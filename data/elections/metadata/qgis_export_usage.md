# Export QGIS des cartes raster lissees

Le script PyQGIS `scripts/python/10_export_qgis_map.py` utilise le template:

```text
compilation_elections_nc/data_raw/referentiels_geographiques/carto_capital_acp.qgz
```

Il ne recalcule pas le lissage. La logique recommandee est:

1. Produire un raster lisse avec R et `nce_make_carte_resultat()`.
2. Exporter ce raster dans la composition QGIS avec le script PyQGIS.

## Commande tout-en-un

Le script `scripts/R/10_make_qgis_map.R` enchaine les deux etapes: production du raster avec R, puis export PNG avec PyQGIS. Sous PowerShell, le plus simple est d'utiliser le raccourci:

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin provinciales_2019 `
  --type parti `
  --valeur 'AVENIR CONFIANCE' `
  --echelle province `
  --province 'Province Sud' `
  --title 'Province Sud - Provinciales 2019 - Avenir confiance'
```

Exemple communal, avec resolution automatique a 20 m:

```powershell
& '.\compilation_elections_nc\scripts\powershell\make_qgis_map.ps1' `
  --scrutin legislatives_2024 `
  --tour 1 `
  --type bloc `
  --valeur loyaliste `
  --echelle commune `
  --commune Noumea `
  --title 'Noumea - Legislatives 2024 T1 - loyaliste'
```

Les sorties par defaut sont:

- raster GeoTIFF: `outputs/rasters_qgis/`
- PNG QGIS: `outputs/cartes_qgis/`
- manifest CSV par carte: a cote du PNG QGIS

Options pratiques: `--out-rasters`, `--out-qgis-dir`, `--out-png`, `--resolution`, `--classes`, `--skip-qgis`.

Par defaut, la commande ajoute au titre le score total de la valeur cartographiee dans le perimetre demande, par exemple `38,5 % exprimes`. Utiliser `--no-score-title` pour desactiver cet ajout.

## Serie provinciales 2019 par parti

Pour produire toutes les listes des provinciales 2019 a l'echelle de leur province:

```powershell
& 'C:\Program Files\R\R-4.5.2\bin\Rscript.exe' `
  'compilation_elections_nc\scripts\R\11_make_provinciales_partis_qgis_maps.R'
```

Sorties par defaut:

- rasters: `outputs/rasters_provinciales_2019_partis_provinces/`
- PNG QGIS: `outputs/cartes_qgis/provinciales_2019_partis_provinces/`
- manifest global: `outputs/cartes_qgis/provinciales_2019_partis_provinces/manifest_provinciales_2019_partis_provinces.csv`

Options utiles: `--province 'Province Nord'`, `--dry-run`, `--max-maps 3`, `--skip-existing`, `--manifest`.

## Export NC

```powershell
& 'C:\Program Files\QGIS 3.40.14\bin\python-qgis-ltr.bat' `
  'compilation_elections_nc\scripts\python\10_export_qgis_map.py' `
  --raster 'compilation_elections_nc\outputs\rasters_blocs\legislatives_2024_t1_bloc_independantiste_nc_nc.tif' `
  --output 'compilation_elections_nc\outputs\cartes_qgis\legislatives_2024_t1_independantiste.png' `
  --echelle nc `
  --title 'Legislatives 2024 T1 - independantiste'
```

## Export province

```powershell
& 'C:\Program Files\QGIS 3.40.14\bin\python-qgis-ltr.bat' `
  'compilation_elections_nc\scripts\python\10_export_qgis_map.py' `
  --raster 'compilation_elections_nc\outputs\rasters_tests_province\provinciales_2019_scrutin_parti_avenir_confiance_province_province_sud.tif' `
  --output 'compilation_elections_nc\outputs\cartes_qgis\province_sud_provinciales_2019_avenir_confiance.png' `
  --echelle province `
  --province 'Province Sud' `
  --title 'Province Sud - Provinciales 2019 - Avenir confiance'
```

## Export commune

Pour une commune, produire d'abord un raster communal cote R:

```r
nce_make_carte_resultat(
  scrutin = "legislatives_2024",
  tour = "1",
  type = "bloc",
  valeur = "loyaliste",
  echelle = "commune",
  commune = "Noumea",
  resolution = 20
)
```

Puis exporter le raster communal:

```powershell
& 'C:\Program Files\QGIS 3.40.14\bin\python-qgis-ltr.bat' `
  'compilation_elections_nc\scripts\python\10_export_qgis_map.py' `
  --raster 'compilation_elections_nc\outputs\rasters_resultats\legislatives_2024_t1_bloc_loyaliste_commune_noumea.tif' `
  --output 'compilation_elections_nc\outputs\cartes_qgis\noumea_legislatives_2024_t1_loyaliste.png' `
  --echelle commune `
  --commune Noumea `
  --title 'Noumea - Legislatives 2024 T1 - loyaliste'
```

## Options utiles

- `--template`: chemin du projet `.qgz` template.
- `--echelle`: `nc`, `province` ou `commune`.
- `--province`: obligatoire si `--echelle province`.
- `--commune`: obligatoire si `--echelle commune`.
- `--classes`: nombre de classes discretes, 10 par defaut.
- `--legend-title`: libelle de la bande de legende, `exprimes %` par defaut.
- `--note`: texte de note pour remplacer le bloc `Lecture` du template. Par defaut, il est masque.
- `--credit`: credit cartographique. Passer `--credit ""` pour le masquer.
- `--padding`: marge autour de l'extent du raster.
- `--dpi`, `--width`, `--height`: parametres d'export PNG.

Le script supprime les rasters du template avant d'ajouter le raster electoral, masque les objets carte secondaires de la composition, puis utilise en priorite les couches vectorielles deja presentes dans le template quand elles sont valides: une couche polygonale de communes et une couche ponctuelle avec le champ `type` pour `VILLE`/`TRIBU`. Si elles sont absentes, il reconstruit des couches de secours.

A l'echelle province, les autres provinces sont affichees en fond `antiquewhite`, sans villes/tribus actives. Les symboles de type ville sont masques pour Noumea, Dumbea et Mont-Dore afin de ne pas saturer la carte. Le cadrage est base sur l'extent du raster. Pour les cartes communales, produire le raster cote R a `resolution = 20`.

Dans le template QGIS, il est possible de nettoyer par confort les anciennes couches `capital_acp_lisse_nc` et `capital_acp_lisse_noumea`, mais ce n'est pas obligatoire: toutes les couches raster presentes dans le template sont retirees automatiquement a l'export.
