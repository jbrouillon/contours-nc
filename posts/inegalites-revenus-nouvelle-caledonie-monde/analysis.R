# Calculs de l'article « Inégalités de revenus : où se situe la
# Nouvelle-Calédonie ? ».
#
# Sources :
# - Isee, enquêtes Budget des familles (BDF) 2019-2020 et BCM 2008 :
#   indicateurs synthétiques, seuils de pauvreté, déciles et courbe de
#   Lorenz des niveaux de vie (data/revenus/bdf2019-pauvrete-inegalites.xls,
#   bdf2019-pauvrete.xls et bdf2019-inegalites.xls) ;
# - Isee, Synthèse n° 52 (août 2021) : variantes de l'indice de Gini et du
#   taux de pauvreté (p. 4) et comparaison avec la France et les DOM (p. 6),
#   recopiées dans data/revenus/isee-synthese52-tableaux.csv ;
# - Insee, Revenus et patrimoine des ménages, édition 2021, fiche « Niveau
#   de vie des personnes » (enquête Revenus fiscaux et sociaux 2018) :
#   déciles et niveau de vie
#   moyen de chaque dixième de la population en France métropolitaine
#   (data/revenus/insee/) ;
# - Banque mondiale, Poverty and Inequality Platform (PIP), version du
#   22 septembre 2026, et groupes de revenu des pays
#   (data/revenus/banque-mondiale/) ;
# - OCDE, base de données sur la distribution des revenus (IDD), consultée
#   le 30 octobre 2026 : indice de Gini, rapports D9/D1 et S80/S20, taux de
#   pauvreté au seuil de 50 % du revenu médian (data/revenus/ocde/).
#
# Sorties publiques, dans data/ :
# - indicateurs-nc.csv : les cinq indicateurs de la boîte à outils pour la
#   Nouvelle-Calédonie (2008, 2019, 2019 en définition monétaire) et la
#   France métropolitaine (Insee, 2018, d'après l'Isee) ;
# - indicateurs-ocde.csv : dernière année depuis 2015 des quatre indicateurs
#   de l'OCDE pour 43 pays, avec la part des 10 % les plus aisés de la
#   Banque mondiale lorsqu'elle est mesurée sur le revenu ;
# - seuils-nc.csv : seuils de niveau de vie mensuel (D1 à D9) en 2008 et en
#   2019 ;
# - niveaux-de-vie-nc.csv : seuils de pauvreté, population pauvre et niveau
#   de vie médian des ménages kanak et des autres ménages en 2019 ;
# - lorenz-nc.csv : courbe de Lorenz des niveaux de vie, 2008 et 2019, à
#   chaque centième de la population ;
# - deciles-nc.csv : part du total des niveaux de vie reçue par chaque
#   dixième de la population, 2008 et 2019 ;
# - deciles-france.csv, seuils-france.csv : les mêmes parts et les seuils D1
#   à D9 (euros par mois, et par an comme l'Insee) en France métropolitaine,
#   2018 ;
# - gini-monde.csv : dernier indice de Gini national publié par la Banque
#   mondiale pour chaque pays classé par niveau de revenu (enquêtes depuis
#   2010), le rapport S80/S20 qui s'en déduit, la part du total reçue par
#   chaque dixième de la population (d1 à d10, en %) et, pour les pays
#   absents du fond de carte, les coordonnées de leur capitale (lon, lat) ;
# - pays-hors-comparaison.csv : pays de la base de la Banque mondiale qui
#   n'entrent pas dans la comparaison, et pourquoi ;
# - gini-outre-mer.csv : indice de Gini et rapports D9/D1 et S80/S20 du
#   tableau de comparaison de l'Isee.
#
# Le fond de carte du globe, data/pays-monde.geojson, est produit une fois
# pour toutes par prepare_globe.R.

suppressPackageStartupMessages({
  library(data.table)
  library(jsonlite)
  library(readxl)
  library(scales)
})

article_input <- knitr::current_input(dir = TRUE)
if (is.null(article_input)) {
  article_input <- file.path(getwd(), "posts", "inegalites-revenus-nouvelle-caledonie-monde", "index.qmd")
}
article_dir <- normalizePath(dirname(article_input), winslash = "/", mustWork = TRUE)
project_dir <- normalizePath(file.path(article_dir, "..", ".."), winslash = "/", mustWork = TRUE)
data_path <- function(...) file.path(project_dir, "data", ...)
output_path <- function(...) file.path(article_dir, "data", ...)

bdf_inegalites_path <- data_path("revenus", "bdf2019-inegalites.xls")
bdf_synthese_path <- data_path("revenus", "bdf2019-pauvrete-inegalites.xls")
bdf_pauvrete_path <- data_path("revenus", "bdf2019-pauvrete.xls")
synthese52_path <- data_path("revenus", "isee-synthese52-tableaux.csv")
insee_path <- data_path("revenus", "insee", "rpm2021-f4-niveau-de-vie.xlsx")
pip_path <- data_path("revenus", "banque-mondiale", "pip-20260922-enquetes.csv")
pays_path <- data_path("revenus", "banque-mondiale", "wdi-pays.json")
ocde_path <- data_path("revenus", "ocde", "idd-20261030-indicateurs.csv")
globe_path <- output_path("pays-monde.geojson")

required_files <- c(
  bdf_inegalites = bdf_inegalites_path,
  bdf_synthese = bdf_synthese_path,
  bdf_pauvrete = bdf_pauvrete_path,
  synthese52 = synthese52_path,
  insee = insee_path,
  pip = pip_path,
  pays = pays_path,
  ocde = ocde_path,
  globe = globe_path
)
missing_files <- required_files[!file.exists(required_files)]
if (length(missing_files) > 0) {
  stop(
    "Fichiers de données manquants :\n",
    paste0("- ", names(missing_files), " : ", missing_files, collapse = "\n"),
    "\nVoir data/revenus/README.md, data/revenus/insee/README.md, data/revenus/banque-mondiale/README.md et data/revenus/ocde/README.md ;",
    " le fond de carte se prépare avec prepare_globe.R."
  )
}
dir.create(output_path(), showWarnings = FALSE)

# Formats ---------------------------------------------------------------------

fmt_int <- function(x) number(x, accuracy = 1, decimal.mark = ",", big.mark = " ")
fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}
# Espaces insécables : un nombre comme 34 % ne doit pas être coupé.
nbsp <- function(x) gsub(" ", " ", x, fixed = TRUE)
# Comme dans les figures : une décimale sous 10 %, un entier au-delà, la
# moitié arrondie vers le haut (comme Intl.NumberFormat dans le navigateur).
precision_pct <- function(x) ifelse(abs(x) < 10, 1, 0)
arrondi <- function(x, digits) sign(x) * floor(abs(x) * 10^digits + 0.5) / 10^digits
pct <- function(x) {
  nbsp(vapply(x, function(y) paste0(fmt_num(arrondi(y, precision_pct(y)), precision_pct(y)), " %"), ""))
}
ent <- function(x) nbsp(fmt_int(x))
# Indice de Gini : deux décimales, comme dans les figures.
gini_txt <- function(x) fmt_num(arrondi(x, 2), 2)

# Isee : indicateurs publiés --------------------------------------------------

lire_feuille <- function(path, sheet) {
  read_excel(path, sheet = sheet, col_names = FALSE, col_types = "text", .name_repair = "minimal")
}
ligne <- function(feuille, libelle) {
  i <- which(trimws(feuille[[1]]) == libelle)
  stopifnot(length(i) == 1)
  i
}

