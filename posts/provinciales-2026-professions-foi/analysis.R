suppressPackageStartupMessages({
  library(dplyr)
  library(forcats)
  library(ggplot2)
  library(ggwordcloud)
  library(htmltools)
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

fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}

fmt_pct <- function(x, digits = 1) {
  paste0(fmt_num(x, digits), " %")
}

theme_set(theme_minimal(base_size = 12))
theme_update(
  plot.margin = margin(10, 18, 16, 10),
  legend.position = "bottom",
  legend.box = "vertical"
)

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
    "Documents absents du corpus OCR :\n", paste(missing_texts, collapse = "\n"),
    "\nExécuter scripts/extract_propagande_provinciales_2026.R."
  )
}

reference <- read_csv(reference_path, show_col_types = FALSE) |>
  filter(annee == 2026) |>
  mutate(
    province_officielle = recode(
      province,
      "Province des Iles" = "Province des Îles Loyauté"
    ),
    province_officielle = factor(province_officielle, levels = province_levels),
    camp_affichage = case_when(
      str_detect(camp_institutionnel, regex("^Independantiste", ignore_case = TRUE)) ~
        "Indépendantiste / souverainiste",
      str_detect(camp_institutionnel, regex("^Non-independantiste", ignore_case = TRUE)) ~
        "Non-indépendantiste",
      TRUE ~ "Transversal / pro-pays"
    )
  ) |>
  select(
    province = province_officielle, numero_liste, liste_nom_reference = liste_nom,
    liste_nom_court, camp_affichage
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

shade_color <- function(hex, amount = 0) {
  rgb <- grDevices::col2rgb(hex)
  target <- if (amount >= 0) matrix(255, nrow = 3) else matrix(0, nrow = 3)
  mixed <- round(rgb + (target - rgb) * abs(amount))
  grDevices::rgb(mixed[1], mixed[2], mixed[3], maxColorValue = 255)
}

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
    liste_nom_court = coalesce(liste_nom_court, liste_nom),
    liste_nom_court = liste_nom_court |>
      str_replace_all(fixed("Caledonie"), "Calédonie") |>
      str_replace_all(fixed("francaise"), "française") |>
      str_replace_all(fixed("reunis"), "réunis") |>
      str_replace_all(fixed("Iles"), "Îles"),
    mots_ocr = str_count(text, boundary("word")),
    caracteres_ocr = nchar(text),
    province_label = unname(province_short[as.character(province)])
  )

missing_lists <- reference |>
  anti_join(documents, by = c("province", "numero_liste")) |>
  arrange(province, numero_liste)

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
    "cette ces cette ceux aussi autre autres avant avoir vers entre faire faut pouvoir",
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

list_stopwords <- documents$liste_nom |>
  stri_trans_general("Latin-ASCII") |>
  str_to_lower() |>
  str_extract_all("[a-z]{3,}") |>
  unlist() |>
  unique()

geographic_stopwords <- c(
  "belep", "boulouparis", "bourail", "canala", "dore", "dumbea", "farino",
  "djubea", "hienghene", "houailou", "ile", "iles", "kaala-gomen", "kapone", "kone", "koumac",
  "lafoa", "lifou", "loyaute", "mare", "moindou", "mont", "mont-dore", "nord", "noumea",
  "ouegoa", "ouvea", "paita", "poindimie", "pouebo", "pouembout", "poum",
  "poya", "sarramea", "sud", "thio", "tiga", "touho", "voh", "yate", "foa"
)

biographical_stopwords <- c(
  "adjoint", "adjointe", "ancien", "ancienne", "celibataire", "conseil",
  "directeur", "directrice", "enfant", "enfants", "epouse", "fonction",
  "maire", "marie", "mariee", "membre", "profession", "retraite", "retraitee",
  "rueru"
)

# Formes confirmees comme artefacts apres retour au PDF ou au contexte OCR.
# Elles sont conservees ici pour que le nettoyage reste visible et reproductible.
ocr_noise_words <- c(
  "are", "bre", "eee", "een", "ens", "ere", "esler", "fagufagumana", "ire",
  "mnt", "nan", "ous", "pres", "res", "rte", "sea", "see", "sre", "unpays", "wus",
  "yesles"
)

