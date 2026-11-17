/*
 * Données éditables du site vitrine. Le futur panneau de gestion pourra mettre
 * à jour cette structure via un service authentifié. Ce fichier fonctionne
 * aussi quand index.html est ouvert directement en file://.
 */
window.BLOODLINE_CONTENT = {
  seo: {
    title: 'Bloodline Tattoo — L’art du tatouage sur mesure',
    description: 'Découvrez Bloodline Tattoo, ses styles et ses projets de tatouage sur mesure.'
  },
  brand: {
    name: 'Bloodline',
    footerSecondLine: 'Tattoo',
    logoAlt: 'Bloodline Tattoo',
    logo: 'assets/bloodline-logo.png',
    footerTagline: 'L’art du tatouage sur-mesure'
  },
  theme: {
    black: '#090707',
    cream: '#eee2d4',
    muted: '#c1aea0',
    red: '#a50f21',
    redBright: '#d63145'
  },
  assets: {
    hero: 'assets/hero-art.png',
    cards: 'assets/gateway-art.png',
    salon: 'assets/hero-art.png',
    artists: 'assets/hero-art.png'
  },
  navigation: [
    { label: 'Accueil', target: 'accueil' },
    { label: 'Nos styles', target: 'styles' },
    { label: 'Le salon', target: 'salon' },
    { label: 'Nos artistes', target: 'artistes' },
    { label: 'Réalisations', target: 'realisations' },
    { label: 'Sur-mesure', target: 'sur-mesure' }
  ],
  hero: {
    brand: 'Bloodline Tattoo',
    heading: 'L’art du tatouage',
    emphasis: 'sur-mesure',
    leadFirst: 'Créations uniques',
    leadSecond: 'Projet personnalisé',
    leadLast: 'Particulier & professionnel',
    action: 'Démarrer mon projet',
    actionTarget: 'sur-mesure'
  },
  gateway: [
    { id: 'styles', first: 'Nos', strong: 'styles', target: 'styles', artPosition: '100% 14%' },
    { id: 'salon', first: 'Le', strong: 'salon', target: 'salon', artPosition: '0 86%' },
    { id: 'create', first: 'Création', strong: 'sur-mesure', target: 'sur-mesure', artPosition: '0 14%' },
    { id: 'rdv', first: 'Rendez-vous', strong: 'RP', target: 'sur-mesure', artPosition: '100% 86%' }
  ],
  sectionOrder: ['styles', 'salon', 'artistes', 'realisations', 'sur-mesure'],
  sections: {
    styles: {
      label: 'Nos styles',
      heading: 'Une direction,',
      emphasis: 'votre empreinte.',
      description: 'Du motif personnel à une création proposée par le tatoueur, chaque projet peut prendre une forme différente. Le style final se discute pendant le rendez-vous RP.',
      items: [
        { title: 'Votre motif', description: 'Partez d’un dessin ou d’une idée que vous apportez.', image: 'assets/gateway-art.png', artPosition: '0 14%' },
        { title: 'Création unique', description: 'Laissez le tatoueur vous proposer une pièce originale.', image: 'assets/gateway-art.png', artPosition: '100% 14%' },
        { title: 'À imaginer ensemble', description: 'Affinez le motif, l’emplacement et la taille en RP.', image: 'assets/gateway-art.png', artPosition: '100% 86%' }
      ]
    },
    salon: {
      label: 'Le salon',
      heading: 'Un univers à part,',
      emphasis: 'une idée à vous.',
      lineBreak: true,
      description: 'Bloodline Tattoo donne une place centrale à votre projet. Explorez l’univers du salon, puis racontez ce que vous imaginez : le motif, son emplacement et les détails qui comptent pour vous.',
      action: 'Préparer mon projet',
      actionTarget: 'sur-mesure',
      imageAlt: 'Illustration de l’ambiance du salon Bloodline Tattoo'
    },
    artistes: {
      label: 'Nos artistes',
      heading: 'Une rencontre avant',
      emphasis: 'la première ligne.',
      description: 'Chaque projet commence par un échange. Les portraits et spécialités de l’équipe seront présentés ici dès que ces contenus seront disponibles.',
      action: 'Décrire mon idée',
      actionTarget: 'sur-mesure',
      imageAlt: 'Illustration de l’univers graphique Bloodline Tattoo',
      profiles: []
    },
    realisations: {
      label: 'Réalisations',
      heading: 'Des projets qui portent',
      emphasis: 'une histoire.',
      description: 'Cette section accueillera les photographies des tatouages réalisés au salon. Les visuels ci-dessous présentent uniquement la direction artistique du site.',
      galleryLabel: 'Aperçu de la direction artistique',
      gallery: [
        { label: 'Univers Bloodline', image: 'assets/hero-art.png', position: '4% 42%' },
        { label: 'Le salon', image: 'assets/hero-art.png', position: '83% 50%' },
        { label: 'L’encre et le geste', image: 'assets/hero-art.png', position: '100% 70%' }
      ]
    },
    'sur-mesure': {
      label: 'Sur-mesure · Pro / entreprise',
      heading: 'Votre tatouage,',
      emphasis: 'votre choix.',
      paragraphs: [
        'Pour un projet personnel, de groupe ou d’entreprise, vous pouvez choisir la taille, l’emplacement et le motif. Apportez votre propre idée de tatouage ou laissez le tatoueur vous proposer une création unique.',
        'Le parcours sur mesure est le même pour les particuliers et les professionnels. Les détails et les possibilités se discutent avec le tatoueur pendant le rendez-vous RP.'
      ]
    }
  },
  form: {
    intro: 'Préparez votre demande de rendez-vous RP. Le projet sera discuté avec le tatoueur pendant ce rendez-vous.',
    labels: {
      rpName: 'Votre nom RP',
      projectType: 'Type de projet',
      participants: 'Nombre de personnes',
      creation: 'Quel type de création souhaitez-vous ?',
      idea: 'Motif ou idée de départ',
      placement: 'Emplacement',
      size: 'Taille approximative',
      availability: 'Vos disponibilités RP'
    },
    placeholders: {
      rpName: 'Votre nom en RP',
      participants: 'Ex. 3',
      idea: 'Décrivez votre idée si vous en avez une ; sinon, vous en parlerez en RP.',
      placement: 'Ex. avant-bras',
      size: 'Ex. 10 × 15 cm',
      availability: 'Ex. vendredi soir, après 20 h'
    },
    projectTypes: [
      { value: '', label: 'Choisir une option' },
      { value: 'Projet personnel', label: 'Projet personnel' },
      { value: 'Projet de groupe', label: 'Projet de groupe', needsParticipantCount: true }
    ],
    creations: [
      { value: '', label: 'Choisir une option' },
      { value: 'Mon propre tatouage / motif', label: 'Mon propre tatouage ou motif' },
      { value: 'Création unique proposée par le tatoueur', label: 'Une création unique proposée par le tatoueur' },
      { value: 'À décider avec le tatoueur en RP', label: 'À décider avec le tatoueur en RP' }
    ],
    action: 'Copier ma demande de rendez-vous',
    idle: 'La demande est préparée sur votre appareil : aucun rendez-vous n’est réservé ni confirmé ici.',
    success: 'Demande copiée. Vous pourrez la partager avec le salon ; le rendez-vous sera confirmé en RP.',
    copyError: 'La copie automatique est indisponible. Sélectionnez et copiez votre texte ci-dessous.',
    summaryTitle: 'Demande de rendez-vous RP — Bloodline Tattoo',
    summaryLabels: {
      rpName: 'Nom RP',
      projectType: 'Type',
      participants: 'Nombre de personnes',
      creation: 'Création souhaitée',
      idea: 'Motif ou idée',
      placement: 'Emplacement',
      size: 'Taille',
      availability: 'Disponibilités RP'
    },
    undefinedIdea: 'À discuter avec le tatoueur en RP',
    undefinedDetail: 'À discuter en RP',
    undefinedAvailability: 'À convenir',
    summaryNote: 'Les détails du tatouage seront discutés pendant le rendez-vous RP.'
  },
  footer: {
    backToTop: 'Retour en haut ↑',
    contactLinks: []
  },
  management: {
    button: 'Gestion',
    message: 'Le panneau de gestion sera disponible prochainement.'
  }
};
