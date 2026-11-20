# Direction visuelle — Bloodline Tattoo

## Référence

La [maquette](./reference/maquette.png) fournie par le propriétaire est la référence de composition de l'accueil : navigation centrée, scène gothique sombre, grand logo central, titre à gauche et quatre accès illustrés en pied d'écran.

L'ordre actuel place « Nos styles » immédiatement après l'accueil. Les projets pro / entreprise sont intégrés à « Sur-mesure ». Le pied de page ouvre l’atelier visuel de mise en page.

L’atelier présente une section à la fois dans un aperçu sélectionnable. Les sections se choisissent dans la barre supérieure ; les tailles d’écran et le mode « Agrandir l’aperçu » laissent plus de place au travail, tandis que les réglages restent dans un panneau à droite. Choisir une section sélectionne son fond ; cliquer dans l’aperçu sélectionne un élément. Chaque taille d’écran garde ses propres réglages ; la publication écrit un fichier de configuration relu par la vitrine. Les sections gardent leur largeur et leur hauteur automatiques : leurs espaces supérieur et inférieur se règlent séparément. L’illustration de « Sur-mesure » conserve sa forme carrée lorsque sa largeur change.

Les liens du menu placent les sections sous la barre de navigation fixe. « Sur-mesure » commence avec 20 px d’espace avant son libellé, sans bande vide au-dessus du fond rouge. Le formulaire compact inclut un numéro libre ; le croquis du loup est présenté dans un cadre carré par défaut. Dans l’atelier, une hauteur explicite permet de changer sa forme et les réglages de position et de zoom ciblent uniquement le dessin. Un rafraîchissement remet la page en haut de l’accueil.

« Nos artistes » commence juste sous la séparation de section, avec le titre aligné à gauche et sans lien d’action. Une ligne est affichée par profil configuré dans `site-content.js`. La hauteur du fond rouge suit automatiquement le nombre de profils ; chacun possède un emplacement photo, un nom et une phrase modifiables. Les portraits et identités restent à renseigner. Le cadre de « Sur-mesure » montre le croquis de loup et de rose tiré de la planche illustrée existante.

## Système appliqué

### Interface de gestion

La gestion suit l'identité visuelle du salon : marbre noir veiné de rouge, textes blancs, cadres métalliques légèrement dorés ornés de roses rouges et titre central. Un même décor traverse la barre latérale et le contenu ; chaque panneau utilise un cadre transparent ajusté à son rectangle et un remplissage de marbre sombre net, sans flou ni ombre. Les quatre indicateurs, les deux listes et les raccourcis composent le tableau de bord. Les repères rouges signalent l'action active. Les chiffres et listes affichent uniquement les données réelles de l'API ; les raccourcis ouvrent les fonctions existantes. Sur mobile, la navigation devient une rangée défilante, les indicateurs et les listes passent en une colonne, et le fond reste sombre pour préserver la lisibilité.

Le cadre arrondi des panneaux est un actif transparent produit à partir de la dernière référence fournie. Il épouse directement chaque panneau ; un marbre noir opaque remplit son centre, sans flou ni ombre.

Au survol ou au focus, tous les cadres à roses avancent légèrement : agrandissement de 3,5 %, déplacement de 2 px vers le haut, ombre de profondeur et faible lueur rouge sur le métal. Le mouvement et la lueur progressent sur 1,2 seconde avec une accélération douce. Lorsque la réduction des animations est demandée, l'état change sans transition et l'agrandissement est limité à 2,5 %. La maquette locale force l'animation pour permettre de la juger.

La navigation latérale suit la version « Filet continu » choisie : les icônes sont reliées par une ligne métallique et l'élément actif reçoit un halo rouge en fondu, sans rectangle autour de chaque rubrique. Le fond de la barre s'efface progressivement vers le contenu.

- Palette : noir presque absolu, blanc, rouge profond. La dorure discrète est réservée aux cadres des panneaux.
- Typographie : Cinzel pour la navigation et les contrôles ; Cormorant Garamond pour les titres ; Manrope pour les paragraphes et formulaires. Les fichiers de polices sont locaux dans `assets/fonts/`.
- Angles coupés et filets fins pour rappeler les cadres gravés de la maquette.
- Animations : une courte séquence GSAP à l'entrée, et des transitions CSS discrètes sur les liens et boutons. Aucun contenu ne dépend de l'animation pour être visible.
- Responsive : la composition desktop se transforme en logo, titre et cartes empilés sur mobile, avec menu plein écran.

## Provenance des visuels

