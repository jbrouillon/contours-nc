###############################################################################
# Compléments de mobilité : voiture et bus Tanéo
#
# Ce fichier est chargé par analysis_v2.R après le calcul piéton. Il produit
# des indicateurs comparables pour les mêmes cellules et les mêmes destinations.
###############################################################################

message("Calcul des ordres de grandeur porte-à-porte en voiture…")

car_route_types <- c("VCU", "VCS", "B", "VR", "VS", "RP")
car_access_speed_m_min <- 30 * 1000 / 60
car_effective_speed_cap_kmh <- 30
car_door_to_door_overhead_min <- 5

motor_routes <- routes |>
  filter(
    seg_type %in% car_route_types,
    is.finite(as.numeric(seg_vitesse_max)),
    as.numeric(seg_vitesse_max) > 0
  ) |>
  mutate(
    car_speed_m_min = pmin(
      as.numeric(seg_vitesse_max),
      car_effective_speed_cap_kmh
    ) * 1000 / 60
  )

# La composante routière principale est d’abord calculée sans tenir compte du
# sens de circulation ; les sens uniques sont ensuite rétablis pour les plus courts chemins.
motor_edges_weak <- motor_routes |>
  st_drop_geometry() |>
  transmute(
    from = as.character(seg_noe_deb_guid),
    to = as.character(seg_noe_fin_guid)
  )
motor_graph_weak <- graph_from_data_frame(motor_edges_weak, directed = FALSE)
motor_components <- components(motor_graph_weak)
motor_main_component <- which.max(motor_components$csize)
motor_main_nodes <- names(motor_components$membership)[
  motor_components$membership == motor_main_component
]
motor_routes <- motor_routes |>
  filter(
    seg_noe_deb_guid %in% motor_main_nodes,
    seg_noe_fin_guid %in% motor_main_nodes
  )

motor_edges <- bind_rows(
  motor_routes |>
    st_drop_geometry() |>
    filter(seg_sens_circulation %in% c("D", "SV")) |>
    transmute(
      from = as.character(seg_noe_deb_guid),
      to = as.character(seg_noe_fin_guid),
      weight = length_m / car_speed_m_min
    ),
  motor_routes |>
    st_drop_geometry() |>
    filter(seg_sens_circulation %in% c("D", "SO")) |>
    transmute(
      from = as.character(seg_noe_fin_guid),
      to = as.character(seg_noe_deb_guid),
      weight = length_m / car_speed_m_min
    )
)

car_target_snap <- snap_to_segments(pop_pts, motor_routes)

compute_car_scenario <- function(source_points, scenario_id) {
  source_snap <- source_points |>
    bind_cols(snap_to_segments(source_points, motor_routes))

  # Pour atteindre une destination située sur un segment à sens unique, seul
  # le nœud amont est un point d’entrée valide. Les voies à double sens acceptent les
  # deux extrémités.
  sink <- paste0("__car_sink_", scenario_id, "__")
  source_connectors <- bind_rows(
    source_snap |>
      st_drop_geometry() |>
      filter(seg_sens_circulation %in% c("D", "SV")) |>
      transmute(
        from = node_deb,
        to = sink,
        weight = snap_m / car_access_speed_m_min +
          along_from_deb_m /
          (pmin(as.numeric(seg_vitesse_max), car_effective_speed_cap_kmh) * 1000 / 60)
      ),
    source_snap |>
      st_drop_geometry() |>
      filter(seg_sens_circulation %in% c("D", "SO")) |>
      transmute(
        from = node_fin,
        to = sink,
        weight = snap_m / car_access_speed_m_min +
          (route_length_m - along_from_deb_m) /
          (pmin(as.numeric(seg_vitesse_max), car_effective_speed_cap_kmh) * 1000 / 60)
      )
  ) |>
    group_by(from, to) |>
    summarise(weight = min(weight), .groups = "drop")

  # Un seul calcul de Dijkstra sur le graphe inversé donne le temps de chaque nœud vers
  # le lieu de vote le plus proche.
  reverse_edges_df <- bind_rows(motor_edges, source_connectors) |>
    transmute(from_reverse = to, to_reverse = from, weight) |>
    rename(from = from_reverse, to = to_reverse)
  graph_reverse <- graph_from_data_frame(reverse_edges_df, directed = TRUE)
  vertices <- V(graph_reverse)$name
  keep <- vertices != sink
  node_to_sink <- as.numeric(distances(
    graph_reverse,
    v = sink,
    to = V(graph_reverse)[keep],
    mode = "out",
    weights = E(graph_reverse)$weight
  ))
  names(node_to_sink) <- vertices[keep]
  message(sprintf(
    "Voiture — %s : %s/%s nœuds atteignent une destination ; %s/%s rattachements reconnus.",
    scenario_id,
    sum(is.finite(node_to_sink)), length(node_to_sink),
    sum(car_target_snap$node_deb %in% names(node_to_sink)), nrow(car_target_snap)
  ))

  target_speed <- pmin(
    as.numeric(car_target_snap$seg_vitesse_max),
    car_effective_speed_cap_kmh
  ) * 1000 / 60
  via_nodes <- pmin(
    ifelse(
      car_target_snap$seg_sens_circulation %in% c("D", "SO"),
      car_target_snap$snap_m / car_access_speed_m_min +
        car_target_snap$along_from_deb_m / target_speed +
        node_to_sink[car_target_snap$node_deb],
      Inf
    ),
    ifelse(
      car_target_snap$seg_sens_circulation %in% c("D", "SV"),
      car_target_snap$snap_m / car_access_speed_m_min +
        (car_target_snap$route_length_m - car_target_snap$along_from_deb_m) /
        target_speed + node_to_sink[car_target_snap$node_fin],
      Inf
    ),
    na.rm = TRUE
  )

  direct_time <- rep(Inf, nrow(car_target_snap))
  sources_by_route <- split(
    st_drop_geometry(source_snap),
    source_snap$route_id
  )
  shared_routes <- intersect(
    names(sources_by_route),
    as.character(car_target_snap$route_id)
  )
  for (route_key in shared_routes) {
    cell_index <- which(car_target_snap$route_id == as.integer(route_key))
    source_rows <- sources_by_route[[route_key]]
    direct_time[cell_index] <- vapply(cell_index, function(i) {
      differences <- source_rows$along_from_deb_m -
        car_target_snap$along_from_deb_m[i]
      allowed <- switch(
        car_target_snap$seg_sens_circulation[i],
        D = rep(TRUE, length(differences)),
        SV = differences >= 0,
        SO = differences <= 0,
        rep(FALSE, length(differences))
      )
      if (!any(allowed)) return(Inf)
      min(
        car_target_snap$snap_m[i] / car_access_speed_m_min +
          abs(differences[allowed]) /
          (pmin(
            as.numeric(car_target_snap$seg_vitesse_max[i]),
            car_effective_speed_cap_kmh
          ) * 1000 / 60) +
          source_rows$snap_m[allowed] / car_access_speed_m_min
      )
    }, numeric(1))
  }

  result <- pmin(via_nodes, direct_time)
  result[is.finite(result)] <- result[is.finite(result)] +
    car_door_to_door_overhead_min
  result[!is.finite(result)] <- NA_real_
  result
}

