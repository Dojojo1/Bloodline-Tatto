const siteContent = window.BLOODLINE_CONTENT;

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && typeof value === 'string') element.textContent = value;
}

function setLeadingText(selector, value) {
  const element = document.querySelector(selector);
  if (!element || typeof value !== 'string') return;
  const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = `${value} `;
}

function setHeading(selector, section) {
  const element = document.querySelector(selector);
  if (!element || !section) return;
  const emphasis = document.createElement('em');
  emphasis.textContent = section.emphasis;
  element.replaceChildren(document.createTextNode(section.heading), section.lineBreak ? document.createElement('br') : document.createTextNode(' '), emphasis);
}

function assetUrl(path) {
  return typeof path === 'string' && /^assets\/(?!.*\.\.)[\w./-]+\.(?:png|jpe?g|webp|avif)$/i.test(path) ? `url("${path}")` : null;
}

function setAssetVariable(name, path) {
  const url = assetUrl(path);
  if (url) document.documentElement.style.setProperty(name, url);
}

function setAction(selector, label, target) {
  const element = document.querySelector(selector);
  if (!element) return;
  setLeadingText(selector, label);
  if (target && document.getElementById(target)) element.href = `#${target}`;
}

function replaceOptions(selector, choices) {
  const select = document.querySelector(selector);
  if (!select || !Array.isArray(choices)) return;
  select.replaceChildren(...choices.map((choice) => {
    const option = new Option(choice.label, choice.value);
    if (choice.needsParticipantCount) option.dataset.needsParticipantCount = 'true';
    return option;
  }));
}

