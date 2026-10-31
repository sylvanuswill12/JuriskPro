/* ============================================================
   MODÈLE 2 : Statuts de SARL pluripersonnelle (apports mixtes)
   Plusieurs associés, apports en numéraire, en nature et, en option, en industrie.
   ============================================================ */
function m2Totals(S){
  const g=k=>String(S[k]==null?'':S[k]).trim();
  const n=clamp(parseInt(g('nb_assoc'),10)||2,2,8);
  const nom=+g('nominal')||0,num=[],nat=[];let numTot=0,natTot=0,indParts=0;
  for(let i=0;i<n;i++){
    const a=+g('a'+i+'_num')||0,b=+g('a'+i+'_nat_val')||0;
    num.push(a);nat.push(b);numTot+=a;natTot+=b;
    if(g('industrie')==='oui') indParts+=(+g('a'+i+'_ind_parts')||0);
  }
  const cap=numTot+natTot;
  const ok=nom>0&&cap>0&&cap%nom===0&&num.every(x=>x%nom===0)&&nat.every(x=>x%nom===0);
  return {n:n,nom:nom,num:num,nat:nat,numTot:numTot,natTot:natTot,cap:cap,ok:ok,parts:ok?cap/nom:0,indParts:indParts};
}
function m2SrcOptions(S){
  const n=m2Totals(S).n,o=[];
  for(let i=0;i<n;i++) o.push({v:'a'+i,t:'Associé '+(i+1)+' : '+personName(S,'a',i).replace(/^Associé \d+$/,'à renseigner')});
  o.push({v:'autre',t:'Une autre personne'});
  return o;
}

const M2_ASSOC={type:'repeat',id:'assoc',prefix:'a',countKey:'nb_assoc',min:2,max:8,label:'Associé',addLabel:'Ajouter un associé',
  keys:['civilite','prenom','nom','naissance_date','naissance_lieu','nationalite','profession','adresse','piece','num','nat_desc','nat_val','ind_desc','ind_duree','ind_parts'],
  itemDefaults:()=>({civilite:'M.'}),
  fields:(i)=>{
    const p='a'+i+'_',G='Associé '+(i+1),f=(k,d)=>Object.assign({id:p+k,group:G},d);
    return [
      f('civilite',{type:'choice',variant:'seg',label:'Civilité',opts:CIV}),
      f('prenom',{type:'text',half:true,label:'Prénom(s)'}),
      f('nom',{type:'text',half:true,label:'Nom'}),
      f('naissance_date',{type:'date',half:true,label:'Date de naissance'}),
      f('naissance_lieu',{type:'text',half:true,label:'Lieu de naissance',ph:'Ex. : Bouaké'}),
      f('nationalite',{type:'text',half:true,label:'Nationalité',ph:'Ex. : ivoirienne'}),
      f('profession',{type:'text',half:true,label:'Profession'}),
      f('adresse',{type:'area',rows:2,label:'Adresse du domicile'}),
      f('piece',{type:'text',label:'Pièce d’identité',ph:'Ex. : CNI n° …'})
    ];
  }};
const M2_APPORTS={type:'repeat',id:'apports',prefix:'a',countKey:'nb_assoc',min:2,max:8,fixed:true,label:'Associé',
  fields:(i)=>{
    const p='a'+i+'_',G='Associé '+(i+1),f=(k,d)=>Object.assign({id:p+k,group:G},d);
    const ind=S=>S.industrie==='oui';
    return [
      f('num',{type:'money',unit:'F CFA',label:'Apport en numéraire',ph:'Laisser vide s’il n’y en a pas'}),
      f('nat_desc',{type:'area',rows:3,label:'Apport en nature : désignation',aide:'Le bien apporté et les modalités de l’apport. Laissez vide s’il n’y en a pas.',ph:'Ex. : un véhicule utilitaire de marque …, immatriculé …'}),
      f('nat_val',{type:'money',unit:'F CFA',label:'Apport en nature : valeur retenue',ph:'Ex. : 3 000 000'}),
      f('ind_desc',{type:'area',rows:3,label:'Apport en industrie : activité apportée',aide:'Une ligne par prestation ou compétence.',showIf:ind}),
      f('ind_duree',{type:'text',half:true,label:'Durée des prestations',ph:'Ex. : cinq (5) ans',showIf:ind}),
      f('ind_parts',{type:'int',half:true,unit:'parts',label:'Parts attribuées',showIf:ind}),
      {id:'i_ap'+i,type:'info',calc:(S)=>{
        const nom=+S.nominal||0,a=+S[p+'num']||0,b=+S[p+'nat_val']||0;
        if(!a&&!b) return null;
        if(!nom) return {t:'Indiquez la valeur d’une part à l’étape Capital pour calculer les parts.'};
        if(a%nom||b%nom) return {t:'Chaque apport doit être un multiple de la valeur d’une part ('+fmt(nom)+' F CFA).',c:'bad'};
        const k=(a+b)/nom;
        return {t:fmt(a+b)+' F CFA d’apports : '+fmt(k)+' part'+(k>1?'s':'')+' sociale'+(k>1?'s':'')+'.',c:'ok'};
      }}
    ];
  }};
const M2_GERANTS={type:'repeat',id:'gerants',prefix:'g',countKey:'nb_ger',min:1,max:3,label:'Gérant',addLabel:'Ajouter un gérant',
  showIf:S=>S.gerance_mode!=='ulterieur',
  keys:['src','civilite','prenom','nom','adresse'],
  itemDefaults:(i,S)=>({src:i<m2Totals(S).n?'a'+i:'autre',civilite:'M.'}),
  fields:(i)=>{
    const p='g'+i+'_',G='Gérant '+(i+1),f=(k,d)=>Object.assign({id:p+k,group:G},d);
    const autre=S=>S[p+'src']==='autre';
    return [
      f('src',{type:'select',label:'Qui est gérant ?',opts:m2SrcOptions}),
      f('civilite',{type:'choice',variant:'seg',label:'Civilité',opts:CIV,showIf:autre}),
      f('prenom',{type:'text',half:true,label:'Prénom(s)',showIf:autre}),
      f('nom',{type:'text',half:true,label:'Nom',showIf:autre}),
      f('adresse',{type:'area',rows:2,label:'Adresse',showIf:autre})
    ];
  }};

