/* Composition finale : motif, logo et texte sont rendus séparément puis assemblés à la résolution du format. */
(function () {
  const U = window.UVS;

  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const t = line ? line + ' ' + word : word;
        if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  U.renderFinal = async function (opts) {
    const o = Object.assign({ scale: 1, layers: true, type: 'png' }, opts), f = U.currentFormat();
    const W = Math.round(f.w * o.scale), H = Math.round(f.h * o.scale);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), im = U.currentImage();
    if (!im || o.type === 'jpg') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); }
    if (im) {
      const img = await U.loadImage(U.assetUrl(im.assetId)), k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * k, hh = img.naturalHeight * k;
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, (W - w) / 2, (H - hh) / 2, w, hh);
    }
    if (o.layers) for (const L of U.doc.layers) {
      const x = (L.x / 100) * W, y = (L.y / 100) * H, w = (L.w / 100) * W;
      if (L.type === 'logo') {
        const img = await U.loadImage(U.assetUrl(L.assetId)), hh = w * L.ar;
        ctx.globalAlpha = L.opacity; ctx.drawImage(img, x - w / 2, y - hh / 2, w, hh); ctx.globalAlpha = 1;
      } else {
        const px = (L.size / 100) * W, lh = px * 1.15;
        ctx.font = `${L.weight} ${px}px ${U.fontStack(L.font)}`; ctx.fillStyle = L.color; ctx.textBaseline = 'middle'; ctx.textAlign = L.align;
        const lines = wrap(ctx, L.upper ? L.text.toUpperCase() : L.text, w);
        const tx = L.align === 'left' ? x - w / 2 : L.align === 'right' ? x + w / 2 : x, top = y - (lines.length * lh) / 2;
        lines.forEach((line, i) => ctx.fillText(line, tx, top + lh * (i + 0.5)));
      }
    }
    if (im && im.kind === 'mock') U.drawDemoStamp(ctx, W, H);
    return cv;
  };
  U.exportImage = async function () {
    const e = U.doc.exp, f = U.currentFormat();
    if (!U.currentImage() && !U.doc.layers.length) return U.toast('Rien à exporter : générez ou importez d’abord un visuel', 'error');
    try { await document.fonts.ready; } catch (err) { /* sans objet */ }
    const cv = await U.renderFinal({ scale: e.scale, layers: e.layers, type: e.type });
    const blob = await new Promise((res) => cv.toBlob(res, e.type === 'jpg' ? 'image/jpeg' : 'image/png', e.quality));
    const name = `${(e.name || 'unipop-visuel').trim().replace(/[^\w\-]+/g, '-')}-${cv.width}x${cv.height}.${e.type}`;
    U.download(blob, name); U.toast('Téléchargé : ' + name);
  };
})();
