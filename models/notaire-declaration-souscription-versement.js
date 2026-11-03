/* @needs _socle-notaires */
/* ============================================================
   N3 : déclaration notariée de souscription et de versement
   ============================================================ */
function nDnsvSources(){return nSources();}
function nSources(){
  const out=[];
  [['notaire-sarl-statuts-un-gerant','Statuts de SARL, un gérant'],['notaire-sarl-statuts-cogerance','Statuts de SARL, co-gérance'],['notaire-mise-a-jour-statuts-cession','Mise à jour des statuts avec cession de parts']].forEach(x=>{
    const o=loadDraftO(x[0]);
    if(o&&(o.v.denomination||o.v.a0_nom||o.v.a0_prenom)) out.push({id:x[0],titre:x[1],S:o.v,t:o.t||0});
  });
  out.sort((a,b)=>b.t-a.t);
  return out;
}
function nImport(){
  const src=nSources()[0];if(!src) return null;
  const S=src.S,P={};
  NOTAIRE_KEYS.concat(['denomination','objet','siege_ville','siege_commune','siege_quartier','siege_bp','nominal','date']).forEach(k=>{if(S[k]!=null) P[k]=S[k];});
  const n=nAssoc(S);P.nb_assoc=String(n);
  const nom=+S.nominal||0;
  for(let i=0;i<n;i++){
    NIDKEYS.forEach(k=>{if(S['a'+i+'_'+k]!=null) P['a'+i+'_'+k]=S['a'+i+'_'+k];});
    let parts=+S['a'+i+'_parts']||0;
    if(!parts&&nom) parts=Math.floor((+S['a'+i+'_apport']||0)/nom);
    P['a'+i+'_parts']=parts?String(parts):'';
  }
  return {patch:P,titre:src.titre};
}
function nDnsvTotals(S){return nParts(S,'parts');}
function nDnsvCompute(S){
  const V=nBase(S);nObjetV(V,S);const T=nPartsV(V,S,'parts');
  nSet(V,'verse_tot',T.cap?fmt(T.cap):'','a0_parts');
  for(let i=0;i<T.n;i++){nSet(V,'a'+i+'_souscrit',T.mont[i]?fmt(T.mont[i]):'','a'+i+'_parts');nSet(V,'a'+i+'_nbp',T.parts[i]?fmt(T.parts[i]):'','a'+i+'_parts');}
  return V;
}
function nDnsvBlocks(S,V){
  const T=nParts(S,'parts'),n=T.n;
  const B=nIntro(S,V,['DECLARATION NOTARIEE','DE SOUSCRIPTION ET DE VERSEMENT','SARL « {{denomination_maj}} »']);
  B.push(P('LESQUELS, préalablement à la Déclaration Notariée de Souscription et de Versement, objet des présentes, ont exposé ce qui suit :'),
    {k:'part',text:'E X P O S E'},
    P('Les Comparants ont l’intention de constituer une Société à Responsabilité Limitée devant avoir pour :'),
    P('**Objet** : En République de CÔTE D’IVOIRE :'));
  nObjetLis(S).forEach(b=>B.push(b));
  B.push(P('**Dénomination sociale** : « {{denomination_maj}} ».'),
    P('**Siège social** : {{siege_txt}}'),
    P('**Durée** : Quatre vingt dix neuf (99) ans.'),
    P('**Capital** : {{cap_lettres}} ({{cap}} FCFA).'),
    P('Il sera divisé en {{parts_lettres}} ({{parts}}) parts sociales de {{nominal_lettres}} ({{nominal}} FCFA) chacune numérotées de 1 à {{parts}}.'),
    {k:'part',text:'CECI EXPOSE :'},
    P('Les Comparants ont déposé au Notaire Soussigné, ainsi qu’il est dit dans la liste des souscripteurs en vue de la constitution de la Société à Responsabilité Limitée, ladite somme de {{cap_lettres}} ({{cap}} FCFA), montant du capital et ont déclaré que :'),
    P('1- Les {{parts_lettres}} ({{parts}}) parts sociales représentant le capital de la Société dénommée « {{denomination_maj}} », ont été souscrites en numéraire.'),
    P('2- Il a été versé par les Comparants, une somme égale à la valeur des parts en numéraire souscrites par eux, soit au total, la somme de {{cap_lettres}} ({{cap}} FCFA) ; laquelle somme a été déposée à la Comptabilité de Maître {{notaire_sign}}, Notaire Soussigné.'),
    P('A l’appui de cette Déclaration, les Comparants ont présenté au Notaire Soussigné, un état dressé sur une feuille de papier timbrée à CINQ CENT FRANCS CFA (500 FCFA), certifiée sincère et véritable par lui, ce jour, contenant leur identité, le nombre de parts souscrites ainsi que le montant des versements effectués par eux ; laquelle pièce demeurera ci-annexée.'),
    P('En conséquence et par application des dispositions légales et réglementaires, le Notaire Soussigné affirme que le montant du versement mentionné sur l’Etat des Souscripteurs, représentant au total la somme de {{cap_lettres}} ({{cap}} FCFA), est conforme au montant des sommes déposées à l’Etude de Maître {{notaire_sign}}, Notaire Soussigné au compte de la Société.'));
  nClosing(S,V).forEach(b=>B.push(b));
  /* Annexe : liste des souscripteurs */
  B.push({k:'pb'},{k:'tit',text:'« {{denomination_maj}} »'},{k:'tit',text:'SOCIETE A RESPONSABILITE LIMITEE'},{k:'tit',text:'AU CAPITAL DE {{cap}} FCFA'},
    {k:'tit',text:'SIEGE SOCIAL : {{siege_txt}}'},{k:'sp'},{k:'tit',text:'LISTE DES SOUSCRIPTEURS ET ETAT DES VERSEMENTS'},{k:'sp'});
  const rows=[];
  for(let i=0;i<n;i++) rows.push([
    ['**'+(i+1)+') {{a'+i+'_civ_long}} {{a'+i+'_prenom}} {{a'+i+'_nom}}**, {{a'+i+'_profession}}, demeurant à {{a'+i+'_ville}}, Commune de {{a'+i+'_commune}}, Quartier {{a'+i+'_quartier}}{{?a'+i+'_bp_txt}}'],
    '{{a'+i+'_nbp}}','{{a'+i+'_souscrit}}','{{a'+i+'_souscrit}}']);
  rows.push([['**TOTAL :**','- Des parts souscrites','- Du nominal des parts souscrites','- Des versements de libération'],['','**{{parts}}**','',''],['','','**{{cap}}**',''],['','','','**{{verse_tot}}**']]);
  B.push({k:'table',cols:[46,16,19,19],al:['left','center','right','right'],size:10.5,
    head:['NOM, PRÉNOMS, PROFESSIONS, DOMICILE DES SOUSCRIPTEURS','NOMBRE DE PARTS SOUSCRITES','MONTANT DE LA SOUSCRIPTION (FCFA)','MONTANT DES VERSEMENTS (FCFA)'],rows:rows},
    P('Le présent état est certifié exact et véritable par les associés présents.'),
    P('{{notaire_ville}}, le {{date_longue}}',{al:'left'}),{k:'sp'});
  const it=[];for(let i=0;i<n;i++) it.push('{{a'+i+'_civ_mr}} {{a'+i+'_prenom}} {{a'+i+'_nom}}');
  B.push({k:'sigs',items:it});
  return B;
}
const N3=(function(){
  const assoc=nStepAssocies({import:true,titre:'Les comparants et leurs parts',intro:'Pour chaque associé : son identité et les parts souscrites. Le versement est égal à la valeur des parts souscrites.'});
  const rep=assoc.champs[assoc.champs.length-1];
  const baseFields=rep.fields;
  rep.fields=(i)=>baseFields(i).concat([{id:'a'+i+'_parts',group:'Associé '+(i+1),type:'int',unit:'parts',label:'Parts souscrites',half:true,ph:'Ex. : 60'}]);
  rep.keys=NIDKEYS.concat(['parts']);
  return {
    id:'notaire-declaration-souscription-versement',cat:'societes-associations',titre:'Déclaration notariée de souscription et de versement',sous:'Avec la liste des souscripteurs en annexe',
    resume:'Acte reçu par le notaire qui constate la souscription du capital et le versement des fonds, accompagné de la liste des souscripteurs. Reprend vos statuts notariés en un clic.',
    tags:['Notaire','OHADA','Numéraire','Annexe incluse'],duree:'10 min',
    etapes:[nStepNotaire(),nStepSociete(),assoc,
      {id:'capital',court:'Capital',titre:'Capital',intro:'Le capital est calculé à partir des parts souscrites.',champs:[
        {id:'nominal',type:'money',half:true,unit:'F CFA',label:'Valeur d’une part',ph:'10 000'},nInfoCap('parts')]},
      nStepSignature(),{id:'final',court:'Télécharger',titre:'Vérifier et télécharger',final:true,champs:[]}],
    defaults:()=>Object.assign({},notaireProfile(),{nb_assoc:'2',nominal:'10000',siege_ville:'ABIDJAN',date:todayISO(),a0_civilite:'M.',a1_civilite:'M.'},
      (function(){const o={};for(let i=0;i<2;i++){const d=nItemDefaults();Object.keys(d).forEach(k=>{o['a'+i+'_'+k]=d[k];});}return o;})()),
    exemple:Object.assign({notaire_nom:'NOTAIRE EXEMPLE',notaire_sign:'NOTAIRE EXEMPLE',notaire_ville:'ABIDJAN',denomination:'SOCIETE EXEMPLE',objet:'Commerce général\nImport-export de marchandises\nPrestations de services',siege_ville:'ABIDJAN',siege_commune:'Cocody',siege_quartier:'Quartier exemple',siege_bp:'',nb_assoc:'2',nominal:'10000',a0_parts:'60',a1_parts:'40',pages:'TROIS'},nExAssocie(0),nExAssocie(1)),
    compute:nDnsvCompute,blocks:nDnsvBlocks,
    docTitle:V=>'Déclaration notariée de souscription et de versement '+(V.denomination_maj||''),
    fileBase:V=>'DNSV-notaire-'+(fileSlug(V.denomination)?fileSlug(V.denomination)+'-':'')+'SARL',
    finalNote:'La liste des souscripteurs est annexée à l’acte, sur une feuille de papier timbrée à 500 FCFA.',
    headline:S=>S.denomination||'',importFrom:nImport,importKeys:NIDKEYS.concat(['parts'])
  };
})();
JPModels.add(N3);
