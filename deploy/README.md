# Installation du premier module de gestion

Le service Bloodline est séparé de `heritage-site.service`, de la base et des secrets du vignoble. Il écoute uniquement sur `127.0.0.1:8082` ; un proxy HTTPS public doit servir la page et l'API sur la **même origine**. Ne pas exposer directement le port 8082 à Internet.

1. Installer ce dépôt dans `/home/dojojo/Documents/bloodline_gestion` sans écraser le dossier du vignoble.
2. Créer un environnement Python et installer `requirements-gestion.txt`.
3. Mettre dans `.env` privé : `BLOODLINE_DB_PATH=/home/dojojo/Documents/bloodline_gestion/data/bloodline.sqlite3` et `BLOODLINE_PUBLIC_ORIGIN=https://adresse-de-gestion.example`. Garder `BLOODLINE_COOKIE_SECURE=1` en production.
4. Configurer un domaine ou sous-domaine HTTPS distinct de la gestion du vignoble, pointant vers le port local 8082. L'origine de `.env` doit correspondre exactement à l'adresse publique.
5. Installer `bloodline-gestion.service`, puis démarrer le service. Tester `/api/health` via l'adresse HTTPS.
6. Créer les deux comptes avec `python -m scripts.create_admin --email ... --name ...` depuis le dossier du projet. La commande demande le mot de passe sans l'afficher. Ne jamais envoyer le mot de passe dans la conversation ni le mettre en argument de commande.
7. Lancer `python -m scripts.backup_gestion` pour produire et vérifier une sauvegarde SQLite. Définir `BLOODLINE_BACKUP_DIR` vers un emplacement privé, planifier la commande chaque jour et vérifier une restauration. Copier périodiquement les sauvegardes hors du serveur.

L'accès SSH automatique à `server-linux` a été refusé au moment de la préparation (`Permission denied (publickey,password)`). Aucun déploiement sur le serveur n'a été effectué. Ne pas lancer ces étapes avant d'avoir vérifié l'accès SSH et l'adresse HTTPS à utiliser.
