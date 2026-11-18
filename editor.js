const REPOSITORY = 'Dojojo1/Bloodline-Tatto';
if (location.protocol === 'file:') location.replace('https://dojojo1.github.io/Bloodline-Tatto/editor.html');
const DRAFT_KEY = 'bloodline-visual-draft-v1';
const DEVICE_WIDTHS = { desktop: 1100, tablet: 768, mobile: 390 };
const SECTIONS = [
  ['accueil', 'Accueil'], ['styles', 'Nos styles'], ['salon', 'Le salon'],
  ['artistes', 'Nos artistes'], ['realisations', 'Réalisations'], ['sur-mesure', 'Sur-mesure']
];
const frame = document.querySelector('#preview');
const stage = document.querySelector('#preview-stage');
const paper = document.querySelector('#preview-paper');
const statusLine = document.querySelector('#editor-status');
const fields = document.querySelector('#inspector-fields');
const selectedName = document.querySelector('#selected-name');
const tokenInput = document.querySelector('#github-token');
let settings = { version: 1, desktop: {}, tablet: {}, mobile: {} };
let baseRevision = 0;
let mode = 'desktop';
let previewWidth = DEVICE_WIDTHS.desktop;
let selected = null;
let outline = null;
let token = '';
let connectedUser = '';

function normalizeSettings() {
  for (const device of ['desktop', 'tablet', 'mobile']) {
    settings[device] ||= {};
    for (const [id, values] of Object.entries(settings[device])) {
      if (id.endsWith('/div:5') && id.startsWith('sur-mesure/')) delete values.height;
      if (!Object.keys(values).length) delete settings[device][id];
    }
  }
}

function status(message, error = false) {
  statusLine.textContent = message;
  statusLine.style.color = error ? '#ff9a9f' : '';
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(settings));
  document.querySelector('#restore-draft').hidden = false;
}

function itemForSelected() {
  if (!selected) return null;
  const id = selected.dataset.designId;
  return (settings[mode][id] ||= {});
}

function resizePreview() {
  const doc = frame.contentDocument;
  if (!doc) return;
  const width = previewWidth;
  const height = Math.max(800, doc.documentElement.scrollHeight);
  const scale = Math.min(1, Math.max(.25, (stage.clientWidth - 52) / width));
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.transform = `scale(${scale})`;
  paper.style.width = `${width * scale}px`;
  paper.style.height = `${height * scale}px`;
  document.querySelector('#preview-size').textContent = `${width} px · aperçu ${Math.round(scale * 100)} %`;
  positionOutline();
}

function positionOutline() {
  if (!selected || !outline || !selected.isConnected) return;
  const target = selected.matches('main > section') ? selected.querySelector(':scope > .wrap') || selected : selected;
  outline.querySelectorAll('button').forEach((button) => { button.hidden = false; });
  const rect = target.getBoundingClientRect();
  const win = frame.contentWindow;
  Object.assign(outline.style, {
    left: `${rect.left + win.scrollX}px`, top: `${rect.top + win.scrollY}px`,
    width: `${Math.max(10, rect.width)}px`, height: `${Math.max(10, rect.height)}px`
  });
}

function labelFor(element) {
  const text = element.textContent.trim().replace(/\s+/g, ' ').slice(0, 36);
  const type = element.tagName.toLowerCase();
  return text ? `${type} · ${text}` : `${type} · ${element.className || element.id || 'élément'}`;
}

function fillInspector() {
  if (!selected) return;
  const item = settings[mode][selected.dataset.designId] || {};
  const isSection = selected.matches('main > section');
  const isProjectVisual = selected.classList.contains('project-visual');
  selectedName.textContent = labelFor(selected);
  fields.hidden = false;
  fields.querySelectorAll('[data-prop]').forEach((input) => {
    const key = input.dataset.prop;
    input.disabled = !isSection && (['paddingTop', 'paddingBottom'].includes(key) || (isProjectVisual && key === 'height'));
    input.value = item[key] ?? (input.type === 'color' ? key === 'color' ? '#eee2d4' : '#110b0a' : '');
  });
  document.querySelector('#dimension-hint').textContent = isSection
    ? 'X, Y et largeur règlent le contenu. La hauteur est un minimum : le fond suit toujours les éléments et garde toute la largeur de l’écran.'
    : isProjectVisual ? 'Le cadre est carré : sa hauteur suit sa largeur.'
      : 'Valeurs en pixels. Laisse largeur ou hauteur vide pour reprendre la taille naturelle.';
  const textInput = document.querySelector('#text-value');
  const leaf = selected.children.length === 0;
  textInput.disabled = !leaf;
  textInput.value = leaf ? item.text ?? selected.textContent : '';
  document.querySelector('#text-hint').textContent = leaf ? 'Le texte change dans cet aperçu et après publication.' : 'Clique sur un texte à l’intérieur de cet élément pour le modifier.';
}

