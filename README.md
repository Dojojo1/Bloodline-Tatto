# Bloodline Tattoo — site vitrine

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
- Demande de rendez-vous RP copiable pour un projet personnel ou de groupe. Le visiteur peut préciser son motif, la taille, l'emplacement et choisir son propre dessin ou une création unique proposée par le tatoueur. Les détails sont discutés pendant le rendez-vous RP. Aucune donnée n'est envoyée ni enregistrée, et le formulaire ne confirme aucun créneau.
- Le fond de la première vue, les cartes et les visuels de section sont illustratifs. Ils ne représentent pas des tatouages réalisés par le salon.

## Contenus configurables

[site-content.js](./site-content.js) regroupe les textes, les menus, l'ordre des sections, les cartes, les visuels, les profils d'artistes, la galerie, les options du formulaire, les liens de contact et les principales couleurs. La page affiche un contenu de secours sans ce fichier, puis applique la configuration au chargement. Le parcours « Pro / entreprise » partage désormais la section sur mesure et le même formulaire RP.

Le bouton « Gestion » est déjà présent dans le pied de page. Il annonce le futur panneau ; il ne donne pas encore accès à un espace d'administration. Un véritable panneau exigera une authentification et un service de stockage pour modifier et conserver cette configuration.

## À compléter avec les informations du salon

1. Ville, adresse, horaires et canal de contact réel.
2. Portraits, noms et spécialités des artistes.
3. Photos des réalisations, avec autorisation de publication.
4. Le canal réel par lequel les demandes de rendez-vous RP seront transmises.

La future gestion des clients et des demandes demandera un système distinct de connexion, de stockage et de réception. Elle n'est pas implémentée dans cette version.
