suppressPackageStartupMessages({
  library(dplyr)
  library(igraph)
  library(jsonlite)
  library(sf)
  library(stringr)
  library(terra)
  library(tibble)
})

###############################################################################
# Regroupement des bureaux de vote à Nouméa — production des données
#
# Ce script reconstruit les temps d’accès à partir de la grille SPC,
# de BDROUTE-NC et des référentiels électoraux officiels, puis produit
# les fichiers légers utilisés par les cartes D3.
###############################################################################

script_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
if (length(script_arg) != 1) stop("Lancer ce fichier avec Rscript.")
script_path <- normalizePath(sub("^--file=", "", script_arg), winslash = "/")
project_dir <- normalizePath(file.path(dirname(script_path), "../.."), winslash = "/")

project_path <- function(...) file.path(project_dir, ...)

crs_proj <- 3163
walk_speed_kmh <- 5
walk_speed_m_min <- walk_speed_kmh * 1000 / 60
official_noumea_population_2025 <- 85976
route_buffer_m <- 2500
web_route_simplify_m <- 3
max_population_snap_m <- 500

spc_population_url <- paste0(
  "https://pacificdata.org/data/dataset/",
  "f3abaff7-0d7d-48f2-bd3b-265d1b1e5732/resource/",
  "65791c86-0bc3-4de3-8cdf-6cd3518ca733/download/NCL_Pop_Grid_2020.tif"
)
bdroute_url <- "https://sig-public.gouv.nc/plateforme_telechargement/BDROUTENC.zip"
provinciales_bv_url <- paste0(
  "https://www.nouvelle-caledonie.gouv.fr/contenu/telechargement/",
  "13530/112411/file/PROVINCIALES_2026_PSUD_R%C3%A9sultats_BV.pdf"
)
electoral_sectors_url <- paste0(
  "https://services6.arcgis.com/dIDU3ttIicDWLftk/arcgis/rest/services/",
  "SecteursElectoraux_gdb/FeatureServer/0/query?where=1%3D1&",
  "outFields=*&returnGeometry=true&f=geojson&outSR=4326"
)
bureaux_reference_url <- paste0(
  "https://services6.arcgis.com/dIDU3ttIicDWLftk/arcgis/rest/services/",
  "BureauVote_gdb/FeatureServer/0/query?where=1%3D1&outFields=*&",
  "returnGeometry=true&f=geojson&outSR=4326&orderByFields=num_bv"
)
municipal_centres_url <- paste0(
  "https://www.noumea.nc/noumea-dynamique/actu-agenda/",
  "second-tour-elections-municipales-22-mars-2026"
)

spc_population_path <- project_path(
  "data", "_sources_locales", "spc_population_2020",
  "NCL_Pop_Grid_2020.tif"
)
bdroute_zip <- project_path(
  "data", "_sources_locales", "bdroute", "BDROUTENC_2026-03-16.zip"
)
bdroute_gdb <- project_path(
  "data", "_sources_locales", "bdroute", "extracted", "BD_ROUTENC.gdb"
)
provinciales_bv_path <- project_path(
  "data", "elections", "data_raw", "provinciales_2026",
  "PROVINCIALES_2026_PSUD_Resultats_BV.pdf"
)
iris_path <- project_path("data", "02_geospatial", "vecteurs", "iris_rgp_2019.geojson")
resultats_path <- project_path(
  "data", "elections", "data_raw", "municipales_2026",
  "municipales_2026_resultats_par_bureau.csv"
)
electoral_sectors_path <- project_path(
  "data", "02_geospatial", "vecteurs", "secteurs_electoraux_noumea.geojson"
)
bureaux_reference_path <- project_path(
  "data", "_sources_locales", "bureaux_vote_2026",
  "bureaux_vote_noumea_2026.geojson"
)

