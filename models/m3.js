/* ============================================================
   MODÈLE 3 : Déclaration de souscription et de versement (DSV)
   Article 314 de l'Acte uniforme révisé, article 6 de l'ordonnance 2014-161.
   ============================================================ */
function m3Sources(){
  const out=[];
  [['sarl-pluripersonnelle-mixte','Statuts de SARL pluripersonnelle',S=>!!(S.denomination||S.a0_prenom||S.a0_nom)],
   ['sarl-unipersonnelle-numeraire','Statuts de SARL unipersonnelle',S=>!!(S.denomination||S.prenom||S.nom||S.capital)]].forEach(x=>{
    const o=loadDraftO(x[0]);
    if(o&&x[2](o.v)) out.push({id:x[0],titre:x[1],S:o.v,t:o.t||0});
  });
  out.sort((a,b)=>b.t-a.t);
  return out;
}
function m3Import(){
  const src=m3Sources()[0];
  if(!src) return null;
  const S=src.S,P={},half=S.liberation==='moitie';
  ['denomination','sigle','objet','siege','banque','lieu'].forEach(k=>{P[k]=S[k]||'';});
  P.date_statuts=S.date||'';
  if(src.id==='sarl-pluripersonnelle-mixte'){
    const T=m2Totals(S);
    P.nb_assoc=String(T.n);P.nominal=S.nominal||'';
    for(let i=0;i<T.n;i++){
      ['civilite','prenom','nom','adresse'].forEach(k=>{P['a'+i+'_'+k]=S['a'+i+'_'+k]||(k==='civilite'?'M.':'');});
      const parts=T.nom?Math.round((T.num[i]+T.nat[i])/T.nom):0;
      P['a'+i+'_parts']=parts?String(parts):'';
      P['a'+i+'_verse']=String(half?Math.ceil(T.num[i]/2):T.num[i]);
    }
  }else{
    const cap=+S.capital||0,nom=+S.nominal||0;
    P.nb_assoc='1';P.nominal=S.nominal||'';
    P.a0_civilite=S.civilite||'M.';P.a0_prenom=S.prenom||'';P.a0_nom=S.nom||'';P.a0_adresse=S.adresse||'';
    P.a0_parts=(cap&&nom)?String(Math.round(cap/nom)):'';
    P.a0_verse=String(half?Math.ceil(cap/2):cap);
  }
  return {patch:P,titre:src.titre};
}

function m3Totals(S){
  const g=k=>String(S[k]==null?'':S[k]).trim();
  const n=clamp(parseInt(g('nb_assoc'),10)||1,1,10);
  const nom=+g('nominal')||0,parts=[],verse=[];let pt=0,vt=0,vAny=false;
  for(let i=0;i<n;i++){
    const a=+g('a'+i+'_parts')||0,b=+g('a'+i+'_verse')||0;
    parts.push(a);verse.push(b);pt+=a;vt+=b;
    if(g('a'+i+'_verse')!=='') vAny=true;
  }
  return {n:n,nom:nom,parts:parts,verse:verse,pt:pt,vt:vt,vAny:vAny,cap:pt*nom};
}

const M3_ASSOC={type:'repeat',id:'assoc',prefix:'a',countKey:'nb_assoc',min:1,max:10,label:'Associé',addLabel:'Ajouter un associé',
  keys:['civilite','prenom','nom','adresse','parts','verse'],
  itemDefaults:()=>({civilite:'M.'}),
  fields:(i)=>{
    const p='a'+i+'_',G='Associé '+(i+1),f=(k,d)=>Object.assign({id:p+k,group:G},d);
    return [
      f('civilite',{type:'choice',variant:'seg',label:'Civilité',opts:CIV}),
      f('prenom',{type:'text',half:true,label:'Prénom(s)'}),
      f('nom',{type:'text',half:true,label:'Nom'}),
      f('adresse',{type:'area',rows:2,label:'Domicile'}),
      f('parts',{type:'int',half:true,unit:'parts',label:'Parts souscrites',ph:'Ex. : 100'}),
      f('verse',{type:'money',half:true,unit:'F CFA',label:'Versement effectué',ph:'0 si apport en nature',aide:'La somme réellement versée en espèces. Indiquez 0 pour un apport en nature.'}),
      {id:'i_s'+i,type:'info',calc:(S)=>{
        const nom=+S.nominal||0,a=+S[p+'parts']||0,v=String(S[p+'verse']||'')===''?null:(+S[p+'verse']||0);
        if(!a||!nom) return null;
        const tot=a*nom;
        if(v!==null&&v>tot) return {t:'Le versement dépasse le montant souscrit ('+fmt(tot)+' F CFA).',c:'bad'};
        return {t:'Montant souscrit : '+fmt(tot)+' F CFA'+(v!==null?', dont '+fmt(v)+' F CFA versés.':'.'),c:'ok'};
      }}
    ];
  }};

