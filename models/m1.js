/* ============================================================
   MODÈLE 1 : Statuts de SARL unipersonnelle (apports en numéraire)
   ============================================================ */
const M1_ETAPES=[
 {id:'societe',court:'Société',titre:'La société',intro:'Ces informations alimentent les articles 2, 3 et 4 des statuts.',champs:[
  {id:'denomination',type:'text',label:'Dénomination sociale',aide:'Le nom qui figurera sur vos factures, courriers et publications.',ph:'Ex. : ALPHA SERVICES',req:true},
  {id:'sigle',type:'text',label:'Sigle (facultatif)',ph:'Ex. : ALS'},
  {id:'objet',type:'area',rows:4,label:'Objet social',aide:'Les activités exercées en Côte d’Ivoire. Les activités annexes habituelles figurent déjà dans l’article 3.',ph:'Ex. : Commerce général, import-export de marchandises, prestations de services.',req:true},
  {id:'siege',type:'area',rows:2,label:'Siège social',aide:'Adresse et situation géographique.',ph:'Ex. : Abidjan, Cocody, Riviera Palmeraie, lot 12',req:true}
 ]},
 {id:'associe',court:'Associé',titre:'L’associé unique',intro:'Son identité apparaît en tête des statuts, aux articles 7 et 8 et à la signature.',champs:[
  {id:'civilite',type:'choice',variant:'seg',label:'Civilité',opts:CIV},
  {id:'prenom',type:'text',half:true,label:'Prénom(s)',req:true},
  {id:'nom',type:'text',half:true,label:'Nom',aide:'Mis en majuscules dans le document.',req:true},
  {id:'naissance_date',type:'date',half:true,label:'Date de naissance',req:true},
  {id:'naissance_lieu',type:'text',half:true,label:'Lieu de naissance',ph:'Ex. : Bouaké',req:true},
  {id:'nationalite',type:'text',half:true,label:'Nationalité',ph:'Ex. : ivoirienne',req:true},
  {id:'profession',type:'text',half:true,label:'Profession',req:true},
  {id:'adresse',type:'area',rows:2,label:'Adresse du domicile',req:true},
  {id:'piece',type:'text',label:'Pièce d’identité',ph:'Ex. : CNI n° …',req:true}
 ]},
 {id:'capital',court:'Capital',titre:'Capital et apports',intro:'Articles 7 et 8. Le capital est entièrement constitué par votre apport en numéraire.',champs:[
  {id:'capital',type:'money',half:true,unit:'F CFA',label:'Capital social',ph:'1 000 000',req:true},
  {id:'nominal',type:'money',half:true,unit:'F CFA',label:'Valeur d’une part',ph:'10 000',req:true,
    todoNote:(S)=>((+S.capital||0)&&(+S.nominal||0)&&(+S.capital%+S.nominal))?' (doit diviser le capital)':''},
  {id:'i_parts',type:'info',calc:(v,V)=>{
      const cap=+v.capital||0,n=+v.nominal||0;
      if(!cap||!n) return {t:'Le nombre de parts sera calculé : capital ÷ valeur d’une part.'};
      if(cap%n) return {t:'Le capital doit être un multiple de la valeur d’une part.',c:'bad'};
      return {t:'Soit '+V.parts+' parts sociales, numérotées de 1 à '+V.parts+'.',c:'ok'};
  }},
  {id:'liberation',type:'choice',variant:'stack',label:'Libération des parts',opts:[
    {v:'integrale',t:'Intégralement à la constitution',d:'La totalité du capital est versée au moment de la création.'},
    {v:'moitie',t:'De moitié au moins',d:'Le solde est libéré dans un délai de deux années à compter de l’immatriculation.'}]},
  {id:'i_depot',type:'info',calc:(v)=>{
      const cap=+v.capital||0;
      if(!cap) return null;
      return v.liberation==='moitie'
        ? {t:'À déposer dès la constitution : '+fmt(Math.ceil(cap/2))+' F CFA au moins.'}
        : {t:'Vous déposez la totalité du capital : '+fmt(cap)+' F CFA.'};
  }},
  {id:'banque',type:'text',label:'Établissement où les fonds sont déposés',aide:'Banque, établissement financier ou structure de microfinance.',ph:'Ex. : nom de la banque et agence',req:true}
 ]},
 {id:'gerance',court:'Gérance',titre:'La gérance',intro:'Articles 13 et 14.',champs:[
  {id:'gerance_mode',type:'choice',variant:'stack',label:'Qui est gérant ?',opts:[
    {v:'associe',t:'L’associé unique',d:'Il est nommé gérant directement dans les statuts.'},
    {v:'tiers',t:'Une autre personne, nommée dans les statuts',d:'Vous indiquez son identité et son adresse.'},
    {v:'ulterieur',t:'Le gérant sera nommé plus tard',d:'Il sera désigné par une décision de l’associé unique.'}]},
  {id:'gerant_civilite',type:'choice',variant:'seg',label:'Civilité du gérant',opts:CIV,showIf:v=>v.gerance_mode==='tiers'},
  {id:'gerant_prenom',type:'text',half:true,label:'Prénom(s) du gérant',req:true,showIf:v=>v.gerance_mode==='tiers'},
  {id:'gerant_nom',type:'text',half:true,label:'Nom du gérant',req:true,showIf:v=>v.gerance_mode==='tiers'},
  {id:'gerant_adresse',type:'area',rows:2,label:'Adresse du gérant',req:true,showIf:v=>v.gerance_mode==='tiers'},
  {id:'duree_gerant',type:'int',half:true,unit:'années',label:'Durée du mandat',ph:'Ex. : 4',req:true},
  {id:'preavis_gerant',type:'int',half:true,unit:'mois',label:'Préavis de démission',ph:'Ex. : 3',req:true},
  {id:'limiter',type:'choice',variant:'seg',label:'Pouvoirs du gérant',opts:[{v:'non',t:'Sans limitation'},{v:'oui',t:'Avec limitations'}]},
  {id:'limitations',type:'area',rows:3,label:'Actes soumis à l’autorisation de l’associé unique',aide:'Ex. : vendre un immeuble, contracter un emprunt supérieur à un montant donné.',req:true,showIf:v=>v.limiter==='oui'}
 ]},
 {id:'signature',court:'Signature',titre:'Signature et formalités',intro:'Articles 22 et 25, et bas du document.',champs:[
  {id:'date',type:'date',half:true,label:'Date des statuts',req:true},
  {id:'lieu',type:'text',half:true,label:'Fait à',ph:'Ex. : Abidjan',req:true},
  {id:'nb_ex',type:'int',half:true,unit:'exemplaires',label:'Exemplaires originaux',aide:'Un pour l’associé, un pour le siège, et ceux des formalités.',req:true},
  {id:'t_mand',type:'title',label:'Personne chargée des formalités (article 25)'},
  {id:'mandataire_civilite',type:'choice',variant:'seg',label:'Civilité',opts:CIV},
  {id:'mandataire_nom',type:'text',label:'Nom et prénom(s)',req:true},
  {id:'mandataire_profession',type:'text',half:true,label:'Profession',req:true},
  {id:'mandataire_piece',type:'text',half:true,label:'Pièce d’identité',ph:'CNI n° …',req:true},
  {id:'a_copie',type:'action',action:'copy-associe',label:'Utiliser les informations de l’associé unique'},
  {id:'engagements',type:'area',rows:3,label:'Engagements à prendre au nom de la société (facultatif)',aide:'Laissez vide s’il n’y en a pas : le paragraphe ne figurera pas dans le document.'}
 ]},
 {id:'final',court:'Télécharger',titre:'Vérifier et télécharger',final:true,champs:[]}
];
const M1_EXEMPLE={civilite:'M.',denomination:'ALPHA SERVICES',sigle:'',objet:'Commerce général, import-export de marchandises et prestations de services.',siege:'Abidjan, Cocody, Riviera Palmeraie, lot 12',
  prenom:'Yao',nom:'Konan',naissance_date:'1988-04-12',naissance_lieu:'Bouaké',nationalite:'ivoirienne',profession:'commerçant',adresse:'Abidjan, Cocody Angré',piece:'CNI n° C 0000 0000 00',
  capital:'1000000',nominal:'10000',liberation:'moitie',banque:'Banque Exemple, agence du Plateau',
  gerance_mode:'associe',duree_gerant:'4',preavis_gerant:'3',limiter:'non',limitations:'',
  lieu:'Abidjan',nb_ex:'3',mandataire_civilite:'M.',mandataire_nom:'Yao Konan',mandataire_profession:'commerçant',mandataire_piece:'CNI n° C 0000 0000 00',engagements:''};