all_stopwords <- unique(c(
  fr_stopwords, candidate_stopwords, list_stopwords, geographic_stopwords,
  biographical_stopwords, ocr_noise_words
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

noise_tokens <- tokens_before_stopwords |>
  filter(word_ascii %in% ocr_noise_words)

tokens <- tokens_before_stopwords |>
  filter(
    !word_ascii %in% all_stopwords,
    !stem %in% all_stopword_stems
  )

# Deux mises en page exigent une restriction explicite pour les nuages : la
# seconde page de Sud 05 est une galerie de biographies, et la premiere page
# d'Iles 02 est presque exclusivement la liste des candidats.
cloud_tokens <- tokens |>
  filter(
    !(document_id == "province-sud_05" & page_ocr > 1),
    !(document_id == "iles-loyaute_02" & page_ocr == 1),
    !(
      document_id == "province-sud_05" &
        word_ascii %in% c(
          "assemblee", "assemblees", "congres", "coutumier", "environnement", "haut", "senateur"
        )
    )
  )

token_totals <- tokens |>
  count(document_id, name = "mots_analyses")

documents <- documents |>
  left_join(token_totals, by = "document_id")

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
      word_clean, "[àâäçéèêëîïôöùûüÿœæ]"
    )
  ) |>
  arrange(stem, desc(n), desc(has_accent), nchar(word_clean), word_clean) |>
  group_by(stem) |>
  slice_head(n = 1) |>
  ungroup() |>
  transmute(stem, mot = word_clean)

global_stem_frequency <- cloud_tokens |>
  count(stem, name = "n_global")

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
    score = tf * idf * log1p(n) * if_else(
      stem %in% theme_dictionary$stem, 1.35, 1
    )
  ) |>
  left_join(term_representatives, by = "stem") |>
  left_join(
    documents |>
      select(document_id, numero_liste, liste_nom_court, liste_color),
    by = "document_id"
  ) |>
  group_by(document_id) |>
  slice_max(score, n = 16, with_ties = FALSE) |>
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
    # Une echelle par rang evite que les petits textes paraissent vides quand
    # un ou deux mots ecrasent tous les autres en score TF-IDF.
    taille = 6.4 + 8.0 * ((16 - rang) / 15)^0.65,
    liste_facette = str_wrap(
      paste0(numero_liste, ". ", liste_nom_court), width = 30
    )
  ) |>
  ungroup()

