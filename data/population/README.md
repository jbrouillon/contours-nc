# Données de population

Ce dossier rassemble des tableaux de l'ISEE (recensements de la population). Seuls les fichiers listés ci-dessous sont documentés ici.

## `rp-structure-communautes.xls`

- Producteur : INSEE-ISEE, recensements de la population de Nouvelle-Calédonie (1996 à 2019). Tableaux « Population de la Nouvelle-Calédonie selon la communauté d'appartenance », données mises à jour le 5 mai 2021.
- Page : <https://www.isee.nc/population/recensement/communautes> ; fichier <https://isee.nc/sites/default/files/2025-11/rp-structure-communautes.xls>.
- Téléchargé le 12 octobre 2026. SHA-256 : `90d2c96b0c57cfb2d9e53b0263b2f70d6a11ec8bd9bf66115ac9ef8c7908c906`.
- Utilisé par `posts/bien-dans-mes-claquettes-2025-inegalites/representativite.R` (feuilles `province`, `commune` et `âge`, recensement de 2019).
- Le fichier est ignoré par Git (`.gitignore`) : le retélécharger avant de reconstruire l'article.

```bash
curl -L -o data/population/rp-structure-communautes.xls https://isee.nc/sites/default/files/2025-11/rp-structure-communautes.xls
```

Points d'attention : la feuille `commune` ne détaille que les communautés européenne, kanak, wallisienne et futunienne, « plusieurs communautés » et « autre et non déclarée » (les petits effectifs sont masqués par « ss »). La feuille `âge` n'existe que pour l'ensemble de la Nouvelle-Calédonie, pas par province.

## Fichiers détaillés du recensement de 2019 (`RP2019NC_OD_*.xlsx`)

- Producteur : Insee-Isee, recensement de la population de Nouvelle-Calédonie 2019 (10 septembre-7 octobre 2019). Fichiers anonymisés « Individus » (un ou deux classeurs par province) et « Logements » (trois provinces), diffusés en application de l'arrêté du 10 septembre 2021 : la résidence n'y est localisée qu'à la province et les questions 6, 7 et 8 du bulletin individuel (communauté, tribu) n'y figurent pas.
- Page : <https://www.isee.nc/population/recensement> (rubrique « Données détaillées », page mise à jour le 8 septembre 2025). Notice : <https://data.gouv.nc/explore/dataset/recensement-de-la-population-2019-individus-nc/information/>.
- Téléchargés le 24 octobre 2026. Les fichiers Individus sont identiques (SHA-256) aux copies de travail conservées hors dépôt.

| Fichier | URL | SHA-256 |
|---|---|---|
| `RP2019NC_OD_ind_Sud1.xlsx` | <https://isee.nc/sites/default/files/2026-07/RP2019NC_OD_ind_Sud1.xlsx> | `bef0a7adf95700e731478ab01a48a22e70ddb94d370ebf68e8f5ed213dc7b8bc` |
| `RP2019NC_OD_ind_Sud2.xlsx` | <https://isee.nc/sites/default/files/2026-07/RP2019NC_OD_ind_Sud2.xlsx> | `5bf37a384468d9ee624c54550b830dba2a3cb18836478b68b84b58e493868347` |
| `RP2019NC_OD_ind_Nord.xlsx` | <https://isee.nc/sites/default/files/2026-07/RP2019NC_OD_ind_Nord.xlsx> | `c51db115b374b4220458130266de203f7f0eaad78c241840252cda821b818680` |
| `RP2019NC_OD_ind_Iles.xlsx` | <https://isee.nc/sites/default/files/2026-07/RP2019NC_OD_ind_Iles%20%281%29.xlsx> (renommé) | `ff931841114f3806eff7b46cef8a37e377419cd455225ba9bdd25c259b4a2737` |
| `RP2019NC_OD_logements.xlsx` | <https://isee.nc/sites/default/files/2026-07/RP2019NC_OD_logements.xlsx> | `646cdaab93b44f71d80c564b41319288e23a188a789484770673da1126b6504c` |
| `rp2019-dictionnaire-variables-individus.pdf` | <https://isee.nc/sites/default/files/2025-10/rp2019-dictionnaire-variables-individus.pdf> | `b92f26ed25e4207d5c072d4bcf0b34132510b4a354c0f6d33e5903892d99b391` |
| `rp2019-dictionnaire-variables-logements.pdf` | <https://isee.nc/sites/default/files/2025-10/rp2019-dictionnaire-variables-logements.pdf> | `f5b6154e2aa805656432dd0c25d19067b0cfa65bd89329ec9f2089d76ffc7a96` |

Tous ces fichiers sont ignorés par Git. Les retélécharger, puis les convertir en CSV depuis la racine du dépôt (`readxl` plante sous R 4.6 sur ces classeurs) :

```bash
python scripts/convertir_rp2019_open_data.py
```

Le script écrit `rp2019_od/individus.csv` (271 407 lignes, 43 colonnes) et `rp2019_od/logements.csv` (109 025 lignes, 47 colonnes), également ignorés. Utilisés par `posts/nes-ici-ou-ailleurs-inegalites-nouvelle-caledonie/analysis.R`.

Points d'attention : l'année d'installation (`ANNINS`) n'est renseignée que pour les personnes nées hors de Nouvelle-Calédonie, et manque pour 22 % d'entre elles ; la catégorie socioprofessionnelle (`CS8`, `CS24`, `CS42`) n'est codée que pour les salariés ; le type de contrat détaillé (`TYPEMPL`) manque souvent pour les CDD, que la variable `EMPL` distingue en revanche pour tous les salariés. Le fichier Logements contient aussi les logements vacants, occasionnels et secondaires (`CATL`).

## `rp-population-origine_0.xls`

Tableau Isee « Population par origine » (recensements 1996 à 2019, données mises à jour le 11 mai 2021). La feuille `lieu naissance` donne la part de chaque lieu de naissance de 1983 à 2019 ; la valeur 2019 pour la Nouvelle-Calédonie (77,86 %) est identique à celle calculée sur le fichier détaillé. Son second tableau donne les effectifs de chaque commune par lieu de naissance ; en 2019, ils sont regroupés en cinq colonnes (Nouvelle-Calédonie, Wallis-et-Futuna ou Polynésie française, métropole-DOM-autre TOM, étranger, total) et leurs totaux recoupent le fichier détaillé. Utilisé par `posts/concentration-population-noumea-pacifique/analysis.R` et `posts/nes-ici-ou-ailleurs-inegalites-nouvelle-caledonie/analysis.R` (ce dernier ne lit que la série 1983-2019 du premier tableau).