function applySiteContent(content) {
  if (!content) return;

  document.title = content.seo.title;
  document.querySelector('meta[name="description"]').content = content.seo.description;
  setText('.mobile-brand', content.brand.name);
  setText('.hero-brand', content.hero.brand);
  setLeadingText('.footer-name', content.brand.name);
  setText('.footer-name span', content.brand.footerSecondLine);
  setText('.footer-content > p', content.brand.footerTagline);
  setText('.back-to-top', content.footer.backToTop);
  setText('#management-button', content.management.button);
  setText('#management-status', content.management.message);

  const logo = document.querySelector('.hero-logo');
  if (assetUrl(content.brand.logo)) logo.src = content.brand.logo;
  logo.alt = content.brand.logoAlt;
  Object.entries({ black: '--black', cream: '--cream', muted: '--muted', red: '--red', redBright: '--red-bright' }).forEach(([key, cssName]) => {
    if (/^#[0-9a-f]{6}$/i.test(content.theme[key])) document.documentElement.style.setProperty(cssName, content.theme[key]);
  });
  setAssetVariable('--hero-art', content.assets.hero);
  setAssetVariable('--gateway-art', content.assets.cards);
  setAssetVariable('--salon-art', content.assets.salon);
  setAssetVariable('--artists-art', content.assets.artists);

  const navigation = document.querySelector('.primary-nav');
  navigation.replaceChildren(...content.navigation.filter((item) => document.getElementById(item.target)).map((item, index) => {
    const anchor = document.createElement('a');
    anchor.href = `#${item.target}`;
    anchor.textContent = item.label;
    if (index === 0) anchor.classList.add('is-current');
    return anchor;
  }));

  setHeading('#hero-title', content.hero);
  const lead = document.querySelector('.hero-lead');
  const separator = document.createElement('span');
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '·';
  lead.replaceChildren(document.createTextNode(`${content.hero.leadFirst} `), separator, document.createTextNode(` ${content.hero.leadSecond}`), document.createElement('br'), document.createTextNode(content.hero.leadLast));
  setAction('.button-hero', content.hero.action, content.hero.actionTarget);

  const gateway = document.querySelector('.gateway');
  gateway.replaceChildren(...content.gateway.filter((card) => document.getElementById(card.target)).map((card) => {
    const anchor = document.createElement('a');
    anchor.href = `#${card.target}`;
    anchor.className = 'gateway-card';
    if (/^[a-z-]+$/.test(card.id)) anchor.classList.add(`gateway-${card.id}`);
    anchor.style.backgroundPosition = `center, ${card.artPosition}`;
    const title = document.createElement('span');
    title.className = 'gateway-title';
    const strong = document.createElement('strong');
    strong.textContent = card.strong;
    title.append(document.createTextNode(card.first), document.createElement('br'), strong);
    const rule = document.createElement('span');
    rule.className = 'gateway-rule';
    rule.setAttribute('aria-hidden', 'true');
    rule.textContent = '✦';
    anchor.append(title, rule);
    return anchor;
  }));

  const main = document.querySelector('main');
  const ordered = new Set(content.sectionOrder);
  [...main.querySelectorAll(':scope > section:not(.hero)')].forEach((section) => { section.hidden = !ordered.has(section.id); });
  content.sectionOrder.forEach((id) => {
    const section = document.getElementById(id);
    if (section && section.parentElement === main) main.append(section);
  });

  const styles = content.sections.styles;
  setText('#styles .section-label', styles.label);
  setHeading('#styles-title', styles);
  setText('.styles-heading > p:not(.section-label)', styles.description);
  document.querySelector('.styles-grid').replaceChildren(...styles.items.map((item) => {
    const article = document.createElement('article');
    article.className = 'style-panel';
    const art = document.createElement('div');
    art.className = 'style-panel-art';
    art.setAttribute('aria-hidden', 'true');
    const url = assetUrl(item.image);
    if (url) art.style.backgroundImage = `linear-gradient(0deg, rgba(6,3,3,.34), transparent 40%), ${url}`;
    art.style.backgroundPosition = `center, ${item.artPosition}`;
    const heading = document.createElement('h3');
    heading.textContent = item.title;
    const description = document.createElement('p');
    description.textContent = item.description;
    article.append(art, heading, description);
    return article;
  }));

  for (const [id, section] of Object.entries(content.sections)) {
    if (id === 'styles') continue;
    const root = document.getElementById(id);
    if (!root) continue;
    setText(`#${id} .section-label`, section.label);
    setHeading(`#${id} h2`, section);
    if (id === 'sur-mesure') {
      const paragraphs = root.querySelectorAll('.section-copy > p:not(.section-label)');
      section.paragraphs.forEach((paragraph, index) => { if (paragraphs[index]) paragraphs[index].textContent = paragraph; });
    } else {
      setText(`#${id} .section-copy > p:not(.section-label), #${id} .work-heading > p:not(.section-label)`, section.description);
      setAction(`#${id} .text-link`, section.action, section.actionTarget);
      if (section.imageAlt) root.querySelector('.section-visual').setAttribute('aria-label', section.imageAlt);
    }
  }

  const artistProfiles = content.sections.artistes.profiles || [];
  const artistList = document.querySelector('#artists-list');
  artistList.hidden = artistProfiles.length === 0;
  artistList.replaceChildren(...artistProfiles.map((profile) => {
    const article = document.createElement('article');
    article.className = 'artist-profile';
    if (assetUrl(profile.image)) {
      const portrait = document.createElement('img');
      portrait.src = profile.image;
      portrait.alt = profile.imageAlt || `Portrait de ${profile.name}`;
      portrait.loading = 'lazy';
      article.append(portrait);
    }
    const name = document.createElement('h3');
    name.textContent = profile.name;
    const description = document.createElement('p');
    description.textContent = profile.description;
    article.append(name, description);
    return article;
  }));

  const work = content.sections.realisations;
  const gallery = document.querySelector('.work-gallery');
  gallery.setAttribute('aria-label', work.galleryLabel);
  gallery.replaceChildren(...work.gallery.map((item, index) => {
    const frame = document.createElement('div');
    frame.className = `work-image work-image-${['one', 'two', 'three'][index] || 'extra'}`;
    const url = assetUrl(item.image);
    if (url) frame.style.backgroundImage = `linear-gradient(0deg, rgba(0,0,0,.85), transparent 45%), ${url}`;
    frame.style.backgroundPosition = `center, ${item.position}`;
    const label = document.createElement('span');
    label.textContent = item.label;
    frame.append(label);
    return frame;
  }));

  const form = content.form;
  setText('.form-intro', form.intro);
  const fieldIds = { rpName: 'rp-name', projectType: 'project-type', participants: 'group-size', creation: 'tattoo-choice', idea: 'project-idea', placement: 'project-placement', size: 'project-size', availability: 'rp-availability' };
  Object.entries(fieldIds).forEach(([key, id]) => {
    setLeadingText(`label[for="${id}"]`, form.labels[key]);
    const field = document.getElementById(id);
    if (field && form.placeholders[key]) field.placeholder = form.placeholders[key];
  });
  replaceOptions('#project-type', form.projectTypes);
  replaceOptions('#tattoo-choice', form.creations);
  setLeadingText('.form-button', form.action);
  setText('#form-status', form.idle);

  const footerContacts = document.querySelector('#footer-contacts');
  const contactLinks = (content.footer.contactLinks || []).filter((link) => /^(https:\/\/|mailto:)/i.test(link.href));
  footerContacts.hidden = contactLinks.length === 0;
  footerContacts.replaceChildren(...contactLinks.map((link) => {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    if (link.href.startsWith('https://')) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    return anchor;
  }));
}

applySiteContent(siteContent);

// The configurable section order is applied after the browser first sees the
// fragment. Align direct links again once images and fonts have settled.
window.addEventListener('load', () => {
  if (!window.location.hash) return;
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(id);
  if (target) window.requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
});

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-nav');
const navLinks = [...navigation.querySelectorAll('a')];
const backgroundWhileMenuOpen = [document.querySelector('.skip-link'), document.querySelector('.mobile-brand'), document.querySelector('main'), document.querySelector('footer')];

function closeMenu() {
  navigation.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Ouvrir le menu');
  document.body.classList.remove('menu-open');
  backgroundWhileMenuOpen.forEach((element) => { element.inert = false; });
}

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  if (isOpen) {
    closeMenu();
  } else {
    navigation.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Fermer le menu');
    document.body.classList.add('menu-open');
    backgroundWhileMenuOpen.forEach((element) => { element.inert = true; });
    window.setTimeout(() => {
      if (navigation.classList.contains('is-open')) navLinks[0].focus();
    }, 240);
  }
});

