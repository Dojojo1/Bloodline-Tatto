# Livre interactif Bloodline — fonctionnement et mise en ligne

## Choix technique

Le site est statique, en HTML/CSS/JavaScript. `page-flip@2.0.7` est conservé ; `react-pageflip` est retiré des dépendances et du fichier de verrouillage. Le bundle navigateur et sa licence MIT sont copiés dans `assets/vendor/`, pour fonctionner sans CDN et sans compilation sur l’hébergement actuel.

Documentation primaire : https://github.com/Nodlik/StPageFlip

## Intégration

Le livre est dans **Nos styles**, en ouvrant `index.html#styles`. La version validée est raccordée à l’onglet **Livre de croquis** de Gestion. Les anciennes cartes et leurs textes restent conservés et masqués. Les autres sections et le formulaire restent inchangés.

- `tattoo-book.js` : couvertures, gardes, feuilles publiées et contrôles. Le nombre de feuilles suit le catalogue ; une face vierge complète automatiquement une feuille si le nombre de pages est impair.
- `tattoo-book.css` : styles limités à `#styles`, papier, cuir, épaisseur, reliure et contrôles.
- Double page au-delà de 700 px disponibles pour le livre ; page unique en dessous.
- Navigation au clic, glissement souris/tactile, boutons et flèches du clavier lorsque le livre a le focus.
- À la demande explicite du propriétaire, le prototype conserve le feuilletage manuel complet, même dans son navigateur signalant une réduction des mouvements. Les effets automatiques de coin et la translation du livre respectent cette préférence.
- Chaque dessin appartient à sa feuille ; aucun transform, transition ou animation n’est appliqué à l’image indépendamment de la page.
- La courbure est simulée par le moteur PageFlip (découpe et mouvement des feuilles avec ombres dynamiques), sans modèle de papier physique en maillage 3D.

Les illustrations existantes sont conservées comme premières planches du catalogue. Les originaux, dont `assets/bloodline-logo.png`, ne sont pas altérés. L’équipe peut les remplacer ou ajouter ses vrais croquis depuis Gestion.

## Composer et publier

1. Se connecter à Gestion avec un rôle disposant du droit **Contenu**, puis ouvrir **Livre de croquis**.
2. Ajouter ou dupliquer une page, changer son titre, la monter ou la descendre dans le livre.
3. Importer des PNG, JPEG ou WebP (5 Mo maximum par image). Chaque croquis possède sa propre zone déplaçable à la souris ou au doigt ; les flèches déplacent de 0,5 %, Maj + flèche de 5 %. Les champs de position et de dimensions permettent un placement précis. Les boutons de colonnes alignent les dessins sans en retirer.
4. **Enregistrer le brouillon** conserve le travail sur le serveur, sans modifier le livre visible. **Publier le livre** enregistre si nécessaire puis rend ce brouillon visible dans Nos styles. Les autres sessions sont protégées par un numéro de révision et reçoivent un conflit si leur copie est ancienne.

`book-layout.js` et `book-layout.css` partagent le placement entre l’éditeur et les feuilles du livre. Les dessins restent fixes sur leur page pendant le feuilletage. Le serveur expose un instantané public distinct du brouillon authentifié. Les médias importés sont validés puis normalisés en WebP ; ils sont stockés dans SQLite et inclus dans les sauvegardes existantes. Une image de brouillon n’est accessible publiquement que lorsqu’elle est référencée par le livre publié. Aucun jeton GitHub n’est demandé dans Gestion.

Le catalogue par défaut de `book-default.json` reprend les quatre planches du prototype ; il initialise une nouvelle base sans écraser un catalogue déjà enregistré. Si l’API ne répond pas, la vitrine conserve le livre illustré de secours. Limites par livre : 500 pages ; par page : 32 croquis.

Vérifications de raccordement : 18 tests API (y compris les 12 tests de gestion existants), parcours navigateur avec import/déplacement clavier et souris/sauvegarde/publication/rechargement, correspondance exacte des coordonnées éditées et publiées, ajout d’une cinquième page et fermeture correcte de la dernière couverture, format mobile sans débordement. Les essais de contenu ont été réalisés dans une base isolée.

## Couverture et matières

Trois nouvelles images ont été créées avec l’outil de génération d’images intégré, puis enregistrées dans le projet :