const M2_ETAPES=[
 {id:'societe',court:'Société',titre:'La société',intro:'Ces informations alimentent les articles 2, 3 et 4 des statuts.',champs:[
  {id:'denomination',type:'text',label:'Dénomination sociale',aide:'Le nom qui figurera sur vos factures, courriers et publications.',ph:'Ex. : ALPHA SERVICES',req:true},
  {id:'sigle',type:'text',label:'Sigle (facultatif)',ph:'Ex. : ALS'},
  {id:'objet',type:'area',rows:4,label:'Objet social',aide:'Les activités exercées en Côte d’Ivoire. Les activités annexes habituelles figurent déjà dans l’article 3.',ph:'Ex. : Commerce général, import-export de marchandises, prestations de services.'},
  {id:'siege',type:'area',rows:2,label:'Siège social',aide:'Adresse et situation géographique.',ph:'Ex. : Abidjan, Cocody, Riviera Palmeraie, lot 12'}
 ]},
 {id:'associes',court:'Associés',titre:'Les associés',intro:'Deux associés au moins. Leur identité apparaît en tête des statuts, aux articles 7 et 8 et à la signature.',champs:[M2_ASSOC]},
 {id:'capital',court:'Capital',titre:'Capital et libération',intro:'Articles 7 et 8. Le capital réunit les apports en numéraire et les apports en nature.',champs:[
  {id:'nominal',type:'money',half:true,unit:'F CFA',label:'Valeur d’une part',ph:'10 000',
    todoNote:(S)=>{const T=m2Totals(S);return (T.cap&&T.nom&&!T.ok)?' (doit diviser chaque apport)':'';}},
  {id:'i_cap',type:'info',calc:(S)=>{
      const T=m2Totals(S);
      if(!T.cap) return {t:'Le capital sera calculé à l’étape suivante : apports en numéraire + apports en nature.'};
      const base='Capital : '+fmt(T.cap)+' F CFA ('+fmt(T.numTot)+' en numéraire, '+fmt(T.natTot)+' en nature).';
      if(!T.nom) return {t:base};
      if(!T.ok) return {t:base+' Chaque apport doit être un multiple de la valeur d’une part.',c:'bad'};
      return {t:base+' Soit '+fmt(T.parts)+' parts sociales.',c:'ok'};
  }},
  {id:'liberation',type:'choice',variant:'stack',label:'Libération des apports en numéraire',aide:'Les apports en nature sont libérés en totalité dès la constitution.',opts:[
    {v:'integrale',t:'Intégralement à la constitution',d:'Les sommes apportées sont versées en totalité.'},
    {v:'moitie',t:'De moitié au moins',d:'Le solde est libéré dans un délai de deux années à compter de l’immatriculation.'}]},
  {id:'i_depot',type:'info',calc:(S)=>{
      const T=m2Totals(S);
      if(!T.numTot) return null;
      return S.liberation==='moitie'
        ? {t:'À déposer dès la constitution : '+fmt(Math.ceil(T.numTot/2))+' F CFA au moins.'}
        : {t:'Vous déposez la totalité du numéraire : '+fmt(T.numTot)+' F CFA.'};
  }},
  {id:'banque',type:'text',label:'Établissement où les fonds sont déposés',aide:'Banque, établissement financier ou structure de microfinance.',ph:'Ex. : nom de la banque et agence'},
  {id:'industrie',type:'choice',variant:'seg',label:'Un associé apporte-t-il son industrie ?',aide:'Connaissances techniques, professionnelles ou services (article 7, partie III).',opts:[{v:'non',t:'Non'},{v:'oui',t:'Oui'}]}
 ]},
 {id:'apports',court:'Apports',titre:'Les apports de chaque associé',intro:'Renseignez, pour chacun, ce qu’il apporte. Laissez vide ce qui ne le concerne pas.',champs:[
  M2_APPORTS,
  {id:'t_eval',type:'title',label:'Évaluation des apports en nature'},
  {id:'eval_mode',type:'choice',variant:'stack',label:'Comment les apports en nature sont-ils évalués ?',opts:[
    {v:'commissaire',t:'Par un commissaire aux apports',d:'Désigné à l’unanimité des futurs associés. Son rapport est annexé aux statuts.'},
    {v:'ordonnance',t:'Par un commissaire désigné en justice',d:'Désigné par ordonnance du président du tribunal chargé des affaires commerciales.'},
    {v:'dispense',t:'Sans commissaire aux apports',d:'Possible si aucun apport ne dépasse 5 000 000 F CFA et si le total reste sous ce seuil.'}]},
  {id:'commissaire',type:'text',label:'Nom du commissaire aux apports',showIf:S=>S.eval_mode!=='dispense'},
  {id:'ord_ville',type:'text',half:true,label:'Tribunal de',ph:'Ex. : Abidjan',showIf:S=>S.eval_mode==='ordonnance'},
  {id:'ord_date',type:'date',half:true,label:'Date de l’ordonnance',showIf:S=>S.eval_mode==='ordonnance'},
  {id:'ord_requerant',type:'text',label:'À la requête de',showIf:S=>S.eval_mode==='ordonnance'},
  {id:'i_eval',type:'info',calc:(S)=>{
      const T=m2Totals(S);
      if(S.eval_mode!=='dispense'||!T.natTot) return null;
      const big=T.nat.some(x=>x>5000000);
      if(big||T.natTot>5000000) return {t:'Un apport dépasse 5 000 000 F CFA, ou leur total le dépasse : un commissaire aux apports est nécessaire.',c:'bad'};
      return {t:'Les apports en nature restent sous 5 000 000 F CFA : la dispense est possible.',c:'ok'};
  }},
  {id:'i_ind',type:'info',calc:(S)=>{
      const T=m2Totals(S);
      if(S.industrie!=='oui'||!T.indParts||!T.parts) return null;
      const pct=T.indParts/(T.parts+T.indParts)*100;
      return pct>25?{t:'Les parts d’industrie représentent '+pct.toFixed(1).replace('.',',')+' % : elles ne doivent pas dépasser 25 %.',c:'bad'}
                   :{t:'Les parts d’industrie représentent '+pct.toFixed(1).replace('.',',')+' % des droits (maximum 25 %).',c:'ok'};
  }}
 ]},
 {id:'gerance',court:'Gérance',titre:'La gérance',intro:'Articles 15 et 16.',champs:[
  {id:'gerance_mode',type:'choice',variant:'stack',label:'Qui est gérant ?',opts:[
    {v:'statuts',t:'Un ou plusieurs gérants nommés dans les statuts',d:'Vous les désignez ci-dessous.'},
    {v:'ulterieur',t:'Les gérants seront nommés plus tard',d:'Ils seront désignés par une décision collective des associés.'}]},
  M2_GERANTS,
  {id:'duree_gerant',type:'int',half:true,unit:'années',label:'Durée du mandat',ph:'Ex. : 4',req:true},
  {id:'preavis_gerant',type:'int',half:true,unit:'mois',label:'Préavis de démission',ph:'Ex. : 3',req:true},
  {id:'maj_nom',type:'choice',variant:'seg',label:'Majorité pour nommer un gérant',opts:[{v:'moitie',t:'Plus de la moitié des parts'},{v:'autre',t:'Une majorité renforcée'}]},
  {id:'maj_autre',type:'text',label:'Majorité exigée',ph:'Ex. : des trois quarts (3/4) des parts',showIf:S=>S.maj_nom==='autre'},
  {id:'limiter',type:'choice',variant:'seg',label:'Pouvoirs du gérant',opts:[{v:'non',t:'Sans limitation'},{v:'oui',t:'Avec limitations'}]},
  {id:'limitations',type:'area',rows:3,label:'Actes soumis à l’autorisation des associés',aide:'Ex. : vendre un immeuble, contracter un emprunt supérieur à un montant donné.',showIf:S=>S.limiter==='oui'}
 ]},
 {id:'signature',court:'Signature',titre:'Signature et formalités',intro:'Articles 27, 28 et 31, et bas du document.',champs:[
  {id:'date',type:'date',half:true,label:'Date des statuts',req:true},
  {id:'lieu',type:'text',half:true,label:'Fait à',ph:'Ex. : Abidjan'},
  {id:'nb_ex',type:'int',half:true,unit:'exemplaires',label:'Exemplaires originaux',ph:'Calculé automatiquement'},
  {id:'i_nb',type:'info',calc:(S)=>{const n=m2Totals(S).n;return {t:'Recommandé : '+(n+2)+' exemplaires, soit un par associé, un pour le siège social et un pour les formalités.'};}},
  {id:'contest',type:'choice',variant:'stack',label:'Contestations entre associés (article 27)',opts:[
    {v:'tribunal',t:'Tribunal chargé des affaires commerciales',d:'Droit commun.'},
    {v:'arbitrage',t:'Arbitrage',d:'Selon l’Acte uniforme de l’OHADA relatif à l’arbitrage.'}]},
  {id:'t_mand',type:'title',label:'Personne chargée des formalités (article 31)'},
  {id:'m_src',type:'select',label:'Qui accomplit les formalités ?',opts:m2SrcOptions},
  {id:'m_civilite',type:'choice',variant:'seg',label:'Civilité',opts:CIV,showIf:S=>S.m_src==='autre'},
  {id:'m_nom',type:'text',label:'Nom et prénom(s)',showIf:S=>S.m_src==='autre'},
  {id:'m_profession',type:'text',half:true,label:'Profession',showIf:S=>S.m_src==='autre'},
  {id:'m_piece',type:'text',half:true,label:'Pièce d’identité',ph:'CNI n° …',showIf:S=>S.m_src==='autre'},
  {id:'t_eng',type:'title',label:'Engagements pour le compte de la société (article 28)'},
  {id:'eng_mandataire',type:'text',label:'Mandataire des engagements (facultatif)',aide:'Nom, prénom et adresse. À remplir seulement si les associés donnent mandat de prendre des engagements.'},
  {id:'eng_texte',type:'area',rows:3,label:'Engagements à prendre (facultatif)',aide:'Laissez vide s’il n’y en a pas : le paragraphe ne figurera pas dans le document.'}
 ]},
 {id:'final',court:'Télécharger',titre:'Vérifier et télécharger',final:true,champs:[]}
];

