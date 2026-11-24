/* Réglages contextuels : Composer (sujet, format, style), Habiller (calques), Exporter. */
(function () {
  const U = window.UVS, { h } = U;
  let root;
  const NEUTRAL = [
    { title: 'Apprendre ensemble', prompt: 'Un groupe d’adultes réunis autour d’une table pendant un atelier, ambiance conviviale' },
    { title: 'Langues', prompt: 'Deux personnes en conversation, échange de bulles de dialogue stylisées sans texte' },
    { title: 'Numérique', prompt: 'Une personne qui découvre un ordinateur portable, entourée de formes abstraites' },
    { title: 'Créativité', prompt: 'Des mains qui dessinent, peignent et découpent sur une grande table d’atelier' },
    { title: 'Bien-être', prompt: 'Une personne détendue en mouvement, formes souples et aérées' },
    { title: 'Vie citoyenne', prompt: 'Des silhouettes variées qui se retrouvent sur une place publique' }
  ];

  const field = (label, ...c) => h('div', { class: 'field' }, label ? h('span', { class: 'field-label', text: label }) : null, ...c);
  const seg = (opts, val, on, cls) => h('div', { class: 'seg ' + (cls || ''), role: 'group' }, opts.map(([v, l, title]) => h('button', { type: 'button', class: 'seg-btn' + (v === val ? ' on' : ''), 'aria-pressed': String(v === val), title, text: l, onclick: () => on(v) })));
  const slider = (label, min, max, step, val, fmt, live) => {
    const out = h('output', { text: fmt(val) });
    return h('div', { class: 'field' }, h('div', { class: 'field-row' }, h('span', { class: 'field-label', text: label }), out),
      h('input', { type: 'range', min, max, step, value: val, 'aria-label': label, oninput: (e) => { const v = +e.target.value; out.textContent = fmt(v); live(v); }, onchange: () => U.commit() }));
  };
  const toggle = (label, on, cb) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => cb(e.target.checked) }), h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', { text: label }));
  /* Modifie le document, rafraîchit la vue et enregistre l'étape dans l'historique. */
  const apply = (fn, struct) => { fn(); U.commit(); U.emit(...(struct === false ? ['doc'] : ['doc', 'struct'])); };

  /* ---------- Composer ---------- */
  function compose() {
    const d = U.doc, p = U.profile, cur = U.currentFormat();
    const ta = h('textarea', { class: 'input', rows: 3, id: 'subject', placeholder: 'Décrivez le visuel souhaité (facultatif)', 'aria-label': 'Sujet ou thème', value: d.subject, oninput: (e) => { d.subject = e.target.value; }, onchange: () => U.commit() });
    const ideas = [...((p && p.subjects) || []).map((s) => ({ title: s.title, prompt: s.prompt || s.title })), ...NEUTRAL].slice(0, 6);
    const fmt = (f) => {
      const on = d.formatId === f.id, w = f.id === 'custom' ? +d.custom.w || 1 : f.w, hh = f.id === 'custom' ? +d.custom.h || 1 : f.h;
      return h('button', { type: 'button', class: 'fmt' + (on ? ' on' : ''), 'aria-pressed': String(on), title: f.id === 'custom' ? 'Dimensions libres' : `${f.w} × ${f.h} px`, onclick: () => apply(() => { d.formatId = f.id; U.ui.zoom = 1; U.ui.pan = { x: 0, y: 0 }; }) },
        h('span', { class: 'fmt-box' }, h('i', { style: { aspectRatio: `${w} / ${hh}`, [w >= hh ? 'width' : 'height']: '100%' } })),
        h('span', { class: 'fmt-name', text: f.label }), h('span', { class: 'fmt-ratio', text: f.ratio }));
    };
    const num = (k) => h('input', { class: 'input', type: 'number', min: 64, max: 8000, value: d.custom[k], 'aria-label': k === 'w' ? 'Largeur en pixels' : 'Hauteur en pixels', oninput: (e) => { d.custom[k] = U.clamp(+e.target.value || 64, 64, 8000); U.emit('doc'); }, onchange: () => U.commit() });
    const styleCard = p
      ? h('button', { type: 'button', class: 'style-card', title: 'Afficher le profil', onclick: () => { U.ui.leftTab = 'profile'; U.emit('ui'); } },
        h('span', { class: 'style-dots' }, p.palette.slice(0, 6).map((c) => h('i', { style: { background: c.hex } }))),
        h('span', { class: 'style-name' }, h('strong', { text: p.name }), h('span', { class: 'muted', text: 'Version ' + p.version })), U.icon('chevron', 14))
      : h('div', { class: 'style-card is-missing' }, h('span', { class: 'style-name' }, h('strong', { text: 'Aucun profil importé' }), h('span', { class: 'muted', text: 'Le prompt reste neutre, sans identité UniPop.' })), U.btn({ label: 'Importer', class: 'btn-sm', onclick: U.pickProfile }));
    const gens = Object.values(U.generators);
    return [
      field('Sujet ou thème', ta,
        h('div', { class: 'ideas' }, ideas.map((s) => h('button', { type: 'button', class: 'chip-btn', title: s.prompt, text: s.title, onclick: () => { d.subject = s.prompt; ta.value = s.prompt; U.commit(); } })))),
      field('Format', h('div', { class: 'fmts' }, U.allFormats().map(fmt)),
        d.formatId === 'custom' ? h('div', { class: 'grid2 custom-size' }, num('w'), num('h')) : h('p', { class: 'muted small', text: `${cur.w} × ${cur.h} px` })),
      field('Style', styleCard),
      field('Variantes', seg([[1, '1'], [2, '2'], [3, '3'], [4, '4']], d.count, (v) => apply(() => { d.count = v; }))),
      h('div', { class: 'group' },
        toggle('Texte sur l’image', d.textOn, (v) => apply(() => { d.textOn = v; })),
        d.textOn ? [
          h('textarea', { class: 'input', rows: 2, placeholder: 'Titre ou message', 'aria-label': 'Texte sur l’image', value: d.textContent, oninput: (e) => { d.textContent = e.target.value; }, onchange: () => U.commit() }),
          seg([['layer', 'Calque éditable', 'Le texte reste modifiable et net ; l’image est générée sans texte'], ['baked', 'Intégré à l’image', 'Le texte est demandé au modèle d’images, il ne sera plus modifiable']], d.textMode, (v) => apply(() => { d.textMode = v; }), 'seg-wide'),
          d.textMode === 'layer' ? field('Zone réservée au texte', seg([['top', 'Haut'], ['center', 'Centre'], ['bottom', 'Bas']], d.textPlace, (v) => apply(() => { d.textPlace = v; }), 'seg-wide')) : h('p', { class: 'note' }, U.icon('info', 13), 'Les modèles d’images font souvent des fautes dans le texte. Le calque éditable est plus fiable.')
        ] : h('p', { class: 'muted small', text: 'Désactivé : le visuel est créé sans aucun texte.' })),
      h('details', { class: 'more' }, h('summary', {}, U.icon('chevron', 13), 'Options de génération'),
        field('Moteur', h('select', { class: 'input', value: d.provider, 'aria-label': 'Moteur de génération', onchange: (e) => apply(() => { d.provider = e.target.value; }) },
          gens.map((g) => h('option', { value: g.id, disabled: !g.available, text: g.label + (g.available ? '' : ' (non connecté)') })))),
        toggle('Envoyer les références de style (max. 3)', !!d.useRefs, (v) => apply(() => { d.useRefs = v; })),
        field('Langue du prompt', seg([['en', 'Anglais'], ['fr', 'Français']], d.promptLang, (v) => apply(() => { d.promptLang = v; }), 'seg-wide')))
    ];
  }
  function composeFoot() {
    const g = U.generators[U.doc.provider], busy = !!U.ui.busy;
    return [
      h('p', { class: 'note' }, U.icon('info', 13), g.kind === 'mock' ? 'Mode démo : le studio compose une maquette abstraite aux couleurs du profil. Aucune IA n’est appelée.' : `Le prompt sera envoyé à ${g.label} via le service UniPop. Les références marquées de style sont envoyées uniquement si l’option est activée.`),
      h('div', { class: 'row' },
        U.btn({ label: 'Voir le prompt', icon: 'code', onclick: U.showPrompt }),
        U.btn({ label: busy ? 'Génération…' : 'Générer un visuel', icon: 'wand', class: 'btn-primary btn-grow', disabled: busy, onclick: U.generate }))
    ];
  }

  /* ---------- Habiller ---------- */
  function swatches(L) {
    const pal = [...((U.profile && U.profile.palette) || []).map((c) => c.hex), '#FFFFFF', '#141414'];
    return h('div', { class: 'colors' }, [...new Set(pal.map((x) => x.toUpperCase()))].map((c) => h('button', { type: 'button', class: 'color' + (L.color.toUpperCase() === c ? ' on' : ''), style: { background: c }, title: c, 'aria-label': 'Couleur ' + c, onclick: () => apply(() => { L.color = c; }) })),
      h('input', { type: 'color', value: L.color, 'aria-label': 'Autre couleur', oninput: (e) => { L.color = e.target.value; U.emit('doc'); }, onchange: () => U.commit() }));
  }
  function textProps(L) {
    return [
      h('textarea', { class: 'input', id: 'layer-text-input', rows: 2, 'aria-label': 'Texte du calque', value: L.text, oninput: (e) => { L.text = e.target.value; U.emit('doc'); }, onchange: () => { U.commit(); U.emit('struct'); } }),
      field('Police', h('select', { class: 'input', value: L.font, 'aria-label': 'Police', onchange: (e) => apply(() => { L.font = e.target.value; }) }, U.FONTS.map((f) => h('option', { value: f.id, text: f.id === 'brand' ? `${f.label} (${U.brandFamily()})` : f.label }))),
        L.font === 'brand' ? h('p', { class: 'muted small', text: `${U.brandFamily()} s’affiche si la police est installée sur ce poste, sinon une police proche la remplace.` }) : null),
      field('Graisse', seg([[400, 'Normal'], [500, 'Médium'], [700, 'Gras'], [900, 'Noir']], L.weight, (v) => apply(() => { L.weight = v; }), 'seg-wide')),
      slider('Taille', 1.5, 24, 0.1, L.size, (v) => Math.round((v / 100) * U.currentFormat().w) + ' px', (v) => { L.size = v; U.emit('doc'); }),
      slider('Largeur du bloc', 15, 100, 1, L.w, (v) => Math.round(v) + ' %', (v) => { L.w = v; U.emit('doc'); }),
      field('Alignement', seg([['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']], L.align, (v) => apply(() => { L.align = v; }), 'seg-wide')),
      toggle('Capitales', L.upper, (v) => apply(() => { L.upper = v; })),
      field('Couleur', swatches(L))
    ];
  }
  function logoProps(L) {
    const pos = ['top-left', 'top-center', 'top-right', 'center-left', 'center-center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    const rule = U.profile && U.profile.branding && U.profile.branding.logoRules;
    return [
      slider('Taille', 4, 90, 0.5, L.w, (v) => Math.round(v) + ' % de la largeur', (v) => { L.w = v; U.emit('doc'); }),
      slider('Opacité', 0.1, 1, 0.05, L.opacity, (v) => Math.round(v * 100) + ' %', (v) => { L.opacity = v; U.emit('doc'); }),
      field('Position', h('div', { class: 'posgrid' }, pos.map((p) => h('button', { type: 'button', title: p, 'aria-label': 'Position ' + p, onclick: () => apply(() => U.placeLayer(L, p)) })))),
      U.btn({ label: 'Remplacer le logo', icon: 'swap', class: 'btn-sm', onclick: () => U.addLogo(L) }),
      rule && rule.length ? h('div', { class: 'card' }, h('h3', { text: 'Règles du profil' }), h('ul', { class: 'plist' }, rule.map((t) => h('li', { text: t })))) : null
    ];
  }
  function dress() {
    const d = U.doc, sel = U.selectedLayer();
    const row = (L) => h('li', { class: 'lrow' + (sel === L ? ' on' : '') },
      h('button', { type: 'button', class: 'lrow-main', 'aria-pressed': String(sel === L), onclick: () => U.select(sel === L ? null : L.id) }, U.icon(L.type === 'text' ? 'text' : 'badge', 15), h('span', { text: L.type === 'text' ? (L.text.split('\n')[0] || 'Texte vide') : 'Logo' })),
      U.btn({ icon: 'trash', title: 'Supprimer le calque', class: 'btn-ghost btn-icon btn-sm', onclick: () => U.removeLayer(L.id) }));
    return [
      h('div', { class: 'grid2' },
        U.btn({ label: 'Ajouter du texte', icon: 'text', onclick: () => U.addText() }),
        U.btn({ label: 'Ajouter un logo', icon: 'badge', onclick: () => U.addLogo() })),
      field('Calques', h('ul', { class: 'lrows' }, [...d.layers].reverse().map(row),
        h('li', { class: 'lrow lrow-base' }, h('span', { class: 'lrow-main' }, U.icon('image', 15), h('span', { text: U.currentImage() ? 'Motif' : 'Motif (aucun)' })), U.btn({ label: 'Importer', class: 'btn-ghost btn-sm', onclick: U.importImages })))),
      sel ? h('div', { class: 'group' }, sel.type === 'text' ? textProps(sel) : logoProps(sel))
        : h('p', { class: 'muted small', text: d.layers.length ? 'Sélectionnez un calque pour le régler. Sur le plan de travail, faites-le glisser pour le déplacer.' : 'Texte et logo restent des calques séparés du motif : vous pouvez les modifier à tout moment.' })
    ];
  }

  /* ---------- Exporter ---------- */
  function exportTab() {
    const e = U.doc.exp, f = U.currentFormat(), im = U.currentImage();
    return [
      field('Fichier', seg([['png', 'PNG'], ['jpg', 'JPG']], e.type, (v) => apply(() => { e.type = v; }), 'seg-wide')),
      e.type === 'jpg' ? slider('Qualité', 0.5, 1, 0.01, e.quality, (v) => Math.round(v * 100) + ' %', (v) => { e.quality = v; }) : null,
      field('Résolution', seg([[1, `${f.w} × ${f.h}`], [2, `${f.w * 2} × ${f.h * 2}`]], e.scale, (v) => apply(() => { e.scale = v; }), 'seg-wide')),
      field('Nom du fichier', h('input', { class: 'input', value: e.name, 'aria-label': 'Nom du fichier', oninput: (ev) => { e.name = ev.target.value; }, onchange: () => U.commit() })),
      toggle('Inclure le texte et le logo', e.layers, (v) => apply(() => { e.layers = v; })),
      im && im.kind === 'mock' ? h('p', { class: 'note' }, U.icon('info', 13), 'Ce visuel est une maquette de démonstration : la mention « pas une image IA » est ajoutée à chaque export.') : null,
      h('div', { class: 'card' }, h('h3', { text: 'Plan de travail' }),
        h('p', { class: 'muted small', text: 'Votre travail est enregistré automatiquement dans ce navigateur et restauré à la prochaine ouverture.' }),
        U.btn({ label: 'Tout réinitialiser', icon: 'trash', class: 'btn-sm btn-ghost', onclick: async () => { if (await U.confirm('Réinitialiser le plan de travail ?', 'Les variantes et les calques seront retirés. Les références et le profil sont conservés.', 'Réinitialiser')) U.resetDoc(); } }))
    ];
  }

  U.inspector = {
    mount(el) { root = el; U.on('struct', this.render); U.on('ui', this.render); },
    render() {
      const tab = U.ui.rightTab, scroll = (U.$('.panel-body', root) || {}).scrollTop || 0;
      const tabs = h('div', { class: 'tabs', role: 'tablist' }, [['compose', 'Composer'], ['dress', 'Habiller'], ['export', 'Exporter']].map(([v, l]) =>
        h('button', { type: 'button', role: 'tab', class: 'tab' + (tab === v ? ' on' : ''), 'aria-selected': String(tab === v), text: l, onclick: () => { U.ui.rightTab = v; U.emit('ui'); } })));
      const body = h('div', { class: 'panel-body' }, tab === 'compose' ? compose() : tab === 'dress' ? dress() : exportTab());
      const foot = tab === 'compose' ? composeFoot() : tab === 'export' ? [U.btn({ label: 'Télécharger', icon: 'download', class: 'btn-primary btn-block', onclick: U.exportImage })] : null;
      U.fill(root, tabs, body, foot ? h('div', { class: 'panel-foot' }, foot) : '');
      U.$('.panel-body', root).scrollTop = scroll;
    }
  };
})();
