/* Démarrage, barre supérieure, génération, commandes et raccourcis clavier. */
(function () {
  const U = window.UVS, { h, $ } = U;

  /* ---------- génération ---------- */
  let consent = false;
  U.generate = async function () {
    if (U.ui.busy) return;
    const d = U.doc, gen = U.generators[d.provider] || U.generators.mock;
    if (!gen.available) return U.toast(gen.label + ' n’est pas connecté dans cette version', 'error');
    if (gen.kind === 'ai' && !consent) {
      consent = await U.confirm('Envoyer le prompt ?', `Le prompt de génération sera envoyé à ${gen.label} par l’intermédiaire du service UniPop. Aucune image de référence n’est transmise.`, 'Envoyer et générer');
      if (!consent) return;
    }
    const f = U.currentFormat(), b = U.buildPrompt();
    U.ui.busy = { label: gen.kind === 'mock' ? 'Composition des maquettes' : 'Génération en cours', done: 0, total: d.count };
    U.ui.compare = false; U.emit('ui');
    try {
      const out = await gen.generate({ prompt: b.prompt, negative: b.negative, width: f.w, height: f.h, count: d.count, profile: U.profile, onProgress: (done, total) => { U.ui.busy.done = done; U.ui.busy.total = total; U.stage.render(); } });
      let first = null;
      for (const o of out) { const id = U.uid(); d.images.push({ id, assetId: await U.assetPut(o.blob, 'image'), kind: gen.kind, label: d.subject.trim().slice(0, 60) }); first = first || id; }
      if (first) d.current = first;
      if (d.textOn && d.textMode === 'layer' && d.textContent.trim() && !d.layers.some((l) => l.type === 'text'))
        d.layers.push({ id: U.uid(), type: 'text', text: d.textContent.trim(), x: 50, y: { top: 14, center: 50, bottom: 85 }[d.textPlace], w: 80, size: 7, weight: 700, align: 'center', color: '#141414', font: 'brand', upper: false });
      U.commit();
      U.toast(gen.kind === 'mock' ? `${out.length} maquette(s) de démonstration` : `${out.length} visuel(s) généré(s)`);
    } catch (e) { U.toast('Génération impossible : ' + e.message, 'error'); }
    U.ui.busy = null; U.emit('doc', 'ui');
  };

  /* ---------- présentation ---------- */
  U.togglePresent = function () {
    U.ui.present = !U.ui.present;
    document.body.classList.toggle('presenting', U.ui.present);
    U.ui.selected = null; U.ui.compare = false; U.ui.zoom = 1; U.ui.pan = { x: 0, y: 0 };
    try { if (U.ui.present) document.documentElement.requestFullscreen().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* plein écran indisponible */ }
    U.emit('ui');
  };
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && U.ui.present) U.togglePresent(); });

  /* ---------- barre supérieure ---------- */
  function topbar() {
    U.fill($('#topbar'), 
      h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i')), h('span', { class: 'brand-name' }, h('b', { text: 'UniPop' }), ' Visual Studio'), h('span', { class: 'chip', text: 'v0.1 démo' })),
      h('button', { type: 'button', class: 'cmd-trigger', onclick: U.showPalette }, U.icon('search', 15), h('span', { text: 'Rechercher une action' }), h('kbd', { text: U.mod + ' K' })),
      h('div', { class: 'top-actions' },
        h('span', { class: 'local', title: 'Références, profil et visuels restent dans ce navigateur. Rien n’est envoyé sans action de votre part.' }, U.icon('lock', 13), h('span', { text: 'Données locales' })),
        h('span', { class: 'save' + (U.ui.saved ? ' ok' : ''), id: 'save', text: U.ui.saved ? 'Enregistré' : 'Enregistrement…' }),
        U.btn({ icon: 'undo', title: `Annuler (${U.mod} Z)`, class: 'btn-ghost btn-icon', disabled: !U.history.canUndo(), onclick: () => U.history.go(-1) }),
        U.btn({ icon: 'redo', title: `Rétablir (${U.mod} ⇧ Z)`, class: 'btn-ghost btn-icon', disabled: !U.history.canRedo(), onclick: () => U.history.go(1) }),
        U.btn({ icon: U.ui.theme === 'dark' ? 'sun' : 'moon', title: U.ui.theme === 'dark' ? 'Thème clair (D)' : 'Thème sombre (D)', class: 'btn-ghost btn-icon', onclick: () => U.setTheme(U.ui.theme === 'dark' ? 'light' : 'dark') }),
        U.btn({ icon: 'help', title: 'Raccourcis clavier (?)', class: 'btn-ghost btn-icon', onclick: U.showShortcuts }),
        U.btn({ label: 'Présenter', icon: 'present', title: 'Mode présentation (F)', onclick: U.togglePresent })));
  }
  function leftPanel() {
    const left = $('#left'), tab = U.ui.leftTab;
    let body = $('.panel-body', left);
    if (!body) {
      body = h('div', { class: 'panel-body' }); left.append(h('div', { class: 'tabs', role: 'tablist' }), body);
    }
    U.fill($('.tabs', left), ...[['refs', 'Références', U.refs.length || ''], ['profile', 'Profil de style', U.profile ? '●' : '']].map(([v, l, n]) =>
      h('button', { type: 'button', role: 'tab', class: 'tab' + (tab === v ? ' on' : ''), 'aria-selected': String(tab === v), onclick: () => { U.ui.leftTab = v; U.persist(); U.emit('ui'); } }, l, n ? h('span', { class: 'count' + (n === '●' ? ' dot' : ''), text: n }) : null)));
    const pane = tab === 'refs' ? panes.refs : panes.profile;
    if (body.firstChild !== pane) U.fill(body, pane);
  }
  const panes = {};

  /* ---------- commandes ---------- */
  U.commands = () => [
    { l: 'Ajouter des références', k: 'I', i: 'upload', run: U.pickRefs },
    { l: 'Analyser le style : préparer le brief pour Cameron', i: 'palette', run: U.showAnalysis },
    { l: 'Importer le profil Cameron', i: 'file', run: U.pickProfile },
    { l: 'Coller le profil Cameron (JSON)', i: 'code', run: U.showPasteProfile },
    { l: 'Charger le profil d’exemple', i: 'file', run: U.loadExample },
    ...(U.profile ? [{ l: 'Modifier le profil de style', i: 'edit', run: U.editProfile }] : []),
    { l: 'Générer un visuel', k: 'G', i: 'wand', run: U.generate },
    { l: 'Voir le prompt', k: 'P', i: 'code', run: U.showPrompt },
    { l: 'Ajouter du texte', k: 'T', i: 'text', run: () => U.addText() },
    { l: 'Ajouter un logo', k: 'L', i: 'badge', run: () => U.addLogo() },
    { l: 'Importer une image sur le plan de travail', i: 'image', run: U.importImages },
    { l: 'Télécharger le visuel', i: 'download', run: U.exportImage },
    { l: 'Comparer les variantes', k: 'C', i: 'compare', run: U.toggleCompare },
    { l: 'Mode présentation', k: 'F', i: 'present', run: U.togglePresent },
    { l: 'Ajuster à la fenêtre', k: '0', i: 'fit', run: U.fitView },
    ...U.allFormats().filter((f) => f.id !== 'custom').map((f) => ({ l: `Format : ${f.label} (${f.w} × ${f.h})`, i: 'image', run: () => { U.doc.formatId = f.id; U.ui.zoom = 1; U.ui.pan = { x: 0, y: 0 }; U.commit(); U.emit('doc', 'struct'); } })),
    { l: 'Annuler', k: U.mod + ' Z', i: 'undo', run: () => U.history.go(-1) },
    { l: 'Rétablir', k: U.mod + ' ⇧ Z', i: 'redo', run: () => U.history.go(1) },
    { l: 'Exporter les références (ZIP)', i: 'download', run: () => U.exportRefsZip(false) },
    { l: U.ui.theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre', k: 'D', i: U.ui.theme === 'dark' ? 'sun' : 'moon', run: () => U.setTheme(U.ui.theme === 'dark' ? 'light' : 'dark') },
    { l: 'Raccourcis clavier', k: '?', i: 'help', run: U.showShortcuts }
  ];

  /* ---------- clavier ---------- */
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === 'k') { e.preventDefault(); return U.showPalette(); }
    if (U.modalOpen()) return;
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === 'Escape') {
      if (typing) return e.target.blur();
      if (U.ui.present) return U.togglePresent();
      if (U.ui.compare) return U.toggleCompare();
      if (U.ui.selected) return U.select(null);
      return;
    }
    if (typing) return;
    if (mod && k === 'z') { e.preventDefault(); return U.history.go(e.shiftKey ? 1 : -1); }
    if (mod && k === 'y') { e.preventDefault(); return U.history.go(1); }
    if (mod || e.altKey) return;
    const L = U.selectedLayer();
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (L) { const s = e.shiftKey ? 5 : 0.5; if (e.key === 'ArrowLeft') L.x -= s; if (e.key === 'ArrowRight') L.x += s; if (e.key === 'ArrowUp') L.y -= s; if (e.key === 'ArrowDown') L.y += s; L.x = U.clamp(L.x, 0, 100); L.y = U.clamp(L.y, 0, 100); U.commit(); U.emit('doc'); }
      else if (e.key === 'ArrowLeft') U.stepImage(-1); else if (e.key === 'ArrowRight') U.stepImage(1);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && L) return U.removeLayer(L.id);
    if (U.ui.present) { if (k === 'f') U.togglePresent(); return; }
    const map = { g: U.generate, p: U.showPrompt, t: () => U.addText(), l: () => U.addLogo(), i: U.pickRefs, c: U.toggleCompare, f: U.togglePresent, d: () => U.setTheme(U.ui.theme === 'dark' ? 'light' : 'dark'), '0': U.fitView, '+': () => U.zoomBy(1.25), '=': () => U.zoomBy(1.25), '-': () => U.zoomBy(0.8), '?': U.showShortcuts };
    if (map[k]) { e.preventDefault(); return map[k](); }
    if (/^[1-9]$/.test(k) && U.doc.images[+k - 1]) { U.ui.compare = false; U.showImage(U.doc.images[+k - 1].id); U.emit('doc'); }
  }

  /* ---------- dépôt de fichiers n'importe où dans la fenêtre ---------- */
  function dragAndDrop() {
    let depth = 0;
    const has = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (!has(e)) return; depth++; document.body.classList.add('dragging'); });
    window.addEventListener('dragleave', (e) => { if (!has(e)) return; depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
    window.addEventListener('dragover', (e) => { if (has(e)) e.preventDefault(); });
    window.addEventListener('drop', async (e) => {
      if (!has(e)) return;
      e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
      const files = Array.from(e.dataTransfer.files), json = files.filter((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
      if (json.length) return U.importProfileText(await json[0].text(), 'cameron');   // un profil déposé est importé directement
      U.addRefFiles(files);
    });
  }

  /* ---------- démarrage ---------- */
  async function boot() {
    await U.db.open();
    const ws = await U.db.kvGet('workspace');
    if (ws && ws.doc) { Object.assign(U.doc, ws.doc); if (ws.ui) { U.ui.leftTab = ws.ui.leftTab || 'refs'; U.ui.theme = ws.ui.theme || 'dark'; } }
    if (!U.generators[U.doc.provider] || !U.generators[U.doc.provider].available) U.doc.provider = 'mock';
    document.documentElement.dataset.theme = U.ui.theme;
    const saved = await U.db.kvGet('profile');
    if (saved && saved.profile && U.validateProfile(saved.profile).ok) { U.profile = saved.profile; U.profileMeta = saved.meta; }
    await U.loadRefs(); await U.loadAssets();
    U.history.reset(); U.applyAccent();

    U.stage.mount($('#stage')); U.inspector.mount($('#right'));
    panes.refs = h('div', { class: 'pane' }); panes.profile = h('div', { class: 'pane' });
    U.library.mount(panes.refs); U.profilePanel.mount(panes.profile);
    U.on('ui', () => { topbar(); leftPanel(); }); U.on('history', topbar); U.on('refs', leftPanel); U.on('profile', leftPanel);
    U.on('saved', () => { const s = $('#save'); if (s) { s.textContent = U.ui.saved ? 'Enregistré' : 'Enregistrement…'; s.classList.toggle('ok', U.ui.saved); } });

    topbar(); leftPanel(); U.library.render(); U.profilePanel.render(); U.stage.render(); U.inspector.render();
    document.addEventListener('keydown', onKey); dragAndDrop();
    document.body.classList.add('ready');
    if (!U.db.persistent) U.toast('Stockage local indisponible dans ce navigateur : le travail ne sera pas conservé', 'error');
  }
  boot();
})();
