"""Convert the existing initial passwords into one-time activation codes."""
import os
from pathlib import Path

from backend.storage import connect, init_database


def prepare(db_path, initial_path, activation_path):
    initial_path = Path(initial_path)
    activation_path = Path(activation_path)
    if not initial_path.is_file() or activation_path.exists():
        raise ValueError("Fichier initial absent ou codes d’activation déjà préparés.")
    init_database(db_path)
    with connect(db_path) as db:
        accounts = db.execute("select id, username, role, activation_required from members").fetchall()
        if len(accounts) != 2 or {item["username"] for item in accounts} != {"erwan", "lucia"}:
            raise ValueError("Les deux comptes attendus sont introuvables.")
        if any(item["role"] != "superadmin" or item["activation_required"] for item in accounts):
            raise ValueError("Les comptes ont déjà été activés ou modifiés.")
        db.execute("update members set activation_required = 1 where username in ('erwan', 'lucia')")
        db.execute("delete from sessions where member_id in (select id from members where username in ('erwan', 'lucia'))")
    os.replace(initial_path, activation_path)
    os.chmod(activation_path, 0o600)


def main():
    root = Path(__file__).resolve().parents[1]
    db_path = Path(os.environ.get("BLOODLINE_DB_PATH", root / "data" / "bloodline.sqlite3"))
    private_dir = Path.home() / ".config" / "bloodline"
    output = private_dir / "activation-codes.txt"
    prepare(db_path, private_dir / "initial-admins.txt", output)
    print(f"Première connexion prête. Codes dans {output} (lecture privée).")


if __name__ == "__main__":
    main()