bdf_synthese <- lire_feuille(bdf_synthese_path, "Indicateurs synthetiques")
stopifnot(trimws(bdf_synthese[[2]][5]) == "2008", trimws(bdf_synthese[[3]][5]) == "2019")
synthese_bdf <- function(l, annee) {
  as.numeric(bdf_synthese[[if (annee == 2008) 2 else 3]][ligne(bdf_synthese, l)])
}
gini_2008 <- synthese_bdf("Indice de Gini (niveau de vie)", 2008)
gini_2019 <- synthese_bdf("Indice de Gini (niveau de vie)", 2019)
s80_s20_2008 <- synthese_bdf("S80/S20**", 2008)
s80_s20_2019 <- synthese_bdf("S80/S20**", 2019)
d9_d1_2008 <- synthese_bdf("D9/D1*", 2008)
d9_d1_2019 <- synthese_bdf("D9/D1*", 2019)
# Taux de pauvreté, en % : part de la population dont le niveau de vie est
# inférieur à la moitié du niveau de vie médian.
pauvrete_2008 <- 100 * synthese_bdf("Taux de pauvreté", 2008)
pauvrete_2019 <- 100 * synthese_bdf("Taux de pauvreté", 2019)
population_pauvre_2019 <- synthese_bdf("Population pauvre", 2019)

# Tableaux de la synthèse n° 52, recopiés (voir data/revenus/README.md).
synthese52 <- fread(synthese52_path, encoding = "UTF-8")
s52 <- function(tab, territoire_, annee_, indicateur_, definition_ = NULL) {
  x <- synthese52[tableau == tab & territoire == territoire_ & annee == annee_ & indicateur == indicateur_]
  if (!is.null(definition_)) x <- x[definition == definition_]
  stopifnot(nrow(x) == 1)
  x$valeur
}
gini_2019_officiel <- s52("variantes", "Nouvelle-Calédonie", 2019, "gini", "Avec autoconsommation et redistribution")
gini_2008_officiel <- s52("variantes", "Nouvelle-Calédonie", 2008, "gini", "Avec autoconsommation et redistribution")
gini_2019_avant_redistribution <- s52("variantes", "Nouvelle-Calédonie", 2019, "gini", "Avant redistribution")
gini_2019_sans_autoconso <- s52("variantes", "Nouvelle-Calédonie", 2019, "gini", "Sans autoconsommation")
gini_2019_harmonise <- s52("comparaison", "Nouvelle-Calédonie", 2019, "gini")
gini_france_2018 <- s52("comparaison", "France", 2018, "gini")
s80_s20_france_2018 <- s52("comparaison", "France", 2018, "s80_s20")
d9_d1_france_2018 <- s52("comparaison", "France", 2018, "d9_d1")
# Niveau de vie monétaire (hors autoconsommation), retenu par l'Isee pour
# comparer avec la France et les DOM, et le plus proche de la mesure de
# l'OCDE.
d9_d1_2019_harmonise <- s52("comparaison", "Nouvelle-Calédonie", 2019, "d9_d1")
s80_s20_2019_harmonise <- s52("comparaison", "Nouvelle-Calédonie", 2019, "s80_s20")
pauvrete_2019_harmonise <- s52("variantes", "Nouvelle-Calédonie", 2019, "taux_pauvrete", "Sans autoconsommation")
pauvrete_2019_avant_redistribution <- s52("variantes", "Nouvelle-Calédonie", 2019, "taux_pauvrete", "Avant redistribution")

# Le tableur arrondit à deux décimales les valeurs de la synthèse, qui
# arrondit à une décimale les taux de pauvreté du tableur.
stopifnot(
  abs(gini_2019 - round(gini_2019_officiel, 2)) < 1e-9,
  abs(gini_2008 - round(gini_2008_officiel, 2)) < 1e-9,
  abs(pauvrete_2019 - s52("variantes", "Nouvelle-Calédonie", 2019, "taux_pauvrete", "Avec autoconsommation et redistribution")) < 0.05,
  abs(pauvrete_2008 - s52("variantes", "Nouvelle-Calédonie", 2008, "taux_pauvrete", "Avec autoconsommation et redistribution")) < 0.05
)

# Seuils de niveau de vie mensuel (F CFP par unité de consommation).
bdf_deciles <- lire_feuille(bdf_inegalites_path, "deciles niveau de vie")
entete_deciles <- trimws(unlist(bdf_deciles[ligne(bdf_deciles, "2019") - 2, ]))
decile_bdf <- function(annee, d) {
  j <- which(entete_deciles == d)
  stopifnot(length(j) == 1)
  as.numeric(bdf_deciles[[j]][ligne(bdf_deciles, as.character(annee))])
}
d1_2019 <- decile_bdf(2019, "D1")
d9_2019 <- decile_bdf(2019, "D9")
mediane_2019 <- decile_bdf(2019, "D5")
stopifnot(abs(d9_2019 / d1_2019 - d9_d1_2019) < 0.05)
seuils_nc <- rbindlist(lapply(c(2008, 2019), function(a) {
  data.table(annee = a, decile = 1:9, seuil = vapply(paste0("D", 1:9), function(d) decile_bdf(a, d), numeric(1)))
}))
stopifnot(
  !anyNA(seuils_nc$seuil),
  all(seuils_nc[, all(diff(seuil) > 0), by = annee]$V1),
  abs(seuils_nc[annee == 2008 & decile == 9, seuil] / seuils_nc[annee == 2008 & decile == 1, seuil] - d9_d1_2008) < 0.05
)
fwrite(seuils_nc, output_path("seuils-nc.csv"))

# Seuil de pauvreté 2019 : revenu disponible mensuel en dessous duquel un
# ménage est pauvre, selon sa composition.
bdf_seuils <- lire_feuille(bdf_pauvrete_path, "Seuil de pauvreté - type ménage")
colonne_2019 <- which(trimws(unlist(bdf_seuils[ligne(bdf_seuils, "Personne seule") - 1, ])) == "2019")
stopifnot(length(colonne_2019) == 1)
seuil_menage <- function(l) as.numeric(bdf_seuils[[colonne_2019]][ligne(bdf_seuils, l)])
seuil_pauvrete_2019 <- seuil_menage("Personne seule")
seuil_pauvrete_couple_2_enfants <- seuil_menage("Couple avec 2 enfants âgés de moins de 14 ans")
stopifnot(
  # La moitié du niveau de vie médian, arrondie à la centaine.
  abs(seuil_pauvrete_2019 - mediane_2019 / 2) < 100,
  seuil_pauvrete_2019 > d1_2019, seuil_pauvrete_2019 < decile_bdf(2019, "D2")
)

# Niveau de vie mensuel médian 2019 selon la communauté de la personne de
# référence du ménage (« kanak » : déclarée uniquement kanak).
bdf_quintiles <- lire_feuille(bdf_inegalites_path, "quintiles niveau de vie 2019")
colonne_mediane <- which(trimws(unlist(bdf_quintiles[6, ])) == "Médiane")
stopifnot(length(colonne_mediane) == 1)
mediane_bdf <- function(l) as.numeric(bdf_quintiles[[colonne_mediane]][ligne(bdf_quintiles, l)])
mediane_kanak <- mediane_bdf("Kanak")
mediane_non_kanak <- mediane_bdf("Non Kanak")

# Repères de 2019 cités dans le texte et le résumé, hors des autres fichiers
# publics (le niveau de vie médian de l'ensemble est le D5 de seuils-nc.csv).
niveaux_de_vie_nc <- data.table(
  indicateur = c("seuil_pauvrete_personne_seule", "seuil_pauvrete_couple_2_enfants", "population_pauvre",
                 "mediane_menages_kanak", "mediane_autres_menages"),
  annee = 2019,
  valeur = c(seuil_pauvrete_2019, seuil_pauvrete_couple_2_enfants, population_pauvre_2019,
             mediane_kanak, mediane_non_kanak),
  unite = c("F CFP par mois", "F CFP par mois", "personnes",
            "F CFP par mois et par unité de consommation", "F CFP par mois et par unité de consommation")
)
stopifnot(!anyNA(niveaux_de_vie_nc$valeur), mediane_kanak < mediane_2019, mediane_2019 < mediane_non_kanak)
fwrite(niveaux_de_vie_nc, output_path("niveaux-de-vie-nc.csv"))

