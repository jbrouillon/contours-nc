# Natural Earth — pays du monde au 1:110 m

Téléchargé le 29 octobre 2026. Le fichier est conservé tel quel ; aucune correction n'y est apportée. Natural Earth est dans le domaine public (<https://www.naturalearthdata.com/about/terms-of-use/>).

| Fichier | Contenu | URL | SHA-256 |
|---|---|---|---|
| `ne_110m_admin_0_countries.geojson` | Admin 0 – Countries, échelle 1:110 m, version 5.1.2 : 177 pays ou territoires, avec codes ISO (`ISO_A3`, `ADM0_A3`) et noms dans plusieurs langues (`NAME_FR`). | <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson> | `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f` |

Points d'attention :

- `ISO_A3` vaut `-99` pour la France et la Norvège : utiliser `ADM0_A3`. Le Kosovo a le code `KOS`, la Banque mondiale emploie `XKX`.
- Le contour de la France comprend la Guyane et la Corse.
- Les petits États insulaires (Kiribati, Tonga, Samoa, Tuvalu, Nauru, Îles Marshall, Micronésie, Maldives, Malte…) sont absents à cette échelle.

Utilisé par `posts/inegalites-revenus-nouvelle-caledonie-monde/prepare_globe.R`, qui produit le fond de carte du globe de l'article.

```bash
curl -L -o data/02_geospatial/natural-earth/ne_110m_admin_0_countries.geojson \
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson"
```
