"""Focused auth and pointage checks for the independent Linux backend."""
from tempfile import TemporaryDirectory
from pathlib import Path
import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.storage import create_member
from backend.storage import init_database
from scripts.backup_gestion import main as backup_database


ORIGIN = "http://127.0.0.1:8082"


def test_private_pointage_and_server_timestamps():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        app = create_app(path, public_origin=ORIGIN, secure_cookie=False)
        create_member(path, "owner@example.test", "Propriétaire", "secret-long-1234", "superadmin")
        create_member(path, "friend@example.test", "Co-propriétaire", "secret-long-5678", "superadmin")

        with TestClient(app, base_url=ORIGIN) as owner, TestClient(app, base_url=ORIGIN) as friend:
            assert owner.get("/api/me").status_code == 401
            assert owner.post("/api/login", json={"email": "owner@example.test", "password": "secret-long-1234"}, headers={"Origin": "https://evil.example"}).status_code == 403
            assert owner.post("/api/login", json={"email": "owner@example.test", "password": "secret-long-1234"}, headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/shifts/start", headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/shifts/start", headers={"Origin": ORIGIN}).status_code == 409
            owner_data = owner.get("/api/me").json()
            assert len(owner_data["sessions"]) == 1
            assert owner_data["sessions"][0]["ended_at"] is None
            assert friend.post("/api/login", json={"email": "friend@example.test", "password": "secret-long-5678"}, headers={"Origin": ORIGIN}).status_code == 200
            assert friend.get("/api/me").json()["sessions"] == []
            assert owner.post("/api/shifts/end", headers={"Origin": "https://evil.example"}).status_code == 403
            assert owner.post("/api/shifts/end", headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/shifts/end", headers={"Origin": ORIGIN}).status_code == 409
            assert owner.get("/api/me").json()["sessions"][0]["ended_at"] is not None
            assert owner.post("/api/logout", headers={"Origin": ORIGIN}).status_code == 200
            assert owner.get("/api/me").status_code == 401


def test_login_is_throttled_after_failed_attempts():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        app = create_app(path, public_origin=ORIGIN, secure_cookie=False)
        create_member(path, "owner@example.test", "Propriétaire", "secret-long-1234", "superadmin")
        with TestClient(app, base_url=ORIGIN) as client:
            for _ in range(5):
                assert client.post("/api/login", json={"email": "owner@example.test", "password": "wrong"}, headers={"Origin": ORIGIN}).status_code == 401
            assert client.post("/api/login", json={"email": "owner@example.test", "password": "secret-long-1234"}, headers={"Origin": ORIGIN}).status_code == 429


def test_backup_is_readable(monkeypatch):
    with TemporaryDirectory() as folder:
        source = Path(folder) / "data.sqlite3"
        backup_dir = Path(folder) / "backups"
        init_database(source)
        monkeypatch.setenv("BLOODLINE_DB_PATH", str(source))
        monkeypatch.setenv("BLOODLINE_BACKUP_DIR", str(backup_dir))
        backup_database()
        with closing(sqlite3.connect(next(backup_dir.glob("*.sqlite3")))) as backup:
            assert backup.execute("pragma integrity_check").fetchone()[0] == "ok"