# Courbe de Lorenz ------------------------------------------------------------
#
# La colonne des parts cumulées de population est décalée d'une ligne : le
# libellé « population » occupe la place de la première valeur, et la
# dernière (1) n'a pas de revenu en regard. Chaque part cumulée de niveau de
# vie se lit donc avec la part de population de la ligne suivante. Lue sans
# décalage, la courbe de 2019 cesserait d'être convexe à son extrémité, ce
# qui est impossible pour une population rangée par niveau de vie croissant.

lorenz_brut <- lire_feuille(bdf_inegalites_path, "Courbe de Lorenz")
debut <- ligne(lorenz_brut, "population")
stopifnot(trimws(lorenz_brut[[2]][debut - 1]) == "2008", trimws(lorenz_brut[[3]][debut - 1]) == "2019")
bloc <- lorenz_brut[debut:nrow(lorenz_brut), ]
n_bloc <- nrow(bloc)
lorenz_isee <- data.table(
  population = as.numeric(bloc[[1]][-1]),
  r2008 = as.numeric(bloc[[2]][-n_bloc]),
  r2019 = as.numeric(bloc[[3]][-n_bloc])
)
pente_2019 <- diff(c(0, lorenz_isee$r2019)) / diff(c(0, lorenz_isee$population))
stopifnot(
  nrow(lorenz_isee) == 1141,
  !anyNA(lorenz_isee),
  all(diff(lorenz_isee$population) > 0),
  all(diff(lorenz_isee$r2008) >= 0),
  all(diff(lorenz_isee$r2019) >= 0),
  abs(tail(lorenz_isee$population, 1) - 1) < 1e-9,
  abs(tail(lorenz_isee$r2019, 1) - 1) < 1e-9,
  # La courbe de 2008, donnée sur la grille de 2019, s'arrête un peu avant 1.
  abs(tail(lorenz_isee$r2008, 1) - 1) < 1e-3,
  # Convexité de la courbe de 2019 : pentes croissantes, aux arrondis près.
  all(diff(pente_2019) > -1e-6)
)

# Courbe complétée de ses extrémités (0, 0) et (1, 1), par définition.
courbe <- function(annee) {
  y <- lorenz_isee[[paste0("r", annee)]]
  x <- c(0, lorenz_isee$population)
  y <- c(0, y)
  y[length(y)] <- 1
  list(x = x, y = y)
}
part_cumulee <- function(annee, p) {
  k <- courbe(annee)
  approx(k$x, k$y, xout = p, ties = "ordered")$y
}
# Indice de Gini : 1 moins deux fois l'aire sous la courbe (trapèzes).
gini_courbe <- function(x, y) 1 - sum(diff(x) * (head(y, -1) + tail(y, -1)))
gini_calcule_2008 <- with(courbe(2008), gini_courbe(x, y))
gini_calcule_2019 <- with(courbe(2019), gini_courbe(x, y))
masses <- function(annee) (1 - part_cumulee(annee, 0.8)) / part_cumulee(annee, 0.2)
stopifnot(
  abs(gini_calcule_2008 - gini_2008_officiel) < 0.002,
  abs(gini_calcule_2019 - gini_2019_officiel) < 0.002,
  abs(masses(2008) - s80_s20_2008) < 0.15,
  abs(masses(2019) - s80_s20_2019) < 0.15
)

grille <- seq(0, 1, by = 0.01)
lorenz_nc <- rbindlist(lapply(c(2008, 2019), function(a) {
  data.table(annee = a, population = grille, revenu = round(part_cumulee(a, grille), 4))
}))
fwrite(lorenz_nc, output_path("lorenz-nc.csv"))

deciles_nc <- rbindlist(lapply(c(2008, 2019), function(a) {
  cumul <- part_cumulee(a, seq(0, 1, by = 0.1))
  data.table(annee = a, decile = 1:10, part = round(100 * diff(cumul), 2))
}))
stopifnot(all(abs(deciles_nc[, sum(part), by = annee]$V1 - 100) < 0.05))
fwrite(deciles_nc, output_path("deciles-nc.csv"))

# Parts du total des niveaux de vie (en %), 2019.
part_bas20 <- 100 * part_cumulee(2019, 0.2)
part_haut20 <- 100 * (1 - part_cumulee(2019, 0.8))
part_haut10 <- 100 * (1 - part_cumulee(2019, 0.9))
part_bas50 <- 100 * part_cumulee(2019, 0.5)
part_haut10_2008 <- 100 * (1 - part_cumulee(2008, 0.9))

# Indice calculé sur dix groupes seulement, comme dans la figure
# d'explication (qui le recalcule dans le navigateur à partir de
# deciles-nc.csv) : regrouper les ménages efface les écarts internes à chaque
# groupe et abaisse un peu l'indice.
gini_deciles <- function(parts) {
  cumul <- c(0, cumsum(parts)) / 100
  gini_courbe(seq(0, 1, by = 0.1), cumul)
}
gini_10_2019 <- gini_deciles(deciles_nc[annee == 2019, part])
# Si les 10 % les plus aisés recevaient tout : 0,9 avec dix groupes.
gini_10_extreme <- gini_deciles(c(rep(0, 9), 100))

# France et Outre-mer (tableau de comparaison de l'Isee) --------------------
#
# La Polynésie française (0,530 dans le tableau, ISPF 2015) n'est pas reprise :
# la valeur n'a pas pu être rapprochée d'une publication de l'ISPF. La
# Martinique n'a pas d'indice de Gini dans le tableau ; Mayotte n'a que son
# rapport S80/S20, publié « >80 », et n'est pas reprise.

outre_mer <- dcast(
  synthese52[tableau == "comparaison" & territoire != "Polynésie française"],
  territoire + annee + source_enquete ~ indicateur, value.var = "valeur"
)[!(is.na(gini) & is.na(d9_d1) & is.na(s80_s20))]
outre_mer <- outre_mer[order(is.na(gini), -gini),
                       .(territoire = fifelse(territoire == "France", "France métropolitaine", territoire),
                         annee, source = source_enquete, gini, d9_d1, s80_s20)]
stopifnot(
  nrow(outre_mer) == 6,
  !"Mayotte" %in% outre_mer$territoire,
  outre_mer[territoire == "Martinique", is.na(gini) & !is.na(d9_d1) & !is.na(s80_s20)],
  !anyNA(outre_mer[territoire != "Martinique", .(gini, d9_d1, s80_s20)])
)
fwrite(outre_mer, output_path("gini-outre-mer.csv"))
gini_om <- function(t) outre_mer[territoire == t, gini]
om <- function(t, indicateur) outre_mer[territoire == t][[indicateur]]

# France métropolitaine : parts et seuils des dixièmes (Insee) ---------------
#
# Fiche « Niveau de vie des personnes » de Revenus et patrimoine des ménages
# (édition 2021), même enquête que la colonne « France » du tableau de l'Isee
# (ERFS 2018). Figure 1 :
# limite supérieure de chaque décile et niveau de vie moyen de chaque
# dixième, en euros par an ; figure 2 : indicateurs publiés, qui servent de
# contrôle.

insee_f1 <- lire_feuille(insee_path, "figure 1")
insee_f2 <- lire_feuille(insee_path, "figure 2")
stopifnot(
  grepl("en 2018", insee_f1[[1]][1], fixed = TRUE),
  trimws(insee_f1[[3]][2]) == "en euros par an",
  grepl("France métropolitaine", insee_f1[[1]][ligne(insee_f1, "Ensemble") + 4], fixed = TRUE)
)
tranches_insee <- c("Inférieur à D1", paste0("D", 1:8, " à D", 2:9), "Supérieur à D9")
tranche_insee <- function(l, j) as.numeric(insee_f1[[j]][ligne(insee_f1, l)])
seuils_france_an <- unname(vapply(tranches_insee[1:9], tranche_insee, numeric(1), j = 2))
moyennes_france <- unname(vapply(tranches_insee, tranche_insee, numeric(1), j = 3))
moyenne_france <- tranche_insee("Ensemble", 3)
colonne_insee_2018 <- which(trimws(unlist(insee_f2[3, ])) == "2018")
stopifnot(length(colonne_insee_2018) == 1)
insee_2018 <- function(l) as.numeric(insee_f2[[colonne_insee_2018]][ligne(insee_f2, l)])

