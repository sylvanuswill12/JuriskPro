/* ============================================================
   APPLICATION : routage, portail, atelier de rédaction
   ============================================================ */
const $=(s,r)=> (r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const app=document.getElementById('app');
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
let M=null,S=null,step=0,pane='form',fieldIndex={},saveTimer=0,pvRaf=0,lastSaved=0,fieldFilter='';
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

/* eachField, buildIndex, champs obligatoires et analyse : voir engine.js */

/* ---------- Calculs ---------- */
function recompute(){
  const V=M.compute(S);
  const blocks=M.blocks(S,V);
  return {V:V,blocks:blocks};
}

const NOT_DRAFT=['account','history','theme','notifications'];
/* Liste des brouillons présents sur l'appareil : aucun modèle n'est chargé pour l'afficher. */
function listDrafts(){
  const out=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const mm=/^juriskpro:(.+):v1$/.exec(localStorage.key(i)||'');
      if(!mm||NOT_DRAFT.indexOf(mm[1])>-1) continue;
      const d=readDraft(mm[1]);if(d) out.push({id:mm[1],d:d});
    }
  }catch(e){}
  return out.sort((x,y)=>(y.d.t||0)-(x.d.t||0));
}
/* Résumé enregistré avec le brouillon : titre, avancement, blancs. Évite de recharger le modèle pour l'afficher. */
function draftMeta(m,s){
  let an=null;try{an=analyse(m,s);}catch(e){}
  return {titre:m.titre,headline:(m.headline?m.headline(s):'')||'',n:an?an.secs.length:0,done:an?an.done:0,missAll:an?an.missAll:0,probs:an?an.probs.length:0};
}
function draftsList(){
  return listDrafts().map(x=>({id:x.id,d:x.d,meta:x.d.meta||null,m:{id:x.id,titre:(x.d.meta&&x.d.meta.titre)||(Cat.meta(x.id)||{}).titre||x.id}}));
}
/* Anciens brouillons sans résumé : on charge leur modèle une fois pour le calculer (6 au plus à la fois). */
async function upgradeDrafts(){
  const miss=listDrafts().filter(x=>!x.d.meta).slice(0,6);
  if(!miss.length) return false;
  try{await loadModels(miss.map(x=>x.id));}catch(e){return false;}
  let any=false;
  miss.forEach(x=>{const m=FULL[x.id];if(!m) return;x.d.meta=draftMeta(m,Object.assign(m.defaults(),x.d.v));if(store.set(draftKey(x.id),JSON.stringify(x.d))) any=true;});
  return any;
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

/* ---------- Pastilles rouges sur la barre de navigation ---------- */
const SEEN_KEY='juriskpro:seenModels';
let newModels=0;
function badgeCounts(){
  let ds=[];try{ds=listDrafts();}catch(e){}
  const ctl=ds.filter(x=>x.d.meta&&((x.d.meta.probs||0)+(x.d.meta.missAll||0))>0).length;
  return {brouillons:ds.length,controle:ctl,modeles:newModels};
}
function updateBadges(){
  const c=badgeCounts();
  NAV.forEach((n,i)=>{
    const k=c[n.id]||0;
    document.querySelectorAll('.bnav a:nth-child('+(i+1)+'),.nav-d a:nth-child('+(i+1)+')').forEach(a=>{
      let b=a.querySelector('.nav-badge');
      if(!k){if(b) b.remove();a.removeAttribute('data-badge');return;}
      if(!b){b=document.createElement('span');b.className='nav-badge';b.setAttribute('aria-hidden','true');a.appendChild(b);}
      b.textContent=k>9?'9+':String(k);
      a.setAttribute('data-badge',k+(k>1?' nouveaux éléments':' nouvel élément'));
    });
  });
}
/* Modèles : la pastille compte les modèles ajoutés depuis la dernière visite de l'onglet Modèles. */
async function computeNewModels(){
  try{
    const ids=Object.keys(await Cat.index());let seen=null;
    try{seen=JSON.parse(store.get(SEEN_KEY)||'null');}catch(e){}
    if(!Array.isArray(seen)){store.set(SEEN_KEY,JSON.stringify(ids));newModels=0;}
    else{const set=new Set(seen);newModelIds=ids.filter(i=>!set.has(i));newModels=newModelIds.length;}
  }catch(e){}
  updateBadges();notifyNewModels();
}
function markModelsSeen(){
  if(!newModels) return;
  Cat.index().then(idx=>{store.set(SEEN_KEY,JSON.stringify(Object.keys(idx)));newModels=0;newModelIds=[];updateBadges();}).catch(()=>{});
}

/* ---------- Notifications ----------
   Application Android : notifications locales natives (autorisation Android 13+, rappel programmé même app fermée).
   Navigateur : notifications du système via le service worker. Tout est désactivé tant que l'utilisateur n'a pas activé l'option. */
const NOTIF_KEY='juriskpro:notifications',NOTIF_MODELS_KEY='juriskpro:notifiedModels',REMIND_ID=4101;
let newModelIds=[];
const notifOn=()=>store.get(NOTIF_KEY)==='on';
function nativeLN(){try{if(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()) return capPlugin('LocalNotifications');}catch(e){}return null;}
function notifSupported(){return !!nativeLN()||('Notification' in window);}
async function notifPermission(){
  const ln=nativeLN();
  if(ln){try{const r=await ln.checkPermissions();return r.display==='granted'?'granted':r.display==='denied'?'denied':'default';}catch(e){return 'unsupported';}}
  return 'Notification' in window?(Notification.permission==='default'?'default':Notification.permission):'unsupported';
}
async function notifRequest(){
  const ln=nativeLN();
  if(ln){try{const r=await ln.requestPermissions();return r.display==='granted'?'granted':'denied';}catch(e){return 'unsupported';}}
  if(!('Notification' in window)) return 'unsupported';
  try{const r=await Notification.requestPermission();return r;}catch(e){return 'unsupported';}
}
async function notify(title,body,url,tag){
  if(!notifOn()||(await notifPermission())!=='granted') return false;
  const ln=nativeLN();
  try{
    if(ln){await ln.schedule({notifications:[{id:Math.floor(Date.now()%2000000000),title:title,body:body,extra:{url:url||'#'}}]});return true;}
    const opts={body:body,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:tag||'juriskpro',data:{url:url||'./#'}};
    const reg=('serviceWorker' in navigator)?await navigator.serviceWorker.getRegistration():null;
    if(reg&&reg.showNotification){await reg.showNotification(title,opts);return true;}
    new Notification(title,opts);return true;
  }catch(e){return false;}
}
/* Rappel Android quand l'application passe en arrière-plan : programmé pour le lendemain, annulé à la réouverture. */
async function syncReminder(){
  const ln=nativeLN();if(!ln) return;
  try{
    await ln.cancel({notifications:[{id:REMIND_ID}]});
    if(!document.hidden||!notifOn()||(await notifPermission())!=='granted') return;
    const n=badgeCounts().brouillons;if(!n) return;
    await ln.schedule({notifications:[{id:REMIND_ID,title:'Vos brouillons vous attendent',body:n>1?'Vous avez '+n+' documents en cours. Reprenez votre travail dans JuriskPro.':'Vous avez un document en cours. Reprenez votre travail dans JuriskPro.',schedule:{at:new Date(Date.now()+24*3600*1000),allowWhileIdle:true},extra:{url:'#brouillons'}}]});
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{syncReminder();});
/* Nouveaux modèles : une seule notification par série de nouveautés. */
async function notifyNewModels(){
  if(!newModelIds.length||!notifOn()) return;
  const sig=newModelIds.slice().sort().join(',');
  if(store.get(NOTIF_MODELS_KEY)===sig) return;
  if(await notify(newModelIds.length>1?newModelIds.length+' nouveaux modèles disponibles':'Un nouveau modèle est disponible','Ouvrez l’onglet Modèles pour le découvrir.','#modeles','new-models')) store.set(NOTIF_MODELS_KEY,sig);
}
try{const ln=nativeLN();if(ln&&ln.addListener) ln.addListener('localNotificationActionPerformed',e=>{const u=e&&e.notification&&e.notification.extra&&e.notification.extra.url;if(u) location.hash=String(u).replace(/^.*#/,'');});}catch(e){}

/* ---------- Avatars (dessins originaux) : trois femmes, trois hommes ---------- */
const AVATARS=[
  {id:'f1',t:'Avatar femme 1',bg:'#f8c9d8',skin:'#8d5524',hair:'#1a1a1a',cloth:'#c2185b',style:'long'},
  {id:'f2',t:'Avatar femme 2',bg:'#ffe7a8',skin:'#c68642',hair:'#1a1a1a',cloth:'#1565c0',style:'wrap',wrap:'#f4b400'},
  {id:'f3',t:'Avatar femme 3',bg:'#cfe9d0',skin:'#5c3a21',hair:'#111',cloth:'#2e7d32',style:'afro'},
  {id:'m1',t:'Avatar homme 1',bg:'#c6def7',skin:'#8d5524',hair:'#111',cloth:'#0b6b4c',style:'short'},
  {id:'m2',t:'Avatar homme 2',bg:'#ffdcb0',skin:'#5c3a21',hair:'#111',cloth:'#6a1b9a',style:'short',beard:true},
  {id:'m3',t:'Avatar homme 3',bg:'#d9cdf0',skin:'#c68642',hair:'#222',cloth:'#ef6c00',style:'afro'}
];
function avatarSVG(av){
  const h=av.hair,sk=av.skin;let back='',front='';
  if(av.style==='long'){back='<path d="M17 31C15 8 49 8 47 31L49 54H15Z" fill="'+h+'"/>';front='<path d="M21 25C24 13 40 13 43 25C38 20 26 20 21 25Z" fill="'+h+'"/>';}
  else if(av.style==='afro'){back='<ellipse cx="32" cy="23" rx="16" ry="16" fill="'+h+'"/>';front='<path d="M21 25C24 17 40 17 43 25C38 22 26 22 21 25Z" fill="'+h+'"/>';}
  else if(av.style==='wrap'){back='<path d="M18 31C16 10 48 10 46 31L47 50H17Z" fill="'+h+'"/>';front='<path d="M20 26C19 11 45 11 44 26C40 20 24 20 20 26Z" fill="'+av.wrap+'"/><circle cx="41" cy="14" r="5" fill="'+av.wrap+'"/>';}
  else {front='<path d="M21 27C20 12 44 12 43 27C40 20 24 20 21 27Z" fill="'+h+'"/>';}
  const beard=av.beard?'<path d="M21.5 30C22 43 42 43 42.5 30C39 37 25 37 21.5 30Z" fill="'+h+'"/>':'';
  return '<svg class="av-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" fill="'+av.bg+'"/>'+back+'<path d="M8 64C8 49 20 43 32 43S56 49 56 64Z" fill="'+av.cloth+'"/><rect x="27" y="35" width="10" height="10" rx="3" fill="'+sk+'"/><ellipse cx="32" cy="28" rx="11" ry="13" fill="'+sk+'"/>'+beard+front+'<circle cx="27.5" cy="28" r="1.4" fill="#1b1b1b"/><circle cx="36.5" cy="28" r="1.4" fill="#1b1b1b"/><path d="M28.5 34Q32 37 35.5 34" fill="none" stroke="#1b1b1b" stroke-width="1.3" stroke-linecap="round"/></svg>';
}
/* Avatar par défaut : toujours un avatar, choisi de façon stable à partir de l'adresse e-mail. */
function avatarIdFor(acc){
  const ok=id=>AVATARS.some(x=>x.id===id);
  if(acc&&ok(acc.avatar)) return acc.avatar;
  const k=String((acc&&(acc.email||acc.username||acc.name))||'').toLowerCase();let n=0;
  for(let i=0;i<k.length;i++) n=(n*31+k.charCodeAt(i))>>>0;
  return AVATARS[n%AVATARS.length].id;
}
function avatarMarkup(acc,cls){
  if(acc&&acc.photo) return '<img class="'+(cls||'av-img')+'" src="'+acc.photo+'" alt="">';
  const id=avatarIdFor(acc);return avatarSVG(AVATARS.find(x=>x.id===id));
}
/* Au démarrage : on mémorise l'identité du compte connecté (pour l'avatar de l'en-tête) et on la rafraîchit. */
async function syncAccountFromSession(){
  try{
    const auth=window.JuriskProAuth;if(!auth||!auth.getClient||!auth.getClient()) return;
    const {data}=await auth.getClient().auth.getUser();const u=data&&data.user;if(!u) return;
    const meta=u.user_metadata||{};let loc=accountRead()||{};
    if(loc.email&&loc.email!==u.email) loc={};
    const merged=Object.assign({},loc,{email:u.email||'',name:meta.full_name||meta.name||loc.name||u.email||'',username:meta.username||loc.username||(u.email||'').split('@')[0],avatar:meta.avatar_id||loc.avatar||''});
    accountSave(merged);
    const a=document.querySelector('.top-actions a[href="#compte"]');if(a) a.innerHTML=avatarMarkup(merged,'top-profile-img');
  }catch(e){}
}

/* ---------- Structure commune : en-tête, contenu, barre fixe ---------- */
function shell(active,inner,o){
  o=o||{};
  const brand='<a class="brand" href="#" aria-label="JuriskPro, accueil"><img class="brand-logo" src="./icons/logo-96.webp" alt="" aria-hidden="true"><span class="bn-txt">Jurisk<b>Pro</b></span></a>';
  const left=o.back?'<a class="hd-back" href="'+o.back+'" aria-label="'+esc(o.backLabel||'Retour')+'">'+ico('back',22)+'</a>':'';
  const mid=o.title?'<div class="hd-title"><strong>'+esc(o.title)+'</strong>'+(o.extra||'')+'</div>':'';
  const nav='<nav class="nav-d" aria-label="Rubriques">'+NAV.map(n=>'<a href="'+n.h+'"'+(n.id===active?' aria-current="page"':'')+'>'+n.t+'</a>').join('')+'</nav>';
  const bar='<nav class="bnav" aria-label="Navigation principale">'+NAV.map(n=>'<a href="'+n.h+'"'+(n.id===active?' aria-current="page"':'')+'>'+ico(n.id,22)+'<span>'+n.t+'</span></a>').join('')+'</nav>';
  const acc=accountRead();
  const avatar=avatarMarkup(acc,'top-profile-img');
  const actions='<div class="top-actions"><button type="button" class="top-icon-btn" id="theme" aria-label="Basculer entre le thème sombre et clair" title="Thème sombre / clair"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg></button><a class="top-icon-btn" href="#compte" aria-label="Ouvrir mon profil" title="Mon profil">'+avatar+'</a></div>';
  /* La barre du bas n'est pas reconstruite à chaque écran : seul l'onglet actif change (moins de clignotement, plus rapide). */
  const oldBar=app.querySelector('.bnav');if(oldBar) oldBar.remove();
  app.innerHTML='<a class="skip-link" href="#main">Aller au contenu principal</a><div class="wrap'+(o.cls?' '+o.cls:'')+'"><header class="top">'+left+brand+mid+nav+actions+'</header><main id="main" tabindex="-1">'+inner+'</main></div>';
  if(oldBar){app.appendChild(oldBar);const cur=NAV.map(n=>n.id).indexOf(active);oldBar.querySelectorAll('a').forEach((a,i)=>{if(i===cur) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');});}
  else app.insertAdjacentHTML('beforeend',bar);
  if(ui.anim){const w=app.querySelector('.wrap');if(w){w.classList.add('enter','dir-'+ui.anim);setTimeout(()=>{w.classList.remove('enter','dir-fwd','dir-back','dir-fade');},700);}ui.anim=null;}
  const t=$('#theme');if(t) t.onclick=()=>{toggleTheme();};
  updateBadges();
}
function leave(){flushSave();M=null;S=null;}
let lastH=null;
let pendingOpen=null;

/* ---------- Routage ---------- */
/* Types d'écran à partir de l'adresse. Un identifiant de modèle n'a pas besoin d'être connu à l'avance. */
const RESERVED=['','modeles','notaires','brouillons','historique','controle','compte'];
function parseRoute(h){
  let m;
  if((m=/^m\/(.+)$/.exec(h))) return {t:'detail',id:m[1]};
  if((m=/^modeles\/([\w-]+)$/.exec(h))) return {t:'fam',id:m[1]};
  if(h==='notaires') return {t:'fam',id:'notaires'};
  if(RESERVED.indexOf(h)>-1) return {t:h===''?'home':h};
  return {t:'model',id:h};
}
/* Profondeur d'un écran : sert à choisir le sens de l'animation (avancer = glisse depuis la droite, reculer = depuis la gauche). */
function depthOf(h){const r=parseRoute(h);return r.t==='model'?3:(r.t==='detail'||r.t==='fam')?2:1;}
function route(){
  const h=(location.hash||'').replace(/^#/,'');
  if(h!==lastH){ui.armed='';ui.anim=lastH===null?'fade':(depthOf(h)>depthOf(lastH)?'fwd':depthOf(h)<depthOf(lastH)?'back':'fade');lastH=h;}
  const r=parseRoute(h);
  if((r.t==='model'||r.t==='detail')&&!FULL[r.id]){
    document.body.classList.add('jp-busy');
    (async()=>{
      if(!(await modelExists(r.id))) return 'absent';
      await loadModels([r.id]);
      const nx=FULL[r.id]&&FULL[r.id].next;if(nx) await Cat.index().catch(()=>{});
      return 'ok';
    })().then(st=>{
      document.body.classList.remove('jp-busy');
      if((location.hash||'').replace(/^#/,'')!==h) return;
      if(st==='absent'||!FULL[r.id]){try{history.replaceState(null,'',location.pathname);}catch(e){}lastH='';routeNow('',{t:'home'});return;}
      routeNow(h,r);
    },()=>{
      document.body.classList.remove('jp-busy');
      setTitle('Connexion lente');
      app.innerHTML='<div class="wrap"><main id="main" tabindex="-1"><section class="empty-state"><h1>Chargement impossible</h1><p>Le modèle n’a pas pu être téléchargé. Vérifiez votre connexion Internet, puis réessayez. Vos brouillons ne sont pas supprimés.</p><p><button type="button" class="btn" id="jp-retry">Réessayer</button> <a class="btn ghost" href="#">Accueil</a></p></section></main></div>';
      const b=$('#jp-retry');if(b)b.onclick=route;
    });
    return;
  }
  routeNow(h,r);
}
function routeNow(h,r){
  try{
    switch(r.t){
      case 'detail': openDetail(FULL[r.id]);break;
      case 'model': openModel(FULL[r.id]);break;
      case 'fam': openFamily(r.id);markModelsSeen();break;
      case 'modeles': openLibrary();markModelsSeen();break;
      case 'brouillons': openDrafts();break;
      case 'historique': openHistory();break;
      case 'controle': openControl();break;
      case 'compte': openAccount();break;
      default: openHome();
    }
  }catch(err){
    console.error('Erreur de navigation JuriskPro :',err);
    setTitle('Erreur');
    app.innerHTML='<div class="wrap"><main id="main" tabindex="-1"><section class="empty-state"><h1>Impossible d’afficher cet écran</h1><p>Vos brouillons déjà enregistrés ne sont pas supprimés. Revenez à l’accueil ou rechargez l’application.</p><div class="cta-row"><a class="btn" href="#">Retour à l’accueil</a><button class="btn ghost" type="button" onclick="location.reload()">Recharger</button></div></section></main></div>';
  }
  window.scrollTo(0,0);
  const main=$('#main');if(main&&document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.bnav,.nav-d')){try{main.focus({preventScroll:true});}catch(e){main.focus();}}
}
window.addEventListener('hashchange',route);
/* Dès que le doigt ou la souris touche un modèle, on commence à le télécharger : à l'ouverture, il est déjà là. */
(function(){
  const warm=e=>{const a=e.target&&e.target.closest&&e.target.closest('a[href^="#"]');if(!a) return;const h=a.getAttribute('href').slice(1),r=parseRoute(h);if(r.t==='detail'||r.t==='model') prefetchModel(r.id);};
  document.addEventListener('touchstart',warm,{passive:true,capture:true});
  document.addEventListener('pointerover',e=>{if(e.pointerType==='mouse') warm(e);},{passive:true,capture:true});
  warmCatalogue();
  computeNewModels();
})();
function go(h){if(location.hash==='#'+h) route(); else location.hash=h;}
function openWith(id,step,jump){pendingOpen={id:id,step:step,jump:jump};go(id);}

/* ============================================================
   ÉCRAN 1 : ACCUEIL
   ============================================================ */
function famShortcuts(){
  return CAT_FAMILIES.filter(f=>f.count>0).slice(0,4).map((f,i)=>
    '<a class="short home-short" href="#modeles/'+f.id+'"><span class="short-icon">'+(i%2?ICON_SCALE:ICON_DOC)+'</span><span class="short-copy"><strong>'+esc(f.titre)+'</strong><span>'+plural(f.count,'modèle','modèles')+'. '+esc(f.aide)+'</span></span><span class="short-arrow">↗</span></a>').join('');
}
function openHome(){
  leave();setTitle('');
  const ds=draftsList(),recent=ds.slice(0,2);
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
    '<section class="block home-library" aria-labelledby="h-fam"><div class="cat-h"><div><p class="eyebrow">BIBLIOTHÈQUE</p><h2 id="h-fam">Par où commencer ?</h2></div><a href="#modeles">Tous les modèles →</a></div><div class="shortcuts">'+famShortcuts()+'</div></section>'+
    '<section class="home-bottom"><div><span class="home-bottom-icon">✓</span><p><b>Des modèles révisés par un juriste qualifié</b><small>Tous les modèles publiés sur JuriskPro ont été révisés par un juriste qualifié. Les contrôles automatiques aident à repérer certains champs manquants et certaines incohérences. Faites vérifier le document avant signature.</small></p></div><div class="home-total"><b>'+CAT_FAMILIES.reduce((n,f)=>n+f.count,0)+'</b><span>modèles disponibles</span></div></section>'+
    '<footer class="foot">Votre compte et votre historique sont associés à votre compte personnel. Les brouillons de saisie restent locaux à cet appareil.</footer>');
  $('#hq').addEventListener('submit',e=>{e.preventDefault();ui.q=$('#q').value;go('modeles');});
  bindDrafts($('#main'));
  upgradeDrafts().then(ch=>{if(ch&&!(location.hash||'').replace(/^#/,'')) openHome();});
}
function paintPaths(){
  const el=$('#paths');if(!el) return;
  el.innerHTML='<div class="block"><div class="cat-h"><h2>Parcours</h2><span>Les actes à enchaîner pour une même opération</span></div>'+
   PARCOURS.map(p=>'<div class="path"><h3>'+esc(p.titre)+'</h3><p>Dans cet ordre.</p><ol>'+p.etapes.map(e=>'<li><strong>'+esc(e.t)+'</strong><span>'+esc(e.d)+'</span><span class="lk">'+e.ids.map(id=>{return '<a href="#m/'+id+'">'+esc(Cat.titleSync(id).replace(/^Statuts de /,''))+'</a>';}).join('')+'</span></li>').join('')+'</ol></div>').join('')+
   '<p class="soon">D’autres modèles seront ajoutés ici : procès-verbaux, cessions de parts, statuts de SAS.</p></div>';
}

/* ---------- Carte de brouillon (accueil, brouillons) ---------- */
function draftHTML(x,full){
  const head=(x.meta&&x.meta.headline)||'',an=x.meta&&x.meta.n?{secs:{length:x.meta.n},done:x.meta.done,missAll:x.meta.missAll}:null;
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
/* Maquette « JuriskPro Model Library » : titre, recherche + filtre, catégories défilantes, bascule « Derniers ajouts / Modèles populaires », cartes avec étoile et étiquettes. */
const ICON_FILTER='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/></svg>';
const STAR_PATH='M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z';
const STAR_ON='<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="'+STAR_PATH+'"/></svg>';
const STAR_OFF='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="'+STAR_PATH+'"/></svg>';
const ICON_NEXT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/* Favoris et usage : propres à cet appareil (localStorage, jamais bloquant). */
const FAV_KEY='juriskpro:favs',USE_KEY='juriskpro:usage';
function readJSON(k,d){try{const v=JSON.parse(store.get(k)||'null');return v==null?d:v;}catch(e){return d;}}
const favList=()=>{const l=readJSON(FAV_KEY,[]);return Array.isArray(l)?l:[];};
const isFav=id=>favList().indexOf(id)>-1;
function toggleFav(id){const l=favList(),i=l.indexOf(id);if(i>-1) l.splice(i,1); else l.unshift(id);store.set(FAV_KEY,JSON.stringify(l));return i<0;}
function bumpUsage(id){const u=readJSON(USE_KEY,{});if(!u||typeof u!=='object') return;u[id]=(u[id]||0)+1;store.set(USE_KEY,JSON.stringify(u));}

/* « #CôteDIvoire », « #1-à-10-associés » : étiquette d'affichage d'une carte. */
function hashtag(t){
  const words=String(t).replace(/[’']/g,' ').split(/\s+/).filter(Boolean);
  const s=/\d/.test(t)?words.map((w,i)=>i?w.toLowerCase():w).join('-'):words.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');
  return '#'+s;
}
const famShort=id=>{const f=Cat.family(id);return f?(f.court||f.titre):'';};
const famLabel=id=>{const f=Cat.family(id);return f?f.titre:'';};

/* État de l'écran Modèles (gardé tant que l'application reste ouverte). */
ui.lb=ui.lb||{cat:'',tab:'new',fav:false,dur:'',tag:'',shown:30,panel:false};
let searchSeq=0,qTimer=0,lbData=null;
const lbFilterCount=()=>{const L=ui.lb;return (L.fav?1:0)+(L.dur?1:0)+(L.tag?1:0);};

function openLibrary(){
  leave();setTitle('Modèles');
  const L=ui.lb;
  const puces=CAT_PUCES.map(id=>{const f=CAT_FAMILIES.find(x=>x.id===id&&x.count>0),r=CAT_RUBRIQUES.find(x=>x.id===id&&x.ids.length);return f?{id:id,t:f.court||f.titre}:r?{id:id,t:r.court}:null;}).filter(Boolean);
  const chips='<button type="button" class="lb-chip" data-cat="" aria-pressed="'+(!L.cat)+'">Tous</button>'+
    puces.map(c=>'<button type="button" class="lb-chip" data-cat="'+c.id+'" aria-pressed="'+(L.cat===c.id)+'">'+esc(c.t)+'</button>').join('');
  shell('modeles',
    '<div class="lb-head"><h1>JuriskPro</h1><p>JuriskPro Model Library</p></div>'+
    '<div class="lb-sticky">'+
      '<div class="lb-searchrow">'+
        '<div class="lb-search"><label class="sr" for="q">Recherche de modèles</label>'+ICON_SEARCH+'<input id="q" type="search" enterkeyhint="search" placeholder="Recherche de modèles…" autocomplete="off" value="'+esc(ui.q)+'"></div>'+
        '<button type="button" class="lb-filter" id="lb-filter" aria-label="Filtres" aria-expanded="'+!!L.panel+'" aria-controls="lb-panel">'+ICON_FILTER+'<span class="lb-dot" id="lb-dot" hidden></span></button>'+
      '</div>'+
      '<div class="lb-panel" id="lb-panel"'+(L.panel?'':' hidden')+'>'+
        '<label class="lb-check"><input type="checkbox" id="lb-fav"'+(L.fav?' checked':'')+'> <span>Mes favoris uniquement</span></label>'+
        '<label class="lb-sel"><span>Durée de remplissage</span><select id="lb-dur"><option value="">Toutes</option><option value="s">10 min ou moins</option><option value="m">De 10 à 20 min</option><option value="l">Plus de 20 min</option></select></label>'+
        '<label class="lb-sel"><span>Étiquette</span><select id="lb-tag"><option value="">Toutes</option></select></label>'+
        '<button type="button" class="linkbtn" id="lb-reset">Réinitialiser les filtres</button>'+
      '</div>'+
      '<div class="lb-chiprow"><div class="lb-chips" id="lb-chips" role="group" aria-label="Catégories">'+chips+'</div><button type="button" class="lb-next" id="lb-next" aria-label="Catégories suivantes">'+ICON_NEXT+'</button></div>'+
      '<div class="lb-tabs" id="lb-tabs" role="tablist" aria-label="Classement des modèles">'+
        '<button type="button" role="tab" class="lb-tab" data-tab="new" aria-selected="'+(L.tab==='new')+'">Derniers ajouts</button>'+
        '<button type="button" role="tab" class="lb-tab" data-tab="pop" aria-selected="'+(L.tab==='pop')+'">Modèles populaires</button>'+
      '</div>'+
    '</div>'+
    '<div id="catalog" aria-live="polite"></div>',{cls:'lb'});
  $('#lb-dur').value=L.dur;
  $('#q').addEventListener('input',e=>{
    ui.q=e.target.value;const box=e.target.closest('.lb-search');
    if(box) box.classList.add('loading');
    clearTimeout(qTimer);qTimer=setTimeout(()=>{ui.lb.shown=30;paintLibrary();},220);
  });
  $('#lb-filter').onclick=()=>{L.panel=!L.panel;$('#lb-panel').hidden=!L.panel;$('#lb-filter').setAttribute('aria-expanded',String(L.panel));};
  $('#lb-fav').onchange=e=>{L.fav=e.target.checked;L.shown=30;paintLibrary();};
  $('#lb-dur').onchange=e=>{L.dur=e.target.value;L.shown=30;paintLibrary();};
  $('#lb-tag').onchange=e=>{L.tag=e.target.value;L.shown=30;paintLibrary();};
  $('#lb-reset').onclick=()=>{L.fav=false;L.dur='';L.tag='';L.shown=30;$('#lb-fav').checked=false;$('#lb-dur').value='';$('#lb-tag').value='';paintLibrary();};
  $$('.lb-chip').forEach(b=>b.onclick=()=>{
    L.cat=b.dataset.cat;L.shown=30;
    $$('.lb-chip').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    try{b.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});}catch(e){}
    paintLibrary();
  });
  $$('.lb-tab').forEach(b=>b.onclick=()=>{
    L.tab=b.dataset.tab;L.shown=30;
    $$('.lb-tab').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
    paintLibrary();
  });
  const row=$('#lb-chips'),nx=$('#lb-next'),rowBox=row.parentNode;
  const sync=()=>{rowBox.classList.toggle('at-end',row.scrollLeft+row.clientWidth>=row.scrollWidth-4);rowBox.classList.toggle('no-scroll',row.scrollWidth<=row.clientWidth+2);};
  row.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',sync);
  nx.onclick=()=>{try{row.scrollBy({left:Math.max(120,row.clientWidth*.7),behavior:'smooth'});}catch(e){row.scrollLeft+=row.clientWidth*.7;}};
  requestAnimationFrame(sync);
  paintLibrary();
}

/* Classement. « Derniers ajouts » : date d'ajout décroissante (modèles sans date en fin). « Populaires » : sélection éditoriale
   (models/library.json) à laquelle s'ajoutent les modèles que vous ouvrez le plus sur cet appareil. */
function lbSort(list,tab){
  const use=readJSON(USE_KEY,{})||{};
  const t=(a,b)=>a.titre.localeCompare(b.titre,'fr');
  if(tab==='pop'){
    const sc=m=>(use[m.id]||0)*4+(m.pop?11-Math.min(m.pop,10):0);
    return list.slice().sort((a,b)=>sc(b)-sc(a)||t(a,b));
  }
  return list.slice().sort((a,b)=>String(b.ajout||'').localeCompare(String(a.ajout||''))||t(a,b));
}
function lbFilter(list){
  const L=ui.lb,favs=L.fav?new Set(favList()):null;
  return list.filter(m=>{
    if(L.cat){const r=CAT_RUBRIQUES.find(x=>x.id===L.cat);if(r){if(r.ids.indexOf(m.id)<0) return false;}else if(m.cat!==L.cat) return false;}
    if(favs&&!favs.has(m.id)) return false;
    if(L.dur){const n=parseInt(m.duree,10)||0;if(L.dur==='s'&&n>10) return false;if(L.dur==='m'&&(n<=10||n>20)) return false;if(L.dur==='l'&&n<=20) return false;}
    if(L.tag&&!(m.etiq||[]).some(x=>x===L.tag)) return false;
    return true;
  });
}
function lbFillTags(all){
  const sel=$('#lb-tag');if(!sel) return;
  const L=ui.lb,count={};
  all.forEach(m=>(m.etiq||[]).forEach(t=>{count[t]=(count[t]||0)+1;}));
  const tags=Object.keys(count).sort((a,b)=>count[b]-count[a]||a.localeCompare(b,'fr')).slice(0,40);
  sel.innerHTML='<option value="">Toutes</option>'+tags.map(t=>'<option value="'+esc(t)+'">'+esc(hashtag(t))+' ('+count[t]+')</option>').join('');
  sel.value=tags.indexOf(L.tag)>-1?L.tag:'';if(sel.value!==L.tag) L.tag=sel.value;
}
function paintLibrary(){
  const el=$('#catalog');if(!el) return;
  const box=$('.lb-search'),L=ui.lb,q=ui.q.trim(),stop=()=>{if(box) box.classList.remove('loading');};
  const my=++searchSeq;
  const dot=$('#lb-dot');if(dot){const n=lbFilterCount();dot.hidden=!n;dot.textContent=n;}
  const tabs=$('#lb-tabs');if(tabs) tabs.classList.toggle('muted',!!q);
  if(!lbData) el.innerHTML=SKEL(4);
  Promise.all([Cat.all(),q?Cat.search(q):null]).then(([all,res])=>{
    if(my!==searchSeq||!$('#catalog')) return;
    lbData=all;lbFillTags(all);
    let list;
    if(res){const by={};all.forEach(m=>{by[m.id]=m;});list=lbFilter(res.map(r=>by[r.id]).filter(Boolean));}
    else list=lbSort(lbFilter(all),L.tab);
    ui.lbList=list;
    el.innerHTML=lbListHTML(q);bindLibraryList();stop();
  }).catch(()=>{
    if(my!==searchSeq||!$('#catalog')) return;
    el.innerHTML='<p class="msg err" role="status">La bibliothèque n’est pas disponible pour le moment. Vérifiez votre connexion puis réessayez.</p><p><button type="button" class="btn ghost" id="lb-retry">Réessayer</button></p>';
    const r=$('#lb-retry');if(r) r.onclick=paintLibrary;stop();
  });
}
function lbListHTML(q){
  const list=ui.lbList,L=ui.lb,n=Math.min(L.shown,list.length),filtered=lbFilterCount()>0||L.cat;
  if(!list.length){
    if(L.fav&&!q&&!L.cat&&!L.dur&&!L.tag) return '<p class="empty" role="status">Aucun favori pour le moment. Touchez l’étoile d’un modèle pour le retrouver ici.</p>';
    return '<p class="empty" role="status">'+(q?'Aucun modèle ne correspond à « '+esc(q)+' »'+(filtered?' avec ces filtres':'')+'. Essayez un mot plus court (« statuts », « bail », « vente »).':'Aucun modèle ne correspond à ces filtres.')+'</p><p><button type="button" class="linkbtn" id="lb-clear">'+(q?'Effacer la recherche':'Réinitialiser les filtres')+'</button></p>';
  }
  return (q||filtered?'<p class="count" role="status">'+plural(list.length,'modèle','modèles')+'</p>':'')+
    '<div class="lb-list">'+list.slice(0,n).map(m=>cardHTML(m,false)).join('')+'</div>'+
    (n<list.length?'<div class="more-wrap"><button type="button" class="btn ghost" id="lb-more">Afficher plus ('+(list.length-n)+' restants)</button></div>':'');
}
function bindLibraryList(){
  const el=$('#catalog'),c=$('#lb-clear'),b=$('#lb-more'),L=ui.lb;
  if(c) c.onclick=()=>{
    if(ui.q.trim()){ui.q='';const q=$('#q');if(q) q.value='';}
    else{L.fav=false;L.dur='';L.tag='';$('#lb-fav').checked=false;$('#lb-dur').value='';$('#lb-tag').value='';}
    paintLibrary();
  };
  if(b){
    const more=()=>{L.shown+=30;el.innerHTML=lbListHTML(ui.q.trim());bindLibraryList();};
    b.onclick=more;
    if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();if($('#lb-more')===b) more();}},{rootMargin:'300px'});io.observe(b);}
  }
  const idle=window.requestIdleCallback||(fn=>setTimeout(fn,600));
  idle(()=>(ui.lbList||[]).slice(0,4).forEach(m=>prefetchModel(m.id)));
}
/* Étoile : un seul écouteur pour tous les écrans qui affichent des cartes. */
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-fav]');if(!b) return;
  e.preventDefault();e.stopPropagation();
  const id=b.dataset.fav,on=toggleFav(id),m=Cat.meta(id),t=m?m.titre:'ce modèle';
  b.setAttribute('aria-pressed',String(on));b.innerHTML=on?STAR_ON:STAR_OFF;
  b.setAttribute('aria-label',(on?'Retirer « ':'Ajouter « ')+t+(on?' » des favoris':' » aux favoris'));
  b.classList.toggle('on',on);
  if(!on&&ui.lb.fav&&$('#catalog')&&$('.lb-list')){ui.lbList=(ui.lbList||[]).filter(x=>x.id!==id);const el=$('#catalog');el.innerHTML=lbListHTML(ui.q.trim());bindLibraryList();}
},true);
/* Page d'une famille : les modèles arrivent 40 par 40 (défilement ou bouton). */
let famToken=0;
function openFamily(fid){
  const f=Cat.family(fid);if(!f){openLibrary();return;}
  leave();setTitle(f.titre);
  shell('modeles','<div class="page-h"><h1>'+esc(f.titre)+'</h1><p>'+esc(f.aide)+'</p></div><p class="count" role="status">'+plural(f.count,'modèle','modèles')+'</p><div id="famlist"></div><div id="fammore" class="more-wrap"></div>',{back:'#modeles',backLabel:'Tous les modèles'});
  famPage(f,1);
}
function famPage(f,n){
  const my=++famToken,list=$('#famlist'),more=$('#fammore');if(!list) return;
  if(n===1) list.innerHTML=SKEL(3);
  more.innerHTML='';
  Cat.page(f.id,n).then(items=>{
    if(my!==famToken||!$('#famlist')) return;
    if(n===1) list.innerHTML='<div class="lb-list" id="famgrid"></div>';
    const grid=$('#famgrid');let last=grid.dataset.sub||'',h='';
    items.forEach(m=>{if(m.sub&&m.sub!==last){h+='<h3 class="sub-h fam-sub">'+esc(m.sub)+'</h3>';last=m.sub;}h+=cardHTML(m,false);});
    grid.dataset.sub=last;grid.insertAdjacentHTML('beforeend',h);
    const idle=window.requestIdleCallback||(fn=>setTimeout(fn,600));idle(()=>items.slice(0,6).forEach(m=>prefetchModel(m.id)));
    if(n<f.pages){
      const left=Math.max(0,f.count-n*CAT_PAGE);
      more.innerHTML='<button type="button" class="btn ghost" id="more">Afficher plus ('+left+' restants)</button>';
      const next=()=>famPage(f,n+1);
      $('#more').onclick=next;
      if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();if(my===famToken) next();}},{rootMargin:'300px'});io.observe($('#more'));}
    }
  }).catch(()=>{
    if(my!==famToken) return;
    (n===1?list:more).innerHTML='<p class="msg err" role="status">Impossible de charger cette liste. Vérifiez votre connexion.</p><p><button type="button" class="btn ghost" id="retry">Réessayer</button></p>';
    const r=$('#retry');if(r) r.onclick=()=>famPage(f,n);
  });
}
function cardHTML(m,withFam){
  const hasDraft=store.get(draftKey(m.id))!==null,fav=isFav(m.id),t=esc(m.titre);
  const tags=(m.etiq||[]).slice(0,4).map(x=>'<li>'+esc(hashtag(x))+'</li>').join('');
  return '<article class="lb-card"><span class="lb-ico" aria-hidden="true">'+ICON_DOC+'</span><div class="lb-body"><h3><a href="#m/'+m.id+'">'+t+'</a></h3>'+
    (tags?'<ul class="lb-tags" aria-label="Étiquettes">'+tags+'</ul>':'')+
    (hasDraft?'<span class="pill lb-draft">Brouillon en cours</span>':'')+'</div>'+
    '<button type="button" class="lb-star'+(fav?' on':'')+'" data-fav="'+m.id+'" aria-pressed="'+fav+'" aria-label="'+(fav?'Retirer « ':'Ajouter « ')+t+(fav?' » des favoris':' » aux favoris')+'">'+(fav?STAR_ON:STAR_OFF)+'</button></article>';
}
/* ============================================================
   ÉCRAN 3 : DÉTAIL DU MODÈLE
   ============================================================ */
function openDetail(m){
  leave();setTitle(m.titre);
  const cat=CATS.find(c=>c.id===m.cat),d=readDraft(m.id);
  const secs=m.etapes.filter(e=>!e.final);
  const sourcePdf=m.sourceTemplate&&m.sourceTemplate.file?String(m.sourceTemplate.file).replace(/\.docx$/i,'.pdf')+'?v='+encodeURIComponent(m.sourceTemplate.version||'1'):'';
  /* Modèles sans fichier Word source : extrait du début du document, rempli avec les données d'exemple. */
  let extrait='';
  if(!sourcePdf){
    try{
      const ex=Object.assign(m.defaults(),JSON.parse(JSON.stringify(m.exemple)),{date:todayISO()});
      const V=m.compute(ex),bl=m.blocks(ex,V);
      extrait=renderHTML(bl.slice(0,18),V).html;
    }catch(e){extrait='';}
  }
  shell('modeles',
    '<article class="detail"><p class="mcat">'+esc(cat.titre)+'</p><h1>'+esc(m.titre)+'</h1><p class="msub">'+esc(m.sous)+'</p>'+
    '<p class="lead2">'+esc(m.resume)+'</p>'+
    '<ul class="tags">'+m.tags.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>'+
    '<dl class="facts"><div><dt>Durée indicative</dt><dd>'+esc(m.duree)+'</dd></div><div><dt>Sections à remplir</dt><dd>'+secs.length+'</dd></div><div><dt>Exports</dt><dd>'+(sourcePdf?'Word (mise en page d’origine) et PDF':'Word (.docx) et PDF')+'</dd></div></dl>'+
    (d?'<p class="status-line warn"><strong>Un brouillon existe</strong> pour ce modèle, modifié le '+esc(fmtWhen(d.t))+'.</p>':'')+
    '<div class="cta-row"><a class="btn big" href="#'+m.id+'">'+(d?'Reprendre le brouillon':'Utiliser ce modèle')+'</a></div>'+
    '<section class="block"><h2>Ce que vous allez renseigner</h2><ol class="secs">'+secs.map(e=>'<li><strong>'+esc(e.titre)+'</strong>'+(e.intro?'<span>'+esc(e.intro)+'</span>':'')+'</li>').join('')+'</ol></section>'+
    (extrait?'<section class="block"><h2>Aperçu</h2><p class="note">Début du document, rempli avec les données d’exemple du modèle (non reprises dans votre brouillon).</p><div class="sheet-scroll"><div class="sheet sheet-ex" aria-label="Extrait du document">'+extrait+'</div></div></section>':'')+
    (sourcePdf?'<section class="block"><h2>Aperçu intégral</h2><p class="note">Toutes les pages de la matrice Word anonymisée. Les zones à compléter apparaissent en pointillés ; vos données seront insérées dans le Word et le PDF téléchargés (le Word garde exactement la mise en page d’origine, le PDF en reprend le texte et la structure).</p><div class="source-preview" data-pdf="./'+esc(sourcePdf)+'"><p class="pv-status" role="status">Chargement de l’aperçu…</p></div><p class="pv-open"><a class="btn ghost" href="./'+esc(sourcePdf)+'" target="_blank" rel="noopener">Ouvrir l’aperçu en PDF</a></p></section>':'')+
    '</article>',
    {back:'#modeles',backLabel:'Retour aux modèles',title:m.titre,cls:'detail-on'});
  renderPdfPreview($('.source-preview'));
}

/* Aperçu PDF page par page (pdf.js) : fonctionne aussi sur Android, où un PDF dans un cadre reste souvent vide.
   Les pages se dessinent à l'approche de l'écran et sont libérées en s'éloignant (économie de mémoire). */
let pdfWorkerSrc=null;
async function pdfWorkerUrl(){
  if(pdfWorkerSrc) return pdfWorkerSrc;
  try{const r=await fetch('./vendor/pdf.worker.js',{method:'HEAD'});if(r.ok){pdfWorkerSrc='./vendor/pdf.worker.js';return pdfWorkerSrc;}}catch(e){}
  pdfWorkerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return pdfWorkerSrc;
}
async function renderPdfPreview(box){
  if(!box) return;
  const url=box.dataset.pdf,status=box.querySelector('.pv-status');
  const fail=()=>{if(status&&box.isConnected) status.textContent='L’aperçu n’a pas pu s’afficher ici. Utilisez le bouton « Ouvrir l’aperçu en PDF » ci-dessous.';};
  let doc=null,io=null;
  try{
    await JPLibs.load('pdfjs');
    const lib=window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc=await pdfWorkerUrl();
    doc=await lib.getDocument({url:url,disableRange:true,disableStream:true,disableAutoFetch:true}).promise;
    if(!box.isConnected){doc.destroy();return;}
    const first=await doc.getPage(1),b1=first.getViewport({scale:1});
    if(status) status.remove();
    const wrap=document.createElement('div');wrap.className='pdf-pages';box.appendChild(wrap);
    const total=doc.numPages,cssW=()=>Math.max(240,wrap.clientWidth||box.clientWidth||320);
    const pages=[];
    for(let i=1;i<=total;i++){
      const d=document.createElement('div');d.className='pdf-page';d.dataset.n=String(i);
      d.style.height=Math.round(cssW()*b1.height/b1.width)+'px';
      d.innerHTML='<span class="pdf-n">Page '+i+' / '+total+'</span>';
      wrap.appendChild(d);pages.push(d);
    }
    const draw=async d=>{
      if(d._busy||d._done||!d.isConnected) return;
      d._busy=true;
      try{
        const n=+d.dataset.n,p=await doc.getPage(n),base=p.getViewport({scale:1});
        const w=d.clientWidth||cssW(),dpr=Math.min(window.devicePixelRatio||1,2);
        const vp=p.getViewport({scale:(w/base.width)*dpr});
        const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
        c.setAttribute('role','img');c.setAttribute('aria-label','Page '+n+' sur '+total+' de l’aperçu');
        await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
        if(!d.isConnected||d._vis===false) return;
        d.style.height=Math.round(w*base.height/base.width)+'px';
        d.appendChild(c);d._done=true;
      }catch(e){}finally{d._busy=false;}
    };
    const free=d=>{const c=d.querySelector('canvas');if(c){c.width=c.height=0;c.remove();}d._done=false;};
    if('IntersectionObserver' in window){
      io=new IntersectionObserver(es=>{
        if(!box.isConnected){io.disconnect();try{doc.destroy();}catch(e){}return;}
        es.forEach(e=>{e.target._vis=e.isIntersecting;if(e.isIntersecting) draw(e.target); else free(e.target);});
      },{rootMargin:'800px 0px'});
      pages.forEach(d=>io.observe(d));
    }else pages.slice(0,6).forEach(draw);
  }catch(e){fail();}
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
  upgradeDrafts().then(ch=>{if(ch&&location.hash==='#brouillons') openDrafts();});
}

/* ============================================================
   HISTORIQUE CLOUD : documents rattachés au compte de l’utilisateur.
   Le stockage local n'est qu'un cache temporaire, jamais la source.
   ============================================================ */
const HISTORY_KEY='juriskpro:history:v1';
function historyClient(){const a=window.JuriskProAuth;return a&&a.getClient?a.getClient():null;}
function messageFr(error,fallback){const raw=String(error&&error.message||error||'').toLowerCase();if(/invalid login credentials|invalid password|wrong password/.test(raw))return 'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants puis réessayez.';if(/permission denied|not authorized|unauthorized|row-level security/.test(raw))return 'Vous n’êtes pas autorisé à effectuer cette opération. Vérifiez votre compte et vos droits d’accès.';if(/network|fetch failed|failed to fetch|load failed/.test(raw))return 'La connexion au service est impossible. Vérifiez votre connexion Internet puis réessayez.';if(/not found|does not exist|no such file/.test(raw))return 'Le document demandé est introuvable.';if(/expired|invalid.*token/.test(raw))return 'Votre session ou ce lien a expiré. Reconnectez-vous puis réessayez.';return fallback||'Une erreur est survenue. Réessayez dans quelques instants.';}
async function historyUser(){const c=historyClient();if(!c)throw new Error('Connexion indisponible.');const {data,error}=await c.auth.getUser();if(error||!data.user)throw new Error('Session expirée. Reconnectez-vous.');return data.user;}
const HIST_PAGE=20;
/* Une page de l'historique, sans le texte complet des documents (chargé à la demande). */
async function historyRead(from){
  const c=historyClient();if(!c)throw new Error('Connexion indisponible.');
  const {data,error}=await c.from('juriskpro_documents').select('id,title,model_id,model_title,format,file_name,storage_path,created_at').order('created_at',{ascending:false}).range(from||0,(from||0)+HIST_PAGE-1);
  if(error)throw error;return data||[];
}
async function historyText(id){
  const c=historyClient();if(!c)throw new Error('Connexion indisponible.');
  const {data,error}=await c.from('juriskpro_documents').select('document_text').eq('id',id).maybeSingle();
  if(error)throw error;return (data&&data.document_text)||'';
}
async function historySave(item,blob){
  histCache=null;
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
  histCache=null;
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
    '<details data-hid="'+esc(x.id)+'"><summary>Consulter le contenu du document</summary><div class="history-content"><pre>'+(x.document_text||x.text?esc(x.document_text||x.text):'Chargement…')+'</pre></div></details>'+
    '<div class="history-actions"><button type="button" class="btn small" data-history-download="'+esc(x.id)+'">Télécharger le fichier</button><a class="btn small ghost" href="#'+esc(x.model_id||x.modelId||'modeles')+'">Reprendre le modèle</a><button type="button" class="btn small ghost danger" data-history-del="'+esc(x.id)+'" data-history-path="'+esc(x.storage_path||'')+'">Supprimer</button></div></article>';
}
const SKEL=n=>'<div class="skel-list" role="status" aria-live="polite"><span class="sr">Chargement en cours…</span>'+Array(n+1).join('<div class="skel" aria-hidden="true"></div>')+'</div>';
let hist={items:[],more:false};
function histHead(p){return '<div class="page-h"><h1>Historique</h1><p>'+p+'</p></div>';}
let histCache=null;
async function openHistory(){
  leave();setTitle('Historique');
  if(histCache){
    /* Réouverture : on affiche tout de suite la dernière liste connue, puis on la rafraîchit discrètement. */
    hist={items:histCache.items.slice(),more:histCache.more};paintHistory();
    historyRead(0).then(first=>{
      if(location.hash!=='#historique') return;
      const key=a=>a.map(x=>x.id).join(',');
      histCache={items:first,more:first.length===HIST_PAGE};
      if(hist.items.length<=HIST_PAGE&&key(first)!==key(hist.items)){hist={items:first,more:first.length===HIST_PAGE};paintHistory();}
    }).catch(()=>{});
    return;
  }
  hist={items:[],more:false};
  shell('historique',histHead('<span class="spin" aria-hidden="true"></span> Chargement de vos documents…')+SKEL(3));
  try{
    const first=await historyRead(0);
    hist.items=first;hist.more=first.length===HIST_PAGE;histCache={items:first.slice(),more:hist.more};
    paintHistory();
  }catch(e){
    shell('historique',histHead('Impossible de charger votre historique.')+'<section class="card set"><p class="msg err">'+esc(messageFr(e,'Vérifiez votre connexion et la configuration de la sauvegarde sécurisée.'))+'</p><p>Vos documents ne sont pas affichés tant que la connexion au stockage sécurisé n’est pas rétablie.</p><button class="btn" type="button" id="history-retry">Réessayer</button></section>');
    const b=$('#history-retry');if(b) b.onclick=openHistory;
  }
}
function paintHistory(){
  const list=hist.items;
  shell('historique',histHead('Vos documents sont enregistrés dans votre compte. Retrouvez-les après connexion depuis un autre téléphone ou ordinateur, puis téléchargez à nouveau les fichiers originaux.')+
    (list.length?'<div class="history-list">'+list.map(historyHTML).join('')+'</div>'+(hist.more?'<div class="more-wrap"><button type="button" class="btn ghost" id="hist-more">Afficher plus de documents</button></div>':''):
      '<div class="empty-state"><p><strong>Aucun document dans votre historique.</strong></p><p>Vos prochaines créations y seront enregistrées automatiquement.</p><a class="btn" href="#modeles">Créer un document</a></div>'));
  const more=$('#hist-more');
  if(more) more.onclick=async()=>{
    more.disabled=true;more.classList.add('is-busy');
    try{const next=await historyRead(hist.items.length);hist.items=hist.items.concat(next);hist.more=next.length===HIST_PAGE;paintHistory();}
    catch(e){alert('Chargement impossible : '+messageFr(e,'Vérifiez votre connexion puis réessayez.'));more.disabled=false;more.classList.remove('is-busy');}
  };
  $$('details[data-hid]').forEach(d=>d.addEventListener('toggle',async()=>{
    if(!d.open||d.dataset.loaded) return;
    d.dataset.loaded='1';
    const pre=d.querySelector('pre'),id=d.dataset.hid;
    try{pre.textContent=(await historyText(id))||'Contenu non disponible';}catch(e){pre.textContent='Contenu indisponible pour le moment.';d.dataset.loaded='';}
  }));
  $$('[data-history-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer définitivement ce document de votre historique ?'))return;b.disabled=true;try{await historyDelete(b.dataset.historyDel,b.dataset.historyPath);await openHistory();}catch(e){alert('Suppression impossible : '+messageFr(e,'Une erreur est survenue lors de la suppression.'));b.disabled=false;}});
  $$('[data-history-download]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const item=hist.items.find(x=>String(x.id)===b.dataset.historyDownload);if(!item||!item.storage_path)throw new Error('Fichier introuvable.');const c=historyClient();const {data,error}=await c.storage.from('juriskpro-documents').createSignedUrl(item.storage_path,60);if(error)throw error;if(isNativeApp()){const resp=await fetch(data.signedUrl);if(!resp.ok)throw new Error('Téléchargement impossible.');await nativeShareBlob(await resp.blob(),item.file_name||'document',item.file_name||'document');}else{const a=document.createElement('a');a.href=data.signedUrl;a.download=item.file_name||'document';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();}}catch(e){alert('Téléchargement impossible : '+messageFr(e,'Une erreur est survenue lors du téléchargement.'));}finally{b.disabled=false;}});
}

/* ============================================================
   ÉCRAN 6 : CONTRÔLE ET ALERTES
   ============================================================ */
function openControl(){
  leave();setTitle('Contrôle');
  const all=draftsList(),lim=ui.ctl||5,ds=all.slice(0,lim);
  const head='<div class="page-h"><h1>Contrôle</h1><p>Vérifications effectuées par l’application sur vos brouillons.</p></div>';
  const note='<p class="note legal">Les contrôles de JuriskPro sont automatiques : ils signalent certains champs laissés en blanc et certaines incohérences détectables (parts, capital, versements…). Ils ne constituent pas une validation juridique et ne vérifient pas que les informations saisies correspondent à votre situation.</p>';
  if(!all.length){
    shell('controle',head+'<div class="empty-state"><p><strong>Rien à contrôler pour le moment.</strong></p><p>Les contrôles portent sur vos brouillons. Commencez un document pour les voir ici.</p><a class="btn" href="#modeles">Choisir un modèle</a></div>'+note);
    return;
  }
  shell('controle',head+SKEL(Math.min(ds.length,3))+note);
  loadModels(ds.map(x=>x.id)).then(()=>{
    if(location.hash!=='#controle') return;
    paintControl(ds,all.length,head,note);
  }).catch(()=>{
    if(location.hash!=='#controle') return;
    shell('controle',head+'<section class="card set"><p class="msg err">Impossible de charger les contrôles. Vérifiez votre connexion.</p><button class="btn" type="button" id="ctl-retry">Réessayer</button></section>'+note);
    const b=$('#ctl-retry');if(b) b.onclick=openControl;
  });
}
function paintControl(ds,total,head,note){
  const body=ds.map(x=>{
    const m=FULL[x.id];if(!m) return '';
    let an=null;try{an=analyse(m,Object.assign(m.defaults(),x.d.v));}catch(e){}
    if(!an) return '';
    let h='<article class="chk"><div><h3>'+esc(m.titre)+'</h3><p class="note">'+esc(m.headline(x.d.v)||'Sans dénomination')+' · modifié le '+esc(fmtWhen(x.d.t))+'</p></div>';
    if(an.probs.length) h+='<div class="al bad" role="group" aria-label="Incohérences"><p class="al-t">À corriger · '+plural(an.probs.length,'incohérence','incohérences')+'</p><ul>'+an.probs.map(p=>'<li><span>'+esc(p.t)+'<small>Section : '+esc(m.etapes[p.step].titre)+'</small></span><button type="button" class="btn small ghost" data-fix="'+m.id+'" data-st="'+p.step+'">Corriger</button></li>').join('')+'</ul></div>';
    if(an.missAll) h+='<div class="al warn" role="group" aria-label="Informations à compléter"><p class="al-t">À examiner · '+plural(an.missAll,'information à compléter','informations à compléter')+'</p><p class="note">Ces blancs apparaissent en pointillés dans le document. Vous pouvez aussi les remplir à la main après impression.</p><ul>'+
      an.miss.slice(0,5).map(id=>'<li><span>'+esc(an.ix[id].label)+'<small>Section : '+esc(m.etapes[an.ix[id].step].titre)+'</small></span><button type="button" class="btn small ghost" data-fix="'+m.id+'" data-fid="'+id+'">Compléter</button></li>').join('')+
      (an.miss.length>5?'<li class="more">… et '+(an.miss.length-5)+' autres, visibles dans la validation finale.</li>':'')+'</ul></div>';
    if(!an.probs.length&&!an.missAll) h+='<div class="al ok"><p class="al-t">Aucun blanc ni incohérence détecté</p><p class="note">Relisez l’aperçu avant de télécharger le document.</p></div>';
    h+='<div class="acts"><button type="button" class="btn small" data-fix="'+m.id+'" data-st="final">Ouvrir la validation finale</button></div></article>';
    return h;
  }).join('');
  shell('controle',head+body+(total>ds.length?'<div class="more-wrap"><button type="button" class="btn ghost" id="ctl-more">Contrôler '+Math.min(5,total-ds.length)+' brouillon'+(total-ds.length>1?'s':'')+' de plus ('+(total-ds.length)+' restants)</button></div>':'')+note);
  $$('[data-fix]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.fix;
    if(b.dataset.fid) openWith(id,null,b.dataset.fid);
    else openWith(id,b.dataset.st==='final'?'final':+b.dataset.st);
  });
  const more=$('#ctl-more');if(more) more.onclick=()=>{ui.ctl=(ui.ctl||5)+5;openControl();};
}

/* ============================================================
   ÉCRAN 10 : COMPTE, PROFIL ET PRÉFÉRENCES
   Authentification et profil via le service de comptes. Les préférences d’interface
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
  shell('compte','<div class="page-h"><h1>Compte &amp; Paramètres</h1><p><span class="spin" aria-hidden="true"></span> Chargement de votre profil…</p></div>'+SKEL(2));
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
        photo:meta.avatar_url||localProfile.photo||'', avatar:meta.avatar_id||localProfile.avatar||'', supabaseUser:true
      };
      renderAccountProfile(profile);
      return;
    }catch(err){
      shell('compte','<div class="page-h"><h1>Compte &amp; Paramètres</h1><p>Impossible de charger votre profil pour le moment.</p></div><section class="card set"><p class="msg err">Vérifiez votre connexion Internet puis rechargez la page.</p></section>');
      return;
    }
  }
  // L’authentification est exclusivement gérée par le service de comptes.
  shell('compte','<div class="page-h"><h1>Compte &amp; Paramètres</h1></div><section class="card set"><p class="msg err">Le service de compte n’est pas disponible. Rechargez la page et vérifiez votre connexion.</p></section>');
}
function renderAccountProfile(a){
  const nbd=draftsList().length,tm=themeMode();
  const notif=notifOn();
  const themeLabel=tm==='dark'?'Sombre':tm==='light'?'Clair':'Automatique';
  const initial=esc((a.name||a.username||'U').trim().charAt(0).toUpperCase());
  const camera='<span class="avatar-camera" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h-4l-2 3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg></span>';
  const CH='<span class="acc-chev" aria-hidden="true"></span>';
  const row=(t,sub,end)=>'<div class="acc-row"><span class="acc-label"><strong>'+t+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</span>'+(end||'')+'</div>';
  const link=(t,href,ext)=>'<a class="acc-row acc-link" href="'+href+'"'+(ext?' target="_blank" rel="noopener"':'')+'><span class="acc-label"><strong>'+t+'</strong></span>'+CH+'</a>';
  shell('compte',
    '<div class="page-h"><h1>Compte</h1></div>'+
    '<section class="acc-top"><button type="button" class="account-avatar acc-avatar" id="avatar-open" aria-expanded="false" aria-controls="avatar-picker" aria-label="Changer d’avatar ou de photo">'+avatarMarkup(a)+camera+'</button><input id="profile-photo-input" type="file" accept="image/*" hidden><div class="acc-id"><h2>'+esc(a.name||a.username)+'</h2><p>'+esc(a.email||'')+'</p></div></section>'+
    '<section class="acc-picker" id="avatar-picker" hidden><p class="acc-picker-t">Choisissez un avatar</p><div class="acc-avs">'+AVATARS.map(x=>'<button type="button" class="acc-av'+(!a.photo&&avatarIdFor(a)===x.id?' is-on':'')+'" data-av="'+x.id+'" aria-label="'+x.t+'" aria-pressed="'+(!a.photo&&avatarIdFor(a)===x.id)+'">'+avatarSVG(x)+'</button>').join('')+'</div><div class="acc-picker-act"><label class="acc-btn" for="profile-photo-input">Choisir une photo</label>'+(a.photo?'<button type="button" class="acc-btn acc-btn-dim" id="profile-photo-remove">Retirer ma photo</button>':'')+'</div></section>'+

    '<h2 class="acc-title">Mon compte</h2><section class="acc-group">'+
      '<details class="acc-item"><summary class="acc-row"><span class="acc-label"><strong>Mon profil</strong><small>Nom, identifiant, coordonnées</small></span>'+CH+'</summary><div class="acc-panel"><form id="acc-profile-form" class="fields">'+
        accountField('prof-name','Nom complet','text',a.name,'Votre nom et prénom',true,'name')+
        accountField('prof-username','Nom d’utilisateur','text',a.username,'Votre identifiant',true,'username')+
        '<div class="field"><label>Adresse e-mail</label><input type="email" value="'+esc(a.email||'')+'" disabled><small class="aide">Elle sert à votre connexion et ne peut pas être modifiée ici.</small></div>'+
        accountField('prof-phone','Téléphone','tel',a.phone,'Facultatif',false,'tel')+
        accountField('prof-city','Ville / pays','text',a.city,'Facultatif',false,'address-level2')+
        accountField('prof-profession','Profession ou activité','text',a.profession,'Facultatif',false,'organization-title')+
        '<div class="tools"><button type="submit" class="btn">Enregistrer</button><span class="msg" id="prof-msg" role="status" aria-live="polite"></span></div></form></div></details>'+
      '<details class="acc-item"><summary class="acc-row"><span class="acc-label"><strong>Sécurité et données</strong><small>Confidentialité de vos informations</small></span>'+CH+'</summary><div class="acc-panel"><p>Vos informations sont personnelles : elles ne sont ni vendues ni rendues publiques, et ne sont communiquées que pour le fonctionnement du service ou si la loi l’exige.</p><p>Choisissez un mot de passe robuste, gardez-le confidentiel et déconnectez-vous sur un appareil partagé.</p><p>Les documents générés et leur historique sont enregistrés dans votre compte. Les brouillons non terminés, les préférences et la photo de profil restent sur cet appareil.</p><p class="msg" id="acc-profile-msg" role="status" aria-live="polite"></p></div></details>'+
      '<div class="acc-row"><span class="acc-label"><strong>Brouillons</strong><small>'+(nbd?plural(nbd,'document','documents'):'Aucun document')+' sur cet appareil</small></span><button type="button" class="acc-btn" id="open-drafts">Voir</button></div>'+
    '</section>'+

    '<h2 class="acc-title">Préférences</h2><section class="acc-group">'+
      '<div class="acc-row"><span class="acc-label"><strong>Thème</strong></span><select id="acc-theme-select" class="acc-select" aria-label="Thème de l’application"><option value="auto" '+(tm==='auto'?'selected':'')+'>Automatique</option><option value="light" '+(tm==='light'?'selected':'')+'>Clair</option><option value="dark" '+(tm==='dark'?'selected':'')+'>Sombre</option></select></div>'+
      '<label class="acc-row acc-toggle" for="acc-notif"><span class="acc-label"><strong>Notifications</strong><small>Nouveaux modèles et rappel des brouillons en attente.</small></span><input id="acc-notif" class="acc-switch" type="checkbox" '+(notif?'checked':'')+'></label><p class="acc-note" id="acc-notif-msg" role="status" aria-live="polite" hidden></p>'+
      row('Langue','','<span class="acc-value">Français</span>')+
    '</section>'+

    '<h2 class="acc-title">Informations</h2><section class="acc-group">'+
      '<details class="acc-item"><summary class="acc-row"><span class="acc-label"><strong>Aide</strong></span>'+CH+'</summary><div class="acc-panel"><p>1. Choisissez un modèle. 2. Complétez les champs demandés. 3. Vérifiez l’aperçu. 4. Exportez votre document.</p><p>En cas de problème, vérifiez que votre navigateur est à jour et que les téléchargements sont autorisés.</p></div></details>'+
      link('Conditions d’utilisation','./conditions-utilisation.html',true)+
      link('Politique de confidentialité','./politique-confidentialite.html',true)+
      '<details class="acc-item"><summary class="acc-row"><span class="acc-label"><strong>À propos de JuriskPro</strong></span>'+CH+'</summary><div class="acc-panel"><p>Votre allié juridique, partout avec vous.</p><p>Les modèles publiés ont été révisés par un juriste qualifié. Les contrôles automatiques repèrent certains champs manquants et certaines incohérences : ils ne remplacent pas la vérification du document par un professionnel compétent.</p><p>Contact : <a href="mailto:messtonsconseils2@gmail.com">messtonsconseils2@gmail.com</a></p></div></details>'+
    '</section>'+

    '<button type="button" class="acc-logout" id="acc-logout">Se déconnecter</button>');
  const themeSelect=$('#acc-theme-select');
  if(themeSelect) themeSelect.onchange=()=>{const v=themeSelect.value;if(v==='auto'){store.del('juriskpro:theme');applyTheme(null);}else{store.set('juriskpro:theme',v);applyTheme(v);}};
  const notifInput=$('#acc-notif'),notifMsg=$('#acc-notif-msg');
  const notifSay=t=>{if(!notifMsg) return;notifMsg.textContent=t||'';notifMsg.hidden=!t;};
  if(notifInput){
    if(notif) notifPermission().then(st=>{if(st==='denied'){notifInput.checked=false;store.set(NOTIF_KEY,'off');notifSay('Les notifications sont bloquées pour JuriskPro. Autorisez-les dans les réglages du téléphone ou du navigateur, puis réactivez l’option.');}});
    notifInput.onchange=async()=>{
      if(!notifInput.checked){store.set(NOTIF_KEY,'off');notifSay('');syncReminder();return;}
      if(!notifSupported()){notifInput.checked=false;notifSay('Ce navigateur ne permet pas les notifications. Utilisez l’application Android ou un navigateur récent.');return;}
      notifInput.disabled=true;
      const st=await notifRequest();
      notifInput.disabled=false;
      if(st==='granted'){
        store.set(NOTIF_KEY,'on');notifSay('Notifications activées.');
        notify('Notifications activées','Vous serez prévenu des nouveaux modèles et des brouillons en attente.','#compte','welcome');
        notifyNewModels();
      }else{
        notifInput.checked=false;store.set(NOTIF_KEY,'off');
        notifSay(st==='denied'?'Autorisation refusée. Pour l’accorder, ouvrez les réglages du téléphone ou du navigateur puis réactivez l’option.':'Les notifications ne sont pas disponibles ici.');
      }
    };
  }
  const photoInput=$('#profile-photo-input');
  if(photoInput) photoInput.onchange=()=>{const file=photoInput.files&&photoInput.files[0];if(!file)return;if(!file.type||!file.type.startsWith('image/')){alert('Choisissez un fichier image.');return;}if(file.size>8*1024*1024){alert('Choisissez une image de moins de 8 Mo.');photoInput.value='';return;}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=320,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);const updated=Object.assign({},a,{photo:canvas.toDataURL('image/jpeg',.78)});if(!accountSave(updated)){alert('Impossible d’enregistrer la photo dans le stockage local de ce navigateur.');return;}renderAccountProfile(updated);};img.onerror=()=>alert('Cette image ne peut pas être ouverte.');img.src=reader.result;};reader.readAsDataURL(file);};
  const avOpen=$('#avatar-open'),avPick=$('#avatar-picker');
  if(avOpen&&avPick) avOpen.onclick=()=>{const show=avPick.hidden;avPick.hidden=!show;avOpen.setAttribute('aria-expanded',String(show));};
  $$('[data-av]').forEach(b=>b.onclick=async()=>{
    const updated=Object.assign({},a,{avatar:b.dataset.av});delete updated.photo;accountSave(updated);
    const au=window.JuriskProAuth;
    if(a.supabaseUser&&au&&au.getClient()){try{await au.getClient().auth.updateUser({data:{avatar_id:b.dataset.av}});}catch(e){}}
    renderAccountProfile(updated);
  });
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
  rememberRecent(m.id);bumpUsage(m.id);
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
  const dir=target>step?'s-fwd':target<step?'s-back':'';
  step=target;visitedSteps.add(step);renderSteps();renderStep(true,focusSel);scheduleSave();
  if(dir){const sb=$('#stepbox');if(sb){sb.classList.remove('s-fwd','s-back');void sb.offsetWidth;sb.classList.add(dir);}}
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

function stepProgress(e){
  let total=0,done=0,required=0,missing=0;
  (e.champs||[]).forEach(c=>{
    const list=c.type==='repeat'?[].concat(...Array.from({length:clamp(parseInt(S[c.countKey],10)||c.min||1,c.min||1,c.max)},(_,i)=>c.fields(i))):[c];
    list.forEach(f=>{
      if(!f||['info','title','action'].includes(f.type)||(f.showIf&&!f.showIf(S))) return;
      total++; if(String(S[f.id]==null?'':S[f.id]).trim()!=='') done++;
      if(isReq(f)){required++;if(String(S[f.id]==null?'':S[f.id]).trim()==='') missing++;}
    });
  });
  return {total,done,required,missing};
}

function stepFieldsHTML(e){
  let lastGroup='';
  return (e.champs||[]).map(c=>{
    const group=c.group||'';
    let h='';
    if(group&&group!==lastGroup) h+='<h3 class="sub-h form-group-title">'+esc(group)+'</h3>';
    lastGroup=group;
    return h+(c.type==='repeat'?repeatHTML(c):fieldHTML(c));
  }).join('');
}

function renderStep(focus,focusSel){
  const e=M.etapes[step],box=$('#stepbox');
  if(e.final){box.innerHTML=finalHTML();bindFinal();}
  else{
    const body=stepFieldsHTML(e);
    const pg=stepProgress(e);
    box.innerHTML='<section class="card" aria-labelledby="st-h"><h2 id="st-h" tabindex="-1">'+esc(e.titre)+'</h2>'+(e.intro?'<p class="intro">'+esc(e.intro)+'</p>':'')+
      '<div class="field-search"><label for="field-filter">Rechercher un champ</label><input id="field-filter" type="search" placeholder="Ex. adresse, montant, date, notaire" autocomplete="off"></div>'+ 
      '<p class="form-progress" role="status">'+(pg.missing?('<strong>'+pg.missing+' champ'+(pg.missing>1?'s':'')+' obligatoire'+(pg.missing>1?'s':'')+' à compléter</strong> · '):'')+pg.done+' / '+pg.total+' champ'+(pg.total>1?'s':'')+' renseigné'+(pg.done>1?'s':'')+'</p>'+ 
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
  const search=$('#field-filter');
  if(search){search.value=fieldFilter;search.addEventListener('input',()=>{fieldFilter=search.value;applyFieldFilter(box);});applyFieldFilter(box);}
}
function applyFieldFilter(box){
  const q=String(fieldFilter||'').trim().toLocaleLowerCase('fr-FR');
  $$('[data-fid]',box||document).forEach(el=>{
    const text=String(el.textContent||'').toLocaleLowerCase('fr-FR');
    el.classList.toggle('filter-hide',!!q&&!text.includes(q));
  });
}
function onInput(e){
  if(!M||!S) return; /* événement tardif après avoir quitté le formulaire */
  const t=e.target;if(!t||!(t.matches('input,textarea,select'))) return;
  if(t.id==='field-filter') return;
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
  if(M.next){const nx=Cat.meta(M.next)||(Cat.titleSync(M.next)?{titre:Cat.titleSync(M.next)}:null);if(nx) h+='<div class="next"><p><strong>Étape suivante :</strong> '+esc(nx.titre)+'. Elle reprend la dénomination, les associés et les versements de ces statuts.</p><a class="btn small" href="#'+nx.id+'">Ouvrir le modèle</a></div>';}
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
/* Modules natifs Capacitor : dans l'APK sans bundler, ils sont exposés par Capacitor.Plugins (registerPlugin n'existe pas). */
function capPlugin(name){
  const C=window.Capacitor;
  if(!C) throw new Error('Capacitor indisponible');
  if(C.Plugins&&C.Plugins[name]) return C.Plugins[name];
  if(typeof C.registerPlugin==='function') return C.registerPlugin(name);
  throw new Error('module natif « '+name+' » indisponible');
}
function blobToBase64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(r.error||new Error('lecture'));r.readAsDataURL(blob);});}
async function nativeShareBlob(blob,name,title){
  _capFS=_capFS||capPlugin('Filesystem');
  _capShare=_capShare||capPlugin('Share');
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
// PDF : les modèles issus d'un fichier Word gardent la mise en page d'origine (polices, marges, retraits, tableaux) ;
// en cas d'échec, on retombe sur la mise en page simplifiée plutôt que de ne rien livrer.
async function buildPdfFor(M,r,S,title){
  if(M.sourceTemplate&&typeof buildSourcePdf==='function'){
    try{return await buildSourcePdf(M,r.V,S,title);}
    catch(e){console.warn('PDF fidèle indisponible, mise en page simplifiée.',e);}
  }
  return buildPdf(r.blocks,r.V,title);
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
  const cur=$(kind==='docx'?'#dl-docx':'#dl-pdf'),lab=cur.textContent;cur.textContent='Préparation en cours…';cur.classList.add('is-busy');
  say('Préparation du fichier…');
  try{
    await JPLibs.load(kind==='docx'?'jszip':'jspdf');
    const blob=kind==='docx'
      ?(M.sourceTemplate&&typeof buildSourceTemplateDocx==='function'
        ?await buildSourceTemplateDocx(M,r.V,S,title)
        :await buildDocx(r.blocks,r.V,title))
      :await buildPdfFor(M,r,S,title);
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
  }finally{exporting=false;btns.forEach(b=>{b.disabled=false;});cur.classList.remove('is-busy');cur.textContent=lab;}
}

async function shareDocument(){
  if(!M) return;
  const gate=finalValidation(M,S);
  if(gate.blocked){gotoStep(firstCorrectionStep(gate));return;}
  const btn=$('#share-doc');
  if(!btn||exporting) return;
  exporting=true;btn.disabled=true;const old=btn.textContent;btn.textContent='Préparation…';btn.classList.add('is-busy');
  try{
    await JPLibs.load('jspdf');
    const r=recompute(),title=M.docTitle(r.V),name=M.fileBase(r.V)+'.pdf';
    const blob=await buildPdfFor(M,r,S,title);
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
  }finally{exporting=false;btn.disabled=false;btn.classList.remove('is-busy');btn.textContent=old;}
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
  const ok=store.set(draftKey(M.id),JSON.stringify({v:v,step:step,t:Date.now(),meta:draftMeta(M,S)}));
  try{updateBadges();}catch(e){}
  setSaved(ok?'Enregistré à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'Non enregistré : stockage plein ou indisponible. Supprimez d’anciens brouillons.',!ok);
}
window.addEventListener('pagehide',flushSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden) flushSave();});