out_raster_dir <- project_path("data", "outputs_regroupement_bureaux_vote_noumea_v2")
out_web_dir <- project_path("posts", "regroupement-bureaux-vote-noumea", "data")
dir.create(out_raster_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(out_web_dir, recursive = TRUE, showWarnings = FALSE)

download_if_missing <- function(url, destination) {
  if (file.exists(destination)) return(invisible(destination))
  dir.create(dirname(destination), recursive = TRUE, showWarnings = FALSE)
  message("Téléchargement : ", url)
  download.file(url, destination, mode = "wb", quiet = FALSE)
  invisible(destination)
}

download_if_missing(spc_population_url, spc_population_path)
download_if_missing(bdroute_url, bdroute_zip)
download_if_missing(provinciales_bv_url, provinciales_bv_path)
download_if_missing(electoral_sectors_url, electoral_sectors_path)
download_if_missing(bureaux_reference_url, bureaux_reference_path)

if (!dir.exists(bdroute_gdb)) {
  extract_dir <- dirname(bdroute_gdb)
  dir.create(extract_dir, recursive = TRUE, showWarnings = FALSE)
  unzip(bdroute_zip, exdir = extract_dir)
}

required_files <- c(
  spc_population_path, iris_path, resultats_path, provinciales_bv_path,
  electoral_sectors_path, bureaux_reference_path
)
if (!all(file.exists(required_files)) || !dir.exists(bdroute_gdb)) {
  stop("Une ou plusieurs sources sont absentes après la phase de téléchargement.")
}

normalize_code_bv <- function(x) {
  x <- suppressWarnings(as.integer(as.character(x)))
  ifelse(is.na(x), NA_character_, sprintf("%04d", x))
}

normalize_code_commune <- function(x) {
  x <- suppressWarnings(as.integer(as.character(x)))
  ifelse(is.na(x), NA_character_, sprintf("%05d", x))
}

weighted_mean <- function(x, w) {
  ok <- is.finite(x) & is.finite(w) & w > 0
  if (!any(ok)) return(NA_real_)
  sum(x[ok] * w[ok]) / sum(w[ok])
}

weighted_quantile <- function(x, w, probs) {
  ok <- is.finite(x) & is.finite(w) & w > 0
  x <- x[ok]
  w <- w[ok]
  if (!length(x)) return(rep(NA_real_, length(probs)))
  ord <- order(x)
  x <- x[ord]
  w <- w[ord]
  cumulative <- cumsum(w) / sum(w)
  vapply(probs, function(p) x[which(cumulative >= p)[1]], numeric(1))
}

weighted_share <- function(condition, w) {
  ok <- !is.na(condition) & is.finite(w) & w > 0
  if (!any(ok)) return(NA_real_)
  100 * sum(w[ok & condition]) / sum(w[ok])
}

write_csv_utf8 <- function(x, path) {
  write.csv(x, path, row.names = FALSE, na = "", fileEncoding = "UTF-8")
}

message("Préparation de l’emprise communale…")
iris_rgp <- st_read(iris_path, quiet = TRUE) |>
  st_make_valid() |>
  mutate(codgeo_i = suppressWarnings(as.integer(codgeo))) |>
  filter(codgeo_i >= 1800, codgeo_i < 1900) |>
  st_transform(crs_proj)

noumea <- iris_rgp |>
  st_union() |>
  st_make_valid() |>
  st_buffer(0)
noumea_sf <- st_sf(name = "Nouméa", geometry = noumea)
noumea_vect <- vect(noumea_sf)
noumea_wgs <- st_transform(noumea_sf, 4326)

# Les deux îlots rattachés à l’IRIS Anse Vata Ouest (1804) parasitent les
# cartes agrandies sans apporter d’information à l’échelle des quartiers.
# Comme dans l’article sur les disparités territoriales, les calculs conservent
# la géométrie source complète, tandis que les exports cartographiques ne
# gardent que la composante terrestre principale de cet IRIS.
remove_anse_vata_islets <- function(x) {
  anse_vata_index <- which(x$codgeo_i == 1804)
  if (length(anse_vata_index) != 1) {
    stop("L’IRIS Anse Vata Ouest (1804) est introuvable ou dupliqué.")
  }
  anse_vata_parts <- st_cast(
    st_geometry(x[anse_vata_index, ]),
    "POLYGON",
    warn = FALSE
  )
  anse_vata_areas <- st_area(anse_vata_parts)
  st_geometry(x)[anse_vata_index] <- st_cast(
    anse_vata_parts[which.max(anse_vata_areas)],
    "MULTIPOLYGON"
  )
  x
}

iris_rgp_map <- remove_anse_vata_islets(iris_rgp)
noumea_map_sf <- iris_rgp_map |>
  st_union() |>
  st_make_valid() |>
  st_buffer(0) |>
  st_sf(name = "Nouméa", geometry = _)

message("Préparation des bureaux et des centres…")
resultats <- read.csv(resultats_path, fileEncoding = "UTF-8-BOM") |>
  mutate(
    code_commune = normalize_code_commune(code_commune),
    code_bv = normalize_code_bv(code_bv),
    inscrits = as.numeric(inscrits),
    votants = as.numeric(votants),
    abstentions = as.numeric(abstentions),
    longitude = as.numeric(longitude),
    latitude = as.numeric(latitude)
  )

bureaux_reference <- st_read(bureaux_reference_path, quiet = TRUE) |>
  st_make_valid() |>
  mutate(
    code_bv = normalize_code_bv(num_bv),
    source_id = paste0("BV", code_bv),
    source_nom = str_squish(libelle)
  ) |>
  arrange(code_bv)
if (
  nrow(bureaux_reference) != 57 ||
  n_distinct(bureaux_reference$code_bv) != 57 ||
  anyNA(bureaux_reference$code_bv)
) {
  stop("Le référentiel géographique doit contenir les 57 bureaux de Nouméa.")
}

read_provinciales_noumea_bv <- function(path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) {
    stop(
      "Le programme pdftotext est nécessaire pour lire le tableau officiel ",
      "des provinciales 2026 par bureau."
    )
  }

  lines <- system2(
    pdftotext,
    c("-table", "-enc", "UTF-8", shQuote(path), "-"),
    stdout = TRUE,
    stderr = FALSE
  ) |>
    enc2utf8()
  lines <- lines[str_detect(lines, "^Noum")]
  pattern <- paste0(
    "^Noum\\S*\\s+(\\d+)\\s+(.+?)\\s{2,}",
    "([0-9]+(?: [0-9]{3})?)\\s+([0-9]+(?: [0-9]{3})?)\\s+",
    "([0-9]+,[0-9]+)%\\s+([0-9]+(?: [0-9]{3})?)\\s+",
    "([0-9]+,[0-9]+)%"
  )
  matches <- str_match(lines, pattern)
  if (nrow(matches) != 57 || anyNA(matches[, 1])) {
    stop("Le tableau provincial de Nouméa ne contient pas les 57 lignes attendues.")
  }

  parse_integer_pdf <- function(x) as.numeric(str_remove_all(x, "[^0-9]"))
  parse_percent_pdf <- function(x) as.numeric(str_replace(x, ",", "."))
  parsed <- tibble(
    code_bv = sprintf("%04d", as.integer(matches[, 2])),
    bureau_nom_provinciales = str_squish(matches[, 3]),
    inscrits_provinciales = parse_integer_pdf(matches[, 4]),
    votants_provinciales = parse_integer_pdf(matches[, 5]),
    participation_provinciales = parse_percent_pdf(matches[, 6]),
    abstentions_provinciales = parse_integer_pdf(matches[, 7]),
    abstention_provinciales = parse_percent_pdf(matches[, 8])
  )
  if (any(parsed$inscrits_provinciales !=
          parsed$votants_provinciales + parsed$abstentions_provinciales)) {
    stop("Incohérence arithmétique dans le tableau provincial par bureau.")
  }
  parsed
}

provinciales_noumea <- read_provinciales_noumea_bv(provinciales_bv_path)

municipales_noumea <- resultats |>
  filter(
    election == "municipales_2026", tour == 1,
    code_commune == "98818",
    !is.na(longitude), !is.na(latitude)
  ) |>
  transmute(
    code_bv,
    bureau_nom_resultats_municipales = bureau_nom,
    longitude,
    latitude,
    iris_codgeo,
    iris_libgeo,
    inscrits_municipales = inscrits,
    votants_municipales = votants,
    abstentions_municipales = abstentions,
    abstention_municipales = 100 * abstentions / inscrits
  ) |>
  left_join(
    bureaux_reference |>
      st_drop_geometry() |>
      select(code_bv, bureau_nom_habituel = source_nom),
    by = "code_bv"
  )

vote_context <- municipales_noumea |>
  left_join(provinciales_noumea, by = "code_bv") |>
  mutate(
    ecart_abstention_provinciales_municipales =
      abstention_provinciales - abstention_municipales
  )
if (nrow(vote_context) != 57 || anyNA(vote_context$abstention_provinciales)) {
  stop("Appariement incomplet des bureaux municipaux et provinciaux de Nouméa.")
}

electoral_sectors <- st_read(electoral_sectors_path, quiet = TRUE) |>
  st_make_valid() |>
  mutate(code_bv = normalize_code_bv(num_bv)) |>
  arrange(code_bv)
if (
  nrow(electoral_sectors) != 57 ||
  n_distinct(electoral_sectors$code_bv) != 57 ||
  !setequal(electoral_sectors$code_bv, vote_context$code_bv)
) {
  stop("La couche des secteurs électoraux ne correspond pas aux 57 bureaux de Nouméa.")
}

vote_sector_context <- electoral_sectors |>
  select(code_bv, bureau_secteur = bureau, site_regroupement = site, last_edited_date) |>
  left_join(
    vote_context |>
      select(
        code_bv, bureau_nom_habituel,
        inscrits_municipales, abstention_municipales,
        inscrits_provinciales, abstention_provinciales
      ),
    by = "code_bv"
  )
if (anyNA(vote_sector_context$abstention_provinciales)) {
  stop("Jointure incomplète entre secteurs électoraux et résultats par bureau.")
}

bureaux_sf <- bureaux_reference |>
  select(source_id, source_nom, code_bv, equipement, adresse, quartier) |>
  st_transform(crs_proj)