const M3_ETAPES=[
 {id:'societe',court:'Société',titre:'La société et ses statuts',intro:'Ces informations reprennent les principales caractéristiques des statuts.',champs:[
  {id:'denomination',type:'text',label:'Dénomination sociale',ph:'Ex. : ALPHA SERVICES',req:true},
  {id:'sigle',type:'text',label:'Sigle (facultatif)',ph:'Ex. : ALS'},
  {id:'objet',type:'area',rows:3,label:'Objet social',ph:'Ex. : Commerce général, import-export de marchandises.'},
  {id:'siege',type:'area',rows:2,label:'Siège social',ph:'Ex. : Abidjan, Cocody, Riviera Palmeraie, lot 12'},
  {id:'date_statuts',type:'date',half:true,label:'Date de l’acte de statuts'},
  {id:'date_enreg',type:'date',half:true,label:'Date d’enregistrement (facultatif)',aide:'Laissez vide si les statuts ne sont pas encore enregistrés : le blanc sera à compléter à la main.'}
 ]},
 {id:'associes',court:'Associés',titre:'Les associés et leurs versements',intro:'Pour chaque associé : son identité, ses parts souscrites et la somme versée.',champs:[
  {id:'a_import',type:'action',action:'import-statuts',label:'Reprendre les informations de mes statuts',showIf:()=>m3Sources().length>0},
  M3_ASSOC
 ]},
 {id:'capital',court:'Capital',titre:'Capital et dépôt des fonds',champs:[
  {id:'nominal',type:'money',half:true,unit:'F CFA',label:'Valeur d’une part',ph:'10 000',req:true},
  {id:'i_cap',type:'info',calc:(S)=>{
      const T=m3Totals(S);
      if(!T.pt) return {t:'Le capital sera calculé : total des parts souscrites × valeur d’une part.'};
      if(!T.nom) return {t:fmt(T.pt)+' parts souscrites. Indiquez la valeur d’une part pour obtenir le capital.'};
      return {t:'Capital souscrit : '+fmt(T.cap)+' F CFA, soit '+fmt(T.pt)+' parts. Versements : '+fmt(T.vt)+' F CFA.',c:'ok'};
  }},
  {id:'banque',type:'text',label:'Établissement où les fonds sont déposés',aide:'Banque, établissement financier ou structure de microfinance.',ph:'Ex. : nom de la banque et agence'}
 ]},
 {id:'signature',court:'Signature',titre:'Signature',champs:[
  {id:'date',type:'date',half:true,label:'Date de la déclaration',req:true},
  {id:'lieu',type:'text',half:true,label:'Fait à',ph:'Ex. : Abidjan'},
  {id:'nb_ex',type:'int',half:true,unit:'exemplaires',label:'Exemplaires originaux',ph:'Calculé automatiquement'},
  {id:'i_nb',type:'info',calc:(S)=>{const n=m3Totals(S).n;return {t:'Recommandé : '+(n+2)+' exemplaires, soit un par associé, un pour le siège social et un pour les formalités.'};}}
 ]},
 {id:'final',court:'Télécharger',titre:'Vérifier et télécharger',final:true,champs:[]}
];

function m3Defaults(){return {nb_assoc:'2',a0_civilite:'M.',a1_civilite:'M.',date:todayISO()};}
const M3_EXEMPLE={
  denomination:'ALPHA SERVICES',sigle:'',objet:'Commerce général, import-export de marchandises et prestations de services.',siege:'Abidjan, Cocody, Riviera Palmeraie, lot 12',
  date_statuts:'2026-09-15',date_enreg:'',nb_assoc:'2',
  a0_civilite:'M.',a0_prenom:'Yao',a0_nom:'Konan',a0_adresse:'Abidjan, Cocody Angré',a0_parts:'200',a0_verse:'1000000',
  a1_civilite:'Mme',a1_prenom:'Aya',a1_nom:'Kouassi',a1_adresse:'Abidjan, Marcory Zone 4',a1_parts:'300',a1_verse:'0',
  nominal:'10000',banque:'Banque Exemple, agence du Plateau',lieu:'Abidjan',nb_ex:''
};

