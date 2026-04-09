import random
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import smtplib
import ssl
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Awaitable, Callable, Dict, Literal
from uuid import uuid4
from zipfile import ZipFile

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'))

import httpx
import fitz
from backend.domain.coc.core import (
  ActionRequest,
  AdminAssetCreate,
  CharacterCreate,
  CheckResolutionRequest,
  BetaAccessCredential,
  BetaAccessSessionResult,
  BetaEmailOtpSendRequest,
  BetaEmailOtpSendResult,
  BetaEmailOtpVerifyRequest,
  BetaEmailOtpVerifyResult,
  BetaWaitlistRequest,
  BetaWaitlistResult,
  CocCheckRequest,
  CocCheckResult,
  CocAsset,
  CocChatMessage,
  CocClue,
  CocHandout,
  CocLocation,
  CocNpc,
  CocQuest,
  CocScenario,
  CocScene,
  CocSceneItem,
  CocTriggerAction,
  CocTriggerCondition,
  CocTriggerRule,
  ExternalActionRequest,
  ModulePublishRequest,
  Role,
  SessionCreate,
  SkillCheck,
  XPUpdate,
)
from backend.seed_coc_scenario import MODULE_ID as BASELINE_MODULE_ID, write_seed_scenario_to_system
from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# --- DND Rules Constants ---
COC_OCCUPATION_CONFIG = {
    "默认": [
        {"item_ref_id": "base_flashlight", "name": "手电筒", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "普通的便携光源。", "stats": {}},
        {"item_ref_id": "base_notebook", "name": "笔记本和笔", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "用来记录线索。", "stats": {}},
        {"item_ref_id": "base_wallet", "name": "钱包", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "里面有一些零钱和证件。", "stats": {}}
    ],
    "警探": [
        {"item_ref_id": "base_revolver", "name": "左轮手枪", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": ".38口径的警用配枪。", "stats": {"damage": "1d10"}},
        {"item_ref_id": "base_bullets", "name": "子弹", "category": "consumable", "origin": "base", "is_equipped": False, "quantity": 12, "description": ".38口径子弹。", "stats": {}},
        {"item_ref_id": "base_flashlight", "name": "手电筒", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "普通的便携光源。", "stats": {}},
        {"item_ref_id": "base_badge", "name": "警徽", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "身份的象征。", "stats": {}}
    ],
    "医生": [
        {"item_ref_id": "base_medical_kit", "name": "急救包", "category": "consumable", "origin": "base", "is_equipped": False, "quantity": 3, "description": "包含绷带、消毒水和基础药品的急救包。", "stats": {}},
        {"item_ref_id": "base_flashlight", "name": "手电筒", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "普通的便携光源。", "stats": {}}
    ]
}

app = FastAPI()
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"]
)

storage_dir = os.getenv("MODULE_STORAGE_DIR", os.path.join(os.path.dirname(__file__), "storage"))
os.makedirs(storage_dir, exist_ok=True)

IMPORT_STATUS_LABELS = {
  "uploaded": "上传成功",
  "processing": "处理中",
  "completed": "处理完成",
  "failed": "处理失败"
}

IMPORT_STAGE_LABELS = {
  "upload_received": "文件已上传，等待后台处理",
  "dify_uploading": "正在上传文件到 Dify",
  "dify_running": "正在等待 Dify Workflow 结果",
  "fallback_extracting": "正在提取文档文本",
  "fallback_running": "正在执行 fallback 结构化",
  "normalizing": "正在标准化结构化结果",
  "draft_saving": "正在写入 draft 与版本快照",
  "completed": "draft 已生成，可继续编辑",
  "failed": "处理失败"
}

IMPORT_ERROR_LABELS = {
  "dify_upload_failed": "Dify 上传失败",
  "dify_workflow_failed": "Dify 执行失败",
  "structured_result_unrecognized": "结构化结果不可识别",
  "backend_normalization_failed": "后端标准化失败",
  "fallback_processing_failed": "Fallback 处理失败",
  "publish_validation_failed": "发布校验失败"
}

IMPORT_RESULT_SOURCE_LABELS = {
  "dify": "Dify Workflow",
  "openrouter": "OpenRouter 解析",
  "openrouter_fallback": "Fallback 解析"
}

UNSET = object()
BETA_ACCESS_EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)


class ImportPipelineError(Exception):
  def __init__(
    self,
    error_type: str,
    message: str,
    stage: str,
    source: str,
    raw_payload: Any = None,
    fallback_allowed: bool = False
  ):
    super().__init__(message)
    self.error_type = error_type
    self.message = message
    self.stage = stage
    self.source = source
    self.raw_payload = raw_payload
    self.fallback_allowed = fallback_allowed

structured_modules: dict[str, CocScenario] = {}
draft_modules: dict[str, CocScenario] = {}
characters: dict[str, dict] = {}
sessions: dict[str, dict] = {}
session_logs: dict[str, list[CocChatMessage]] = {}
ws_clients: dict[str, set[WebSocket]] = {}

def db_path() -> str:
  return os.path.join(storage_dir, "modules.db")


def location_ref(location: CocLocation) -> str:
  return location.id or location.name


def scene_location_ref(scene: CocScene) -> str | None:
  return scene.location_id


def get_published_scenario(module_id: str) -> CocScenario | None:
  return structured_modules.get(module_id)


def list_published_scenarios() -> list[CocScenario]:
  return [structured_modules[module_id] for module_id in sorted(structured_modules.keys())]


def list_visible_published_scenarios() -> list[CocScenario]:
  module = structured_modules.get(BASELINE_MODULE_ID)
  return [module] if module else []


def list_visible_sessions() -> list[dict[str, Any]]:
  return [
    session
    for session in sessions.values()
    if (session.get("scenario_id") or session.get("module_id")) == BASELINE_MODULE_ID
  ]


def serialize_admin_session(session: dict[str, Any]) -> dict[str, Any]:
  return {
    "id": session.get("id"),
    "user_id": session.get("user_id"),
    "module_id": session.get("module_id") or session.get("scenario_id"),
    "character_id": session.get("character_id") or session.get("investigator_id"),
    "status": session.get("status") or "active",
    "created_at": session.get("created_at") or session.get("started_at"),
    "updated_at": session.get("updated_at")
  }


def build_module_summary(module: CocScenario) -> dict[str, Any]:
  return {
    "id": module.module_id or "",
    "name": module.title,
    "type": module.rule_system,
    "description": module.background,
    "difficulty": "自定义",
    "players": "单人",
    "image": "",
    "publisher": module.source_type or "system",
    "price": "免费",
    "tags": module.themes or ["COC"]
  }


def build_status_track(current: int, maximum: int) -> dict[str, int]:
  return {
    "current": current,
    "maximum": maximum,
  }


def normalize_inventory_items(raw_inventory: Any) -> list[dict[str, Any]]:
  if not isinstance(raw_inventory, list):
    return []
  normalized: list[dict[str, Any]] = []
  for index, raw_item in enumerate(raw_inventory):
    if not isinstance(raw_item, dict):
      continue
    normalized.append({
      "id": raw_item.get("id") or f"item_{index}",
      "name": raw_item.get("name") or "未知物品",
      "description": raw_item.get("description") or "",
      "category": raw_item.get("category") or "tool",
      "origin": raw_item.get("origin") or "custom",
      "quantity": raw_item.get("quantity") or 1,
      "is_equipped": bool(raw_item.get("is_equipped")),
      "stats": raw_item.get("stats") if isinstance(raw_item.get("stats"), dict) else {},
      "linked_clue_id": raw_item.get("linked_clue_id"),
    })
  return normalized


def normalize_character_record(raw_character: dict[str, Any]) -> dict[str, Any]:
  profile = raw_character.get("profile") if isinstance(raw_character.get("profile"), dict) else {}
  characteristics = raw_character.get("characteristics") if isinstance(raw_character.get("characteristics"), dict) else {}
  normalized_profile = {
    "name": profile.get("name") or "无名调查员",
    "occupation": profile.get("occupation"),
    "age": profile.get("age"),
    "residence": profile.get("residence"),
    "birthplace": profile.get("birthplace"),
    "avatar": profile.get("avatar") or "🕵️",
    "backstory": profile.get("backstory"),
  }
  pow_value = characteristics.get("pow") or 0
  raw_status = raw_character.get("status") if isinstance(raw_character.get("status"), dict) else {}
  default_hp = max(1, ((characteristics.get("con") or 0) + (characteristics.get("siz") or 0)) // 10)
  default_mp = max(0, pow_value // 5)
  default_san = max(0, pow_value)
  hp_track = raw_status.get("hp") if isinstance(raw_status.get("hp"), dict) else build_status_track(default_hp, default_hp)
  mp_track = raw_status.get("mp") if isinstance(raw_status.get("mp"), dict) else build_status_track(default_mp, default_mp)
  san_track = raw_status.get("san") if isinstance(raw_status.get("san"), dict) else build_status_track(default_san, default_san)
  status = {
    "hp": hp_track,
    "mp": mp_track,
    "san": san_track,
    "conditions": raw_status.get("conditions") if isinstance(raw_status.get("conditions"), list) else [],
    "flags": raw_status.get("flags") if isinstance(raw_status.get("flags"), dict) else {},
  }
  return {
    "id": raw_character.get("id"),
    "rule_system": "coc",
    "profile": normalized_profile,
    "characteristics": characteristics,
    "skills": raw_character.get("skills") if isinstance(raw_character.get("skills"), dict) else {},
    "inventory": normalize_inventory_items(raw_character.get("inventory")),
    "status": status,
    "created_at": raw_character.get("created_at") or now_iso(),
    "tags": raw_character.get("tags") if isinstance(raw_character.get("tags"), list) else [],
    "extra": raw_character.get("extra") if isinstance(raw_character.get("extra"), dict) else {},
  }


def save_character_to_db(character_data: dict) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into characters (id, name, data, created_at) values (?, ?, ?, ?) "
      "on conflict(id) do update set name=excluded.name, data=excluded.data, created_at=excluded.created_at",
      (
        character_data["id"],
        character_data["profile"]["name"],
        json.dumps(character_data, ensure_ascii=False),
        character_data["created_at"]
      )
    )
    conn.commit()


def load_characters_from_db() -> None:
  with sqlite3.connect(db_path()) as conn:
    try:
      rows = conn.execute("select id, data from characters").fetchall()
      for char_id, data in rows:
        try:
          characters[char_id] = normalize_character_record(json.loads(data))
        except json.JSONDecodeError:
          continue
    except sqlite3.OperationalError:
      # Table might not exist yet
      pass


def now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def summarize_import_payload(payload: Any, limit: int = 320) -> str | None:
  if payload is None:
    return None
  if isinstance(payload, str):
    text = " ".join(payload.split())
  else:
    try:
      text = json.dumps(payload, ensure_ascii=False, default=str)
    except TypeError:
      text = str(payload)
  return text if len(text) <= limit else f"{text[:limit]}..."


def unwrap_import_raw_output(raw_output: Any) -> tuple[dict[str, Any], Any]:
  if isinstance(raw_output, dict) and set(raw_output.keys()).issubset({"meta", "payload"}):
    meta = raw_output.get("meta") if isinstance(raw_output.get("meta"), dict) else {}
    return meta, raw_output.get("payload")
  return {}, raw_output


def wrap_import_raw_output(payload: Any, meta: dict[str, Any]) -> dict[str, Any]:
  return {
    "meta": meta,
    "payload": payload
  }


def update_import_task_runtime(
  task: dict[str, Any],
  *,
  status: Any = UNSET,
  stage: Any = UNSET,
  raw_output: Any = UNSET,
  normalized_output: Any = UNSET,
  error_message: Any = UNSET,
  error_type: Any = UNSET,
  result_source: Any = UNSET,
  output_summary: Any = UNSET,
  next_action: Any = UNSET,
  draft_version: Any = UNSET,
  fallback_from: Any = UNSET
) -> None:
  meta, payload = unwrap_import_raw_output(task.get("raw_output"))
  if raw_output is not UNSET:
    payload = raw_output
    meta["raw_output_summary"] = summarize_import_payload(raw_output)
  elif payload is not None and "raw_output_summary" not in meta:
    meta["raw_output_summary"] = summarize_import_payload(payload)
  if status is not UNSET:
    task["status"] = status
  if normalized_output is not UNSET:
    task["normalized_output"] = normalized_output
  if error_message is not UNSET:
    task["error_message"] = error_message
  if stage is not UNSET:
    meta["stage"] = stage
  if error_type is not UNSET:
    meta["error_type"] = error_type
  if result_source is not UNSET:
    meta["result_source"] = result_source
  if output_summary is not UNSET:
    meta["output_summary"] = output_summary
  if next_action is not UNSET:
    meta["next_action"] = next_action
  if draft_version is not UNSET:
    meta["draft_version"] = draft_version
  if fallback_from is not UNSET:
    meta["fallback_from"] = fallback_from
  task["updated_at"] = now_iso()
  meta["updated_at"] = task["updated_at"]
  task["raw_output"] = wrap_import_raw_output(payload, meta)


def serialize_import_task(task: dict[str, Any], include_payload: bool = True) -> dict[str, Any]:
  meta, raw_payload = unwrap_import_raw_output(task.get("raw_output"))
  status = task["status"]
  stage = meta.get("stage") or status
  error_type = meta.get("error_type")
  result_source = meta.get("result_source")
  data = {
    "task_id": task["task_id"],
    "module_id": task["module_id"],
    "source_file_name": task["source_file_name"],
    "source_file_type": task["source_file_type"],
    "parser_type": task["parser_type"],
    "parser_version": task["parser_version"],
    "status": status,
    "status_label": IMPORT_STATUS_LABELS.get(status, status),
    "stage": stage,
    "stage_label": IMPORT_STAGE_LABELS.get(stage, stage),
    "result_source": result_source,
    "result_source_label": IMPORT_RESULT_SOURCE_LABELS.get(result_source),
    "error_type": error_type,
    "error_label": IMPORT_ERROR_LABELS.get(error_type),
    "error_message": task.get("error_message"),
    "output_summary": meta.get("output_summary"),
    "raw_output_summary": meta.get("raw_output_summary"),
    "next_action": meta.get("next_action"),
    "fallback_from": meta.get("fallback_from"),
    "draft_version": meta.get("draft_version"),
    "created_at": task["created_at"],
    "updated_at": task["updated_at"],
    "draft_ready": status == "completed" and task.get("normalized_output") is not None,
    "can_open_editor": task.get("normalized_output") is not None
  }
  if include_payload:
    data["raw_output"] = raw_payload
    data["normalized_output"] = task.get("normalized_output")
  return data


def init_db() -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "create table if not exists structured_modules (module_id text primary key, data text not null, updated_at text not null)"
    )
    conn.execute(
      "create table if not exists structured_module_drafts (module_id text primary key, data text not null, updated_at text not null)"
    )
    conn.execute(
      "create table if not exists structured_module_versions (version_id text primary key, module_id text not null, status text not null, note text, data text not null, created_at text not null)"
    )
    conn.execute(
      "create table if not exists module_import_tasks (task_id text primary key, module_id text not null, source_file_name text not null, source_file_type text not null, parser_type text not null, parser_version text not null, status text not null, raw_output text, normalized_output text, error_message text, created_at text not null, updated_at text not null)"
    )
    conn.execute(
      "create table if not exists characters (id text primary key, name text not null, data text not null, created_at text not null)"
    )
    conn.execute(
      "create table if not exists beta_access_emails (email text primary key, is_verified integer not null default 0, first_verified_at text, last_verified_at text, last_login_at text, last_otp_requested_at text, last_otp_sent_at text, last_waitlist_at text, waitlist_status text, created_at text not null, updated_at text not null)"
    )
    conn.execute(
      "create table if not exists beta_access_otps (otp_id text primary key, email text not null, code_hash text not null, status text not null, expires_at text not null, requested_at text not null, sent_at text, verified_at text, superseded_at text, failure_reason text, attempt_count integer not null default 0)"
    )
    conn.execute(
      "create table if not exists beta_access_tokens (token_id text primary key, email text not null, token_hash text not null unique, status text not null, created_at text not null, expires_at text not null, last_used_at text, revoked_at text)"
    )
    conn.execute(
      "create table if not exists beta_waitlist (email text primary key, status text not null, source_status text, first_requested_at text not null, last_requested_at text not null, created_at text not null, updated_at text not null)"
    )
    conn.commit()


