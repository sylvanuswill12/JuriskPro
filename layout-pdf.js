/* ============================================================
   MOTEUR DE MISE EN PAGE FIDÈLE (modèles issus des fichiers Word)
   - lit le JSON de mise en page extrait du .docx (templates/*.lay.json) ;
   - insère les valeurs saisies, refait les retours à la ligne et les sauts de page
     avec les mêmes polices que l'aperçu d'origine ;
   - écrit un vrai PDF (texte sélectionnable) avec jsPDF.
   Les mesures viennent directement des fichiers de polices (largeurs d'avance) :
   le résultat est identique sur tous les appareils.
   ============================================================ */
(function (root) {
  'use strict';

  const DOTS = '………………';
  const PT = 1 / 20;                         // twip -> point

  /* ---------- lecture minimale d'une police TrueType ---------- */
  function parseTTF(buf) {
    const dv = new DataView(buf);
    const nt = dv.getUint16(4), T = {};
    for (let i = 0; i < nt; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
      T[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
    }
    const upem = dv.getUint16(T.head.off + 18);
    const asc = dv.getInt16(T.hhea.off + 4), desc = -dv.getInt16(T.hhea.off + 6);
    const nH = dv.getUint16(T.hhea.off + 34);
    const hm = T.hmtx.off;
    const adv = (g) => dv.getUint16(hm + Math.min(g, nH - 1) * 4);
    // cmap -> Map(code point -> glyphe)
    const cmap = new Map();
    const co = T.cmap.off, nSub = dv.getUint16(co + 2);
    let best = null;
    for (let i = 0; i < nSub; i++) {
      const pid = dv.getUint16(co + 4 + i * 8), eid = dv.getUint16(co + 6 + i * 8), off = dv.getUint32(co + 8 + i * 8);
      const fmt = dv.getUint16(co + off);
      if ((pid === 3 && (eid === 1 || eid === 10)) || (pid === 0)) {
        if (!best || fmt === 12 || (best.fmt !== 12 && fmt === 4)) best = { off: co + off, fmt };
      }
    }
    if (best && best.fmt === 4) {
      const o = best.off, sc = dv.getUint16(o + 6) / 2;
      const endO = o + 14, startO = endO + sc * 2 + 2, deltaO = startO + sc * 2, rangeO = deltaO + sc * 2;
      for (let s = 0; s < sc; s++) {
        const e = dv.getUint16(endO + s * 2), st = dv.getUint16(startO + s * 2), dl = dv.getInt16(deltaO + s * 2), ro = dv.getUint16(rangeO + s * 2);
        for (let c = st; c <= e && c < 0xFFFF; c++) {
          let g;
          if (ro === 0) g = (c + dl) & 0xFFFF;
          else {
            const gi = rangeO + s * 2 + ro + (c - st) * 2;
            g = dv.getUint16(gi);
            if (g) g = (g + dl) & 0xFFFF;
          }
          if (g) cmap.set(c, g);
        }
      }
    } else if (best && best.fmt === 12) {
      const o = best.off, n = dv.getUint32(o + 12);
      for (let k = 0; k < n; k++) {
        const st = dv.getUint32(o + 16 + k * 12), e = dv.getUint32(o + 20 + k * 12), g0 = dv.getUint32(o + 24 + k * 12);
        for (let c = st; c <= e; c++) cmap.set(c, g0 + c - st);
      }
    }
    let ulp = -0.1, ult = 0.05;
    if (T.post) { ulp = dv.getInt16(T.post.off + 8) / upem; ult = dv.getInt16(T.post.off + 10) / upem; }
    const cache = new Map();
    return {
      upem, asc: asc / upem, desc: desc / upem, ulp, ult,
      has: (cp) => cmap.has(cp),
      w: (cp) => {
        let v = cache.get(cp);
        if (v === undefined) { const g = cmap.get(cp); v = g ? adv(g) / upem : -1; cache.set(cp, v); }
        return v;
      }
    };
  }

  /* ---------- polices ---------- */
  const STY = ['r', 'b', 'i', 'bi'];
  const styOf = (fl) => STY[(fl & 1 ? 1 : 0) + (fl & 2 ? 2 : 0) - (fl & 1 && fl & 2 ? 0 : 0) === 3 ? 3 : ((fl & 1) ? 1 : 0) + ((fl & 2) ? 2 : 0)];

  function makeEnv(fonts) {
    // fonts[key][st] = {m: parsed}
    const env = { fonts, cw: new Map() };
    env.font = (key, fl) => {
      const f = fonts[key] || fonts.serif || Object.values(fonts)[0];
      return f[styOf(fl)] || f.r;
    };
    // largeur d'un texte en points
    env.width = (s, key, fl, z) => {
      const F = env.font(key, fl).m;
      let w = 0;
      for (const ch of s) {
        const cp = ch.codePointAt(0);
        let a = F.w(cp);
        if (a < 0) a = cp === 0xA0 ? F.w(0x20) : (F.w(0x3F) > 0 ? F.w(0x3F) : 0.5);
        w += a;
      }
      return w * z;
    };
    return env;
  }

  const isSpace = (c) => c === ' ';
  const isNB = (c) => c === ' ';
  const SUPSZ = 0.58, SUPUP = 0.33, SUBDN = 0.08;

  /* ---------- atomes d'un paragraphe ---------- */
  function substitute(text, V) {
    return text.replace(/\{\{(#?\??\w+)\}\}/g, (m, id) => {
      if (V && V[m] != null) return String(V[m]);
      if (id[0] === '#') return V && V[m] != null ? V[m] : '0';
      return '';
    });
  }

  function atomsOf(runs, V, env) {
    const atoms = [];
    for (const r of runs) {
      let txt = substitute(r[0], V);
      const fk = r[1], z = r[2] / 2, fl = r[3], col = r[4] || '', hl = r[5] || '';
      if (fl & 32 || fl & 64) txt = txt.toUpperCase();
      const sc = (fl & 24) ? SUPSZ : 1;
      const zz = z * sc;
      const base = { f: fk, fl, z: zz, col, hl, up: (fl & 8) ? SUPUP * z : (fl & 16) ? -SUBDN * z : 0 };
      let i = 0;
      const n = txt.length;
      while (i < n) {
        const c = txt[i];
        if (c === '\t') { atoms.push(Object.assign({ k: 't', w: 0 }, base)); i++; continue; }
        if (c === '\n') { atoms.push(Object.assign({ k: 'n', w: 0 }, base)); i++; continue; }
        if (c === '\f') { atoms.push(Object.assign({ k: 'f', w: 0 }, base)); i++; continue; }
        if (c === '\r') { i++; continue; }
        if (isSpace(c) || isNB(c)) {
          let j = i;
          while (j < n && txt[j] === c) j++;
          const cnt = j - i;
          atoms.push(Object.assign({ k: 's', s: c.repeat(cnt), nb: isNB(c), w: env.width(c.repeat(cnt), fk, fl, zz) }, base));
          i = j; continue;
        }
        // mot : jusqu'à espace/tab/saut ; coupures possibles après un trait d'union
        let j = i;
        while (j < n && !'  \t\n\f\r'.includes(txt[j])) j++;
        const word = txt.slice(i, j);
        let st = 0;
        for (let k = 0; k < word.length; k++) {
          const ch = word[k];
          if ((ch === '-' || ch === '‐' || ch === '–' || ch === '—') && k < word.length - 1 && k > 0) {
            const part = word.slice(st, k + 1);
            atoms.push(Object.assign({ k: 'w', s: part, bk: true, w: env.width(part, fk, fl, zz) }, base));
            st = k + 1;
          }
        }
        const part = word.slice(st);
        if (part) atoms.push(Object.assign({ k: 'w', s: part, w: env.width(part, fk, fl, zz) }, base));
        i = j;
      }
    }
    return atoms;
  }

  /* ---------- mise en page d'un paragraphe ---------- */
  function lineMetrics(items, p, env) {
    let asc = 0, desc = 0;
    for (const it of items) {
      const F = env.font(it.f, it.fl).m;
      const z = (it.fl & 24) ? it.z / SUPSZ : it.z;     // la hauteur de ligne suit la taille d'origine
      asc = Math.max(asc, F.asc * z); desc = Math.max(desc, F.desc * z);
    }
    return [asc, desc];
  }

  function lineHeight(asc, desc, p) {
    const ln = p.ln || [240, 'a'];
    const nat = asc + desc;
    let h;
    if (ln[1] === 'e') h = ln[0] * PT;
    else if (ln[1] === 'l') h = Math.max(nat, ln[0] * PT);
    else h = nat * (ln[0] / 240);
    return { h, base: h - desc };
  }

  function tabStops(p, defTab) { return (p.tb || []).map((t) => ({ pos: t[0], al: t[1], ld: t[2] })); }

  /* retourne {lines:[{h,base,items:[{x,...}],last}], marker} ; x relatifs au bord gauche de la zone de texte */
  function layoutPara(p, width, V, env, ctx) {
    const il = (p.il || 0) * PT, ir = (p.ir || 0) * PT, fl = (p.fl || 0) * PT;
    const defTab = (ctx.tab || 720) * PT;
    const stops = tabStops(p).map((s) => ({ pos: s.pos * PT, al: s.al, ld: s.ld })).sort((a, b) => a.pos - b.pos);
    const right = width - ir;
    let atoms = p.r ? atomsOf(p.r, V, env) : [];
    const lines = [];
    let first = true;
    // marqueur de liste
    let marker = null;
    let startFirst = il + fl;
    if (p.mk) {
      const m = p.mk;
      const mz = m[2] / 2, mfl = m[3];
      const mw = env.width(m[0], m[1], mfl, mz);
      marker = { s: m[0], f: m[1], fl: mfl, z: mz, col: m[4] || '', w: mw, x: startFirst };
    }
    const nextStop = (x, firstLine) => {
      // x : position courante (relative à la marge). Retourne {pos, al, ld}
      let cand = null;
      for (const s of stops) if (s.pos > x + 0.01) { cand = s; break; }
      if (firstLine && fl < 0 && il > x + 0.01 && (!cand || il < cand.pos)) cand = { pos: il, al: 'l', ld: '' };
      if (cand) return cand;
      const last = stops.length ? stops[stops.length - 1].pos : 0;
      let d = Math.floor((x + 0.01) / defTab + 1) * defTab;
      if (d <= last) d = Math.floor(last / defTab + 1) * defTab;
      return { pos: d, al: 'l', ld: '' };
    };

    let i = 0;
    let curItems = [], x = 0, lastBreak = -1, lastBreakX = 0, startX = 0, availRight = right;
    let forced = false;
    const startLine = () => {
      curItems = []; lastBreak = -1;
      startX = first ? startFirst : il;
      x = startX;
      if (first && marker) {
        const suff = p.mk[5] || 'tab';
        let mx = marker.w;
        x = marker.x + mx;
        if (suff === 'tab') {
          const st = nextStop(x, true);
          x = Math.max(st.pos, x);
        } else if (suff === 'space') {
          x += env.width(' ', marker.f, marker.fl, marker.z);
        }
        startX = Math.min(startX, x);
      }
    };
    const finishLine = (items, isLast, brokeForced, leftover) => {
      // retire les espaces de fin pour l'alignement
      let end = items.length;
      while (end > 0 && items[end - 1].k === 's') end--;
      const visible = items.slice(0, end);
      const [asc, desc] = lineMetrics(items.length ? items : [{ f: (p.e || ['serif', 20])[0], fl: 0, z: (p.e || ['serif', 20])[1] / 2 }], p, env);
      const lh = lineHeight(asc, desc, p);
      lines.push({ items, visible, h: lh.h, base: lh.base, asc, desc, last: isLast, forced: brokeForced, firstLine: lines.length === 0, marker: lines.length === 0 ? marker : null });
    };

    const place = (items, firstLine) => {
      // calcule les x des atomes de la ligne
      let cx = firstLine && marker ? marker.x + marker.w : (firstLine ? startFirst : il);
      let begin = firstLine ? startFirst : il;
      if (firstLine && marker) {
        const suff = p.mk[5] || 'tab';
        if (suff === 'tab') { const st = nextStop(cx, true); cx = Math.max(st.pos, cx); }
        else if (suff === 'space') cx += env.width(' ', marker.f, marker.fl, marker.z);
        begin = cx;
      }
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        if (it.k === 't') {
          const st = nextStop(cx, firstLine);
          let target = st.pos;
          if (st.al !== 'l') {
            // largeur du texte qui suit jusqu'à la prochaine tabulation
            let seg = 0;
            for (let m = k + 1; m < items.length && items[m].k !== 't'; m++) seg += items[m].w;
            let tw = seg;
            // espaces de fin exclus
            for (let m = items.length - 1; m > k && items[m].k === 's'; m--) { tw -= items[m].w; }
            target = st.al === 'r' ? st.pos - tw : st.pos - tw / 2;
            if (target < cx) target = cx;
          }
          if (target > right + 0.5) target = Math.max(cx, right);
          it.x = cx; it.w = target - cx; it.ld = st.ld;
          cx = target;
        } else { it.x = cx; cx += it.w; }
      }
      return { begin, end: cx };
    };

    const alignLine = (ln) => {
      const items = ln.items;
      const pl = place(items, ln.firstLine);
      // largeur visible (sans espaces de fin)
      let end = items.length; while (end > 0 && items[end - 1].k === 's') end--;
      const vis = items.slice(0, end);
      const contentEnd = vis.length ? vis[vis.length - 1].x + vis[vis.length - 1].w : pl.begin;
      const al = p.al || 'l';
      const lineRight = right;
      if (al === 'c') {
        const sh = (lineRight - pl.begin - (contentEnd - pl.begin)) / 2 - (contentEnd - contentEnd) ;
        const off = (lineRight + pl.begin - contentEnd - 0) / 2 - pl.begin * 0;
        const shift = ((lineRight - contentEnd) + (pl.begin - pl.begin)) / 2 - (pl.begin - il) * 0;
        const w = contentEnd - pl.begin;
        const sx = pl.begin + ((lineRight - pl.begin) - w) / 2 - pl.begin;
        for (const it of items) it.x += sx;
        ln.shift = sx;
      } else if (al === 'r') {
        const sx = lineRight - contentEnd;
        for (const it of items) it.x += sx;
        ln.shift = sx;
      } else if (al === 'j' && !ln.last && !ln.forced) {
        // répartit l'espace restant entre les espaces de la ligne (hors espaces de fin et insécables)
        const extra = lineRight - contentEnd;
        let nsp = 0;
        for (const it of vis) if (it.k === 's' && !it.nb) nsp += it.s.length;
        if (Math.abs(extra) > 0.01 && nsp > 0 && extra > -0.5 * 1e9) {
          const add = extra / nsp;
          let acc = 0;
          for (const it of items) {
            it.x += acc;
            if (it.k === 's' && !it.nb) { it.w += add * it.s.length; acc += add * it.s.length; }
            if (it.k === 't') { /* les tabulations gardent leur largeur */ }
          }
        }
      }
      ln.contentEnd = contentEnd; ln.begin = pl.begin;
    };

    // --- construction des lignes
    startLine();
    let pendingFormFeed = false;
    const flush = (isLast, forcedBreak) => {
      finishLine(curItems, isLast, forcedBreak);
      first = false;
    };
    const widthOf = (items) => {
      let w = 0; for (const it of items) w += it.w; return w;
    };
    for (let ai = 0; ai < atoms.length; ai++) {
      const a = atoms[ai];
      if (a.k === 'n') { curItems.push(a); a.w = 0; flush(false, true); startLine(); continue; }
      if (a.k === 'f') { flush(false, true); lines[lines.length - 1].pageBreakAfter = true; startLine(); continue; }
      if (a.k === 't') {
        // largeur provisoire (réelle calculée à l'alignement) : on estime avec la position courante
        const cx = x;
        const st = nextStop(cx, first);
        let target = st.pos;
        if (st.al !== 'l') {
          let seg = 0;
          for (let m = ai + 1; m < atoms.length && atoms[m].k !== 't' && atoms[m].k !== 'n' && atoms[m].k !== 'f'; m++) seg += atoms[m].w;
          target = st.al === 'r' ? st.pos - seg : st.pos - seg / 2;
          if (target < cx) target = cx;
        }
        if (target > right + 0.5) target = Math.max(cx, right);
        a.w = target - cx;
        curItems.push(a); x = target;
        continue;
      }
      if (a.k === 's') {
        curItems.push(a); x += a.w;
        if (!a.nb) { lastBreak = curItems.length; lastBreakX = x; }
        continue;
      }
      // mot
      const room = right + (ctx.tol != null ? ctx.tol : 0.02);
      let shrink = 0;
      if (p.al === 'j' && ctx.shrink) {
        let sw = 0;
        for (let q2 = 0; q2 < curItems.length; q2++) if (curItems[q2].k === 's' && !curItems[q2].nb) sw += curItems[q2].w;
        // l'espace entre le dernier mot et le mot courant compte aussi
        shrink = ctx.shrink * sw;
      }
      if (x + a.w > room + shrink && curItems.some((it) => it.k === 'w' || it.k === 't' && false)) {
        // dépasse : coupe au dernier point de rupture
        if (lastBreak > 0) {
          const rest = curItems.splice(lastBreak);
          flush(false, false);
          startLine();
          for (const r of rest) { curItems.push(r); x += r.w; if (r.k === 's' && !r.nb) { lastBreak = curItems.length; } if (r.k === 'w' && r.bk) lastBreak = curItems.length; }
          // le mot courant peut encore dépasser : on boucle
          ai--; continue;
        }
        // un seul mot trop long : coupe par caractères
        if (curItems.length === 0 || !curItems.some((it) => it.k === 'w')) {
          // continue en dépassement
        } else {
          flush(false, false); startLine(); ai--; continue;
        }
      }
      if (a.w > right - startX + 0.02 && a.s.length > 1 && curItems.length === 0) {
        // mot plus large qu'une ligne entière : on le coupe
        let acc = '', k = 0;
        for (const ch of a.s) {
          const nw = env.width(acc + ch, a.f, a.fl, a.z);
          if (x + nw > right && acc) break;
          acc += ch; k += ch.length;
        }
        const head = Object.assign({}, a, { s: acc, w: env.width(acc, a.f, a.fl, a.z) });
        const tail = Object.assign({}, a, { s: a.s.slice(k), w: env.width(a.s.slice(k), a.f, a.fl, a.z) });
        curItems.push(head); x += head.w; flush(false, false); startLine();
        atoms.splice(ai + 1, 0, tail);
        continue;
      }
      curItems.push(a); x += a.w;
      if (a.bk) { lastBreak = curItems.length; lastBreakX = x; }
    }
    // dernière ligne (toujours présente, même vide)
    flush(true, false);
    // positions et alignement
    for (const ln of lines) alignLine(ln);
    return { lines, marker };
  }

  /* ---------- pile de blocs (cellules, en-têtes) ---------- */
  function stackLayout(items, width, V, env, ctx) {
    const out = []; let y = 0, pend = 0, prev = null;
    for (const it of items) {
      if (it.t === 'p') {
        const L = layoutPara(it, width, V, env, ctx);
        L.width = width;
        const same = !!(it.cx && prev && prev.t === 'p' && prev.cx && prev.ps === it.ps);
        if (!same) y += prev ? Math.max(pend, (it.sb || 0) * PT) : (it.sb || 0) * PT;
        const top = y;
        let yy = y;
        for (const ln of L.lines) { ln.y = yy; yy += ln.h; }
        out.push({ k: 'p', p: it, L, y: top, h: yy - top });
        y = yy; pend = (it.sa || 0) * PT;
      } else if (it.t === 'tbl') {
        y += prev ? pend : 0;
        const T = layoutTable(it, width, V, env, ctx);
        out.push({ k: 'tbl', T, y, h: T.h });
        y += T.h; pend = 0;
      }
      prev = it;
    }
    return { blocks: out, h: y + pend };
  }

  /* ---------- tableaux ---------- */
  function layoutTable(t, width, V, env, ctx) {
    const grid = t.g || [];
    const mar = t.mar || [108, 108, 0, 0];
    const rows = [];
    let y = 0;
    const gx = [0];
    for (const g of grid) gx.push(gx[gx.length - 1] + g * PT);
    for (let ri = 0; ri < t.rows.length; ri++) {
      const r = t.rows[ri];
      let x = 0, maxH = 0;
      const cells = [];
      let ci = 0;
      for (const c of r.c) {
        const span = c.sp || 1;
        const cx = gx[ci] || x, cw = (gx[Math.min(ci + span, gx.length - 1)] || cx + c.w * PT) - cx;
        const cm = c.mar || {};
        const ml = (cm.left != null ? cm.left : mar[0]) * PT, mr = (cm.right != null ? cm.right : mar[1]) * PT;
        const mt = (cm.top != null ? cm.top : mar[2]) * PT, mb = (cm.bottom != null ? cm.bottom : mar[3]) * PT;
        const S = c.vm === 2 ? { blocks: [], h: 0 } : stackLayout(c.it, Math.max(10, cw - ml - mr), V, env, ctx);
        cells.push({ c, x: cx, w: cw, ml, mr, mt, mb, S });
        maxH = Math.max(maxH, S.h + mt + mb);
        ci += span;
      }
      let h = maxH;
      if (r.h) { const rh = r.h * PT; h = r.hr === 'e' ? rh : Math.max(h, rh); }
      rows.push({ r, cells, y, h });
      y += h;
    }
    const total = grid.length ? gx[gx.length - 1] : width;
    return { rows, h: y, w: total, t, gx, ox: (t.ind || 0) * PT - (mar[0] * PT) * 0 };
  }

  /* ---------- sorties de dessin ---------- */
  function emitPara(page, L, x0, y0, env, p) {
    const ops = page.ops;
    for (const ln of L.lines) {
      const base = y0 + ln.y + ln.base;
      if (ln.marker && !ln.__noMarker) {
        const m = ln.marker;
        ops.push({ t: 'text', x: x0 + m.x + (ln.shift && p.al !== 'j' && false ? ln.shift : 0), y: base, s: m.s, f: m.f, fl: m.fl, z: m.z, col: m.col });
      }
      // surlignage + texte + soulignement
      let ulStart = null, ulKey = null;
      const flushUL = (endx, it) => {
        if (ulStart != null) {
          const F = env.font(it.f, it.fl).m;
          ops.push({ t: 'line', x1: x0 + ulStart, x2: x0 + endx, y: base - F.ulp * it.z * 1 + 0, w: Math.max(0.4, F.ult * it.z), col: ulKey.col || '' });
        }
        ulStart = null;
      };
      let prev = null;
      for (const it of ln.items) {
        if (it.hl) {
          const F = env.font(it.f, it.fl).m;
          if (it.w > 0) ops.push({ t: 'rect', x: x0 + it.x, y: base - F.asc * it.z, w: it.w, h: (F.asc + F.desc) * it.z, fill: it.hl });
        }
        if (it.k === 'w' || (it.k === 's' && it.s.trim() !== '' )) {
          ops.push({ t: 'text', x: x0 + it.x, y: base - (it.up || 0), yb: base, s: it.s, f: it.f, fl: it.fl, z: it.z, col: it.col });
        } else if (it.k === 't' && it.ld && it.w > 2) {
          const ch = it.ld === 'd' || it.ld === 'h' ? '.' : (it.ld === 'u' ? '_' : (it.ld === 'm' ? '-' : '.'));
          const F = env.font(it.f, it.fl).m;
          const cwid = Math.max(0.1, F.w(ch.codePointAt(0)) * it.z);
          const n = Math.max(0, Math.floor((it.w - 1) / (cwid * 1.0)));
          if (n > 0) ops.push({ t: 'text', x: x0 + it.x + it.w - n * cwid, y: base, s: ch.repeat(n), f: it.f, fl: it.fl, z: it.z, col: it.col });
        }
        if (it.fl & 4) {
          const wu = it.w;
          if (ulStart == null) { ulStart = it.x; ulKey = it; }
          else if (ulKey.col !== it.col) { flushUL(prev.x + prev.w, prev); ulStart = it.x; ulKey = it; }
        } else if (ulStart != null) flushUL(prev.x + prev.w, prev);
        if (it.fl & 128) {
          const F = env.font(it.f, it.fl).m;
          ops.push({ t: 'line', x1: x0 + it.x, x2: x0 + it.x + it.w, y: base - F.asc * it.z * 0.3, w: 0.5, col: it.col });
        }
        prev = it;
      }
      if (ulStart != null && prev) flushUL(prev.x + prev.w, prev);
    }
  }

  function emitStack(page, S, x0, y0, env) {
    for (const b of S.blocks) {
      if (b.k === 'p') {
        const p = b.p;
        if (p.bg) page.ops.push({ t: 'rect', x: x0, y: y0 + b.y, w: b.L.width || 0, h: b.h, fill: p.bg, sw: true });
        emitPara(page, b.L, x0, y0, env, p);
      } else emitTable(page, b.T, x0, y0 + b.y, env);
    }
  }

  const bw = (b) => (b ? Math.max(0.25, b[0] / 8) : 0);

  function emitTable(page, T, x0, y0, env, rowFrom, rowTo, dy) {
    const t = T.t, bd = t.bd || {};
    const ox = x0 + T.ox;
    const from = rowFrom || 0, to = rowTo == null ? T.rows.length : rowTo;
    const nR = T.rows.length;
    for (let ri = from; ri < to; ri++) {
      const row = T.rows[ri];
      const ry = y0 + row.y - (dy || 0);
      for (const c of row.cells) {
        const cell = c.c;
        if (cell.bg) page.ops.push({ t: 'rect', x: ox + c.x, y: ry, w: c.w, h: row.h, fill: cell.bg });
        if (c.S.blocks.length) {
          let off = c.mt;
          if (cell.va === 'c') off = c.mt + (row.h - c.mt - c.mb - c.S.h) / 2;
          else if (cell.va === 'b') off = row.h - c.mb - c.S.h;
          emitStack(page, c.S, ox + c.x + c.ml, ry + off, env);
        }
        // bordures
        const cb = cell.bd || {};
        const colEnd = c.x + c.w;
        const isFirstCol = c.x < 0.5, isLastCol = Math.abs(colEnd - T.w) < 0.5;
        const isFirstRow = ri === 0, isLastRow = ri === nR - 1;
        const side = (k, inside, outer) => (cb[k] !== undefined ? cb[k] : (outer ? bd[k] : (bd[inside] !== undefined ? bd[inside] : bd[k])));
        const top = side('top', 'insideH', isFirstRow), bot = side('bottom', 'insideH', isLastRow);
        const lef = side('left', 'insideV', isFirstCol), rig = side('right', 'insideV', isLastCol);
        if (top) page.ops.push({ t: 'line', x1: ox + c.x, x2: ox + colEnd, y: ry, w: bw(top), col: top[1] });
        if (bot) page.ops.push({ t: 'line', x1: ox + c.x, x2: ox + colEnd, y: ry + row.h, w: bw(bot), col: bot[1] });
        if (lef) page.ops.push({ t: 'vline', y1: ry, y2: ry + row.h, x: ox + c.x, w: bw(lef), col: lef[1] });
        if (rig) page.ops.push({ t: 'vline', y1: ry, y2: ry + row.h, x: ox + colEnd, w: bw(rig), col: rig[1] });
      }
    }
  }

  /* ---------- pagination ---------- */
  function layoutDocument(lay, V, env) {
    const pg = lay.page;
    const PW = pg.w * PT, PH = pg.h * PT;
    const ML = (pg.ml + (pg.gt || 0)) * PT, MR = pg.mr * PT;
    const TW = PW - ML - MR;
    const ctx = { tab: lay.tab || 720, tol: (root.JPLAY_TOL != null ? root.JPLAY_TOL : -0.05), shrink: lay.cm ? (root.JPLAY_SHRINK != null ? root.JPLAY_SHRINK : 0.25) : 0 };
    const pages = [];
    const hfCache = {};
    const hfStack = (items, V2) => stackLayout(items, TW, V2, env, ctx);
    const hfFor = (which, kind, n, total) => {
      const src = (kind === 'h' ? lay.hdr : lay.ftr) || {};
      const items = src[which] || (which === 'first' ? null : null);
      return items;
    };
    const hfHeight = (kind, which) => {
      const items = (kind === 'h' ? lay.hdr : lay.ftr);
      if (!items || !items[which]) return 0;
      const key = kind + which;
      if (hfCache[key] == null) hfCache[key] = hfStack(items[which], Object.assign({}, V, { '{{#PAGE}}': '1', '{{#NUMPAGES}}': '1' })).h;
      return hfCache[key];
    };
    const areaFor = (idx) => {
      const which = (lay.tp && idx === 0) ? 'first' : 'default';
      const hh = hfHeight('h', which), fh = hfHeight('f', which);
      const top = Math.max(pg.mt * PT, hh ? pg.hd * PT + hh : 0);
      const bot = PH - Math.max(pg.mb * PT, fh ? pg.fd * PT + fh : 0);
      return { top, bot, which };
    };
    let cur = null, y = 0, area = null;
    const newPage = () => {
      cur = { ops: [], idx: pages.length };
      pages.push(cur);
      area = areaFor(cur.idx);
      y = area.top;
      cur.atTop = true;
    };
    newPage();
    const items = lay.body;
    let prevSa = 0;
    const room = () => area.bot - y;
    let pendingBreak = false;

    const placeLines = (L, p, from, to, x0) => {
      // dessine les lignes [from,to) du paragraphe à partir de y courant
      const sub = { lines: L.lines.slice(from, to), marker: from === 0 ? L.marker : null };
      let yy = y;
      for (const ln of sub.lines) { ln.y = yy - y; yy += ln.h; }
      // re-décale pour emit : y0 = y
      for (const ln of sub.lines) { if (from > 0) ln.marker = null; }
      emitPara(cur, sub, x0, y, env, p);
      const h = yy - y;
      y = yy;
      cur.atTop = false;
      return h;
    };

    for (let ii = 0; ii < items.length; ii++) {
      const it = items[ii];
      if (it.t === 'p') {
        if (it.pb && !cur.atTop) newPage();
        const L = layoutPara(it, TW - 0, V, env, ctx);
        L.width = TW;
        const sb = (it.sb || 0) * PT, sa = (it.sa || 0) * PT;
        const prevP = items[ii - 1];
        const cxSame = !!(it.cx && prevP && prevP.t === 'p' && prevP.cx && prevP.ps === it.ps);
        if (cxSame) { /* même style, espacement contextuel : aucun espace entre les deux */ }
        else if (!(cur.atTop && cur.idx > 0 && !pendingBreak)) y += cur.atTop ? sb : Math.max(prevSa, sb);
        else y += 0;
        prevSa = 0;
        pendingBreak = false;
        // coupure de page forcée (\f) : on découpe aux lignes marquées
        let from = 0;
        const total = L.lines.length;
        while (from < total) {
          // lignes jusqu'au prochain saut forcé
          let segEnd = total;
          for (let k = from; k < total; k++) if (L.lines[k].pageBreakAfter) { segEnd = k + 1; break; }
          const n = segEnd - from;
          // combien de lignes tiennent ?
          let fit = 0, hh = 0;
          for (let k = from; k < segEnd; k++) { if (hh + L.lines[k].h <= room() + 0.05) { hh += L.lines[k].h; fit++; } else break; }
          const wc = it.wc !== 0;
          let doSplit = fit < n;
          if (doSplit) {
            // saut de page nécessaire
            let take = fit;
            if (it.kl || (from === 0 && take === 0)) take = 0;
            else if (wc) {
              if (from === 0 && take < 2 && n >= 2) take = 0;
              else if (n - take === 1 && take >= 3) take -= 1;
              else if (n - take === 1 && take < 3) take = 0;
            }
            if (take === 0 && cur.atTop) take = Math.max(1, fit);   // jamais de boucle infinie
            if (take === 0) { newPage(); continue; }
            placeLines(L, it, from, from + take, ML);
            from += take;
            newPage();
            continue;
          }
          placeLines(L, it, from, segEnd, ML);
          from = segEnd;
          if (segEnd < total || L.lines[segEnd - 1].pageBreakAfter) {
            if (segEnd <= total && L.lines[segEnd - 1].pageBreakAfter) { newPage(); pendingBreak = true; }
          }
        }
        prevSa = sa;
        // keepNext : si le paragraphe suivant ne peut pas tenir avec celui-ci, on les déplace ensemble
        // (géré approximativement : on vérifie la place pour la 1re ligne du suivant)
        if (it.kn && items[ii + 1] && items[ii + 1].t === 'p') {
          const nx = items[ii + 1];
          const L2 = layoutPara(nx, TW, V, env, ctx);
          const need = ((nx.sb || 0) * PT) + (L2.lines[0] ? L2.lines[0].h : 0) + (L2.lines[1] && (nx.wc !== 0) ? L2.lines[1].h : 0);
          if (need > room() + 0.05 && !cur.atTop) {
            // déplace le paragraphe courant avec le suivant : on retire ses opérations de la page
            // (cas rare ; on se contente d'un saut de page avant le suivant)
            newPage();
          }
        }
      } else if (it.t === 'tbl') {
        const T = layoutTable(it, TW, V, env, ctx);
        const x0 = ML;
        let ri = 0;
        while (ri < T.rows.length) {
          // lignes qui tiennent sur la page courante
          let hh = 0, k = ri;
          while (k < T.rows.length && hh + T.rows[k].h <= room() + 0.05) { hh += T.rows[k].h; k++; }
          if (k === ri) {
            if (!cur.atTop) { newPage(); continue; }
            k = ri + 1; hh = T.rows[ri].h;   // ligne plus haute qu'une page : on la laisse déborder
          }
          const dy = T.rows[ri].y;
          emitTable(cur, T, x0, y, env, ri, k, dy);
          y += T.rows[k - 1].y + T.rows[k - 1].h - dy;
          cur.atTop = false; prevSa = 0;
          ri = k;
          if (ri < T.rows.length) newPage();
        }
      }
    }
    // pages finales entièrement vides (paragraphes vides en excédent) : supprimées
    while (pages.length > 1 && pages[pages.length - 1].ops.length === 0) pages.pop();
    // en-têtes / pieds de page
    const total = pages.length;
    pages.forEach((pgx, idx) => {
      const which = (lay.tp && idx === 0) ? 'first' : 'default';
      const V2 = Object.assign({}, V, { '{{#PAGE}}': String(idx + 1), '{{#NUMPAGES}}': String(total) });
      if (lay.hdr && lay.hdr[which]) {
        const S = hfStack(lay.hdr[which], V2);
        emitStack(pgx, S, ML, pg.hd * PT, env);
      }
      if (lay.ftr && lay.ftr[which]) {
        const S = hfStack(lay.ftr[which], V2);
        const fh = S.h;
        emitStack(pgx, S, ML, PH - pg.fd * PT - fh, env);
      }
    });
    return { pages, pw: PW, ph: PH };
  }

  /* ---------- écriture PDF (jsPDF) ---------- */
  const hex = (h) => [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  const JSTY = { r: 'normal', b: 'bold', i: 'italic', bi: 'bolditalic' };

  function toPdf(J, res, env, opts) {
    opts = opts || {};
    const doc = new J({ unit: 'pt', format: [res.pw, res.ph], orientation: res.pw > res.ph ? 'l' : 'p', compress: true, putOnlyUsedFonts: true });
    if (opts.fontData) {
      for (const key of Object.keys(opts.fontData)) {
        for (const st of Object.keys(opts.fontData[key])) {
          const fn = key + '-' + st + '.ttf';
          doc.addFileToVFS(fn, opts.fontData[key][st]);
          doc.addFont(fn, key, JSTY[st], 'Identity-H');
        }
      }
    }
    if (opts.title) doc.setProperties({ title: opts.title });
    res.pages.forEach((pg, i) => {
      if (i > 0) doc.addPage([res.pw, res.ph], res.pw > res.ph ? 'l' : 'p');
      for (const o of pg.ops) {
        if (o.t === 'text') {
          const F = env.font(o.f, o.fl);
          doc.setFont(o.f, JSTY[(o.fl & 1 ? (o.fl & 2 ? 'bi' : 'b') : (o.fl & 2 ? 'i' : 'r'))]);
          doc.setFontSize(o.z);
          const c = o.col ? hex(o.col) : [0, 0, 0];
          doc.setTextColor(c[0], c[1], c[2]);
          // caractères absents de la police : repli
          let s = o.s, out = '';
          for (const ch of s) { out += F.m.has(ch.codePointAt(0)) ? ch : (F.m.has(0x3F) ? '?' : ' '); }
          doc.text(out, o.x, o.y, { baseline: 'alphabetic' });
        } else if (o.t === 'rect') {
          const c = hex(o.fill); doc.setFillColor(c[0], c[1], c[2]);
          doc.rect(o.x, o.y, o.w, o.h, 'F');
        } else if (o.t === 'line' || o.t === 'vline') {
          const c = o.col ? hex(o.col) : [0, 0, 0];
          doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(o.w || 0.5);
          if (o.t === 'line') doc.line(o.x1, o.y, o.x2, o.y); else doc.line(o.x, o.y1, o.x, o.y2);
        }
      }
    });
    return doc;
  }

  /* ---------- chargement des polices et API ---------- */
  const b64 = (buf) => {
    let s = '';
    const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };

  async function loadFonts(keys, base, meta, fetcher) {
    const fonts = {}, data = {};
    const f = fetcher || ((u) => fetch(u).then((r) => { if (!r.ok) throw new Error('police ' + u); return r.arrayBuffer(); }));
    await Promise.all(keys.map(async (k) => {
      fonts[k] = {}; data[k] = {};
      await Promise.all(STY.map(async (st) => {
        const buf = await f(base + (meta && meta[k] ? meta[k].files[st] : k + '-' + st + '.ttf'));
        fonts[k][st] = { m: parseTTF(buf) };
        if (root.btoa) data[k][st] = b64(buf);
      }));
    }));
    return { fonts, data };
  }

  /* ---------- Préparation commune (PDF et aperçu) : mise en page + polices, mises en cache ---------- */
  let fontMeta = null;
  const layCache = {}, envCache = {};
  async function prepareSource(model, V, S, needPdf) {
    const src = model && model.sourceTemplate;
    if (!src || !src.file) throw new Error('Modèle source non configuré.');
    let J = null;
    if (needPdf) {
      if (typeof JPLibs !== 'undefined') await JPLibs.load('jspdf');
      J = root.jspdf && root.jspdf.jsPDF;
      if (!J) throw { code: 'lib', lib: 'jspdf' };
    }
    const ver = encodeURIComponent(src.version || '1');
    const layUrl = './' + String(src.file).replace(/^\.\//, '').replace(/\.docx$/i, '.lay.json') + '?v=' + ver;
    if (!layCache[layUrl]) {
      layCache[layUrl] = fetch(layUrl).then((r) => { if (!r.ok) throw new Error('Mise en page introuvable : ' + layUrl); return r.json(); })
        .catch((e) => { delete layCache[layUrl]; throw e; });
    }
    const lay = await layCache[layUrl];
    if (!fontMeta) {
      const fr = await fetch('./vendor/fonts/fonts.json?v=' + ver);
      if (!fr.ok) throw new Error('Polices introuvables');
      fontMeta = await fr.json();
    }
    const keys = Array.from(new Set((lay.fonts || []).concat(['serif']))).filter((k) => fontMeta[k]).sort();
    const ek = keys.join(',');
    if (!envCache[ek]) {
      envCache[ek] = loadFonts(keys, './vendor/fonts/', fontMeta).then(({ fonts, data }) => ({ env: makeEnv(fonts), data }))
        .catch((e) => { delete envCache[ek]; throw e; });
    }
    const { env, data } = await envCache[ek];
    const map = typeof root.JPTokenMap === 'function' ? root.JPTokenMap(model, V, S) : {};
    const res = layoutDocument(lay, map, env);
    return { res, env, data, J };
  }

  async function buildSourcePdf(model, V, S, title) {
    const P = await prepareSource(model, V, S, true);
    const doc = toPdf(P.J, P.res, P.env, { fontData: P.data, title: title });
    return doc.output('blob');
  }

  /* ---------- Aperçu à l'écran : les mêmes opérations de dessin que le PDF, sur des <canvas> ---------- */
  const faceP = {};
  function ensureFaces(data) {
    const jobs = [];
    for (const key of Object.keys(data)) {
      for (const st of Object.keys(data[key])) {
        const name = 'JPL-' + key + '-' + st;
        if (!faceP[name]) {
          faceP[name] = (async () => {
            const bin = atob(data[key][st]), u = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            const face = new FontFace(name, u.buffer);
            await face.load();
            document.fonts.add(face);
            return true;
          })().catch((e) => { delete faceP[name]; throw e; });
        }
        jobs.push(faceP[name]);
      }
    }
    return Promise.all(jobs);
  }

  function drawPage(ctx, pg, env, scale, pw, ph) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pw, ph);
    ctx.textBaseline = 'alphabetic';
    if ('fontKerning' in ctx) ctx.fontKerning = 'none';
    ctx.lineCap = 'butt';
    for (const o of pg.ops) {
      if (o.t === 'text') {
        const st = o.fl & 1 ? (o.fl & 2 ? 'bi' : 'b') : (o.fl & 2 ? 'i' : 'r');
        const F = env.font(o.f, o.fl);
        let out = '';
        for (const ch of o.s) out += F.m.has(ch.codePointAt(0)) ? ch : (F.m.has(0x3F) ? '?' : ' ');
        ctx.font = o.z + 'px "JPL-' + o.f + '-' + st + '"';
        // zones à compléter (pointillés) : surlignées en jaune pâle
        if (out.indexOf('…') > -1) {
          const w = ctx.measureText(out).width;
          ctx.fillStyle = 'rgba(255,205,90,.5)';
          ctx.fillRect(o.x, o.y - o.z * 0.82, w, o.z * 1.05);
        }
        ctx.fillStyle = o.col ? '#' + o.col : '#000';
        ctx.fillText(out, o.x, o.y);
      } else if (o.t === 'rect') {
        ctx.fillStyle = '#' + o.fill; ctx.fillRect(o.x, o.y, o.w, o.h);
      } else if (o.t === 'line' || o.t === 'vline') {
        ctx.strokeStyle = o.col ? '#' + o.col : '#000'; ctx.lineWidth = o.w || 0.5;
        ctx.beginPath();
        if (o.t === 'line') { ctx.moveTo(o.x1, o.y); ctx.lineTo(o.x2, o.y); } else { ctx.moveTo(o.x, o.y1); ctx.lineTo(o.x, o.y2); }
        ctx.stroke();
      }
    }
  }

  function drawIfNeeded(st, p) {
    const w = p.div.clientWidth;
    if (!w || !st.P) return;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const pxW = Math.min(Math.round(w * dpr), 1700), pxH = Math.round(pxW * st.ph / st.pw);
    const c = p.canvas;
    if (c.width !== pxW || c.height !== pxH) { c.width = pxW; c.height = pxH; }
    drawPage(c.getContext('2d'), st.P.res.pages[p.i], st.P.env, pxW / st.pw, st.pw, st.ph);
    p.dirty = false;
  }

  function clearPreview(host) {
    const st = host && host.__jpv;
    if (!st) return;
    try { st.io.disconnect(); st.ro.disconnect(); } catch (e) { /* ignore */ }
    host.__jpv = null;
  }

  function paintHost(host, P) {
    let st = host.__jpv;
    const n = P.res.pages.length, pw = P.res.pw, ph = P.res.ph;
    if (!st || st.n !== n || st.pw !== pw || st.ph !== ph) {
      clearPreview(host);
      host.innerHTML = '';
      st = host.__jpv = { n, pw, ph, pages: [], P };
      st.io = new IntersectionObserver((es) => es.forEach((e) => {
        const p = e.target.__pg;
        p.vis = e.isIntersecting;
        if (p.vis) { if (p.dirty) drawIfNeeded(st, p); }
        else if (p.canvas.width > 1) { p.canvas.width = 1; p.canvas.height = 1; p.dirty = true; }   // libère la mémoire des pages éloignées
      }), { rootMargin: '900px 0px' });
      st.ro = new ResizeObserver(() => st.pages.forEach((p) => { p.dirty = true; if (p.vis) drawIfNeeded(st, p); }));
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div'), c = document.createElement('canvas');
        d.className = 'pv-page'; d.style.aspectRatio = pw + ' / ' + ph;
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Page ' + (i + 1) + ' sur ' + n + ' du document');
        d.appendChild(c); host.appendChild(d);
        const p = { i, div: d, canvas: c, vis: false, dirty: true };
        d.__pg = p; st.pages.push(p); st.io.observe(d);
      }
      st.ro.observe(host);
    }
    st.P = P;
    st.pages.forEach((p) => { p.dirty = true; if (p.vis) drawIfNeeded(st, p); });
  }

  /* Affiche le document rempli (valeurs de V, pointillés pour les vides) dans un ou plusieurs conteneurs. */
  async function showPreview(model, V, S, hosts, stale) {
    const P = await prepareSource(model, V, S, false);
    await ensureFaces(P.data);
    if (stale && stale()) return false;
    hosts.forEach((h) => paintHost(h, P));
    return true;
  }

  root.JPLay = { parseTTF, makeEnv, layoutDocument, layoutPara, toPdf, loadFonts, buildSourcePdf, showPreview, clearPreview, DOTS };
  root.buildSourcePdf = buildSourcePdf;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JPLay;
})(typeof window !== 'undefined' ? window : globalThis);
