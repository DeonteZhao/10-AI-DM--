from pathlib import Path
from tempfile import TemporaryDirectory
import os
import unittest

from fastapi.testclient import TestClient

import backend.main as main
import backend.seed_coc_scenario as seed


def build_legacy_scenario(module_id: str) -> dict:
  return {
    "module_id": module_id,
    "source_type": "legacy_test",
    "status": "published",
    "rule_system": "coc",
    "title": "历史模组",
    "background": "这是一条不应继续出现在列表中的历史数据。",
    "themes": ["COC", "legacy"],
    "locations": [
      {
        "id": "legacy_hall",
        "name": "旧大厅",
        "description": "历史大厅",
        "connections": [],
        "npcs": []
      }
    ],
    "npcs": [],
    "events": [],
    "quests": [],
    "sequence": [
      {
        "id": "legacy_scene",
        "title": "旧开场",
        "location_id": "legacy_hall",
        "order": 0,
        "description": "旧模组的开场场景。",
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


class Task4SingleModuleBaselineTest(unittest.TestCase):
  def setUp(self):
    self.temp_dir = TemporaryDirectory()
    self.storage_path = Path(self.temp_dir.name)
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
    self.seed_result = seed.write_seed_scenario_to_system(storage_dir=self.temp_dir.name)

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

  def inject_legacy_residuals(self, module_id: str) -> None:
    legacy_scenario = build_legacy_scenario(module_id)
    store_response = self.client.post(f"/modules/{module_id}/structured", json=legacy_scenario)
    self.assertEqual(store_response.status_code, 200)

    legacy_draft = main.normalize_structured_module(module_id, legacy_scenario, "legacy_test", "draft")
    main.save_module_draft(module_id, legacy_draft)
    main.create_module_version(module_id, legacy_draft, "draft", "legacy snapshot")
    created_at = main.now_iso()
    main.save_import_task({
      "task_id": "import_legacy_hidden",
      "module_id": module_id,
      "source_file_name": "legacy.docx",
      "source_file_type": "docx",
      "parser_type": "dify",
      "parser_version": "v1",
      "status": "completed",
      "raw_output": {"meta": {"stage": "completed", "result_source": "dify"}},
      "normalized_output": legacy_draft.model_dump(),
      "error_message": None,
      "created_at": created_at,
      "updated_at": created_at
    })

  def test_historical_modules_are_hidden_from_visible_lists(self):
    legacy_id = "legacy_hidden_module"
    user_email = "seed_user@example.com"
    headers = self.auth_headers(user_email)
    self.inject_legacy_residuals(legacy_id)

    character_id = self.create_character(headers, "可见调查员")
    visible_session = self.client.post(
      "/sessions",
      headers=headers,
      json={"scenario_id": seed.MODULE_ID, "investigator_id": character_id}
    )
    self.assertEqual(visible_session.status_code, 200)

    hidden_session = self.client.post(
      "/sessions",
      headers=headers,
      json={"scenario_id": legacy_id, "investigator_id": character_id}
    )
    self.assertEqual(hidden_session.status_code, 200)

    public_modules = self.client.get("/modules").json()["modules"]
    self.assertEqual(len(public_modules), 1)
    self.assertEqual(public_modules[0]["id"], seed.MODULE_ID)

    public_detail = self.client.get(f"/modules/{legacy_id}")
    self.assertEqual(public_detail.status_code, 404)
    public_structured = self.client.get(f"/modules/{legacy_id}/structured")
    self.assertEqual(public_structured.status_code, 404)

    admin_modules = self.client.get("/admin/modules").json()["data"]
    self.assertEqual(len(admin_modules), 1)
    self.assertEqual(admin_modules[0]["id"], seed.MODULE_ID)

    admin_stats = self.client.get("/admin/stats").json()["data"]
    self.assertEqual(admin_stats["module_count"], 1)
    self.assertEqual(admin_stats["structured_module_count"], 1)
    self.assertEqual(admin_stats["session_count"], 1)

    admin_sessions = self.client.get("/admin/sessions").json()["data"]
    self.assertEqual(len(admin_sessions), 1)
    self.assertEqual(admin_sessions[0]["module_id"], seed.MODULE_ID)
    self.assertEqual(admin_sessions[0]["user_id"], user_email)

    admin_users = self.client.get("/admin/users").json()["data"]
    self.assertEqual(len(admin_users), 1)
    self.assertEqual(admin_users[0]["user_id"], user_email)

  def test_docx_module_works_in_public_admin_and_runtime_flows(self):
    user_email = "runtime_user@example.com"
    headers = self.auth_headers(user_email)
    public_modules = self.client.get("/modules").json()["modules"]
    self.assertEqual(len(public_modules), 1)
    self.assertEqual(public_modules[0]["id"], seed.MODULE_ID)
    self.assertEqual(public_modules[0]["name"], seed.MODULE_TITLE)

    public_detail = self.client.get(f"/modules/{seed.MODULE_ID}")
    self.assertEqual(public_detail.status_code, 200)
    self.assertEqual(public_detail.json()["module"]["id"], seed.MODULE_ID)

    public_structured = self.client.get(f"/modules/{seed.MODULE_ID}/structured")
    self.assertEqual(public_structured.status_code, 200)
    structured_payload = public_structured.json()["module"]
    self.assertEqual(structured_payload["module_id"], seed.MODULE_ID)
    self.assertEqual(structured_payload["title"], seed.MODULE_TITLE)
    self.assertGreaterEqual(len(structured_payload["opening_options"]), 1)

    admin_modules = self.client.get("/admin/modules").json()["data"]
    self.assertEqual(len(admin_modules), 1)
    self.assertEqual(admin_modules[0]["id"], seed.MODULE_ID)
    self.assertTrue(admin_modules[0]["has_structured"])
    self.assertTrue(admin_modules[0]["has_draft"])
    self.assertIsNone(admin_modules[0]["latest_import"])

    admin_detail = self.client.get(f"/admin/modules/{seed.MODULE_ID}").json()["data"]
    self.assertIn(admin_detail["structured"]["source_type"], {seed.SOURCE_TYPE, seed.FALLBACK_SOURCE_TYPE})
    self.assertEqual(admin_detail["draft"]["source_type"], admin_detail["structured"]["source_type"])

    validation = self.client.post(f"/admin/modules/{seed.MODULE_ID}/validate").json()["data"]
    self.assertTrue(validation["valid"])
    self.assertEqual(validation["errors"], [])

    character_id = self.create_character(headers, "运行调查员")
    session_response = self.client.post(
      "/sessions",
      headers=headers,
      json={"scenario_id": seed.MODULE_ID, "investigator_id": character_id}
    )
    self.assertEqual(session_response.status_code, 200)
    session_id = session_response.json()["session"]["id"]
    self.assertEqual(session_response.json()["session"]["user_id"], user_email)

    state_response = self.client.get(f"/sessions/{session_id}/state", headers=headers)
    self.assertEqual(state_response.status_code, 200)
    runtime = state_response.json()
    self.assertEqual(runtime["scenario"]["module_id"], seed.MODULE_ID)
    self.assertIsNotNone(runtime["current_scene"])
    self.assertIsNotNone(runtime["current_location"])
    self.assertGreaterEqual(len(runtime["scenes"]), 1)
    self.assertGreaterEqual(len(runtime["messages"]), 1)

  def test_import_versions_and_storage_match_single_module_baseline(self):
    self.assertEqual(self.seed_result["module_id"], seed.MODULE_ID)
    self.assertEqual(self.seed_result["validation_errors"], [])
    self.assertTrue(self.seed_result["draft_saved"])
    self.assertTrue(self.seed_result["published_saved"])

    admin_detail = self.client.get(f"/admin/modules/{seed.MODULE_ID}").json()["data"]
    self.assertEqual(admin_detail["import_tasks"], [])
    self.assertEqual(len(admin_detail["versions"]), 1)
    self.assertEqual(admin_detail["versions"][0]["status"], "published")
    self.assertEqual(admin_detail["versions"][0]["note"], "seed docx baseline")
    self.assertEqual(admin_detail["versions"][0]["title"], seed.MODULE_TITLE)
    self.assertEqual(admin_detail["versions"][0]["rule_system"], "coc")
    self.assertEqual(admin_detail["versions"][0]["schema_version"], 3)

    stored_files = sorted(path.name for path in self.storage_path.iterdir())
    self.assertEqual(stored_files, ["modules.db"])
    self.assertFalse(any(path.suffix.lower() in {".docx", ".pdf"} for path in self.storage_path.iterdir()))


if __name__ == "__main__":
  unittest.main()
