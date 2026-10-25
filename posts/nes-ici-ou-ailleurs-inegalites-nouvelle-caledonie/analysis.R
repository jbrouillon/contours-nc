# Calculs de l'article « Nés ici ou en métropole ».
#
# L'article compare d'abord les personnes nées en Nouvelle-Calédonie et celles
# nées en métropole ou dans un DOM (modalité 4 de ILN, « Métropole, DOM ou autre
# territoire français », qui ne peut pas être détaillée). Les autres lieux de
# naissance (Wallis-et-Futuna, Polynésie française, étranger) servent de points
# de comparaison.
#
# Sources :
# - fichiers open data Individus et Logements du recensement de 2019 (Isee),
#   convertis en CSV par scripts/convertir_rp2019_open_data.py ;
# - IRIS du RGP 2019 (PopGIS3) et limites communales du dépôt ;
# - tableau Isee « Population par origine » (série du lieu de naissance) ;
# - Isee, enquête Budget des familles 2019-2020 (pauvreté et niveaux de vie),
#   dans data/revenus/.
#
# Sorties publiques, dans data/ :
# - profils-25-64-ans.csv : indicateurs par groupe (taux observés et taux à
#   structure par âge et sexe identique) ;
# - diplomes-lieu-naissance.csv : répartition par diplôme selon le lieu de
#   naissance ;
# - generations-diplome.csv : diplôme selon la classe d'âge, natifs du pays et
#   personnes nées en métropole ;
# - generations-installation.csv : indicateurs par classe d'âge, croisée avec
#   la période de la dernière installation ou l'âge à l'arrivée, pour les
#   personnes nées en métropole (natifs du pays en repère) ;
# - diplome-egal.csv : chômage et cadres par niveau de diplôme, et taux à
#   âge, sexe et diplôme identiques, natifs du pays et personnes nées en
#   métropole ;
# - logement-provinces.csv : surpeuplement et accès à internet par province,
#   pour les deux mêmes groupes ;
# - pauvrete-bdf-2019.csv : taux de pauvreté publiés par l'Isee ;
# - iris-origines.json : géométrie simplifiée des IRIS et indicateurs de la
#   carte ;
# - iris-origines.csv : les mêmes indicateurs, sans géométrie.

suppressPackageStartupMessages({
  library(data.table)
  library(dplyr)
  library(jsonlite)
  library(readxl)
  library(scales)
  library(sf)
  library(tidyr)
})

article_input <- knitr::current_input(dir = TRUE)
if (is.null(article_input)) {
  article_input <- file.path(
    getwd(), "posts", "nes-ici-ou-ailleurs-inegalites-nouvelle-caledonie", "index.qmd"
  )
}
article_dir <- normalizePath(dirname(article_input), winslash = "/", mustWork = TRUE)
project_dir <- normalizePath(file.path(article_dir, "..", ".."), winslash = "/", mustWork = TRUE)
data_path <- function(...) file.path(project_dir, "data", ...)
output_path <- function(...) file.path(article_dir, "data", ...)

individus_path <- data_path("population", "rp2019_od", "individus.csv")
logements_path <- data_path("population", "rp2019_od", "logements.csv")
origine_xls_path <- data_path("population", "rp-population-origine_0.xls")
iris_path <- data_path("02_geospatial", "vecteurs", "iris_rgp_2019.geojson")
communes_path <- data_path("02_geospatial", "vecteurs", "nc_communes_simp.geojson")
bdf_pauvrete_path <- data_path("revenus", "bdf2019-pauvrete.xls")
bdf_inegalites_path <- data_path("revenus", "bdf2019-inegalites.xls")
bdf_synthese_path <- data_path("revenus", "bdf2019-pauvrete-inegalites.xls")

required_files <- c(
  individus = individus_path,
  logements = logements_path,
  origine = origine_xls_path,
  iris = iris_path,
  communes = communes_path,
  bdf_pauvrete = bdf_pauvrete_path,
  bdf_inegalites = bdf_inegalites_path,
  bdf_synthese = bdf_synthese_path
)
missing_files <- required_files[!file.exists(required_files)]
if (length(missing_files) > 0) {
  stop(
    "Fichiers de données manquants :\n",
    paste(missing_files, collapse = "\n"),
    "\n\nTélécharger les fichiers open data du recensement 2019 (voir ",
    "data/population/README.md), puis lancer depuis la racine du dépôt :\n",
    "python scripts/convertir_rp2019_open_data.py"
  )
}
dir.create(output_path(), showWarnings = FALSE)

# Formats ---------------------------------------------------------------------

fmt_int <- function(x) number(x, accuracy = 1, decimal.mark = ",", big.mark = " ")
fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}
fmt_pct <- function(x, digits = 0) paste0(fmt_num(x, digits), " %")
# Espaces insécables : un nombre comme 34 % ne doit pas être coupé.
nbsp <- function(x) gsub(" ", " ", x, fixed = TRUE)
# Comme dans les figures : une décimale sous 10 %, un entier au-delà, la
# moitié arrondie vers le haut (comme Intl.NumberFormat dans le navigateur).
precision_pct <- function(x) ifelse(abs(x) < 10, 1, 0)
arrondi_pct <- function(x) sign(x) * floor(abs(x) * 10^precision_pct(x) + 0.5) / 10^precision_pct(x)
pct <- function(x) {
  nbsp(vapply(x, function(y) if (is.na(y)) "n.c." else fmt_pct(arrondi_pct(y), precision_pct(y)), ""))
}
ent <- function(x) nbsp(fmt_int(x))
# Taux publiés dans les fichiers de données. Les figures les arrondissent à
# nouveau : l'arrondi d'export ne doit changer aucune valeur affichée par
# rapport au texte, calculé sur les valeurs exactes.
taux_export <- function(x, digits = 4) {
  y <- round(x, digits)
  stopifnot(all(abs(arrondi_pct(x) - arrondi_pct(y)) < 1e-9 | is.na(x)))
  y
}

# Microdonnées ------------------------------------------------------------------

individus <- fread(individus_path, colClasses = "character", encoding = "UTF-8")
logements <- fread(logements_path, colClasses = "character", encoding = "UTF-8")
entiers <- c("AGEA", "ANNINS", "DIPL", "TACT", "CS8", "EMPL", "ILN", "IRA", "STAT", "TYP", "GENRE")
individus[, (entiers) := lapply(.SD, as.integer), .SDcols = entiers]

# Le recensement de 2019 compte 271 407 habitants ; chaque logement occupé
# du fichier Logements est relié à ses occupants par IDLOG.
stopifnot(
  nrow(individus) == 271407,
  !anyDuplicated(individus$ID),
  !anyDuplicated(logements$IDLOG),
  all(individus$IDLOG[individus$TYP == 2] %in% logements$IDLOG),
  all(!is.na(individus$ILN)),
  # L'année d'installation n'est demandée qu'aux personnes nées hors du pays.
  all(is.na(individus$ANNINS[individus$ILN == 1]))
)

individus <- merge(
  individus,
  logements[, .(IDLOG, STOC, PEUPL, INTER)],
  by = "IDLOG",
  all.x = TRUE,
  sort = FALSE
)

naissance_niveaux <- c(
  "Nouvelle-Calédonie", "Métropole ou DOM", "Étranger",
  "Polynésie française", "Wallis-et-Futuna"
)
anciennete_niveaux <- c(
  "Nés en Nouvelle-Calédonie", "Arrivés en 2015-2019", "Arrivés en 2005-2014",
  "Arrivés en 1990-2004", "Arrivés avant 1990", "Année non déclarée"
)

individus[, `:=`(
  naissance = factor(
    c("Nouvelle-Calédonie", "Wallis-et-Futuna", "Polynésie française",
      "Métropole ou DOM", "Étranger")[ILN],
    levels = naissance_niveaux
  ),
  naissance2 = factor(
    fifelse(ILN == 1, "Nés en Nouvelle-Calédonie", "Nés hors de Nouvelle-Calédonie"),
    levels = c("Nés en Nouvelle-Calédonie", "Nés hors de Nouvelle-Calédonie")
  ),
  anciennete = factor(
    fcase(
      ILN == 1, "Nés en Nouvelle-Calédonie",
      is.na(ANNINS), "Année non déclarée",
      ANNINS >= 2015, "Arrivés en 2015-2019",
      ANNINS >= 2005, "Arrivés en 2005-2014",
      ANNINS >= 1990, "Arrivés en 1990-2004",
      default = "Arrivés avant 1990"
    ),
    levels = anciennete_niveaux
  ),
  age_arrivee = ANNINS - (2019L - AGEA)
)]

# Population et lieu de naissance, tous âges -------------------------------------

population_naissance <- individus[, .N, by = naissance][order(naissance)]
population_naissance[, part := 100 * N / sum(N)]
n_total <- nrow(individus)
n_hors <- individus[ILN != 1, .N]
part_hors <- 100 * n_hors / n_total
n_hors_sans_annee <- individus[ILN != 1 & is.na(ANNINS), .N]
part_hors_sans_annee <- 100 * n_hors_sans_annee / n_hors

