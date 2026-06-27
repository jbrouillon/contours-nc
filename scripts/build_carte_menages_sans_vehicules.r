library(dplyr)
library(sf)
library(terra)
library(here)

crs_work <- 3163

project_dir <- here::here()
data_path <- function(...) file.path(project_dir, "data", ...)

iris_path <- data_path("02_geospatial", "vecteurs", "iris_rgp_2019.geojson")
pop_path  <- data_path("02_geospatial", "rasters", "NCL_Pop_Grid_2020.tif")

out_dir <- data_path("outputs_sans_vehicules")
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

var_lissage <- "percent_menages_sans_vehicules"

make_gaussian_kernel <- function(size = 9, sigma = 3) {
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

make_smoothed_surface <- function(
    pop_points,
    mask_sf,
    variable,
    resolution = 25,
    kernel_size = 9,
    sigma = 3,
    n_smooth = 3
) {
  message("Préparation de l'emprise Nouméa")

  mask_sf <- mask_sf |>
    st_make_valid() |>
    st_transform(crs_work)

  boundary_vect <- terra::vect(mask_sf)
  template <- make_template_from_boundary(boundary_vect, resolution)

  pop_points <- pop_points |>
    st_transform(crs_work) |>
    filter(
      !is.na(.data[[variable]]),
      !is.na(population),
      population > 0
    )

  message("Rasterisation pondérée par population")

  pts_vect <- terra::vect(pop_points)
  pts_vect$var_x_pop <- pts_vect[[variable]] * pts_vect$population

  r_num <- terra::rasterize(
    pts_vect,
    template,
    field = "var_x_pop",
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
  names(r_cells) <- paste0(variable, "_cellules_habitees")
  r_cells <- mask_to_boundary(r_cells, boundary_vect)

  message("Remplissage par plus proche voisin")

  r_land <- template
  terra::values(r_land) <- 1
  r_land <- mask_to_boundary(r_land, boundary_vect)

  pts_values <- terra::as.points(r_cells, values = TRUE, na.rm = TRUE)

  r_smooth <- terra::interpNear(
    r_land,
    pts_values,
    field = names(r_cells)[1],
    radius = Inf,
    fill = NA_real_
  )

  message("Lissage gaussien")

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
  names(r_smooth) <- paste0(variable, "_lisse")

  list(
    cellules_habitees = r_cells,
    lisse = r_smooth
  )
}

message("Lecture des IRIS")

iris <- st_read(iris_path, quiet = TRUE) |>
  st_make_valid() |>
  st_transform(crs_work) |>
  mutate(
    codgeo_i = suppressWarnings(as.integer(codgeo)),
    territoire = if_else(
      codgeo_i >= 1800 & codgeo_i < 1900,
      "Noumea",
      "Reste de la Nouvelle-Caledonie"
    ),
    "{var_lissage}" := as.numeric(.data[[var_lissage]])
  )

if (!var_lissage %in% names(iris)) {
  stop("Variable absente des IRIS : ", var_lissage)
}

noumea_iris <- iris |>
  filter(codgeo_i >= 1800, codgeo_i < 1900)

noumea_boundary <- noumea_iris |>
  summarise(geometry = st_union(geometry), .groups = "drop") |>
  st_as_sf() |>
  st_make_valid()

message("Préparation des points de population")

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

message("Jointure population x IRIS Nouméa")

pop_pts_noumea <- st_join(
  pop_pts,
  noumea_iris |> select(all_of(var_lissage)),
  join = st_intersects,
  left = FALSE
) |>
  filter(
    !is.na(.data[[var_lissage]]),
    !is.na(population),
    population > 0
  )

message("Points joints : ", nrow(pop_pts_noumea))

surface_noumea <- make_smoothed_surface(
  pop_points = pop_pts_noumea,
  mask_sf = noumea_boundary,
  variable = var_lissage,
  resolution = 25,
  kernel_size = 9,
  sigma = 3,
  n_smooth = 3
)

message("Exports rasters")

terra::writeRaster(
  surface_noumea$cellules_habitees,
  file.path(out_dir, "sans_vehicules_cellules_habitees_noumea.tif"),
  overwrite = TRUE
)

terra::writeRaster(
  surface_noumea$lisse,
  file.path(out_dir, "sans_vehicules_lisse_noumea.tif"),
  overwrite = TRUE
)

message("Terminé. Sorties : ", out_dir)