centres_8 <- tribble(
  ~source_id, ~source_nom, ~source_locale, ~longitude, ~latitude,
  "R01", "Hôtel de Ville de Nouméa", "Mairie de Nouméa", 166.439401925184, -22.271405610423,
  "R02", "Salle omnisports W.K. Wawanabu de l'Anse-Vata", "Salle omnisports de l'Anse Vata", 166.444524508051, -22.296642207313,
  "R03", "Salle Jean-Noyant", "Salle de tennis de table Jean NOYANT", 166.448871879119, -22.296558401305,
  "R04", "Collège Jean-Leques", "Collège Jean-Leques", 166.466446975023, -22.272407348121,
  "R05", "École Céline-Teyssandier-de-Laubarede", "École primaire Céline TEYSSANDIER DE LAUBARÈDE", 166.445705500987, -22.264001775133,
  "R06", "Collège François-Ollivaud", "Collège François Ollivaud", 166.464001130836, -22.260014770569,
  "R07", "Groupe scolaire Marie-Courtot / Henriette-Gervolino", "École Marie COURTOT", 166.470464378859, -22.242522007083,
  "R08", "Centre culturel Ko We Kara", "Centre Culturel Ko We Kara", 166.456104572757, -22.235553621718
)

centres_9 <- centres_8 |>
  filter(!str_detect(str_to_upper(source_nom), "KO WE KARA|KOWE KARA")) |>
  bind_rows(tribble(
    ~source_id, ~source_nom, ~source_locale, ~longitude, ~latitude,
    "R09", "Collège de Kaméré", "Collège de Kaméré", 166.434181176354, -22.232179981997,
    "R10", "Salle de boxe municipale Vincent Kafoa", "Salle de boxe municipale Vincent Kafoa", 166.463264611981, -22.232851828901
  ))

points_from_centres <- function(x) {
  st_as_sf(x, coords = c("longitude", "latitude"), crs = 4326, remove = FALSE) |>
    st_transform(crs_proj)
}
centres_8_sf <- points_from_centres(centres_8)
centres_9_sf <- points_from_centres(centres_9)

# Affectation administrative des bureaux aux lieux de vote. La liste municipale
# est publiée par la Ville. Pour les provinciales, la couche des secteurs
# électoraux contient directement le champ `site` mis à jour en juin 2026.
municipal_8_assignment <- tibble(code_bv = sprintf("%04d", 1:57)) |>
  mutate(
    assigned_centres_8_id = case_when(
      code_bv %in% sprintf("%04d", c(1, 2, 3, 18, 19, 57)) ~ "R01",
      code_bv %in% sprintf("%04d", c(4, 5, 12, 13, 14, 46, 47, 52, 53, 56)) ~ "R02",
      code_bv %in% sprintf("%04d", 6:11) ~ "R03",
      code_bv %in% sprintf("%04d", c(15, 16, 17, 20:26, 51)) ~ "R04",
      code_bv %in% sprintf("%04d", c(27, 28, 29, 54)) ~ "R05",
      code_bv %in% sprintf("%04d", c(30, 45, 49, 50)) ~ "R06",
      code_bv %in% sprintf("%04d", c(31, 32, 36:40, 55)) ~ "R07",
      code_bv %in% sprintf("%04d", c(33, 34, 35, 41:44, 48)) ~ "R08"
    )
  )

normalize_site_key <- function(x) {
  x |>
    iconv(from = "UTF-8", to = "ASCII//TRANSLIT") |>
    str_to_upper() |>
    str_replace_all("[^A-Z0-9]+", " ") |>
    str_squish()
}

provincial_9_site_lookup <- tribble(
  ~site_key, ~assigned_centres_9_id,
  "HOTEL DE VILLE", "R01",
  "SALLE OMNISPORT ANSE VATA", "R02",
  "SALLE NOYANT", "R03",
  "COLLEGE JEAN LEQUES", "R04",
  "ECOLE C T DE LAUBAREDE EX PETIT POUCET", "R05",
  "COLLEGE FRANCOIS OLLIVAUD", "R06",
  "ECOLES COURTOT GERVOLINO", "R07",
  "COLLEGE DE KAMERE", "R09",
  "SALLES VEYRET KAFOA", "R10"
)

provincial_9_assignment <- electoral_sectors |>
  st_drop_geometry() |>
  transmute(
    code_bv,
    site_regroupement = site,
    site_key = normalize_site_key(site)
  ) |>
  left_join(provincial_9_site_lookup, by = "site_key")

sector_destination_map <- tibble(code_bv = sprintf("%04d", 1:57)) |>
  mutate(assigned_bureaux_complets_id = paste0("BV", code_bv)) |>
  left_join(municipal_8_assignment, by = "code_bv") |>
  left_join(
    provincial_9_assignment |>
      select(code_bv, site_regroupement, assigned_centres_9_id),
    by = "code_bv"
  )

if (
  nrow(sector_destination_map) != 57 ||
  anyNA(sector_destination_map$assigned_centres_8_id) ||
  anyNA(sector_destination_map$assigned_centres_9_id) ||
  !setequal(sector_destination_map$assigned_centres_8_id, centres_8_sf$source_id) ||
  !setequal(sector_destination_map$assigned_centres_9_id, centres_9_sf$source_id)
) {
  stop("L'affectation des 57 secteurs aux lieux de vote est incomplète.")
}

message("Lecture de BDROUTE-NC 2026 dans l’emprise de Nouméa…")
route_filter_wkt <- st_as_text(st_geometry(st_buffer(noumea_sf, route_buffer_m))[[1]])
routes <- st_read(
  bdroute_gdb,
  layer = "Segment",
  wkt_filter = route_filter_wkt,
  quiet = TRUE
) |>
  st_zm(drop = TRUE, what = "ZM") |>
  filter(
    is.na(seg_valide_jusqua),
    !is.na(seg_noe_deb_guid), seg_noe_deb_guid != "",
    !is.na(seg_noe_fin_guid), seg_noe_fin_guid != "",
    seg_noe_deb_guid != seg_noe_fin_guid
  ) |>
  mutate(
    route_id = row_number(),
    length_m = as.numeric(st_length(shape))
  ) |>
  filter(is.finite(length_m), length_m > 0)
n_routes_context <- nrow(routes)

# Contrôle explicite du sens géométrique : le premier sommet doit correspondre
# à seg_noe_deb_guid et le dernier à seg_noe_fin_guid. La V1 reconstruisait ces
# positions et les associait dans l’ordre inverse.
nodes_check <- st_read(
  bdroute_gdb,
  layer = "Noeud",
  wkt_filter = route_filter_wkt,
  quiet = TRUE
) |>
  st_zm(drop = TRUE, what = "ZM")
node_xy <- st_coordinates(nodes_check)
node_index <- setNames(seq_len(nrow(nodes_check)), as.character(nodes_check$noe_guid))
route_endpoints <- t(vapply(st_geometry(routes), function(geometry) {
  xy <- st_coordinates(geometry)
  c(xy[1, "X"], xy[1, "Y"], xy[nrow(xy), "X"], xy[nrow(xy), "Y"])
}, numeric(4)))
deb_index <- unname(node_index[as.character(routes$seg_noe_deb_guid)])
fin_index <- unname(node_index[as.character(routes$seg_noe_fin_guid)])
matched_endpoints <- is.finite(deb_index) & is.finite(fin_index)
correct_distance <- rep(NA_real_, nrow(routes))
reversed_distance <- rep(NA_real_, nrow(routes))
correct_distance[matched_endpoints] <-
  sqrt((route_endpoints[matched_endpoints, 1] - node_xy[deb_index[matched_endpoints], "X"])^2 +
         (route_endpoints[matched_endpoints, 2] - node_xy[deb_index[matched_endpoints], "Y"])^2) +
  sqrt((route_endpoints[matched_endpoints, 3] - node_xy[fin_index[matched_endpoints], "X"])^2 +
         (route_endpoints[matched_endpoints, 4] - node_xy[fin_index[matched_endpoints], "Y"])^2)
