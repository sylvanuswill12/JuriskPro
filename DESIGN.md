# Design JuriskPro (v41)

Le design vit dans `styles.css`. La fin du fichier (« JuriskPro v41 ») est la couche de référence : elle redéfinit les jetons et les mouvements ; ne pas ajouter de valeurs « en dur » ailleurs.

## Jetons (variables CSS dans `:root`, clair et sombre)
- Couleurs : `--accent` (vert JuriskPro) pour l'action et la validation ; `--gold` (or, avec `--gold-soft`, `--gold-line`, `--gold-ink`) **uniquement** pour les favoris, la progression terminée et « Prêt à être téléchargé ». Une seule couleur d'accent en plus du vert : n'en ajoutez pas d'autre.
- Profondeur : `--sh-1` (cartes), `--sh-2` (survol), `--sh-accent` (boutons principaux).
- Mouvement : `--ease-out`, `--ease-spring`, `--dur-1` (.12 s), `--dur-2` (.22 s), `--dur-3` (.36 s).
- Typographie : interface en `--font-ui` (Instrument Sans, repli système) ; grands titres (accueil, page d'un modèle) en `--font-display` (police à empattements du téléphone : Noto Serif sur Android) ; documents en `--font-doc` (fidélité au Word, ne pas changer).

## Règles de mouvement
1. Tout ce qui bouge est dans `@media (prefers-reduced-motion:no-preference)` : rien ne bouge quand le téléphone demande de réduire les animations (`fx.js` coupe aussi la vibration et les ondes).
2. On n'anime que `transform` et `opacity` (fluide sur un téléphone modeste), jamais `width`, `height` ou `top`.
3. Durées de 120 à 360 ms, sauf les décors de l'accueil. Pas de bibliothèque d'animation.
4. Une animation sert une information : apparition d'une carte, étape complétée, favori ajouté, barre de progression, « prêt à télécharger ».

## Interactions
- `fx.js` : onde au toucher sur `.btn`, `.lb-chip`, onglets du formulaire ; vibration brève (8 à 16 ms) sur favori, étape complétée, téléchargement.
- `app.js` : `refreshProgress()` met à jour pendant la saisie le compteur « n / total champs renseignés » et la barre `.fp-bar` ; `renderSteps()` marque `just-done` l'étape qui vient de devenir complète.
- La barre « Formulaire / Aperçu » est masquée sur téléphone tant que l'aperçu n'est pas disponible.
