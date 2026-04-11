from tempfile import TemporaryDirectory
import asyncio
import os
import unittest

from fastapi.testclient import TestClient

import backend.main as main


def build_test_scenario(module_id: str) -> dict:
  return {
    "module_id": module_id,
    "source_type": "test",
    "status": "published",
    "rule_system": "coc",
    "title": "隔离测试模组",
    "background": "用于测试角色归属与模型路由。",
    "themes": ["COC"],
    "locations": [
      {
        "id": "test_street",
        "name": "测试街道",
        "description": "一条用于测试的街道。",
        "connections": [],
        "npcs": []
      }
    ],
    "npcs": [],
    "events": [],
    "quests": [],
    "sequence": [
      {
        "id": "opening_scene",
        "title": "开场",
        "location_id": "test_street",
        "order": 0,
        "description": "调查员进入测试街道。",
        "prerequisites": []
      }
    ],
    "triggers": [],
    "clues": [],
    "handouts": [],
    "scene_items": [],
    "assets": [],
    "extensions": {},
    "custom_types": [],
    "schema_version": 3
  }


class Task5UserIsolationAndGeoRoutingTest(unittest.TestCase):
  def setUp(self):
    self.temp_dir = TemporaryDirectory()
    self.original_storage_dir = main.storage_dir
    main.storage_dir = self.temp_dir.name
    os.environ["ADMIN_API_TOKEN"] = ""
    main.draft_modules.clear()
    main.structured_modules.clear()
    main.characters.clear()
    main.sessions.clear()
    main.session_logs.clear()
    main.init_db()
    self.client = TestClient(main.app)
    self.module_id = "task5_test_module"
    response = self.client.post(f"/modules/{self.module_id}/structured", json=build_test_scenario(self.module_id))
    self.assertEqual(response.status_code, 200)

  def tearDown(self):
    self.client.close()
    main.storage_dir = self.original_storage_dir
    try:
      self.temp_dir.cleanup()
    except PermissionError:
      pass
    main.draft_modules.clear()
    main.structured_modules.clear()
    main.characters.clear()
    main.sessions.clear()
    main.session_logs.clear()

  def mark_verified(self, email: str) -> None:
    record = main.ensure_beta_access_email_record(email)
    timestamp = main.now_iso()
    record["is_verified"] = True
    record["first_verified_at"] = record["first_verified_at"] or timestamp
    record["last_verified_at"] = timestamp
    record["last_login_at"] = timestamp
    record["updated_at"] = timestamp
    main.save_beta_access_email_record(record)

  def auth_headers(self, email: str) -> dict[str, str]:
    self.mark_verified(email)
    credential = main.issue_beta_access_token(email)
    return {"authorization": f"Bearer {credential['token']}"}

  def create_character(self, headers: dict[str, str], name: str) -> str:
    response = self.client.post(
      "/characters",
      headers=headers,
      json={
        "profile": {"name": name, "occupation": "记者"},
        "characteristics": {"pow": 60, "con": 55, "siz": 55, "dex": 60, "edu": 70, "int": 65},
        "skills": {"侦查": 60, "聆听": 55},
        "inventory": []
      }
    )
    self.assertEqual(response.status_code, 200)
    return response.json()["character"]["id"]

  def test_characters_and_sessions_are_scoped_by_beta_email(self):
    alpha_headers = self.auth_headers("alpha@example.com")
    beta_headers = self.auth_headers("beta@example.com")
    alpha_character_id = self.create_character(alpha_headers, "甲调查员")
    beta_character_id = self.create_character(beta_headers, "乙调查员")

    alpha_characters = self.client.get("/characters", headers=alpha_headers)
    beta_characters = self.client.get("/characters", headers=beta_headers)

    self.assertEqual(alpha_characters.status_code, 200)
    self.assertEqual(beta_characters.status_code, 200)
    self.assertEqual([item["id"] for item in alpha_characters.json()["characters"]], [alpha_character_id])
    self.assertEqual([item["id"] for item in beta_characters.json()["characters"]], [beta_character_id])
    self.assertEqual(alpha_characters.json()["characters"][0]["user_id"], "alpha@example.com")
    self.assertEqual(beta_characters.json()["characters"][0]["user_id"], "beta@example.com")

    denied_character_response = self.client.post(
      f"/characters/{alpha_character_id}/skill-check",
      headers=beta_headers,
      json={"skill_name": "侦查", "success": True}
    )
    self.assertEqual(denied_character_response.status_code, 404)

    session_response = self.client.post(
      "/sessions",
      headers=alpha_headers,
      json={"scenario_id": self.module_id, "investigator_id": alpha_character_id}
    )
    self.assertEqual(session_response.status_code, 200)
    session_id = session_response.json()["session"]["id"]

    own_session_response = self.client.get(f"/sessions/{session_id}", headers=alpha_headers)
    denied_session_response = self.client.get(f"/sessions/{session_id}", headers=beta_headers)

    self.assertEqual(own_session_response.status_code, 200)
    self.assertEqual(own_session_response.json()["session"]["user_id"], "alpha@example.com")
    self.assertEqual(denied_session_response.status_code, 404)

  def test_resolve_openrouter_model_switches_for_cn_and_overseas(self):
    original_env = {
      "OPENROUTER_CN_MODEL": os.environ.get("OPENROUTER_CN_MODEL"),
      "OPENROUTER_KP_MODEL": os.environ.get("OPENROUTER_KP_MODEL"),
      "OPENROUTER_MODEL": os.environ.get("OPENROUTER_MODEL"),
    }
    os.environ["OPENROUTER_CN_MODEL"] = "deepseek/deepseek-v3.2-exp"
    os.environ["OPENROUTER_KP_MODEL"] = "openai/gpt-4o-mini"
    os.environ["OPENROUTER_MODEL"] = "anthropic/claude-3.5-sonnet"
    try:
      cn_kp_model = asyncio.run(main.resolve_openrouter_model("kp", "CN", None, None))
      overseas_kp_model = asyncio.run(main.resolve_openrouter_model("kp", "US", None, None))
      overseas_import_model = asyncio.run(main.resolve_openrouter_model("import", "US", None, None))
    finally:
      for key, value in original_env.items():
        if value is None:
          os.environ.pop(key, None)
        else:
          os.environ[key] = value

    self.assertEqual(cn_kp_model, "deepseek/deepseek-v3.2-exp")
    self.assertEqual(overseas_kp_model, "openai/gpt-4o-mini")
    self.assertEqual(overseas_import_model, "anthropic/claude-3.5-sonnet")
