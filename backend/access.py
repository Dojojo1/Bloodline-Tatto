"""Account invitations and editable management roles."""
import re
import secrets
import sqlite3

from backend.storage import connect, password_hash, utc_now


def _audit(db, actor_id, action, target):
    db.execute("insert into access_events(actor_id, action, target, created_at) values (?, ?, ?, ?)",
               (actor_id, action, target, utc_now().isoformat()))


def init_database(path):
    with connect(path) as db:
        db.execute("""create table if not exists access_events (
            id integer primary key,
            actor_id integer references members(id),
            action text not null,
            target text not null,
            created_at text not null
        )""")


def overview(path):
    with connect(path) as db:
        roles = [dict(row) for row in db.execute(
            "select slug, name, projects, access, content, finance, protected from roles order by protected desc, name"
        )]
        members = [dict(row) for row in db.execute("""select m.id, m.username, m.display_name,
            m.role_slug, r.name as role_name, m.active, m.activation_required, m.created_at
            from members m join roles r on r.slug = m.role_slug order by m.active desc, m.display_name""")]
        events = [dict(row) for row in db.execute("""select e.action, e.target, e.created_at,
            coalesce(m.display_name, 'Système') as author from access_events e
            left join members m on m.id = e.actor_id order by e.id desc limit 20""")]
    return {"roles": roles, "members": members, "events": events}


def save_role(path, actor_id, slug, name, permissions):
    name = name.strip()
    if not 2 <= len(name) <= 60:
        raise ValueError("Le nom du rôle doit contenir entre 2 et 60 caractères.")
    flags = {key: int(bool(permissions.get(key))) for key in ("projects", "access", "content", "finance")}
    with connect(path) as db:
        if slug:
            row = db.execute("select protected from roles where slug = ?", (slug,)).fetchone()
            if not row:
                raise LookupError("Rôle introuvable.")
            if row["protected"]:
                db.execute("update roles set name = ? where slug = ?", (name, slug))
            else:
                db.execute("""update roles set name = ?, projects = ?, access = ?, content = ?, finance = ?
                    where slug = ?""", (name, *flags.values(), slug))
            action = "Rôle modifié"
        else:
            slug = "r_" + secrets.token_hex(8)
            db.execute("""insert into roles(slug, name, projects, access, content, finance)
                values (?, ?, ?, ?, ?, ?)""", (slug, name, *flags.values()))
            action = "Rôle créé"
        _audit(db, actor_id, action, name)
    return slug


def delete_role(path, actor_id, slug):
    with connect(path) as db:
        role = db.execute("select name, protected from roles where slug = ?", (slug,)).fetchone()
        if not role:
            raise LookupError("Rôle introuvable.")
        if role["protected"]:
            raise ValueError("Le rôle des administrateurs suprêmes est protégé.")
        if db.execute("select 1 from members where role_slug = ? limit 1", (slug,)).fetchone():
            raise ValueError("Réattribuez les comptes de ce rôle avant de le supprimer.")
        db.execute("delete from roles where slug = ?", (slug,))
        _audit(db, actor_id, "Rôle supprimé", role["name"])


def invite_member(path, actor_id, username, display_name, role_slug):
    username = username.strip().lower()
    display_name = display_name.strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", username):
        raise ValueError("Nom de compte invalide : 3 à 32 lettres, chiffres, points ou tirets.")
    if not 2 <= len(display_name) <= 80:
        raise ValueError("Le nom affiché doit contenir entre 2 et 80 caractères.")
    code = secrets.token_urlsafe(24)
    with connect(path) as db:
        role = db.execute("select protected from roles where slug = ?", (role_slug,)).fetchone()
        if not role or role["protected"]:
            raise ValueError("Choisissez un rôle d'équipe.")
        try:
            db.execute("""insert into members(username, display_name, password_hash, activation_required,
                role, role_slug, created_at) values (?, ?, ?, 1, 'staff', ?, ?)""",
                (username, display_name, password_hash(code), role_slug, utc_now().isoformat()))
        except sqlite3.IntegrityError as exc:
            raise ValueError("Ce nom de compte est déjà utilisé.") from exc
        _audit(db, actor_id, "Compte invité", username)
    return code


def update_member(path, actor_id, member_id, role_slug, active):
    with connect(path) as db:
        member = db.execute("select username, role from members where id = ?", (member_id,)).fetchone()
        if not member:
            raise LookupError("Compte introuvable.")
        if member["role"] == "superadmin":
            raise ValueError("Les deux comptes administrateurs suprêmes sont protégés.")
        role = db.execute("select protected from roles where slug = ?", (role_slug,)).fetchone()
        if not role or role["protected"]:
            raise ValueError("Choisissez un rôle d'équipe.")
        db.execute("update members set role_slug = ?, active = ? where id = ?",
                   (role_slug, int(active), member_id))
        if not active:
            db.execute("delete from sessions where member_id = ?", (member_id,))
        _audit(db, actor_id, "Compte modifié", member["username"])


def reset_member(path, actor_id, member_id):
    code = secrets.token_urlsafe(24)
    with connect(path) as db:
        member = db.execute("select username, role, active from members where id = ?", (member_id,)).fetchone()
        if not member:
            raise LookupError("Compte introuvable.")
        if member["role"] == "superadmin" or not member["active"]:
            raise ValueError("Ce compte ne peut pas être réinitialisé ici.")
        db.execute("update members set password_hash = ?, activation_required = 1 where id = ?",
                   (password_hash(code), member_id))
        db.execute("delete from sessions where member_id = ?", (member_id,))
        _audit(db, actor_id, "Code de connexion renouvelé", member["username"])
    return code
