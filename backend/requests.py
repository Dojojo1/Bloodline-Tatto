"""Project requests, appointment sheets, and staff-only follow-up history."""
import re
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from backend.storage import connect, utc_now


STATUSES = {"new", "to_contact", "in_discussion", "scheduled", "done", "cancelled"}
SALON_TIMEZONE = ZoneInfo("Europe/Brussels")


class TooManyRequests(Exception):
    pass


def init_database(path):
    with connect(path) as db:
        db.executescript("""
            create table if not exists project_requests (
                id integer primary key,
                reference text not null unique,
                client_name text not null,
                phone text not null,
                phone_key text not null,
                project_type text not null,
                creation_type text not null,
                group_size integer,
                idea text not null default '',
                placement text not null default '',
                availability text not null default '',
                status text not null default 'new'
                    check (status in ('new', 'to_contact', 'in_discussion', 'scheduled', 'done', 'cancelled')),
                source text not null default 'website',
                acknowledged_at text not null,
                created_at text not null,
                updated_at text not null
            );
            create index if not exists requests_created on project_requests(created_at desc);
            create index if not exists requests_phone_created on project_requests(phone_key, created_at desc);
            create table if not exists appointments (
                id integer primary key,
                request_id integer not null unique references project_requests(id),
                scheduled_at text not null,
                artist_name text not null default '',
                status text not null check (status in ('scheduled', 'cancelled')),
                updated_at text not null
            );
            create index if not exists appointments_schedule on appointments(status, scheduled_at);
            create table if not exists request_notes (
                id integer primary key,
                request_id integer not null references project_requests(id),
                member_id integer not null references members(id),
                body text not null,
                created_at text not null
            );
            create table if not exists request_events (
                id integer primary key,
                request_id integer not null references project_requests(id),
                member_id integer references members(id),
                detail text not null,
                created_at text not null
            );
        """)


