from tempfile import TemporaryDirectory
import os
import unittest

from fastapi.testclient import TestClient

import backend.main as main


def build_sample_scenario(module_id: str) -> dict:
  return {
    "module_id": module_id,
    "source_type": "test",
    "status": "published",
    "rule_system": "coc",
    "title": "鬼屋调查",
    "background": "调查员受托前往一栋古宅，查清最近的异响来源。",
    "themes": ["调查", "恐怖"],
    "locations": [
      {
        "id": "loc_hall",
        "name": "门厅",
        "description": "破旧的门厅，灰尘遍地。",
        "connections": ["loc_study"],
        "npcs": []
      },
      {
        "id": "loc_study",
        "name": "书房",
        "description": "书柜与书桌挤满整个房间。",
        "connections": ["loc_hall"],
        "npcs": []
      }
    ],
    "npcs": [],
    "events": [],
    "quests": [],
    "sequence": [
      {
        "id": "scene_hall",
        "title": "踏入古宅",
        "location_id": "loc_hall",
        "order": 0,
        "description": "你刚刚进入古宅，异响从深处传来。",
        "prerequisites": []
      },
      {
        "id": "scene_study",
        "title": "调查书房",
        "location_id": "loc_study",
        "order": 1,
        "description": "书桌抽屉似乎藏着关键秘密。",
        "prerequisites": ["scene_hall"]
      }
    ],
    "triggers": [
      {
        "id": "trigger_drawer",
        "name": "打开抽屉",
        "once": True,
        "conditions": [
          {"type": "scene", "value": "scene_study"},
          {"type": "action", "value": "抽屉", "operator": "contains"}
        ],
        "actions": [
          {"type": "reveal_clue", "target_id": "clue_letter"},
          {"type": "grant_handout", "target_id": "handout_letter"},
          {"type": "update_state", "payload": {"drawer_opened": "yes"}}
        ]
      }
    ],
    "clues": [
      {
        "id": "clue_letter",
        "title": "烧焦的信纸",
        "content": "信中提到地下室祭坛。",
        "source": "书桌抽屉",
        "discovery_conditions": ["scene:scene_study", "action:搜索"],
        "visibility": "explicit",
        "trigger_ref": "trigger_drawer"
      }
    ],
    "handouts": [
      {
        "id": "handout_letter",
        "title": "信纸复印件",
        "content": "这是可交给玩家的手递资料。",
        "type": "text",
        "asset_ids": [],
        "grant_conditions": [],
        "add_to_inventory": True
      }
    ],
    "scene_items": [
      {
        "id": "item_desk",
        "name": "旧书桌",
        "location_id": "loc_study",
        "description": "抽屉有被人撬开过的痕迹。",
        "interactions": ["搜索", "打开抽屉"],
        "linked_clue_ids": ["clue_letter"]
      }
    ],
    "assets": [],
    "extensions": {},
    "custom_types": [],
    "schema_version": 3
  }


