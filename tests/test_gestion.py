"""Focused auth and pointage checks for the independent Linux backend."""
from tempfile import TemporaryDirectory
from pathlib import Path
import sqlite3
import os
from contextlib import closing

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.storage import create_member
from backend.storage import init_database
from scripts.backup_gestion import main as backup_database
from scripts.bootstrap_admins import bootstrap


ORIGIN = "http://127.0.0.1:8082"


def test_private_pointage_and_server_timestamps():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        app = create_app(path, public_origin=ORIGIN, secure_cookie=False)
        create_member(path, "owner", "Propriétaire", "secret-long-1234", "superadmin")
        create_member(path, "friend", "Co-propriétaire", "secret-long-5678", "superadmin")

        with TestClient(app, base_url=ORIGIN) as owner, TestClient(app, base_url=ORIGIN) as friend:
            assert owner.get("/api/me").status_code == 401
            assert owner.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": "https://evil.example"}).status_code == 403
            assert owner.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/shifts/start", headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/shifts/start", headers={"Origin": ORIGIN}).status_code == 409
            owner_data = owner.get("/api/me").json()
            assert len(owner_data["sessions"]) == 1
            assert owner_data["sessions"][0]["ended_at"] is None
            assert friend.post("/api/login", json={"username": "friend", "password": "secret-long-5678"}, headers={"Origin": ORIGIN}).status_code == 200
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
        create_member(path, "owner", "Propriétaire", "secret-long-1234", "superadmin")
        with TestClient(app, base_url=ORIGIN) as client:
            for _ in range(5):
                assert client.post("/api/login", json={"username": "owner", "password": "wrong"}, headers={"Origin": ORIGIN}).status_code == 401
            assert client.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN}).status_code == 429


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


def test_existing_database_migrates_account_identifier():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        with closing(sqlite3.connect(path)) as legacy:
            legacy.execute("create table members(id integer primary key, email text not null unique, display_name text not null, password_hash text not null, role text not null, active integer not null default 1, created_at text not null)")
            legacy.execute("create table login_attempts(email text not null, remote_address text not null, failures integer not null, first_at text not null, primary key(email, remote_address))")
            legacy.commit()
        init_database(path)
        create_member(path, "owner", "Propriétaire", "secret-long-1234", "superadmin")
        app = create_app(path, public_origin=ORIGIN, secure_cookie=False)
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN}).status_code == 200


def test_initial_admins_and_password_change():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        credentials = Path(folder) / "private" / "initial-admins.txt"
        bootstrap(path, credentials, ("Erwan", "Lucia"))
        if os.name != "nt":
            assert credentials.stat().st_mode & 0o777 == 0o600
        passwords = dict(line.strip().split(": ", 1) for line in credentials.read_text(encoding="utf-8").splitlines())
        app = create_app(path, public_origin=ORIGIN, secure_cookie=False)
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.post("/api/login", json={"username": "Erwan", "password": passwords["Erwan"]}, headers={"Origin": ORIGIN}).status_code == 200
            assert client.post("/api/password", json={"current_password": "incorrect", "new_password": "another-long-secret"}, headers={"Origin": ORIGIN}).status_code == 400
            assert client.post("/api/password", json={"current_password": passwords["Erwan"], "new_password": "another-long-secret"}, headers={"Origin": ORIGIN}).status_code == 200
            assert client.get("/api/me").status_code == 401
            assert client.post("/api/login", json={"username": "erwan", "password": passwords["Erwan"]}, headers={"Origin": ORIGIN}).status_code == 401
            assert client.post("/api/login", json={"username": "lucia", "password": passwords["Lucia"]}, headers={"Origin": ORIGIN}).status_code == 200