def load_structured_modules() -> None:
  structured_modules.clear()
  draft_modules.clear()
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute("select module_id, data from structured_modules").fetchall()
    for module_id, data in rows:
      try:
        payload = json.loads(data)
        payload.setdefault("module_id", module_id)
        payload.setdefault("status", "published")
        structured = CocScenario.model_validate(payload)
        structured_modules[module_id] = structured
      except json.JSONDecodeError:
        continue
    draft_rows = conn.execute("select module_id, data from structured_module_drafts").fetchall()
    for module_id, data in draft_rows:
      try:
        payload = json.loads(data)
        payload.setdefault("module_id", module_id)
        payload.setdefault("status", "draft")
        draft_modules[module_id] = CocScenario.model_validate(payload)
      except json.JSONDecodeError:
        continue

def save_structured_module(module_id: str, module: CocScenario) -> None:
  normalized = module.model_copy(update={"module_id": module_id, "status": "published"})
  payload = json.dumps(normalized.model_dump(), ensure_ascii=False)
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into structured_modules (module_id, data, updated_at) values (?, ?, ?) on conflict(module_id) do update set data=excluded.data, updated_at=excluded.updated_at",
      (module_id, payload, now_iso())
    )
    conn.commit()


def save_module_draft(module_id: str, module: CocScenario) -> None:
  normalized = module.model_copy(update={"module_id": module_id, "status": "draft"})
  draft_modules[module_id] = normalized
  payload = json.dumps(normalized.model_dump(), ensure_ascii=False)
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into structured_module_drafts (module_id, data, updated_at) values (?, ?, ?) on conflict(module_id) do update set data=excluded.data, updated_at=excluded.updated_at",
      (module_id, payload, now_iso())
    )
    conn.commit()


def get_module_draft(module_id: str) -> CocScenario | None:
  draft = draft_modules.get(module_id)
  if draft:
    return draft
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute(
      "select data from structured_module_drafts where module_id = ?",
      (module_id,)
    ).fetchone()
  if not row:
    return None
  payload = json.loads(row[0])
  payload.setdefault("module_id", module_id)
  payload.setdefault("status", "draft")
  draft = CocScenario.model_validate(payload)
  draft_modules[module_id] = draft
  return draft


def list_module_versions(module_id: str) -> list[dict[str, Any]]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute(
      "select version_id, status, note, created_at, data from structured_module_versions where module_id = ? order by created_at desc",
      (module_id,)
    ).fetchall()
  items = []
  for version_id, status, note, created_at, data in rows:
    parsed = json.loads(data)
    items.append({
      "version_id": version_id,
      "status": status,
      "note": note,
      "created_at": created_at,
      "title": parsed.get("title"),
      "schema_version": parsed.get("schema_version"),
      "rule_system": parsed.get("rule_system")
    })
  return items


def create_module_version(module_id: str, module: CocScenario, status: str, note: str | None = None) -> dict[str, Any]:
  version_id = f"ver_{uuid4().hex[:10]}"
  created_at = now_iso()
  snapshot = module.model_copy(update={"module_id": module_id, "status": status})
  payload = json.dumps(snapshot.model_dump(), ensure_ascii=False)
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into structured_module_versions (version_id, module_id, status, note, data, created_at) values (?, ?, ?, ?, ?, ?)",
      (version_id, module_id, status, note, payload, created_at)
    )
    conn.commit()
  return {
    "version_id": version_id,
    "status": status,
    "note": note,
    "created_at": created_at,
    "title": snapshot.title,
    "schema_version": snapshot.schema_version,
    "rule_system": snapshot.rule_system
  }


def save_import_task(task: dict[str, Any]) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into module_import_tasks (task_id, module_id, source_file_name, source_file_type, parser_type, parser_version, status, raw_output, normalized_output, error_message, created_at, updated_at) "
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
      "on conflict(task_id) do update set module_id=excluded.module_id, source_file_name=excluded.source_file_name, source_file_type=excluded.source_file_type, parser_type=excluded.parser_type, parser_version=excluded.parser_version, status=excluded.status, raw_output=excluded.raw_output, normalized_output=excluded.normalized_output, error_message=excluded.error_message, updated_at=excluded.updated_at",
      (
        task["task_id"],
        task["module_id"],
        task["source_file_name"],
        task["source_file_type"],
        task["parser_type"],
        task["parser_version"],
        task["status"],
        json.dumps(task.get("raw_output"), ensure_ascii=False) if task.get("raw_output") is not None else None,
        json.dumps(task.get("normalized_output"), ensure_ascii=False) if task.get("normalized_output") is not None else None,
        task.get("error_message"),
        task["created_at"],
        task["updated_at"]
      )
    )
    conn.commit()


def load_import_task_record(task_id: str) -> dict[str, Any] | None:
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute(
      "select task_id, module_id, source_file_name, source_file_type, parser_type, parser_version, status, raw_output, normalized_output, error_message, created_at, updated_at from module_import_tasks where task_id = ?",
      (task_id,)
    ).fetchone()
  if not row:
    return None
  raw_output = json.loads(row[7]) if row[7] else None
  normalized_output = json.loads(row[8]) if row[8] else None
  return {
    "task_id": row[0],
    "module_id": row[1],
    "source_file_name": row[2],
    "source_file_type": row[3],
    "parser_type": row[4],
    "parser_version": row[5],
    "status": row[6],
    "raw_output": raw_output,
    "normalized_output": normalized_output,
    "error_message": row[9],
    "created_at": row[10],
    "updated_at": row[11]
  }


def get_import_task(task_id: str) -> dict[str, Any] | None:
  task = load_import_task_record(task_id)
  if not task:
    return None
  return serialize_import_task(task)


def list_module_import_tasks(module_id: str, limit: int = 10) -> list[dict[str, Any]]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute(
      "select task_id, module_id, source_file_name, source_file_type, parser_type, parser_version, status, raw_output, normalized_output, error_message, created_at, updated_at from module_import_tasks where module_id = ? order by created_at desc limit ?",
      (module_id, limit)
    ).fetchall()
  items = []
  for row in rows:
    items.append(serialize_import_task({
      "task_id": row[0],
      "module_id": row[1],
      "source_file_name": row[2],
      "source_file_type": row[3],
      "parser_type": row[4],
      "parser_version": row[5],
      "status": row[6],
      "raw_output": json.loads(row[7]) if row[7] else None,
      "normalized_output": json.loads(row[8]) if row[8] else None,
      "error_message": row[9],
      "created_at": row[10],
      "updated_at": row[11]
    }, include_payload=False))
  return items


def get_module_draft_updated_at_map() -> dict[str, str]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute("select module_id, updated_at from structured_module_drafts").fetchall()
  return {module_id: updated_at for module_id, updated_at in rows}


def get_module_version_count_map() -> dict[str, int]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute("select module_id, count(*) from structured_module_versions group by module_id").fetchall()
  return {module_id: count for module_id, count in rows}


def get_latest_import_summary_map() -> dict[str, dict[str, Any]]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute(
      "select task_id, module_id, source_file_name, source_file_type, parser_type, parser_version, status, raw_output, normalized_output, error_message, created_at, updated_at from module_import_tasks order by created_at desc"
    ).fetchall()
  summary_map: dict[str, dict[str, Any]] = {}
  for row in rows:
    module_id = row[1]
    if module_id in summary_map:
      continue
    summary_map[module_id] = serialize_import_task({
      "task_id": row[0],
      "module_id": row[1],
      "source_file_name": row[2],
      "source_file_type": row[3],
      "parser_type": row[4],
      "parser_version": row[5],
      "status": row[6],
      "raw_output": json.loads(row[7]) if row[7] else None,
      "normalized_output": json.loads(row[8]) if row[8] else None,
      "error_message": row[9],
      "created_at": row[10],
      "updated_at": row[11]
    }, include_payload=False)
  return summary_map


def env_int(name: str, default: int, minimum: int = 1) -> int:
  raw_value = os.getenv(name, str(default)).strip()
  try:
    parsed = int(raw_value)
  except ValueError:
    return default
  return max(minimum, parsed)


def beta_access_email_limit() -> int:
  return env_int("BETA_ACCESS_EMAIL_LIMIT", 100)


def beta_access_otp_ttl_seconds() -> int:
  return env_int("BETA_ACCESS_OTP_TTL_SECONDS", 600)


def beta_access_otp_resend_cooldown_seconds() -> int:
  return env_int("BETA_ACCESS_OTP_RESEND_COOLDOWN_SECONDS", 60)


def beta_access_otp_send_window_seconds() -> int:
  return env_int("BETA_ACCESS_OTP_SEND_WINDOW_SECONDS", 3600)


def beta_access_otp_send_limit_per_window() -> int:
  return env_int("BETA_ACCESS_OTP_SEND_LIMIT_PER_WINDOW", 5)


def beta_access_token_ttl_days() -> int:
  return env_int("BETA_ACCESS_TOKEN_TTL_DAYS", 30)


def future_iso(*, seconds: int = 0, days: int = 0) -> str:
  return (datetime.now(timezone.utc) + timedelta(seconds=seconds, days=days)).isoformat()


def hash_secret(value: str) -> str:
  return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_beta_email(email: str) -> str:
  normalized = email.strip().lower()
  if not normalized or not BETA_ACCESS_EMAIL_PATTERN.fullmatch(normalized):
    raise HTTPException(status_code=400, detail="邮箱格式无效")
  return normalized


def beta_access_otp_subject() -> str:
  subject = os.getenv("EMAIL_OTP_SUBJECT", "Dice Tales 内测验证码").strip()
  return subject or "Dice Tales 内测验证码"


def parse_iso_datetime(value: str) -> datetime | None:
  try:
    parsed = datetime.fromisoformat(value)
  except ValueError:
    return None
  if parsed.tzinfo is None:
    return parsed.replace(tzinfo=timezone.utc)
  return parsed


def seconds_until_datetime(target: datetime | None) -> int | None:
  if target is None:
    return None
  remaining = (target - datetime.now(timezone.utc)).total_seconds()
  if remaining <= 0:
    return 0
  return math.ceil(remaining)


def get_beta_access_email_record(email: str) -> dict[str, Any] | None:
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute(
      "select email, is_verified, first_verified_at, last_verified_at, last_login_at, last_otp_requested_at, last_otp_sent_at, last_waitlist_at, waitlist_status, created_at, updated_at from beta_access_emails where email = ?",
      (email,)
    ).fetchone()
  if not row:
    return None
  return {
    "email": row[0],
    "is_verified": bool(row[1]),
    "first_verified_at": row[2],
    "last_verified_at": row[3],
    "last_login_at": row[4],
    "last_otp_requested_at": row[5],
    "last_otp_sent_at": row[6],
    "last_waitlist_at": row[7],
    "waitlist_status": row[8],
    "created_at": row[9],
    "updated_at": row[10]
  }


def ensure_beta_access_email_record(email: str) -> dict[str, Any]:
  existing = get_beta_access_email_record(email)
  if existing:
    return existing
  created_at = now_iso()
  return {
    "email": email,
    "is_verified": False,
    "first_verified_at": None,
    "last_verified_at": None,
    "last_login_at": None,
    "last_otp_requested_at": None,
    "last_otp_sent_at": None,
    "last_waitlist_at": None,
    "waitlist_status": None,
    "created_at": created_at,
    "updated_at": created_at
  }


def save_beta_access_email_record(record: dict[str, Any]) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into beta_access_emails (email, is_verified, first_verified_at, last_verified_at, last_login_at, last_otp_requested_at, last_otp_sent_at, last_waitlist_at, waitlist_status, created_at, updated_at) "
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
      "on conflict(email) do update set is_verified=excluded.is_verified, first_verified_at=excluded.first_verified_at, last_verified_at=excluded.last_verified_at, last_login_at=excluded.last_login_at, last_otp_requested_at=excluded.last_otp_requested_at, last_otp_sent_at=excluded.last_otp_sent_at, last_waitlist_at=excluded.last_waitlist_at, waitlist_status=excluded.waitlist_status, created_at=excluded.created_at, updated_at=excluded.updated_at",
      (
        record["email"],
        1 if record["is_verified"] else 0,
        record["first_verified_at"],
        record["last_verified_at"],
        record["last_login_at"],
        record["last_otp_requested_at"],
        record["last_otp_sent_at"],
        record["last_waitlist_at"],
        record["waitlist_status"],
        record["created_at"],
        record["updated_at"]
      )
    )
    conn.commit()


def count_verified_beta_access_emails() -> int:
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute("select count(*) from beta_access_emails where is_verified = 1").fetchone()
  return int(row[0]) if row else 0


def get_beta_access_resend_available_in_seconds(access_record: dict[str, Any]) -> int:
  cooldown_seconds = max(0, beta_access_otp_resend_cooldown_seconds())
  if cooldown_seconds <= 0:
    return 0
  last_sent_at = parse_iso_datetime(access_record.get("last_otp_sent_at") or "")
  if last_sent_at is None:
    return 0
  remaining = seconds_until_datetime(last_sent_at + timedelta(seconds=cooldown_seconds))
  return remaining or 0


def create_beta_access_otp(email: str, code: str) -> dict[str, Any]:
  otp_id = f"otp_{uuid4().hex[:12]}"
  requested_at = now_iso()
  expires_at = future_iso(seconds=beta_access_otp_ttl_seconds())
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_otps set status = 'superseded', superseded_at = ?, failure_reason = coalesce(failure_reason, 'replaced_by_new_code') where email = ? and status in ('pending', 'sent')",
      (requested_at, email)
    )
    conn.execute(
      "insert into beta_access_otps (otp_id, email, code_hash, status, expires_at, requested_at, sent_at, verified_at, superseded_at, failure_reason, attempt_count) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      (otp_id, email, hash_secret(code), "pending", expires_at, requested_at, None, None, None, None, 0)
    )
    conn.commit()
  return {
    "otp_id": otp_id,
    "email": email,
    "status": "pending",
    "expires_at": expires_at,
    "requested_at": requested_at
  }


def mark_beta_access_otp_sent(otp_id: str) -> None:
  sent_at = now_iso()
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_otps set status = 'sent', sent_at = ? where otp_id = ? and status = 'pending'",
      (sent_at, otp_id)
    )
    conn.commit()


def mark_beta_access_otp_failed(otp_id: str, failure_reason: str) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_otps set status = 'failed', failure_reason = ? where otp_id = ?",
      (failure_reason, otp_id)
    )
    conn.commit()


def get_latest_active_beta_access_otp(email: str) -> dict[str, Any] | None:
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute(
      "select otp_id, email, code_hash, status, expires_at, requested_at, sent_at, verified_at, superseded_at, failure_reason, attempt_count from beta_access_otps where email = ? and status in ('pending', 'sent') order by requested_at desc limit 1",
      (email,)
    ).fetchone()
  if not row:
    return None
  return {
    "otp_id": row[0],
    "email": row[1],
    "code_hash": row[2],
    "status": row[3],
    "expires_at": row[4],
    "requested_at": row[5],
    "sent_at": row[6],
    "verified_at": row[7],
    "superseded_at": row[8],
    "failure_reason": row[9],
    "attempt_count": row[10]
  }


