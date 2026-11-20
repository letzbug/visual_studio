/* Plan de travail : format dynamique, zoom et déplacement, calques, variantes, comparaison, présentation. */
(function () {
  const U = window.UVS, { h } = U;
  let root, viewport, board, stamp, baseBox, layerBox, guideV, guideH, strip, tools, compareBox, welcome, progress, caption, zoomLabel;
  let baseKey = null, scale = 1;

  /* ---------- actions sur les calques ---------- */
  U.placeLayer = function (L, pos) {
    const f = U.currentFormat(), m = 5, my = (m * f.w) / f.h;
    const [v, hz] = pos === 'center' ? ['center', 'center'] : pos.split('-');
    const hw = L.w / 2, hh = L.type === 'logo' ? (L.w * L.ar * f.w) / f.h / 2 : 7;
    L.x = hz === 'left' ? m + hw : hz === 'right' ? 100 - m - hw : 50;
    L.y = v === 'top' ? my + hh : v === 'bottom' ? 100 - my - hh : 50;
  };
  U.select = function (id) {
    U.ui.selected = id;
    if (id) { U.ui.rightTab = 'dress'; U.ui.compare = false; }
    U.emit('doc', 'struct');
  };
  U.addText = function (text, place) {
    const tc = U.profile && U.profile.palette.find((c) => c.role === 'text');
    const L = { id: U.uid(), type: 'text', text: text || 'Votre titre', x: 50, y: { top: 14, center: 50, bottom: 85 }[place || 'bottom'], w: 80, size: 7, weight: 700, align: 'center', color: tc ? tc.hex : '#1D1D1B', font: 'brand', upper: false };
    U.doc.layers.push(L); U.commit(); U.select(L.id); return L;
  };
  U.addLogo = async function (replaceLayer) {
    const [f] = await U.pickFiles('image/png,image/svg+xml,image/webp,image/jpeg');
    if (!f) return;
    const assetId = await U.assetPut(f, 'logo');
    let im; try { im = await U.loadImage(U.assetUrl(assetId)); } catch (e) { return U.toast('Logo illisible', 'error'); }
    const ar = im.naturalHeight / im.naturalWidth || 1;
    if (replaceLayer) { Object.assign(replaceLayer, { assetId, ar }); U.commit(); U.emit('doc', 'struct'); return; }
    const b = (U.profile && U.profile.branding) || {};
    const L = { id: U.uid(), type: 'logo', assetId, ar, w: Math.max(18, b.minSizePercent || 0), opacity: 1, x: 50, y: 50 };
    U.placeLayer(L, b.placement || 'bottom-right');
    U.doc.layers.push(L); U.commit(); U.select(L.id);
  };
  U.removeLayer = function (id) {
    U.doc.layers = U.doc.layers.filter((l) => l.id !== id);
    if (U.ui.selected === id) U.ui.selected = null;
    U.commit(); U.emit('doc', 'struct');
  };
  U.importImages = async function () {
    const files = (await U.pickFiles('image/png,image/jpeg,image/webp', true)).filter((f) => /^image\//.test(f.type));
    for (const f of files) { const id = U.uid(); U.doc.images.push({ id, assetId: await U.assetPut(f, 'image'), kind: 'import', label: f.name }); U.doc.current = id; }
    if (files.length) { U.ui.compare = false; U.commit(); U.emit('doc', 'struct'); U.toast(files.length + ' image(s) importée(s)'); }
  };
  U.showImage = function (id) { if (U.doc.current === id) return; U.doc.current = id; U.commit(); U.emit('doc'); };
  U.stepImage = function (d) {
    const im = U.doc.images; if (im.length < 2) return;
    const i = im.findIndex((x) => x.id === U.doc.current);
    U.showImage(im[(i + d + im.length) % im.length].id);
  };
  U.removeImage = function (id) {
    const im = U.doc.images, i = im.findIndex((x) => x.id === id);
    im.splice(i, 1);
    if (U.doc.current === id) U.doc.current = im.length ? im[Math.min(i, im.length - 1)].id : null;
    if (im.length < 2) U.ui.compare = false;
    U.commit(); U.emit('doc', 'struct');
  };

  /* ---------- vue ---------- */
  function layout(animate) {
    const f = U.currentFormat(), r = viewport.getBoundingClientRect();
    if (!r.width) return;
    const pad = U.ui.present ? 36 : 64, padB = U.ui.present ? 36 : 120;
    const fit = Math.min((r.width - pad * 2) / f.w, (r.height - pad - padB) / f.h);
    scale = Math.max(fit * U.ui.zoom, 0.02);
    const w = f.w * scale, hh = f.h * scale;
    board.classList.toggle('no-anim', !animate);
    board.style.width = w + 'px'; board.style.height = hh + 'px';
    board.style.transform = `translate(${(r.width - w) / 2 + U.ui.pan.x}px, ${(r.height - pad - padB - hh) / 2 + pad + U.ui.pan.y}px)`;
    zoomLabel.textContent = Math.round(scale * 100) + ' %';
  }
  U.zoomBy = function (factor, cx, cy) {
    const r = viewport.getBoundingClientRect(), z = U.clamp(U.ui.zoom * factor, 0.2, 8), k = z / U.ui.zoom;
    if (cx != null) {
      const b = board.getBoundingClientRect(), dx = cx - (b.left + b.width / 2), dy = cy - (b.top + b.height / 2);
      U.ui.pan.x += dx * (1 - k); U.ui.pan.y += dy * (1 - k);
    }
    U.ui.zoom = z; layout(cx == null); void r;
  };
  U.fitView = function () { U.ui.zoom = 1; U.ui.pan = { x: 0, y: 0 }; layout(true); };

  function layerEl(L) {
    const sel = U.ui.selected === L.id && !U.ui.present;
    const el = h('div', { class: `layer layer-${L.type}` + (sel ? ' is-selected' : ''), 'data-id': L.id, style: { left: L.x + '%', top: L.y + '%', width: L.w + '%' } });
    if (L.type === 'text') el.append(h('div', { class: 'layer-text', text: L.upper ? L.text.toUpperCase() : L.text, style: { fontSize: L.size + 'cqw', fontWeight: L.weight, color: L.color, textAlign: L.align, fontFamily: U.fontStack(L.font) } }));
    else { el.style.opacity = L.opacity; el.append(h('img', { src: U.assetUrl(L.assetId), alt: 'Logo', draggable: 'false' })); }
    if (sel) el.append(h('span', { class: 'handle', 'data-handle': '1', title: 'Redimensionner' }));
    return el;
  }
  function renderBase() {
    const im = U.currentImage(), key = im ? im.assetId : null;
    if (key === baseKey) return;
    baseKey = key;
    U.$$('.base-img', baseBox).forEach((old) => { old.classList.add('leaving'); setTimeout(() => old.remove(), 420); });
    if (im) baseBox.append(h('img', { class: 'base-img', src: U.assetUrl(im.assetId), alt: '', draggable: 'false' }));
  }
  const KIND = { mock: 'Maquette démo', import: 'Image importée', ai: 'Image générée' };
  function renderStrip() {
    const imgs = U.doc.images;
    strip.hidden = !imgs.length;
    U.fill(strip, ...imgs.map((im, i) => h('div', { class: 'film' + (im.id === U.doc.current ? ' on' : '') },
      h('button', { type: 'button', class: 'film-img', title: `${i + 1}. ${KIND[im.kind]}` + (im.label ? ' : ' + im.label : ''), 'aria-pressed': String(im.id === U.doc.current), onclick: () => { U.ui.compare = false; U.showImage(im.id); U.emit('doc'); } }, h('img', { src: U.assetUrl(im.assetId), alt: `Variante ${i + 1}`, draggable: 'false' })),
      im.kind === 'mock' ? h('span', { class: 'film-tag', text: 'démo' }) : null,
      h('button', { type: 'button', class: 'film-x', title: 'Supprimer cette variante', 'aria-label': 'Supprimer cette variante', onclick: () => U.removeImage(im.id) }, U.icon('x', 11)))),
      h('button', { type: 'button', class: 'film film-add', title: 'Importer une image', 'aria-label': 'Importer une image', onclick: U.importImages }, U.icon('plus', 16)));
  }
  function renderCompare() {
    const imgs = U.doc.images, f = U.currentFormat(), r = viewport.getBoundingClientRect();
    const n = imgs.length, cols = n <= 3 ? n : n === 4 ? (f.w > f.h ? 2 : 4) : Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), gap = 20;
    const tw = Math.min((r.width - 96 - gap * (cols - 1)) / cols, (((r.height - 190 - gap * (rows - 1)) / rows) - 30) * (f.w / f.h));
    compareBox.style.gridTemplateColumns = `repeat(${cols}, ${Math.max(80, tw)}px)`;
    U.fill(compareBox, ...imgs.map((im, i) => h('button', { type: 'button', class: 'cmp' + (im.id === U.doc.current ? ' on' : ''), title: 'Afficher cette variante', onclick: () => { U.ui.compare = false; U.showImage(im.id); U.emit('doc'); } },
      h('img', { src: U.assetUrl(im.assetId), alt: `Variante ${i + 1}`, style: { aspectRatio: `${f.w} / ${f.h}` } }), h('span', { class: 'cmp-label' }, h('b', { text: 'Variante ' + (i + 1) }), h('span', { class: 'muted', text: KIND[im.kind] })))));
  }
  function renderWelcome() {
    const done = [U.refs.length > 0, !!U.profile, U.doc.images.length > 0];
    const step = (i, title, text, btn) => h('li', { class: 'wstep' + (done[i] ? ' done' : '') }, h('span', { class: 'wstep-n' }, done[i] ? U.icon('check', 14) : String(i + 1)), h('div', {}, h('strong', { text: title }), h('span', { text: text })), btn);
    U.fill(welcome, 
      h('h1', { text: 'De vos références à de nouveaux visuels UniPop' }),
      h('ol', { class: 'wsteps' },
        step(0, 'Ajoutez vos références', done[0] ? `${U.refs.length} visuel(s) dans la bibliothèque` : 'Déposez les visuels existants n’importe où dans la fenêtre', U.btn({ label: 'Ajouter des références', class: 'btn-sm', onclick: U.pickRefs })),
        step(1, 'Importez le profil Cameron', done[1] ? `« ${U.profile.name} » appliqué` : 'Le profil de style pilote chaque prompt', U.btn({ label: done[1] ? 'Remplacer' : 'Importer le profil', class: 'btn-sm', onclick: U.pickProfile })),
        step(2, 'Générez un visuel', 'Sujet et format à droite, puis texte et logo en calques', U.btn({ label: 'Générer un visuel', class: 'btn-sm btn-primary', onclick: U.generate }))),
      done[1] ? null : h('button', { type: 'button', class: 'link', text: 'Découvrir le studio avec le profil d’exemple', onclick: U.loadExample }));
  }

  function render() {
    const d = U.doc, present = U.ui.present, hasContent = d.images.length || d.layers.length;
    const compare = U.ui.compare && d.images.length > 1 && !present;
    root.classList.toggle('is-compare', compare);
    root.classList.toggle('is-empty', !hasContent);
    board.classList.toggle('is-blank', !U.currentImage());
    renderBase();
    stamp.hidden = !(U.currentImage() && U.currentImage().kind === 'mock');
    U.fill(layerBox, ...d.layers.map(layerEl));
    renderStrip();
    compareBox.hidden = !compare; if (compare) renderCompare();
    welcome.hidden = !!hasContent || present; if (!welcome.hidden) renderWelcome();
    const f = U.currentFormat(), i = d.images.findIndex((x) => x.id === d.current);
    U.fill(caption, 
      U.btn({ icon: 'chevron', title: 'Variante précédente', class: 'btn-ghost btn-icon flip', disabled: d.images.length < 2, onclick: () => U.stepImage(-1) }),
      h('span', { text: (d.images.length ? `${i + 1} / ${d.images.length}` : 'Aucun visuel') + `   ${f.label}, ${f.w} × ${f.h}` }),
      U.btn({ icon: 'chevron', title: 'Variante suivante', class: 'btn-ghost btn-icon', disabled: d.images.length < 2, onclick: () => U.stepImage(1) }),
      U.btn({ label: 'Quitter', kbd: 'Échap', class: 'btn-ghost btn-sm', onclick: U.togglePresent }));
    const b = U.ui.busy;
    progress.hidden = !b;
    if (b) U.fill(progress, h('span', { text: b.label }), h('span', { class: 'bar' }, h('i', { style: { width: Math.round((b.done / b.total) * 100) + '%' } })), h('span', { class: 'muted', text: `${b.done} / ${b.total}` }));
    U.$('[data-act=compare]', tools).disabled = d.images.length < 2;
    U.$('[data-act=compare]', tools).setAttribute('aria-pressed', String(compare));
    layout(true);
  }

  /* ---------- interactions ---------- */
  function startLayerDrag(e, id, resize) {
    const L = U.doc.layers.find((l) => l.id === id), b = board.getBoundingClientRect();
    const cx = b.left + (L.x / 100) * b.width, cy = b.top + (L.y / 100) * b.height;
    const start = { x: e.clientX, y: e.clientY, lx: L.x, ly: L.y, w: L.w, size: L.size, dist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 };
    let moved = false;
    const move = (ev) => {
      moved = true;
      if (resize) {
        const k = U.clamp(Math.hypot(ev.clientX - cx, ev.clientY - cy) / start.dist, 0.1, 10);
        L.w = U.clamp(start.w * k, 4, 100);
        if (L.type === 'text') L.size = U.clamp(start.size * k, 1.5, 30);
      } else {
        L.x = U.clamp(start.lx + ((ev.clientX - start.x) / b.width) * 100, 0, 100);
        L.y = U.clamp(start.ly + ((ev.clientY - start.y) / b.height) * 100, 0, 100);
        const sx = Math.abs(L.x - 50) < 1.2, sy = Math.abs(L.y - 50) < 1.2;   // aimantation au centre
        if (sx) L.x = 50; if (sy) L.y = 50;
        guideV.hidden = !sx; guideH.hidden = !sy;
      }
      const el = U.$(`[data-id="${id}"]`, layerBox);
      if (el) { el.style.left = L.x + '%'; el.style.top = L.y + '%'; el.style.width = L.w + '%'; if (L.type === 'text') el.firstChild.style.fontSize = L.size + 'cqw'; }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      guideV.hidden = guideH.hidden = true;
      if (moved) { U.commit(); U.emit('struct'); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function onPointerDown(e) {
    if (e.button > 1 || U.ui.present) return;
    const layer = e.target.closest('.layer');
    if (layer && e.button === 0) {
      const id = layer.dataset.id, resize = !!e.target.closest('[data-handle]');
      if (U.ui.selected !== id) U.select(id);
      e.preventDefault(); startLayerDrag(e, id, resize); return;
    }
    if (e.target.closest('button, .strip, .tools')) return;
    const start = { x: e.clientX, y: e.clientY, px: U.ui.pan.x, py: U.ui.pan.y };
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      moved = true; viewport.classList.add('is-panning');
      U.ui.pan = { x: start.px + ev.clientX - start.x, y: start.py + ev.clientY - start.y }; layout(false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      viewport.classList.remove('is-panning');
      if (!moved && U.ui.selected) U.select(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function onWheel(e) {
    if (U.ui.compare) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) U.zoomBy(Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
    else { U.ui.pan.x -= e.deltaX; U.ui.pan.y -= e.deltaY; layout(false); }
  }

  U.stage = {
    mount(el) {
      root = el;
      guideV = h('i', { class: 'guide guide-v', hidden: true }); guideH = h('i', { class: 'guide guide-h', hidden: true });
      baseBox = h('div', { class: 'base' }); layerBox = h('div', { class: 'layers' });
      stamp = h('span', { class: 'demo-stamp', text: U.DEMO_LABEL, hidden: true });
      board = h('div', { class: 'board' }, baseBox, layerBox, stamp, guideV, guideH);
      welcome = h('section', { class: 'welcome' });
      compareBox = h('div', { class: 'compare', hidden: true });
      viewport = h('div', { class: 'viewport', onpointerdown: onPointerDown, ondblclick: (e) => { if (e.target.closest('.layer-text')) { const t = U.$('#layer-text-input'); if (t) { t.focus(); t.select(); } } } }, board, welcome, compareBox);
      viewport.addEventListener('wheel', onWheel, { passive: false });
      zoomLabel = h('button', { type: 'button', class: 'zoom-label', title: 'Ajuster à la fenêtre (0)', onclick: U.fitView });
      tools = h('div', { class: 'tools glass' },
        U.btn({ icon: 'minus', title: 'Dézoomer (−)', class: 'btn-ghost btn-icon', onclick: () => U.zoomBy(1 / 1.25) }), zoomLabel,
        U.btn({ icon: 'plus', title: 'Zoomer (+)', class: 'btn-ghost btn-icon', onclick: () => U.zoomBy(1.25) }),
        U.btn({ icon: 'fit', title: 'Ajuster à la fenêtre (0)', class: 'btn-ghost btn-icon', onclick: U.fitView }),
        h('span', { class: 'sep' }),
        h('button', { type: 'button', class: 'btn btn-ghost', 'data-act': 'compare', title: 'Comparer les variantes (C)', onclick: U.toggleCompare }, U.icon('compare'), h('span', { text: 'Comparer' })));
      strip = h('div', { class: 'strip glass', hidden: true });
      progress = h('div', { class: 'progress glass', hidden: true, role: 'status' });
      caption = h('div', { class: 'caption glass' });
      root.append(viewport, tools, strip, progress, caption);
      new ResizeObserver(() => { layout(false); if (U.ui.compare) renderCompare(); }).observe(viewport);
      U.on('doc', render); U.on('ui', render); U.on('refs', () => { if (!welcome.hidden) renderWelcome(); });
    },
    render
  };
  U.toggleCompare = function () {
    if (U.doc.images.length < 2) return U.toast('Il faut au moins deux variantes pour comparer');
    U.ui.compare = !U.ui.compare; if (U.ui.compare) U.ui.selected = null; U.emit('doc', 'struct');
  };
})();
