from tempfile import TemporaryDirectory
import os
import sqlite3
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import backend.main as main


class Task1EmailOtpBetaGateTest(unittest.TestCase):
  def setUp(self):
    self.temp_dir = TemporaryDirectory()
    self.original_storage_dir = main.storage_dir
    main.storage_dir = self.temp_dir.name
    os.environ["ADMIN_API_TOKEN"] = ""
    os.environ["BETA_ACCESS_EMAIL_LIMIT"] = "100"
    os.environ["BETA_ACCESS_OTP_TTL_SECONDS"] = "600"
    os.environ["BETA_ACCESS_OTP_RESEND_COOLDOWN_SECONDS"] = "60"
    os.environ["BETA_ACCESS_OTP_SEND_WINDOW_SECONDS"] = "3600"
    os.environ["BETA_ACCESS_OTP_SEND_LIMIT_PER_WINDOW"] = "5"
    os.environ["BETA_ACCESS_TOKEN_TTL_DAYS"] = "30"
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
    main.characters.clear()

  def _db_row(self, query: str, params: tuple = ()):
    with sqlite3.connect(main.db_path()) as conn:
      return conn.execute(query, params).fetchone()

  def _db_value(self, query: str, params: tuple = ()):
    row = self._db_row(query, params)
    return row[0] if row else None

  def _save_verified_email(self, email: str):
    record = main.ensure_beta_access_email_record(email)
    timestamp = main.now_iso()
    record["is_verified"] = True
    record["first_verified_at"] = record["first_verified_at"] or timestamp
    record["last_verified_at"] = timestamp
    record["last_login_at"] = timestamp
    record["updated_at"] = timestamp
    main.save_beta_access_email_record(record)

  def test_send_code_creates_otp_record_for_new_email(self):
    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      response = self.client.post("/beta-access/send-code", json={"email": "Player@Example.com"})

    self.assertEqual(response.status_code, 200)
    payload = response.json()
    self.assertEqual(payload["status"], "otp_sent")
    self.assertEqual(payload["email"], "player@example.com")
    self.assertFalse(payload["historical_user"])
    self.assertEqual(len(deliveries), 1)
    self.assertRegex(deliveries[0]["code"], r"^\d{6}$")

    otp_row = self._db_row(
      "select email, code_hash, status from beta_access_otps order by requested_at desc limit 1"
    )
    self.assertEqual(otp_row[0], "player@example.com")
    self.assertEqual(otp_row[1], main.hash_secret(deliveries[0]["code"]))
    self.assertEqual(otp_row[2], "sent")

    email_row = self._db_row(
      "select is_verified, last_otp_requested_at, last_otp_sent_at from beta_access_emails where email = ?",
      ("player@example.com",)
    )
    self.assertEqual(email_row[0], 0)
    self.assertIsNotNone(email_row[1])
    self.assertIsNotNone(email_row[2])

  def test_verify_code_marks_email_verified_and_issues_token(self):
    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      self.client.post("/beta-access/send-code", json={"email": "verify@example.com"})

    wrong_response = self.client.post(
      "/beta-access/verify-code",
      json={"email": "verify@example.com", "code": "000000"}
    )
    self.assertEqual(wrong_response.status_code, 400)
    self.assertEqual(wrong_response.json()["detail"], "验证码错误")

    response = self.client.post(
      "/beta-access/verify-code",
      json={"email": "verify@example.com", "code": deliveries[0]["code"]}
    )

    self.assertEqual(response.status_code, 200)
    payload = response.json()
    self.assertTrue(payload["verified"])
    self.assertEqual(payload["email"], "verify@example.com")
    self.assertTrue(payload["credential"]["token"].startswith("beta_"))
    self.assertTrue(payload["credential"]["expires_at"])

    email_row = self._db_row(
      "select is_verified, first_verified_at, last_verified_at, last_login_at from beta_access_emails where email = ?",
      ("verify@example.com",)
    )
    self.assertEqual(email_row[0], 1)
    self.assertIsNotNone(email_row[1])
    self.assertIsNotNone(email_row[2])
    self.assertIsNotNone(email_row[3])

    otp_status = self._db_value(
      "select status from beta_access_otps where email = ? order by requested_at desc limit 1",
      ("verify@example.com",)
    )
    self.assertEqual(otp_status, "verified")

    token_row = self._db_row(
      "select email, status, token_hash from beta_access_tokens where email = ? order by created_at desc limit 1",
      ("verify@example.com",)
    )
    self.assertEqual(token_row[0], "verify@example.com")
    self.assertEqual(token_row[1], "active")
    self.assertEqual(token_row[2], main.hash_secret(payload["credential"]["token"]))

  def test_capacity_full_blocks_new_email_but_allows_historical_email(self):
    for index in range(99):
      self._save_verified_email(f"seed{index}@example.com")
    self._save_verified_email("returning@example.com")
    self.assertEqual(main.count_verified_beta_access_emails(), 100)

    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      blocked_response = self.client.post("/beta-access/send-code", json={"email": "newcomer@example.com"})
      allowed_response = self.client.post("/beta-access/send-code", json={"email": "returning@example.com"})

    self.assertEqual(blocked_response.status_code, 200)
    self.assertEqual(blocked_response.json()["status"], "waitlist_required")
    self.assertTrue(blocked_response.json()["waitlist_open"])

    self.assertEqual(allowed_response.status_code, 200)
    self.assertEqual(allowed_response.json()["status"], "otp_sent")
    self.assertTrue(allowed_response.json()["historical_user"])
    self.assertEqual(len(deliveries), 1)
    self.assertEqual(deliveries[0]["email"], "returning@example.com")

  def test_waitlist_upsert_keeps_single_active_record(self):
    first_response = self.client.post(
      "/beta-access/waitlist",
      json={"email": "waitlist@example.com", "source_status": "beta_capacity_full"}
    )
    second_response = self.client.post(
      "/beta-access/waitlist",
      json={"email": "waitlist@example.com", "source_status": "capacity_retry"}
    )

    self.assertEqual(first_response.status_code, 200)
    self.assertTrue(first_response.json()["created"])
    self.assertEqual(second_response.status_code, 200)
    self.assertFalse(second_response.json()["created"])

    row = self._db_row(
      "select count(*), status, source_status from beta_waitlist where email = ?",
      ("waitlist@example.com",)
    )
    self.assertEqual(row[0], 1)
    self.assertEqual(row[1], "active")
    self.assertEqual(row[2], "capacity_retry")

  def test_expired_code_is_rejected(self):
    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      self.client.post("/beta-access/send-code", json={"email": "expired@example.com"})

    with sqlite3.connect(main.db_path()) as conn:
      conn.execute(
        "update beta_access_otps set expires_at = ? where email = ?",
        ("2000-01-01T00:00:00", "expired@example.com")
      )
      conn.commit()

    response = self.client.post(
      "/beta-access/verify-code",
      json={"email": "expired@example.com", "code": deliveries[0]["code"]}
    )

    self.assertEqual(response.status_code, 400)
    self.assertEqual(response.json()["detail"], "验证码已过期")
    otp_status = self._db_value(
      "select status from beta_access_otps where email = ? order by requested_at desc limit 1",
      ("expired@example.com",)
    )
    self.assertEqual(otp_status, "expired")

  def test_send_code_returns_resend_cooldown_when_requested_too_fast(self):
    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      first_response = self.client.post("/beta-access/send-code", json={"email": "cooldown@example.com"})
      second_response = self.client.post("/beta-access/send-code", json={"email": "cooldown@example.com"})

    self.assertEqual(first_response.status_code, 200)
    self.assertEqual(second_response.status_code, 429)
    payload = second_response.json()
    self.assertEqual(payload["status"], "rate_limited")
    self.assertTrue(payload["active_code_available"])
    self.assertGreaterEqual(payload["resend_available_in_seconds"], 1)
    self.assertEqual(payload["expires_in_seconds"], 600)
    self.assertEqual(second_response.headers["retry-after"], str(payload["resend_available_in_seconds"]))
    self.assertEqual(len(deliveries), 1)

  def test_send_code_blocks_when_hourly_limit_reached(self):
    os.environ["BETA_ACCESS_OTP_SEND_WINDOW_SECONDS"] = "3600"
    os.environ["BETA_ACCESS_OTP_SEND_LIMIT_PER_WINDOW"] = "2"
    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      first_response = self.client.post("/beta-access/send-code", json={"email": "limit@example.com"})
      with sqlite3.connect(main.db_path()) as conn:
        conn.execute(
          "update beta_access_emails set last_otp_sent_at = ? where email = ?",
          ((main.datetime.now(main.timezone.utc) - main.timedelta(minutes=30)).isoformat(), "limit@example.com")
        )
        conn.execute(
          "update beta_access_otps set sent_at = ? where email = ?",
          ((main.datetime.now(main.timezone.utc) - main.timedelta(minutes=30)).isoformat(), "limit@example.com")
        )
        conn.commit()
      second_response = self.client.post("/beta-access/send-code", json={"email": "limit@example.com"})
      with sqlite3.connect(main.db_path()) as conn:
        conn.execute(
          "update beta_access_emails set last_otp_sent_at = ? where email = ?",
          ((main.datetime.now(main.timezone.utc) - main.timedelta(minutes=10)).isoformat(), "limit@example.com")
        )
        conn.commit()
      third_response = self.client.post("/beta-access/send-code", json={"email": "limit@example.com"})

    self.assertEqual(first_response.status_code, 200)
    self.assertEqual(second_response.status_code, 200)
    self.assertEqual(third_response.status_code, 429)
    payload = third_response.json()
    self.assertEqual(payload["status"], "rate_limited")
    self.assertIn("发送过于频繁", payload["detail"])
    self.assertGreaterEqual(payload["resend_available_in_seconds"], 1)
    self.assertEqual(len(deliveries), 2)

  def test_admin_beta_access_endpoint_lists_verified_and_waitlist(self):
    self._save_verified_email("verified@example.com")
    self.client.post("/beta-access/waitlist", json={"email": "waiting@example.com", "source_status": "beta_capacity_full"})

    response = self.client.get("/admin/beta-access")

    self.assertEqual(response.status_code, 200)
    payload = response.json()["data"]
    self.assertEqual(payload["summary"]["verified_total"], 1)
    self.assertEqual(payload["summary"]["waitlist_total"], 1)
    self.assertEqual(payload["summary"]["verified_limit"], 100)
    self.assertEqual(payload["verified_emails"][0]["email"], "verified@example.com")
    self.assertEqual(payload["waitlist"][0]["email"], "waiting@example.com")

  def test_session_endpoint_accepts_active_token(self):
    deliveries: list[dict] = []

    def fake_deliver(email: str, code: str, expires_in_seconds: int):
      deliveries.append({
        "email": email,
        "code": code,
        "expires_in_seconds": expires_in_seconds
      })

    with patch.object(main, "deliver_email_otp", new=fake_deliver):
      self.client.post("/beta-access/send-code", json={"email": "session@example.com"})

    verify_response = self.client.post(
      "/beta-access/verify-code",
      json={"email": "session@example.com", "code": deliveries[0]["code"]}
    )
    token = verify_response.json()["credential"]["token"]

    response = self.client.get(
      "/beta-access/session",
      headers={"Authorization": f"Bearer {token}"}
    )

    self.assertEqual(response.status_code, 200)
    payload = response.json()
    self.assertTrue(payload["authenticated"])
    self.assertEqual(payload["email"], "session@example.com")
    self.assertTrue(payload["expires_at"])
    last_used_at = self._db_value(
      "select last_used_at from beta_access_tokens where email = ? order by created_at desc limit 1",
      ("session@example.com",)
    )
    self.assertIsNotNone(last_used_at)

  def test_session_endpoint_rejects_unknown_token(self):
    response = self.client.get(
      "/beta-access/session",
      headers={"Authorization": "Bearer beta_missing"}
    )

    self.assertEqual(response.status_code, 401)
    self.assertEqual(response.json()["detail"], "未通过内测准入验证")


if __name__ == "__main__":
  unittest.main()
