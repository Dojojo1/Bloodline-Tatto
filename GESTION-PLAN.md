# Plan de reprise — gestion Bloodline Tattoo

État au 19 novembre 2026 : le site vitrine et la page de gestion sont publiés sur GitHub Pages. `editor.html` est un atelier de mise en page. Le formulaire sur mesure copie encore la demande sur l'appareil ; l'envoi public attend les coordonnées du responsable à afficher dans l'information sur les données. La gestion privée présente le tableau de bord, les fiches de demandes et de rendez-vous, le pointage personnel, les heures d'équipe mensuelles et la gestion des accès. L'API et la base SQLite privée sont dans `/home/dojojo/Documents/bloodline` sur le serveur Linux, avec sauvegarde quotidienne ; elles passent par l'adresse ngrok du vignoble sous le chemin distinct `/bloodline-api/`, via un routeur local sur `127.0.0.1:8083`. Les comptes Erwan et Lucia ont été créés ; un des deux attend encore son activation avec son code privé et le choix de son mot de passe. Aucune donnée de démonstration n'est stockée en production.

## Décisions déjà prises avec le propriétaire

- La propriétaire du salon doit pouvoir modifier les contenus et réglages courants sans faire modifier le code : artistes (nombre libre, photo, nom, présentation), tatouages (photo, nom, prix), prestations, photos, textes, prix et webhook Discord.
- Le visiteur indique son numéro et propose ses disponibilités. Il ne réserve pas directement un créneau et n'a pas besoin de compte. L'équipe le contacte et confirme le rendez-vous.
- Chaque rendez-vous possède une fiche liée au client, à la demande, à l'artiste, à son statut, aux notes et aux ventes éventuelles.
- La gestion comprend : tableau de bord ; rendez-vous ; projets et demandes ; artistes ; prestations et services ; pointage des heures (« prise de services ») ; gestion des accès ; tatouages vendus avec prix ; comptabilité complète (recettes, dépenses, acomptes, remboursements et parts des artistes).
- « Nos styles » doit devenir une page distincte de la vitrine. La gestion permet d'y publier des tatouages avec photo, nom et prix.
- Rôles initiaux : Patron, Co-patron, Artiste, Direction. Les deux comptes d'administration suprême seront ceux du créateur du site et de la personne pour qui il le crée. Les rôles peuvent être ajoutés, renommés ou retirés, avec droits configurables.
- Le webhook et le salon Discord privé n'existent pas encore : la gestion doit permettre de renseigner ou remplacer le webhook plus tard. Ne jamais l'exposer dans le code ou les réponses du navigateur.
- L'atelier visuel actuel reste distinct de la gestion métier, mais un accès depuis le nouveau panneau peut y mener.

## Architecture de réalisation recommandée

GitHub Pages héberge la vitrine et l'interface de gestion. Le **serveur Linux existant** héberge uniquement l'API et les données privées, dans un service FastAPI indépendant (port local 8082) avec sa propre base SQLite. L'adresse ngrok existante arrive sur un routeur Caddy local (port 8083) : seul le chemin `/bloodline-api/*` va vers Bloodline ; tous les autres chemins vont vers le vignoble (port 8081). L'API Bloodline autorise seulement l'origine GitHub Pages du propriétaire ; chaque requête privée porte un jeton de session dans l'en-tête Authorization, conservé dans le stockage de l'onglet et invalidé à la déconnexion. Ne pas partager les fichiers, secrets ou comptes du vignoble. Les opérations sensibles passent par l'API Linux.

Ne jamais mettre un mot de passe initial, un « code admin suprême », une clé de service ou le webhook Discord dans GitHub Pages, `site-content.js`, `design-settings.json` ou le JavaScript client. Les deux comptes suprêmes ont été créés côté serveur avec `scripts/bootstrap_admins.py` ; les codes privés à usage unique sont remis hors du dépôt. La gestion permet d'inviter ou de réinitialiser un compte d'équipe, avec un nouveau code affiché une seule fois. Prévoir une authentification à deux facteurs pour les administrateurs et une procédure privée de récupération si les deux comptes suprêmes perdent l'accès.

## Données à prévoir