# Série publiée par l'Isee : part de chaque lieu de naissance, 1983-2019.
origine_feuille <- read_excel(
  origine_xls_path,
  sheet = "lieu naissance",
  col_names = FALSE,
  col_types = "text",
  .name_repair = "minimal"
)
# Premier tableau de la feuille : ligne « Lieu de naissance » (années), puis
# ligne « Nouvelle-Calédonie » (parts en %).
ligne_annees <- which(origine_feuille[[1]] == "Lieu de naissance")[1]
origine_serie <- tibble(
  annee = as.integer(unlist(origine_feuille[ligne_annees, 2:8])),
  part_nes_nc = as.numeric(unlist(origine_feuille[ligne_annees + 1, 2:8]))
)
stopifnot(
  identical(origine_serie$annee, c(1983L, 1989L, 1996L, 2004L, 2009L, 2014L, 2019L)),
  origine_feuille[[1]][ligne_annees + 1] == "Nouvelle-Calédonie",
  # Le fichier détaillé retrouve exactement la part publiée pour 2019.
  abs(origine_serie$part_nes_nc[origine_serie$annee == 2019] -
        100 * individus[ILN == 1, .N] / n_total) < 0.001
)
serie_min <- min(origine_serie$part_nes_nc)
serie_max <- max(origine_serie$part_nes_nc)

# Indicateurs des 25-64 ans --------------------------------------------------------
#
# Chaque indicateur vaut 1, 0 ou NA (hors champ) pour chaque personne :
# - diplômes et emploi : toutes les personnes de 25 à 64 ans ;
# - chômage : actifs (en emploi, en apprentissage ou au chômage), chômage
#   déclaré au recensement, qui n'est pas le chômage au sens du BIT ;
# - cadres : salariés, seuls à avoir une catégorie socioprofessionnelle dans le
#   fichier open data ;
# - secteur public : personnes en emploi ;
# - contrat à durée déterminée : salariés hors apprentis et stagiaires ;
# - logement : personnes vivant en logement ordinaire (hors communautés), selon
#   les caractéristiques du logement de leur ménage.

indicateurs <- tribble(
  ~id, ~libelle, ~court, ~champ, ~theme,
  "bac3", "Diplômés d’un bac +3 ou plus", "Bac +3 ou plus",
    "personnes de 25 à 64 ans", "Diplôme",
  "sans_diplome", "Sans aucun diplôme", "Sans diplôme",
    "personnes de 25 à 64 ans", "Diplôme",
  "emploi", "En emploi", "En emploi",
    "personnes de 25 à 64 ans", "Emploi",
  "chomage", "Au chômage (déclaré)", "Chômage",
    "actifs de 25 à 64 ans", "Emploi",
  "cadres", "Cadres et professions intellectuelles supérieures", "Cadres",
    "salariés de 25 à 64 ans", "Emploi",
  "public", "Employés du secteur public", "Secteur public",
    "personnes en emploi de 25 à 64 ans", "Emploi",
  "cdd", "En contrat à durée déterminée", "CDD",
    "salariés de 25 à 64 ans, hors apprentis et stagiaires", "Emploi",
  "proprietaire", "Ménage propriétaire de son logement", "Propriétaires",
    "personnes de 25 à 64 ans en logement ordinaire", "Logement",
  "surpeuplement", "Logement surpeuplé", "Surpeuplement",
    "personnes de 25 à 64 ans en logement ordinaire", "Logement",
  "sans_internet", "Logement sans accès à internet", "Sans internet",
    "personnes de 25 à 64 ans en logement ordinaire", "Logement"
)

adultes <- individus[AGEA >= 25 & AGEA <= 64]
stopifnot(all(!is.na(adultes$DIPL)), all(!is.na(adultes$TACT)))
en_emploi <- adultes$TACT %in% 1:2
logement_ordinaire <- adultes$TYP == 2
adultes[, `:=`(
  bac3 = as.numeric(DIPL %in% 17:19),
  sans_diplome = as.numeric(DIPL %in% 1:4),
  emploi = as.numeric(en_emploi),
  chomage = fifelse(TACT %in% c(1, 2, 4), as.numeric(TACT == 4), NA_real_),
  cadres = fifelse(en_emploi & STAT %in% 3, as.numeric(CS8 %in% 3), NA_real_),
  public = fifelse(en_emploi & !is.na(EMPL), as.numeric(EMPL %in% 7:8), NA_real_),
  cdd = fifelse(EMPL %in% 5:8, as.numeric(EMPL %in% c(5, 7)), NA_real_),
  proprietaire = fifelse(
    logement_ordinaire & STOC %in% c("1", "2", "3", "4"), as.numeric(STOC == "1"), NA_real_
  ),
  surpeuplement = fifelse(
    logement_ordinaire & PEUPL %in% c("NOR", "SO1", "SO2", "SU1", "SU2"),
    as.numeric(PEUPL %in% c("SU1", "SU2")), NA_real_
  ),
  sans_internet = fifelse(
    logement_ordinaire & INTER %in% c("1", "2"), as.numeric(INTER == "2"), NA_real_
  ),
  classe_age = cut(AGEA, c(24, 34, 44, 54, 64), labels = c("25-34", "35-44", "45-54", "55-64"))
)]
# La catégorie socioprofessionnelle est renseignée pour tous les salariés, et
# seulement pour eux.
stopifnot(
  all(!is.na(adultes$CS8[en_emploi & adultes$STAT %in% 3])),
  all(is.na(adultes$CS8[en_emploi & !adultes$STAT %in% 3]))
)
ids <- indicateurs$id

# Diplôme le plus élevé, en six niveaux.
diplome_niveaux <- c(
  "Aucun diplôme", "CEP ou brevet", "CAP ou BEP", "Baccalauréat", "Bac +2", "Bac +3 ou plus"
)
adultes[, diplome := factor(
  fcase(
    DIPL %in% 1:4, diplome_niveaux[1],
    DIPL %in% 11:12, diplome_niveaux[2],
    DIPL == 13, diplome_niveaux[3],
    DIPL %in% 14:15, diplome_niveaux[4],
    DIPL == 16, diplome_niveaux[5],
    DIPL %in% 17:19, diplome_niveaux[6]
  ),
  levels = diplome_niveaux
)]
stopifnot(
  all(!is.na(adultes$diplome)),
  all((adultes$diplome == "Bac +3 ou plus") == (adultes$bac3 == 1)),
  all((adultes$diplome == "Aucun diplôme") == (adultes$sans_diplome == 1))
)

# Taux observés et taux à structure par âge et sexe identique. La structure de
# référence est celle de l'ensemble des 25-64 ans du territoire étudié : quatre
# classes d'âge décennales croisées avec le sexe.
taux_groupes <- function(data, groupe, regroupement, territoire) {
  data <- copy(data)
  data[, groupe := as.character(get(groupe))]
  reference <- data[, .(poids = .N), by = .(classe_age, GENRE)][, poids := poids / sum(poids)]
  long <- melt(
    data[, c("groupe", "classe_age", "GENRE", ids), with = FALSE],
    id.vars = c("groupe", "classe_age", "GENRE"),
    variable.name = "indicateur",
    value.name = "valeur",
    variable.factor = FALSE
  )[!is.na(valeur)]
  brut <- long[, .(n_champ = .N, n = sum(valeur), taux = 100 * mean(valeur)), by = .(groupe, indicateur)]
  cellules <- long[, .(taux = mean(valeur)), by = .(groupe, indicateur, classe_age, GENRE)]
  cellules <- merge(cellules, reference, by = c("classe_age", "GENRE"))
  std <- cellules[, .(taux_std = 100 * sum(taux * poids) / sum(poids), poids_couvert = sum(poids)),
                  by = .(groupe, indicateur)]
  out <- merge(brut, std, by = c("groupe", "indicateur"))
  # Sans personne dans une partie des classes âge × sexe de référence, le taux
  # comparable n'est pas calculé plutôt qu'extrapolé.
  out[poids_couvert < 0.95, taux_std := NA_real_]
  out[, `:=`(territoire = territoire, regroupement = regroupement)]
  as_tibble(out)
}

calcul_territoire <- function(data, territoire) {
  data <- copy(data)
  data[, ensemble := "Ensemble des 25-64 ans"]
  bind_rows(
    taux_groupes(data, "ensemble", "ensemble", territoire),
    taux_groupes(data, "naissance2", "naissance2", territoire),
    taux_groupes(data, "naissance", "naissance", territoire),
    taux_groupes(data, "anciennete", "anciennete", territoire),
    taux_groupes(
      data[ILN != 1][, origine_anciennete := paste(naissance, anciennete, sep = " · ")],
      "origine_anciennete", "naissance_anciennete", territoire
    )
  )
}

profils <- bind_rows(
  calcul_territoire(adultes, "nc"),
  calcul_territoire(adultes[PROV == "Sud"], "sud")
) |>
  mutate(
    naissance = case_when(
      regroupement == "naissance" ~ groupe,
      regroupement == "naissance_anciennete" ~ sub(" · .*$", "", groupe),
      groupe %in% c("Nés en Nouvelle-Calédonie") ~ "Nouvelle-Calédonie",
      TRUE ~ NA_character_
    ),
    anciennete = case_when(
      regroupement == "anciennete" ~ groupe,
      regroupement == "naissance_anciennete" ~ sub("^.* · ", "", groupe),
      TRUE ~ NA_character_
    )
  ) |>
  left_join(indicateurs |> select(indicateur = id, libelle, champ, theme), by = "indicateur") |>
  arrange(territoire, regroupement, groupe, match(indicateur, ids))

