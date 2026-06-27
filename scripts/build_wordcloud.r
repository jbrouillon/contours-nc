suppressPackageStartupMessages({
  library(dplyr)
  library(forcats)
  library(ggplot2)
  library(ggwordcloud)
  library(purrr)
  library(readr)
  library(scales)
  library(SnowballC)
  library(stringi)
  library(stringr)
  library(tibble)
  library(tidyr)
  library(tidytext)
})

find_project_root <- function(path = getwd()) {
  path <- normalizePath(path, winslash = "/", mustWork = TRUE)
  repeat {
    if (file.exists(file.path(path, "_quarto.yml"))) return(path)
    parent <- dirname(path)
    if (identical(parent, path)) stop("Racine du projet Quarto introuvable.")
    path <- parent
  }
}

shade_color <- function(hex, amount = 0) {
  rgb <- grDevices::col2rgb(hex)
  target <- if (amount >= 0) matrix(255, nrow = 3) else matrix(0, nrow = 3)
  mixed <- round(rgb + (target - rgb) * abs(amount))
  grDevices::rgb(mixed[1], mixed[2], mixed[3], maxColorValue = 255)
}

project_dir <- find_project_root()

raw_dir <- file.path(
  project_dir, "data", "elections", "data_raw", "provinciales_2026",
  "propagande_electronique"
)

processed_dir <- file.path(
  project_dir, "data", "elections", "data_processed", "provinciales_2026",
  "propagande_electronique"
)

manifest_path <- file.path(raw_dir, "manifest.csv")
corpus_path <- file.path(processed_dir, "corpus_ocr.csv")

reference_path <- file.path(
  project_dir, "data", "outputs_provinciales_candidats",
  "provinciales_referentiel_listes_politiques_2019_2026.csv"
)

candidates_path <- file.path(
  project_dir, "data", "outputs_provinciales_candidats",
  "provinciales_candidats_2019_2026_qualifies.csv"
)

