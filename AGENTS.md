# AGENTS.md — contours.nc

## Portée et ordre de priorité

Ce fichier s'applique à l'ensemble du dépôt. Un éventuel `AGENTS.md` placé plus bas dans l'arborescence peut préciser ces règles pour son sous-dossier.

En cas de conflit, respecter dans cet ordre :

1. la demande explicite de l'utilisateur ;
2. le `AGENTS.md` le plus proche du fichier modifié ;
3. le présent fichier ;
4. les conventions déjà visibles dans le fichier ou l'article concerné.

Le dépôt alimente **contours.nc**, un carnet de recherche en sciences sociales consacré à la Nouvelle-Calédonie et au Pacifique. Le site associe articles, données, cartographie et datavisualisations. Son identité visuelle repose sur D3.js, rough.js et un langage graphique crayonné. Toute contribution doit préserver à la fois la solidité scientifique, la lisibilité éditoriale et cette identité.

## Principes non négociables

- Travailler en français pour les contenus, l'interface et les échanges avec l'utilisateur, sauf demande contraire ou section bilingue existante.
- Conserver les accents, apostrophes typographiques et fichiers en UTF-8. Ne jamais introduire de texte mal encodé.
- Ne jamais inventer une donnée, une source, une citation, une date, un résultat ou une méthode. Signaler clairement toute incertitude.
- Distinguer dans le texte ce qui relève des données observées, du calcul, de l'interprétation et de l'hypothèse.
- Privilégier les sources primaires et officielles. Pour une information susceptible d'avoir changé, vérifier la version et la date de consultation.
- Ne pas modifier silencieusement le sens politique, historique ou social d'un passage. Les sujets calédoniens demandent précision, contextualisation et respect des dénominations employées par les sources.
- Garder les méthodes reproductibles : les nombres dérivés doivent, autant que possible, être calculés par le code plutôt que recopiés manuellement.
- Préserver le style Contours : papier clair, encre sombre, palette sobre, hachures et traits imparfaits maîtrisés, `Cabin Sketch` pour les accents éditoriaux et `Atkinson Hyperlegible` pour la lecture.
- Ne pas transformer chaque élément en effet crayonné. Rough.js sert la hiérarchie et la matérialité du graphique ; les données, libellés et contrôles restent nets et lisibles.
- Préserver les changements déjà présents dans le worktree. Ne jamais nettoyer, restaurer, déplacer ou reformater des fichiers hors du périmètre demandé.
- Préférer une modification ciblée à une refonte. Ne pas moderniser du code historique sans lien direct avec la tâche.
- Toute campagne pour les réseaux sociaux — textes, sources, exports, vidéos et calendrier Buffer — vit dans le dépôt frère `../contours-nc-social/`. Le présent dépôt ne conserve que les articles, leurs données, leurs visualisations et les composants « En bref » qui alimentent ces campagnes.
- Toute vidéo de campagne (TikTok, Reels, Shorts, format vertical animé) se termine par l'outro animée de contours.nc : `campagnes/lancement-tiktok/contours-nc-outro.mp4` du dépôt social, ajoutée avec l'option `--outro` de `scripts/produire_video.py`. Ne jamais livrer ni programmer une vidéo sans elle.

## Carte du dépôt

