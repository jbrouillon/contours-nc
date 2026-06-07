library(magick)

root <- normalizePath(file.path(getwd()), winslash = "/", mustWork = TRUE)
maps_dir <- file.path(root, "data", "cartes", "municipales 2026")

animations <- list(
  list(
    output = "municipales_participation_nc_2020_2026.gif",
    frames = c(
      "municipales_2020_t1_nc_participation_comparable.png",
      "municipales_2026_t1_nc_participation_comparable.png"
    )
  ),
  list(
    output = "municipales_participation_noumea_echelle_nc_2020_2026.gif",
    frames = c(
      "municipales_2020_t1_noumea_participation_echelle_nc.png",
      "municipales_2026_t1_noumea_participation_echelle_nc.png"
    )
  ),
  list(
    output = "municipales_participation_noumea_echelle_interne_2020_2026.gif",
    frames = c(
      "municipales_2020_t1_noumea_participation_comparable.png",
      "municipales_2026_t1_noumea_participation_comparable.png"
    )
  )
)

make_animation <- function(spec) {
  input_paths <- file.path(maps_dir, spec$frames)
  missing <- input_paths[!file.exists(input_paths)]
  if (length(missing) > 0) {
    stop("Images manquantes :\n", paste(missing, collapse = "\n"))
  }

  frames <- image_read(input_paths)
  gif <- image_animate(frames, fps = 1, loop = 0, dispose = "previous")
  output_path <- file.path(maps_dir, spec$output)
  image_write(gif, output_path)
  message("GIF créé : ", output_path)
}

invisible(lapply(animations, make_animation))