reversed_distance[matched_endpoints] <-
  sqrt((route_endpoints[matched_endpoints, 1] - node_xy[fin_index[matched_endpoints], "X"])^2 +
         (route_endpoints[matched_endpoints, 2] - node_xy[fin_index[matched_endpoints], "Y"])^2) +
  sqrt((route_endpoints[matched_endpoints, 3] - node_xy[deb_index[matched_endpoints], "X"])^2 +
         (route_endpoints[matched_endpoints, 4] - node_xy[deb_index[matched_endpoints], "Y"])^2)
topology_orientation_share <- mean(
  correct_distance[matched_endpoints] <= reversed_distance[matched_endpoints]
)
topology_endpoint_error_p99_m <- unname(quantile(
  correct_distance[matched_endpoints] / 2,
  0.99,
  na.rm = TRUE
))
if (topology_orientation_share < 0.95) {
  stop("Le sens début/fin des géométries BDROUTE n’est pas confirmé par la couche Noeud.")
}
message(sprintf(
  "Contrôle topologique : %.1f %% des segments orientés début → fin ; erreur P99 %.3f m.",
  100 * topology_orientation_share,
  topology_endpoint_error_p99_m
))

edges <- routes |>
  st_drop_geometry() |>
  transmute(
    route_id,
    from = as.character(seg_noe_deb_guid),
    to = as.character(seg_noe_fin_guid),
    weight = length_m / walk_speed_m_min
  )

graph_all <- graph_from_data_frame(edges |> select(from, to, weight), directed = FALSE)
component_all <- components(graph_all)
main_component <- which.max(component_all$csize)
main_nodes <- names(component_all$membership)[component_all$membership == main_component]

routes <- routes |>
  filter(seg_noe_deb_guid %in% main_nodes, seg_noe_fin_guid %in% main_nodes) |>
  mutate(route_id = row_number())

edges <- routes |>
  st_drop_geometry() |>
  transmute(
    route_id,
    from = as.character(seg_noe_deb_guid),
    to = as.character(seg_noe_fin_guid),
    weight = length_m / walk_speed_m_min
  )
graph_routes <- graph_from_data_frame(edges |> select(from, to, weight), directed = FALSE)

message(sprintf(
  "Segments dans l’emprise : %s ; segments de la composante principale : %s ; nœuds : %s.",
  n_routes_context, nrow(routes), vcount(graph_routes)
))

# Convertit une géométrie de route en petits segments XY ordonnés. Cette étape
# permet de mesurer la position du point projeté le long du segment, sans
# reconstruire — et potentiellement inverser — les nœuds comme dans la V1.
prepare_route_profile <- function(geometry) {
  coords <- st_coordinates(geometry)
  coords <- coords[, intersect(c("X", "Y", "L1", "L2", "L3"), colnames(coords)), drop = FALSE]
  group_columns <- setdiff(colnames(coords), c("X", "Y"))
  groups <- if (length(group_columns)) {
    interaction(as.data.frame(coords[, group_columns, drop = FALSE]), drop = TRUE)
  } else {
    factor(rep(1, nrow(coords)))
  }

  parts <- split(seq_len(nrow(coords)), groups)
  segment_rows <- list()
  offset <- 0
  k <- 0
  for (indices in parts) {
    xy <- coords[indices, c("X", "Y"), drop = FALSE]
    if (nrow(xy) < 2) next
    dx <- diff(xy[, "X"])
    dy <- diff(xy[, "Y"])
    lengths <- sqrt(dx^2 + dy^2)
    keep <- is.finite(lengths) & lengths > 0
    if (!any(keep)) next
    starts <- head(xy, -1)[keep, , drop = FALSE]
    ends <- tail(xy, -1)[keep, , drop = FALSE]
    lengths <- lengths[keep]
    k <- k + 1
    segment_rows[[k]] <- data.frame(
      x1 = starts[, "X"], y1 = starts[, "Y"],
      x2 = ends[, "X"], y2 = ends[, "Y"],
      segment_m = lengths,
      cumulative_m = offset + c(0, head(cumsum(lengths), -1))
    )
    offset <- offset + sum(lengths)
  }
  segments <- bind_rows(segment_rows)
  if (!nrow(segments)) stop("Géométrie routière vide pendant le rattachement.")
  list(segments = segments, total_m = sum(segments$segment_m))
}

project_point_to_profile <- function(x, y, profile) {
  s <- profile$segments
  dx <- s$x2 - s$x1
  dy <- s$y2 - s$y1
  denominator <- dx^2 + dy^2
  fraction <- ((x - s$x1) * dx + (y - s$y1) * dy) / denominator
  fraction <- pmax(0, pmin(1, fraction))
  projected_x <- s$x1 + fraction * dx
  projected_y <- s$y1 + fraction * dy
  distance_sq <- (x - projected_x)^2 + (y - projected_y)^2
  nearest <- which.min(distance_sq)
  data.frame(
    snap_m = sqrt(distance_sq[nearest]),
    along_from_deb_m = s$cumulative_m[nearest] + fraction[nearest] * s$segment_m[nearest],
    route_length_m = profile$total_m
  )
}

snap_to_segments <- function(points_sf, routes_sf) {
  if (!nrow(points_sf)) return(tibble())
  nearest <- st_nearest_feature(points_sf, routes_sf)
  point_xy <- st_coordinates(points_sf)
  geometries <- st_geometry(routes_sf)
  profiles <- new.env(parent = emptyenv())

  get_profile <- function(index) {
    key <- as.character(index)
    if (!exists(key, envir = profiles, inherits = FALSE)) {
      assign(key, prepare_route_profile(geometries[[index]]), envir = profiles)
    }
    get(key, envir = profiles, inherits = FALSE)
  }

  projected <- lapply(seq_len(nrow(points_sf)), function(i) {
    project_point_to_profile(point_xy[i, "X"], point_xy[i, "Y"], get_profile(nearest[i]))
  }) |>
    bind_rows()

  route_data <- routes_sf[nearest, ] |>
    st_drop_geometry() |>
    transmute(
      route_id,
      seg_guid,
      node_deb = as.character(seg_noe_deb_guid),
      node_fin = as.character(seg_noe_fin_guid),
      seg_type,
      seg_fonction,
      seg_sens_circulation,
      seg_vitesse_max
    )

  bind_cols(route_data, projected) |>
    mutate(
      along_from_deb_m = pmax(0, pmin(route_length_m, along_from_deb_m)),
      access_deb_m = snap_m + along_from_deb_m,
      access_fin_m = snap_m + route_length_m - along_from_deb_m
    )
}

message("Préparation et recalage de la grille SPC 2020…")
pop_source <- rast(spc_population_path)
noumea_pop_crs <- st_transform(noumea_wgs, crs(pop_source))
pop_noumea <- crop(pop_source, vect(noumea_pop_crs)) |>
  mask(vect(noumea_pop_crs), touches = FALSE) |>
  project(paste0("EPSG:", crs_proj), method = "sum", res = 100) |>
  mask(noumea_vect, touches = FALSE)
pop_noumea <- ifel(pop_noumea > 0, pop_noumea, NA)
spc_noumea_total <- global(pop_noumea, "sum", na.rm = TRUE)[1, 1]
names(pop_noumea) <- "pop"

