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

## Encadré En bref

Les articles longs ou structurants peuvent commencer par :

```markdown
::: {.en-bref}
## En bref

- Premier résultat important.
- Deuxième résultat important.
- Troisième résultat important.
:::
```

L’encadré doit reprendre uniquement des résultats explicitement présents dans l’article. Ne pas ajouter de chiffre nouveau sans source ou calcul déjà documenté dans le texte.
