# Bloodline Tattoo — site vitrine

La préparation de la future gestion métier est consignée dans [GESTION-PLAN.md](./GESTION-PLAN.md).

Première version locale en HTML, CSS et JavaScript, construite d'après [la maquette fournie](./reference/maquette.png). Le [logo original](./assets/bloodline-logo.png) est utilisé sans modification du fichier.

## Voir le site

Ouvrir [index.html](./index.html) dans un navigateur. Pour le tester avec un serveur local :

```powershell
py -3 -m http.server 4173 --bind 127.0.0.1
```

Puis ouvrir `http://127.0.0.1:4173/`.

## Contenu et comportement

- Navigation vers les sections du site, avec « Nos styles » juste après l’accueil et un menu mobile.
- Animation d'entrée discrète avec une copie locale de GSAP. Le site reste lisible si JavaScript ou GSAP est indisponible, et respecte la préférence de réduction des animations.
- Demande de rendez-vous copiable pour un projet personnel ou de groupe. Le visiteur peut préciser son motif, son emplacement et son numéro, puis choisir son propre dessin ou une création unique proposée par le tatoueur. Les détails sont discutés pendant le rendez-vous. Aucune donnée n'est envoyée ni enregistrée, et le formulaire ne confirme aucun créneau.
- Le fond de la première vue, les cartes et les visuels de section sont illustratifs. Ils ne représentent pas des tatouages réalisés par le salon.

## Contenus configurables

[site-content.js](./site-content.js) regroupe les textes, les menus, l'ordre des sections, les cartes, les visuels, les profils d'artistes, la galerie, les options du formulaire, les liens de contact et les principales couleurs. La page affiche un contenu de secours sans ce fichier, puis applique la configuration au chargement. Le parcours « Pro / entreprise » partage désormais la section sur mesure et le même formulaire.

Le bouton « Gestion » ouvre [l'atelier visuel](./editor.html). Il permet de sélectionner les éléments de la vitrine, de les déplacer, de saisir des dimensions, de changer les couleurs et d'ajouter des images. Chaque section possède un bouton « Fond » dans la navigation de l'atelier ; le panneau permet de changer sa couleur, de masquer son image ou de choisir un visuel déjà présent. Les réglages d'ordinateur, tablette et mobile sont distincts. Un brouillon peut être conservé dans le navigateur.

Pour publier depuis la version en ligne, l'éditeur doit avoir un compte GitHub autorisé sur `Dojojo1/Bloodline-Tatto`. Le propriétaire peut créer une clé fine-grained limitée à ce dépôt avec la permission **Contents: Read and write**. Il colle cette clé dans l'atelier, vérifie son accès et clique sur « Publier en ligne ». La clé reste dans l'onglet et n'est pas enregistrée. L'atelier modifie uniquement [design-settings.json](./design-settings.json) et ajoute les images choisies dans `assets/uploads/`; GitHub Pages déploie ensuite la nouvelle version. Le bouton affiche quand le fichier publié est disponible.

Si la clé est refusée, l'atelier permet aussi de copier les réglages et de les coller dans [design-settings.json sur GitHub](https://github.com/Dojojo1/Bloodline-Tatto/edit/main/design-settings.json), puis de valider la modification. GitHub indique que les clés fines ne couvrent pas encore tous les cas des collaborateurs externes ; un collaborateur peut avoir besoin d'une clé classique avec `public_repo`. Cette dernière donne un accès plus large et doit rester privée.

L'atelier est réservé à la mise en page. La gestion des rendez-vous, des prestations, des ventes, des accès détaillés et de la comptabilité fera l'objet d'un panneau distinct.

## À compléter avec les informations du salon

1. Ville, adresse, horaires et canal de contact réel.
2. Portraits, noms et spécialités des artistes.
3. Photos des réalisations, avec autorisation de publication.
4. Le canal réel par lequel les demandes de rendez-vous seront transmises.

La future gestion des clients et des demandes demandera un système distinct de connexion, de stockage et de réception. Elle n'est pas implémentée dans cette version.