editorial_profiles <- tribble(
  ~document_id, ~angle, ~themes, ~mesure1, ~mesure2, ~mesure3, ~precision,
  "province-sud_01", "Sortir de la logique des blocs par la paix sociale, la participation citoyenne et une refonte économique et sociale.", "Cohésion et dialogue|Urgence sociale|Réforme fiscale|Démocratie participative", "Aménagements temporaires de fiscalité et de cotisations pour le pouvoir d’achat et la relance des entreprises.", "Rétablissement d’aides sociales ciblées, évaluées et concentrées sur les ménages précaires.", "Assemblées citoyennes et réforme du système fiscal et social avec les partenaires sociaux.", "Mesures identifiées",
  "province-sud_02", "Faire du bouclier social, de l’emploi local et de la jeunesse les bases d’une accession préparée à la pleine souveraineté.", "Vie chère|Protection sociale|Jeunesse et insertion|Souveraineté", "Rétablir les aides supprimées, créer un bouclier prix famille-retraité et un plan « manger local et moins cher ».", "Tarification provinciale aidée, voire gratuite, pour les transports et renforcement des aides au logement et à l’accession.", "Clauses sociales dans les marchés publics, parcours d’insertion, travail alternatif payé à la journée et aide au permis.", "Mesures détaillées",
  "province-sud_03", "Une relance fortement adossée à l’État, associée à la fermeté sécuritaire, au nucléaire civil et à l’ancrage français.", "Relance et BTP|Sécurité|Énergie nucléaire|Ancrage français", "Prêts garantis par l’État, fonds de reconstruction de 8 milliards de F CFP et priorité locale dans les marchés publics.", "Petits réacteurs nucléaires modulaires, avec une baisse annoncée de 30 % de l’électricité des ménages et 40 % pour l’industrie lourde.", "Nouveau centre pénitentiaire, brigades territoriales de la jeunesse et service civique obligatoire pour les jeunes déscolarisés.", "Mesures détaillées",
  "province-sud_05", "Réunir province inclusive, solidarité entre les trois provinces et poursuite négociée de l’émancipation.", "Solidarité territoriale|Réduction des inégalités|Vivre-ensemble|Émancipation négociée", "Engager les négociations institutionnelles dès le lendemain du scrutin.", "Revisiter progressivement le lien avec la France et l’Europe dans la continuité des accords de Matignon et de Nouméa.", "Restaurer le développement économique tout en réduisant les inégalités et en soutenant les créateurs de richesse.", "Orientations générales",
  "province-sud_07", "Articuler dignité quotidienne, institutions moins coûteuses et souveraineté construite progressivement et en partenariat.", "Pouvoir d’achat|Services essentiels|Institutions|Souveraineté par étapes", "Rétablir les aides à la scolarité, à la cantine et au transport, avec un Pass Mobilité accessible à tous.", "Rétablir une couverture médicale gratuite et alléger les charges pesant sur le travail.", "Rendre les institutions plus efficaces et moins coûteuses, et préparer une souveraineté partagée étape par étape.", "Mesures identifiées",
  "province-sud_08", "Associer autorité, maintien français, solidarité conditionnée et soutien au monde rural et à la propriété.", "Sécurité et autorité|Vie chère|Citoyenneté|Monde rural", "Fermeté contre les violences et trafics, justice accélérée et action ciblée sur la délinquance des mineurs.", "Bouclier alimentaire local, lutte contre les monopoles et aides ciblées aux ménages.", "Service civique et Contrat Premier Emploi, plan Habitat Digne et développement de la médecine mobile.", "Mesures identifiées",
  "province-sud_09", "Reconstruire avant de trancher l’institutionnel, avec des mesures immédiates sur les prix, les transports et la production locale.", "Vie chère|Entreprises|Production locale|Gouvernance", "Baisser le prix d’un panier de produits essentiels, fixer le ticket Tanéo à 200 F et agir sur le carburant.", "Simplifications fiscales, meilleur accès à la commande publique et réduction des délais de paiement des entreprises.", "Demi-part fiscale supplémentaire pour les anciens, fonds pour la production locale et développement agricole sur terres coutumières.", "Mesures détaillées",
  "province-sud_10", "Un programme de rupture libérale : sécurité, baisse des prélèvements, réduction des dépenses publiques et accession à la propriété.", "Sécurité|Fiscalité|Entreprises|Propriété", "Tolérance zéro, moyens supplémentaires pour les forces de l’ordre et responsabilisation parentale.", "Suppression des droits de succession, baisse des impôts et du coût du travail, prolongation de Sud Relance.", "Suppression des droits de douane australiens et néo-zélandais ; arrêt des nouveaux logements sociaux et conversion d’une partie en accession.", "Mesures détaillées",
  "province-sud_11", "Une province sociale et de proximité, fondée sur le diagnostic territorial et une souveraineté en partenariat avec la France.", "Solidarité|Logement et santé|Économie locale|Souveraineté partenariale", "Diagnostic social et territorial dans quartiers, squats, villages et tribus, et étude d’un revenu de solidarité citoyenne.", "Plan progressif de résorption des squats avec relogement, poursuite de Do Kamo et action sur santé mentale et addictions.", "Soutien aux sites miniers, aux TPE et à l’économie coutumière, réorganisation des transports et réduction de la fracture numérique.", "Mesures identifiées",
  "province-sud_12", "Rétablir la confiance par un pacte de stabilité, la simplification économique et l’exemplarité des responsables publics.", "Stabilité institutionnelle|Économie|Pouvoir d’achat|Exemplarité publique", "Reprendre les discussions pour conclure un pacte de stabilité donnant de la visibilité aux ménages et aux investisseurs.", "Réduire doublons et dépenses publiques, élaborer une stratégie nickel et baisser durablement le coût de l’énergie.", "Agir sur transports, cantines, logement et produits essentiels, tout en renforçant formation professionnelle et passerelles vers l’emploi.", "Mesures identifiées",
  "province-nord_01", "Une union non-indépendantiste centrée sur la rigueur financière, la reprise économique et les services de proximité.", "Finances provinciales|Économie et mines|Jeunesse|Santé de proximité", "Préserver les services essentiels, les aides aux communes et les investissements utiles par une gestion financière rigoureuse.", "Soutenir entreprises, agriculture, pêche, tourisme et reprise minière et métallurgique.", "Renforcer formation, apprentissage et insertion, ainsi que les soins dans les communes éloignées.", "Orientations générales",
  "province-nord_02", "Renouveler l’ensemble des politiques provinciales tout en préparant le transfert des compétences et la pleine souveraineté.", "Politiques publiques|Jeunesse|Culture et interculturalité|Pleine souveraineté", "Renforcer santé, solidarité, enseignement, activités socio-éducatives, sport et culture.", "Développer formation et insertion des jeunes, condition féminine, économie et protection environnementale.", "Poursuivre les transferts de compétences et les négociations vers la pleine souveraineté, avec des réformes limitant la dette future.", "Orientations générales",
  "province-nord_03", "Relancer l’économie du Nord autour de Koniambo, du désenclavement et d’une gouvernance provinciale plus contrôlable.", "Usine du Nord|Services de proximité|Désenclavement|Gouvernance", "Copiloter la reprise de l’Usine du Nord, diversifier les filières et accompagner les porteurs de projets.", "Sanctuariser la santé, restaurer les dispositifs jeunesse et agir sur numérique, eau, énergie et désenclavement.", "Publier une feuille de route et des comptes rendus annuels, simplifier les démarches et conduire réforme fiscale et redressement financier.", "Mesures identifiées",
  "province-nord_04", "Articuler dignité quotidienne, institutions moins coûteuses et souveraineté construite progressivement et en partenariat.", "Pouvoir d’achat|Services essentiels|Institutions|Souveraineté par étapes", "Rétablir les aides à la scolarité, à la cantine et au transport, avec un Pass Mobilité accessible à tous.", "Rétablir une couverture médicale gratuite et alléger les charges pesant sur le travail.", "Rendre les institutions plus efficaces et moins coûteuses, et préparer une souveraineté partagée étape par étape.", "Mesures identifiées",
  "province-nord_05", "Faire du contrôle public du nickel, du rééquilibrage social et de la transition écologique les bases de la souveraineté.", "Nickel public|Rééquilibrage|Justice sociale|Environnement", "Trouver un repreneur pour Vavouto et maintenir une doctrine nickel fondée sur 51 % d’intérêts publics calédoniens.", "Soutenir l’investissement productif, les terres coutumières, l’économie verte et bleue, la recherche et le numérique.", "Poursuivre désenclavement, fiscalité progressive, lutte contre la vie chère, santé accessible et Plan Climat-Énergie.", "Mesures détaillées",
  "iles-loyaute_01", "Redresser les comptes et transformer transport, santé et production locale en conditions concrètes de la souveraineté.", "Redressement financier|Transport|Santé|Autonomie productive", "Apurer plus de 4 milliards de dette, maîtriser les dépenses et soumettre les actions à une évaluation rigoureuse.", "Sécuriser durablement les dessertes aériennes et maritimes et construire un schéma de transport à l’échelle du pays.", "Moderniser les dispensaires, viser l’autonomie énergétique en 2030 et structurer des coopératives de production et transformation locales.", "Mesures détaillées",
  "iles-loyaute_02", "Une ligne de sérieux budgétaire et d’autonomie locale qui privilégie la méthode plutôt qu’un catalogue de dispositifs.", "Finances|Mobilité|Initiative locale|Jeunesse", "Assainir les finances de la Province et remettre la responsabilité au cœur de la gestion.", "Désenclaver les îles et améliorer les mobilités.", "Soutenir emploi, entrepreneuriat, initiatives locales, jeunesse, formation et transmission culturelle.", "Orientations générales",
  "iles-loyaute_03", "Une liste chrétienne et coutumière axée sur l’équité, la transparence administrative et l’investissement dans la jeunesse.", "Équité|Jeunesse|Gouvernance|Économie locale", "Affecter pendant cinq ans les indemnités nettes de la tête de liste — plus de 30 millions de F CFP annoncés — à la formation et aux microprojets des jeunes.", "Plan de désendettement, diagnostic territorial, permanence du président et sanctions contre les absences injustifiées des élus.", "Améliorer dessertes et infrastructures, télémédecine, agriculture, pêche, tourisme et transformation locale.", "Mesures détaillées",
  "iles-loyaute_04", "Construire un bouclier social autochtone associant jeunesse, protection des écosystèmes et participation coutumière.", "Justice sociale|Jeunesse|Valeurs autochtones|Participation", "Plan provincial de justice sociale ciblant les tribus en difficulté et renforcement de la santé, de l’école et du logement.", "Plan emploi-émancipation des jeunes et soutien aux coopératives, circuits courts et activités locales.", "Cogestion coutumière des écosystèmes, transmission des langues et participation accrue des chefferies, femmes, jeunes et associations.", "Mesures identifiées",
  "iles-loyaute_05", "Bâtir la souveraineté par l’autonomie alimentaire, énergétique et économique et par le pouvoir d’agir des îles et des tribus.", "Souveraineté|Rééquilibrage|Pouvoir local|Transitions", "Assainir la gouvernance, réduire la dépendance aux dotations et restaurer des marges d’investissement productif.", "Redonner aux îles, districts et tribus la capacité de décider, structurer et exécuter les politiques de proximité.", "Organiser des démarches participatives par île et investir dans les transitions numérique, écologique et économique.", "Orientations générales",
  "iles-loyaute_06", "Le programme le plus chiffré : redressement financier, équipements de transport, santé et filières locales au service de la souveraineté.", "Finances chiffrées|Continuité territoriale|Santé|Filières locales", "Plan 2027-2031 : masse salariale ramenée à 42-44 %, épargne brute à 8-10 % et 1,2 à 1,5 milliard de F CFP d’investissement annuel.", "Financer le Betico 3 pour une livraison en 2028, adopter un schéma intégré des transports et équiper Tiga d’une barge et d’une rampe.", "Régler les dettes sanitaires, recruter des soignants et recentrer la SODIL sur des filières locales annoncées jusqu’à 2,5 milliards de F CFP par an.", "Mesures détaillées",
  "iles-loyaute_07", "Construire une souveraineté responsable par des finances saines, l’initiative privée et une amélioration ciblée de la qualité de vie.", "Gestion financière|Économie locale|Qualité de vie|Souveraineté", "Rétablir des finances saines et recentrer les politiques provinciales sur des compétences soutenables.", "Développer une économie locale créatrice d’emplois par des partenariats favorisant l’initiative entrepreneuriale privée.", "Améliorer l’accès à la santé, créer des espaces hybrides culture-sport-loisirs, repenser la mobilité et associer les jeunes aux politiques provinciales.", "Orientations générales"
)