- `assets/bloodline-book-cover.png` : couverture de face en cuir noir/bordeaux, emblème Bloodline interprété en relief et coins métalliques patinés, à partir du logo fourni.
- `assets/bloodline-book-back.png` : dos assorti généré à partir de la couverture, même cuir et patine, sans emblème, charnière à droite. Les gardes rigides intérieures reprennent ce cuir et conservent les textes du prototype.
- `assets/book-leather.png` : matière de cuir ancien sans texte.
- `assets/book-paper.png` : papier vieilli vierge sans dessin.

Prompts de génération :

**Couverture** — Create the front cover artwork for an antique Bloodline Tattoo sketchbook using the supplied official logo as the central design. Portrait 3:4, flat straight-on orthographic view, full bleed, no surrounding scene. Heavy antique black leather with oxblood undertones, grain and wear, thick beveled edges, raised left spine channel, blind-tooled inset border, aged silver corner protectors. Large central wolf, tattoo machine, red rose, motorcycle, Bloodline/Tattoo lettering, skull and flourishes from the reference. Embossed aged silver and blood red accents. No extra wording, no gold glam, no tilted perspective.

**Cuir** — Flat full-bleed square material photograph of dark oxblood almost black antique leather, fine natural grain, abraded high spots, small creases, even diffuse light. No book object, border, writing, design or emblem.

**Papier** — Flat full-bleed blank old ivory ochre rag paper. Fine fibers, light warm beige center, soft mottling, subtle foxing and sepia edge wear. Even lighting, no drawing, text, border, book object or center fold.

**Dos** — Edit the supplied front cover into the matching back cover of the same book. Preserve exact flat 3:4 rectangle, black oxblood leather grain, patina, exposure, blind-tooled border and silver corners. Remove central logo and fill naturally with matching leather. Spine ridge on the right, corner protectors on the left. No new text, no scene, no page block, no perspective.

## Bords et souplesse des couvertures

Le fin rectangle sombre de l’image est recadré de 2 px sur les faces extérieures et intérieures, sans modifier les fichiers source, les dimensions du livre ou ses charnières. Les bordures CSS des gardes intérieures sont supprimées et leurs coins suivent ceux du cuir.

Chaque face de couverture est rendue en seize bandes jointives. L’ancienne arche automatique est remplacée par une surface articulée de longueur constante : le bord saisi entraîne la couverture, et les segments proches de la reliure suivent avec une réponse amortie de 90 ms. La courbure reste plus limitée que celle des feuilles (22° de différence au maximum entre reliure et bord libre). Une faible courbure de prise subsiste pendant le maintien ; elle dépend de l’angle réel de la couverture, sans inversion arbitraire entre ouverture et fermeture. Le retour du geste réduit progressivement la flexion. Un clic maintenu sans déplacement laisse la couverture plate, puis les boutons et le relâchement utilisent le même suivi continu jusqu’au repos. La boucle de suivi fonctionne aussi entre deux événements pointeur. Le recto, le verso et les tranches partagent les mêmes points articulés ; les feuilles et leurs dessins conservent leur animation existante.

Contrôles à 1440 et 390 px : prise sans déplacement (courbure nulle), déplacement, maintien, changement de sens et relâchement sur les deux couvertures. Les rotations avant/arrière sont symétriques et sans débordement horizontal.

Les corrections fondées sur le masquage des anciennes peaux séparées n’ont pas suffi. Leur assemblage est remplacé par seize petits volumes fermés : chacun possède un recto, un verso et quatre tranches, tous liés à une seule transformation. Le parent 3D n’est plus aplati par un découpage CSS ; le navigateur gère les faces arrière et leur profondeur. Un léger recouvrement de 0,65 px scelle les jonctions. Les textures, textes, dimensions, épaisseur et logique de suivi du geste sont conservés.

Contrôle de continuité par lecture des pixels : le livre seul est rendu devant un fond magenta, puis une ligne de pixels est vérifiée au milieu de la couverture pour détecter une éventuelle transparence intérieure. 32 positions contrôlées à 1440 et 390 px, avant et arrière, sans fente détectée. Confirmation dans Chrome via Playwright MCP sur 12 positions, puis ouverture/fermeture des deux couvertures avec les boutons. La vérification du rendu et la navigation sont effectuées séparément des outils de diagnostic de code.