function selectElement(element) {
  if (!element?.dataset.designId) return;
  selected = element;
  fillInspector();
  positionOutline();
}

function updateValue(key, value) {
  if (selected?.classList.contains('project-visual') && key === 'height') return;
  const item = itemForSelected();
  if (!item) return;
  if (key === 'text') item.text = String(value);
  else if (value === '' || value == null) delete item[key];
  else item[key] = value;
  if (key === 'text') selected.textContent = value;
  else if (value !== '' && value != null) frame.contentWindow.BLOODLINE_DESIGN.applyOne(selected, ['x', 'y', 'fit', 'backgroundScale', 'backgroundX', 'backgroundY'].includes(key) ? item : { [key]: value });
  else {
    if (selected.matches('main > section')) {
      const content = selected.querySelector(':scope > .wrap');
      if (key === 'width' && content) content.style.width = '';
      if ((key === 'x' || key === 'y') && content) content.style.translate = `${item.x || 0}px ${item.y || 0}px`;
      if (key === 'height') selected.style.minHeight = '';
    } else {
      if (key === 'width' && selected.classList.contains('project-visual')) selected.style.removeProperty('--project-visual-width');
      else if (key === 'width' || key === 'height' || key === 'fontSize' || key === 'opacity') selected.style[key] = '';
      if (key === 'x' || key === 'y') selected.style.translate = `${item.x || 0}px ${item.y || 0}px`;
    }
    if (key === 'backgroundColor' || key === 'color' || key === 'image') selected.style[key === 'image' ? 'backgroundImage' : key] = '';
    if (key === 'fit' || key === 'backgroundScale') selected.style.backgroundSize = '';
    if (key === 'backgroundX' || key === 'backgroundY') selected.style.backgroundPosition = `${item.backgroundX ?? 50}% ${item.backgroundY ?? 50}%`;
  }
  saveDraft();
  positionOutline();
  resizePreview();
  status('Brouillon modifié. Publie pour rendre les changements visibles sur le site.');
}