compute_car_assigned_scenario <- function(
  source_points,
  assignment_ids,
  scenario_id
) {
  if (length(assignment_ids) != nrow(car_target_snap) || anyNA(assignment_ids)) {
    stop("Affectations voiture absentes ou incomplètes pour ", scenario_id, ".")
  }
  source_points <- source_points |>
    filter(source_id %in% unique(assignment_ids))
  if (!setequal(source_points$source_id, unique(assignment_ids))) {
    stop("Destination voiture attribuée absente pour ", scenario_id, ".")
  }

  source_snap <- source_points |>
    bind_cols(snap_to_segments(source_points, motor_routes))
  source_data <- source_snap |>
    mutate(sink = paste0("__car_assigned_", scenario_id, "_", source_id, "__"))

  source_connectors <- bind_rows(
    source_data |>
      st_drop_geometry() |>
      filter(seg_sens_circulation %in% c("D", "SV")) |>
      transmute(
        from = node_deb,
        to = sink,
        weight = snap_m / car_access_speed_m_min +
          along_from_deb_m /
          (pmin(as.numeric(seg_vitesse_max), car_effective_speed_cap_kmh) * 1000 / 60)
      ),
    source_data |>
      st_drop_geometry() |>
      filter(seg_sens_circulation %in% c("D", "SO")) |>
      transmute(
        from = node_fin,
        to = sink,
        weight = snap_m / car_access_speed_m_min +
          (route_length_m - along_from_deb_m) /
          (pmin(as.numeric(seg_vitesse_max), car_effective_speed_cap_kmh) * 1000 / 60)
      )
  ) |>
    group_by(from, to) |>
    summarise(weight = min(weight), .groups = "drop")

  reverse_edges_df <- bind_rows(motor_edges, source_connectors) |>
    transmute(from_reverse = to, to_reverse = from, weight) |>
    rename(from = from_reverse, to = to_reverse)
  graph_reverse <- graph_from_data_frame(reverse_edges_df, directed = TRUE)
  target_nodes <- unique(c(car_target_snap$node_deb, car_target_snap$node_fin))
  distance_matrix <- distances(
    graph_reverse,
    v = V(graph_reverse)[source_data$sink],
    to = V(graph_reverse)[target_nodes],
    mode = "out",
    weights = E(graph_reverse)$weight
  )
  source_row <- match(assignment_ids, source_data$source_id)
  node_deb_column <- match(car_target_snap$node_deb, colnames(distance_matrix))
  node_fin_column <- match(car_target_snap$node_fin, colnames(distance_matrix))
  if (anyNA(source_row) || anyNA(node_deb_column) || anyNA(node_fin_column)) {
    stop("Indexation voiture incomplète pour ", scenario_id, ".")
  }

  target_speed <- pmin(
    as.numeric(car_target_snap$seg_vitesse_max),
    car_effective_speed_cap_kmh
  ) * 1000 / 60
  via_nodes <- pmin(
    ifelse(
      car_target_snap$seg_sens_circulation %in% c("D", "SO"),
      car_target_snap$snap_m / car_access_speed_m_min +
        car_target_snap$along_from_deb_m / target_speed +
        distance_matrix[cbind(source_row, node_deb_column)],
      Inf
    ),
    ifelse(
      car_target_snap$seg_sens_circulation %in% c("D", "SV"),
      car_target_snap$snap_m / car_access_speed_m_min +
        (car_target_snap$route_length_m - car_target_snap$along_from_deb_m) /
        target_speed + distance_matrix[cbind(source_row, node_fin_column)],
      Inf
    ),
    na.rm = TRUE
  )

  source_plain <- st_drop_geometry(source_data)[source_row, ]
  differences <- source_plain$along_from_deb_m - car_target_snap$along_from_deb_m
  same_route <- car_target_snap$route_id == source_plain$route_id
  allowed <- same_route & case_when(
    car_target_snap$seg_sens_circulation == "D" ~ TRUE,
    car_target_snap$seg_sens_circulation == "SV" ~ differences >= 0,
    car_target_snap$seg_sens_circulation == "SO" ~ differences <= 0,
    .default = FALSE
  )
  direct_time <- rep(Inf, nrow(car_target_snap))
  direct_time[allowed] <-
    car_target_snap$snap_m[allowed] / car_access_speed_m_min +
    abs(differences[allowed]) / target_speed[allowed] +
    source_plain$snap_m[allowed] / car_access_speed_m_min

  result <- pmin(via_nodes, direct_time)
  result[is.finite(result)] <- result[is.finite(result)] +
    car_door_to_door_overhead_min
  result[!is.finite(result)] <- NA_real_
  message(sprintf(
    "Voiture attribuée — %s : %.1f %% de la population couverte.",
    scenario_id,
    100 * sum(pop_data$pop[is.finite(result)]) / sum(pop_data$pop)
  ))
  result
}

