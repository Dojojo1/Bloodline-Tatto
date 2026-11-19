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
from scripts.prepare_first_login import prepare


ORIGIN = "http://127.0.0.1:8082"


def test_private_pointage_and_server_timestamps():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        app = create_app(path, public_origin=ORIGIN)
        create_member(path, "owner", "Propriétaire", "secret-long-1234", "superadmin")
        create_member(path, "friend", "Co-propriétaire", "secret-long-5678", "superadmin")

        with TestClient(app, base_url=ORIGIN) as owner, TestClient(app, base_url=ORIGIN) as friend:
            assert owner.get("/api/me").status_code == 401
            assert owner.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": "https://evil.example"}).status_code == 403
            login = owner.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN})
            assert login.status_code == 200 and "set-cookie" not in login.headers
            assert owner.get("/api/me").status_code == 401
            owner.headers["Authorization"] = f"Bearer {login.json()['token']}"
            assert owner.post("/api/shifts/start", headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/shifts/start", headers={"Origin": ORIGIN}).status_code == 409
            owner_data = owner.get("/api/me").json()
            assert len(owner_data["sessions"]) == 1
            assert owner_data["sessions"][0]["ended_at"] is None
            friend_login = friend.post("/api/login", json={"username": "friend", "password": "secret-long-5678"}, headers={"Origin": ORIGIN})
            assert friend_login.status_code == 200
            friend.headers["Authorization"] = f"Bearer {friend_login.json()['token']}"
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
        app = create_app(path, public_origin=ORIGIN)
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
        app = create_app(path, public_origin=ORIGIN)
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN}).status_code == 200


def test_initial_admins_create_password_on_first_login():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        credentials = Path(folder) / "private" / "initial-admins.txt"
        bootstrap(path, credentials, ("Erwan", "Lucia"))
        if os.name != "nt":
            assert credentials.stat().st_mode & 0o777 == 0o600
        codes = dict(line.strip().split(": ", 1) for line in credentials.read_text(encoding="utf-8").splitlines())
        app = create_app(path, public_origin=ORIGIN)
        with TestClient(app, base_url=ORIGIN) as client:
            first = client.post("/api/login", json={"username": "Erwan", "password": codes["Erwan"]}, headers={"Origin": ORIGIN})
            assert first.status_code == 200 and first.json()["setup_required"]
            assert client.get("/api/me").status_code == 401
            assert client.post("/api/activate", json={"username": "Erwan", "code": "wrong", "new_password": "another-long-secret"}, headers={"Origin": ORIGIN}).status_code == 401
            assert client.post("/api/activate", json={"username": "Erwan", "code": codes["Erwan"], "new_password": "another-long-secret"}, headers={"Origin": "https://evil.example"}).status_code == 403
            activation = client.post("/api/activate", json={"username": "Erwan", "code": codes["Erwan"], "new_password": "another-long-secret"}, headers={"Origin": ORIGIN})
            assert activation.status_code == 200
            client.headers["Authorization"] = f"Bearer {activation.json()['token']}"
            assert client.get("/api/me").status_code == 200
            assert client.post("/api/activate", json={"username": "Erwan", "code": codes["Erwan"], "new_password": "different-long-secret"}, headers={"Origin": ORIGIN}).status_code == 401
            assert client.post("/api/password", json={"current_password": "incorrect", "new_password": "another-long-secret"}, headers={"Origin": ORIGIN}).status_code == 400
            assert client.post("/api/password", json={"current_password": "another-long-secret", "new_password": "different-long-secret"}, headers={"Origin": ORIGIN}).status_code == 200
            assert client.get("/api/me").status_code == 401
            assert client.post("/api/login", json={"username": "erwan", "password": codes["Erwan"]}, headers={"Origin": ORIGIN}).status_code == 401
            assert client.post("/api/login", json={"username": "erwan", "password": "different-long-secret"}, headers={"Origin": ORIGIN}).status_code == 200
            assert client.post("/api/login", json={"username": "lucia", "password": codes["Lucia"]}, headers={"Origin": ORIGIN}).json()["setup_required"]


