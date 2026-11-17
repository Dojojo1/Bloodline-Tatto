# APEX — Bloodline Tattoo, site vitrine

## Contract

Créer dans ce dossier une première version locale du site vitrine Bloodline Tattoo en HTML, CSS et JavaScript, fidèle à la maquette fournie. Laisser le logo intact. Reporter la gestion des clients et des demandes.

## Baseline et risque

- Dossier initialement vide, sans dépôt Git ni instructions AGENTS.md.
- Risque : moyen (nouvelle interface et interactions locales, aucune donnée distante).
- Informations manquantes : coordonnées, ville, portraits d'artistes, photographies de réalisations. Ne pas les inventer.
- `apex-state.py` ne fonctionne pas sous Windows : import Python `fcntl` indisponible. Ce journal conserve le minimum de l'état APEX.

## Tâches

1. Enregistrer le produit et les références visuelles. Terminé.
2. Construire l'accueil et les sections en HTML/CSS/JS. Terminé.
3. Vérifier navigation, formulaire local, responsive et accessibilité. Terminé pour la première version locale.
4. Documenter le résultat et les contenus à compléter. Terminé.

## Vérifications en cours

- `node --check script.js` : réussi.
- Diagnostic éditeur sur HTML, CSS et JS : aucune erreur.
- Navigateur Chromium : largeurs 1440 et 390 sans débordement ; images chargées ; GSAP chargé ; menu mobile et copie du brief fonctionnels ; aucune erreur JavaScript.
- Ajustement issu de la vérification : hauteur automatique du logo et fond sombre fondu derrière le logo.
- Prévisualisation intégrée indisponible ; captures faites avec Chromium local.

## Validation finale

- Serveur local : réponse HTTP 200.
- `node --check script.js` : PASS.
- Diagnostic éditeur HTML/CSS/JS : PASS, aucune erreur.
- Navigateur Chromium : PASS à 1440, 768 et 390 px ; aucune image cassée, aucun débordement horizontal ni erreur JavaScript.
- Menu mobile : PASS, premier lien focalisé, arrière-plan inert, Tab bouclé sur les contrôles du menu, arrière-plan restauré à la fermeture.
- Brief local : PASS, texte copié sans envoi ; préférence de réduction des animations : logo visible.
- Empreinte SHA-256 du logo copié identique à celle de l'original : PASS.
- Revue indépendante : trois points signalés (promesse de rendez-vous, focus du menu, images des cartes) et tous trois résolus après correction et nouvelle capture. Verdict final : première version locale prête.
- Le dossier `.impeccable/qa` contient l'outil de vérification et sa dépendance locale. Son nettoyage automatique a été refusé par la politique d'exécution ; il ne participe pas au site.

## Évolution de la vitrine

- « Pro / entreprise » et « Sur-mesure » regroupés dans un seul parcours.
- « Nos styles » ajouté en première section après l'accueil.
- `site-content.js` centralise les contenus éditoriaux et l'ordre des sections pour le futur panneau de gestion.
- Bouton « Gestion » ajouté au pied de page ; il annonce le panneau à venir sans simuler une connexion.
- Contrôles syntaxiques et navigateur à 1440, 768 et 390 px : aucune erreur JavaScript, image cassée ou largeur excessive ; menu mobile et formulaire RP fonctionnels.
- Contrôle de configuration sans modifier les fichiers : la marque, un libellé de navigation, l'ordre des sections, le titre d'un style et la couleur d'accent changent depuis `site-content.js` au chargement.
- Bouton « Gestion » : message d'attente visible après activation. Le panneau et la persistance restent explicitement hors de cette étape.