def get_beta_access_active_otp_remaining_seconds(email: str) -> int | None:
  otp_record = get_latest_active_beta_access_otp(email)
  if not otp_record:
    return None
  expires_at = parse_iso_datetime(otp_record["expires_at"])
  remaining = seconds_until_datetime(expires_at)
  if remaining is None or remaining <= 0:
    mark_beta_access_otp_expired(otp_record["otp_id"])
    return None
  return remaining


def list_beta_access_recent_sent_timestamps(email: str, *, window_seconds: int) -> list[str]:
  cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute(
      "select sent_at from beta_access_otps where email = ? and sent_at is not null and sent_at >= ? order by sent_at asc",
      (email, cutoff)
    ).fetchall()
  return [row[0] for row in rows if row[0]]


def increment_beta_access_otp_attempt(otp_id: str) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_otps set attempt_count = attempt_count + 1 where otp_id = ?",
      (otp_id,)
    )
    conn.commit()


def mark_beta_access_otp_expired(otp_id: str) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_otps set status = 'expired' where otp_id = ? and status in ('pending', 'sent')",
      (otp_id,)
    )
    conn.commit()


def mark_beta_access_otp_verified(otp_id: str) -> None:
  verified_at = now_iso()
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_otps set status = 'verified', verified_at = ? where otp_id = ? and status in ('pending', 'sent')",
      (verified_at, otp_id)
    )
    conn.commit()


def deliver_email_otp(email: str, code: str, expires_in_seconds: int) -> None:
  smtp_host = os.getenv("EMAIL_OTP_SMTP_HOST", "").strip()
  smtp_port = env_int("EMAIL_OTP_SMTP_PORT", 587)
  smtp_username = os.getenv("EMAIL_OTP_SMTP_USERNAME", "").strip()
  smtp_password = os.getenv("EMAIL_OTP_SMTP_PASSWORD", "")
  smtp_from = os.getenv("EMAIL_OTP_FROM", smtp_username).strip()
  use_ssl = os.getenv("EMAIL_OTP_SMTP_USE_SSL", "false").strip().lower() == "true"
  use_tls = os.getenv("EMAIL_OTP_SMTP_USE_TLS", "true").strip().lower() != "false"
  if not smtp_host or not smtp_from:
    raise RuntimeError("email_delivery_not_configured")
  message = EmailMessage()
  message["Subject"] = beta_access_otp_subject()
  message["From"] = smtp_from
  message["To"] = email
  expire_minutes = max(1, (expires_in_seconds + 59) // 60)
  message.set_content(
    f"你的 Dice Tales 内测验证码是 {code}。\n\n"
    f"验证码将在 {expire_minutes} 分钟后失效。"
  )
  try:
    if use_ssl:
      with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as client:
        if smtp_username:
          client.login(smtp_username, smtp_password)
        client.send_message(message)
      return
    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as client:
      if use_tls:
        client.starttls(context=ssl.create_default_context())
      if smtp_username:
        client.login(smtp_username, smtp_password)
      client.send_message(message)
  except Exception as exc:
    raise RuntimeError("email_delivery_failed") from exc


def issue_beta_access_token(email: str) -> dict[str, str]:
  token_id = f"token_{uuid4().hex[:12]}"
  token = f"beta_{secrets.token_urlsafe(32)}"
  created_at = now_iso()
  expires_at = future_iso(days=beta_access_token_ttl_days())
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_tokens set status = 'revoked', revoked_at = ? where email = ? and status = 'active'",
      (created_at, email)
    )
    conn.execute(
      "insert into beta_access_tokens (token_id, email, token_hash, status, created_at, expires_at, last_used_at, revoked_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      (token_id, email, hash_secret(token), "active", created_at, expires_at, created_at, None)
    )
    conn.commit()
  return {"token": token, "expires_at": expires_at}


def get_beta_access_token_record(token: str) -> dict[str, Any] | None:
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute(
      "select token_id, email, status, created_at, expires_at, last_used_at, revoked_at from beta_access_tokens where token_hash = ?",
      (hash_secret(token),)
    ).fetchone()
  if not row:
    return None
  return {
    "token_id": row[0],
    "email": row[1],
    "status": row[2],
    "created_at": row[3],
    "expires_at": row[4],
    "last_used_at": row[5],
    "revoked_at": row[6]
  }


def touch_beta_access_token(token_id: str) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_tokens set last_used_at = ? where token_id = ? and status = 'active'",
      (now_iso(), token_id)
    )
    conn.commit()


def mark_beta_access_token_expired(token_id: str) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "update beta_access_tokens set status = 'expired', revoked_at = ? where token_id = ? and status = 'active'",
      (now_iso(), token_id)
    )
    conn.commit()


def extract_bearer_token(authorization: str | None) -> str | None:
  if not authorization:
    return None
  scheme, _, value = authorization.partition(" ")
  if scheme.lower() != "bearer":
    return None
  token = value.strip()
  return token or None


def require_beta_access_token(authorization: str | None) -> dict[str, Any]:
  token = extract_bearer_token(authorization)
  if not token or not token.startswith("beta_"):
    raise HTTPException(status_code=401, detail="未通过内测准入验证")
  token_record = get_beta_access_token_record(token)
  if not token_record or token_record["status"] != "active":
    raise HTTPException(status_code=401, detail="未通过内测准入验证")
  expires_at = parse_iso_datetime(token_record["expires_at"])
  if expires_at is None or expires_at <= datetime.now(timezone.utc):
    mark_beta_access_token_expired(token_record["token_id"])
    raise HTTPException(status_code=401, detail="内测准入凭证已过期")
  access_record = get_beta_access_email_record(token_record["email"])
  if not access_record or not access_record["is_verified"]:
    raise HTTPException(status_code=401, detail="未通过内测准入验证")
  touch_beta_access_token(token_record["token_id"])
  return token_record


def get_beta_waitlist_entry(email: str) -> dict[str, Any] | None:
  with sqlite3.connect(db_path()) as conn:
    row = conn.execute(
      "select email, status, source_status, first_requested_at, last_requested_at, created_at, updated_at from beta_waitlist where email = ?",
      (email,)
    ).fetchone()
  if not row:
    return None
  return {
    "email": row[0],
    "status": row[1],
    "source_status": row[2],
    "first_requested_at": row[3],
    "last_requested_at": row[4],
    "created_at": row[5],
    "updated_at": row[6]
  }


def upsert_beta_waitlist_entry(email: str, source_status: str | None) -> bool:
  existing = get_beta_waitlist_entry(email)
  created = existing is None
  requested_at = now_iso()
  final_source_status = source_status or (existing.get("source_status") if existing else None) or "beta_capacity_full"
  first_requested_at = existing["first_requested_at"] if existing else requested_at
  created_at = existing["created_at"] if existing else requested_at
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into beta_waitlist (email, status, source_status, first_requested_at, last_requested_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?) "
      "on conflict(email) do update set status=excluded.status, source_status=excluded.source_status, last_requested_at=excluded.last_requested_at, updated_at=excluded.updated_at",
      (email, "active", final_source_status, first_requested_at, requested_at, created_at, requested_at)
    )
    conn.commit()
  return created


def list_beta_access_email_records() -> list[dict[str, Any]]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute(
      "select email, is_verified, first_verified_at, last_verified_at, last_login_at, last_otp_requested_at, last_otp_sent_at, last_waitlist_at, waitlist_status, created_at, updated_at "
      "from beta_access_emails "
      "order by is_verified desc, coalesce(last_login_at, last_verified_at, updated_at) desc, email asc"
    ).fetchall()
  return [{
    "email": row[0],
    "is_verified": bool(row[1]),
    "first_verified_at": row[2],
    "last_verified_at": row[3],
    "last_login_at": row[4],
    "last_otp_requested_at": row[5],
    "last_otp_sent_at": row[6],
    "last_waitlist_at": row[7],
    "waitlist_status": row[8],
    "created_at": row[9],
    "updated_at": row[10]
  } for row in rows]


def list_beta_waitlist_entries() -> list[dict[str, Any]]:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute(
      "select email, status, source_status, first_requested_at, last_requested_at, created_at, updated_at "
      "from beta_waitlist "
      "order by case when status = 'active' then 0 else 1 end, last_requested_at desc, email asc"
    ).fetchall()
  return [{
    "email": row[0],
    "status": row[1],
    "source_status": row[2],
    "first_requested_at": row[3],
    "last_requested_at": row[4],
    "created_at": row[5],
    "updated_at": row[6]
  } for row in rows]


def beta_access_rate_limited_response(
  *,
  email: str,
  detail: str,
  retry_after_seconds: int,
  active_code_expires_in_seconds: int | None
) -> JSONResponse:
  retry_after = max(1, retry_after_seconds)
  return JSONResponse(
    status_code=429,
    headers={"Retry-After": str(retry_after)},
    content={
      "detail": detail,
      "status": "rate_limited",
      "email": email,
      "resend_available_in_seconds": retry_after,
      "expires_in_seconds": active_code_expires_in_seconds,
      "active_code_available": bool(active_code_expires_in_seconds)
    }
  )


def extract_pdf_text(path: str) -> str:
  doc = fitz.open(path)
  try:
    chunks = [page.get_text("text") for page in doc]
  finally:
    doc.close()
  text = "\n".join(chunks)
  return " ".join(text.split())


def extract_docx_text(path: str) -> str:
  try:
    with zipfile.ZipFile(path) as archive:
      data = archive.read("word/document.xml")
  except (KeyError, zipfile.BadZipFile):
    raise HTTPException(status_code=400, detail="DOCX解析失败")
  ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
  root = ET.fromstring(data)
  paragraphs: list[str] = []
  for paragraph in root.findall(".//w:p", ns):
    text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
    if text:
      paragraphs.append(text)
  return "\n".join(paragraphs)


def infer_source_type(filename: str) -> str:
  suffix = os.path.splitext(filename)[1].lower()
  return suffix.lstrip(".") or "unknown"


def parse_embedded_json(value: Any, fallback: Any):
  if isinstance(value, (dict, list)):
    return value
  if isinstance(value, str):
    text = value.strip()
    if not text:
      return fallback
    try:
      return json.loads(text)
    except json.JSONDecodeError:
      return fallback
  return fallback


def coerce_workflow_structured_data(data: dict[str, Any]) -> dict[str, Any]:
  data["extensions"] = parse_embedded_json(data.get("extensions"), {})
  data["custom_types"] = parse_embedded_json(data.get("custom_types"), [])

  for collection_name in ("locations", "npcs", "events", "quests", "sequence", "clues", "handouts", "scene_items", "assets", "triggers"):
    items = data.get(collection_name)
    if not isinstance(items, list):
      continue
    for item in items:
      if not isinstance(item, dict):
        continue
      item["extra"] = parse_embedded_json(item.get("extra"), {})

  for trigger in data.get("triggers", []) if isinstance(data.get("triggers"), list) else []:
    if not isinstance(trigger, dict):
      continue
    conditions = trigger.get("conditions")
    if isinstance(conditions, list):
      for condition in conditions:
        if isinstance(condition, dict):
          condition["extra"] = parse_embedded_json(condition.get("extra"), {})
    actions = trigger.get("actions")
    if isinstance(actions, list):
      for action in actions:
        if isinstance(action, dict):
          action["extra"] = parse_embedded_json(action.get("extra"), {})
          action["payload"] = parse_embedded_json(action.get("payload"), {})
  return data


def normalize_location_ids(data: dict[str, Any]) -> None:
  location_id_map: dict[str, str] = {}
  for index, location in enumerate(data.get("locations", []) if isinstance(data.get("locations"), list) else []):
    if not isinstance(location, dict):
      continue
    location_id = str(location.get("id") or location.get("name") or f"location_{index}")
    location["id"] = location_id
    location_id_map[str(location.get("name") or location_id)] = location_id
    location_id_map[location_id] = location_id

  for index, scene in enumerate(data.get("sequence", []) if isinstance(data.get("sequence"), list) else []):
    if not isinstance(scene, dict):
      continue
    scene["id"] = str(scene.get("id") or f"scene_{index}")
    scene_location_id = scene.get("location_id")
    if scene_location_id is not None:
      scene["location_id"] = location_id_map.get(str(scene_location_id), str(scene_location_id))
    scene.setdefault("order", index)

  for index, scene_item in enumerate(data.get("scene_items", []) if isinstance(data.get("scene_items"), list) else []):
    if not isinstance(scene_item, dict):
      continue
    scene_item["id"] = str(scene_item.get("id") or f"item_{index}")
    item_location_id = scene_item.get("location_id")
    if item_location_id is not None:
      scene_item["location_id"] = location_id_map.get(str(item_location_id), str(item_location_id))


def ensure_scene_sequence(data: dict[str, Any]) -> None:
  sequence = data.get("sequence")
  if isinstance(sequence, list) and sequence:
    return
  generated_sequence = []
  for index, location in enumerate(data.get("locations", []) if isinstance(data.get("locations"), list) else []):
    if not isinstance(location, dict):
      continue
    location_id = str(location.get("id") or location.get("name") or f"location_{index}")
    generated_sequence.append({
      "id": f"scene_{location_id}",
      "title": str(location.get("name") or f"场景{index + 1}"),
      "location_id": location_id,
      "order": index,
      "description": str(location.get("description") or ""),
      "prerequisites": [generated_sequence[-1]["id"]] if generated_sequence else [],
      "tags": [],
      "extra": {}
    })
  data["sequence"] = generated_sequence


def normalize_structured_module(module_id: str, payload: dict[str, Any] | CocScenario, source_type: str, status: Literal["draft", "published"]) -> CocScenario:
  if isinstance(payload, CocScenario):
    data = payload.model_dump()
  else:
    data = dict(payload)
  data = coerce_workflow_structured_data(data)
  data.setdefault("title", module_id)
  data.setdefault("background", "")
  data.setdefault("locations", [])
  data.setdefault("npcs", [])
  data.setdefault("events", [])
  data.setdefault("quests", [])
  data.setdefault("sequence", [])
  data.setdefault("triggers", [])
  data.setdefault("clues", [])
  data.setdefault("handouts", [])
  data.setdefault("scene_items", [])
  data.setdefault("assets", [])
  data.setdefault("themes", [])
  data.setdefault("extensions", {})
  data.setdefault("custom_types", [])
  data["module_id"] = module_id
  data["source_type"] = source_type
  data["status"] = status
  data["rule_system"] = "coc"
  data["schema_version"] = max(int(data.get("schema_version", 3) or 3), 3)
  normalize_location_ids(data)
  ensure_scene_sequence(data)
  return CocScenario.model_validate(data)


def resolve_structured_candidate(value: Any) -> dict[str, Any] | None:
  if isinstance(value, CocScenario):
    return value.model_dump()
  if isinstance(value, dict):
    if "title" in value and "background" in value:
      return value
    for preferred_key in ("structured_output", "structured", "module", "result", "json"):
      if preferred_key in value:
        resolved = resolve_structured_candidate(value[preferred_key])
        if resolved:
          return resolved
    for nested in value.values():
      resolved = resolve_structured_candidate(nested)
      if resolved:
        return resolved
  if isinstance(value, str):
    text = value.strip()
    if not text:
      return None
    try:
      parsed = parse_json_block(text)
    except HTTPException:
      return None
    return resolve_structured_candidate(parsed)
  return None


def resolve_dify_structured_output(workflow_response: dict[str, Any]) -> dict[str, Any]:
  data = workflow_response.get("data", workflow_response)
  outputs = data.get("outputs", {}) if isinstance(data, dict) else {}
  candidate = resolve_structured_candidate(outputs) or resolve_structured_candidate(data)
  if not candidate:
    raise HTTPException(status_code=502, detail="Dify未返回可识别的结构化结果")
  return candidate


