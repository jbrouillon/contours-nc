# Candidats des listes provinciales 2019 et 2026

Sources principales :

- 2019 : pages HTML `elections-nc.fr` par province, fournies dans `sources_provinciales_candidats/elections_nc_2019/`.
- 2019 : arretes officiels du Haut-Commissariat `2019/144`, `2019/145` et `2019/147` conserves dans `sources_provinciales_candidats/`.
- 2026 : arrete officiel `HC/DCCAJE/BEL n. 2026-46` et annexe PDF conserves dans `sources_provinciales_candidats/`.

Fichiers produits :

- `provinciales_candidats_2019_2026.csv` : table longue des candidats avec annee, province, liste, rang, nom, sexe, source et cles de comparaison.
- `provinciales_candidats_resume_listes.csv` : controle des effectifs par liste.
- `provinciales_candidats_comparaison_exacte_2019_2026.csv` : comparaison exacte sur une cle normalisee et triee par tokens.
- `provinciales_candidats_rapprochements_potentiels_2019_2026.csv` : rapprochements a verifier manuellement quand les noms different legerement entre 2019 et 2026.
- `provinciales_candidats_rapprochements_fuzzy_2019_2026.csv` : rapprochements fuzzy plus larges, a utiliser avec prudence.
- `provinciales_referentiel_listes_politiques_2019_2026.csv` : referentiel par liste avec qualification politique, sieges 2019 et groupes de liste quand ils sont connus.
- `provinciales_candidats_2019_2026_qualifies.csv` : table longue enrichie avec qualification politique, statut d'elu 2019, groupes 2019, groupes actuels 2026 par rapprochement de nom, et corrections OCR ponctuelles.
- `provinciales_candidats_comparaison_exacte_2019_2026_qualifiee.csv` : comparaison exacte regeneree apres corrections OCR et enrichie politiquement.
- `provinciales_suivi_mandature_groupes_2019_2026.csv` : suivi par personne et par institution des groupes initiaux 2019 et des groupes actuels 2026.
- `provinciales_candidats_qualifies_controle_listes.csv` : controle des effectifs et des elus 2019 par liste qualifiee.

Controles :

- 2019 : 25 listes, 934 candidats.
- 2026 : 24 listes, 928 candidats.
- Toutes les listes ont le nombre attendu de candidats selon leur province.

Note qualification politique :

- Les sieges 2019 sont saisis depuis les resultats definitifs officiels du Haut-Commissariat.
- Les groupes initiaux du Congres 2019 sont cales sur les groupes constitues a l'installation de la mandature : L'Avenir En Confiance 18, Caledonie Ensemble 6, UC-FLNKS et Nationalistes 13, UNI 12, Non-inscrits 5.
- Les groupes 2026 correspondent a la situation actuelle de la mandature 2019-2026 au moment du constat, et non aux groupes post-scrutin.
- Le fichier `provinciales_suivi_mandature_groupes_2019_2026.csv` sert a suivre les bascules en cours de mandature : groupe initial 2019, groupe actuel 2026 et statut de changement.
- Les listes nouvelles ou difficiles a classer sont marquees `qualification_a_verifier = TRUE` dans le referentiel.

Note :

La page 2019 `elections-nc.fr` des Iles Loyauté indique encore `Lucien Manabo WADRIA` en rang 23 de `PALIKA ILES`; l'arrete modificatif officiel `2019/145` remplace cette ligne par `ADJOUHGNIOPE David Germond`, correction appliquee dans la table finale.
