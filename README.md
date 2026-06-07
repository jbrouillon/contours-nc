# Contours NC

Site Quarto pour le blog **Contours NC** : sciences sociales, cartographie et visualisation de données en Nouvelle-Calédonie.

## Prévisualiser le site

Dans le terminal du projet :

```bash
quarto preview
```

## Générer le site

Avant le rendu, préparer les versions web des cartes et des images du site :

```bash
python scripts/prepare_web_images.py
python scripts/prepare_social_previews.py
```

Les PNG originaux restent dans `data/cartes/` et `images/`. Le site affiche les versions WebP sans perte générées à côté, avec un favicon léger dédié. Les previews sociales des articles sont générées en JPEG 1200 x 630 dans `images/previews/`.

```bash
quarto render
```

## Premier article

Le premier article est ici :

```text
posts/regroupement-bureaux-vote-noumea/index.qmd
```

Les données locales à ajouter sont listées dans `README_PREMIER_ARTICLE.md`.
