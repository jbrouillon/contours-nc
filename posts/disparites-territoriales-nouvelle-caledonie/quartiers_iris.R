# Correspondance entre les quartiers des tableaux Isee et les IRIS 2019 ---
#
# Les 61 quartiers publies dans le classeur infracommunal ne sont pas tous
# des unions d'IRIS. Trois paires de quartiers se recoupent avec le decoupage
# du GeoJSON et doivent donc etre reunies pour une cartographie sans fausse
# precision. On obtient 58 unites cartographiques exhaustives et disjointes.
#
# Objets produits :
# - quartiers_map_spec : 58 unites et leurs quartiers Isee sources ;
# - iris_quartier_crosswalk : les 88 IRIS du Grand Noumea, chacun affecte une
#   seule fois ;
# - quartiers_map_2014 / quartiers_map_2019 : indicateurs recalcules apres
#   aggregation des effectifs ;
# - quartiers_map_sf : geometries dissoutes, pretes a etre jointes aux taux.

suppressPackageStartupMessages({
  library(dplyr)
  library(sf)
  library(tibble)
  library(tidyr)
})

`%||%` <- function(left, right) {
  if (is.null(left) || length(left) == 0 || is.na(left)) right else left
}

locate_quartiers_iris_dir <- function() {
  file_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
  if (length(file_arg)) {
    return(dirname(normalizePath(
      sub("^--file=", "", file_arg[[1]]),
      winslash = "/",
      mustWork = TRUE
    )))
  }

  source_file <- tryCatch(sys.frame(1)$ofile, error = function(e) NULL)
  if (!is.null(source_file)) {
    return(dirname(normalizePath(
      source_file,
      winslash = "/",
      mustWork = TRUE
    )))
  }

  candidates <- c(
    getwd(),
    file.path(getwd(), "posts", "habiter-ville-coloniale-noumea")
  )
  found <- candidates[file.exists(file.path(candidates, "parse_quartiers.R"))]
  if (!length(found)) stop("Impossible de localiser parse_quartiers.R.")
  normalizePath(found[[1]], winslash = "/", mustWork = TRUE)
}

if (!exists("quartiers_2019", inherits = TRUE)) {
  source(file.path(locate_quartiers_iris_dir(), "parse_quartiers.R"))
}

map_unit <- function(map_id, label, ids, iris) {
  tibble(
    map_id = map_id,
    map_label = label,
    id_quartiers = list(ids),
    iris_codes = list(as.character(iris))
  )
}