function m3Compute(S){
  const V=newV(),g=k=>String(S[k]==null?'':S[k]).trim(),gn=k=>g(k).replace(/\s*\n+\s*/g,' ');
  const T=m3Totals(S),n=T.n,pr=(k,val,src)=>{V[k]=val;if(src)V._src[k]=src;};
  for(let i=0;i<n;i++) addPerson(V,S,'a',i);
  ['denomination','sigle','objet','siege','banque','lieu'].forEach(k=>{V[k]=gn(k);});
  V.sigle_txt=g('sigle')?', en abrégé « '+g('sigle')+' »':'';V._src.sigle_txt='sigle';
  V.annee_lettres=anneeLettres(g('date'));V._src.annee_lettres='date';
  V.date_longue=dateFr(g('date'));V._src.date_longue='date';
  V.date_statuts_longue=dateFr(g('date_statuts'));V._src.date_statuts_longue='date_statuts';
  V.enreg_txt=g('date_enreg')?', enregistré le '+dateFr(g('date_enreg')):', enregistré le ………………';V._src.enreg_txt='date_enreg';V._nohl.add('enreg_txt');
  /* accords singulier / pluriel */
  const sing=n===1,fem=g('a0_civilite')==='Mme';
  const gram=(k,v)=>{V[k]=v;V._nohl.add(k);};
  gram('sous',sing?(fem?'La soussignée':'Le soussigné'):'Les soussignés');
  gram('sous_min',sing?(fem?'la soussignée':'le soussigné'):'les soussignés');
  gram('etabli',sing?'a établi':'ont établi');
  gram('entre',sing?(fem?'elle':'lui'):'eux');
  gram('decl',sing?'déclare':'déclarent');
  gram('dresse',sing?(fem?'elle a dressé':'il a dressé'):'ils ont dressé');
  gram('titre_sig',sing?'L’associé unique':'Les associés');
  /* parts, numérotation, montants */
  let cur=1;
  for(let i=0;i<n;i++){
    const p='a'+i+'_',a=T.parts[i];
    pr(p+'parts',a?fmt(a):'');
    pr(p+'nd',a?String(cur):'',p+'parts');pr(p+'nf',a?String(cur+a-1):'',p+'parts');
    if(a) cur+=a;
    pr(p+'souscrit',(a&&T.nom)?fmt(a*T.nom):'',a?'nominal':p+'parts');
    const raw=g(p+'verse');
    pr(p+'verse_txt',raw===''?'':(T.verse[i]>0?fmt(T.verse[i]):'—'),p+'verse');
  }
  pr('nominal_chiffres',T.nom?fmt(T.nom):'','nominal');
  pr('parts_tot',T.pt?fmt(T.pt):'','a0_parts');
  pr('capital',(T.pt&&T.nom)?fmt(T.cap):'',T.pt?'nominal':'a0_parts');
  pr('verse_tot',T.vAny?fmt(T.vt):'','a0_verse');
  const nbx=+g('nb_ex')||(n+2);
  pr('nb_ex_txt',String(nbx),'nb_ex');pr('nb_ex_lettres_maj',lettres(nbx).toUpperCase(),'nb_ex');
  return V;
}