# Chaque dixième compte un dixième de la population : sa part du total est
# son niveau de vie moyen rapporté à dix fois celui de l'ensemble.
parts_france <- 100 * moyennes_france / (10 * moyenne_france)
cumul_france <- cumsum(parts_france)
stopifnot(
  !anyNA(seuils_france_an), !anyNA(moyennes_france),
  all(diff(seuils_france_an) > 0), all(diff(moyennes_france) > 0),
  # Moyennes arrondies à la dizaine d'euros.
  abs(sum(parts_france) - 100) < 0.05,
  seuils_france_an[1] == insee_2018("1er décile (D1)"),
  seuils_france_an[5] == insee_2018("Médiane (D5)"),
  seuils_france_an[9] == insee_2018("9e décile (D9)"),
  # Les parts cumulées redonnent les S20, S40, S50, S80 et S90 publiés, au
  # dixième de point près.
  abs(cumul_france[c(2, 4, 5, 8, 9)] -
        vapply(paste0("S", c(20, 40, 50, 80, 90), " (en %)"), insee_2018, numeric(1))) < 0.06,
  # Mêmes indicateurs que le tableau de l'Isee : D9/D1 3,49 (3,5 pour l'Isee),
  # (100 - S80)/S20 4,45 (4,4 pour l'Isee : 38,7 / 8,7 = 4,448), indice de
  # Gini 0,298. Le texte et les figures citent l'Isee.
  abs(insee_2018("Rapport interdécile D9/D1") - d9_d1_france_2018) < 0.05,
  abs(seuils_france_an[9] / seuils_france_an[1] - d9_d1_france_2018) < 0.05,
  abs(insee_2018("(100-S80)/S20") - s80_s20_france_2018) < 0.05 + 1e-9,
  abs(insee_2018("Indice de Gini") - gini_france_2018) < 1e-6
)

deciles_france <- data.table(annee = 2018, decile = 1:10, part = round(parts_france, 2))
stopifnot(abs(sum(deciles_france$part) - 100) < 0.05)
fwrite(deciles_france, output_path("deciles-france.csv"))
# Seuils par mois, comme ceux de l'Isee, et par an, comme l'Insee les publie.
seuils_france <- data.table(annee = 2018, decile = 1:9, seuil = round(seuils_france_an / 12, 2), seuil_annuel = seuils_france_an)
fwrite(seuils_france, output_path("seuils-france.csv"))

d1_france <- seuils_france_an[1] / 12
mediane_france <- seuils_france_an[5] / 12
d9_france <- seuils_france_an[9] / 12
seuil_pauvrete_france <- mediane_france / 2
part_bas20_france <- cumul_france[2]
part_haut20_france <- 100 - cumul_france[8]
# Échelle des niveaux de vie (outil 3) : chaque seuil rapporté au niveau de
# vie médian de son territoire.
relatif_mediane <- c(
  d1_nc = d1_2019 / mediane_2019, d9_nc = d9_2019 / mediane_2019,
  d1_france = d1_france / mediane_france, d9_france = d9_france / mediane_france
)
stopifnot(
  # Outil 3 : le seuil de pauvreté (la moitié du niveau de vie médian)
  # dépasse le D1 en Nouvelle-Calédonie, pas en France : moins de 10 % de la
  # population y vit en dessous.
  seuil_pauvrete_2019 > d1_2019, seuil_pauvrete_france < d1_france,
  # L'échelle de la figure va jusqu'à 300 % du niveau de vie médian.
  max(relatif_mediane) < 3
)

# Monde : Banque mondiale ------------------------------------------------------

pip <- fread(pip_path, encoding = "UTF-8")
stopifnot(
  all(c("country_code", "country_name", "reporting_year", "reporting_level", "welfare_type", "gini",
        paste0("decile", 1:10)) %in% names(pip)),
  !anyDuplicated(pip[, .(country_code, reporting_year, reporting_level, welfare_type)])
)
pays_wdi <- fromJSON(pays_path)[[2]]
coordonnee <- function(x) as.numeric(fifelse(trimws(x) == "", NA_character_, x))
groupes_wdi <- data.table(
  country_code = pays_wdi$id,
  iso2 = pays_wdi$iso2Code,
  groupe = pays_wdi$incomeLevel$id,
  region = pays_wdi$region$id,
  # Coordonnées de la capitale, pour placer les pays absents du fond de carte.
  lon = coordonnee(pays_wdi$longitude),
  lat = coordonnee(pays_wdi$latitude)
)
stopifnot(groupes_wdi[country_code == "NCL", groupe] == "HIC")

GROUPES <- c(
  HIC = "Revenu élevé",
  UMC = "Revenu intermédiaire, tranche supérieure",
  LMC = "Revenu intermédiaire, tranche inférieure",
  LIC = "Faible revenu"
)

# Dernière enquête nationale depuis 2010 ; pour une même année, le revenu est
# préféré à la consommation, plus proche de la mesure calédonienne.
enquetes <- pip[reporting_level == "national" & !is.na(gini) & reporting_year >= 2010]
enquetes[, ordre_mesure := fifelse(welfare_type == "income", 1L, 2L)]
dernieres <- enquetes[order(country_code, -reporting_year, ordre_mesure)][, .SD[1], by = country_code]
dernieres <- groupes_wdi[dernieres, on = "country_code"]
hors_classement <- dernieres[!groupe %in% names(GROUPES), country_name]
monde <- dernieres[groupe %in% names(GROUPES)]
stopifnot(
  !anyDuplicated(monde$country_code),
  all(nchar(monde$iso2) == 2),
  all(monde$gini > 0 & monde$gini < 1),
  all(monde$welfare_type %in% c("income", "consumption"))
)

# Parts du total (revenu ou consommation) reçues par chaque dixième de la
# population, du plus modeste au plus aisé.
parts_deciles <- paste0("decile", 1:10)
stopifnot(
  !anyNA(monde[, ..parts_deciles]),
  all(abs(rowSums(monde[, ..parts_deciles]) - 1) < 0.005),
  all(apply(as.matrix(monde[, ..parts_deciles]), 1, function(p) all(diff(p) > -1e-9)))
)

# Globe : les pays sans contour au 1:110 m (petits États insulaires) sont
# figurés par un point à leur capitale.
iso3_globe <- fromJSON(globe_path)$features$properties$iso3
sans_contour <- !monde$country_code %in% iso3_globe
stopifnot(
  all(is.finite(monde$lon[sans_contour]) & is.finite(monde$lat[sans_contour])),
  all(c("NCL", "GUF") %in% iso3_globe),
  # Méthode : « dont Kiribati, Tonga ou les Samoa ».
  all(c("KIR", "TON", "WSM") %in% monde$country_code[sans_contour])
)

# Rapport S80/S20 : part des 20 % les plus aisés rapportée à celle des 20 %
# les plus modestes, calculée sur les parts non arrondies.
monde[, s80_s20 := (decile9 + decile10) / (decile1 + decile2)]
stopifnot(all(monde$s80_s20 > 1))

