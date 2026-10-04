"""Produit data/elections/metadata/geoloc_bureaux_provinciales_2019_2026.csv.

Corrections de géolocalisation des bureaux de vote des provinciales.

- 2026 : les bureaux étaient placés par leur numéro, à partir d'un référentiel
  construit sur la numérotation de 2019. Plusieurs communes ont renuméroté ou
  déplacé leurs bureaux (Païta, Dumbéa, Mont-Dore, Nouméa…).
- 2019 et 2026 : le référentiel lui-même plaçait certains lieux loin de leur
  emplacement réel (écoles de Nouméa, Plum, Saint-Michel, tribus de Lifou,
  mairie de Koné). Ils ont été repérés en comparant chaque bureau au lieu de
  même nom dans les sources officielles (écart supérieur à 1 km).

La table fixe, pour chaque bureau corrigé, le lieu nommé dans les résultats
officiels et ses coordonnées, avec leur source.

Sources, par ordre de préférence :
- etablissements_publics_nc : établissements publics de Nouvelle-Calédonie
  (copie de septembre 2025, data_raw/referentiels_geographiques/etablissements_publics) ;
- batiments_publics_nc : bâtiments publics, DITTT, service ArcGIS
  « batiments_publics_nc », licence CC BY-NC-ND 4.0, téléchargé le 2026-10-04
  (data_raw/referentiels_geographiques/batiments_publics) ; centre des emprises
  du site ;
- referentiel : bureaux_reference_geolocalises.csv, quand le même lieu y figure
  sous un autre numéro ;
- openstreetmap : © contributeurs OpenStreetMap, ODbL (consulté le 2026-10-04).

À lancer depuis la racine du dépôt : python scripts/geoloc_bureaux_provinciales.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
BRUT = RACINE / "data/elections/data_raw/referentiels_geographiques"
SORTIE = RACINE / "data/elections/metadata/geoloc_bureaux_provinciales_2019_2026.csv"

etablissements = {
    f["properties"]["ident"]: f
    for f in json.load(open(BRUT / "etablissements_publics/etablissements_publics_nc.geojson", encoding="utf-8"))["features"]
}
batiments = {
    f["properties"]["objectid"]: f
    for f in json.load(open(BRUT / "batiments_publics/batiments_publics_nc_2026-10-04.geojson", encoding="utf-8"))["features"]
}


def points(geometrie):
    sortie = []

    def parcourir(c):
        if isinstance(c[0], (int, float)):
            sortie.append(c)
        else:
            for x in c:
                parcourir(x)

    parcourir(geometrie["coordinates"])
    return sortie


def etab(ident):
    p = etablissements[ident]
    lon, lat = p["geometry"]["coordinates"][:2]
    return lon, lat, "etablissements_publics_nc", f"ident {ident} {p['properties']['lib_norme']}", "batiment"


def bat(*objectids):
    pts = [pt for oid in objectids for pt in points(batiments[oid]["geometry"])]
    lon = sum(p[0] for p in pts) / len(pts)
    lat = sum(p[1] for p in pts) / len(pts)
    libelle = batiments[objectids[0]]["properties"]["libelle"]
    return lon, lat, "batiments_publics_nc", f"objectid {', '.join(map(str, objectids))} {libelle}", "batiment"


def bat_libelle(libelle):
    """Toutes les emprises portant exactement ce libellé."""
    ids = sorted(oid for oid, f in batiments.items() if (f["properties"].get("libelle") or "") == libelle)
    if not ids:
        raise KeyError(libelle)
    return bat(*ids)


def etab_nom(nom):
    idents = [ident for ident, f in etablissements.items() if f["properties"]["lib_norme"] == nom]
    if len(idents) != 1:
        raise KeyError(nom)
    return etab(idents[0])


def ref(lon, lat, detail):
    return lon, lat, "referentiel", detail, "batiment"


def osm(lon, lat, detail, precision="batiment"):
    return lon, lat, "openstreetmap", detail, precision


# (province, commune, code, nom, localisation, note)
CORRECTIONS_2026 = [
    ("Province Sud", "Boulouparis", "0002", "Maison des associations du village de Boulouparis", etab("020004"), ""),
    ("Province Sud", "Boulouparis", "0003", "Centre culturel de Boulouparis", etab("020046"), "Centre socio-culturel du village, seul équipement culturel recensé."),
    ("Province Sud", "Boulouparis", "0004", "Maison des associations du village de Tomo",
     osm(166.15105, -21.95844, "place=village Tomo", "village"), "Bâtiment non recensé : centre du village de Tomo."),
    ("Province Sud", "Bourail", "0005", "Colisée 2", etab("030114"), ""),
    *[("Province Sud", "Dumbéa", code, f"Salle omnisports d'Auteuil Ernest Chambonnier {n}", etab("050028"), "Renumérotation 2026.")
      for n, code in enumerate(["0004", "0005", "0006", "0007", "0008", "0009"], start=1)],
    ("Province Sud", "Dumbéa", "0010", "Maison de la Jeunesse 1", etab("050090"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0011", "Maison de la Jeunesse 2", etab("050090"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0013", "Ecole primaire Gustave Clain 2", etab("050003"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0015", "Ecole maternelle l'Oasis 2", etab("050002"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0017", "Groupe scolaire Michelle Delacharlerie-Rolly 2", etab("050129"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0019", "Groupe scolaire Renée Fong 2", etab("050021"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0022", "Mairie du Nord 3", etab("050105"), "Renumérotation 2026."),
    ("Province Sud", "Dumbéa", "0024", "Ecole primaire Paul Duboisé 2", etab("050016"), "Renumérotation 2026."),
    ("Province Sud", "Mont-Dore", "0007", "Groupe scolaire de Plum",
     bat(2971, 2976, 2984, 2986, 2990, 3005, 3017, 3018, 3019, 3034, 4546),
     "Le référentiel plaçait l'école de Plum aux coordonnées de celle de Yahoué."),
    ("Province Sud", "Mont-Dore", "0020", "Ecole La Rizière 3", ref(166.57398, -22.23322, "École La Rizière (référentiel, n° 0005)"), "Renumérotation 2026."),
    ("Province Sud", "Mont-Dore", "0021", "Ecole de La Briqueterie 1", ref(166.56645, -22.26251, "École de la Briqueterie (référentiel, n° 0022)"), "Renumérotation 2026."),
    ("Province Sud", "Mont-Dore", "0023", "Mairie 2", ref(166.52326, -22.22975, "Mairie 2 (référentiel, n° 0024)"), "Renumérotation 2026."),
    ("Province Sud", "Mont-Dore", "0024", "Groupe scolaire de Yahoué", bat(4038, 4375, 4379), "Renumérotation 2026."),
    ("Province Sud", "Nouméa", "0018", "Ecole Suzanne Russier 1", etab("180304"), ""),
    ("Province Sud", "Nouméa", "0019", "Ecole Suzanne Russier 2", etab("180304"), ""),
    ("Province Sud", "Nouméa", "0035", "Ecole Les Oeillets", etab("180297"),
     "Le référentiel plaçait l'école à 7 km, hors de Rivière-Salée ; seul établissement de ce nom recensé."),
    ("Province Sud", "Nouméa", "0037", "Ecole Les Hibiscus 1", etab("180295"), ""),
    ("Province Sud", "Nouméa", "0038", "Ecole Les Hibiscus 2", etab("180295"), ""),
    ("Province Sud", "Nouméa", "0044", "Ecole Maurice Fonrobert", etab("180625"), ""),
    ("Province Sud", "Païta", "0001", "Arène du sud 1", etab("210024"), "Nouveau lieu de vote en 2026."),
    ("Province Sud", "Païta", "0002", "Arène du sud 2", etab("210024"), "Nouveau lieu de vote en 2026."),
    ("Province Sud", "Païta", "0003", "Ecole Robert ABEL 1", etab("210011"), "Renumérotation 2026."),
    *[("Province Sud", "Païta", code, nom, bat(4773, 4774, 4775, 4776, 4777, 4778, 4779), "Renumérotation 2026.")
      for code, nom in [("0005", "ecole Patrice JEAN 1"), ("0007", "Ecole Patrice JEAN 2"),
                        ("0008", "Ecole Patrice JEAN 3"), ("0018", "Ecole Patrice JEAN 4")]],
    *[("Province Sud", "Païta", code, f"Dock socio-culturel {n}", ref(166.36637, -22.12950, "Dock socio-culturel (référentiel, n° 0001 à 0005)"), "Renumérotation 2026.")
      for n, code in [(2, "0009"), (3, "0010"), (4, "0011"), (5, "0012")]],
    *[("Province Sud", "Païta", code, f"Ecole Henri Martinet {n}", etab("210002"), "Renumérotation 2026.")
      for n, code in [(1, "0013"), (2, "0014"), (3, "0015"), (4, "0019")]],
    ("Province Sud", "Yaté", "0002", "Mairie (Waho central)", ref(166.94326, -22.16058, "Mairie (référentiel, n° 0001)"), "Bureau déplacé de Touaourou à la mairie de Waho."),
    ("Province Nord", "Houaïlou", "0002", "Nediouen (maison commune)", bat(1380), ""),
    ("Province Nord", "Koumac", "0002", "Médiathèque Louis BASTIEN", etab("120030"), ""),
    ("Province Nord", "Pouembout", "0002", "Cantine école primaire",
     osm(164.90077, -21.12369, "amenity=school École publique Léonie AVRIL"),
     "Rattachement probable : école primaire publique du village."),
    ("Province Nord", "Touho", "0002", "Téganpaîk", bat(1439), "Maison commune de Téganpaïk."),
    ("Province Nord", "Voh", "0006", "Ecole publique de BOYEN", etab("310007"),
     "Le référentiel plaçait ce bureau au foyer de Gatope."),
    ("Province Nord", "Voh", "0007", "Local socio-éducatif de TEMALA", etab("310032"), "Nouveau bureau en 2026."),
    ("Province Nord", "Koné", "0001", "Salle Au Pitiri", etab("110062"), ""),
    ("Province Nord", "Koné", "0011", "Ecole Téari", etab("110117"), ""),
    ("Province Sud", "Mont-Dore", "0012", "Groupe scolaire de Saint-Michel 1", etab("170010"), "Erreur du référentiel (3 km)."),
    ("Province Sud", "Mont-Dore", "0019", "Groupe scolaire Saint-Michel 2", etab("170010"), "Erreur du référentiel (3 km)."),
    ("Province Sud", "Nouméa", "0034", "Ecole Les Roses", etab("180278"), "Erreur du référentiel (6,5 km)."),
    ("Province Sud", "Nouméa", "0048", "Ecole Marguerite Arsapin", bat_libelle("Ecole élémentaire Marguerite ARSAPIN"), "Erreur du référentiel (5,6 km)."),
    ("Province des Iles", "Lifou", "0008", "Hnathalo", bat_libelle("Maison commune de Hnathalo"), "Erreur du référentiel (9 km) : maison commune de la tribu."),
    ("Province des Iles", "Lifou", "0015", "Nang", bat_libelle("Maison commune de Nang"), "Erreur du référentiel (3 km) : maison commune de la tribu."),
]

# Erreurs du référentiel, déjà présentes en 2019.
CORRECTIONS_2019 = [
    ("Province Nord", "Koné", "0001", "Mairie", etab_nom("Mairie de Koné"), "Erreur du référentiel (1,5 km)."),
    ("Province Nord", "Koné", "0011", "Mairie 2", etab_nom("Mairie de Koné"), "Erreur du référentiel (3,7 km)."),
    ("Province Sud", "Mont-Dore", "0012", "Groupe scolaire de Saint-Michel 1", etab("170010"), "Erreur du référentiel (3 km)."),
    ("Province Sud", "Mont-Dore", "0019", "Groupe scolaire Saint-Michel 2", etab("170010"), "Erreur du référentiel (3 km)."),
    ("Province Sud", "Mont-Dore", "0020", "Groupe scolaire de Plum", bat_libelle("Groupe scolaire de Plum"),
     "Le référentiel plaçait l'école de Plum aux coordonnées de celle de Yahoué."),
    ("Province Sud", "Nouméa", "0034", "Ecole Les Roses", etab("180278"), "Erreur du référentiel (6,5 km)."),
    ("Province Sud", "Nouméa", "0035", "Ecole Les Oeillets", etab("180297"), "Erreur du référentiel (7,4 km)."),
    ("Province Sud", "Nouméa", "0037", "Ecole Mauricette Devambez 1", bat_libelle("Ecole élémentaire Mauricette DEVAMBEZ"), "Erreur du référentiel (3,9 km)."),
    ("Province Sud", "Nouméa", "0038", "Ecole Mauricette Devambez 2", bat_libelle("Ecole élémentaire Mauricette DEVAMBEZ"), "Erreur du référentiel (3,9 km)."),
    ("Province Sud", "Nouméa", "0044", "Ecole Louise Vergès", bat_libelle("Ecole élémentaire Louise VERGES"), "Erreur du référentiel (6,6 km)."),
    ("Province Sud", "Nouméa", "0048", "Ecole Marguerite Arsapin", bat_libelle("Ecole élémentaire Marguerite ARSAPIN"), "Erreur du référentiel (5,6 km)."),
    ("Province des Iles", "Lifou", "0008", "Hnathalo", bat_libelle("Maison commune de Hnathalo"), "Erreur du référentiel (9 km) : maison commune de la tribu."),
    ("Province des Iles", "Lifou", "0015", "Nang", bat_libelle("Maison commune de Nang"), "Erreur du référentiel (3 km) : maison commune de la tribu."),
]

# Lieux 2026 non retrouvés dans les sources : position antérieure conservée.
NON_RESOLUS = [
    ("Province Nord", "Kouaoua", code, f"Centre administratif de Niminra {n}", "Lieu absent des sources consultées : position antérieure conservée.")
    for n, code in [(1, "0001"), (2, "0002"), (3, "0003"), (4, "0004")]
] + [
    ("Province Nord", "Ouégoa", "0001", "Salle polyvalente de Ouégoné", "Lieu absent des sources consultées : position antérieure (mairie) conservée."),
    ("Province Nord", "Poya Nord", "0001", "Salle ancienne mairie", "Emplacement de l'ancienne mairie non établi : position antérieure conservée."),
]

with open(SORTIE, "w", encoding="utf-8", newline="") as fichier:
    ecrivain = csv.writer(fichier)
    ecrivain.writerow(["annee", "province", "commune", "code_bv", "bureau_nom", "longitude", "latitude",
                       "source", "source_detail", "precision", "statut", "note"])
    for annee, corrections in ((2019, CORRECTIONS_2019), (2026, CORRECTIONS_2026)):
        for province, commune, code, nom, (lon, lat, source, detail, precision), note in corrections:
            ecrivain.writerow([annee, province, commune, code, nom, f"{lon:.6f}", f"{lat:.6f}", source, detail, precision, "corrige", note])
    for province, commune, code, nom, note in NON_RESOLUS:
        ecrivain.writerow([2026, province, commune, code, nom, "", "", "", "", "", "non_resolu", note])

print(f"2019 : {len(CORRECTIONS_2019)} bureaux corrigés ; 2026 : {len(CORRECTIONS_2026)} corrigés, "
      f"{len(NON_RESOLUS)} non résolus -> {SORTIE.relative_to(RACINE)}")
