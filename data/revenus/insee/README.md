# Niveaux de vie en France métropolitaine (Insee, 2018)

Fichier de données de la fiche « Niveau de vie des personnes » de l'ouvrage *Revenus et patrimoine des ménages*, édition 2021 (Insee Références, paru le 27 mai 2021), téléchargé le 31 octobre 2026. Le fichier est conservé tel quel ; aucune correction n'y est apportée.

| Fichier | Contenu | URL | SHA-256 |
|---|---|---|---|
| `rpm2021-f4-niveau-de-vie.xlsx` | Quatre feuilles. Figure 1 : limite supérieure de chaque décile du niveau de vie annuel (D1 à D9) et niveau de vie moyen de chaque dixième de la population, en euros par an, 2018. Figure 2 : indicateurs de 1996 à 2018, dont D1, médiane et D9 (euros 2018), parts cumulées S20, S40, S50, S80 et S90 de la masse des niveaux de vie, rapports D9/D1 et (100 - S80)/S20, indice de Gini. Figure 3 : séries annuelles des trois indicateurs d'inégalité. Figure 4 : centiles du niveau de vie 2018. | <https://www.insee.fr/fr/statistiques/fichier/5371207/RPM2021-F4.xlsx> (page de la fiche : <https://www.insee.fr/fr/statistiques/5371207?sommaire=5371304>) | `3137e3ebbfb95ca1694bf5a7ca4676fb044fe079ff1e4341197ac4b3f632c41f` |

Champ : France métropolitaine, personnes vivant dans un ménage dont le revenu déclaré est positif ou nul et dont la personne de référence n'est pas étudiante. Source : Insee-DGFiP-Cnaf-Cnav-CCMSA, enquête Revenus fiscaux et sociaux (ERFS) 2018. C'est la même source que la colonne « France » du tableau de comparaison de la synthèse n° 52 de l'Isee (voir `../README.md`).

Conditions de réutilisation : Licence Ouverte / Open Licence version 2.0 (Etalab), avec la mention « Source : Insee » et la date de dernière mise à jour lorsqu'elle est connue, sans altérer le sens des informations (page « Mentions légales et crédits », <https://www.insee.fr/fr/information/2008466>, consultée le 31 octobre 2026).

Points d'attention pour comparer avec la Nouvelle-Calédonie :

- Le niveau de vie de l'Insee est, comme celui de l'Isee, le revenu disponible du ménage divisé par le nombre d'unités de consommation (1, 0,5 et 0,3), mais sans autoconsommation. Il est publié par an, l'Isee le publie par mois : l'article divise les montants de l'Insee par 12.
- Les parts du total reçues par chaque dixième ne sont pas publiées telles quelles : chaque dixième compte un dixième de la population, sa part est donc son niveau de vie moyen (figure 1) rapporté à dix fois le niveau de vie moyen de l'ensemble (24 650 euros). Les parts cumulées obtenues redonnent, au dixième de point près, les S20, S40, S50, S80 et S90 de la figure 2.
- L'Insee publie un rapport (100 - S80)/S20 de 4,45 et un rapport D9/D1 de 3,49 ; le tableau de l'Isee donne 4,4 et 3,5 (38,7 / 8,7 = 4,448). L'article cite les valeurs de l'Isee, comme pour les autres territoires comparés.

Le traitement est fait par `posts/inegalites-revenus-nouvelle-caledonie-monde/analysis.R`, qui écrit `deciles-france.csv` et `seuils-france.csv` dans le dossier `data/` de l'article.

```bash
curl -L -o data/revenus/insee/rpm2021-f4-niveau-de-vie.xlsx \
  "https://www.insee.fr/fr/statistiques/fichier/5371207/RPM2021-F4.xlsx"
```