async def run_dify_import(
  module_id: str,
  filename: str,
  content: bytes,
  content_type: str | None,
  progress_callback: Callable[[str, str], Awaitable[None]] | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
  api_key = os.getenv("DIFY_API_KEY") or os.getenv("DIFY_WORKFLOW_API_KEY")
  if not api_key:
    raise ImportPipelineError("dify_workflow_failed", "DIFY_API_KEY 未配置", "dify_running", "dify")
  api_url = os.getenv("DIFY_API_URL", "https://api.dify.ai/v1").rstrip("/")
  async with httpx.AsyncClient(timeout=180) as client:
    try:
      upload_response = await client.post(
        f"{api_url}/files/upload",
        headers={"Authorization": f"Bearer {api_key}"},
        data={"user": "admin"},
        files={"file": (filename, content, content_type or "application/octet-stream")}
      )
    except httpx.TimeoutException as exc:
      raise ImportPipelineError("dify_upload_failed", "Dify 文件上传超时", "dify_uploading", "dify", {"exception": str(exc)}) from exc
    except httpx.HTTPError as exc:
      raise ImportPipelineError("dify_upload_failed", "Dify 文件上传失败", "dify_uploading", "dify", {"exception": str(exc)}) from exc
    if upload_response.status_code >= 400:
      raise ImportPipelineError(
        "dify_upload_failed",
        "Dify 文件上传失败",
        "dify_uploading",
        "dify",
        {"status_code": upload_response.status_code, "body": summarize_import_payload(upload_response.text)}
      )
    upload_payload = upload_response.json()
    file_id = upload_payload.get("id")
    if not file_id:
      raise ImportPipelineError("dify_upload_failed", "Dify 未返回 file_id", "dify_uploading", "dify", upload_payload)
    if progress_callback:
      await progress_callback("dify_running", "文件已上传至 Dify，正在等待 Workflow 结构化结果")
    try:
      workflow_response = await client.post(
        f"{api_url}/workflows/run",
        headers={
          "Authorization": f"Bearer {api_key}",
          "Content-Type": "application/json"
        },
        json={
          "inputs": {
            "module_id": module_id,
            "file": {
              "type": "document",
              "transfer_method": "local_file",
              "upload_file_id": file_id
            },
            "sys.query": "解析文本为标准json结构"
          },
          "response_mode": "blocking",
          "user": "admin"
        }
      )
    except httpx.TimeoutException as exc:
      raise ImportPipelineError(
        "dify_workflow_failed",
        "Dify Workflow 超时，准备切换 fallback",
        "dify_running",
        "dify",
        {"exception": str(exc)},
        fallback_allowed=True
      ) from exc
    except httpx.HTTPError as exc:
      raise ImportPipelineError("dify_workflow_failed", "Dify Workflow 请求失败", "dify_running", "dify", {"exception": str(exc)}) from exc
  if workflow_response.status_code >= 500:
    raise ImportPipelineError(
      "dify_workflow_failed",
      "Dify Workflow 返回 5xx，准备切换 fallback",
      "dify_running",
      "dify",
      {"status_code": workflow_response.status_code, "body": summarize_import_payload(workflow_response.text)},
      fallback_allowed=True
    )
  if workflow_response.status_code >= 400:
    raise ImportPipelineError(
      "dify_workflow_failed",
      "Dify Workflow 运行失败",
      "dify_running",
      "dify",
      {"status_code": workflow_response.status_code, "body": summarize_import_payload(workflow_response.text)}
    )
  workflow_payload = workflow_response.json()
  workflow_status = workflow_payload.get("data", {}).get("status")
  if workflow_status not in (None, "succeeded"):
    fallback_allowed = isinstance(workflow_status, str) and "timeout" in workflow_status.lower()
    error_text = workflow_payload.get("data", {}).get("error") or workflow_status
    raise ImportPipelineError(
      "dify_workflow_failed",
      f"Dify Workflow 执行失败: {error_text}",
      "dify_running",
      "dify",
      workflow_payload,
      fallback_allowed=fallback_allowed
    )
  try:
    return workflow_payload, resolve_dify_structured_output(workflow_payload)
  except HTTPException as exc:
    raise ImportPipelineError(
      "structured_result_unrecognized",
      "Dify 返回成功，但结构化结果不可识别",
      "dify_running",
      "dify",
      workflow_payload
    ) from exc


async def run_fallback_import(
  filename: str,
  content: bytes,
  task_id: str,
  dify_error: ImportPipelineError | None = None
) -> tuple[dict[str, Any], dict[str, Any], str]:
  try:
    text = await extract_text_for_import(filename, content, task_id)
    ai_structured = await ai_structure_module(text)
  except HTTPException as exc:
    detail = exc.detail.get("message") if isinstance(exc.detail, dict) and "message" in exc.detail else str(exc.detail)
    raise ImportPipelineError(
      "fallback_processing_failed",
      f"Fallback 处理失败: {detail}",
      "fallback_running",
      "openrouter_fallback",
      {"detail": detail}
    ) from exc
  raw_output = ai_structured.model_dump()
  if dify_error:
    raw_output = {
      "fallback_from": dify_error.error_type,
      "dify_error": dify_error.message,
      "openrouter_output": raw_output
    }
  return raw_output, ai_structured.model_dump(), "openrouter_fallback" if dify_error else "openrouter"


async def process_admin_import_task(
  task: dict[str, Any],
  file_path: str,
  content_type: str | None
) -> None:
  with open(file_path, "rb") as source:
    content = source.read()

  async def persist_stage(stage: str, summary: str, *, result_source: str | None = None):
    update_import_task_runtime(
      task,
      status="processing",
      stage=stage,
      result_source=result_source if result_source is not None else UNSET,
      error_type=None,
      error_message=None,
      output_summary=summary
    )
    save_import_task(task)

  try:
    source_type = task["parser_type"]
    raw_output: Any = None
    parsed_output: dict[str, Any] | None = None
    if task["parser_type"] == "dify":
      await persist_stage("dify_uploading", "上传成功，正在将文件提交给 Dify", result_source="dify")
      try:
        raw_output, parsed_output = await run_dify_import(
          task["module_id"],
          task["source_file_name"],
          content,
          content_type,
          progress_callback=lambda stage, summary: persist_stage(stage, summary, result_source="dify")
        )
        source_type = "dify"
      except ImportPipelineError as dify_error:
        update_import_task_runtime(
          task,
          status="processing",
          stage=dify_error.stage,
          result_source="dify",
          error_type=dify_error.error_type,
          error_message=dify_error.message,
          output_summary=dify_error.message,
          raw_output=dify_error.raw_payload
        )
        save_import_task(task)
        if not dify_error.fallback_allowed:
          raise
        await persist_stage("fallback_extracting", "Dify 超时或返回 5xx，正在切换 fallback 解析", result_source="openrouter_fallback")
        raw_output, parsed_output, source_type = await run_fallback_import(
          task["source_file_name"],
          content,
          task["task_id"],
          dify_error
        )
    else:
      await persist_stage("fallback_extracting", "上传成功，正在提取文档文本并准备后备解析", result_source="openrouter")
      raw_output, parsed_output, source_type = await run_fallback_import(
        task["source_file_name"],
        content,
        task["task_id"]
      )
    await persist_stage("normalizing", "结构化候选结果已返回，正在执行后端标准化", result_source=source_type)
    update_import_task_runtime(task, raw_output=raw_output, result_source=source_type)
    save_import_task(task)
    normalized = normalize_structured_module(task["module_id"], parsed_output or {}, source_type, "draft")
    await persist_stage("draft_saving", "标准化完成，正在写入 draft 与版本快照", result_source=source_type)
    save_module_draft(task["module_id"], normalized)
    version = create_module_version(task["module_id"], normalized, "draft", f"{task['parser_type']} import draft")
    update_import_task_runtime(
      task,
      status="completed",
      stage="completed",
      result_source=source_type,
      raw_output=raw_output,
      normalized_output=normalized.model_dump(),
      error_type=None,
      error_message=None,
      output_summary="结构化候选结果已自动写入 draft，管理员现在可以继续编辑并在校验后发布",
      next_action="打开编辑器继续补充字段、修订扩展信息并执行发布校验",
      draft_version=version,
      fallback_from="dify_workflow_failed" if source_type == "openrouter_fallback" else None
    )
    save_import_task(task)
  except ImportPipelineError as exc:
    update_import_task_runtime(
      task,
      status="failed",
      stage="failed",
      result_source=exc.source,
      raw_output=exc.raw_payload if exc.raw_payload is not None else UNSET,
      normalized_output=None,
      error_type=exc.error_type,
      error_message=exc.message,
      output_summary=exc.message,
      next_action="查看失败来源后可重新上传，或改用 OpenRouter/Fallback 再次生成 draft"
    )
    save_import_task(task)
  except Exception as exc:
    update_import_task_runtime(
      task,
      status="failed",
      stage="failed",
      normalized_output=None,
      error_type="backend_normalization_failed",
      error_message=f"后端标准化失败: {exc}",
      output_summary="结构化结果已返回，但后端在标准化、校验或落库时失败",
      next_action="检查任务摘要与原始响应后重试，必要时在编辑器中手动补全"
    )
    save_import_task(task)


async def extract_text_for_import(filename: str, content: bytes, task_id: str) -> str:
  source_file_type = infer_source_type(filename)
  if source_file_type == "pdf":
    temp_path = os.path.join(storage_dir, f"{task_id}.pdf")
    with open(temp_path, "wb") as target:
      target.write(content)
    return extract_pdf_text(temp_path)
  if source_file_type == "docx":
    temp_path = os.path.join(storage_dir, f"{task_id}.docx")
    with open(temp_path, "wb") as target:
      target.write(content)
    return extract_docx_text(temp_path)
  raise HTTPException(status_code=400, detail="仅支持 PDF/DOCX")


async def ai_structure_module(text: str) -> CocScenario:
  api_key = os.getenv("OPENROUTER_API_KEY")
  if not api_key:
    raise HTTPException(status_code=500, detail="OPENROUTER未配置")
  prompt = (
    "你是TRPG模组解析器。把输入的模组文本转成结构化JSON。"
    "只输出JSON，不要包含任何解释或多余文本。"
    "JSON必须包含字段: title, background, locations, npcs, events, quests, sequence, triggers, clues, handouts, scene_items, assets, themes, extensions, custom_types。"
    "locations字段包含: name, description, connections, npcs。"
    "npcs字段包含: name, description, secrets。"
    "events字段包含: trigger, result。"
    "quests字段包含: name, goal。"
    "sequence字段包含: id, title, location_id, order, description, prerequisites。"
    "triggers字段包含: id, name, once, conditions, actions。"
    "triggers.conditions字段包含: type, key, operator, value。"
    "triggers.actions字段包含: type, target_id, payload。"
    "clues字段包含: id, title, content, source, discovery_conditions, visibility, trigger_ref, discovery_method, gm_notes。"
    "handouts字段包含: id, title, content, type, asset_ids, grant_conditions, add_to_inventory。"
    "scene_items字段包含: id, name, location_id, description, interactions, linked_clue_ids。"
    "assets字段包含: id, name, type, url, description。"
    "如果遇到无法稳定归类的新信息，请放入合适对象的extra字段或顶层extensions字段，不要丢弃。"
  )
  async with httpx.AsyncClient(timeout=60) as client:
    response = await client.post(
      f"{(os.getenv('OPENROUTER_API_URL', 'https://openrouter.ai/api/v1')).rstrip('/')}/chat/completions",
      headers=build_openrouter_headers(api_key),
      json={
        "model": os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
        "messages": [
          {"role": "system", "content": prompt},
          {"role": "user", "content": text[:8000]}
        ]
      }
    )
  if response.status_code >= 400:
    raise HTTPException(status_code=502, detail=f"AI解析失败: {response.text}")
  content = extract_openrouter_message_content(response.json())
  payload = parse_json_block(content)
  return normalize_structured_module("draft", payload, "openrouter", "draft")


def build_openrouter_headers(api_key: str) -> dict[str, str]:
  return {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "http://localhost:3000"),
    "X-Title": "DiceTales"
  }


def extract_openrouter_message_content(payload: dict[str, Any]) -> str:
  content = payload.get("choices", [{}])[0].get("message", {}).get("content") or ""
  if isinstance(content, str):
    return content
  if isinstance(content, list):
    return "".join(
      item.get("text", "")
      for item in content
      if isinstance(item, dict) and isinstance(item.get("text"), str)
    )
  return str(content)


def parse_json_block(content: str) -> dict:
  try:
    return json.loads(content)
  except json.JSONDecodeError:
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
      raise HTTPException(status_code=502, detail="AI返回非JSON")
    snippet = content[start : end + 1]
    try:
      return json.loads(snippet)
    except json.JSONDecodeError:
      raise HTTPException(status_code=502, detail="AI返回非JSON")


def ensure_default_structured(module_id: str) -> CocScenario:
  scenario = get_published_scenario(module_id)
  if scenario:
    return scenario
  raise HTTPException(status_code=404, detail="Scenario not found")


def get_recent_messages(session_id: str) -> list[CocChatMessage]:
  logs = session_logs.get(session_id, [])
  return logs[-10:]


def append_message(session_id: str, role: Role, content: str) -> list[CocChatMessage]:
  logs = session_logs.setdefault(session_id, [])
  logs.append(CocChatMessage(role=role, content=content))
  if len(logs) > 10:
    session_logs[session_id] = logs[-10:]
  return session_logs[session_id]


