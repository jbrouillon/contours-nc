library(dplyr)
library(sf)
library(terra)
library(FactoMineR)
library(here)

crs_work <- 3163

project_dir <- here::here()
data_path <- function(...) file.path(project_dir, "data", ...)

iris_path <- data_path("02_geospatial", "vecteurs", "iris_rgp_2019.geojson")
iris_extra_path <- data_path("02_geospatial", "vecteurs", "iris_rgp_2019_data.csv")
pop_path <- data_path("02_geospatial", "rasters", "NCL_Pop_Grid_2020.tif")
out_dir <- data_path("outputs_capital_socio_economique")

dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

vars_capital <- c(
  "percent_diplomes_dun_bac_3_ou",
  "taux_demploi",
  "percent_cdi_contrat_a_duree_indeterminee",
  "percent_menages_acces_a_internet",
  "percent_menages_avec_vehicules"
)

vars_inversees <- character(0)

vars_acp <- c(
  vars_capital,
  if (length(vars_inversees) > 0) paste0("inv_", vars_inversees) else character(0)
)

vars_descriptives <- c(
  "taux_de_chomage",
  "percent_diplomes_dun_bac_2",
  "percent_diplomes_du_bepc_ou_moins",
  "percent_menages_sans_vehicules",
  "percent_menages_machine_a_laver"
)

read_popgis_iris_data <- function(path) {
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
    "taux_navetteurs_sortant",
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

  numeric_cols <- setdiff(names(dat), "libelle_extra")
  dat[numeric_cols] <- lapply(
    dat[numeric_cols],
    function(x) suppressWarnings(as.numeric(as.character(x)))
  )

  dat |>
    mutate(
      codgeo_i = as.integer(code),
      csp_total = csp_agri + csp_artisans + csp_cadres +
        csp_professions_intermediaires + csp_employes + csp_ouvriers,
      pct_cadres_professions_intermediaires = if_else(
        csp_total > 0,
        100 * (csp_cadres + csp_professions_intermediaires) / csp_total,
        NA_real_
      ),
      pct_moins_employes_ouvriers = 100 - pct_employes_ouvriers
    ) |>
    select(
      codgeo_i,
      pct_cadres_professions_intermediaires,
      pct_moins_employes_ouvriers,
      pct_machine_laver_extra,
      pct_eau_courante,
      pct_electricite,
      pct_proprietaires,
      pct_logements_plus_160
    )
}

make_variable_audit <- function(iris_df) {
  audit_data <- iris_df |>
    st_drop_geometry() |>
    transmute(
      `Diplomes bac +3 ou plus` = as.numeric(percent_diplomes_dun_bac_3_ou),
      `Diplomes bac +2` = as.numeric(percent_diplomes_dun_bac_2),
      `Moins de bas niveaux de diplome` =
        100 - as.numeric(percent_diplomes_du_bepc_ou_moins),
      `Cadres et professions intermediaires` =
        as.numeric(pct_cadres_professions_intermediaires),
      `Taux emploi` = as.numeric(taux_demploi),
      `Moins de chomage` = 100 - as.numeric(taux_de_chomage),
      `CDI` = as.numeric(percent_cdi_contrat_a_duree_indeterminee),
      `Acces internet` = as.numeric(percent_menages_acces_a_internet),
      `Menages avec vehicule` = as.numeric(percent_menages_avec_vehicules),
      `Machine a laver` = as.numeric(percent_menages_machine_a_laver)
    )

  cor_mat <- cor(audit_data, use = "pairwise.complete.obs")

  as.data.frame(as.table(cor_mat), stringsAsFactors = FALSE) |>
    filter(as.character(Var1) < as.character(Var2)) |>
    transmute(
      variable_1 = as.character(Var1),
      variable_2 = as.character(Var2),
      correlation = Freq,
      correlation_absolue = abs(Freq),
      variable_1_retenue = variable_1 %in% names(audit_data)[names(audit_data) %in% c(
        "Diplomes bac +3 ou plus",
        "Taux emploi",
        "CDI",
        "Acces internet",
        "Menages avec vehicule"
      )],
      variable_2_retenue = variable_2 %in% names(audit_data)[names(audit_data) %in% c(
        "Diplomes bac +3 ou plus",
        "Taux emploi",
        "CDI",
        "Acces internet",
        "Menages avec vehicule"
      )]
    ) |>
    arrange(desc(correlation_absolue))
}

make_gaussian_kernel <- function(size = 7, sigma = 2) {
  if (size %% 2 == 0) stop("kernel_size doit etre impair.")

  ax <- seq(-(size - 1) / 2, (size - 1) / 2)
  k <- outer(ax, ax, function(x, y) exp(-(x^2 + y^2) / (2 * sigma^2)))
  k / sum(k)
}

