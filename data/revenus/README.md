# Revenus, pauvreté et inégalités (Isee)

Tableaux de l'Isee publiés sur la page « Revenus et inégalités » (<https://isee.nc/revenus-et-inegalites>, page mise à jour le 8 septembre 2025). Téléchargés le 24 octobre 2026. Les fichiers sont conservés tels quels ; aucune correction n'y est apportée.

| Fichier | Contenu | URL | SHA-256 |
|---|---|---|---|
| `bdf2019-pauvrete.xls` | Enquête Budget des familles (BDF) 2019-2020 et BCM 2008 : seuils de pauvreté selon le type de ménage, taux de pauvreté selon les caractéristiques de la personne de référence (activité, diplôme, communauté, âge, taille et type de ménage). Données mises à jour le 26 août 2021. | <https://isee.nc/sites/default/files/2025-11/bdf2019-pauvrete.xls> | `593c33c704cfd889c1f11d860d5887915bed95cd7067c58a1683c4f6ccacc496` |
| `bdf2019-inegalites.xls` | BDF 2019-2020 et BCM 2008 : quintiles et médiane du niveau de vie mensuel selon les caractéristiques du ménage (dont Kanak et non Kanak en 2019), déciles, courbe de Lorenz. Données mises à jour le 26 août 2021. | <https://isee.nc/sites/default/files/2025-11/bdf2019-inegalites.xls> | `aeffa0fa100a7491d292878eb631bb251e1d7eff9277fe50b2ff780573c19f23` |
| `bdf2019-pauvrete-inegalites.xls` | BDF 2019-2020 et BCM 2008 : indicateurs synthétiques (population pauvre, taux et intensité de la pauvreté, D9/D1, S80/S20, indice de Gini). | <https://isee.nc/sites/default/files/2025-11/bdf2019-pauvrete-inegalites.xls> | `91761aa332d454cb9ee94404ac8c23d0a06a9193f6f2ace434f724e8a09e84a2` |
| `pauvrete.xlsx` | Dispositif de suivi de la pauvreté et des inégalités 2020 (sources DSF, Cafat, provinces, CLR, FSH) : niveaux de vie par commune de 2 000 habitants ou plus, taux de pauvreté par province et par commune (sauf Bélep), classification des communes, composition du niveau de vie. Données mises à jour le 11 avril 2023. | <https://isee.nc/sites/default/files/2025-11/pauvrete.xlsx> | `4ffe0f52ad28cc9137561203ffb25d141b0aad113a6eaad318261d3581fe88d6` |

Les trois fichiers de l'enquête BDF sont utilisés par `posts/nes-ici-ou-ailleurs-inegalites-nouvelle-caledonie/analysis.R`, qui lit les feuilles « Taux de pauvreté », « Seuil de pauvreté - type ménage », « quintiles niveau de vie 2019 » et « Indicateurs synthetiques », et vérifie leurs en-têtes avant usage. `pauvrete.xlsx` (dispositif 2020) n'est plus utilisé par cet article, qui a renoncé à rapprocher taux de pauvreté communaux et part des personnes nées ailleurs (comparaison entre territoires, pas entre personnes) ; il est conservé tel quel.

Points d'attention :

- Le seuil de pauvreté est fixé en Nouvelle-Calédonie à 50 % du niveau de vie médian (revenu disponible par unité de consommation). Les taux de l'enquête BDF de 2019 et ceux du dispositif de 2020 ne reposent pas sur la même source (enquête par sondage d'un côté, sources administratives de l'autre) : ne pas les comparer comme une évolution.
- Dans la BDF, les caractéristiques sont celles de la personne de référence du ménage ; un ménage est « kanak » quand sa personne de référence s'est déclarée uniquement kanak. Le dispositif de 2020 ne distingue aucune caractéristique des ménages.
- Aucun de ces tableaux ne croise le lieu de naissance. La part des natifs de Nouvelle-Calédonie parmi les personnes pauvres (89 %) et la part des Kanak (71 %) figurent seulement dans le texte de la synthèse n° 52 de l'Isee (B. Buffière, « En 2019, le taux de pauvreté reste stable en Nouvelle-Calédonie », août 2021, p. 3) : <https://isee.nc/sites/default/files/2025-11/bdf2019-synthese52.pdf>.
- Les revenus non déclarés, les dons et les solidarités familiales ou coutumières ne sont pas mesurés ; l'autoconsommation est valorisée (imputée par modèle dans le dispositif de 2020). Voir la synthèse n° 64 (avril 2023) : <https://isee.nc/sites/default/files/2025-11/pauvrete2020-synthese.pdf>.

```bash
for f in bdf2019-pauvrete.xls bdf2019-inegalites.xls bdf2019-pauvrete-inegalites.xls pauvrete.xlsx; do
  curl -L -o "data/revenus/$f" "https://isee.nc/sites/default/files/2025-11/$f"
done
```
