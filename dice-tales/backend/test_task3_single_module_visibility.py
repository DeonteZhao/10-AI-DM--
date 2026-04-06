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


class Task3SingleModuleVisibilityTest(unittest.TestCase):
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
    seed.write_seed_scenario_to_system(storage_dir=self.temp_dir.name)

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

  def create_character(self, name: str) -> str:
    response = self.client.post(
      "/characters",
      json={
        "profile": {"name": name, "occupation": "记者"},
        "characteristics": {"pow": 60, "con": 50, "siz": 50, "dex": 55, "edu": 70, "int": 65},
        "skills": {"侦查": 60},
        "inventory": []
      }
    )
    self.assertEqual(response.status_code, 200)
    return response.json()["character"]["id"]

  def test_public_and_admin_views_only_show_seed_module(self):
    legacy_id = "legacy_hidden_module"
    legacy_scenario = build_legacy_scenario(legacy_id)
    store_response = self.client.post(f"/modules/{legacy_id}/structured", json=legacy_scenario)
    self.assertEqual(store_response.status_code, 200)

    legacy_draft = main.normalize_structured_module(legacy_id, legacy_scenario, "legacy_test", "draft")
    main.save_module_draft(legacy_id, legacy_draft)
    main.create_module_version(legacy_id, legacy_draft, "draft", "legacy snapshot")
    created_at = main.now_iso()
    main.save_import_task({
      "task_id": "import_legacy_hidden",
      "module_id": legacy_id,
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

    character_id = self.create_character("可见调查员")
    seed_session = self.client.post(
      "/sessions",
      json={"scenario_id": seed.MODULE_ID, "investigator_id": character_id, "user_id": "seed_user"}
    )
    self.assertEqual(seed_session.status_code, 200)
    legacy_session = self.client.post(
      "/sessions",
      json={"scenario_id": legacy_id, "investigator_id": character_id, "user_id": "legacy_user"}
    )
    self.assertEqual(legacy_session.status_code, 200)

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
    self.assertEqual(admin_sessions[0]["user_id"], "seed_user")

    admin_users = self.client.get("/admin/users").json()["data"]
    self.assertEqual(len(admin_users), 1)
    self.assertEqual(admin_users[0]["user_id"], "seed_user")

  def test_seed_module_runtime_endpoints_work_for_character_and_session(self):
    public_modules = self.client.get("/modules").json()["modules"]
    self.assertEqual(len(public_modules), 1)
    self.assertEqual(public_modules[0]["id"], seed.MODULE_ID)
    self.assertEqual(public_modules[0]["name"], seed.MODULE_TITLE)

    module_detail = self.client.get(f"/modules/{seed.MODULE_ID}").json()["module"]
    self.assertEqual(module_detail["id"], seed.MODULE_ID)
    self.assertEqual(module_detail["name"], seed.MODULE_TITLE)

    structured_detail = self.client.get(f"/modules/{seed.MODULE_ID}/structured").json()["module"]
    self.assertEqual(structured_detail["module_id"], seed.MODULE_ID)
    self.assertGreaterEqual(len(structured_detail["locations"]), 1)
    self.assertGreaterEqual(len(structured_detail["sequence"]), 1)

    character_id = self.create_character("运行调查员")
    session_response = self.client.post(
      "/sessions",
      json={"scenario_id": seed.MODULE_ID, "investigator_id": character_id}
    )
    self.assertEqual(session_response.status_code, 200)
    session_id = session_response.json()["session"]["id"]

    state_response = self.client.get(f"/sessions/{session_id}/state")
    self.assertEqual(state_response.status_code, 200)
    runtime = state_response.json()
    self.assertEqual(runtime["scenario"]["module_id"], seed.MODULE_ID)
    self.assertIsNotNone(runtime["current_scene"])
    self.assertIsNotNone(runtime["current_location"])
    self.assertGreaterEqual(len(runtime["scenes"]), 1)
    self.assertGreaterEqual(len(runtime["messages"]), 1)


if __name__ == "__main__":
  unittest.main()
