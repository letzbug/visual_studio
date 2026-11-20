/* Schéma du profil de style (profil Cameron) et validation.
   La même définition est publiée dans schema/cameron-style-profile.schema.json. */
(function () {
  const U = window.UVS;
  const str = (description) => ({ type: 'string', description });
  const list = (description) => ({ type: 'array', items: { type: 'string' }, description });
  const conf = { type: 'string', enum: ['observed', 'assumed'], description: 'observed = visible dans les références ; assumed = hypothèse à confirmer' };

  U.SCHEMA_ID = 'unipop.style-profile/1';
  U.PROFILE_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: U.SCHEMA_ID,
    title: 'UniPop Style Profile',
    description: 'Profil de style produit par Cameron à partir des références UniPop, importé dans UniPop Visual Studio.',
    type: 'object',
    required: ['schema', 'name', 'version', 'palette', 'generation'],
    properties: {
      schema: { type: 'string', enum: [U.SCHEMA_ID], description: 'Identifiant du schéma, toujours "unipop.style-profile/1"' },
      name: { type: 'string', minLength: 1, description: 'Nom du profil' },
      version: { type: 'string', pattern: '^\\d+\\.\\d+(\\.\\d+)?$', description: 'Version du profil, par exemple 1.0.0' },
      author: str('Auteur de l’analyse, par exemple Cameron'),
      createdAt: str('Date ISO 8601'),
      description: str('Résumé du profil en une ou deux phrases'),
      palette: {
        type: 'array', minItems: 1, maxItems: 16, description: 'Couleurs dominantes',
        items: {
          type: 'object', required: ['hex'],
          properties: {
            name: str('Nom de la couleur'),
            hex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', description: 'Valeur HEX sur 6 chiffres, par exemple #1F3A5F' },
            role: { type: 'string', enum: ['primary', 'secondary', 'accent', 'background', 'text', 'neutral'] },
            usage: str('Où et comment la couleur est utilisée'),
            confidence: conf
          }
        }
      },
      illustration: { type: 'object', properties: { style: str('Style d’illustration'), imagery: str('Langage visuel, sujets, ambiance'), keywords: list('Mots-clés de style'), confidence: conf } },
      composition: { type: 'object', properties: { rules: list('Règles de composition'), layouts: list('Mises en page typiques'), confidence: conf } },
      typography: {
        type: 'object',
        properties: {
          headings: { type: 'object', properties: { family: str('Famille de la police de titre'), weight: str('Graisse'), case: str('Casse'), confidence: conf } },
          body: { type: 'object', properties: { family: str('Famille de la police de texte'), weight: str('Graisse'), confidence: conf } },
          notes: str('Remarques typographiques')
        }
      },
      backgrounds: { type: 'object', properties: { types: list('Types de fonds'), notes: str('Remarques'), confidence: conf } },
      graphicElements: list('Éléments graphiques récurrents'),
      branding: {
        type: 'object',
        properties: {
          logoRules: list('Règles d’usage du logo'),
          placement: { type: 'string', enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'], description: 'Position habituelle du logo' },
          minSizePercent: { type: 'number', minimum: 1, maximum: 100, description: 'Largeur minimale du logo en % de la largeur du visuel' },
          notes: str('Remarques')
        }
      },
      formats: {
        type: 'array', description: 'Formats recommandés',
        items: { type: 'object', required: ['label', 'width', 'height'], properties: { label: str('Nom du format'), width: { type: 'integer', minimum: 64, maximum: 8000 }, height: { type: 'integer', minimum: 64, maximum: 8000 } } }
      },
      generation: {
        type: 'object', required: ['positive'],
        properties: { summary: str('Description du style en une phrase, placée en tête du prompt'), positive: list('Consignes à suivre'), negative: list('Éléments à éviter') }
      },
      subjects: { type: 'array', description: 'Exemples de sujets', items: { type: 'object', required: ['title'], properties: { title: str('Titre court'), prompt: str('Description du sujet') } } },
      uncertainties: list('Points que l’analyse n’a pas pu établir avec certitude')
    }
  };

  /* Validateur réduit : type, required, properties, items, enum, pattern, min/max. Messages en français. */
  const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
  const TYPES_FR = { string: 'un texte', number: 'un nombre', integer: 'un nombre entier', array: 'une liste', object: 'un objet', boolean: 'vrai ou faux' };
  function check(v, s, path, errs) {
    const t = typeOf(v);
    if (s.type && !(t === s.type || (s.type === 'number' && t === 'integer'))) { errs.push({ path, msg: `doit être ${TYPES_FR[s.type]}` }); return; }
    if (s.enum && !s.enum.includes(v)) errs.push({ path, msg: `valeur « ${v} » refusée ; valeurs possibles : ${s.enum.join(', ')}` });
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) errs.push({ path, msg: `format invalide (« ${v} »)` + (s.description ? ` ; attendu : ${s.description}` : '') });
    if (s.minLength != null && typeof v === 'string' && v.length < s.minLength) errs.push({ path, msg: 'ne peut pas être vide' });
    if (s.minimum != null && typeof v === 'number' && v < s.minimum) errs.push({ path, msg: `doit valoir au moins ${s.minimum}` });
    if (s.maximum != null && typeof v === 'number' && v > s.maximum) errs.push({ path, msg: `doit valoir au plus ${s.maximum}` });
    if (t === 'array') {
      if (s.minItems != null && v.length < s.minItems) errs.push({ path, msg: `doit contenir au moins ${s.minItems} élément(s)` });
      if (s.maxItems != null && v.length > s.maxItems) errs.push({ path, msg: `doit contenir au plus ${s.maxItems} éléments` });
      if (s.items) v.forEach((x, i) => check(x, s.items, `${path}[${i}]`, errs));
    }
    if (t === 'object') {
      (s.required || []).forEach((k) => { if (v[k] === undefined) errs.push({ path: path ? `${path}.${k}` : k, msg: 'champ obligatoire manquant' }); });
      for (const k in s.properties || {}) if (v[k] !== undefined) check(v[k], s.properties[k], path ? `${path}.${k}` : k, errs);
    }
  }
  U.validateProfile = function (obj) {
    const errors = [], warnings = [];
    if (typeOf(obj) !== 'object') return { ok: false, errors: [{ path: '(racine)', msg: 'le fichier doit contenir un objet JSON' }], warnings };
    check(obj, U.PROFILE_SCHEMA, '', errors);
    if (!errors.length) {
      if (!obj.palette.some((c) => c.role === 'background')) warnings.push('Aucune couleur de fond (role "background") : la plus claire sera utilisée.');
      if (!obj.generation.positive.length) warnings.push('La liste generation.positive est vide : le prompt ne contiendra pas de consignes de style.');
      if (!(obj.generation.negative || []).length) warnings.push('Aucune consigne négative (generation.negative).');
      if (!obj.illustration || !obj.illustration.style) warnings.push('Le style d’illustration n’est pas décrit (illustration.style).');
    }
    return { ok: !errors.length, errors, warnings };
  };
  U.parseProfile = function (text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, errors: [{ path: 'JSON', msg: 'le texte n’est pas un JSON valide (' + e.message + ')' }], warnings: [] }; }
    return Object.assign(U.validateProfile(obj), { profile: obj });
  };

  /* Profil d'exemple : fictif, sert à essayer l'application avant de recevoir le profil de Cameron. */
  U.EXAMPLE_PROFILE = {
    schema: U.SCHEMA_ID,
    name: 'Profil d’exemple (fictif)',
    version: '0.1.0',
    author: 'UniPop Visual Studio',
    createdAt: '2026-11-20',
    description: 'Profil de démonstration. Il ne décrit pas l’identité réelle d’UniPop : remplacez-le par le profil établi par Cameron.',
    palette: [
      { name: 'Bleu nuit', hex: '#1F3A5F', role: 'primary', usage: 'Grandes surfaces, formes principales', confidence: 'assumed' },
      { name: 'Corail', hex: '#F26B4E', role: 'accent', usage: 'Points d’attention', confidence: 'assumed' },
      { name: 'Jaune soleil', hex: '#F6C445', role: 'secondary', usage: 'Formes secondaires', confidence: 'assumed' },
      { name: 'Vert d’eau', hex: '#2FA39A', role: 'secondary', usage: 'Formes secondaires', confidence: 'assumed' },
      { name: 'Ivoire', hex: '#F7F3EA', role: 'background', usage: 'Fonds', confidence: 'assumed' },
      { name: 'Encre', hex: '#1D1D1B', role: 'text', usage: 'Textes', confidence: 'assumed' }
    ],
    illustration: { style: 'Illustration vectorielle en aplats, formes géométriques simples, sans dégradés ni contours', imagery: 'Personnages stylisés et objets du quotidien, ton chaleureux et accessible', keywords: ['flat design', 'géométrique', 'chaleureux'], confidence: 'assumed' },
    composition: { rules: ['Un sujet principal net, légèrement décentré', 'Grandes zones de respiration', 'Trois à quatre couleurs par visuel au maximum'], layouts: ['Sujet à gauche, espace libre à droite', 'Sujet centré sur fond uni'], confidence: 'assumed' },
    typography: { headings: { family: 'Gotham', weight: 'Bold', case: 'Bas de casse', confidence: 'assumed' }, body: { family: 'Gotham', weight: 'Book', confidence: 'assumed' }, notes: 'Une seule famille de caractères par visuel.' },
    backgrounds: { types: ['Aplat uni clair', 'Aplat de couleur principale'], notes: 'Pas de photo en arrière-plan.', confidence: 'assumed' },
    graphicElements: ['Cercles et demi-cercles', 'Bandes diagonales', 'Trames de points'],
    branding: { logoRules: ['Logo sur fond uni uniquement', 'Zone de protection égale à la hauteur du logo'], placement: 'bottom-right', minSizePercent: 14, notes: '' },
    formats: [{ label: 'Affiche A4', width: 2480, height: 3508 }],
    generation: {
      summary: 'Illustration vectorielle en aplats, géométrique et chaleureuse',
      positive: ['Aplats de couleur nets, bords francs', 'Formes géométriques simples', 'Composition aérée avec espace libre', 'Palette limitée aux couleurs du profil'],
      negative: ['photoréalisme', 'dégradés', 'ombres portées', 'rendu 3D', 'détails surchargés']
    },
    subjects: [
      { title: 'Atelier collectif', prompt: 'Un groupe d’adultes autour d’une table pendant un atelier' },
      { title: 'Cours de langue', prompt: 'Deux personnes en conversation, bulles de dialogue stylisées sans texte' },
      { title: 'Atelier numérique', prompt: 'Une personne devant un ordinateur portable, entourée de formes abstraites' }
    ],
    uncertainties: ['Toutes les valeurs de ce profil sont des exemples.']
  };

  /* Brief à transmettre à Cameron avec les images de référence. */
  U.cameronBrief = function (measured, refs) {
    const starred = refs.filter((r) => r.style).map((r) => r.name);
    return [
      'Bonjour Cameron,',
      '',
      `Je te joins ${refs.length} visuel(s) de référence d’UniPop. Analyse-les et rédige le profil de style correspondant pour UniPop Visual Studio.`,
      starred.length ? `Références les plus représentatives du style : ${starred.join(', ')}.` : '',
      '',
      'Consignes :',
      '1. Réponds uniquement par un objet JSON conforme au schéma ci-dessous, sans texte autour.',
      '2. Décris la palette (HEX), le style d’illustration, les règles de composition, la typographie, les fonds, les éléments graphiques, les règles de logo, les formats recommandés, les consignes de génération positives et négatives, et quelques exemples de sujets.',
      '3. Pour chaque élément, indique "confidence": "observed" si tu le vois dans les images, "assumed" si c’est une hypothèse.',
      '4. N’affirme pas le nom exact d’une police ou une valeur HEX exacte si tu ne peux pas l’établir : note-le dans "uncertainties".',
      '5. Le profil sert à créer de nouveaux motifs dans le même esprit, pas à reproduire les visuels existants.',
      measured && measured.length ? '\nCouleurs mesurées localement par comptage de pixels (repère, à vérifier) :\n' + measured.map((c) => `${c.hex} (${c.share} %)`).join(', ') : '',
      '',
      'Schéma JSON :',
      JSON.stringify(U.PROFILE_SCHEMA, null, 2)
    ].filter((l) => l !== '').join('\n');
  };
})();
