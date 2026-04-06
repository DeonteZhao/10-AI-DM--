from tempfile import TemporaryDirectory
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import backend.main as main


def sample_module(title: str, source_type: str = "dify") -> dict:
  return {
    "module_id": None,
    "source_type": source_type,
    "status": "draft",
    "rule_system": "coc",
    "title": title,
    "background": "模组背景",
    "locations": [],
    "npcs": [],
    "events": [],
    "quests": [],
    "sequence": [],
    "triggers": [],
    "clues": [],
    "handouts": [],
    "scene_items": [],
    "assets": [],
    "themes": [],
    "extensions": {"raw_section": {"notes": "kept"}},
    "custom_types": [{"name": "custom"}],
    "schema_version": 3
  }


class ImportArchitectureTest(unittest.TestCase):
  def setUp(self):
    self.temp_dir = TemporaryDirectory()
    self.original_storage_dir = main.storage_dir
    main.storage_dir = self.temp_dir.name
    os.environ["ADMIN_API_TOKEN"] = ""
    main.draft_modules.clear()
    main.structured_modules.clear()
    main.characters.clear()
    main.init_db()
    self.client = TestClient(main.app)

  def tearDown(self):
    self.client.close()
    main.storage_dir = self.original_storage_dir
    try:
      self.temp_dir.cleanup()
    except PermissionError:
      pass
    main.draft_modules.clear()
    main.structured_modules.clear()

  def post_import(self, module_id: str, parser_type: str = "dify"):
    return self.client.post(
      "/admin/modules/import",
      data={"module_id": module_id, "parser_type": parser_type},
      files={"file": ("module.docx", b"fake", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )

  def test_empty_storage_has_no_visible_modules(self):
    public_modules = self.client.get("/modules").json()["modules"]
    admin_modules = self.client.get("/admin/modules").json()["data"]
    admin_stats = self.client.get("/admin/stats").json()["data"]

    self.assertEqual(public_modules, [])
    self.assertEqual(admin_modules, [])
    self.assertEqual(admin_stats["module_count"], 0)
    self.assertEqual(admin_stats["structured_module_count"], 0)

  def test_import_runs_as_async_task_and_writes_draft(self):
    async def fake_run_dify_import(module_id, filename, content, content_type, progress_callback=None):
      if progress_callback:
        await progress_callback("dify_running", "Dify 已返回结构化候选结果")
      payload = sample_module("异步导入成功", "dify")
      return {"workflow": "ok"}, payload

    with patch.object(main, "run_dify_import", new=fake_run_dify_import):
      response = self.post_import("module_async_success")

    self.assertEqual(response.status_code, 202)
    upload_task = response.json()["data"]["task"]
    self.assertEqual(upload_task["status"], "uploaded")
    task_id = upload_task["task_id"]

    task_detail = self.client.get(f"/admin/modules/import-tasks/{task_id}").json()["data"]
    self.assertEqual(task_detail["status"], "completed")
    self.assertEqual(task_detail["result_source"], "dify")
    self.assertTrue(task_detail["draft_ready"])

    module_detail = self.client.get("/admin/modules/module_async_success").json()["data"]
    self.assertEqual(module_detail["draft"]["title"], "异步导入成功")
    self.assertEqual(module_detail["draft"]["extensions"]["raw_section"]["notes"], "kept")
    self.assertGreaterEqual(len(module_detail["versions"]), 1)

  def test_dify_timeout_falls_back_to_draft_import(self):
    async def fake_run_dify_import(module_id, filename, content, content_type, progress_callback=None):
      raise main.ImportPipelineError(
        "dify_workflow_failed",
        "Dify Workflow 超时，准备切换 fallback",
        "dify_running",
        "dify",
        {"status_code": 504},
        fallback_allowed=True
      )

    async def fake_run_fallback_import(filename, content, task_id, dify_error=None):
      payload = sample_module("Fallback 成功", "openrouter_fallback")
      return {"fallback_from": dify_error.error_type, "openrouter_output": payload}, payload, "openrouter_fallback"

    with patch.object(main, "run_dify_import", new=fake_run_dify_import), patch.object(main, "run_fallback_import", new=fake_run_fallback_import):
      response = self.post_import("module_fallback_success")

    task_id = response.json()["data"]["task"]["task_id"]
    task_detail = self.client.get(f"/admin/modules/import-tasks/{task_id}").json()["data"]
    self.assertEqual(task_detail["status"], "completed")
    self.assertEqual(task_detail["result_source"], "openrouter_fallback")
    self.assertEqual(task_detail["fallback_from"], "dify_workflow_failed")

    module_detail = self.client.get("/admin/modules/module_fallback_success").json()["data"]
    self.assertEqual(module_detail["draft"]["source_type"], "openrouter_fallback")

  def test_unrecognized_dify_output_marks_task_failed(self):
    async def fake_run_dify_import(module_id, filename, content, content_type, progress_callback=None):
      raise main.ImportPipelineError(
        "structured_result_unrecognized",
        "Dify 返回成功，但结构化结果不可识别",
        "dify_running",
        "dify",
        {"outputs": {"text": "not-json"}}
      )

    with patch.object(main, "run_dify_import", new=fake_run_dify_import):
      response = self.post_import("module_unrecognized")

    task_id = response.json()["data"]["task"]["task_id"]
    task_detail = self.client.get(f"/admin/modules/import-tasks/{task_id}").json()["data"]
    self.assertEqual(task_detail["status"], "failed")
    self.assertEqual(task_detail["error_type"], "structured_result_unrecognized")
    self.assertEqual(task_detail["error_label"], "结构化结果不可识别")
    self.assertIn("重新上传", task_detail["next_action"])


if __name__ == "__main__":
  unittest.main()
