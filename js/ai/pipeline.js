/* Chaîne interchangeable :  StyleAnalyzer → StyleProfile → ImageGenerator

   StyleAnalyzer   { id, label, available, analyze(input) → Promise<StyleProfile> }
   StyleProfile    objet conforme à schema/cameron-style-profile.schema.json
   ImageGenerator  { id, label, kind, available, generate(request) → Promise<[{ blob }]> }
                   request = { prompt, negative, width, height, count, profile, onProgress(done, total) }

   v0.1 : l'analyse est faite par Cameron hors de l'application (import JSON) et seul le
   générateur de maquettes est actif. Les fournisseurs IA passent par un Worker qui détient
   les clés ; ils restent désactivés tant que UVS_CONFIG.workerUrl est vide. */
(function () {
  const U = window.UVS;

  /* ---------- StyleAnalyzer ---------- */
  U.analyzers = {
    'cameron-import': {
      id: 'cameron-import', label: 'Analyse par Cameron (import JSON)', available: true,
      async analyze({ json }) {
        const r = U.parseProfile(json);
        if (!r.ok) { const e = new Error('Profil invalide'); e.details = r.errors; throw e; }
        return r.profile;
      }
    },
    'remote-api': {
      id: 'remote-api', label: 'Analyse automatique par API', get available() { return false; },
      async analyze() { throw new Error('Analyse automatique non connectée dans la version 0.1.'); }
      /* Version ultérieure : POST {workerUrl}/analyze avec les images, après accord explicite de l'utilisateur. */
    }
  };

  /* ---------- ImageGenerator : maquettes de démonstration ---------- */
  function paletteFor(profile) {
    if (!profile) return { bg: '#E9E9E7', others: ['#C9C9C6', '#8F8F8C', '#55565A', '#2B2C2F'] };
    const hexes = profile.palette.map((c) => c.hex);
    const bgEntry = profile.palette.find((c) => c.role === 'background');
    const bg = bgEntry ? bgEntry.hex : hexes.slice().sort((a, b) => U.lum(b) - U.lum(a))[0];
    const others = profile.palette.filter((c) => c.hex !== bg && c.role !== 'text').map((c) => c.hex);
    return { bg, others: others.length ? others : ['#55565A'] };
  }
  function drawMock(ctx, W, H, pal, seed, kind) {
    const r = U.rng(seed), m = Math.min(W, H), pick = () => pal.others[Math.floor(r() * pal.others.length)];
    const circle = (x, y, rad) => { ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); };
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
    if (kind === 0) {            // cercles superposés
      for (let k = 0; k < 5; k++) { ctx.fillStyle = pick(); circle(r() * W, r() * H, m * (0.16 + r() * 0.28)); }
      ctx.strokeStyle = pick(); ctx.lineWidth = m * 0.035; ctx.beginPath(); ctx.arc(W * (0.3 + r() * 0.4), H * (0.3 + r() * 0.4), m * 0.3, 0, Math.PI * (0.8 + r())); ctx.stroke();
    } else if (kind === 1) {     // bandes diagonales
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.5 + r() * 0.35);
      for (let k = -5; k <= 5; k++) { ctx.fillStyle = pick(); ctx.fillRect(-W * 2, k * m * 0.17, W * 4, m * (0.04 + r() * 0.09)); }
      ctx.restore(); ctx.fillStyle = pick(); circle(W * (0.25 + r() * 0.5), H * (0.3 + r() * 0.4), m * 0.24);
    } else if (kind === 2) {     // carreaux et quarts de cercle
      const n = W >= H ? 5 : 4, cell = W / n, rows = Math.ceil(H / cell);
      for (let y = 0; y < rows; y++) for (let x = 0; x < n; x++) {
        if (r() < 0.55) { ctx.fillStyle = pick(); ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1); }
        if (r() < 0.6) { const cx = x * cell + (r() < 0.5 ? 0 : cell), cy = y * cell + (r() < 0.5 ? 0 : cell); ctx.save(); ctx.beginPath(); ctx.rect(x * cell, y * cell, cell, cell); ctx.clip(); ctx.fillStyle = r() < 0.3 ? pal.bg : pick(); circle(cx, cy, cell); ctx.restore(); }
      }
    } else {                     // collines
      ctx.fillStyle = pick(); circle(W * (0.6 + r() * 0.25), H * (0.2 + r() * 0.15), m * 0.14);
      for (let k = 0; k < 4; k++) {
        const y = H * (0.4 + k * 0.15); ctx.fillStyle = pick(); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, y + r() * H * 0.08);
        ctx.bezierCurveTo(W * 0.3, y - H * (0.05 + r() * 0.12), W * 0.6, y + H * (0.02 + r() * 0.12), W, y - r() * H * 0.08); ctx.lineTo(W, H); ctx.fill();
      }
    }
    ctx.fillStyle = pick(); const gx = W * (0.08 + r() * 0.5), gy = H * (0.08 + r() * 0.5), step = m * 0.03;   // trame de points
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) circle(gx + x * step, gy + y * step, m * 0.0045);
  }
  /* Mention obligatoire des maquettes : affichée sur le plan de travail et dessinée à chaque export,
     quel que soit le format, pour qu'une maquette ne passe jamais pour une image générée par IA. */
  U.DEMO_LABEL = 'Maquette de démonstration, pas une image IA';
  U.drawDemoStamp = function (ctx, W, H) {
    const fs = Math.max(12, W * 0.021), pad = fs * 0.7;
    ctx.save(); ctx.font = `600 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(U.DEMO_LABEL).width;
    ctx.fillStyle = 'rgba(15,15,15,.78)'; ctx.beginPath(); ctx.roundRect(fs, H - fs * 3.1, tw + pad * 2, fs * 2.1, fs * 0.5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(U.DEMO_LABEL, fs + pad, H - fs * 2.05); ctx.restore();
  };
  const mock = {
    id: 'mock', label: 'Mode démo (maquettes)', kind: 'mock', available: true,
    async generate(req) {
      const pal = paletteFor(req.profile), out = [], base = Math.floor(Math.random() * 1e9), start = Math.floor(Math.random() * 4);
      for (let i = 0; i < req.count; i++) {
        const cv = document.createElement('canvas'); cv.width = req.width; cv.height = req.height;
        drawMock(cv.getContext('2d'), req.width, req.height, pal, base + i * 7919, (start + i) % 4);
        out.push({ blob: await new Promise((res) => cv.toBlob(res, 'image/png')) });
        await new Promise((res) => setTimeout(res, 260));
        req.onProgress && req.onProgress(i + 1, req.count);
      }
      return out;
    }
  };

  /* ---------- ImageGenerator : fournisseurs IA via le Worker ---------- */
  function remote(id, label) {
    return {
      id, label, kind: 'ai', get available() { return id === 'openai' && !!U.config.workerUrl; },
      async generate(req) {
        const code = window.prompt('Code d’accès au service de génération (non enregistré)');
        if (!code) throw new Error('Génération annulée');
        const refs = await Promise.all((req.refs || []).map(async r => {
          const im = await createImageBitmap(r.blob); const scale = Math.min(1, 1024 / Math.max(im.width, im.height));
          const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width*scale)); cv.height = Math.max(1, Math.round(im.height*scale));
          cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); im.close(); return cv.toDataURL('image/png');
        }));
        const res = await fetch(U.config.workerUrl.replace(/\/$/, '') + '/generate', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + code },
          body: JSON.stringify({ provider: id, prompt: req.prompt, negative_prompt: req.negative, width: req.width, height: req.height, count: req.count, refs })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || ('Service : ' + res.status)); }
        const data = await res.json();
        if (!data.images?.length) throw new Error("Aucune image reçue");
        return Promise.all((data.images || []).map(async (im) => ({ blob: await U.dataURLToBlob(`data:${im.mime || 'image/png'};base64,${im.b64}`) })));
      }
    };
  }
  U.generators = { mock, openai: remote('openai', 'OpenAI Images'), flux: remote('flux', 'FLUX'), recraft: remote('recraft', 'Recraft') };
})();