quartiers_map_spec <- bind_rows(
  map_unit("GN01", "Val Plaisance", "GN01", c(1801, 1802)),
  map_unit("GN02", "Anse-Vata", "GN02", c(1803, 1804)),
  map_unit("GN03", "Baie des Citrons", "GN03", 1805),
  map_unit("GN04", "N'Géa", "GN04", 1807),
  map_unit("GN05", "Motor Pool, Receiving", "GN05", 1806),
  map_unit("GN06", "Orphelinat", "GN06", 1809),
  map_unit("GN07", "Trianon", "GN07", 1808),
  map_unit("GN08", "Faubourg Blanchot", "GN08", 1811),
  map_unit("GN09", "Artillerie", "GN09", 1810),
  map_unit(
    "GN10_GN17",
    "Quartier latin - Vallée du Génie - Centre-ville",
    c("GN10", "GN17"),
    c(1812, 1822)
  ),
  map_unit(
    "GN11",
    "Vallée des Colons",
    "GN11",
    c(1813, 1814, 1820, 1821)
  ),
  map_unit("GN12", "Magenta", "GN12", c(1815, 1816, 1817)),
  map_unit("GN13", "Ouémo", "GN13", 1818),
  map_unit("GN14", "Aérodrome", "GN14", c(1827, 1830)),
  map_unit(
    "GN15_GN20",
    "Portes de Fer - Montravel",
    c("GN15", "GN20"),
    c(1826, 1828)
  ),
  map_unit("GN16", "Haut-Magenta", "GN16", 1819),
  map_unit(
    "GN18",
    "Vallée du Tir - Doniambo - Montagne Coupée",
    "GN18",
    c(1824, 1825)
  ),
  map_unit("GN19", "Nouville", "GN19", 1823),
  map_unit("GN21", "PK 4", "GN21", 1829),
  map_unit("GN22", "PK 6", "GN22", c(1831, 1834)),
  map_unit("GN23", "Tina", "GN23", 1835),
  map_unit("GN24", "Normandie", "GN24", c(1839, 1840)),
  map_unit("GN25", "PK 7", "GN25", c(1836, 1837)),
  map_unit("GN26", "Rivière-Salée", "GN26", c(1833, 1838, 1841)),
  map_unit("GN27", "Zone industrielle Ducos", "GN27", 1832),
  map_unit("GN28", "Ducos", "GN28", 1842),
  map_unit("GN29", "Logicoop", "GN29", 1843),
  map_unit("GN30", "Kaméré", "GN30", 1844),
  map_unit("GN31", "Numbo-Koumourou, Tindu", "GN31", 1845),
  map_unit(
    "GN32_GN35",
    "Cœur de Ville - Dumbéa-sur-mer",
    c("GN32", "GN35"),
    c(501, 502, 510)
  ),
  map_unit("GN33", "Koutio", "GN33", 503:507),
  map_unit("GN34", "Auteuil", "GN34", 508),
  map_unit("GN36", "Plaine Adam", "GN36", 511),
  map_unit("GN37", "Nakutakoin", "GN37", 513),
  # Dzumac (516) n'a aucun habitant recense ; sa geometrie prolonge Koghis.
  map_unit("GN38", "Les Koghis", "GN38", c(509, 516)),
  map_unit("GN39", "Plaine de Koé", "GN39", 512),
  map_unit("GN40", "Katiramona sud", "GN40", 515),
  map_unit("GN41", "Nondoué-La Couvelée", "GN41", 514),
  map_unit("GN42", "Yahoué", "GN42", c(1701, 1702)),
  map_unit("GN43", "Pont des Français", "GN43", 1703),
  map_unit("GN44", "Conception", "GN44", 1704),
  map_unit("GN45", "Robinson", "GN45", c(1705, 1706)),
  map_unit("GN46", "Boulari", "GN46", 1707),
  map_unit("GN47", "Saint Michel", "GN47", 1708),
  map_unit("GN48", "Saint Louis", "GN48", 1709),
  map_unit("GN49", "La Coulée", "GN49", c(1710, 1711)),
  map_unit("GN50", "Vallon Dore", "GN50", 1712),
  map_unit("GN51", "Mont-Dore sud", "GN51", 1713),
  map_unit("GN52", "Plum", "GN52", 1714),
  # Malaoui (1716) a une population nulle et complete le Grand Sud.
  map_unit(
    "GN53",
    "La Lembi - Grand Sud - Ile Ouen",
    "GN53",
    c(1715, 1716)
  ),
  map_unit("GN54", "Païta Centre", "GN54", 2101),
  map_unit("GN55", "Scheffleras", "GN55", 2102),
  map_unit("GN56", "Mont Mou", "GN56", 2108),
  # Baie Maa (2111) n'a pas de resultat disponible et jouxte Savannah-Noure.
  map_unit(
    "GN57",
    "Katiramona-Gadji",
    "GN57",
    c(2103, 2110, 2111)
  ),
  map_unit("GN58", "Ondémia-Port Laguerre", "GN58", 2104),
  map_unit("GN59", "N'Dé-Naniouni", "GN59", 2105),
  # Humbolt (2109) est inhabite et prolonge le secteur Tamoa-Bangou.
  map_unit(
    "GN60",
    "Tamoa-Bangou-Saint Laurent",
    "GN60",
    c(2106, 2109)
  ),
  map_unit("GN61", "Tontouta-Littoral", "GN61", 2107)
)

if (nrow(quartiers_map_spec) != 58) {
  stop("58 unites cartographiques attendues.")
}

quartiers_map_members <- quartiers_map_spec |>
  select(map_id, map_label, id_quartiers) |>
  unnest_longer(id_quartiers, values_to = "id_quartier")

iris_quartier_crosswalk <- quartiers_map_spec |>
  select(map_id, map_label, iris_codes) |>
  unnest_longer(iris_codes, values_to = "codgeo") |>
  mutate(codgeo = as.character(codgeo))

if (nrow(quartiers_map_members) != 61 ||
    anyDuplicated(quartiers_map_members$id_quartier)) {
  stop("Les 61 quartiers Isee doivent etre representes exactement une fois.")
}

if (nrow(iris_quartier_crosswalk) != 88 ||
    anyDuplicated(iris_quartier_crosswalk$codgeo)) {
  stop("Les 88 IRIS du Grand Noumea doivent etre affectes exactement une fois.")
}

quartier_count_columns <- c(
  "population_totale",
  "nes_hors_nc",
  "population_15_plus",
  "comprend_langue_kanak",
  "parle_langue_kanak",
  "connait_langue_kanak",
  "actifs_ayant_emploi",
  "chomeurs_recensement",
  "population_active",
  "cadres_prof_intermediaires",
  "employes",
  "ouvriers",
  "employes_ouvriers",
  "emplois_csp",
  "independants",
  "cdd_stagiaires",
  "cdi",
  "emplois_statut",
  "sans_diplome",
  "population_15_plus_diplome",
  "locataires",
  "population_residences_principales_occupation",
  "population_residences_principales",
  "raccordes_reseau_electrique",
  "non_raccordes_reseau_electrique",
  "sans_eau_courante_interieure",
  "population_residences_principales_eau",
  "sans_internet",
  "population_menages_equipement",
  "sans_automobile",
  "population_menages_vehicules"
)

