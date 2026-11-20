/* Outils de base : DOM, fichiers, couleurs, icônes, ZIP. */
(function () {
  const U = (window.UVS = window.UVS || {});
  U.config = window.UVS_CONFIG || {};

  U.$ = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  U.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    const a = attrs || {};
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false || k === 'value') continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') { for (const p in v) p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]); }
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    if (a.value != null) el.value = a.value;
    return el;
  };

  /* Remplace le contenu d'un élément (les valeurs vides sont ignorées). */
  U.fill = function (el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== '')); return el; };

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  U.mod = U.isMac ? '⌘' : 'Ctrl';
  U.fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';

  /* ---------- fichiers ---------- */
  U.download = function (blob, name) {
    const a = U.h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  U.downloadText = (text, name, type) => U.download(new Blob([text], { type: type || 'application/json' }), name);
  U.pickFiles = function (accept, multiple) {
    return new Promise((res) => {
      const i = U.h('input', { type: 'file', accept, multiple: !!multiple, style: { display: 'none' } });
      i.addEventListener('change', () => { res(Array.from(i.files || [])); i.remove(); });
      document.body.append(i); i.click();
    });
  };
  U.loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Image illisible')); im.src = src; });
  U.blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  U.dataURLToBlob = async (d) => (await fetch(d)).blob();
  U.copy = async function (text, msg) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = U.h('textarea', { value: text, style: { position: 'fixed', opacity: 0 } }); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    U.toast(msg || 'Copié');
  };

  /* ---------- notifications ---------- */
  U.toast = function (msg, kind) {
    const t = U.h('div', { class: 'toast' + (kind ? ' toast-' + kind : ''), text: msg });
    U.$('#toasts').append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, kind === 'error' ? 5200 : 2600);
  };

  /* ---------- couleurs ---------- */
  U.hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  U.lum = (hex) => { const [r, g, b] = U.hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  U.contrast = (a, b) => { const x = U.lum(a), y = U.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  U.mix = (a, b, t) => { const x = U.hexToRgb(a), y = U.hexToRgb(b); return U.rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  U.inkOn = (hex) => (U.lum(hex) > 0.42 ? '#141414' : '#FFFFFF');
  U.rng = function (seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ---------- icônes (SVG en ligne, trait 1.6) ---------- */
  const I = {
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7.5',
    star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    eyeoff: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM4 4l16 16',
    trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5', download: 'M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14',
    upload: 'M12 15.5v-11M7.5 9L12 4.5 16.5 9M5 19.5h14', swap: 'M4 8h13l-3-3M20 16H7l3 3',
    undo: 'M8 5L4 9l4 4M4 9h10a5.5 5.5 0 010 11h-3', redo: 'M16 5l4 4-4 4M20 9H10a5.5 5.5 0 000 11h3',
    search: 'M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM16 16l4.5 4.5',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4',
    moon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z', present: 'M4 5h16v11H4zM9 20h6M12 16v4',
    compare: 'M4 5h7v14H4zM13 5h7v14h-7z', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    text: 'M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 8.5v.01',
    badge: 'M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z', copy: 'M9 9h10.5v10.5H9zM5 15H4.5V4.5H15V5',
    code: 'M8.5 7l-5 5 5 5M15.5 7l5 5-5 5', wand: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16v4M16.5 18h4',
    lock: 'M7 11V8a5 5 0 0110 0v3M5.5 11h13v9h-13z', file: 'M7 3.5h7l4 4v13H7zM14 3.5v4h4',
    edit: 'M4 20l1-4L16.5 4.5l3 3L8 19z', chevron: 'M9 6l6 6-6 6', layers: 'M12 4l8 4.5-8 4.5-8-4.5zM4 13l8 4.5 8-4.5',
    info: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 11v5M12 8v.01', help: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 16.5v.01',
    palette: 'M12 3.5a8.5 8.5 0 000 17c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H17a3.5 3.5 0 003.5-3.5c0-4.7-3.8-8.5-8.5-8.5zM7.5 12v.01M9.5 8v.01M14 7.5v.01'
  };
  U.icon = function (name, size) {
    const s = size || 16;
    return U.h('span', { class: 'ico', 'aria-hidden': 'true', html: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${I[name] || ''}"/></svg>` });
  };
  U.btn = function (opts) {
    return U.h('button', { type: 'button', class: 'btn ' + (opts.class || ''), title: opts.title, 'aria-label': opts.label ? null : opts.title, disabled: opts.disabled, onclick: opts.onclick, 'aria-pressed': opts.pressed == null ? null : String(!!opts.pressed) },
      opts.icon ? U.icon(opts.icon, opts.size) : null, opts.label ? U.h('span', { text: opts.label }) : null, opts.kbd ? U.h('kbd', { text: opts.kbd }) : null);
  };

  /* ---------- ZIP sans compression (pour l'export groupé) ---------- */
  let crcTable;
  U.crc32 = function (bytes) {
    if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  U.zip = async function (files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0, cdSize = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = U.crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length; cdSize += 46 + name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  };
})();