pop_pts <- as.points(pop_noumea, values = TRUE, na.rm = TRUE) |>
  st_as_sf() |>
  mutate(cell_id = row_number())

message(sprintf(
  "Cellules habitées avant contrôle du réseau : %s ; total SPC brut pour Nouméa : %.0f.",
  nrow(pop_pts), spc_noumea_total
))

message("Rattachement des cellules habitées aux segments routiers…")
pop_snap <- snap_to_segments(pop_pts, routes)
pop_data <- pop_pts |>
  mutate(
    longitude = st_coordinates(st_transform(geometry, 4326))[, "X"],
    latitude = st_coordinates(st_transform(geometry, 4326))[, "Y"]
  ) |>
  bind_cols(pop_snap)

# Quelques cellules se trouvent sur des îlots sans liaison au réseau
# routier principal. Les raccorder en ligne droite à la Grande Terre créerait
# un trajet fictif au-dessus de l’eau. Elles sont écartées avant le recalage communal.
excluded_population_cells <- sum(pop_data$snap_m > max_population_snap_m)
excluded_population <- sum(
  pop_data$pop[pop_data$snap_m > max_population_snap_m],
  na.rm = TRUE
)
pop_data <- pop_data |>
  filter(snap_m <= max_population_snap_m)

population_network_covered_total <- sum(pop_data$pop)
population_scale_factor <- official_noumea_population_2025 / population_network_covered_total
pop_data <- pop_data |>
  mutate(pop = pop * population_scale_factor)

# Chaque cellule est rattachée au secteur électoral qui la contient. Les rares
# centres de cellules situés juste hors des polygones sont associés au secteur
# le plus proche, avec une distance conservée dans l'audit.
electoral_sectors_proj <- electoral_sectors |>
  st_transform(crs_proj)
sector_hits <- st_within(pop_data, electoral_sectors_proj)
if (any(lengths(sector_hits) > 1)) {
  stop("Certaines cellules appartiennent à plusieurs secteurs électoraux.")
}
sector_index <- vapply(
  sector_hits,
  function(index) if (length(index)) index[[1]] else NA_integer_,
  integer(1)
)
sector_fallback <- which(is.na(sector_index))
sector_fallback_distance_m <- rep(0, nrow(pop_data))
if (length(sector_fallback)) {
  nearest_sector <- st_nearest_feature(
    pop_data[sector_fallback, ],
    electoral_sectors_proj
  )
  sector_index[sector_fallback] <- nearest_sector
  sector_fallback_distance_m[sector_fallback] <- as.numeric(st_distance(
    pop_data[sector_fallback, ],
    electoral_sectors_proj[nearest_sector, ],
    by_element = TRUE
  ))
}
if (anyNA(sector_index) || max(sector_fallback_distance_m) > 150) {
  stop("Le rattachement spatial des cellules aux secteurs électoraux doit être contrôlé.")
}

population_sector_assignment <- tibble(
  code_bv_affectation = electoral_sectors_proj$code_bv[sector_index],
  secteur_affectation = electoral_sectors_proj$bureau[sector_index],
  affectation_par_proximite = seq_len(nrow(pop_data)) %in% sector_fallback,
  distance_secteur_proche_m = sector_fallback_distance_m
) |>
  left_join(
    sector_destination_map,
    by = c("code_bv_affectation" = "code_bv")
  )
if (anyNA(population_sector_assignment$assigned_bureaux_complets_id)) {
  stop("Certaines cellules n'ont pas de destination électorale attribuée.")
}
pop_data <- bind_cols(pop_data, population_sector_assignment)

sector_assignment_audit <- tibble(
  n_cellules = nrow(pop_data),
  population = sum(pop_data$pop),
  n_cellules_dans_secteur = sum(!pop_data$affectation_par_proximite),
  population_dans_secteur = sum(pop_data$pop[!pop_data$affectation_par_proximite]),
  n_cellules_secteur_proche = sum(pop_data$affectation_par_proximite),
  population_secteur_proche = sum(pop_data$pop[pop_data$affectation_par_proximite]),
  distance_secteur_proche_max_m = max(pop_data$distance_secteur_proche_m)
)

pop_pts <- pop_data |>
  select(cell_id, pop)
pop_noumea <- rasterize(vect(pop_pts), pop_noumea, field = "pop", background = NA_real_)
names(pop_noumea) <- "pop"

message(sprintf(
  paste0(
    "Contrôle du réseau : %s cellules insulaires écartées (%.1f habitants SPC) ; ",
    "%s cellules retenues ; facteur de recalage RP 2025 : %.4f."
  ),
  excluded_population_cells,
  excluded_population,
  nrow(pop_data),
  population_scale_factor
))

compute_scenario <- function(source_points, scenario_id, scenario_label, target_data = pop_data) {
  message("Calcul du scénario : ", scenario_label)
  source_snap <- snap_to_segments(source_points, routes)
  source_data <- source_points |>
    bind_cols(source_snap) |>
    mutate(scenario_id = scenario_id, scenario = scenario_label)

  connectors <- bind_rows(
    source_data |> st_drop_geometry() |> transmute(node = node_deb, cost = access_deb_m / walk_speed_m_min),
    source_data |> st_drop_geometry() |> transmute(node = node_fin, cost = access_fin_m / walk_speed_m_min)
  ) |>
    group_by(node) |>
    summarise(cost = min(cost), .groups = "drop")

  source_vertex <- paste0("__source_", scenario_id, "__")
  graph_scenario <- add_vertices(graph_routes, 1, name = source_vertex)
  edge_vector <- as.vector(t(cbind(source_vertex, connectors$node)))
  graph_scenario <- add_edges(
    graph_scenario,
    edge_vector,
    attr = list(weight = connectors$cost)
  )

  vertices <- V(graph_scenario)$name
  keep <- vertices != source_vertex
  node_times <- as.numeric(distances(
    graph_scenario,
    v = source_vertex,
    to = V(graph_scenario)[keep],
    weights = E(graph_scenario)$weight
  ))
  names(node_times) <- vertices[keep]

  time_via_nodes <- pmin(
    node_times[target_data$node_deb] + target_data$access_deb_m / walk_speed_m_min,
    node_times[target_data$node_fin] + target_data$access_fin_m / walk_speed_m_min,
    na.rm = TRUE
  )

  # Cas particulier : la cellule et la destination sont projetées sur le même
  # segment. Le chemin direct entre les deux projections peut être plus court
  # que le passage par une extrémité du segment.
  direct_time <- rep(Inf, nrow(target_data))
  sources_by_route <- split(st_drop_geometry(source_data), source_data$route_id)
  shared_routes <- intersect(names(sources_by_route), as.character(target_data$route_id))
  for (route_key in shared_routes) {
    cell_index <- which(target_data$route_id == as.integer(route_key))
    source_rows <- sources_by_route[[route_key]]
    direct_time[cell_index] <- vapply(cell_index, function(i) {
      min(
        target_data$snap_m[i] +
          abs(target_data$along_from_deb_m[i] - source_rows$along_from_deb_m) +
          source_rows$snap_m
      ) / walk_speed_m_min
    }, numeric(1))
  }

  travel_time <- pmin(time_via_nodes, direct_time)
  travel_time[!is.finite(travel_time)] <- NA_real_

  audit <- source_data |>
    st_drop_geometry() |>
    select(
      scenario_id, scenario, source_id, source_nom,
      route_id, seg_guid, seg_type, seg_fonction,
      snap_m, along_from_deb_m, route_length_m,
      access_deb_m, access_fin_m
    )

  list(time = travel_time, audit = audit, snapped_sources = source_data)
}