def test_existing_admins_convert_initial_passwords_to_activation_codes():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        old = Path(folder) / "initial-admins.txt"
        new = Path(folder) / "activation-codes.txt"
        bootstrap(path, old, ("Erwan", "Lucia"))
        codes = dict(line.strip().split(": ", 1) for line in old.read_text(encoding="utf-8").splitlines())
        with closing(sqlite3.connect(path)) as db:
            db.execute("update members set activation_required = 0")
            db.commit()
        prepare(path, old, new)
        assert not old.exists() and new.exists()
        app = create_app(path, public_origin=ORIGIN)
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.post("/api/login", json={"username": "Erwan", "password": codes["Erwan"]}, headers={"Origin": ORIGIN}).json()["setup_required"]


def test_cors_allows_only_the_management_origin():
    with TemporaryDirectory() as folder:
        app = create_app(Path(folder) / "bloodline.sqlite3", public_origin=ORIGIN)
        with TestClient(app, base_url="https://api.example.test") as client:
            headers = {"Origin": ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type,ngrok-skip-browser-warning"}
            response = client.options("/api/shifts/start", headers=headers)
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == ORIGIN
            assert client.options("/api/shifts/start", headers={**headers, "Origin": "https://evil.example"}).status_code == 400


def project_payload(phone="01 23 45"):
    return {
        "name": "Client Exemple", "phone": phone,
        "project_type": "Projet personnel", "creation_type": "À décider avec le tatoueur",
        "idea": "Rose", "placement": "Bras", "availability": "Vendredi soir",
        "acknowledged": True,
    }


def test_public_request_becomes_private_appointment_sheet():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        app = create_app(path, public_origin=ORIGIN, public_requests_enabled=True)
        create_member(path, "owner", "Direction", "secret-long-1234", "superadmin")
        create_member(path, "artist", "Artiste", "secret-long-5678", "staff")
        with TestClient(app, base_url=ORIGIN) as public, TestClient(app, base_url=ORIGIN) as owner, TestClient(app, base_url=ORIGIN) as artist:
            assert public.get("/api/requests").status_code == 401
            assert public.post("/api/requests", json=project_payload(), headers={"Origin": "https://evil.example"}).status_code == 403
            assert public.post("/api/requests", json={**project_payload(), "acknowledged": False}, headers={"Origin": ORIGIN}).status_code == 422
            assert public.post("/api/requests", json={**project_payload(), "website": "spam.example"}, headers={"Origin": ORIGIN}).status_code == 201
            assert public.get("/api/requests").status_code == 401
            submitted = public.post("/api/requests", json=project_payload(), headers={"Origin": ORIGIN})
            assert submitted.status_code == 201 and submitted.json()["reference"].startswith("BL-")
            owner_login = owner.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN})
            owner.headers["Authorization"] = f"Bearer {owner_login.json()['token']}"
            rows = owner.get("/api/requests").json()["items"]
            assert len(rows) == 1 and rows[0]["phone"] == "01 23 45"
            request_id = rows[0]["id"]
            assert owner.get("/api/dashboard").json()["new"] == 1
            assert owner.post(f"/api/requests/{request_id}/status", json={"status": "to_contact"}, headers={"Origin": ORIGIN}).status_code == 200
            note = owner.post(f"/api/requests/{request_id}/notes", json={"body": "À rappeler."}, headers={"Origin": ORIGIN})
            assert note.status_code == 200 and note.json()["notes"][0]["author"] == "Direction"
            appointment = owner.post(f"/api/requests/{request_id}/appointment", json={"local_when": "2026-12-18T14:30", "artist_name": "Lucia"}, headers={"Origin": ORIGIN})
            assert appointment.status_code == 200 and appointment.json()["status"] == "scheduled"
            assert len(owner.get("/api/appointments").json()["items"]) == 1
            assert owner.get("/api/dashboard").json()["scheduled"] == 1
            assert owner.post(f"/api/requests/{request_id}/status", json={"status": "cancelled"}, headers={"Origin": ORIGIN}).status_code == 200
            assert owner.get("/api/appointments").json()["items"] == []
            artist_login = artist.post("/api/login", json={"username": "artist", "password": "secret-long-5678"}, headers={"Origin": ORIGIN})
            artist.headers["Authorization"] = f"Bearer {artist_login.json()['token']}"
            assert artist.get("/api/dashboard").status_code == 403
            assert artist.get("/api/me").status_code == 200


def test_public_request_is_limited_per_number():
    with TemporaryDirectory() as folder:
        app = create_app(Path(folder) / "bloodline.sqlite3", public_origin=ORIGIN, public_requests_enabled=True)
        with TestClient(app, base_url=ORIGIN) as public:
            for _ in range(3):
                assert public.post("/api/requests", json=project_payload(), headers={"Origin": ORIGIN}).status_code == 201
            assert public.post("/api/requests", json=project_payload(), headers={"Origin": ORIGIN}).status_code == 429


