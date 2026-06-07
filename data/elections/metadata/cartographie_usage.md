# Usage des fonctions de cartographie

Les fonctions de cartographie sont dans `R/05_maps.R`.

## Charger les fonctions

```r
library(dplyr)
library(sf)
library(terra)
library(ggplot2)
library(ggspatial)
library(ggrepel)
library(RColorBrewer)

root <- "compilation_elections_nc"
source(file.path(root, "R/00_utils.R"))
source(file.path(root, "R/01_data.R"))
source(file.path(root, "R/03_rasters.R"))
source(file.path(root, "R/04_blocs.R"))
source(file.path(root, "R/05_maps.R"))

ctx <- nce_map_context(root)
```

## Commande directe R + QGIS

Pour produire une carte finale en PNG avec le template QGIS, utiliser:

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin provinciales_2019 `
  --type parti `
  --valeur 'AVENIR CONFIANCE' `
  --echelle province `
  --province 'Province Sud' `
  --title 'Province Sud - Provinciales 2019 - Avenir confiance'
```

Le script calcule le raster avec `nce_make_carte_resultat()`, puis appelle PyQGIS. Les resolutions automatiques sont `500` m pour `nc`, `250` m pour `province` et `20` m pour `commune`.

Le score total de la valeur cartographiee est ajoute automatiquement au titre pour faciliter le controle. Aux echelles infra-NC, une sous-ligne ajoute aussi les scores de comparaison: score NC pour une province ou une circonscription; score province et score NC pour une commune quand la province peut etre retrouvee.

Les PNG QGIS sont ranges automatiquement dans `outputs/cartes_qgis/<scrutin>/<echelle>/<type>/`. Pour les provinciales 2019, le dossier de scrutin est simplement `provinciales`; pour `referendum_2018`, `referendum_2020` et `referendum_2021`, il est `referendums`.

## Carte de bloc a l'echelle NC

```r
nce_make_carte_resultat(
  scrutin = "legislatives_2024",
  tour = "1",
  type = "bloc",
  valeur = "independantiste",
  echelle = "nc",
  root = root,
  context = ctx
)
```

## Carte de parti

```r
nce_make_carte_resultat(
  scrutin = "legislatives_2024",
  tour = "1",
  type = "parti",
  valeur = "CE",
  echelle = "nc",
  root = root,
  context = ctx
)
```

## Carte d'une commune

```r
nce_make_carte_resultat(
  scrutin = "legislatives_2024",
  tour = "1",
  type = "bloc",
  valeur = "loyaliste",
  echelle = "commune",
  commune = "Noumea",
  resolution = 20,
  root = root,
  context = ctx
)
```

A l'echelle commune, l'export QGIS ajoute les labels IRIS avec la meme mise en forme que les labels communaux, sans afficher les frontieres IRIS.

Les communes voisines sont affichees en contexte `antiquewhite`, sous le raster de la commune cartographiee.

## Comparer deux cartes avec la meme legende

Chaque carte exportee produit un manifest CSV contenant le chemin du raster. Pour appliquer l'echelle de couleurs d'une carte de reference a une autre carte, utiliser `--scale-reference-manifest`.

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin provinciales_2019 `
  --type parti `
  --valeur 'AVENIR CONFIANCE' `
  --echelle commune `
  --commune 'Dumbea' `
  --scale-reference-manifest 'compilation_elections_nc/outputs/cartes_qgis/provinciales/commune/parti/noumea_avenir_confiance_manifest.csv'
```

On peut aussi pointer directement vers un GeoTIFF avec `--scale-reference-raster`, ou forcer les bornes avec `--legend-min` et `--legend-max`.

## Carte d'une province

Les provinciales utilisent des listes propres a chaque province. Pour ce cas, filtrer explicitement la province avant le lissage:

```r
nce_make_carte_resultat(
  scrutin = "provinciales_2019",
  type = "parti",
  valeur = "AVENIR CONFIANCE",
  echelle = "province",
  province = "Province Sud",
  resolution = 250,
  root = root,
  context = ctx
)
```

## Carte de participation ou d'abstention

Ces deux types ne demandent pas de `--valeur`: ils cartographient respectivement `votants / inscrits` et `abstentions / inscrits`.

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin legislatives_2024 `
  --tour 1 `
  --type participation `
  --echelle province `
  --province 'Province Sud'
```

Exemple referendum 2021:

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin referendum_2021 `
  --type participation `
  --echelle commune `
  --commune 'Noumea'
```

## Carte d'une circonscription legislative

La circonscription 1 correspond a Noumea, Mare, Lifou, Ouvea et l'Ile des Pins. La circonscription 2 correspond au reste de la Nouvelle-Caledonie.

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin legislatives_2024 `
  --tour 1 `
  --type bloc `
  --valeur loyaliste `
  --echelle circonscription `
  --circonscription 1
```

## Types disponibles

- `type = "bloc"`: utilise `independantiste`, `loyaliste`, `centriste`, `autre`.
- `type = "camp"`: utilise le champ institutionnel, par exemple `independantiste` ou `anti_independantiste`.
- `type = "parti"`: utilise les codes de `metadata/blocs_reference.csv`, par exemple `CE`, `UC`, `GNC`, `R-LR`.
- `type = "option"`: cible un libelle exact de candidat, liste ou choix, par exemple `Nicolas Metzdorf`, `OUI`, `PS LISTE 03`.
- `type = "participation"`: cartographie la part des votants parmi les inscrits.
- `type = "abstention"`: cartographie la part des abstentions parmi les inscrits.

## Parametres cartographiques utiles

- `echelle = "nc"`: carte de toute la Nouvelle-Caledonie, avec limites et noms des communes.
- `echelle = "province"` et `province = "..."`: carte cadree et calculee sur une province; utile notamment pour les provinciales.
- `echelle = "circonscription"` et `circonscription = "1"` ou `"2"`: carte cadree et calculee sur une circonscription legislative.
- `echelle = "commune"` et `commune = "..."`: carte cadree sur une commune.
- `classes = 10`: nombre cible de classes discretes.
- `palette = "Spectral"`: palette utilisee pour les classes.
- `resolution = NULL`: resolution automatique du raster en metres, soit `500` m a l'echelle NC, `250` m a l'echelle province et circonscription, et `20` m a l'echelle communale.
- `fond = "aliceblue"`: fond de carte.

Les cartes ajoutent automatiquement les villes/villages et tribus, les limites communales, une echelle graphique et une fleche du nord. Les routes ne sont pas representees. Le cartouche de titre est dessine sur fond blanc avec un filet noir fin et la carte est decalee pour eviter de masquer les polygones d'interet.