make_template_from_boundary <- function(boundary_vect, resolution_m) {
  e <- terra::ext(boundary_vect)

  ncol <- ceiling((terra::xmax(e) - terra::xmin(e)) / resolution_m)
  nrow <- ceiling((terra::ymax(e) - terra::ymin(e)) / resolution_m)

  terra::rast(
    ncols = ncol,
    nrows = nrow,
    xmin = terra::xmin(e),
    xmax = terra::xmin(e) + ncol * resolution_m,
    ymin = terra::ymin(e),
    ymax = terra::ymin(e) + nrow * resolution_m,
    crs = terra::crs(boundary_vect)
  )
}

mask_to_boundary <- function(r, boundary_vect) {
  terra::mask(
    terra::crop(r, boundary_vect),
    boundary_vect,
    touches = TRUE
  )
}

rescale_0_100 <- function(x) {
  rng <- range(x, na.rm = TRUE)
  if (!all(is.finite(rng)) || diff(rng) == 0) {
    return(rep(NA_real_, length(x)))
  }

  100 * (x - rng[1]) / diff(rng)
}

make_capital_surface <- function(
    pop_points,
    mask_sf,
    resolution,
    kernel_size,
    sigma,
    n_smooth,
    label
) {
  message("Surface ", label, " : preparation de l'emprise")

  pop_points <- pop_points |>
    st_transform(crs_work) |>
    filter(!is.na(indice_capital), !is.na(population), population > 0)

  mask_sf <- mask_sf |>
    st_make_valid() |>
    st_transform(crs_work)

  boundary_vect <- terra::vect(mask_sf)
  template <- make_template_from_boundary(boundary_vect, resolution)

  message("Surface ", label, " : rasterisation ponderee")

  pts_vect <- terra::vect(pop_points)
  pts_vect$indice_x_pop <- pts_vect$indice_capital * pts_vect$population

  r_num <- terra::rasterize(
    pts_vect,
    template,
    field = "indice_x_pop",
    fun = "sum",
    background = NA_real_
  )

  r_den <- terra::rasterize(
    pts_vect,
    template,
    field = "population",
    fun = "sum",
    background = NA_real_
  )

  r_cells <- r_num / r_den
  names(r_cells) <- "indice_capital_cellules_habitees"
  r_cells <- mask_to_boundary(r_cells, boundary_vect)

  message("Surface ", label, " : remplissage par plus proche voisin")

  r_land <- template
  terra::values(r_land) <- 1
  r_land <- mask_to_boundary(r_land, boundary_vect)

  pts_capital <- terra::as.points(r_cells, values = TRUE, na.rm = TRUE)

  r_smooth <- terra::interpNear(
    r_land,
    pts_capital,
    field = names(r_cells)[1],
    radius = Inf,
    fill = NA_real_
  )

  message("Surface ", label, " : lissage gaussien")

  w <- make_gaussian_kernel(size = kernel_size, sigma = sigma)
  for (i in seq_len(n_smooth)) {
    message("  passe ", i, "/", n_smooth)
    r_smooth <- terra::focal(
      r_smooth,
      w = w,
      fun = "sum",
      na.policy = "omit",
      expand = TRUE
    )
  }

  r_smooth <- terra::mask(r_smooth, r_land)
  names(r_smooth) <- "indice_capital_lisse"

  list(cellules_habitees = r_cells, visu_lisse = r_smooth)
}

message("Lecture des IRIS")

iris_extra <- read_popgis_iris_data(iris_extra_path)

iris <- st_read(iris_path, quiet = TRUE) |>
  st_make_valid() |>
  st_transform(crs_work) |>
  mutate(
    row_id = row_number(),
    codgeo_i = suppressWarnings(as.integer(codgeo)),
    territoire = if_else(
      codgeo_i >= 1800 & codgeo_i < 1900,
      "Noumea",
      "Reste de la Nouvelle-Caledonie"
    ),
    across(all_of(vars_inversees), ~ -.x, .names = "inv_{.col}")
  ) |>
  left_join(iris_extra, by = "codgeo_i")

missing_vars <- setdiff(c(vars_capital, vars_inversees, vars_descriptives), names(iris))
if (length(missing_vars) > 0) {
  stop("Variables manquantes dans iris : ", paste(missing_vars, collapse = ", "))
}

message("ACP parcimonieuse apres controle des variables redondantes")

df_acp <- iris |>
  st_drop_geometry() |>
  select(row_id, all_of(vars_acp)) |>
  mutate(across(all_of(vars_acp), as.numeric)) |>
  tidyr::drop_na(all_of(vars_acp))

res_acp <- FactoMineR::PCA(
  df_acp |> select(all_of(vars_acp)),
  scale.unit = TRUE,
  graph = FALSE
)