car_motorized_nearest_full <- compute_car_scenario(bureaux_sf, "bureaux_complets")
car_motorized_nearest_8 <- compute_car_scenario(centres_8_sf, "centres_8")
car_motorized_nearest_9 <- compute_car_scenario(centres_9_sf, "centres_9")
car_motorized_assigned_full <- compute_car_assigned_scenario(
  bureaux_sf, pop_data$assigned_bureaux_complets_id, "bureaux_complets"
)
car_motorized_assigned_8 <- compute_car_assigned_scenario(
  centres_8_sf, pop_data$assigned_centres_8_id, "centres_8"
)
car_motorized_assigned_9 <- compute_car_assigned_scenario(
  centres_9_sf, pop_data$assigned_centres_9_id, "centres_9"
)

# À très courte distance, prendre la voiture n'est pas un choix réaliste : le
# forfait de cinq minutes écraserait artificiellement les valeurs autour des
# lieux de vote. Les cartes « avec une voiture » retiennent donc le plus court
# entre la marche directe et le trajet automobile porte-à-porte.
best_available_time <- function(walk_time, alternative_time) {
  result <- walk_time
  use_alternative <- is.finite(alternative_time) & alternative_time < walk_time
  result[use_alternative] <- alternative_time[use_alternative]
  result
}

car_nearest_full <- best_available_time(scenario_full$time, car_motorized_nearest_full)
car_nearest_8 <- best_available_time(scenario_8$time, car_motorized_nearest_8)
car_nearest_9 <- best_available_time(scenario_9$time, car_motorized_nearest_9)
car_assigned_full <- best_available_time(
  scenario_full_assigned$time, car_motorized_assigned_full
)
car_assigned_8 <- best_available_time(
  scenario_8_assigned$time, car_motorized_assigned_8
)
car_assigned_9 <- best_available_time(
  scenario_9_assigned$time, car_motorized_assigned_9
)

message("Reconstitution des temps en bus Tanéo…")

taneo_gtfs_url <- "https://api.taneo.nc/v1/gtfs/download"
taneo_gtfs_zip <- project_path(
  "data", "_sources_locales", "taneo", "taneo-gtfs-downloaded-2026-09-06.zip"
)
taneo_gtfs_dir <- project_path(
  "data", "_sources_locales", "taneo", "gtfs-2026-09-06"
)
if (!file.exists(taneo_gtfs_zip)) {
  download_if_missing(taneo_gtfs_url, taneo_gtfs_zip)
}
if (!dir.exists(taneo_gtfs_dir)) {
  dir.create(taneo_gtfs_dir, recursive = TRUE, showWarnings = FALSE)
  unzip(taneo_gtfs_zip, exdir = taneo_gtfs_dir)
}

gtfs_read <- function(name) {
  data.table::fread(
    file.path(taneo_gtfs_dir, name),
    encoding = "UTF-8",
    data.table = FALSE,
    showProgress = FALSE
  )
}
hms_seconds <- function(x) {
  parts <- strsplit(as.character(x), ":", fixed = TRUE)
  vapply(parts, function(value) {
    value <- as.numeric(value)
    value[1] * 3600 + value[2] * 60 + value[3]
  }, numeric(1))
}

gtfs_stops <- gtfs_read("stops.txt")
gtfs_trips <- gtfs_read("trips.txt")
gtfs_stop_times <- gtfs_read("stop_times.txt")
gtfs_calendar_dates <- gtfs_read("calendar_dates.txt")
gtfs_routes <- gtfs_read("routes.txt")

# Pour le 28 juin, le SMTU a annoncé une circulation selon l’offre du samedi,
# de 6 h à 18 h. L’archive exacte de ce dimanche n’étant pas disponible,
# le calcul applique le premier samedi actif disponible dans le flux postérieur
# à la réorganisation du 22 juin.
active_calendar_dates <- as.Date(
  as.character(gtfs_calendar_dates$date), format = "%Y%m%d"
)
saturday_candidates <- active_calendar_dates[
  gtfs_calendar_dates$exception_type == 1 &
    active_calendar_dates >= as.Date("2026-06-22") &
    as.POSIXlt(active_calendar_dates)$wday == 6
]
if (!length(saturday_candidates)) {
  stop("Le GTFS Tanéo ne contient aucun samedi actif après le 22 juin 2026.")
}
representative_saturday_date <- min(saturday_candidates)
representative_saturday <- as.integer(format(representative_saturday_date, "%Y%m%d"))
saturday_services <- gtfs_calendar_dates |>
  filter(date == representative_saturday, exception_type == 1) |>
  pull(service_id)
active_trips <- gtfs_trips |>
  filter(service_id %in% saturday_services) |>
  distinct(trip_id, .keep_all = TRUE)
active_stop_times <- gtfs_stop_times |>
  inner_join(active_trips |> select(trip_id), by = "trip_id") |>
  mutate(
    stop_sequence = as.numeric(stop_sequence),
    arrival_sec = hms_seconds(arrival_time),
    departure_sec = hms_seconds(departure_time)
  ) |>
  arrange(trip_id, stop_sequence)