function m2Defaults(){
  return {nb_assoc:'2',a0_civilite:'M.',a1_civilite:'M.',liberation:'integrale',industrie:'non',eval_mode:'commissaire',
    gerance_mode:'statuts',nb_ger:'1',g0_src:'a0',g0_civilite:'M.',duree_gerant:'4',preavis_gerant:'3',maj_nom:'moitie',limiter:'non',
    contest:'tribunal',m_src:'a0',m_civilite:'M.',date:todayISO()};
}
const M2_EXEMPLE={
  denomination:'ALPHA SERVICES',sigle:'',objet:'Commerce général, import-export de marchandises et prestations de services.',siege:'Abidjan, Cocody, Riviera Palmeraie, lot 12',
  nb_assoc:'2',
  a0_civilite:'M.',a0_prenom:'Yao',a0_nom:'Konan',a0_naissance_date:'1988-04-12',a0_naissance_lieu:'Bouaké',a0_nationalite:'ivoirienne',a0_profession:'commerçant',a0_adresse:'Abidjan, Cocody Angré',a0_piece:'CNI n° C 0000 0000 00',
  a1_civilite:'Mme',a1_prenom:'Aya',a1_nom:'Kouassi',a1_naissance_date:'1991-09-03',a1_naissance_lieu:'Abidjan',a1_nationalite:'ivoirienne',a1_profession:'comptable',a1_adresse:'Abidjan, Marcory Zone 4',a1_piece:'CNI n° C 1111 1111 11',
  nominal:'10000',liberation:'moitie',banque:'Banque Exemple, agence du Plateau',industrie:'non',
  a0_num:'2000000',a0_nat_desc:'',a0_nat_val:'',
  a1_num:'',a1_nat_desc:'un véhicule utilitaire de marque Toyota Hilux, immatriculé 0000 AB 01',a1_nat_val:'3000000',
  eval_mode:'dispense',
  gerance_mode:'statuts',nb_ger:'1',g0_src:'a0',duree_gerant:'4',preavis_gerant:'3',maj_nom:'moitie',limiter:'non',
  lieu:'Abidjan',nb_ex:'',contest:'tribunal',m_src:'a0',eng_mandataire:'',eng_texte:''
};

function m2Compute(S){
  const V=newV(),g=k=>String(S[k]==null?'':S[k]).trim(),gn=k=>g(k).replace(/\s*\n+\s*/g,' ');
  const T=m2Totals(S),n=T.n,pr=(k,val,src)=>{V[k]=val;if(src)V._src[k]=src;};
  const ind=g('industrie')==='oui';
  for(let i=0;i<n;i++) addPerson(V,S,'a',i);
  ['denomination','sigle','objet','siege','banque','lieu','commissaire','ord_ville','ord_requerant','eng_mandataire','eng_texte','limitations','maj_autre'].forEach(k=>{V[k]=gn(k);});
  V.denomination_maj=g('denomination').toUpperCase();V._src.denomination_maj='denomination';
  V.sigle_txt=g('sigle')?', en abrégé « '+g('sigle')+' »':'';V._src.sigle_txt='sigle';
  V.annee_lettres=anneeLettres(g('date'));V._src.annee_lettres='date';
  V.date_longue=dateFr(g('date'));V._src.date_longue='date';
  V.ord_date_longue=dateFr(g('ord_date'));V._src.ord_date_longue='ord_date';
  /* apports */
  const numIdx=[],natIdx=[],indIdx=[];
  for(let i=0;i<n;i++){
    const p='a'+i+'_';
    if(T.num[i]>0) numIdx.push(i);
    if(g(p+'nat_desc')||T.nat[i]>0) natIdx.push(i);
    if(ind&&(g(p+'ind_desc')||g(p+'ind_parts'))) indIdx.push(i);
    pr(p+'num_chiffres',T.num[i]?fmt(T.num[i]):'',p+'num');
    pr(p+'nat_val_chiffres',T.nat[i]?fmt(T.nat[i]):'',p+'nat_val');
    V[p+'nat_desc']=gn('a'+i+'_nat_desc');
    V[p+'ind_duree']=gn('a'+i+'_ind_duree');
    V[p+'ind_parts']=g(p+'ind_parts');
    const lines=g(p+'ind_desc').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if(!lines.length) lines.push('');
    V._indLines=V._indLines||{};V._indLines[i]=lines.length;
    lines.forEach((s,k)=>pr(p+'ind_l'+k,s,p+'ind_desc'));
  }
  const numAll=numIdx.length?numIdx:Array.from({length:n},(_,i)=>i);
  const natAll=natIdx.length?natIdx:[n-1];
  const indAll=indIdx.length?indIdx:[n-1];
  V._numIdx=numAll;V._natIdx=natAll;V._indIdx=indAll;
  /* numérotation des parts : numéraire d'abord, puis nature */
  let cur=1;
  for(let i=0;i<n;i++){
    const p='a'+i+'_',has=T.ok&&T.num[i]>0,k=has?T.num[i]/T.nom:0,s=has?'nominal':p+'num';
    pr(p+'np',has?fmt(k):'',s);pr(p+'nd',has?String(cur):'',s);pr(p+'nf',has?String(cur+k-1):'',s);
    if(has) cur+=k;
  }
  for(let i=0;i<n;i++){
    const p='a'+i+'_',has=T.ok&&T.nat[i]>0,k=has?T.nat[i]/T.nom:0,s=has?'nominal':p+'nat_val';
    pr(p+'vp',has?fmt(k):'',s);pr(p+'vd',has?String(cur):'',s);pr(p+'vf',has?String(cur+k-1):'',s);
    if(has) cur+=k;
  }
  const f0=numAll[0],f1=natAll[0];
  pr('num_tot',T.numTot?fmt(T.numTot):'','a'+f0+'_num');
  pr('num_tot_lettres',T.numTot?fcfa(T.numTot):'','a'+f0+'_num');
  pr('nat_tot',T.natTot?fmt(T.natTot):'','a'+f1+'_nat_val');
  pr('cap_chiffres',T.cap?fmt(T.cap):'','a'+f0+'_num');
  pr('cap_lettres',T.cap?fcfa(T.cap):'','a'+f0+'_num');
  pr('tot_chiffres',T.cap?fmt(T.cap):'','a'+f0+'_num');
  pr('nominal_chiffres',T.nom?fmt(T.nom):'','nominal');
  pr('parts',T.ok?fmt(T.parts):'','nominal');
  const moitie=g('liberation')==='moitie';
  V.liberation_txt=moitie?'de la moitié au moins':'intégralement';V._src.liberation_txt='liberation';V._nohl.add('liberation_txt');
  V.liberation_txt8=moitie?'de moitié au moins pour les apports en numéraire et intégralement pour les apports en nature':'intégralement';V._src.liberation_txt8='liberation';V._nohl.add('liberation_txt8');
  /* gérance */
  const dg=+g('duree_gerant')||0,pv=+g('preavis_gerant')||0;
  pr('duree_gerant_txt',dg?lettres(dg)+' '+(dg>1?'ans':'an'):'','duree_gerant');
  pr('preavis_txt',pv?lettres(pv)+' ('+pv+') mois':'','preavis_gerant');
  pr('maj_txt',g('maj_nom')==='autre'?gn('maj_autre'):'de plus de la moitié des parts',g('maj_nom')==='autre'?'maj_autre':'maj_nom');
  const ng=g('gerance_mode')==='ulterieur'?0:clamp(parseInt(g('nb_ger'),10)||1,1,3);
  V._ng=ng;
  for(let j=0;j<ng;j++){
    const src=g('g'+j+'_src'),k=/^a(\d+)$/.exec(src);
    if(k&&+k[1]<n){
      const a='a'+k[1]+'_',id='g'+j+'_';
      ['civ'].forEach(x=>{V[id+x]=V[a+x];V._src[id+x]=a+'civilite';V._nohl.add(id+x);});
      ['prenom','nom','adresse'].forEach(x=>{V[id+x]=V[a+x];V._src[id+x]=a+x;});
    }else addPerson(V,S,'g',j);
  }
  /* mandataire des formalités */
  const mk=/^a(\d+)$/.exec(g('m_src'));
  if(mk&&+mk[1]<n){
    const a='a'+mk[1]+'_';
    V.m_civ_long=V[a+'civ_long'];V._src.m_civ_long=a+'civilite';V._nohl.add('m_civ_long');
    V.m_nom_complet=(V[a+'prenom']+' '+V[a+'nom']).trim();V._src.m_nom_complet=a+'nom';
    V.m_prof=V[a+'profession'];V._src.m_prof=a+'profession';
    V.m_pc=V[a+'piece'];V._src.m_pc=a+'piece';
  }else{
    V.m_civ_long=g('m_civilite')==='Mme'?'Madame':'Monsieur';V._src.m_civ_long='m_civilite';V._nohl.add('m_civ_long');
    V.m_nom_complet=gn('m_nom');V._src.m_nom_complet='m_nom';
    V.m_prof=gn('m_profession');V._src.m_prof='m_profession';
    V.m_pc=gn('m_piece');V._src.m_pc='m_piece';
  }
  const nbx=+g('nb_ex')||(n+2);
  pr('nb_ex_txt',String(nbx),'nb_ex');pr('nb_ex_lettres_maj',lettres(nbx).toUpperCase(),'nb_ex');
  return V;
}

