from tempfile import TemporaryDirectory
import os
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import backend.main as main
import backend.seed_coc_scenario as seed


class Task2DocxSeedImportTest(unittest.TestCase):
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

  def test_build_scenario_from_docx_uses_new_coc_fields(self):
    scenario = seed.build_scenario_from_docx()
    payload = scenario.model_dump()

    self.assertEqual(payload["module_id"], seed.MODULE_ID)
    self.assertEqual(payload["title"], "追书人")
    self.assertEqual(payload["rule_system"], "coc")
    self.assertIn(payload["source_type"], {seed.SOURCE_TYPE, seed.FALLBACK_SOURCE_TYPE})
    self.assertGreaterEqual(len(payload["locations"]), 6)
    self.assertGreaterEqual(len(payload["sequence"]), 8)
    self.assertGreaterEqual(len(payload["clues"]), 6)
    self.assertIn("raw_sections", payload["extensions"])
    self.assertNotIn("structured_output", payload)
    self.assertNotIn("parser_type", payload)
    self.assertNotIn("draft_version", payload)

  def test_write_seed_scenario_to_system_bypasses_import_task_flow(self):
    result = seed.write_seed_scenario_to_system()

    self.assertEqual(result["module_id"], seed.MODULE_ID)
    self.assertEqual(result["validation_errors"], [])

    public_modules = self.client.get("/modules").json()["modules"]
    self.assertEqual(len(public_modules), 1)
    self.assertEqual(public_modules[0]["id"], seed.MODULE_ID)
    self.assertEqual(public_modules[0]["name"], "追书人")

    admin_detail = self.client.get(f"/admin/modules/{seed.MODULE_ID}").json()["data"]
    expected_source_type = main.get_published_scenario(seed.MODULE_ID).source_type
    self.assertIn(expected_source_type, {seed.SOURCE_TYPE, seed.FALLBACK_SOURCE_TYPE})
    self.assertEqual(admin_detail["structured"]["source_type"], expected_source_type)
    self.assertEqual(admin_detail["draft"]["source_type"], expected_source_type)
    self.assertEqual(admin_detail["import_tasks"], [])
    self.assertGreaterEqual(len(admin_detail["versions"]), 1)

    validate_detail = self.client.post(f"/admin/modules/{seed.MODULE_ID}/validate").json()["data"]
    self.assertTrue(validate_detail["valid"])
    self.assertEqual(validate_detail["errors"], [])

  def test_missing_docx_still_restores_public_module(self):
    missing_docx = os.path.join(self.temp_dir.name, "missing.docx")
    original_default_docx_path = seed.default_docx_path
    original_test_client = self.client
    fallback_storage_dir = os.path.join(self.temp_dir.name, "fallback_storage")

    try:
      original_test_client.close()
      os.makedirs(fallback_storage_dir, exist_ok=True)
      main.storage_dir = fallback_storage_dir
      main.draft_modules.clear()
      main.structured_modules.clear()
      main.characters.clear()
      main.sessions.clear()
      main.session_logs.clear()
      seed.default_docx_path = lambda: Path(missing_docx)

      scenario = seed.build_scenario_from_docx()
      payload = scenario.model_dump()
      self.assertEqual(payload["module_id"], seed.MODULE_ID)
      self.assertEqual(payload["source_type"], seed.FALLBACK_SOURCE_TYPE)
      self.assertTrue(payload["extensions"]["docx_seed"]["fallback_used"])
      self.assertIn("DOCX 读取失败", payload["extensions"]["docx_seed"]["fallback_reason"])

      result = seed.write_seed_scenario_to_system(docx_path=missing_docx, storage_dir=fallback_storage_dir)
      self.assertEqual(result["module_id"], seed.MODULE_ID)
      self.assertEqual(result["validation_errors"], [])

      stored_module = main.get_published_scenario(seed.MODULE_ID)
      self.assertIsNotNone(stored_module)
      self.assertEqual(stored_module.source_type, seed.FALLBACK_SOURCE_TYPE)
      self.assertGreaterEqual(len(stored_module.locations), 1)
      self.assertGreaterEqual(len(stored_module.sequence), 1)

      with TestClient(main.app) as fallback_client:
        self.client = fallback_client

        public_modules = fallback_client.get("/modules").json()["modules"]
        self.assertEqual(len(public_modules), 1)
        self.assertEqual(public_modules[0]["id"], seed.MODULE_ID)

        public_detail = fallback_client.get(f"/modules/{seed.MODULE_ID}")
        self.assertEqual(public_detail.status_code, 200)
        self.assertEqual(public_detail.json()["module"]["id"], seed.MODULE_ID)

        structured_detail = fallback_client.get(f"/modules/{seed.MODULE_ID}/structured")
        self.assertEqual(structured_detail.status_code, 200)
        structured_module = structured_detail.json()["module"]
        self.assertEqual(structured_module["module_id"], seed.MODULE_ID)
        self.assertEqual(structured_module["rule_system"], "coc")
    finally:
      self.client = original_test_client
      seed.default_docx_path = original_default_docx_path


if __name__ == "__main__":
  unittest.main()