# Précision des valeurs publiées : le navigateur les arrondit à son tour pour
# les afficher ; à trois décimales, ce double arrondi faisait passer l'indice
# d'Haïti de 0,6045 à 0,61 au lieu de 0,60, et l'Uruguay dans la classe
# supérieure du globe.
gini_monde <- monde[, c(
  .(
    iso3 = country_code,
    iso2 = iso2,
    pays = country_name,
    groupe = groupe,
    annee = reporting_year,
    mesure = fifelse(welfare_type == "income", "revenu", "consommation"),
    gini = round(gini, 5),
    s80_s20 = round(s80_s20, 3),
    lon = fifelse(sans_contour, lon, NA_real_),
    lat = fifelse(sans_contour, lat, NA_real_)
  ),
  setNames(lapply(.SD, function(p) round(100 * p, 2)), paste0("d", 1:10))
), .SDcols = parts_deciles][order(groupe, gini)]
fwrite(gini_monde, output_path("gini-monde.csv"))

# Pays de la base absents de la comparaison : dernière enquête nationale
# antérieure à 2010, enquête seulement urbaine (Argentine), ou pays sans
# groupe de revenu (Taïwan).
derniere_nationale <- pip[reporting_level == "national" & !is.na(gini),
                          .(derniere = max(reporting_year)), by = country_code]
hors_comparaison <- unique(pip[!country_code %in% monde$country_code, .(country_code, pays = country_name)])
hors_comparaison <- derniere_nationale[hors_comparaison, on = "country_code"]
hors_comparaison[, motif := fifelse(is.na(derniere), "urbain", fifelse(derniere < 2010, "ancienne", "non-classe"))]
stopifnot(
  !anyDuplicated(hors_comparaison$country_code),
  setequal(hors_comparaison[motif == "non-classe", country_code],
           dernieres[!groupe %in% names(GROUPES), country_code]),
  all(pip[country_code %in% hors_comparaison[motif == "urbain", country_code], reporting_level] != "national"),
  # Méthode : l'Argentine (urbain) et Taïwan (non classé), les autres anciens.
  hors_comparaison[motif == "urbain", country_code] == "ARG",
  hors_comparaison[motif == "non-classe", country_code] == "TWN"
)
fwrite(hors_comparaison[order(country_code), .(iso3 = country_code, pays, motif, derniere)],
       output_path("pays-hors-comparaison.csv"))
derniere_hors <- function(code) hors_comparaison[country_code == code, derniere]

n_monde <- nrow(monde)
n_groupe <- function(g) monde[groupe == g, .N]
# Rang de la Nouvelle-Calédonie : nombre de pays dont l'indice est plus bas.
# Comme pour l'OCDE et dans les figures (indicateurs-nc.csv), l'indice
# officiel est pris à trois décimales (0,393) : le tableur de l'Isee l'arrondit
# à 0,39, et trois pays de la base se trouvent entre les deux.
sous_nc <- function(seuil, g = NULL) {
  x <- if (is.null(g)) monde else monde[groupe == g]
  sum(x$gini < seuil)
}
part_sous_nc <- 100 * sous_nc(gini_2019_officiel) / n_monde
part_sous_nc_harmonise <- 100 * sous_nc(gini_2019_harmonise) / n_monde
n_hic <- n_groupe("HIC")
hic_au_dessus <- monde[groupe == "HIC" & gini > gini_2019_officiel][order(-gini), country_code]
gini_pays <- function(code) monde[country_code == code, gini]
annee_pays <- function(code) monde[country_code == code, reporting_year]
mesure_pays <- function(code) monde[country_code == code, welfare_type]
extremes <- monde[order(gini)][c(1, .N), country_code]

# Noms français des pays cités dans le texte (les figures les traduisent avec
# Intl.DisplayNames).
NOMS <- c(
  PAN = "le Panama", CRI = "le Costa Rica", CHL = "le Chili", USA = "les États-Unis",
  URY = "l’Uruguay", BGR = "la Bulgarie", LTU = "la Lituanie", ISR = "Israël", PRT = "le Portugal",
  BRA = "le Brésil", ZAF = "l’Afrique du Sud", MEX = "le Mexique", TUR = "la Turquie"
)
noms <- function(codes, liste = NOMS) {
  stopifnot(all(codes %in% names(liste)))
  x <- unname(liste[codes])
  if (length(x) == 1) return(x)
  paste(paste(head(x, -1), collapse = ", "), "et", tail(x, 1))
}

# Comment mesurer : la France et le Brésil, mesurés tous deux sur le revenu,
# servent d'exemples (parts des dixièmes, indice recalculé sur dix groupes).
part_decile_pays <- function(code, k) 100 * monde[country_code == code, get(paste0("decile", k))]
part_haut10_pays <- function(code) part_decile_pays(code, 10)
part_bas10_pays <- function(code) part_decile_pays(code, 1)
s80_s20_pays <- function(code) {
  (part_decile_pays(code, 9) + part_decile_pays(code, 10)) / (part_decile_pays(code, 1) + part_decile_pays(code, 2))
}
gini_10_pays <- function(code) gini_deciles(vapply(1:10, function(k) part_decile_pays(code, k), numeric(1)))
# Lecture de l'indice : écart moyen entre deux personnes prises au hasard,
# rapporté au revenu moyen (deux fois l'indice).
ecart_moyen <- function(code) 2 * gini_pays(code)

# Exemple de calcul du niveau de vie (ménage fictif) : un couple et deux
# enfants de moins de 14 ans, 400 000 F CFP de revenu disponible par mois.
uc_exemple <- 1 + 0.5 + 0.3 + 0.3
revenu_exemple <- 400000
niveau_vie_exemple <- revenu_exemple / uc_exemple

# Géographie : régions de la Banque mondiale.
REGIONS <- c(
  EAS = "Asie de l’Est et Pacifique", ECS = "Europe et Asie centrale",
  LCN = "Amérique latine et Caraïbes", MEA = "Moyen-Orient et Afrique du Nord",
  NAC = "Amérique du Nord", SAS = "Asie du Sud", SSF = "Afrique subsaharienne"
)
stopifnot(all(monde$region %in% names(REGIONS)))
# Pays cités sans article, aux extrémités des classements du globe.
NOMS_MONDE <- c(HTI = "Haïti", IND = "Inde", SVK = "Slovaquie")

# Repères de lecture du globe, aux seuils de ses classes de couleur pour
# l'indice de Gini (GLOBE_OUTILS dans assets/js/inegalites-revenus.js) : bleu
# sous 0,30, orange et rouge à partir de 0,45.
seuil_bas <- 0.30
seuil_haut <- 0.45
n_sous_seuil_bas <- monde[gini < seuil_bas, .N]
n_sous_seuil_bas_europe <- monde[gini < seuil_bas & region == "ECS", .N]
n_au_dessus_seuil_haut <- monde[gini >= seuil_haut, .N]

# PIP divise par le nombre de personnes, l'Insee par les unités de
# consommation : la France, mesurée par les deux, sert d'étalon.
gini_france_pip_2018 <- pip[country_code == "FRA" & reporting_level == "national" &
                              reporting_year == 2018 & welfare_type == "income", gini]
stopifnot(length(gini_france_pip_2018) == 1)
ecart_france_pip <- gini_france_pip_2018 - gini_france_2018

# Revenu et consommation : enquêtes où PIP publie les deux mesures pour un
# même pays et une même année.
deux_mesures <- dcast(
  pip[reporting_level == "national" & !is.na(gini)],
  country_code + reporting_year ~ welfare_type, value.var = "gini"
)[!is.na(income) & !is.na(consumption)]
n_deux_mesures <- nrow(deux_mesures)
part_revenu_plus_haut <- 100 * mean(deux_mesures$income > deux_mesures$consumption)
annees_enquetes <- range(monde$reporting_year)

