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
| `text`, `area` | texte court / long (`upper: true` fournit aussi `{{nom_maj}}`) |
| `date` | date ; `{{id}}` donne « 15 janvier 2026 » ; `"def": "@today"` = aujourd'hui |
| `money` | montant ; `{{id}}` = « 2 500 000 », `{{id_lettres}}` = en toutes lettres |
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