### Étanchéité des jointures de couverture

Les volumes fermés empêchaient les grandes fentes, mais leurs arêtes lissées par le navigateur laissaient encore certains pixels partiellement transparents. Une doublure opaque en cuir est maintenant dessinée dans un canvas sous les textures de chaque couverture. Elle utilise la même projection et les mêmes points articulés, remplit l’union des volumes en un seul tracé et recouvre légèrement leur frange d’anticrénelage. Elle n’est affichée que pendant la flexion ; le volume unique au repos et le rendu PageFlip des feuilles restent inchangés.

Vérification : comparaison du rendu devant des fonds noir et blanc sur 24 positions (avant/arrière, 1440 px et mobile 390 px avec densité de pixels 2), contrôle visuel du passage de profil dans Chrome, puis ouverture/fermeture des deux couvertures et aller-retour de feuilles dans Playwright MCP aux deux largeurs. Le fond ne forme plus de fines lignes visibles au travers de la texture sur les captures contrôlées. Une frange d’anticrénelage reste normale sur la silhouette extérieure. Doublures et bandes articulées masquées au repos, aucun débordement horizontal.

### Fluidité des feuilles après l’ajout de l’épaisseur

Les couvertures articulées restaient composées de leurs seize volumes même immobiles. Mesure du compositeur Chromium sur une double page intérieure : 236 calques, dont 196 portant du contenu. Au repos, chaque couverture utilise désormais un unique volume fermé avec les mêmes faces et les mêmes textures ; les seize volumes souples ne s’affichent que pendant sa propre flexion. Le nombre de calques descend à 26, dont 16 portant du contenu. Les feuilles gardent leurs géométries PageFlip, leurs dessins, leurs durées et leurs ombres existantes.

Contrôle : aucun volume de couverture articulé affiché pendant une prise de feuille ; densité `soft` conservée pour les faces 2 à 5 ; glissement souris puis relâchement de la double page 3 vers 5 dans Chrome, retour avec les boutons ; swipe tactile de la page 3 vers 4 et retour sur mobile. Les couvertures reprennent leur rendu articulé uniquement lors de leur rotation.

Les deux couvertures ont une épaisseur géométrique de 8 px : faces espacées de part et d’autre du plan central et quatre tranches qui les relient. La matière des tranches est prélevée directement dans l’image de la couverture correspondante, avec ses détails et sa patine, plutôt que recouverte d’un dégradé brun. Les tranches supérieure et inférieure suivent les seize bandes de flexion. La tranche reste visible lorsque la couverture passe à 90°, à l’avant comme à l’arrière. Contrôle des deux rotations à 1440 et 390 px, sans débordement horizontal.

Vérification Playwright sur PC et mobile : ouverture et fermeture avant, légèreté de la courbure en cours de rotation, bord intérieur sans bordure, absence de débordement horizontal. Le navigateur partagé vérifie aussi la fermeture et la réouverture arrière. Aucun diagnostic JavaScript/CSS.

## Vérifications effectuées

### Couvertures isolées du moteur des feuilles

Les défauts de superposition persistant avec les couvertures natives ont conduit à séparer les responsabilités : une planche DOM rigide, composée de deux faces dos à dos, anime désormais chaque couverture autour de sa charnière. Le moteur PageFlip conserve le rendu et la courbure des feuilles souples. Pendant l’ouverture ou la fermeture, il affiche seulement la double page intérieure statique ; sa garde correspondante est masquée pour éviter une seconde copie sous la planche en rotation. Le recto, le verso et le recentrage sont animés par la même progression. À l’arrêt, la planche et la garde reprennent la même position. Les images et textes originaux de chaque garde sont conservés.

Le grand support en cuir est désactivé : il ne doit jamais remplir l’espace découvert derrière une couverture. Le glissement d’une couverture est géré par Pointer Events, avec retour progressif si le geste est abandonné. Les événements souris/tactiles de PageFlip sont empêchés pendant ces transitions pour éviter de lancer deux animations en parallèle. Le scroll vertical reste disponible grâce à `touch-action: pan-y`.

