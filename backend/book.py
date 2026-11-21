"""Versioned sketchbook drafts, atomic publication, and private image originals.

Images live in SQLite with the catalogue, so existing database backups include
the entire book. Only images referenced by the published snapshot are public.
"""
import base64
import hashlib
import io
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.storage import connect, utc_now

ROOT = Path(__file__).resolve().parents[1]
BUILTIN = {"assets/biker-club-sketch.webp", "assets/tattoo-book-open.png", "assets/salon-book.png"}
IDENTIFIER = re.compile(r"^[a-zA-Z0-9_-]{1,80}$")


class Conflict(ValueError):
    pass


def init_database(path):
    initial = (ROOT / "book-default.json").read_text(encoding="utf-8")
    with connect(path) as db:
        db.execute("""create table if not exists sketchbook (
            id integer primary key check (id = 1), draft text not null,
            published text not null, revision integer not null default 1,
            published_revision integer not null default 1,
            updated_at text not null, published_at text not null)""")
        db.execute("""create table if not exists sketchbook_assets (
            id text primary key, body blob not null, media_type text not null,
            name text not null, created_at text not null)""")
        now = utc_now().isoformat()
        db.execute("insert or ignore into sketchbook(id,draft,published,updated_at,published_at) values (1,?,?,?,?)",
                   (initial, initial, now, now))


def read(path, public=False):
    with connect(path) as db:
        row = db.execute("select * from sketchbook where id=1").fetchone()
    if public:
        return {**json.loads(row["published"]), "revision": row["published_revision"], "published_at": row["published_at"]}
    return {"document": json.loads(row["draft"]), "revision": row["revision"],
            "published_revision": row["published_revision"], "published_at": row["published_at"]}


def validate(document, db):
    if not isinstance(document, dict) or document.get("version") != 1:
        raise ValueError("Format de livre incorrect.")
    pages = document.get("pages")
    if not isinstance(pages, list) or not 1 <= len(pages) <= 500:
        raise ValueError("Le livre doit contenir entre 1 et 500 pages.")
    ids, clean = set(), []
    assets = {r["id"] for r in db.execute("select id from sketchbook_assets")}
    for page in pages:
        if not isinstance(page, dict):
            raise ValueError("Page incorrecte.")
        page_id = page.get("id", "")
        if not isinstance(page_id, str) or not IDENTIFIER.fullmatch(page_id) or page_id in ids:
            raise ValueError("Identifiant de page incorrect ou répété.")
        ids.add(page_id)
        title, items = page.get("title", ""), page.get("items")
        if not isinstance(title, str) or len(title) > 120 or not isinstance(items, list) or len(items) > 32:
            raise ValueError("Une page accepte un titre de 120 caractères et 32 croquis maximum.")
        clean_items, item_ids = [], set()
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Croquis incorrect.")
            item_id, src, alt = item.get("id", ""), item.get("src", ""), item.get("alt", "")
            if not isinstance(item_id, str) or not IDENTIFIER.fullmatch(item_id) or item_id in item_ids:
                raise ValueError("Identifiant de croquis incorrect ou répété.")
            if not isinstance(src, str) or src not in BUILTIN and src not in assets:
                raise ValueError("Image absente du catalogue du salon.")
            if not isinstance(alt, str) or len(alt) > 180:
                raise ValueError("La description du croquis est trop longue.")
            values = {}
            for key in ("x", "y", "w", "h"):
                value = item.get(key)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError("Position de croquis incorrecte.")
                values[key] = round(value, 4)
            if not (0 <= values["x"] <= 100 and 0 <= values["y"] <= 100 and
                    2 <= values["w"] <= 100 and 2 <= values["h"] <= 100 and
                    values["x"] + values["w"] <= 100.001 and values["y"] + values["h"] <= 100.001):
                raise ValueError("Gardez les croquis dans les limites de la page.")
            item_ids.add(item_id)
            clean_items.append({"id": item_id, "src": src, "alt": alt, **values})
        clean.append({"id": page_id, "title": title.strip(), "items": clean_items})
    return {"version": 1, "pages": clean}


def save(path, actor_id, document, revision):
    with connect(path) as db:
        db.execute("begin immediate")
        row = db.execute("select revision from sketchbook where id=1").fetchone()
        if revision != row["revision"]:
            raise Conflict("Le livre a changé dans une autre session. Rechargez avant de sauvegarder.")
        clean = validate(document, db)
        db.execute("update sketchbook set draft=?,revision=revision+1,updated_at=? where id=1",
                   (json.dumps(clean, ensure_ascii=False), utc_now().isoformat()))
        db.execute("insert into access_events(actor_id,action,target,created_at) values (?,?,?,?)",
                   (actor_id, "book.draft", str(len(clean["pages"])), utc_now().isoformat()))
    return read(path)


def publish(path, actor_id, revision):
    with connect(path) as db:
        db.execute("begin immediate")
        row = db.execute("select * from sketchbook where id=1").fetchone()
        if revision != row["revision"]:
            raise Conflict("Le brouillon a changé. Rechargez avant de publier.")
        validate(json.loads(row["draft"]), db)
        db.execute("update sketchbook set published=draft,published_revision=revision,published_at=? where id=1",
                   (utc_now().isoformat(),))
        db.execute("insert into access_events(actor_id,action,target,created_at) values (?,?,?,?)",
                   (actor_id, "book.publish", str(revision), utc_now().isoformat()))
    return read(path)


def upload(path, encoded, name):
    if len(encoded) > 7_000_000:
        raise ValueError("Image trop lourde (5 Mo maximum).")
    try:
        body = base64.b64decode(encoded, validate=True)
        if len(body) > 5_000_000:
            raise ValueError("Image trop lourde.")
        with Image.open(io.BytesIO(body), formats=["PNG", "JPEG", "WEBP"]) as image:
            if image.width * image.height > 24_000_000 or min(image.size) < 10:
                raise ValueError("Dimensions de l’image non prises en charge.")
            image.load()
            image = ImageOps.exif_transpose(image).convert("RGBA")
            image.thumbnail((2000, 2000))
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=93, method=4)
            body = output.getvalue()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise ValueError("Choisissez une image PNG, JPEG ou WebP valide.") from exc
    asset_id = hashlib.sha256(body).hexdigest()
    with connect(path) as db:
        if db.execute("select coalesce(sum(length(body)),0) from sketchbook_assets").fetchone()[0] > 500_000_000:
            raise ValueError("Le stockage du livre est plein. Contactez le responsable.")
        db.execute("insert or ignore into sketchbook_assets values (?,?,?,?,?)",
                   (asset_id, body, "image/webp", name[:160], utc_now().isoformat()))
    return {"id": asset_id, "name": name[:160]}


def asset(path, asset_id, public=False):
    if not re.fullmatch(r"[a-f0-9]{64}", asset_id):
        return None
    with connect(path) as db:
        if public:
            published = json.loads(db.execute("select published from sketchbook where id=1").fetchone()[0])
            if not any(item["src"] == asset_id for page in published["pages"] for item in page["items"]):
                return None
        row = db.execute("select body,media_type from sketchbook_assets where id=?", (asset_id,)).fetchone()
    return dict(row) if row else None