| Chemin | Rôle | Règles de travail |
|---|---|---|
| `_quarto.yml` | Configuration globale du site, navigation, rendu, ressources et inclusions | Modification à fort impact : prévoir un rendu global et contrôler plusieurs types de pages. |
| `index.qmd`, `about.qmd` | Accueil et présentation | L'accueil contient la bannière D3/rough et un listing Quarto des publications récentes. |
| `posts/_metadata.yml` | Métadonnées communes des articles | Active par défaut la citation et Google Scholar. Déroger seulement pour une raison explicite. |
| `posts/<slug>/index.qmd` | Source canonique d'un article | Un article vit dans un dossier au slug stable, en minuscules et séparé par des tirets. |
| `posts/<slug>/analysis.R` | Calculs propres à un article | À privilégier quand les transformations sont assez importantes pour être séparées du récit. |
| `posts/<slug>/data/` | Données légères livrées avec un article interactif | Déclarer `resources: - "data/**"` dans le YAML lorsque Quarto doit les copier. |
| `posts/regroupement-bureaux-vote-noumea/v1/`, `v2/` | Instantanés HTML historiques de l'article sur l'accessibilité électorale | Ressources explicitement copiées par `_quarto.yml`. Ne pas les régénérer, déplacer ou supprimer sans demande ciblée. |
| `articles/`, `notes/` | Listings de tous les articles et des notes de recherche | Les pages sont alimentées par les métadonnées des posts ; ne pas dupliquer manuellement un post dans ces listings. |
| `dossiers/` | Parcours éditoriaux thématiques | Les dossiers sont actuellement composés à la main : mettre à jour les cartes, liens, dates et descriptions concernées. |
| `cartes/` | Galerie et pages autonomes de cartes/animations | La galerie est actuellement manuelle : toute nouvelle visualisation publique peut nécessiter une nouvelle carte de galerie. |
| `ressources/` | Données, méthodes et ressources réutilisables | Documenter clairement les formats, limites et conditions de réutilisation. |
| `newsletter/`, `presse/`, `contact/`, `contribuer/` | Pages éditoriales secondaires | Respecter leur ton et leurs appels à l'action existants. |
| `styles.css` | Design system global | Réutiliser les variables CSS de `:root` et les composants existants avant d'ajouter de nouvelles règles. |
| `assets/css/` | Styles propres à une famille d'articles ou une dataviz | Préférable à un long bloc `<style>` dans un nouvel article. |
| `assets/js/` | JavaScript partagé ou propre aux dataviz | Les visualisations récentes et volumineuses doivent être externalisées ici. |
| `assets/vendor/` | D3 v7 et rough.js vendus localement | Réutiliser ces fichiers quand possible ; ne pas modifier les fichiers minifiés à la main. |
| `assets/data/` | Données légères directement consommées par le navigateur | Contenu public. Garder une source et une méthode de génération identifiables. |
| `assets/documents/`, `assets/images/` | Documents et illustrations publiés tels quels | Vérifier droits, poids, texte alternatif et nécessité de publication. |
| `data/elections/data_raw/` | Sources électorales brutes | Ne pas écraser ni corriger une source brute en place. |
| `data/elections/data_processed/` | Tables électorales harmonisées | Toute modification substantielle doit pouvoir être reliée à un script, un schéma ou un manifeste. |
| `data/elections/metadata/` | Provenance, schémas, usages cartographiques et corrections documentées | Lire ces fichiers avant de modifier la chaîne électorale. |
| `data/02_geospatial/`, `data/population/` | Référentiels géographiques et démographiques | Respecter projections, millésimes, géographies et dictionnaires de variables. |
| `data/cartes/` | Exports cartographiques sources | Les PNG originaux peuvent être lourds ; les pages utilisent souvent leurs variantes WebP. |
| `data/pacific-climate-fingerprints/` | Sources, traitements et métadonnées de la dataviz climat | Lire son `README.md` avant toute modification. |
| `data/outputs_*` | Sorties d'analyse et audits réutilisés | Ne pas supposer qu'ils sont tous régénérables sans données locales ignorées. |
| `images/previews/` | Images sociales et vignettes de listings | Viser 1 200 × 630 px quand il s'agit d'une carte sociale ; renseigner `image` et `image-alt`. |
| `images/exports/` | Exports graphiques destinés à la diffusion | Conserver une signature et une définition suffisante. |
| `includes/` | Comportements globaux injectés après le corps des pages | Citation, partage, commentaires, newsletter, sommaire mobile et dates de mise à jour. Tester sur plusieurs types de pages. |
| `scripts/` | Préparation d'images, extraction, contrôles et chaînes de données | Exécuter depuis la racine du dépôt, sauf indication contraire du script. |
| `_freeze/` | Résultats d'exécution gelés par Quarto | Artefacts générés, parfois suivis par Git. Ne pas les éditer manuellement. |
| `docs/` | Site HTML généré et publié par GitHub Pages | Sortie suivie par Git, jamais source de vérité. Ne pas éditer à la main. |
| `.quarto/` | Cache et fichiers temporaires locaux | Ignoré par Git. Ne jamais versionner ni utiliser comme source. |
| `../contours-nc-social/` | Source de vérité des campagnes pour les réseaux sociaux | Pour toute demande de campagne, vérifier aussi son worktree et travailler sous `articles/<slug>/` ou `campagnes/` selon les conventions de ce dépôt. Ne pas créer de nouveau chantier dans `social/` ici. |
| `social/` | Ancien emplacement local ignoré | Ne pas y créer ni y maintenir de campagne ; migrer tout brouillon utile vers `../contours-nc-social/`. |
| `CNAME`, `.nojekyll` | Configuration de publication | Doivent se retrouver dans `docs/` après un rendu complet. |
| `README.md`, `CONTRIBUTING.md`, `README_PREMIER_ARTICLE.md` | Documentation humaine du dépôt | Les consulter et les maintenir cohérents si une modification change les commandes ou conventions décrites. |
| `Contours-NC.Rproj`, `.vscode/` | Configuration locale RStudio/éditeur | Ne pas modifier sauf demande liée à l'environnement de développement. |

