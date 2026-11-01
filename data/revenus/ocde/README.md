# Indicateurs d'inégalités des pays de l'OCDE

Base de données de l'OCDE sur la distribution des revenus (*Income distribution database*, IDD), interrogée par l'API SDMX de l'OCDE Data Explorer le 30 octobre 2026. Le fichier est conservé tel quel ; aucune correction n'y est apportée.

| Fichier | Contenu | URL | SHA-256 |
|---|---|---|---|
| `idd-20261030-indicateurs.csv` | 45 pays (membres de l'OCDE et quelques partenaires), 2010 et après, population totale, définition des revenus en vigueur depuis 2012 (`METH2012`, `D_CUR`) : indice de Gini du revenu disponible (`INC_DISP_GINI`), rapport interdécile P90/P10 (`D9_1_INC_DISP`), rapport interquintile S80/S20 (`QR_INC_DISP`), taux de pauvreté au seuil de 50 % et de 60 % du revenu disponible médian national (`PR_INC_DISP`, `PL_50` et `PL_60`). 2 395 observations, codes et libellés anglais. | <https://sdmx.oecd.org/public/rest/data/OECD.WISE.INE,DSD_WISE_IDD@DF_IDD,1.0/.A.INC_DISP_GINI+D9_1_INC_DISP+QR_INC_DISP+PR_INC_DISP..._T.METH2012.D_CUR.?startPeriod=2010&dimensionAtObservation=AllDimensions&format=csvfilewithlabels> | `51172a4358d310c23991ee31eb6b03644a541bc7ce8e7a3d8e98a7c046c3b045` |

Conditions de réutilisation : conditions générales de l'OCDE pour les données (<https://www.oecd.org/en/about/terms-conditions.html>) : extraction, copie, adaptation et diffusion permises pour tout usage, avec mention de la source sous la forme « OCDE (année), titre du jeu de données, URL (consulté le …) ». Les conditions ne placent pas formellement les données sous licence CC BY 4.0, réservée aux contenus rédactionnels publiés depuis le 1er juillet 2024. Page des conditions non consultable directement le 30 octobre 2026 (accès refusé aux robots) : lecture d'après le texte cité par les moteurs de recherche, à revérifier avant toute réutilisation commerciale.

Points d'attention pour comparer avec la Nouvelle-Calédonie :

- L'OCDE mesure le revenu disponible monétaire du ménage, sans autoconsommation ni loyer imputé, divisé par la racine carrée du nombre de personnes du ménage. L'Isee et l'Insee divisent par le nombre d'unités de consommation (échelle dite de l'OCDE modifiée : 1, 0,5 et 0,3). Pour la France, les deux mesures sont proches : indice de Gini 0,299 en 2023 pour l'OCDE, 0,298 en 2018 pour l'Insee ; rapport D9/D1 3,52 et 3,5.
- Le niveau de vie officiel calédonien comprend l'autoconsommation. Pour une comparaison au plus près de l'OCDE, l'Isee publie aussi les indicateurs sur le niveau de vie monétaire (synthèse n° 52, p. 4 et 6 : Gini 0,419, D9/D1 8,7, S80/S20 10,2, taux de pauvreté 20,7 % en 2019). Voir `../README.md`.
- Le seuil de pauvreté de 50 % du revenu médian national est celui retenu par l'Isee en Nouvelle-Calédonie.
- Les valeurs des Pays-Bas pour 2024 sont provisoires (`OBS_STATUS = P`).
- Les années disponibles varient : la Chine et l'Inde n'ont pas de valeur postérieure à 2011.

L'article `posts/inegalites-revenus-nouvelle-caledonie-monde/` retient, pour chaque pays, la dernière année depuis 2015 qui dispose des quatre indicateurs (43 pays), et le taux de pauvreté au seuil de 50 %.

```bash
curl -L -o data/revenus/ocde/idd-20261030-indicateurs.csv \
  "https://sdmx.oecd.org/public/rest/data/OECD.WISE.INE,DSD_WISE_IDD@DF_IDD,1.0/.A.INC_DISP_GINI+D9_1_INC_DISP+QR_INC_DISP+PR_INC_DISP..._T.METH2012.D_CUR.?startPeriod=2010&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
```
