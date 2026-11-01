/* ============================================================
   APPLICATION : routage, portail, atelier de rédaction
   ============================================================ */
const $=(s,r)=> (r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const app=document.getElementById('app');
/* byId : modèle complet s'il est chargé, sinon sa fiche du catalogue (titre, résumé, etc.). */
const byId=id=>FULL[id]||MODELS.find(m=>m.id===id);
const ICON_SEARCH='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICON_DOC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
const ICON_SCALE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M7 21h10M5 7h14M7 7l-4 7h8L7 7zM17 7l-4 7h8l-4-7z"/></svg>';
const ARROW='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* ---------- Stockage local (jamais bloquant) ---------- */
const store={
  get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}},
  del(k){try{localStorage.removeItem(k);}catch(e){}}
};
const draftKey=id=>'juriskpro:'+id+':v1';
function readDraft(id){try{const o=JSON.parse(store.get(draftKey(id))||'null');return o&&o.v?o:null;}catch(e){return null;}}
const stripV=S=>{const o={};Object.keys(S).forEach(k=>{if(k.charAt(0)!=='_'||k==='_ex')o[k]=S[k];});return o;};

/* ---------- État du moment ---------- */
let M=null,S=null,step=0,pane='form',fieldIndex={},saveTimer=0,pvRaf=0,lastSaved=0;
let visitedSteps=new Set(),touchedSteps=new Set(),validationAttempted=false;
const ui={q:'',cat:'all',armed:''};

function esc2(s){return esc(s);}
function setTitle(t){document.title=t?t+' · JuriskPro':'JuriskPro';}