stopifnot(
  !anyDuplicated(profils[c("territoire", "regroupement", "groupe", "indicateur")]),
  all(profils$taux >= 0 & profils$taux <= 100),
  all(profils$taux_std >= 0 & profils$taux_std <= 100, na.rm = TRUE),
  # Chaque groupe couvre toute la structure de référence, sauf de rares cases
  # vides dans le plus petit croisement origine × ancienneté.
  all(profils$poids_couvert[profils$regroupement != "naissance_anciennete"] > 0.999),
  all(is.na(profils$taux_std) == (profils$poids_couvert < 0.95)),
  all(profils$groupe[is.na(profils$taux_std)] == "Wallis-et-Futuna · Arrivés en 2015-2019"),
  # Les effectifs des groupes s'additionnent.
  with(
    profils |> filter(territoire == "nc", indicateur == "bac3"),
    sum(n_champ[regroupement == "anciennete"]) == n_champ[regroupement == "ensemble"] &&
      sum(n_champ[regroupement == "naissance"]) == n_champ[regroupement == "ensemble"] &&
      sum(n_champ[regroupement == "naissance_anciennete"]) ==
        n_champ[groupe == "Nés hors de Nouvelle-Calédonie"]
  )
)

# Valeur d'un indicateur pour un groupe. Les natifs figurent dans deux
# regroupements, avec des valeurs identiques.
v <- function(groupe, indicateur, territoire = "nc", col = "taux") {
  x <- unique(profils[[col]][profils$groupe == groupe & profils$indicateur == indicateur &
                               profils$territoire == territoire])
  stopifnot(length(x) == 1)
  x
}
NC <- "Nés en Nouvelle-Calédonie"
HORS <- "Nés hors de Nouvelle-Calédonie"
# Personnes nées en métropole ou dans un DOM : groupe de comparaison principal.
METRO <- "Métropole ou DOM"
oa <- function(naissance, anciennete) paste(naissance, anciennete, sep = " · ")

# Comparaison principale : natifs du pays et personnes nées en métropole ; NA
# pour les autres lieux de naissance.
adultes[, comparaison := factor(fcase(ILN == 1, NC, ILN == 4, METRO), levels = c(NC, METRO))]

n_adultes <- nrow(adultes)
n_adultes_hors <- adultes[ILN != 1, .N]
part_adultes_hors <- 100 * n_adultes_hors / n_adultes
n_adultes_metro <- adultes[ILN == 4, .N]
# Part des personnes nées en métropole parmi les 25-64 ans nés hors du pays.
part_metro_hors <- 100 * n_adultes_metro / n_adultes_hors
part_metro_adultes <- 100 * n_adultes_metro / n_adultes
part_nc_adultes <- 100 * adultes[ILN == 1, .N] / n_adultes
# Année d'installation manquante, toutes personnes nées en métropole.
part_metro_sans_annee <- 100 * individus[ILN == 4, mean(is.na(ANNINS))]
ratio_bac3 <- v(HORS, "bac3") / v(NC, "bac3")
ratio_bac3_std <- v(HORS, "bac3", col = "taux_std") / v(NC, "bac3", col = "taux_std")
ratio_bac3_metro <- v(METRO, "bac3") / v(NC, "bac3")
ratio_bac3_metro_std <- v(METRO, "bac3", col = "taux_std") / v(NC, "bac3", col = "taux_std")
# Effet de la standardisation : faible entre natifs et nés ailleurs, notable
# seulement pour les arrivées les plus anciennes, plus âgées.
ecart_std <- profils |>
  filter(territoire == "nc", regroupement %in% c("naissance2", "naissance", "anciennete")) |>
  mutate(ecart = taux_std - taux)
ecart_std_naissance2 <- max(abs(ecart_std$ecart[ecart_std$regroupement == "naissance2"]))
# Variation, indicateur par indicateur, de l'écart entre nés ailleurs et natifs.
ecart_gap_std <- ecart_std |>
  filter(regroupement == "naissance2") |>
  group_by(indicateur) |>
  summarise(
    gap = taux[groupe == HORS] - taux[groupe == NC],
    gap_std = taux_std[groupe == HORS] - taux_std[groupe == NC],
    .groups = "drop"
  ) |>
  summarise(m = max(abs(gap_std - gap))) |>
  pull(m)
# Même calcul entre natifs du pays et personnes nées en métropole, pour les
# huit indicateurs de la figure des écarts.
ecarts_metro <- profils |>
  filter(territoire == "nc", regroupement == "naissance", groupe %in% c("Nouvelle-Calédonie", METRO)) |>
  group_by(indicateur) |>
  summarise(
    gap = taux[groupe == METRO] - taux[groupe == "Nouvelle-Calédonie"],
    gap_std = taux_std[groupe == METRO] - taux_std[groupe == "Nouvelle-Calédonie"],
    .groups = "drop"
  )
ecart_std_hors_ancien <- max(abs(ecart_std$ecart[ecart_std$groupe != "Arrivés avant 1990"]))
emploi_ancien <- v("Arrivés avant 1990", "emploi")
emploi_ancien_std <- v("Arrivés avant 1990", "emploi", col = "taux_std")

# Secteur d'activité des personnes en emploi : administration publique,
# enseignement, santé et action sociale (sections O, P et Q de la NAF).
secteur_opq <- adultes[TACT %in% 1:2, .(
  n = .N, opq = 100 * mean(SECT21 %in% c("O", "P", "Q")), enseignement = 100 * mean(SECT21 == "P")
), by = anciennete]
vs <- function(groupe, col) secteur_opq[[col]][secteur_opq$anciennete == groupe]

# Natifs selon la province de résidence.
natifs_province <- adultes[ILN == 1, .(
  n = .N,
  bac3 = 100 * mean(bac3),
  sans_diplome = 100 * mean(sans_diplome),
  chomage = 100 * mean(chomage, na.rm = TRUE)
), by = PROV]
vp <- function(province, col) natifs_province[[col]][natifs_province$PROV == province]
n_natifs_sud <- vp("Sud", "n")
part_natifs_hors_sud <- 100 * (1 - n_natifs_sud / adultes[ILN == 1, .N])
part_ailleurs_hors_sud <- 100 * adultes[ILN != 1, mean(PROV != "Sud")]
part_metro_hors_sud <- 100 * adultes[ILN == 4, mean(PROV != "Sud")]

# Être propriétaire ne dit rien de la taille du logement.
surpeuplement_proprietaires <- adultes[proprietaire == 1 & !is.na(comparaison), .(
  n = .N, surpeuplement = 100 * mean(surpeuplement, na.rm = TRUE)
), by = .(groupe = comparaison)]
vsp <- function(groupe) surpeuplement_proprietaires$surpeuplement[surpeuplement_proprietaires$groupe == groupe]

# Personnes qui vivaient hors du pays en 2014 (question posée aux 5 ans ou plus).
venus_2014 <- individus[IRA %in% 4:5, .N]
venus_2014_natifs <- individus[IRA %in% 4:5 & ILN == 1, .N]

# Part des natifs du pays dans quelques groupes de 25-64 ans.
part_natifs <- function(filtre) 100 * mean(adultes$ILN[filtre] == 1)
part_natifs_adultes <- part_natifs(rep(TRUE, nrow(adultes)))
part_natifs_sans_diplome <- part_natifs(adultes$sans_diplome == 1)
part_natifs_chomeurs <- part_natifs(adultes$chomage %in% 1)
part_natifs_bac3 <- part_natifs(adultes$bac3 == 1)
part_natifs_cadres <- part_natifs(adultes$cadres %in% 1)

# Répartition par diplôme selon le lieu de naissance ------------------------------

diplomes_groupes <- rbind(
  adultes[, .(groupe = as.character(naissance2), diplome)],
  adultes[ILN != 1, .(groupe = as.character(naissance), diplome)]
)[, .(effectif = .N), by = .(groupe, diplome)]
diplomes_groupes[, part := 100 * effectif / sum(effectif), by = groupe]
setorder(diplomes_groupes, groupe, diplome)
stopifnot(
  nrow(diplomes_groupes) == 6 * length(diplome_niveaux),
  all(diplomes_groupes[, abs(sum(part) - 100), by = groupe]$V1 < 1e-9),
  sum(diplomes_groupes$effectif[diplomes_groupes$groupe %in% c(NC, HORS)]) == n_adultes
)
vd <- function(g, niveau) diplomes_groupes$part[diplomes_groupes$groupe == g & diplomes_groupes$diplome == niveau]

# Diplôme selon la classe d'âge ----------------------------------------------------
#
# Lecture transversale : des classes d'âge observées en 2019, pas des
# générations suivies dans le temps. Chez les personnes nées en métropole, la
# composition de chaque classe d'âge dépend aussi des arrivées et des départs.

generations <- adultes[!is.na(comparaison), .(
  effectif = .N,
  sans_diplome = 100 * mean(sans_diplome),
  bac3 = 100 * mean(bac3)
), by = .(classe_age, groupe = comparaison)]
setorder(generations, groupe, classe_age)
stopifnot(nrow(generations) == 2 * 4, sum(generations$effectif) == adultes[!is.na(comparaison), .N])
vg <- function(classe, groupe, col) {
  generations[[col]][generations$classe_age == classe & generations$groupe == groupe]
}