Le projet n'a actuellement ni workflow CI général, ni manifeste central de dépendances R/Python/JavaScript. Ne pas supposer qu'une dépendance est disponible : vérifier l'environnement et documenter toute nouvelle dépendance.

## Sources de vérité et fichiers générés

La chaîne générale est :

```text
données brutes → scripts/analysis.R → données traitées/figures → fichiers .qmd + assets → Quarto → docs/
```

- Modifier les `.qmd`, les scripts, `styles.css` et `assets/`, puis régénérer la sortie nécessaire.
- La liste `project.render` de `_quarto.yml` est explicite. Une nouvelle page placée hors des motifs existants ne sera pas rendue : vérifier le motif avant d'étendre la configuration.
- Ne jamais corriger un défaut uniquement dans `docs/` : la prochaine compilation l'effacerait.
- `docs/` est suivi parce qu'il constitue le site publié. Pour une livraison destinée à la publication, les sources et les sorties pertinentes doivent être cohérentes.
- Une modification dans `assets/` est copiée dans `docs/assets/` au rendu. Vérifier que les deux versions correspondent avant publication.
- `execute.freeze: auto` est défini globalement. Après une modification de données, d'un script R ou d'un calcul, s'assurer que le rendu a réellement réexécuté ce qui devait l'être et que le résultat gelé n'est pas périmé.
- Ne pas supprimer globalement `_freeze/`, `docs/` ou `.quarto/`. Si une invalidation ciblée devient nécessaire, identifier exactement le dossier concerné et préserver les travaux tiers.
- Respecter `.gitignore`. Les rasters, shapefiles, caches OCR, exports sociaux et autres fichiers lourds ignorés ne doivent pas être ajoutés par accident.

## Avant toute modification

1. Exécuter `git status --short` et considérer tout changement existant comme appartenant à l'utilisateur.
2. Lire le fichier cible, ses voisins immédiats et le précédent le plus proche dans le dépôt.
3. Repérer la provenance des données et le script qui les produit avant de modifier un résultat.
4. Déterminer si la tâche touche seulement une page, un composant partagé ou la publication globale.
5. Annoncer les hypothèses qui peuvent modifier le sens, la méthode, les données ou le périmètre.

Ne demander une précision que si aucune hypothèse raisonnable et réversible ne permet d'avancer. Pour une tâche d'implémentation, aller jusqu'à une vérification proportionnée au risque.

## Créer ou modifier un article

### Structure recommandée

```text
posts/mon-slug/
├── index.qmd
├── analysis.R          # si nécessaire
└── data/               # uniquement les données web propres à l'article
```

Métadonnées de base pour une nouvelle publication :