- `members`, `roles` : comptes, invitations avec code temporaire, rôles renommables et droits par rubrique. Les deux comptes administrateurs suprêmes restent protégés ; les comptes d'équipe peuvent être désactivés sans effacer leur historique.
- `clients`, `project_requests`, `appointments`, `appointment_notes` : numéro, projet, disponibilités proposées, suivi et historique. Une demande peut produire un rendez-vous confirmé par l'équipe.
- `artists` : profil, photo, présentation, visibilité, ordre d'affichage. Le nombre de profils est libre ; les listes et le fond de section suivent automatiquement leur contenu.
- `services`, `tattoo_catalog`, `portfolio_items` : prestations, tatouages publiés avec photo/nom/prix, réalisations. Séparer le catalogue affiché des ventes réelles. Ici, « prise de services » désigne le pointage du personnel, pas une prestation client.
- `work_sessions`, `work_session_adjustments` : début et fin du service, propriétaire du compte, durée calculée, éventuelles pauses et corrections validées. Une session ouverte à la fois par personne ; les heures sont calculées côté serveur et conservées dans l'historique.
- `sales`, `sale_lines`, `deposits`, `expenses`, `refunds`, `artist_shares` : montants, dates, liens vers rendez-vous/artiste, statut et trace des corrections. Éviter l'effacement des écritures comptables : annuler ou corriger avec historique.
- `site_content`, `site_assets`, `integrations`, `audit_log` : contenus publiés, médias, configuration du webhook côté serveur, journal des modifications sensibles.

Définir les prix et montants en centimes, avec devise explicite. Prévoir export CSV et filtres par période, artiste et statut. Les tableaux de bord calculent leurs totaux à partir des écritures réelles, pas de valeurs saisies à part.

## Parcours à construire dans cet ordre

1. **Socle privé** : service Linux Bloodline indépendant, schéma et migrations versionnées, connexion, invitations, deux administrateurs suprêmes et journal d'audit. Vérifier qu'un visiteur et un artiste ne peuvent pas lire les données interdites. La connexion, le pointage, l'accès HTTPS, les invitations, les rôles renommables, la désactivation et le journal des changements d'accès sont installés. Un compte suprême attend encore son activation ; l'authentification à deux facteurs reste à construire.
2. **Demandes et rendez-vous** : le stockage privé, les fiches, notes, statuts et confirmations sont en place. Publier l'envoi réel du formulaire après ajout du nom du responsable et d'un contact pour l'information sur les données personnelles. La validation, le piège anti-spam et les limites d'envoi sont codés et testés. Le client propose ses disponibilités sans choisir de créneau.
3. **Gestion éditoriale** : le livre de **Nos styles** dispose maintenant d’un éditeur privé relié à la permission **Contenu** : pages, import de croquis, placement souris/tactile/clavier, dimensions, ordre, brouillon et publication sans commit manuel. Catalogue et images sont inclus dans les sauvegardes SQLite ; la vitrine lit uniquement l’instantané publié. Les artistes, galerie, prix, prestations et autres contenus restent à raccorder.
4. **Pointage** : dans chaque profil connecté, boutons « Prendre mon service » et « Terminer mon service », compteur de la session en cours et historique personnel. La vue d'équipe par mois avec totaux et export CSV est installée pour les deux administrateurs suprêmes. Les totaux journaliers et hebdomadaires ainsi que les corrections manuelles avec motif et historique restent à construire. Horodatage par le serveur, fuseau Europe/Brussels à l'affichage.
5. **Opérations et finances** : saisir tatouage vendu et prix, acomptes, règlements, dépenses, remboursements, parts des artistes, rapports et exports ; relier chaque mouvement à sa source.
6. **Intégrations et finition** : écran de configuration du webhook, test d'envoi depuis le serveur, notifications Discord, sauvegardes, contrôles d'accès complets, vérification mobile et test du parcours entier en ligne.

Une étape est finie seulement si la vitrine en ligne, la gestion, les permissions et la persistance fonctionnent ensemble. Les données de démonstration ne doivent pas être présentées comme des clients, ventes ou artistes réels.

## Points à trancher avant l'implémentation dépendante

1. Pour activer l'envoi du formulaire public : le nom du responsable des demandes et un moyen de contact public à afficher dans l'information sur les données. Aucun e-mail de compte n'est requis.
2. Pour le **pointage** : faut-il compter les pauses, permettre l'oubli de fin de service et qui peut corriger une session ? L'hypothèse de départ est : pause facultative, oubli signalé, correction réservée aux deux administrateurs suprêmes avec motif et historique.
3. Pour les **parts des artistes** : pourcentage par artiste, par prestation ou calcul manuel ? Les rapports pourront commencer avec une saisie explicite, puis automatiser la règle choisie.
4. Le webhook Discord pourra être ajouté plus tard depuis la gestion. Les sauvegardes sont sur le serveur Linux ; prévoir aussi une copie hors serveur.

## Reprise rapide

Commencer par vérifier `git status` et la branche distante. Lire ce document, `README.md`, `site-content.js`, `editor.html` et le formulaire de `index.html`. Ne pas confondre l'atelier visuel et la future gestion. Construire le socle privé avant de promettre la réception des demandes ou la comptabilité. Demander les points ci-dessus uniquement lorsqu'ils bloquent la fonction concernée. Publier ensuite la vitrine et le panneau en ligne, puis vérifier le déploiement réel.
