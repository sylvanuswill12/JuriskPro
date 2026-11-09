#!/usr/bin/env node
/* ============================================================
   Contrôle automatique de TOUS les modèles (sans navigateur).
   À lancer avant chaque publication : npm run test:models

   Pour chaque modèle :
     - structure : étapes, champs uniques, types connus, options, étape finale
     - état « exemple » : le document se génère, ne contient ni « undefined » ni « NaN »,
       aucun champ obligatoire manquant, aucune incohérence
     - état « vide » : le téléchargement est bien bloqué
     - conditions (showIf) : aucune ne plante
     - blocs du document : types connus, exportables en Word

   Usage : node scripts/validate-models.cjs [--dev] [id-du-modele ...]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.cwd();
const MODELS = path.join(ROOT, 'models');
const argv = process.argv.slice(2);
const only = argv.filter((a) => !a.startsWith('--'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const coreSrc = read('core.js'), engineSrc = read('engine.js'), specSrc = read('spec.js');

const FIELD_TYPES = ['text', 'area', 'date', 'money', 'int', 'choice', 'select', 'info', 'title', 'action', 'repeat'];
const BLOCK_KINDS = ['tit', 'sous', 'part', 'art', 'sub', 'li', 'sp', 'pb', 'p', 'box', 'sigs', 'table'];
const JUNK = /undefined|NaN|\bnull\b|\[object|\{\{|\}\}/;

const files = fs.readdirSync(MODELS).filter((f) => /\.(js|json)$/.test(f) && !/^(families|parcours|library)\.json$/.test(f));
const info = {};
files.forEach((f) => {
  const text = fs.readFileSync(path.join(MODELS, f), 'utf8'), head = text.slice(0, 400), name = f.replace(/\.(js|json)$/, '');
  info[name] = { f, kind: f.endsWith('.json') ? 'json' : 'js', text, lib: /@lib\b/.test(head), needs: ((/@needs\s+([\w\-, ]+?)\s*\*\//.exec(head) || [])[1] || '').split(/[ ,]+/).filter(Boolean) };
});
const chain = (name, seen = []) => {
  const x = info[name]; if (!x) throw new Error('fichier requis introuvable : ' + name);
  let l = []; x.needs.forEach((n) => chain(n, seen.concat(name)).forEach((y) => { if (l.indexOf(y) < 0) l.push(y); })); l.push(name); return l;
};

function sandbox() {
  const sb = { console, document: {}, navigator: {}, localStorage: { getItem() { return null; }, setItem() {}, key() { return null; }, length: 0 } };
  sb.window = sb; sb.JPModels = { list: [], add(m) { this.list.push(m); } };
  vm.createContext(sb);
  vm.runInContext(coreSrc, sb, { filename: 'core.js' });
  vm.runInContext(engineSrc, sb, { filename: 'engine.js' });
  vm.runInContext(specSrc, sb, { filename: 'spec.js' });
  return sb;
}
function loadModelsOf(name) {
  const sb = sandbox();
  if (info[name].kind === 'json') {
    const spec = JSON.parse(info[name].text);
    sb.JPModels.add(vm.runInContext('JPSpec', sb).build(spec));
    return { sb, models: sb.JPModels.list, dev: !!spec.dev };
  }
  chain(name).forEach((n) => { if (n === name) sb.JPModels.list.length = 0; vm.runInContext(info[n].text, sb, { filename: 'models/' + n + '.js' }); });
  return { sb, models: sb.JPModels.list, dev: false };
}

let total = 0, bad = 0;
const report = [];
function check(sb, m, problems) {
  const P = (msg) => problems.push(msg);
  ['id', 'titre', 'cat'].forEach((k) => { if (!m[k]) P('champ « ' + k + ' » manquant'); });
  ['defaults', 'compute', 'blocks', 'docTitle', 'fileBase'].forEach((k) => { if (typeof m[k] !== 'function') P('« ' + k + ' » doit être une fonction'); });
  if (!m.exemple || typeof m.exemple !== 'object') P('« exemple » manquant');
  if (!Array.isArray(m.etapes) || !m.etapes.length) { P('aucune étape'); return; }
  const finals = m.etapes.filter((e) => e.final);
  if (finals.length !== 1 || !m.etapes[m.etapes.length - 1].final) P('il faut une seule étape finale, placée en dernier');

  /* structure des champs */
  const seen = new Set();
  const walk = (f, where) => {
    if (!f || !f.type) { P(where + ' : champ sans type'); return; }
    if (FIELD_TYPES.indexOf(f.type) < 0) P(where + ' : type inconnu « ' + f.type + ' »');
    if (f.type !== 'repeat' && !f.id) P(where + ' : champ sans id');
    if (f.id && f.type !== 'repeat') { if (seen.has(f.id)) P('identifiant de champ en double : ' + f.id); seen.add(f.id); }
    if (['text', 'area', 'date', 'money', 'int', 'choice', 'select'].indexOf(f.type) > -1 && !f.label) P('champ « ' + f.id + ' » sans libellé');
    if ((f.type === 'choice' || f.type === 'select') && typeof f.opts !== 'function' && !(f.opts && f.opts.length)) P('champ « ' + f.id + ' » sans options');
    if (f.type === 'info' && typeof f.calc !== 'function') P('champ info « ' + f.id + ' » sans calcul');
  };
  m.etapes.forEach((e, si) => (e.champs || []).forEach((c) => {
    if (c.type === 'repeat') {
      if (!c.countKey || !c.prefix || !c.max || typeof c.fields !== 'function') { P('liste répétée « ' + c.id + ' » incomplète'); return; }
      for (let i = 0; i < c.max; i++) c.fields(i).forEach((f) => walk(f, 'étape ' + (si + 1)));
    } else walk(c, 'étape ' + (si + 1));
  }));

  /* état exemple */
  let S;
  try { S = Object.assign(m.defaults(), JSON.parse(JSON.stringify(m.exemple)), { date: '2026-01-15' }); } catch (e) { P('defaults/exemple : ' + e.message); return; }
  let V, bl, out, txt;
  try {
    V = m.compute(S); bl = m.blocks(S, V);
    out = sb.renderHTML(bl, V); txt = sb.toText(bl, V);
  } catch (e) { P('génération du document (exemple) : ' + e.message); return; }
  if (!Array.isArray(bl) || !bl.length) P('le document est vide');
  (bl || []).forEach((b) => { if (BLOCK_KINDS.indexOf(b.k) < 0) P('type de bloc inconnu « ' + b.k + ' »'); });
  if (typeof sb.blockXML === 'function') { try { (bl || []).forEach((b) => sb.blockXML(b, V)); } catch (e) { P('export Word impossible : ' + e.message); } }
  if (out.missing.size) P('le document de l\'exemple contient ' + out.missing.size + ' blanc(s) : ' + [...out.missing].slice(0, 5).map((k) => '{{' + k + '}}').join(' ') + ' (faute de frappe dans un {{champ}}, ou champ non rempli dans l\'exemple ?)');
  const j = JUNK.exec(txt); if (j) P('le document contient « ' + j[0] + ' » : ' + txt.slice(Math.max(0, j.index - 30), j.index + 30).replace(/\s+/g, ' '));
  if (!m.docTitle(V) || !m.fileBase(V)) P('titre ou nom de fichier vide');
  let fv;
  try { fv = sb.finalValidation(m, S); } catch (e) { P('validation (exemple) : ' + e.message); return; }
  if (fv.req.length) P('l\'exemple laisse ' + fv.req.length + ' champ(s) obligatoire(s) vide(s) : ' + fv.req.slice(0, 3).map((x) => x.label).join(' ; '));
  if (fv.an.probs.length) P('l\'exemple déclenche une incohérence : ' + fv.an.probs[0].t);
  if (m.sourceTemplate && m.sourceTemplate.file) {
    const sourcePath = path.join(ROOT, m.sourceTemplate.file);
    if (!fs.existsSync(sourcePath)) P('modèle Word source introuvable : ' + m.sourceTemplate.file);
  }

  /* état vide : doit être bloqué */
  try {
    const E = m.defaults(); const ev = sb.finalValidation(m, E);
    // Une matrice Word (sourceTemplate) peut se télécharger vide : tous ses champs sont facultatifs.
    // Une matrice sans aucune zone de saisie (seulement un texte d'information) se télécharge telle quelle.
    let hasInput = false;
    sb.eachField(m, (f) => { if (['info', 'title', 'action'].indexOf(f.type) < 0) hasInput = true; });
    if (hasInput && !ev.blocked && !m.sourceTemplate) P('un formulaire vide n\'est pas bloqué (aucun champ obligatoire détecté)');
  } catch (e) { P('validation (vide) : ' + e.message); }

  /* conditions */
  try { sb.eachField(m, (f) => { if (f.showIf) f.showIf(S); }); } catch (e) { P('une condition showIf plante : ' + e.message); }
}

const names = Object.keys(info).filter((n) => !info[n].lib && (!only.length || only.indexOf(n) > -1));
names.forEach((n) => {
  let loaded;
  try { loaded = loadModelsOf(n); } catch (e) { total++; bad++; report.push({ n, p: ['chargement impossible : ' + e.message] }); return; }
  loaded.models.forEach((m) => {
    total++;
    const p = []; check(loaded.sb, m, p);
    if (p.length) bad++;
    report.push({ n: m.id, p, dev: loaded.dev });
  });
});

report.forEach((r) => console.log((r.p.length ? '✖ ' : '✔ ') + r.n + (r.dev ? ' (test)' : '') + (r.p.length ? '\n    - ' + r.p.join('\n    - ') : '')));
console.log('\n' + (bad ? '✖ ' + bad + ' modèle(s) en erreur sur ' + total : '✔ ' + total + ' modèle(s) contrôlé(s), aucune erreur.'));
process.exit(bad ? 1 : 0);