/* ---------- Thème ---------- */
function applyTheme(t){
  const r=document.documentElement;
  if(t==='dark'||t==='light') r.setAttribute('data-theme',t); else r.removeAttribute('data-theme');
}
function currentTheme(){return document.documentElement.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
function toggleTheme(){
  const n=currentTheme()==='dark'?'light':'dark';
  applyTheme(n);store.set('juriskpro:theme',n);
}
applyTheme(store.get('juriskpro:theme'));

function eachField(m,fn){
  m.etapes.forEach((e,si)=>{
    (e.champs||[]).forEach(c=>{
      if(c.type==='repeat'){for(let i=0;i<c.max;i++) c.fields(i).forEach(f=>fn(f,si,c,i));}
      else fn(c,si,null,0);
    });
  });
}
function buildIndex(m){
  const ix={};
  eachField(m,(f,si,rep,i)=>{
    if(f.type==='info'||f.type==='title'||f.type==='action') return;
    ix[f.id]={step:si,label:(f.group?f.group+' : ':'')+f.label};
  });
  return ix;
}

/* ---------- Calculs ---------- */
function recompute(){
  const V=M.compute(S);
  const blocks=M.blocks(S,V);
  return {V:V,blocks:blocks};
}

/* ---------- Validation stricte avant aperçu / export ---------- */
function requiredMissing(m,s){
  const missing=[];
  const add=(f,si,rep,i)=>{
    if(!f||!f.req||['info','title','action'].includes(f.type)) return;
    if(f.showIf&&!f.showIf(s)) return;
    if(rep&&i>=clamp(parseInt(s[rep.countKey],10)||rep.min||1,rep.min||1,rep.max)) return;
    const v=s[f.id];
    if(v==null||String(v).trim()==='') missing.push({id:f.id,step:si,label:(f.group?f.group+' : ':'')+f.label});
  };
  m.etapes.forEach((e,si)=>{
    if(e.final) return;
    (e.champs||[]).forEach(c=>{
      if(c.type==='repeat'){
        if(c.showIf&&!c.showIf(s)) return;
        const n=clamp(parseInt(s[c.countKey],10)||c.min||1,c.min||1,c.max);
        for(let i=0;i<n;i++) c.fields(i).forEach(f=>add(f,si,c,i));
      }else add(c,si,null,0);
    });
  });
  const have=new Set(missing.map(x=>x.id)),ixr=buildIndex(m);
  neededIds(m,s).forEach(id=>{
    if(have.has(id)||!ixr[id]) return;
    const v=s[id];
    if(v==null||String(v).trim()==='') missing.push({id:id,step:ixr[id].step,label:ixr[id].label});
  });
  return missing.sort((x,y)=>x.step-y.step);
}
/* ---------- Champs obligatoires : mêmes règles pour tous les modèles ----------
   Un champ est obligatoire s'il est marqué req dans le modèle OU si le document en a besoin
   dans l'état actuel du formulaire (il laisserait un blanc). Les champs qui ne concernent pas
   votre cas (apport en nature d'un associé en numéraire, conjoint d'un célibataire…) ne sont pas exigés. */
let DYN=new Set(),_needKey='',_needVal=[];
const STAR=' <span class="required-star" aria-label="champ obligatoire" title="Champ obligatoire">*</span>';
const isReq=f=>!!(f&&(f.req||DYN.has(f.id)));
function neededIds(m,s){
  const counts=new Set(),sk=[],opt=new Set(),s2=Object.assign({},s);
  m.etapes.forEach(e=>(e.champs||[]).forEach(c=>{if(c.type==='repeat'&&c.countKey) counts.add(c.countKey);}));
  eachField(m,f=>{
    if(['info','title','action'].includes(f.type)) return;
    if(f.opt||/\(facultatif\)/i.test(f.label||'')) opt.add(f.id);
    if(['text','area','date','money'].includes(f.type)||(f.type==='int'&&!counts.has(f.id))) s2[f.id]='';
    else sk.push(f.id+'='+s[f.id]);
  });
  const key=m.id+'§'+sk.join('|');
  if(key!==_needKey){
    _needKey=key;
    try{const V=m.compute(s2),out=renderHTML(m.blocks(s2,V),V),ix=buildIndex(m);_needVal=[...out.missing].filter(id=>ix[id]&&!opt.has(id));}
    catch(e){_needVal=[];}
  }
  if(m===M) DYN=new Set(_needVal);
  return _needVal;
}
let _anK='',_anV=null;
function analyse(m,s){const k=m.id+'§'+JSON.stringify(s);if(k===_anK) return _anV;const v=analyseRaw(m,s);_anK=k;_anV=v;return v;}
function finalValidation(m,s){
  const an=analyse(m,s),req=requiredMissing(m,s);
  return {an:an,req:req,blocked:req.length>0||an.probs.length>0};
}
function firstCorrectionStep(v){
  if(v.req.length) return v.req[0].step;
  if(v.an.probs.length) return v.an.probs[0].step;
  return 0;
}

/* ---------- Analyse d'un état (contrôles réellement effectués) ---------- */
function analyseRaw(m,s){
  const ix=buildIndex(m),V=m.compute(s),bl=m.blocks(s,V),out=renderHTML(bl,V);
  const miss=[...out.missing].filter(id=>ix[id]);
  const probs=[];
  eachField(m,(f,si,rep,i)=>{
    if(f.type!=='info') return;
    if(rep&&i>=clamp(parseInt(s[rep.countKey],10)||rep.min||1,rep.min||1,rep.max)) return;
    const r=f.calc(s,V);
    if(r&&r.c==='bad') probs.push({t:r.t,step:si});
  });
  const per=m.etapes.map(()=>0);
  miss.forEach(id=>{per[ix[id].step]++;});
  const secs=m.etapes.map((e,i)=>({i:i,t:e.court||e.titre,full:e.titre,final:!!e.final,n:per[i]})).filter(x=>!x.final);
  return {ix:ix,miss:miss,missAll:out.missing.size,probs:probs,secs:secs,done:secs.filter(x=>!x.n).length};
}
function draftsList(){
  return MODELS.map(m=>({m:FULL[m.id],d:readDraft(m.id)})).filter(x=>x.m&&x.d).sort((a,b)=>(b.d.t||0)-(a.d.t||0)).map(x=>{
    const s=Object.assign(x.m.defaults(),x.d.v);
    let an=null;try{an=analyse(x.m,s);}catch(e){}
    return {m:x.m,d:x.d,s:s,an:an};
  });
}
const fmtWhen=t=>t?new Date(t).toLocaleString('fr-FR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'';
const plural=(n,a,b)=>n+' '+(n>1?b:a);

/* ---------- Icônes ---------- */
const ICONS={
  accueil:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  brouillons:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  historique:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"',
  modeles:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  controle:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  compte:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  back:'<path d="M15 5l-7 7 7 7"/>'
};
const ico=(n,s)=>'<svg width="'+(s||24)+'" height="'+(s||24)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[n]+'</svg>';
const NAV=[
  {id:'accueil',h:'#',t:'Accueil'},
  {id:'brouillons',h:'#brouillons',t:'Brouillons'},
  {id:'historique',h:'#historique',t:'Historique'},
  {id:'modeles',h:'#modeles',t:'Modèles'},
  {id:'controle',h:'#controle',t:'Contrôle'},
  {id:'compte',h:'#compte',t:'Compte'}
];

/* ---------- Structure commune : en-tête, contenu, barre fixe ---------- */
function shell(active,inner,o){
  o=o||{};
  const brand='<a class="brand" href="#" aria-label="JuriskPro, accueil"><img class="brand-logo" src="./icons/logo-96.webp" alt="" aria-hidden="true"><span class="bn-txt">Jurisk<b>Pro</b></span></a>';
  const left=o.back?'<a class="hd-back" href="'+o.back+'" aria-label="'+esc(o.backLabel||'Retour')+'">'+ico('back',22)+'</a>':'';
  const mid=o.title?'<div class="hd-title"><strong>'+esc(o.title)+'</strong>'+(o.extra||'')+'</div>':'';
  const nav='<nav class="nav-d" aria-label="Rubriques">'+NAV.map(n=>'<a href="'+n.h+'"'+(n.id===active?' aria-current="page"':'')+'>'+n.t+'</a>').join('')+'</nav>';
  const bar='<nav class="bnav" aria-label="Navigation principale">'+NAV.map(n=>'<a href="'+n.h+'"'+(n.id===active?' aria-current="page"':'')+'>'+ico(n.id,22)+'<span>'+n.t+'</span></a>').join('')+'</nav>';
  const acc=accountRead();
  const avatar=acc&&acc.photo?'<img class="top-profile-img" src="'+acc.photo+'" alt="Photo de profil">':'<span class="top-profile-initial">'+esc((acc&&(acc.name||acc.username)||'').trim().charAt(0).toUpperCase()||'U')+'</span>';
  const actions='<div class="top-actions"><button type="button" class="top-icon-btn" id="theme" aria-label="Basculer entre le thème sombre et clair" title="Thème sombre / clair"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg></button><a class="top-icon-btn" href="#compte" aria-label="Ouvrir mon profil" title="Mon profil">'+avatar+'</a></div>';
  app.innerHTML='<a class="skip-link" href="#main">Aller au contenu principal</a><div class="wrap'+(o.cls?' '+o.cls:'')+'"><header class="top">'+left+brand+mid+nav+actions+'</header><main id="main" tabindex="-1">'+inner+'</main></div>'+bar;
  const t=$('#theme');if(t) t.onclick=()=>{toggleTheme();};
}
function leave(){flushSave();M=null;S=null;}
let lastH=null;
let pendingOpen=null;

/* ---------- Routage ---------- */
function route(){
  const h=(location.hash||'').replace(/^#/,'');
  if(h!==lastH){ui.armed='';lastH=h;}
  /* Modèles à charger avant d'afficher l'écran : celui qu'on ouvre + ceux qui ont un brouillon. */
  const need=[];let mm;
  if((mm=/^m\/(.+)$/.exec(h))&&byId(mm[1])) need.push(mm[1]);
  else if(byId(h)) need.push(h);
  if(need.length||h===''||h==='brouillons'||h==='controle') MODELS.forEach(m=>{if(need.indexOf(m.id)<0&&readDraft(m.id)) need.push(m.id);});
  const missing=need.filter(id=>!FULL[id]);
  if(!missing.length){routeNow(h);return;}
  document.body.classList.add('jp-busy');
  loadModels(missing).then(()=>{
    document.body.classList.remove('jp-busy');
    if((location.hash||'').replace(/^#/,'')===h) routeNow(h);
  },()=>{
    document.body.classList.remove('jp-busy');
    setTitle('Connexion lente');
    app.innerHTML='<div class="wrap"><main id="main" tabindex="-1"><section class="empty-state"><h1>Chargement impossible</h1><p>Le modèle n’a pas pu être téléchargé. Vérifiez votre connexion Internet, puis réessayez. Vos brouillons ne sont pas supprimés.</p><p><button type="button" class="btn" id="jp-retry">Réessayer</button> <a class="btn ghost" href="#">Accueil</a></p></section></main></div>';
    const b=$('#jp-retry');if(b)b.onclick=route;
  });
}
function routeNow(h){
  try{
    let m;
    if((m=/^m\/(.+)$/.exec(h))&&byId(m[1])) openDetail(byId(m[1]));
    else if(byId(h)) openModel(byId(h));
    else if(h==='modeles'||h==='notaires'){if(h==='notaires') ui.cat='notaires';openLibrary();}
    else if(h==='brouillons') openDrafts();
    else if(h==='historique') openHistory();
    else if(h==='controle') openControl();
    else if(h==='compte') openAccount();
    else openHome();
  }catch(err){
    console.error('Erreur de navigation JuriskPro :',err);
    setTitle('Erreur');
    app.innerHTML='<div class="wrap"><main id="main" tabindex="-1"><section class="empty-state"><h1>Impossible d’afficher cet écran</h1><p>Vos brouillons déjà enregistrés ne sont pas supprimés. Revenez à l’accueil ou rechargez l’application.</p><div class="cta-row"><a class="btn" href="#">Retour à l’accueil</a><button class="btn ghost" type="button" onclick="location.reload()">Recharger</button></div></section></main></div>';
  }
  window.scrollTo(0,0);
  const main=$('#main');if(main&&document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.bnav,.nav-d')){try{main.focus({preventScroll:true});}catch(e){main.focus();}}
}
window.addEventListener('hashchange',route);
function go(h){if(location.hash==='#'+h) route(); else location.hash=h;}
function openWith(id,step,jump){pendingOpen={id:id,step:step,jump:jump};go(id);}

/* ============================================================
   ÉCRAN 1 : ACCUEIL
   ============================================================ */
function openHome(){
  leave();setTitle('');
  const ds=draftsList(),recent=ds.slice(0,2);
  const privN=MODELS.filter(m=>m.cat==='prive').length,notN=MODELS.filter(m=>m.cat==='notaires').length;
  shell('accueil',
    '<section class="home-hero"><div class="home-copy">'+
      '<p class="eyebrow"><span class="home-dot"></span> VOTRE ESPACE DE RÉDACTION</p>'+
      '<h1>Vos actes juridiques, <em>en toute simplicité.</em></h1>'+
      '<p class="slogan"><strong>JuriskPro,</strong> vous êtes rédacteur d’un monde qui vacille</p>'+
      '<p class="lead">Choisissez un modèle, renseignez les informations demandées et préparez votre document à télécharger en Word ou en PDF.</p>'+
      '<div class="cta-row"><a class="btn big" href="#modeles">'+ICON_DOC+' Créer un document</a>'+(ds.length?'<a class="btn big ghost" href="#brouillons">Reprendre un brouillon</a>':'')+'</div>'+
      '<form class="search home-search" id="hq" role="search"><label class="sr" for="q">Rechercher un modèle</label>'+ICON_SEARCH+'<input id="q" type="search" enterkeyhint="search" placeholder="Quel document recherchez-vous ?" autocomplete="off"></form>'+
    '</div><div class="home-preview"><div class="preview-top"><span class="preview-mark">'+ICON_SCALE+'</span><div><b>JuriskPro</b><small>Atelier de rédaction juridique</small></div><span class="preview-state"><i></i> Aperçu</span></div>'+
      '<div class="preview-paper"><span class="paper-kicker">DOCUMENT JURIDIQUE</span><div class="paper-rule"></div><h3>STATUTS DE SOCIÉTÉ</h3><p>Les informations saisies sont organisées dans un document structuré, prêt à être vérifié avant téléchargement.</p><div class="paper-lines"><i></i><i></i><i></i></div><div class="paper-fields"><span><b>Capital social</b><strong>5 000 000 F CFA</strong></span><span><b>Parts sociales</b><strong>500 parts</strong></span></div><div class="paper-sign">DOCUMENT À RELIRE AVANT SIGNATURE</div></div>'+
    '</div></section>'+
    '<section class="home-steps" aria-label="Comment utiliser JuriskPro"><div class="home-step"><span>01</span><div><b>Choisissez</b><small>un modèle adapté</small></div></div><div class="step-connector"></div><div class="home-step"><span>02</span><div><b>Renseignez</b><small>les champs demandés</small></div></div><div class="step-connector"></div><div class="home-step"><span>03</span><div><b>Téléchargez</b><small>votre document</small></div></div></section>'+
    (recent.length?'<section class="block home-recent" aria-labelledby="h-rec"><div class="cat-h"><div><p class="eyebrow">CONTINUER</p><h2 id="h-rec">Reprendre votre travail</h2></div><a href="#brouillons">Voir tous les brouillons →</a></div><div class="drafts">'+recent.map(x=>draftHTML(x,false)).join('')+'</div></section>':'')+
    '<section class="block home-library" aria-labelledby="h-fam"><div class="cat-h"><div><p class="eyebrow">BIBLIOTHÈQUE</p><h2 id="h-fam">Par où commencer ?</h2></div><a href="#modeles">Tous les modèles →</a></div><div class="shortcuts">'+
      '<a class="short home-short" href="#modeles"><span class="short-icon">'+ICON_DOC+'</span><span class="short-copy"><strong>Actes sous seing privé</strong><span>'+privN+' modèles pour préparer vos actes sans acte reçu par un notaire.</span></span><span class="short-arrow">↗</span></a>'+
      '<a class="short home-short" href="#notaires"><span class="short-icon">'+ICON_SCALE+'</span><span class="short-copy"><strong>Actes notariés</strong><span>'+notN+' modèles pour les actes relevant d’un notaire.</span></span><span class="short-arrow">↗</span></a></div></section>'+
    '<section class="home-bottom"><div><span class="home-bottom-icon">✓</span><p><b>Des modèles révisés par un juriste qualifié</b><small>Tous les modèles publiés sur JuriskPro ont été révisés par un juriste qualifié. Les contrôles automatiques aident à repérer certains champs manquants et certaines incohérences. Faites vérifier le document avant signature.</small></p></div><div class="home-total"><b>'+MODELS.length+'</b><span>modèles disponibles</span></div></section>'+
    '<footer class="foot">Votre compte et votre historique sont associés à votre compte personnel. Les brouillons de saisie restent locaux à cet appareil.</footer>');
  $('#hq').addEventListener('submit',e=>{e.preventDefault();ui.q=$('#q').value;ui.cat='all';go('modeles');});
  bindDrafts($('#main'));
}
function paintPaths(){
  const el=$('#paths');if(!el) return;
  el.innerHTML='<div class="block"><div class="cat-h"><h2>Parcours</h2><span>Les actes à enchaîner pour une même opération</span></div>'+
   PARCOURS.map(p=>'<div class="path"><h3>'+esc(p.titre)+'</h3><p>Dans cet ordre.</p><ol>'+p.etapes.map(e=>'<li><strong>'+esc(e.t)+'</strong><span>'+esc(e.d)+'</span><span class="lk">'+e.ids.map(id=>{const m=byId(id);return '<a href="#m/'+id+'">'+esc(m.titre.replace(/^Statuts de /,''))+'</a>';}).join('')+'</span></li>').join('')+'</ol></div>').join('')+
   '<p class="soon">D’autres modèles seront ajoutés ici : procès-verbaux, cessions de parts, statuts de SAS.</p></div>';
}

/* ---------- Carte de brouillon (accueil, brouillons) ---------- */
function draftHTML(x,full){
  const head=x.m.headline(x.d.v),an=x.an;
  const armed=ui.armed===x.m.id;
  let prog='';
  if(an){
    const n=an.secs.length,pc=n?Math.round(an.done/n*100):0;
    prog='<p class="prog">'+plural(an.done,'section complète','sections complètes')+' sur '+n+(an.missAll?' · '+plural(an.missAll,'information à compléter','informations à compléter'):' · aucun blanc')+'</p>'+
      '<div class="bar" role="img" aria-label="Avancement : '+pc+' %"><i style="width:'+pc+'%"></i></div>';
  }
  return '<article class="draft"><div><h3>'+esc(x.m.titre)+'</h3><p>'+(head?esc(head)+' · ':'')+'modifié le '+esc(fmtWhen(x.d.t))+'</p>'+prog+'</div>'+
    '<div class="acts"><a class="btn small" href="#'+x.m.id+'">Reprendre</a>'+
    (full?'<button type="button" class="btn small ghost" data-ctl="'+x.m.id+'">Contrôler</button>':'')+
    (full?'<button type="button" class="btn small ghost danger'+(armed?' armed':'')+'" data-del="'+x.m.id+'">'+(armed?'Confirmer la suppression':'Supprimer')+'</button>':'')+'</div></article>';
}
function bindDrafts(root,repaint){
  $$('[data-del]',root).forEach(b=>b.onclick=()=>{
    const id=b.dataset.del;
    if(ui.armed!==id){ui.armed=id;(repaint||route)();return;}
    store.del(draftKey(id));ui.armed='';(repaint||route)();
  });
  $$('[data-ctl]',root).forEach(b=>b.onclick=()=>openWith(b.dataset.ctl,'final'));
}

/* ============================================================
   ÉCRAN 2 : BIBLIOTHÈQUE DES MODÈLES
   ============================================================ */
function openLibrary(){
  leave();setTitle('Modèles');
  shell('modeles',
    '<div class="page-h"><h1>Modèles</h1><p>Choisissez l’acte à rédiger. Vous verrez le détail du modèle avant de commencer.</p></div>'+
    '<div class="search"><label class="sr" for="q">Rechercher un modèle</label>'+ICON_SEARCH+'<input id="q" type="search" enterkeyhint="search" placeholder="Rechercher : statuts, SARL, souscription…" autocomplete="off" value="'+esc(ui.q)+'"></div>'+
    '<div id="catalog" aria-live="polite"></div>');
  $('#q').addEventListener('input',e=>{ui.q=e.target.value;paintCatalog();});
  paintCatalog();
}
function matches(m){
  const q=ui.q.trim().toLowerCase();
  if(ui.cat!=='all'&&m.cat!==ui.cat) return false;
  if(!q) return true;
  const hay=(m.titre+' '+m.sous+' '+m.resume+' '+m.tags.join(' ')).toLowerCase();
  return q.split(/\s+/).every(w=>hay.indexOf(w)>-1);
}
function paintCatalog(){
  const el=$('#catalog');if(!el) return;
  const chips='<div class="chips" role="group" aria-label="Filtrer par famille">'+
    [{id:'all',titre:'Tous'}].concat(CATS).map(c=>'<button type="button" class="chip" data-cat="'+c.id+'" aria-pressed="'+(ui.cat===c.id)+'">'+esc(c.titre)+'</button>').join('')+'</div>';
  const list=MODELS.filter(matches);
  let body='<p class="count" role="status">'+plural(list.length,'modèle','modèles')+'</p>';
  if(!list.length) body='<p class="empty" role="status">Aucun modèle ne correspond à « '+esc(ui.q)+' »'+(ui.cat!=='all'?' dans cette famille':'')+'. Essayez « statuts » ou « SARL », ou choisissez « Tous ».</p>';
  else CATS.forEach(c=>{
    const items=list.filter(m=>m.cat===c.id);
    if(!items.length) return;
    body+='<div class="block"><div class="cat-h"><h2>'+esc(c.titre)+'</h2><span>'+esc(c.aide)+'</span></div><div class="grid">'+items.map(cardHTML).join('')+'</div></div>';
  });
  el.innerHTML=chips+body;
  $$('.chip',el).forEach(b=>b.onclick=()=>{ui.cat=b.dataset.cat;paintCatalog();});
}
function cardHTML(m){
  const d=readDraft(m.id);
  return '<article class="model model-compact"><h3><a href="#m/'+m.id+'">'+esc(m.titre)+'</a></h3>'+
    '<div class="model-row-meta">'+(d?'<span class="pill">Brouillon en cours</span>':'<span class="model-open-hint">Ouvrir le modèle</span>')+'<span class="model-arrow" aria-hidden="true">'+ARROW+'</span></div></article>';
}
/* ============================================================
   ÉCRAN 3 : DÉTAIL DU MODÈLE
   ============================================================ */
function openDetail(m){
  leave();setTitle(m.titre);
  const cat=CATS.find(c=>c.id===m.cat),d=readDraft(m.id);
  const secs=m.etapes.filter(e=>!e.final);
  let extrait='';
  try{
    const ex=Object.assign(m.defaults(),JSON.parse(JSON.stringify(m.exemple)),{date:todayISO()});
    const V=m.compute(ex),bl=m.blocks(ex,V);
    extrait=renderHTML(bl.slice(0,18),V).html;
  }catch(e){extrait='';}
  shell('modeles',
    '<article class="detail"><p class="mcat">'+esc(cat.titre)+'</p><h1>'+esc(m.titre)+'</h1><p class="msub">'+esc(m.sous)+'</p>'+
    '<p class="lead2">'+esc(m.resume)+'</p>'+
    '<ul class="tags">'+m.tags.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>'+
    '<dl class="facts"><div><dt>Durée indicative</dt><dd>'+esc(m.duree)+'</dd></div><div><dt>Sections à remplir</dt><dd>'+secs.length+'</dd></div><div><dt>Exports</dt><dd>Word (.docx) et PDF</dd></div></dl>'+
    (d?'<p class="status-line warn"><strong>Un brouillon existe</strong> pour ce modèle, modifié le '+esc(fmtWhen(d.t))+'.</p>':'')+
    '<div class="cta-row"><a class="btn big" href="#'+m.id+'">'+(d?'Reprendre le brouillon':'Utiliser ce modèle')+'</a></div>'+
    '<section class="block"><h2>Ce que vous allez renseigner</h2><ol class="secs">'+secs.map(e=>'<li><strong>'+esc(e.titre)+'</strong>'+(e.intro?'<span>'+esc(e.intro)+'</span>':'')+'</li>').join('')+'</ol></section>'+
    (extrait?'<section class="block"><h2>Aperçu</h2><p class="note">Début du document, rempli avec les données d’exemple du modèle (non reprises dans votre brouillon).</p><div class="sheet-scroll"><div class="sheet sheet-ex" aria-label="Extrait du document">'+extrait+'</div></div></section>':'')+
    '</article>',
    {back:'#modeles',backLabel:'Retour aux modèles',title:m.titre,cls:'detail-on'});
}

/* ============================================================
   ÉCRAN 9 : BROUILLONS
   ============================================================ */
function openDrafts(){
  leave();setTitle('Brouillons');
  const ds=draftsList();
  shell('brouillons',
    '<div class="page-h"><h1>Brouillons</h1><p>Enregistrés automatiquement sur cet appareil, dans ce navigateur. Il n’y a pas de synchronisation avec d’autres appareils. Un brouillon par modèle.</p></div>'+
    (ds.length?'<div class="drafts">'+ds.map(x=>draftHTML(x,true)).join('')+'</div>':
      '<div class="empty-state"><p><strong>Aucun brouillon pour le moment.</strong></p><p>Dès que vous saisissez une information dans un modèle, elle est enregistrée ici.</p><a class="btn" href="#modeles">Choisir un modèle</a></div>'));
  bindDrafts($('#main'),openDrafts);
}

/* ============================================================
   HISTORIQUE CLOUD : documents rattachés au compte Supabase.
   Le stockage local n'est qu'un cache temporaire, jamais la source.
   ============================================================ */
const HISTORY_KEY='juriskpro:history:v1';
function historyClient(){const a=window.JuriskProAuth;return a&&a.getClient?a.getClient():null;}
function messageFr(error,fallback){const raw=String(error&&error.message||error||'').toLowerCase();if(/invalid login credentials|invalid password|wrong password/.test(raw))return 'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants puis réessayez.';if(/permission denied|not authorized|unauthorized|row-level security/.test(raw))return 'Vous n’êtes pas autorisé à effectuer cette opération. Vérifiez votre compte et vos droits d’accès.';if(/network|fetch failed|failed to fetch|load failed/.test(raw))return 'La connexion au service est impossible. Vérifiez votre connexion Internet puis réessayez.';if(/not found|does not exist|no such file/.test(raw))return 'Le document demandé est introuvable.';if(/expired|invalid.*token/.test(raw))return 'Votre session ou ce lien a expiré. Reconnectez-vous puis réessayez.';return fallback||'Une erreur est survenue. Réessayez dans quelques instants.';}
async function historyUser(){const c=historyClient();if(!c)throw new Error('Connexion indisponible.');const {data,error}=await c.auth.getUser();if(error||!data.user)throw new Error('Session expirée. Reconnectez-vous.');return data.user;}
async function historyRead(){
  const c=historyClient();if(!c)throw new Error('Connexion indisponible.');
  const {data,error}=await c.from('juriskpro_documents').select('id,title,model_id,model_title,format,file_name,storage_path,document_text,values_json,created_at').order('created_at',{ascending:false}).limit(1000);
  if(error)throw error;return data||[];
}
async function historySave(item,blob){
  const c=historyClient(),u=await historyUser();if(!c)throw new Error('Connexion indisponible.');
  const id=item.id, path=u.id+'/'+id+'/'+item.fileName;
  const {error:uploadError}=await c.storage.from('juriskpro-documents').upload(path,blob,{contentType:blob.type||'application/octet-stream',upsert:true});
  if(uploadError)throw uploadError;
  const row={id,user_id:u.id,title:item.title,model_id:item.modelId,model_title:item.modelTitle,format:item.format,file_name:item.fileName,storage_path:path,document_text:item.text,values_json:item.values,created_at:new Date(item.createdAt).toISOString()};
  const {error}=await c.from('juriskpro_documents').upsert(row,{onConflict:'id'});
  if(error){await c.storage.from('juriskpro-documents').remove([path]);throw error;}
  return true;
}
async function historyDelete(id,path){
  const c=historyClient();if(!c)throw new Error('Connexion indisponible.');
  // Retirer le fichier avant la ligne : en cas d'échec Storage, l'entrée reste visible
  // et l'utilisateur peut relancer l'opération sans perdre la référence au fichier.
  if(path){
    const storageResult=await c.storage.from('juriskpro-documents').remove([path]);
    if(storageResult.error)throw storageResult.error;
  }
  const {error}=await c.from('juriskpro_documents').delete().eq('id',id);
  if(error)throw error;
}
function historyHTML(x){
  const d=Date.parse(x.created_at||x.createdAt)||0;
  return '<article class="history-item"><h3>'+esc(x.title||'Document sans titre')+'</h3><p class="history-meta">'+esc(x.model_title||x.modelTitle||'Modèle')+' · '+esc(d?fmtWhen(d):'Date inconnue')+' · '+esc((x.format||'').toUpperCase())+'</p>'+
    '<details><summary>Consulter le contenu du document</summary><div class="history-content"><pre>'+esc(x.document_text||x.text||'Contenu non disponible')+'</pre></div></details>'+
    '<div class="history-actions"><button type="button" class="btn small" data-history-download="'+esc(x.id)+'">Télécharger le fichier</button><a class="btn small ghost" href="#'+esc(x.model_id||x.modelId||'modeles')+'">Reprendre le modèle</a><button type="button" class="btn small ghost danger" data-history-del="'+esc(x.id)+'" data-history-path="'+esc(x.storage_path||'')+'">Supprimer</button></div></article>';
}
async function openHistory(){
  leave();setTitle('Historique');shell('historique','<div class="page-h"><h1>Historique</h1><p>Chargement de vos documents enregistrés dans votre espace personnel…</p></div>');
  try{
    const list=await historyRead();
    shell('historique','<div class="page-h"><h1>Historique</h1><p>Vos documents sont enregistrés dans votre compte. Retrouvez-les après connexion depuis un autre téléphone ou ordinateur, puis téléchargez à nouveau les fichiers originaux.</p></div>'+
      (list.length?'<div class="history-list">'+list.map(historyHTML).join('')+'</div>':'<div class="empty-state"><p><strong>Aucun document dans votre historique.</strong></p><p>Vos prochaines créations y seront enregistrées automatiquement.</p><a class="btn" href="#modeles">Créer un document</a></div>'));
    $$('[data-history-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer définitivement ce document de votre historique ?'))return;b.disabled=true;try{await historyDelete(b.dataset.historyDel,b.dataset.historyPath);await openHistory();}catch(e){alert('Suppression impossible : '+messageFr(e,'Une erreur est survenue lors de la suppression.'));b.disabled=false;}});
    $$('[data-history-download]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const item=list.find(x=>String(x.id)===b.dataset.historyDownload);if(!item||!item.storage_path)throw new Error('Fichier introuvable.');const c=historyClient();const {data,error}=await c.storage.from('juriskpro-documents').createSignedUrl(item.storage_path,60);if(error)throw error;if(isNativeApp()){const resp=await fetch(data.signedUrl);if(!resp.ok)throw new Error('Téléchargement impossible.');await nativeShareBlob(await resp.blob(),item.file_name||'document',item.file_name||'document');}else{const a=document.createElement('a');a.href=data.signedUrl;a.download=item.file_name||'document';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();}}catch(e){alert('Téléchargement impossible : '+messageFr(e,'Une erreur est survenue lors du téléchargement.'));}finally{b.disabled=false;}});
  }catch(e){shell('historique','<div class="page-h"><h1>Historique</h1><p>Impossible de charger votre historique.</p></div><section class="card set"><p class="msg err">'+esc(messageFr(e,'Vérifiez votre connexion et la configuration de la sauvegarde sécurisée.'))+'</p><p>Vos documents ne sont pas affichés tant que la connexion au stockage sécurisé n’est pas rétablie.</p><button class="btn" type="button" id="history-retry">Réessayer</button></section>');const b=$('#history-retry');if(b)b.onclick=openHistory;}
}

/* ============================================================
   ÉCRAN 6 : CONTRÔLE ET ALERTES
   ============================================================ */
function openControl(){
  leave();setTitle('Contrôle');
  const ds=draftsList();
  const note='<p class="note legal">Les contrôles de JuriskPro sont automatiques : ils signalent certains champs laissés en blanc et certaines incohérences détectables (parts, capital, versements…). Ils ne constituent pas une validation juridique et ne vérifient pas que les informations saisies correspondent à votre situation.</p>';
  let body;
  if(!ds.length) body='<div class="empty-state"><p><strong>Rien à contrôler pour le moment.</strong></p><p>Les contrôles portent sur vos brouillons. Commencez un document pour les voir ici.</p><a class="btn" href="#modeles">Choisir un modèle</a></div>';
  else body=ds.map(x=>{
    const an=x.an;if(!an) return '';
    let h='<article class="chk"><div><h3>'+esc(x.m.titre)+'</h3><p class="note">'+esc(x.m.headline(x.d.v)||'Sans dénomination')+' · modifié le '+esc(fmtWhen(x.d.t))+'</p></div>';
    if(an.probs.length) h+='<div class="al bad" role="group" aria-label="Incohérences"><p class="al-t">À corriger · '+plural(an.probs.length,'incohérence','incohérences')+'</p><ul>'+an.probs.map(p=>'<li><span>'+esc(p.t)+'<small>Section : '+esc(x.m.etapes[p.step].titre)+'</small></span><button type="button" class="btn small ghost" data-fix="'+x.m.id+'" data-st="'+p.step+'">Corriger</button></li>').join('')+'</ul></div>';
    if(an.missAll) h+='<div class="al warn" role="group" aria-label="Informations à compléter"><p class="al-t">À examiner · '+plural(an.missAll,'information à compléter','informations à compléter')+'</p><p class="note">Ces blancs apparaissent en pointillés dans le document. Vous pouvez aussi les remplir à la main après impression.</p><ul>'+
      an.miss.slice(0,5).map(id=>'<li><span>'+esc(an.ix[id].label)+'<small>Section : '+esc(x.m.etapes[an.ix[id].step].titre)+'</small></span><button type="button" class="btn small ghost" data-fix="'+x.m.id+'" data-fid="'+id+'">Compléter</button></li>').join('')+
      (an.miss.length>5?'<li class="more">… et '+(an.miss.length-5)+' autres, visibles dans la validation finale.</li>':'')+'</ul></div>';
    if(!an.probs.length&&!an.missAll) h+='<div class="al ok"><p class="al-t">Aucun blanc ni incohérence détecté</p><p class="note">Relisez l’aperçu avant de télécharger le document.</p></div>';
    h+='<div class="acts"><button type="button" class="btn small" data-fix="'+x.m.id+'" data-st="final">Ouvrir la validation finale</button></div></article>';
    return h;
  }).join('');
  shell('controle','<div class="page-h"><h1>Contrôle</h1><p>Vérifications effectuées par l’application sur vos brouillons.</p></div>'+body+note);
  $$('[data-fix]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.fix;
    if(b.dataset.fid) openWith(id,null,b.dataset.fid);
    else openWith(id,b.dataset.st==='final'?'final':+b.dataset.st);
  });
}

/* ============================================================
   ÉCRAN 10 : COMPTE, PROFIL ET PRÉFÉRENCES
   Authentification et profil via Supabase. Les préférences d’interface
   et la photo restent locales à ce navigateur.
   ============================================================ */
function themeMode(){return store.get('juriskpro:theme')||'auto';}
const ACCOUNT_KEY='juriskpro:account:v1';
function accountRead(){try{return JSON.parse(store.get(ACCOUNT_KEY)||'null');}catch(e){return null;}}
function accountSave(o){return store.set(ACCOUNT_KEY,JSON.stringify(o));}
function accountField(id,label,type,value,placeholder,required,autocomplete){
  return '<div class="field"><label for="'+id+'">'+label+(required?' <span aria-hidden="true">*</span>':'')+'</label><input id="'+id+'" name="'+id+'" type="'+type+'" value="'+esc(value||'')+'" placeholder="'+esc(placeholder||'')+'" '+(required?'required ':'')+'autocomplete="'+autocomplete+'"></div>';
}
async function openAccount(){
  leave();setTitle('Compte');
  const auth=window.JuriskProAuth;
  if(auth && auth.getClient()){
    try{
      const {data,error}=await auth.getClient().auth.getUser();
      if(error) throw error;
      const user=data&&data.user;
      if(!user){shell('compte','<div class="page-h"><h1>Compte &amp; Paramètres</h1><p>Aucune session active.</p></div><section class="card set"><p class="msg err">Votre session a expiré. Rechargez la page pour vous reconnecter.</p></section>');return;}
      const meta=user.user_metadata||{},localProfile=accountRead()||{};
      const profile={
        name:meta.full_name||meta.name||user.email||'Utilisateur',
        username:meta.username||(user.email||'').split('@')[0], email:user.email||'',
        phone:meta.phone||'', city:meta.city||'', profession:meta.profession||'',
        photo:meta.avatar_url||localProfile.photo||'', supabaseUser:true
      };
      renderAccountProfile(profile);
      return;
    }catch(err){
      shell('compte','<div class="page-h"><h1>Compte &amp; Paramètres</h1><p>Impossible de charger votre profil pour le moment.</p></div><section class="card set"><p class="msg err">Vérifiez votre connexion Internet puis rechargez la page.</p></section>');
      return;
    }
  }
  // L’authentification est exclusivement gérée par Supabase.
  shell('compte','<div class="page-h"><h1>Compte &amp; Paramètres</h1></div><section class="card set"><p class="msg err">Le service de compte n’est pas disponible. Rechargez la page et vérifiez votre connexion.</p></section>');
}
function renderAccountProfile(a){
  const nbd=draftsList().length,tm=themeMode();
  const notif=store.get('juriskpro:notifications')==='on';
  const themeLabel=tm==='dark'?'Sombre':tm==='light'?'Clair':'Automatique';
  shell('compte',
    '<div class="page-h"><h1>Compte &amp; Paramètres</h1><p>Gérez votre profil et personnalisez votre expérience JuriskPro.</p></div>'+
    '<section class="card set account-summary"><div class="account-heading"><label class="account-avatar" for="profile-photo-input" aria-label="Ajouter ou modifier la photo de profil">'+(a.photo?'<img src="'+a.photo+'" alt="Photo de profil">':esc((a.name||a.username||'U').trim().charAt(0).toUpperCase()))+'<span class="avatar-camera" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h-4l-2 3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg></span></label><input id="profile-photo-input" type="file" accept="image/*" hidden><div class="account-summary-text"><h2>'+esc(a.name||a.username)+'</h2><p class="intro">'+esc(a.email||'')+'</p></div><span class="pill">Compte Supabase</span></div></section>'+
    '<section class="card set account-menu" aria-label="Paramètres du compte">'+
      '<details class="account-item"><summary><span class="account-item-icon">♙</span><span class="account-item-text"><strong>Mon profil</strong><small>Nom, identifiant et coordonnées du compte</small></span><span class="account-chevron">›</span></summary><div class="account-panel"><p class="intro">Ces informations sont enregistrées dans les métadonnées de votre compte Supabase. La photo de profil, si vous en ajoutez une, reste enregistrée dans ce navigateur. Les informations du notaire, des parties et du dossier se renseignent séparément dans le formulaire du document concerné.</p><form id="acc-profile-form" class="fields">'+
        accountField('prof-name','Nom complet','text',a.name,'Votre nom et prénom',true,'name')+
        accountField('prof-username','Nom d’utilisateur','text',a.username,'Votre identifiant',true,'username')+
        '<div class="field"><label>Adresse e-mail du compte</label><input type="email" value="'+esc(a.email||'')+'" disabled><small class="aide">Cette adresse sert à votre connexion. Pour la modifier, utilisez la procédure de changement d’adresse e-mail.</small></div>'+
        accountField('prof-phone','Téléphone','tel',a.phone,'Facultatif',false,'tel')+
        accountField('prof-city','Ville / pays','text',a.city,'Facultatif',false,'address-level2')+
        accountField('prof-profession','Profession ou activité','text',a.profession,'Facultatif',false,'organization-title')+
        '<div class="tools"><button type="submit" class="btn">Enregistrer les modifications</button><span class="msg" id="prof-msg" role="status" aria-live="polite"></span></div></form></div></details>'+
      '<details class="account-item"><summary><span class="account-item-icon">♙</span><span class="account-item-text"><strong>Sécurité</strong><small>Session et confidentialité</small></span><span class="account-chevron">›</span></summary><div class="account-panel"><p class="intro"><strong>Confidentialité et protection de vos données</strong></p><p class="intro">Les informations que vous confiez à JuriskPro sont personnelles et doivent être traitées avec confidentialité. Elles ne sont pas destinées à être rendues publiques, vendues ou divulguées à des tiers. Elles ne peuvent être communiquées que lorsque cela est nécessaire au fonctionnement du service par ses prestataires techniques, avec les protections applicables, ou lorsque la loi l’exige.</p><p class="intro">L’accès à votre compte est protégé par l’authentification Supabase. Toutefois, la sécurité absolue ne peut être garantie sur Internet : choisissez un mot de passe robuste, gardez-le confidentiel et déconnectez-vous sur un appareil partagé.</p><p class="intro"><strong>Où vos données sont-elles conservées actuellement ?</strong> Votre compte et les informations de profil sont gérés par Supabase. En revanche, les documents générés et leur historique sont enregistrés dans votre compte JuriskPro et doivent rester accessibles après reconnexion sur un autre appareil. Les brouillons de saisie non encore finalisés, les préférences et la photo de profil restent locaux à ce navigateur.</p><div class="tools"><button type="button" class="btn ghost" id="acc-logout">Se déconnecter</button></div><p class="msg" id="acc-profile-msg" role="status" aria-live="polite"></p></div></details>'+
      '<details class="account-item"><summary><span class="account-item-icon">♧</span><span class="account-item-text"><strong>Notifications</strong><small>Préférences de rappel</small></span><span class="account-chevron">›</span></summary><div class="account-panel"><label class="account-toggle-row"><span><strong>Rappels dans l’application</strong><small>Afficher les rappels et informations utiles dans JuriskPro.</small></span><input id="acc-notif" type="checkbox" '+(notif?'checked':'')+'></label><p class="aide">Cette option mémorise uniquement votre préférence sur cet appareil. Aucun rappel automatique ni notification par e-mail ou téléphone n’est envoyé pour le moment.</p></div></details>'+
      '<div class="account-item account-setting-row"><span class="account-item-icon">◐</span><span class="account-item-text"><strong>Thème</strong><small>Adapter l’apparence de l’application</small></span><select id="acc-theme-select" aria-label="Thème de l’application"><option value="auto" '+(tm==='auto'?'selected':'')+'>Automatique</option><option value="light" '+(tm==='light'?'selected':'')+'>Clair</option><option value="dark" '+(tm==='dark'?'selected':'')+'>Sombre</option></select></div>'+
      '<div class="account-item account-setting-row"><span class="account-item-icon">文</span><span class="account-item-text"><strong>Langue</strong><small>Langue de l’interface</small></span><span class="account-value">Français</span></div>'+
      '<details class="account-item"><summary><span class="account-item-icon">ⓘ</span><span class="account-item-text"><strong>Aide &amp; Support</strong><small>Conseils pour utiliser JuriskPro</small></span><span class="account-chevron">›</span></summary><div class="account-panel"><p class="intro">1. Choisissez un modèle. 2. Complétez les champs demandés. 3. Vérifiez l’aperçu et les informations saisies. 4. Exportez votre document.</p><p class="intro">Si vous rencontrez un problème, vérifiez que votre navigateur est à jour et que les téléchargements sont autorisés.</p></div></details>'+
      '<details class="account-item"><summary><span class="account-item-icon">ⓘ</span><span class="account-item-text"><strong>À propos de JuriskPro</strong><small>Informations sur l’application</small></span><span class="account-chevron">›</span></summary><div class="account-panel"><p><strong>JuriskPro</strong></p><p class="intro">Votre allié juridique, partout avec vous.</p><p class="intro"><strong>Qualité juridique :</strong> tous les modèles publiés sur JuriskPro ont été révisés par un juriste qualifié. Cette exigence s’applique également à tout nouveau modèle avant sa publication.</p><p class="intro"><strong>Politique de confidentialité :</strong> consultez <a href="./politique-confidentialite.html" target="_blank" rel="noopener">notre politique complète</a> ou écrivez à <a href="mailto:messtonsconseils2@gmail.com">messtonsconseils2@gmail.com</a>.</p><p class="intro"><strong>Confidentialité :</strong> JuriskPro accorde une attention particulière à la confidentialité des informations personnelles et des documents que vous saisissez. Vos données ne sont pas destinées à être rendues publiques, vendues ou divulguées à des tiers, sous réserve des interventions nécessaires de nos prestataires techniques et des obligations légales. Les documents générés et leur historique sont associés au compte utilisateur. Les brouillons non finalisés restent locaux à l’appareil.</p><p class="intro">JuriskPro propose des modèles et des contrôles automatiques pour repérer certains champs manquants et certaines incohérences. Ces contrôles ne constituent pas une validation juridique et ne remplacent pas la vérification du document par un professionnel compétent.</p><p class="aide">Version mobile et bureau · Langue : français.</p></div></details>'+
      '<div class="account-item account-setting-row"><span class="account-item-icon">▤</span><span class="account-item-text"><strong>Brouillons</strong><small>'+ (nbd?plural(nbd,'document enregistré','documents enregistrés'):'Aucun document enregistré') +' sur cet appareil</small></span><button type="button" class="btn small ghost" id="open-drafts">Voir</button></div>'+
    '</section>'+
    '<p class="account-footnote">Le thème est appliqué immédiatement et enregistré dans ce navigateur. La langue de l’interface est actuellement le français. Les notifications automatiques ne sont pas encore disponibles.</p>');
  const themeSelect=$('#acc-theme-select');
  if(themeSelect) themeSelect.onchange=()=>{const v=themeSelect.value;if(v==='auto'){store.del('juriskpro:theme');applyTheme(null);}else{store.set('juriskpro:theme',v);applyTheme(v);}};
  const notifInput=$('#acc-notif');
  if(notifInput) notifInput.onchange=()=>{store.set('juriskpro:notifications',notifInput.checked?'on':'off');};
  const photoInput=$('#profile-photo-input');
  if(photoInput) photoInput.onchange=()=>{const file=photoInput.files&&photoInput.files[0];if(!file)return;if(!file.type||!file.type.startsWith('image/')){alert('Choisissez un fichier image.');return;}if(file.size>8*1024*1024){alert('Choisissez une image de moins de 8 Mo.');photoInput.value='';return;}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=320,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);const updated=Object.assign({},a,{photo:canvas.toDataURL('image/jpeg',.78)});if(!accountSave(updated)){alert('Impossible d’enregistrer la photo dans le stockage local de ce navigateur.');return;}renderAccountProfile(updated);};img.onerror=()=>alert('Cette image ne peut pas être ouverte.');img.src=reader.result;};reader.readAsDataURL(file);};
  const photoRemove=$('#profile-photo-remove');if(photoRemove)photoRemove.onclick=()=>{const updated=Object.assign({},a);delete updated.photo;accountSave(updated);renderAccountProfile(updated);};
  $('#acc-profile-form').onsubmit=async e=>{
    e.preventDefault();const v=id=>$('#'+id).value.trim();
    const updated=Object.assign({},a,{name:v('prof-name'),username:v('prof-username'),phone:v('prof-phone'),city:v('prof-city'),profession:v('prof-profession')});
    const auth=window.JuriskProAuth;
    if(a.supabaseUser && auth && auth.getClient()){
      const msg=$('#prof-msg');
      const {error}=await auth.getClient().auth.updateUser({data:{full_name:updated.name,username:updated.username,phone:updated.phone,city:updated.city,profession:updated.profession}});
      if(error){msg.textContent='Impossible d’enregistrer les modifications : '+messageFr(error,'Vérifiez votre connexion puis réessayez.');msg.className='msg err';return;}
      msg.textContent='Votre profil a été mis à jour.';msg.className='msg success';
      renderAccountProfile(updated);
    }else{accountSave(updated);renderAccountProfile(updated);}
  };
  $('#open-drafts').onclick=()=>go('brouillons');
  $('#acc-logout').onclick=async()=>{
    const auth=window.JuriskProAuth;
    if(auth && auth.getClient()) await auth.signOut();
    else {location.reload();}
  };
  
}
/* ============================================================
   ATELIER : ouverture d'un modèle
   ============================================================ */