const M1_SRC={denomination_maj:'denomination',sigle_txt:'sigle',capital_chiffres:'capital',capital_lettres:'capital',nominal_chiffres:'nominal',parts:'nominal',
  annee_lettres:'date',date_longue:'date',naissance_date_longue:'naissance_date',liberation_txt:'liberation',liberation_txt8:'liberation',
  duree_gerant_txt:'duree_gerant',preavis_txt:'preavis_gerant',nb_ex_lettres_maj:'nb_ex',civ:'civilite',civ_long:'civilite',ne:'civilite',Ne:'civilite',
  sous_le:'civilite',Sous_le:'civilite',lui:'civilite',gerant_civ:'gerant_civilite',mand_civ_long:'mandataire_civilite'};
const M1_NOHL=['civ','civ_long','ne','Ne','sous_le','Sous_le','lui','gerant_civ','mand_civ_long','liberation_txt','liberation_txt8'];

function m1Compute(v){
  const g=k=>String(v[k]==null?'':v[k]).trim();
  const fem=g('civilite')==='Mme',gfem=g('gerant_civilite')==='Mme',mfem=g('mandataire_civilite')==='Mme';
  const cap=+g('capital')||0,nomi=+g('nominal')||0,okp=cap>0&&nomi>0&&cap%nomi===0;
  const nb=+g('nb_ex')||0,dg=+g('duree_gerant')||0,pr=+g('preavis_gerant')||0;
  const O={_src:M1_SRC,_nohl:new Set(M1_NOHL)};
  ['denomination','sigle','objet','siege','prenom','naissance_lieu','nationalite','profession','adresse','piece','banque','gerant_prenom','gerant_adresse','limitations','lieu','engagements','mandataire_nom','mandataire_profession','mandataire_piece'].forEach(k=>{O[k]=g(k);});
  return Object.assign(O,{
    denomination_maj:g('denomination').toUpperCase(),
    sigle_txt:g('sigle')?', en abrégé « '+g('sigle')+' »':'',
    nom:g('nom').toUpperCase(),gerant_nom:g('gerant_nom').toUpperCase(),
    civ:fem?'Mme':'M.',civ_long:fem?'Madame':'Monsieur',ne:fem?'née':'né',Ne:fem?'Née':'Né',
    sous_le:fem?'la soussignée':'le soussigné',Sous_le:fem?'La soussignée':'Le soussigné',lui:fem?'elle':'lui',
    gerant_civ:gfem?'Mme':'M.',mand_civ_long:mfem?'Madame':'Monsieur',
    annee_lettres:anneeLettres(g('date')),date_longue:dateFr(g('date')),naissance_date_longue:dateFr(g('naissance_date')),
    capital_chiffres:cap?fmt(cap):'',capital_lettres:cap?fcfa(cap):'',nominal_chiffres:nomi?fmt(nomi):'',parts:okp?fmt(cap/nomi):'',
    liberation_txt:g('liberation')==='moitie'?'de la moitié au moins':'intégralement',
    liberation_txt8:g('liberation')==='moitie'?'de moitié':'intégralement',
    duree_gerant_txt:dg?dg+' '+(dg>1?'années':'année'):'',
    preavis_txt:pr?pr+' mois':'',
    nb_ex:nb?String(nb):'',nb_ex_lettres_maj:nb?lettres(nb).toUpperCase():''
  });
}