orientation <- ifelse(
  cor(
    res_acp$ind$coord[, 1],
    df_acp$percent_diplomes_dun_bac_3_ou,
    use = "complete.obs"
  ) < 0,
  -1,
  1
)

scores <- tibble(
  row_id = df_acp$row_id,
  capital_acp = as.numeric(res_acp$ind$coord[, 1]) * orientation
) |>
  mutate(
    indice_capital = rescale_0_100(capital_acp),
    capital_acp_std = as.numeric(scale(capital_acp)),
    quintile_capital = dplyr::ntile(indice_capital, 5)
  )

iris_capital <- iris |>
  left_join(scores, by = "row_id")

variable_contrib <- tibble(
  variable = vars_acp,
  correlation_axe1 = as.numeric(res_acp$var$coord[vars_acp, 1]) * orientation,
  contribution_axe1 = as.numeric(res_acp$var$contrib[vars_acp, 1]),
  correlation_axe2 = as.numeric(res_acp$var$coord[vars_acp, 2]),
  contribution_axe2 = as.numeric(res_acp$var$contrib[vars_acp, 2])
)

axis_summary <- tibble(
  axe = paste0("Dimension ", seq_len(nrow(res_acp$eig))),
  variance = res_acp$eig[, 2],
  variance_cumulee = res_acp$eig[, 3]
)

variable_audit <- make_variable_audit(iris)

message("Exports vecteur et tables")

st_write(
  iris_capital,
  file.path(out_dir, "iris_capital_socio_economique.gpkg"),
  delete_dsn = TRUE,
  quiet = TRUE
)

write.csv(
  st_drop_geometry(iris_capital),
  file.path(out_dir, "iris_capital_socio_economique.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

write.csv(
  variable_contrib,
  file.path(out_dir, "capital_acp_contributions.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

write.csv(
  axis_summary,
  file.path(out_dir, "capital_acp_variance.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

write.csv(
  variable_audit,
  file.path(out_dir, "capital_variables_correlation_audit.csv"),
  row.names = FALSE,
  fileEncoding = "UTF-8"
)

message("Preparation des points de population")

pop_rast <- terra::rast(pop_path)
pop_pos <- terra::ifel(pop_rast > 0, pop_rast, NA)

pop_pts <- terra::as.points(pop_pos, values = TRUE, na.rm = TRUE) |>
  st_as_sf() |>
  st_transform(crs_work)

pop_col <- names(pop_pts)[1]

pop_pts <- pop_pts |>
  rename(population = all_of(pop_col)) |>
  mutate(population = as.numeric(population)) |>
  filter(!is.na(population), population > 0)

pop_pts_capital <- st_join(
  pop_pts,
  iris_capital |> select(indice_capital),
  join = st_intersects,
  left = FALSE
) |>
  filter(!is.na(indice_capital), !is.na(population), population > 0)

message("Points de population joints : ", nrow(pop_pts_capital))

# The visualization mask must keep the full IRIS footprint. IRIS without an
# ACP score are not used as source points, but they should be filled by the
# nearest scored cells before smoothing, as in the original cartography script.
nc_boundary <- iris_capital |>
  summarise(geometry = st_union(geometry), .groups = "drop") |>
  st_as_sf() |>
  st_make_valid()

noumea_boundary <- iris_capital |>
  filter(codgeo_i >= 1800, codgeo_i < 1900) |>
  summarise(geometry = st_union(geometry), .groups = "drop") |>
  st_as_sf() |>
  st_make_valid()

capital_nc <- make_capital_surface(
  pop_points = pop_pts_capital,
  mask_sf = nc_boundary,
  resolution = 500,
  kernel_size = 13,
  sigma = 5,
  n_smooth = 5,
  label = "NC"
)

capital_noumea <- make_capital_surface(
  pop_points = pop_pts_capital,
  mask_sf = noumea_boundary,
  resolution = 25,
  kernel_size = 9,
  sigma = 3,
  n_smooth = 3,
  label = "Noumea"
)

message("Exports rasters")

terra::writeRaster(
  capital_nc$cellules_habitees,
  file.path(out_dir, "capital_acp_cellules_habitees_nc.tif"),
  overwrite = TRUE
)

terra::writeRaster(
  capital_nc$visu_lisse,
  file.path(out_dir, "capital_acp_lisse_nc.tif"),
  overwrite = TRUE
)

terra::writeRaster(
  capital_noumea$cellules_habitees,
  file.path(out_dir, "capital_acp_cellules_habitees_noumea.tif"),
  overwrite = TRUE
)

terra::writeRaster(
  capital_noumea$visu_lisse,
  file.path(out_dir, "capital_acp_lisse_noumea.tif"),
  overwrite = TRUE
)

message("Termine. Sorties : ", out_dir)
