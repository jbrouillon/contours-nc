# Fond de carte du globe de l'article « Inégalités de revenus : où se situe la
# Nouvelle-Calédonie ? ».
#
# Source : Natural Earth, Admin 0 – Countries, 1:110 m, version 5.1.2
# (domaine public), conservée telle quelle dans
# data/02_geospatial/natural-earth/ (voir le README de ce dossier).
#
# Sortie : posts/inegalites-revenus-nouvelle-caledonie-monde/data/pays-monde.geojson,
# une entité par pays avec deux propriétés :
# - iso3 : code ISO 3166-1 alpha-3 tel que l'emploie la Banque mondiale
#   (ADM0_A3 quand Natural Earth n'a pas d'ISO_A3 : France, Norvège ; XKX pour
#   le Kosovo) ;
# - nom : nom français de Natural Earth (NAME_FR).
#
# Transformations :
# - la Guyane, comprise dans le contour de la France, en est détachée
#   (code GUF) : les Outre-mer sont comparés à part dans l'article, avec les
#   chiffres de l'Isee et de l'Insee ;
# - coordonnées arrondies à 0,01 degré (environ 1 km), largement sous la
#   précision du 1:110 m ;
# - les petits États insulaires absents du 1:110 m (Kiribati, Tonga,
#   Samoa…) ne sont pas ajoutés ici : le globe les figure par un point placé
#   à leur capitale (coordonnées de la Banque mondiale, voir analysis.R).
#
# À exécuter depuis la racine du dépôt, une seule fois (le fichier produit est
# versionné) :
#   Rscript posts/inegalites-revenus-nouvelle-caledonie-monde/prepare_globe.R

suppressPackageStartupMessages({
  library(sf)
  library(data.table)
})

stopifnot(file.exists("_quarto.yml"))
source_path <- file.path("data", "02_geospatial", "natural-earth", "ne_110m_admin_0_countries.geojson")
output_path <- file.path("posts", "inegalites-revenus-nouvelle-caledonie-monde", "data", "pays-monde.geojson")
if (!file.exists(source_path)) {
  stop("Fond de carte manquant : ", source_path, "\nVoir data/02_geospatial/natural-earth/README.md.")
}

sf_use_s2(FALSE)
ne <- st_read(source_path, quiet = TRUE)
stopifnot(nrow(ne) == 177, all(st_geometry_type(ne) == "MULTIPOLYGON"))

iso3 <- ifelse(ne$ISO_A3 == "-99", ne$ADM0_A3, ne$ISO_A3)
iso3[iso3 == "KOS"] <- "XKX"
pays <- st_sf(iso3 = iso3, nom = ne$NAME_FR, geometry = st_geometry(ne))

# Guyane : polygone de la France situé à l'ouest de 40° O.
france <- which(pays$iso3 == "FRA")
parties <- st_cast(st_geometry(pays[france, ]), "POLYGON")
ouest <- vapply(parties, function(p) st_bbox(p)[["xmax"]] < -40, logical(1))
stopifnot(sum(ouest) == 1, sum(!ouest) == 2)
st_geometry(pays)[france] <- st_combine(parties[!ouest])
st_geometry(pays)[france] <- st_cast(st_geometry(pays)[france], "MULTIPOLYGON")
guyane <- st_sf(iso3 = "GUF", nom = "Guyane", geometry = st_cast(st_combine(parties[ouest]), "MULTIPOLYGON"))
pays <- rbind(pays, guyane)

stopifnot(
  !anyDuplicated(pays$iso3),
  !any(pays$iso3 == "-99" & !pays$nom %in% c("Chypre du Nord", "Somaliland")),
  "NCL" %in% pays$iso3
)

if (file.exists(output_path)) invisible(file.remove(output_path))
st_write(
  pays, output_path,
  driver = "GeoJSON",
  layer_options = c("COORDINATE_PRECISION=2", "WRITE_BBOX=NO"),
  quiet = TRUE
)

# Écriture compacte, sans les membres propres à GDAL (crs, résolution).
geojson <- jsonlite::read_json(output_path, simplifyVector = FALSE)
geojson <- list(type = geojson$type, features = geojson$features)
jsonlite::write_json(geojson, output_path, auto_unbox = TRUE, digits = NA)

# Relecture : l'arrondi ne doit créer ni collection ni géométrie vide.
relu <- st_read(output_path, quiet = TRUE)
stopifnot(
  nrow(relu) == nrow(pays),
  all(st_geometry_type(relu) %in% c("POLYGON", "MULTIPOLYGON")),
  !any(st_is_empty(relu))
)
message("Écrit : ", output_path, " (", nrow(relu), " entités, ",
        round(file.size(output_path) / 1024), " Ko)")
