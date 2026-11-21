/* Shared placement renderer: identical coordinates in the editor and book. */
(() => {
  const api = 'https://unabashed-tackle-claw.ngrok-free.dev/bloodline-api/api';
  const assetUrl = src => /^[a-f0-9]{64}$/.test(src) ? `${api}/book/public/media/${src}` : src;
  const images = new Map();
  const publicImage = src => {
    if (!/^[a-f0-9]{64}$/.test(src)) return src;
    if (!images.has(src)) images.set(src, fetch(assetUrl(src), { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(response => { if (!response.ok) throw new Error('Image indisponible'); return response.blob(); })
      .then(blob => URL.createObjectURL(blob)));
    return images.get(src);
  };
  const place = (element, item) => {
    Object.assign(element.style, { left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` });
  };
  const render = (container, page, resolve = assetUrl, editable = false) => {
    container.replaceChildren();
    for (const item of page.items) {
      const box = document.createElement('div'); box.className = 'sketch-item'; box.dataset.item = item.id;
      place(box, item);
      const img = document.createElement('img'); img.alt = item.alt || page.title || 'Croquis de tatouage';
      const source = resolve(item.src);
      if (typeof source === 'string') img.src = source;
      else source.then(url => { img.src = url; }).catch(() => { box.classList.add('image-unavailable'); });
      img.draggable = false; img.decoding = 'async'; box.append(img);
      if (editable) { box.tabIndex = 0; box.setAttribute('role', 'button'); box.setAttribute('aria-label', `${img.alt} — déplacer avec les flèches`); }
      container.append(box);
    }
  };
  window.BLOODLINE_LAYOUT = Object.freeze({ api, assetUrl, publicImage, place, render });
})();