```yaml
---
title: "Titre précis"
subtitle: "Angle ou promesse de lecture"
author: "Nom de l'auteur"
date: "YYYY-MM-DD"
draft: true
lang: fr
rubrique: "Territoires et société"
categories:
  - Premier tag
  - Second tag
description: "Résumé autonome et informatif pour les moteurs et les partages."
image: "../../images/previews/mon-slug.jpg"
image-alt: "Description utile du contenu de l'image"
title-block-banner: true
toc: true
toc-depth: 3
execute:
  echo: false
  warning: false
  message: false
---
```

- Les quatre rubriques de référence sont celles de `CONTRIBUTING.md` : `Politique et élections`, `Territoires et société`, `Cartographie et données`, `Méthodes`.
- Utiliser en général deux catégories, trois lorsqu'un second axe de lecture le justifie. Ne pas créer des variantes de casse ou de vocabulaire pour un tag existant.
- Ne pas normaliser en masse les anciennes rubriques ou catégories sans demande explicite.
- Ajouter `research-note: true` et un `note-number` cohérent uniquement pour une vraie note de recherche, avec méthode explicite et documentation renforcée.
- Utiliser `date-modified` lors d'une mise à jour éditoriale substantielle, pas pour une simple correction typographique.
- Garder `draft: true` tant que le contenu, les sources, l'image sociale ou les contrôles ne sont pas prêts. Le projet utilise `draft-mode: unlinked` : ne pas modifier ce réglage global pour publier une seule page.
- Tout nouvel article long ou structurant comporte un résumé « En bref » en diapositives (voir ci-dessous). L'ancien encadré `::: {.en-bref}` reste acceptable pour une note courte ou un article historique.
- Éviter les titres sensationnalistes. Un titre peut être engageant mais doit décrire honnêtement l'objet et le niveau de preuve.
- Toute image informative reçoit un texte alternatif. Une image purement décorative peut recevoir `alt=""`.
- Sourcer les chiffres, citations et documents au plus près du passage. Indiquer les limites de millésime, de couverture et de comparabilité.
- Employer les espaces insécables et la typographie française lorsque cela améliore le rendu, sans casser les expressions de code ni les données.

### Résumé « En bref » en diapositives

Les diapositives « En bref » sont la norme du site pour résumer un article. Elles reposent sur un composant commun, `assets/js/contours-brief.js` et `assets/css/contours-brief.css`, qui construit le bouton de lancement, le dialogue, la navigation (boutons, points, flèches du clavier, balayage), le piège de focus et le lien direct `?lecture=en-bref&slide=n`. Sans JavaScript, les diapositives restent lisibles à la suite. Précédent : `posts/provinciales-2026-geographie-forces-politiques/index.qmd` (le résumé de `posts/regroupement-bureaux-vote-noumea/` est une version antérieure, propre à l'article).

- Placer une section `## En bref` en début d'article, après l'introduction et les éventuels chiffres clés, contenant une `<section class="contours-brief" data-contours-brief data-brief-lede="…">` et une `<article class="contours-brief-slide">` par écran. Charger le CSS dans l'en-tête et `contours-brief.js` en fin d'article.
- Chaque diapositive suit la même structure : `contours-brief-step` (numéro · thème), un `h3` formulé comme une phrase-résultat, un chiffre fort `contours-brief-big`, puis une phrase de précision (source, repère de comparaison, limite).
- Viser cinq à neuf écrans. Le dernier rappelle la méthode ou la principale limite et renvoie vers la section détaillée (`contours-brief-read`).
- Les diapositives ne contiennent que des résultats démontrés dans l'article. Les chiffres sont produits par le code (R inline ou données), jamais recopiés à la main. Le sens d'une évolution est marqué explicitement par `is-up` ou `is-down`, calculé à partir du signe.
- Un croquis optionnel `svg.contours-brief-sketch[data-brief-sketch]` (viewBox `0 0 420 240`, `role="img"` et `aria-label` descriptif) est dessiné par le script de l'article à l'écoute de l'événement `contours-brief:open` (`event.detail.dialog`). Il réutilise les classes, couleurs et graines déterministes de la visualisation principale et porte la signature `contours.nc`.
- Vérifier ouverture, fermeture (Échap, bouton, clic hors du panneau), navigation clavier, lien direct, rendu mobile et absence d'erreur console.
- Le résumé et la campagne sociale d'un article (`../contours-nc-social/articles/<slug>/`) racontent la même chose : mêmes écrans, mêmes chiffres, mêmes règles de calcul (un bloc `brief_*` d'`analysis.R` avec `stopifnot` qui vérifie les phrases). Écrire pour le grand public et garder les textes des croquis lisibles sur mobile (au moins 8,5 unités du viewBox). Les croquis étant dessinés dans des diapositives masquées, ne pas mesurer la largeur d'un texte avec `getComputedTextLength()` : elle vaut 0.

