#!/usr/bin/env node
/* ============================================================
   Génère le catalogue de JuriskPro à partir des fichiers de models/.
   Une seule source de vérité : les fichiers de modèles eux-mêmes.

   models/<id>.js        modèle écrit en code (en-tête optionnel : /* @needs autre-fichier *\/)
   models/_xxx.js        bibliothèque partagée (en-tête : /* @lib *\/), jamais listée au catalogue
   models/<id>.json      modèle décrit par des données (voir MODELES.md)
   models/families.json  familles (id, titre, aide, ord)
   models/parcours.json  parcours (suites d'actes)
   models/library.json   registre de la bibliothèque : date d'ajout de chaque modèle et sélection « populaires »

   Sortie :
   catalogue-data.js     familles + version, chargé au démarrage (quelques Ko)
   catalogue/f-<fam>.json  liste d'une famille (chargée à l'ouverture de la famille)
   catalogue/search.json   index de recherche (chargé à la première recherche)
   catalogue/index.json    id -> fichiers à charger (chargé seulement si besoin)

   Usage : node scripts/build-catalogue.cjs [--dev] [--check]
     --dev    inclut les modèles marqués "dev": true (tests)
     --check  ne régénère rien : échoue si les fichiers générés ne sont plus à jour
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = process.cwd();
const MODELS = path.join(ROOT, 'models');
const OUT = path.join(ROOT, 'catalogue');
const INCLUDE_DEV = process.argv.includes('--dev');
const CHECK = process.argv.includes('--check');
const errors = [];
const fail = (m) => errors.push(m);

const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ---------- 1. Inventaire des fichiers ---------- */
const files = {};
for (const f of fs.readdirSync(MODELS)) {
  const m = /^(.+)\.(js|json)$/.exec(f);
  if (!m || ['families', 'parcours', 'library'].includes(m[1])) continue;
  const buf = fs.readFileSync(path.join(MODELS, f));
  const text = buf.toString('utf8');
  const head = text.slice(0, 400);
  files[m[1]] = {
    name: m[1], kind: m[2], buf, text, h: hash(buf),
    lib: m[2] === 'js' && /@lib\b/.test(head),
    needs: ((/@needs\s+([\w\-, ]+?)\s*\*\//.exec(head) || [])[1] || '').split(/[ ,]+/).filter(Boolean),
  };
}
const families = JSON.parse(fs.readFileSync(path.join(MODELS, 'families.json'), 'utf8'));
const parcours = JSON.parse(fs.readFileSync(path.join(MODELS, 'parcours.json'), 'utf8'));
const famIds = new Set(families.map((f) => f.id));
const LIB_PATH = path.join(MODELS, 'library.json');
const library = fs.existsSync(LIB_PATH) ? JSON.parse(fs.readFileSync(LIB_PATH, 'utf8')) : {};
library.ajouts = library.ajouts || {};
library.populaires = library.populaires || [];
library.rubriques = library.rubriques || [];
library.puces = library.puces || families.map((f) => f.id);

/* ---------- 2. Ordre de chargement (dépendances d'abord) ---------- */
function loadList(name, seen = []) {
  const f = files[name];
  if (!f) { fail('Fichier requis introuvable : models/' + name + '.js'); return []; }
  if (seen.includes(name)) { fail('Dépendance circulaire : ' + seen.concat(name).join(' > ')); return []; }
  let list = [];
  f.needs.forEach((n) => { loadList(n, seen.concat(name)).forEach((x) => { if (!list.some((y) => y[0] === x[0])) list.push(x); }); });
  list.push([f.name, f.kind, f.h]);
  return list;
}

/* ---------- 3. Lecture des fiches ---------- */
const coreSrc = fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8');
function metaOf(m) {
  return {
    id: m.id, cat: m.cat, sub: m.sub || undefined, titre: m.titre, sous: m.sous || '', resume: m.resume || '',
    tags: m.tags || [], duree: m.duree || '', next: m.next || undefined, ord: m.ord || 0,
  };
}
function extractCode(f) {
  const sb = { console, document: {}, navigator: {}, localStorage: { getItem() { return null; } } };
  sb.window = sb;
  const got = [];
  sb.JPModels = { add: (m) => got.push(m) };
  vm.createContext(sb);
  try {
    vm.runInContext(coreSrc, sb, { filename: 'core.js' });
    const chain = loadList(f.name).map((x) => x[0]);
    chain.forEach((n) => {
      if (n === f.name) got.length = 0; // on ne garde que les modèles déclarés par ce fichier, pas ceux de ses dépendances
      vm.runInContext(files[n].text, sb, { filename: 'models/' + n + '.js' });
    });
  } catch (e) { fail('models/' + f.name + '.js : ' + e.message); }
  return got.map(metaOf);
}

const entries = []; // { meta, ld }
for (const f of Object.values(files)) {
  if (f.lib) continue;
  if (f.kind === 'js') {
    const metas = extractCode(f);
    if (!metas.length) fail('models/' + f.name + '.js ne déclare aucun modèle (JPModels.add manquant ?)');
    metas.forEach((meta) => entries.push({ meta, ld: loadList(f.name), file: f.name }));
  } else {
    let spec;
    try { spec = JSON.parse(f.text); } catch (e) { fail('models/' + f.name + '.json : JSON invalide (' + e.message + ')'); continue; }
    if (spec.dev && !INCLUDE_DEV) continue;
    entries.push({ meta: metaOf(spec), ld: [['spec', 'js', null], [f.name, 'json', f.h]], file: f.name, spec: true });
  }
}

/* ---------- 4. Contrôles de cohérence ---------- */
const ids = new Set();
entries.forEach(({ meta, file }) => {
  const w = 'Modèle « ' + meta.id + ' » : ';
  if (!meta.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.id)) fail(w + 'identifiant invalide (minuscules, chiffres et tirets).');
  if (ids.has(meta.id)) fail(w + 'identifiant en double.');
  ids.add(meta.id);
  if (meta.id !== file && !files[file].lib && entries.filter((e) => e.file === file).length === 1) fail(w + 'le fichier doit s\'appeler models/' + meta.id + '.' + files[file].kind + '.');
  ['titre', 'resume', 'cat'].forEach((k) => { if (!meta[k]) fail(w + 'champ « ' + k + ' » manquant.'); });
  if (meta.cat && !famIds.has(meta.cat)) fail(w + 'famille inconnue « ' + meta.cat + ' » (voir models/families.json).');
  if (!meta.tags || !meta.tags.length) fail(w + 'au moins un mot-clé (tags) est nécessaire à la recherche.');
});
entries.forEach(({ meta }) => { if (meta.next && !ids.has(meta.next)) fail('Modèle « ' + meta.id + ' » : « next » pointe vers « ' + meta.next + ' » qui n\'existe pas.'); });
parcours.forEach((p) => p.etapes.forEach((e) => e.ids.forEach((id) => { if (!ids.has(id)) fail('Parcours « ' + p.titre + ' » : modèle inconnu « ' + id + ' ».'); })));

/* ---------- 4 bis. Bibliothèque : date d'ajout, popularité, étiquettes d'affichage ---------- */
const today = new Date().toISOString().slice(0, 10);
let libDirty = false;
const famCourt = {}; families.forEach((f) => { famCourt[f.id] = f.court || f.titre; });
/* Étiquettes affichées sur les cartes (#OHADA, #CôteDIvoire…) : sous-rubrique, juridiction citée, puis mots-clés rédigés avec majuscule.
   Les mots-clés en minuscules servent seulement à la recherche et ne s'affichent pas. */
function etiquettes(meta) {
  const hay = ' ' + norm([meta.titre, (meta.tags || []).join(' '), meta.resume].join(' ')) + ' ';
  const list = [];
  if (hay.includes(' ohada ')) list.push('OHADA');
  if (hay.includes(' cote d ivoire ')) list.push('Côte d’Ivoire');
  if (meta.sub) list.push(meta.sub);
  (meta.tags || []).forEach((t) => { if (/^[A-ZÀ-Ý0-9]/.test(t)) list.push(t); });
  const seen = new Set(), out = [];
  list.forEach((t) => { const k = norm(t); if (k && !seen.has(k)) { seen.add(k); out.push(t); } });
  if (out.length < 2 && !seen.has(norm(famCourt[meta.cat]))) out.push(famCourt[meta.cat]);
  return out.slice(0, 4);
}
entries.forEach(({ meta }) => {
  if (!(meta.id in library.ajouts)) {
    if (CHECK) fail('Modèle « ' + meta.id + ' » : absent de models/library.json (lancez « npm run build:catalogue » pour y inscrire sa date d\'ajout).');
    else { library.ajouts[meta.id] = today; libDirty = true; }
  }
  const d = library.ajouts[meta.id];
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) fail('Modèle « ' + meta.id + ' » : date d\'ajout invalide dans models/library.json (AAAA-MM-JJ attendu).');
  meta.ajout = d || undefined;
  const r = library.populaires.indexOf(meta.id);
  meta.pop = r > -1 ? r + 1 : undefined;
  meta.etiq = etiquettes(meta);
});
library.rubriques.forEach((r) => {
  if (!r.id || !r.court) fail('models/library.json : une rubrique doit avoir « id » et « court ».');
  if (famIds.has(r.id)) fail('models/library.json : la rubrique « ' + r.id + ' » porte le même identifiant qu\'une famille.');
  (r.ids || []).forEach((id) => { if (!ids.has(id)) fail('models/library.json : la rubrique « ' + r.id + ' » cite un modèle inconnu « ' + id + ' ».'); });
});
const puceIds = new Set(families.map((f) => f.id).concat(library.rubriques.map((r) => r.id)));
library.puces.forEach((id) => { if (!puceIds.has(id)) fail('models/library.json : la puce « ' + id + ' » n\'est ni une famille ni une rubrique.'); });
library.populaires.forEach((id) => { if (!ids.has(id)) fail('models/library.json : « populaires » cite un modèle inconnu « ' + id + ' ».'); });
Object.keys(library.ajouts).forEach((id) => { if (!ids.has(id) && !INCLUDE_DEV) { delete library.ajouts[id]; libDirty = !CHECK || libDirty; } });

