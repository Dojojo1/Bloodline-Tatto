"""Private SQLite store for the Bloodline management service."""
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path


def utc_now():
    return datetime.now(timezone.utc)


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("pragma foreign_keys = on")
    db.execute("pragma busy_timeout = 10000")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_database(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute("pragma journal_mode = wal")
        db.executescript("""
            create table if not exists members (
                id integer primary key,
                username text not null unique,
                display_name text not null,
                password_hash text not null,
                role text not null check (role in ('superadmin', 'staff')),
                active integer not null default 1,
                created_at text not null
            );
            create table if not exists sessions (
                token_hash text primary key,
                member_id integer not null references members(id) on delete cascade,
                expires_at text not null
            );
            create table if not exists login_attempts (
                username text not null,
                remote_address text not null,
                failures integer not null,
                first_at text not null,
                primary key (username, remote_address)
            );
            create table if not exists work_sessions (
                id integer primary key,
                member_id integer not null references members(id),
                started_at text not null,
                ended_at text,
                check (ended_at is null or ended_at >= started_at)
            );
            create unique index if not exists one_open_shift on work_sessions(member_id) where ended_at is null;
            create index if not exists work_sessions_member_start on work_sessions(member_id, started_at desc);
        """)
        # Preserve an existing database created before account names replaced e-mails.
        if "email" in {column["name"] for column in db.execute("pragma table_info(members)")}:
            db.execute("alter table members rename column email to username")
        if "email" in {column["name"] for column in db.execute("pragma table_info(login_attempts)")}:
            db.execute("alter table login_attempts rename column email to username")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def password_hash(password):
    if len(password) < 12:
        raise ValueError("Le mot de passe doit contenir au moins 12 caractères.")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return f"scrypt:16384:8:1:{salt.hex()}:{digest.hex()}"


def verify_password(password, stored):
    try:
        _, n, r, p, salt, expected = stored.split(":")
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(digest, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


def create_member(path, username, name, password, role="staff"):
    if role not in {"staff", "superadmin"}:
        raise ValueError("Rôle invalide")
    username = username.strip().lower()
    name = name.strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", username) or len(name) < 2:
        raise ValueError("Nom de compte ou nom affiché invalide")
    hashed = password_hash(password)
    with connect(path) as db:
        if role == "superadmin" and db.execute("select count(*) from members where role = 'superadmin'").fetchone()[0] >= 2:
            raise ValueError("Les deux comptes d'administration suprême existent déjà")
        db.execute("insert into members(username, display_name, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
                   (username, name, hashed, role, utc_now().isoformat()))


def authenticate(path, username, password):
    with connect(path) as db:
        member = db.execute("select * from members where username = ? and active = 1", (username.strip().lower(),)).fetchone()
    if not member or not verify_password(password, member["password_hash"]):
        return None
    return dict(member)


def change_password(path, member_id, current_password, new_password):
    if len(new_password) < 12 or len(new_password) > 256:
        raise ValueError("Le nouveau mot de passe doit contenir entre 12 et 256 caractères.")
    with connect(path) as db:
        member = db.execute("select password_hash from members where id = ? and active = 1", (member_id,)).fetchone()
        if not member or not verify_password(current_password, member["password_hash"]):
            raise ValueError("Mot de passe actuel incorrect.")
        db.execute("update members set password_hash = ? where id = ?", (password_hash(new_password), member_id))
        db.execute("delete from sessions where member_id = ?", (member_id,))


def login_blocked(path, username, remote_address):
    cutoff = (utc_now() - timedelta(minutes=15)).isoformat()
    with connect(path) as db:
        row = db.execute("select failures, first_at from login_attempts where username = ? and remote_address = ?",
                         (username, remote_address)).fetchone()
    return bool(row and row["first_at"] >= cutoff and row["failures"] >= 5)


def record_login_failure(path, username, remote_address):
    cutoff = (utc_now() - timedelta(minutes=15)).isoformat()
    with connect(path) as db:
        db.execute("""insert into login_attempts(username, remote_address, failures, first_at)
            values (?, ?, 1, ?) on conflict(username, remote_address) do update set
            failures = case when login_attempts.first_at < ? then 1 else login_attempts.failures + 1 end,
            first_at = case when login_attempts.first_at < ? then excluded.first_at else login_attempts.first_at end""",
            (username, remote_address, utc_now().isoformat(), cutoff, cutoff))


def clear_login_failures(path, username, remote_address):
    with connect(path) as db:
        db.execute("delete from login_attempts where username = ? and remote_address = ?", (username, remote_address))


def create_session(path, member_id):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires = (utc_now() + timedelta(days=7)).isoformat()
    with connect(path) as db:
        db.execute("insert into sessions(token_hash, member_id, expires_at) values (?, ?, ?)", (token_hash, member_id, expires))
    return token


def session_member(path, token):
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with connect(path) as db:
        member = db.execute("""select m.id, m.username, m.display_name, m.role from sessions s
            join members m on m.id = s.member_id
            where s.token_hash = ? and s.expires_at > ? and m.active = 1""",
            (token_hash, utc_now().isoformat())).fetchone()
    return dict(member) if member else None


def delete_session(path, token):
    if token:
        with connect(path) as db:
            db.execute("delete from sessions where token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))


def list_shifts(path, member_id):
    with connect(path) as db:
        rows = db.execute("select id, started_at, ended_at from work_sessions where member_id = ? order by started_at desc limit 20", (member_id,)).fetchall()
    return [dict(row) for row in rows]


def start_shift(path, member_id):
    with connect(path) as db:
        try:
            db.execute("insert into work_sessions(member_id, started_at) values (?, ?)", (member_id, utc_now().isoformat()))
        except sqlite3.IntegrityError as exc:
            raise ValueError("Un service est déjà en cours.") from exc


def end_shift(path, member_id):
    with connect(path) as db:
        result = db.execute("update work_sessions set ended_at = ? where member_id = ? and ended_at is null",
                            (utc_now().isoformat(), member_id))
        if result.rowcount != 1:
            raise ValueError("Aucun service en cours.")
