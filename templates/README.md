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

## Import Drive du 3 novembre 2026

L’inventaire du dossier Drive a porté sur 4 916 fichiers uniques, dont 693 DOCX dans les dossiers métier. Les pièces personnelles, jugements, comptes rendus et dossiers de travail ne sont pas intégrés automatiquement. Soixante-huit matrices ou modèles réutilisables ont finalement été retenus, copiés dans ce dossier sous forme anonymisée et classés dans les familles JuriskPro. Le lot couvre désormais les actes d’adoption, les demandes de congés, les documents de travail, les baux, les ventes, les procurations, les associations, les sociétés et les matrices OHADA. Le détail source/famille est conservé dans `source-template-report.csv`.

Les fichiers originaux téléchargés sont conservés hors du projet, dans la zone de traitement, et ne sont pas publiés dans JuriskPro. La validation finale exécutée sur les 68 copies n’a relevé aucun nom, adresse ou référence personnelle ciblée dans le texte visible, et aucun fichier DOCX invalide. Les composants ZIP Word sont identiques entre chaque original et sa copie anonymisée ; seule la valeur textuelle des zones anonymisées ou transformées en champs change. Les séries de points, ellipses, soulignements et instructions entre crochets ont été reliées à des champs `champ_###` afin qu’elles soient réellement remplissables et remplacées à l’export.

Les champs issus d’un emplacement visuel automatique reçoivent maintenant un libellé métier déduit du contexte (`Date à renseigner`, `Montant à renseigner`, `Adresse à renseigner`, `Nom du notaire à renseigner`, etc.). Lorsque le contexte est insuffisant, le libellé devient `Autre information à compléter`, avec un numéro d’emplacement pour distinguer les zones répétées. Le dossier « Donations » n’existe pas dans le Drive fourni et aucun modèle de donation n’a donc été inventé.