### R et calculs intégrés

- Pour une analyse conséquente, placer les calculs dans `analysis.R` et le charger depuis le chunk `setup`, comme dans les articles récents :

```r
article_dir <- dirname(knitr::current_input(dir = TRUE))
source(
  file.path(article_dir, "analysis.R"),
  local = knitr::knit_global(),
  encoding = "UTF-8"
)
```

- Pour les chemins partagés du dépôt, `here::here()` est accepté et déjà utilisé.
- Ne pas dépendre du répertoire de travail implicite d'une session RStudio.
- Garder les données brutes intactes et écrire les sorties dans un emplacement explicite.
- Vérifier au minimum : unicité des clés, valeurs manquantes, totaux, dénominateurs, bornes des pourcentages, effectifs après jointure et cohérence des millésimes.
- Ne pas arrondir avant la fin des calculs. Dans le texte français, distinguer `%`, points de pourcentage, voix, inscrits, votants et exprimés.
- Une jointure floue, une correction manuelle ou une exclusion doit laisser une trace d'audit ou de métadonnées.
- Pour les données spatiales, documenter le SCR, l'unité des distances, le mode de simplification/lissage et les géométries exclues.
- Si une donnée locale facultative manque, produire un message explicite ou un mode de prévisualisation dégradé ; ne jamais substituer des valeurs fictives.

## Données et reproductibilité

- Les sources brutes sont immuables. Toute harmonisation va dans `data_processed/`, un dossier de sortie ou le `data/` de l'article.
- Associer à toute nouvelle source : organisme, titre, URL ou référence, date/millésime, date de téléchargement si pertinente, licence ou conditions, et transformations appliquées.
- Préserver les noms de colonnes stables dans les fichiers publics. Si un schéma change, mettre à jour ensemble le producteur, les consommateurs, les métadonnées et les contrôles.
- Garder les fichiers navigateur aussi petits que raisonnablement possible : colonnes utiles seulement, géométries simplifiées à une tolérance documentée, précision numérique adaptée à l'usage.
- Ne pas exposer dans `assets/data/`, `posts/*/data/` ou `docs/` une donnée personnelle, confidentielle ou non destinée à la publication.
- Les tableaux publiés doivent pouvoir être reliés à leur source et à leur script. Ajouter un `README`, `SOURCES.md`, manifeste ou `metadata.json` lorsque la chaîne n'est pas évidente.
- Lorsqu'un résultat existant et un recalcul divergent, arrêter la publication, quantifier l'écart et rechercher sa cause avant de choisir une version.

Références internes importantes :

- `data/elections/metadata/schema_cible.md`
- `data/elections/metadata/sources_manifest.csv`
- `data/elections/metadata/geoloc_overrides.csv`
- `data/outputs_provinciales_candidats/README.md`
- `data/pacific-climate-fingerprints/README.md`
- `assets/data/pacific-climate-fingerprints/SOURCES.md`
- `README_PREMIER_ARTICLE.md` pour les fichiers locaux nécessaires aux analyses d'accessibilité électorale.

## Identité visuelle et visualisations D3/rough.js

### Vocabulaire graphique

Réutiliser d'abord les variables globales de `styles.css` :