# Génération et date d'installation ------------------------------------------------
#
# Les classes d'âge de 2019 sont croisées avec la date de la dernière
# installation, exprimée de deux façons : la période d'installation, ou l'âge
# atteint l'année de l'installation. AGEA étant la différence entre 2019 et
# l'année de naissance, les 25-34 ans sont nés en 1985-1994 et l'âge à
# l'arrivée est exact à l'année près. À classe d'âge donnée, période et âge à
# l'arrivée se déduisent donc l'un de l'autre. Lecture transversale, comme
# ci-dessus. Le croisement porte sur les personnes nées en métropole ; les
# natifs du pays, en repère, figurent dans les deux regroupements, les
# personnes sans année d'installation seulement dans le premier.

classes_age <- c("25-34", "35-44", "45-54", "55-64")
age_arrivee_niveaux <- c(
  "Nés en Nouvelle-Calédonie", "Arrivés avant 16 ans", "Arrivés à 16-24 ans",
  "Arrivés à 25 ans ou plus", "Année non déclarée"
)
adultes[, age_arrivee_groupe := factor(
  fcase(
    ILN == 1, age_arrivee_niveaux[1],
    is.na(age_arrivee), age_arrivee_niveaux[5],
    age_arrivee < 16, age_arrivee_niveaux[2],
    age_arrivee < 25, age_arrivee_niveaux[3],
    default = age_arrivee_niveaux[4]
  ),
  levels = age_arrivee_niveaux
)]
stopifnot(
  all(!is.na(adultes$age_arrivee_groupe)),
  all(adultes$age_arrivee >= 0, na.rm = TRUE),
  all((adultes$age_arrivee_groupe == "Année non déclarée") == (adultes$anciennete == "Année non déclarée"))
)

gi_base <- adultes[!is.na(comparaison)]
gi_long <- melt(
  gi_base[, c("classe_age", "anciennete", "age_arrivee_groupe", ids), with = FALSE],
  measure.vars = ids,
  variable.name = "indicateur",
  value.name = "valeur",
  variable.factor = FALSE
)[!is.na(valeur)]
gi_taux <- function(data, var, regroupement) {
  data[, .(regroupement = regroupement, effectif_champ = .N, effectif = sum(valeur), taux = 100 * mean(valeur)),
       by = .(classe_age = as.character(classe_age), groupe = as.character(get(var)), indicateur)]
}
# Âge médian à l'arrivée de chaque case, sur toutes les personnes de 25 à 64 ans.
gi_age <- function(var, regroupement) {
  gi_base[, .(regroupement = regroupement, age_arrivee_median = as.numeric(median(age_arrivee))),
          by = .(classe_age = as.character(classe_age), groupe = as.character(get(var)))]
}
generations_installation <- merge(
  rbind(
    gi_taux(gi_long, "anciennete", "anciennete"),
    gi_taux(gi_long[age_arrivee_groupe != "Année non déclarée"], "age_arrivee_groupe", "age_arrivee")
  ),
  rbind(gi_age("anciennete", "anciennete"), gi_age("age_arrivee_groupe", "age_arrivee")),
  by = c("regroupement", "classe_age", "groupe")
)
setorder(generations_installation, regroupement, classe_age, groupe, indicateur)
generations_installation[, naissance := fifelse(groupe == NC, "Nouvelle-Calédonie", METRO)]
gi_natifs <- dcast(
  generations_installation[groupe == "Nés en Nouvelle-Calédonie"],
  classe_age + indicateur ~ regroupement, value.var = "taux"
)
stopifnot(
  nrow(generations_installation) == length(classes_age) * (6 + 4) * length(ids),
  !anyDuplicated(generations_installation[, .(regroupement, classe_age, groupe, indicateur)]),
  all(generations_installation$taux >= 0 & generations_installation$taux <= 100),
  # Chaque regroupement couvre les natifs et les personnes nées en métropole de
  # 25 à 64 ans (hors année non déclarée pour l'âge à l'arrivée) ; les natifs
  # ont les mêmes valeurs dans les deux.
  generations_installation[regroupement == "anciennete" & indicateur == "bac3", sum(effectif_champ)] == nrow(gi_base),
  generations_installation[regroupement == "age_arrivee" & indicateur == "bac3", sum(effectif_champ)] ==
    nrow(gi_base) - gi_base[anciennete == "Année non déclarée", .N],
  all(gi_natifs$anciennete == gi_natifs$age_arrivee),
  all(is.na(generations_installation$age_arrivee_median) ==
        generations_installation$groupe %in% c("Nés en Nouvelle-Calédonie", "Année non déclarée")),
  # Un seul croisement compte moins de 200 personnes de 25 à 64 ans (signalé
  # dans la figure) ; aucun ne descend sous 100.
  sum(generations_installation[indicateur == "bac3", effectif_champ] < 200) == 1,
  min(generations_installation[indicateur == "bac3", effectif_champ]) >= 100
)
# Valeur d'une case ; les natifs figurent dans les deux regroupements, avec des
# valeurs identiques.
vgi <- function(groupe, classe, indicateur, col = "taux") {
  x <- unique(generations_installation[[col]][generations_installation$groupe == groupe &
                                                generations_installation$classe_age == classe &
                                                generations_installation$indicateur == indicateur])
  stopifnot(length(x) == 1)
  x
}
A1519 <- "Arrivés en 2015-2019"
A0514 <- "Arrivés en 2005-2014"
A9004 <- "Arrivés en 1990-2004"
AV90 <- "Arrivés avant 1990"
ENFANTS <- "Arrivés avant 16 ans"
ADULTES <- "Arrivés à 25 ans ou plus"
periodes <- c(A1519, A0514, A9004, AV90)
# Étendue d'un indicateur entre les quatre périodes d'installation, ou entre
# les classes d'âge pour un groupe.
etendue_periodes <- function(classe, indicateur) range(sapply(periodes, vgi, classe = classe, indicateur = indicateur))
etendue_classes <- function(groupe, indicateur) range(sapply(classes_age, \(cl) vgi(groupe, cl, indicateur)))
ans <- function(x) nbsp(paste(fmt_int(x), if (round(x) >= 2) "ans" else "an"))

# Personnes de 25 à 34 ans arrivées enfants, selon le lieu de naissance.
enfants_25_34 <- adultes[classe_age == "25-34" & age_arrivee_groupe == ENFANTS, .(
  n = .N, bac3 = 100 * mean(bac3), chomage = 100 * mean(chomage, na.rm = TRUE)
), by = naissance]
ve <- function(naissance, col) enfants_25_34[[col]][enfants_25_34$naissance == naissance]
part_metro_enfants_25_34 <- 100 * ve("Métropole ou DOM", "n") / sum(enfants_25_34$n)
# Diplôme et chômage des 25-34 ans en province Sud, natifs du pays et
# personnes nées en métropole : la géographie n'explique pas l'écart.
sud_25_34 <- gi_base[PROV == "Sud" & classe_age == "25-34", .(
  n = .N, bac3 = 100 * mean(bac3), chomage = 100 * mean(chomage, na.rm = TRUE)
), by = age_arrivee_groupe]
vcs <- function(groupe, col) sud_25_34[[col]][sud_25_34$age_arrivee_groupe == groupe]
# Plus petit croisement génération × période d'installation.
gi_plus_petit <- generations_installation[indicateur == "bac3"][which.min(effectif_champ)]

# À diplôme égal -------------------------------------------------------------------
#
# Chômage parmi les actifs et part des cadres parmi les salariés, par niveau de
# diplôme, pour les natifs du pays et les personnes nées en métropole. Les taux
# « à structure identique » donnent à chaque groupe la répartition par âge,
# sexe et diplôme de l'ensemble du champ (tous lieux de naissance confondus).

taux_structure <- function(data, var, strates) {
  reference <- data[, .(poids = .N), by = strates][, poids := poids / sum(poids)]
  cellules <- data[!is.na(comparaison), .(taux = mean(get(var))), by = c("comparaison", strates)]
  cellules <- merge(cellules, reference, by = strates)
  cellules[, .(taux = 100 * sum(taux * poids) / sum(poids), couvert = sum(poids)), by = .(groupe = comparaison)]
}
vn <- function(tab, groupe) tab$taux[tab$groupe == groupe]

actifs <- adultes[!is.na(chomage)]
salaries <- adultes[!is.na(cadres)]
strates_diplome <- c("classe_age", "GENRE", "diplome")
taux_obs <- function(data, var) {
  data[!is.na(comparaison), .(effectif_champ = .N, taux = 100 * mean(get(var))), by = .(groupe = comparaison)]
}
chomage_obs <- taux_obs(actifs, "chomage")
chomage_std <- taux_structure(actifs, "chomage", strates_diplome)
chomage_obs_sud <- taux_obs(actifs[PROV == "Sud"], "chomage")
chomage_std_sud <- taux_structure(actifs[PROV == "Sud"], "chomage", strates_diplome)
cadres_obs <- taux_obs(salaries, "cadres")
cadres_std <- taux_structure(salaries, "cadres", strates_diplome)
# Parmi les salariés diplômés d'un bac +3 ou plus, les natifs ont moins souvent
# un bac +5 : la structure de référence distingue donc aussi bac +3-4 et bac +5.
salaries_bac3 <- salaries[bac3 == 1][, bac5 := DIPL >= 18]
cadres_bac3_obs <- taux_obs(salaries_bac3, "cadres")
cadres_bac3_std <- taux_structure(salaries_bac3, "cadres", c("classe_age", "GENRE", "bac5"))
part_bac5 <- adultes[bac3 == 1 & !is.na(comparaison), .(taux = 100 * mean(DIPL >= 18)), by = .(groupe = comparaison)]

