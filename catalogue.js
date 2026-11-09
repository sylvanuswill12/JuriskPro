/* ============================================================
   CATALOGUE (exécution) : conçu pour des milliers de modèles.
   - catalogue-data.js (généré) donne les familles : affichées sans aucun téléchargement.
   - Chaque famille se charge page par page (CAT_PAGE modèles).
   - La recherche utilise un index compact, chargé à la première recherche.
   - Un modèle n'est téléchargé que lorsqu'on l'ouvre.
   ============================================================ */
const FULL = {}, JPModels = { add(m) { FULL[m.id] = m; } };
const CATS = CAT_FAMILIES, PARCOURS = CAT_PARCOURS;

const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const catJSON = (name) => fetch('./catalogue/' + name + '?v=' + CAT_VERSION).then((r) => { if (!r.ok) throw new Error(name + ' : ' + r.status); return r.json(); });

const Cat = {
  metas: new Map(),            // id -> fiche, alimentée par les pages et les modèles chargés
  _pages: {}, _idx: null, _srch: null,
  family(id) { return CAT_FAMILIES.find((f) => f.id === id) || null; },
  meta(id) { return FULL[id] || this.metas.get(id) || null; },

  /* Une page d'une famille (1, 2, 3…). */
  page(fid, n) {
    const key = fid + '-' + n;
    if (!this._pages[key]) {
      this._pages[key] = catJSON('f-' + key + '.json').then((list) => { list.forEach((m) => { m.cat = fid; this.metas.set(m.id, m); }); return list; })
        .catch((e) => { delete this._pages[key]; throw e; });
    }
    return this._pages[key];
  },
  /* Toute une famille (ou tout le catalogue) : ses pages sont chargées en parallèle puis réunies. */
  async all(fid) {
    const fams = (fid ? [this.family(fid)] : CAT_FAMILIES).filter((f) => f && f.count > 0);
    const lists = await Promise.all(fams.map((f) => Promise.all(Array.from({ length: f.pages }, (_, i) => this.page(f.id, i + 1)))));
    return [].concat(...lists.map((l) => [].concat(...l)));
  },
  /* Correspondance id -> {t: titre, f: famille, ld: fichiers à charger}. Chargé seulement si nécessaire. */
  index() {
    if (!this._idx) this._idx = catJSON('index.json').then((d) => { this._idxData = d; return d; }).catch((e) => { this._idx = null; throw e; });
    return this._idx;
  },
  /* Titre d'un modèle déjà connu (page chargée, modèle ouvert ou index chargé), sinon l'identifiant. */
  titleSync(id) {
    const m = this.meta(id); if (m) return m.titre;
    const e = this._idxData && this._idxData[id]; return e ? e.t : '';
  },
  async title(id) {
    const m = this.meta(id); if (m) return m.titre;
    try { const e = (await this.index())[id]; return e ? e.t : id; } catch (x) { return id; }
  },
  /* Recherche : insensible aux accents et à la casse, tous les mots doivent être présents. */
  async search(q) {
    const words = normTxt(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    if (!this._srch) this._srch = catJSON('search.json').catch((e) => { this._srch = null; throw e; });
    const idx = await this._srch, res = [];
    for (const row of idx) {
      const hay = row[3], title = row[4];
      if (!words.every((w) => hay.indexOf(w) > -1)) continue;
      let score = 0;
      if (words.every((w) => title.indexOf(w) > -1)) score += 10;
      if (title.indexOf(words[0]) === 0) score += 5;
      words.forEach((w) => { if ((' ' + title).indexOf(' ' + w) > -1) score += 2; });
      res.push({ id: row[0], titre: row[1], cat: row[2], score });
    }
    return res.sort((a, b) => (b.score - a.score) || a.titre.localeCompare(b.titre, 'fr'));
  },
};

/* ---------- Chargement des modèles à la demande ---------- */
const _files = {};
function loadScriptFile(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = false; s.onload = res; s.onerror = () => { s.remove(); rej(new Error(src)); };
    document.head.appendChild(s);
  });
}
const fileURL = (name, kind, h) => name === 'spec' ? './spec.js?v=' + CAT_VERSION : './models/' + name + '.' + kind + (h ? '?v=' + h : '');
function loadFile(name, kind, h) {
  const key = name + '.' + kind;
  if (!_files[key]) {
    let p;
    if (name === 'spec') p = loadScriptFile(fileURL(name, kind, h));
    else if (kind === 'js') p = loadScriptFile(fileURL(name, kind, h));
    else p = fetch(fileURL(name, kind, h)).then((r) => { if (!r.ok) throw new Error(name + ' : ' + r.status); return r.json(); }).then((spec) => JPModels.add(JPSpec.build(spec)));
    _files[key] = p.catch((e) => { delete _files[key]; throw e; });
  }
  return _files[key];
}
/* Charge un ou plusieurs modèles (et leurs dépendances, dans l'ordre). Un identifiant inconnu est ignoré : voir modelExists. */
async function loadModels(ids) {
  const need = [];
  for (const id of ids) {
    if (FULL[id]) continue;
    let ld = (Cat.metas.get(id) || {}).ld;
    if (!ld) { const e = (await Cat.index())[id]; if (!e) continue; ld = e.ld; }
    ld.forEach((x) => { if (!need.some((y) => y[0] === x[0] && y[1] === x[1])) need.push(x); });
  }
  // Les scripts se téléchargent en parallèle (async=false : ils s'exécutent quand même dans l'ordre) ; les .json attendent leurs scripts.
  await Promise.all(need.filter((x) => x[1] === 'js' || x[0] === 'spec').map(([name, kind, h]) => loadFile(name, kind, h)));
  for (const [name, kind, h] of need) if (!(kind === 'js' || name === 'spec')) await loadFile(name, kind, h);
}
/* Préchargement discret : télécharge les fichiers d'un modèle (cache du navigateur et du service worker) sans les exécuter. */
const _pre = {};
const saveData = () => { try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } };
async function prefetchModel(id) {
  if (FULL[id] || _pre[id] || saveData()) return;
  _pre[id] = 1;
  try {
    let ld = (Cat.metas.get(id) || {}).ld;
    if (!ld) { const e = (await Cat.index())[id]; if (!e) return; ld = e.ld; }
    ld.forEach(([name, kind, h]) => { if (!_files[name + '.' + kind]) fetch(fileURL(name, kind, h)).catch(() => {}); });
  } catch (e) { delete _pre[id]; }
}
/* Une fois l'écran affiché : index et premières pages des familles (quelques Ko). */
function warmCatalogue() {
  if (saveData()) return;
  const run = () => { Cat.index().catch(() => {}); CAT_FAMILIES.forEach((f) => { if (f.count > 0) Cat.page(f.id, 1).catch(() => {}); }); };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2500 }); else setTimeout(run, 1200);
}
/* Un identifiant existe-t-il au catalogue ? */
async function modelExists(id) {
  if (FULL[id] || Cat.metas.has(id)) return true;
  return !!(await Cat.index())[id]; // lève une erreur si le réseau est coupé : l'appelant affiche « Réessayer »
}
const byId = (id) => Cat.meta(id);
