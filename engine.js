/* ============================================================
   MOTEUR DE VÉRIFICATION (sans interface) : champs, champs obligatoires, contrôles.
   Séparé de app.js pour pouvoir être testé automatiquement sur tous les modèles
   (scripts/validate-models.cjs). Dépend de core.js.
   ============================================================ */
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
  if(typeof M!=='undefined'&&m===M) DYN=new Set(_needVal);
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
