# Indices de Gini dans le monde (Banque mondiale)

Téléchargés le 26 octobre 2026. Les fichiers sont conservés tels quels ; aucune correction n'y est apportée. Données sous licence Creative Commons Attribution 4.0 (CC BY 4.0).

| Fichier | Contenu | URL | SHA-256 |
|---|---|---|---|
| `pip-20260922-enquetes.csv` | Poverty and Inequality Platform (PIP), version `20260922_2021_01_02_PROD` (publiée le 22 septembre 2026, PPA 2021) : une ligne par enquête (pays, année, niveau national, urbain ou rural, revenu ou consommation), avec l'indice de Gini et les parts de chaque décile. Estimations d'enquête seulement (`fill_gaps=false`), 2 588 lignes, 172 pays. Le seuil de pauvreté demandé (3 $ par jour) n'intervient pas dans l'indice de Gini. | <https://api.worldbank.org/pip/v1/pip?country=all&year=all&povline=3&fill_gaps=false&ppp_version=2021&version=20260922_2021_01_02_PROD&format=csv> | `d1147750f873731ebc157595337758de6941c102d27a3c541b9209256c0e4339` |
| `wdi-pays.json` | Liste des pays de l'API World Development Indicators, avec codes ISO 2 et 3, région et groupe de revenu en vigueur au téléchargement (la Nouvelle-Calédonie est classée « High income »). | <https://api.worldbank.org/v2/country?format=json&per_page=400> | `c9acf3932785191a649cbc04c3056af4cf64a236e5c3b49d49be25ddb0440bce` |

La Nouvelle-Calédonie ne figure pas dans PIP : son indice vient de l'Isee (voir `../README.md`).

Points d'attention pour comparer :

- PIP mesure le revenu ou la consommation **par personne** (total du ménage divisé par le nombre de ses membres). L'Isee et l'Insee divisent par le nombre d'**unités de consommation** (niveau de vie). Pour la France en 2018, PIP donne 0,324 (EU-SILC) et l'Insee 0,298.
- Selon les pays, l'enquête mesure le revenu (Europe, Amériques, pays riches) ou la consommation (Afrique, Asie, Pacifique insulaire). La consommation est en général moins inégalement répartie que le revenu.
- Les années d'enquête varient d'un pays à l'autre.

L'article `posts/inegalites-revenus-nouvelle-caledonie-monde/` retient, pour chaque pays, la dernière enquête nationale réalisée depuis 2010 ; lorsqu'une même année a les deux mesures, il garde le revenu, plus proche de la mesure calédonienne.

```bash
curl -L -o data/revenus/banque-mondiale/pip-20260922-enquetes.csv \
  "https://api.worldbank.org/pip/v1/pip?country=all&year=all&povline=3&fill_gaps=false&ppp_version=2021&version=20260922_2021_01_02_PROD&format=csv"
curl -L -o data/revenus/banque-mondiale/wdi-pays.json \
  "https://api.worldbank.org/v2/country?format=json&per_page=400"
```