- fond général `--bg: #f7f7f4` ;
- papier `--surface` ou `#fffdf8` dans les figures ;
- encre `--ink: #252525` ;
- texte principal `--text` et secondaire `--muted` ;
- accents historiques `--red`, `--green`, `--yellow` ;
- bordures chaudes `--border`.

Les couleurs spécifiques à un sujet sont possibles, mais leur signification doit rester constante dans toute la figure et dans son texte. Pour une comparaison temporelle, partager explicitement la même échelle lorsque c'est le message analytique recherché.

### Architecture recommandée

- Pour une nouvelle dataviz substantielle, mettre le CSS dans `assets/css/<slug>.css` et le JavaScript dans `assets/js/<slug>.js`.
- Dans un post, charger en priorité les versions locales :

```html
<script src="../../assets/vendor/d3.v7.min.js"></script>
<script src="../../assets/vendor/rough.v4.js"></script>
```

- Conserver un grand script inline seulement lorsqu'on intervient localement sur un article historique et que l'extraction augmenterait inutilement le risque.
- Initialiser le composant depuis un attribut `data-*` ou un identifiant propre à l'article. Si le conteneur ou une bibliothèque manque, sortir sans casser la page.
- Charger les CSV/GeoJSON avec `Promise.all`, typer les CSV (`d3.autoType`) et afficher une erreur compréhensible dans le composant en cas d'échec.
- Utiliser des chemins relatifs compatibles avec la page générée et servir la prévisualisation par HTTP ; les chargements `fetch()` ne doivent pas être validés uniquement via `file://`.
- Pour les textures rough.js, fournir des graines déterministes dérivées d'une clé stable. Un rechargement ne doit pas changer arbitrairement le graphique ni les captures.

### Rendu attendu

- D3 gère données, projections, échelles, axes, disposition et interaction ; rough.js habille contours, cadres, repères et hachures.
- Conserver les textes importants en SVG/HTML nets. Éviter d'utiliser rough.js pour les libellés, petits symboles ou grandes surfaces lorsque cela gêne la lecture ou les performances.
- Utiliser un `viewBox`, une largeur fluide et des règles mobiles explicites. Éviter un graphique seulement lisible à 1 180 px.
- Pour une dataviz complexe, prévoir un mode mobile simplifié plutôt que réduire mécaniquement la version bureau.
- Tout contrôle interactif a un vrai `<button>`, `<select>` ou lien, un libellé visible ou `aria-label`, un état (`aria-pressed`, `aria-current`, etc.) et un focus clavier perceptible.
- Un SVG informatif reçoit `role="img"` et un `aria-label` ou `aria-labelledby` qui décrit le message, pas seulement le type de graphique.
- Les cibles survolables importantes doivent aussi être accessibles au focus. L'infobulle ne peut pas être l'unique endroit où une information indispensable est disponible.
- Ne pas coder une distinction uniquement par la couleur : ajouter libellés, position, forme, texture ou légende.
- Respecter `prefers-reduced-motion`. Une animation doit pouvoir être interrompue et ne doit pas être requise pour comprendre le résultat.
- Prévoir un état de chargement, un état d'erreur et, pour une expérience éditoriale majeure, un contenu de repli lisible sans JavaScript.
- Éviter les appels réseau inutiles. Les données stables du site doivent de préférence être publiées localement ; une dépendance CDN critique demande un repli raisonnable.
- Si la figure propose un export PNG, vérifier le fond, les polices, la légende, le nom de fichier, la résolution et la signature discrète `contours.nc`.
- L'export ou la capture destinée aux réseaux sociaux doit rester intelligible hors du contexte de l'article : titre, période, unité, légende, source courte et signature.

Les meilleurs précédents récents sont :

- `assets/js/provinciales-2026-geographie-forces.js` pour une carte comparative accessible, déterministe et exportable ;
- `assets/js/regroupement-bureaux-vote-noumea-v2*.js` pour les cartes multimodales, contrôles et exports ;
- `assets/js/pacific-climate-fingerprints/` pour une expérience éditoriale complexe avec modes bureau/mobile, internationalisation et tests dédiés ;
- `assets/js/contours-sketch.js` et `assets/js/sketch-labels.js` pour l'identité graphique globale ;
- `assets/js/contours-brief.js` pour les diapositives « En bref » communes au site.

