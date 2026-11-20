/* Mesure locale des couleurs dominantes par comptage de pixels.
   C'est un calcul déterministe dans le navigateur, pas une analyse par IA :
   il sert de repère pour vérifier les valeurs HEX du profil Cameron. */
(function () {
  const U = window.UVS;
  U.measureColors = async function (refs, max) {
    const buckets = new Map();
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let total = 0;
    for (const r of refs) {
      let im; try { im = await U.loadImage(r.url); } catch (e) { continue; }
      ctx.clearRect(0, 0, 64, 64); ctx.drawImage(im, 0, 0, 64, 64);
      const d = ctx.getImageData(0, 0, 64, 64).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        const b = buckets.get(k) || [0, 0, 0, 0];
        b[0]++; b[1] += d[i]; b[2] += d[i + 1]; b[3] += d[i + 2];
        buckets.set(k, b); total++;
      }
    }
    const sorted = Array.from(buckets.values()).sort((a, b) => b[0] - a[0]);
    const out = [];
    for (const b of sorted) {
      const c = [b[1] / b[0], b[2] / b[0], b[3] / b[0]];
      const near = out.find((o) => Math.hypot(o.rgb[0] - c[0], o.rgb[1] - c[1], o.rgb[2] - c[2]) < 44);
      if (near) { near.n += b[0]; continue; }
      if (out.length < (max || 8)) out.push({ rgb: c, n: b[0] });
    }
    return out.map((o) => ({ hex: U.rgbToHex(o.rgb[0], o.rgb[1], o.rgb[2]), share: Math.round((o.n / total) * 100) })).filter((o) => o.share >= 1);
  };
})();