stop_lines <- active_stop_times |>
  inner_join(
    active_trips |> select(trip_id, route_id),
    by = "trip_id"
  ) |>
  inner_join(
    gtfs_routes |> select(route_id, route_short_name),
    by = "route_id"
  ) |>
  group_by(stop_id) |>
  summarise(
    lignes = paste(sort(unique(route_short_name)), collapse = ", "),
    .groups = "drop"
  )

connections <- active_stop_times |>
  group_by(trip_id) |>
  transmute(
    trip_id,
    from_stop = stop_id,
    to_stop = lead(stop_id),
    departure_sec,
    arrival_sec = lead(arrival_sec)
  ) |>
  ungroup() |>
  filter(
    !is.na(to_stop),
    departure_sec >= 6 * 3600,
    departure_sec <= 18 * 3600,
    is.finite(arrival_sec),
    arrival_sec >= departure_sec
  ) |>
  arrange(departure_sec, arrival_sec)

used_stop_ids <- sort(unique(c(connections$from_stop, connections$to_stop)))
stops_used <- gtfs_stops |>
  filter(stop_id %in% used_stop_ids) |>
  left_join(stop_lines, by = "stop_id") |>
  mutate(stop_index = match(stop_id, used_stop_ids) - 1L) |>
  arrange(stop_index)
stop_lookup <- setNames(stops_used$stop_index, stops_used$stop_id)
trip_ids <- unique(connections$trip_id)
trip_lookup <- setNames(seq_along(trip_ids) - 1L, trip_ids)
connections <- connections |>
  transmute(
    from = unname(stop_lookup[from_stop]),
    to = unname(stop_lookup[to_stop]),
    departure_sec,
    arrival_sec,
    trip = unname(trip_lookup[trip_id])
  )

stops_sf <- st_as_sf(
  stops_used,
  coords = c("stop_lon", "stop_lat"),
  crs = 4326,
  remove = FALSE
) |>
  st_transform(crs_proj)

bus_walk_speed_m_sec <- 4.5 * 1000 / 3600
bus_walk_distance_factor <- 1.2
bus_access_limit_m <- 1600
bus_egress_limit_m <- 2200
bus_transfer_limit_m <- 140
bus_transfer_penalty_sec <- 30
bus_departures_sec <- c(8, 10, 12, 14, 16) * 3600

transfer_neighbours <- st_is_within_distance(
  stops_sf,
  stops_sf,
  dist = bus_transfer_limit_m
)
stop_xy <- st_coordinates(stops_sf)
foot_to <- vector("list", nrow(stops_sf))
foot_time <- vector("list", nrow(stops_sf))
for (i in seq_len(nrow(stops_sf))) {
  neighbours <- setdiff(transfer_neighbours[[i]], i)
  foot_to[[i]] <- as.integer(neighbours - 1L)
  if (length(neighbours)) {
    distances_m <- sqrt(
      (stop_xy[neighbours, "X"] - stop_xy[i, "X"])^2 +
        (stop_xy[neighbours, "Y"] - stop_xy[i, "Y"])^2
    )
    foot_time[[i]] <- bus_transfer_penalty_sec +
      bus_walk_distance_factor * distances_m / bus_walk_speed_m_sec
  } else {
    foot_time[[i]] <- numeric()
  }
}

distance_cells_stops <- st_distance(pop_pts, stops_sf)
distance_cells_stops <- matrix(
  as.numeric(distance_cells_stops),
  nrow = nrow(pop_pts),
  ncol = nrow(stops_sf)
)
access_count <- 6L
access_stop <- matrix(-1L, nrow = nrow(pop_pts), ncol = access_count)
access_time <- matrix(Inf, nrow = nrow(pop_pts), ncol = access_count)
for (i in seq_len(nrow(pop_pts))) {
  candidates <- head(order(distance_cells_stops[i, ]), access_count)
  candidates <- candidates[distance_cells_stops[i, candidates] <= bus_access_limit_m]
  if (!length(candidates)) next
  access_stop[i, seq_along(candidates)] <- candidates - 1L
  access_time[i, seq_along(candidates)] <-
    bus_walk_distance_factor * distance_cells_stops[i, candidates] /
    bus_walk_speed_m_sec
}

bus_egress_matrix <- function(source_points) {
  distances <- st_distance(stops_sf, source_points)
  distances <- matrix(
    as.numeric(distances),
    nrow = nrow(stops_sf),
    ncol = nrow(source_points)
  )
  time <- bus_walk_distance_factor * distances / bus_walk_speed_m_sec
  time[distances > bus_egress_limit_m] <- Inf
  colnames(time) <- source_points$source_id
  time
}
bus_scenario_keys <- c("bureaux_complets", "centres_8", "centres_9")
bus_source_sets <- list(bureaux_sf, centres_8_sf, centres_9_sf)
names(bus_source_sets) <- bus_scenario_keys
bus_assignment_sets <- list(
  bureaux_complets = pop_data$assigned_bureaux_complets_id,
  centres_8 = pop_data$assigned_centres_8_id,
  centres_9 = pop_data$assigned_centres_9_id
)
bus_egress_matrices <- lapply(bus_source_sets, bus_egress_matrix)

# Graphe horaire à deux états : avant et après le premier trajet en bus. Cette distinction
# empêche qu’un simple trajet à pied jusqu’à un arrêt soit compté comme un
# trajet en bus. Les nœuds sont les départs programmés ; toutes les arêtes
# avancent dans le temps.
active_events <- active_stop_times |>
  filter(departure_sec >= 6 * 3600, departure_sec <= 18 * 3600) |>
  mutate(
    stop = unname(stop_lookup[stop_id]),
    trip = unname(trip_lookup[trip_id]),
    event = row_number()
  ) |>
  filter(!is.na(stop), !is.na(trip))

