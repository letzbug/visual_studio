/* État de l'application, historique (annuler/rétablir), sauvegarde automatique. */
(function () {
  const U = window.UVS;

  U.FORMATS = [
    { id: 'ig-1x1', label: 'Instagram carré', ratio: '1:1', w: 1080, h: 1080 },
    { id: 'ig-4x5', label: 'Instagram portrait', ratio: '4:5', w: 1080, h: 1350 },
    { id: 'story-9x16', label: 'Story', ratio: '9:16', w: 1080, h: 1920 },
    { id: 'fb-16x9', label: 'Facebook', ratio: '16:9', w: 1920, h: 1080 },
    { id: 'custom', label: 'Personnalisé', ratio: 'libre', w: 0, h: 0 }
  ];
  U.FONTS = [
    { id: 'brand', label: 'Police de marque' },
    { id: 'sans', label: 'Sans-serif', stack: 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif' },
    { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
    { id: 'round', label: 'Arrondie', stack: '"Arial Rounded MT Bold", "Varela Round", "Nunito", system-ui, sans-serif' },
    { id: 'cond', label: 'Étroite', stack: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif' }
  ];
  U.brandFamily = () => (U.profile && U.profile.typography && U.profile.typography.headings && U.profile.typography.headings.family) || 'Gotham';
  U.fontStack = function (id) {
    const f = U.FONTS.find((x) => x.id === id);
    if (f && f.stack) return f.stack;
    return `"${U.brandFamily().replace(/"/g, '')}", "Gotham", "Montserrat", "Avenir Next", "Century Gothic", system-ui, sans-serif`;
  };

  const freshDoc = () => ({
    subject: '', formatId: 'ig-1x1', custom: { w: 1200, h: 800 }, count: 2,
    textOn: false, textMode: 'layer', textContent: '', textPlace: 'bottom',
    promptLang: 'en', provider: 'mock',
    images: [], current: null, layers: [],
    exp: { type: 'png', quality: 0.92, scale: 1, layers: true, name: 'unipop-visuel' }
  });

  U.refs = [];
  U.profile = null;
  U.profileMeta = null;
  U.doc = freshDoc();
  U.ui = { leftTab: 'refs', rightTab: 'compose', refFilter: 'all', refSelected: null, selected: null, compare: false, present: false, zoom: 1, pan: { x: 0, y: 0 }, theme: 'dark', busy: null, saved: true };

  /* ---------- événements ---------- */
  const subs = {};
  U.on = (evt, fn) => { (subs[evt] = subs[evt] || []).push(fn); };
  U.emit = (...evts) => evts.forEach((e) => (subs[e] || []).forEach((fn) => fn()));

  /* ---------- formats ---------- */
  U.allFormats = function () {
    const extra = ((U.profile && U.profile.formats) || []).map((f, i) => ({ id: 'p:' + i, label: f.label, ratio: 'profil', w: f.width, h: f.height, fromProfile: true }))
      .filter((f) => !U.FORMATS.some((b) => b.w === f.w && b.h === f.h));
    return [...U.FORMATS.slice(0, 4), ...extra, U.FORMATS[4]];
  };
  U.currentFormat = function () {
    const d = U.doc;
    if (d.formatId === 'custom') return { id: 'custom', label: 'Personnalisé', ratio: 'libre', w: U.clamp(+d.custom.w || 1080, 64, 8000), h: U.clamp(+d.custom.h || 1080, 64, 8000) };
    return U.allFormats().find((f) => f.id === d.formatId) || U.FORMATS[0];
  };
  U.currentImage = () => U.doc.images.find((i) => i.id === U.doc.current) || null;
  U.selectedLayer = () => U.doc.layers.find((l) => l.id === U.ui.selected) || null;

  /* ---------- ressources binaires (visuels, logos) ---------- */
  const assets = new Map();
  U.assetPut = async function (blob, kind) {
    const id = U.uid();
    assets.set(id, { blob, url: URL.createObjectURL(blob) });
    await U.db.put('assets', { id, kind, blob });
    return id;
  };
  U.assetUrl = (id) => (assets.get(id) || {}).url || '';
  U.assetBlob = (id) => (assets.get(id) || {}).blob || null;
  U.loadAssets = async function () {
    const used = new Set([...U.doc.images.map((i) => i.assetId), ...U.doc.layers.map((l) => l.assetId).filter(Boolean)]);
    for (const a of await U.db.all('assets')) {
      if (!used.has(a.id)) { U.db.del('assets', a.id); continue; }   // ménage au démarrage
      assets.set(a.id, { blob: a.blob, url: URL.createObjectURL(a.blob) });
    }
    U.doc.images = U.doc.images.filter((i) => assets.has(i.assetId));
    U.doc.layers = U.doc.layers.filter((l) => l.type !== 'logo' || assets.has(l.assetId));
    if (!U.currentImage()) U.doc.current = U.doc.images.length ? U.doc.images[0].id : null;
  };

  /* ---------- historique ---------- */
  let stack = [], index = -1;
  const save = U.debounce(async () => {
    await U.db.kvSet('workspace', { doc: U.doc, ui: { leftTab: U.ui.leftTab, theme: U.ui.theme } });
    U.ui.saved = true; U.emit('saved');
  }, 500);
  U.persist = function () { U.ui.saved = false; U.emit('saved'); save(); };
  U.history = {
    reset() { stack = [JSON.stringify(U.doc)]; index = 0; },
    canUndo: () => index > 0, canRedo: () => index < stack.length - 1,
    go(step) {
      const n = index + step;
      if (n < 0 || n >= stack.length) return;
      index = n; U.doc = JSON.parse(stack[index]);
      if (!U.selectedLayer()) U.ui.selected = null;
      U.persist(); U.emit('doc', 'struct', 'history');
    }
  };
  /* À appeler après chaque modification terminée du document. */
  U.commit = function () {
    const snap = JSON.stringify(U.doc);
    if (snap === stack[index]) return;
    stack = stack.slice(0, index + 1); stack.push(snap);
    if (stack.length > 80) stack.shift();
    index = stack.length - 1;
    U.persist(); U.emit('history');
  };
  U.resetDoc = function () { U.doc = freshDoc(); U.ui.selected = null; U.commit(); U.emit('doc', 'struct'); };

  /* ---------- profil ---------- */
  U.setProfile = async function (profile, meta) {
    U.profile = profile; U.profileMeta = profile ? meta : null;
    await U.db.kvSet('profile', profile ? { profile, meta } : null);
    U.applyAccent(); U.emit('profile', 'doc', 'struct');
  };

  /* L'accent de l'interface reprend la couleur principale du profil importé. */
  U.applyAccent = function () {
    const dark = U.ui.theme === 'dark', bg = dark ? '#1C1D20' : '#EFEEEB';
    let c = dark ? '#F2C14E' : '#8A6A0A';
    if (U.profile) {
      const p = U.profile.palette;
      c = (p.find((x) => x.role === 'primary') || p.find((x) => x.role === 'accent') || p[0]).hex;
    }
    for (let n = 0; n < 12 && U.contrast(c, bg) < 3.2; n++) c = U.mix(c, dark ? '#FFFFFF' : '#000000', 0.14);
    const s = document.documentElement.style;
    s.setProperty('--accent', c); s.setProperty('--accent-ink', U.inkOn(c));
  };
  U.setTheme = function (t) {
    U.ui.theme = t; document.documentElement.dataset.theme = t;
    U.applyAccent(); U.persist(); U.emit('ui');
  };
})();
