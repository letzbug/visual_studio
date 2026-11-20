/* Bibliothèque de références : dépôt, galerie, marquage, export et import. */
(function () {
  const U = window.UVS, { h } = U;
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  let root;

  const stored = (r) => ({ id: r.id, name: r.name, type: r.type, size: r.size, w: r.w, h: r.h, style: r.style, excluded: r.excluded, added: r.added, blob: r.blob });
  async function makeRef(blob, name, extra) {
    const url = URL.createObjectURL(blob);
    let im; try { im = await U.loadImage(url); } catch (e) { URL.revokeObjectURL(url); return null; }
    return Object.assign({ id: U.uid(), name, type: blob.type, size: blob.size, w: im.naturalWidth, h: im.naturalHeight, style: false, excluded: false, added: Date.now(), blob, url }, extra || {});
  }
  U.loadRefs = async function () {
    U.refs = (await U.db.all('refs')).sort((a, b) => a.added - b.added).map((r) => Object.assign(r, { url: URL.createObjectURL(r.blob) }));
  };
  U.addRefFiles = async function (files) {
    const ok = files.filter((f) => TYPES.includes(f.type)), skipped = files.length - ok.length;
    let n = 0;
    for (const f of ok) { const r = await makeRef(f, f.name); if (!r) continue; U.refs.push(r); await U.db.put('refs', stored(r)); n++; }
    if (n) { U.ui.leftTab = 'refs'; U.ui.refFilter = 'all'; U.toast(n + (n > 1 ? ' références ajoutées' : ' référence ajoutée')); }
    if (skipped) U.toast(skipped + ' fichier(s) ignoré(s) : formats acceptés PNG, JPG, WebP', 'error');
    U.emit('refs', 'ui');
  };
  U.pickRefs = async () => U.addRefFiles(await U.pickFiles(TYPES.join(','), true));
  const update = (r) => { U.db.put('refs', stored(r)); U.emit('refs'); };
  const remove = (r) => { U.refs = U.refs.filter((x) => x !== r); U.db.del('refs', r.id); URL.revokeObjectURL(r.url); if (U.ui.refSelected === r.id) U.ui.refSelected = null; U.emit('refs'); U.toast('Référence retirée'); };
  async function replace(r) {
    const [f] = await U.pickFiles(TYPES.join(','));
    if (!f) return;
    const n = await makeRef(f, f.name);
    if (!n) return U.toast('Image illisible', 'error');
    URL.revokeObjectURL(r.url);
    Object.assign(r, { name: n.name, type: n.type, size: n.size, w: n.w, h: n.h, blob: n.blob, url: n.url });
    update(r); U.toast('Référence remplacée');
  }

  U.exportRefsZip = async function (includedOnly) {
    const refs = U.refs.filter((r) => !includedOnly || !r.excluded);
    if (!refs.length) return U.toast('Aucune référence à exporter', 'error');
    const seen = {}, files = refs.map((r) => { let n = r.name; if (seen[n]) n = n.replace(/(\.\w+)?$/, `-${seen[r.name]}$1`); seen[r.name] = (seen[r.name] || 0) + 1; return { name: n, blob: r.blob }; });
    const manifest = { schema: 'unipop.references-manifest/1', exportedAt: new Date().toISOString(), items: refs.map((r, i) => ({ file: files[i].name, width: r.w, height: r.h, styleReference: r.style, excluded: r.excluded })) };
    files.push({ name: 'manifest.json', blob: new Blob([JSON.stringify(manifest, null, 2)]) });
    U.download(await U.zip(files), 'unipop-references.zip');
  };
  U.exportRefsJson = async function () {
    if (!U.refs.length) return U.toast('Aucune référence à exporter', 'error');
    const items = [];
    for (const r of U.refs) items.push({ name: r.name, type: r.type, style: r.style, excluded: r.excluded, dataUrl: await U.blobToDataURL(r.blob) });
    U.downloadText(JSON.stringify({ schema: 'unipop.references/1', exportedAt: new Date().toISOString(), items }), 'unipop-references.collection.json');
  };
  U.importRefsJson = async function () {
    const [f] = await U.pickFiles('.json,application/json');
    if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch (e) { data = null; }
    if (!data || data.schema !== 'unipop.references/1' || !Array.isArray(data.items)) return U.toast('Ce fichier n’est pas une collection de références UniPop', 'error');
    let n = 0;
    for (const it of data.items) {
      const r = await makeRef(await U.dataURLToBlob(it.dataUrl), it.name, { style: !!it.style, excluded: !!it.excluded });
      if (r) { U.refs.push(r); await U.db.put('refs', stored(r)); n++; }
    }
    U.toast(n + ' référence(s) importée(s)'); U.emit('refs');
  };
  U.useRefAsImage = async function (r) {
    const assetId = await U.assetPut(r.blob, 'image'), id = U.uid();
    U.doc.images.push({ id, assetId, kind: 'import', label: r.name }); U.doc.current = id; U.ui.compare = false;
    U.commit(); U.emit('doc', 'struct'); U.toast('Référence placée sur le plan de travail');
  };

  function thumb(r) {
    const act = (icon, title, fn, on) => h('button', { type: 'button', class: 'thumb-act' + (on ? ' on' : ''), title, 'aria-label': title, 'aria-pressed': on == null ? null : String(!!on), onclick: (e) => { e.stopPropagation(); fn(); } }, U.icon(icon, 14));
    return h('li', { class: 'thumb' + (r.excluded ? ' is-excluded' : '') + (U.ui.refSelected === r.id ? ' is-selected' : '') },
      h('button', { type: 'button', class: 'thumb-img', title: r.name, onclick: () => { U.ui.refSelected = U.ui.refSelected === r.id ? null : r.id; U.emit('refs'); } }, h('img', { src: r.url, alt: r.name, loading: 'lazy', draggable: 'false' })),
      r.style ? h('span', { class: 'thumb-flag', title: 'Référence de style' }, U.icon('star', 11)) : null,
      r.excluded ? h('span', { class: 'thumb-flag thumb-flag-off', title: 'Exclue de l’analyse' }, U.icon('eyeoff', 11)) : null,
      h('div', { class: 'thumb-acts' },
        act('star', r.style ? 'Ne plus marquer comme référence de style' : 'Marquer comme référence de style', () => { r.style = !r.style; update(r); }, r.style),
        act(r.excluded ? 'eyeoff' : 'eye', r.excluded ? 'Inclure dans l’analyse' : 'Exclure de l’analyse', () => { r.excluded = !r.excluded; update(r); }, r.excluded),
        act('trash', 'Retirer', () => remove(r))));
  }
  function detail(r) {
    return h('div', { class: 'ref-detail' },
      h('div', { class: 'ref-meta' }, h('strong', { text: r.name, title: r.name }), h('span', { class: 'muted', text: `${r.w} × ${r.h} px, ${U.fmtSize(r.size)}` })),
      h('div', { class: 'row' },
        U.btn({ label: 'Utiliser comme fond', icon: 'image', class: 'btn-sm', onclick: () => U.useRefAsImage(r) }),
        U.btn({ icon: 'swap', title: 'Remplacer', class: 'btn-sm btn-icon', onclick: () => replace(r) }),
        U.btn({ icon: 'download', title: 'Exporter cette image', class: 'btn-sm btn-icon', onclick: () => U.download(r.blob, r.name) })));
  }

  U.library = {
    mount(el) { root = el; U.on('refs', this.render); },
    render() {
      const all = U.refs, f = U.ui.refFilter;
      const counts = { all: all.length, style: all.filter((r) => r.style).length, off: all.filter((r) => r.excluded).length };
      const list = f === 'style' ? all.filter((r) => r.style) : f === 'off' ? all.filter((r) => r.excluded) : all;
      const sel = all.find((r) => r.id === U.ui.refSelected);
      const drop = h('button', { type: 'button', class: 'dropzone' + (all.length ? ' is-compact' : ''), onclick: U.pickRefs },
        h('span', { class: 'dropzone-art', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('strong', { text: all.length ? 'Ajouter des références' : 'Déposez vos visuels UniPop ici' }),
        h('span', { class: 'muted', text: all.length ? 'Glisser-déposer ou cliquer' : 'PNG, JPG ou WebP. Plusieurs fichiers à la fois, ou cliquez pour parcourir.' }));
      const chip = (v, l) => h('button', { type: 'button', class: 'chip-btn' + (f === v ? ' on' : ''), 'aria-pressed': String(f === v), onclick: () => { U.ui.refFilter = v; U.emit('refs'); } }, l, h('span', { class: 'count', text: counts[v] }));
      U.fill(root, 
        drop,
        all.length ? h('div', { class: 'filters' }, chip('all', 'Toutes'), chip('style', 'Style'), chip('off', 'Exclues')) : null,
        all.length ? (list.length ? h('ul', { class: 'thumbs' }, list.map(thumb)) : h('p', { class: 'empty-line', text: f === 'style' ? 'Marquez d’une étoile les visuels les plus représentatifs.' : 'Aucune référence exclue de l’analyse.' })) : null,
        sel ? detail(sel) : null,
        h('div', { class: 'lib-foot' },
          U.btn({ label: 'Analyser le style', icon: 'palette', class: 'btn-primary btn-block', disabled: !all.length, onclick: U.showAnalysis }),
          h('div', { class: 'row row-spread' },
            U.btn({ label: 'Exporter (ZIP)', icon: 'download', class: 'btn-sm btn-ghost', disabled: !all.length, onclick: () => U.exportRefsZip(false) }),
            U.btn({ label: 'Collection', icon: 'download', title: 'Exporter la collection réimportable (.json)', class: 'btn-sm btn-ghost', disabled: !all.length, onclick: U.exportRefsJson }),
            U.btn({ label: 'Importer', icon: 'upload', title: 'Importer une collection (.json)', class: 'btn-sm btn-ghost', onclick: U.importRefsJson })),
          h('p', { class: 'note' }, U.icon('lock', 13), U.db.persistent ? 'Enregistrées sur cet ordinateur uniquement.' : 'Stockage local indisponible : les références seront perdues à la fermeture.'))
      );
    }
  };
})();