profiles <- documents |>
  select(
    document_id, province, numero_liste, liste_nom_court, camp_affichage,
    liste_color, source_url, mots_ocr
  ) |>
  inner_join(editorial_profiles, by = "document_id") |>
  mutate(
    theme_tags = str_split(themes, fixed("|")),
    precision_class = case_when(
      precision == "Mesures détaillées" ~ "high",
      precision == "Mesures identifiées" ~ "medium",
      TRUE ~ "low"
    )
  ) |>
  arrange(province, numero_liste)

if (nrow(profiles) != nrow(documents)) {
  stop("Les profils éditoriaux ne couvrent pas exactement les 22 circulaires.")
}

theme_portraits <- function(province_name) {
  dat <- profiles |>
    filter(as.character(province) == province_name) |>
    arrange(numero_liste)

  rows <- lapply(seq_len(nrow(dat)), function(i) {
    row <- dat[i, ]
    theme_items <- lapply(row$theme_tags[[1]], function(label) {
      tags$span(
        class = "theme-portrait__theme",
        tags$span(class = "theme-portrait__dot", `aria-hidden` = "true"),
        label
      )
    })

    tags$article(
      class = "theme-portrait",
      style = paste0("--list-color:", row$liste_color, ";"),
      tags$div(
        class = "theme-portrait__identity",
        tags$span(
          class = "theme-portrait__number",
          paste0("Liste ", row$numero_liste)
        ),
        tags$h3(
          class = "theme-portrait__title",
          tags$span(
            class = "theme-portrait__list-dot",
            `aria-hidden` = "true"
          ),
          row$liste_nom_court
        ),
        tags$p(row$camp_affichage)
      ),
      tags$div(class = "theme-portrait__themes", theme_items)
    )
  })

  tagList(tags$div(class = "theme-portrait-list", rows))
}

