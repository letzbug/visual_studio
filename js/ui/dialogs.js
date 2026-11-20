/* Fenêtres : modale générique, prompt, préparation de l'analyse, palette de commandes, raccourcis. */
(function () {
  const U = window.UVS, { h, $ } = U;

  U.modalOpen = () => !!$('#overlays .scrim');
  U.modal = function ({ title, body, footer, cls, bare }) {
    const prev = document.activeElement;
    const close = () => { wrap.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
      if (e.key === 'Tab') {   // le focus reste dans la fenêtre
        const f = U.$$('button, [href], input, select, textarea', dlg).filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const dlg = h('div', { class: 'modal ' + (cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      bare ? null : h('header', { class: 'modal-head' }, h('h2', { text: title }), U.btn({ icon: 'x', title: 'Fermer', class: 'btn-ghost btn-icon', onclick: close })),
      h('div', { class: 'modal-body' }, body), footer ? h('footer', { class: 'modal-foot' }, footer) : null);
    const wrap = h('div', { class: 'scrim', onpointerdown: (e) => { if (e.target === wrap) close(); } }, dlg);
    $('#overlays').append(wrap);
    document.addEventListener('keydown', key, true);
    const f = $('[autofocus]', dlg) || $('input, textarea, button.btn-primary', dlg) || $('button', dlg);
    if (f) f.focus();
    return { close, el: dlg };
  };
  U.confirm = function (title, text, okLabel) {
    return new Promise((res) => {
      let done = false;
      const m = U.modal({
        title, cls: 'modal-sm', body: h('p', { class: 'prose', text }),
        footer: [U.btn({ label: 'Annuler', class: 'btn-ghost', onclick: () => { m.close(); } }), U.btn({ label: okLabel || 'Confirmer', class: 'btn-primary', onclick: () => { done = true; m.close(); res(true); } })]
      });
      const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) res(false); } });
      obs.observe($('#overlays'), { childList: true });
    });
  };

  /* ---------- Voir le prompt ---------- */
  U.showPrompt = function () {
    const b = U.buildPrompt();
    let tab = 'prompt';
    const body = h('div');
    const text = () => (tab === 'prompt' ? b.prompt : tab === 'neg' ? b.negative : JSON.stringify(b.payload, null, 2));
    const draw = () => {
      U.fill(body, 
        h('div', { class: 'seg seg-wide' }, [['prompt', 'Prompt complet'], ['neg', 'Prompt négatif'], ['json', 'Requête JSON']].map(([v, l]) =>
          h('button', { type: 'button', class: 'seg-btn' + (tab === v ? ' on' : ''), 'aria-pressed': String(tab === v), text: l, onclick: () => { tab = v; draw(); } }))),
        tab === 'prompt'
          ? h('dl', { class: 'prompt-view' }, b.sections.map((s) => [h('dt', { text: s.title }), h('dd', { text: s.text })]), b.negative ? [h('dt', { text: 'Négatif' }), h('dd', { class: 'neg', text: b.negative })] : null)
          : h('pre', { class: 'code', text: text() || 'Aucune consigne négative.' }),
        h('p', { class: 'note' }, U.icon('info', 14), U.profile
          ? `Construit à partir du profil « ${U.profile.name} » v${U.profile.version}, du sujet, du format et des options de texte.` + (b.usedNeutral ? ' Aucun sujet saisi : un motif neutre est proposé.' : '')
          : 'Aucun profil de style importé : le prompt ne contient pas encore l’identité UniPop.')
      );
    };
    draw();
    U.modal({ title: 'Prompt de génération', cls: 'modal-md', body, footer: [
      U.btn({ label: 'Télécharger (.txt)', icon: 'download', class: 'btn-ghost', onclick: () => U.downloadText(b.prompt, 'prompt-unipop.txt', 'text/plain') }),
      U.btn({ label: 'Copier', icon: 'copy', class: 'btn-primary', onclick: () => U.copy(text(), tab === 'prompt' ? 'Prompt copié' : 'Copié') })] });
  };

  /* ---------- Analyser le style : préparation pour Cameron ---------- */
  U.showAnalysis = async function () {
    const refs = U.refs.filter((r) => !r.excluded), excluded = U.refs.length - refs.length;
    const colors = h('div', { class: 'measure' }, h('span', { class: 'muted', text: refs.length ? 'Mesure en cours…' : 'Ajoutez des références pour mesurer leurs couleurs.' }));
    let measured = [];
    const step = (n, title, text, ...actions) => h('li', { class: 'step' }, h('span', { class: 'step-n', text: n }), h('div', {}, h('h3', { text: title }), h('p', { text }), h('div', { class: 'row' }, actions)));
    const m = U.modal({
      title: 'Analyser le style', cls: 'modal-md',
      body: [
        h('p', { class: 'prose', text: 'Dans cette version, l’analyse du style est réalisée par Cameron, en dehors de l’application. Le studio prépare les éléments à lui transmettre, puis applique le profil qu’il vous remet.' }),
        h('ol', { class: 'steps' },
          step('1', 'Exporter les références', `${refs.length} image(s) incluse(s)` + (excluded ? `, ${excluded} exclue(s) de l’analyse.` : '.'),
            U.btn({ label: 'Télécharger le ZIP', icon: 'download', disabled: !refs.length, onclick: () => U.exportRefsZip(true) })),
          step('2', 'Transmettre le brief à Cameron', 'Le brief contient les consignes, le schéma JSON attendu et les couleurs mesurées ci-dessous.',
            U.btn({ label: 'Copier le brief', icon: 'copy', onclick: () => U.copy(U.cameronBrief(measured, refs), 'Brief copié') }),
            U.btn({ label: 'Schéma JSON', icon: 'code', class: 'btn-ghost', onclick: () => U.downloadText(JSON.stringify(U.PROFILE_SCHEMA, null, 2), 'cameron-style-profile.schema.json') })),
          step('3', 'Importer le profil reçu', 'Le fichier est vérifié par rapport au schéma avant d’être appliqué.',
            U.btn({ label: 'Importer le profil Cameron', icon: 'file', class: 'btn-primary', onclick: () => { m.close(); U.pickProfile(); } }))),
        h('div', { class: 'card' }, h('h3', { text: 'Couleurs mesurées dans les références' }), colors,
          h('p', { class: 'note' }, U.icon('info', 14), 'Comptage de pixels effectué dans ce navigateur. Ce n’est pas une analyse par IA : utilisez ces valeurs pour vérifier celles du profil.')),
        h('p', { class: 'note' }, U.icon('lock', 14), 'Analyse automatique par API : non connectée dans la version 0.1. Aucune image n’est envoyée par l’application.')
      ]
    });
    if (refs.length) {
      measured = await U.measureColors(refs, 8);
      U.fill(colors, ...measured.map((c) => h('button', { type: 'button', class: 'swatch-mini', title: 'Copier ' + c.hex, onclick: () => U.copy(c.hex, c.hex + ' copié') },
        h('span', { class: 'swatch-dot', style: { background: c.hex } }), h('span', { text: c.hex }), h('span', { class: 'muted', text: c.share + ' %' }))));
    }
  };

  /* ---------- import de profil ---------- */
  U.importProfileText = async function (text, source) {
    let profile;
    try { profile = await U.analyzers['cameron-import'].analyze({ json: text }); }
    catch (e) { U.showProfileErrors(e.details || [{ path: 'JSON', msg: e.message }]); return false; }
    const warnings = U.validateProfile(profile).warnings;
    await U.setProfile(profile, { source: source || 'cameron', importedAt: new Date().toISOString(), warnings });
    U.ui.leftTab = 'profile'; U.emit('ui');
    U.toast(`Profil « ${profile.name} » importé` + (warnings.length ? `, ${warnings.length} remarque(s)` : ''));
    document.body.classList.add('accent-sweep'); setTimeout(() => document.body.classList.remove('accent-sweep'), 1200);
    return true;
  };
  U.pickProfile = async function () {
    const [f] = await U.pickFiles('.json,application/json');
    if (f) U.importProfileText(await f.text(), 'cameron');
  };
  U.loadExample = () => U.importProfileText(JSON.stringify(U.EXAMPLE_PROFILE), 'example');
  U.showProfileErrors = function (errors) {
    U.modal({ title: 'Profil non conforme', cls: 'modal-md', body: [
      h('p', { class: 'prose', text: `Le fichier n’a pas été importé : ${errors.length} point(s) à corriger. Transmettez cette liste à Cameron.` }),
      h('ul', { class: 'errors' }, errors.map((e) => h('li', {}, h('code', { text: e.path }), ' ', e.msg)))],
      footer: [U.btn({ label: 'Copier la liste', icon: 'copy', onclick: () => U.copy(errors.map((e) => `${e.path} : ${e.msg}`).join('\n'), 'Liste copiée') })] });
  };
  U.showPasteProfile = function () {
    const ta = h('textarea', { class: 'input code-input', rows: 14, placeholder: '{ "schema": "unipop.style-profile/1", … }', autofocus: true, 'aria-label': 'JSON du profil' });
    const m = U.modal({ title: 'Coller le profil Cameron', cls: 'modal-md', body: ta, footer: [
      U.btn({ label: 'Importer', class: 'btn-primary', onclick: async () => { if (!ta.value.trim()) return U.toast('Collez d’abord le JSON du profil', 'error'); m.close(); U.importProfileText(ta.value, 'cameron'); } })] });
  };

  /* ---------- raccourcis ---------- */
  U.showShortcuts = function () {
    const rows = [[U.mod + ' K', 'Rechercher une action'], ['G', 'Générer un visuel'], ['P', 'Voir le prompt'], ['T', 'Ajouter du texte'], ['L', 'Ajouter un logo'], ['I', 'Ajouter des références'],
      ['C', 'Comparer les variantes'], ['F', 'Mode présentation'], ['← →', 'Variante précédente / suivante, ou déplacer le calque'], ['1 à 9', 'Afficher une variante'], ['0', 'Ajuster à la fenêtre'], ['+ −', 'Zoomer / dézoomer'],
      [U.mod + ' molette', 'Zoom sur le pointeur'], ['Glisser le fond', 'Déplacer la vue'], [U.mod + ' Z', 'Annuler'], [U.mod + ' ⇧ Z', 'Rétablir'], ['Suppr', 'Supprimer le calque sélectionné'], ['D', 'Thème clair / sombre'], ['Échap', 'Désélectionner, fermer']];
    U.modal({ title: 'Raccourcis clavier', cls: 'modal-sm', body: h('dl', { class: 'keys' }, rows.map(([k, l]) => [h('dt', {}, h('kbd', { text: k })), h('dd', { text: l })])) });
  };

  /* ---------- palette de commandes ---------- */
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  U.showPalette = function () {
    if ($('.modal-cmd')) return;
    const all = U.commands();
    let list = all, idx = 0;
    const ul = h('ul', { class: 'cmd-list', role: 'listbox' });
    const run = (c) => { m.close(); setTimeout(c.run, 30); };
    const draw = () => {
      U.fill(ul, ...(list.length ? list.map((c, i) => h('li', { class: 'cmd' + (i === idx ? ' on' : ''), role: 'option', 'aria-selected': String(i === idx), onclick: () => run(c), onpointermove: () => { if (idx !== i) { idx = i; draw(); } } },
        U.icon(c.i || 'chevron', 15), h('span', { text: c.l }), c.k ? h('kbd', { text: c.k }) : null)) : [h('li', { class: 'cmd-empty', text: 'Aucune action ne correspond.' })]));
      const on = $('.on', ul); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const input = h('input', { class: 'cmd-input', placeholder: 'Rechercher une action…', 'aria-label': 'Rechercher une action', autofocus: true,
      oninput: (e) => { const q = norm(e.target.value).split(/\s+/).filter(Boolean); list = all.filter((c) => q.every((w) => norm(c.l).includes(w))); idx = 0; draw(); },
      onkeydown: (e) => {
        if (e.key === 'ArrowDown') { idx = Math.min(list.length - 1, idx + 1); draw(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); }
        if (e.key === 'Enter' && list[idx]) run(list[idx]);
      } });
    const m = U.modal({ title: 'Actions', cls: 'modal-cmd', bare: true, body: [h('div', { class: 'cmd-head' }, U.icon('search', 16), input), ul] });
    draw();
  };
})();
