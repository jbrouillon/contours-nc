# Préparation des données des deux explorateurs.
suppressPackageStartupMessages({
  library(dplyr)
  library(htmltools)
  library(jsonlite)
  library(readxl)
  library(scales)
  library(sf)
  library(tidyr)
})

article_dir <- get0(
  "habitat_analysis_dir",
  envir = environment(),
  inherits = TRUE,
  ifnotfound = NULL
)
if (is.null(article_dir)) {
  article_input <- knitr::current_input(dir = TRUE)
  if (is.null(article_input)) {
    article_input <- file.path(
      getwd(),
      "posts",
      "disparites-territoriales-nouvelle-caledonie",
      "index.qmd"
    )
  }
  article_dir <- dirname(article_input)
}
article_dir <- normalizePath(article_dir, winslash = "/", mustWork = TRUE)

source(
  file.path(article_dir, "parse_quartiers.R"),
  local = environment(),
  encoding = "UTF-8"
)
source(
  file.path(article_dir, "quartiers_iris.R"),
  local = environment(),
  encoding = "UTF-8"
)

fmt_int <- function(x) {
  number(x, accuracy = 1, decimal.mark = ",", big.mark = " ")
}

fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}

fmt_pct <- function(x, digits = 1) {
  paste0(fmt_num(x, digits), " %")
}

fmt_signed_pp <- function(x, digits = 1) {
  paste0(ifelse(x > 0, "+", ""), fmt_num(x, digits), " points")
}

