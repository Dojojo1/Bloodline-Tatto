"""Create a consistent private SQLite backup; run daily from a timer or cron."""
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    source = Path(os.environ.get("BLOODLINE_DB_PATH", root / "data" / "bloodline.sqlite3"))
    backup_dir = Path(os.environ.get("BLOODLINE_BACKUP_DIR", root / "backups"))
    if not source.is_file():
        raise SystemExit("Base Bloodline introuvable ; aucune sauvegarde créée.")
    backup_dir.mkdir(parents=True, exist_ok=True)
    target = backup_dir / f"bloodline-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.sqlite3"
    with closing(sqlite3.connect(source)) as original, closing(sqlite3.connect(target)) as backup:
        original.backup(backup)
        if backup.execute("pragma integrity_check").fetchone()[0] != "ok":
            raise SystemExit("La vérification de la sauvegarde a échoué.")
    os.chmod(target, 0o600)
    print(f"Sauvegarde vérifiée : {target}")


if __name__ == "__main__":
    main()