if (errors.length) {
  console.error('\n✖ Catalogue invalide :\n  - ' + errors.join('\n  - ') + '\n');
  process.exit(1);
}

/* ---------- 5. Fichiers générés ---------- */
const out = {};
const byFam = {};
entries.forEach(({ meta, ld }) => { (byFam[meta.cat] = byFam[meta.cat] || []).push(Object.assign({}, meta, { ld })); });
const PAGE = 40; // modèles par page de liste : une famille de 1000 modèles se charge 40 par 40
const fam = families.map((f) => ({ id: f.id, titre: f.titre, aide: f.aide || '', ord: f.ord || 0, court: f.court || f.titre, count: (byFam[f.id] || []).length, pages: Math.ceil((byFam[f.id] || []).length / PAGE) }));
Object.keys(byFam).forEach((id) => {
  const list = byFam[id].sort((a, b) => String(a.sub || '').localeCompare(String(b.sub || ''), 'fr') || (a.ord - b.ord) || a.titre.localeCompare(b.titre, 'fr'));
  list.forEach((m) => { delete m.ord; if (m.sub === undefined) delete m.sub; if (m.next === undefined) delete m.next; if (m.ajout === undefined) delete m.ajout; if (m.pop === undefined) delete m.pop; delete m.cat; });
  for (let p = 0; p * PAGE < list.length; p++) out['catalogue/f-' + id + '-' + (p + 1) + '.json'] = JSON.stringify(list.slice(p * PAGE, (p + 1) * PAGE));
});
const idx = {};
entries.forEach(({ meta, ld }) => { idx[meta.id] = { t: meta.titre, f: meta.cat, ld }; });
out['catalogue/index.json'] = JSON.stringify(idx);
out['catalogue/search.json'] = JSON.stringify(entries
  .map(({ meta }) => [meta.id, meta.titre, meta.cat, norm([meta.titre, meta.sous, (meta.tags || []).join(' '), meta.resume].join(' ')), norm(meta.titre)])
  .sort((a, b) => a[1].localeCompare(b[1], 'fr')));
