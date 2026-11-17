# Direction visuelle — Bloodline Tattoo

## Référence

La [maquette](./reference/maquette.png) fournie par le propriétaire est la référence de composition de l'accueil : navigation centrée, scène gothique sombre, grand logo central, titre à gauche et quatre accès illustrés en pied d'écran.

L'ordre actuel place « Nos styles » immédiatement après l'accueil. Les projets pro / entreprise sont intégrés à « Sur-mesure ». Le pied de page porte un accès « Gestion » en attente du futur panneau.

Le lien « Sur-mesure » règle seulement la position d'arrivée du défilement : le titre et le formulaire commencent environ 19 px plus bas qu'avant, sans modifier leurs dimensions ni leur disposition. Un rafraîchissement remet la page en haut de l’accueil.

## Système appliqué

- Palette : noir presque absolu, argent et bronze vieillis, rouge profond. Les fonds restent sombres, les textes principaux ivoire.
- Typographie : Cinzel pour la navigation et les contrôles ; Cormorant Garamond pour les titres ; Manrope pour les paragraphes et formulaires. Les fichiers de polices sont locaux dans `assets/fonts/`.
- Angles droits et filets fins pour rappeler les cadres gravés de la maquette.
- Animations : une courte séquence GSAP à l'entrée, et des transitions CSS discrètes sur les liens et boutons. Aucun contenu ne dépend de l'animation pour être visible.
- Responsive : la composition desktop se transforme en logo, titre et cartes empilés sur mobile, avec menu plein écran.

## Provenance des visuels

- `assets/bloodline-logo.png` : image fournie par le propriétaire ; fichier laissé intact.
- `reference/maquette.png` : image fournie par le propriétaire ; référence de travail.
- `assets/hero-art.png` : image générée avec l'outil intégré ImageGen à partir de la maquette. Elle sert de décor illustratif et ne prétend pas représenter le vrai salon.
- `assets/gateway-art.png` : planche de quatre images illustratives, générée avec l'outil intégré ImageGen à partir de la maquette pour différencier les quatre cartes.

### Prompt utilisé pour le fond

> Use case: precise-object-edit. Asset type: wide website hero background plate for Bloodline Tattoo. Input image: the supplied website mockup is the edit target and composition reference. Preserve its dark engraved gothic tattoo aesthetic and overall scene: on the left a dramatic stone sculptural tattooed male bust and red rose petals; center background dark smoke and subtle engraved ornament; on the right a richly detailed, dim tattoo studio with leather tattoo chair, framed art, red neon crown, tattooed forearm and tattoo machine in the foreground. Remove ALL existing website UI, navigation, cards, lettering, words, logos, badges, and buttons, including the central Bloodline logo. Reconstruct the natural background behind removed items. Keep the middle-left dark enough for live HTML heading and the center clear enough for the separately supplied logo. Use near-black, antique silver, oxblood red, warm brass highlights. Wide 2:1 cinematic composition, intricate photorealistic illustration. No text, no typography, no watermark, no UI.

### Prompt utilisé pour la planche des cartes

> Use case: stylized-concept. Asset type: one square 2-by-2 image sheet of four distinct editorial art panels for the four navigation cards of a Bloodline Tattoo website. Use the supplied reference website mockup for its gothic dark art direction only. Make an exact equal 2x2 grid, with four independent square compositions, no space or dividers between cells. Top left: hand-drawn tattoo concept sketches of a wolf and rose spread on aged paper with graphite pencil, overhead close view. Top right: close view of a black-gloved tattoo artist working on an arm with intricate black-and-grey tattoo, dramatic low lighting, no faces. Bottom left: luxurious dark tattoo studio lounge, tufted leather sofa, framed art, warm lamp, old wood and bronze. Bottom right: dark leather appointment book with a blank page, antique wax seal and tattoo drawing at the edge, close view. Consistent near-black, aged silver, oxblood red, antique bronze palette; intricate realistic textures and cinematic shadow, ornate but photographically believable. Every panel fills its square to the edges. No text, letters, numbers, logo, typography, UI, watermark or borders.