ride_edges <- active_events |>
  group_by(trip_id) |>
  arrange(stop_sequence, .by_group = TRUE) |>
  transmute(
    from_event = event,
    to_event = lead(event),
    weight = lead(departure_sec) - departure_sec
  ) |>
  ungroup() |>
  filter(!is.na(to_event), weight >= 0)

wait_edges <- active_events |>
  group_by(stop) |>
  arrange(departure_sec, .by_group = TRUE) |>
  transmute(
    from_event = event,
    to_event = lead(event),
    weight = lead(departure_sec) - departure_sec
  ) |>
  ungroup() |>
  filter(!is.na(to_event), weight >= 0)

events_by_stop <- split(active_events, active_events$stop)
transfer_rows <- vector("list", nrow(active_events))
for (i in seq_len(nrow(active_events))) {
  from_stop <- active_events$stop[i] + 1L
  neighbours <- foot_to[[from_stop]]
  if (!length(neighbours)) next
  durations <- foot_time[[from_stop]]
  candidates <- lapply(seq_along(neighbours), function(k) {
    events <- events_by_stop[[as.character(neighbours[k])]]
    if (is.null(events) || !nrow(events)) return(NULL)
    ready <- active_events$departure_sec[i] + durations[k]
    next_index <- which(events$departure_sec >= ready)[1]
    if (is.na(next_index)) return(NULL)
    tibble(
      from_event = active_events$event[i],
      to_event = events$event[next_index],
      weight = events$departure_sec[next_index] - active_events$departure_sec[i]
    )
  })
  transfer_rows[[i]] <- bind_rows(candidates)
}
transfer_edges <- bind_rows(transfer_rows)

state_name <- function(layer, event) paste0("b", layer, "_", event)
same_layer_edges <- bind_rows(wait_edges, transfer_edges)
bus_graph_edges <- bind_rows(
  same_layer_edges |>
    transmute(
      from = state_name(0, from_event),
      to = state_name(0, to_event),
      weight
    ),
  same_layer_edges |>
    transmute(
      from = state_name(1, from_event),
      to = state_name(1, to_event),
      weight
    ),
  ride_edges |>
    transmute(
      from = state_name(0, from_event),
      to = state_name(1, to_event),
      weight
    ),
  ride_edges |>
    transmute(
      from = state_name(1, from_event),
      to = state_name(1, to_event),
      weight
    )
)

# Chaque départ de bus peut déboucher sur la marche directe. Pour éviter de
# dupliquer le graphe horaire pour chaque destination, tous les événements d'un
# même arrêt rejoignent un nœud de sortie commun ; les sorties sont ensuite
# reliées aux destinations `nearest` et `assigned`.
bus_exit_name <- function(stop) paste0("__bus_exit_", stop, "__")
bus_exit_edges <- active_events |>
  distinct(event, stop) |>
  transmute(
    from = state_name(1, event),
    to = bus_exit_name(stop),
    weight = 0
  )

bus_sink_lookup <- list(nearest = character(), assigned = list())
bus_sink_edges_parts <- list()
part_index <- 0L
for (scenario_key in bus_scenario_keys) {
  egress <- bus_egress_matrices[[scenario_key]]
  nearest_sink <- paste0("__bus_nearest_", scenario_key, "__")
  bus_sink_lookup$nearest[scenario_key] <- nearest_sink
  nearest_egress <- apply(egress, 1, min)
  part_index <- part_index + 1L
  bus_sink_edges_parts[[part_index]] <- tibble(
    from = bus_exit_name(seq_len(nrow(stops_sf)) - 1L),
    to = nearest_sink,
    weight = nearest_egress
  ) |>
    filter(is.finite(weight))

  assigned_sinks <- setNames(
    paste0("__bus_assigned_", scenario_key, "_", colnames(egress), "__"),
    colnames(egress)
  )
  bus_sink_lookup$assigned[[scenario_key]] <- assigned_sinks
  assigned_parts <- lapply(seq_len(ncol(egress)), function(source_i) {
    tibble(
      from = bus_exit_name(seq_len(nrow(stops_sf)) - 1L),
      to = assigned_sinks[source_i],
      weight = egress[, source_i]
    ) |>
      filter(is.finite(weight))
  })
  part_index <- part_index + 1L
  bus_sink_edges_parts[[part_index]] <- bind_rows(assigned_parts)
}
bus_sink_edges <- bind_rows(bus_sink_edges_parts)
bus_sinks <- unique(bus_sink_edges$to)
bus_graph_reverse <- bind_rows(bus_graph_edges, bus_exit_edges, bus_sink_edges) |>
  transmute(from_reverse = to, to_reverse = from, weight) |>
  rename(from = from_reverse, to = to_reverse) |>
  graph_from_data_frame(directed = TRUE)
bus_state_zero <- intersect(
  unique(state_name(0, active_events$event)),
  V(bus_graph_reverse)$name
)
bus_distance_matrix <- distances(
  bus_graph_reverse,
  v = V(bus_graph_reverse)[bus_sinks],
  to = V(bus_graph_reverse)[bus_state_zero],
  mode = "out",
  weights = E(bus_graph_reverse)$weight
)
message(sprintf(
  "Tanéo : %s destinations (nearest + assigned) calculées sur %s nœuds horaires.",
  nrow(bus_distance_matrix), ncol(bus_distance_matrix)
))

