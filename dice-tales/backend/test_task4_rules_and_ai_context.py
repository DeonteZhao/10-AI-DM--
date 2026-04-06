from tempfile import TemporaryDirectory
import json
import os
import unittest
from unittest.mock import patch

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
    "triggers": [],
    "clues": [],
    "handouts": [],
    "scene_items": [
      {
        "id": "item_desk",
        "name": "旧书桌",
        "location_id": "loc_study",
        "description": "抽屉有被人撬开过的痕迹。",
        "interactions": ["搜索", "打开抽屉"],
        "linked_clue_ids": []
      }
    ],
    "assets": [],
    "extensions": {},
    "custom_types": [],
    "schema_version": 3
  }


class FakeResponse:
  def __init__(self, answer: dict):
    self.status_code = 200
    self.text = json.dumps(answer, ensure_ascii=False)
    self._answer = answer

  def json(self):
    return self._answer


class Task4RulesAndAiContextTest(unittest.TestCase):
  def setUp(self):
    self.temp_dir = TemporaryDirectory()
    self.original_storage_dir = main.storage_dir
    self.original_dify_api_key = os.environ.get("DIFY_API_KEY")
    self.original_dify_api_url = os.environ.get("DIFY_API_URL")
    self.original_openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
    self.original_openrouter_api_url = os.environ.get("OPENROUTER_API_URL")
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
    if self.original_dify_api_key is None:
      os.environ.pop("DIFY_API_KEY", None)
    else:
      os.environ["DIFY_API_KEY"] = self.original_dify_api_key
    if self.original_dify_api_url is None:
      os.environ.pop("DIFY_API_URL", None)
    else:
      os.environ["DIFY_API_URL"] = self.original_dify_api_url
    if self.original_openrouter_api_key is None:
      os.environ.pop("OPENROUTER_API_KEY", None)
    else:
      os.environ["OPENROUTER_API_KEY"] = self.original_openrouter_api_key
    if self.original_openrouter_api_url is None:
      os.environ.pop("OPENROUTER_API_URL", None)
    else:
      os.environ["OPENROUTER_API_URL"] = self.original_openrouter_api_url
    try:
      self.temp_dir.cleanup()
    except PermissionError:
      pass
    main.structured_modules.clear()
    main.draft_modules.clear()
    main.characters.clear()
    main.sessions.clear()
    main.session_logs.clear()

  def create_runtime(self) -> str:
    scenario_id = "task4_case"
    store_response = self.client.post(f"/modules/{scenario_id}/structured", json=build_sample_scenario(scenario_id))
    self.assertEqual(store_response.status_code, 200)

    character_response = self.client.post(
      "/characters",
      json={
        "id": "investigator_task4",
        "profile": {"name": "韩梅梅", "occupation": "记者"},
        "characteristics": {"pow": 60, "dex": 70, "con": 50, "siz": 50},
        "skills": {"侦查": 60, "聆听": 55},
        "inventory": [],
      }
    )
    self.assertEqual(character_response.status_code, 200)

    session_response = self.client.post(
      "/sessions",
      json={"scenario_id": scenario_id, "investigator_id": "investigator_task4"}
    )
    self.assertEqual(session_response.status_code, 200)
    return session_response.json()["session"]["id"]

  def test_session_check_endpoint_uses_unified_coc_rule_result(self):
    session_id = self.create_runtime()

    response = self.client.post(
      f"/sessions/{session_id}/checks",
      json={
        "check": {
          "check_id": "check_search",
          "action": "搜索书桌",
          "kind": "skill",
          "key": "侦查",
          "name": "侦查",
          "difficulty": "hard"
        },
        "roll_value": 20
      }
    )

    self.assertEqual(response.status_code, 200)
    result = response.json()["result"]
    self.assertEqual(result["check_id"], "check_search")
    self.assertEqual(result["kind"], "skill")
    self.assertEqual(result["key"], "侦查")
    self.assertEqual(result["target"], 60)
    self.assertEqual(result["required_threshold"], 30)
    self.assertEqual(result["level"], "hard")
    self.assertTrue(result["passed"])
    self.assertEqual(result["roll"]["expression"], "1d100")
    self.assertEqual(result["roll"]["value"], 20)

  def test_gm_action_sends_new_ai_context_and_consumes_structured_check_result(self):
    session_id = self.create_runtime()
    state = main.get_session_state_record(session_id)
    state["current_scene_id"] = "scene_study"
    state["current_location_id"] = "loc_study"
    state.setdefault("flags", {})["pending_check"] = {
      "check_id": "check_search",
      "action": "搜索书桌",
      "kind": "skill",
      "key": "侦查",
      "name": "侦查",
      "difficulty": "regular"
    }
    captured_payload: dict[str, dict] = {}
    os.environ["OPENROUTER_API_KEY"] = "task4-test-key"
    os.environ["OPENROUTER_API_URL"] = "https://example.invalid"

    class FakeAsyncClient:
      def __init__(self, *args, **kwargs):
        pass

      async def __aenter__(self):
        return self

      async def __aexit__(self, exc_type, exc, tb):
        return False

      async def post(self, url: str, headers: dict | None = None, json: dict | None = None):
        captured_payload["json"] = json or {}
        answer = {
          "choices": [{
            "message": {
              "content": json_module.dumps({
                "narration": "你在书桌抽屉里发现新的痕迹。",
                "state_update": {"desk_checked": "yes"},
                "required_check": {
                  "check_id": "check_listen",
                  "action": "分辨暗处动静",
                  "kind": "skill",
                  "key": "聆听",
                  "name": "聆听",
                  "difficulty": "hard"
                }
              }, ensure_ascii=False)
            }
          }]
        }
        return FakeResponse(answer)

    json_module = json
    with patch("backend.main.httpx.AsyncClient", FakeAsyncClient):
      response = self.client.post(
        "/gm/action",
        json={
          "session_id": session_id,
          "message": "我完成了侦查检定。",
          "check_result": {
            "check_id": "check_search",
            "action": "搜索书桌",
            "kind": "skill",
            "key": "侦查",
            "name": "侦查",
            "target": 60,
            "required_threshold": 60,
            "difficulty": "regular",
            "passed": True,
            "level": "regular",
            "roll": {"expression": "1d100", "value": 42, "details": [42]}
          }
        }
      )

    self.assertEqual(response.status_code, 200)
    result = response.json()["result"]
    self.assertEqual(result["required_check"]["check_id"], "check_listen")
    self.assertEqual(result["required_check"]["key"], "聆听")

    payload = captured_payload["json"]
    query_payload = payload["messages"][1]["content"]
    context_json = query_payload.split("[会话上下文]\n", 1)[1].split("\n[玩家行动]\n", 1)[0]
    context_payload = json.loads(context_json)
    self.assertEqual(context_payload["investigator"]["profile"]["name"], "韩梅梅")
    self.assertEqual(context_payload["runtime"]["current_scene"]["id"], "scene_study")
    self.assertEqual(context_payload["runtime"]["current_location"]["id"], "loc_study")
    self.assertEqual(context_payload["runtime"]["scene_items"][0]["id"], "item_desk")
    self.assertEqual(context_payload["runtime"]["last_check_result"]["check_id"], "check_search")
    self.assertIn("[会话上下文]", query_payload)

    runtime_state = main.get_session_state_record(session_id)
    self.assertEqual(runtime_state["flags"]["desk_checked"], "yes")
    self.assertEqual(runtime_state["flags"]["last_check_result"]["check_id"], "check_search")
    self.assertEqual(runtime_state["flags"]["pending_check"]["check_id"], "check_listen")

  def test_gm_action_rewrites_failed_social_check_that_model_narrates_as_success(self):
    session_id = self.create_runtime()
    state = main.get_session_state_record(session_id)
    state["current_scene_id"] = "scene_study"
    state["current_location_id"] = "loc_study"

    class FakeAsyncClient:
      def __init__(self, *args, **kwargs):
        pass

      async def __aenter__(self):
        return self

      async def __aexit__(self, exc_type, exc, tb):
        return False

      async def post(self, url: str, headers: dict | None = None, json: dict | None = None):
        answer = {
          "choices": [{
            "message": {
              "content": json_module.dumps({
                "narration": "守墓人被你说服了，立刻把自己知道的关键情报全都告诉了你。",
                "state_update": {"npc_cooperated": "yes"},
                "scene_change": "scene_study"
              }, ensure_ascii=False)
            }
          }]
        }
        return FakeResponse(answer)

    json_module = json
    with patch("backend.main.httpx.AsyncClient", FakeAsyncClient):
      response = self.client.post(
        "/gm/action",
        json={
          "session_id": session_id,
          "message": "我试着说服守墓人开口。",
          "check_result": {
            "check_id": "check_social_fail",
            "action": "说服守墓人",
            "kind": "skill",
            "key": "说服",
            "name": "说服",
            "target": 40,
            "required_threshold": 40,
            "difficulty": "regular",
            "passed": False,
            "level": "failure",
            "roll": {"expression": "1d100", "value": 77, "details": [77]}
          }
        }
      )

    self.assertEqual(response.status_code, 200)
    result = response.json()["result"]
    self.assertIn("检定失败", result["narration"])
    self.assertIn("没有获得关键情报", result["narration"])
    self.assertNotIn("被你说服", result["narration"])
    self.assertEqual(result["state_update"], {})
    self.assertIsNone(result["scene_change"])

    runtime_state = main.get_session_state_record(session_id)
    self.assertEqual(runtime_state["flags"]["last_check_result"]["check_id"], "check_social_fail")
    self.assertNotIn("npc_cooperated", runtime_state["flags"])


if __name__ == "__main__":
  unittest.main()