diplome_egal <- rbind(
  actifs[!is.na(comparaison), .(indicateur = "chomage", effectif_champ = .N, taux = 100 * mean(chomage)),
         by = .(niveau = as.character(diplome), groupe = comparaison)],
  chomage_obs[, .(indicateur = "chomage", niveau = "Ensemble (taux observé)", groupe, effectif_champ, taux)],
  chomage_std[, .(indicateur = "chomage", niveau = "Ensemble, à âge, sexe et diplôme identiques", groupe,
                  effectif_champ = NA_integer_, taux)],
  salaries[!is.na(comparaison), .(indicateur = "cadres", effectif_champ = .N, taux = 100 * mean(cadres)),
           by = .(niveau = as.character(diplome), groupe = comparaison)],
  cadres_obs[, .(indicateur = "cadres", niveau = "Ensemble (taux observé)", groupe, effectif_champ, taux)],
  cadres_std[, .(indicateur = "cadres", niveau = "Ensemble, à âge, sexe et diplôme identiques", groupe,
                 effectif_champ = NA_integer_, taux)],
  use.names = TRUE
)
diplome_egal[, groupe := as.character(groupe)]
stopifnot(
  all(c(chomage_std$couvert, chomage_std_sud$couvert, cadres_std$couvert, cadres_bac3_std$couvert) > 0.999),
  nrow(diplome_egal) == 2 * 2 * (length(diplome_niveaux) + 2),
  !anyDuplicated(diplome_egal[, .(indicateur, niveau, groupe)]),
  all(diplome_egal$taux >= 0 & diplome_egal$taux <= 100),
  # Les taux observés retrouvent ceux des profils.
  abs(vn(chomage_obs, METRO) - v(METRO, "chomage")) < 1e-9,
  abs(vn(cadres_obs, NC) - v(NC, "cadres")) < 1e-9,
  # Le plus petit croisement diplôme × groupe compte plus de 400 personnes.
  min(diplome_egal$effectif_champ, na.rm = TRUE) > 400
)
vde <- function(indicateur, niveau, groupe) {
  diplome_egal$taux[diplome_egal$indicateur == indicateur & diplome_egal$niveau == niveau &
                      diplome_egal$groupe == groupe]
}

# Logement selon la province de résidence ------------------------------------------

logement_provinces <- rbind(
  adultes[!is.na(surpeuplement) & !is.na(comparaison),
          .(indicateur = "surpeuplement", effectif_champ = .N, taux = 100 * mean(surpeuplement)),
          by = .(province = PROV, groupe = comparaison)],
  adultes[!is.na(sans_internet) & !is.na(comparaison),
          .(indicateur = "sans_internet", effectif_champ = .N, taux = 100 * mean(sans_internet)),
          by = .(province = PROV, groupe = comparaison)]
)
logement_provinces[, groupe := as.character(groupe)]
# Aux îles Loyauté, les personnes nées en métropole sont moins de 300.
stopifnot(nrow(logement_provinces) == 2 * 3 * 2, all(logement_provinces$effectif_champ >= 200))
vl <- function(province, groupe, indicateur) {
  logement_provinces$taux[logement_provinces$province == province & logement_provinces$groupe == groupe &
                            logement_provinces$indicateur == indicateur]
}

# IRIS -----------------------------------------------------------------------------

clean_iris_label <- function(x) {
  x |>
    gsub("Forˆt", "Forêt", x = _) |>
    gsub("Fran‡ais", "Français", x = _) |>
    gsub("^Coeur", "Cœur", x = _)
}

iris_raw <- st_read(iris_path, quiet = TRUE) |>
  st_make_valid() |>
  mutate(codgeo = as.character(codgeo))
communes_raw <- st_read(communes_path, quiet = TRUE) |>
  st_make_valid()

# Comme dans l'article sur les disparités territoriales : chaque IRIS est
# rattaché à la commune avec laquelle il partage la plus grande surface.
iris_commune <- st_intersection(
  iris_raw |> select(codgeo) |> st_transform(3163) |> st_set_agr("constant"),
  communes_raw |> select(commune, Province) |> st_transform(3163) |> st_set_agr("constant")
) |>
  mutate(surface = as.numeric(st_area(geometry))) |>
  st_drop_geometry() |>
  group_by(codgeo) |>
  slice_max(surface, n = 1, with_ties = FALSE) |>
  ungroup() |>
  transmute(
    codgeo,
    commune,
    province = recode(Province, Sud = "Province Sud", Nord = "Province Nord", Iles = "Îles Loyauté")
  )
stopifnot(nrow(iris_commune) == nrow(iris_raw), !anyDuplicated(iris_commune$codgeo))

grand_noumea <- c("Nouméa", "Dumbéa", "Mont-Dore", "Païta")

# La part des natifs se calcule sur la population de l'IRIS qui inclut les
# communautés (nés ici + nés ailleurs), comme dans PopGIS.
iris_data <- iris_raw |>
  st_drop_geometry() |>
  left_join(iris_commune, by = "codgeo") |>
  transmute(
    id = codgeo,
    iris = clean_iris_label(libgeo),
    commune,
    province,
    grand_noumea = commune %in% grand_noumea,
    nes_nc = nb_de_pers_nees_en_nouvelle_caledonie,
    nes_hors = nb_de_pers_nees_hors_nouvelle_caledonie,
    nes_metro = nb_de_pers_nees_en_metropole_ou_dans_un_dom,
    nes_wf_pf = nb_de_pers_nees_a_wallis_et_futuna_ou_en_polynesie_francaise,
    nes_etranger = nb_de_pers_nees_a_letranger,
    population = nes_nc + nes_hors,
    pct_hors = if_else(population > 0, 100 * nes_hors / population, NA_real_),
    pct_metro = if_else(population > 0, 100 * nes_metro / population, NA_real_),
    pct_wf_pf = if_else(population > 0, 100 * nes_wf_pf / population, NA_real_),
    pct_etranger = if_else(population > 0, 100 * nes_etranger / population, NA_real_),
    hors_nc_2014 = nb_de_pers_ne_residant_pas_en_nouvelle_caledonie_en_2014,
    pct_hors_2014 = if_else(population > 0, percent_pers_ne_residant_pas_en_nouvelle_caledonie_en_2014, NA_real_)
  ) |>
  arrange(province, commune, iris)

iris_habites <- iris_data |> filter(population > 0)

# Les comptages des IRIS recoupent exactement le fichier détaillé.
stopifnot(
  nrow(iris_data) == 162,
  nrow(iris_habites) == 155,
  sum(iris_habites$nes_nc) == individus[ILN == 1, .N],
  sum(iris_habites$nes_hors) == n_hors,
  sum(iris_habites$nes_metro) == individus[ILN == 4, .N],
  sum(iris_habites$nes_wf_pf) == individus[ILN %in% 2:3, .N],
  sum(iris_habites$nes_etranger) == individus[ILN == 5, .N],
  sum(iris_habites$hors_nc_2014) == venus_2014,
  all(iris_habites$nes_metro + iris_habites$nes_wf_pf + iris_habites$nes_etranger == iris_habites$nes_hors),
  all(!is.na(iris_habites$pct_hors_2014))
)

# Indice de dissimilarité de Duncan : part d'un des deux groupes qui devrait
# changer d'IRIS pour que les deux soient répartis de la même façon.
dissimilarite <- function(a, b) 0.5 * sum(abs(a / sum(a) - b / sum(b)))
dissim_hors <- 100 * with(iris_habites, dissimilarite(nes_nc, nes_hors))
dissim_metro <- 100 * with(iris_habites, dissimilarite(nes_nc, nes_metro))
dissim_wf_pf <- 100 * with(iris_habites, dissimilarite(nes_nc, nes_wf_pf))
dissim_etranger <- 100 * with(iris_habites, dissimilarite(nes_nc, nes_etranger))
dissim_metro_wf_pf <- 100 * with(iris_habites, dissimilarite(nes_metro, nes_wf_pf))
# Même indice limité aux IRIS de Nouméa : l'écart de répartition ne tient pas
# seulement à l'opposition entre Nouméa et le reste du pays.
iris_noumea <- iris_habites |> filter(commune == "Nouméa")
dissim_metro_noumea <- 100 * with(iris_noumea, dissimilarite(nes_nc, nes_metro))
# Installations récentes : personnes qui résidaient hors du pays en 2014,
# natifs revenus compris (question posée aux 5 ans ou plus).
dissim_2014 <- 100 * with(iris_habites, dissimilarite(nes_nc, hors_nc_2014))
part_natifs_venus_2014 <- 100 * venus_2014_natifs / venus_2014

