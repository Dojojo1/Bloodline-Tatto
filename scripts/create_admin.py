"""Create one of the two private admin accounts without putting a password in Git."""
import argparse
import getpass
import os
from pathlib import Path

from backend.storage import create_member, init_database


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--name", help="Nom affiché ; utilise le nom de compte si omis")
    args = parser.parse_args()
    password = getpass.getpass("Mot de passe (12 caractères minimum) : ")
    confirm = getpass.getpass("Confirmer le mot de passe : ")
    if password != confirm:
        raise SystemExit("Les mots de passe sont différents.")
    path = Path(os.environ.get("BLOODLINE_DB_PATH", Path(__file__).resolve().parents[1] / "data" / "bloodline.sqlite3"))
    init_database(path)
    create_member(path, args.username, args.name or args.username, password, "superadmin")
    print("Compte administrateur créé.")


if __name__ == "__main__":
    main()