`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

project_dir <- normalizePath(
  file.path(article_dir, "..", ".."),
  winslash = "/",
  mustWork = TRUE
)

# Donnees cartographiques ----------------------------------------------------

map_geometry_sf <- quartiers_map_sf |>
  select(map_id, map_label, commune) |>
  st_transform(3163) |>
  st_simplify(dTolerance = 65, preserveTopology = TRUE) |>
  st_transform(4326)

sf_geojson_object <- function(x) {
  if (inherits(x, "sfc")) x <- st_sf(geometry = x)
  tmp <- tempfile(fileext = ".geojson")
  on.exit(unlink(tmp), add = TRUE)
  st_write(x, tmp, driver = "GeoJSON", quiet = TRUE, delete_dsn = TRUE)
  text <- paste(
    readLines(tmp, encoding = "UTF-8", warn = FALSE),
    collapse = "\n"
  )
  fromJSON(text, simplifyVector = FALSE)
}

map_geometry_json <- sf_geojson_object(map_geometry_sf)

# Les limites sont dissoutes avant l’affichage afin qu’une frontière commune
# ne soit jamais dessinée deux fois. Les contours extérieurs sont conservés
# comme surfaces pour pouvoir être adoucis à la manière de la couche « sketch »
# de geoviz.
map_commune_sf <- map_geometry_sf |>
  group_by(commune) |>
  summarise(do_union = TRUE, .groups = "drop")
map_noumea_sf <- map_geometry_sf |>
  filter(commune == "Nouméa")

make_map_sketch_area <- function(x, layer_name, tolerance) {
  x |>
    st_transform(3163) |>
    st_union() |>
    st_sf(couche = layer_name, geometry = _) |>
    st_simplify(dTolerance = tolerance, preserveTopology = TRUE) |>
    st_transform(4326) |>
    sf_geojson_object()
}

map_linework <- list(
  quartiers = sf_geojson_object(st_sf(
    couche = "quartiers",
    geometry = st_union(st_boundary(st_geometry(map_geometry_sf)))
  )),
  communes = sf_geojson_object(st_sf(
    couche = "communes",
    geometry = st_union(st_boundary(st_geometry(map_commune_sf)))
  )),
  grand_area = sf_geojson_object(st_sf(
    couche = "grand_noumea",
    geometry = st_union(st_geometry(map_geometry_sf))
  )),
  noumea_quartiers = sf_geojson_object(st_sf(
    couche = "quartiers_noumea",
    geometry = st_union(st_boundary(st_geometry(map_noumea_sf)))
  )),
  noumea_area = sf_geojson_object(st_sf(
    couche = "noumea",
    geometry = st_union(st_geometry(map_noumea_sf))
  )),
  sketch_areas = list(
    grand = make_map_sketch_area(map_geometry_sf, "grand_noumea", 180),
    noumea = make_map_sketch_area(map_noumea_sf, "noumea", 95)
  )
)

select_map_data <- function(data) {
  data |>
    transmute(
      annee,
      map_id,
      quartier = map_label,
      commune,
      quartiers_sources,
      taux_nes_hors_nc,
      nes_hors_nc,
      population_totale,
      taux_chomage = taux_chomage_recensement,
      chomeurs = chomeurs_recensement,
      actifs = population_active,
      taux_cdd = taux_cdd_stagiaires,
      cdd = cdd_stagiaires,
      emplois = emplois_statut,
      taux_cadres = taux_cadres_prof_intermediaires,
      cadres = cadres_prof_intermediaires,
      emplois_csp,
      taux_employes_ouvriers,
      employes_ouvriers,
      taux_langue = taux_connaissance_langue_kanak,
      connait_langue = connait_langue_kanak,
      population_15_plus,
      taux_sans_diplome,
      sans_diplome,
      population_15_plus_diplome,
      taux_locataires,
      locataires,
      population_residences_principales_occupation,
      taux_non_reseau = taux_non_raccordement_electrique,
      non_raccordes = non_raccordes_reseau_electrique,
      population_residences_principales,
      taux_sans_eau = taux_sans_eau_courante_interieure,
      sans_eau = sans_eau_courante_interieure,
      population_residences_principales_eau,
      taux_sans_internet,
      sans_internet,
      population_menages_equipement,
      taux_sans_automobile,
      sans_automobile,
      population_menages_vehicules
    )
}

map_data <- bind_rows(
  select_map_data(quartiers_map_2014),
  select_map_data(quartiers_map_2019)
) |>
  arrange(annee, map_id)

# Donnees IRIS pour l'ensemble de la Nouvelle-Caledonie --------------------

# Les donnees complementaires PopGIS contiennent plusieurs indicateurs qui
# ne figurent pas directement dans le GeoJSON. Elles sont lues ici sans
# modifier les libelles originaux du fichier source.
read_nc_iris_extra <- function(path) {
  lines <- readLines(path, encoding = "UTF-8", warn = FALSE)
  header <- strsplit(lines[3], ";", fixed = TRUE)[[1]]

  dat <- read.table(
    text = paste(lines[-seq_len(3)], collapse = "\n"),
    sep = ";",
    dec = ".",
    header = FALSE,
    fill = TRUE,
    quote = "",
    stringsAsFactors = FALSE,
    check.names = FALSE,
    na.strings = c("", "NA")
  )
  dat <- dat[, seq_along(header), drop = FALSE]

  names(dat) <- c(
    "code",
    "libelle_extra",
    "csp_agri",
    "csp_artisans",
    "csp_cadres",
    "csp_professions_intermediaires",
    "csp_employes",
    "csp_ouvriers",
    "pct_employes_ouvriers",
    "pct_salaries_prive",
    "pct_salaries_public",
    "pct_cdd",
    "pct_cdi_extra",
    "pct_temps_complet",
    "pct_temps_partiel",
    "pct_travail_continu",
    "pct_travail_saisonnier",
    "pct_marche",
    "pct_voiture",
    "pct_transport_commun",
    "pct_sans_vehicule",
    "pct_proprietaires",
    "pct_locataires",
    "pct_locataires_gratuit",
    "pct_locataires_social",
    "pct_locataires_prive",
    "pct_logements_moins_40",
    "pct_logements_moins_80",
    "pct_logements_moins_120",
    "pct_logements_plus_160",
    "pct_electricite",
    "pct_sans_electricite",
    "pct_eau_courante",
    "pct_refrigerateur",
    "pct_machine_laver_extra",
    "pct_internet_extra",
    "taux_navetteurs_sortant_extra",
    "taux_activite_extra",
    "taux_emploi_extra",
    "taux_chomage_extra",
    "pct_travailleurs_independants_extra",
    "pct_hors_nc_2014",
    "pct_autre_commune_2014",
    "pct_meme_commune_2014",
    "pct_pers_seules_extra",
    "pct_couples_sans_enfants_extra",
    "pct_couples_avec_enfants_extra",
    "pct_familles_monoparentales_extra",
    "pct_menages_complexes_extra"
  )

  numeric_columns <- setdiff(names(dat), "libelle_extra")
  dat[numeric_columns] <- lapply(
    dat[numeric_columns],
    function(x) suppressWarnings(as.numeric(as.character(x)))
  )

  as_tibble(dat) |>
    mutate(
      codgeo = as.character(as.integer(code)),
      csp_total = csp_agri + csp_artisans + csp_cadres +
        csp_professions_intermediaires + csp_employes + csp_ouvriers,
      pct_cadres_professions_intermediaires = if_else(
        csp_total > 0,
        100 * (csp_cadres + csp_professions_intermediaires) / csp_total,
        NA_real_
      )
    ) |>
    select(
      codgeo,
      pct_cadres_professions_intermediaires,
      pct_employes_ouvriers,
      pct_locataires,
      pct_sans_electricite,
      pct_eau_courante
    )
}

nc_iris_path <- file.path(
  project_dir,
  "data",
  "02_geospatial",
  "vecteurs",
  "iris_rgp_2019.geojson"
)
nc_iris_extra_path <- file.path(
  project_dir,
  "data",
  "02_geospatial",
  "vecteurs",
  "iris_rgp_2019_data.csv"
)
nc_communes_path <- file.path(
  project_dir,
  "data",
  "02_geospatial",
  "vecteurs",
  "nc_communes_simp.geojson"
)

required_nc_files <- c(nc_iris_path, nc_iris_extra_path, nc_communes_path)
if (any(!file.exists(required_nc_files))) {
  stop(
    "Fichiers necessaires a l'explorateur NC manquants : ",
    paste(required_nc_files[!file.exists(required_nc_files)], collapse = ", ")
  )
}

nc_iris_raw <- st_read(nc_iris_path, quiet = TRUE) |>
  st_make_valid() |>
  mutate(codgeo = as.character(codgeo))
nc_communes_raw <- st_read(nc_communes_path, quiet = TRUE) |>
  st_make_valid()
nc_iris_extra <- read_nc_iris_extra(nc_iris_extra_path)

# Le point interieur de quelques IRIS littoraux tombe hors des limites
# communales simplifiees. On retient donc, pour chaque IRIS, la commune avec
# laquelle sa geometrie partage la plus grande surface.
nc_iris_assignment <- st_intersection(
  nc_iris_raw |>
    select(codgeo) |>
    st_transform(3163),
  nc_communes_raw |>
    select(commune, Province) |>
    st_transform(3163)
) |>
  mutate(overlap_area = as.numeric(st_area(geometry))) |>
  st_drop_geometry() |>
  group_by(codgeo) |>
  slice_max(overlap_area, n = 1, with_ties = FALSE) |>
  ungroup() |>
  transmute(
    codgeo,
    commune,
    province = recode(
      Province,
      Sud = "Province Sud",
      Nord = "Province Nord",
      Iles = "Îles Loyauté"
    )
  )

if (nrow(nc_iris_assignment) != nrow(nc_iris_raw) ||
    anyDuplicated(nc_iris_assignment$codgeo)) {
  stop("Chaque IRIS doit etre rattache exactement une fois a une commune.")
}

clean_nc_iris_label <- function(x) {
  x |>
    gsub("Forˆt", "Forêt", x = _) |>
    gsub("^Coeur", "Cœur", x = _)
}

nc_data <- nc_iris_raw |>
  st_drop_geometry() |>
  left_join(nc_iris_extra, by = "codgeo") |>
  left_join(nc_iris_assignment, by = "codgeo") |>
  transmute(
    annee = 2019,
    map_id = codgeo,
    iris = clean_nc_iris_label(libgeo),
    commune,
    province,
    population = population_totale,
    taux_chomage = taux_de_chomage,
    taux_emploi = taux_demploi,
    taux_cdd = percent_cdd_contrat_a_duree_determinee,
    taux_cadres = pct_cadres_professions_intermediaires,
    taux_employes_ouvriers = pct_employes_ouvriers,
    taux_bepc_moins = percent_diplomes_du_bepc_ou_moins,
    taux_bac3_plus = percent_diplomes_dun_bac_3_ou,
    taux_tribu = percent_pers_en_tribu,
    taux_nes_hors_nc = percent_pers_nees_hors_nouvelle_caledonie,
    taux_familles_monoparentales = percent_familles_monoparentales,
    taux_65_plus = percent_64_ans_et,
    taux_locataires = pct_locataires,
    taux_sans_electricite = pct_sans_electricite,
    taux_sans_eau = 100 - pct_eau_courante,
    taux_sans_internet = 100 - percent_menages_acces_a_internet,
    taux_sans_vehicule = percent_menages_sans_vehicules,
    taux_navetteurs = 100 * taux_de_navetteurs_sortant,
    taux_salaries_public = percent_salaries_du_public,
    taux_marche = percent_mode_principal_de_transport_marche_a_pied,
    taux_transport_commun =
      percent_mode_principal_de_transport_transport_en_commun
  ) |>
  arrange(province, commune, iris)

nc_geometry_sf <- nc_iris_raw |>
  transmute(
    map_id = codgeo,
    map_label = clean_nc_iris_label(libgeo),
    geometry
  ) |>
  left_join(nc_iris_assignment, by = c("map_id" = "codgeo")) |>
  st_transform(3163) |>
  st_simplify(dTolerance = 110, preserveTopology = TRUE) |>
  st_transform(4326)

nc_geometry_json <- sf_geojson_object(nc_geometry_sf)
nc_commune_geometry_sf <- nc_geometry_sf |>
  group_by(commune, province) |>
  summarise(do_union = TRUE, .groups = "drop")
nc_province_geometry_sf <- nc_geometry_sf |>
  group_by(province) |>
  summarise(do_union = TRUE, .groups = "drop")

make_nc_sketch_area <- function(x, layer_name) {
  projected <- x |>
    st_transform(3163)

  st_sf(
    couche = layer_name,
    geometry = st_union(st_geometry(projected))
  ) |>
    st_simplify(dTolerance = 400, preserveTopology = TRUE) |>
    st_transform(4326) |>
    sf_geojson_object()
}

nc_sketch_areas <- list(
  nc = make_nc_sketch_area(nc_geometry_sf, "nouvelle_caledonie"),
  sud = make_nc_sketch_area(
    nc_geometry_sf |> filter(province == "Province Sud"),
    "province_sud"
  ),
  nord = make_nc_sketch_area(
    nc_geometry_sf |> filter(province == "Province Nord"),
    "province_nord"
  ),
  iles = make_nc_sketch_area(
    nc_geometry_sf |> filter(province == "Îles Loyauté"),
    "iles_loyaute"
  )
)

nc_linework <- list(
  iris = sf_geojson_object(st_sf(
    couche = "iris",
    geometry = st_union(st_boundary(st_geometry(nc_geometry_sf)))
  )),
  communes = sf_geojson_object(st_sf(
    couche = "communes",
    geometry = st_union(st_boundary(st_geometry(nc_commune_geometry_sf)))
  )),
  provinces = sf_geojson_object(st_sf(
    couche = "provinces",
    geometry = st_union(st_boundary(st_geometry(nc_province_geometry_sf)))
  )),
  area = sf_geojson_object(st_sf(
    couche = "nouvelle_caledonie",
    geometry = st_union(st_geometry(nc_geometry_sf))
  )),
  sketch_areas = nc_sketch_areas
)

map_bundle <- list(
  geometry = map_geometry_json,
  linework = map_linework,
  data = map_data,
  nc_geometry = nc_geometry_json,
  nc_linework = nc_linework,
  nc_data = nc_data
)

# Synthèse multivariée 2019 -----------------------------------------------

heatmap_rank <- function(x) {
  ifelse(is.na(x), NA_real_, 100 * percent_rank(x))
}

heatmap_data <- map_data |>
  filter(annee == 2019) |>
  mutate(
    rang_nes_hors_nc = heatmap_rank(taux_nes_hors_nc),
    rang_chomage = heatmap_rank(taux_chomage),
    rang_cdd = heatmap_rank(taux_cdd),
    rang_cadres = heatmap_rank(taux_cadres),
    rang_faible_cadres = heatmap_rank(-taux_cadres),
    rang_employes_ouvriers = heatmap_rank(taux_employes_ouvriers),
    rang_langue = heatmap_rank(taux_langue),
    rang_non_reseau = heatmap_rank(taux_non_reseau),
    rang_sans_diplome = heatmap_rank(taux_sans_diplome),
    rang_locataires = heatmap_rank(taux_locataires),
    rang_sans_eau = heatmap_rank(taux_sans_eau),
    rang_sans_internet = heatmap_rank(taux_sans_internet),
    rang_sans_automobile = heatmap_rank(taux_sans_automobile),
    indice_socioeco = rowMeans(
      pick(
        rang_chomage,
        rang_cdd,
        rang_faible_cadres,
        rang_employes_ouvriers,
        rang_sans_diplome,
        rang_non_reseau,
        rang_sans_eau,
        rang_sans_internet,
        rang_sans_automobile
      ),
      na.rm = TRUE
    )
  ) |>
  select(
    annee,
    map_id,
    quartier,
    commune,
    quartiers_sources,
    taux_nes_hors_nc,
    taux_chomage,
    taux_cdd,
    taux_cadres,
    taux_employes_ouvriers,
    taux_langue,
    taux_non_reseau,
    taux_sans_diplome,
    taux_locataires,
    taux_sans_eau,
    taux_sans_internet,
    taux_sans_automobile,
    rang_nes_hors_nc,
    rang_chomage,
    rang_cdd,
    rang_cadres,
    rang_employes_ouvriers,
    rang_langue,
    rang_non_reseau,
    rang_sans_diplome,
    rang_locataires,
    rang_sans_eau,
    rang_sans_internet,
    rang_sans_automobile,
    indice_socioeco
  ) |>
  arrange(desc(indice_socioeco), commune, quartier)

explorer_table <- map_data |>
  select(
    annee,
    commune,
    quartier,
    taux_nes_hors_nc,
    taux_sans_diplome,
    taux_chomage,
    taux_cdd,
    taux_employes_ouvriers,
    taux_cadres,
    taux_langue,
    taux_locataires,
    taux_non_reseau,
    taux_sans_eau,
    taux_sans_internet,
    taux_sans_automobile
  ) |>
  mutate(across(starts_with("taux_"), fmt_pct)) |>
  rename(
    Année = annee,
    Commune = commune,
    `Unité cartographique` = quartier,
    `Nés hors de NC` = taux_nes_hors_nc,
    `Sans diplôme` = taux_sans_diplome,
    Chômage = taux_chomage,
    `CDD/stages` = taux_cdd,
    `Employés/ouvriers` = taux_employes_ouvriers,
    `Cadres/prof. interm.` = taux_cadres,
    `Langue kanak (proxy)` = taux_langue,
    Locataires = taux_locataires,
    `Non-raccordement électrique` = taux_non_reseau,
    `Sans eau intérieure` = taux_sans_eau,
    `Sans internet` = taux_sans_internet,
    `Sans automobile` = taux_sans_automobile
  )

heatmap_correlations <- heatmap_data |>
  summarise(
    nes_hors_nc_cadres = cor(
      taux_nes_hors_nc,
      taux_cadres,
      method = "pearson",
      use = "complete.obs"
    ),
    langue_chomage = cor(taux_langue, taux_chomage, method = "spearman"),
    langue_cadres = cor(taux_langue, taux_cadres, method = "spearman"),
    langue_indice_socioeco = cor(
      taux_langue,
      indice_socioeco,
      method = "spearman"
    )
  )

nc_correlations <- nc_data |>
  filter(population > 0) |>
  summarise(
    nes_hors_nc_cadres = cor(
      taux_nes_hors_nc,
      taux_cadres,
      method = "pearson",
      use = "complete.obs"
    ),
    tribu_chomage = cor(
      taux_tribu,
      taux_chomage,
      method = "spearman",
      use = "complete.obs"
    ),
    tribu_bepc_moins = cor(
      taux_tribu,
      taux_bepc_moins,
      method = "spearman",
      use = "complete.obs"
    ),
    tribu_bac3_plus = cor(
      taux_tribu,
      taux_bac3_plus,
      method = "spearman",
      use = "complete.obs"
    ),
    tribu_sans_internet = cor(
      taux_tribu,
      taux_sans_internet,
      method = "spearman",
      use = "complete.obs"
    )
  )

nc_explorer_table <- nc_data |>
  filter(population > 0) |>
  select(
    province,
    commune,
    iris,
    population,
    taux_tribu,
    taux_bepc_moins,
    taux_bac3_plus,
    taux_chomage,
    taux_emploi,
    taux_cdd,
    taux_cadres,
    taux_employes_ouvriers,
    taux_sans_internet,
    taux_sans_vehicule
  ) |>
  mutate(across(starts_with("taux_"), fmt_pct)) |>
  rename(
    Province = province,
    Commune = commune,
    IRIS = iris,
    Population = population,
    `Résidence en tribu` = taux_tribu,
    `BEPC ou moins` = taux_bepc_moins,
    `Bac +3 ou plus` = taux_bac3_plus,
    Chômage = taux_chomage,
    Emploi = taux_emploi,
    CDD = taux_cdd,
    `Cadres/prof. interm.` = taux_cadres,
    `Employés/ouvriers` = taux_employes_ouvriers,
    `Sans internet` = taux_sans_internet,
    `Sans véhicule` = taux_sans_vehicule
  )

map_bundle_payload <- function() {
  tags$script(
    id = "habitat-map-bundle-data",
    type = "application/json",
    HTML(toJSON(
      map_bundle,
      auto_unbox = TRUE,
      dataframe = "rows",
      na = "null",
      digits = 8
    ))
  )
}

map_figure <- function(id, options = list()) {
  tagList(
    tags$div(
      id = id,
      class = "habitat-sketch habitat-map no-lightbox",
      `data-sketch-chart` = options$aria_label %||%
        options$title %||%
        "Carte de la Nouvelle-Calédonie"
    ),
    tags$script(
      id = paste0(id, "-data"),
      type = "application/json",
      HTML(toJSON(
        list(options = options),
        auto_unbox = TRUE,
        dataframe = "rows",
        na = "null",
        digits = 8
      ))
    )
  )
}

chart_figure <- function(id, data, options = list()) {
  tagList(
    tags$div(
      id = id,
      class = "habitat-sketch no-lightbox",
      `data-sketch-chart` = options$aria_label %||%
        options$title %||%
        "Graphique"
    ),
    tags$script(
      id = paste0(id, "-data"),
      type = "application/json",
      HTML(toJSON(
        list(data = data, options = options),
        auto_unbox = TRUE,
        dataframe = "rows",
        na = "null",
        digits = 8
      ))
    )
  )
}

# Resultats utiles au texte --------------------------------------------------

distribution_row <- function(variable) {
  quartiers_distribution |>
    filter(.data$variable == variable) |>
    slice(1)
}

dist_chomage <- distribution_row("taux_chomage_recensement")
dist_cdd <- distribution_row("taux_cdd_stagiaires")
dist_langue <- distribution_row("taux_connaissance_langue_kanak")
dist_reseau <- distribution_row("taux_non_raccordement_electrique")

min_chomage_2019 <- quartiers_2019 |>
  slice_min(taux_chomage_recensement, n = 1, with_ties = FALSE)
max_chomage_2019 <- quartiers_2019 |>
  slice_max(taux_chomage_recensement, n = 1, with_ties = FALSE)
min_cdd_2019 <- quartiers_2019 |>
  slice_min(taux_cdd_stagiaires, n = 1, with_ties = FALSE)
max_cdd_2019 <- quartiers_2019 |>
  slice_max(taux_cdd_stagiaires, n = 1, with_ties = FALSE)
min_langue_2019 <- quartiers_2019 |>
  slice_min(taux_connaissance_langue_kanak, n = 1, with_ties = FALSE)
max_langue_2019 <- quartiers_2019 |>
  slice_max(taux_connaissance_langue_kanak, n = 1, with_ties = FALSE)

grand_noumea_rates <- quartiers_indicateurs |>
  group_by(annee) |>
  summarise(
    chomeurs = sum(chomeurs_recensement),
    actifs = sum(population_active),
    cdd = sum(cdd_stagiaires),
    emplois = sum(emplois_statut),
    langue = sum(connait_langue_kanak),
    population_15_plus = sum(population_15_plus),
    non_raccordes = sum(non_raccordes_reseau_electrique),
    population_residences_principales =
      sum(population_residences_principales),
    taux_chomage = 100 * chomeurs / actifs,
    taux_cdd = 100 * cdd / emplois,
    taux_langue = 100 * langue / population_15_plus,
    taux_non_reseau = 100 * non_raccordes /
      population_residences_principales,
    .groups = "drop"
  )

grand_noumea_2019 <- grand_noumea_rates |>
  filter(annee == 2019) |>
  slice(1)

get_quartier_year <- function(name, year) {
  quartiers_indicateurs |>
    filter(quartier == name, annee == year) |>
    slice(1)
}

nouville_2014 <- get_quartier_year("Nouville", 2014)
nouville_2019 <- get_quartier_year("Nouville", 2019)
zi_ducos_2019 <- get_quartier_year("Zone indus. Ducos", 2019)
pk6_2019 <- get_quartier_year("P.K. 6", 2019)
saint_louis_2019 <- get_quartier_year("Saint Louis", 2019)
numbo_2019 <- get_quartier_year("Numbo-Koumourou, Tindu", 2019)
