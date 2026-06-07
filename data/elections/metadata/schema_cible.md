# Schema cible minimal

Les tables harmonisees doivent permettre de comparer les scrutins et de produire des rasters lisses a partir des bureaux de vote geolocalises.

## Table bureaux

- `election`: identifiant du scrutin, par exemple `referendum_2020`.
- `tour`: numero de tour si pertinent, vide sinon.
- `code_departement`: `988`.
- `code_commune`: code commune officiel lorsqu'il est disponible.
- `commune`: libelle source.
- `commune_norm`: libelle normalise pour appariement.
- `code_bv`: code bureau sur 4 caracteres.
- `inscrits`, `votants`, `abstentions`, `exprimes`, `blancs`, `nuls`: compteurs harmonises.
- `bureau_nom`, `bureau_nom_norm`: nom du bureau et version normalisee.
- `longitude`, `latitude`: coordonnees WGS84.
- `geo_source`: origine de la geolocalisation.
- `iris_id`, `iris_codgeo`, `iris_libgeo`: rattachement IRIS si disponible.

## Table candidats ou choix

Elle reprend les colonnes de la table bureaux et ajoute:

- `candidat` ou `choix`: nom de la candidature, liste ou option de vote.
- `nuance`: nuance officielle lorsqu'elle existe.
- `voix`: nombre de voix.
- `pct_exprimes`: part des exprimes.
- `pct_inscrits`: part des inscrits.

## Regle de qualite

Une ligne bureau n'est validee pour la cartographie que si `longitude` et `latitude` sont renseignes. Les cas restants doivent etre listes dans `quality/` avec une justification ou une source a rechercher.
