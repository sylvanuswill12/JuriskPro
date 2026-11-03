# Modèles Word source JuriskPro

Ce dossier reçoit uniquement les `.docx` anonymisés validés. Les fichiers originaux du Drive ne doivent jamais être copiés ici.

## Déclarer un modèle

Dans le modèle JSON/JS correspondant, ajouter :

```json
"sourceTemplate": {
  "file": "templates/promesse-vente-immobiliere.docx",
  "version": "2026-11-03",
  "tokens": {
    "{{vendeur}}": "vendeur",
    "{{domicile_vendeur}}": "domicile_vendeur"
  }
}
```

Les jetons doivent être neutres et explicites (`{{nom}}`, `{{adresse_societe}}`, `{{date_acte}}`, etc.). Le moteur remplit le `.docx` dans `word/document.xml`, les tableaux, les en-têtes, pieds de page, notes et commentaires, sans reconstruire la mise en page. Les styles, marges, polices, images et relations du fichier source sont conservés.

## Contrôle avant intégration

1. Travailler sur une copie du document Drive.
2. Remplacer noms, prénoms, adresses, téléphones, e-mails, numéros d’identification, sociétés, montants, dates personnelles et références de dossier par des jetons neutres.
3. Vérifier aussi les en-têtes, pieds de page, commentaires, propriétés et métadonnées du document.
4. Ajouter le document dans la bonne famille : `baux`, `ventes-immobilier`, `procurations-actes-divers`, `famille-successions`, `societes-associations`, `travail` ou une sous-famille OHADA.
5. Lancer `npm test` et effectuer une recherche finale des noms, adresses, numéros et références personnelles avant publication.

L’aperçu JuriskPro reste généré depuis la définition du modèle. Lorsqu’un modèle possède `sourceTemplate`, le bouton Word utilise le fichier Word source ; PDF et aperçu conservent le comportement existant jusqu’à l’ajout d’un moteur de rendu Word/PDF dédié.
