/* Authenticated editor for the sketchbook. No credentials or GitHub key here. */
(() => {
  const $ = selector => document.querySelector(selector);
  const layout = window.BLOODLINE_LAYOUT;
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => crypto.randomUUID();
  let request, documentData, revision, publishedRevision, current = 0, selected = '', dirty = false, busy = false;
  let history = [], future = [], dragging = null;
  const urls = new Map();
  const page = () => documentData?.pages[current];
  const item = () => page()?.items.find(i => i.id === selected);
  const message = text => { $('#book-message').textContent = text; };
  const checkpoint = () => { history.push(JSON.stringify(documentData)); if (history.length > 40) history.shift(); future = []; };
  const changed = () => { dirty = true; updateStatus(); };
  const updateStatus = () => {
    if (!documentData) {
      $('#book-state').textContent = 'Le livre n’a pas pu se charger.';
      $('#book-save').disabled = true; $('#book-publish').disabled = true;
      return;
    }
    $('#book-state').textContent = dirty ? 'Modifications non enregistrées' : revision === publishedRevision ? 'Version publiée' : 'Brouillon enregistré — non publié';
    $('#book-save').disabled = busy || !dirty;
    $('#book-publish').disabled = busy || (!dirty && revision === publishedRevision);
    $('#book-undo').disabled = busy || !history.length; $('#book-redo').disabled = busy || !future.length;
  };
  const bounds = value => {
    value.w = Math.max(2, Math.min(100, value.w)); value.h = Math.max(2, Math.min(100, value.h));
    value.x = Math.max(0, Math.min(100 - value.w, value.x)); value.y = Math.max(0, Math.min(100 - value.h, value.y));
  };
  const resolve = src => {
    if (src.startsWith('assets/')) return src;
    if (!urls.has(src)) urls.set(src, request(`/book/assets/${src}`, { binary: true }).then(blob => URL.createObjectURL(blob)));
    return urls.get(src);
  };
  function selection() {
    const value = item();
    $('#book-item-fields').disabled = !value;
    for (const el of $('#book-canvas').children) { el.classList.toggle('is-selected', el.dataset.item === selected); el.setAttribute('aria-pressed', String(el.dataset.item === selected)); }
    for (const field of ['x', 'y', 'w', 'h']) $(`#book-${field}`).value = value ? Number(value[field].toFixed(2)) : '';
    $('#book-alt').value = value?.alt || '';
    $('#book-remove-item').disabled = !value;
  }
  function render() {
    if (!documentData) return;
    current = Math.max(0, Math.min(documentData.pages.length - 1, current));
    const list = $('#book-pages'); list.replaceChildren();
    documentData.pages.forEach((value, index) => {
      const button = node('button', `${index + 1}. ${value.title || 'Page sans titre'}`); button.type = 'button';
      button.setAttribute('aria-current', index === current ? 'page' : 'false');
      button.addEventListener('click', () => { current = index; selected = ''; render(); }); list.append(button);
    });
    $('#book-page-title').value = page().title;
    $('#book-folio').textContent = `Page ${current + 1} / ${documentData.pages.length}`;
    $('#book-caption').textContent = page().title;
    $('#book-page-up').disabled = current === 0;
    $('#book-page-down').disabled = current === documentData.pages.length - 1;
    $('#book-page-delete').disabled = documentData.pages.length === 1;
    layout.render($('#book-canvas'), page(), resolve, true);
    const picks = $('#book-sketches'); picks.replaceChildren();
    page().items.forEach((value, index) => {
      const button = node('button', value.alt || `Croquis ${index + 1}`); button.type = 'button';
      button.addEventListener('click', () => { selected = value.id; selection(); $('#book-canvas').querySelector(`[data-item="${selected}"]`)?.focus(); }); picks.append(button);
    });
    selection(); updateStatus();
  }
  async function load(force = false) {
    if (documentData && !force) return;
    const data = await request('/book/draft');
    documentData = data.document; revision = data.revision; publishedRevision = data.published_revision;
    current = 0; selected = ''; dirty = false; history = []; future = []; render();
    $('#book-workbench').inert = false;
    message('Choisissez une page, puis ajoutez ou déplacez ses croquis.');
  }
  async function action(callback) {
    if (busy) return;
    busy = true; $('#book-workbench').inert = true; updateStatus();
    try { await callback(); }
    catch (error) { message(error.message || 'Le livre n’a pas été enregistré. Réessayez.'); }
    finally { busy = false; $('#book-workbench').inert = !documentData; updateStatus(); }
  }
  async function save() {
    if (!dirty) return;
    const data = await request('/book/draft', { method: 'POST', body: JSON.stringify({ document: documentData, revision }) });
    revision = data.revision; publishedRevision = data.published_revision; dirty = false;
  }
  async function upload(files) {
    await action(async () => {
      if (!files.length) return;
      if (page().items.length + files.length > 32) throw new Error('Cette page accepte 32 croquis maximum. Ajoutez une autre page.');
      checkpoint();
      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) throw new Error('Choisissez des images PNG, JPEG ou WebP de 5 Mo maximum.');
        message(`Ajout de ${file.name}…`);
        const encoded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const result = await request('/book/assets', { method: 'POST', body: JSON.stringify({ encoded, name: file.name.slice(0, 160) }) });
        const value = { id: uid(), src: result.id, alt: file.name.replace(/\.[^.]+$/, '').slice(0, 180), x: 5, y: 5, w: 55, h: 55 };
        page().items.push(value); selected = value.id; changed();
      }
      render(); message('Croquis ajoutés au brouillon. Déplacez-les sur la page, puis enregistrez.');
    });
    $('#book-files').value = '';
    render();
  }
  function restore(from, to) {
    if (!from.length || busy) return;
    to.push(JSON.stringify(documentData)); documentData = JSON.parse(from.pop()); selected = ''; changed(); render();
  }
  function initialize() {
    $('#book-save').addEventListener('click', () => action(async () => { await save(); message('Brouillon enregistré. Le site public n’a pas encore changé.'); }));
    $('#book-publish').addEventListener('click', () => action(async () => {
      await save(); const result = await request('/book/publish', { method: 'POST', body: JSON.stringify({ revision }) });
      publishedRevision = result.published_revision; message('Livre publié. Les visiteurs retrouveront cette version en ouvrant Nos styles.');
    }));
    $('#book-reload').addEventListener('click', () => { if (!dirty || confirm('Recharger le brouillon enregistré et abandonner les modifications locales ?')) action(() => load(true)); });
    $('#book-add-page').addEventListener('click', () => {
      if (documentData.pages.length >= 500) { message('Le livre contient déjà 500 pages.'); return; }
      checkpoint(); documentData.pages.splice(current + 1, 0, { id: uid(), title: '', items: [] }); current++; selected = ''; changed(); render(); $('#book-page-title').focus();
    });
    $('#book-page-copy').addEventListener('click', () => {
      if (documentData.pages.length >= 500) return;
      checkpoint(); const copy = clone(page()); copy.id = uid(); copy.items.forEach(i => { i.id = uid(); }); documentData.pages.splice(++current, 0, copy); selected = ''; changed(); render();
    });
    for (const [id, delta] of [['up', -1], ['down', 1]]) $(`#book-page-${id}`).addEventListener('click', () => {
      checkpoint(); const [value] = documentData.pages.splice(current, 1); current += delta; documentData.pages.splice(current, 0, value); changed(); render();
    });
    $('#book-page-delete').addEventListener('click', () => {
      if (documentData.pages.length < 2 || !confirm('Retirer cette page du brouillon ? La version en ligne changera seulement après publication.')) return;
      checkpoint(); documentData.pages.splice(current, 1); selected = ''; changed(); render();
    });
    $('#book-page-title').addEventListener('change', event => { checkpoint(); page().title = event.target.value; changed(); render(); });
    $('#book-files').addEventListener('change', event => upload([...event.target.files]));
    $('#book-undo').addEventListener('click', () => restore(history, future)); $('#book-redo').addEventListener('click', () => restore(future, history));
    for (const field of ['x', 'y', 'w', 'h']) $(`#book-${field}`).addEventListener('change', event => {
      const value = item(), number = Number(event.target.value); if (!value || !Number.isFinite(number)) return;
      checkpoint(); value[field] = number; bounds(value); changed(); layout.place($('#book-canvas').querySelector(`[data-item="${selected}"]`), value); selection();
    });
    $('#book-alt').addEventListener('change', event => { if (item()) { checkpoint(); item().alt = event.target.value; changed(); render(); } });
    $('#book-remove-item').addEventListener('click', () => { if (!item()) return; checkpoint(); page().items = page().items.filter(i => i.id !== selected); selected = ''; changed(); render(); });
    for (const button of document.querySelectorAll('[data-book-arrange]')) button.addEventListener('click', () => {
      checkpoint(); const columns = Number(button.dataset.bookArrange), count = page().items.length, rows = Math.max(1, Math.ceil(count / columns));
      page().items.forEach((value, index) => { value.x = index % columns * 100 / columns + 2; value.y = Math.floor(index / columns) * 100 / rows + 2; value.w = 100 / columns - 4; value.h = 100 / rows - 4; });
      changed(); render();
    });
    const canvas = $('#book-canvas');
    canvas.addEventListener('pointerdown', event => {
      const target = event.target.closest('[data-item]'); if (!target || busy || event.button !== 0) return;
      selected = target.dataset.item; selection(); target.focus(); event.preventDefault();
      dragging = { pointer: event.pointerId, x: event.clientX, y: event.clientY, initial: clone(item()), checkpoint: false };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== dragging.pointer) return;
      if (!dragging.checkpoint) { checkpoint(); dragging.checkpoint = true; }
      const rect = canvas.getBoundingClientRect(), value = item();
      value.x = dragging.initial.x + (event.clientX - dragging.x) / rect.width * 100;
      value.y = dragging.initial.y + (event.clientY - dragging.y) / rect.height * 100; bounds(value);
      layout.place(canvas.querySelector(`[data-item="${selected}"]`), value); changed(); selection();
    });
    const stopDrag = event => { if (dragging?.pointer === event.pointerId) { dragging = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } };
    canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag);
    canvas.addEventListener('keydown', event => {
      const value = item(); if (!value || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); checkpoint(); const step = event.shiftKey ? 5 : .5;
      if (event.key === 'ArrowLeft') value.x -= step; if (event.key === 'ArrowRight') value.x += step;
      if (event.key === 'ArrowUp') value.y -= step; if (event.key === 'ArrowDown') value.y += step;
      bounds(value); layout.place(canvas.querySelector(`[data-item="${selected}"]`), value); changed(); selection();
    });
    canvas.addEventListener('focusin', event => { const target = event.target.closest('[data-item]'); if (target) { selected = target.dataset.item; selection(); } });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }
  initialize();
  $('#book-workbench').inert = true;
  window.BLOODLINE_BOOK_EDITOR = Object.freeze({
    async open(apiRequest) {
      request = apiRequest;
      try { await load(); }
      catch (error) { message(error.message || 'Impossible de charger le livre. Cliquez sur Recharger.'); updateStatus(); }
    },
    reset() { documentData = null; dirty = false; history = []; future = []; $('#book-workbench').inert = true; for (const value of urls.values()) value.then(url => URL.revokeObjectURL(url)).catch(() => {}); urls.clear(); }
  });
})();