output_dir <- file.path(
  project_dir, "data", "outputs_provinciales_2026", "wordclouds_listes"
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

required_files <- c(manifest_path, corpus_path, reference_path, candidates_path)
missing_files <- required_files[!file.exists(required_files)]

if (length(missing_files)) {
  stop("Fichiers manquants :\n", paste(missing_files, collapse = "\n"))
}

province_levels <- c(
  "Province Sud", "Province Nord", "Province des Îles Loyauté"
)

province_short <- c(
  "Province Sud" = "Sud",
  "Province Nord" = "Nord",
  "Province des Îles Loyauté" = "Îles Loyauté"
)

manifest <- read_csv(manifest_path, show_col_types = FALSE) |>
  mutate(
    province = factor(province, levels = province_levels),
    province_slug = case_when(
      province == "Province Sud" ~ "province-sud",
      province == "Province Nord" ~ "province-nord",
      TRUE ~ "iles-loyaute"
    ),
    document_id = paste(province_slug, sprintf("%02d", numero_liste), sep = "_")
  )

corpus <- read_csv(corpus_path, show_col_types = FALSE) |>
  select(document_id, text)

missing_texts <- manifest |>
  anti_join(corpus, by = "document_id") |>
  pull(document_id)

if (length(missing_texts)) {
  stop(
    "Documents absents du corpus OCR :\n",
    paste(missing_texts, collapse = "\n")
  )
}

reference <- read_csv(reference_path, show_col_types = FALSE) |>
  filter(annee == 2026) |>
  mutate(
    province_officielle = recode(
      province,
      "Province des Iles" = "Province des Îles Loyauté"
    ),
    province_officielle = factor(province_officielle, levels = province_levels)
  ) |>
  select(
    province = province_officielle,
    numero_liste,
    liste_nom_reference = liste_nom,
    liste_nom_court,
    axe_politique,
    axe_politique_ordre
  )

axis_palette <- c(
  "Independantiste UC-FLNKS" = "#007a3d",
  "Autres independantistes" = "#b6483b",
  "Independantiste UNI / Palika" = "#f0c52f",
  "Souverainiste / pro-pays" = "#4f8f6a",
  "Oceanien / transversal" = "#8b5fbf",
  "Centre non-independantiste" = "#2f8fb8",
  "Loyaliste droite" = "#305f9f",
  "Droite nationale anti-independantiste" = "#7a4a28",
  "A preciser" = "#8d99a6"
)

list_colors <- read_csv(reference_path, show_col_types = FALSE) |>
  filter(annee == 2026) |>
  mutate(
    province = recode(
      province,
      "Province des Iles" = "Province des Îles Loyauté"
    ),
    province = factor(province, levels = province_levels),
    axe = coalesce(axe_politique, "A preciser"),
    base_color = coalesce(axis_palette[axe], "#8d99a6")
  ) |>
  arrange(province, axe_politique_ordre, numero_liste) |>
  group_by(province, axe) |>
  mutate(
    shade = if (n() == 1L) 0 else seq(-0.18, 0.24, length.out = n()),
    liste_color = mapply(shade_color, base_color, shade, USE.NAMES = FALSE)
  ) |>
  ungroup() |>
  select(province, numero_liste, liste_color)

documents <- manifest |>
  left_join(corpus, by = "document_id") |>
  left_join(reference, by = c("province", "numero_liste")) |>
  left_join(list_colors, by = c("province", "numero_liste")) |>
  mutate(
    liste_color = coalesce(liste_color, "#8d99a6"),
    liste_nom_court = coalesce(liste_nom_court, liste_nom_reference, liste_nom),
    liste_nom_court = liste_nom_court |>
      str_replace_all(fixed("Caledonie"), "Calédonie") |>
      str_replace_all(fixed("francaise"), "française") |>
      str_replace_all(fixed("reunis"), "réunis") |>
      str_replace_all(fixed("Iles"), "Îles"),
    mots_ocr = str_count(text, boundary("word")),
    province_label = unname(province_short[as.character(province)])
  )

fr_stopwords <- str_split(
  paste(
    "a afin ai ainsi alors apres as assez au aucun aucune aujourd hui auquel aura",
    "aurait auront aux avec avez avons ayant beaucoup bien bon car ce ceci cela celle",
    "celles celui ceux chaque chez comme comment contre d dans de dedans dehors deja",
    "depuis des deux devrait doit donc dont du elle elles en encore entre est et etaient",
    "etait etant ete etre eu eux fait faites fois font hors ici il ils je jusque la laquelle",
    "le les leur leurs lui ma mais me meme mes mien moins mon ne ni nos notre nous on ont",
    "ou oui par parce pas pendant peut peu plus pour pourquoi quand que quel quelle quelles",
    "quels qui sa sans se sera seront ses si soi soit son sont sous sur ta tandis te tel telle",
    "tes toi ton tous tout toute toutes tres trop tu un une vos votre vous y",
    "cette ces aussi autre autres avant avoir vers entre faire faut pouvoir",
    "mettre prendre donner aller venir permettre depuis afin autour devant nouveau nouvelle",
    "caledonie caledonien caledonienne province provincial provinciale provinciales election",
    "elections scrutin juin liste listes candidat candidate candidats candidates numero vote",
    "voter bulletin programme projet projets proposition propositions page president presidente",
    "pouvons voulons devons souhaitons soutiendrons promettons agir moyens action bonne",
    "cest nest quil tre see esl men pen pee aujourd'hui votez voter cet",
    "chers cher chacune chacun dimanche faisons habitant habitants notamment",
    "actuel actuelle assumer attente charge demontrer demontre devoir devons doivent egalement lieu mise",
    "nouveau nouvelle petit petite personne prochain sujet suite temps veut vouloir voulons",
    "trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize",
    sep = " "
  ),
  "\\s+"
)[[1]] |>
  unique()

candidate_stopwords <- read_csv(candidates_path, show_col_types = FALSE) |>
  filter(annee == 2026) |>
  pull(nom_prenoms) |>
  stri_trans_general("Latin-ASCII") |>
  str_to_lower() |>
  str_extract_all("[a-z]{3,}") |>
  unlist() |>
  unique()

list_stopwords <- documents$liste_nom_court |>
  stri_trans_general("Latin-ASCII") |>
  str_to_lower() |>
  str_extract_all("[a-z]{3,}") |>
  unlist() |>
  unique()

geographic_stopwords <- c(
  "belep", "boulouparis", "bourail", "canala", "dore", "dumbea", "farino",
  "djubea", "hienghene", "houailou", "ile", "iles", "kaala-gomen", "kapone",
  "kone", "koumac", "lafoa", "lifou", "loyaute", "mare", "moindou",
  "mont", "mont-dore", "nord", "noumea", "ouegoa", "ouvea", "paita",
  "poindimie", "pouebo", "pouembout", "poum", "poya", "sarramea",
  "sud", "thio", "tiga", "touho", "voh", "yate", "foa"
)

biographical_stopwords <- c(
  "adjoint", "adjointe", "ancien", "ancienne", "celibataire", "conseil",
  "directeur", "directrice", "enfant", "enfants", "epouse", "fonction",
  "maire", "marie", "mariee", "membre", "profession", "retraite", "retraitee",
  "rueru"
)

ocr_noise_words <- c(
  "are", "bre", "eee", "een", "ens", "ere", "esler", "fagufagumana",
  "ire", "mnt", "nan", "ous", "pres", "res", "rte", "sea", "see",
  "sre", "unpays", "wus", "yesles"
)

all_stopwords <- unique(c(
  fr_stopwords,
  candidate_stopwords,
  list_stopwords,
  geographic_stopwords,
  biographical_stopwords,
  ocr_noise_words
))

all_stopword_stems <- unique(wordStem(all_stopwords, language = "french"))

tokens_before_stopwords <- documents |>
  select(document_id, province, numero_liste, liste_nom_court, text) |>
  mutate(page_text = str_split(text, "\\s*--- PAGE ---\\s*")) |>
  select(-text) |>
  unnest_longer(page_text, indices_to = "page_ocr") |>
  unnest_tokens(word, page_text, token = "words", to_lower = TRUE) |>
  mutate(
    word_clean = word |>
      str_replace_all("[’`´]", "'") |>
      str_replace("^(l|d|qu|n|s|c|j|t|m)'", ""),
    word_ascii = word_clean |>
      stri_trans_general("Latin-ASCII") |>
      str_replace_all("[^a-z'-]", "") |>
      str_replace_all("(^[-']+|[-']+$)", ""),
    stem = wordStem(word_ascii, language = "french")
  ) |>
  filter(
    str_detect(word_ascii, "^[a-z][a-z'-]+$"),
    between(nchar(word_ascii), 3, 24),
    !str_detect(word_ascii, "(.)\\1{3,}")
  )

tokens <- tokens_before_stopwords |>
  filter(
    !word_ascii %in% all_stopwords,
    !stem %in% all_stopword_stems
  )

cloud_tokens <- tokens |>
  filter(
    !(document_id == "province-sud_05" & page_ocr > 1),
    !(document_id == "iles-loyaute_02" & page_ocr == 1),
    !(
      document_id == "province-sud_05" &
        word_ascii %in% c(
          "assemblee", "assemblees", "congres", "coutumier",
          "environnement", "haut", "senateur"
        )
    )
  )

theme_dictionary <- tribble(
  ~theme, ~terms,
  "Avenir institutionnel", paste(
    "accord avenir institution statut souverain souverainete independance independant",
    "emancipation autodetermination kanaky france francais republique destin pays"
  ),
  "Économie et emploi", paste(
    "economie economique emploi travail entreprise entreprendre investissement investir",
    "relance reconstruction pouvoir achat cher fiscal taxe nickel mine industrie commerce",
    "tourisme revenu salaire cout activite"
  ),
  "Santé et solidarités", paste(
    "sante soin medecin hopital dispensaire social solidarite retraite handicap pauvrete",
    "protection famille enfance femme inegalite aide mutuelle accompagnement"
  ),
  "Jeunesse et formation", paste(
    "jeunesse jeune ecole education enseignement formation lycee etudiant apprentissage",
    "insertion competence diplome"
  ),
  "Environnement et énergie", paste(
    "environnement ecologie climat biodiversite energie renouvelable solaire eau dechet",
    "pollution nature ressource durable assainissement"
  ),
  "Agriculture et alimentation", paste(
    "agriculture agricole agriculteur peche elevage alimentation alimentaire foncier terre",
    "autosuffisance production local maraichage"
  ),
  "Mobilités, logement et numérique", paste(
    "transport route mobilite logement habitat aerien maritime continuite desserte internet",
    "numerique infrastructure equipement amenagement aeroport port"
  ),
  "Culture, identité et coutume", paste(
    "culture culturel coutume coutumier identite langue patrimoine tradition clan chefferie",
    "autochtone kanak oceanien memoire"
  ),
  "Gouvernance et démocratie", paste(
    "gouvernance gestion transparence participation citoyen democratie proximite commune",
    "decentralisation administration reforme corruption dialogue consensus responsabilite"
  ),
  "Sécurité et justice", paste(
    "securite delinquance violence justice ordre prison incivilite police gendarmerie",
    "narcotrafic drogue"
  ),
  "Cohésion et paix", paste(
    "paix unite unir rassemblement reconciliation cohesion racisme haine fraternite",
    "vivre ensemble commun partage confiance respect"
  )
) |>
  separate_rows(terms, sep = "\\s+") |>
  mutate(stem = wordStem(terms, language = "french")) |>
  distinct(theme, stem)

term_representatives <- cloud_tokens |>
  count(stem, word_clean, sort = TRUE) |>
  mutate(
    has_accent = str_detect(
      word_clean,
      "[àâäçéèêëîïôöùûüÿœæ]"
    )
  ) |>
  arrange(stem, desc(n), desc(has_accent), nchar(word_clean), word_clean) |>
  group_by(stem) |>
  slice_head(n = 1) |>
  ungroup() |>
  transmute(stem, mot = word_clean)

global_stem_frequency <- cloud_tokens |>
  count(stem, name = "n_global")

n_documents_total <- n_distinct(cloud_tokens$document_id)
province_document_counts <- documents |>
  count(province, name = "n_documents_province")

cloud_terms <- cloud_tokens |>
  count(province, document_id, stem, name = "n") |>
  left_join(global_stem_frequency, by = "stem") |>
  left_join(province_document_counts, by = "province") |>
  group_by(province, document_id) |>
  mutate(tf = n / sum(n)) |>
  group_by(province, stem) |>
  mutate(
    document_frequency = n_distinct(document_id),
    idf = log(n_documents_province / document_frequency)
  ) |>
  ungroup() |>
  filter(
    n >= 2 | n_global >= 4,
    idf > 0
  ) |>
  mutate(
    score = tf * idf * log1p(n) *
      if_else(stem %in% theme_dictionary$stem, 1.35, 1)
  ) |>
  left_join(term_representatives, by = "stem") |>
  left_join(
    documents |>
      select(
        document_id,
        province,
        province_label,
        numero_liste,
        liste_nom_court,
        liste_color
      ),
    by = c("document_id", "province")
  ) |>
  group_by(document_id) |>
  slice_max(score, n = 22, with_ties = FALSE) |>
  arrange(desc(score), .by_group = TRUE) |>
  mutate(
    rang = row_number(),
    poids_relatif = score / max(score),
    mot_color = mapply(
      shade_color,
      liste_color,
      0.46 * (1 - poids_relatif),
      USE.NAMES = FALSE
    ),
taille = 10 + 18 * ((22 - rang) / 21)^0.65  ) |>
  ungroup()

plot_wordcloud_liste <- function(document) {
  dat <- cloud_terms |>
    filter(document_id == document)

  if (nrow(dat) == 0) {
    stop("Aucun mot disponible pour : ", document)
  }

  meta <- dat |>
    distinct(province_label, numero_liste, liste_nom_court, liste_color) |>
    slice(1)

  ggplot(dat, aes(label = mot, size = taille, colour = mot_color)) +
    geom_text_wordcloud_area(
      seed = 2026,
      eccentricity = 0.55,
      rm_outside = TRUE,
      grid_size = 5
    ) +
    scale_size_identity() +
    scale_colour_identity() +
    labs(
      title = paste0("Liste ", meta$numero_liste, " — ", meta$liste_nom_court),
      subtitle = paste0(
        "Province ", meta$province_label,
        " · mots les plus spécifiques de la profession de foi"
      ),
      caption = "contours.nc · Professions de foi des provinciales 2026"
    ) +
    theme_void(base_size = 12) +
    theme(
      plot.background = element_rect(fill = "white", colour = NA),
      plot.margin = margin(14, 18, 14, 18),
      plot.title = element_text(
        colour = "#24211d",
        face = "bold",
        size = 18,
        hjust = 0.5,
        margin = margin(b = 4)
      ),
      plot.subtitle = element_text(
        colour = "#65615a",
        size = 10.5,
        hjust = 0.5,
        margin = margin(b = 10)
      ),
      plot.caption = element_text(
        colour = "#777169",
        size = 8.5,
        hjust = 1,
        margin = margin(t = 8)
      )
    )
}

safe_filename <- function(x) {
  x |>
    stri_trans_general("Latin-ASCII") |>
    str_to_lower() |>
    str_replace_all("[^a-z0-9]+", "-") |>
    str_replace_all("(^-|-$)", "")
}

export_table <- cloud_terms |>
  distinct(document_id, province_label, numero_liste, liste_nom_court) |>
  arrange(province_label, numero_liste) |>
  mutate(
    filename = paste0(
      safe_filename(document_id),
      "_",
      safe_filename(liste_nom_court),
      ".png"
    ),
    path = file.path(output_dir, filename)
  )

walk2(export_table$document_id, export_table$path, function(id, path) {
  p <- plot_wordcloud_liste(id)

  ggsave(
    filename = path,
    plot = p,
    width = 6,
    height = 6,
    dpi = 300,
    bg = "white"
  )
})

write_csv(
  export_table,
  file.path(output_dir, "index_wordclouds_listes.csv")
)

message("Nuages de mots exportés dans : ", output_dir)