program_cards <- function(province_name) {
  dat <- profiles |>
    filter(as.character(province) == province_name) |>
    arrange(numero_liste)

  cards <- lapply(seq_len(nrow(dat)), function(i) {
    row <- dat[i, ]
    theme_badges <- lapply(row$theme_tags[[1]], function(label) {
      tags$span(class = "program-card__theme", label)
    })
    measures <- lapply(c(row$mesure1, row$mesure2, row$mesure3), tags$li)

tags$article(
  class = "program-card",
  style = paste0(
    "--list-color:",
    row$liste_color,
    ";"
  ),
      tags$div(
        class = "program-card__topline",
        tags$span(class = "program-card__number", paste0("Liste ", row$numero_liste)),
        tags$span(
          class = paste("program-card__precision", row$precision_class),
          row$precision
        )
      ),
     tags$h3(
  class = "program-card__title",
  tags$span(
    class = "program-card__dot",
    style = paste0("--list-color:", row$liste_color, ";"),
    `aria-hidden` = "true"
  ),
  row$liste_nom_court
),
      tags$p(class = "program-card__camp", row$camp_affichage),
      tags$p(class = "program-card__angle", row$angle),
      tags$div(class = "program-card__themes", theme_badges),
      tags$h4("Mesures ou engagements mis en avant"),
      tags$ul(class = "program-card__measures", measures),
      tags$a(
        class = "program-card__source", href = row$source_url,
        target = "_blank", rel = "noopener",
        "Lire la circulaire officielle ↗"
      )
    )
  })

  tagList(tags$div(class = "program-grid", cards))
}