/* ---------- Clavier virtuel : libère la barre du bas pendant la saisie ---------- */
document.addEventListener('focusin',e=>{if(e.target&&e.target.matches&&e.target.matches('input:not([type=radio]):not([type=checkbox]),textarea,select')) document.body.classList.add('kb');});
document.addEventListener('focusout',()=>{setTimeout(()=>{const a=document.activeElement;if(!(a&&a.matches&&a.matches('input:not([type=radio]):not([type=checkbox]),textarea,select'))) document.body.classList.remove('kb');},120);});

/* ---------- Rapidité : on précharge seulement ce que l'utilisateur utilise ----------
   Jamais tout le catalogue : avec des milliers de modèles, ce serait des mégaoctets inutiles. */
const RECENT_KEY='juriskpro:recent';
function recentIds(){try{return JSON.parse(store.get(RECENT_KEY)||'[]').filter(x=>typeof x==='string').slice(0,5);}catch(e){return [];}}
function rememberRecent(id){const l=[id].concat(recentIds().filter(x=>x!==id)).slice(0,5);store.set(RECENT_KEY,JSON.stringify(l));}
function prefetchModels(){
  const c=navigator.connection;
  if(c&&(c.saveData||/(^|-)2g$/.test(c.effectiveType||''))) return;
  const ids=recentIds().slice(0,3);
  if(!ids.length) return;
  const run=()=>loadModels(ids).catch(()=>{});
  if(window.requestIdleCallback) requestIdleCallback(run,{timeout:4000}); else setTimeout(run,2500);
}
document.addEventListener('pointerdown',e=>{
  const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a) return;
  const r=parseRoute((a.getAttribute('href')||'').slice(1));
  if((r.t==='model'||r.t==='detail')&&!FULL[r.id]) loadModels([r.id]).catch(()=>{});
},{passive:true});
window.JuriskProAuth.require(function(){ route(); syncAccountFromSession(); setTimeout(prefetchModels,1200); });
