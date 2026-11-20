/* Each navigation target is a complete view, with native hashes and back/forward. */
(() => {
  const sections = [...document.querySelectorAll('main > section')];
  const show = (id, focus = false) => {
    const selected = sections.find(section => section.id === id) || sections[0];
    sections.forEach(section => section.classList.toggle('route-inactive', section !== selected));
    document.body.classList.add('section-navigation');
    document.querySelectorAll('.primary-nav a').forEach(link => {
      const active = link.hash === `#${selected.id}`;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.querySelector('.primary-nav')?.classList.remove('is-open');
    document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) { selected.setAttribute('tabindex', '-1'); selected.focus({ preventScroll: true }); }
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.hash.length < 2) return;
    const id = link.hash === '#haut' ? 'accueil' : link.hash.slice(1);
    if (!sections.some(section => section.id === id)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    history.pushState(null, '', `#${id}`); show(id, true);
  }, true);
  window.addEventListener('popstate', () => show(location.hash.slice(1)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
  window.addEventListener('load', () => show(location.hash.slice(1)), { once: true });
})();
