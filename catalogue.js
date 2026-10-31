/* Catalogue léger : affiché sans charger les modèles. Chaque modèle est téléchargé à son ouverture (voir models/). */
const MODELS=[
 {
  "id": "sarl-unipersonnelle-numeraire",
  "cat": "prive",
  "titre": "Statuts de SARL unipersonnelle",
  "sous": "Un seul associé, apports en numéraire",
  "resume": "Pour créer une SARL seul, avec un apport en espèces. 25 articles conformes à l’Acte uniforme OHADA révisé.",
  "tags": [
   "OHADA",
   "Côte d’Ivoire",
   "1 associé",
   "Numéraire"
  ],
  "duree": "10 min",
  "next": "declaration-souscription-versement",
  "files": [
   "m1"
  ]
 },
 {
  "id": "sarl-pluripersonnelle-mixte",
  "cat": "prive",
  "titre": "Statuts de SARL pluripersonnelle",
  "sous": "Plusieurs associés, apports mixtes",
  "resume": "Pour créer une SARL à deux associés ou plus, avec des apports en numéraire, en nature et, si besoin, en industrie. 31 articles.",
  "tags": [
   "OHADA",
   "Côte d’Ivoire",
   "2 à 8 associés",
   "Numéraire et nature"
  ],
  "duree": "20 min",
  "next": "declaration-souscription-versement",
  "files": [
   "m2"
  ]
 },
 {
  "id": "declaration-souscription-versement",
  "cat": "prive",
  "titre": "Déclaration de souscription et de versement",
  "sous": "Constate la libération et le dépôt des fonds",
  "resume": "Acte qui accompagne les statuts d’une SARL : parts souscrites par chaque associé, sommes versées et compte de dépôt. Se remplit en un clic depuis vos statuts.",
  "tags": [
   "OHADA",
   "Côte d’Ivoire",
   "1 à 10 associés",
   "Avec les statuts"
  ],
  "duree": "5 min",
  "files": [
   "m2",
   "m3"
  ]
 },
 {
  "id": "notaire-sarl-statuts-un-gerant",
  "cat": "notaires",
  "titre": "Statuts de SARL, un gérant",
  "sous": "Apports en numéraire, acte reçu par le notaire",
  "resume": "Statuts notariés d’une SARL de deux associés ou plus, constituée en numéraire, avec un seul gérant nommé dans les statuts. 33 articles.",
  "tags": [
   "Notaire",
   "OHADA",
   "Numéraire",
   "1 gérant"
  ],
  "duree": "25 min",
  "next": "notaire-declaration-souscription-versement",
  "files": [
   "notaires"
  ]
 },
 {
  "id": "notaire-sarl-statuts-cogerance",
  "cat": "notaires",
  "titre": "Statuts de SARL, co-gérance",
  "sous": "Apports en numéraire, acte reçu par le notaire",
  "resume": "Même acte que le précédent, avec deux gérants nommés dans les statuts. 33 articles.",
  "tags": [
   "Notaire",
   "OHADA",
   "Numéraire",
   "Co-gérance"
  ],
  "duree": "25 min",
  "next": "notaire-declaration-souscription-versement",
  "files": [
   "notaires"
  ]
 },
 {
  "id": "notaire-declaration-souscription-versement",
  "cat": "notaires",
  "titre": "Déclaration notariée de souscription et de versement",
  "sous": "Avec la liste des souscripteurs en annexe",
  "resume": "Acte reçu par le notaire qui constate la souscription du capital et le versement des fonds, accompagné de la liste des souscripteurs. Reprend vos statuts notariés en un clic.",
  "tags": [
   "Notaire",
   "OHADA",
   "Numéraire",
   "Annexe incluse"
  ],
  "duree": "10 min",
  "files": [
   "notaires"
  ]
 },
 {
  "id": "notaire-mise-a-jour-statuts-cession",
  "cat": "notaires",
  "titre": "Mise à jour des statuts après cession de parts",
  "sous": "Statuts refondus, avec la cession et la nouvelle répartition",
  "resume": "Statuts mis à jour après une cession de parts : rappel des apports de la constitution, cession reçue par le notaire, nouvelle répartition du capital. Gère l’administrateur légal d’un enfant mineur.",
  "tags": [
   "Notaire",
   "OHADA",
   "Cession de parts",
   "Mineur"
  ],
  "duree": "25 min",
  "files": [
   "notaires"
  ]
 }
];
const CATS=[
  {id:'prive',titre:'Actes sous seing privé',aide:'Rédigés par les associés, sans notaire.'},
  {id:'notaires',titre:'Notaires',aide:'Actes reçus par un notaire : statuts, déclaration de souscription et de versement, cession de parts.'}
];
const PARCOURS=[
  {titre:'Créer une SARL, sous seing privé',etapes:[
    {t:'Les statuts',d:'Un seul associé ou plusieurs.',ids:['sarl-unipersonnelle-numeraire','sarl-pluripersonnelle-mixte']},
    {t:'La déclaration de souscription et de versement',d:'Reprend vos statuts en un clic.',ids:['declaration-souscription-versement']}
  ]},
  {titre:'Créer une SARL devant notaire',etapes:[
    {t:'Les statuts',d:'Un gérant ou co-gérance.',ids:['notaire-sarl-statuts-un-gerant','notaire-sarl-statuts-cogerance']},
    {t:'La déclaration notariée',d:'Avec la liste des souscripteurs.',ids:['notaire-declaration-souscription-versement']}
  ]},
  {titre:'Après une cession de parts',etapes:[
    {t:'La mise à jour des statuts',d:'Cession et nouvelle répartition du capital.',ids:['notaire-mise-a-jour-statuts-cession']}
  ]}
];

/* ---------- Chargement des modèles à la demande ---------- */
const FULL={},JPModels={add(m){FULL[m.id]=m;}};
const _mf={};
function loadModelFile(n){
  if(_mf[n]) return _mf[n];
  _mf[n]=new Promise((res,rej)=>{const s=document.createElement('script');s.src='./models/'+n+'.js';s.async=false;s.onload=res;s.onerror=()=>{s.remove();rej(new Error(n));};document.head.appendChild(s);}).catch(e=>{delete _mf[n];throw e;});
  return _mf[n];
}
function loadModels(ids){
  const need=[];ids.forEach(id=>{const m=MODELS.find(x=>x.id===id);if(m&&!FULL[id]) m.files.forEach(f=>{if(need.indexOf(f)<0) need.push(f);});});
  /* Ordre respecté (m2 avant m3). */
  return need.reduce((p,f)=>p.then(()=>loadModelFile(f)),Promise.resolve());
}
