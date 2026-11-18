"""Create two admins with private one-time activation codes."""
import argparse
import os
import re
import secrets
from pathlib import Path

from backend.storage import connect, init_database, password_hash, utc_now


def bootstrap(db_path, credentials_path, names):
    if len(names) != 2 or len({name.lower() for name in names}) != 2:
        raise ValueError("Deux noms de compte distincts sont nécessaires.")
    if any(not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", name.lower()) for name in names):
        raise ValueError("Noms de compte invalides.")
    credentials_path = Path(credentials_path)
    credentials_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(credentials_path.parent, 0o700)
    init_database(db_path)
    generated = [(name, secrets.token_urlsafe(24)) for name in names]
    with connect(db_path) as db:
        if db.execute("select count(*) from members").fetchone()[0]:
            raise ValueError("La base contient déjà des comptes ; création initiale annulée.")
        fd = os.open(credentials_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as output:
                for name, code in generated:
                    output.write(f"{name}: {code}\n")
            for name, code in generated:
                db.execute(
                    "insert into members(username, display_name, password_hash, activation_required, role, created_at) values (?, ?, ?, 1, 'superadmin', ?)",
                    (name.lower(), name, password_hash(code), utc_now().isoformat()),
                )
        except Exception:
            credentials_path.unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("first")
    parser.add_argument("second")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    db_path = Path(os.environ.get("BLOODLINE_DB_PATH", root / "data" / "bloodline.sqlite3"))
    credentials_path = Path.home() / ".config" / "bloodline" / "activation-codes.txt"
    bootstrap(db_path, credentials_path, (args.first, args.second))
    print(f"Deux comptes créés. Codes d’activation dans {credentials_path} (lecture privée).")


if __name__ == "__main__":
    main()