const M2_ART_A=[
 ART(9,'MODIFICATION DU CAPITAL SOCIAL'),
 P('9-1- Le capital social peut être augmenté, par décision extraordinaire des associés, soit par émission de parts nouvelles, soit par majoration du nominal des parts existantes.'),
 P('Les parts nouvelles sont libérées soit en espèces, soit par compensation avec des créances certaines, liquides et exigibles sur la société, soit par incorporation de réserves, bénéfices, soit par apport en nature.'),
 P('9-2- En cas d’augmentation de capital, les attributaires de parts nouvelles, s’ils n’ont déjà la qualité d’associés, devront être agréés dans les conditions fixées à l’article 11 ci-après.'),
 P('9-3- En cas d’augmentation de capital par voie d’apports en numéraire, chacun des associés a, proportionnellement au nombre de parts qu’il possède, un droit de préférence à la souscription des parts nouvelles représentatives de l’augmentation de capital.'),
 P('Le droit de souscription attaché aux parts anciennes peut être cédé sous réserve de l’agrément du cessionnaire dans les conditions prévues à l’article 11 ci-après.'),
 P('Les associés pourront, lors de la décision afférente à l’augmentation de capital, renoncer, en tout ou en partie, à leur droit préférentiel de souscription.'),
 P('La collectivité des associés peut également décider la suppression de ce droit.'),
 P('9-4- Dans tous les cas, si l’opération fait apparaître des rompus, les associés feront leur affaire personnelle de toute acquisition ou cession de droits nécessaires.'),
 P('9-5- Le capital social peut être réduit, soit par la diminution de la valeur nominale des parts, soit par la diminution du nombre de parts.'),
 P('La réduction du capital est autorisée ou décidée par l’Assemblée Générale Extraordinaire qui peut déléguer à la gérance les pouvoirs nécessaires pour la réaliser.'),
 ART(10,'DROIT DES PARTS'),
 P('Chaque part sociale confère à son propriétaire un droit égal dans les bénéfices de la société et dans tout l’actif social.'),
 ART(11,'CESSION DE PARTS ENTRE VIFS'),
 {k:'sub',text:'11-1- Forme'},
 P('Toute cession de parts sociales doit être constatée par écrit. Elle n’est opposable à la société qu’après accomplissement des formalités suivantes :'),
 L('signification de la cession à la société par acte extrajudiciaire ;'),
 L('acceptation de la cession par la société dans un acte authentique ;'),
 L('dépôt d’un original de l’acte de cession au siège social contre remise par le gérant d’une attestation de ce dépôt.'),
 P('La cession n’est opposable aux tiers qu’après l’accomplissement de l’une des formalités ci-dessus et modification des statuts et publicité au Registre du Commerce et du Crédit Mobilier.'),
 {k:'sub',text:'11-2- Cessions entre associés'},
 P('Les parts sociales sont librement cessibles entre associés.'),
 {k:'sub',text:'11-3- Cessions aux conjoints, ascendants ou descendants'},
 P('Les parts sociales sont librement cessibles entre conjoints, ascendants ou descendants.'),
 {k:'sub',text:'11-4- Cessions à des tiers'},
 P('Les parts ne peuvent être cédées à des tiers qu’avec le consentement de la majorité des associés représentant au moins les trois quarts (3/4) des parts sociales.'),
 P('Le projet de cession est notifié par l’associé cédant à la société et à chacun des associés par acte extrajudiciaire. Si la société n’a pas fait connaître sa décision dans le délai de trois (3) mois à compter de la dernière des notifications, le consentement à la cession est réputé acquis.'),
 P('Si la société refuse de consentir à la cession, les associés sont tenus, dans les trois (3) mois de la notification du refus, d’acquérir les parts à un prix qui, à défaut d’accord entre les parties, est fixé par un expert nommé par le président de la juridiction compétente à la demande de la partie la plus diligente. Le délai de trois (3) mois peut être prolongé une seule fois par ordonnance du président de la juridiction compétente, sans que cette prolongation puisse excéder cent vingt (120) jours.'),
 P('La société peut également, avec le consentement du cédant, décider, dans le même délai, de réduire son capital du montant de la valeur nominale desdites parts et de racheter ces parts au prix déterminé dans les conditions prévues ci-dessus. Si, à l’expiration du délai imparti, la société n’a pas racheté ou fait racheter les parts, l’associé peut réaliser la cession initialement prévue.'),
 P('Les dispositions qui précèdent sont applicables à tous les cas de cessions, y compris en cas d’apport au titre d’une fusion ou d’une scission ou encore à titre d’attribution en nature à la liquidation d’une autre société.'),
 ART(12,'TRANSMISSION DE PARTS PAR DÉCÈS OU LIQUIDATION DE COMMUNAUTÉ'),
 P('En cas de décès ou d’incapacité d’un associé, la société continue de plein droit entre les associés survivants et les héritiers et ayants droit de l’associé décédé. Lesdits héritiers, ayants droit ou conjoint devront justifier de leur identité personnelle et de leur qualité héréditaire par la production de toutes pièces appropriées.'),
 P('La gérance peut requérir de tout Notaire la délivrance d’expéditions ou d’extraits de tous actes établissant lesdites qualités. Lesdits héritiers, ayants droit et conjoint désignent un mandataire chargé de les représenter auprès de la société pendant la durée de l’indivision.'),
 ART(13,'NANTISSEMENT DES PARTS SOCIALES'),
 P('Le nantissement des parts est constaté par acte notarié ou sous seing privé, enregistré et signifié à la société et publié au Registre du Commerce et du Crédit Mobilier. Si la société a donné son consentement à un projet de nantissement de parts dans les conditions prévues pour les cessions de parts à des tiers, ce consentement emportera agrément du cessionnaire en cas de réalisation forcée des parts nanties, à moins que la société ne préfère, après la cession, racheter dans le délai les parts, en vue de réduire son capital.'),
 {k:'part',text:'TITRE II : FONCTIONNEMENT – DISSOLUTION'},
 ART(14,'COMPTES COURANTS'),
 P('Les associés peuvent laisser ou mettre à disposition de la société toutes sommes dont celle-ci peut avoir besoin. Les conditions de retrait ou de remboursement de ces sommes, ainsi que leur rémunération, sont déterminées soit par décisions collectives des associés, soit par accord entre la gérance et l’intéressé. Dans le cas où l’avance est faite par un gérant, ces conditions sont fixées par décision collective des associés. Ces accords sont soumis à la procédure de contrôle des conventions passées entre la société et l’un de ses gérants ou associés en ce qui concerne la rémunération des sommes mises à disposition.')
];