def get_session_state_record(session_id: str) -> dict[str, Any]:
  session = sessions.get(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  state = session.get("state")
  if not isinstance(state, dict):
    state = {
      "current_scene_id": None,
      "current_location_id": None,
      "discovered_clue_ids": [],
      "granted_handout_ids": [],
      "triggered_rule_ids": [],
      "flags": {},
      "time_progress": None,
    }
    session["state"] = state
  return state


def get_sorted_scenes(module: CocScenario) -> list[CocScene]:
  return sorted(module.sequence, key=lambda item: (item.order, item.title))


def get_location_by_id(module: CocScenario, location_id: str | None) -> CocLocation | None:
  if not location_id:
    return module.locations[0] if module.locations else None
  return next((item for item in module.locations if location_ref(item) == location_id), None)


def get_scene_by_id(module: CocScenario, scene_id: str | None) -> CocScene | None:
  if not scene_id:
    return None
  return next((item for item in module.sequence if item.id == scene_id), None)


def get_current_scene(module: CocScenario, state: dict[str, Any]) -> CocScene | None:
  current_scene = get_scene_by_id(module, state.get("current_scene_id"))
  if current_scene:
    return current_scene
  current_location_id = state.get("current_location_id")
  if current_location_id:
    matched = next((item for item in get_sorted_scenes(module) if scene_location_ref(item) == current_location_id), None)
    if matched:
      return matched
  scenes = get_sorted_scenes(module)
  return scenes[0] if scenes else None


def sync_state_with_scene(module: CocScenario, state: dict[str, Any]) -> None:
  current_scene = get_current_scene(module, state)
  if current_scene:
    state["current_scene_id"] = current_scene.id
    if current_scene.location_id:
      state["current_location_id"] = current_scene.location_id
  elif not state.get("current_location_id") and module.locations:
    state["current_location_id"] = location_ref(module.locations[0])
  flags = state.setdefault("flags", {})
  visible_location_ids = [
    item for item in flags.get("visible_location_ids", [])
    if isinstance(item, str) and item
  ] if isinstance(flags.get("visible_location_ids"), list) else []
  visited_scene_ids = [
    item for item in flags.get("visited_scene_ids", [])
    if isinstance(item, str) and item
  ] if isinstance(flags.get("visited_scene_ids"), list) else []
  current_location_id = state.get("current_location_id")
  if isinstance(current_location_id, str) and current_location_id and current_location_id not in visible_location_ids:
    visible_location_ids.append(current_location_id)
  if current_scene and current_scene.location_id and current_scene.location_id not in visible_location_ids:
    visible_location_ids.append(current_scene.location_id)
  if current_scene and current_scene.id not in visited_scene_ids:
    visited_scene_ids.append(current_scene.id)
  flags["visible_location_ids"] = visible_location_ids
  flags["visited_scene_ids"] = visited_scene_ids


def get_scene_items_for_location(module: CocScenario, location_id: str | None) -> list[CocSceneItem]:
  if not location_id:
    return []
  return [item for item in module.scene_items if item.location_id == location_id]


def get_discovered_clues(module: CocScenario, state: dict[str, Any]) -> list[CocClue]:
  discovered_ids = set(state.get("discovered_clue_ids", []))
  return [item for item in module.clues if item.id in discovered_ids]


def get_granted_handouts(module: CocScenario, state: dict[str, Any]) -> list[CocHandout]:
  granted_ids = set(state.get("granted_handout_ids", []))
  return [item for item in module.handouts if item.id in granted_ids]


def get_keeper_background(module: CocScenario) -> str:
  extensions = module.extensions if isinstance(module.extensions, dict) else {}
  raw_sections = extensions.get("raw_sections")
  if isinstance(raw_sections, dict):
    keeper_background = raw_sections.get("keeper_background")
    if isinstance(keeper_background, str) and keeper_background.strip():
      return keeper_background.strip()
  keeper_background = extensions.get("keeper_background")
  if isinstance(keeper_background, str):
    return keeper_background.strip()
  return ""


def get_player_opening_statement(module: CocScenario) -> str:
  extensions = module.extensions if isinstance(module.extensions, dict) else {}
  opening_statement = extensions.get("player_opening_statement")
  if isinstance(opening_statement, str) and opening_statement.strip():
    return opening_statement.strip()
  opening_context = extensions.get("player_opening_context")
  if isinstance(opening_context, str) and opening_context.strip():
    return opening_context.strip()
  return ""


def get_player_opening_options(module: CocScenario) -> list[str]:
  extensions = module.extensions if isinstance(module.extensions, dict) else {}
  options = extensions.get("player_opening_options")
  if not isinstance(options, list):
    return []
  return [item.strip() for item in options if isinstance(item, str) and item.strip()]


def build_session_intro_message(module: CocScenario, state: dict[str, Any]) -> str:
  current_scene = get_current_scene(module, state)
  current_location = get_location_by_id(module, state.get("current_location_id"))
  location_name = current_location.name if current_location else "案发现场"
  active_quest = next((item.goal for item in module.quests if isinstance(item.goal, str) and item.goal.strip()), "查明这起事件背后的真相。")
  scene_title = current_scene.title if current_scene and current_scene.title else "调查的起点"
  opening_statement = get_player_opening_statement(module)
  opening_options = get_player_opening_options(module)
  options_text = ""
  if opening_options:
    options_text = "\n\n你可以先这样展开调查：\n" + "\n".join(
      f"{index}. {item}" for index, item in enumerate(opening_options, start=1)
    )
  if opening_statement:
    return (
      f"{opening_statement}\n\n"
      f"现在，你已经来到{location_name}。调查从“{scene_title}”开始。你准备先做什么？"
      f"{options_text}"
    )
  if module.module_id == BASELINE_MODULE_ID:
    return (
      f"你应托来到{location_name}，接手托马斯·金博尔提出的委托。"
      "有人夜里潜入屋内，却没有卷走值钱财物，只拿走了他失踪叔叔道格拉斯最珍视的旧书。"
      f"眼下，你需要做的是：{active_quest}\n\n"
      f"现在，调查从“{scene_title}”开始。托马斯正在等你开口。你准备先做什么？"
      f"{options_text}"
    )
  return (
    f"你已经来到{location_name}，正式卷入《{module.title}》的调查。"
    f"此刻最紧迫的问题是：{active_quest}\n\n"
    f"现在，调查从“{scene_title}”开始。你准备先做什么？"
    f"{options_text}"
  )


def serialize_player_scenario(module: CocScenario) -> dict[str, Any]:
  return {
    "module_id": module.module_id,
    "rule_system": module.rule_system,
    "title": module.title,
    "background": module.background,
    "themes": module.themes,
    "opening_options": get_player_opening_options(module),
  }


def serialize_player_location(location: CocLocation) -> dict[str, Any]:
  return {
    "id": location_ref(location),
    "name": location.name,
  }


def serialize_player_scene(scene: CocScene, status: str) -> dict[str, Any]:
  return {
    "id": scene.id,
    "title": scene.title,
    "status": status,
  }


def serialize_player_state(state: dict[str, Any]) -> dict[str, Any]:
  flags = state.get("flags", {})
  safe_flags = {}
  if isinstance(flags, dict):
    pending_check = flags.get("pending_check")
    if pending_check is not None:
      safe_flags["pending_check"] = pending_check
    active_quest = flags.get("active_quest")
    if isinstance(active_quest, str) and active_quest:
      safe_flags["active_quest"] = active_quest
    visible_location_ids = flags.get("visible_location_ids")
    if isinstance(visible_location_ids, list):
      safe_flags["visible_location_ids"] = [
        item for item in visible_location_ids if isinstance(item, str) and item
      ]
  return {
    "current_scene_id": state.get("current_scene_id"),
    "current_location_id": state.get("current_location_id"),
    "discovered_clue_ids": [
      item for item in state.get("discovered_clue_ids", [])
      if isinstance(item, str) and item
    ],
    "granted_handout_ids": [
      item for item in state.get("granted_handout_ids", [])
      if isinstance(item, str) and item
    ],
    "triggered_rule_ids": [
      item for item in state.get("triggered_rule_ids", [])
      if isinstance(item, str) and item
    ],
    "flags": safe_flags,
    "time_progress": state.get("time_progress"),
  }


def normalize_required_check(raw_check: Any) -> dict[str, Any] | None:
  if not isinstance(raw_check, dict):
    return None
  kind = raw_check.get("kind")
  key = raw_check.get("key")
  name = raw_check.get("name")
  if kind not in ("skill", "characteristic"):
    return None
  if not isinstance(key, str) or not key:
    return None
  if not isinstance(name, str) or not name:
    name = key
  difficulty = raw_check.get("difficulty")
  if difficulty not in ("regular", "hard", "extreme"):
    difficulty = "regular"
  request = CocCheckRequest(
    check_id=str(raw_check.get("check_id") or f"check_{uuid4().hex[:8]}"),
    action=str(raw_check.get("action") or name),
    kind=kind,
    key=key,
    name=name,
    difficulty=difficulty,
    target_override=raw_check.get("target_override") if isinstance(raw_check.get("target_override"), int) else None,
    reason=raw_check.get("reason") if isinstance(raw_check.get("reason"), str) else None,
  )
  return request.model_dump()


def normalize_check_result(raw_result: Any) -> dict[str, Any] | None:
  if not isinstance(raw_result, dict):
    return None
  try:
    return CocCheckResult(**raw_result).model_dump()
  except Exception:
    return None


def resolve_check_target(investigator: dict[str, Any], check: CocCheckRequest) -> int:
  if check.target_override is not None:
    return max(1, min(99, check.target_override))
  if check.kind == "characteristic":
    characteristic_value = investigator.get("characteristics", {}).get(check.key)
    if isinstance(characteristic_value, int):
      return max(1, min(99, characteristic_value))
  skill_value = investigator.get("skills", {}).get(check.key)
  if isinstance(skill_value, int):
    return max(1, min(99, skill_value))
  return 50


def resolve_required_threshold(target: int, difficulty: str) -> int:
  if difficulty == "extreme":
    return max(1, target // 5)
  if difficulty == "hard":
    return max(1, target // 2)
  return target


def evaluate_coc_check(investigator: dict[str, Any], check: CocCheckRequest, roll_value: int | None = None) -> CocCheckResult:
  rolled_value = roll_value if isinstance(roll_value, int) and 1 <= roll_value <= 100 else random.randint(1, 100)
  target = resolve_check_target(investigator, check)
  required_threshold = resolve_required_threshold(target, check.difficulty)
  if rolled_value == 1:
    level = "critical"
  elif rolled_value == 100 or (rolled_value >= 96 and target < 50):
    level = "fumble"
  elif rolled_value <= max(1, target // 5):
    level = "extreme"
  elif rolled_value <= max(1, target // 2):
    level = "hard"
  elif rolled_value <= target:
    level = "regular"
  else:
    level = "failure"
  passed_levels = {
    "regular": {"regular", "hard", "extreme", "critical"},
    "hard": {"hard", "extreme", "critical"},
    "extreme": {"extreme", "critical"},
  }[check.difficulty]
  return CocCheckResult(
    check_id=check.check_id,
    action=check.action,
    kind=check.kind,
    key=check.key,
    name=check.name,
    target=target,
    required_threshold=required_threshold,
    difficulty=check.difficulty,
    passed=level in passed_levels,
    level=level,
    roll={"expression": "1d100", "value": rolled_value, "details": [rolled_value]},
  )


def apply_state_patch(state: dict[str, Any], patch_payload: dict[str, Any] | None) -> None:
  if not isinstance(patch_payload, dict):
    return
  if isinstance(patch_payload.get("current_scene_id"), str):
    state["current_scene_id"] = patch_payload["current_scene_id"]
  if isinstance(patch_payload.get("current_location_id"), str):
    state["current_location_id"] = patch_payload["current_location_id"]
  discovered = state.setdefault("discovered_clue_ids", [])
  granted = state.setdefault("granted_handout_ids", [])
  triggered = state.setdefault("triggered_rule_ids", [])
  flags = state.setdefault("flags", {})
  for clue_id in patch_payload.get("add_discovered_clue_ids", []):
    if isinstance(clue_id, str) and clue_id not in discovered:
      discovered.append(clue_id)
  for handout_id in patch_payload.get("add_granted_handout_ids", []):
    if isinstance(handout_id, str) and handout_id not in granted:
      granted.append(handout_id)
  for rule_id in patch_payload.get("add_triggered_rule_ids", []):
    if isinstance(rule_id, str) and rule_id not in triggered:
      triggered.append(rule_id)
  merge_flags = patch_payload.get("merge_flags")
  if isinstance(merge_flags, dict):
    flags.update(merge_flags)
  time_progress_delta = patch_payload.get("time_progress_delta")
  if isinstance(time_progress_delta, int):
    current_time = state.get("time_progress")
    state["time_progress"] = (current_time if isinstance(current_time, int) else 0) + time_progress_delta


def build_ai_context_payload(
  session: dict[str, Any],
  module: CocScenario,
  investigator: dict[str, Any],
  state: dict[str, Any],
  recent_dialogue: list[CocChatMessage],
  player_action: str,
  check_result: dict[str, Any] | None = None
) -> dict[str, Any]:
  sync_state_with_scene(module, state)
  current_scene = get_current_scene(module, state)
  current_location = get_location_by_id(module, state.get("current_location_id"))
  current_location_id = current_location.id if current_location else None
  npc_names = current_location.npcs if current_location else []
  npc_details = [npc.model_dump() for npc in module.npcs if npc.name in npc_names]
  session_payload = {
    "id": session["id"],
    "rule_system": session.get("rule_system", "coc"),
    "scenario_id": session["scenario_id"],
    "investigator_id": session["investigator_id"],
    "started_at": session["started_at"],
    "updated_at": session["updated_at"],
    "state": state,
  }
  return {
    "scenario": {
      "module_id": module.module_id,
      "rule_system": module.rule_system,
      "title": module.title,
      "tone": module.tone,
      "core_conflict": module.core_conflict,
      "background": module.background,
      "keeper_background": get_keeper_background(module),
      "themes": module.themes,
    },
    "investigator": investigator,
    "session": session_payload,
    "runtime": {
      "current_scene": current_scene.model_dump() if current_scene else None,
      "current_location": current_location.model_dump() if current_location else None,
      "scene_items": [item.model_dump() for item in get_scene_items_for_location(module, current_location_id)],
      "npcs_here": npc_names,
      "npc_details": npc_details,
      "discovered_clues": [clue.model_dump() for clue in get_discovered_clues(module, state)],
      "granted_handouts": [handout.model_dump() for handout in get_granted_handouts(module, state)],
      "available_scenes": [scene.model_dump() for scene in get_sorted_scenes(module)],
      "pending_check": state.get("flags", {}).get("pending_check"),
      "last_check_result": check_result or state.get("flags", {}).get("last_check_result"),
    },
    "recent_dialogue": [item.model_dump() for item in recent_dialogue],
    "player_action": player_action,
  }


def build_check_outcome_guidance(check_result: dict[str, Any] | None) -> str:
  if not isinstance(check_result, dict):
    return ""
  passed = check_result.get("passed")
  if passed is None:
    return ""
  name = str(check_result.get("name") or check_result.get("key") or "本次检定").strip()
  level = str(check_result.get("level") or "").strip()
  key = str(check_result.get("key") or "").strip().lower()
  social_keys = {"appearance", "charm", "fast_talk", "persuade", "intimidate", "credit_rating"}
  if passed is False:
    guidance = [
      "[检定裁定硬规则]",
      f"本轮检定【{name}】结果为失败（{level or 'failure'}）。",
      "你必须把这次行动裁定为失败、受阻、只获得无关紧要信息，或付出明显代价；绝不能把失败叙述成成功。",
      "失败后禁止直接描述玩家成功说服、成功取信、成功获得关键线索、成功潜入或成功达成目标。",
    ]
    if key in social_keys or name in {"外貌", "魅惑", "话术", "说服", "恐吓", "信用评级"}:
      guidance.append("这是社交类检定失败：NPC 通常不会配合，可能敷衍、拒绝、警惕、回避，甚至直接不理会玩家；不要在失败时直接吐露关键情报。")
    return "\n".join(guidance)
  return (
    "[检定裁定提示]\n"
    f"本轮检定【{name}】结果为成功（{level or 'regular'}）。"
    "请按成功等级给出相称收益，但不要超出当前场景已允许的信息边界。"
  )


def is_social_check_result(check_result: dict[str, Any] | None) -> bool:
  if not isinstance(check_result, dict):
    return False
  key = str(check_result.get("key") or "").strip().lower()
  name = str(check_result.get("name") or "").strip()
  social_keys = {"app", "appearance", "charm", "fast_talk", "persuade", "intimidate", "credit_rating", "credit"}
  social_names = {"外貌", "魅惑", "魅力", "话术", "说服", "恐吓", "信用评级"}
  return key in social_keys or name in social_names


def failed_check_reply_conflicts(reply: dict[str, Any], check_result: dict[str, Any] | None) -> bool:
  if not isinstance(check_result, dict) or check_result.get("passed") is not False:
    return False
  narration = str(reply.get("narration") or "").strip()
  if not narration:
    return False
  failure_markers = [
    "失败",
    "受阻",
    "没能",
    "未能",
    "没有",
    "拒绝",
    "敷衍",
    "警惕",
    "沉默",
    "回避",
    "离开",
    "不理会",
    "没空",
    "无功而返",
  ]
  generic_success_markers = [
    "你成功",
    "成功地",
    "顺利地",
    "获得了关键线索",
    "找到关键线索",
    "直接达成了目标",
    "达成了目标",
    "取信了",
  ]
  social_success_markers = [
    "愿意停下和你交谈",
    "愿意和你交谈",
    "很乐意",
    "打开话匣子",
    "告诉你",
    "向你透露",
    "说起",
    "配合你",
    "被你说服",
    "答应了你的请求",
    "承认曾经见过",
  ]
  success_markers = [*generic_success_markers]
  if is_social_check_result(check_result):
    success_markers.extend(social_success_markers)
  has_failure_marker = any(marker in narration for marker in failure_markers)
  has_success_marker = any(marker in narration for marker in success_markers)
  return has_success_marker and not has_failure_marker


def build_failed_check_fallback_narration(check_result: dict[str, Any] | None) -> str:
  if not isinstance(check_result, dict):
    return "这次尝试没有达成预期目标，关键进展暂时受阻。"
  name = str(check_result.get("name") or check_result.get("key") or "本次行动").strip()
  if is_social_check_result(check_result):
    return f"你的【{name}】检定失败了。对方没有被你打动，只是敷衍、回避或直接结束了交流；你没有获得关键情报。"
  return f"你的【{name}】检定失败了。这次尝试没有达成预期目标，只得到一些无关紧要的反馈，关键进展暂时受阻。"


def enforce_check_result_consistency(reply: dict[str, Any], check_result: dict[str, Any] | None) -> dict[str, Any]:
  if not failed_check_reply_conflicts(reply, check_result):
    return reply
  return {
    **reply,
    "narration": build_failed_check_fallback_narration(check_result),
    "state_update": {},
    "scene_change": None,
    "location_change": None,
    "quest_update": None,
    "required_check": None,
    "check_result": None,
    "inventory_update": None,
  }


def normalize_ai_reply(module: CocScenario, reply: dict) -> dict:
  narration = reply.get("narration")
  narration_text = narration if isinstance(narration, str) and narration else "风声掠过，未闻回应。"
  choices = reply.get("choices")
  if isinstance(choices, list):
    normalized_choices = [item for item in choices if isinstance(item, str)]
  else:
    normalized_choices = []
  state_update = reply.get("state_update")
  if not isinstance(state_update, dict):
    state_update = {}
  scene_change = reply.get("scene_change")
  if not isinstance(scene_change, str) or not any(
    item.id == scene_change or item.title == scene_change for item in module.sequence
  ):
    scene_change = None
  location_change = reply.get("location_change")
  if not isinstance(location_change, str) or not any(
    location_ref(item) == location_change or item.name == location_change for item in module.locations
  ):
    location_change = None
  quest_update = reply.get("quest_update")
  if not isinstance(quest_update, str) or not any(
    item.name == quest_update for item in module.quests
  ):
    quest_update = None
  
  required_check = normalize_required_check(reply.get("required_check"))
  check_result = normalize_check_result(reply.get("check_result"))
  inventory_update = reply.get("inventory_update")

  return {
    "narration": narration_text,
    "choices": normalized_choices,
    "state_update": state_update,
    "scene_change": scene_change,
    "location_change": location_change,
    "quest_update": quest_update,
    "required_check": required_check,
    "check_result": check_result,
    "inventory_update": inventory_update
  }


def apply_inventory_update(investigator: dict[str, Any], inventory_update: Any) -> None:
  if not isinstance(inventory_update, dict):
    return
  inventory = investigator.get("inventory", [])
  if "add" in inventory_update and isinstance(inventory_update["add"], list):
    for item in inventory_update["add"]:
      if not isinstance(item, dict):
        continue
      existing_item = next((candidate for candidate in inventory if candidate["name"] == item.get("name") and candidate.get("category") == item.get("category")), None)
      if existing_item:
        existing_item["quantity"] = existing_item.get("quantity", 1) + item.get("quantity", 1)
      else:
        inventory.append({
          "id": f"item_{uuid4().hex[:8]}",
          "name": item.get("name", "神秘物品"),
          "category": item.get("category", "tool"),
          "origin": "module",
          "is_equipped": False,
          "quantity": item.get("quantity", 1),
          "description": item.get("description", ""),
          "stats": item.get("stats", {})
        })
  if "remove" in inventory_update and isinstance(inventory_update["remove"], list):
    for item in inventory_update["remove"]:
      if not isinstance(item, dict):
        continue
      for index, existing in enumerate(inventory):
        if existing["name"] != item.get("name"):
          continue
        remove_quantity = item.get("quantity", 1)
        if existing.get("quantity", 1) > remove_quantity:
          existing["quantity"] -= remove_quantity
        else:
          inventory.pop(index)
        break
  investigator["inventory"] = inventory
  save_character_to_db(investigator)


def apply_reply_to_session(
  session_id: str,
  module: CocScenario,
  player_message: str,
  reply: dict,
  check_result: dict[str, Any] | None = None
) -> dict[str, Any]:
  session = sessions[session_id]
  state = get_session_state_record(session_id)
  flags = state.setdefault("flags", {})
  investigator_id = session.get("investigator_id")

  scene_change = reply.get("scene_change")
  location_change = reply.get("location_change")
  quest_update = reply.get("quest_update")
  state_update = reply.get("state_update") if isinstance(reply.get("state_update"), dict) else {}
  resolved_check_result = check_result or reply.get("check_result")

  if resolved_check_result:
    flags["last_check_result"] = resolved_check_result
    flags.pop("pending_check", None)
    state_patch = resolved_check_result.get("state_patch")
    if isinstance(state_patch, dict):
      apply_state_patch(state, state_patch)
  if reply.get("required_check"):
    flags["pending_check"] = reply["required_check"]

  if scene_change:
    state["current_scene_id"] = scene_change
  if location_change:
    state["current_location_id"] = location_change
  if quest_update:
    flags["active_quest"] = quest_update
  if state_update:
    flags.update(state_update)

  sync_state_with_scene(module, state)
  trigger_reply = {**reply}
  if resolved_check_result:
    trigger_reply["check_result"] = resolved_check_result
  trigger_outcome = apply_structured_triggers(session_id, module, player_message, trigger_reply)
  auto_clues = auto_reveal_clues(module, state, player_message)
  auto_handouts = auto_grant_handouts(module, state, player_message, investigator_id)

  revealed_clues = trigger_outcome["revealed_clues"]
  for clue in auto_clues:
    if clue["id"] not in {item["id"] for item in revealed_clues}:
      revealed_clues.append(clue)

  granted_handouts = trigger_outcome["granted_handouts"]
  for handout in auto_handouts:
    if handout["id"] not in {item["id"] for item in granted_handouts}:
      granted_handouts.append(handout)

  sync_state_with_scene(module, state)
  session["updated_at"] = now_iso()
  return {
    "revealed_clues": revealed_clues,
    "granted_handouts": granted_handouts,
  }


async def generate_ai_reply(session_id: str, message: str, check_result: dict[str, Any] | None = None) -> dict:
  session = sessions.get(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  module = ensure_default_structured(session["scenario_id"])
  investigator = characters.get(session["investigator_id"])
  if not investigator:
    raise HTTPException(status_code=404, detail="Investigator not found")
  state = get_session_state_record(session_id)

  append_message(session_id, "player", message)
  recent_dialogue = get_recent_messages(session_id)
  context_payload = build_ai_context_payload(
    session,
    module,
    investigator,
    state,
    recent_dialogue,
    message,
    check_result,
  )

  openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
  openrouter_api_url = (os.getenv("OPENROUTER_API_URL", "https://openrouter.ai/api/v1")).rstrip("/")
  openrouter_model = (
    os.getenv("OPENROUTER_KP_MODEL")
    or os.getenv("OPENROUTER_MODEL")
    or "openai/gpt-4o-mini"
  )

  if not openrouter_api_key:
    return {
      "narration": "DM的灵魂尚未被唤醒 (后端缺少 OPENROUTER_API_KEY 配置，请在 .env.local 中添加)。",
      "choices": [],
      "state_update": {},
      "scene_change": None,
      "location_change": None,
      "quest_update": None
    }

  async with httpx.AsyncClient(timeout=60) as client:
    try:
      check_outcome_guidance = build_check_outcome_guidance(check_result)
      system_instructions = """
[重要规则]
1. 当前是 COC 调查场景，请以守秘人/KP 视角回应。
2. 遇到有失败风险的行动时，使用 "required_check" 输出统一检定对象：{"check_id":"","action":"","kind":"skill|characteristic","key":"","name":"","difficulty":"regular|hard|extreme","reason":""}。
3. 场景推进优先使用 scene_change、location_change 与 state_update，不要输出额外格式。
4. 如果玩家获得或消耗物品，使用 "inventory_update" 描述增减。
5. 如果输入里已经包含 check_result，请直接基于该结构裁定后果，不要再次要求重复检定。
6. 输出必须是 JSON，对话与叙事内容写入 "narration"。
7. 检定失败时，绝不能把失败叙述成成功；社交检定失败时，NPC 可以敷衍、警惕、拒绝、沉默或直接不理会玩家。
8. 检定成功时，也只能给出与成功等级相称的信息，不能越过当前场景边界直接泄露真相。
"""
      augmented_query = (
        f"{system_instructions}\n"
        f"{check_outcome_guidance}\n"
        f"[会话上下文]\n{json.dumps(context_payload, ensure_ascii=False)}\n"
        f"[玩家行动]\n{message}"
      )

      response = await client.post(
        f"{openrouter_api_url}/chat/completions",
        headers=build_openrouter_headers(openrouter_api_key),
        json={
          "model": openrouter_model,
          "temperature": 0.3,
          "messages": [
            {"role": "system", "content": system_instructions},
            {"role": "user", "content": augmented_query}
          ]
        }
      )
    except httpx.RequestError as e:
      print(f"OpenRouter Request Error: {e}")
      return {
        "narration": f"DM似乎在翻阅规则书... (OpenRouter 网络连接错误: {e})",
        "choices": [],
        "state_update": {},
        "scene_change": None,
        "location_change": None,
        "quest_update": None
      }
  
  if response.status_code != 200:
    print(f"OpenRouter Error: {response.status_code} - {response.text}")
    error_msg = response.text
    try:
      error_json = response.json().get("error", {})
      error_msg = error_json.get("message", error_msg)
    except:
      pass
    if response.status_code == 401 or "User not found" in error_msg:
      error_msg = "当前 OPENROUTER_API_KEY 无效、已失效，或对应账户不可用。"
    elif response.status_code == 402:
      error_msg = "OpenRouter 账户余额不足，无法继续调用模型。"
    elif response.status_code == 429:
      error_msg = "OpenRouter 调用频率或额度受限，请稍后重试。"

    return {
      "narration": f"DM似乎在翻阅规则书... (OpenRouter 连接失败: {response.status_code} - {error_msg})",
      "choices": [],
      "state_update": {},
      "scene_change": None,
      "location_change": None,
      "quest_update": None
    }
    
  answer = extract_openrouter_message_content(response.json())
  try:
    result_data = parse_json_block(answer)
  except HTTPException:
    result_data = {"narration": answer}

  reply = normalize_ai_reply(module, result_data)
  reply = enforce_check_result_consistency(reply, check_result)
  append_message(session_id, "ai", reply["narration"])
  apply_inventory_update(investigator, reply.get("inventory_update"))
  trigger_outcome = apply_reply_to_session(session_id, module, message, reply, check_result)
  if trigger_outcome["revealed_clues"]:
    reply["revealed_clues"] = trigger_outcome["revealed_clues"]
  if trigger_outcome["granted_handouts"]:
    reply["granted_handouts"] = trigger_outcome["granted_handouts"]
  return reply


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.post("/beta-access/send-code")
async def send_beta_access_code(request: BetaEmailOtpSendRequest):
  email = normalize_beta_email(request.email)
  access_record = ensure_beta_access_email_record(email)
  historical_user = bool(access_record["is_verified"])
  requested_at = now_iso()
  access_record["last_otp_requested_at"] = requested_at
  access_record["updated_at"] = requested_at
  resend_available_in_seconds = get_beta_access_resend_available_in_seconds(access_record)
  active_code_expires_in_seconds = get_beta_access_active_otp_remaining_seconds(email)
  if resend_available_in_seconds > 0:
    save_beta_access_email_record(access_record)
    return beta_access_rate_limited_response(
      email=email,
      detail=f"验证码已发送，请在 {resend_available_in_seconds} 秒后再试",
      retry_after_seconds=resend_available_in_seconds,
      active_code_expires_in_seconds=active_code_expires_in_seconds
    )
  send_window_seconds = max(1, beta_access_otp_send_window_seconds())
  send_window_limit = max(1, beta_access_otp_send_limit_per_window())
  recent_sent_timestamps = list_beta_access_recent_sent_timestamps(email, window_seconds=send_window_seconds)
  if len(recent_sent_timestamps) >= send_window_limit:
    oldest_recent_sent_at = parse_iso_datetime(recent_sent_timestamps[0])
    retry_after_seconds = seconds_until_datetime(
      oldest_recent_sent_at + timedelta(seconds=send_window_seconds) if oldest_recent_sent_at else None
    ) or 1
    save_beta_access_email_record(access_record)
    return beta_access_rate_limited_response(
      email=email,
      detail=f"发送过于频繁，请在 {retry_after_seconds} 秒后再试",
      retry_after_seconds=retry_after_seconds,
      active_code_expires_in_seconds=active_code_expires_in_seconds
    )
  if not historical_user and count_verified_beta_access_emails() >= beta_access_email_limit():
    save_beta_access_email_record(access_record)
    return BetaEmailOtpSendResult(
      status="waitlist_required",
      email=email,
      historical_user=False,
      waitlist_open=True,
      expires_in_seconds=None,
      resend_available_in_seconds=None
    ).model_dump()
  code = f"{random.randint(0, 999999):06d}"
  otp_record = create_beta_access_otp(email, code)
  try:
    deliver_email_otp(email, code, beta_access_otp_ttl_seconds())
  except RuntimeError:
    mark_beta_access_otp_failed(otp_record["otp_id"], "delivery_failed")
    raise HTTPException(status_code=503, detail="验证码发送失败，请稍后重试")
  sent_at = now_iso()
  access_record["last_otp_sent_at"] = sent_at
  access_record["updated_at"] = sent_at
  save_beta_access_email_record(access_record)
  mark_beta_access_otp_sent(otp_record["otp_id"])
  return BetaEmailOtpSendResult(
    status="otp_sent",
    email=email,
    historical_user=historical_user,
    waitlist_open=False,
    expires_in_seconds=beta_access_otp_ttl_seconds(),
    resend_available_in_seconds=beta_access_otp_resend_cooldown_seconds()
  ).model_dump()


@app.post("/beta-access/verify-code")
async def verify_beta_access_code(request: BetaEmailOtpVerifyRequest):
  email = normalize_beta_email(request.email)
  code = request.code.strip()
  if not re.fullmatch(r"\d{6}", code):
    raise HTTPException(status_code=400, detail="验证码格式无效")
  otp_record = get_latest_active_beta_access_otp(email)
  if not otp_record:
    raise HTTPException(status_code=400, detail="验证码不存在或已失效")
  expires_at = parse_iso_datetime(otp_record["expires_at"])
  if expires_at is None or expires_at <= datetime.now(timezone.utc):
    mark_beta_access_otp_expired(otp_record["otp_id"])
    raise HTTPException(status_code=400, detail="验证码已过期")
  if not hmac.compare_digest(otp_record["code_hash"], hash_secret(code)):
    increment_beta_access_otp_attempt(otp_record["otp_id"])
    raise HTTPException(status_code=400, detail="验证码错误")
  mark_beta_access_otp_verified(otp_record["otp_id"])
  verified_at = now_iso()
  access_record = ensure_beta_access_email_record(email)
  access_record["is_verified"] = True
  access_record["first_verified_at"] = access_record["first_verified_at"] or verified_at
  access_record["last_verified_at"] = verified_at
  access_record["last_login_at"] = verified_at
  access_record["updated_at"] = verified_at
  save_beta_access_email_record(access_record)
  credential = issue_beta_access_token(email)
  return BetaEmailOtpVerifyResult(
    email=email,
    credential=BetaAccessCredential(token=credential["token"], expires_at=credential["expires_at"])
  ).model_dump()


@app.post("/beta-access/waitlist")
async def register_beta_access_waitlist(request: BetaWaitlistRequest):
  email = normalize_beta_email(request.email)
  created = upsert_beta_waitlist_entry(email, request.source_status)
  updated_at = now_iso()
  access_record = ensure_beta_access_email_record(email)
  access_record["last_waitlist_at"] = updated_at
  access_record["waitlist_status"] = "active"
  access_record["updated_at"] = updated_at
  save_beta_access_email_record(access_record)
  return BetaWaitlistResult(email=email, created=created).model_dump()


@app.get("/beta-access/session")
async def get_beta_access_session(authorization: str | None = Header(default=None)):
  token_record = require_beta_access_token(authorization)
  return BetaAccessSessionResult(
    email=token_record["email"],
    expires_at=token_record["expires_at"]
  ).model_dump()


def require_admin_token(x_admin_token: str | None = Header(default=None)):
  expected = os.getenv("ADMIN_API_TOKEN", "")
  if expected and x_admin_token != expected:
    raise HTTPException(status_code=401, detail="Unauthorized")


def admin_response(data: Any, meta: dict | None = None):
  return {"data": data, "meta": meta or {}, "error": None}


def validate_module_for_publish(module: CocScenario) -> list[str]:
  errors: list[str] = []
  if not module.title.strip():
    errors.append("标题不能为空")
  if not module.background.strip():
    errors.append("背景不能为空")
  location_ids = {location_ref(location) for location in module.locations}
  scene_ids = {scene.id for scene in module.sequence}
  clue_ids = {clue.id for clue in module.clues}
  handout_ids = {handout.id for handout in module.handouts}
  asset_ids = {asset.id for asset in module.assets}
  trigger_ids = {rule.id for rule in module.triggers}
  for step in module.sequence:
    if step.location_id and step.location_id not in location_ids:
      errors.append(f"场景 {step.id} 引用了不存在的地点 {step.location_id}")
    missing_prerequisites = [scene_id for scene_id in step.prerequisites if scene_id not in scene_ids]
    if missing_prerequisites:
      errors.append(f"场景 {step.id} 引用了不存在的前置场景 {', '.join(missing_prerequisites)}")
  for item in module.scene_items:
    if item.location_id not in location_ids:
      errors.append(f"场景物件 {item.id} 引用了不存在的地点 {item.location_id}")
    missing_clues = [clue_id for clue_id in item.linked_clue_ids if clue_id not in clue_ids]
    if missing_clues:
      errors.append(f"场景物件 {item.id} 引用了不存在的线索 {', '.join(missing_clues)}")
  for handout in module.handouts:
    missing_assets = [asset_id for asset_id in handout.asset_ids if asset_id not in asset_ids]
    if missing_assets:
      errors.append(f"资料 {handout.id} 引用了不存在的资源 {', '.join(missing_assets)}")
  for clue in module.clues:
    if clue.trigger_ref and clue.trigger_ref not in trigger_ids:
      errors.append(f"线索 {clue.id} 引用了不存在的触发器 {clue.trigger_ref}")
  for rule in module.triggers:
    for action in rule.actions:
      if action.type == "reveal_clue" and action.target_id and action.target_id not in clue_ids:
        errors.append(f"触发器 {rule.id} 引用了不存在的线索 {action.target_id}")
      if action.type == "grant_handout" and action.target_id and action.target_id not in handout_ids:
        errors.append(f"触发器 {rule.id} 引用了不存在的资料 {action.target_id}")
      if action.type == "branch_scene" and action.target_id and action.target_id not in scene_ids:
        errors.append(f"触发器 {rule.id} 引用了不存在的场景 {action.target_id}")
      if action.type == "move_location" and action.target_id and action.target_id not in location_ids:
        errors.append(f"触发器 {rule.id} 引用了不存在的地点 {action.target_id}")
  return errors


@app.get("/modules")
async def list_modules():
  return {"modules": [build_module_summary(module) for module in list_visible_published_scenarios()]}


@app.get("/modules/{module_id}")
async def get_module(module_id: str):
  if module_id != BASELINE_MODULE_ID:
    raise HTTPException(status_code=404, detail="Scenario not found")
  module = get_published_scenario(module_id)
  if not module:
    raise HTTPException(status_code=404, detail="Scenario not found")
  return {"module": build_module_summary(module)}


@app.post("/modules/{module_id}/pdf")
async def upload_module_pdf(module_id: str, file: UploadFile = File(...)):
  filename = f"{module_id}.pdf"
  dest = os.path.join(storage_dir, filename)
  content = await file.read()
  if not content:
    raise HTTPException(status_code=400, detail="Empty file")
  with open(dest, "wb") as target:
    target.write(content)
  text = extract_pdf_text(dest)
  if not text:
    raise HTTPException(status_code=400, detail="PDF解析失败")
  structured = normalize_structured_module(module_id, await ai_structure_module(text), "pdf", "published")
  structured_modules[module_id] = structured
  save_structured_module(module_id, structured)
  create_module_version(module_id, structured, "published", "legacy pdf import")
  return {"module_id": module_id, "path": dest, "structured": structured.model_dump()}


@app.get("/modules/{module_id}/pdf")
async def get_module_pdf(module_id: str):
  filename = os.path.join(storage_dir, f"{module_id}.pdf")
  if not os.path.exists(filename):
    raise HTTPException(status_code=404, detail="PDF not found")
  return FileResponse(filename, media_type="application/pdf")


@app.get("/modules/{module_id}/structured")
async def get_structured_module(module_id: str):
  if module_id != BASELINE_MODULE_ID:
    raise HTTPException(status_code=404, detail="Scenario not found")
  module = ensure_default_structured(module_id)
  return {"module": serialize_player_scenario(module)}


@app.post("/modules/{module_id}/structured")
async def save_structured_module_api(module_id: str, payload: CocScenario):
  normalized = normalize_structured_module(module_id, payload, payload.source_type or "api", "published")
  structured_modules[module_id] = normalized
  save_structured_module(module_id, normalized)
  create_module_version(module_id, normalized, "published", "public structured update")
  return {"module_id": module_id, "status": "stored"}


@app.get("/admin/stats")
async def admin_stats(x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  visible_sessions = list_visible_sessions()
  recent_session = None
  if visible_sessions:
    recent_session = max(
      visible_sessions,
      key=lambda item: item.get("created_at") or item.get("started_at", "")
    )
    recent_session = recent_session.get("created_at") or recent_session.get("started_at")
  return admin_response({
    "module_count": len(list_visible_published_scenarios()),
    "structured_module_count": len(list_visible_published_scenarios()),
    "character_count": len(characters),
    "session_count": len(visible_sessions),
    "recent_session_at": recent_session
  })


@app.get("/admin/users")
async def admin_users(x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  aggregate: dict[str, dict] = {}
  for session in list_visible_sessions():
    user_id = session.get("user_id") or "anonymous"
    data = aggregate.setdefault(user_id, {
      "user_id": user_id,
      "session_count": 0,
      "investigator_ids": set(),
      "last_active_at": ""
    })
    data["session_count"] += 1
    investigator_id = session.get("investigator_id")
    if investigator_id:
      data["investigator_ids"].add(investigator_id)
    updated_at = session.get("updated_at", "")
    if updated_at > data["last_active_at"]:
      data["last_active_at"] = updated_at
  users = [{
    "user_id": item["user_id"],
    "session_count": item["session_count"],
    "character_count": len(item["investigator_ids"]),
    "last_active_at": item["last_active_at"]
  } for item in aggregate.values()]
  users.sort(key=lambda item: item["last_active_at"], reverse=True)
  return admin_response(users, {"total": len(users)})


@app.get("/admin/beta-access")
async def admin_beta_access(x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  email_records = list_beta_access_email_records()
  verified_emails = [item for item in email_records if item["is_verified"]]
  waitlist_entries = list_beta_waitlist_entries()
  recent_verified_at = next((item["last_verified_at"] for item in verified_emails if item["last_verified_at"]), None)
  recent_waitlist_at = next((item["last_requested_at"] for item in waitlist_entries if item["last_requested_at"]), None)
  return admin_response({
    "summary": {
      "verified_total": len(verified_emails),
      "waitlist_total": len(waitlist_entries),
      "active_waitlist_total": len([item for item in waitlist_entries if item["status"] == "active"]),
      "verified_limit": beta_access_email_limit(),
      "recent_verified_at": recent_verified_at,
      "recent_waitlist_at": recent_waitlist_at
    },
    "verified_emails": verified_emails,
    "waitlist": waitlist_entries
  })


@app.get("/admin/sessions")
async def admin_sessions(
  user_id: str | None = Query(default=None),
  module_id: str | None = Query(default=None),
  status: str | None = Query(default=None),
  limit: int = Query(default=100, ge=1, le=500),
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  items = [serialize_admin_session(item) for item in list_visible_sessions()]
  if user_id:
    items = [item for item in items if (item.get("user_id") or "anonymous") == user_id]
  if module_id:
    items = [item for item in items if item.get("module_id") == module_id]
  if status:
    items = [item for item in items if item.get("status") == status]
  items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
  return admin_response(items[:limit], {"total": len(items), "limit": limit})


@app.get("/admin/modules")
async def admin_modules(
  q: str | None = Query(default=None),
  offset: int = Query(default=0, ge=0),
  limit: int = Query(default=50, ge=1, le=200),
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  draft_updated_at_map = get_module_draft_updated_at_map()
  version_count_map = get_module_version_count_map()
  latest_import_summary_map = get_latest_import_summary_map()
  rows = []
  structured = get_published_scenario(BASELINE_MODULE_ID)
  draft = draft_modules.get(BASELINE_MODULE_ID)
  reference = draft or structured
  if reference:
    rows.append({
      "id": BASELINE_MODULE_ID,
      "name": reference.title,
      "description": reference.background,
      "has_structured": structured is not None,
      "has_draft": BASELINE_MODULE_ID in draft_modules,
      "schema_version": (draft.schema_version if draft else (structured.schema_version if structured else None)),
      "status": (draft.status if draft else (structured.status if structured else "draft")),
      "draft_updated_at": draft_updated_at_map.get(BASELINE_MODULE_ID),
      "version_count": version_count_map.get(BASELINE_MODULE_ID, 0),
      "latest_import": latest_import_summary_map.get(BASELINE_MODULE_ID)
    })
  if q:
    q_lower = q.lower()
    rows = [row for row in rows if q_lower in row["id"].lower() or q_lower in row["name"].lower()]
  rows.sort(key=lambda item: item["id"])
  paged = rows[offset : offset + limit]
  return admin_response(paged, {"total": len(rows), "offset": offset, "limit": limit})


@app.post("/admin/modules/import")
async def admin_import_module(
  background_tasks: BackgroundTasks,
  module_id: str = Form(...),
  parser_type: str = Form("dify"),
  file: UploadFile = File(...),
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  content = await file.read()
  if not content:
    raise HTTPException(status_code=400, detail="Empty file")
  source_file_type = infer_source_type(file.filename or "")
  task = {
    "task_id": f"import_{uuid4().hex[:10]}",
    "module_id": module_id,
    "source_file_name": file.filename or f"{module_id}.{source_file_type}",
    "source_file_type": source_file_type,
    "parser_type": parser_type,
    "parser_version": "v1",
    "status": "uploaded",
    "raw_output": None,
    "normalized_output": None,
    "error_message": None,
    "created_at": now_iso(),
    "updated_at": now_iso()
  }
  update_import_task_runtime(
    task,
    status="uploaded",
    stage="upload_received",
    output_summary="文件上传成功，任务已创建，后台将继续完成结构化与 draft 落库",
    next_action="可留在当前页面轮询任务状态，完成后直接进入编辑器继续修订"
  )
  save_import_task(task)
  stored_file_path = os.path.join(storage_dir, f"{task['task_id']}.{source_file_type}")
  with open(stored_file_path, "wb") as target:
    target.write(content)
  background_tasks.add_task(process_admin_import_task, task, stored_file_path, file.content_type)
  return JSONResponse(
    content=admin_response({"task": serialize_import_task(task, include_payload=False)}),
    status_code=202
  )


@app.get("/admin/modules/import-tasks/{task_id}")
async def admin_import_task_detail(task_id: str, x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  task = get_import_task(task_id)
  if not task:
    raise HTTPException(status_code=404, detail="Import task not found")
  return admin_response(task)


@app.get("/admin/modules/{module_id}")
async def admin_module_detail(module_id: str, x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  draft = get_module_draft(module_id)
  structured = get_published_scenario(module_id)
  if not structured and not draft:
    raise HTTPException(status_code=404, detail="Scenario not found")
  reference = draft or structured
  return admin_response({
    "module_id": module_id,
    "module_info": {
      "name": reference.title,
      "description": reference.background,
      "tags": reference.themes or ["COC"]
    },
    "structured": structured.model_dump() if structured else None,
    "draft": draft.model_dump() if draft else None,
    "versions": list_module_versions(module_id),
    "import_tasks": list_module_import_tasks(module_id)
  })


@app.put("/admin/modules/{module_id}/structured")
async def admin_update_module_structured(
  module_id: str,
  payload: CocScenario,
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  normalized = normalize_structured_module(module_id, payload, payload.source_type or "admin", "draft")
  save_module_draft(module_id, normalized)
  version = create_module_version(module_id, normalized, "draft", "manual draft save")
  return admin_response({"module_id": module_id, "status": "draft_saved", "draft": normalized.model_dump(), "version": version})


@app.post("/admin/modules/{module_id}/publish")
async def admin_publish_module(
  module_id: str,
  payload: ModulePublishRequest,
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  draft = get_module_draft(module_id)
  if not draft:
    raise HTTPException(status_code=404, detail="Draft not found")
  errors = validate_module_for_publish(draft)
  if errors:
    raise HTTPException(status_code=422, detail={"message": "发布校验失败", "errors": errors})
  published = normalize_structured_module(module_id, draft, draft.source_type or "admin", "published")
  structured_modules[module_id] = published
  save_structured_module(module_id, published)
  version = create_module_version(module_id, published, "published", payload.note or "manual publish")
  return admin_response({
    "module_id": module_id,
    "status": "published",
    "version": version,
    "validation_errors": []
  })


@app.post("/admin/modules/{module_id}/validate")
async def admin_validate_module(module_id: str, x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  candidate = get_module_draft(module_id) or structured_modules.get(module_id)
  if not candidate:
    candidate = ensure_default_structured(module_id)
  errors = validate_module_for_publish(candidate)
  return admin_response({
    "module_id": module_id,
    "valid": len(errors) == 0,
    "errors": errors
  })


@app.post("/admin/modules/{module_id}/assets")
async def admin_add_module_asset(
  module_id: str,
  payload: AdminAssetCreate,
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  structured = get_module_draft(module_id) or structured_modules.get(module_id)
  if not structured:
    structured = ensure_default_structured(module_id)
  asset_id = payload.id or f"asset_{uuid4().hex[:8]}"
  asset = CocAsset(
    id=asset_id,
    name=payload.name,
    type=payload.type,
    url=payload.url,
    description=payload.description
  )
  structured.assets = [*structured.assets, asset]
  normalized = normalize_structured_module(module_id, structured, structured.source_type or "admin", "draft")
  save_module_draft(module_id, normalized)
  return admin_response({"module_id": module_id, "asset": asset.model_dump(), "draft": normalized.model_dump()})


def evaluate_trigger_rule(
  rule: CocTriggerRule,
  state: dict,
  player_message: str,
  reply: dict
) -> bool:
  def compare_value(current: Any, expected: str, operator: str) -> bool:
    current_text = "" if current is None else str(current)
    if operator == "contains":
      return expected in current_text
    if operator == "gte":
      try:
        return float(current_text or 0) >= float(expected)
      except ValueError:
        return False
    if operator == "lte":
      try:
        return float(current_text or 0) <= float(expected)
      except ValueError:
        return False
    return current_text == expected

  def get_state_value(key: str | None) -> Any:
    if not key:
      return None
    if key in state:
      return state.get(key)
    return flags.get(key)

  flags = state.get("flags", {})
  message_lower = player_message.lower()
  discovered = set(state.get("discovered_clue_ids", []))
  granted = set(state.get("granted_handout_ids", []))
  for condition in rule.conditions:
    operator = condition.operator or "eq"
    if condition.type == "location":
      if not compare_value(state.get("current_location_id"), str(condition.value), operator):
        return False
    elif condition.type == "scene":
      if not compare_value(state.get("current_scene_id"), str(condition.value), operator):
        return False
    elif condition.type == "action":
      value = str(condition.value).lower()
      if value not in message_lower:
        return False
    elif condition.type == "state":
      current = get_state_value(condition.key)
      if current is None:
        return False
      if not compare_value(current, condition.value, operator):
        return False
    elif condition.type == "check_result":
      value = str(condition.value).lower()
      if value not in json.dumps(reply, ensure_ascii=False).lower():
        return False
    elif condition.type == "clue":
      if condition.value not in discovered:
        return False
    elif condition.type == "handout":
      if condition.value not in granted:
        return False
    elif condition.type == "time":
      if not compare_value(state.get("time_progress"), str(condition.value), operator):
        return False
  return True


def add_handout_to_inventory(investigator_id: str | None, handout: CocHandout) -> None:
  if not investigator_id or investigator_id not in characters:
    return
  investigator = characters[investigator_id]
  inventory = investigator.get("inventory", [])
  inventory.append({
    "id": f"item_{uuid4().hex[:8]}",
    "name": handout.title,
    "category": "document",
    "origin": "module",
    "is_equipped": False,
    "quantity": 1,
    "description": handout.content,
    "stats": {}
  })
  investigator["inventory"] = inventory
  save_character_to_db(investigator)


def evaluate_progress_condition(condition: str, state: dict[str, Any], player_message: str) -> bool:
  text = condition.strip()
  if not text:
    return True
  if ":" not in text:
    return text.lower() in player_message.lower()
  prefix, raw_value = text.split(":", 1)
  value = raw_value.strip()
  if prefix == "scene":
    return str(state.get("current_scene_id") or "") == value
  if prefix == "location":
    return str(state.get("current_location_id") or "") == value
  if prefix == "action":
    return value.lower() in player_message.lower()
  if prefix == "trigger":
    return value in set(state.get("triggered_rule_ids", []))
  if prefix == "flag":
    key, _, expected = value.partition("=")
    if not key:
      return False
    return str(state.get("flags", {}).get(key.strip())) == expected.strip()
  return value.lower() in player_message.lower()


def auto_reveal_clues(module: CocScenario, state: dict[str, Any], player_message: str) -> list[dict[str, Any]]:
  discovered = state.setdefault("discovered_clue_ids", [])
  triggered = set(state.get("triggered_rule_ids", []))
  revealed: list[dict[str, Any]] = []
  for clue in module.clues:
    if clue.id in discovered:
      continue
    if clue.trigger_ref and clue.trigger_ref not in triggered:
      continue
    if not clue.discovery_conditions:
      continue
    if not all(
      evaluate_progress_condition(condition, state, player_message)
      for condition in clue.discovery_conditions
    ):
      continue
    discovered.append(clue.id)
    revealed.append(clue.model_dump())
  state["discovered_clue_ids"] = discovered
  return revealed


def auto_grant_handouts(module: CocScenario, state: dict[str, Any], player_message: str, investigator_id: str | None) -> list[dict[str, Any]]:
  granted = state.setdefault("granted_handout_ids", [])
  granted_set = set(granted)
  granted_payloads: list[dict[str, Any]] = []
  for handout in module.handouts:
    if handout.id in granted_set:
      continue
    if not handout.grant_conditions:
      continue
    if not all(
      evaluate_progress_condition(condition, state, player_message)
      for condition in handout.grant_conditions
    ):
      continue
    granted.append(handout.id)
    granted_set.add(handout.id)
    granted_payloads.append(handout.model_dump())
    if handout.add_to_inventory:
      add_handout_to_inventory(investigator_id, handout)
  state["granted_handout_ids"] = granted
  return granted_payloads


def apply_structured_triggers(
  session_id: str,
  module: CocScenario,
  player_message: str,
  reply: dict
) -> dict:
  state = get_session_state_record(session_id)
  discovered = state.setdefault("discovered_clue_ids", [])
  granted = state.setdefault("granted_handout_ids", [])
  triggered = state.setdefault("triggered_rule_ids", [])
  revealed_clues: list[dict] = []
  granted_handouts: list[dict] = []
  flags = state.setdefault("flags", {})
  investigator_id = sessions.get(session_id, {}).get("investigator_id")
  for rule in module.triggers:
    if rule.once and rule.id in triggered:
      continue
    if not evaluate_trigger_rule(rule, state, player_message, reply):
      continue
    for action in rule.actions:
      if action.type == "reveal_clue" and action.target_id:
        clue = next((item for item in module.clues if item.id == action.target_id), None)
        if clue and clue.id not in discovered:
          discovered.append(clue.id)
          revealed_clues.append(clue.model_dump())
      elif action.type == "grant_handout" and action.target_id:
        handout = next((item for item in module.handouts if item.id == action.target_id), None)
        if handout and handout.id not in granted:
          granted.append(handout.id)
          granted_handouts.append(handout.model_dump())
          if handout.add_to_inventory:
            add_handout_to_inventory(investigator_id, handout)
      elif action.type == "update_state":
        payload = action.payload if isinstance(action.payload, dict) else {}
        flags.update(payload)
      elif action.type == "branch_scene" and action.target_id:
        state["current_scene_id"] = action.target_id
      elif action.type == "move_location" and action.target_id:
        state["current_location_id"] = action.target_id
    triggered.append(rule.id)
  state["discovered_clue_ids"] = discovered
  state["granted_handout_ids"] = granted
  state["triggered_rule_ids"] = triggered
  state["flags"] = flags
  sync_state_with_scene(module, state)
  return {"revealed_clues": revealed_clues, "granted_handouts": granted_handouts}


@app.post("/characters")
async def create_character(payload: CharacterCreate):
  character_id = payload.id or str(uuid4())
  import copy

  characteristics = payload.characteristics.model_dump()
  con_value = characteristics.get("con") or 50
  siz_value = characteristics.get("siz") or 50
  pow_value = characteristics.get("pow") or 50
  default_hp = max(1, (con_value + siz_value) // 10)
  default_mp = max(0, pow_value // 5)
  status_payload = payload.status.model_dump() if payload.status else {
    "hp": build_status_track(default_hp, default_hp),
    "mp": build_status_track(default_mp, default_mp),
    "san": build_status_track(pow_value, pow_value),
    "conditions": [],
    "flags": {},
  }
  occupation = payload.profile.occupation or "默认"
  inventory = copy.deepcopy(COC_OCCUPATION_CONFIG.get(occupation, COC_OCCUPATION_CONFIG["默认"]))
  for item in inventory:
    item["id"] = f"item_{uuid4().hex[:8]}"
  inventory.extend([item.model_dump() for item in payload.inventory])

  data = {
    "id": character_id,
    "rule_system": "coc",
    "profile": {
      **payload.profile.model_dump(),
      "avatar": payload.profile.avatar or "🕵️",
    },
    "characteristics": characteristics,
    "skills": payload.skills,
    "inventory": inventory,
    "status": status_payload,
    "created_at": now_iso(),
    "tags": [],
    "extra": {},
  }
  characters[character_id] = data
  save_character_to_db(data)
  return {"character": data}

@app.post("/characters/{character_id}/equip")
async def toggle_equip(character_id: str, payload: dict):
    item_id = payload.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="Missing item_id")
        
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    inventory = char.get("inventory", [])
    item_found = False
    
    for item in inventory:
        if item.get("id") == item_id:
            # Toggle equip status
            item["is_equipped"] = not item.get("is_equipped", False)
            item_found = True
            break
            
    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found in inventory")
        
    char["inventory"] = inventory
    save_character_to_db(char)
    
    return {"character": char}

@app.post("/characters/{character_id}/xp")
async def add_xp(character_id: str, payload: XPUpdate):
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    raise HTTPException(status_code=400, detail="当前版本仅支持 COC 调查员链路")

@app.post("/characters/{character_id}/skill-check")
async def skill_check(character_id: str, payload: SkillCheck):
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    if char.get("rule_system") != "coc":
        raise HTTPException(status_code=400, detail="Only CoC characters use Skill Marks")
        
    if payload.success:
        flags = char.setdefault("status", {}).setdefault("flags", {})
        marks = set(flags.get("skill_marks", []))
        if payload.skill_name not in marks:
            marks.add(payload.skill_name)
            flags["skill_marks"] = list(marks)
            save_character_to_db(char)
            
    return {"character": char}

@app.post("/characters/{character_id}/growth")
async def trigger_growth(character_id: str):
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    if char.get("rule_system") != "coc":
        raise HTTPException(status_code=400, detail="Only CoC characters use Growth")
        
    marks = char.get("status", {}).get("flags", {}).get("skill_marks", [])
    if not marks:
        return {"message": "No skills marked for growth", "results": []}
        
    results = []
    skill_values = char.get("skills", {})
    
    growth_log = []
    
    for skill_name in marks:
        current_val = skill_values.get(skill_name, 50)
        check_roll = random.randint(1, 100)
        
        if check_roll > current_val:
            growth_amount = random.randint(1, 6) + 1
            new_val = current_val + growth_amount
            skill_values[skill_name] = new_val
            growth_log.append({
                "skill": skill_name,
                "roll": check_roll,
                "old": current_val,
                "gain": growth_amount,
                "new": new_val,
                "success": True
            })
        else:
            growth_log.append({
                "skill": skill_name,
                "roll": check_roll,
                "threshold": current_val,
                "success": False
            })
            
    char["skills"] = skill_values
    char.setdefault("status", {}).setdefault("flags", {})["skill_marks"] = []
    save_character_to_db(char)
    
    return {"results": growth_log, "character": char}

@app.get("/characters")
async def list_characters():
  return {"characters": list(characters.values())}


@app.post("/sessions")
async def create_session(payload: SessionCreate):
  try:
    structured = ensure_default_structured(payload.scenario_id)
  except HTTPException:
    raise HTTPException(status_code=404, detail=f"Scenario not found: {payload.scenario_id}")

  if payload.investigator_id not in characters:
    raise HTTPException(status_code=404, detail="Investigator not found")
  
  session_id = str(uuid4())
  initial_scene = get_sorted_scenes(structured)[0] if structured.sequence else None
  initial_location_id = initial_scene.location_id if initial_scene and initial_scene.location_id else (location_ref(structured.locations[0]) if structured.locations else None)
  data = {
    "id": session_id,
    "rule_system": "coc",
    "scenario_id": payload.scenario_id,
    "investigator_id": payload.investigator_id,
    "started_at": now_iso(),
    "updated_at": now_iso(),
    "user_id": payload.user_id,
    "state": {
      "current_scene_id": initial_scene.id if initial_scene else None,
      "current_location_id": initial_location_id,
      "discovered_clue_ids": [],
      "granted_handout_ids": [],
      "triggered_rule_ids": [],
      "flags": {"active_quest": initial_scene.title} if initial_scene else {},
      "time_progress": None,
    }
  }
  sessions[session_id] = data
  sync_state_with_scene(structured, data["state"])
  intro_message = build_session_intro_message(structured, data["state"])

  session_logs[session_id] = [
      CocChatMessage(role="ai", content=intro_message)
  ]
  return {"session": data}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
  session = sessions.get(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")

  investigator_id = session.get("investigator_id")
  investigator = characters.get(investigator_id) if investigator_id else None
  state = get_session_state_record(session_id)
  sync_state_with_scene(ensure_default_structured(session["scenario_id"]), state)
  return {
    "session": {
      **session,
      "state": serialize_player_state(state),
    },
    "investigator": investigator
  }


def serialize_session_runtime(session_id: str) -> dict[str, Any]:
  session = sessions[session_id]
  module = ensure_default_structured(session["scenario_id"])
  state = get_session_state_record(session_id)
  sync_state_with_scene(module, state)
  current_scene = get_current_scene(module, state)
  current_location = get_location_by_id(module, state.get("current_location_id"))
  flags = state.get("flags", {})
  visible_location_ids = set(
    item for item in (flags.get("visible_location_ids", []) if isinstance(flags, dict) else [])
    if isinstance(item, str) and item
  )
  visited_scene_ids = set(
    item for item in (flags.get("visited_scene_ids", []) if isinstance(flags, dict) else [])
    if isinstance(item, str) and item
  )
  scene_progress = []
  for scene in get_sorted_scenes(module):
    if scene.id not in visited_scene_ids:
      continue
    status = "active" if current_scene and scene.id == current_scene.id else "completed"
    scene_progress.append(serialize_player_scene(scene, status))
  visible_locations = [
    serialize_player_location(location)
    for location in module.locations
    if location_ref(location) in visible_location_ids
  ]
  return {
    "scenario": serialize_player_scenario(module),
    "current_scene": serialize_player_scene(current_scene, "active") if current_scene else None,
    "current_location": serialize_player_location(current_location) if current_location else None,
    "locations": visible_locations,
    "scene_items": [],
    "discovered_clues": [clue.model_dump() for clue in get_discovered_clues(module, state)],
    "granted_handouts": [handout.model_dump() for handout in get_granted_handouts(module, state)],
    "scenes": scene_progress
  }


@app.get("/sessions/{session_id}/state")
async def get_session_state(session_id: str):
  if session_id not in sessions:
    raise HTTPException(status_code=404, detail="Session not found")
  return {
    "messages": [item.model_dump() for item in get_recent_messages(session_id)],
    "state": serialize_player_state(get_session_state_record(session_id)),
    **serialize_session_runtime(session_id)
  }


@app.post("/sessions/{session_id}/checks")
async def resolve_session_check(session_id: str, payload: CheckResolutionRequest):
  session = sessions.get(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  investigator = characters.get(session["investigator_id"])
  if not investigator:
    raise HTTPException(status_code=404, detail="Investigator not found")
  result = evaluate_coc_check(investigator, payload.check, payload.roll_value)
  return {"result": result.model_dump()}


@app.post("/gm/action")
async def gm_action(payload: ActionRequest):
  reply = await generate_ai_reply(
    payload.session_id,
    payload.message,
    payload.check_result.model_dump() if payload.check_result else None,
  )
  return {"result": reply}


@app.post("/gm/action/external")
async def gm_action_external(payload: ExternalActionRequest):
  session = sessions.get(payload.session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  module = ensure_default_structured(session["scenario_id"])
  append_message(payload.session_id, "player", payload.player_action)
  
  result_data = payload.result
  if isinstance(result_data, str):
    try:
      result_data = json.loads(result_data)
    except json.JSONDecodeError:
      result_data = {"narration": result_data}
  
  reply = normalize_ai_reply(module, result_data)
  reply = enforce_check_result_consistency(reply, reply.get("check_result"))
  append_message(payload.session_id, "ai", reply["narration"])
  trigger_outcome = apply_reply_to_session(payload.session_id, module, payload.player_action, reply)
  if trigger_outcome["revealed_clues"]:
    reply["revealed_clues"] = trigger_outcome["revealed_clues"]
  if trigger_outcome["granted_handouts"]:
    reply["granted_handouts"] = trigger_outcome["granted_handouts"]
  return {"result": reply}


@app.websocket("/ws/{session_id}")
async def gm_ws(websocket: WebSocket, session_id: str):
  await websocket.accept()
  ws_clients.setdefault(session_id, set()).add(websocket)
  try:
    while True:
      message = await websocket.receive_text()
      reply = await generate_ai_reply(session_id, message)
      await websocket.send_json(reply)
  except WebSocketDisconnect:
    ws_clients[session_id].remove(websocket)


@app.on_event("startup")
async def startup_event():
  init_db()
  load_structured_modules()
  load_characters_from_db()
  write_seed_scenario_to_system()