- `assets/bloodline-silver-rose-frame.png` : cadre transparent créé avec ImageGen à partir de la capture de référence fournie par le propriétaire. Prompt : « Create a standalone transparent decorative FRAME ASSET, not a dashboard screenshot. Reference the attached Bloodline Tattoo screenshot for its exact material and ornament language: polished antique silver engraving, four deep red roses integrated at the rounded corners, fine red enamel line following all four sides, a small red diamond centered on top and bottom rails. Shape: wide rounded rectangular border, aspect ratio 2.15:1, symmetric, consistent thickness on all sides. Keep the entire center 100% transparent and empty; everything outside the border also 100% transparent. No text, icons, numbers, marble, black fill, blur, shadow, glow, cropped edges or UI. The border should be razor sharp and proportioned so it can wrap a 520x250 dashboard panel, with the rails sitting near the asset edge and all four corners fully visible. »
- `assets/bloodline-gold-rose-frame.png` : variante légèrement dorée créée avec ImageGen à partir de `assets/bloodline-silver-rose-frame.png`. Prompt : « Precise color edit of the attached transparent Bloodline Tattoo frame asset. Preserve its exact shape, dimensions, four roses, center diamonds, fine red rails, transparency inside and outside, and all ornament positions. Change ONLY the metallic silver portions to a subtle warm champagne gold / pale antique gold, retaining bright white highlights and dark engraved shadows. The metal should remain mostly light and luminous, only gently gold tinted, not yellow or bronze. Keep the roses and diamonds vivid deep red exactly as they are. No background, no fill, no added objects, no text, no glow, no blur, no crop. This is a web UI border asset. »

- `assets/bloodline-logo.png` : image fournie par le propriétaire ; fichier laissé intact.
- `assets/salon-book.png` : image du livre Bloodline Tattoo fournie par le propriétaire pour le cadre « Le salon ».
- `assets/tattoo-book-open.png` : image du livre de motifs ouvert fournie par le propriétaire pour la première carte de « Réalisations ».
- `reference/maquette.png` : image fournie par le propriétaire ; référence de travail.
- `assets/hero-art.png` : image générée avec l'outil intégré ImageGen à partir de la maquette. Elle sert de décor illustratif et ne prétend pas représenter le vrai salon.
- `assets/gateway-art.png` : planche de quatre images illustratives, générée avec l'outil intégré ImageGen à partir de la maquette pour différencier les quatre cartes.
- `assets/biker-club-sketch.webp` : nouveau croquis fictif de tatouage « club motard », généré avec ImageGen à partir de la référence de style fournie par le propriétaire. La composition montre une moto chopper, un crâne ailé et des roses sur papier vieilli ; elle ne représente pas une réalisation du salon.

### Prompt utilisé pour le fond

> Use case: precise-object-edit. Asset type: wide website hero background plate for Bloodline Tattoo. Input image: the supplied website mockup is the edit target and composition reference. Preserve its dark engraved gothic tattoo aesthetic and overall scene: on the left a dramatic stone sculptural tattooed male bust and red rose petals; center background dark smoke and subtle engraved ornament; on the right a richly detailed, dim tattoo studio with leather tattoo chair, framed art, red neon crown, tattooed forearm and tattoo machine in the foreground. Remove ALL existing website UI, navigation, cards, lettering, words, logos, badges, and buttons, including the central Bloodline logo. Reconstruct the natural background behind removed items. Keep the middle-left dark enough for live HTML heading and the center clear enough for the separately supplied logo. Use near-black, antique silver, oxblood red, warm brass highlights. Wide 2:1 cinematic composition, intricate photorealistic illustration. No text, no typography, no watermark, no UI.

### Prompt utilisé pour la planche des cartes

> Use case: stylized-concept. Asset type: one square 2-by-2 image sheet of four distinct editorial art panels for the four navigation cards of a Bloodline Tattoo website. Use the supplied reference website mockup for its gothic dark art direction only. Make an exact equal 2x2 grid, with four independent square compositions, no space or dividers between cells. Top left: hand-drawn tattoo concept sketches of a wolf and rose spread on aged paper with graphite pencil, overhead close view. Top right: close view of a black-gloved tattoo artist working on an arm with intricate black-and-grey tattoo, dramatic low lighting, no faces. Bottom left: luxurious dark tattoo studio lounge, tufted leather sofa, framed art, warm lamp, old wood and bronze. Bottom right: dark leather appointment book with a blank page, antique wax seal and tattoo drawing at the edge, close view. Consistent near-black, aged silver, oxblood red, antique bronze palette; intricate realistic textures and cinematic shadow, ornate but photographically believable. Every panel fills its square to the edges. No text, letters, numbers, logo, typography, UI, watermark or borders.


## Direction valid?e ? marbre sculpt? et LED blanche (20 novembre 2026)

Le site vitrine et la gestion partagent d?sormais un marbre noir, des veines blanches et des accents rouge Bloodline. Les illustrations tatouage, le logo, les roses et les loups du salon restent les ?l?ments de marque. Les bordures de panneaux ne portent plus d?ornements floraux ajout?s. Les petits ?l?ments utilisent un galet asym?trique ; les panneaux principaux et le formulaire emploient des angles taill?s. Une LED blanche continue, sans point anim?, associe un halo large discret, une lueur serr?e et un trait fin. Le rendu reprend le proc?d? de la roue H?ritage, dont les sources ne sont pas modifi?es.

La vitrine charge bloodline-stone.css apr?s les styles existants. management-frames.js calcule le trac? SVG selon les dimensions r?elles et suit les contenus dynamiques. Les lumi?res sont d?coratives, masqu?es aux technologies d?assistance et ne bloquent aucun clic. Les contr?les gardent leurs ?tats focus et les animations respectent la r?duction des mouvements. Les textes et donn?es de site-content.js sont conserv?s.