aggregate_map_data <- function(data) {
  data |>
    inner_join(quartiers_map_members, by = "id_quartier") |>
    group_by(annee, map_id, map_label, commune) |>
    summarise(
      quartiers_sources = paste(quartier, collapse = " ; "),
      across(all_of(quartier_count_columns), sum),
      .groups = "drop"
    ) |>
    mutate(
      taux_nes_hors_nc = 100 * nes_hors_nc / population_totale,
      taux_connaissance_langue_kanak = 100 *
        connait_langue_kanak / population_15_plus,
      taux_chomage_recensement = 100 *
        chomeurs_recensement / population_active,
      taux_cadres_prof_intermediaires = 100 *
        cadres_prof_intermediaires / emplois_csp,
      taux_employes_ouvriers = 100 * employes_ouvriers / emplois_csp,
      taux_cdd_stagiaires = 100 * cdd_stagiaires / emplois_statut,
      taux_sans_diplome = 100 * sans_diplome / population_15_plus_diplome,
      taux_locataires = 100 *
        locataires / population_residences_principales_occupation,
      taux_non_raccordement_electrique = 100 *
        non_raccordes_reseau_electrique /
          population_residences_principales,
      taux_sans_eau_courante_interieure = 100 *
        sans_eau_courante_interieure /
          population_residences_principales_eau,
      taux_sans_internet = 100 *
        sans_internet / population_menages_equipement,
      taux_sans_automobile = 100 *
        sans_automobile / population_menages_vehicules
    )
}

quartiers_map_2014 <- aggregate_map_data(quartiers_2014)
quartiers_map_2019 <- aggregate_map_data(quartiers_2019)

iris_path <- file.path(
  quartiers_project_dir,
  "data",
  "02_geospatial",
  "vecteurs",
  "iris_rgp_2019.geojson"
)

if (!file.exists(iris_path)) {
  stop("GeoJSON IRIS introuvable : ", iris_path)
}

iris_grand_noumea <- st_read(iris_path, quiet = TRUE) |>
  mutate(codgeo = as.character(codgeo)) |>
  filter(codgeo %in% iris_quartier_crosswalk$codgeo)

missing_iris <- setdiff(
  iris_quartier_crosswalk$codgeo,
  iris_grand_noumea$codgeo
)
unexpected_iris <- setdiff(
  iris_grand_noumea$codgeo,
  iris_quartier_crosswalk$codgeo
)

if (length(missing_iris) || length(unexpected_iris) ||
    nrow(iris_grand_noumea) != 88 || anyDuplicated(iris_grand_noumea$codgeo)) {
  stop(
    "Couverture IRIS incorrecte. Manquants : ",
    paste(missing_iris, collapse = ", "),
    "; inattendus : ",
    paste(unexpected_iris, collapse = ", ")
  )
}

iris_grand_noumea <- iris_grand_noumea |>
  inner_join(iris_quartier_crosswalk, by = "codgeo")

iris_population_check <- iris_grand_noumea |>
  st_drop_geometry() |>
  group_by(map_id) |>
  summarise(
    population_15_plus_iris = sum(
      nb_de_pers_de_15_ans_et,
      na.rm = TRUE
    ),
    .groups = "drop"
  ) |>
  inner_join(
    quartiers_map_2019 |>
      select(map_id, population_15_plus_xls = population_15_plus),
    by = "map_id"
  ) |>
  mutate(ecart = population_15_plus_iris - population_15_plus_xls)

if (any(iris_population_check$ecart != 0)) {
  bad <- iris_population_check |>
    filter(ecart != 0) |>
    pull(map_id)
  stop(
    "Les effectifs des 15 ans ou plus ne concordent pas pour : ",
    paste(bad, collapse = ", ")
  )
}

quartiers_map_sf <- iris_grand_noumea |>
  select(map_id, map_label) |>
  group_by(map_id, map_label) |>
  summarise(geometry = st_union(geometry), .groups = "drop") |>
  st_make_valid() |>
  inner_join(
    quartiers_map_2019 |>
      select(-map_label),
    by = "map_id"
  ) |>
  st_transform(4326)

# Les deux petits îlots rattachés à l’IRIS de l’Anse-Vata déforment fortement
# l’emprise de la vue agrandie sans apporter d’information à l’échelle du
# quartier. La cartographie conserve uniquement sa composante terrestre.
anse_vata_index <- which(quartiers_map_sf$map_id == "GN02")
anse_vata_parts <- st_cast(
  st_geometry(quartiers_map_sf[anse_vata_index, ]),
  "POLYGON"
)
anse_vata_areas <- st_area(st_transform(anse_vata_parts, 3163))
st_geometry(quartiers_map_sf)[anse_vata_index] <- st_cast(
  anse_vata_parts[which.max(anse_vata_areas)],
  "MULTIPOLYGON"
)

if (nrow(quartiers_map_sf) != 58 || any(!st_is_valid(quartiers_map_sf))) {
  stop("La dissolution des geometries n'a pas produit 58 unites valides.")
}

if (sys.nframe() == 0L) {
  message(
    "Correspondance validee : 61 quartiers, 88 IRIS, 58 unites ",
    "cartographiques sans chevauchement d'affectation."
  )
  print(
    quartiers_map_spec |>
      mutate(
        id_quartiers = vapply(
          id_quartiers,
          paste,
          collapse = ",",
          FUN.VALUE = character(1)
        ),
        iris_codes = vapply(
          iris_codes,
          paste,
          collapse = ",",
          FUN.VALUE = character(1)
        )
      ),
    n = Inf,
    width = Inf
  )
}
