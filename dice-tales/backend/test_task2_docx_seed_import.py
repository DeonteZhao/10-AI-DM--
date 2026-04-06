from tempfile import TemporaryDirectory
import os
import unittest

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
    self.assertEqual(admin_detail["structured"]["source_type"], seed.SOURCE_TYPE)
    self.assertEqual(admin_detail["draft"]["source_type"], seed.SOURCE_TYPE)
    self.assertEqual(admin_detail["import_tasks"], [])
    self.assertGreaterEqual(len(admin_detail["versions"]), 1)

    validate_detail = self.client.post(f"/admin/modules/{seed.MODULE_ID}/validate").json()["data"]
    self.assertTrue(validate_detail["valid"])
    self.assertEqual(validate_detail["errors"], [])


if __name__ == "__main__":
  unittest.main()