event_lookup_by_stop <- lapply(events_by_stop, function(events) {
  events[order(events$departure_sec), c("event", "departure_sec")]
})
bus_transit_cube <- array(
  NA_real_,
  dim = c(
    nrow(pop_pts), length(bus_departures_sec), length(bus_scenario_keys), 2L
  ),
  dimnames = list(
    NULL,
    sprintf("h%02d", bus_departures_sec / 3600),
    bus_scenario_keys,
    c("nearest", "assigned")
  )
)
bus_distance_columns <- setNames(seq_len(ncol(bus_distance_matrix)), colnames(bus_distance_matrix))
bus_distance_rows <- setNames(seq_len(nrow(bus_distance_matrix)), rownames(bus_distance_matrix))

for (origin in seq_len(nrow(pop_pts))) {
  candidates <- which(access_stop[origin, ] >= 0)
  if (!length(candidates)) next
  for (start_i in seq_along(bus_departures_sec)) {
    start <- bus_departures_sec[start_i]
    access_events <- lapply(candidates, function(k) {
      stop <- access_stop[origin, k]
      events <- event_lookup_by_stop[[as.character(stop)]]
      if (is.null(events) || !nrow(events)) return(NULL)
      ready <- start + access_time[origin, k]
      next_index <- which(events$departure_sec >= ready)[1]
      if (is.na(next_index)) return(NULL)
      tibble(
        event = events$event[next_index],
        departure = events$departure_sec[next_index]
      )
    }) |>
      bind_rows()
    if (!nrow(access_events)) next
    state_columns <- unname(bus_distance_columns[state_name(0, access_events$event)])
    keep_access <- is.finite(state_columns)
    access_events <- access_events[keep_access, ]
    state_columns <- state_columns[keep_access]
    if (!nrow(access_events)) next
    for (scenario_key in bus_scenario_keys) {
      assigned_id <- bus_assignment_sets[[scenario_key]][origin]
      sinks <- c(
        nearest = bus_sink_lookup$nearest[[scenario_key]],
        assigned = bus_sink_lookup$assigned[[scenario_key]][[assigned_id]]
      )
      for (method in names(sinks)) {
        sink_row <- bus_distance_rows[[sinks[[method]]]]
        remaining <- bus_distance_matrix[sink_row, state_columns]
        candidates_time <- access_events$departure - start + remaining
        best <- suppressWarnings(min(candidates_time, na.rm = TRUE))
        if (is.finite(best)) {
          bus_transit_cube[origin, start_i, scenario_key, method] <- best / 60
        }
      }
    }
  }
}

bus_walk_times <- list(
  nearest = cbind(
    bureaux_complets = scenario_full$time,
    centres_8 = scenario_8$time,
    centres_9 = scenario_9$time
  ),
  assigned = cbind(
    bureaux_complets = scenario_full_assigned$time,
    centres_8 = scenario_8_assigned$time,
    centres_9 = scenario_9_assigned$time
  )
)
bus_available_cube <- bus_transit_cube
for (method in c("nearest", "assigned")) {
  for (scenario_key in bus_scenario_keys) {
    for (start_i in seq_along(bus_departures_sec)) {
      bus_available_cube[, start_i, scenario_key, method] <- best_available_time(
        bus_walk_times[[method]][, scenario_key],
        bus_transit_cube[, start_i, scenario_key, method]
      )
    }
  }
}

finite_summary <- function(x, fun) {
  x <- x[is.finite(x)]
  if (!length(x)) return(NA_real_)
  fun(x)
}
bus_available_min <- apply(bus_available_cube, c(1, 3, 4), min)
bus_available_median <- apply(bus_available_cube, c(1, 3, 4), median)
bus_available_max <- apply(bus_available_cube, c(1, 3, 4), max)
bus_transit_min <- apply(
  bus_transit_cube, c(1, 3, 4), finite_summary, fun = min
)
bus_transit_median <- apply(
  bus_transit_cube, c(1, 3, 4), finite_summary, fun = median
)
bus_transit_max <- apply(
  bus_transit_cube, c(1, 3, 4), finite_summary, fun = max
)
nearest_bus_stop_index <- max.col(-distance_cells_stops, ties.method = "first")
nearest_bus_stop_distance_m <- distance_cells_stops[
  cbind(seq_len(nrow(distance_cells_stops)), nearest_bus_stop_index)
]

