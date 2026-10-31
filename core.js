/* ============================================================
   CŒUR : nombres en lettres, rendu des blocs, export Word et PDF.
   Les modèles (m1, m2, m3) fournissent leurs questions et leur texte.
   Un bloc de texte peut contenir {{champs}} et **gras**.
   ============================================================ */
const NB=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
const DIZ=['','','vingt','trente','quarante','cinquante','soixante'];
function sous100(n,fin){
  if(n<17) return NB[n];
  if(n<20) return 'dix-'+NB[n-10];
  if(n<70){const d=Math.floor(n/10),u=n%10;return DIZ[d]+(u===0?'':(u===1?' et un':'-'+NB[u]));}
  if(n<80){const u=n-60;return 'soixante'+(u===11?' et onze':'-'+sous100(u,false));}
  const u=n-80;
  if(u===0) return fin?'quatre-vingts':'quatre-vingt';
  return 'quatre-vingt-'+sous100(u,false);
}
function sous1000(n,fin){
  const c=Math.floor(n/100),r=n%100;let s='';
  if(c>0){
    s=c===1?'cent':NB[c]+' cent';
    if(r===0&&c>1&&fin) s+='s';
    if(r>0) s+=' ';
  }
  if(r>0) s+=sous100(r,fin);
  return s;
}
function lettres(n){
  n=Math.floor(Number(n)||0);
  if(n===0) return 'zéro';
  if(n>=1e12) return String(n);
  const p=[];
  const mrd=Math.floor(n/1e9),mil=Math.floor(n%1e9/1e6),k=Math.floor(n%1e6/1e3),r=n%1e3;
  if(mrd) p.push(sous1000(mrd,true)+' milliard'+(mrd>1?'s':''));
  if(mil) p.push(sous1000(mil,true)+' million'+(mil>1?'s':''));
  if(k) p.push(k===1?'mille':sous1000(k,false)+' mille');
  if(r) p.push(sous1000(r,true));
  return p.join(' ');
}
function fcfa(n){
  const s=lettres(n);
  if(n===1) return 'un franc CFA';
  return /(million|milliard)s?$/.test(s)?s+' de francs CFA':s+' francs CFA';
}
function fmt(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dateFr(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');
  if(!m) return '';
  const d=+m[3],mo=+m[2]-1;
  if(mo<0||mo>11||d<1||d>31) return '';
  return (d===1?'1er':d)+' '+MOIS[mo]+' '+m[1];
}
function anneeLettres(iso){const m=/^(\d{4})-/.exec(iso||'');return m?lettres(+m[1]):'';}
function todayISO(){const d=new Date();const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const CIV=[{v:'M.',t:'Monsieur'},{v:'Mme',t:'Madame'}];

/* ---------- Valeurs communes à tous les modèles ---------- */
function newV(){return {_src:{},_nohl:new Set()};}
/* Une personne (associé, gérant, mandataire) : prefixe p, indice i, champs p+i+'_civilite', '_prenom', '_nom'… */
function addPerson(V,S,p,i){
  const id=p+i+'_',g=k=>String(S[id+k]==null?'':S[id+k]).trim();
  const fem=g('civilite')==='Mme';
  const gram=(k,val)=>{V[id+k]=val;V._src[id+k]=id+'civilite';V._nohl.add(id+k);};
  gram('civ',fem?'Mme':'M.');gram('civ_long',fem?'Madame':'Monsieur');
  gram('ne',fem?'née':'né');gram('Ne',fem?'Née':'Né');gram('il',fem?'elle':'il');
  ['prenom','naissance_lieu','nationalite','profession','adresse','piece'].forEach(k=>{V[id+k]=g(k);});
  V[id+'nom']=g('nom').toUpperCase();
  V[id+'naissance']=dateFr(g('naissance_date'));V._src[id+'naissance']=id+'naissance_date';
  V[id+'ident']=[V[id+'civ'],V[id+'prenom'],V[id+'nom']].filter(Boolean).join(' ');
}
const ASSO=(i,p)=>'{{'+(p||'a')+i+'_civ}} {{'+(p||'a')+i+'_prenom}} {{'+(p||'a')+i+'_nom}}';
function personName(S,p,i){
  const n=((S[p+i+'_prenom']||'')+' '+String(S[p+i+'_nom']||'').toUpperCase()).trim();
  return n||('Associé '+(i+1));
}
function loadDraftS(id){
  try{const o=JSON.parse(localStorage.getItem('juriskpro:'+id+':v1')||'null');return o&&o.v?o.v:null;}catch(e){return null;}
}
function fileSlug(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

/* ---------- Découpage d'un texte en segments ---------- */
function runs(text,V){
  const src=(V&&V._src)||{},nh=(V&&V._nohl)||null,out=[];let bold=false;
  String(text).split(/(\*\*|\{\{\??\w+\}\})/).forEach(tok=>{
    if(!tok) return;
    if(tok==='**'){bold=!bold;return;}
    const m=/^\{\{(\??)(\w+)\}\}$/.exec(tok);
    if(m){
      const key=m[2],val=V[key]==null?'':String(V[key]),f=src[key]||key;
      if(val===''){if(m[1]) return;out.push({t:'',b:bold,f:f,key:key,miss:true});}
      else out.push({t:val,b:bold,f:f,key:key,g:!!(nh&&nh.has(key))});
    }else out.push({t:tok,b:bold});
  });
  return out;
}
function runHTML(r,miss){
  if(r.miss){miss.add(r.f);return '<span class="b" data-f="'+r.f+'" title="À compléter">………………</span>';}
  const t=esc(r.t),inner=r.b?'<strong>'+t+'</strong>':t;
  return r.f?'<span class="'+(r.g?'g':'v')+'" data-f="'+r.f+'">'+inner+'</span>':inner;
}
const lineHTML=(text,V,miss)=>runs(text,V).map(r=>runHTML(r,miss)).join('');
const cellLines=c=>Array.isArray(c)?c:[c];
const cellHTML=(c,V,miss)=>cellLines(c).map(l=>'<div>'+lineHTML(l,V,miss)+'</div>').join('');
const ALCLS={right:' class="right"',center:' class="center"',left:''};
function renderHTML(blocks,V){
  const miss=new Set();
  const h=blocks.map(b=>{
    switch(b.k){
      case 'tit':return '<p class="tit">'+lineHTML(b.text,V,miss)+'</p>';
      case 'sous':return '<p class="tit2">'+lineHTML(b.text,V,miss)+'</p>';
      case 'part':return '<p class="part">'+lineHTML(b.text,V,miss)+'</p>';
      case 'art':return '<p class="art">'+lineHTML(b.text,V,miss)+'</p>';
      case 'sub':return '<p class="sub">'+lineHTML(b.text,V,miss)+'</p>';
      case 'li':return '<p class="li">'+lineHTML(b.text,V,miss)+'</p>';
      case 'sp':return '<div class="sp"></div>';
      case 'pb':return '<hr class="pb">';
      case 'p':return '<p'+(ALCLS[b.al]||'')+'>'+lineHTML(b.text,V,miss)+'</p>';
      case 'box':return '<table class="box"><tbody><tr><td>'+b.lines.map(l=>'<div>'+lineHTML(l,V,miss)+'</div>').join('')+'</td></tr></tbody></table>';
      case 'sigs':return '<div class="sigs">'+b.items.map(t=>'<div class="sg"><div>'+lineHTML(t,V,miss)+'</div><div class="sline"></div></div>').join('')+'</div>';
      case 'table':{
        const al=b.al||[];
        const cg='<colgroup>'+b.cols.map(w=>'<col style="width:'+w+'%">').join('')+'</colgroup>';
        const th='<thead><tr>'+b.head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead>';
        const tb='<tbody>'+b.rows.map(r=>'<tr>'+r.map((c,i)=>'<td'+(al[i]&&al[i]!=='left'?' class="'+al[i]+'"':'')+'>'+cellHTML(c,V,miss)+'</td>').join('')+'</tr>').join('')+'</tbody>';
        return '<div class="tw"><table'+(b.cols.length>3?' class="wide"':'')+'>'+cg+th+tb+'</table></div>';
      }
    }
    return '';
  }).join('');
  return {html:h,missing:miss};
}
function toText(blocks,V){
  const plain=t=>runs(t,V).map(r=>r.miss?'…………':r.t).join('');
  const cell=c=>cellLines(c).map(plain).join(' / ');
  return blocks.map(b=>{
    if(b.k==='sp') return '';
    if(b.k==='pb') return '\f';
    if(b.k==='box') return b.lines.map(plain).join('\n');
    if(b.k==='sigs') return b.items.map(plain).join('\n');
    if(b.k==='table') return b.head.join(' | ')+'\n'+b.rows.map(r=>r.map(cell).join(' | ')).join('\n');
    if(b.k==='li') return '– '+plain(b.text);
    return plain(b.text);
  }).join('\n');
}

/* ---------- Export Word (.docx) ---------- */
const xe=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
function runsXML(text,V,o){
  o=o||{};
  return runs(text,V).map(r=>{
    const t=r.miss?'………………':r.t;
    const pr=((r.b||o.bold)?'<w:b/>':'')+(o.italic?'<w:i/>':'')+(o.size?'<w:sz w:val="'+o.size+'"/><w:szCs w:val="'+o.size+'"/>':'');
    return '<w:r>'+(pr?'<w:rPr>'+pr+'</w:rPr>':'')+'<w:t xml:space="preserve">'+xe(t)+'</w:t></w:r>';
  }).join('');
}
function paraXML(inner,o){
  o=o||{};
  const pp=(o.keep?'<w:keepNext/>':'')+'<w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null?120:o.after)+'" w:line="'+(o.line||276)+'" w:lineRule="auto"/>'+(o.ind||'')+'<w:jc w:val="'+(o.jc||'both')+'"/>';
  return '<w:p><w:pPr>'+pp+'</w:pPr>'+inner+'</w:p>';
}
const JC={left:'left',right:'right',center:'center'};
function tblXML(o,V){
  const total=9070,cols=o.cols.map(w=>Math.round(total*w/100));
  const bd=o.borders===false?'<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/>':
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="808080"/>';
  const pr='<w:tblPr><w:tblW w:w="'+total+'" w:type="dxa"/><w:tblBorders>'+bd+'</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>';
  const grid='<w:tblGrid>'+cols.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>';
  const cell=(w,lines,c)=>'<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(c.shade?'<w:shd w:val="clear" w:color="auto" w:fill="E9EDEA"/>':'')+'</w:tcPr>'+
    lines.map(l=>paraXML(c.plain?xe(l):runsXML(l,V,{bold:c.bold,size:c.size}),{jc:c.jc||'left',after:40,keep:o.keep})).join('')+'</w:tc>';
  let rows='';
  if(o.head) rows+='<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>'+o.head.map((h,i)=>{
    return '<w:tc><w:tcPr><w:tcW w:w="'+cols[i]+'" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E9EDEA"/></w:tcPr>'+paraXML('<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">'+xe(h)+'</w:t></w:r>',{jc:'center',after:40})+'</w:tc>';
  }).join('')+'</w:tr>';
  rows+=o.rows.map(r=>'<w:tr><w:trPr><w:cantSplit/></w:trPr>'+r.map((c,i)=>cell(cols[i],cellLines(c),{jc:JC[(o.al||[])[i]]})).join('')+'</w:tr>').join('');
  return '<w:tbl>'+pr+grid+rows+'</w:tbl>';
}
function sigRows(items){
  const rows=[];
  for(let i=0;i<items.length;i+=2) rows.push([[items[i],'','',''],items[i+1]?[items[i+1],'','','']:['','','','']]);
  return rows;
}
function blockXML(b,V){
  switch(b.k){
    case 'tit':return paraXML(runsXML(b.text,V,{bold:true,size:28}),{jc:'center',after:80,keep:true});
    case 'sous':return paraXML(runsXML(b.text,V,{size:20}),{jc:'center',after:160});
    case 'part':return paraXML(runsXML(b.text,V,{bold:true}),{jc:'center',before:360,after:160,keep:true});
    case 'art':return paraXML(runsXML(b.text,V,{bold:true}),{jc:'left',before:240,after:80,keep:true});
    case 'sub':return paraXML(runsXML(b.text,V,{bold:true,italic:true}),{jc:'left',after:80,keep:true});
    case 'li':return paraXML('<w:r><w:t>–</w:t></w:r><w:r><w:tab/></w:r>'+runsXML(b.text,V),{ind:'<w:ind w:left="567" w:hanging="284"/>',after:80,keep:b.kn});
    case 'sp':return paraXML('',{after:120,keep:b.kn});
    case 'pb':return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    case 'p':return paraXML(runsXML(b.text,V),{jc:JC[b.al]||'both',keep:b.kn});
    case 'box':return tblXML({cols:[100],rows:[[b.lines]]},V)+paraXML('',{after:120});
    case 'sigs':return tblXML({cols:[50,50],rows:sigRows(b.items),borders:false,keep:true},V)+paraXML('',{after:120});
    case 'table':return tblXML(b,V)+paraXML('',{after:120});
  }
  return '';
}
async function buildDocx(blocks,V,title){
  if(typeof JPLibs!=='undefined') await JPLibs.load('jszip');
  const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const body=blocks.map(b=>blockXML(b,V)).join('');
  const sect='<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
  const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+sect+'</w:body></w:document>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="fr-FR" w:eastAsia="fr-FR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>';
  const small='<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
  const footer='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr '+NS+'><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>'+small+'<w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r>'+small+'<w:t>1</w:t></w:r></w:fldSimple><w:r>'+small+'<w:t xml:space="preserve"> sur </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r>'+small+'<w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>';
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const drels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  const core='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+xe(title)+'</dc:title><dc:creator>JuriskPro</dc:creator></cp:coreProperties>';
  const zip=new JSZip();
  zip.file('[Content_Types].xml',ct);
  zip.file('_rels/.rels',rels);
  zip.file('docProps/core.xml',core);
  zip.file('word/document.xml',doc);
  zip.file('word/styles.xml',styles);
  zip.file('word/footer1.xml',footer);
  zip.file('word/_rels/document.xml.rels',drels);
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}

/* ---------- Export PDF (jsPDF) ---------- */
async function buildPdf(blocks,V,title){
  if(typeof JPLibs!=='undefined') await JPLibs.load('jspdf');
  const J=(typeof jspdf!=='undefined'&&jspdf.jsPDF)?jspdf.jsPDF:null;
  if(!J) throw {code:'lib'};
  const doc=new J({unit:'mm',format:'a4',compress:true});
  const PW=210,PH=297,M=25,TW=PW-2*M,FS=12,PT=0.3528;
  let y=M,dry=false;
  const setF=(b,i)=>doc.setFont('times',b&&i?'bolditalic':b?'bold':i?'italic':'normal');
  const segsOf=(text,bold,italic)=>runs(text,V).map(r=>({t:r.miss?'………………':r.t,b:!!(r.b||bold),i:!!italic}));
  function atomsOf(segs){
    const out=[];let sp=false;
    segs.forEach(s=>{
      String(s.t).split(' ').forEach((p,i)=>{
        if(i>0) sp=true;
        if(p==='') return;
        out.push({t:p,b:s.b,i:s.i,sp:sp&&out.length>0});
        sp=false;
      });
    });
    return out;
  }
  function layout(segs,w,size){
    doc.setFontSize(size);
    const at=atomsOf(segs);
    at.forEach(a=>{setF(a.b,a.i);a.w=doc.getTextWidth(a.t);});
    setF(false,false);
    const spw=doc.getTextWidth(' ');
    const lines=[];let cur=[],cw=0;
    at.forEach(a=>{
      const need=cur.length?(a.sp?spw:0)+a.w:a.w;
      if(cur.length&&cw+need>w){lines.push(cur);cur=[a];cw=a.w;}else{cur.push(a);cw+=need;}
    });
    if(cur.length) lines.push(cur);
    if(!lines.length) lines.push([]);
    return {lines:lines,spw:spw,size:size,lh:size*PT*1.3};
  }
  function paint(L,i,x,top,w,align){
    if(dry) return;
    const ln=L.lines[i],last=i===L.lines.length-1;
    doc.setFontSize(L.size);
    let natural=0,gaps=0;
    ln.forEach((a,k)=>{natural+=a.w;if(k&&a.sp){natural+=L.spw;gaps++;}});
    let extra=0;
    if(align==='both'&&!last&&gaps>0) extra=Math.max(0,(w-natural)/gaps);
    let cx=x;
    if(align==='right') cx=x+w-natural; else if(align==='center') cx=x+(w-natural)/2;
    const base=top+L.size*PT*1.02;
    ln.forEach((a,k)=>{if(k&&a.sp) cx+=L.spw+extra;setF(a.b,a.i);doc.text(a.t,cx,base);cx+=a.w;});
  }
  const ensure=h=>{if(dry) return;if(y+h>PH-M){doc.addPage();y=M;}};
  function para(text,o){
    o=o||{};
    const x=M+(o.indent||0),w=TW-(o.indent||0);
    const L=layout(segsOf(text,o.bold,o.italic),w,o.size||FS);
    y+=o.before||0;
    ensure(L.lh*Math.min(L.lines.length,o.keep?3:2));
    if(o.bullet&&!dry){doc.setFontSize(L.size);setF(false,false);doc.text('–',M+3,y+L.size*PT*1.02);}
    for(let i=0;i<L.lines.length;i++){ensure(L.lh);paint(L,i,x,y,w,o.align||'both');y+=L.lh;}
    y+=o.after==null?2.2:o.after;
  }
  function row(cells,widths,o){
    const pad=2,gap=0.8;
    const Ls=cells.map((paras,ci)=>cellLines(paras).map(t=>layout(segsOf(t,o.bold,false),widths[ci]-2*pad,o.size||10.5)));
    const hs=Ls.map(ps=>ps.reduce((s,L)=>s+L.lines.length*L.lh+gap,0)+2*pad-gap);
    const h=Math.max.apply(null,hs);
    ensure(h);
    let cx=M;
    cells.forEach((_,ci)=>{
      if(o.border!==false&&!dry){
        if(o.shade){doc.setFillColor(233,237,234);doc.rect(cx,y,widths[ci],h,'FD');}else doc.rect(cx,y,widths[ci],h);
      }
      let ty=y+pad;
      const al=(o.aligns&&o.aligns[ci])||o.align||'left';
      Ls[ci].forEach(L=>{for(let i=0;i<L.lines.length;i++){paint(L,i,cx+pad,ty,widths[ci]-2*pad,al);ty+=L.lh;}ty+=gap;});
      cx+=widths[ci];
    });
    y+=h;
  }
  doc.setDrawColor(110);doc.setLineWidth(0.2);doc.setTextColor(0);
  doc.setProperties({title:title,creator:'JuriskPro'});
  function draw(b){
    switch(b.k){
      case 'tit':para(b.text,{bold:true,size:13,align:'center',after:1.5});break;
      case 'sous':para(b.text,{size:9.5,align:'center',after:4});break;
      case 'part':para(b.text,{bold:true,align:'center',before:7,after:3,keep:true});break;
      case 'art':para(b.text,{bold:true,align:'left',before:4.5,after:1.5,keep:true});break;
      case 'sub':para(b.text,{bold:true,italic:true,align:'left',after:1.5,keep:true});break;
      case 'li':para(b.text,{indent:9,bullet:true,after:1.5});break;
      case 'sp':y+=3.5;break;
      case 'pb':if(!dry&&y>M+1){doc.addPage();y=M;}break;
      case 'p':para(b.text,{align:b.al||'both'});break;
      case 'box':row([b.lines],[TW],{});y+=4;break;
      case 'sigs':{
        const half=TW/2;
        for(let i=0;i<b.items.length;i+=2){
          row([[b.items[i],'','',''],b.items[i+1]?[b.items[i+1],'','','']:['','','','']],[half,half],{border:false});
        }
        y+=4;break;
      }
      case 'table':{
        const widths=b.cols.map(c=>TW*c/100);
        ensure(38);
        row(b.head.map(h=>[h]),widths,{bold:true,shade:true,align:'center',size:10});
        b.rows.forEach(r=>row(r,widths,{aligns:b.al,size:b.size}));
        y+=4;break;
      }
    }
  }
  /* Les blocs marqués kn restent sur la même page que le bloc qui les suit (signatures, « Fait à… »). */
  for(let i=0;i<blocks.length;i++){
    if(blocks[i].kn){
      let j=i;while(j<blocks.length-1&&blocks[j].kn) j++;
      const y0=y;dry=true;
      for(let k=i;k<=j;k++) draw(blocks[k]);
      dry=false;
      const h=y-y0;y=y0;
      if(h<PH-2*M&&y+h>PH-M){doc.addPage();y=M;}
      for(let k=i;k<=j;k++) draw(blocks[k]);
      i=j;
    }else draw(blocks[i]);
  }
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){
    doc.setPage(i);setF(false,false);doc.setFontSize(9);
    const s='Page '+i+' sur '+n;
    doc.text(s,PW/2-doc.getTextWidth(s)/2,PH-12);
  }
  return doc.output('blob');
}
/* Éléments partagés par les modèles */
const P=(text,o)=>Object.assign({k:'p',text},o||{});
const L=text=>({k:'li',text});
const ART=(n,t)=>({k:'art',text:'ARTICLE '+n+' – '+t});
function loadDraftO(id){
  try{const o=JSON.parse(localStorage.getItem('juriskpro:'+id+':v1')||'null');return o&&o.v?o:null;}catch(e){return null;}
}