## CSS, HTML et composants globaux

- Chercher un composant existant avant de créer une nouvelle classe : cartes, encadrés, boutons d'export, légendes, galeries et dossiers sont déjà stylés.
- Préfixer les classes propres à une dataviz ou un article pour éviter les collisions globales.
- Éviter les styles inline pour les composants répétés. Les petites exceptions propres à une seule phrase ou figure restent acceptables.
- Ne pas augmenter la spécificité avec `!important` sans comprendre la cascade Quarto/Bootstrap existante.
- Vérifier les largeurs `column-page` et `page-layout: full` sur mobile ; une pleine largeur n'autorise ni débordement horizontal involontaire ni texte trop long.
- Garder un HTML sémantique : titres hiérarchisés, `<figure>`/`<figcaption>` ou légende équivalente, tableaux avec en-têtes, liens descriptifs.
- Les scripts de `includes/` s'exécutent sur de nombreuses pages. Ils doivent être idempotents, tolérer l'absence de leur cible et ne pas ralentir les pages non concernées.
- Toute image ajoutée au contenu doit fonctionner avec la lightbox globale ou être explicitement exclue via `.no-lightbox` si l'interaction serait incorrecte.

## Images et aperçus sociaux

- Conserver l'original utile et produire une variante WebP pour le Web quand elle est plus légère.
- Depuis la racine :

```powershell
python scripts/prepare_web_images.py
python scripts/prepare_social_previews.py
```

- `prepare_web_images.py` traite par défaut `data/cartes/` et `images/`, avec une dimension maximale de 3 500 px et une qualité WebP de 92. Ne pas utiliser `--force` sans nécessité.
- `prepare_social_previews.py` ne connaît qu'une liste explicite de previews. Ajouter une entrée au script si la nouvelle preview doit devenir reproductible.
- Contrôler visuellement le recadrage, la taille de fichier, les accents et la lisibilité à petite taille.
- Ne pas ajouter un raster très lourd si un SVG, un WebP ou une donnée simplifiée offre le même résultat.

## Commandes de travail

Exécuter les commandes depuis la racine du dépôt.

Prévisualisation générale :

```powershell
quarto preview
```

Rendu ciblé d'un article :

```powershell
quarto render posts/<slug>/index.qmd
```

Rendu complet destiné à la publication :

```powershell
python scripts/prepare_web_images.py
python scripts/prepare_social_previews.py
quarto render
```

Points d'attention :

- Un rendu complet modifie `docs/`, les listings, les flux, la recherche et parfois `_freeze/`. Ne le lancer que lorsque la portée le justifie.
- `Rscript` n'est pas nécessairement dans le `PATH` sous Windows. Utiliser l'installation R détectée ou RStudio sans coder en dur une version dans les sources.
- Python requiert Pillow pour les deux scripts d'images.
- Deno/Node ne sont pas des dépendances globales garanties. Ne pas installer un runtime ou un package sans que la tâche le nécessite et sans en informer l'utilisateur.
- Les scripts de téléchargement ou d'actualisation changent des sources externes : ne les lancer que si la demande porte sur cette mise à jour, puis auditer le diff des données.

## Cas particulier : Pacific Climate Fingerprints

La chaîne est documentée dans `data/pacific-climate-fingerprints/README.md` :

- `download_official_datasets.R` télécharge et inventorie les jeux officiels ;
- `prepare_climate_data.R` produit les observations traitées et le CSV navigateur ;
- `prepare_context_data.py` produit les tables de contexte ;
- `refresh-context-data.ps1` actualise les séries NOAA et démographiques avant reconstruction ;
- `optimize_eez_geojson.py` simplifie la couche EEZ publique ;
- `assets/data/pacific-climate-fingerprints/SOURCES.md` documente la publication.

