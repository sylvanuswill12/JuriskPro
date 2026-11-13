# Ajouter un modèle à JuriskPro

JuriskPro est conçu pour des milliers de modèles. Chaque modèle est un fichier dans `models/`.
Le catalogue (familles, listes, recherche) est **généré automatiquement** à partir de ces fichiers.

## En 4 étapes
1. Créer `models/<identifiant>.json` (voir le format ci-dessous). L'identifiant : minuscules, chiffres et tirets, et **le nom du fichier doit être identique**.
2. `npm run build:catalogue` : génère le catalogue (dossier `catalogue/` et `catalogue-data.js`).
3. `npm run test:models` : contrôle tous les modèles. Rien ne doit être en rouge.
4. Publier (`git add -A`, `git commit`, `git push`). Les fichiers générés sont versionnés avec le reste.

Sur Termux : `pkg install nodejs` une seule fois, puis les commandes ci-dessus.
Sur GitHub, le contrôle (onglet Actions, « Contrôle des modèles ») se relance à chaque publication et signale tout modèle cassé ou catalogue pas à jour.

## Familles
`models/families.json` : `{ "id": "baux", "titre": "Baux et immobilier", "aide": "…", "ord": 3 }`.
Un modèle indique sa famille dans `cat`. La page d'une famille affiche ses modèles 40 par 40 ; `sub` (facultatif) crée des intertitres dans la famille.

