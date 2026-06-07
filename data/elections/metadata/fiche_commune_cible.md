# Fiche communale cible

Objectif: produire une fiche par commune qui combine une synthese electorale lisible et des cartes lissees comparables entre scrutins.

## Donnees minimales de la fiche

Chaque fiche doit pouvoir s'appuyer sur:

- `indicateurs_scrutins.csv`: participation, abstention, exprimes, blancs, nuls, nombre de bureaux et couverture geographique.
- `resultats_top.csv`: principaux choix, listes ou candidats par scrutin.
- `bureaux_commune.csv`: bureaux de la commune avec coordonnees et metadonnees de geolocalisation.
- `resultats_commune_long.csv`: resultats detailles au format long pour graphiques et tableaux.
- `bureaux_non_geolocalises.csv`: points a exclure ou traiter explicitement avant cartographie.

## Structure proposee de fiche

1. Titre: commune, nombre de bureaux, couverture geographique.
2. Encadre de synthese: participation et abstention par scrutin.
3. Principaux resultats: top candidats/listes/choix par scrutin.
4. Evolution referendum 2018 -> 2020: oui/non, participation et abstention.
5. Provinciales 2019: principales listes et bloc politique apres validation du referentiel.
6. Legislatives 2024: resultats par tour.
7. Cartes lissees:
   - abstention;
   - participation;
   - principaux scores par option politique;
   - differences entre scrutins comparables.
8. Notes de qualite: bureaux non geolocalises, regroupements, limites d'interpolation.

## Principe cartographique

Pour les cartes lissees, privilegier l'interpolation de volumes numerator/denominator puis le calcul de ratio:

- abstention = interpolation des abstentions / interpolation des inscrits;
- participation = interpolation des votants / interpolation des inscrits;
- score d'une option = interpolation des voix / interpolation des exprimes.

Ce principe evite d'interpoler directement des pourcentages de bureaux de tailles tres differentes.

## Fonctions candidates pour package

- `nce_read_bureaux()`
- `nce_read_resultats()`
- `nce_list_communes()`
- `nce_commune_indicators()`
- `nce_commune_top_results()`
- `nce_prepare_fiche_data()`
- `nce_write_fiche_data()`
- `nce_interpolate_ratio_idw()`

Ces fonctions sont actuellement dans `compilation_elections_nc/R/`.
