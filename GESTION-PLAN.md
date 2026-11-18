# Plan de reprise — gestion Bloodline Tattoo

État au 18 novembre 2026 : le site vitrine est publié sur GitHub Pages. `editor.html` est un atelier de mise en page. Le formulaire sur mesure copie actuellement la demande sur l'appareil ; il ne l'envoie pas. Le premier module de gestion est installé dans `/home/dojojo/Documents/bloodline` sur le serveur Linux : connexion et pointage personnel, SQLite privée, service persistant sur `127.0.0.1:8082` et sauvegarde quotidienne. Il manque les deux vrais comptes administrateurs et une adresse HTTPS pour l'ouvrir sans tunnel SSH. Aucun client, rendez-vous ou paiement n'est encore stocké.

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

GitHub Pages continue à héberger la vitrine. La gestion est hébergée séparément sur le **serveur Linux existant**, avec son propre service FastAPI (port local 8082), sa propre base SQLite privée et un point d'accès HTTPS distinct de celui du vignoble. La page de gestion et l'API sont servies depuis la même origine ; la session reste dans un cookie HttpOnly. Ne pas partager les fichiers, secrets ou comptes du vignoble. Les pages publiques ne reçoivent que le contenu destiné à la vitrine. Les opérations sensibles passent par l'API Linux.

Ne jamais mettre un mot de passe initial, un « code admin suprême », une clé de service ou le webhook Discord dans GitHub Pages, `site-content.js`, `design-settings.json` ou le JavaScript client. Le premier module crée les deux comptes d'administration avec la commande privée `scripts/create_admin.py`, qui lit le mot de passe sans l'afficher. Une invitation et une réinitialisation de mot de passe restent à construire avant que la propriétaire gère seule tous les accès. Prévoir une authentification à deux facteurs pour les administrateurs et protéger les deux comptes suprêmes contre la suppression ou la perte simultanée d'accès.

## Données à prévoir

- `users`, `roles`, `permissions`, `user_roles` : comptes, rôles renommables et matrice de droits. Identifiants stables pour les rôles, noms affichés modifiables.
- `clients`, `project_requests`, `appointments`, `appointment_notes` : numéro, projet, disponibilités proposées, suivi et historique. Une demande peut produire un rendez-vous confirmé par l'équipe.
- `artists` : profil, photo, présentation, visibilité, ordre d'affichage. Le nombre de profils est libre ; les listes et le fond de section suivent automatiquement leur contenu.
- `services`, `tattoo_catalog`, `portfolio_items` : prestations, tatouages publiés avec photo/nom/prix, réalisations. Séparer le catalogue affiché des ventes réelles. Ici, « prise de services » désigne le pointage du personnel, pas une prestation client.
- `work_sessions`, `work_session_adjustments` : début et fin du service, propriétaire du compte, durée calculée, éventuelles pauses et corrections validées. Une session ouverte à la fois par personne ; les heures sont calculées côté serveur et conservées dans l'historique.
- `sales`, `sale_lines`, `deposits`, `expenses`, `refunds`, `artist_shares` : montants, dates, liens vers rendez-vous/artiste, statut et trace des corrections. Éviter l'effacement des écritures comptables : annuler ou corriger avec historique.
- `site_content`, `site_assets`, `integrations`, `audit_log` : contenus publiés, médias, configuration du webhook côté serveur, journal des modifications sensibles.

Définir les prix et montants en centimes, avec devise explicite. Prévoir export CSV et filtres par période, artiste et statut. Les tableaux de bord calculent leurs totaux à partir des écritures réelles, pas de valeurs saisies à part.

## Parcours à construire dans cet ordre

1. **Socle privé** : service Linux Bloodline indépendant, schéma et migrations versionnées, connexion, invitations, deux administrateurs suprêmes et journal d'audit. Vérifier qu'un visiteur et un artiste ne peuvent pas lire les données interdites. Le premier jet connexion + pointage est installé et testé sur le serveur ; les comptes réels, l'accès HTTPS, les invitations et l'audit restent à faire.
2. **Demandes et rendez-vous** : remplacer la copie du formulaire par un envoi réel avec consentement et protection anti-spam ; enregistrer le numéro et les disponibilités ; créer une fiche de demande ; permettre à l'équipe de contacter, assigner, confirmer, déplacer ou annuler un rendez-vous. Le client ne choisit pas de créneau.
3. **Gestion éditoriale** : artistes, vitrine, galerie, page « Nos styles » séparée, tatouages photo/nom/prix, prestations et services ; aperçu avant publication. Les changements doivent se voir sur GitHub Pages sans nouveau commit manuel.
4. **Pointage** : dans chaque profil connecté, boutons « Prendre mon service » et « Terminer mon service », compteur de la session en cours et historique personnel ; vue d'équipe pour les responsables, total par jour/semaine/mois et export. Horodatage par le serveur, fuseau Europe/Brussels à l'affichage. Une correction manuelle conserve l'original et l'auteur de la correction.
5. **Opérations et finances** : saisir tatouage vendu et prix, acomptes, règlements, dépenses, remboursements, parts des artistes, rapports et exports ; relier chaque mouvement à sa source.
6. **Intégrations et finition** : écran de configuration du webhook, test d'envoi depuis le serveur, notifications Discord, sauvegardes, contrôles d'accès complets, vérification mobile et test du parcours entier en ligne.

Une étape est finie seulement si la vitrine en ligne, la gestion, les permissions et la persistance fonctionnent ensemble. Les données de démonstration ne doivent pas être présentées comme des clients, ventes ou artistes réels.

## Points à trancher avant l'implémentation dépendante

1. Les noms de compte des **deux futurs administrateurs suprêmes**. Aucun e-mail n'est requis. Ne pas inscrire leurs mots de passe dans ce fichier.
2. Pour le **pointage** : faut-il compter les pauses, permettre l'oubli de fin de service et qui peut corriger une session ? L'hypothèse de départ est : pause facultative, oubli signalé, correction réservée aux deux administrateurs suprêmes avec motif et historique.
3. Pour les **parts des artistes** : pourcentage par artiste, par prestation ou calcul manuel ? Les rapports pourront commencer avec une saisie explicite, puis automatiser la règle choisie.
4. Hébergement et budget du service de données, domaine éventuel, et responsable des sauvegardes. Le webhook peut être ajouté plus tard depuis la gestion.

## Reprise rapide

Commencer par vérifier `git status` et la branche distante. Lire ce document, `README.md`, `site-content.js`, `editor.html` et le formulaire de `index.html`. Ne pas confondre l'atelier visuel et la future gestion. Construire le socle privé avant de promettre la réception des demandes ou la comptabilité. Demander les points ci-dessus uniquement lorsqu'ils bloquent la fonction concernée. Publier ensuite la vitrine et le panneau en ligne, puis vérifier le déploiement réel.