iris_majorite_hors <- iris_habites |> filter(pct_hors >= 50)
part_hors_dans_majorite <- 100 * sum(iris_majorite_hors$nes_hors) / n_hors
part_2014_dans_majorite <- 100 * sum(iris_majorite_hors$hors_nc_2014) / venus_2014
iris_top_wf_pf <- iris_habites |> slice_max(pct_wf_pf, n = 5)
# IRIS où les personnes nées en métropole forment au moins 40 % des habitants
# (classe la plus foncée de la carte), et IRIS où elles sont majoritaires.
seuil_metro <- 40
iris_forte_metro <- iris_habites |> filter(pct_metro >= seuil_metro)
part_metro_dans_forte <- 100 * sum(iris_forte_metro$nes_metro) / sum(iris_habites$nes_metro)
part_nc_dans_forte <- 100 * sum(iris_forte_metro$nes_nc) / sum(iris_habites$nes_nc)
iris_majorite_metro <- iris_habites |> filter(pct_metro > 50)
# IRIS presque sans personne née en métropole (moins de 2 % des habitants).
iris_faible_metro <- iris_habites |> filter(pct_metro < 2)
n_faible_metro_hors_sud <- sum(iris_faible_metro$province != "Province Sud")

# Revenus et pauvreté (Isee) -------------------------------------------------------
#
# Le recensement ne mesure pas les revenus. L'enquête Budget des familles
# 2019-2020 (BDF) de l'Isee les complète, par caractéristiques de la personne
# de référence du ménage, sans distinguer le lieu de naissance dans ses
# tableaux. Les rapprochements entre territoires (taux de pauvreté communaux et
# part des personnes nées ailleurs) sont écartés : ils décrivent des lieux, pas
# des personnes.

lire_feuille <- function(path, sheet) {
  read_excel(path, sheet = sheet, col_names = FALSE, col_types = "text", .name_repair = "minimal")
}
ligne <- function(feuille, libelle) {
  i <- which(trimws(feuille[[1]]) == libelle)
  stopifnot(length(i) == 1)
  i
}

# Taux de pauvreté 2019 selon la personne de référence du ménage.
bdf_taux <- lire_feuille(bdf_pauvrete_path, "Taux de pauvreté")
colonne_2019 <- which(trimws(unlist(bdf_taux[5, ])) == "2019")
stopifnot(length(colonne_2019) == 1)
pauvrete_bdf <- tribble(
  ~categorie, ~modalite, ~libelle_isee,
  "Diplôme", "Sans diplôme", "Pas de diplôme",
  "Diplôme", "Primaire ou secondaire", "Primaire ou secondaire",
  "Diplôme", "Diplôme du supérieur", "Diplôme supérieur",
  "Situation", "En emploi", "Actif occupé",
  "Situation", "Au chômage", "Chômeur",
  "Situation", "Retraité", "Retraité",
  "Situation", "Inactif", "Inactif",
  "Communauté", "Kanak", "Kanak",
  "Communauté", "Non Kanak", "Non Kanak",
  "Ensemble", "Ensemble", "Ensemble"
) |>
  mutate(taux = vapply(libelle_isee, \(l) 100 * as.numeric(bdf_taux[[colonne_2019]][ligne(bdf_taux, l)]), 0,
                       USE.NAMES = FALSE))

# Niveau de vie mensuel médian 2019 (F CFP), selon la communauté.
bdf_quintiles <- lire_feuille(bdf_inegalites_path, "quintiles niveau de vie 2019")
colonne_mediane <- which(trimws(unlist(bdf_quintiles[6, ])) == "Médiane")
stopifnot(length(colonne_mediane) == 1)
mediane_bdf <- function(l) as.numeric(bdf_quintiles[[colonne_mediane]][ligne(bdf_quintiles, l)])
mediane_kanak <- mediane_bdf("Kanak")
mediane_non_kanak <- mediane_bdf("Non Kanak")
mediane_ensemble <- mediane_bdf("Ensemble")
bdf_seuils <- lire_feuille(bdf_pauvrete_path, "Seuil de pauvreté - type ménage")
stopifnot(trimws(bdf_seuils[[5]][ligne(bdf_seuils, "Personne seule") - 1]) == "2019")
seuil_personne_seule <- as.numeric(bdf_seuils[[5]][ligne(bdf_seuils, "Personne seule")])

# Indicateurs d'ensemble 2019.
bdf_synthese <- lire_feuille(bdf_synthese_path, "Indicateurs synthetiques")
stopifnot(trimws(bdf_synthese[[3]][5]) == "2019")
synthese_bdf <- function(l) as.numeric(bdf_synthese[[3]][ligne(bdf_synthese, l)])
gini_2019 <- synthese_bdf("Indice de Gini (niveau de vie)")
d9_d1_2019 <- synthese_bdf("D9/D1*")

# Composition de la population pauvre : valeurs publiées dans le texte de la
# synthèse (Isee, Synthèse n° 52, août 2021, p. 3), absentes des tableaux
# téléchargeables. Arrondies à l'unité par l'Isee.
part_natifs_pauvres <- 89
part_kanak_pauvres <- 71
# Ordre de grandeur des taux de pauvreté selon le lieu de naissance, en
# combinant cette proportion avec la part des natifs au recensement de 2019 :
# P(pauvre | natif) = P(natif | pauvre) × P(pauvre) / P(natif).
taux_pauvrete_2019 <- pauvrete_bdf$taux[pauvrete_bdf$modalite == "Ensemble"]
part_natifs_population <- 100 * individus[ILN == 1, .N] / n_total
pauvrete_natifs <- taux_pauvrete_2019 * part_natifs_pauvres / part_natifs_population
pauvrete_hors <- taux_pauvrete_2019 * (100 - part_natifs_pauvres) / (100 - part_natifs_population)
# Avec l'arrondi de l'Isee (de 88,5 à 89,5 %), les deux taux restent dans ces
# bornes.
pauvrete_bornes <- sapply(c(88.5, 89.5), \(p) c(
  natifs = taux_pauvrete_2019 * p / part_natifs_population,
  hors = taux_pauvrete_2019 * (100 - p) / (100 - part_natifs_population)
))
stopifnot(
  abs(taux_pauvrete_2019 - 100 * synthese_bdf("Taux de pauvreté")) < 0.1,
  all(pauvrete_bornes["natifs", ] > 20.5 & pauvrete_bornes["natifs", ] < 21.5),
  all(pauvrete_bornes["hors", ] > 8.5 & pauvrete_bornes["hors", ] < 10)
)

# Géométrie publiée (EPSG:3163 pour la simplification, coordonnées arrondies à
# 4 décimales, soit une dizaine de mètres) : 60 m de tolérance pour les IRIS
# de l'emprise du Grand Nouméa, affichés en agrandissement, 250 m ailleurs,
# soit moins d'un pixel à l'échelle du pays.
emprise_gn <- st_as_sfc(
  st_bbox(c(xmin = 166.30, ymin = -22.35, xmax = 166.68, ymax = -22.08), crs = 4326)
) |>
  st_transform(3163)
iris_proj <- iris_raw |>
  transmute(id = codgeo, geometry) |>
  st_transform(3163)
dans_emprise_gn <- lengths(st_intersects(iris_proj, emprise_gn)) > 0
iris_geo <- st_simplify(
  iris_proj,
  dTolerance = ifelse(dans_emprise_gn, 60, 250),
  preserveTopology = TRUE
)
stopifnot(all(st_is_valid(iris_geo)), !any(st_is_empty(iris_geo)))

# Trait de côte crayonné : calculé sur les contours d'origine, puis simplifié.
# Les IRIS de PopGIS ne forment pas un pavage parfait : une dilatation puis une
# érosion de 20 m referment les interstices, qui seraient sinon dessinés comme
# des côtes intérieures. Côte très simplifiée pour la vue d'ensemble ; côte
# fine pour l'agrandissement, découpée 5 km au-delà de l'emprise pour que les
# bords du découpage restent hors de la vue. Les limites communales, sujettes
# aux mêmes interstices, ne sont pas dessinées : la commune figure dans
# l'infobulle de chaque IRIS.
# Seuls les anneaux extérieurs sont gardés : les trous restants (interstices
# plus larges, plans d'eau exclus des IRIS) ne sont pas des côtes.
sans_trous <- function(x) {
  x <- st_cast(x, "MULTIPOLYGON")
  st_sfc(
    lapply(x, function(mp) st_multipolygon(lapply(mp, function(polygone) polygone[1]))),
    crs = st_crs(x)
  )
}
terre <- st_union(st_buffer(iris_proj, 20)) |>
  st_buffer(-20) |>
  sans_trous()
terre_nc <- terre |>
  st_simplify(dTolerance = 400, preserveTopology = TRUE) |>
  st_sf(geometry = _)
terre_gn <- terre |>
  st_intersection(st_buffer(emprise_gn, 5000)) |>
  st_collection_extract("POLYGON") |>
  st_simplify(dTolerance = 60, preserveTopology = TRUE) |>
  st_sf(geometry = _)