function startDrag(event, kind) {
  if (!selected) return;
  event.preventDefault();
  event.stopPropagation();
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  const rect = (selected.matches('main > section') ? selected.querySelector(':scope > .wrap') || selected : selected).getBoundingClientRect();
  const item = itemForSelected();
  const start = { x: event.clientX, y: event.clientY, offsetX: safeNumber(item.x), offsetY: safeNumber(item.y), width: rect.width, height: rect.height };
  const move = (pointer) => {
    const dx = Math.round(pointer.clientX - start.x);
    const dy = Math.round(pointer.clientY - start.y);
    if (kind === 'move') {
      updateValue('x', start.offsetX + dx);
      updateValue('y', start.offsetY + dy);
    } else {
      updateValue('width', Math.max(20, Math.round(start.width + dx)));
      if (!selected.classList.contains('project-visual')) updateValue('height', Math.max(20, Math.round(start.height + dy)));
    }
    fillInspector();
  };
  const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function installSelection() {
  const doc = frame.contentDocument;
  const runtime = frame.contentWindow.BLOODLINE_DESIGN;
  if (!doc || !runtime) return;
  runtime.assignIds(doc);
  runtime.applyAll(settings, mode, doc);
  const style = doc.createElement('style');
  style.textContent = '#bloodline-design-outline{position:absolute;z-index:2147483646;border:2px solid #f04b60;box-shadow:0 0 0 1px #090707;pointer-events:none;box-sizing:border-box}#bloodline-design-outline button{position:absolute;z-index:1;width:26px;height:26px;border:1px solid #ffe1df;background:#a52236;color:white;font:600 14px Arial;pointer-events:auto;cursor:move}#bloodline-design-outline button[hidden]{display:none!important}#bloodline-design-outline .move{top:-28px;left:-2px}#bloodline-design-outline .resize{right:-14px;bottom:-14px;cursor:nwse-resize}';
  doc.head.append(style);
  outline = doc.createElement('div');
  outline.id = 'bloodline-design-outline';
  outline.hidden = true;
  const move = doc.createElement('button');
  move.type = 'button'; move.className = 'move'; move.textContent = '↔'; move.title = 'Déplacer';
  const resize = doc.createElement('button');
  resize.type = 'button'; resize.className = 'resize'; resize.textContent = '↘'; resize.title = 'Redimensionner';
  outline.append(move, resize);
  doc.body.append(outline);
  move.addEventListener('pointerdown', (event) => startDrag(event, 'move'));
  resize.addEventListener('pointerdown', (event) => startDrag(event, 'resize'));
  doc.addEventListener('click', (event) => {
    if (event.target.closest('#bloodline-design-outline')) return;
    event.preventDefault(); event.stopPropagation();
    const target = event.target.closest('[data-design-id]');
    if (target) { selectElement(target); outline.hidden = false; }
  }, true);
  selected = null;
  fields.hidden = true;
  selectedName.textContent = 'Clique sur un élément dans l’aperçu.';
  resizePreview();
  doc.fonts.ready.then(resizePreview);
  status('Aperçu prêt. Clique sur le fond ou sur un élément pour le régler.');
}

function refreshPreview() {
  selected = null;
  frame.src = `index.html?atelier=${Date.now()}`;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}

async function github(path, options = {}) {
  const action = options.method === 'PUT' ? 'écrire' : 'lire';
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${path}`, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...options.headers }
  });
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    if (response.status === 403 && /Resource not accessible by personal access token/i.test(message.message || '')) {
      throw new Error(`la clé GitHub ne peut pas ${action} ${path}. Vérifie le propriétaire, le dépôt et « Contents : Read and write », ou utilise « Copier les réglages »`);
    }
    throw new Error(`${action} ${path} : ${message.message || `GitHub a répondu ${response.status}`}`);
  }
  return response.json();
}

async function publish() {
  if (!token) { status('Vérifie ton accès GitHub avant de publier.', true); return; }
  const button = document.querySelector('#publish');
  button.disabled = true;
  status('Publication en cours…');
  try {
    const current = await github('design-settings.json');
    const latest = current.content ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(current.content.replace(/\s/g, '')), (character) => character.charCodeAt(0)))) : { revision: 0 };
    if ((latest.revision || 0) !== baseRevision) throw new Error('une autre personne a publié depuis ton ouverture de l’atelier. Garde ton brouillon et recharge la page avant de publier');
    settings.revision = Date.now();
    const content = bytesToBase64(new TextEncoder().encode(`${JSON.stringify(settings, null, 2)}\n`));
    await github('design-settings.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Mettre à jour la mise en page (${connectedUser})`, content, sha: current.sha, branch: 'main' }) });
    localStorage.removeItem(DRAFT_KEY);
    baseRevision = settings.revision;
    document.querySelector('#restore-draft').hidden = true;
    status('Réglages envoyés. GitHub Pages prépare la version en ligne…');
    const revision = settings.revision;
    let found = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const published = await fetch(`design-settings.json?fresh=${Date.now()}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => null);
      if (published?.revision === revision) { found = true; break; }
    }
    status(found ? 'La nouvelle mise en page est en ligne. Ouvre la vitrine pour la voir.' : 'Réglages enregistrés sur GitHub. La mise en ligne prend encore du temps.');
  } catch (error) {
    status(`Publication impossible : ${error.message}. Le brouillon reste sur cet appareil.`, true);
    saveDraft();
  } finally { button.disabled = false; }
}

async function uploadImage(file) {
  if (!file) return;
  if (!token) { status('Vérifie ton accès GitHub pour ajouter une image.', true); return; }
  if (!/^image\/(png|jpeg|webp|avif)$/.test(file.type) || file.size > 4 * 1024 * 1024) { status('Choisis une image PNG, JPEG, WebP ou AVIF de moins de 4 Mo.', true); return; }
  try {
    status('Envoi de l’image…');
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' }[file.type];
    const path = `assets/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    await github(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Ajouter une image de mise en page (${connectedUser})`, content, branch: 'main' }) });
    updateValue('image', path);
    const previewUrl = URL.createObjectURL(file);
    if (selected.tagName === 'IMG') selected.src = previewUrl;
    else selected.style.backgroundImage = `url("${previewUrl}")`;
    document.querySelector('[data-prop="image"]').value = path;
    status('Image envoyée. Publie les réglages pour l’afficher sur le site.');
  } catch (error) { status(`Envoi impossible : ${error.message}`, true); }
}

document.querySelector('#section-list').replaceChildren(...SECTIONS.map(([id, label]) => {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label;
  button.addEventListener('click', () => {
    const section = frame.contentDocument?.getElementById(id);
    if (!section) return;
    const scale = paper.clientWidth / previewWidth;
    stage.scrollTop = Math.max(0, section.getBoundingClientRect().top * scale - 20);
    document.querySelectorAll('#section-list button').forEach((other) => other.classList.toggle('is-active', other === button));
    selectElement(section); outline.hidden = false;
  });
  return button;
}));

frame.addEventListener('load', installSelection);
window.addEventListener('resize', resizePreview);
document.querySelector('#refresh-preview').addEventListener('click', () => { refreshPreview(); status('Nouvelle version de la vitrine chargée dans l’aperçu.'); });
document.querySelectorAll('[data-device]').forEach((button) => button.addEventListener('click', () => {
  mode = button.dataset.device;
  previewWidth = DEVICE_WIDTHS[mode];
  document.querySelector('#preview-width').value = previewWidth;
  document.querySelectorAll('[data-device]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
  refreshPreview();
}));
document.querySelector('#preview-width').addEventListener('change', (event) => {
  previewWidth = Math.max(320, Math.min(2560, Number(event.target.value) || DEVICE_WIDTHS[mode]));
  event.target.value = previewWidth;
  mode = previewWidth <= 600 ? 'mobile' : previewWidth <= 1000 ? 'tablet' : 'desktop';
  document.querySelectorAll('[data-device]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.device === mode)));
  refreshPreview();
});
document.querySelectorAll('[data-prop]').forEach((input) => input.addEventListener('input', () => updateValue(input.dataset.prop, input.type === 'number' ? input.value === '' ? '' : Number(input.value) : input.value)));
document.querySelector('#text-value').addEventListener('input', (event) => updateValue('text', event.target.value));
document.querySelector('#reset-element').addEventListener('click', () => { if (!selected) return; delete settings[mode][selected.dataset.designId]; saveDraft(); refreshPreview(); status('Élément réinitialisé dans le brouillon.'); });
document.querySelector('#save-draft').addEventListener('click', () => { saveDraft(); status('Brouillon gardé sur cet appareil.'); });
document.querySelector('#restore-draft').addEventListener('click', () => { try { settings = JSON.parse(localStorage.getItem(DRAFT_KEY)); normalizeSettings(); baseRevision = settings.revision || 0; saveDraft(); refreshPreview(); status('Brouillon restauré.'); } catch { status('Brouillon illisible.', true); } });
document.querySelector('#publish').addEventListener('click', publish);
document.querySelector('#copy-settings').addEventListener('click', async () => {
  try {
    settings.revision = Date.now();
    saveDraft();
    await navigator.clipboard.writeText(`${JSON.stringify(settings, null, 2)}\n`);
    status('Réglages copiés. Ouvre le fichier sur GitHub, remplace son contenu par ce texte, puis clique sur « Commit changes ».');
  } catch {
    status('Copie impossible dans ce navigateur. Garde le brouillon, puis réessaie depuis la version en ligne.', true);
  }
});
document.querySelector('#upload-image').addEventListener('change', (event) => uploadImage(event.target.files[0]));
document.querySelector('#connect').addEventListener('click', async () => {
  const candidate = tokenInput.value.trim();
  if (!candidate) { status('Colle ta clé GitHub.', true); return; }
  token = candidate;
  try {
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` };
    const user = await fetch('https://api.github.com/user', { headers }).then((res) => res.ok ? res.json() : Promise.reject(new Error('Clé non reconnue')));
    const repo = await fetch(`https://api.github.com/repos/${REPOSITORY}`, { headers }).then((res) => res.ok ? res.json() : Promise.reject(new Error('Accès au dépôt refusé')));
    if (!repo.permissions?.push) throw new Error('Ce compte ne peut pas publier dans le dépôt');
    await github('design-settings.json');
    connectedUser = user.login;
    tokenInput.value = '';
    document.querySelector('#publish').disabled = false;
    status(`Accès à la lecture vérifié pour ${connectedUser}. L’écriture sera vérifiée au moment de publier.`);
  } catch (error) { token = ''; status(error.message, true); }
});

if (localStorage.getItem(DRAFT_KEY)) document.querySelector('#restore-draft').hidden = false;
fetch(`design-settings.json?fresh=${Date.now()}`, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => {
  if (data?.version === 1) { settings = data; normalizeSettings(); baseRevision = data.revision || 0; }
  refreshPreview();
}).catch(() => { refreshPreview(); });
