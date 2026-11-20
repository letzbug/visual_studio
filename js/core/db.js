/* Stockage local IndexedDB. Rien ne quitte le navigateur.
   Magasins : refs (images de référence), assets (visuels, logos), kv (profil, espace de travail). */
(function () {
  const U = window.UVS;
  const NAME = 'unipop-visual-studio', STORES = ['refs', 'assets', 'kv'];
  let db = null;
  const mem = { refs: new Map(), assets: new Map(), kv: new Map() };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = (name, mode) => db.transaction(name, mode).objectStore(name);

  U.db = {
    persistent: false,
    async open() {
      try {
        const r = indexedDB.open(NAME, 1);
        r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); };
        db = await req(r); this.persistent = true;
      } catch (e) { db = null; this.persistent = false; }
      return this.persistent;
    },
    async all(s) { return db ? req(store(s, 'readonly').getAll()) : Array.from(mem[s].values()); },
    async get(s, id) { return db ? req(store(s, 'readonly').get(id)) : mem[s].get(id); },
    async put(s, v) { if (db) return req(store(s, 'readwrite').put(v)); mem[s].set(v.id, v); },
    async del(s, id) { if (db) return req(store(s, 'readwrite').delete(id)); mem[s].delete(id); },
    async clear(s) { if (db) return req(store(s, 'readwrite').clear()); mem[s].clear(); },
    async kvGet(k) { const v = await this.get('kv', k); return v ? v.value : undefined; },
    async kvSet(k, value) { return this.put('kv', { id: k, value }); }
  };
})();
