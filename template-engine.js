/* ============================================================
   MOTEUR DOCX SOURCE
   Remplit un modèle Word anonymisé sans reconstruire le document.
   Les styles, marges, tableaux, en-têtes, pieds de page, signatures,
   images et relations restent ceux du fichier .docx original.

   Convention : un modèle peut déclarer
   sourceTemplate: { file: "templates/vente.docx", tokens: { "{{nom}}": "nom" } }
   ou simplement utiliser les identifiants de champs sous la forme {{nom}}.
   ============================================================ */
(function (root) {
  'use strict';
  const XML_PARTS = /^(word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml)$/i;
  const escXml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const unescXml = (s) => String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  const DOTS = '………………';

  function valueFor(key, V, S) {
    const k = String(key || '').trim();
    if (V && Object.prototype.hasOwnProperty.call(V, k)) return V[k];
    if (S && Object.prototype.hasOwnProperty.call(S, k)) return S[k];
    return '';
  }

  function tokenMap(model, V, S) {
    const configured = model && model.sourceTemplate && model.sourceTemplate.tokens;
    const map = {};
    if (configured && typeof configured === 'object') {
      Object.keys(configured).forEach((token) => { map[token] = valueFor(configured[token], V, S); });
    }
    const fields = (model && model.etapes || []).flatMap((e) => e.champs || [])
      .flatMap((f) => f.type === 'repeat' ? [] : [f]);
    fields.forEach((f) => {
      if (!f || !f.id || Object.prototype.hasOwnProperty.call(map, '{{' + f.id + '}}')) return;
      const raw = valueFor(f.id, V, S), empty = raw == null || String(raw).trim() === '';
      // un champ resté vide garde ses pointillés : le Word reste complétable à la main, comme l’aperçu et le PDF
      map['{{' + f.id + '}}'] = empty ? DOTS : raw;
      map['{{' + f.id + '_maj}}'] = empty ? DOTS : String(raw).toUpperCase();
      // formes dérivées calculées avec la valeur saisie : « de / d’ + ville », montant en lettres, montant en toutes lettres + FCFA, date sans l’année
      ['_de', '_de_maj', '_lettres', '_fcfa', '_jm'].forEach((sfx) => {
        const key = f.id + sfx;
        if (!V || !Object.prototype.hasOwnProperty.call(V, key)) return;
        const dv = V[key], blank = dv == null || String(dv).trim() === '';
        map['{{' + key + '}}'] = blank ? (sfx === '_de' ? 'de ' + DOTS : sfx === '_de_maj' ? 'DE ' + DOTS : DOTS) : dv;
      });
    });
    return map;
  }

  function replacePlain(xml, map) {
    let out = xml;
    Object.keys(map).sort((a, b) => b.length - a.length).forEach((token) => {
      const value = escXml(map[token]);
      out = out.split(token).join(value);
    });
    return out;
  }

  // Word peut couper un jeton entre plusieurs w:t. Cette routine recolle
  // uniquement les nœuds de texte d’un même paragraphe et remet la valeur
  // dans le premier nœud, en laissant intacts les formats de runs existants.
  function replaceSplitRuns(xml, map) {
    return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi, (para) => {
      const nodes = [];
      const re = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/gi;
      let m;
      while ((m = re.exec(para))) nodes.push({ start: m.index, end: re.lastIndex, open: m[1], text: m[2], close: m[3] });
      if (nodes.length < 2) return para;
      const joined = nodes.map((n) => unescXml(n.text)).join('');
      let replaced = joined;
      Object.keys(map).sort((a, b) => b.length - a.length).forEach((token) => {
        replaced = replaced.split(token).join(String(map[token] == null ? '' : map[token]));
      });
      if (replaced === joined) return para;
      const first = nodes[0];
      let cursor = 0;
      return para.replace(re, (full, open, text, close, offset) => {
        const original = unescXml(text);
        const next = cursor === 0 ? replaced.slice(0, replaced.length) : '';
        cursor += original.length;
        return open + (cursor <= original.length ? escXml(next) : '') + close;
      });
    });
  }

  async function buildSourceTemplateDocx(model, V, S, title) {
    if (typeof JPLibs !== 'undefined') await JPLibs.load('jszip');
    if (typeof JSZip === 'undefined') throw { code: 'lib', lib: 'jszip' };
    const source = model && model.sourceTemplate;
    if (!source || !source.file) throw new Error('Modèle DOCX source non configuré.');
    const response = await fetch('./' + String(source.file).replace(/^\.\//, '') + '?v=' + (source.version || '1'));
    if (!response.ok) throw new Error('Modèle Word introuvable : ' + source.file);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const map = tokenMap(model, V, S);
    const names = Object.keys(zip.files).filter((name) => XML_PARTS.test(name));
    for (const name of names) {
      const file = zip.file(name);
      if (!file) continue;
      let xml = await file.async('string');
      xml = replacePlain(xml, map);
      xml = replaceSplitRuns(xml, map);
      zip.file(name, xml);
    }
    // Le titre est écrit dans les propriétés seulement si elles existent déjà,
    // afin de ne pas introduire de nouvelles relations dans un modèle source.
    const core = zip.file('docProps/core.xml');
    if (core && title) {
      let xml = await core.async('string');
      xml = xml.replace(/(<dc:title[^>]*>)[\s\S]*?(<\/dc:title>)/i, '$1' + escXml(title) + '$2');
      zip.file('docProps/core.xml', xml);
    }
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  root.buildSourceTemplateDocx = buildSourceTemplateDocx;
  root.JPTokenMap = tokenMap;
})(window);
