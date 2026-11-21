/* Published sketchbook. Every illustration stays attached to its own leaf. */
(async () => {
  const host = document.querySelector('#tattoo-book');
  if (!host) return;
  const stage = document.querySelector('#tattoo-book-stage');
  const position = document.querySelector('.tattoo-book-position');
  const status = document.querySelector('#tattoo-book-status');
  const previous = document.querySelector('#tattoo-book-prev');
  const next = document.querySelector('#tattoo-book-next');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Normalized assets and layouts can later be supplied by the management API.
  const leaves = [
    { kind: 'cover', label: 'Couverture Bloodline Tattoo' },
    { kind: 'title', title: 'Le carnet\nBloodline', text: 'Une idée, un trait.\nLe début de votre histoire.' },
    { kind: 'plate', title: 'Encre & liberté', image: 'assets/biker-club-sketch.webp', alt: 'Croquis existant : moto, roses et crâne ailé' },
    { kind: 'plate', title: 'Les archives Bloodline', image: 'assets/tattoo-book-open.png', alt: 'Illustration existante du livre ouvert Bloodline, loups et dessins de tatouage' },
    { kind: 'plate', title: 'Le carnet de l’atelier', image: 'assets/salon-book.png', alt: 'Livre ancien Bloodline en cuir gravé' },
    { kind: 'duo', title: 'Deux études sur une page', images: [
      { image: 'assets/biker-club-sketch.webp', alt: 'Étude moto et roses' },
      { image: 'assets/tattoo-book-open.png', alt: 'Étude des planches Bloodline' }
    ] },
    { kind: 'title', title: 'À imaginer\nensemble.', text: 'Ces illustrations présentent l’univers Bloodline.\nVotre projet se dessine avec le tatoueur.' },
    { kind: 'back', label: 'Quatrième de couverture Bloodline' }
  ];
  try {
    const response = await fetch(`${BLOODLINE_LAYOUT.api}/book/public`, {
      cache: 'no-store', headers: { 'ngrok-skip-browser-warning': 'true' }, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('Catalogue indisponible');
    const catalogue = await response.json();
    if (catalogue.version !== 1 || !Array.isArray(catalogue.pages) || !catalogue.pages.length) throw new Error('Catalogue vide');
    const pages = catalogue.pages.map(page => ({ kind: 'layout', ...page }));
    // A sheet has two sides; preserve the final inside cover when count is odd.
    if (pages.length % 2) pages.push({ kind: 'layout', title: '', items: [] });
    leaves.splice(2, leaves.length - 4, ...pages);
    document.querySelector('.tattoo-book-demo').hidden = true;
  } catch {
    // The existing illustrated book remains usable during an API outage.
  }
  const backIndex = () => leaves.length - 1;
  const rearOpenIndex = portrait => leaves.length - (portrait ? 2 : 3);
  const create = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const plate = item => {
    const figure = create('figure', 'tattoo-plate');
    const image = create('img'); image.src = item.image; image.alt = item.alt;
    image.draggable = false; image.decoding = 'async'; figure.append(image); return figure;
  };
  leaves.forEach((leaf, index) => {
    const page = create('div', 'tattoo-leaf');
    page.dataset.bookLeaf = String(index);
    if (index === 1 || index === leaves.length - 2) page.dataset.bookGuard = 'true';
    if (leaf.kind === 'cover' || leaf.kind === 'back') {
      page.classList.add('tattoo-cover'); page.dataset.density = 'hard';
      if (leaf.kind === 'cover') {
        const img = create('img', 'tattoo-cover-art');
        img.src = 'assets/bloodline-book-cover.png'; img.alt = leaf.label; img.draggable = false;
        page.append(img);
      } else {
        const img = create('img', 'tattoo-cover-art');
        img.src = 'assets/bloodline-book-back.png'; img.alt = leaf.label; img.draggable = false;
        page.append(img);
      }
    } else {
      const inner = create('div', 'tattoo-paper-inner');
      if (leaf.kind === 'title') {
        // Inner faces of the rigid cover, not a paper leaf forced to turn rigid.
        page.classList.add('tattoo-endpaper'); page.dataset.density = 'hard';
        inner.classList.add('tattoo-title-page');
        inner.append(create('div', 'tattoo-stamp', 'B'), create('h3', '', leaf.title), create('p', '', leaf.text));
      } else {
        inner.append(create('p', 'tattoo-folio', 'Bloodline Tattoo · Carnet de l’atelier'));
        if (leaf.kind === 'layout') {
          const canvas = create('div', 'sketch-stage');
          BLOODLINE_LAYOUT.render(canvas, leaf, BLOODLINE_LAYOUT.publicImage); inner.append(canvas);
        } else if (leaf.kind === 'duo') {
          const stack = create('div', 'tattoo-plate-stack'); leaf.images.forEach(item => stack.append(plate(item))); inner.append(stack);
        } else inner.append(plate(leaf));
        inner.append(create('p', 'tattoo-caption', leaf.title));
      }
      inner.append(create('span', 'tattoo-page-number', String(index)));
      page.append(inner);
    }
    host.append(page);
  });
  let book;
  let resizeFrame;
  let settling = false;
  let lastWidth = 0;
  let lastHeight = 0;
  let centerOffset = 0;
  let coverMotion = null;
  let coverGesture = null;
  let lastPointerTime = 0;
  const coverLayers = new Map();
  const coverSegments = 16;
  let fontsReady = !document.fonts || document.fonts.status === 'loaded';
  const centerFor = display => {
    if (book.getOrientation() === 'portrait') return 0;
    const halfPage = book.getBoundsRect().pageWidth / 2;
    return display === 'front' ? -halfPage : display === 'back' ? halfPage : 0;
  };
  const placeBook = offset => {
    centerOffset = offset;
    position.style.transform = `translate3d(${offset}px,0,0)`;
  };
  const coverLeft = (kind, angle, rect) => {
    const singleBack = kind === 'back' && book.getOrientation() === 'portrait';
    const closingOffset = singleBack ? rect.pageWidth * (1 - Math.min(1, Math.abs(angle) / 180)) : 0;
    return rect.left + (kind === 'front' ? rect.pageWidth : 0) + closingOffset;
  };
  const paintCoverCore = (layer, solids, rect, kind, angle) => {
    const { core, coreContext: ctx } = layer;
    core.style.display = solids.length ? 'block' : 'none';
    if (!solids.length || !ctx) return;
    const padding = Math.ceil(Math.max(160, rect.height * .4)), width = position.clientWidth, height = position.clientHeight;
    core.style.top = `${-padding}px`;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const pixelWidth = Math.ceil(width * ratio), pixelHeight = Math.ceil((height + padding * 2) * ratio);
    if (core.width !== pixelWidth || core.height !== pixelHeight) {
      core.width = pixelWidth; core.height = pixelHeight;
      core.style.width = `${width}px`; core.style.height = `${height + padding * 2}px`;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height + padding * 2);
    const root = angle * Math.PI / 180, cosine = Math.cos(root), sine = Math.sin(root);
    const hinge = kind === 'front' ? 0 : rect.pageWidth;
    const left = coverLeft(kind, angle, rect);
    const project = (solid, dx, y, dz) => {
      const c = Math.cos(solid.radians), s = Math.sin(solid.radians);
      const x = solid.x + c * dx + s * dz, z = solid.z - s * dx + c * dz;
      const worldX = left + hinge + cosine * (x - hinge) + sine * z;
      const worldZ = -sine * (x - hinge) + cosine * z;
      const scale = 2000 / (2000 - worldZ);
      return { x: width / 2 + (worldX - width / 2) * scale, y: padding + height / 2 + (rect.top + y - height / 2) * scale };
    };
    // One path fills the UNION of the projected solids. Shared edges are
    // rasterized once, so subpixel skin seams cannot reveal a paper below.
    ctx.beginPath();
    for (const solid of solids) {
      const corners = [];
      for (const z of [-4, 4]) for (const y of [0, rect.height]) for (const x of [-solid.width / 2, solid.width / 2]) {
        corners.push(project(solid, x, y, z));
      }
      for (const indices of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
        const polygon = indices.map(i => corners[i]);
        const area = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % 4]; return sum + p.x * q.y - q.x * p.y; }, 0);
        if (area < 0) polygon.reverse();
        polygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath();
      }
    }
    ctx.fillStyle = layer.corePattern || '#1b100e';
    ctx.fill();
    // Cover the antialias fringe shared by adjacent projected polygons.
    // This uses the same leather, underneath the skins, not a visible border.
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = .8;
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  const showCoverBoard = (kind, angle, angularLag = 0) => {
    const rect = book.getBoundsRect();
    let layer = coverLayers.get(kind);
    if (!layer) {
      const scene = create('div', 'tattoo-cover-scene');
      scene.dataset.coverKind = kind; scene.setAttribute('aria-hidden', 'true');
      const board = create('div', 'tattoo-cover-board');
      const core = create('canvas', 'tattoo-cover-core');
      board.dataset.kind = kind; scene.append(core, board); position.append(scene);
      layer = { scene, board, core, coreContext: core.getContext('2d'), strips: [] }; coverLayers.set(kind, layer);
      const leather = new Image();
      leather.onload = () => { layer.corePattern = layer.coreContext?.createPattern(leather, 'repeat'); };
      leather.src = 'assets/book-leather.png';
      const source = host.querySelector(`[data-book-leaf="${kind === 'front' ? 1 : leaves.length - 2}"] .tattoo-paper-inner`);
      for (let index = 0; index <= coverSegments; index++) {
        // Each strip is a closed six-sided solid. Its two skins and four rims
        // share one transform; clipping never flattens their 3D parent.
        const strip = create('div', 'tattoo-board-strip');
        strip.dataset.surface = index === coverSegments ? 'rest' : 'flex';
        const outside = create('div', 'tattoo-board-face tattoo-board-outside');
        const outsideSkin = create('div', 'tattoo-board-skin');
        const art = create('img', 'tattoo-cover-art');
        art.src = kind === 'front' ? 'assets/bloodline-book-cover.png' : 'assets/bloodline-book-back.png';
        art.alt = ''; art.draggable = false;
        outsideSkin.append(art); outside.append(outsideSkin);
        const inside = create('div', 'tattoo-board-face tattoo-board-inside');
        const insideSkin = create('div', `tattoo-leaf tattoo-endpaper tattoo-board-skin ${kind === 'front' ? '--left' : '--right'}`);
        insideSkin.append(source.cloneNode(true)); inside.append(insideSkin);
        strip.append(outside, inside);
        const edges = ['top', 'bottom', 'left', 'right'].map(side => {
          const edge = create('div', 'tattoo-board-edge');
          edge.dataset.side = side; strip.append(edge); return edge;
        });
        board.append(strip);
        layer.strips.push({ strip, outsideSkin, insideSkin, edges, index });
      }
    }
    const { scene, board } = layer;
    Object.assign(board.style, {
      top: `${rect.top}px`, left: `${coverLeft(kind, angle, rect)}px`,
      width: `${rect.pageWidth}px`, height: `${rect.height}px`,
      transformOrigin: kind === 'front' ? 'left center' : 'right center',
      transform: `rotateY(${angle}deg)`
    });
    const depth = 8;
    const length = rect.pageWidth / coverSegments;
    board.style.setProperty('--cover-half-depth', `${depth / 2}px`);
    board.style.setProperty('--cover-depth', `${depth}px`);
    board.style.setProperty('--cover-rim-art', `url('assets/bloodline-book-${kind === 'front' ? 'cover' : 'back'}.png')`);
    const hingeSign = kind === 'front' ? 1 : -1;
    // Paper turns must not composite 32 articulated cover strips underneath.
    // A flat board uses one identical solid until its own movement begins.
    const atRest = Math.abs(angularLag) < .001;
    const points = [{ x: kind === 'front' ? 0 : rect.pageWidth, z: 0 }];
    for (let index = 0; index < coverSegments; index++) {
      const tangent = angularLag * Math.pow((index + .5) / coverSegments, 1.35) * Math.PI / 180;
      const last = points[index];
      points.push({ x: last.x + hingeSign * length * Math.cos(tangent), z: last.z - hingeSign * length * Math.sin(tangent) });
    }
    const solids = [];
    for (const { strip, outsideSkin, insideSkin, edges, index } of layer.strips) {
      const flat = index === coverSegments;
      strip.style.display = flat === atRest ? 'block' : 'none';
      if (flat !== atRest) continue;
      const segment = flat ? 0 : kind === 'front' ? index : coverSegments - 1 - index;
      const p0 = points[segment], p1 = points[segment + 1];
      const tangent = flat ? 0 : angularLag * Math.pow((segment + .5) / coverSegments, 1.35);
      // A subpixel overlap seals joints between neighboring closed solids.
      const overlap = .65;
      const start = flat ? 0 : index * length - (index ? overlap / 2 : 0);
      const width = flat ? rect.pageWidth : length + (index ? overlap / 2 : 0) + (index < coverSegments - 1 ? overlap / 2 : 0);
      const originalCenter = start + width / 2;
      const originalSegmentCenter = (index + .5) * length;
      const centerAdjustment = originalCenter - originalSegmentCenter;
      const radians = tangent * Math.PI / 180;
      const x = flat ? rect.pageWidth / 2 : (p0.x + p1.x) / 2 + centerAdjustment * Math.cos(radians);
      const z = flat ? 0 : (p0.z + p1.z) / 2 - centerAdjustment * Math.sin(radians);
      if (!flat) solids.push({ x, z, width, radians });
      Object.assign(strip.style, {
        width: `${width}px`, height: `${rect.height}px`,
        transform: `translate3d(${x - width / 2}px,0,${z}px) rotateY(${tangent}deg)`
      });
      for (const skin of [outsideSkin, insideSkin]) {
        Object.assign(skin.style, { width: `${rect.pageWidth}px`, height: `${rect.height}px` });
      }
      outsideSkin.style.left = `${-start}px`;
      insideSkin.style.left = `${-(rect.pageWidth - start - width)}px`;
      for (const edge of edges) {
        const side = edge.dataset.side;
        const horizontal = side === 'top' || side === 'bottom';
        Object.assign(edge.style, {
          width: horizontal ? `${width}px` : `${depth}px`,
          height: horizontal ? `${depth}px` : `${rect.height}px`,
          left: horizontal ? '0px' : `${(side === 'left' ? 0 : width) - depth / 2}px`,
          top: horizontal ? `${(side === 'top' ? 0 : rect.height) - depth / 2}px` : '0px',
          transform: horizontal ? 'rotateX(90deg)' : 'rotateY(90deg)',
          backgroundSize: `${rect.pageWidth}px ${rect.height}px`,
          backgroundPosition: horizontal
            ? `${-start}px ${side === 'top' ? -rect.height * .035 : -rect.height * .95}px`
            : `${-rect.pageWidth * (side === 'right' ? .94 : .04)}px 0px`
        });
      }
    }
    paintCoverCore(layer, solids, rect, kind, angle);
    scene.style.visibility = 'visible';
  };
  const hideCoverBoard = kind => {
    const layer = coverLayers.get(kind);
    if (layer) layer.scene.style.visibility = 'hidden';
  };
  const prepareCover = (kind, opening) => {
    const first = kind === 'front';
    const closedPage = first ? 0 : book.getPageCount() - 1;
    const portrait = book.getOrientation() === 'portrait';
    const openPage = first ? portrait ? 2 : 1 : rearOpenIndex(portrait);
    const fromDisplay = opening ? kind : 'open';
    const toDisplay = opening ? 'open' : kind;
    const fromAngle = opening ? 0 : first ? -180 : 180;
    const toAngle = opening ? first ? -180 : 180 : 0;
    const motion = { kind, opening, fromAngle, toAngle, fromOffset: centerFor(fromDisplay), toOffset: centerFor(toDisplay), target: opening ? openPage : closedPage, progress: 0, followingAngle: fromAngle, sampledAt: performance.now() };
    coverMotion = motion; settling = true;
    stage.dataset.coverActive = kind; stage.dataset.state = 'flipping';
    // Only static interior pages live under this two-sided board. PageFlip
    // never draws a second copy of the cover during this transition.
    book.turnToPage(openPage);
    placeBook(motion.fromOffset); showCoverBoard(kind, fromAngle);
    stage.style.setProperty('--book-support-opacity', '0');
    return motion;
  };
  const paintCover = (motion, progress, now = performance.now()) => {
    motion.progress = progress;
    const targetAngle = motion.fromAngle + (motion.toAngle - motion.fromAngle) * progress;
    const elapsed = Math.max(0, Math.min(40, now - motion.sampledAt));
    motion.sampledAt = now;
    motion.followingAngle += (targetAngle - motion.followingAngle) * (1 - Math.exp(-elapsed / 90));
    // The grip keeps a modest page-like curl even when held still. Its side
    // comes from the actual hinge angle, never an opening/closing toggle.
    // Motion adds elastic give without flipping the leather inside out.
    const gripBend = 9 * Math.sin(targetAngle * Math.PI / 180);
    const response = Math.max(-14, Math.min(14, targetAngle - motion.followingAngle)) * Math.sqrt(Math.max(0, Math.sin(Math.PI * progress)));
    const bendSign = Math.sign(gripBend);
    const lag = Math.abs(gripBend) < .00001 ? 0 : bendSign * Math.max(Math.abs(gripBend) * .35, Math.min(22, Math.abs(gripBend) + response * bendSign));
    placeBook(motion.fromOffset + (motion.toOffset - motion.fromOffset) * progress);
    showCoverBoard(motion.kind, targetAngle - lag, lag);
  };
  const finishCover = (motion, completed) => {
    paintCover(motion, completed ? 1 : 0);
    const first = motion.kind === 'front';
    const closed = first ? 0 : book.getPageCount() - 1;
    const portrait = book.getOrientation() === 'portrait';
    const open = first ? portrait ? 2 : 1 : rearOpenIndex(portrait);
    book.turnToPage(completed ? motion.target : motion.opening ? closed : open);
    coverMotion = null; settling = false; delete stage.dataset.coverActive;
    stage.dataset.state = 'read'; sync();
  };
  const animateCover = (motion, complete = true) => {
    const from = motion.progress, to = complete ? 1 : 0;
    const duration = Math.max(650, 1600 * Math.abs(to - from));
    const started = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t * t * (3 - 2 * t);
      paintCover(motion, from + (to - from) * eased, now);
      if (t < 1) requestAnimationFrame(tick); else finishCover(motion, complete);
    };
    requestAnimationFrame(tick);
  };
  const stabilizeCoverFaces = instance => {
    const clipUnturnedPaper = (element, orientation) => {
      const render = instance.getRender();
      const calculation = instance.getFlipController().getCalculation();
      if (coverMotion || !calculation || render.flippingPage?.getDrawingDensity() !== 'soft') return;
      const backward = calculation.getDirection() === 1;
      if (orientation !== (backward ? 0 : 1)) return;
      const { pageWidth: width, height } = instance.getBoundsRect();
      const pointer = calculation.getPosition();
      const cornerY = calculation.getCorner() === 'bottom' ? height : 0;
      const a = width - pointer.x, b = cornerY - pointer.y;
      if (Math.hypot(a, b) < .01) return;
      const c = (width * width + cornerY * cornerY - pointer.x * pointer.x - pointer.y * pointer.y) / 2;
      // PageFlip leaves this entire face underneath its clipped moving layers.
      // Explicitly retain only the unturned side of the fold. Otherwise small
      // corner wedges remain visible through rounding/antialiasing gaps.
      const distance = p => a * p.x + b * p.y - c + Math.hypot(a, b) * .5;
      const rectangle = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
      const polygon = [];
      for (let i = 0; i < rectangle.length; i++) {
        const from = rectangle[i], to = rectangle[(i + 1) % rectangle.length];
        const d0 = distance(from), d1 = distance(to);
        if (d0 <= 0) polygon.push(from);
        if ((d0 <= 0) !== (d1 <= 0)) {
          const t = d0 / (d0 - d1);
          polygon.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
        }
      }
      const clip = polygon.length >= 3
        ? `polygon(${polygon.map(p => `${backward ? width - p.x : p.x}px ${p.y}px`).join(',')})`
        : 'polygon(0 0,0 0,0 0)';
      element.style.clipPath = clip;
      element.style.webkitClipPath = clip;
    };
    // A soft bottom leaf is also drawn in hard mode beside a cover. Normalize
    // every actual rigid drawing to the same origin used by the static spread.
    for (let index = 0; index < instance.getPageCount(); index++) {
      const leaf = instance.getPage(index);
      const element = leaf.getElement();
      const draw = leaf.draw.bind(leaf);
      const simpleDraw = leaf.simpleDraw.bind(leaf);
      leaf.draw = (...args) => {
        draw(...args);
        const rotation = element.style.transform.match(/rotateY\(([-\d.]+)deg\)/);
        if (rotation) {
          const rect = instance.getBoundsRect();
          element.style.top = `${rect.top}px`;
          element.style.left = `${element.classList.contains('--left') ? rect.left : 0}px`;
          // The library's integer point interpolation can stop a fraction of
          // a degree short, then snap flat when simpleDraw takes over.
          const angle = Number(rotation[1]);
          const flatAngle = Math.round(angle / 180) * 180;
          if (Math.abs(angle - flatAngle) < .3) {
            element.style.transform = element.style.transform.replace(rotation[0], `rotateY(${flatAngle}deg)`);
          }
        }
        const away = rotation && Math.cos(Number(rotation[1]) * Math.PI / 180) <= .0001;
        if (away) element.dataset.faceAway = 'true'; else delete element.dataset.faceAway;
      };
      leaf.simpleDraw = (...args) => {
        delete element.dataset.faceAway;
        simpleDraw(...args);
        clipUnturnedPaper(element, args[0]);
      };
    }
  };
  // PageFlip scales its default duration by pixels left to travel. On release
  // that can collapse to a few milliseconds. Adapt the public renderer entry
  // point, preserving the vendor's page geometry, shadows and completion hook.
  const softenMotion = instance => {
    const render = instance.getRender();
    const startAnimation = render.startAnimation.bind(render);
    render.startAnimation = (frames, originalDuration, complete) => {
      const state = instance.getState();
      if (state === 'fold_corner' || frames.length < 2) {
        return startAnimation(frames, originalDuration, complete);
      }
      settling = true;
      stage.dataset.state = 'flipping';
      const released = state === 'user_fold';
      const remaining = Math.min(1, frames.length / (render.getRect().pageWidth * 2));
      // The owner explicitly requested the complete, manually triggered flip
      // for this prototype, including in the reduced-motion preview browser.
      const duration = released ? Math.max(650, 1600 * Math.sqrt(remaining)) : 1600;
      stage.style.setProperty('--book-motion-duration', `${duration}ms`);
      const calculation = instance.getFlipController().getCalculation();
      const willTurn = !released || calculation?.getPosition().x <= 0;
      if (willTurn && calculation) {
        const page = instance.getCurrentPageIndex();
        const last = instance.getPageCount() - 1;
        const step = instance.getOrientation() === 'landscape' ? 2 : 1;
        const target = calculation.getDirection() === 0
          ? page === 0 ? 1 : Math.min(last, page + step)
          : page === 1 ? 0 : Math.max(0, page - step);
        stage.dataset.display = target === 0 ? 'front' : target === last ? 'back' : 'open';
      }
      const startOffset = centerOffset;
      const endOffset = centerFor(stage.dataset.display);
      const startSupport = Number(stage.style.getPropertyValue('--book-support-opacity')) || 0;
      const endSupport = stage.dataset.display === 'open' ? 1 : 0;
      const easedFrames = Array.from({ length: 180 }, (_, index) => {
        const t = index / 179;
        const eased = released ? Math.sin(t * Math.PI / 2) : t * t * (3 - 2 * t);
        return () => {
          placeBook(startOffset + (endOffset - startOffset) * eased);
          // Fade only the physical backing; it must not pop into place at the
          // completion callback and look like the whole book changed size.
          const backingProgress = endSupport > startSupport ? Math.max(0, (eased - .8) / .2) : Math.min(1, eased / .25);
          stage.style.setProperty('--book-support-opacity', String(startSupport + (endSupport - startSupport) * backingProgress));
          frames[Math.round(eased * (frames.length - 1))]();
        };
      });
      // finishAnimation() belongs to PageFlip; guard input while settling so
      // a second click/hover cannot force the current animation to its end.
      startAnimation(easedFrames, duration, () => {
        easedFrames[easedFrames.length - 1]();
        complete();
        settling = false;
        stage.dataset.state = 'read';
        sync();
      });
    };
  };
  const sync = () => {
    if (!book || coverMotion) return;
    const page = book.getCurrentPageIndex();
    const orientation = book.getOrientation();
    const last = book.getPageCount() - 1;
    stage.dataset.orientation = orientation;
    stage.dataset.display = page === 0 ? 'front' : page === last ? 'back' : 'open';
    if (!settling) {
      placeBook(centerFor(stage.dataset.display));
      stage.style.setProperty('--book-support-opacity', stage.dataset.display === 'open' ? '1' : '0');
    }
    if (stage.dataset.display === 'open') {
      // These are the SAME physical faces that just completed their rotation.
      // They stay below the paper for the rest of the visit; no clone swap.
      showCoverBoard('front', -180); showCoverBoard('back', 180);
    } else {
      hideCoverBoard(stage.dataset.display === 'front' ? 'back' : 'front');
      showCoverBoard(stage.dataset.display, 0);
    }
    previous.disabled = page === 0;
    next.disabled = page === last;
    next.querySelector('span').textContent = page === 0 ? 'Ouvrir le livre' : 'Suivante';
    status.textContent = page === 0 ? 'Couverture' : page === last ? 'Fin du carnet' : orientation === 'landscape' ? `Pages ${page} – ${Math.min(page + 1, last - 1)}` : `Page ${page} sur ${last - 1}`;
    const rect = book.getBoundsRect();
    const single = orientation === 'portrait';
    stage.style.setProperty('--book-page-width', `${rect.pageWidth}px`);
    stage.style.setProperty('--book-render-left', `${rect.left}px`);
    stage.style.setProperty('--book-render-top', `${rect.top}px`);
    stage.style.setProperty('--book-left', `${single ? rect.left + rect.pageWidth : rect.left}px`);
    stage.style.setProperty('--book-top', `${rect.top}px`);
    stage.style.setProperty('--book-width', `${single ? rect.pageWidth : rect.width}px`);
    stage.style.setProperty('--book-height', `${rect.height}px`);
    stage.dataset.loading = 'false';
  };
  const init = () => {
    if (book || !fontsReady || stage.clientWidth < 10 || !window.St?.PageFlip) return;
    stage.dataset.loading = 'true';
    book = new St.PageFlip(host, {
      width: 420, height: 560, size: 'stretch', minWidth: 350, maxWidth: 840,
      minHeight: 300, maxHeight: 1120, autoSize: false, showCover: true, usePortrait: true,
      startPage: 0, drawShadow: true, maxShadowOpacity: .58,
      flippingTime: 1600, mobileScrollSupport: true,
      swipeDistance: 28, showPageCorners: false, useMouseEvents: true, disableFlipByClick: false
    });
    book.on('init', sync);
    book.on('flip', () => { if (!settling) sync(); });
    book.on('changeOrientation', () => requestAnimationFrame(() => {
      // The front endpaper belongs to the inside of the left-hand cover.
      // In single-page mode the first paper leaf is the visible right side.
      if (book.getOrientation() === 'portrait' && book.getCurrentPageIndex() === 1) book.turnToPage(2);
      sync();
    }));
    book.on('changeState', event => { if (!settling) stage.dataset.state = event.data; });
    book.loadFromHTML(host.querySelectorAll('.tattoo-leaf'));
    stabilizeCoverFaces(book);
    softenMotion(book);
    // Read-only controller for functional tests and later management preview.
    window.BLOODLINE_BOOK = Object.freeze({ get instance() { return book; }, leaves });
    sync();
  };
  const turn = direction => {
    if (!book || settling || !['read', 'fold_corner'].includes(book.getState())) return;
    if (direction > 0 && next.disabled || direction < 0 && previous.disabled) return;
    const page = book.getCurrentPageIndex(), portrait = book.getOrientation() === 'portrait';
    if (page === 0 && direction > 0) return animateCover(prepareCover('front', true));
    if (page === backIndex() && direction < 0) return animateCover(prepareCover('back', true));
    if (page === (portrait ? 2 : 1) && direction < 0) return animateCover(prepareCover('front', false));
    if (page === rearOpenIndex(portrait) && direction > 0) return animateCover(prepareCover('back', false));
    direction > 0 ? book.flipNext('bottom') : book.flipPrev('bottom');
  };
  previous.addEventListener('click', () => turn(-1)); next.addEventListener('click', () => turn(1));
  stage.addEventListener('pointerdown', event => {
    if (!book || settling || event.button !== 0) return;
    const page = book.getCurrentPageIndex(), portrait = book.getOrientation() === 'portrait';
    const rect = book.getBoundsRect(), bounds = position.getBoundingClientRect();
    const leftSide = event.clientX < bounds.left + rect.left + rect.pageWidth;
    let kind, opening;
    if (page === 0) { kind = 'front'; opening = true; }
    else if (page === backIndex()) { kind = 'back'; opening = true; }
    else if (page === (portrait ? 2 : 1) && (portrait ? event.clientX < bounds.left + bounds.width * .3 : leftSide)) { kind = 'front'; opening = false; }
    else if (page === rearOpenIndex(portrait) && !leftSide) { kind = 'back'; opening = false; }
    if (!kind) return;
    event.preventDefault();
    coverGesture = { id: event.pointerId, x: event.clientX, moved: false, motion: prepareCover(kind, opening) };
    stage.setPointerCapture(event.pointerId);
    const gesture = coverGesture;
    const followPointer = now => {
      if (coverGesture !== gesture) return;
      paintCover(gesture.motion, gesture.motion.progress, now);
      requestAnimationFrame(followPointer);
    };
    requestAnimationFrame(followPointer);
  });
  stage.addEventListener('pointermove', event => {
    if (!coverGesture || coverGesture.id !== event.pointerId) return;
    const dx = event.clientX - coverGesture.x;
    if (Math.abs(dx) > 5) coverGesture.moved = true;
    const motion = coverGesture.motion;
    const sign = (motion.kind === 'front') === motion.opening ? -1 : 1;
    paintCover(motion, Math.max(0, Math.min(1, dx * sign / book.getBoundsRect().pageWidth)));
  });
  const releaseCover = event => {
    if (!coverGesture || coverGesture.id !== event.pointerId) return;
    const gesture = coverGesture; coverGesture = null; lastPointerTime = performance.now();
    animateCover(gesture.motion, event.type !== 'pointercancel' && (!gesture.moved || gesture.motion.progress > .18));
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener('pointerup', releaseCover);
  stage.addEventListener('pointercancel', releaseCover);
  // Ignore extra pointer events only during an automatic completion. Dragging
  // stays live until release, and native scrolling remains available on mobile.
  for (const type of ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend']) {
    host.addEventListener(type, event => {
      if (settling || coverGesture || performance.now() - lastPointerTime < 150) event.stopImmediatePropagation();
    }, { capture: true, passive: true });
  }
  stage.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); turn(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const width = stage.clientWidth, height = stage.clientHeight;
      if (width < 10 || width === lastWidth && height === lastHeight) return;
      lastWidth = width; lastHeight = height;
      const existed = Boolean(book);
      init(); if (existed) book?.getUI().update(); sync();
    });
  }).observe(stage);
  init();
  if (!fontsReady) document.fonts.ready.then(() => {
    fontsReady = true;
    init();
  });
  if (!window.St?.PageFlip) {
    status.textContent = 'Le livre n’a pas pu se charger.'; next.disabled = true;
  }
})();