Tests dédiés, seulement si Deno est disponible :

```powershell
deno run --allow-read --allow-net scripts/pacific-climate-fingerprints/smoke-test.mjs
deno run --allow-read --allow-net scripts/pacific-climate-fingerprints/smoke-test-mobile.mjs
deno run --allow-read scripts/pacific-climate-fingerprints/publication-audit.mjs
```

Ne pas appliquer ces tests à tout le site : ils sont spécifiques à cet article.

## Vérification proportionnée

### Pour un changement de texte ou de métadonnées

- Relire le passage dans son contexte.
- Vérifier orthographe, typographie, liens, sources, titres et cohérence des métadonnées.
- Rendre au minimum la page concernée si la syntaxe Quarto/YAML ou les liens ont changé.

### Pour un calcul ou des données

- Réexécuter le script producteur pertinent.
- Comparer les effectifs, totaux et sorties avant/après.
- Examiner le diff des CSV/JSON sans se limiter à leur date de modification.
- Rendre l'article et confronter les chiffres du texte, des tableaux et des graphiques.

### Pour du CSS, du JavaScript ou une dataviz

- Contrôler la console : aucune erreur JavaScript, ressource 404 ou promesse rejetée.
- Tester au minimum une largeur mobile, une tablette ou petite fenêtre, et un bureau large.
- Tester clavier, focus, contrôles, infobulles, changement d'état et téléchargement s'il existe.
- Vérifier chargement, erreur et absence de données ; tester `prefers-reduced-motion` si la figure est animée.
- Inspecter la figure avec des libellés longs et sans dépendre uniquement du survol.
- Servir via `quarto preview` ou un serveur local HTTP pour valider les `fetch()`.

### Pour une publication ou un composant global

- Faire un rendu complet.
- Contrôler accueil, article standard, note de recherche, dossier, galerie et page secondaire.
- Vérifier `docs/CNAME`, `docs/.nojekyll`, les listings, `search.json`, `sitemap.xml` et les flux générés.
- S'assurer qu'un brouillon n'a pas été rendu public ou ajouté aux listings par erreur.
- Comparer les assets source et leurs copies dans `docs/assets/`.

### Contrôle final systématique

```powershell
git status --short
git diff --check
git diff --stat
```

Puis inspecter le diff utile fichier par fichier. Distinguer explicitement les changements préexistants de ceux produits par la tâche. Ne pas prétendre qu'un test a réussi s'il n'a pas été exécuté ; indiquer les limitations de l'environnement.

## Git et sécurité du dépôt

- Ne jamais utiliser `git reset --hard`, `git clean`, `git checkout -- <fichier>` ni supprimer récursivement un dossier pour obtenir un worktree propre.
- Ne pas écraser une modification utilisateur, y compris dans un fichier généré.
- Ne pas inclure dans une livraison des changements sans rapport causés par un rendu global.
- Ne pas committer, pousser, publier ou déployer sans demande explicite.
- Ne pas ajouter de secrets, jetons, cookies, chemins personnels ou données locales sensibles.
- Ne pas modifier `CNAME`, l'URL canonique ou les mécanismes de newsletter/commentaires sans demande explicite.
- Avant toute suppression matérielle, identifier la source régénérable et obtenir l'autorisation si la suppression ne découle pas clairement de la demande.

## Critères de fin

Une tâche est terminée lorsque :

- la demande est réalisée dans les fichiers sources appropriés ;
- le contenu reste exact, sourcé et cohérent avec les conventions éditoriales ;
- l'identité D3/rough.js de Contours est respectée lorsqu'une visualisation est concernée ;
- l'affichage est lisible, responsive et accessible au niveau pertinent ;
- les vérifications adaptées ont été exécutées ou leurs limites sont signalées ;
- les sorties générées nécessaires sont cohérentes avec les sources ;
- aucun changement utilisateur ou fichier hors périmètre n'a été altéré ;
- le compte rendu final énumère brièvement les fichiers modifiés, les contrôles effectués et les éventuels points restant à valider.