cell_df <- cell_df |>
  mutate(
    car_motorized_nearest_bureaux_complets = car_motorized_nearest_full,
    car_motorized_nearest_centres_8 = car_motorized_nearest_8,
    car_motorized_nearest_centres_9 = car_motorized_nearest_9,
    car_motorized_assigned_bureaux_complets = car_motorized_assigned_full,
    car_motorized_assigned_centres_8 = car_motorized_assigned_8,
    car_motorized_assigned_centres_9 = car_motorized_assigned_9,
    car_nearest_bureaux_complets = car_nearest_full,
    car_nearest_centres_8 = car_nearest_8,
    car_nearest_centres_9 = car_nearest_9,
    car_assigned_bureaux_complets = car_assigned_full,
    car_assigned_centres_8 = car_assigned_8,
    car_assigned_centres_9 = car_assigned_9,
    # Alias historiques : ils restent explicitement équivalents à `nearest`.
    car_motorized_bureaux_complets = car_motorized_nearest_full,
    car_motorized_centres_8 = car_motorized_nearest_8,
    car_motorized_centres_9 = car_motorized_nearest_9,
    car_bureaux_complets = car_nearest_full,
    car_centres_8 = car_nearest_8,
    car_centres_9 = car_nearest_9,
    bus_transit_nearest_bureaux_complets_min = bus_transit_min[, "bureaux_complets", "nearest"],
    bus_transit_nearest_bureaux_complets_median = bus_transit_median[, "bureaux_complets", "nearest"],
    bus_transit_nearest_bureaux_complets_max = bus_transit_max[, "bureaux_complets", "nearest"],
    bus_transit_nearest_centres_8_min = bus_transit_min[, "centres_8", "nearest"],
    bus_transit_nearest_centres_8_median = bus_transit_median[, "centres_8", "nearest"],
    bus_transit_nearest_centres_8_max = bus_transit_max[, "centres_8", "nearest"],
    bus_transit_nearest_centres_9_min = bus_transit_min[, "centres_9", "nearest"],
    bus_transit_nearest_centres_9_median = bus_transit_median[, "centres_9", "nearest"],
    bus_transit_nearest_centres_9_max = bus_transit_max[, "centres_9", "nearest"],
    bus_transit_assigned_bureaux_complets_min = bus_transit_min[, "bureaux_complets", "assigned"],
    bus_transit_assigned_bureaux_complets_median = bus_transit_median[, "bureaux_complets", "assigned"],
    bus_transit_assigned_bureaux_complets_max = bus_transit_max[, "bureaux_complets", "assigned"],
    bus_transit_assigned_centres_8_min = bus_transit_min[, "centres_8", "assigned"],
    bus_transit_assigned_centres_8_median = bus_transit_median[, "centres_8", "assigned"],
    bus_transit_assigned_centres_8_max = bus_transit_max[, "centres_8", "assigned"],
    bus_transit_assigned_centres_9_min = bus_transit_min[, "centres_9", "assigned"],
    bus_transit_assigned_centres_9_median = bus_transit_median[, "centres_9", "assigned"],
    bus_transit_assigned_centres_9_max = bus_transit_max[, "centres_9", "assigned"],
    bus_nearest_bureaux_complets_min = bus_available_min[, "bureaux_complets", "nearest"],
    bus_nearest_bureaux_complets_median = bus_available_median[, "bureaux_complets", "nearest"],
    bus_nearest_bureaux_complets_max = bus_available_max[, "bureaux_complets", "nearest"],
    bus_nearest_centres_8_min = bus_available_min[, "centres_8", "nearest"],
    bus_nearest_centres_8_median = bus_available_median[, "centres_8", "nearest"],
    bus_nearest_centres_8_max = bus_available_max[, "centres_8", "nearest"],
    bus_nearest_centres_9_min = bus_available_min[, "centres_9", "nearest"],
    bus_nearest_centres_9_median = bus_available_median[, "centres_9", "nearest"],
    bus_nearest_centres_9_max = bus_available_max[, "centres_9", "nearest"],
    bus_assigned_bureaux_complets_min = bus_available_min[, "bureaux_complets", "assigned"],
    bus_assigned_bureaux_complets_median = bus_available_median[, "bureaux_complets", "assigned"],
    bus_assigned_bureaux_complets_max = bus_available_max[, "bureaux_complets", "assigned"],
    bus_assigned_centres_8_min = bus_available_min[, "centres_8", "assigned"],
    bus_assigned_centres_8_median = bus_available_median[, "centres_8", "assigned"],
    bus_assigned_centres_8_max = bus_available_max[, "centres_8", "assigned"],
    bus_assigned_centres_9_min = bus_available_min[, "centres_9", "assigned"],
    bus_assigned_centres_9_median = bus_available_median[, "centres_9", "assigned"],
    bus_assigned_centres_9_max = bus_available_max[, "centres_9", "assigned"],
    # La médiane des cinq horaires est l'indicateur principal.
    bus_nearest_bureaux_complets = bus_available_median[, "bureaux_complets", "nearest"],
    bus_nearest_centres_8 = bus_available_median[, "centres_8", "nearest"],
    bus_nearest_centres_9 = bus_available_median[, "centres_9", "nearest"],
    bus_assigned_bureaux_complets = bus_available_median[, "bureaux_complets", "assigned"],
    bus_assigned_centres_8 = bus_available_median[, "centres_8", "assigned"],
    bus_assigned_centres_9 = bus_available_median[, "centres_9", "assigned"],
    # Alias historiques, désormais documentés comme `nearest` et médiane.
    bus_transit_bureaux_complets = bus_transit_median[, "bureaux_complets", "nearest"],
    bus_transit_centres_8 = bus_transit_median[, "centres_8", "nearest"],
    bus_transit_centres_9 = bus_transit_median[, "centres_9", "nearest"],
    bus_bureaux_complets = bus_available_median[, "bureaux_complets", "nearest"],
    bus_centres_8 = bus_available_median[, "centres_8", "nearest"],
    bus_centres_9 = bus_available_median[, "centres_9", "nearest"],
    bus_arret_proche = stops_used$stop_name[nearest_bus_stop_index],
    bus_marche_arret_min = bus_walk_distance_factor *
      nearest_bus_stop_distance_m / bus_walk_speed_m_sec / 60
  )

for (method in c("nearest", "assigned")) {
  for (scenario_key in bus_scenario_keys) {
    for (start_i in seq_along(bus_departures_sec)) {
      hour_key <- sprintf("h%02d", bus_departures_sec[start_i] / 3600)
      cell_df[[paste("bus", method, scenario_key, hour_key, sep = "_")]] <-
        bus_available_cube[, start_i, scenario_key, method]
    }
  }
}