plot_wordclouds <- function(province_name, ncol = NULL) {
  dat <- cloud_terms |>
    filter(as.character(province) == province_name) |>
    mutate(
      liste_facette = factor(
        liste_facette,
        levels = unique(liste_facette[order(numero_liste)])
      )
    )

  if (is.null(ncol)) {
    n_lists <- n_distinct(dat$document_id)
    ncol <- if (n_lists >= 9) 5 else if (n_lists >= 6) 4 else 3
  }

  ggplot(dat, aes(label = mot, size = taille, colour = mot_color)) +
    geom_text_wordcloud_area(
      seed = 2026,
      eccentricity = 0.55,
      rm_outside = TRUE,
      grid_size = 5
    ) +
    scale_size_identity() +
    scale_colour_identity() +
    facet_wrap(~ liste_facette, ncol = ncol) +
    labs(
      title = paste(
        "Les mots-signatures —", unname(province_short[province_name])
      ),
      subtitle = paste(
        "Taille = rang de spécificité du mot dans la profession de foi ;",
        "les noms, lieux et artefacts OCR sont retirés"
      ),
      caption = "contours.nc • Professions de foi des provinciales 2026",
      x = NULL, y = NULL
    ) +
    theme_void(base_size = 12) +
    theme(
      plot.background = element_rect(fill = "white", colour = NA),
      plot.margin = margin(12, 14, 12, 12),
      plot.title = element_text(
        colour = "#24211d", face = "bold", size = 17,
        margin = margin(b = 5)
      ),
      plot.subtitle = element_text(
        colour = "#65615a", size = 10.2, margin = margin(b = 9)
      ),
      strip.background = element_rect(
        fill = "#f3efe6", colour = "#d8d0c1", linewidth = 0.45
      ),
      strip.text = element_text(
        colour = "#24211d", face = "bold", size = 9.2,
        margin = margin(5, 5, 5, 5)
      ),
      plot.caption = element_text(
        colour = "#777169", size = 8.2, hjust = 1,
        margin = margin(t = 7)
      ),
      panel.spacing = unit(0.5, "lines"),
      panel.background = element_rect(
        colour = "#ded8cc", fill = "#fbfaf7", linewidth = 0.45
      )
    )
}