Les deux planches persistent maintenant une fois ouvertes, sous les feuilles. Il n’y a plus de remplacement par une garde fixe à la fin de l’animation : les faces PageFlip 1 et 6 restent toujours masquées. Le recto et le verso de chaque planche sont explicitement masqués selon leur orientation pour éviter un flash du verso au premier rendu GPU. En portrait, l’ouverture avant arrive directement à la première feuille de dessin (face 2), la garde avant appartenant au côté gauche hors champ ; son contenu reste conservé sur la couverture intérieure et en double page sur PC. Le bouton précédent depuis cette première feuille referme le livre.

Correction du masquage des gardes : les faces PageFlip 1 et 6 restent masquées au repos et pendant une rotation de couverture. Elles sont toutefois rendues **avec la découpe calculée par PageFlip** pendant le feuilletage d’une feuille souple (`flipping` ou `user_fold`, sans `data-cover-active`). Sans cette surface de destination, l’ancienne feuille restait visible sous la partie découverte jusqu’au nettoyage final. Les faces des planches persistantes portent maintenant le même ombrage gauche/droite que ces surfaces découpées.

Cette exception exclut les gardes statiques `.--simple`. Réafficher une garde statique au premier mouvement de souris superposait une autre couche d’ombres à sa planche persistante et donnait une impression de tremblement. Vérification : sept petits mouvements de 8 à 14 px en gardant la souris enfoncée, position du livre inchangée et garde statique toujours masquée ; la garde de destination reste bien visible avec son découpage pendant un retour de page.

Contrôle anti-flash : plus de 600 échantillons par largeur (1440 et 390 px) pendant les quatre mouvements de couverture, sans garde fixe visible pendant les rotations. Vérification des captures au début et à la fin, avec deux planches conservées dans le DOM et sans débordement horizontal.

Vérifié aux largeurs 1440 px et 390 px : ouvrir/fermer l’avant, fermer/rouvrir l’arrière, glissement de la couverture à la souris et au toucher, retour au même centre après fermeture, feuilletage des pages après ouverture, aucun débordement horizontal, support caché. Playwright MCP vérifie aussi les boutons et les états finaux du navigateur partagé.

### Ajustement du mouvement

Le point d’entrée public `getRender().startAnimation` est adapté dans `tattoo-book.js` sans modifier le bundle de la bibliothèque. Les boutons utilisent une durée de 1,6 s avec accélération et ralentissement ; le relâchement utilise au moins 650 ms et décélère jusqu’à sa position finale. Les clics supplémentaires ne terminent plus de force l’animation. Le dernier état géométrique et le callback de PageFlip sont exécutés à la fin.

La reliure fixe au-dessus des feuilles est retirée : seules leurs ombres propres dessinent le pli. La tranche rayée occupe uniquement les six pixels du bord inférieur. Le recentrage est calculé dans les mêmes frames et avec le même easing que la rotation : aucune transition CSS séparée ne peut le désynchroniser ou le supprimer. Le décalage `left/top` manquant dans le mode de dessin rigide de PageFlip 2.0.7 est restauré dans l’adaptateur `draw`, pour les couvertures **et** les feuilles souples dessinées temporairement en rigide. Une correction CSS fondée sur la classe permanente de la feuille était insuffisante. Les angles résiduels inférieurs à 0,3° sont alignés sur leur état final pour éviter le redressement au passage au mode statique. Le support apparaît progressivement à la fin du geste. L’initialisation attend les polices pour éviter une variation de la hauteur du titre pendant la première ouverture.

Contrôle de continuité : comparaison du rectangle de chaque face encore visible à la dernière image animée et après son retour à l’état statique. Ouverture/fermeture des deux couvertures : écart final nul aux largeurs 1440 px et 390 px. Feuilletage souple : écart au plus 1 px à 1440 px. Captures intermédiaires et vérification des états `flipping` puis `read`, sans débordement horizontal.

Playwright (outils navigateur et tests locaux avec Edge) : couverture, ouverture, quatre changements de double page jusqu’à la fin, retour au début, états désactivés aux limites, glissement tactile et navigation au clavier, format portrait mobile, redimensionnement PC/mobile, largeur 320 px sans débordement, réduction des mouvements, passage à Sur-mesure et retour au livre. Les illustrations sont chargées et sans transformation indépendante. Contrôle visuel PC/mobile, diagnostics éditeur, `node --check`, `git diff --check` et détecteur Impeccable sans constat sur les nouveaux styles/scripts.