def create_request(path, data):
    name = data.name.strip()
    phone = data.phone.strip()
    phone_key = "".join(char for char in phone if char.isdigit())
    if len(name) < 2 or len(phone_key) < 3 or not re.fullmatch(r"[+0-9() .-]+", phone):
        raise ValueError("Vérifiez votre nom et votre numéro.")
    if data.project_type == "Projet de groupe" and not data.group_size:
        raise ValueError("Indiquez le nombre de personnes pour ce projet de groupe.")
    if not data.acknowledged:
        raise ValueError("Confirmez que vous avez compris comment votre demande sera utilisée.")
    now = utc_now().isoformat()
    cutoff = (utc_now() - timedelta(days=1)).isoformat()
    reference = "BL-" + secrets.token_hex(6).upper()
    with connect(path) as db:
        db.execute("begin immediate")
        if db.execute("select count(*) from project_requests where created_at >= ?", (cutoff,)).fetchone()[0] >= 100:
            raise TooManyRequests()
        if db.execute("select count(*) from project_requests where phone_key = ? and created_at >= ?", (phone_key, cutoff)).fetchone()[0] >= 3:
            raise TooManyRequests()
        db.execute("""insert into project_requests
            (reference, client_name, phone, phone_key, project_type, creation_type, group_size,
             idea, placement, availability, acknowledged_at, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (reference, name, phone, phone_key, data.project_type.strip(), data.creation_type.strip(),
             data.group_size, data.idea.strip(), data.placement.strip(), data.availability.strip(),
             now, now, now))
    return reference


def list_requests(path, limit=100):
    with connect(path) as db:
        rows = db.execute("""select r.id, r.reference, r.client_name, r.phone, r.project_type,
            r.status, r.created_at, a.scheduled_at, a.artist_name, a.status as appointment_status
            from project_requests r left join appointments a on a.request_id = r.id
            order by r.created_at desc limit ?""", (limit,)).fetchall()
    return [dict(row) for row in rows]


def list_appointments(path, limit=100):
    with connect(path) as db:
        rows = db.execute("""select a.id, a.request_id, a.scheduled_at, a.artist_name,
            r.reference, r.client_name, r.phone, r.project_type, r.status
            from appointments a join project_requests r on r.id = a.request_id
            where a.status = 'scheduled' and r.status = 'scheduled'
            order by a.scheduled_at limit ?""", (limit,)).fetchall()
    return [dict(row) for row in rows]


def dashboard(path):
    with connect(path) as db:
        counts = {row["status"]: row["total"] for row in db.execute(
            "select status, count(*) as total from project_requests group by status")}
    return {
        "new": counts.get("new", 0),
        "to_contact": counts.get("to_contact", 0),
        "scheduled": counts.get("scheduled", 0),
        "in_discussion": counts.get("in_discussion", 0),
        "recent": list_requests(path, 5),
        "appointments": list_appointments(path, 5),
    }


def get_request(path, request_id):
    with connect(path) as db:
        request = db.execute("select * from project_requests where id = ?", (request_id,)).fetchone()
        if not request:
            return None
        appointment = db.execute("select * from appointments where request_id = ?", (request_id,)).fetchone()
        notes = db.execute("""select n.id, n.body, n.created_at, m.display_name as author
            from request_notes n join members m on m.id = n.member_id
            where n.request_id = ? order by n.created_at desc""", (request_id,)).fetchall()
        events = db.execute("""select e.detail, e.created_at, coalesce(m.display_name, 'Site vitrine') as author
            from request_events e left join members m on m.id = e.member_id
            where e.request_id = ? order by e.created_at desc limit 30""", (request_id,)).fetchall()
    return {
        **dict(request),
        "appointment": dict(appointment) if appointment else None,
        "notes": [dict(row) for row in notes],
        "events": [dict(row) for row in events],
    }


def update_status(path, request_id, member_id, new_status):
    if new_status not in STATUSES or new_status == "scheduled":
        raise ValueError("Statut invalide. Confirmez un rendez-vous pour choisir « Confirmé ».")
    now = utc_now().isoformat()
    with connect(path) as db:
        row = db.execute("select status from project_requests where id = ?", (request_id,)).fetchone()
        if not row:
            return False
        if row["status"] == new_status:
            return True
        db.execute("update project_requests set status = ?, updated_at = ? where id = ?", (new_status, now, request_id))
        if new_status != "done":
            db.execute("update appointments set status = 'cancelled', updated_at = ? where request_id = ? and status = 'scheduled'", (now, request_id))
        db.execute("insert into request_events(request_id, member_id, detail, created_at) values (?, ?, ?, ?)",
                   (request_id, member_id, f"Statut : {row['status']} → {new_status}", now))
    return True


def save_appointment(path, request_id, member_id, local_when, artist_name):
    try:
        local = datetime.strptime(local_when, "%Y-%m-%dT%H:%M").replace(tzinfo=SALON_TIMEZONE)
    except ValueError as exc:
        raise ValueError("Indiquez une date et une heure valides.") from exc
    scheduled_at = local.astimezone(timezone.utc).isoformat()
    artist_name = artist_name.strip()
    if len(artist_name) > 80:
        raise ValueError("Le nom de l'artiste est trop long.")
    now = utc_now().isoformat()
    with connect(path) as db:
        row = db.execute("select id from project_requests where id = ?", (request_id,)).fetchone()
        if not row:
            return False
        db.execute("""insert into appointments(request_id, scheduled_at, artist_name, status, updated_at)
            values (?, ?, ?, 'scheduled', ?) on conflict(request_id) do update set
            scheduled_at = excluded.scheduled_at, artist_name = excluded.artist_name,
            status = 'scheduled', updated_at = excluded.updated_at""",
            (request_id, scheduled_at, artist_name, now))
        db.execute("update project_requests set status = 'scheduled', updated_at = ? where id = ?", (now, request_id))
        db.execute("insert into request_events(request_id, member_id, detail, created_at) values (?, ?, ?, ?)",
                   (request_id, member_id, f"Rendez-vous fixé au {local_when} (heure du salon)" +
                    (f" avec {artist_name}" if artist_name else ""), now))
    return True


def add_note(path, request_id, member_id, body):
    body = body.strip()
    if not body or len(body) > 1500:
        raise ValueError("La note doit contenir entre 1 et 1 500 caractères.")
    now = utc_now().isoformat()
    with connect(path) as db:
        if not db.execute("select id from project_requests where id = ?", (request_id,)).fetchone():
            return False
        db.execute("insert into request_notes(request_id, member_id, body, created_at) values (?, ?, ?, ?)",
                   (request_id, member_id, body, now))
    return True
