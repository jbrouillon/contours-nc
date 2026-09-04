// Editorial V2 drop-in wrapper for Pacific Climate Fingerprints.
// The original localization module is pinned to the repository state before this editorial refactor.
import * as base from "https://cdn.jsdelivr.net/gh/jbrouillon/contours-nc@6d8dd05d73a8251731cf8c22fabe27a194c49d8c/assets/js/pacific-climate-fingerprints/climate-i18n.js";

const OVERRIDES = {
  en: {
  "header.eyebrow": "PACIFIC CLIMATE FINGERPRINTS · OBSERVATIONS THROUGH 2025",
  "header.title": "One Pacific. Twenty-two climate fingerprints.",
  "header.lede": "Warming crosses the Pacific, but its fingerprint is never exactly the same from one territory to another. Here, a climate fingerprint aligns up to four observed signals through time: ocean heat, land heat, rainfall and sea level.",
  "header.formulaSignals": "up to 4 observed signals",
  "header.formulaTerritories": "22 territories",
  "header.formulaResult": "22 climate fingerprints",
  "header.formulaAria": "Up to four observed signals across 22 territories form 22 climate fingerprints",
  "header.stamp": "READ<br>THE<br>CHANGE",
  "source.note": "Created as <em>Contours</em>’ submission to the <a href=\"https://pacificdatavizchallenge.org/\" target=\"_blank\" rel=\"noreferrer\">2026 Pacific Dataviz Challenge</a>, dedicated to climate change. Sources: <a href=\"https://stats.pacificdata.org/\" target=\"_blank\" rel=\"noreferrer\">Pacific Data Hub</a> (climate and population indicators); <a href=\"https://gml.noaa.gov/ccgg/trends/data.html\" target=\"_blank\" rel=\"noreferrer\">NOAA Global Monitoring Laboratory</a> (atmospheric CO₂); <a href=\"https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt\" target=\"_blank\" rel=\"noreferrer\">NOAA Climate Prediction Center</a> (Oceanic Niño Index). Values are annual and missing observations are not interpolated. The map covers 21 territories; Pitcairn, not mapped, remains in the 22-territory atlas. Observation periods and references differ by indicator: see the <a href=\"../../assets/data/pacific-climate-fingerprints/SOURCES.md\">methodological notes</a> for transformations and interpretation cautions.",
  "explore.prompt": "Choose one signal and compare it across the Pacific",
  "explore.help": "Colours show departures from each territory’s own reference, not absolute climate. Open “Understand this indicator” for method and coverage.",
  "atlas.title": "Twenty-two fingerprints, one Pacific",
  "atlas.intro": "Each row is a territory. First compare one signal across the Pacific; then select a row to align that territory’s four records into its climate fingerprint.",
  "atlas.compareNote": "All ribbons share the same 1850—2025 time axis. Blank sections mean no published observation; values are not interpolated.",
  "atlas.detailKicker": "CLIMATE FINGERPRINT · SELECTED TERRITORY",
  "atlas.detailMetric": "4 signals · 1 shared timeline",
  "atlas.detailCompareSummary": "This is the climate fingerprint of {territory}: four observed records aligned through time. Hover a stripe for its value; click it to return that indicator and year to the map.",
  "atlas.detailCompareCaption": "Read each indicator on its own scale. Compare patterns through time, not colours between different indicators. Blank spans mean no published observation.",
  "atlas.summaryKicker": "WHAT STANDS OUT",
  "conclusion.kicker": "WHAT THIS FINGERPRINT SHOWS",
  "conclusion.title": "Three signals to remember for {territory}",
  "conclusion.lede": "These statements summarise observed records. They describe the past and present; they do not predict the future.",
  "conclusion.caveat": "One direction can be shared without producing one identical trajectory. Each indicator has its own unit, reference and observation period; colours compare a territory with its own reference, not the absolute climates of different islands.",
  "scrolly.instructions": "Scroll through the story. The map updates as each card becomes active; on small screens, swipe the cards.",
  "scrolly.opening.number": "START HERE · 2025",
  "scrolly.opening.title": "In 2025, no mapped territory is blue",
  "scrolly.opening.bodyDesktop": "All 21 mapped territories are warmer than their own sea-surface reference. But this shared direction emerged through very different histories.",
  "scrolly.opening.bodyCompact": "All 21 mapped territories are warmer than their own sea-surface reference. But this shared direction emerged through very different histories.",
  "scrolly.opening.cueDesktop": "Rewind to 1960 ↓",
  "scrolly.opening.cueCompact": "Next: rewind to 1960 →",
  "scrolly.warming.number": "ACT 1 · OCEAN · 1960 → 2025",
  "scrolly.warming.title": "How did red take over the Pacific?",
  "scrolly.warming.bodyDesktop": "Rewind the map, then move forward: blue becomes rarer while warm anomalies spread across territories.",
  "scrolly.warming.bodyCompact": "Press Play: blue becomes rarer while warm anomalies spread across territories.",
  "scrolly.warming.evidence": "One colour = one territory’s departure from its own local reference.",
  "scrolly.landWarming.number": "ACT 1 · LAND · 1960 → 2025",
  "scrolly.landWarming.title": "The warming signal does not stop at the shore",
  "scrolly.landWarming.bodyDesktop": "Switch from ocean to land. The same broad warming direction appears, but coverage and local trajectories differ.",
  "scrolly.landWarming.bodyCompact": "Press Play: land shows the same broad warming direction, with different local trajectories.",
  "scrolly.landWarming.evidence": "Ocean and land are separate records: similar direction does not mean identical evolution.",
  "scrolly.rain.number": "ACT 2 · RAINFALL · DIFFERENT DIRECTIONS",
  "scrolly.rain.title": "Climate change does not mean the same rainfall everywhere",
  "scrolly.rain.body": "Some territories are wetter than their usual level, others drier, and many remain highly variable. Rainfall breaks the idea of one single Pacific trajectory.",
  "scrolly.rain.evidence": "Blue = wetter than the local reference · orange = drier.",
  "scrolly.sea.number": "ACT 3 · SEA LEVEL · 1993 → 2023",
  "scrolly.sea.title": "A shorter record adds another rising signal",
  "scrolly.sea.body": "The sea-level archive starts much later. Recent years increasingly sit above each territory’s early-record reference, so this signal must be read on its own timescale.",
  "scrolly.sea.evidence": "A common direction, observed over a shorter period.",
  "scrolly.explore.number": "FROM THE PACIFIC TO ONE TERRITORY",
  "scrolly.explore.title": "Now reveal a climate fingerprint",
  "scrolly.explore.body": "So far, you compared territories one signal at a time. Choose a territory and align its four records to see what makes its trajectory distinctive.",
  "scrolly.explore.cue": "Explore the 22 fingerprints ↓",
  "metric.ocean.description": "Compared with its own local reference, how unusual was sea-surface temperature in each territory?",
  "metric.land.description": "Compared with its own local reference, how unusual was land-surface temperature in each territory?",
  "metric.rain.description": "Compared with its own usual rainfall, was each territory wetter, drier or close to normal?",
  "atlas.readingStripe": "1 stripe = 1 observed year",
  "atlas.readingTime": "Left = earlier · right = more recent",
  "atlas.readingZero": "Pale = close to the local reference",
  "atlas.readingBlank": "Blank = no published observation"
},
  fr: {
  "header.eyebrow": "EMPREINTES CLIMATIQUES DU PACIFIQUE · OBSERVATIONS JUSQU’EN 2025",
  "header.title": "Un même Pacifique. Vingt-deux empreintes climatiques.",
  "header.lede": "Le réchauffement traverse le Pacifique, mais son empreinte n’est jamais exactement la même d’un territoire à l’autre. Ici, une empreinte climatique aligne jusqu’à quatre signaux observés dans le temps : température de l’océan, température des terres, pluies et niveau marin.",
  "header.formulaSignals": "jusqu’à 4 signaux observés",
  "header.formulaTerritories": "22 territoires",
  "header.formulaResult": "22 empreintes climatiques",
  "header.formulaAria": "Jusqu’à quatre signaux observés dans 22 territoires forment 22 empreintes climatiques",
  "header.stamp": "LIRE<br>LE<br>CHANGEMENT",
  "source.note": "Cette visualisation est la soumission de <em>Contours</em> au <a href=\"https://pacificdatavizchallenge.org/fr\" target=\"_blank\" rel=\"noreferrer\">Pacific Dataviz Challenge 2026</a>, consacré au changement climatique. Sources : <a href=\"https://stats.pacificdata.org/\" target=\"_blank\" rel=\"noreferrer\">Pacific Data Hub</a> (indicateurs climatiques et démographiques) ; <a href=\"https://gml.noaa.gov/ccgg/trends/data.html\" target=\"_blank\" rel=\"noreferrer\">NOAA Global Monitoring Laboratory</a> (CO₂ atmosphérique) ; <a href=\"https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt\" target=\"_blank\" rel=\"noreferrer\">NOAA Climate Prediction Center</a> (Oceanic Niño Index). Les valeurs sont annuelles et les observations manquantes ne sont pas interpolées. La carte couvre 21 territoires ; Pitcairn, non cartographié, reste présent dans l’atlas qui en réunit 22. Les périodes d’observation et les références diffèrent selon les indicateurs : voir les <a href=\"../../assets/data/pacific-climate-fingerprints/SOURCES.md\">notes méthodologiques</a> pour les transformations et précautions d’interprétation.",
  "explore.prompt": "Choisissez un signal et comparez-le dans tout le Pacifique",
  "explore.help": "Les couleurs montrent des écarts à la référence propre de chaque territoire, pas leur climat absolu. Ouvrez « Comprendre cet indicateur » pour la méthode et la couverture.",
  "atlas.title": "Vingt-deux empreintes, un même Pacifique",
  "atlas.intro": "Chaque ligne est un territoire. Comparez d’abord un signal dans tout le Pacifique, puis sélectionnez une ligne pour aligner les quatre séries de ce territoire et révéler son empreinte climatique.",
  "atlas.compareNote": "Tous les rubans partagent le même axe 1850—2025. Les zones vides signalent l’absence d’observation publiée ; les valeurs ne sont pas interpolées.",
  "atlas.detailKicker": "EMPREINTE CLIMATIQUE · TERRITOIRE SÉLECTIONNÉ",
  "atlas.detailMetric": "4 signaux · 1 chronologie commune",
  "atlas.detailCompareSummary": "Voici l’empreinte climatique de {territory} : quatre séries observées alignées dans le temps. Survolez une bande pour lire sa valeur ; cliquez pour retrouver cet indicateur et cette année sur la carte.",
  "atlas.detailCompareCaption": "Lisez chaque indicateur avec sa propre échelle. Comparez les motifs dans le temps, pas les couleurs entre indicateurs différents. Un espace vide signifie qu’aucune observation n’est publiée.",
  "atlas.summaryKicker": "CE QUI RESSORT",
  "conclusion.kicker": "CE QUE MONTRE CETTE EMPREINTE",
  "conclusion.title": "Trois signaux à retenir pour {territory}",
  "conclusion.lede": "Ces phrases résument les observations disponibles. Elles décrivent le passé et le présent ; elles ne prédisent pas l’avenir.",
  "conclusion.caveat": "Une direction peut être commune sans produire une trajectoire identique. Chaque indicateur possède son unité, sa référence et sa période d’observation ; les couleurs comparent un territoire à sa propre référence, pas les climats absolus des différentes îles.",
  "scrolly.instructions": "Faites défiler le récit. La carte se met à jour à chaque carte active ; sur mobile, faites glisser les cartes.",
  "scrolly.opening.number": "COMMENCEZ ICI · 2025",
  "scrolly.opening.title": "En 2025, aucun territoire cartographié n’est bleu",
  "scrolly.opening.bodyDesktop": "Les 21 territoires cartographiés sont tous plus chauds que leur propre référence de température de surface de la mer. Mais cette direction commune s’est construite au fil de trajectoires très différentes.",
  "scrolly.opening.bodyCompact": "Les 21 territoires cartographiés sont tous plus chauds que leur propre référence de température de surface de la mer. Mais cette direction commune s’est construite au fil de trajectoires très différentes.",
  "scrolly.opening.cueDesktop": "Revenons en 1960 ↓",
  "scrolly.opening.cueCompact": "Suivant : retour en 1960 →",
  "scrolly.warming.number": "ACTE 1 · OCÉAN · 1960 → 2025",
  "scrolly.warming.title": "Comment le rouge a-t-il gagné le Pacifique ?",
  "scrolly.warming.bodyDesktop": "Remontez le temps puis avancez : le bleu se raréfie tandis que les anomalies chaudes gagnent les territoires.",
  "scrolly.warming.bodyCompact": "Lancez l’animation : le bleu se raréfie tandis que les anomalies chaudes gagnent les territoires.",
  "scrolly.warming.evidence": "Une couleur = l’écart d’un territoire à sa propre référence locale.",
  "scrolly.landWarming.number": "ACTE 1 · TERRES · 1960 → 2025",
  "scrolly.landWarming.title": "Le signal du réchauffement ne s’arrête pas au rivage",
  "scrolly.landWarming.bodyDesktop": "Passez de l’océan aux terres. La même direction générale apparaît, mais les périodes d’observation et les trajectoires locales diffèrent.",
  "scrolly.landWarming.bodyCompact": "Lancez l’animation : les terres montrent la même direction générale, avec des trajectoires locales différentes.",
  "scrolly.landWarming.evidence": "Océan et terres sont deux séries distinctes : une direction similaire ne signifie pas une évolution identique.",
  "scrolly.rain.number": "ACTE 2 · PLUIES · DES DIRECTIONS OPPOSÉES",
  "scrolly.rain.title": "Le changement climatique ne signifie pas la même pluie partout",
  "scrolly.rain.body": "Certains territoires sont plus humides que leur niveau habituel, d’autres plus secs, et beaucoup restent très variables. Les pluies cassent l’idée d’une trajectoire pacifique unique.",
  "scrolly.rain.evidence": "Bleu = plus humide que la référence locale · orange = plus sec.",
  "scrolly.sea.number": "ACTE 3 · NIVEAU MARIN · 1993 → 2023",
  "scrolly.sea.title": "Une série plus courte ajoute un autre signal à la hausse",
  "scrolly.sea.body": "L’archive du niveau marin commence bien plus tard. Les années récentes se situent de plus en plus souvent au-dessus de la référence du début de série : ce signal doit donc être lu sur sa propre échelle de temps.",
  "scrolly.sea.evidence": "Une direction commune, observée sur une période plus courte.",
  "scrolly.explore.number": "DU PACIFIQUE À UN TERRITOIRE",
  "scrolly.explore.title": "Révélez maintenant une empreinte climatique",
  "scrolly.explore.body": "Jusqu’ici, vous avez comparé les territoires un signal à la fois. Choisissez-en un et alignez ses quatre séries pour voir ce qui distingue sa trajectoire.",
  "scrolly.explore.cue": "Explorer les 22 empreintes ↓",
  "metric.ocean.description": "Par rapport à sa propre référence locale, à quel point la température de surface de la mer était-elle inhabituelle dans chaque territoire ?",
  "metric.land.description": "Par rapport à sa propre référence locale, à quel point la température des terres était-elle inhabituelle dans chaque territoire ?",
  "metric.rain.description": "Par rapport à ses pluies habituelles, chaque territoire était-il plus humide, plus sec ou proche de la normale ?",
  "atlas.readingStripe": "1 bande = 1 année observée",
  "atlas.readingTime": "À gauche = plus ancien · à droite = plus récent",
  "atlas.readingZero": "Couleur pâle = proche de la référence locale",
  "atlas.readingBlank": "Vide = aucune observation publiée"
}
};

function interpolate(template, variables) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => (
    variables[key] === undefined || variables[key] === null ? "" : String(variables[key])
  ));
}

export const initialLanguage = base.initialLanguage;
export const persistLanguage = base.persistLanguage;
export const territoryName = base.territoryName;
export const localizeEnsoPhase = base.localizeEnsoPhase;
export const localizedNumber = base.localizedNumber;
export const localizedPopulation = base.localizedPopulation;

export function translate(language, key, variables = {}) {
  const template = OVERRIDES[language]?.[key];
  if (template !== undefined) return interpolate(template, variables);
  return base.translate(language, key, variables);
}