def test_public_submission_stays_closed_until_contact_information_is_ready():
    with TemporaryDirectory() as folder:
        app = create_app(Path(folder) / "bloodline.sqlite3", public_origin=ORIGIN, public_requests_enabled=False)
        with TestClient(app, base_url=ORIGIN) as public:
            assert public.post("/api/requests", json=project_payload(), headers={"Origin": ORIGIN}).status_code == 503


def test_roles_invitations_and_account_protection():
    with TemporaryDirectory() as folder:
        path = Path(folder) / "bloodline.sqlite3"
        app = create_app(path, public_origin=ORIGIN)
        create_member(path, "owner", "Erwan", "secret-long-1234", "superadmin")
        create_member(path, "friend", "Lucia", "secret-long-5678", "superadmin")
        with TestClient(app, base_url=ORIGIN) as owner, TestClient(app, base_url=ORIGIN) as artist:
            login = owner.post("/api/login", json={"username": "owner", "password": "secret-long-1234"}, headers={"Origin": ORIGIN})
            owner.headers["Authorization"] = f"Bearer {login.json()['token']}"
            access = owner.get("/api/access").json()
            assert len(access["members"]) == 2
            assert {member["role_slug"] for member in access["members"]} == {"superadmin"}
            assert owner.post("/api/roles", json={"slug": "superadmin", "name": "Administration", "projects": False},
                              headers={"Origin": ORIGIN}).status_code == 200
            assert owner.get("/api/me").json()["member"]["projects"] == 1
            assert owner.post("/api/roles/superadmin/delete", headers={"Origin": ORIGIN}).status_code == 422
            created = owner.post("/api/roles", json={"name": "Responsable accueil", "projects": True},
                                 headers={"Origin": ORIGIN})
            assert created.status_code == 200
            slug = next(role["slug"] for role in created.json()["roles"] if role["name"] == "Responsable accueil")
            assert owner.post("/api/members/invite", json={"username": "camille", "display_name": "Camille", "role_slug": slug},
                              headers={"Origin": "https://evil.example"}).status_code == 403
            invited = owner.post("/api/members/invite", json={"username": "camille", "display_name": "Camille", "role_slug": slug},
                                 headers={"Origin": ORIGIN})
            assert invited.status_code == 200 and "code" in invited.json()
            code = invited.json()["code"]
            assert code not in str(owner.get("/api/access").json())
            camille = next(member for member in invited.json()["members"] if member["username"] == "camille")
            assert owner.post(f"/api/roles/{slug}/delete", headers={"Origin": ORIGIN}).status_code == 422
            assert owner.post(f"/api/members/{camille['id']}", json={"role_slug": "superadmin", "active": True},
                              headers={"Origin": ORIGIN}).status_code == 422
            assert artist.post("/api/login", json={"username": "camille", "password": code},
                               headers={"Origin": ORIGIN}).json()["setup_required"]
            activated = artist.post("/api/activate", json={"username": "camille", "code": code,
                "new_password": "camille-new-secret"}, headers={"Origin": ORIGIN})
            assert activated.status_code == 200
            artist.headers["Authorization"] = f"Bearer {activated.json()['token']}"
            assert artist.get("/api/dashboard").status_code == 200
            assert artist.get("/api/access").status_code == 403
            assert artist.post("/api/roles", json={"name": "Frauduleux"}, headers={"Origin": ORIGIN}).status_code == 403
            renewed = owner.post(f"/api/members/{camille['id']}/reset", headers={"Origin": ORIGIN})
            assert renewed.status_code == 200 and renewed.json()["code"] != code
            assert artist.get("/api/me").status_code == 401
            assert artist.post("/api/login", json={"username": "camille", "password": "camille-new-secret"},
                               headers={"Origin": ORIGIN}).status_code == 401
            assert owner.post(f"/api/members/{camille['id']}", json={"role_slug": "artiste", "active": False},
                              headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post(f"/api/roles/{slug}/delete", headers={"Origin": ORIGIN}).status_code == 200
            assert owner.post("/api/members/1", json={"role_slug": "artiste", "active": False},
                              headers={"Origin": ORIGIN}).status_code == 422
