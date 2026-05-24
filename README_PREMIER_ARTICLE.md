# Fichiers à ajouter pour rendre le premier article entièrement reproductible

Article concerné : `posts/regroupement-bureaux-vote-noumea/index.qmd`

Le site peut être prévisualisé sans ces fichiers. L'article affiche alors une note de prévisualisation et les calculs dépendants des données sont désactivés. Pour activer les tableaux, graphiques et cartes, ajoutez les fichiers ci-dessous.

## Rasters de temps

À placer dans : `data/outputs_noumea_municipales_2026_v2/`

- `noumea_temps_pieton_bureaux_complets_min_cellules_habitees.tif`
- `noumea_temps_pieton_centres_regroupes_8_min_cellules_habitees.tif`
- `noumea_temps_pieton_centres_regroupes_9_sans_kowe_kara_kamere_kafoa_min_cellules_habitees.tif`

## Données géographiques

À placer dans : `data/02_geospatial/vecteurs/`

- `iris_rgp_2019.geojson`

À placer dans : `data/02_geospatial/rasters/`

- `NCL_Pop_Grid_2020.tif`

## Cartes QGIS optionnelles

À placer dans : `data/cartes/municipales 2026/`

- `temps trajet nouméa bureaux complets.png`
- `temps trajet nouméa bureaux regroupés.png`
- `temps trajet nouméa bureaux regroupés sans koe kara.png`
- `menages sans véhicules noumea 2019.png`
- `abstention nouméa 2026 bureaux complets.png`

## Packages R nécessaires

L'article utilise : `dplyr`, `ggplot2`, `gt`, `scales`, `sf`, `terra`, `tidyr`, `knitr`.

## Rendu local

Depuis le dossier du projet :

```bash
quarto preview
```

ou :

```bash
quarto render
```