const version = hash(Buffer.from(Object.keys(out).sort().map((k) => k + out[k]).join('|') + JSON.stringify(fam) + JSON.stringify(parcours)));
out['catalogue-data.js'] = '/* GÉNÉRÉ par scripts/build-catalogue.cjs : ne pas modifier à la main (npm run build:catalogue). */\n' +
  'const CAT_VERSION=' + JSON.stringify(version) + ';\n' +
  'const CAT_PAGE=' + PAGE + ';\n' +
  'const CAT_FAMILIES=' + JSON.stringify(fam) + ';\n' +
  'const CAT_PARCOURS=' + JSON.stringify(parcours) + ';\n' +
  'const CAT_RUBRIQUES=' + JSON.stringify(library.rubriques.map((r) => ({ id: r.id, court: r.court, aide: r.aide || '', ids: r.ids || [] }))) + ';\n' +
  'const CAT_PUCES=' + JSON.stringify(library.puces) + ';\n';

if (CHECK) {
  let stale = [];
  Object.keys(out).forEach((k) => { const p = path.join(ROOT, k); if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== out[k]) stale.push(k); });
  if (fs.existsSync(OUT)) fs.readdirSync(OUT).forEach((f) => { if (!out['catalogue/' + f]) stale.push('catalogue/' + f + ' (en trop)'); });
  if (stale.length) { console.error('✖ Catalogue pas à jour : lancez « npm run build:catalogue » puis versionnez le résultat.\n  - ' + stale.join('\n  - ')); process.exit(1); }
  console.log('✔ Catalogue à jour (' + entries.length + ' modèles).');
  process.exit(0);
}

if (libDirty) {
  const ordered = {}; Object.keys(library.ajouts).sort((a, b) => String(library.ajouts[a] || '').localeCompare(String(library.ajouts[b] || '')) || a.localeCompare(b)).forEach((k) => { ordered[k] = library.ajouts[k]; });
  library.ajouts = ordered;
  fs.writeFileSync(LIB_PATH, JSON.stringify(library, null, 1) + '\n');
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
Object.keys(out).forEach((k) => fs.writeFileSync(path.join(ROOT, k), out[k]));
const kb = (k) => (Buffer.byteLength(out[k]) / 1024).toFixed(1) + ' Ko';
console.log('✔ ' + entries.length + ' modèle(s), ' + fam.length + ' famille(s). Version ' + version);
Object.keys(out).forEach((k) => console.log('   ' + k.padEnd(48) + kb(k)));