const ASSO1='{{civ}} {{prenom}} {{nom}}';
const M1_CORPS=[
 {k:'tit',text:'STATUTS DE LA SOCIÉTÉ À RESPONSABILITÉ LIMITÉE DÉNOMMÉE'},
 {k:'tit',text:'« {{denomination_maj}} SARL UNIPERSONNELLE »'},
 {k:'sp'},
 P('L’an {{annee_lettres}},'),
 P('Le {{date_longue}},'),
 P('**{{Sous_le}},**'),
 {k:'box',lines:['**'+ASSO1+'**','{{Ne}} le {{naissance_date_longue}} à {{naissance_lieu}}, de nationalité {{nationalite}}','Profession : {{profession}}','Demeurant à {{adresse}}','Pièce d’identité : {{piece}}']},
 P('A établi par les présentes, les statuts de la Société à Responsabilité Limitée dont la teneur suit :'),

 {k:'part',text:'TITRE I : DISPOSITIONS GÉNÉRALES'},
 ART(1,'FORME'),
 P('Il est constitué par {{sous_le}}, une Société à Responsabilité Limitée devant exister entre {{lui}} et tous propriétaires de parts sociales ultérieures, qui sera régie par l’Acte Uniforme révisé de l’OHADA du 30 janvier 2014 relatif au droit des Sociétés commerciales et du Groupement d’intérêt économique (GIE), ainsi que par toutes autres dispositions légales ou réglementaires applicables et les présents statuts.'),
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
 P('Par exception, le premier exercice sera clos le trente et un décembre de l’année suivante si la société commence ses activités au-delà des six premiers mois de l’année en cours.'),
 ART(7,'APPORTS'),
 {k:'sub',text:'Apports en numéraire'},
 P('Lors de la constitution, {{sous_le}} a fait apport à la société, à savoir :'),
 {k:'table',cols:[62,38],al:['left','right'],head:['IDENTITÉ DE L’APPORTEUR','MONTANT DE L’APPORT EN NUMÉRAIRE'],rows:[
   [ASSO1,'{{capital_chiffres}} F CFA'],
   ['**Total des apports en numéraire :** {{capital_lettres}}, ci {{capital_chiffres}} F CFA','**{{capital_chiffres}} F CFA**']]},
 P('Les apports en numéraire de {{capital_chiffres}} F CFA ({{capital_lettres}}) correspondent à {{parts}} parts sociales de {{nominal_chiffres}} F CFA chacune, souscrites et libérées {{liberation_txt}} par l’associé unique.'),
 P('La libération de la seconde moitié des parts sociales devra intervenir, à la demande du Gérant, en une ou plusieurs fois dans un délai de deux années à compter de l’immatriculation de la société au Registre du Commerce et du Crédit Mobilier.',{when:v=>v.liberation==='moitie'}),
 P('La somme correspondante a été déposée pour le compte de la société et conformément à la loi, dans un compte ouvert à {{banque}}.'),
 ART(8,'CAPITAL SOCIAL'),
 P('Le capital social est fixé à la somme de {{capital_chiffres}} F CFA, divisé en {{parts}} parts sociales de {{nominal_chiffres}} F CFA chacune, entièrement souscrites et libérées {{liberation_txt8}}, numérotées de 1 à {{parts}}, attribuées à l’associé unique, à savoir :'),
 {k:'table',cols:[72,28],al:['left','right'],head:['IDENTITÉ DE L’ASSOCIÉ','CONCURRENCE DES PARTS'],rows:[
   ['À '+ASSO1+', {{parts}} parts sociales numérotées de 1 à {{parts}} inclus, en rémunération de son apport exclusif en numéraire ci-dessus','**{{parts}} PARTS**'],
   ['**TOTAL ÉGAL** au nombre de parts composant le capital social, soit {{parts}} parts sociales, ci-contre','**{{parts}} PARTS**']]},
 ART(9,'MODIFICATION DU CAPITAL'),
 P('Le capital social peut être augmenté, par décision extraordinaire de l’associé unique, soit par émission de parts nouvelles, soit par majoration du nominal des parts existantes.'),
 P('Les parts nouvelles sont libérées soit en espèces, soit par compensation avec des créances certaines, liquides et exigibles sur la société, soit par incorporation de réserves, bénéfices, soit par apport en nature.'),
 P('Le capital social peut être réduit, soit par la diminution de la valeur nominale des parts, soit par diminution du nombre de parts.'),
 P('La réduction du capital est autorisée ou décidée par l’associé unique qui peut déléguer à la gérance les pouvoirs nécessaires pour la réaliser.'),
 ART(10,'DROITS DES PARTS'),
 P('Chaque part sociale confère à son propriétaire un droit égal dans les bénéfices de la société et dans tout l’actif social.'),
 ART(11,'NANTISSEMENT DES PARTS SOCIALES'),
 P('Le nantissement des parts est constaté par acte notarié ou sous seing privé enregistré et signifié à la société ou accepté par elle dans un acte authentique.'),

 {k:'part',text:'TITRE II : FONCTIONNEMENT – DISSOLUTION'},
 ART(12,'COMPTES COURANTS'),
 P('L’associé unique peut laisser ou mettre à disposition de la société toutes sommes dont celle-ci peut avoir besoin. Les conditions de retrait ou de remboursement de ces sommes, ainsi que leur rémunération, sont déterminées soit par décision de l’associé unique, soit par accords entre la gérance et l’intéressé. Dans le cas où l’avance est faite par l’associé unique gérant, ces conditions sont fixées par décision de ce dernier.'),
 ART(13,'GÉRANCE'),
 P('1. La société est gérée par une ou plusieurs personnes physiques. L’associé unique peut être le gérant de la société. Le gérant est nommé pour une durée de {{duree_gerant_txt}}. La nomination du gérant au cours de la vie sociale est décidée par l’associé unique.',{when:v=>v.gerance_mode==='ulterieur'}),
 P('1. La société est gérée par une ou plusieurs personnes physiques. L’associé unique peut être le gérant de la société.',{when:v=>v.gerance_mode!=='ulterieur'}),
 P('Est nommé gérant de la société : '+ASSO1+', associé unique, demeurant à {{adresse}}, qui accepte.',{when:v=>v.gerance_mode==='associe'}),
 P('Est nommé gérant de la société : {{gerant_civ}} {{gerant_prenom}} {{gerant_nom}}, demeurant à {{gerant_adresse}}, qui accepte.',{when:v=>v.gerance_mode==='tiers'}),
 P('Le gérant est nommé pour une durée de {{duree_gerant_txt}}. Il est toujours rééligible.',{when:v=>v.gerance_mode!=='ulterieur'}),
 P('Au cours de la vie sociale, le gérant est nommé par décision de l’associé unique.',{when:v=>v.gerance_mode!=='ulterieur'}),
 P('Le gérant peut démissionner de son mandat, mais seulement en prévenant l’associé unique au moins {{preavis_txt}} à l’avance, par lettre recommandée avec demande d’avis de réception ou lettre au porteur contre récépissé.'),
 P('Le gérant est révocable par décision de l’associé unique.'),
 P('2. La rémunération du gérant est fixée par la décision qui le nomme.'),
 ART(14,'POUVOIRS DU GÉRANT'),
 P('Le gérant peut faire tous les actes de gestion dans l’intérêt de la société.'),
 P('Cependant, il ne peut, sans y être autorisé par l’associé unique : {{limitations}}',{when:v=>v.limiter==='oui'}),
 P('Dans les rapports avec les tiers, le gérant est investi des pouvoirs les plus étendus pour agir en toute circonstance, au nom de la société, sous réserve des pouvoirs expressément attribués à l’associé unique par la loi.'),
 P('La société est engagée, même par les actes du gérant qui ne relèvent pas de l’objet social, à moins qu’elle ne prouve que le tiers savait que l’acte dépassait cet objet ou qu’il ne pouvait l’ignorer compte tenu des circonstances, étant exclu que la seule publication des statuts suffise à constituer cette preuve.'),
 ART(15,'RESPONSABILITÉ DU GÉRANT'),
 P('Le gérant est responsable, envers la société ou envers les tiers, soit des infractions aux dispositions législatives ou réglementaires applicables aux sociétés à responsabilité limitée, soit des violations des statuts, soit des fautes commises dans sa gestion. Si plusieurs gérants ont coopéré aux mêmes faits, le tribunal chargé des affaires commerciales détermine la part contributive de chacun dans la réparation du dommage.'),
 P('Aucune décision de l’associé unique ne peut avoir pour effet d’éteindre une action en responsabilité contre les gérants pour faute commise dans l’accomplissement de leur mandat.'),
 ART(16,'DÉCISIONS DE L’ASSOCIÉ UNIQUE'),
 P('L’associé unique exerce les pouvoirs dévolus par l’Acte Uniforme relatif au droit des sociétés commerciales et du GIE.'),
 P('L’associé unique ne peut déléguer ses pouvoirs. Ses décisions sont consignées dans un procès-verbal versé dans les archives de la société.'),
 ART(17,'COMPTES SOCIAUX'),
 P('À la clôture de chaque exercice, le gérant établit et arrête les états financiers de synthèse conformément aux dispositions de l’Acte Uniforme portant organisation et harmonisation des comptabilités.'),
 P('Le gérant établit un rapport de gestion dans lequel il expose la situation de la société durant l’exercice écoulé, son évolution prévisible et, en particulier, les perspectives de continuation de l’activité, l’évolution de la situation de trésorerie et le plan de financement.'),
 P('Ces documents ainsi que les textes des résolutions proposées et, le cas échéant, les rapports du commissaire aux comptes sont communiqués à l’associé unique dans les conditions et délais prévus par les dispositions légales et réglementaires.'),
 P('À compter de cette communication, l’associé unique a la possibilité de poser par écrit des questions auxquelles le gérant sera tenu de répondre.'),
 P('L’associé unique est tenu de statuer sur les comptes de l’exercice écoulé dans les six mois de la clôture de l’exercice ou, en cas de prolongation, dans le délai fixé par décision de justice.'),
 ART(18,'AFFECTATION DES RÉSULTATS'),
 P('Après approbation des comptes et constatation de l’existence d’un bénéfice distribuable, l’associé unique détermine la part attribuée sous forme de dividende.'),
 P('Il est pratiqué sur le bénéfice de l’exercice diminué, le cas échéant, des pertes antérieures, une dotation égale à un dixième au moins affectée à la formation d’un fonds de réserve dit « réserve légale ». Cette dotation cesse d’être obligatoire lorsque la réserve atteint le cinquième du montant du capital social.'),
 P('L’associé unique a la faculté de constituer tous postes de réserves.'),
 P('Il peut procéder à la distribution de tout ou partie des réserves à la condition qu’il ne s’agisse pas de réserves déclarées indisponibles par la loi ou par les statuts. Dans ce cas, il indique expressément les postes de réserve sur lesquels les prélèvements sont effectués.'),
 P('La société est tenue de déposer au Registre du Commerce et du Crédit Mobilier du lieu du siège social, dans le mois qui suit leur approbation par les organes compétents, les états financiers de synthèse, à savoir le bilan, le compte de résultat, le tableau des ressources et des emplois et l’état annexé de l’exercice écoulé.'),
 ART(19,'VARIATION DES CAPITAUX PROPRES'),
 P('Si du fait des pertes constatées dans les états financiers de synthèse, les capitaux propres de la société deviennent inférieurs à la moitié du capital social, le gérant ou, le cas échéant, le commissaire aux comptes doit, dans les quatre mois qui suivent l’approbation des comptes ayant fait apparaître cette perte, consulter l’associé unique sur l’opportunité de prononcer la dissolution anticipée de la société.'),
 P('Si la dissolution est écartée, la société est tenue, dans les deux ans qui suivent la date de clôture de l’exercice déficitaire, de reconstituer ses capitaux propres jusqu’à ce que ceux-ci soient à la hauteur de la moitié au moins du capital social.'),
 P('À défaut, elle doit réduire son capital d’un montant au moins égal à celui des pertes qui n’ont pu être imputées sur les réserves, à la condition que cette réduction du capital n’ait pas pour effet de réduire le capital à un montant inférieur à celui du capital minimum légal.'),
 P('À défaut par le gérant ou le commissaire aux comptes de provoquer cette décision, ou si l’associé unique n’a pu prendre de décision valablement, tout intéressé peut demander à la juridiction compétente de prononcer la dissolution de la société. Il en est de même si la reconstitution des capitaux propres n’est pas intervenue dans les délais prescrits.'),
 ART(20,'CONTRÔLE DES COMPTES'),
 P('Un ou plusieurs commissaires aux comptes titulaires et suppléants seront désignés lorsque, à la clôture d’un exercice social, la société remplit deux des conditions suivantes :'),
 L('total du bilan supérieur à cent vingt-cinq millions (125 000 000) de francs CFA ;'),
 L('chiffre d’affaires annuel supérieur à deux cent cinquante millions (250 000 000) de francs CFA ;'),
 L('effectif permanent supérieur à cinquante (50) personnes.'),
 P('Le commissaire aux comptes est nommé pour trois (3) exercices par un ou plusieurs associés représentant plus de la moitié du capital.'),
 P('La société n’est plus tenue de désigner un commissaire aux comptes dès lors qu’elle n’a pas rempli deux (2) des conditions fixées ci-dessus pendant les deux (2) exercices précédant l’expiration du mandat du commissaire aux comptes.'),
 ART(21,'DISSOLUTION'),
 P('La société à responsabilité limitée est dissoute pour les causes communes à toutes les sociétés. La dissolution de la société n’entraîne pas sa mise en liquidation.'),
 ART(22,'ENGAGEMENTS POUR LE COMPTE DE LA SOCIÉTÉ'),
 P('Un état des actes accomplis par l’associé unique pour le compte de la société en formation, avec l’indication de l’engagement qui en résulterait pour la société, est annexé aux présents statuts.',{when:v=>!String(v.engagements||'').trim()}),
 P('1. Un état des actes accomplis par l’associé unique pour le compte de la société en formation, avec l’indication de l’engagement qui en résulterait pour la société, est annexé aux présents statuts.',{when:v=>!!String(v.engagements||'').trim()}),
 P('2. En outre, {{sous_le}} se réserve le droit de prendre les engagements suivants au nom et pour le compte de la société : {{engagements}}',{when:v=>!!String(v.engagements||'').trim()}),
 ART(23,'FRAIS'),
 P('Les frais, droits et honoraires des présents statuts sont à la charge de la société.'),
 ART(24,'ÉLECTION DE DOMICILE'),
 P('Pour l’exécution des présentes et de leurs suites, {{sous_le}} déclare faire élection de domicile au siège social.'),
 ART(25,'POUVOIRS'),
 P('L’associé unique donne tous pouvoirs à {{mand_civ_long}} {{mandataire_nom}}, {{mandataire_profession}}, titulaire de la pièce d’identité : {{mandataire_piece}}, à l’effet de procéder à l’enregistrement des présents statuts, d’accomplir les formalités d’immatriculation au Registre du Commerce et du Crédit Mobilier, et, pour les besoins de ces formalités, de signer tout acte et d’en donner bonne et valable décharge.'),
 {k:'sp',kn:true},
 P('Fait à {{lieu}}, le {{date_longue}}',{kn:true}),
 P('EN {{nb_ex_lettres_maj}} ({{nb_ex}}) EXEMPLAIRES ORIGINAUX',{kn:true}),
 {k:'sp',kn:true},
 P('**'+ASSO1+'**',{al:'right',kn:true}),
 P('Associé unique',{al:'right',kn:true}),
 {k:'sp',kn:true},{k:'sp',kn:true},{k:'sp'}
];

