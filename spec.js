/* ============================================================
   MOTEUR DE MODÈLES DÉCRITS PAR DES DONNÉES (JSON)
   Transforme un fichier models/<id>.json en modèle utilisable par l'application,
   sans écrire de code. Format et exemples : MODELES.md.
   Chargé seulement quand un modèle JSON est ouvert.
   Dépend de core.js (lettres, fmt, dateFr, newV, fileSlug, P, todayISO).
   ============================================================ */
const JPSpec = (function () {
  const PRESETS = {
    civilite: [{ v: 'M.', t: 'Monsieur' }, { v: 'Mme', t: 'Madame' }],
    ouinon: [{ v: 'oui', t: 'Oui' }, { v: 'non', t: 'Non' }],
  };
  const DISPLAY = ['info', 'title', 'action'];
  const fail = (spec, msg) => { throw new Error('Modèle « ' + (spec && spec.id) + ' » : ' + msg); };

  /* ---------- Conditions : des données, jamais du code exécuté ---------- */
  /* Un champ s'écrit tel quel (« mode »), ou « @champ » = le même champ dans la ligne répétée courante. */
  function keyOf(k, ctx) {
    k = String(k || '');
    if (k.charAt(0) === '@') { if (!ctx) throw new Error('« ' + k + ' » n\'a de sens que dans une liste répétée'); return ctx.prefix + ctx.i + '_' + k.slice(1); }
    return k;
  }
  function cond(c, ctx) {
    if (c == null || c === true) return () => true;
    if (Array.isArray(c.all)) { const f = c.all.map((x) => cond(x, ctx)); return (S) => f.every((g) => g(S)); }
    if (Array.isArray(c.any)) { const f = c.any.map((x) => cond(x, ctx)); return (S) => f.some((g) => g(S)); }
    if (c.not) { const g = cond(c.not, ctx); return (S) => !g(S); }
    if (!c.field) throw new Error('condition sans « field » : ' + JSON.stringify(c));
    const key = keyOf(c.field, ctx), get = (S) => String(S[key] == null ? '' : S[key]).trim();
    if ('eq' in c) return (S) => get(S) === String(c.eq);
    if ('ne' in c) return (S) => get(S) !== String(c.ne);
    if (Array.isArray(c.in)) return (S) => c.in.map(String).indexOf(get(S)) > -1;
    if ('gt' in c) return (S) => Number(get(S)) > Number(c.gt);
    if ('lt' in c) return (S) => Number(get(S)) < Number(c.lt);
    if (c.filled) return (S) => get(S) !== '';
    if (c.empty) return (S) => get(S) === '';
    throw new Error('condition non reconnue : ' + JSON.stringify(c));
  }

  /* « de » devant un nom de ville : d’Abidjan, de Bouaké (le h reste muet ou aspiré selon le mot : on ne l’élide pas) */
  const deElide = (v) => { v = String(v == null ? '' : v).trim(); return !v ? '' : (/^[aeiouàâäéèêëîïôöùûü]/i.test(v) ? 'd’' + v : 'de ' + v); };

  /* ---------- Textes avec {{champs}} ---------- */
  const plain = (tpl, V) => String(tpl == null ? '' : tpl).replace(/\{\{\??(\w+)\}\}/g, (m, k) => (V[k] == null ? '' : String(V[k])));
  const firstKey = (tpl) => { const m = /\{\{\??(\w+)\}\}/.exec(String(tpl)); return m ? m[1] : null; };
  /* Dans une boucle « each » : {{@nom}} devient {{p0_nom}}, {{#}} devient le numéro (1, 2, 3…). */
  function sub(str, ctx) {
    if (!ctx) return str;
    return str.replace(/\{\{(\??)@(\w+)\}\}/g, (m, q, k) => '{{' + q + ctx.prefix + ctx.i + '_' + k + '}}').replace(/\{\{#\}\}/g, String(ctx.i + 1));
  }
  function walk(v, ctx) {
    if (typeof v === 'string') return sub(v, ctx);
    if (Array.isArray(v)) return v.map((x) => walk(x, ctx));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = (k === 'k' || k === 'al' || k === 'cols') ? v[k] : walk(v[k], ctx); }); return o; }
    return v;
  }

  /* ---------- Champs ---------- */
  function opts(f) {
    if (typeof f.opts === 'string') { if (!PRESETS[f.opts]) throw new Error('liste « ' + f.opts + ' » inconnue (civilite, ouinon)'); return PRESETS[f.opts]; }
    return (f.opts || []).map((o) => (typeof o === 'string' ? { v: o, t: o } : o));
  }
  function mapField(f, ctx, ids) {
    if (!f.id || !f.type) throw new Error('un champ doit avoir « id » et « type » : ' + JSON.stringify(f).slice(0, 80));
    const o = Object.assign({}, f);
    o.id = ctx ? ctx.prefix + ctx.i + '_' + f.id : f.id;
    if (ids.has(o.id)) throw new Error('champ « ' + o.id + ' » en double');
    ids.add(o.id);
    if (f.type === 'choice' || f.type === 'select') {
      const L = opts(f); if (!L.length) throw new Error('le champ « ' + f.id + ' » n\'a aucune option'); o.opts = L;
      if (f.type === 'select') o.opts = L; // le champ select de l'application attend des options {v,t}
    }
    delete o.showIf; delete o.when; delete o.def; delete o.text;
    if (f.showIf) o.showIf = cond(f.showIf, ctx);
    if (f.type === 'info') {
      const w = cond(f.when, ctx);
      o.calc = (S, V) => (w(S) ? { t: plain(sub(f.text || '', ctx), V), c: f.c || '' } : null);
      delete o.c;
    }
    return o;
  }
  function mapStep(e, ids, repeats) {
    return Object.assign({}, e, {
      champs: (e.champs || []).map((c) => {
        if (c.type !== 'repeat') return mapField(c, null, ids);
        if (!c.prefix || !c.countKey || !c.max) throw new Error('la liste « ' + c.id + ' » exige prefix, countKey et max');
        const r = Object.assign({}, c, { min: c.min || 1 });
        delete r.showIf;
        if (c.showIf) r.showIf = cond(c.showIf, null);
        const probe = ids; // vérifie l'unicité des identifiants de chaque ligne
        r.fields = (i) => c.fields.map((f) => mapField(f, { prefix: c.prefix, i }, new Set()));
        for (let i = 0; i < c.max; i++) c.fields.forEach((f) => { const id = c.prefix + i + '_' + f.id; if (probe.has(id)) throw new Error('champ « ' + id + ' » en double'); probe.add(id); });
        repeats[c.id] = r;
        return r;
      }),
    });
  }

  /* ---------- Construction du modèle ---------- */
  function build(spec) {
    if (!spec || typeof spec !== 'object') throw new Error('modèle vide');
    ['id', 'cat', 'titre', 'resume'].forEach((k) => { if (!spec[k]) fail(spec, 'champ « ' + k + ' » manquant'); });
    if (!Array.isArray(spec.etapes) || !spec.etapes.length) fail(spec, 'au moins une étape est nécessaire');
    if (!Array.isArray(spec.doc) || !spec.doc.length) fail(spec, 'le document (« doc ») est vide');
    const ids = new Set(), repeats = {};
    let etapes;
    try { etapes = spec.etapes.map((e) => mapStep(e, ids, repeats)); } catch (e) { fail(spec, e.message); }
    if (!etapes.some((e) => e.final)) etapes.push({ id: 'final', court: 'Télécharger', titre: 'Vérifier et télécharger', final: true, champs: [] });

    /* liste à plat des champs (pour defaults / compute) */
    const flat = [];
    etapes.forEach((e) => (e.champs || []).forEach((c) => {
      if (c.type === 'repeat') for (let i = 0; i < c.max; i++) c.fields(i).forEach((f) => flat.push(f)); else flat.push(c);
    }));
    const rawDefaults = {};
    spec.etapes.forEach((e) => (e.champs || []).forEach((c) => {
      if (c.type === 'repeat') {
        rawDefaults[c.countKey] = String(c.def != null ? c.def : (c.min || 1));
        for (let i = 0; i < c.max; i++) c.fields.forEach((f) => { if (f.def != null) rawDefaults[c.prefix + i + '_' + f.id] = f.def === '@today' ? todayISO() : String(f.def); });
      } else if (c.def != null) rawDefaults[c.id] = c.def === '@today' ? todayISO() : String(c.def);
    }));

    function compute(S) {
      const V = newV();
      flat.forEach((f) => {
        if (DISPLAY.indexOf(f.type) > -1) return;
        const raw = String(S[f.id] == null ? '' : S[f.id]).trim(), id = f.id;
        if (f.type === 'date') {
          V[id] = raw ? dateFr(raw) : ''; V._src[id] = id;
          // « 15 mars » sans l’année : pour les actes dont « L’AN DEUX MIL … » est déjà écrit dans le texte (modèles Word : {{champ_jm}})
          V[id + '_jm'] = raw ? dateFr(raw).replace(/\s\d{4}$/, '') : ''; V._src[id + '_jm'] = id;
        }
        else if (f.type === 'money') {
          const n = Number(String(raw).replace(/\s/g, ''));
          V[id] = raw && isFinite(n) ? fmt(n) : ''; V[id + '_lettres'] = raw && isFinite(n) ? lettres(n) : '';
          V[id + '_fcfa'] = raw && isFinite(n) ? fcfa(n) : '';
          V._src[id] = id; V._src[id + '_lettres'] = id; V._src[id + '_fcfa'] = id;
        } else if (f.type === 'choice' || f.type === 'select') {
          V[id] = raw; const o = (f.opts || []).filter((x) => x.v === raw)[0]; V[id + '_t'] = o ? o.t : ''; V._src[id + '_t'] = id;
        } else {
          V[id] = raw;
          if (f.upper) { V[id + '_maj'] = raw.toUpperCase(); V._src[id + '_maj'] = id; }
          // « de Bouaké » / « d’Abidjan » : l’élision suit la ville saisie (modèles Word : {{champ_de}} et {{champ_de_maj}})
          V[id + '_de'] = deElide(raw); V[id + '_de_maj'] = deElide(raw).toUpperCase();
          V._src[id + '_de'] = id; V._src[id + '_de_maj'] = id;
        }
      });
      Object.keys(spec.calc || {}).forEach((name) => {
        const d = spec.calc[name];
        if (d.tpl != null) { V[name] = plain(d.tpl, V).replace(/\s+/g, ' ').trim(); const k = firstKey(d.tpl); if (k) V._src[name] = V._src[k] || k; }
        else if (d.pick) { const raw = String(S[d.pick] == null ? '' : S[d.pick]).trim(); V[name] = d.map && d.map[raw] != null ? d.map[raw] : (d.def || ''); V._src[name] = d.pick; V._nohl.add(name); }
        else if (d.fn) {
          const base = S[d.of] != null ? String(S[d.of]).trim() : (V[d.of] == null ? '' : String(V[d.of])); // valeur saisie, ou résultat d'un calcul précédent
          const n = Number(String(base).replace(/\s/g, ''));
          const F = { upper: () => String(base).toUpperCase(), lower: () => String(base).toLowerCase(), lettres: () => (base === '' ? '' : lettres(n)), fcfa: () => (base === '' ? '' : fcfa(n)), fmt: () => (base === '' ? '' : fmt(n)), date: () => (base ? dateFr(base) : '') };
          if (!F[d.fn]) throw new Error('fonction « ' + d.fn + ' » inconnue');
          V[name] = F[d.fn](); V._src[name] = V._src[d.of] || d.of;
        } else throw new Error('calcul « ' + name + ' » non reconnu');
      });
      return V;
    }

    function expand(items, S, ctx) {
      const out = [];
      items.forEach((it) => {
        if (it.if) {
          const ok = cond(it.if, ctx)(S);
          out.push.apply(out, expand(ok ? (it.then || []) : (it.else || []), S, ctx));
        } else if (it.each) {
          const r = repeats[it.each]; if (!r) throw new Error('« each » : liste « ' + it.each + ' » inconnue');
          const n = clamp(parseInt(S[r.countKey], 10) || r.min || 1, r.min || 1, r.max);
          for (let i = 0; i < n; i++) out.push.apply(out, expand(it.blocks || [], S, { prefix: r.prefix, i }));
        } else {
          if (it.when && !cond(it.when, ctx)(S)) return;
          const b = walk(it, ctx); delete b.when;
          out.push(b);
        }
      });
      return out;
    }

    const first = flat.filter((f) => f.req && ['text', 'area'].indexOf(f.type) > -1)[0];
    return {
      id: spec.id, cat: spec.cat, sub: spec.sub, titre: spec.titre, sous: spec.sous || '', resume: spec.resume,
      tags: spec.tags || [], duree: spec.duree || '', next: spec.next,
      etapes: etapes,
      defaults: () => Object.assign({}, rawDefaults),
      exemple: spec.exemple || {},
      compute: compute,
      blocks: (S, V) => expand(spec.doc, S, null),
      docTitle: (V) => plain(spec.docTitle || spec.titre, V),
      fileBase: (V) => fileSlug(plain(spec.fileBase || spec.docTitle || spec.titre, V)) || fileSlug(spec.titre),
      finalNote: spec.finalNote || '',
      sourceTemplate: spec.sourceTemplate || null,
      etapesAuChoix: !!spec.etapesAuChoix, noteForm: spec.noteForm || '',
      headline: (S) => plain(spec.headline || (first ? '{{' + first.id + '}}' : ''), S),
    };
  }

  return { build, PRESETS };
})();