# Pas d'option RFC7946 : combinée à l'arrondi, elle transforme quelques IRIS en
# collections de géométries. L'orientation des anneaux est corrigée dans le
# navigateur. Le fichier écrit est relu pour vérifier les types.
geojson_object <- function(x, types) {
  x <- st_transform(x, 4326)
  tmp <- tempfile(fileext = ".geojson")
  on.exit(unlink(tmp), add = TRUE)
  st_write(x, tmp, driver = "GeoJSON", quiet = TRUE, delete_dsn = TRUE,
           layer_options = "COORDINATE_PRECISION=4")
  relu <- st_read(tmp, quiet = TRUE)
  stopifnot(nrow(relu) == nrow(x), all(as.character(st_geometry_type(relu)) %in% types))
  out <- fromJSON(paste(readLines(tmp, encoding = "UTF-8", warn = FALSE), collapse = "\n"),
                  simplifyVector = FALSE)
  # Le pilote GeoJSON nomme la couche d'après le fichier temporaire : ce nom,
  # différent à chaque exécution, n'a pas sa place dans le fichier publié.
  out$name <- NULL
  out
}
surfaces <- c("POLYGON", "MULTIPOLYGON")

iris_props <- iris_data |>
  transmute(
    id, iris, commune, province, grand_noumea, population,
    across(c(pct_hors, pct_metro, pct_wf_pf, pct_etranger, pct_hors_2014), \(x) taux_export(x))
  )
# La carte classe les IRIS sur ces valeurs arrondies : elle doit retrouver les
# IRIS cités dans le texte.
stopifnot(sum(iris_props$pct_metro >= seuil_metro, na.rm = TRUE) == nrow(iris_forte_metro))
iris_bundle <- list(
  iris = geojson_object(iris_geo |> left_join(iris_props, by = "id"), surfaces),
  terre_nc = geojson_object(terre_nc, surfaces),
  terre_gn = geojson_object(terre_gn, surfaces),
  # Vue de l'agrandissement (ouest, sud, est, nord), contenue dans l'emprise
  # simplifiée finement.
  vue_gn = c(166.37, -22.33, 166.60, -22.16)
)
stopifnot(
  iris_bundle$vue_gn[1] > 166.30, iris_bundle$vue_gn[2] > -22.35,
  iris_bundle$vue_gn[3] < 166.68, iris_bundle$vue_gn[4] < -22.08
)
write_json(
  iris_bundle,
  output_path("iris-origines.json"),
  auto_unbox = TRUE,
  digits = NA,
  na = "null"
)
write.csv(iris_props, output_path("iris-origines.csv"), row.names = FALSE, fileEncoding = "UTF-8", na = "")

profils_export <- profils |>
  transmute(
    territoire = recode(territoire, nc = "Nouvelle-Calédonie", sud = "Province Sud"),
    regroupement, groupe, naissance, anciennete,
    indicateur, theme, libelle, champ,
    effectif_champ = n_champ,
    effectif = round(n),
    taux = taux_export(taux),
    taux_age_sexe_identiques = taux_export(taux_std)
  )
write.csv(profils_export, output_path("profils-25-64-ans.csv"), row.names = FALSE, fileEncoding = "UTF-8", na = "")

ecrire_csv <- function(x, fichier) {
  write.csv(x, output_path(fichier), row.names = FALSE, fileEncoding = "UTF-8", na = "")
}
ecrire_csv(
  diplomes_groupes[, .(groupe, diplome, effectif, part = taux_export(part))],
  "diplomes-lieu-naissance.csv"
)
ecrire_csv(
  melt(generations, id.vars = c("classe_age", "groupe", "effectif"),
       variable.name = "indicateur", value.name = "taux", variable.factor = FALSE)[
    , .(classe_age, groupe, indicateur, effectif, taux = taux_export(taux))],
  "generations-diplome.csv"
)
ecrire_csv(
  generations_installation[, .(regroupement, classe_age, naissance, groupe, indicateur, effectif_champ, effectif,
                               taux = taux_export(taux), age_arrivee_median)],
  "generations-installation.csv"
)
ecrire_csv(
  diplome_egal[, .(indicateur, niveau, groupe, effectif_champ, taux = taux_export(taux))],
  "diplome-egal.csv"
)
ecrire_csv(
  logement_provinces[, .(province, groupe, indicateur, effectif_champ, taux = taux_export(taux))],
  "logement-provinces.csv"
)
ecrire_csv(
  pauvrete_bdf |> transmute(categorie, modalite, taux = round(taux, 2)),
  "pauvrete-bdf-2019.csv"
)

# Résumé « En bref » et phrases de l'article ----------------------------------
#
# Les phrases des diapositives et du texte sont vérifiées ci-dessous, dans
# l'ordre de l'article.

brief_bac3_nc <- v(NC, "bac3")
brief_bac3_metro <- v(METRO, "bac3")
brief_bac3_hors <- v(HORS, "bac3")
brief_bac3_wf <- v("Wallis-et-Futuna", "bac3")
brief_bac3_pf <- v("Polynésie française", "bac3")
brief_bac3_etranger <- v("Étranger", "bac3")
brief_chomage_nc <- v(NC, "chomage")
brief_chomage_metro <- v(METRO, "chomage")
brief_chomage_std_nc <- vn(chomage_std, NC)
brief_chomage_std_metro <- vn(chomage_std, METRO)
brief_bac3_metro_recent <- v(oa(METRO, A1519), "bac3")
brief_bac3_metro_ancien <- v(oa(METRO, AV90), "bac3")
# Les installations anciennes concernent des personnes plus âgées : à âge et
# sexe comparables, l'écart entre arrivées récentes et anciennes se réduit.
bac3_metro_recent_std <- v(oa(METRO, A1519), "bac3", col = "taux_std")
bac3_metro_ancien_std <- v(oa(METRO, AV90), "bac3", col = "taux_std")
brief_public_metro_recent <- v(oa(METRO, A1519), "public")
brief_proprio_metro_recent <- v(oa(METRO, A1519), "proprietaire")
brief_proprio_metro_ancien <- v(oa(METRO, AV90), "proprietaire")
# Le croisement génération × installation ne porte que sur les personnes nées
# en métropole : « arrivés avant 16 ans » les désigne.
brief_gen_bac3_enfants <- vgi(ENFANTS, "25-34", "bac3")
brief_gen_bac3_nc <- vgi(NC, "25-34", "bac3")
brief_surpeuplement_nc <- v(NC, "surpeuplement")
brief_surpeuplement_metro <- v(METRO, "surpeuplement")
brief_internet_nc <- v(NC, "sans_internet")
brief_internet_metro <- v(METRO, "sans_internet")
brief_iris_forte_metro <- nrow(iris_forte_metro)

# Figure des écarts : huit indicateurs, dont le sens favorable est connu ; un
# seul (la propriété) à l'avantage des natifs.
indicateurs_ecarts <- c(bac3 = 1, sans_diplome = -1, emploi = 1, chomage = -1, cadres = 1,
                        proprietaire = 1, surpeuplement = -1, sans_internet = -1)
favorable_natifs <- sapply(names(indicateurs_ecarts), \(i) indicateurs_ecarts[[i]] * (v(NC, i) - v(METRO, i)) > 0)
ecarts_metro_8 <- ecarts_metro |> filter(indicateur %in% names(indicateurs_ecarts))
ecart_gap_std_metro <- max(abs(ecarts_metro_8$gap_std - ecarts_metro_8$gap))

# Classes d'âge, génération et date d'installation, diplôme égal, logement.
ecart_bac3_jeunes <- vg("25-34", METRO, "bac3") - vg("25-34", NC, "bac3")
ecart_bac3_aines <- vg("55-64", METRO, "bac3") - vg("55-64", NC, "bac3")
ecart_sans_diplome_jeunes <- vg("25-34", NC, "sans_diplome") - vg("25-34", METRO, "sans_diplome")
ecart_sans_diplome_aines <- vg("55-64", NC, "sans_diplome") - vg("55-64", METRO, "sans_diplome")
ecart_chomage_obs <- vn(chomage_obs, NC) - vn(chomage_obs, METRO)
ecart_chomage_std <- brief_chomage_std_nc - brief_chomage_std_metro
part_ecart_chomage_std <- 100 * ecart_chomage_std / ecart_chomage_obs
ecart_chomage_obs_sud <- vn(chomage_obs_sud, NC) - vn(chomage_obs_sud, METRO)
ecart_chomage_std_sud <- vn(chomage_std_sud, NC) - vn(chomage_std_sud, METRO)
# Personnes nées en métropole de 25 à 34 ans arrivées depuis 2015.
part_recents_25_34 <- 100 * adultes[ILN == 4 & classe_age == "25-34", mean(anciennete == A1519)]
# Part des 25-34 ans nés en métropole arrivés avant 16 ans qui vivent en
# province Sud.
part_sud_enfants_25_34 <- 100 * adultes[ILN == 4 & classe_age == "25-34" & age_arrivee_groupe == ENFANTS,
                                        mean(PROV == "Sud")]
n_metro_iles_logement <- max(logement_provinces$effectif_champ[logement_provinces$province == "Iles" &
                                                                 logement_provinces$groupe == METRO])