const M1={
  id:'sarl-unipersonnelle-numeraire',cat:'prive',
  titre:'Statuts de SARL unipersonnelle',
  sous:'Un seul associé, apports en numéraire',
  resume:'Pour créer une SARL seul, avec un apport en espèces. 25 articles conformes à l’Acte uniforme OHADA révisé.',
  tags:['OHADA','Côte d’Ivoire','1 associé','Numéraire'],
  duree:'10 min',
  etapes:M1_ETAPES,
  defaults:()=>({civilite:'M.',liberation:'integrale',gerance_mode:'associe',limiter:'non',gerant_civilite:'M.',mandataire_civilite:'M.',nb_ex:'3',date:todayISO()}),
  exemple:M1_EXEMPLE,
  compute:m1Compute,
  blocks:(S,V)=>M1_CORPS.filter(b=>!b.when||b.when(S)),
  docTitle:V=>'Statuts '+(V.denomination_maj||'SARL unipersonnelle'),
  fileBase:V=>'Statuts-'+(fileSlug(V.denomination)?fileSlug(V.denomination)+'-':'')+'SARL-unipersonnelle',
  finalNote:'Joignez aux statuts l’état des actes accomplis pour le compte de la société en formation (article 22).',
  headline:S=>S.denomination||'',
  next:'declaration-souscription-versement',
  copyAssocie:S=>({mandataire_civilite:S.civilite||'M.',mandataire_nom:((S.prenom||'')+' '+(S.nom||'')).trim(),mandataire_profession:S.profession||'',mandataire_piece:S.piece||''})
};
JPModels.add(M1);