compute_assigned_scenario <- function(
  source_points,
  assignment_ids,
  scenario_id,
  scenario_label,
  target_data = pop_data
) {
  message("Calcul du scénario avec affectation : ", scenario_label)
  if (length(assignment_ids) != nrow(target_data) || anyNA(assignment_ids)) {
    stop("Vecteur d'affectation absent ou incomplet pour ", scenario_label, ".")
  }

  source_points <- source_points |>
    filter(source_id %in% unique(assignment_ids)) |>
    arrange(match(source_id, unique(assignment_ids)))
  if (!setequal(source_points$source_id, unique(assignment_ids))) {
    stop("Une destination attribuée est absente du référentiel : ", scenario_label, ".")
  }

  source_snap <- snap_to_segments(source_points, routes)
  source_data <- source_points |>
    bind_cols(source_snap) |>
    mutate(
      scenario_id = scenario_id,
      scenario = scenario_label,
      source_vertex = paste0("__assigned_", scenario_id, "_", source_id, "__")
    )

  connectors <- bind_rows(
    source_data |>
      st_drop_geometry() |>
      transmute(source_vertex, node = node_deb, cost = access_deb_m / walk_speed_m_min),
    source_data |>
      st_drop_geometry() |>
      transmute(source_vertex, node = node_fin, cost = access_fin_m / walk_speed_m_min)
  ) |>
    group_by(source_vertex, node) |>
    summarise(cost = min(cost), .groups = "drop")

  graph_scenario <- add_vertices(
    graph_routes,
    nrow(source_data),
    name = source_data$source_vertex
  )
  graph_scenario <- add_edges(
    graph_scenario,
    as.vector(t(as.matrix(connectors[, c("source_vertex", "node")]))),
    attr = list(weight = connectors$cost)
  )

  target_nodes <- unique(c(target_data$node_deb, target_data$node_fin))
  distance_matrix <- distances(
    graph_scenario,
    v = V(graph_scenario)[source_data$source_vertex],
    to = V(graph_scenario)[target_nodes],
    weights = E(graph_scenario)$weight
  )
  source_row <- match(assignment_ids, source_data$source_id)
  node_deb_column <- match(target_data$node_deb, colnames(distance_matrix))
  node_fin_column <- match(target_data$node_fin, colnames(distance_matrix))
  if (anyNA(source_row) || anyNA(node_deb_column) || anyNA(node_fin_column)) {
    stop("Indexation du graphe incomplète pour ", scenario_label, ".")
  }

  time_via_nodes <- pmin(
    distance_matrix[cbind(source_row, node_deb_column)] +
      target_data$access_deb_m / walk_speed_m_min,
    distance_matrix[cbind(source_row, node_fin_column)] +
      target_data$access_fin_m / walk_speed_m_min,
    na.rm = TRUE
  )

  source_plain <- st_drop_geometry(source_data)[source_row, ]
  same_route <- target_data$route_id == source_plain$route_id
  direct_time <- rep(Inf, nrow(target_data))
  direct_time[same_route] <- (
    target_data$snap_m[same_route] +
      abs(
        target_data$along_from_deb_m[same_route] -
          source_plain$along_from_deb_m[same_route]
      ) +
      source_plain$snap_m[same_route]
  ) / walk_speed_m_min

  travel_time <- pmin(time_via_nodes, direct_time)
  travel_time[!is.finite(travel_time)] <- NA_real_

  assigned_population <- tibble(
    source_id = assignment_ids,
    pop = target_data$pop
  ) |>
    group_by(source_id) |>
    summarise(
      cellules_attribuees = n(),
      population_attribuee = sum(pop),
      .groups = "drop"
    )
  audit <- source_data |>
    st_drop_geometry() |>
    select(
      scenario_id, scenario, source_id, source_nom,
      route_id, seg_guid, seg_type, seg_fonction,
      snap_m, along_from_deb_m, route_length_m,
      access_deb_m, access_fin_m
    ) |>
    left_join(assigned_population, by = "source_id")

  list(time = travel_time, audit = audit, snapped_sources = source_data)
}

scenario_full <- compute_scenario(bureaux_sf, "bureaux_complets", "Bureaux de vote habituels")
scenario_8 <- compute_scenario(centres_8_sf, "centres_8", "8 centres regroupés")
scenario_9 <- compute_scenario(centres_9_sf, "centres_9", "9 centres regroupés")

scenario_full_assigned <- compute_assigned_scenario(
  bureaux_sf,
  pop_data$assigned_bureaux_complets_id,
  "bureaux_complets",
  "Bureaux habituels — secteur attribué"
)
scenario_8_assigned <- compute_assigned_scenario(
  centres_8_sf,
  pop_data$assigned_centres_8_id,
  "centres_8",
  "8 centres — secteur attribué"
)
scenario_9_assigned <- compute_assigned_scenario(
  centres_9_sf,
  pop_data$assigned_centres_9_id,
  "centres_9",
  "9 centres — secteur attribué"
)

cell_df <- pop_data |>
  st_drop_geometry() |>
  transmute(
    cell_id, longitude, latitude, pop,
    snap_route_m = snap_m,
    code_bv_affectation, secteur_affectation,
    affectation_par_proximite, distance_secteur_proche_m,
    assigned_bureaux_complets_id,
    assigned_centres_8_id,
    assigned_centres_9_id,
    bureaux_complets = scenario_full$time,
    centres_8 = scenario_8$time,
    centres_9 = scenario_9$time,
    assigned_bureaux_complets = scenario_full_assigned$time,
    assigned_centres_8 = scenario_8_assigned$time,
    assigned_centres_9 = scenario_9_assigned$time,
    delta_8_vs_full = centres_8 - bureaux_complets,
    delta_9_vs_full = centres_9 - bureaux_complets,
    delta_9_vs_8 = centres_9 - centres_8,
    assigned_delta_8_vs_full = assigned_centres_8 - assigned_bureaux_complets,
    assigned_delta_9_vs_full = assigned_centres_9 - assigned_bureaux_complets,
    assigned_delta_9_vs_8 = assigned_centres_9 - assigned_centres_8
  )

# Les indicateurs voiture et bus sont produits dans un module distinct afin de
# garder la chaîne piétonne lisible. Le module réutilise les mêmes cellules de
# population et les mêmes destinations.
source(file.path(dirname(script_path), "analysis_mobility.R"), local = environment())

if (any(!is.finite(cell_df$bureaux_complets))) {
  stop("Certaines cellules habitées ne sont pas reliées au graphe principal.")
}

scenario_vars <- tibble(
  scenario = c("Bureaux de vote habituels", "8 centres regroupés", "9 centres regroupés"),
  variable = c("bureaux_complets", "centres_8", "centres_9")
)
scenario_stats <- scenario_vars |>
  rowwise() |>
  mutate(
    population_couverte = sum(cell_df$pop[is.finite(cell_df[[variable]])]),
    moyenne = weighted_mean(cell_df[[variable]], cell_df$pop),
    mediane = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.5),
    p75 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.75),
    p90 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.9),
    part_pop_plus_15 = weighted_share(cell_df[[variable]] > 15, cell_df$pop),
    part_pop_plus_30 = weighted_share(cell_df[[variable]] > 30, cell_df$pop)
  ) |>
  ungroup()