function openModel(m){
  flushSave();
  M=m;ui.armed='';pane='form';validationAttempted=false;touchedSteps=new Set();
  const d=readDraft(m.id);
  S=Object.assign(m.defaults(),d?d.v:{});
  step=d&&Number.isInteger(d.step)?clamp(d.step,0,m.etapes.length-1):0;
  let jump=null;
  if(pendingOpen&&pendingOpen.id===m.id){
    if(pendingOpen.step==='final'){step=m.etapes.length-1;validationAttempted=true;}
    else if(Number.isInteger(pendingOpen.step)) step=clamp(pendingOpen.step,0,m.etapes.length-1);
    jump=pendingOpen.jump||null;
  }
  pendingOpen=null;
  fieldIndex=buildIndex(m);
  setTitle(m.titre);
  shell('modeles',
    '<nav class="crumbs" aria-label="Fil d’Ariane"><a href="#modeles">Modèles</a><span aria-hidden="true">/</span><a href="#m/'+m.id+'">'+esc(m.titre)+'</a></nav>'+
    '<div class="title-row"><h1>'+esc(m.titre)+'</h1><p>'+esc(m.sous)+'</p></div>'+
    '<div id="wiz" data-pane="form">'+
      '<div class="pane-switch" role="tablist" aria-label="Affichage"><button type="button" role="tab" id="tab-form" aria-selected="true" data-pane="form">Formulaire</button><button type="button" role="tab" id="tab-prev" aria-selected="false" data-pane="preview" hidden>Aperçu<span class="bdg" id="bdg" hidden></span></button></div>'+
      '<div class="work">'+
        '<div class="form-pane"><p class="stepno" id="stepno" aria-live="polite"></p><ol class="steps" id="steps"></ol><div id="stepbox"></div></div>'+
        '<aside class="preview" aria-label="Aperçu du document" hidden><div class="pv-head"><strong>Aperçu du document</strong><span class="legend"><span><i class="lv"></i>Saisi</span><span><i class="lb"></i>À compléter</span></span></div><div class="sheet-scroll" id="pvscroll"><div class="sheet" id="sheet"></div></div><button type="button" class="btn ghost back-form" id="back-form">Revenir au formulaire</button></aside>'+
      '</div><div class="jp-preview-modal" id="jp-preview-modal" role="dialog" aria-modal="true" aria-labelledby="jp-preview-title" hidden><div class="jp-preview-toolbar"><strong id="jp-preview-title">Aperçu complet du document</strong><div class="jp-preview-actions"><button type="button" class="jp-preview-close" id="jp-preview-close">Fermer l’aperçu ✕</button></div></div><div class="jp-preview-scroll" id="jp-preview-scroll"><div class="jp-preview-paper"><div class="sheet" id="jp-preview-sheet"></div></div></div></div></div>',
    {back:'#m/'+m.id,backLabel:'Retour à la fiche du modèle',title:m.titre,extra:'<span class="saved" id="saved" role="status">'+(d?'Brouillon repris':'Pas encore enregistré')+'</span>',cls:'wizard'});
  /* Le dialogue est déplacé directement sous body pour éviter qu'un conteneur animé/transformé de la version ordinateur bloque les clics ou limite le plein écran. */
  const modalNode=$('#jp-preview-modal');
  if(modalNode && modalNode.parentElement!==document.body) document.body.appendChild(modalNode);
  $$('.pane-switch button').forEach(b=>b.onclick=()=>{if(b.dataset.pane==='preview') openFullPreview(); else setPane('form');});
  $('#back-form').onclick=()=>setPane('form');
  const modal=$('#jp-preview-modal'),closePreview=$('#jp-preview-close');
  if(closePreview) closePreview.onclick=closeFullPreview;
  if(modal) modal.addEventListener('click',e=>{if(e.target===modal)closeFullPreview();});
  document.removeEventListener('keydown',onPreviewEscape);document.addEventListener('keydown',onPreviewEscape);
  /* Tout clic sur l'aperçu latéral ouvre la version complète, comme demandé. */
  const previewAside=$('.preview');
  if(previewAside){
    previewAside.style.cursor='zoom-in';
    previewAside.setAttribute('title','Cliquer pour afficher le document en plein écran');
    previewAside.addEventListener('click',e=>{
      if(e.target.closest('#back-form')) return;
      openFullPreview();
    });
  }
  const previewSheet=$('#sheet');
  if(previewSheet){
    previewSheet.style.cursor='zoom-in';
    previewSheet.setAttribute('title','Cliquer pour afficher le document en plein écran');
  }
  visitedSteps=new Set([step]);renderSteps();renderStep(false);paintPreview();
  if(jump) jumpToField(jump);
}
function setPane(p){
  if(p==='preview'){
    if(!(M&&M.etapes[step]&&M.etapes[step].final)) p='form';
    else if(finalValidation(M,S).blocked){p='form';updatePreviewVisibility();return;}
  }
  pane=p;
  $('#wiz').dataset.pane=p;
  $$('.pane-switch button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.pane===p)));
  window.scrollTo(0,0);
}
function renderSteps(){
  // Au départ, les étapes restent neutres. Les erreurs ne sont signalées qu'après
  // une tentative d'accès à la vérification finale. Une étape complète devient verte.
  let ix={},miss=[],probs=[];
  try{ix=buildIndex(M);miss=requiredMissing(M,S);probs=analyse(M,S).probs;}catch(e){}
  const badByStep=new Set();
  if(validationAttempted){
    miss.forEach(f=>{if(ix[f.id])badByStep.add(ix[f.id].step);});
    probs.forEach(p=>badByStep.add(p.step));
  }
  const goodByStep=new Set();
  M.etapes.forEach((e,i)=>{
    if(e.final)return;
    const stepFields=[];
    eachField(M,(f,si,rep,j)=>{if(si===i&&isReq(f)&&!['info','title','action'].includes(f.type)&&(!f.showIf||f.showIf(S)))stepFields.push(f);});
    let hasFields=false;
    eachField(M,(f,si)=>{if(si===i&&!['info','title','action'].includes(f.type)&&(!f.showIf||f.showIf(S)))hasFields=true;});
    const hasRequired=stepFields.length>0||hasFields;
    const allFilled=stepFields.every(f=>S[f.id]!=null&&String(S[f.id]).trim()!=='');
    const hasProblem=analyse(M,S).probs.some(p=>p.step===i);
    if((touchedSteps.has(i)||validationAttempted)&&hasRequired&&allFilled&&!hasProblem)goodByStep.add(i);
  });
  $('#steps').innerHTML=M.etapes.map((e,i)=>{
    const bad=validationAttempted&&!e.final&&badByStep.has(i),good=!e.final&&!bad&&goodByStep.has(i);
    const cls='step'+(i===step?' on':'')+(good?' step-good done':'')+(bad?' step-bad':'');
    const mark=bad?'×':(good?'✓':String(i+1));
    const status=bad?' · À corriger':(good?' · Complète':'');
    return '<li><button type="button" class="'+cls+'" data-i="'+i+'" '+(i===step?'aria-current="step"':'')+' aria-label="'+esc(e.court+status)+'"><span class="n">'+mark+'</span>'+esc(e.court)+'</button></li>';
  }).join('');
  $$('.step').forEach(b=>b.onclick=()=>{const target=+b.dataset.i;if(M.etapes[target].final)validationAttempted=true;step=target;visitedSteps.add(step);renderSteps();renderStep(true);scheduleSave();});
  const sn=$('#stepno');if(sn) sn.textContent='Étape '+(step+1)+' sur '+M.etapes.length+' · '+M.etapes[step].court;
  const st=$('#steps'),on=$('.step.on');
  if(st&&on&&st.scrollWidth>st.clientWidth) st.scrollLeft=on.offsetLeft-(st.clientWidth-on.offsetWidth)/2;
}
function gotoStep(i,focusSel){
  const target=clamp(i,0,M.etapes.length-1);if(M.etapes[target]&&M.etapes[target].final)validationAttempted=true;
  step=target;visitedSteps.add(step);renderSteps();renderStep(true,focusSel);scheduleSave();
}

/* ---------- Construction des champs ---------- */
function optList(f){return typeof f.opts==='function'?f.opts(S):f.opts;}
function val(id){return S[id]==null?'':String(S[id]);}
function fieldHTML(f){
  const v=val(f.id),vis=!f.showIf||f.showIf(S);
  const hid=vis?'':' hidden',half=f.half?' half':'';
  const aide=f.aide?'<p class="aide" id="h-'+f.id+'">'+esc(f.aide)+'</p>':'';
  const desc=f.aide?' aria-describedby="h-'+f.id+'"':'';
  const labelText=esc(f.label)+(isReq(f)?STAR:'');
  switch(f.type){
    case 'title':return '<h3 class="sub-h" data-fid="'+f.id+'"'+hid+'>'+esc(f.label)+'</h3>';
    case 'info':{
      const r=f.calc(S,M.compute(S));
      return '<div class="field info-w" data-fid="'+f.id+'"'+(r?'':' hidden')+'><p class="info '+(r&&r.c||'')+'" role="status" id="'+f.id+'">'+(r?esc(r.t):'')+'</p></div>';
    }
    case 'action':return '<div class="field" data-fid="'+f.id+'"'+hid+'><button type="button" class="btn ghost small" data-action="'+f.action+'">'+esc(f.label)+'</button></div>';
    case 'choice':{
      const opts=optList(f);
      return '<fieldset class="field'+half+'" data-fid="'+f.id+'"'+hid+'><legend>'+labelText+'</legend>'+aide+'<div class="opts '+(f.variant==='seg'?'seg':'stack')+'">'+
        opts.map(o=>'<label class="opt"><input type="radio" name="'+f.id+'" id="'+f.id+'-'+esc(o.v)+'" value="'+esc(o.v)+'"'+(v===o.v?' checked':'')+desc+'><span class="ob"><span class="ot">'+esc(o.t)+'</span>'+(o.d?'<span class="od">'+esc(o.d)+'</span>':'')+'</span></label>').join('')+
        '</div></fieldset>';
    }
    case 'select':{
      const opts=optList(f);
      return '<div class="field'+half+'" data-fid="'+f.id+'"'+hid+'><label for="'+f.id+'">'+labelText+'</label><select id="'+f.id+'" data-sel="1">'+
        opts.map(o=>'<option value="'+esc(o.v)+'"'+(v===o.v?' selected':'')+'>'+esc(o.t)+'</option>').join('')+'</select>'+aide+'</div>';
    }
    case 'area':return '<div class="field'+half+'" data-fid="'+f.id+'"'+hid+'><label for="'+f.id+'">'+labelText+'</label><textarea id="'+f.id+'" rows="'+(f.rows||3)+'" placeholder="'+esc(f.ph||'')+'"'+desc+'>'+esc(v)+'</textarea>'+aide+'</div>';
    case 'date':return '<div class="field'+half+'" data-fid="'+f.id+'"'+hid+'><label for="'+f.id+'">'+labelText+'</label><input type="date" id="'+f.id+'" value="'+esc(v)+'"'+desc+'>'+aide+'</div>';
    case 'money':case 'int':{
      const shown=f.type==='money'?(v?fmt(+v):''):v;
      return '<div class="field'+half+'" data-fid="'+f.id+'"'+hid+'><label for="'+f.id+'">'+labelText+'</label><div class="inp"><input type="text" inputmode="numeric" autocomplete="off" id="'+f.id+'" data-num="'+f.type+'" value="'+esc(shown)+'" placeholder="'+esc(f.ph||'')+'"'+desc+'>'+(f.unit?'<span class="unit">'+esc(f.unit)+'</span>':'')+'</div>'+aide+'</div>';
    }
    default:return '<div class="field'+half+'" data-fid="'+f.id+'"'+hid+'><label for="'+f.id+'">'+labelText+'</label><input type="text" id="'+f.id+'" value="'+esc(v)+'" placeholder="'+esc(f.ph||'')+'" autocomplete="off" enterkeyhint="next"'+desc+'>'+aide+'</div>';
  }
}
function repeatHTML(c){
  const n=clamp(parseInt(S[c.countKey],10)||c.min||1,c.min||1,c.max);
  const vis=!c.showIf||c.showIf(S);
  let h='<div class="field rep" data-rep="'+c.id+'"'+(vis?'':' hidden')+'><div class="fields" style="margin-top:0">';
  for(let i=0;i<n;i++){
    const nm=personName(S,c.prefix,i);
    const label=c.label+' '+(i+1);
    h+='<div class="field rhead" data-fid="rh-'+c.id+'-'+i+'"><h3>'+esc(label)+(nm&&!/^Associé \d+$/.test(nm)?' <span>· '+esc(nm)+'</span>':'')+'</h3>'+
      ((!c.fixed&&n>(c.min||1))?'<button type="button" class="btn ghost small" data-rm="'+c.id+':'+i+'" aria-label="Retirer '+esc(label)+'">Retirer</button>':'')+'</div>';
    h+=c.fields(i).map(fieldHTML).join('');
  }
  h+='</div>'+((!c.fixed&&n<c.max)?'<div style="margin-top:14px"><button type="button" class="btn ghost small" data-add="'+c.id+'">+ '+esc(c.addLabel)+'</button></div>':'')+'</div>';
  return h;
}
function repeatOf(id){let r=null;M.etapes.forEach(e=>(e.champs||[]).forEach(c=>{if(c.type==='repeat'&&c.id===id) r=c;}));return r;}

function renderStep(focus,focusSel){
  const e=M.etapes[step],box=$('#stepbox');
  if(e.final){box.innerHTML=finalHTML();bindFinal();}
  else{
    const body=(e.champs||[]).map(c=>c.type==='repeat'?repeatHTML(c):fieldHTML(c)).join('');
    box.innerHTML='<section class="card" aria-labelledby="st-h"><h2 id="st-h" tabindex="-1">'+esc(e.titre)+'</h2>'+(e.intro?'<p class="intro">'+esc(e.intro)+'</p>':'')+
      '<div class="fields">'+body+'</div>'+
      '<div class="nav"><button type="button" class="btn ghost" id="prev"'+(step===0?' disabled':'')+'>Précédent</button><button type="button" class="btn" id="next">'+(step===M.etapes.length-2?'Vérifier le document':'Continuer')+'</button></div>'+
      '<div class="tools"><button type="button" class="linkbtn" id="ex">Remplir avec un exemple</button><button type="button" class="linkbtn'+(ui.armed==='reset'?' armed':'')+'" id="reset">'+(ui.armed==='reset'?'Confirmer : tout effacer':'Recommencer à zéro')+'</button></div>'+
      '<div id="exnote"></div></section>';
    bindStep(box);
    paintExNote();
  }
  updatePreviewVisibility();
  if(focus){
    const t=focusSel?$(focusSel):$('#st-h');
    if(t){try{t.focus({preventScroll:false});}catch(x){}}
    if(!focusSel) window.scrollTo(0,0);
  }
}
function updatePreviewVisibility(){
  const finalStep=!!(M&&M.etapes[step]&&M.etapes[step].final);
  const validation=finalStep?finalValidation(M,S):null;
  const canPreview=finalStep&&validation&&!validation.blocked;
  const wiz=$('#wiz'),tab=$('#tab-prev'),preview=$('.preview');
  if(tab) tab.hidden=!canPreview;
  if(preview) preview.hidden=!canPreview;
  if(!canPreview){pane='form';if(wiz) wiz.dataset.pane='form';}
  const formTab=$('#tab-form');
  if(formTab) formTab.setAttribute('aria-selected',String(pane==='form'));
  if(tab) tab.setAttribute('aria-selected',String(canPreview&&pane==='preview'));
  if(canPreview) paintPreview();
}
function paintExNote(){
  const el=$('#exnote');if(!el) return;
  el.innerHTML=S._ex?'<p class="exnote">Ces informations sont un exemple. Remplacez-les par les vôtres, ou choisissez « Recommencer à zéro ».</p>':'';
}

/* ---------- Saisie ---------- */
function bindStep(box){
  box.addEventListener('input',onInput);
  box.addEventListener('change',onInput);
  box.addEventListener('focusin',e=>{
    const id=e.target&&e.target.id||e.target&&e.target.name;
    if(id) flashField(id);
  });
  box.addEventListener('click',onClick);
  const p=$('#prev'),n=$('#next');
  if(p) p.onclick=()=>gotoStep(step-1);
  if(n) n.onclick=()=>gotoStep(step+1);
  $('#ex').onclick=loadExample;
  $('#reset').onclick=doReset;
}
function onInput(e){
  if(!M||!S) return; /* événement tardif après avoir quitté le formulaire */
  const t=e.target;if(!t||!(t.matches('input,textarea,select'))) return;
  if(e.type==='input'&&(t.type==='radio'||t.tagName==='SELECT')) return;
  let id=t.type==='radio'?t.name:t.id,v=t.value;
  if(!id) return;
  if(t.dataset&&t.dataset.num){
    const before=t.value,pos=t.selectionStart;
    const digits=before.replace(/\D/g,'');
    v=digits;
    if(t.dataset.num==='money'){
      const f=digits?fmt(+digits):'';
      const keep=before.slice(0,pos||0).replace(/\D/g,'').length;
      t.value=f;
      let c=0,i=0;
      if(keep>0){for(i=0;i<f.length&&c<keep;i++){if(/\d/.test(f[i])) c++;}}
      try{t.setSelectionRange(i,i);}catch(x){}
    }else t.value=digits;
  }
  S[id]=v;
  touchedSteps.add(step);
  renderSteps();
  if(S._ex){delete S._ex;paintExNote();}
  if(M.etapes[step].champs.some(c=>c.type==='repeat'&&c.countKey===id)){renderStep(true,'[name="'+id+'"]:checked');scheduleSave();schedulePreview();return;}
  afterChange(id);
}
function afterChange(id){
  refreshDynamic();
  scheduleSave();
  schedulePreview();
}
function refreshDynamic(){
  const e=M.etapes[step];if(!e||e.final) return;
  try{neededIds(M,S);}catch(er){}
  const walk=(f)=>{
    const w=$('[data-fid="'+f.id+'"]');if(!w) return;
    const lab=w.querySelector('label');
    if(lab&&f.type!=='info'&&f.type!=='title'&&f.type!=='action'){const has=lab.querySelector('.required-star'),want=isReq(f);if(want&&!has) lab.insertAdjacentHTML('beforeend',STAR);else if(!want&&has) has.remove();}
    if(f.type==='info'){
      const r=f.calc(S,M.compute(S)),p=w.querySelector('.info');
      w.hidden=!r;p.textContent=r?r.t:'';p.className='info '+(r&&r.c||'');return;
    }
    if(f.showIf) w.hidden=!f.showIf(S);
    if(f.type==='select'&&typeof f.opts==='function'){
      const sel=w.querySelector('select'),cur=val(f.id),opts=f.opts(S);
      const sig=opts.map(o=>o.v+'|'+o.t).join('\n');
      if(sel.dataset.sig!==sig){
        sel.innerHTML=opts.map(o=>'<option value="'+esc(o.v)+'"'+(cur===o.v?' selected':'')+'>'+esc(o.t)+'</option>').join('');
        sel.dataset.sig=sig;
      }
    }
  };
  (e.champs||[]).forEach(c=>{
    if(c.type==='repeat'){
      const w=$('[data-rep="'+c.id+'"]');
      if(w&&c.showIf) w.hidden=!c.showIf(S);
      const n=clamp(parseInt(S[c.countKey],10)||c.min||1,c.min||1,c.max);
      for(let i=0;i<n;i++){
        c.fields(i).forEach(walk);
        const h=$('[data-fid="rh-'+c.id+'-'+i+'"] h3');
        if(h){const nm=personName(S,c.prefix,i),lab=c.label+' '+(i+1);h.innerHTML=esc(lab)+(nm&&!/^Associé \d+$/.test(nm)?' <span>· '+esc(nm)+'</span>':'');}
      }
    }else walk(c);
  });
  /* l'info "Capital" etc. peut dépendre d'une étape précédente : la remettre à jour à chaque saisie */
}
function onClick(e){
  const a=e.target.closest('[data-action]');
  if(a){doAction(a.dataset.action);return;}
  const ad=e.target.closest('[data-add]');
  if(ad){repeatAdd(repeatOf(ad.dataset.add));return;}
  const rm=e.target.closest('[data-rm]');
  if(rm){const x=rm.dataset.rm.split(':');repeatRemove(repeatOf(x[0]),+x[1]);return;}
}
function repeatAdd(c){
  const n=clamp(parseInt(S[c.countKey],10)||c.min||1,c.min||1,c.max);
  if(n>=c.max) return;
  const d=c.itemDefaults?c.itemDefaults(n,S):{};
  Object.keys(d).forEach(k=>{S[c.prefix+n+'_'+k]=d[k];});
  S[c.countKey]=String(n+1);
  const ff=c.fields(n).find(f=>f.type==='text'||f.type==='select');
  afterStructure(ff?'#'+ff.id:null);
}
function repeatRemove(c,i){
  const n=clamp(parseInt(S[c.countKey],10)||c.min||1,c.min||1,c.max);
  if(n<=(c.min||1)) return;
  for(let j=i;j<n-1;j++) c.keys.forEach(k=>{S[c.prefix+j+'_'+k]=S[c.prefix+(j+1)+'_'+k];});
  c.keys.forEach(k=>{delete S[c.prefix+(n-1)+'_'+k];});
  S[c.countKey]=String(n-1);
  if(M.id==='sarl-pluripersonnelle-mixte'&&c.prefix==='a'){
    ['g0_src','g1_src','g2_src','m_src'].forEach(k=>{
      const m=/^a(\d+)$/.exec(S[k]||'');
      if(m){const x=+m[1];S[k]=x===i?'a0':(x>i?'a'+(x-1):S[k]);}
    });
  }
  afterStructure();
}
function afterStructure(focusSel){
  renderStep(!!focusSel,focusSel);
  scheduleSave();schedulePreview();
}
function doAction(a){
  if(a==='import-statuts'&&M.importFrom){
    const r=M.importFrom();
    if(!r) return;
    const n=clamp(parseInt(r.patch.nb_assoc,10)||1,1,10);
    for(let i=0;i<10;i++) (M.importKeys||['civilite','prenom','nom','adresse','parts','verse']).forEach(k=>{delete S['a'+i+'_'+k];});
    Object.keys(r.patch).forEach(k=>{if(r.patch[k]!==''||/^a\d+_civilite$/.test(k)) S[k]=r.patch[k];});
    S.nb_assoc=String(n);delete S._ex;
    renderStep(false);schedulePreview();scheduleSave();
    const el=$('#exnote');if(el) el.innerHTML='<p class="exnote ok">Informations reprises depuis « '+esc(r.titre)+' ». Vérifiez les parts et les versements.</p>';
  }else if(a==='copy-associe'&&M.copyAssocie){
    Object.assign(S,M.copyAssocie(S));
    renderStep(false);schedulePreview();scheduleSave();
  }
}
function loadExample(){
  S=Object.assign(M.defaults(),JSON.parse(JSON.stringify(M.exemple)),{date:todayISO(),_ex:1});
  ui.armed='';renderStep(false);schedulePreview();scheduleSave();
}
function doReset(){
  if(ui.armed!=='reset'){ui.armed='reset';renderStep(false);return;}
  ui.armed='';S=M.defaults();store.del(draftKey(M.id));step=0;
  renderSteps();renderStep(true);paintPreview();
}

/* ---------- Aperçu ---------- */
/* Aperçu : recalculé après une courte pause de saisie (140 ms), pas à chaque touche. */
function schedulePreview(){clearTimeout(pvRaf);pvRaf=setTimeout(()=>{pvRaf=0;paintPreview();},140);}
let lastMissing=0;
function paintPreview(){
  if(!M) return;
  const r=recompute(),out=renderHTML(r.blocks,r.V);
  const sheet=$('#sheet');if(!sheet) return;
  const sc=$('#pvscroll'),top=sc?sc.scrollTop:0;
  sheet.innerHTML=out.html;
  const modalSheet=$('#jp-preview-sheet');
  if(modalSheet) modalSheet.innerHTML=out.html;
  if(sc) sc.scrollTop=top;
  lastMissing=out.missing.size;
  const b=$('#bdg');if(b){b.hidden=!out.missing.size;b.textContent=out.missing.size;}
}
function openFullPreview(){
  if(!(M&&M.etapes[step]&&M.etapes[step].final)) return;
  const gate=finalValidation(M,S);
  if(gate.blocked){setPane('form');return;}
  paintPreview();
  const modal=$('#jp-preview-modal');if(!modal)return;
  modal.hidden=false;document.body.classList.add('jp-modal-open');
  const sc=$('#jp-preview-scroll');if(sc)sc.scrollTop=0;
  const close=$('#jp-preview-close');if(close)close.focus();
}
function closeFullPreview(){
  const modal=$('#jp-preview-modal');if(modal)modal.hidden=true;
  document.body.classList.remove('jp-modal-open');
  const tab=$('#tab-prev');if(tab)tab.focus();
}
function onPreviewEscape(e){if(e.key==='Escape'){const modal=$('#jp-preview-modal');if(modal&&!modal.hidden)closeFullPreview();}}

function flashField(id){
  const els=$$('#sheet [data-f="'+id+'"]');
  if(!els.length) return;
  els.forEach(x=>{x.classList.remove('flash');void x.offsetWidth;x.classList.add('flash');});
  const sc=$('#pvscroll');
  if(sc&&getComputedStyle($('.preview')).position==='sticky'){
    const first=els[0],cr=sc.getBoundingClientRect(),er=first.getBoundingClientRect();
    if(er.top<cr.top+20||er.bottom>cr.bottom-20) sc.scrollTop+=er.top-cr.top-cr.height/3;
  }
}
function jumpToField(id){
  const ix=fieldIndex[id];if(!ix) return;
  if(M.etapes[step].final||ix.step!==step){step=ix.step;renderSteps();renderStep(false);}
  setPane('form');
  const el=document.getElementById(id)||$('[name="'+id+'"]');
  if(el){el.scrollIntoView({block:'center'});try{el.focus({preventScroll:true});}catch(x){}}
}


/* ---------- ÉCRANS 7 ET 8 : validation finale et exportation ---------- */
function finalHTML(){
  const validation=finalValidation(M,S),an=validation.an,req=validation.req,blocked=validation.blocked;
  const nSec=an.secs.length,todo=an.miss;
  let h='<section class="card" aria-labelledby="st-h"><h2 id="st-h" tabindex="-1">'+esc(M.etapes[step].titre)+'</h2>';
  h+='<div class="final-h">';
  h+='<div class="states" role="list">'+
    '<div class="stt" role="listitem"><span>Formulaire</span><strong>'+an.done+' / '+nSec+' sections complètes</strong></div>'+
    '<div class="stt'+(an.probs.length?' bad':'')+'" role="listitem"><span>Contrôles techniques</span><strong>'+(an.probs.length?plural(an.probs.length,'incohérence à corriger','incohérences à corriger'):'Aucune incohérence détectée')+'</strong></div>'+
    '<div class="stt'+(an.missAll?' warn':'')+'" role="listitem"><span>À examiner</span><strong>'+(an.missAll?plural(an.missAll,'information à compléter','informations à compléter'):'Aucun blanc')+'</strong></div>'+
    '<div class="stt'+(blocked?' bad':'')+'" role="listitem"><span>Exportation</span><strong>'+(blocked?'Bloquée jusqu’aux corrections':'Prêt à être téléchargé')+'</strong></div></div>';
  h+='<p class="note legal">Les contrôles automatiques de JuriskPro portent sur les champs et certaines incohérences détectables ; ils ne constituent pas une validation juridique et ne confirment pas que les informations saisies sont exactes ou adaptées à votre situation. Faites vérifier le document final par un professionnel compétent avant signature.</p>';
  if(blocked){
    h+='<section class="al bad" role="alert"><p class="al-t">Aperçu et téléchargement bloqués</p><p>Complétez tous les champs obligatoires marqués d’un astérisque rouge et corrigez les incohérences signalées avant de consulter l’aperçu.</p>';
    if(req.length) h+='<h3 class="sub-h2">Champs obligatoires à remplir</h3><ul>'+req.map(x=>'<li><button type="button" class="linkbtn" data-jump="'+esc(x.id)+'">'+esc(x.label)+' — compléter</button></li>').join('')+'</ul>';
    if(an.probs.length) h+='<h3 class="sub-h2">Incohérences à corriger</h3><ul>'+an.probs.map(p=>'<li>'+esc(p.t)+' <button type="button" class="linkbtn" data-step="'+p.step+'">Aller à la correction</button></li>').join('')+'</ul>';
    h+='</section>';
  }
  h+='<h3 class="sub-h2">Résumé par section</h3><ul class="secsum">'+an.secs.map(x=>'<li><span class="sst '+(x.n?'w':'o')+'">'+(x.n?plural(x.n,'à compléter','à compléter'):'Complète')+'</span><span class="sn">'+esc(x.full)+'</span><button type="button" class="linkbtn" data-step="'+x.i+'">'+(x.n?'Compléter':'Revoir')+'</button></li>').join('')+'</ul>';
  if(an.probs.length) h+=an.probs.map(p=>'<p class="status-line warn"><strong>À corriger :</strong> '+esc(p.t)+' <button type="button" class="linkbtn" data-step="'+p.step+'">Corriger</button></p>').join('');
  if(todo.length) h+='<ul class="todo">'+todo.slice(0,12).map(id=>'<li><button type="button" data-jump="'+id+'"><span>'+esc(an.ix[id].label)+'</span><small>Compléter</small></button></li>').join('')+(todo.length>12?'<li class="note">… et '+(todo.length-12)+' autres.</li>':'')+'</ul>';
  if(!blocked){
    h+='<h3 class="sub-h2">Aperçu du document</h3><p class="note">Les champs obligatoires sont renseignés et aucun contrôle d’incohérence n’est en attente. Vous pouvez maintenant consulter l’aperçu, puis télécharger le document.</p>';
    h+='<h3 class="sub-h2">Télécharger</h3>';
    h+='<div class="dl-row"><button type="button" class="btn" id="dl-docx">Word (.docx)</button><button type="button" class="btn ghost" id="dl-pdf">PDF</button><button type="button" class="btn ghost" id="share-doc">↗ Partager</button></div><p class="note dl-help">Word : modifiable. PDF : prêt à lire, imprimer ou envoyer. Partager ouvre les applications compatibles de votre téléphone.</p>';
    h+='<p class="msg" id="dl-msg" role="status" aria-live="polite"></p>';
    h+='<div class="tools" style="margin-top:0"><button type="button" class="linkbtn" id="cp">Copier le texte</button></div>';
  }else{
    h+='<p class="note">Les options d’aperçu, de copie et de téléchargement seront disponibles après correction de tous les champs obligatoires et de toutes les incohérences détectées.</p>';
  }
  if(M.finalNote) h+='<p class="note">'+esc(M.finalNote)+'</p>';
  if(M.next){const nx=byId(M.next);if(nx) h+='<div class="next"><p><strong>Étape suivante :</strong> '+esc(nx.titre)+'. Elle reprend la dénomination, les associés et les versements de ces statuts.</p><a class="btn small" href="#'+nx.id+'">Ouvrir le modèle</a></div>';}
  h+='</div><div class="nav"><button type="button" class="btn ghost" id="prev">Précédent</button><span></span></div></section>';
  return h;
}
function bindFinal(){
  const box=$('#stepbox');
  $('#prev').onclick=()=>gotoStep(step-1);
  $$('[data-jump]',box).forEach(b=>b.onclick=()=>jumpToField(b.dataset.jump));
  $$('[data-step]',box).forEach(b=>b.onclick=()=>gotoStep(+b.dataset.step));
  const docx=$('#dl-docx'),pdf=$('#dl-pdf'),share=$('#share-doc'),cp=$('#cp');
  /* On télécharge les modules Word/PDF dès l'étape finale : le clic est alors instantané. */
  if(window.JPLibs){JPLibs.load('jszip').catch(()=>{});JPLibs.load('jspdf').catch(()=>{});}
  if(docx) docx.onclick=()=>download('docx');
  if(pdf) pdf.onclick=()=>download('pdf');
  if(share) share.onclick=shareDocument;
  if(cp) cp.onclick=copyText;
}
function say(t,kind){const m=$('#dl-msg');if(m){m.textContent=t;m.className='msg'+(kind?' '+kind:'');}}
let exporting=false;
const isNativeApp=()=>!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
let _capFS=null,_capShare=null;
function blobToBase64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(r.error||new Error('lecture'));r.readAsDataURL(blob);});}
async function nativeShareBlob(blob,name,title){
  _capFS=_capFS||Capacitor.registerPlugin('Filesystem');
  _capShare=_capShare||Capacitor.registerPlugin('Share');
  const safe=String(name||'document').replace(/[\\/:*?"<>|]+/g,'-');
  const data=await blobToBase64(blob);
  const w=await _capFS.writeFile({path:safe,data:data,directory:'CACHE',recursive:true});
  try{
    await _capShare.share({title:title||safe,dialogTitle:'Enregistrer ou envoyer le document',url:w.uri});
  }catch(e){
    if(/cancel/i.test(String(e&&(e.message||e)))) throw {code:'declined'};
    throw e;
  }
}
async function saveBlob(blob,name){
  if(isNativeApp()){await nativeShareBlob(blob,name,name);return;}
  let dl=null;
  try{if(typeof claude!=='undefined'&&claude&&claude.use) dl=await claude.use('downloads');}
  catch(e){if(e&&e.code) throw e;}
  if(dl){await dl.save({filename:name,data:blob});return;}
  const u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(u);},5000);
}
async function download(kind){
  if(!M) return;
  const gate=finalValidation(M,S);
  if(gate.blocked){gotoStep(firstCorrectionStep(gate));return;}
  if(exporting) return;
  exporting=true;
  const btns=$$('#dl-docx,#dl-pdf');
  const r=recompute(),title=M.docTitle(r.V),name=M.fileBase(r.V)+'.'+kind;
  btns.forEach(b=>{b.disabled=true;});
  const cur=$(kind==='docx'?'#dl-docx':'#dl-pdf'),lab=cur.textContent;cur.textContent='Préparation en cours…';
  say('Préparation du fichier…');
  try{
    await JPLibs.load(kind==='docx'?'jszip':'jspdf');
    const blob=kind==='docx'?await buildDocx(r.blocks,r.V,title):await buildPdf(r.blocks,r.V,title);
    const item={id:(window.crypto&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);})),modelId:M.id,modelTitle:M.titre,title:title,fileName:name,format:kind,createdAt:Date.now(),text:toText(r.blocks,r.V),values:stripV(S)};
    // La création et le téléchargement local restent possibles même si le cloud est indisponible.
    await saveBlob(blob,name);
    try{
      await historySave(item,blob);
      say('✓ Document téléchargé et enregistré dans votre compte : '+name+'.', 'ok');
    }catch(cloudError){
      console.warn('Échec de la sauvegarde cloud ; le fichier local a été téléchargé.',cloudError);
      say('✓ Document téléchargé : '+name+'. Attention : son enregistrement dans l’historique cloud a échoué. Réessayez plus tard.', 'err');
    }
  }catch(e){
    if(e&&e.code==='declined') say('Téléchargement annulé. Vous pouvez réessayer.');
    else if(e&&e.code==='lib') say('Le module de création de fichier n’a pas pu se charger (module : '+(e.lib||'?')+'). Vérifiez votre connexion puis réessayez.','err');
    else if(e&&e.code==='rate_limited') say('Une demande de téléchargement est déjà ouverte. Répondez-y, puis réessayez.','err');
    else{console.warn('Export échoué',e);say('Le fichier n’a pas pu être créé ou téléchargé (détail : '+String((e&&(e.message||e.code||e.name))||e).slice(0,90)+'). Réessayez, ou utilisez « Copier le texte » pour récupérer le contenu.','err');}
  }finally{exporting=false;btns.forEach(b=>{b.disabled=false;});cur.textContent=lab;}
}