## Format d'un modèle (JSON)
```json
{
 "id": "lettre-demission",
 "cat": "travail",
 "sub": "Salariés",
 "titre": "Lettre de démission",
 "sous": "Une phrase de présentation",
 "resume": "Texte affiché dans la fiche et utilisé par la recherche.",
 "tags": ["démission", "préavis", "salarié"],
 "duree": "5 min",
 "docTitle": "Lettre de démission de {{nom}}",
 "fileBase": "Lettre-demission-{{nom}}",
 "headline": "{{nom}}",
 "etapes": [ { "id": "identite", "court": "Identité", "titre": "Qui démissionne ?", "intro": "…", "champs": [ … ] } ],
 "calc": { "date_fr": { "fn": "date", "of": "date" } },
 "doc": [ { "k": "tit", "text": "LETTRE DE DÉMISSION" }, { "k": "p", "text": "Je soussigné {{nom}}…" } ],
 "exemple": { "nom": "Kouassi" }
}
```
`tags` est obligatoire (la recherche s'appuie dessus). L'étape finale « Télécharger » est ajoutée automatiquement.

### Champs
`{ "id": "nom", "type": "text", "label": "Nom", "req": true, "half": true, "ph": "Exemple", "aide": "Texte d'aide" }`

| type | rôle |
|---|---|
| `text`, `area` | texte court / long (`upper: true` fournit aussi `{{nom_maj}}` ; `{{id_de}}` / `{{id_de_maj}}` donnent « de Bouaké » / « d’Abidjan » avec l'élision correcte) |
| `date` | date ; `{{id}}` donne « 15 janvier 2026 », `{{id_jm}}` donne « 15 janvier » (sans l'année, pour un acte dont « L'AN DEUX MIL … » est déjà écrit) ; `"def": "@today"` = aujourd'hui |
| `money` | montant ; `{{id}}` = « 2 500 000 », `{{id_lettres}}` = en toutes lettres, `{{id_fcfa}}` = en toutes lettres + « francs CFA » |
| `int` | nombre entier |
| `choice` (`"variant": "seg"` pour des boutons) | choix ; `{{id}}` = valeur, `{{id_t}}` = libellé ; `opts` : liste `[{"v","t"}]` ou `"civilite"`, `"ouinon"` |
| `select` | liste déroulante (mêmes `opts`) |
| `info` | message calculé : `{ "type": "info", "when": {condition}, "text": "…{{champ}}…", "c": "warn" }` ; avec `"c": "bad"`, il **bloque le téléchargement** (incohérence) |

**Champs obligatoires** : `req: true`. En plus, tout champ dont le document a besoin est exigé automatiquement : un `{{champ}}` laissé vide ferait un blanc, donc le téléchargement est bloqué. Ajoutez « (facultatif) » dans le libellé, ou `"opt": true`, pour un champ qui peut rester vide.

### Conditions (jamais de code)
`{ "field": "mode", "eq": "echeances" }` — aussi `ne`, `in: [..]`, `gt`, `lt`, `filled: true`, `empty: true`, et les combinaisons `{ "all": [..] }`, `{ "any": [..] }`, `{ "not": {..} }`.
S'utilise dans `showIf` (afficher un champ), `when` (un message ou un bloc) et `if` (dans le document).

### Listes répétées (plusieurs parties, associés…)
```json
{ "type": "repeat", "id": "parties", "prefix": "p", "countKey": "nb_parties", "min": 2, "max": 5,
  "label": "Partie", "addLabel": "Ajouter une partie",
  "fields": [ { "id": "prenom", "type": "text", "label": "Prénom", "req": true } ] }
```
Les champs d'une ligne s'appellent `p0_prenom`, `p1_prenom`… Dans les conditions et le document : `@prenom` = le champ de la ligne en cours.

### Document (`doc`)
Blocs : `tit` (titre), `sous`, `part`, `art` (article), `sub`, `li` (puce), `p` (paragraphe, `"al": "right"`), `sp`, `pb` (saut de page), `box`, `sigs` (signatures, `items`), `table` (`head`, `rows`, `cols`).
Texte : `{{champ}}` (la valeur ; un champ vide donne un blanc en pointillés), `{{?champ}}` (la valeur, ou rien du tout si le champ est vide : aucun blanc).
Logique : `{ "if": {cond}, "then": [blocs], "else": [blocs] }`, `{ "when": {cond}, "k": "p", … }`, et pour une liste répétée `{ "each": "parties", "blocks": [ … {{@prenom}} … {{#}} (numéro 1, 2, 3) ] }`.
Calculs (`calc`) : `{ "fn": "upper|lower|lettres|fcfa|fmt|date", "of": "champ" }`, `{ "tpl": "{{civ}} {{prenom}} {{nom}}" }`, `{ "pick": "civilite", "map": { "M.": "né", "Mme": "née" } }`.

### L'exemple
`exemple` doit remplir **tous** les champs nécessaires. Le contrôle échoue sinon, et c'est voulu : le bouton « Remplir avec un exemple » doit toujours donner un document complet.

## Ce que `npm run test:models` vérifie
Champs en double, types inconnus, options manquantes, étape finale ; document généré sans « undefined » ni « NaN » ; faute de frappe dans un `{{champ}}` ; exemple complet et sans incohérence ; formulaire vide bien bloqué ; conditions sans erreur ; blocs exportables en Word.

## Modèles écrits en code (cas complexes)
Un fichier `models/<identifiant>.js` qui se termine par `JPModels.add(MonModele);`. Pour partager du code entre plusieurs modèles, créer un fichier `models/_ma-bibliotheque.js` (première ligne `/* @lib */`) et le déclarer dans chaque modèle : `/* @needs _ma-bibliotheque */`. Exemple : les modèles notaires (`_socle-notaires.js`).

## Capacité
Testé avec 1 500 modèles : démarrage identique (aucun fichier de catalogue chargé), liste d'une famille 40 par 40, recherche en 0,2 ms, contrôle complet en 5 s. L'index de recherche pèse environ 250 octets par modèle (≈ 26 Ko compressés pour 1 500) ; au-delà de 10 000 modèles, déplacer la recherche côté serveur (Supabase).

## Bibliothèque : dates, popularité, étiquettes (v36)

- `models/library.json` : registre de la bibliothèque.
  - `ajouts` : date d'ajout (AAAA-MM-JJ) de chaque modèle. Un nouveau modèle y est inscrit automatiquement, avec la date du jour, par `npm run build:catalogue`. Elle sert à l'onglet « Derniers ajouts » (elle n'est pas affichée aux utilisateurs).
  - `populaires` : sélection éditoriale, du plus au moins populaire. Sur chaque appareil, les modèles que l'utilisateur ouvre le plus passent devant.
- `models/families.json` : le champ `court` donne le nom de la puce de catégorie (« Sociétés », « Travail »…).
- Étiquettes des cartes (#OHADA…) : calculées par le catalogue (sous-rubrique, juridiction citée, mots-clés rédigés avec majuscule). Les mots-clés en minuscules ne servent qu'à la recherche.

## PDF fidèle (v36)

Pour un modèle issu d'un fichier Word (`sourceTemplate`), le PDF téléchargé est recomposé dans le navigateur à partir de `templates/source-*.lay.json` (mise en page extraite du Word : polices, marges, retraits, interlignes, tableaux, numérotation) avec les polices de `vendor/fonts/`. Si cette étape échoue, l'application retombe sur la mise en page simplifiée. Le fichier Word téléchargé reste le document d'origine rempli, sans aucune recomposition.

## Aperçu fidèle et « Mon cabinet » (v38)

- Aperçu : pour un modèle issu d'un fichier Word, le volet d'aperçu (et l'aperçu plein écran) affiche la vraie page, calculée par le même moteur que le PDF (`layout-pdf.js`) et dessinée sur des `<canvas>` ; les zones à compléter sont surlignées. Il est disponible à toutes les étapes. Si le moteur échoue, l'ancien aperçu simplifié s'affiche.
- Mon cabinet (écran Compte) : qualité, prénom, nom, étude, adresse, BP, ville, téléphone, e-mail, enregistrés sur l'appareil uniquement (`juriskpro:cabinet:v1`). Sous un champ texte actif, ces valeurs apparaissent en boutons et s'insèrent d'un toucher.
- Reprise automatique : seuls les champs marqués dans le modèle (`"profil": "nom" | "prenom" | "maitre" | "ville"`, avec `"pq": "notaire"` pour ne s'appliquer qu'à un notaire) sont remplis, et seulement dans un nouveau brouillon. Le marquage se fait avec `tools/tag_profil.py` (libellés exacts, jamais les champs ambigus comme « Ville », « Lieu » ou « BP »).

## Aucune valeur « en dur » dans un modèle Word (v39)

Un lieu, une date ou une valeur qui change d'un dossier à l'autre ne doit jamais être écrit dans le Word : c'est un `{{champ}}` relié au formulaire. Seules restent en dur les constantes juridiques (articles, seuils légaux, noms d'institutions) et, à la demande du cabinet, l'année des actes notariés (« L'AN DEUX MIL … »). Outils :

- `tools/scan_literals.py` et `tools/scan_literals2.py` : inventaire des valeurs écrites en dur (villes, dates, jours, montants, noms propres) dans `templates/source-*.docx`.
- `tools/fix_literals.py <projet> <bak34>` : convertit ces valeurs en champs (`ville_notaire`, `ville_signature`, `date_lettre`, `salaire_net`, …) et fusionne les jetons doubles du type `{{a}}({{b}})` en un seul champ (écriture en lettres calculée par `_lettres` / `_fcfa`). `ville_notaire` et `ville_signature` portent `profil` / `pq` : ils se remplissent depuis « Mon cabinet ».
- `tools/relabel.py <projet>` : renomme les libellés trop génériques à partir du texte voisin.
- `tools/year_jm.py <projet>` : un champ date placé juste sous « L'AN DEUX MIL … » utilise `{{id_jm}}` pour ne pas afficher deux années.
- `tools/split_sarl.py` : sépare un fichier Word qui contient plusieurs versions (modèle simplifié / développé / autres actes) en autant de modèles distincts. **Règle** : deux versions d'un même acte = deux modèles, jamais un seul.

## Mêmes règles pour tous les modèles, convertis ou non (v39)

- **Champs obligatoires** : un champ est obligatoire (astérisque rouge) sauf `"opt": true`. Dans un modèle converti d'un Word, `opt` n'est posé que pour les champs qui ne concernent pas tous les cas (lignes de tableau supplémentaires, alternatives « ou », mentions entre parenthèses, conjoint, libellé « facultatif »). `tools/set_required.py <projet>` applique cette règle (classement dans `tools/classify_opt.py`).
- **Parties facultatives** : une étape marquée `"fac": true` (variante, clause qui ne concerne pas tous les cas) n'exige ses champs que si on commence à la remplir. Un modèle marqué `"etapesAuChoix": true` (plusieurs actes ou résolutions dans un même Word) traite toutes ses étapes ainsi et exige au moins une partie remplie ; `"noteForm"` est le message affiché en tête de chaque étape et sur la page de présentation.
- **Coche verte** : une étape devient verte seulement quand ses champs obligatoires sont remplis ; une étape sans champ obligatoire ne devient verte que si on y a saisi quelque chose.
- **Aperçu et téléchargement** : disponibles uniquement à l'étape finale, quand tous les champs obligatoires sont remplis et qu'aucune incohérence n'est signalée.
- **Page de présentation** : un petit aperçu du début du document (première page seulement, fondu en bas), sans aperçu complet.
- Le bouton « Remplir avec un exemple » n'existe que pour les modèles qui ont de vraies données d'exemple (pas pour les modèles convertis).

## APK : fichiers embarqués

`scripts/prepare-web.cjs` copie dans `www/` (donc dans l'APK) la liste de scripts de la racine. Depuis la v38, il vérifie aussi que chaque script chargé par `index.html` y figure (`template-engine.js` et `layout-pdf.js` manquaient auparavant à cette liste).
