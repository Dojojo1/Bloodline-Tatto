/* White LED: Heritage's bloom, glow and core adapted to Bloodline stone frames. */
(() => {
  const selector = '.stats>div,.overview-section,.dashboard-shortcuts button,.request-detail,.access-panel,.service-card,.auth-panel';
  const namespace = 'http://www.w3.org/2000/svg';
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const svg = target.querySelector(':scope > .marble-led');
      const w = target.clientWidth - 28, h = target.clientHeight - 28;
      if (!svg || w < 20 || h < 20) continue;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const cut = target.matches('.overview-section,.request-detail,.access-panel,.auth-panel');
      const r = Math.min(cut ? 17 : 29, h / 3);
      const d = cut
        ? `M${r} 2H${w-r}L${w-2} ${r}V${h-r}L${w-r} ${h-2}H${r}L2 ${h-r}V${r}Z`
        : `M${r} 2H${w-10}Q${w-2} 2 ${w-2} 10V${h-r}Q${w-2} ${h-2} ${w-r} ${h-2}H12Q2 ${h-2} 2 ${h-12}V${r}Q2 2 ${r} 2Z`;
      svg.querySelectorAll('path').forEach(path => path.setAttribute('d', d));
    }
  });
  const decorate = () => {
    document.querySelectorAll(selector).forEach(panel => {
      if (panel.querySelector(':scope > .marble-led')) return;
      const svg = document.createElementNS(namespace, 'svg');
      svg.classList.add('marble-led'); svg.setAttribute('aria-hidden', 'true');
      for (const layer of ['bloom', 'glow', 'core']) {
        const path = document.createElementNS(namespace, 'path');
        path.classList.add(`marble-led-${layer}`); svg.append(path);
      }
      panel.append(svg); observer.observe(panel);
    });
  };
  decorate();
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
})();