stopifnot(
  # Introduction et diapositive 2 : « les deux tiers » des 25-64 ans nés hors
  # du pays sont nés en métropole.
  abs(part_metro_hors - 200 / 3) < 2,
  # 1 Bac +3 « plus de quatre fois » plus fréquent ; la structure par âge et
  #   sexe « ne change presque pas l'écart » (moins d'un point).
  ratio_bac3_metro > 4, ratio_bac3_metro < 5, ratio_bac3_metro_std > 4, ratio_bac3_metro_std < 5,
  abs(ecarts_metro$gap_std[ecarts_metro$indicateur == "bac3"] - ecarts_metro$gap[ecarts_metro$indicateur == "bac3"]) < 1,
  # 2 Bac +3 : Wallis-et-Futuna le plus bas des lieux de naissance, sous les
  #   natifs ; métropole le plus haut ; Polynésie proche des natifs ;
  #   étranger entre les deux.
  brief_bac3_wf == min(profils$taux[profils$territoire == "nc" & profils$regroupement == "naissance" &
                                      profils$indicateur == "bac3"]),
  brief_bac3_metro == max(profils$taux[profils$territoire == "nc" & profils$regroupement == "naissance" &
                                         profils$indicateur == "bac3"]),
  brief_bac3_wf < brief_bac3_nc, abs(brief_bac3_pf - brief_bac3_nc) < 2.5,
  brief_bac3_etranger > brief_bac3_nc, brief_bac3_etranger < brief_bac3_metro,
  # La moyenne des personnes nées hors du pays est tirée vers le haut.
  brief_bac3_hors > brief_bac3_etranger, brief_bac3_hors < brief_bac3_metro,
  # Cadres : métropole au-dessus des natifs, eux-mêmes au-dessus de
  # Wallis-et-Futuna.
  v(METRO, "cadres") > v(NC, "cadres"), v(NC, "cadres") > v("Wallis-et-Futuna", "cadres"),
  # Écarts : sept indicateurs sur huit plus favorables aux personnes nées en
  # métropole ; la structure par âge et sexe change chaque écart de moins de
  # deux points.
  sum(favorable_natifs) == 1, favorable_natifs[["proprietaire"]],
  ecart_gap_std_metro < 2,
  # 3 Chômage « près de cinq fois » plus fréquent chez les natifs.
  brief_chomage_nc / brief_chomage_metro > 4.5, brief_chomage_nc / brief_chomage_metro < 5,
  v(METRO, "emploi") > v(NC, "emploi"),
  # 4 À âge, sexe et diplôme identiques, « plus des deux tiers » de l'écart
  #   observé subsiste ; écart à chaque niveau de diplôme, pour le chômage et
  #   les cadres ; en province Sud aussi.
  part_ecart_chomage_std > 200 / 3, part_ecart_chomage_std < 100,
  all(sapply(diplome_niveaux, \(d) vde("chomage", d, NC) > vde("chomage", d, METRO))),
  all(sapply(diplome_niveaux, \(d) vde("cadres", d, NC) < vde("cadres", d, METRO))),
  ecart_chomage_std_sud > 0, ecart_chomage_std_sud < ecart_chomage_obs_sud,
  # Cadres parmi les salariés bac +3 : les natifs ont moins souvent un bac +5 ;
  # l'ajustement réduit l'écart « sans le faire disparaître ».
  vn(part_bac5, NC) < vn(part_bac5, METRO),
  vn(cadres_bac3_std, NC) < vn(cadres_bac3_std, METRO),
  vn(cadres_bac3_std, METRO) - vn(cadres_bac3_std, NC) < vn(cadres_bac3_obs, METRO) - vn(cadres_bac3_obs, NC),
  # 5 Personnes nées en métropole : plus l'installation est récente, plus le
  #   bac +3 est fréquent ; même installées avant 1990, « près de quatre fois »
  #   les natifs ; progression plus forte parmi les personnes nées à
  #   l'étranger, absente parmi celles nées à Wallis-et-Futuna.
  all(diff(sapply(periodes, \(p) v(oa(METRO, p), "bac3"))) < 0),
  all(sapply(periodes, \(p) v(oa(METRO, p), "bac3")) > 3.5 * brief_bac3_nc),
  brief_bac3_metro_ancien / brief_bac3_nc > 3.5, brief_bac3_metro_ancien / brief_bac3_nc < 4,
  # À âge et sexe comparables, l'écart entre arrivées récentes et anciennes
  # « se réduit » sans s'inverser.
  bac3_metro_ancien_std > brief_bac3_metro_ancien,
  bac3_metro_recent_std - bac3_metro_ancien_std > 0,
  bac3_metro_recent_std - bac3_metro_ancien_std < brief_bac3_metro_recent - brief_bac3_metro_ancien,
  v(oa("Étranger", A1519), "bac3") - v(oa("Étranger", AV90), "bac3") > brief_bac3_metro_recent - brief_bac3_metro_ancien,
  abs(v(oa("Wallis-et-Futuna", A1519), "bac3") - v(oa("Wallis-et-Futuna", AV90), "bac3")) < 2,
  # Arrivées de 2015-2019 : secteur public au-dessus des natifs, propriété rare,
  # contrairement aux installations d'avant 1990.
  brief_public_metro_recent > v(NC, "public") + 15,
  brief_proprio_metro_recent < 15, brief_proprio_metro_ancien > 70,
  # « Près d'une » personne née en métropole « sur cinq » sans année
  # d'installation.
  part_metro_sans_annee > 17, part_metro_sans_annee < 20.5,
  # Classes d'âge : écart d'absence de diplôme plus faible chez les 25-34 ans,
  # écart de bac +3 plus large.
  ecart_sans_diplome_jeunes < ecart_sans_diplome_aines,
  ecart_bac3_jeunes > ecart_bac3_aines,
  # 6 25-34 ans nés en métropole arrivés avant 16 ans : bac +3 « près de quatre
  #   fois » plus fréquent que chez les natifs du même âge, chômage bien plus
  #   faible ; la plupart vivent en province Sud, où l'écart demeure.
  brief_gen_bac3_enfants / brief_gen_bac3_nc > 3.5, brief_gen_bac3_enfants / brief_gen_bac3_nc < 4,
  vgi(NC, "25-34", "chomage") > 3 * vgi(ENFANTS, "25-34", "chomage"),
  vgi(ENFANTS, "25-34", "bac3", "effectif_champ") >= 200,
  part_sud_enfants_25_34 > 75,
  vcs(ENFANTS, "bac3") > 2.5 * vcs(NC, "bac3"),
  # 7 Logement : natifs plus souvent en logement surpeuplé ou sans internet,
  #   mais plus souvent propriétaires ; même parmi les ménages propriétaires,
  #   plus de surpeuplement. Géographie : un tiers des natifs hors du Sud,
  #   moins d'une personne née en métropole sur dix. En province Sud,
  #   surpeuplement « trois fois », internet « plus de six fois ».
  brief_surpeuplement_nc > brief_surpeuplement_metro, brief_internet_nc > brief_internet_metro,
  # Diapositive 7 : surpeuplement « près de quatre fois » plus fréquent.
  brief_surpeuplement_nc / brief_surpeuplement_metro > 3.5,
  brief_surpeuplement_nc / brief_surpeuplement_metro < 4,
  v(NC, "proprietaire") > v(METRO, "proprietaire"),
  # En province Sud, l'avantage des natifs pour la propriété est « bien plus
  # faible » (moins de la moitié de l'écart du pays).
  v(NC, "proprietaire", "sud") > v(METRO, "proprietaire", "sud"),
  v(NC, "proprietaire", "sud") - v(METRO, "proprietaire", "sud") <
    (v(NC, "proprietaire") - v(METRO, "proprietaire")) / 2,
  vsp(NC) > 2 * vsp(METRO),
  part_natifs_hors_sud > 30, part_metro_hors_sud < 10,
  vl("Sud", NC, "surpeuplement") / vl("Sud", METRO, "surpeuplement") > 2.8,
  vl("Sud", NC, "surpeuplement") / vl("Sud", METRO, "surpeuplement") < 3.4,
  vl("Sud", NC, "sans_internet") / vl("Sud", METRO, "sans_internet") > 6,
  # 8 Quartiers : la dissimilarité avec les natifs est plus forte pour les
  #   personnes nées en métropole que pour les autres lieux de naissance ;
  #   les IRIS à au moins 40 % de personnes nées en métropole sont tous à
  #   Nouméa, au nombre de dix au plus (écrit en lettres).
  dissim_metro > dissim_wf_pf, dissim_metro > dissim_etranger,
  # Entre les seuls IRIS de Nouméa, l'indice « atteint » au moins le niveau
  # du pays.
  dissim_metro_noumea >= dissim_metro,
  # IRIS à moins de 2 % de personnes nées en métropole : la plupart hors de
  # la province Sud.
  n_faible_metro_hors_sud > nrow(iris_faible_metro) / 2,
  brief_iris_forte_metro >= 2, brief_iris_forte_metro <= 10,
  all(iris_forte_metro$commune == "Nouméa"),
  nrow(iris_majorite_metro) >= 2, nrow(iris_majorite_metro) <= 10,
  part_metro_dans_forte > 3 * part_nc_dans_forte,
  # Revenus (enquête BDF) : le seuil d'une personne seule est la moitié du
  # niveau de vie médian.
  abs(mediane_ensemble / 2 - seuil_personne_seule) < 1
)