# Pacifique insulaire : pays de la base (la dernière enquête de la
# Papouasie-Nouvelle-Guinée, de 2009, est trop ancienne ; la Nouvelle-Zélande
# n'y figure pas). Ils ne sont pas comparés à la Nouvelle-Calédonie : « tous
# sauf Nauru » sont à revenu intermédiaire, « tous » mesurés sur la
# consommation.
PACIFIQUE <- c("FJI", "FSM", "KIR", "MHL", "NRU", "SLB", "TON", "TUV", "VUT", "WSM")
pacifique <- monde[country_code %in% PACIFIQUE][order(gini)]
stopifnot(
  nrow(pacifique) == length(PACIFIQUE),
  all(pacifique$welfare_type == "consumption"),
  pacifique[groupe == "HIC", country_code] == "NRU",
  all(pacifique[country_code != "NRU", groupe] %in% c("UMC", "LMC")),
  !"PNG" %in% monde$country_code,
  !"NZL" %in% pip$country_code
)

# Part des 10 % les plus aisés et des 20 % les plus modestes dans le monde ----
#
# Parts publiées par la Banque mondiale (revenu ou consommation par
# personne), comparées à celles du niveau de vie calédonien.

# Colonnes p_haut10 et p_bas20 (en %), distinctes des valeurs calédoniennes
# part_haut10 et part_bas20.
monde[, `:=`(p_haut10 = 100 * decile10, p_bas20 = 100 * (decile1 + decile2))]
part_haut10_extremes <- monde[order(p_haut10)][c(1, .N), country_code]
part_haut10_monde <- function(code) monde[country_code == code, p_haut10]

# Rapport S80/S20 tiré des mêmes parts (globe), comparé au rapport officiel
# calédonien.
s80_extremes <- monde[order(s80_s20)][c(1, .N), country_code]
s80_monde <- function(code) monde[country_code == code, s80_s20]
n_monde_s80_au_dessus <- monde[s80_s20 > s80_s20_2019, .N]
mediane_s80_hic <- median(monde[groupe == "HIC", s80_s20])
hic_s80_au_dessus <- monde[groupe == "HIC" & s80_s20 > s80_s20_2019][order(-s80_s20), country_code]

# OCDE : quatre indicateurs pour 43 pays ------------------------------------
#
# Dernière année depuis 2015 disposant des quatre indicateurs : la Chine et
# l'Inde, sans valeur postérieure à 2011, sont écartées. Taux de pauvreté au
# seuil de 50 % du revenu disponible médian, comme en Nouvelle-Calédonie.

ocde_brut <- fread(ocde_path, encoding = "UTF-8",
                   select = c("REF_AREA", "MEASURE", "POVERTY_LINE", "TIME_PERIOD", "OBS_VALUE"))
OCDE_MESURES <- c(INC_DISP_GINI = "gini", D9_1_INC_DISP = "d9_d1", QR_INC_DISP = "s80_s20", PR_INC_DISP = "pauvrete")
ocde <- ocde_brut[MEASURE %in% names(OCDE_MESURES) & (MEASURE != "PR_INC_DISP" | POVERTY_LINE == "PL_50")]
ocde[, indicateur := OCDE_MESURES[MEASURE]]
stopifnot(
  !anyDuplicated(ocde[, .(REF_AREA, TIME_PERIOD, indicateur)]),
  !anyNA(ocde$OBS_VALUE),
  all(ocde[indicateur == "gini", OBS_VALUE > 0 & OBS_VALUE < 1]),
  all(ocde[indicateur %in% c("d9_d1", "s80_s20"), OBS_VALUE > 1]),
  all(ocde[indicateur == "pauvrete", OBS_VALUE > 0 & OBS_VALUE < 100])
)
ocde_annees <- dcast(ocde, REF_AREA + TIME_PERIOD ~ indicateur, value.var = "OBS_VALUE")
ocde_annees <- ocde_annees[!is.na(gini) & !is.na(d9_d1) & !is.na(s80_s20) & !is.na(pauvrete) & TIME_PERIOD >= 2015]
ocde_pays <- ocde_annees[order(REF_AREA, -TIME_PERIOD)][, .SD[1], by = REF_AREA]
ocde_pays <- groupes_wdi[, .(REF_AREA = country_code, iso2)][ocde_pays, on = "REF_AREA"]
ocde_pays <- monde[welfare_type == "income", .(REF_AREA = country_code, p_haut10, annee_bm = reporting_year)][ocde_pays, on = "REF_AREA"]
ocde_pays <- unique(pip[, .(REF_AREA = country_code, pays = country_name)])[ocde_pays, on = "REF_AREA"]
ocde_pays[REF_AREA == "NZL", pays := "New Zealand"]
stopifnot(
  nrow(ocde_pays) == 43,
  setequal(setdiff(unique(ocde_brut$REF_AREA), ocde_pays$REF_AREA), c("CHN", "IND")),
  all(nchar(ocde_pays$iso2) == 2), !anyNA(ocde_pays$pays),
  # Part des 10 % les plus aisés : la Nouvelle-Zélande est absente de la base
  # de la Banque mondiale, l'Afrique du Sud y est mesurée sur la consommation.
  setequal(ocde_pays[is.na(p_haut10), REF_AREA], c("NZL", "ZAF"))
)
indicateurs_ocde <- ocde_pays[order(-gini), .(
  iso3 = REF_AREA, iso2, pays, annee = TIME_PERIOD,
  # Assez de décimales pour éviter un double arrondi à l'affichage (voir
  # gini-monde.csv).
  gini = round(gini, 4), s80_s20 = round(s80_s20, 4), d9_d1 = round(d9_d1, 4), pauvrete = round(pauvrete, 1),
  part_haut10 = round(p_haut10, 2), annee_bm
)]
fwrite(indicateurs_ocde, output_path("indicateurs-ocde.csv"))
n_ocde <- nrow(ocde_pays)
annees_ocde <- range(ocde_pays$TIME_PERIOD)

# Valeurs calédoniennes comparées : définition officielle (la plus basse) et
# niveau de vie monétaire, sans autoconsommation, comme pour l'OCDE.
nc_ocde <- list(
  gini = c(officiel = gini_2019_officiel, harmonise = gini_2019_harmonise),
  s80_s20 = c(officiel = s80_s20_2019, harmonise = s80_s20_2019_harmonise),
  d9_d1 = c(officiel = d9_d1_2019, harmonise = d9_d1_2019_harmonise),
  pauvrete = c(officiel = pauvrete_2019, harmonise = pauvrete_2019_harmonise)
)
ocde_au_dessus <- function(indicateur, definition = "officiel") {
  ocde_pays[get(indicateur) > nc_ocde[[indicateur]][[definition]]][order(-get(indicateur)), REF_AREA]
}
n_ocde_au_dessus <- function(indicateur, definition = "officiel") length(ocde_au_dessus(indicateur, definition))
mediane_ocde <- function(indicateur) median(ocde_pays[[indicateur]])
ocde_val <- function(code, indicateur) ocde_pays[REF_AREA == code][[indicateur]]
annee_ocde <- function(code) ocde_pays[REF_AREA == code, TIME_PERIOD]
# Pays qui dépassent la Nouvelle-Calédonie sur les quatre indicateurs.
ocde_toujours_au_dessus <- Reduce(intersect, lapply(names(nc_ocde), ocde_au_dessus))
ocde_toujours_au_dessus_harmonise <- Reduce(intersect, lapply(names(nc_ocde), ocde_au_dessus, definition = "harmonise"))
# Part des 10 % les plus aisés pour les mêmes pays (Banque mondiale).
n_ocde_haut10 <- ocde_pays[!is.na(p_haut10), .N]
n_ocde_haut10_au_dessus <- ocde_pays[p_haut10 > part_haut10, .N]