plot_theme_preview <- function() {
  labels <- profiles |>
    transmute(
      document_id,
      label = str_wrap(
        paste0(numero_liste, ". ", liste_nom_court), width = 23
      )
    ) |>
    deframe()

  dat <- profiles |>
    select(document_id, province, numero_liste, liste_nom_court, theme_tags) |>
    unnest_longer(
      theme_tags, values_to = "theme_label", indices_to = "theme_rank"
    ) |>
    mutate(
      document_plot = factor(document_id, levels = rev(profiles$document_id)),
      province_plot = factor(
        unname(province_short[as.character(province)]),
        levels = unname(province_short[province_levels])
      ),
      theme_label = str_wrap(theme_label, width = 18)
    )

  ggplot(dat, aes(theme_rank, document_plot, label = theme_label)) +
    geom_label(
      fill = "#f7f4ec", colour = "#294f55", label.size = 0.22,
      label.padding = unit(0.14, "lines"), lineheight = 0.92,
      size = 3.05, fontface = "bold"
    ) +
    facet_grid(
      province_plot ~ ., scales = "free_y", space = "free_y", switch = "y"
    ) +
    scale_x_continuous(limits = c(0.55, 4.45), expand = c(0, 0)) +
    scale_y_discrete(labels = labels) +
    labs(
      title = "Provinciales 2026 : les priorités affichées par chaque liste",
      subtitle = "Quatre points d’entrée issus de la lecture complète des professions de foi",
      x = NULL, y = NULL
    ) +
    theme_minimal(base_size = 12) +
    theme(
      plot.background = element_rect(fill = "white", colour = NA),
      plot.title = element_text(
        colour = "#24211d", face = "bold", size = 24,
        margin = margin(b = 4)
      ),
      plot.subtitle = element_text(
        colour = "#65615a", size = 13, margin = margin(b = 12)
      ),
      panel.grid = element_blank(),
      panel.spacing = unit(0.7, "lines"),
      strip.background = element_rect(
        fill = "#3f6f58", colour = NA
      ),
      strip.text.y.left = element_text(
        colour = "white", face = "bold", size = 13,
        angle = 0, margin = margin(6, 8, 6, 8)
      ),
      axis.text.x = element_blank(),
      axis.text.y = element_text(colour = "#3c3a35", size = 8.5),
      plot.margin = margin(20, 24, 22, 20)
    )
}

plot_document_lengths <- function() {
  documents |>
    mutate(
      liste_plot = fct_reorder(liste_nom_court, mots_ocr),
      province_label = factor(
        province_label,
        levels = unname(province_short[province_levels])
      )
    ) |>
    ggplot(aes(mots_ocr, liste_plot, fill = province_label)) +
    geom_col(width = 0.72, show.legend = FALSE) +
    facet_wrap(~ province_label, scales = "free_y", ncol = 1) +
    scale_x_continuous(labels = label_number(big.mark = " ")) +
    scale_fill_manual(values = c("Sud" = "#4f7c8a", "Nord" = "#7d9b63", "Îles Loyauté" = "#c58c42")) +
    labs(
      title = "Des professions de foi de longueur très inégale",
      subtitle = "Nombre de mots reconnus dans chaque document avant filtrage",
      x = "Mots extraits", y = NULL
    ) +
    theme(panel.grid.major.y = element_blank())
}

n_documents <- nrow(documents)
n_listes_total <- nrow(reference)
n_listes_absentes <- nrow(missing_lists)
n_mots_total <- sum(documents$mots_ocr, na.rm = TRUE)
n_profiles_detailed <- sum(profiles$precision == "Mesures détaillées")
n_ocr_noise_occurrences <- nrow(noise_tokens)
n_ocr_noise_types <- n_distinct(noise_tokens$word_ascii)
n_documents_with_noise <- n_distinct(noise_tokens$document_id)
date_collecte <- as.Date(substr(manifest$date_collecte[[1]], 1, 10))