mobility_field <- function(mode, method, scenario) {
  switch(
    mode,
    walk = if (method == "assigned") paste0("assigned_", scenario) else scenario,
    car = paste("car", method, scenario, sep = "_"),
    bus = paste("bus", method, scenario, sep = "_"),
    stop("Mode inconnu : ", mode)
  )
}
mobility_variables <- bind_rows(lapply(c("walk", "car", "bus"), function(mode) {
  mode_key <- mode
  bind_rows(lapply(c("nearest", "assigned"), function(method) {
    method_key <- method
    tibble(
      mode = mode_key,
      method = method_key,
      method_label = ifelse(
        method_key == "assigned", "Bureau attribué", "Bureau de vote le plus proche"
      ),
      scenario = bus_scenario_keys,
      variable = vapply(
        bus_scenario_keys,
        function(scenario) mobility_field(mode_key, method_key, scenario),
        character(1)
      ),
      indicator = case_when(
        mode_key == "walk" ~ "marche à 5 km/h",
        mode_key == "car" ~ "minimum marche ou voiture, forfait 5 min",
        TRUE ~ "médiane des cinq valeurs marche ou Tanéo"
      )
    )
  }))
}))
mobility_stats <- mobility_variables |>
  rowwise() |>
  mutate(
    population_couverte = sum(cell_df$pop[is.finite(cell_df[[variable]])]),
    part_population_couverte = 100 * population_couverte / sum(cell_df$pop),
    moyenne = weighted_mean(cell_df[[variable]], cell_df$pop),
    mediane = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.5),
    p90 = weighted_quantile(cell_df[[variable]], cell_df$pop, 0.9),
    part_pop_plus_15 = weighted_share(cell_df[[variable]] > 15, cell_df$pop),
    part_pop_plus_30 = weighted_share(cell_df[[variable]] > 30, cell_df$pop)
  ) |>
  ungroup()

sensitivity_variants <- tribble(
  ~mode, ~variant, ~variant_label, ~is_main,
  "walk", "walk_5", "Marche à 5 km/h", TRUE,
  "walk", "walk_4", "Marche à 4 km/h", FALSE,
  "car", "car_5", "Voiture · forfait 5 min", TRUE,
  "car", "car_10", "Voiture · forfait 10 min", FALSE,
  "bus", "bus_median", "Tanéo · médiane des 5 départs", TRUE,
  "bus", "bus_best", "Tanéo · meilleur des 5 départs", FALSE
)
sensitivity_time <- function(mode, method, scenario, variant) {
  walk_field <- mobility_field("walk", method, scenario)
  walk_time <- cell_df[[walk_field]]
  if (mode == "walk") {
    return(if (variant == "walk_4") walk_time * 5 / 4 else walk_time)
  }
  if (mode == "car") {
    car_field <- paste("car_motorized", method, scenario, sep = "_")
    motorized <- cell_df[[car_field]]
    if (variant == "car_10") motorized[is.finite(motorized)] <- motorized[is.finite(motorized)] + 5
    return(best_available_time(walk_time, motorized))
  }
  bus_suffix <- if (variant == "bus_best") "min" else "median"
  cell_df[[paste("bus", method, scenario, bus_suffix, sep = "_")]]
}
sensitivity_specs <- merge(
  sensitivity_variants,
  expand.grid(
    method = c("nearest", "assigned"),
    scenario = bus_scenario_keys,
    stringsAsFactors = FALSE
  ),
  all = TRUE
) |>
  arrange(mode, method, variant, match(scenario, bus_scenario_keys))
sensitivity_stats <- bind_rows(lapply(seq_len(nrow(sensitivity_specs)), function(i) {
  spec <- sensitivity_specs[i, ]
  current <- sensitivity_time(spec$mode, spec$method, spec$scenario, spec$variant)
  reference <- sensitivity_time(
    spec$mode, spec$method, "bureaux_complets", spec$variant
  )
  increase <- current - reference
  tibble(
    mode = spec$mode,
    method = spec$method,
    scenario = spec$scenario,
    variant = spec$variant,
    variant_label = spec$variant_label,
    is_main = spec$is_main,
    moyenne = weighted_mean(current, cell_df$pop),
    augmentation_moyenne = weighted_mean(increase, cell_df$pop),
    part_pop_plus_30 = weighted_share(current > 30, cell_df$pop),
    part_pop_hausse_plus_5 = weighted_share(increase > 5, cell_df$pop)
  )
}))

mobility_metadata <- list(
  car = list(
    model = paste0(
      "meilleur temps entre la marche directe et un ordre de grandeur ",
      "automobile porte-à-porte sur les voies carrossables de BDROUTE"
    ),
    selection_rule = "minimum cellule par cellule entre marche et voiture",
    route_types = car_route_types,
    direction = "sens uniques de BDROUTE respectés",
    speed = paste0(
      "seg_vitesse_max plafonnée à ", car_effective_speed_cap_kmh,
      " km/h pour représenter une progression urbaine"
    ),
    fixed_overhead_min = car_door_to_door_overhead_min,
    sensitivity_fixed_overhead_min = 10,
    fixed_overhead_definition = paste0(
      "accès au véhicule, mise en route, stationnement et marche finale ; ",
      "la congestion exceptionnelle reste exclue"
    )
  ),
  bus = list(
    operator = "Tanéo / SMTU",
    source_url = taneo_gtfs_url,
    reconstruction = paste0(
      "service du samedi postérieur au 22 juin, reconstitué avec le GTFS du ",
      representative_saturday
    ),
    service_window = "06:00-18:00",
    sampled_departures = bus_departures_sec / 3600,
    selection_rule = paste0(
      "à chaque horaire, minimum cellule par cellule entre marche directe et trajet ",
      "Tanéo complet ; médiane des cinq valeurs comme indicateur principal"
    ),
    favorable_rule = "minimum des cinq valeurs comme horaire le plus favorable",
    unavailable_rule = "marche directe si aucun trajet Tanéo n'est calculable à l'horaire",
    access_walk_limit_m = bus_access_limit_m,
    egress_walk_limit_m = bus_egress_limit_m,
    transfer_walk_limit_m = bus_transfer_limit_m,
    walk_speed_kmh = 4.5
  )
)

message("Statistiques multimodales :")
print(mobility_stats)