# Les cinq indicateurs de la boîte à outils, pour la Nouvelle-Calédonie.
indicateurs_nc <- data.table(
  indicateur = c("part_haut10", "s80_s20", "d9_d1", "gini", "pauvrete"),
  nc_2008 = c(part_haut10_2008, s80_s20_2008, d9_d1_2008, gini_2008_officiel, pauvrete_2008),
  nc_2019 = c(part_haut10, s80_s20_2019, d9_d1_2019, gini_2019_officiel, pauvrete_2019),
  nc_2019_harmonise = c(NA, s80_s20_2019_harmonise, d9_d1_2019_harmonise, gini_2019_harmonise, pauvrete_2019_harmonise),
  france_2018 = c(NA, s80_s20_france_2018, d9_d1_france_2018, gini_france_2018, NA)
)
fwrite(indicateurs_nc[, lapply(.SD, function(x) if (is.numeric(x)) round(x, 3) else x)],
       output_path("indicateurs-nc.csv"))

# Résumé « En bref » et phrases de l'article ----------------------------------
#
# Les phrases des diapositives et du texte sont vérifiées ci-dessous, dans
# l'ordre de l'article.

# Introduction et diapositive 1 : « sur 100 francs », les 10 % les plus
# modestes et les 10 % les plus aisés.
part_bas10 <- 100 * part_cumulee(2019, 0.1)
rapport_haut_bas10 <- part_haut10 / part_bas10
n_monde_haut10_au_dessus <- monde[p_haut10 > part_haut10, .N]
# Variantes de l'indice calédonien de 2019 (section des limites) : « de 0,39
# à 0,43 ».
variantes_2019 <- synthese52[territoire == "Nouvelle-Calédonie" & annee == 2019 & indicateur == "gini",
                             .(definition, valeur)][order(valeur)]
quintiles_2019 <- deciles_nc[annee == 2019, .(part = sum(part)), by = .(quintile = (decile + 1) %/% 2)]

stopifnot(
  # Figure d'explication : la France et le Brésil, mesurés sur le revenu ; les
  # 10 % les plus aisés reçoivent bien plus au Brésil.
  mesure_pays("FRA") == "income", mesure_pays("BRA") == "income",
  part_haut10_pays("BRA") > 1.5 * part_haut10_pays("FRA"),
  part_bas10_pays("BRA") < part_bas10_pays("FRA"),
  s80_s20_pays("BRA") > 2 * s80_s20_pays("FRA"),
  # Indice de Gini : regroupé en dix, l'indice baisse un peu ; l'écart moyen
  # vaut environ le revenu moyen au Brésil.
  gini_10_pays("FRA") < gini_pays("FRA"), gini_10_pays("BRA") < gini_pays("BRA"),
  abs(ecart_moyen("BRA") - 1) < 0.02,
  # Globe : sous 0,30, « surtout » des pays d'Europe et d'Asie centrale ; à
  # partir de 0,45, « tous » en Amérique latine et Caraïbes ou en Afrique
  # subsaharienne.
  n_sous_seuil_bas_europe > n_sous_seuil_bas / 2,
  n_au_dessus_seuil_haut > 0,
  all(monde[gini >= seuil_haut, region] %in% c("LCN", "SSF")),
  # Outil 4 et diapositive 5 : l'indice de 2019, « 0,39 ».
  gini_txt(gini_2019) == "0,39",
  # Étape 2 : les 10 % les plus aisés reçoivent davantage que toute la moitié
  # la plus modeste.
  part_haut10 > part_bas50,
  # Outil 4 : l'indice baisse légèrement de 2008 à 2019 (0,41 → 0,39).
  gini_2019 < gini_2008, gini_2008 - gini_2019 < 0.03,
  # Outil 2 : « 5 % » pour les 20 % les plus modestes, « 44 % » pour les 20 %
  #   les plus aisés, arrondis de l'Isee (« près de 44 % », « 5 % »).
  round(part_bas20) == 5, round(part_haut20) == 44,
  abs(quintiles_2019$part[1] - part_bas20) < 0.05, abs(quintiles_2019$part[5] - part_haut20) < 0.05,
  #   « plus d'un quart » pour les 10 % les plus aisés, « moins d'un quart »
  #   pour la moitié la plus modeste.
  part_haut10 > 25, part_bas50 < 25,
  #   « Avant redistribution », l'indice serait plus élevé « d'environ 0,04 ».
  abs(gini_2019_avant_redistribution - gini_2019_officiel - 0.04) < 0.005,
  # Figure d'explication : l'indice calculé sur dix groupes s'affiche aussi
  # « 0,39 » ; il vaut 0,9 si les 10 % les plus aisés reçoivent tout.
  gini_txt(gini_10_2019) == gini_txt(gini_2019), gini_10_2019 < gini_2019_officiel,
  abs(gini_10_extreme - 0.9) < 1e-9,
  # France et Outre-mer : avec le niveau de vie monétaire, la
  #   Nouvelle-Calédonie (0,42) dépasse la France métropolitaine (0,30), la
  #   Guadeloupe et La Réunion ; « seule la Guyane » fait plus.
  outre_mer$territoire[1] == "Guyane", outre_mer$territoire[2] == "Nouvelle-Calédonie",
  outre_mer$territoire[5] == "France métropolitaine",
  # Pays riches : « six seulement » des pays à revenu élevé de la Banque
  # mondiale ont un indice de Gini supérieur à celui de la Nouvelle-Calédonie.
  length(hic_au_dessus) == 6,
  setequal(hic_au_dessus, c("PAN", "CRI", "CHL", "USA", "URY", "BGR")),
  #   « Sept pays sur dix » ont un indice plus bas que 0,39, « quatre sur
  #   cinq » que 0,42.
  round(part_sous_nc / 10) == 7, round(part_sous_nc_harmonise / 10) == 8,
  #   Extrêmes de la base : l'Inde et Haïti.
  setequal(extremes, c("IND", "HTI")),
  # Comparabilité : le revenu est plus inégal que la consommation « sept fois
  # sur dix » ; le revenu par personne de PIP place la France au-dessus de
  # l'Insee (« accentue un peu les écarts ») ; les chiffres de l'OCDE sont
  # « très proches » de ceux de l'Insee.
  round(part_revenu_plus_haut / 10) == 7,
  ecart_france_pip > 0.02, ecart_france_pip < 0.035,
  abs(ocde_val("FRA", "gini") - gini_france_2018) < 0.005,
  abs(ocde_val("FRA", "d9_d1") - d9_d1_france_2018) < 0.05,
  # Ce que l'indice ne dit pas : le niveau de vie médian des ménages kanak est
  # « deux fois moins élevé » que celui des autres ménages.
  abs(mediane_non_kanak / mediane_kanak - 2) < 0.05,
  #   Selon la définition, l'indice de 2019 va « de 0,39 à 0,43 ».
  gini_txt(min(variantes_2019$valeur)) == "0,39", gini_txt(max(variantes_2019$valeur)) == "0,43"
)

