/* @needs _socle-notaires */
/* ============================================================
   N4 : mise à jour des statuts avec cession de parts
   ============================================================ */
function nCessionRep(){
  return {type:'repeat',id:'fond',prefix:'f',countKey:'nb_fond',min:1,max:8,label:'Apporteur',addLabel:'Ajouter un apporteur',
    keys:['nom','apport'],itemDefaults:()=>({}),
    fields:(i)=>{const p='f'+i+'_',G='Apporteur '+(i+1);return [
      {id:p+'nom',group:G,type:'text',label:'Civilité, prénoms et nom',ph:'Ex. : Monsieur Yao KONAN'},
      {id:p+'apport',group:G,type:'money',unit:'F CFA',label:'Apport en numéraire',ph:'Ex. : 600 000'}];}};
}
function nCessionSelect(id,label){return {id:id,type:'select',label:label,opts:nSrcOptions};}
function nCessionDefaults(){
  return Object.assign({},notaireProfile(),{nb_assoc:'2',nb_fond:'2',nb_ger:'1',nominal:'10000',siege_ville:'ABIDJAN',date:todayISO(),
    a0_civilite:'M.',a1_civilite:'M.',g0_src:'a0',g0_civilite:'M.',g1_src:'a1',g1_civilite:'M.',g2_src:'autre',g2_civilite:'M.',cedant:'a0',cessionnaire:'a1'},
    (function(){const o={};for(let i=0;i<2;i++){const d=nItemDefaults();Object.keys(d).forEach(k=>{o['a'+i+'_'+k]=d[k];});}return o;})());
}
function nCessionCompute(S){
  const V=nBase(S);nObjetV(V,S);nGeranceV(V,S);const T=nPartsV(V,S,'parts');
  nSet(V,'date_age',dateFr(String(S.age_date||'')),'age_date');
  nSet(V,'date_constitution_l',dateFr(String(S.date_constitution||'')),'date_constitution');
  nSet(V,'date_immat_l',dateFr(String(S.date_immat||'')),'date_immat');
  const nf=clamp(parseInt(S.nb_fond,10)||1,1,8);let ft=0;
  for(let i=0;i<nf;i++){
    const a=+S['f'+i+'_apport']||0;ft+=a;
    nSet(V,'f'+i+'_nom',String(S['f'+i+'_nom']||'').trim(),'f'+i+'_nom');
    nSet(V,'f'+i+'_ap',a?fmt(a):'','f'+i+'_apport');nSet(V,'f'+i+'_ap_l',a?nMT(a):'','f'+i+'_apport');
  }
  nSet(V,'fond_tot',ft?fmt(ft):'','f0_apport');nSet(V,'fond_tot_l',ft?nMT(ft):'','f0_apport');
  const idx=s=>{const m=/^a(\d+)$/.exec(String(s||''));return m&&+m[1]<T.n?+m[1]:-1;};
  const ci=idx(S.cedant),si=idx(S.cessionnaire),nbc=+S.nb_cedees||0;
  nSet(V,'cedant_ident',ci>=0?V['a'+ci+'_ident']:'','cedant');nSet(V,'cessionnaire_ident',si>=0?V['a'+si+'_ident']:'','cessionnaire');
  nSet(V,'nbc',nbc?String(nbc):'','nb_cedees');nSet(V,'nbc_l',nbc?lettres(nbc):'','nb_cedees');
  return V;
}
function nCessionBlocks(S,V){
  const T=nParts(S,'parts'),n=T.n,nf=clamp(parseInt(S.nb_fond,10)||1,1,8);
  const g2=nGen(2),g3=nGen(3),g4=nGen(4);
  const objet=[P('La société a pour objet, directement et indirectement en tous pays et plus particulièrement en République de COTE D’IVOIRE :')].concat(nObjetLis(S),[
    P('Et pour la réalisation de l’objet social :'),
    {k:'li',text:'L’acquisition, la location et la vente de tous biens meubles et immeubles ;'},
    {k:'li',text:'L’emprunt de toutes sommes auprès de tous Etablissements financiers avec possibilité de donner en garantie tout ou partie des biens sociaux ;'},
    {k:'li',text:'La prise en location-gérance de tous fonds de commerce ;'},
    {k:'li',text:'La prise de participation dans toute Société existante ou devant être créée ;'},
    P('Et plus généralement toutes opérations commerciales, industrielles, financières, mobilières et immobilières pouvant se rattacher directement ou indirectement à l’objet ci-dessus ou à tous autres objets similaires ou connexes, ou susceptibles d’en faciliter la réalisation et le développement.')]);
  const g6=nGen(6);
  const fo=[];
  for(let i=0;i<nf;i++) fo.push({k:'li',text:'{{f'+i+'_nom}}, la somme de {{f'+i+'_ap_l}}, ci {{f'+i+'_ap}} FCFA'});
  const hold=[];
  for(let i=0;i<n;i++) hold.push((i===0?'{{a0_civ_long}} {{a0_prenom}} {{a0_nom}} se trouve':'{{a'+i+'_civ_long}} {{a'+i+'_prenom}} {{a'+i+'_nom}}')+' propriétaire de {{a'+i+'_np_l}} ({{a'+i+'_np}}) parts sociales');
  const holdTxt=hold.length>1?hold.slice(0,-1).join(', ')+' et '+hold[hold.length-1]:hold[0];
  const att=[];
  for(let i=0;i<n;i++) att.push({k:'li',text:'{{a'+i+'_civ_long}} {{a'+i+'_prenom}} {{a'+i+'_nom}}, la somme de {{a'+i+'_ap_lettres}}, ci {{a'+i+'_ap_chiffres}} FCFA'});
  const a6=g6.slice(0,3).concat([
    P('Lors de la constitution le {{date_constitution_l}}, il a été fait apport en numéraire à la Société, savoir :')],fo,[
    P('TOTAL DES APPORTS : {{fond_tot_l}}, ci {{fond_tot}} FCFA'),
    P('Le versement des fonds correspondant a été constaté par la Déclaration Notariée de Souscription et de Versement reçue par le Notaire soussigné lors de la création de la société.'),
    P('Suite à l’Assemblée Générale Extraordinaire en date du {{date_age}} dont un exemplaire a été remis au Notaire soussigné, une cession de parts reçue par ledit notaire est intervenue suivant laquelle {{cedant_ident}} a cédé les {{nbc_l}} ({{nbc}}) parts sociales lui appartenant à {{cessionnaire_ident}}.'),
    P('Aux termes desdits actes '+holdTxt+' de la SARL « {{denomination_maj}} ». Les parts sont attribuées comme suit, savoir :')],att,[
    P('TOTAL DES APPORTS : {{cap_lettres}}, ci {{cap}} FCFA')]);
  const ca=[];
  for(let i=0;i<n;i++) ca.push({k:'li',text:'{{a'+i+'_civ_long}} {{a'+i+'_prenom}} {{a'+i+'_nom}} à concurrence de {{a'+i+'_np}} parts numérotées de {{a'+i+'_nd}} à {{a'+i+'_nf}}, ci {{a'+i+'_np}} P'});
  const a7=[P('Le capital social est fixé à la somme de {{cap_lettres}} ({{cap}} FCFA) divisé en {{parts_lettres}} ({{parts}}) parts sociales de {{nominal_lettres}} ({{nominal}} FCFA), entièrement souscrites et libérées, numérotées de 1 à {{parts}} et attribuées à chaque associé, en proportion de ses apports respectifs, de la manière suivante :')]
    .concat(ca,[P('TOTAL du nombre de parts sociales composant le capital social, soit {{parts}}, ci {{parts}} P')]);
  const ov=nStatutsOv(S,V,{2:objet,5:[P('La durée de la société est fixée à QUATRE VINGT DIX NEUF (99) ans à compter du {{date_immat_l}}, date de son immatriculation au Registre du Commerce et du Crédit Mobilier, sauf les cas de dissolution anticipée ou de prorogation prévue aux présents statuts.')],6:a6,7:a7,14:nGeranceBlocks(S)});
  const B=nIntro(S,V,['MISE A JOUR DES STATUTS','DE LA SARL « {{denomination_maj}} »'],{mineur:true});
  B.push(P('LESQUELS, ont établi ainsi qu’il suit, la mise à jour des Statuts de ladite Société conformément à l’Assemblée Générale Extraordinaire en date du {{date_age}}, et aux nouvelles dispositions de l’Acte Uniforme de l’OHADA adopté le trente Janvier deux mil quatorze et entré en vigueur le cinq Mai deux mil quatorze.'),
    {k:'tit',text:'S T A T U T S'});
  return B.concat(nBody(ov),nClosing(S,V));
}
const N4=(function(){
  const assoc=nStepAssocies({mineur:true,titre:'Les comparants (associés actuels)',intro:'Les associés après la cession de parts. Pour chacun, indiquez ses parts à l’étape suivante.'});
  return {
    id:'notaire-mise-a-jour-statuts-cession',cat:'notaires',titre:'Mise à jour des statuts après cession de parts',sous:'Statuts refondus, avec la cession et la nouvelle répartition',
    resume:'Statuts mis à jour après une cession de parts : rappel des apports de la constitution, cession reçue par le notaire, nouvelle répartition du capital. Gère l’administrateur légal d’un enfant mineur.',
    tags:['Notaire','OHADA','Cession de parts','Mineur'],duree:'25 min',
    etapes:[nStepNotaire(),nStepSociete({constitution:true}),assoc,
      {id:'capital',court:'Capital',titre:'Capital et nouvelle répartition',intro:'Article 7. Indiquez les parts détenues par chaque associé après la cession.',champs:[
        {id:'nominal',type:'money',half:true,unit:'F CFA',label:'Valeur d’une part',ph:'10 000'},nInfoCap('parts'),
        {type:'repeat',id:'partsrep',prefix:'a',countKey:'nb_assoc',min:2,max:8,fixed:true,label:'Associé',fields:(i)=>[{id:'a'+i+'_parts',group:'Associé '+(i+1),type:'int',unit:'parts',label:'Parts détenues après la cession',ph:'Ex. : 60'}]}]},
      {id:'constitution',court:'Constitution',titre:'Apports de la constitution',intro:'Article 6. Rappel des apports versés lors de la création de la société.',champs:[nCessionRep(),
        {id:'i_fond',type:'info',calc:(S)=>{
          const nf=clamp(parseInt(S.nb_fond,10)||1,1,8);let t=0;for(let i=0;i<nf;i++) t+=(+S['f'+i+'_apport']||0);
          const T=nParts(S,'parts');
          if(!t||!T.cap) return null;
          return t===T.cap?{t:'Total des apports : '+fmt(t)+' F CFA, égal au capital.',c:'ok'}:{t:'Total des apports : '+fmt(t)+' F CFA. Le capital actuel est de '+fmt(T.cap)+' F CFA.',c:'bad'};
        }}]},
      {id:'cession',court:'Cession',titre:'La cession de parts',intro:'Article 6. La cession a été décidée en assemblée générale extraordinaire, puis reçue par le notaire.',champs:[
        {id:'age_date',type:'date',half:true,label:'Date de l’assemblée générale extraordinaire'},
        {id:'nb_cedees',type:'int',half:true,unit:'parts',label:'Nombre de parts cédées',ph:'Ex. : 20'},
        nCessionSelect('cedant','Cédant'),nCessionSelect('cessionnaire','Cessionnaire'),
        {id:'i_ces',type:'info',calc:(S)=>S.cedant&&S.cedant===S.cessionnaire?{t:'Le cédant et le cessionnaire doivent être deux personnes différentes.',c:'bad'}:null}]},
      {id:'gerance',court:'Gérance',titre:'La gérance',intro:'Article 14.',champs:[
        {id:'nb_ger',type:'choice',variant:'seg',label:'Nombre de gérants',opts:[{v:'1',t:'Un gérant'},{v:'2',t:'Deux gérants'}]},nGerantsRep()]},
      nStepSignature(),{id:'final',court:'Télécharger',titre:'Vérifier et télécharger',final:true,champs:[]}],
    defaults:nCessionDefaults,
    exemple:Object.assign({notaire_nom:'KOFFI-ABOUT Akoua Mireille',notaire_sign:'KOFFI-ABOUT A. Mireille',notaire_ville:'ABIDJAN',denomination:'ALPHA SERVICES',objet:'Commerce général\nImport-export de marchandises\nPrestations de services',siege_ville:'ABIDJAN',siege_commune:'Cocody',siege_quartier:'Riviera Palmeraie',siege_bp:'',
      date_constitution:'2019-02-14',date_immat:'2019-03-05',nb_assoc:'2',nominal:'10000',a0_parts:'40',a1_parts:'60',nb_fond:'2',f0_nom:'Monsieur Yao KONAN',f0_apport:'600000',f1_nom:'Madame Fatoumata TRAORE',f1_apport:'400000',
      age_date:'2026-09-10',nb_cedees:'20',cedant:'a0',cessionnaire:'a1',nb_ger:'1',g0_src:'a0',pages:'VINGT'},nExAssocie(0),nExAssocie(1)),
    compute:nCessionCompute,blocks:nCessionBlocks,
    docTitle:V=>'Mise à jour des statuts '+(V.denomination_maj||'SARL'),
    fileBase:V=>'Mise-a-jour-statuts-cession-'+(fileSlug(V.denomination)||'SARL'),
    finalNote:'Joignez l’extrait du procès-verbal de l’assemblée générale extraordinaire et l’acte de cession reçu par le notaire.',
    headline:S=>S.denomination||'',importKeys:NIDKEYS.concat(['parts','mineur','enfant'])
  };
})();
JPModels.add(N4);