async function shareDocument(){
  if(!M) return;
  const gate=finalValidation(M,S);
  if(gate.blocked){gotoStep(firstCorrectionStep(gate));return;}
  const btn=$('#share-doc');
  if(!btn||exporting) return;
  exporting=true;btn.disabled=true;const old=btn.textContent;btn.textContent='Préparation…';
  try{
    await JPLibs.load('jspdf');
    const r=recompute(),title=M.docTitle(r.V),name=M.fileBase(r.V)+'.pdf';
    const blob=await buildPdf(r.blocks,r.V,title);
    const file=new File([blob],name,{type:'application/pdf'});
    if(isNativeApp()){
      await nativeShareBlob(blob,name,title);
      say('Menu de partage ouvert. Choisissez WhatsApp, Drive, Fichiers ou une autre application.','ok');
    }else if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({title:title,text:'Document créé avec JuriskPro',files:[file]});
      say('Partage ouvert. Choisissez WhatsApp, Facebook ou une autre application disponible.','ok');
    }else if(navigator.share){
      await navigator.share({title:title,text:'Document créé avec JuriskPro'});
      say('Le menu de partage est ouvert. Pour transmettre le fichier, utilisez Télécharger PDF.','ok');
    }else{
      say('Le partage direct n’est pas disponible dans ce navigateur. Téléchargez le PDF, puis partagez-le depuis votre téléphone.','err');
    }
  }catch(e){
    if(e&&(e.name==='AbortError'||e.code==='declined')) say('Partage annulé.');
    else if(e&&e.code==='lib') say('Le module PDF n’a pas pu se charger (module : '+(e.lib||'?')+'). Vérifiez la connexion puis réessayez.','err');
    else{console.warn('Partage échoué',e);say('Le partage n’a pas pu être lancé (détail : '+String((e&&(e.message||e.code||e.name))||e).slice(0,90)+'). Téléchargez le PDF, puis partagez-le depuis votre téléphone.','err');}
  }finally{exporting=false;btn.disabled=false;btn.textContent=old;}
}