destination_method_vars <- tribble(
  ~method, ~method_label, ~scenario, ~scenario_label, ~variable,
  "nearest", "Lieu le plus proche", "bureaux_complets", "57 bureaux habituels", "bureaux_complets",
  "nearest", "Lieu le plus proche", "centres_8", "8 centres municipaux", "centres_8",
  "nearest", "Lieu le plus proche", "centres_9", "9 centres provinciaux", "centres_9",
  "assigned", "Bureau attribué", "bureaux_complets", "57 bureaux habituels", "assigned_bureaux_complets",
  "assigned", "Bureau attribué", "centres_8", "8 centres municipaux", "assigned_centres_8",
  "assigned", "Bureau attribué", "centres_9", "9 centres provinciaux", "assigned_centres_9"
)
destination_method_stats <- destination_method_vars |>
  rowwise() |>
  mutate(
    population_couverte = sum(cell_df$pop[is.finite(cell_df[[variable]])]),
    moyenne = weighted_mean(cell_df[[variable]], cell_df$pop),
    mediane = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.5),
    p75 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.75),
    p90 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.9),
    part_pop_plus_15 = weighted_share(cell_df[[variable]] > 15, cell_df$pop),
    part_pop_plus_30 = weighted_share(cell_df[[variable]] > 30, cell_df$pop)
  ) |>
  ungroup()

delta_vars <- tibble(
  comparaison = c(
    "8 centres - bureaux habituels",
    "9 centres - bureaux habituels",
    "9 centres - 8 centres"
  ),
  variable = c("delta_8_vs_full", "delta_9_vs_full", "delta_9_vs_8")
)
delta_stats <- delta_vars |>
  rowwise() |>
  mutate(
    moyenne = weighted_mean(cell_df[[variable]], cell_df$pop),
    mediane = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.5),
    p75 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.75),
    p90 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.9),
    part_pop_plus_5 = weighted_share(cell_df[[variable]] > 5, cell_df$pop),
    part_pop_plus_10 = weighted_share(cell_df[[variable]] > 10, cell_df$pop),
    part_pop_baisse = weighted_share(cell_df[[variable]] < 0, cell_df$pop)
  ) |>
  ungroup()

message("Agrégation par IRIS 2019…")
cell_times_sf <- pop_pts |>
  select(cell_id, pop) |>
  left_join(cell_df, by = c("cell_id", "pop"))
cell_iris <- st_join(
  cell_times_sf,
  iris_rgp |>
    select(codgeo, libgeo, nb_de_menages, percent_menages_sans_vehicules, population_totale),
  join = st_within,
  left = FALSE
)

iris_stats <- cell_iris |>
  st_drop_geometry() |>
  group_by(codgeo, libgeo, nb_de_menages, percent_menages_sans_vehicules, population_totale) |>
  summarise(
    population_grille = sum(pop),
    mean_bureaux_complets = weighted_mean(bureaux_complets, pop),
    mean_centres_8 = weighted_mean(centres_8, pop),
    mean_centres_9 = weighted_mean(centres_9, pop),
    mean_assigned_bureaux_complets = weighted_mean(assigned_bureaux_complets, pop),
    mean_assigned_centres_8 = weighted_mean(assigned_centres_8, pop),
    mean_assigned_centres_9 = weighted_mean(assigned_centres_9, pop),
    mean_delta_8_vs_full = weighted_mean(delta_8_vs_full, pop),
    mean_delta_9_vs_full = weighted_mean(delta_9_vs_full, pop),
    mean_delta_9_vs_8 = weighted_mean(delta_9_vs_8, pop),
    .groups = "drop"
  ) |>
  mutate(
    menages_sans_vehicules = nb_de_menages * percent_menages_sans_vehicules / 100,
    indice_cumul = menages_sans_vehicules * pmax(mean_delta_9_vs_full, 0),
    classe_sans_vehicule = factor(
      ntile(percent_menages_sans_vehicules, 3),
      levels = 1:3,
      labels = c("part faible", "part intermédiaire", "part élevée")
    )
  )

message("Écriture des rasters analytiques…")
write_time_raster <- function(values, filename, layer_name) {
  points <- pop_pts
  points$travel_time <- values
  output <- rasterize(vect(points), pop_noumea, field = "travel_time", background = NA_real_)
  names(output) <- layer_name
  writeRaster(output, file.path(out_raster_dir, filename), overwrite = TRUE)
}
write_time_raster(
  scenario_full$time,
  "noumea_temps_pieton_bureaux_complets_min_cellules_habitees.tif",
  "temps_bureaux_complets_min"
)
write_time_raster(
  scenario_8$time,
  "noumea_temps_pieton_centres_regroupes_8_min_cellules_habitees.tif",
  "temps_centres_8_min"
)
write_time_raster(
  scenario_9$time,
  "noumea_temps_pieton_centres_regroupes_9_min_cellules_habitees.tif",
  "temps_centres_9_min"
)
write_time_raster(
  scenario_full_assigned$time,
  "noumea_temps_pieton_bureaux_attribues_min_cellules_habitees.tif",
  "temps_bureaux_attribues_min"
)
write_time_raster(
  scenario_8_assigned$time,
  "noumea_temps_pieton_centres_8_attribues_min_cellules_habitees.tif",
  "temps_centres_8_attribues_min"
)
write_time_raster(
  scenario_9_assigned$time,
  "noumea_temps_pieton_centres_9_attribues_min_cellules_habitees.tif",
  "temps_centres_9_attribues_min"
)
writeRaster(
  pop_noumea,
  file.path(out_raster_dir, "noumea_population_spc_2020_recalee_rp2025.tif"),
  overwrite = TRUE
)

message("Écriture des données web et des audits…")
write_csv_utf8(cell_df, file.path(out_web_dir, "accessibilite_cellules.csv"))
write_csv_utf8(scenario_stats, file.path(out_web_dir, "scenario_stats.csv"))
write_csv_utf8(
  destination_method_stats,
  file.path(out_web_dir, "destination_method_stats.csv")
)
write_csv_utf8(delta_stats, file.path(out_web_dir, "delta_stats.csv"))
write_csv_utf8(mobility_stats, file.path(out_web_dir, "mobility_stats.csv"))
write_csv_utf8(iris_stats, file.path(out_web_dir, "iris_stats.csv"))
write_csv_utf8(vote_context, file.path(out_web_dir, "vote_context_bureaux.csv"))

vote_context_stats <- bind_rows(
  vote_context |>
    summarise(
      scrutin = "Municipales 2026 - premier tour",
      inscrits = sum(inscrits_municipales),
      votants = sum(votants_municipales),
      abstentions = sum(abstentions_municipales),
      abstention = 100 * abstentions / inscrits
    ),
  vote_context |>
    summarise(
      scrutin = "Provinciales 2026",
      inscrits = sum(inscrits_provinciales),
      votants = sum(votants_provinciales),
      abstentions = sum(abstentions_provinciales),
      abstention = 100 * abstentions / inscrits
    )
)
write_csv_utf8(vote_context_stats, file.path(out_web_dir, "vote_context_stats.csv"))

source_audit <- bind_rows(
  scenario_full$audit,
  scenario_8$audit,
  scenario_9$audit
)
write_csv_utf8(source_audit, file.path(out_web_dir, "audit_rattachement_sources.csv"))

