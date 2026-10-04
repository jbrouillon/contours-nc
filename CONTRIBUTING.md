# Conventions éditoriales contours.nc

## Rubriques et tags

Les articles utilisent deux niveaux de classement.

```yaml
rubrique: "Politique et élections"
categories:
  - Provinciales 2026
  - Analyse électorale
  - Participation
```

- `rubrique` désigne la grande famille éditoriale. Elle sert à organiser le site et les futurs dossiers.
- `categories` contient les tags publics utilisés par les listings Quarto et les filtres de catégories. Utiliser deux tags quand cela suffit, trois lorsqu'il y a un vrai second axe de lecture. Éviter de cumuler rubrique, méthode, territoire et sujet si l'un de ces éléments apparaît déjà clairement dans le titre ou le dossier.
- Ne pas créer de page de rubrique vide. Une page de rubrique doit présenter de vrais contenus.

Rubriques principales retenues :

- `Politique et élections`
- `Territoires et société`
- `Cartographie et données`
- `Méthodes`

## Inventaire harmonisé

Les anciennes métadonnées mélangeaient rubriques, sujets et méthodes dans `categories` :

- rubriques : `Élections`, `Politique`, `Cartographie`, `Institutions`
- sujets : `Provinciales 2026`, `Provinciales 2019`, `Nouméa`, `Inégalités`
- méthodes : `Analyse électorale`, `Analyse textuelle`, `Data mining`
- catégories trop générales ou ambiguës : `Analyse`, `Débat public`
- variantes : `cartes`, `cartographie`, `dataviz`, `Data mining`

La convention actuelle évite les tags décoratifs ou interchangeables. Un tag doit signaler un vrai point d'entrée éditorial, par exemple `Participation`, `Inégalités`, `Accessibilité`, `Analyse électorale`, `Programmes`, `Congrès`, `Cartographie` ou `Données`.

## Résumé En bref

Les articles longs ou structurants comportent désormais un résumé « En bref » en diapositives, construit avec le composant commun `assets/js/contours-brief.js` et `assets/css/contours-brief.css` :

```html
<section class="contours-brief" data-contours-brief data-brief-lede="Six écrans pour…">
  <article class="contours-brief-slide">
    <div class="contours-brief-copy">
      <p class="contours-brief-step">1 · Thème</p>
      <h3>Une phrase-résultat.</h3>
      <p class="contours-brief-big"><span>40,6 %</span><span aria-hidden="true">→</span><span class="is-up">50,1 %</span></p>
      <p>La précision : repère de comparaison, source ou limite.</p>
    </div>
  </article>
</section>
<script src="../../assets/js/contours-brief.js"></script>
```

Exemple complet : `posts/provinciales-2026-geographie-forces-politiques/index.qmd`. Les règles détaillées (nombre d’écrans, croquis, accessibilité, contrôles) figurent dans `AGENTS.md`.

Pour une note courte ou un article historique, l’ancien encadré reste possible :

```markdown
::: {.en-bref}
## En bref

- Premier résultat important.
- Deuxième résultat important.
- Troisième résultat important.
:::
```

Diapositives comme encadré doivent reprendre uniquement des résultats explicitement présents dans l’article. Ne pas ajouter de chiffre nouveau sans source ou calcul déjà documenté dans le texte.