async function copyText(){
  if(!M) return;
  const gate=finalValidation(M,S);
  if(gate.blocked){gotoStep(firstCorrectionStep(gate));return;}
  const r=recompute(),txt=toText(r.blocks,r.V);
  try{await navigator.clipboard.writeText(txt);say('Texte copié. Collez-le dans votre traitement de texte.','ok');}
  catch(e){
    const ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand('copy');}catch(x){}
    ta.remove();say(ok?'Texte copié.':'La copie a été refusée par le navigateur. Sélectionnez le texte de l’aperçu et copiez-le.',ok?'ok':'err');
  }
}

/* ---------- Brouillon automatique ---------- */
function setSaved(t,bad){const el=$('#saved');if(el){el.textContent=t;el.className='saved'+(bad?' bad':'');}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,500);}
function flushSave(){
  clearTimeout(saveTimer);saveTimer=0;
  if(!M||!S) return;
  const v=stripV(S),d0=M.defaults();
  const hasData=Object.keys(v).some(k=>k!=='_ex'&&String(v[k]).trim()!==''&&String(v[k])!==String(d0[k]==null?'':d0[k]));
  if(M.cat==='notaires') saveNotaireProfile(S);
  if(!hasData&&!v._ex&&!store.get(draftKey(M.id))) return;
  const ok=store.set(draftKey(M.id),JSON.stringify({v:v,step:step,t:Date.now()}));
  setSaved(ok?'Enregistré à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'Non enregistré : stockage indisponible',!ok);
}
window.addEventListener('pagehide',flushSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden) flushSave();});

/* ---------- Clavier virtuel : libère la barre du bas pendant la saisie ---------- */
document.addEventListener('focusin',e=>{if(e.target&&e.target.matches&&e.target.matches('input:not([type=radio]):not([type=checkbox]),textarea,select')) document.body.classList.add('kb');});
document.addEventListener('focusout',()=>{setTimeout(()=>{const a=document.activeElement;if(!(a&&a.matches&&a.matches('input:not([type=radio]):not([type=checkbox]),textarea,select'))) document.body.classList.remove('kb');},120);});

window.JuriskProAuth.require(function(){ route(); });