assigned_source_audit <- bind_rows(
  scenario_full_assigned$audit,
  scenario_8_assigned$audit,
  scenario_9_assigned$audit
)
write_csv_utf8(
  assigned_source_audit,
  file.path(out_web_dir, "audit_destinations_attribuees.csv")
)
write_csv_utf8(
  sector_assignment_audit,
  file.path(out_web_dir, "audit_affectation_secteurs.csv")
)

population_audit <- cell_df |>
  summarise(
    n_cellules = n(),
    population = sum(pop),
    snap_mediane_m = median(snap_route_m),
    snap_p90_m = quantile(snap_route_m, 0.9),
    snap_p99_m = quantile(snap_route_m, 0.99),
    snap_max_m = max(snap_route_m)
  )
write_csv_utf8(population_audit, file.path(out_web_dir, "audit_rattachement_population.csv"))

boundary_web <- noumea_map_sf |>
  st_simplify(dTolerance = web_route_simplify_m, preserveTopology = TRUE) |>
  st_transform(4326)
st_write(
  boundary_web,
  file.path(out_web_dir, "noumea_limite.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

routes_web <- routes |>
  st_crop(st_bbox(noumea_sf)) |>
  st_simplify(dTolerance = web_route_simplify_m, preserveTopology = TRUE) |>
  st_transform(4326) |>
  select(route_id)
st_write(
  routes_web,
  file.path(out_web_dir, "noumea_routes.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

source_web <- bind_rows(
  bureaux_sf |> mutate(source_group = "bureaux_complets") |> select(source_id, source_nom, source_group),
  centres_8_sf |> mutate(source_group = "centres_8") |> select(source_id, source_nom, source_group),
  centres_9_sf |> mutate(source_group = "centres_9") |> select(source_id, source_nom, source_group)
) |>
  st_transform(4326)
st_write(
  source_web,
  file.path(out_web_dir, "points_vote.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

bus_stops_web <- stops_used |>
  mutate(
    station_id = if_else(
      is.na(parent_station) | parent_station == "",
      as.character(stop_id),
      as.character(parent_station)
    )
  ) |>
  group_by(station_id, stop_name) |>
  summarise(
    stop_lon = mean(stop_lon),
    stop_lat = mean(stop_lat),
    lignes = paste(
      sort(unique(unlist(str_split(na.omit(lignes), ",\\s*")))),
      collapse = ", "
    ),
    .groups = "drop"
  ) |>
  st_as_sf(coords = c("stop_lon", "stop_lat"), crs = 4326) |>
  st_transform(crs_proj) |>
  st_filter(noumea_map_sf, .predicate = st_intersects) |>
  select(station_id, stop_name, lignes) |>
  st_transform(4326)
st_write(
  bus_stops_web,
  file.path(out_web_dir, "bus_stops.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

iris_context_web <- iris_rgp_map |>
  select(codgeo, libgeo) |>
  mutate(codgeo = as.character(codgeo)) |>
  inner_join(
    iris_stats |>
      mutate(codgeo = as.character(codgeo)) |>
      select(
        codgeo, percent_menages_sans_vehicules, nb_de_menages,
        menages_sans_vehicules, mean_delta_9_vs_full
      ),
    by = "codgeo"
  ) |>
  select(
    codgeo, libgeo, percent_menages_sans_vehicules, nb_de_menages,
    menages_sans_vehicules, mean_delta_9_vs_full
  ) |>
  st_simplify(dTolerance = 20, preserveTopology = TRUE) |>
  st_transform(4326)
st_write(
  iris_context_web,
  file.path(out_web_dir, "iris_context.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

vote_context_web <- st_as_sf(
  vote_context,
  coords = c("longitude", "latitude"),
  crs = 4326,
  remove = FALSE
)
st_write(
  vote_context_web,
  file.path(out_web_dir, "vote_context_bureaux.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

vote_sector_context_web <- vote_sector_context |>
  st_transform(crs_proj) |>
  st_simplify(dTolerance = 8, preserveTopology = TRUE) |>
  st_transform(4326)
st_write(
  vote_sector_context_web,
  file.path(out_web_dir, "vote_context_secteurs.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

metadata <- list(
  version = "2.0",
  produced_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  walking_speed_kmh = walk_speed_kmh,
  population = list(
    source = "SPC New_Caledonia_Population_Grid",
    source_year = 2020,
    release = "SPC-SDD 2021",
    resolution = "100 m",
    source_url = spc_population_url,
    spc_noumea_before_calibration = unname(spc_noumea_total),
    spc_network_covered_before_calibration = unname(population_network_covered_total),
    excluded_cells_over_500m = excluded_population_cells,
    excluded_population_over_500m = unname(excluded_population),
    official_noumea_rp2025 = official_noumea_population_2025,
    calibration_factor = unname(population_scale_factor),
    official_source_url = "https://www.insee.fr/fr/statistiques/8658726"
  ),
  routes = list(
    source = "Gouvernement de la Nouvelle-Calédonie / DITTT — BDROUTE-NC",
    data_version = "2026-03-16",
    source_url = bdroute_url,
    segments_main_component = nrow(routes),
    graph_nodes = vcount(graph_routes),
    graph_edges = ecount(graph_routes)
    ,topology_orientation_share = unname(topology_orientation_share)
    ,topology_endpoint_error_p99_m = topology_endpoint_error_p99_m
  ),
  mobility = mobility_metadata,
  destination_methods = list(
    nearest = "temps minimal vers n'importe quel lieu ouvert dans la configuration",
    assigned = paste0(
      "temps vers le bureau ou le lieu attribué au secteur électoral de la cellule"
    ),
    municipal_assignments_url = municipal_centres_url,
    provincial_assignments_url = electoral_sectors_url,
    cells_joined_within_sector = sector_assignment_audit$n_cellules_dans_secteur,
    cells_joined_to_nearest_sector = sector_assignment_audit$n_cellules_secteur_proche,
    population_joined_to_nearest_sector = sector_assignment_audit$population_secteur_proche,
    maximum_nearest_sector_distance_m = sector_assignment_audit$distance_secteur_proche_max_m
  ),
  sources = list(
    bureaux_habituels = nrow(bureaux_sf),
    bureaux_habituels_url = bureaux_reference_url,
    bureaux_habituels_reference = "Ville de Nouméa — BureauVote_gdb",
    centres_8 = nrow(centres_8_sf),
    centres_9 = nrow(centres_9_sf),
    municipales_bureaux = nrow(municipales_noumea),
    provinciales_bureaux = nrow(provinciales_noumea),
    provinciales_bureaux_url = provinciales_bv_url,
    secteurs_electoraux = nrow(vote_sector_context),
    secteurs_electoraux_url = electoral_sectors_url
  ),
  snap_population = as.list(population_audit[1, ])
)
write_json(
  metadata,
  file.path(out_web_dir, "metadata.json"),
  auto_unbox = TRUE, pretty = TRUE, digits = 10
)

message("Calcul terminé. Résultats principaux :")
print(scenario_stats)
print(destination_method_stats)
print(delta_stats)
print(population_audit)
message("Audit des destinations (plus fortes distances hors réseau) :")
print(source_audit |> arrange(desc(snap_m)) |> select(scenario, source_nom, snap_m) |> head(12))