navLinks.forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
    closeMenu();
    menuToggle.focus();
  }
  if (event.key === 'Tab' && navigation.classList.contains('is-open')) {
    const focusables = [menuToggle, ...navLinks];
    const current = focusables.indexOf(document.activeElement);
    if (current === -1) {
      event.preventDefault();
      navLinks[0].focus();
    } else if (event.shiftKey && current === 0) {
      event.preventDefault();
      navLinks.at(-1).focus();
    } else if (!event.shiftKey && current === focusables.length - 1) {
      event.preventDefault();
      menuToggle.focus();
    }
  }
});

if ('IntersectionObserver' in window) {
  const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      const selected = link.getAttribute('href') === `#${visible.target.id}`;
      link.classList.toggle('is-current', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.1, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

const projectForm = document.querySelector('#project-form');
const formStatus = document.querySelector('#form-status');
const projectType = document.querySelector('#project-type');
const groupSizeField = document.querySelector('#group-size-field');
const groupSizeInput = document.querySelector('#group-size');
const formContent = siteContent?.form;
const managementButton = document.querySelector('#management-button');
const managementStatus = document.querySelector('#management-status');

managementButton.addEventListener('click', () => {
  const willShow = managementStatus.hidden;
  managementStatus.hidden = !willShow;
  managementButton.setAttribute('aria-expanded', String(willShow));
});

function needsParticipantCount() {
  return projectType.selectedOptions[0]?.dataset.needsParticipantCount === 'true' || projectType.value === 'Projet de groupe';
}

projectType.addEventListener('change', () => {
  const isGroup = needsParticipantCount();
  groupSizeField.hidden = !isGroup;
  groupSizeInput.required = isGroup;
  if (!isGroup) groupSizeInput.value = '';
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!projectForm.reportValidity()) return;

  const data = new FormData(projectForm);
  const labels = formContent?.summaryLabels || {};
  const brief = [
    formContent?.summaryTitle || 'Demande de rendez-vous RP — Bloodline Tattoo',
    `${labels.rpName || 'Nom RP'} : ${String(data.get('nom_rp')).trim()}`,
    `${labels.projectType || 'Type'} : ${data.get('type')}`,
    ...(needsParticipantCount() ? [`${labels.participants || 'Nombre de personnes'} : ${data.get('participants')}`] : []),
    `${labels.creation || 'Création souhaitée'} : ${data.get('creation')}`,
    `${labels.idea || 'Motif ou idée'} : ${String(data.get('idee')).trim() || formContent?.undefinedIdea || 'À discuter avec le tatoueur en RP'}`,
    `${labels.placement || 'Emplacement'} : ${String(data.get('emplacement')).trim() || formContent?.undefinedDetail || 'À discuter en RP'}`,
    `${labels.size || 'Taille'} : ${String(data.get('taille')).trim() || formContent?.undefinedDetail || 'À discuter en RP'}`,
    `${labels.availability || 'Disponibilités RP'} : ${String(data.get('disponibilites')).trim() || formContent?.undefinedAvailability || 'À convenir'}`,
    formContent?.summaryNote || 'Les détails du tatouage seront discutés pendant le rendez-vous RP.'
  ].join('\n');

  try {
    await navigator.clipboard.writeText(brief);
    formStatus.textContent = formContent?.success || 'Demande copiée. Vous pourrez la partager avec le salon ; le rendez-vous sera confirmé en RP.';
    formStatus.className = 'form-status is-success';
  } catch {
    formStatus.textContent = formContent?.copyError || 'La copie automatique est indisponible. Sélectionnez et copiez votre texte ci-dessous.';
    formStatus.className = 'form-status is-error';
    let fallback = projectForm.querySelector('#brief-fallback');
    if (!fallback) {
      fallback = document.createElement('textarea');
      fallback.id = 'brief-fallback';
      fallback.setAttribute('aria-label', 'Demande de rendez-vous RP à copier');
      fallback.readOnly = true;
      projectForm.append(fallback);
    }
    fallback.value = brief;
    fallback.focus();
    fallback.select();
  }
});

// One quiet entrance sequence; the page remains fully usable without GSAP.
if (window.gsap) {
  const motion = window.gsap.matchMedia();
  motion.add('(prefers-reduced-motion: no-preference)', () => {
    window.gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero-copy', { autoAlpha: 0, y: 18, duration: 0.75 })
      .from('.hero-logo', { autoAlpha: 0, y: 12, scale: 0.975, duration: 0.85 }, '-=0.48')
      .from('.gateway-card', { autoAlpha: 0, y: 13, duration: 0.55, stagger: 0.08 }, '-=0.34');
  });
}