# Boîte à outils (fiches, outils 1 à 5) et comparaison avec l'OCDE.
voisins_en_dessous <- c("FRA", "AUS", "NZL")
stopifnot(
  abs(part_bas10 - deciles_nc[annee == 2019 & decile == 1, part]) < 0.01,
  # Fiches : la Nouvelle-Calédonie au-dessus de la France sur les cinq
  # outils.
  part_haut10 > part_haut10_pays("FRA"), s80_s20_2019 > s80_s20_france_2018, d9_d1_2019 > d9_d1_france_2018,
  gini_2019 > gini_france_2018, pauvrete_2019 > ocde_val("FRA", "pauvrete"),
  # Outil 1 : « plus d'un quart ». Globe : « au milieu du classement »
  # mondial ; extrêmes : la Slovaquie et Haïti.
  part_haut10 > 25,
  n_monde_haut10_au_dessus / n_monde > 0.4, n_monde_haut10_au_dessus / n_monde < 0.6,
  setequal(part_haut10_extremes, c("SVK", "HTI")),
  # Outil 2 : « presque deux fois » le rapport français ; les piles
  # françaises de la figure redonnent le rapport de l'Isee, à l'arrondi près,
  # comme les piles calédoniennes.
  s80_s20_2019 / s80_s20_france_2018 > 1.8, s80_s20_2019 / s80_s20_france_2018 < 2,
  abs(part_haut20_france / part_bas20_france - s80_s20_france_2018) < 0.15,
  # Outil 3 : « deux fois moins » en France.
  abs(d9_d1_2019 / d9_d1_france_2018 - 2) < 0.1,
  # Outil 1 : la France « à peine moins » (Banque mondiale).
  part_haut10_pays("FRA") < part_haut10, part_haut10 / part_haut10_pays("FRA") < 1.1,
  # Outil 5 : « près d'une sur cinq » ; les États-Unis « au même niveau ».
  pauvrete_2019 > 17.5, pauvrete_2019 < 20,
  abs(ocde_val("USA", "pauvrete") - pauvrete_2019) < 0.5,
  # Cinq outils, un même constat : rapport D9/D1 et taux de pauvreté « deux
  # fois plus élevés » qu'en France, S80/S20 « presque deux fois », écart
  # « faible » sur la part des 10 % les plus aisés.
  abs(pauvrete_2019 / ocde_val("FRA", "pauvrete") - 2) < 0.15,
  # Globe, rapport S80/S20 : de l'Inde à Haïti ; des trois outils de la Banque
  # mondiale, c'est celui où la Nouvelle-Calédonie est le moins souvent
  # dépassée.
  setequal(s80_extremes, c("IND", "HTI")),
  n_monde_s80_au_dessus < monde[gini > gini_2019_officiel, .N],
  n_monde_s80_au_dessus < n_monde_haut10_au_dessus,
  # Pays riches, Banque mondiale : le rapport S80/S20 médian des pays à revenu
  # élevé est bien sous la valeur calédonienne (« confirme ce constat »).
  mediane_s80_hic < s80_s20_2019, length(hic_s80_au_dessus) < 0.1 * n_hic,
  # Pays riches, OCDE, rapport S80/S20 : la France, l'Australie et la
  # Nouvelle-Zélande « loin derrière » (moins de 70 % de la valeur
  # calédonienne officielle).
  all(ocde_pays[REF_AREA %in% c("FRA", "AUS", "NZL"), s80_s20] < 0.7 * s80_s20_2019),
  mediane_ocde("s80_s20") < s80_s20_2019,
  # Ménage imaginaire : seuil d'un couple avec deux enfants de moins de 14 ans
  # (2,1 unités de consommation), sous son niveau de vie.
  abs(seuil_pauvrete_couple_2_enfants - uc_exemple * seuil_pauvrete_2019) < 100,
  niveau_vie_exemple > seuil_pauvrete_2019,
  # Pays riches : trois pays dépassent la Nouvelle-Calédonie sur les quatre
  # indicateurs (deux en niveau de vie monétaire) ; la France, l'Australie et
  # la Nouvelle-Zélande sont « nettement en dessous sur chacun » (moins de
  # 85 % de la valeur calédonienne officielle).
  setequal(ocde_toujours_au_dessus, c("ZAF", "CRI", "BRA")),
  setequal(ocde_toujours_au_dessus_harmonise, c("ZAF", "CRI")),
  vapply(names(nc_ocde), function(i) all(ocde_pays[REF_AREA %in% voisins_en_dessous][[i]] < 0.85 * nc_ocde[[i]][["officiel"]]), logical(1)),
  ocde_pays[REF_AREA %in% voisins_en_dessous, .N] == 3,
  all(unlist(lapply(names(nc_ocde), ocde_au_dessus)) %in% names(NOMS)),
  #   Les États-Unis : Gini, S80/S20 et pauvreté « proches », D9/D1 « plus
  #   faible ».
  abs(ocde_val("USA", "gini") - gini_2019_officiel) < 0.01,
  abs(ocde_val("USA", "s80_s20") - s80_s20_2019) < 0.3,
  ocde_val("USA", "d9_d1") < d9_d1_2019 - 0.5,
  #   « Seule nuance » : la part des 10 % les plus aisés, plus souvent
  #   dépassée que les quatre autres indicateurs.
  n_ocde_haut10_au_dessus / n_ocde_haut10 > max(vapply(names(nc_ocde), n_ocde_au_dessus, integer(1))) / n_ocde,
  # France et Outre-mer : pour le rapport S80/S20, « seule la Guyane fait
  # plus » ; pour le rapport D9/D1, la Nouvelle-Calédonie devance tous les
  # territoires comparés.
  outre_mer[order(-s80_s20)]$territoire[1:2] == c("Guyane", "Nouvelle-Calédonie"),
  outre_mer[order(-d9_d1)]$territoire[1] == "Nouvelle-Calédonie"
)

# Résumé « En bref », diapositive par diapositive. Les mêmes phrases et les
# mêmes chiffres servent à la campagne pour les réseaux sociaux.
brief_ratio_france <- c(
  part_haut10 = part_haut10 / part_haut10_pays("FRA"),
  s80_s20 = s80_s20_2019 / s80_s20_france_2018,
  d9_d1 = d9_d1_2019 / d9_d1_france_2018,
  gini = gini_2019 / gini_france_2018,
  pauvrete = pauvrete_2019 / ocde_val("FRA", "pauvrete")
)
stopifnot(
  # 2 Rapport S80/S20 : l'écart est « presque deux fois plus faible » en
  #   France ; le croquis compare les cinq parts calédoniennes et
  #   françaises : les 20 % les plus modestes reçoivent moins, les 20 % les
  #   plus aisés plus.
  brief_ratio_france[["s80_s20"]] > 1.8, brief_ratio_france[["s80_s20"]] < 2,
  part_bas20 < part_bas20_france, part_haut20 > part_haut20_france,
  # 3 Taux de pauvreté « deux fois plus » élevé qu'en France, au même seuil.
  abs(brief_ratio_france[["pauvrete"]] - 2) < 0.15,
  # 4 « Les cinq outils » au-dessus de la France ; l'écart « tient surtout
  #   aux plus modestes » : rapport D9/D1 et taux de pauvreté « deux fois
  #   plus élevés », part des 10 % les plus aisés « faible ».
  all(brief_ratio_france > 1),
  abs(brief_ratio_france[["d9_d1"]] - 2) < 0.1,
  brief_ratio_france[["part_haut10"]] < 1.1,
  brief_ratio_france[["part_haut10"]] == min(brief_ratio_france),
  # 5 Parmi la France et les Outre-mer comparés, « seule la Guyane » a un
  #   indice de Gini plus élevé que la Nouvelle-Calédonie.
  identical(outre_mer[!is.na(gini) & gini > gini_2019_harmonise, territoire], "Guyane"),
  # 6 « Sept pays sur dix » ont un indice de Gini plus bas, de l'Inde à
  #   Haïti ; le croquis place la Nouvelle-Calédonie dans la classe 0,35-0,40
  #   du globe, en vert clair (GLOBE_OUTILS dans inegalites-revenus.js).
  round(part_sous_nc / 10) == 7, setequal(extremes, c("IND", "HTI")),
  gini_2019_officiel >= 0.35, gini_2019_officiel < 0.40,
  # 7 Pays de l'OCDE : « seulement » quelques pays au-dessus pour le rapport
  #   S80/S20 ; l'Australie, la Nouvelle-Zélande et la France « loin
  #   derrière » (moins de 70 % de la valeur calédonienne).
  n_ocde_au_dessus("s80_s20") < 0.15 * n_ocde,
  all(ocde_pays[REF_AREA %in% c("FRA", "AUS", "NZL"), s80_s20] < 0.7 * s80_s20_2019),
  # 8 De 2008 à 2019, les inégalités ont « un peu reculé » : les cinq outils
  #   baissent tous, l'indice de Gini de moins de 0,03 et le taux de pauvreté
  #   de moins d'un point.
  all(indicateurs_nc$nc_2019 < indicateurs_nc$nc_2008),
  gini_2008 - gini_2019 < 0.03, pauvrete_2008 - pauvrete_2019 < 1
)
