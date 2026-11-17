(function () {
  const MODES = ['desktop', 'tablet', 'mobile'];
  const NUMERIC = new Set(['x', 'y', 'width', 'height', 'paddingTop', 'paddingBottom', 'fontSize', 'opacity', 'backgroundX', 'backgroundY', 'backgroundScale']);

  function assignIds(doc = document) {
    const roots = [doc.querySelector('.site-header'), ...doc.querySelectorAll('main > section'), doc.querySelector('.site-footer')].filter(Boolean);
    function visit(element, path) {
      element.dataset.designId = path;
      [...element.children].forEach((child, index) => visit(child, `${path}/${child.tagName.toLowerCase()}:${index}`));
    }
    roots.forEach((root) => visit(root, root.id || root.classList[0]));
  }

  function modeForWidth(width) {
    return width <= 600 ? 'mobile' : width <= 1000 ? 'tablet' : 'desktop';
  }

  function cleanValue(key, value) {
    if (NUMERIC.has(key)) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(key === 'opacity' ? 0 : -2000, Math.min(key === 'opacity' ? 1 : 4000, number)) : null;
    }
    if (key === 'backgroundColor' || key === 'color') return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
    if (key === 'image') return /^assets\/(?!.*\.\.)[\w./-]+\.(png|jpe?g|webp|avif)$/i.test(value) ? value : null;
    if (key === 'fit') return ['cover', 'contain', 'auto'].includes(value) ? value : null;
    if (key === 'text') return typeof value === 'string' ? value.slice(0, 2000) : null;
    return null;
  }

  function applyOne(element, values) {
    if (!values || typeof values !== 'object') return;
    const safe = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cleanValue(key, value)]));
    const isSection = element.matches('main > section');
    const isProjectVisual = element.classList.contains('project-visual');
    if (!isSection && (safe.x != null || safe.y != null)) element.style.translate = `${safe.x || 0}px ${safe.y || 0}px`;
    if (isProjectVisual && safe.width != null) element.style.setProperty('--project-visual-width', `${Math.max(1, safe.width)}px`);
    else if (!isSection && safe.width != null) element.style.width = `${Math.max(1, safe.width)}px`;
    if (!isSection && !isProjectVisual && safe.height != null) element.style.height = `${Math.max(1, safe.height)}px`;
    if (isSection && safe.paddingTop != null) element.style.paddingTop = `${Math.max(0, safe.paddingTop)}px`;
    if (isSection && safe.paddingBottom != null) element.style.paddingBottom = `${Math.max(0, safe.paddingBottom)}px`;
    if (safe.fontSize != null) element.style.fontSize = `${Math.max(8, safe.fontSize)}px`;
    if (safe.opacity != null) element.style.opacity = String(safe.opacity);
    if (safe.backgroundColor) element.style.backgroundColor = safe.backgroundColor;
    if (safe.color) element.style.color = safe.color;
    if (safe.image) {
      if (element instanceof HTMLImageElement) element.src = safe.image;
      else element.style.backgroundImage = `url("${safe.image}")`;
    }
    if (safe.fit) {
      if (element instanceof HTMLImageElement) element.style.objectFit = safe.fit;
      else element.style.backgroundSize = safe.fit;
    }
    if (safe.backgroundX != null || safe.backgroundY != null) {
      const position = `${safe.backgroundX ?? 50}% ${safe.backgroundY ?? 50}%`;
      if (element instanceof HTMLImageElement) element.style.objectPosition = position;
      else element.style.backgroundPosition = position;
    }
    if (safe.backgroundScale != null && !(element instanceof HTMLImageElement)) element.style.backgroundSize = `${Math.max(20, Math.min(400, safe.backgroundScale))}% auto`;
    if (safe.text != null && !element.children.length) element.textContent = safe.text;
  }

  function applyAll(settings, mode = modeForWidth(window.innerWidth), doc = document) {
    assignIds(doc);
    const values = settings && typeof settings === 'object' ? settings[mode] : null;
    if (!values || typeof values !== 'object') return;
    doc.querySelectorAll('[data-design-id]').forEach((element) => {
      const item = values[element.dataset.designId];
      if (item) applyOne(element, item);
    });
  }

  window.BLOODLINE_DESIGN = { assignIds, modeForWidth, cleanValue, applyOne, applyAll, MODES };
  fetch(`design-settings.json?fresh=${Date.now()}`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((settings) => { if (settings) applyAll(settings); })
    .catch(() => {});
})();