const M2_ART_B=[
 ART(17,'RESPONSABILITÉ DES GÉRANTS'),
 P('Les gérants sont responsables, individuellement ou solidairement, selon le cas, envers la société ou envers les tiers, soit des infractions aux dispositions législatives ou réglementaires applicables aux sociétés à responsabilité limitée, soit des violations des statuts, soit de fautes commises dans leur gestion. Si plusieurs gérants ont coopéré aux mêmes faits, le tribunal chargé des affaires commerciales détermine la part contributive de chacun dans la réparation du dommage.'),
 P('Aucune décision de l’Assemblée ne peut avoir pour effet d’éteindre une action en responsabilité contre les gérants pour faute commise dans l’accomplissement de leur mandat.'),
 {k:'sub',text:'Assiduité – Non-concurrence – Publicité'},
 P('1- Assiduité : les gérants sont tenus de consacrer le temps et les soins nécessaires aux affaires sociales.'),
 P('2- Non-concurrence : tout gérant s’interdit, directement ou indirectement, à quelque titre que ce soit, toute activité concurrente ou connexe à celle de la société et s’engage à informer les associés de la nature de toute activité professionnelle qu’il envisagerait d’entreprendre au cours de son mandat.'),
 P('3- Publicité : la nomination et la cessation des fonctions d’un gérant donnent lieu à publication dans les conditions prévues par la réglementation sur les sociétés commerciales.'),
 P('Ni la société, ni les tiers ne peuvent, pour se soustraire à leurs engagements, se prévaloir d’une irrégularité dans la nomination d’un gérant lorsque la nomination a été régulièrement publiée. La société ne peut se prévaloir, à l’égard des tiers, des nomination et cessation de fonctions d’un gérant, tant qu’elles n’ont pas été régulièrement publiées.'),
 P('Un gérant qui a cessé ses fonctions peut exiger, par toute voie de droit, l’accomplissement de toute publicité rendue nécessaire par la cessation de ses fonctions.'),
 ART(18,'DÉCISIONS COLLECTIVES'),
 P('18-1- La volonté des associés s’exprime par des décisions collectives qui obligent tous les associés, qu’ils aient ou non pris part.'),
 P('18-2- Les décisions collectives sont prises, au choix de la gérance, soit en assemblée, soit par consultation écrite, sauf dans les cas où la loi impose la tenue d’une assemblée.'),
 P('18-3- L’assemblée est convoquée par le ou les gérants individuellement ou collectivement ou, à défaut, par le commissaire aux comptes, s’il en existe un, ou encore par un mandataire désigné en justice à la demande de tout associé.'),
 P('Pendant la liquidation, les assemblées sont convoquées par le ou les liquidateurs.'),
 P('Les assemblées sont réunies au lieu indiqué dans la convocation. La convocation est faite par lettre recommandée avec demande d’avis de réception ou par lettre au porteur contre récépissé adressée à chacun des associés, quinze (15) jours au moins avant la date de la réunion. Celle-ci indique l’ordre du jour.'),
 P('L’assemblée est présidée par le gérant ou par l’un des gérants. Si aucun des gérants n’est associé, elle est présidée par l’associé présent ou acceptant qui possède ou représente le plus grand nombre de parts. Si deux associés qui possèdent ou représentent le même nombre de parts sont acceptants, la présidence de l’assemblée est assurée par le plus âgé.'),
 P('La délibération est constatée par un procès-verbal qui indique la date et le lieu de la réunion, les noms et prénoms des associés présents, le nombre de parts sociales détenues par chacun, les documents et rapports soumis à l’assemblée, un résumé des débats, le texte des résolutions mises aux voix et le résultat des votes. Les procès-verbaux sont signés par chacun des associés présents.'),
 P('18-4- En cas de consultation écrite, le texte des résolutions proposées ainsi que les documents nécessaires à l’information des associés sont adressés à chacun d’eux par lettre recommandée avec demande d’avis de réception ou par lettre au porteur contre récépissé. Les associés disposent d’un délai minimal de quinze (15) jours, à compter de la date de réception des projets de résolutions, pour émettre leur vote par écrit.'),
 P('La réponse est faite par lettre recommandée avec demande d’avis de réception ou par lettre contre récépissé. Tout associé n’ayant pas répondu dans le délai ci-dessus est considéré comme s’étant abstenu.'),
 P('La consultation est mentionnée dans un procès-verbal, auquel est annexée la réponse de chaque associé.'),
 P('18-5- Chaque associé a le droit de participer aux décisions et dispose d’un nombre de voix égal à celui des parts sociales qu’il possède.'),
 P('18-6- Un associé peut se faire représenter par son conjoint à moins que la société ne comprenne que les deux époux. Sauf si les associés sont au nombre de deux, un associé peut se faire représenter par un autre associé.'),
 P('Tout associé peut se faire représenter par la personne de son choix.'),
 ART(19,'DÉCISIONS COLLECTIVES ORDINAIRES'),
 P('Sont qualifiées d’ordinaires, les décisions des associés ayant pour but de statuer sur les états financiers de synthèse, d’autoriser la gérance à effectuer les opérations subordonnées dans les statuts à l’accord préalable des associés, de nommer et de remplacer les gérants et, le cas échéant, le commissaire aux comptes, d’approuver les conventions intervenues entre la société et les gérants et associés et plus généralement de statuer sur toutes les questions qui n’entraînent pas modification des statuts.'),
 P('Ces décisions sont valablement adoptées par un ou plusieurs associés représentant plus de la moitié des parts sociales. Si cette majorité n’est pas obtenue, les associés sont, selon le cas, convoqués ou consultés une seconde fois, et les décisions sont prises à la majorité des votes émis, quel que soit le nombre de votants.'),
 P('Toutefois, la révocation des gérants doit toujours être décidée à la majorité absolue.'),
 ART(20,'DÉCISIONS COLLECTIVES EXTRAORDINAIRES'),
 P('Sont qualifiées d’extraordinaires, les décisions des associés ayant pour objet de statuer sur la modification des statuts, sous réserve des exceptions prévues par la loi.'),
 P('Les modifications des statuts sont adoptées par les associés représentant au moins les trois quarts (3/4) des parts sociales.'),
 P('Toutefois, l’unanimité est requise dans les cas suivants :'),
 L('augmentation des engagements des associés ;'),
 L('transformation de la société en société en nom collectif ;'),
 L('transfert du siège social dans un État autre qu’un État partie au Traité OHADA.'),
 P('La décision d’augmenter le capital social par incorporation de bénéfices, de réserves ou de primes d’apports, d’émission ou de fusion est prise par les associés représentant au moins la moitié des parts sociales.'),
 ART(21,'DROIT DE COMMUNICATION DES ASSOCIÉS'),
 P('Lors de toute consultation des associés, chacun d’eux a le droit d’obtenir communication des documents et informations nécessaires pour lui permettre de se prononcer en connaissance de cause et de porter un jugement sur la gestion de la société.'),
 P('La nature de ces documents et les conditions de leur envoi ou mise à disposition sont déterminées par la loi.'),
 ART(22,'COMPTES SOCIAUX'),
 P('À la clôture de chaque exercice, le gérant établit et arrête les états financiers de synthèse conformément aux dispositions de l’Acte uniforme portant organisation et harmonisation des comptabilités.'),
 P('Le gérant établit un rapport de gestion dans lequel il expose la situation de la société durant l’exercice écoulé, son évolution prévisible et, en particulier, les perspectives de continuation de l’activité, l’évolution de la situation de trésorerie et le plan de financement.'),
 P('Ces documents ainsi que les textes des résolutions proposées et, le cas échéant, les rapports du commissaire aux comptes sont communiqués aux associés dans les conditions et délais prévus par les dispositions légales et réglementaires.'),
 P('À compter de cette communication, tout associé a la possibilité de poser par écrit des questions auxquelles le gérant sera tenu de répondre au cours de l’assemblée.'),
 P('Une assemblée générale appelée à statuer sur les comptes de l’exercice écoulé doit être réunie chaque année dans les six (6) mois de la clôture de l’exercice ou, en cas de prolongation, dans le délai fixé par décision de justice.'),
 ART(23,'AFFECTATION DES RÉSULTATS'),
 P('Après approbation des comptes et constatation de l’existence d’un bénéfice distribuable, l’Assemblée Générale détermine la part attribuée aux associés sous forme de dividende.'),
 P('Il est pratiqué sur le bénéfice de l’exercice diminué, le cas échéant, des pertes antérieures, une dotation égale à un dixième au moins affectée à la formation d’un fonds de réserve dit « réserve légale ». Cette dotation cesse d’être obligatoire lorsque la réserve atteint le cinquième du montant du capital social.'),
 P('Les sommes dont la mise en distribution est décidée sont réparties entre les associés titulaires de parts, proportionnellement au nombre de leurs parts.'),
 P('L’assemblée générale a la faculté de constituer tous postes de réserves.'),
 P('Elle peut procéder à la distribution de tout ou partie des réserves à la condition qu’il ne s’agisse pas de réserves déclarées indisponibles par la loi ou par les statuts. Dans ce cas, elle indique expressément les postes de réserve sur lesquels les prélèvements sont effectués.'),
 P('La société est tenue de déposer au Registre du Commerce et du Crédit Mobilier du lieu du siège social, dans le mois qui suit leur approbation par les organes compétents, les états financiers de synthèse, à savoir le bilan, le compte de résultat, le tableau des ressources et des emplois et l’état annexé de l’exercice écoulé.'),
 ART(24,'VARIATION DES CAPITAUX PROPRES'),
 P('Si du fait des pertes constatées dans les états financiers de synthèse, les capitaux propres de la société deviennent inférieurs à la moitié du capital social, le gérant ou, le cas échéant, le commissaire aux comptes doit, dans les quatre (4) mois qui suivent l’approbation des comptes ayant fait apparaître cette perte, consulter les associés sur l’opportunité de prononcer la dissolution anticipée de la société.'),
 P('Si la dissolution est écartée, la société est tenue, dans les deux (2) ans qui suivent la date de clôture de l’exercice déficitaire, de reconstituer ses capitaux propres jusqu’à ce que ceux-ci soient à la hauteur de la moitié au moins du capital social.'),
 P('À défaut, elle doit réduire son capital d’un montant au moins égal à celui des pertes qui n’ont pu être imputées sur les réserves, à la condition que cette réduction du capital n’ait pas pour effet de réduire le capital à un montant inférieur à celui du capital légal.'),
 P('À défaut par le gérant ou le commissaire aux comptes de provoquer cette décision ou si les associés n’ont pu délibérer valablement, tout intéressé peut demander à la juridiction compétente de prononcer la dissolution de la société. Il en est de même si la reconstitution des capitaux propres n’est pas intervenue dans les délais prescrits.'),
 ART(25,'CONTRÔLE DES COMPTES'),
 P('Un ou plusieurs commissaires aux comptes titulaires et suppléants seront désignés lorsque, à la clôture d’un exercice social, la société remplit deux des conditions suivantes :'),
 L('total du bilan supérieur à cent vingt-cinq millions (125 000 000) de francs CFA ;'),
 L('chiffre d’affaires annuel supérieur à deux cent cinquante millions (250 000 000) de francs CFA ;'),
 L('effectif permanent supérieur à cinquante (50) personnes.'),
 P('Le commissaire aux comptes est nommé pour trois (3) exercices par un ou plusieurs associés représentant plus de la moitié du capital.'),
 ART(26,'DISSOLUTION'),
 P('La société à responsabilité limitée est dissoute pour les causes communes à toutes sociétés.'),
 P('La dissolution de la société entraîne sa mise en liquidation. Le ou les gérants en fonction lors de la dissolution exercent les fonctions de liquidateurs, à moins qu’une décision collective des associés ne désigne un ou plusieurs autres liquidateurs, choisis parmi les associés ou les tiers. Les pouvoirs du liquidateur, ou de chacun d’eux s’ils sont plusieurs, sont déterminés par la collectivité des associés.'),
 P('Le boni de liquidation est réparti entre les associés au prorata du nombre de parts qu’ils détiennent.'),
 P('Si toutes les parts sociales sont réunies en une seule main, l’expiration de la société ou sa dissolution pour quelque cause que ce soit entraîne la transmission universelle du patrimoine social à l’associé unique, sans qu’il y ait lieu à liquidation, sous réserve du droit d’opposition des créanciers.')
];