function m3Blocks(S,V){
  const T=m3Totals(S),n=T.n,B=[],ap=(...x)=>{x.forEach(y=>B.push(y));};
  ap({k:'tit',text:'DÉCLARATION DE SOUSCRIPTION ET DE VERSEMENT'},
     {k:'sous',text:'(article 314 de l’Acte uniforme révisé du 30 janvier 2014 ; article 6 de l’Ordonnance n° 2014-161 du 02 avril 2014 relative à la forme des statuts et au capital social de la société à responsabilité limitée)'},
     {k:'sp'},P('L’an {{annee_lettres}},'),P('Le {{date_longue}},'),P('**{{sous}} :**'));
  const lines=[];
  for(let i=0;i<n;i++) lines.push('**'+ASSO(i)+'**, demeurant à {{a'+i+'_adresse}}');
  ap({k:'box',lines:lines});
  ap({k:'art',text:'I – EXPOSÉ PRÉALABLE'},
     P('Par acte sous seing privé en date du {{date_statuts_longue}}{{enreg_txt}}, {{sous_min}} {{etabli}} les statuts de la Société à Responsabilité Limitée devant exister entre {{entre}} et tous propriétaires de parts sociales ultérieures, dont les principales caractéristiques sont les suivantes :'),
     {k:'sub',text:'1 – Forme'},
     P('La société constituée est une Société à Responsabilité Limitée régie par les dispositions de l’Acte uniforme révisé de l’OHADA du 30 janvier 2014 relatif au droit des Sociétés commerciales et du Groupement d’intérêt économique (GIE), ainsi que par toutes autres dispositions légales ou réglementaires applicables et ses statuts.'),
     {k:'sub',text:'2 – Dénomination'},
     P('La société a pour dénomination : **{{denomination}}**{{?sigle_txt}}'),
     {k:'sub',text:'3 – Objet'},
     P('La société a pour objet en CÔTE D’IVOIRE : {{objet}}'),
     {k:'sub',text:'4 – Siège social'},
     P('Le siège social est fixé à : {{siege}}'),
     {k:'sub',text:'5 – Durée'},
     P('La durée de la société est de quatre-vingt-dix-neuf (99) années, sauf dissolution anticipée ou prorogation.'),
     {k:'sub',text:'6 – Capital social'},
     P('Le capital social est fixé à la somme de {{capital}} F CFA, divisé en {{parts_tot}} parts sociales de {{nominal_chiffres}} F CFA chacune.'));
  ap({k:'art',text:'II – CONSTATATION DE LA LIBÉRATION ET DU DÉPÔT DES FONDS PROVENANT DES PARTS SOCIALES'},
     P('{{sous}} {{decl}} que les souscriptions et les versements des fonds provenant de la libération des parts sociales ont été effectués comme suit :'));
  const rows=[];
  for(let i=0;i<n;i++) rows.push([
    ['**'+ASSO(i)+'**','{{a'+i+'_adresse}}'],
    ['{{a'+i+'_parts}} parts','numérotées de {{a'+i+'_nd}} à {{a'+i+'_nf}}'],
    '{{nominal_chiffres}}','{{a'+i+'_souscrit}}','{{a'+i+'_verse_txt}}']);
  rows.push(['**TOTAL**','**{{parts_tot}} parts**','','**{{capital}}**','**{{verse_tot}}**']);
  ap({k:'table',cols:[30,19,15,18,18],al:['left','center','right','right','right'],size:10,
      head:['IDENTITÉ DES ASSOCIÉS ET LEUR DOMICILE','NOMBRE DE PARTS SOUSCRITES','MONTANT NOMINAL (F CFA)','MONTANT TOTAL SOUSCRIT (F CFA)','VERSEMENT EFFECTUÉ (F CFA)'],rows:rows});
  ap(P('La somme correspondant à l’ensemble des souscriptions et versements effectués à ce jour, de {{verse_tot}} F CFA, a été déposée pour le compte de la société et conformément à la loi, dans un compte ouvert à {{banque}}.'),
     P('**En foi de quoi, {{dresse}} la présente, pour servir et valoir ce que de droit.**'),
     {k:'sp',kn:true},
     P('Fait à {{lieu}}, le {{date_longue}}',{kn:true}),
     P('EN {{nb_ex_lettres_maj}} ({{nb_ex_txt}}) EXEMPLAIRES ORIGINAUX',{kn:true}),
     {k:'sp',kn:true},P('**{{titre_sig}}**',{kn:true}));
  const sg=[];for(let i=0;i<n;i++) sg.push('**'+ASSO(i)+'**');
  ap({k:'sigs',items:sg});
  return B;
}

const M3={
  id:'declaration-souscription-versement',cat:'prive',
  titre:'Déclaration de souscription et de versement',
  sous:'Constate la libération et le dépôt des fonds',
  resume:'Acte qui accompagne les statuts d’une SARL : parts souscrites par chaque associé, sommes versées et compte de dépôt. Se remplit en un clic depuis vos statuts.',
  tags:['OHADA','Côte d’Ivoire','1 à 10 associés','Avec les statuts'],
  duree:'5 min',
  etapes:M3_ETAPES,
  defaults:m3Defaults,
  exemple:M3_EXEMPLE,
  compute:m3Compute,
  blocks:m3Blocks,
  docTitle:V=>'Déclaration de souscription et de versement '+(V.denomination||''),
  fileBase:V=>'DSV-'+(fileSlug(V.denomination)?fileSlug(V.denomination)+'-':'')+'SARL',
  finalNote:'Déposez la déclaration avec les statuts et le justificatif du dépôt des fonds lors des formalités de constitution.',
  headline:S=>S.denomination||'',
  importFrom:m3Import
};
/* Corps commun des statuts notariés de SARL : généré depuis les modèles du notaire (tools/gen_body.py). Format : [type, n° d’article, texte] */
JPModels.add(M3);