class ScenarioRuntimeTask3Test(unittest.TestCase):
  def setUp(self):
    self.temp_dir = TemporaryDirectory()
    self.original_storage_dir = main.storage_dir
    main.storage_dir = self.temp_dir.name
    os.environ["ADMIN_API_TOKEN"] = ""
    main.structured_modules.clear()
    main.draft_modules.clear()
    main.characters.clear()
    main.sessions.clear()
    main.session_logs.clear()
    main.init_db()
    self.client = TestClient(main.app)

  def tearDown(self):
    self.client.close()
    main.storage_dir = self.original_storage_dir
    try:
      self.temp_dir.cleanup()
    except PermissionError:
      pass
    main.structured_modules.clear()
    main.draft_modules.clear()
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

  def test_normalize_structured_module_drops_legacy_location_fallbacks(self):
    normalized = main.normalize_structured_module(
      "legacy_case",
      {
        "rule_system": "dnd",
        "title": "旧结构案件",
        "background": "测试",
        "locations": [{"name": "大厅", "description": "入口", "connections": [], "npcs": []}],
        "npcs": [],
        "events": [],
        "quests": [],
        "sequence": [{"id": "scene_entry", "title": "入口", "location": "大厅", "description": "开始", "prerequisites": []}],
        "triggers": [],
        "clues": [],
        "handouts": [],
        "scene_items": [],
        "assets": [],
        "themes": [],
        "extensions": {},
        "custom_types": []
      },
      "test",
      "draft"
    )
    self.assertEqual(normalized.rule_system, "coc")
    self.assertIsNone(normalized.sequence[0].location_id)

    with self.assertRaises(Exception):
      main.normalize_structured_module(
        "legacy_case",
        {
          "rule_system": "coc",
          "title": "旧结构案件",
          "background": "测试",
          "locations": [{"name": "大厅", "description": "入口", "connections": [], "npcs": []}],
          "npcs": [],
          "events": [],
          "quests": [],
          "sequence": [{"id": "scene_entry", "title": "入口", "location_id": "loc_0", "description": "开始", "prerequisites": []}],
          "triggers": [],
          "clues": [],
          "handouts": [],
          "scene_items": [{"id": "item_key", "name": "钥匙", "location": "大厅", "description": "生锈", "interactions": [], "linked_clue_ids": []}],
          "assets": [],
          "themes": [],
          "extensions": {},
          "custom_types": []
        },
        "test",
        "draft"
      )

  def test_session_runtime_uses_scene_trigger_clue_and_handout_chain(self):
    scenario_id = "task3_case"
    headers = self.auth_headers("task3_runtime@example.com")
    scenario = build_sample_scenario(scenario_id)
    store_response = self.client.post(f"/modules/{scenario_id}/structured", json=scenario)
    self.assertEqual(store_response.status_code, 200)

    character_response = self.client.post(
      "/characters",
      headers=headers,
      json={
        "id": "investigator_task3",
        "profile": {"name": "韩梅梅", "occupation": "记者"},
        "characteristics": {"pow": 60, "con": 50, "siz": 50},
        "skills": {"侦查": 60},
        "inventory": [],
      }
    )
    self.assertEqual(character_response.status_code, 200)

    session_response = self.client.post(
      "/sessions",
      headers=headers,
      json={"scenario_id": scenario_id, "investigator_id": "investigator_task3"}
    )
    self.assertEqual(session_response.status_code, 200)
    session_id = session_response.json()["session"]["id"]

    move_response = self.client.post(
      "/gm/action/external",
      headers=headers,
      json={
        "session_id": session_id,
        "player_action": "我前往书房",
        "result": {
          "narration": "你进入了书房。",
          "scene_change": "scene_study",
          "location_change": "loc_study",
          "state_update": {}
        }
      }
    )
    self.assertEqual(move_response.status_code, 200)

    trigger_response = self.client.post(
      "/gm/action/external",
      headers=headers,
      json={
        "session_id": session_id,
        "player_action": "我搜索书桌并打开抽屉",
        "result": {
          "narration": "抽屉里露出一叠烧焦的纸张。",
          "state_update": {}
        }
      }
    )
    self.assertEqual(trigger_response.status_code, 200)
    result = trigger_response.json()["result"]
    self.assertEqual(result["revealed_clues"][0]["id"], "clue_letter")
    self.assertEqual(result["granted_handouts"][0]["id"], "handout_letter")

    runtime_state = self.client.get(f"/sessions/{session_id}/state", headers=headers).json()
    self.assertEqual(runtime_state["state"]["current_scene_id"], "scene_study")
    self.assertEqual(runtime_state["state"]["current_location_id"], "loc_study")
    self.assertEqual(runtime_state["current_scene"]["id"], "scene_study")
    self.assertEqual(runtime_state["current_location"]["id"], "loc_study")
    self.assertEqual(runtime_state["scene_items"], [])
    self.assertIn("loc_study", [item["id"] for item in runtime_state["locations"]])
    self.assertEqual(runtime_state["discovered_clues"][0]["id"], "clue_letter")
    self.assertEqual(runtime_state["granted_handouts"][0]["id"], "handout_letter")


if __name__ == "__main__":
  unittest.main()