function m2Blocks(S,V){
  const T=m2Totals(S),n=T.n,B=[],ap=(...x)=>{x.forEach(y=>B.push(y));};
  const ind=String(S.industrie)==='oui',moitie=S.liberation==='moitie';
  const R=['I','II','III','IV','V'];let rn=0;
  ap({k:'tit',text:'STATUTS DE LA SOCIÉTÉ À RESPONSABILITÉ LIMITÉE DÉNOMMÉE'},{k:'tit',text:'« {{denomination_maj}} SARL »'},{k:'sp'},
     P('L’an {{annee_lettres}},'),P('Le {{date_longue}},'),P('**Entre les soussignés,**'));
  const lines=[];
  for(let i=0;i<n;i++){
    lines.push('**'+ASSO(i)+'**, {{a'+i+'_ne}} le {{a'+i+'_naissance}} à {{a'+i+'_naissance_lieu}}, de nationalité {{a'+i+'_nationalite}}, {{a'+i+'_profession}}');
    lines.push('Demeurant à {{a'+i+'_adresse}}. Pièce d’identité : {{a'+i+'_piece}}');
    if(i<n-1) lines.push('');
  }
  ap({k:'box',lines:lines},P('Il a été établi par les présentes, les statuts de la Société à Responsabilité Limitée dont la teneur suit :'));
  ap({k:'part',text:'TITRE I : DISPOSITIONS GÉNÉRALES'},
   ART(1,'FORME'),
   P('Il est constitué par les soussignés, une Société à Responsabilité Limitée devant exister entre eux et tous propriétaires de parts sociales ultérieures, qui sera régie par l’Acte Uniforme révisé de l’OHADA du 30 janvier 2014 relatif au droit des Sociétés commerciales et du Groupement d’intérêt économique (GIE), ainsi que par toutes autres dispositions légales ou réglementaires applicables et les présents statuts.'),
   ART(2,'DÉNOMINATION'),
   P('La société a pour dénomination : **{{denomination}}**{{?sigle_txt}}'),
   P('La dénomination sociale doit figurer sur tous les actes et documents émanant de la société et destinés aux tiers, notamment les lettres, les factures, les annonces et publications diverses. Elle doit être précédée ou suivie immédiatement en caractères lisibles de l’indication Société à Responsabilité Limitée ou SARL, du montant de son capital social, de l’adresse de son siège social et de la mention de son immatriculation au Registre du Commerce et du Crédit Mobilier.'),
   ART(3,'OBJET'),
   P('La société a pour objet en CÔTE D’IVOIRE :'),
   P('{{objet}}'),
   P('Et pour la réalisation de l’objet social :'),
   L('l’acquisition, la location et la vente de tous biens meubles et immeubles ;'),
   L('l’emprunt de toutes sommes auprès de tous établissements financiers avec possibilité de donner en garantie tout ou partie des biens sociaux ;'),
   L('la prise en location gérance de tous fonds de commerce ;'),
   L('la prise de participation dans toute société existante ou devant être créée ;'),
   L('et généralement, toutes opérations financières, commerciales, industrielles, mobilières et immobilières, se rapportant directement ou indirectement à l’objet social ou pouvant en faciliter l’extension ou le développement.'),
   ART(4,'SIÈGE SOCIAL'),
   P('Le siège social est fixé à : {{siege}}'),
   P('Il peut être transféré dans les limites du territoire de la République de CÔTE D’IVOIRE par décision de la gérance qui modifie en conséquence les statuts, sous réserve de la ratification de cette décision par la plus prochaine Assemblée Générale Ordinaire.'),
   ART(5,'DURÉE'),
   P('La durée de la société est de quatre-vingt-dix-neuf (99) années, sauf dissolution anticipée ou prorogation.'),
   ART(6,'EXERCICE SOCIAL'),
   P('L’exercice social commence le premier janvier et se termine le trente et un décembre de chaque année.'),
   P('Par exception, le premier exercice sera clos le trente et un décembre de l’année suivante si la société commence ses activités au-delà des six premiers mois de l’année en cours.'));
  /* Article 7 : apports */
  ap(ART(7,'APPORTS'));
  ap({k:'sub',text:R[rn++]+' – Apports en numéraire'},P('Lors de la constitution, les soussignés ont fait apport à la société, à savoir :'));
  const nrows=V._numIdx.map(i=>[ASSO(i),'{{a'+i+'_num_chiffres}} F CFA']);
  nrows.push(['**Total des apports en numéraire :** {{num_tot_lettres}}, ci {{num_tot}} F CFA','**{{num_tot}} F CFA**']);
  ap({k:'table',cols:[62,38],al:['left','right'],head:['IDENTITÉ DES APPORTEURS','MONTANT DE L’APPORT EN NUMÉRAIRE'],rows:nrows});
  ap(P('Les apports en numéraire de {{num_tot}} F CFA ({{num_tot_lettres}}) correspondent à '+(T.ok&&T.numTot?fmt(T.numTot/T.nom):'{{parts}}')+' parts sociales de {{nominal_chiffres}} F CFA chacune, souscrites et libérées {{liberation_txt}} par les associés.'));
  if(moitie) ap(P('La libération de la seconde moitié par les associés ayant effectué une libération partielle des parts sociales devra intervenir, à la demande du Gérant, en une ou plusieurs fois dans un délai de deux années à compter de l’immatriculation de la société au Registre du Commerce et du Crédit Mobilier.'));
  ap(P('La somme correspondante a été déposée pour le compte de la société et conformément à la loi, dans un compte ouvert à {{banque}}.'));
  ap({k:'sub',text:R[rn++]+' – Apports en nature'});
  V._natIdx.forEach(i=>{
    ap(P('{{a'+i+'_civ}} {{a'+i+'_prenom}} {{a'+i+'_nom}}, en s’obligeant à toutes les garanties ordinaires et de droit, fait apport à la société de : {{a'+i+'_nat_desc}}'));
  });
  if(S.eval_mode==='ordonnance') ap(P('Il a été procédé à l’évaluation de chacun des apports en nature ci-dessus au vu du rapport annexé aux présents statuts, établi par {{commissaire}}, commissaire aux apports désigné par ordonnance du président du tribunal chargé des affaires commerciales de {{ord_ville}}, en date du {{ord_date_longue}}, à la requête de {{ord_requerant}}.'));
  else if(S.eval_mode==='dispense') ap(P('Aucun des apports en nature n’ayant une valeur supérieure à 5 000 000 F CFA et la valeur totale desdits apports n’excédant pas 5 000 000 F CFA, les associés, à l’unanimité, ont décidé de ne pas recourir à un commissaire aux apports et ont procédé eux-mêmes à l’évaluation.'));
  else ap(P('Il a été procédé à l’évaluation de chacun des apports en nature ci-dessus au vu du rapport annexé aux présents statuts, établi par {{commissaire}}, commissaire aux apports désigné à l’unanimité des futurs associés.'));
  V._natIdx.forEach(i=>{
    ap(P('En rémunération de son apport, évalué à {{a'+i+'_nat_val_chiffres}} F CFA, {{a'+i+'_civ}} {{a'+i+'_prenom}} {{a'+i+'_nom}} se voit attribuer {{a'+i+'_vp}} parts sociales.'));
  });
  if(ind){
    ap({k:'sub',text:R[rn++]+' – Apports en industrie'});
    V._indIdx.forEach(i=>{
      ap(P('{{a'+i+'_civ}} {{a'+i+'_prenom}} {{a'+i+'_nom}}, en s’obligeant à rendre à la société la contribution promise et à lui devoir compte de tous gains qu’{{a'+i+'_il}} aurait réalisés par l’activité faisant l’objet de son apport, fait apport à la société de ses connaissances techniques, professionnelles ou services consistant à :'));
      const cnt=(V._indLines&&V._indLines[i])||1;
      for(let k=0;k<cnt;k++) ap(L('{{a'+i+'_ind_l'+k+'}}'));
      ap(P('Les prestations relatives à cette activité professionnelle, qu’{{a'+i+'_il}} apporte en société, seront fournies à la société pour une durée de {{a'+i+'_ind_duree}}.'));
      ap(P('En rémunération de son apport en industrie, {{a'+i+'_civ}} {{a'+i+'_prenom}} {{a'+i+'_nom}} se voit attribuer {{a'+i+'_ind_parts}} parts sociales, ouvrant, avec charge de contribuer aux pertes de la société, le droit au vote et au partage des bénéfices et de l’actif net, dans une proportion qui n’excède pas à la fois 25 % de l’ensemble des droits de vote, des bénéfices, de l’actif net et des pertes.'));
    });
    ap(P('En cas de cessation de son activité, les parts sociales ainsi attribuées seront liquidées à un montant forfaitaire arrêté par les autres associés sans que l’apporteur en industrie ne participe au vote.'));
  }
  ap({k:'sub',text:R[rn++]+' – Récapitulation des apports au capital social'},
     {k:'table',cols:[62,38],al:['left','right'],head:['NATURE DES APPORTS','MONTANT'],rows:[
       ['Apports en numéraire','{{num_tot}} F CFA'],
       ['Apports en nature','{{nat_tot}} F CFA'],
       ['**Total des apports**','**{{tot_chiffres}} F CFA**']]});
  /* Article 8 : capital */
  ap(ART(8,'CAPITAL SOCIAL'),
     P('Le capital social est fixé à la somme de {{cap_chiffres}} F CFA, divisé en {{parts}} parts sociales de {{nominal_chiffres}} F CFA chacune, entièrement souscrites et libérées {{liberation_txt8}}, numérotées de 1 à {{parts}}, attribuées aux associés, à savoir :'));
  const crows=[];
  V._numIdx.forEach(i=>crows.push(['À '+ASSO(i)+', {{a'+i+'_np}} parts sociales numérotées de {{a'+i+'_nd}} à {{a'+i+'_nf}} inclus, en rémunération de son apport en numéraire ci-dessus','**{{a'+i+'_np}} PARTS**']));
  V._natIdx.forEach(i=>crows.push(['À '+ASSO(i)+', {{a'+i+'_vp}} parts sociales numérotées de {{a'+i+'_vd}} à {{a'+i+'_vf}} inclus, en rémunération de son apport en nature ci-dessus','**{{a'+i+'_vp}} PARTS**']));
  crows.push(['**TOTAL ÉGAL** au nombre de parts composant le capital social, soit {{parts}} parts sociales, ci-contre','**{{parts}} PARTS**']);
  ap({k:'table',cols:[72,28],al:['left','right'],head:['IDENTITÉ DES ASSOCIÉS','CONCURRENCE DES PARTS'],rows:crows});
  M2_ART_A.forEach(b=>B.push(b));
  /* Article 15 : gérance */
  ap(ART(15,'GÉRANCE'));
  ap(P('La société est gérée par une ou plusieurs personnes physiques, choisies parmi les associés ou en dehors d’eux. Elles sont nommées pour une durée de {{duree_gerant_txt}} et sont toujours rééligibles. La nomination des gérants au cours de la vie sociale est décidée à la majorité {{maj_txt}}.'));
  for(let j=0;j<V._ng;j++) ap(P('Est nommé gérant de la société : {{g'+j+'_civ}} {{g'+j+'_prenom}} {{g'+j+'_nom}}, demeurant à {{g'+j+'_adresse}}, qui accepte.'));
  ap(P('Les gérants reçoivent, à titre de rémunération de leurs fonctions et en compensation de la responsabilité attachée à la gestion de la société, un traitement dont le montant et les modalités de paiement sont déterminés par décision collective ordinaire des associés. Ce traitement peut être fixe ou proportionnel ou à la fois fixe et proportionnel selon des modalités arrêtées par les associés. Il peut comprendre, également, des avantages en nature et, éventuellement, être augmenté de gratifications exceptionnelles en cours ou en fin d’exercice social. Chaque gérant a droit au remboursement, sur justification, de ses frais de représentation et de déplacement.'),
     P('Les sommes versées aux gérants à titre de rémunération ou en remboursement de frais sont inscrites en dépenses d’exploitation. Les gérants sont soumis aux obligations fixées par la loi et les règlements et notamment à l’établissement des comptes annuels et du rapport de gestion.'),
     P('Les gérants peuvent démissionner de leur mandat, mais seulement en prévenant chacun des associés au moins {{preavis_txt}} à l’avance, par lettre recommandée avec demande d’avis de réception ou lettre au porteur contre récépissé.'),
     P('Les gérants sont révocables par décision des associés représentant plus de la moitié des parts sociales.'),
     P('La rémunération des gérants est fixée par la décision qui les nomme.'));
  ap(ART(16,'POUVOIRS DU GÉRANT'),P('Dans les rapports entre associés, le gérant peut faire tous les actes de gestion dans l’intérêt de la société.'));
  if(S.limiter==='oui') ap(P('Cependant, il ne peut, sans y être autorisé par une décision collective ordinaire des associés : {{limitations}}'));
  ap(P('Dans les rapports avec les tiers, le gérant est investi des pouvoirs les plus étendus pour agir en toutes circonstances, au nom de la société, sous réserve des pouvoirs expressément attribués aux associés par la loi.'),
     P('La société est engagée, même par les actes du gérant qui ne relèvent pas de l’objet social, à moins qu’elle ne prouve que le tiers savait que l’acte dépassait cet objet ou qu’il ne pouvait l’ignorer compte tenu des circonstances, étant exclu que la seule publication des statuts suffise à constituer cette preuve.'));
  M2_ART_B.forEach(b=>B.push(b));
  /* Articles 27 à 31 */
  ap(ART(27,'CONTESTATIONS ENTRE ASSOCIÉS OU ENTRE UN OU PLUSIEURS ASSOCIÉS ET LA SOCIÉTÉ'));
  if(S.contest==='arbitrage') ap(P('Les contestations relatives aux affaires de la société, survenant pendant la durée de la société ou au cours de sa liquidation, entre les associés ou entre un ou plusieurs associés et la société, sont soumises à l’arbitrage conformément aux dispositions de l’Acte Uniforme de l’OHADA s’y rapportant.'));
  else ap(P('Les contestations relatives aux affaires de la société survenant pendant la vie de la société ou au cours de sa liquidation, entre les associés ou entre un ou plusieurs associés et la société, sont soumises au tribunal chargé des affaires commerciales.'));
  ap(ART(28,'ENGAGEMENTS POUR LE COMPTE DE LA SOCIÉTÉ'),
     P('Un état des actes accomplis par les fondateurs pour le compte de la société en formation, avec indication de l’engagement qui en résulterait, sera présenté à la société qui s’engage à les reprendre.'));
  if(String(S.eng_mandataire||'').trim()||String(S.eng_texte||'').trim()) ap(P('En outre, les soussignés donnent mandat à {{eng_mandataire}} à l’effet de prendre les engagements suivants au nom et pour le compte de la société : {{eng_texte}}'));
  ap(ART(29,'FRAIS'),P('Les frais, droits et honoraires des présents statuts sont à la charge de la société.'),
     ART(30,'ÉLECTION DE DOMICILE'),P('Pour l’exécution des présentes et de leurs suites, les parties déclarent faire élection de domicile au siège social.'),
     ART(31,'POUVOIRS'),
     P('Les associés donnent tous pouvoirs à {{m_civ_long}} {{m_nom_complet}}, {{m_prof}}, titulaire de la pièce d’identité : {{m_pc}}, à l’effet de procéder à l’enregistrement des présents statuts, d’accomplir les formalités d’immatriculation au Registre du Commerce et du Crédit Mobilier, et, pour les besoins de ces formalités, de signer tout acte et d’en donner bonne et valable décharge.'),
     {k:'sp',kn:true},
     P('Fait à {{lieu}}, le {{date_longue}}',{kn:true}),
     P('EN {{nb_ex_lettres_maj}} ({{nb_ex_txt}}) EXEMPLAIRES ORIGINAUX',{kn:true}),
     {k:'sp',kn:true},P('**Les associés**',{kn:true}));
  const sg=[];for(let i=0;i<n;i++) sg.push('**'+ASSO(i)+'**');
  ap({k:'sigs',items:sg});
  return B;
}

const M2={
  id:'sarl-pluripersonnelle-mixte',cat:'prive',
  titre:'Statuts de SARL pluripersonnelle',
  sous:'Plusieurs associés, apports mixtes',
  resume:'Pour créer une SARL à deux associés ou plus, avec des apports en numéraire, en nature et, si besoin, en industrie. 31 articles.',
  tags:['OHADA','Côte d’Ivoire','2 à 8 associés','Numéraire et nature'],
  duree:'20 min',
  etapes:M2_ETAPES,
  defaults:m2Defaults,
  exemple:M2_EXEMPLE,
  compute:m2Compute,
  blocks:m2Blocks,
  docTitle:V=>'Statuts '+(V.denomination_maj||'SARL pluripersonnelle'),
  fileBase:V=>'Statuts-'+(fileSlug(V.denomination)?fileSlug(V.denomination)+'-':'')+'SARL-pluripersonnelle',
  finalNote:'Joignez aux statuts le rapport du commissaire aux apports s’il y en a un, et l’état des actes accomplis pour le compte de la société en formation (article 28).',
  headline:S=>S.denomination||'',
  next:'declaration-souscription-versement'
};
JPModels.add(M2);
