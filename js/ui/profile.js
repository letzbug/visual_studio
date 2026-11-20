/* Profil de style : affichage, édition (formulaire ou JSON), export. */
(function () {
  const U = window.UVS, { h } = U;
  const ROLE = { primary: 'Principale', secondary: 'Secondaire', accent: 'Accent', background: 'Fond', text: 'Texte', neutral: 'Neutre' };
  const SOURCE = { cameron: 'Profil Cameron', example: 'Exemple fictif', manual: 'Modifié dans le studio' };
  let root;

  const conf = (c) => (c ? h('span', { class: 'conf conf-' + c, title: c === 'observed' ? 'Observé dans les références' : 'Hypothèse à confirmer', text: c === 'observed' ? 'observé' : 'hypothèse' }) : null);
  const ul = (items) => (items && items.length ? h('ul', { class: 'plist' }, items.map((t) => h('li', { text: t }))) : null);
  const para = (t) => (t ? h('p', { text: t }) : null);
  function section(title, c, ...content) {
    const kids = content.flat().filter(Boolean);
    if (!kids.length) return null;
    return h('details', { class: 'psec', open: true }, h('summary', {}, U.icon('chevron', 13), h('span', { text: title }), conf(c)), h('div', { class: 'psec-body' }, kids));
  }

  function view(p) {
    const meta = U.profileMeta || {}, t = p.typography || {}, b = p.branding || {}, g = p.generation;
    const font = (label, f) => (f && f.family ? h('p', {}, h('span', { class: 'muted', text: label + ' ' }), [f.family, f.weight, f.case].filter(Boolean).join(', '), ' ', conf(f.confidence)) : null);
    return [
      h('div', { class: 'phead' },
        h('div', {}, h('h2', { text: p.name }), h('span', { class: 'muted', text: `Version ${p.version}` + (p.author ? `, par ${p.author}` : '') })),
        h('span', { class: 'chip' + (meta.source === 'example' ? ' chip-warn' : ' chip-ok'), text: SOURCE[meta.source] || 'Profil' })),
      para(p.description),
      (meta.warnings || []).length ? h('ul', { class: 'warns' }, meta.warnings.map((w) => h('li', { text: w }))) : null,
      h('div', { class: 'swatches' }, p.palette.map((c, i) => h('button', { type: 'button', class: 'swatch', style: { '--c': c.hex, '--ink': U.inkOn(c.hex), '--i': i }, title: 'Copier ' + c.hex, onclick: () => U.copy(c.hex, c.hex + ' copié') },
        h('span', { class: 'swatch-hex', text: c.hex.toUpperCase() }), h('span', { class: 'swatch-name', text: c.name || ROLE[c.role] || '' }),
        c.confidence === 'assumed' ? h('span', { class: 'swatch-q', title: 'Hypothèse à confirmer', text: '?' }) : null))),
      section('Illustration', (p.illustration || {}).confidence, para((p.illustration || {}).style), para((p.illustration || {}).imagery), (p.illustration || {}).keywords ? h('p', { class: 'tags' }, p.illustration.keywords.map((k) => h('span', { class: 'tag', text: k }))) : null),
      section('Composition', (p.composition || {}).confidence, ul((p.composition || {}).rules), ul((p.composition || {}).layouts)),
      section('Typographie', null, font('Titres', t.headings), font('Texte', t.body), para(t.notes)),
      section('Fonds et éléments graphiques', (p.backgrounds || {}).confidence, ul((p.backgrounds || {}).types), para((p.backgrounds || {}).notes), ul(p.graphicElements)),
      section('Logo et marque', null, ul(b.logoRules), b.placement ? h('p', {}, h('span', { class: 'muted', text: 'Position ' }), b.placement) : null, para(b.notes)),
      section('Formats recommandés', null, ul((p.formats || []).map((f) => `${f.label}, ${f.width} × ${f.height} px`))),
      section('Consignes de génération', null, para(g.summary), ul(g.positive), (g.negative || []).length ? h('p', {}, h('span', { class: 'muted', text: 'À éviter ' }), g.negative.join(', ')) : null),
      section('Sujets proposés', null, ul((p.subjects || []).map((s) => s.title + (s.prompt ? ' : ' + s.prompt : '')))),
      section('Points incertains', null, ul(p.uncertainties)),
      h('div', { class: 'lib-foot' },
        h('div', { class: 'row' },
          U.btn({ label: 'Modifier', icon: 'edit', class: 'btn-sm', onclick: U.editProfile }),
          U.btn({ label: 'Exporter', icon: 'download', class: 'btn-sm', onclick: () => U.downloadText(JSON.stringify(p, null, 2), `profil-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.version}.json`) }),
          U.btn({ label: 'Remplacer', icon: 'upload', class: 'btn-sm btn-ghost', onclick: U.pickProfile }),
          U.btn({ icon: 'trash', title: 'Retirer le profil', class: 'btn-sm btn-ghost btn-icon', onclick: async () => { if (await U.confirm('Retirer le profil ?', 'Le profil sera supprimé de ce navigateur. Exportez-le d’abord si vous souhaitez le conserver.', 'Retirer')) { await U.setProfile(null); U.toast('Profil retiré'); } } })))
    ];
  }
  function empty() {
    return h('div', { class: 'pempty' },
      h('span', { class: 'pempty-art', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
      h('h2', { text: 'Aucun profil de style' }),
      h('p', { text: 'Cameron analyse vos références en dehors de l’application et vous remet un profil au format JSON. Une fois importé, il pilote chaque prompt de génération.' }),
      U.btn({ label: 'Importer le profil Cameron', icon: 'file', class: 'btn-primary btn-block', onclick: U.pickProfile }),
      U.btn({ label: 'Coller le JSON', icon: 'code', class: 'btn-block', onclick: U.showPasteProfile }),
      U.btn({ label: 'Préparer l’analyse pour Cameron', icon: 'palette', class: 'btn-block btn-ghost', onclick: U.showAnalysis }),
      h('button', { type: 'button', class: 'link', text: 'Essayer avec le profil d’exemple', onclick: U.loadExample }));
  }

  /* ---------- édition ---------- */
  const LISTS = [['composition.rules', 'Règles de composition'], ['backgrounds.types', 'Types de fonds'], ['graphicElements', 'Éléments graphiques'], ['branding.logoRules', 'Règles de logo'], ['generation.positive', 'Consignes à suivre'], ['generation.negative', 'À éviter'], ['uncertainties', 'Points incertains']];
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); let a = o; ks.forEach((k) => { a = a[k] = a[k] || {}; }); a[last] = v; };

  U.editProfile = function () {
    let p = U.clone(U.profile), tab = 'form';
    const body = h('div'), msg = h('p', { class: 'form-msg', role: 'alert' });
    let jsonTa;
    const txt = (path, label, rows) => h('div', { class: 'field' }, h('label', { class: 'field-label', text: label }),
      rows ? h('textarea', { class: 'input', rows, value: get(p, path) || '', oninput: (e) => set(p, path, e.target.value) }) : h('input', { class: 'input', value: get(p, path) || '', oninput: (e) => set(p, path, e.target.value) }));
    const lines = ([path, label]) => h('div', { class: 'field' }, h('label', { class: 'field-label', text: label + ' (un élément par ligne)' }),
      h('textarea', { class: 'input', rows: 3, value: (get(p, path) || []).join('\n'), oninput: (e) => set(p, path, e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)) }));
    function paletteRows() {
      const box = h('div', { class: 'pal-edit' });
      const draw = () => U.fill(box, ...p.palette.map((c, i) => {
        const hex = h('input', { class: 'input input-hex', value: c.hex, 'aria-label': 'HEX', oninput: (e) => { c.hex = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(c.hex)) col.value = c.hex; } });
        const col = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#888888', 'aria-label': 'Couleur', oninput: (e) => { c.hex = e.target.value.toUpperCase(); hex.value = c.hex; } });
        return h('div', { class: 'pal-row' }, col, hex,
          h('input', { class: 'input', value: c.name || '', placeholder: 'Nom', 'aria-label': 'Nom', oninput: (e) => { c.name = e.target.value; } }),
          h('select', { class: 'input', value: c.role || '', 'aria-label': 'Rôle', onchange: (e) => { if (e.target.value) c.role = e.target.value; else delete c.role; } }, h('option', { value: '', text: 'Rôle' }), Object.keys(ROLE).map((r) => h('option', { value: r, text: ROLE[r] }))),
          h('select', { class: 'input', value: c.confidence || '', 'aria-label': 'Fiabilité', onchange: (e) => { if (e.target.value) c.confidence = e.target.value; else delete c.confidence; } }, h('option', { value: '', text: 'Fiabilité' }), h('option', { value: 'observed', text: 'Observé' }), h('option', { value: 'assumed', text: 'Hypothèse' })),
          U.btn({ icon: 'x', title: 'Supprimer la couleur', class: 'btn-ghost btn-icon btn-sm', disabled: p.palette.length < 2, onclick: () => { p.palette.splice(i, 1); draw(); } }));
      }), U.btn({ label: 'Ajouter une couleur', icon: 'plus', class: 'btn-sm', onclick: () => { p.palette.push({ hex: '#888888', name: '' }); draw(); } }));
      draw(); return box;
    }
    const draw = () => {
      msg.textContent = '';
      const tabs = h('div', { class: 'seg seg-wide' }, [['form', 'Formulaire'], ['json', 'JSON']].map(([v, l]) => h('button', { type: 'button', class: 'seg-btn' + (tab === v ? ' on' : ''), 'aria-pressed': String(tab === v), text: l, onclick: () => {
        if (tab === 'json' && v === 'form') { try { p = JSON.parse(jsonTa.value); } catch (e) { msg.textContent = 'JSON invalide : ' + e.message; return; } if (!Array.isArray(p.palette)) p.palette = []; }
        tab = v; draw();
      } })));
      if (tab === 'json') { jsonTa = h('textarea', { class: 'input code-input', rows: 22, value: JSON.stringify(p, null, 2), 'aria-label': 'JSON du profil', spellcheck: 'false' }); U.fill(body, tabs, jsonTa); return; }
      U.fill(body, tabs,
        h('div', { class: 'grid2' }, txt('name', 'Nom du profil'), txt('version', 'Version')),
        txt('description', 'Description', 2),
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Palette' }), paletteRows()),
        txt('illustration.style', 'Style d’illustration', 2), txt('illustration.imagery', 'Langage visuel', 2),
        h('div', { class: 'grid2' }, txt('typography.headings.family', 'Police des titres'), txt('typography.body.family', 'Police du texte')),
        txt('generation.summary', 'Résumé du style (tête du prompt)'),
        LISTS.map(lines));
    };
    draw();
    const m = U.modal({ title: 'Modifier le profil', cls: 'modal-lg', body: [body, msg], footer: [
      U.btn({ label: 'Annuler', class: 'btn-ghost', onclick: () => m.close() }),
      U.btn({ label: 'Enregistrer le profil', class: 'btn-primary', onclick: async () => {
        if (tab === 'json') { try { p = JSON.parse(jsonTa.value); } catch (e) { msg.textContent = 'JSON invalide : ' + e.message; return; } }
        const v = U.validateProfile(p);
        if (!v.ok) { msg.textContent = v.errors.slice(0, 4).map((e) => `${e.path} ${e.msg}`).join(' ; '); return; }
        const src = (U.profileMeta || {}).source;
        await U.setProfile(p, { source: src === 'example' ? 'example' : 'manual', importedAt: new Date().toISOString(), warnings: v.warnings });
        m.close(); U.toast('Profil enregistré');
      } })] });
  };

  U.profilePanel = {
    mount(el) { root = el; U.on('profile', this.render); },
    render() { U.fill(root, ...[U.profile ? view(U.profile) : empty()].flat().filter(Boolean)); }
  };
})();
