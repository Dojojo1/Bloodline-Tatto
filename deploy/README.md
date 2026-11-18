# Installation du premier module de gestion

Le service Bloodline est séparé de `heritage-site.service`, de la base et des secrets du vignoble. Il écoute uniquement sur `127.0.0.1:8082` ; un proxy HTTPS public doit servir la page et l'API sur la **même origine**. Ne pas exposer directement le port 8082 à Internet.

1. Installer ce dépôt dans `/home/dojojo/Documents/bloodline` sans écraser le dossier du vignoble.
2. Créer un environnement Python et installer `requirements-gestion.txt`.
3. Mettre dans `.env` privé : `BLOODLINE_DB_PATH=/home/dojojo/Documents/bloodline/data/bloodline.sqlite3` et `BLOODLINE_PUBLIC_ORIGIN=https://adresse-de-gestion.example`. Garder `BLOODLINE_COOKIE_SECURE=1` en production.
4. Configurer un domaine ou sous-domaine HTTPS distinct de la gestion du vignoble, pointant vers le port local 8082. L'origine de `.env` doit correspondre exactement à l'adresse publique.
5. Installer `bloodline-gestion-user.service` dans `~/.config/systemd/user/`, activer la persistance de la session avec `loginctl enable-linger dojojo`, puis démarrer le service avec `systemctl --user enable --now bloodline-gestion-user.service`. Tester `/api/health` localement et via l'adresse HTTPS une fois le proxy configuré. Le fichier `bloodline-gestion.service` reste disponible pour une installation système avec droits administrateur.
6. Créer les deux comptes avec `.venv/bin/python -m scripts.create_admin --username nom-de-compte` depuis le dossier du projet. Le nom affiché est facultatif avec `--name "Nom affiché"`. La commande demande le mot de passe sans l'afficher. Ne jamais envoyer le mot de passe dans la conversation ni le mettre en argument de commande.
7. Installer `bloodline-backup.service` et `bloodline-backup.timer` dans `~/.config/systemd/user/`, puis activer le minuteur avec `systemctl --user enable --now bloodline-backup.timer`. Lancer une première sauvegarde avec `systemctl --user start bloodline-backup.service`. Définir `BLOODLINE_BACKUP_DIR` vers un emplacement privé si besoin. Vérifier régulièrement une restauration et copier périodiquement les sauvegardes hors du serveur.

Avant d'avoir un domaine HTTPS, garder le service sur `127.0.0.1:8082` et tester depuis un ordinateur autorisé via `ssh -L 8082:127.0.0.1:8082 server-linux`, avec `BLOODLINE_PUBLIC_ORIGIN=http://127.0.0.1:8082` et `BLOODLINE_COOKIE_SECURE=0`. Ne créer aucun compte avec un mot de passe partagé dans un chat.
