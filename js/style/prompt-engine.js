/* Style Engine : profil + sujet + format + texte  →  prompt de génération complet. */
(function () {
  const U = window.UVS;
  const T = {
    en: {
      subject: 'Subject', style: 'Style', palette: 'Colour palette', composition: 'Composition', backgrounds: 'Backgrounds and graphic elements', text: 'Text', format: 'Format', rules: 'Style rules',
      neutral: 'A neutral, abstract composition that showcases the visual identity',
      noProfile: 'No style profile loaded: neutral contemporary illustration',
      onlyPalette: 'Use only these colours', noText: 'No text, letters, numbers, logo or watermark anywhere in the image.',
      reserve: (p) => `Do not render any text or logo. Keep a calm, uncluttered area at the ${p} of the image: a headline is added afterwards as a separate layer.`,
      exact: (t) => `Render exactly this text, spelled exactly as written: "${t}".`, typo: 'Lettering', place: { top: 'top', center: 'centre', bottom: 'bottom' },
      logoArea: (p) => `Keep the ${p} corner calm for a logo added afterwards.`, ratio: 'aspect ratio', avoid: 'Avoid', newMotif: 'Create a new, original motif; do not reproduce an existing image.'
    },
    fr: {
      subject: 'Sujet', style: 'Style', palette: 'Palette de couleurs', composition: 'Composition', backgrounds: 'Fonds et éléments graphiques', text: 'Texte', format: 'Format', rules: 'Consignes de style',
      neutral: 'Une composition neutre et abstraite qui met en valeur l’identité visuelle',
      noProfile: 'Aucun profil de style chargé : illustration contemporaine neutre',
      onlyPalette: 'Utiliser uniquement ces couleurs', noText: 'Aucun texte, lettre, chiffre, logo ni filigrane dans l’image.',
      reserve: (p) => `Ne dessiner ni texte ni logo. Garder une zone calme et dégagée ${p} de l’image : un titre est ajouté ensuite sur un calque séparé.`,
      exact: (t) => `Écrire exactement ce texte, sans faute : « ${t} ».`, typo: 'Lettrage', place: { top: 'en haut', center: 'au centre', bottom: 'en bas' },
      logoArea: (p) => `Garder le coin ${p} dégagé pour un logo ajouté ensuite.`, ratio: 'rapport', avoid: 'À éviter', newMotif: 'Créer un motif nouveau et original ; ne pas reproduire une image existante.'
    }
  };
  const CORNER = { en: { 'top-left': 'top-left', 'top-right': 'top-right', 'bottom-left': 'bottom-left', 'bottom-right': 'bottom-right', center: 'central' }, fr: { 'top-left': 'supérieur gauche', 'top-right': 'supérieur droit', 'bottom-left': 'inférieur gauche', 'bottom-right': 'inférieur droit', center: 'central' } };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const join = (a) => (a || []).filter(Boolean).join('; ');

  U.buildPrompt = function () {
    const d = U.doc, p = U.profile, f = U.currentFormat(), L = T[d.promptLang] || T.en, lang = T[d.promptLang] ? d.promptLang : 'en';
    const sections = [];
    const subject = d.subject.trim() || L.neutral;
    sections.push({ title: L.subject, text: subject });

    if (p) {
      const il = p.illustration || {};
      const style = [p.generation.summary, il.style, il.imagery, (il.keywords || []).join(', ')].filter(Boolean).join('. ');
      if (style) sections.push({ title: L.style, text: style });
      sections.push({ title: L.palette, text: L.onlyPalette + ': ' + p.palette.map((c) => `${c.hex}${c.name ? ' ' + c.name : ''}${c.role ? ' (' + c.role + ')' : ''}`).join(', ') });
      const comp = p.composition || {};
      if (join(comp.rules) || join(comp.layouts)) sections.push({ title: L.composition, text: [join(comp.rules), join(comp.layouts)].filter(Boolean).join('. ') });
      const bg = [join((p.backgrounds || {}).types), (p.backgrounds || {}).notes, join(p.graphicElements)].filter(Boolean).join('. ');
      if (bg) sections.push({ title: L.backgrounds, text: bg });
    } else sections.push({ title: L.style, text: L.noProfile });

    /* Texte : absent par défaut. */
    let textLine = L.noText;
    const content = d.textContent.trim();
    if (d.textOn && d.textMode === 'layer') textLine = L.reserve(L.place[d.textPlace]);
    if (d.textOn && d.textMode === 'baked' && content) {
      const h = p && p.typography && p.typography.headings;
      textLine = L.exact(content) + (h && h.family ? ` ${L.typo}: ${[h.family, h.weight, h.case].filter(Boolean).join(', ')}.` : '');
    }
    const logo = d.layers.find((l) => l.type === 'logo');
    if (logo) textLine += ' ' + L.logoArea(CORNER[lang][U.cornerOf(logo)]);
    sections.push({ title: L.text, text: textLine });

    const g = gcd(f.w, f.h);
    sections.push({ title: L.format, text: `${f.label}, ${L.ratio} ${f.w / g}:${f.h / g}, ${f.w} × ${f.h} px` });
    const rules = [...((p && p.generation.positive) || []), L.newMotif];
    sections.push({ title: L.rules, text: join(rules) });

    const negList = [...((p && p.generation.negative) || [])];
    if (!(d.textOn && d.textMode === 'baked' && content)) negList.push(...(lang === 'fr' ? ['texte', 'lettres', 'typographie', 'logo', 'filigrane'] : ['text', 'letters', 'typography', 'logo', 'watermark']));
    const negative = negList.join(', ');
    const prompt = sections.map((s) => `${s.title}: ${s.text}`).join('\n') + (negative ? `\n${L.avoid}: ${negative}` : '');
    const payload = { provider: d.provider, prompt, negative_prompt: negative, width: f.w, height: f.h, count: d.count, profile: p ? { name: p.name, version: p.version } : null };
    return { prompt, negative, sections, payload, usedNeutral: !d.subject.trim() };
  };

  U.cornerOf = function (l) {
    if (Math.abs(l.x - 50) < 15 && Math.abs(l.y - 50) < 15) return 'center';
    return (l.y < 50 ? 'top' : 'bottom') + '-' + (l.x < 50 ? 'left' : 'right');
  };
})();
