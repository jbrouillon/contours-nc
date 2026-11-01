(() => {
  "use strict";

  // Figures et croquis de l'article « Inégalités de revenus : où se situe la
  // Nouvelle-Calédonie ? ».
  //
  // - Figures : éléments [data-gini-chart] dont les attributs data-* portent
  //   la source des données, le titre et le pied de figure :
  //   « partage » (dix habitants et leur pile de francs), « gateau » (outil 1 :
  //   la part des 10 % les plus aisés dans un gâteau coupé en dix),
  //   « quintiles » (outil 2 : cinq piles par territoire, les deux extrêmes
  //   comparés), « echelle » (outil 3 : seuils D1 à D9, médiane et seuil de
  //   pauvreté, rapportés au niveau de vie médian de chaque territoire),
  //   « explication » (outil 4 : dix parts du revenu et courbe de Lorenz,
  //   situations théoriques, Nouvelle-Calédonie et pays au choix),
  //   « pauvrete » (outil 5 : cent silhouettes par territoire), « globe »
  //   (globe orthographique à faire tourner, outil et pays au choix, panneau
  //   de détail), « regles » (une règle par outil au choix, pays de l'OCDE en
  //   points) et « outre-mer » (barres, indicateur au choix). Les figures des
  //   cinq outils montrent toutes la Nouvelle-Calédonie et la France.
  // - Tableaux : details[data-gini-table] remplis à partir de gini-monde.csv
  //   (« monde ») ou d'indicateurs-ocde.csv (« ocde »), avec les noms de pays
  //   en français.
  // - Liens a[data-globe-indicateur] ou a[data-globe-vue] : choisissent
  //   l'outil ou la région du globe vers lequel ils pointent.
  // - Fiches de la boîte à outils et ménage : svg[data-gini-icon], petits
  //   croquis dont les valeurs figurent aussi dans le texte.
  // - Croquis du résumé « En bref » : svg[data-brief-sketch] dans la section
  //   [data-gini-brief], dessinés à la première ouverture du résumé
  //   (événement « contours-brief:open »), avec les mêmes couleurs.
  //
  // Les données sont produites par
  // posts/inegalites-revenus-nouvelle-caledonie-monde/analysis.R.
  const figures = Array.from(document.querySelectorAll("[data-gini-chart]"));
  const tables = Array.from(document.querySelectorAll("[data-gini-table]"));
  const briefs = Array.from(document.querySelectorAll("[data-gini-brief]"));
  const icons = Array.from(document.querySelectorAll("svg[data-gini-icon]"));
  if (!figures.length && !tables.length && !briefs.length && !icons.length) return;
  if (!window.d3 || !window.rough) {
    figures.forEach((root) => fail(root, "Le graphique n’a pas pu être chargé (bibliothèques manquantes). Les valeurs restent disponibles dans le texte et dans les fichiers de données."));
    return;
  }

  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const frame = "#d5ccbe";
  const gridColor = "#e7e0d3";
  const fontText = "Atkinson Hyperlegible, sans-serif";
  const fontSketch = "Cabin Sketch, sans-serif";

  // Rouge : la Nouvelle-Calédonie, partout dans la page sauf sur la carte du
  // globe (voir plus bas). Sépia : les autres territoires et les situations
  // imaginaires. Ardoise : les pays de la Banque mondiale pris en exemple.
  // Vert : l'égalité parfaite.
  const colorNc = "#c54832";
  const colorOther = "#7b6a55";
  const colorReal = "#3b637f";
  const colorDot = "#5f574c";
  const colorEq = "#2f6b45";

  // Globe : palette Spectral de ColorBrewer, du bleu (écarts faibles, revenus
  // mieux partagés) au rouge (écarts forts), en six classes propres à chaque
  // outil. La teinte centrale, presque blanche, est écartée pour rester
  // lisible sur le papier. Le rouge y signalant les pays les plus
  // inégalitaires, la Nouvelle-Calédonie est colorée comme les autres pays et
  // repérée à l'encre (anneau, étiquette).
  const GLOBE_COULEURS = ["#3288bd", "#66c2a5", "#abdda4", "#fee08b", "#f46d43", "#9e0142"];
  const oceanColor = "#f6f4ec";
  const noDataColor = "#e7e1d4";
  const noDataStroke = "#b9b0a0";
  // Antarctique, et pays hors des 43 de l'OCDE pour les outils qui en
  // viennent : terre neutre, ni pays coloré ni « sans données ».
  const landColor = "#ebe6dc";
  // Vues proposées : centre [longitude, latitude].
  const GLOBE_VUES = [
    { id: "pacifique", label: "Pacifique", centre: [160, -12] },
    { id: "asie", label: "Asie", centre: [95, 22] },
    { id: "europe", label: "Europe", centre: [15, 47] },
    { id: "afrique", label: "Afrique", centre: [20, 2] },
    { id: "ameriques", label: "Amériques", centre: [-72, 4] }
  ];
  const media = (query) => Boolean(window.matchMedia && window.matchMedia(query).matches);
  const reducedMotion = media("(prefers-reduced-motion: reduce)");
  // Sur écran tactile, le globe ne capte pas le glissement (la page doit
  // défiler) : il tourne avec les boutons, la liste ou en touchant un pays.
  const finePointer = media("(pointer: fine)");

  const GROUPES = [
    { id: "HIC", label: "Revenu élevé" },
    { id: "UMC", label: "Revenu intermédiaire, tranche supérieure" },
    { id: "LMC", label: "Revenu intermédiaire, tranche inférieure" },
    { id: "LIC", label: "Faible revenu" }
  ];
  const GROUPE_LABEL = Object.fromEntries(GROUPES.map((g) => [g.id, g.label]));
  // Pays toujours nommés dans la figure des règles (OCDE).
  const REGLES_REPERES = ["FRA", "AUS", "NZL", "USA", "BRA"];

  const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gini = (value) => nf2.format(value);
  // Moins de 10 % : une décimale ; au-delà, un entier (et 0 sans décimale).
  const share = (value) => (value === 0 ? "0" : Math.abs(value) < 10 ? nf1.format(value) : nf0.format(value));
  const pct = (value) => `${share(value)} %`;
  // Rapports S80/S20 et D9/D1 : une décimale, comme l'Isee et l'Insee.
  const ratio = (value) => nf1.format(value);
  // Taux de pauvreté : une décimale, comme l'Isee.
  const taux = (value) => `${nf1.format(value)} %`;
  const fcfp = (value) => `${nf0.format(value)} F`;
  const euros = (value) => `${nf0.format(value)} €`;
  const ordinal = (k) => (k === 1 ? "1er" : `${k}e`);

  // Indicateurs au choix de la figure France et Outre-mer (tableau de
  // l'Isee).
  const OUTRE_MER = [
    { id: "gini", button: "Indice de Gini", label: "Indice de Gini", fmt: gini, tick: gini, max: 0.5, step: 0.1 },
    { id: "d9_d1", button: "Rapport D9/D1", label: "Rapport interdécile D9/D1", fmt: ratio, tick: (t) => nf0.format(t), max: 10, step: 2 },
    { id: "s80_s20", button: "Rapport S80/S20", label: "Rapport S80/S20", fmt: ratio, tick: (t) => nf0.format(t), max: 12, step: 2 }
  ];
  // Les cinq outils, dans l'ordre de l'article, sur des règles bornées : une
  // valeur au-delà de la borne est signalée par une flèche.
  const REGLES = [
    { id: "part_haut10", label: "Part des 10 % les plus aisés", fmt: pct, domain: [15, 40], step: 5, tick: (t) => `${nf0.format(t)} %`, note: "Banque mondiale, revenu par personne" },
    { id: "s80_s20", label: "Rapport S80/S20", fmt: ratio, domain: [2, 14], step: 2, tick: (t) => nf0.format(t) },
    { id: "d9_d1", label: "Rapport D9/D1", fmt: ratio, domain: [2, 10], step: 2, tick: (t) => nf0.format(t) },
    { id: "gini", label: "Indice de Gini", fmt: gini, domain: [0.2, 0.5], step: 0.05, labelEvery: 0.1, tick: gini },
    { id: "pauvrete", label: "Taux de pauvreté", fmt: taux, domain: [4, 24], step: 4, tick: (t) => `${nf0.format(t)} %` }
  ];

  // Les cinq outils du globe, dans l'ordre de l'article. `source` : « bm »
  // (Banque mondiale, gini-monde.csv, 164 pays) ou « ocde »
  // (indicateurs-ocde.csv, 43 pays). `seuils` : limites des six classes ;
  // `bornes` : début de la première et fin de la dernière, pour la légende.
  // Les seuils de l'indice de Gini sont aussi ceux du texte (seuil_bas,
  // seuil_haut d'analysis.R).
  const GLOBE_OUTILS = [
    {
      id: "part_haut10", source: "bm", button: "Part des 10 % les plus aisés", label: "Part des 10 % les plus aisés", short: "part des 10 % les plus aisés",
      value: (d) => d.d10, fmt: pct, tick: (t) => `${nf0.format(t)} %`, seuils: [22, 25, 28, 32, 38], bornes: [15, 50],
      nom: "Part", bas: "plus faible", haut: "plus élevée", celui: "celle", plusBas: "une part plus faible",
      title: "La part des 10 % les plus aisés dans le monde",
      subtitle: "Part du revenu (ou de la consommation) total reçue par les 10 % les plus aisés, dernière enquête nationale de chaque pays depuis 2010"
    },
    {
      id: "s80_s20", source: "bm", button: "Rapport S80/S20", label: "Rapport S80/S20", short: "rapport S80/S20",
      value: (d) => d.s80_s20, fmt: ratio, tick: (t) => nf0.format(t), seuils: [4, 5, 6, 8, 12], bornes: [2, 30],
      nom: "Rapport", bas: "plus bas", haut: "plus élevé", celui: "celui", plusBas: "un rapport plus bas",
      title: "Le rapport S80/S20 dans le monde",
      subtitle: "Ce que reçoivent les 20 % les plus aisés, rapporté à ce que reçoivent les 20 % les plus modestes, dernière enquête nationale de chaque pays depuis 2010",
      note: "Rapport S80/S20 calculé par Contours NC à partir des parts des dixièmes."
    },
    {
      id: "d9_d1", source: "ocde", button: "Rapport D9/D1", label: "Rapport D9/D1", short: "rapport D9/D1",
      value: (d) => d.d9_d1, fmt: ratio, tick: (t) => nf0.format(t), seuils: [3, 4, 5, 6, 8], bornes: [2, 24],
      nom: "Rapport", bas: "plus bas", haut: "plus élevé", celui: "celui", plusBas: "un rapport plus bas",
      title: "Le rapport D9/D1 dans les pays de l’OCDE",
      subtitle: "Seuil d’entrée des 10 % les plus aisés rapporté au plafond des 10 % les plus modestes, dernière année depuis 2015 ; les autres pays restent en gris"
    },
    {
      id: "gini", source: "bm", button: "Indice de Gini", label: "Indice de Gini", short: "indice de Gini",
      value: (d) => d.gini, fmt: gini, tick: gini, seuils: [0.3, 0.35, 0.4, 0.45, 0.5], bornes: [0.2, 0.65],
      nom: "Indice", bas: "plus bas", haut: "plus élevé", celui: "celui", plusBas: "un indice plus bas",
      title: "L’indice de Gini dans le monde",
      subtitle: "Dernière enquête nationale de chaque pays depuis 2010. Du bleu au rouge : des revenus les mieux partagés aux plus inégalitaires"
    },
    {
      id: "pauvrete", source: "ocde", button: "Taux de pauvreté", label: "Taux de pauvreté", short: "taux de pauvreté",
      value: (d) => d.pauvrete, fmt: taux, tick: (t) => `${nf0.format(t)} %`, seuils: [8, 10, 12, 14, 16], bornes: [4, 30],
      nom: "Taux", bas: "plus bas", haut: "plus élevé", celui: "celui", plusBas: "un taux plus bas",
      title: "Le taux de pauvreté dans les pays de l’OCDE",
      subtitle: "Part de la population qui vit avec moins de la moitié du revenu médian, dernière année depuis 2015 ; les autres pays restent en gris"
    }
  ];
  const GLOBE_GINI = GLOBE_OUTILS.find((o) => o.id === "gini");
  const globeColor = (outil, value) => GLOBE_COULEURS[globeClass(outil, value)];
  const globeClass = (outil, value) => outil.seuils.filter((t) => value >= t).length;
  // Fourchette calédonienne : définition officielle, puis niveau de vie
  // monétaire quand l'Isee le publie.
  const fourchette = (outil, nc) => (nc.high == null ? outil.fmt(nc.low) : `${outil.fmt(nc.low)} à ${outil.fmt(nc.high)}`);

  // Noms de pays en français, fournis par le navigateur ; à défaut, le nom
  // anglais de la Banque mondiale.
  const regionNames = (() => {
    try {
      return new Intl.DisplayNames(["fr"], { type: "region" });
    } catch (error) {
      return null;
    }
  })();
  function countryName(row) {
    try {
      const name = regionNames && regionNames.of(String(row.iso2));
      if (name && name !== String(row.iso2)) return name;
    } catch (error) {
      // Code inconnu du navigateur : nom anglais.
    }
    return row.pays;
  }
  const mesureLabel = (mesure) => (mesure === "revenu" ? "revenu par personne" : "consommation par personne");

  // ---------------------------------------------------------------------------
  // Outils partagés
  // ---------------------------------------------------------------------------

  function fail(root, message) {
    root.querySelectorAll(".habitat-sketch-loading").forEach((node) => node.remove());
    const p = document.createElement("p");
    p.className = "habitat-sketch-loading gini-error";
    p.textContent = message;
    root.appendChild(p);
  }

  function seed(value) {
    let hash = 2166136261;
    for (const char of String(value || "contours")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 2147483646) + 1;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function label(parent, text, x, y, options = {}) {
    return parent.append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", options.anchor || "start")
      .attr("dominant-baseline", options.baseline || "middle")
      .attr("font-family", options.family || fontText)
      .attr("font-size", options.size || 12)
      .attr("font-weight", options.weight || 400)
      .attr("fill", options.color || ink)
      .attr("transform", options.rotate ? `rotate(${options.rotate} ${x} ${y})` : null)
      .attr("paint-order", options.halo ? "stroke" : null)
      .attr("stroke", options.halo ? paper : null)
      .attr("stroke-width", options.halo ? (options.haloWidth || 3) : null)
      .attr("stroke-linejoin", options.halo ? "round" : null)
      .attr("pointer-events", "none")
      .text(text);
  }

  // Coupe un texte en lignes d'au plus `maxChars` caractères, jamais sur une
  // espace insécable. Les textes des diapositives masquées ne peuvent pas
  // être mesurés : la largeur est estimée.
  function wrap(text, maxChars) {
    const words = String(text).split(/[ \t\r\n]+/);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  const textW = (text, size) => String(text).length * size * 0.56;

  // Note coupée pour tenir dans `width` (petits écrans) ; renvoie l'ordonnée
  // de la ligne suivante.
  function paragraph(parent, text, x, y, width, options = {}) {
    const size = options.size || 12;
    const step = options.lineHeight || Math.round(size * 1.4);
    wrap(text, Math.max(12, Math.floor(width / (size * 0.58)))).forEach((line) => {
      label(parent, line, x, y, options);
      y += step;
    });
    return y;
  }

  function appendRough(parent, node, opacity) {
    parent.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (opacity != null) selection.attr("opacity", opacity);
    return selection;
  }

  function hatchColor(color) {
    const lab = d3.lab(color);
    return d3.lab(Math.max(10, lab.l - 18), lab.a, lab.b).formatHex();
  }

  function roughRect(parent, rc, x, y, width, height, options = {}) {
    return appendRough(parent, rc.rectangle(x, y, Math.max(0.5, width), Math.max(0.5, height), {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 3.2 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -41 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.8 : options.fillWeight,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      roughness: options.roughness == null ? 1 : options.roughness,
      bowing: 0.7,
      seed: seed(options.seed)
    }), options.opacity);
  }

  function roughLine(parent, rc, x1, y1, x2, y2, options = {}) {
    return appendRough(parent, rc.line(x1, y1, x2, y2, {
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.9 : options.strokeWidth,
      strokeLineDash: options.dash || undefined,
      roughness: options.roughness == null ? 0.8 : options.roughness,
      bowing: 0.6,
      seed: seed(options.seed)
    }), options.opacity);
  }

  function roughPolygon(parent, rc, points, options = {}) {
    return appendRough(parent, rc.polygon(points, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 4 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -41 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.7 : options.fillWeight,
      stroke: options.stroke || "none",
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      roughness: options.roughness == null ? 0.9 : options.roughness,
      bowing: 0.6,
      seed: seed(options.seed)
    }), options.opacity);
  }

  // Silhouette (tête et buste) debout sur `base`, de hauteur `h`.
  function silhouette(cx, base, h) {
    const r = h * 0.17;
    const cy = base - h + r;
    const top = cy + r + h * 0.05;
    const w = h * 0.3;
    const body = `M${cx - w},${base}V${top + w}Q${cx - w},${top} ${cx},${top}Q${cx + w},${top} ${cx + w},${top + w}V${base}Z`;
    return { cx, cy, r, body };
  }

  // Silhouette nette, pour les pictogrammes répétés.
  function drawSilhouette(parent, cx, base, h, options = {}) {
    const s = silhouette(cx, base, h);
    const g = parent.append("g").attr("pointer-events", "none");
    [["circle", (node) => node.attr("cx", s.cx).attr("cy", s.cy).attr("r", s.r)], ["path", (node) => node.attr("d", s.body)]]
      .forEach(([tag, place]) => {
        place(g.append(tag))
          .attr("fill", options.fill || paper)
          .attr("stroke", options.stroke || ink)
          .attr("stroke-width", options.strokeWidth == null ? 1 : options.strokeWidth)
          .attr("stroke-dasharray", options.dash || null)
          .attr("stroke-linejoin", "round");
      });
    return g;
  }

  // Silhouette crayonnée, pour les personnages des figures.
  function roughSilhouette(parent, rc, cx, base, h, options = {}) {
    const s = silhouette(cx, base, h);
    const style = {
      fill: options.fill || "none",
      fillStyle: "hachure",
      hachureGap: options.hachureGap == null ? 2.4 : options.hachureGap,
      hachureAngle: -41,
      fillWeight: 0.7,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 1 : options.strokeWidth,
      roughness: 0.8,
      bowing: 0.5
    };
    appendRough(parent, rc.circle(s.cx, s.cy, s.r * 2, { ...style, seed: seed(`${options.seed}-tete`) }));
    appendRough(parent, rc.path(s.body, { ...style, seed: seed(`${options.seed}-corps`) }));
  }

  function roughCurve(parent, rc, points, options = {}) {
    return appendRough(parent, rc.linearPath(points, {
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 1.6 : options.strokeWidth,
      roughness: options.roughness == null ? 0.7 : options.roughness,
      bowing: 0.4,
      seed: seed(options.seed)
    }), options.opacity);
  }

  function positionTooltip(container, tooltip, event) {
    const bounds = container.getBoundingClientRect();
    const margin = 8;
    const gap = 14;
    tooltip.style.opacity = 0;
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;
    const pointerX = event.clientX - bounds.left + container.scrollLeft;
    const pointerY = event.clientY - bounds.top;
    let x = pointerX + gap;
    let y = pointerY + gap;
    if (x + tipWidth > container.scrollLeft + bounds.width - margin) x = pointerX - tipWidth - gap;
    if (y + tipHeight > bounds.height - margin) y = pointerY - tipHeight - gap;
    tooltip.style.left = `${Math.max(container.scrollLeft + margin, x)}px`;
    tooltip.style.top = `${Math.max(margin, y)}px`;
    tooltip.style.opacity = 1;
  }

  function focusPointer(node) {
    const box = node.getBoundingClientRect();
    return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
  }

  // Survol, focus clavier et lecteur d'écran donnent la même information.
  function bindTip(selection, ctx, html) {
    selection
      .on("pointermove pointerenter focus", function onEnter(event) {
        ctx.tooltip.innerHTML = typeof html === "function" ? html() : html;
        positionTooltip(ctx.root, ctx.tooltip, event.type === "focus" ? focusPointer(this) : event);
      })
      .on("pointerleave blur", () => { ctx.tooltip.style.opacity = 0; });
    return selection;
  }

  function hitArea(parent, ctx, x, y, width, height, aria, html) {
    const rect = parent.append("rect")
      .attr("class", "gini-hit")
      .attr("x", x).attr("y", y).attr("width", Math.max(1, width)).attr("height", Math.max(1, height))
      .attr("fill", "transparent")
      .attr("tabindex", 0)
      .attr("role", "img")
      .attr("aria-label", aria);
    return bindTip(rect, ctx, html);
  }

  function tip(title, lines) {
    return `<strong>${escapeHtml(title)}</strong>${lines.filter(Boolean).map((line) => escapeHtml(line)).join("<br>")}`;
  }

  function downloadPng(svg, button, filename) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "…";
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll(".gini-hit").forEach((node) => node.remove());
    const box = svg.viewBox.baseVal;
    const width = box?.width || svg.clientWidth;
    const height = box?.height || svg.clientHeight;
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    const done = () => {
      button.disabled = false;
      button.textContent = previous;
    };
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext("2d");
      context.scale(scale, scale);
      context.fillStyle = paper;
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }
        done();
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      done();
    };
    image.src = url;
  }

  // Titre en crayon, sous-titre net. Renvoie l'ordonnée libre.
  function drawHeader(svg, ctx, width, subtitle) {
    const compact = ctx.compact;
    let y = 28;
    wrap(ctx.title, compact ? Math.floor((width - 36) / 10.5) : Math.floor((width - 36) / 12)).forEach((line) => {
      label(svg, line, 18, y, { family: fontSketch, size: compact ? 19 : 23, weight: 700 });
      y += compact ? 23 : 27;
    });
    if (subtitle) {
      wrap(subtitle, compact ? Math.floor((width - 36) / 6.3) : Math.floor((width - 36) / 6.9)).forEach((line) => {
        label(svg, line, 18, y - 2, { size: compact ? 11.5 : 12.5, weight: 700, color: muted });
        y += compact ? 15 : 17;
      });
    }
    return y + 10;
  }

  // Source et signature ; renvoie la hauteur totale.
  function drawFooter(svg, rc, ctx, width, y) {
    roughLine(svg, rc, 18, y, width - 18, y, { stroke: frame, strokeWidth: 0.7, roughness: 0.6, seed: `${ctx.key}-pied` });
    const yy = y + 15;
    const lines = wrap(ctx.source, ctx.compact ? Math.floor((width - 120) / 5.8) : Math.floor((width - 140) / 6.2));
    lines.forEach((line, index) => label(svg, line, 18, yy + index * 14, { size: ctx.compact ? 10 : 10.5, weight: 700, color: muted }));
    label(svg, "contours.nc", width - 18, yy, { anchor: "end", family: fontSketch, size: 14, weight: 700, color: muted });
    return yy + lines.length * 14 + 4;
  }

  function panelTitle(svg, text, x, y, ctx) {
    label(svg, text, x, y, { family: fontSketch, size: ctx.compact ? 15 : 16, weight: 700 });
  }

  // Ajuste la hauteur et le résumé accessible d'une figure.
  function finish(svg, ctx, width, height, aria) {
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
    svg.attr("aria-label", `${ctx.title}. ${aria}`);
  }

  function buttonGroup(name, options, current, onChange) {
    const group = document.createElement("div");
    group.className = "access-mode-buttons";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", name);
    const buttons = options.map(([value, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.dataset.value = value;
      button.setAttribute("aria-pressed", value === current ? "true" : "false");
      button.addEventListener("click", () => {
        setPressed(group, value);
        onChange(value);
      });
      group.appendChild(button);
      return button;
    });
    return group;
  }

  // Bouton enfoncé d'un groupe ; `null` les relâche tous.
  function setPressed(group, value) {
    group.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.value === value ? "true" : "false");
    });
  }

  // Groupe de boutons précédé d'un libellé visible (le groupe porte déjà
  // son nom accessible).
  function controlGroup(text, group) {
    const wrapper = document.createElement("div");
    wrapper.className = "gini-control";
    const name = document.createElement("span");
    name.className = "gini-control-label";
    name.setAttribute("aria-hidden", "true");
    name.textContent = text;
    wrapper.append(name, group);
    return wrapper;
  }

  const cache = new Map();
  function loadCached(src, loader, check) {
    if (!src) return Promise.reject(new Error("Source de données absente"));
    if (!cache.has(src)) {
      const promise = loader(src).then((data) => {
        if (!check(data)) throw new Error(`Données vides : ${src}`);
        return data;
      });
      promise.catch(() => cache.delete(src));
      cache.set(src, promise);
    }
    return cache.get(src);
  }
  const loadCsv = (src) => loadCached(src, (s) => d3.csv(s, d3.autoType), (rows) => rows.length > 0);
  const loadJson = (src) => loadCached(src, (s) => d3.json(s), (geo) => Boolean(geo && geo.features && geo.features.length));

  // Orientation attendue par d3 (anneau extérieur dans le sens horaire) : un
  // polygone mal orienté couvrirait tout le globe.
  function rewindPolygon(rings) {
    return d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI
      ? rings.map((ring) => ring.slice().reverse())
      : rings;
  }
  function rewindGeometry(geometry) {
    if (!geometry) return geometry;
    if (geometry.type === "Polygon") return { ...geometry, coordinates: rewindPolygon(geometry.coordinates) };
    if (geometry.type === "MultiPolygon") return { ...geometry, coordinates: geometry.coordinates.map(rewindPolygon) };
    if (geometry.type === "GeometryCollection") return { ...geometry, geometries: geometry.geometries.map(rewindGeometry) };
    return geometry;
  }
  const rewindFeatures = (geo) => geo.features.map((feature) => ({ ...feature, geometry: rewindGeometry(feature.geometry) }));

  // Centre du plus grand polygone d'un pays (pour la France, la métropole
  // plutôt que la Corse ; pour les États-Unis, hors Alaska).
  function mainCentroid(feature) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
    let best = null;
    let bestArea = -1;
    polygons.forEach((rings) => {
      const shape = { type: "Polygon", coordinates: rings };
      const area = d3.geoArea(shape);
      if (area > bestArea) {
        bestArea = area;
        best = shape;
      }
    });
    return d3.geoCentroid(best);
  }

  function classLabel(outil, index) {
    const s = outil.seuils;
    if (index === 0) return `moins de ${outil.tick(s[0])}`;
    if (index === s.length) return `${outil.tick(s[index - 1])} et plus`;
    return `${outil.tick(s[index - 1])} à ${outil.tick(s[index])}`;
  }

  const partsOf = (row) => d3.range(1, 11).map((k) => row[`d${k}`]);

  // Parts (en %) des dix groupes, du plus modeste au plus aisé → points de la
  // courbe de Lorenz et indice de Gini (trapèzes), comme dans analysis.R.
  function lorenzOf(parts) {
    const total = d3.sum(parts) || 1;
    const points = [[0, 0]];
    let cumul = 0;
    parts.forEach((part, index) => {
      cumul += part / total;
      points.push([(index + 1) / parts.length, index === parts.length - 1 ? 1 : cumul]);
    });
    const area = d3.sum(d3.range(parts.length), (k) => (points[k + 1][0] - points[k][0]) * (points[k][1] + points[k + 1][1]) / 2);
    return { points, gini: Math.max(0, 1 - 2 * area) };
  }

  // Essaim de points déterministe : chaque point prend la position la plus
  // proche de l'axe qui ne chevauche aucun point déjà placé.
  function dodge(items, x, radius, padding) {
    const min = 2 * radius + padding;
    const placed = [];
    items
      .map((d) => ({ d, x: x(d), y: 0 }))
      .sort((a, b) => a.x - b.x || String(a.d.iso3).localeCompare(String(b.d.iso3)))
      .forEach((c) => {
        const near = placed.filter((p) => Math.abs(p.x - c.x) < min);
        const candidates = [0];
        near.forEach((p) => {
          const dy = Math.sqrt(Math.max(0, min * min - (p.x - c.x) ** 2));
          candidates.push(p.y + dy, p.y - dy);
        });
        candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
        c.y = candidates.find((cy) => near.every((p) => (p.x - c.x) ** 2 + (p.y - cy) ** 2 >= min * min - 1e-6));
        placed.push(c);
      });
    return placed;
  }

  // Étiquettes au-dessus d'une rangée, réparties en couloirs pour ne pas se
  // chevaucher. Une étiquette glisse d'abord vers la droite (trait de rappel
  // oblique) avant de monter d'un couloir, et le trait de rappel d'une
  // étiquette haute ne traverse aucune étiquette plus basse. Renvoie le
  // nombre de couloirs.
  function laneLabels(items, size, left, right) {
    const placed = [];
    // Premier couloir libre, avec un glissement d'au plus `maxShift` et,
    // si `strict`, sans croisement entre traits de rappel et étiquettes.
    const spot = (item, width, maxShift, maxLane, strict) => {
      for (let lane = 0; lane <= maxLane; lane += 1) {
        const end = d3.max(placed.filter((p) => p.lane === lane), (p) => p.lx + p.width / 2) ?? -Infinity;
        const lx = Math.max(left + width / 2, Math.min(right - width / 2, Math.max(item.x, end + width / 2)));
        const x0 = lx - width / 2;
        const x1 = lx + width / 2;
        const fits = x0 >= end - 0.5 && Math.abs(lx - item.x) <= maxShift && (!strict || (
          placed.every((p) => p.lane >= lane || item.x < p.lx - p.width / 2 - 2 || item.x > p.lx + p.width / 2 + 2)
          && placed.every((p) => p.lane <= lane || p.x < x0 - 2 || p.x > x1 + 2)));
        if (fits) return { lane, lx };
      }
      return null;
    };
    items.slice().sort((a, b) => a.x - b.x).forEach((item) => {
      const width = textW(item.text, size) + 10;
      const best = spot(item, width, size * 5, 3, true)
        || spot(item, width, size * 12, 3, true)
        || spot(item, width, Infinity, 5, false)
        || { lane: 5, lx: item.x };
      Object.assign(item, best, { width });
      placed.push(item);
    });
    return placed.length ? d3.max(placed, (p) => p.lane) + 1 : 0;
  }

  // Valeur d'un pays pour un outil du globe (définition officielle pour la
  // Nouvelle-Calédonie) ; null quand la source ne la donne pas.
  function globeValue(entry, outil) {
    if (!entry) return null;
    if (entry.nc) return entry.ncValues[outil.id].low;
    const row = outil.source === "bm" ? entry.bm : entry.ocde;
    const value = row ? outil.value(row) : null;
    return Number.isFinite(value) ? value : null;
  }

  // Panneau du globe : valeur de l'outil affiché, rang, comparaison avec la
  // Nouvelle-Calédonie, les cinq outils du pays sélectionné (chacun peut être
  // affiché sur le globe) et les parts de ses dix groupes.
  function renderGlobePanel(ctx) {
    const G = ctx.globe;
    const outil = G.outil();
    const entry = G.entries.get(ctx.state.selected);
    const value = globeValue(entry, outil);
    const nc = G.ncValues[outil.id];
    const values = G.values.get(outil.id);
    const total = values.length;
    const below = value == null ? 0 : values.filter((v) => v < value).length;
    let meta;
    let rank;
    let note = "";
    if (entry.nc) {
      meta = "Isee, enquête Budget des familles 2019 · niveau de vie par unité de consommation, autoconsommation comprise";
      rank = `${below} des ${total} ${outil.source === "bm" ? "pays de la base de la Banque mondiale" : "pays suivis par l’OCDE"} ont ${outil.plusBas}.`;
      note = `${nc.high == null ? "" : `Sans l’autoconsommation, comme pour l’Insee et l’OCDE : ${outil.fmt(nc.high)}. `}Absente des bases de la Banque mondiale et de l’OCDE.`;
    } else if (value != null) {
      const row = outil.source === "bm" ? entry.bm : entry.ocde;
      meta = outil.source === "bm"
        ? `Banque mondiale · enquête ${row.annee} · ${mesureLabel(row.mesure)} · ${GROUPE_LABEL[row.groupe] || row.groupe}`
        : `OCDE · ${row.annee} · revenu disponible`;
      const ref = `${outil.celui} de la Nouvelle-Calédonie (${fourchette(outil, nc)})`;
      const top = nc.high == null ? nc.low : nc.high;
      const position = value < nc.low ? `${outil.nom} ${outil.bas} que ${ref}`
        : value > top ? `${outil.nom} ${outil.haut} que ${ref}`
          : nc.high == null ? `${outil.nom} au niveau de ${ref}`
            : `${outil.nom} dans la fourchette de la Nouvelle-Calédonie (${fourchette(outil, nc)})`;
      rank = `${below} des ${total} pays ont ${outil.plusBas}. ${position}.`;
      if (outil.source === "bm" && row.mesure !== "revenu") note = "Mesuré sur la consommation, l’écart est en général plus faible que sur le revenu.";
    } else {
      meta = outil.source === "ocde" ? `Hors des ${total} pays suivis par l’OCDE.` : "Pas dans la base de la Banque mondiale.";
      rank = "Pas de valeur pour cet outil : le tableau ci-dessous donne ceux qui sont disponibles.";
    }

    // Les cinq outils, face à la Nouvelle-Calédonie.
    const lignes = GLOBE_OUTILS.map((o) => {
      const v = globeValue(entry, o);
      const cells = entry.nc ? [fourchette(o, G.ncValues[o.id])] : [v == null ? "–" : o.fmt(v), fourchette(o, G.ncValues[o.id])];
      const active = o.id === outil.id;
      return `<tr${active ? " class=\"is-active\"" : ""}><th scope="row"><button type="button" data-outil="${o.id}" aria-pressed="${active}">${escapeHtml(o.label)}</button></th>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`;
    }).join("");
    const sources = entry.nc
      ? ["Isee, 2019 : définition officielle, puis niveau de vie monétaire"]
      : [
        entry.bm ? `Banque mondiale : enquête ${entry.bm.annee}, ${mesureLabel(entry.bm.mesure)}` : null,
        entry.ocde ? `OCDE : ${entry.ocde.annee}` : null
      ].filter(Boolean);

    // Barres : rouge calédonien ou ardoise des pays de la Banque mondiale,
    // comme dans les autres figures ; la teinte du globe figure à côté de
    // la valeur.
    const parts = entry.parts;
    const quoi = entry.nc ? "du total des niveaux de vie" : entry.bm && entry.bm.mesure !== "revenu" ? "de la consommation totale" : "du revenu total";
    G.panelBody.innerHTML = `
      <p class="gini-globe-kicker">${entry.nc ? "Repère calédonien" : "Pays sélectionné"}</p>
      <p class="gini-globe-name">${escapeHtml(entry.name)}</p>
      <p class="gini-globe-value"><span class="gini-globe-big" style="color: ${entry.nc ? colorNc : ink}">${value == null ? "–" : escapeHtml(outil.fmt(value))}</span><span>${escapeHtml(outil.short)}</span></p>
      ${value == null ? "" : `<p class="gini-globe-class"><span class="gini-globe-chip" style="background: ${globeColor(outil, value)}" aria-hidden="true"></span>Teinte sur le globe : ${escapeHtml(classLabel(outil, globeClass(outil, value)))}</p>`}
      <p class="gini-globe-meta">${escapeHtml(meta)}</p>
      <p class="gini-globe-rank">${escapeHtml(rank)}</p>
      ${note ? `<p class="gini-globe-note">${escapeHtml(note)}</p>` : ""}
      <table class="gini-globe-outils">
        <caption>${entry.nc ? "Les cinq outils" : "Les cinq outils, face à la Nouvelle-Calédonie"}</caption>
        <thead><tr><th scope="col">Outil</th><th scope="col">${entry.nc ? "Nouvelle-Calédonie (Isee)" : escapeHtml(entry.name)}</th>${entry.nc ? "" : "<th scope=\"col\">Nouvelle-Calédonie</th>"}</tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <p class="gini-globe-sources">${escapeHtml(sources.join(" · "))}. Choisissez un outil dans le tableau pour l’afficher sur le globe.</p>
      ${parts ? `<p class="gini-globe-subtitle">Part ${escapeHtml(quoi)} reçue par chaque dixième de la population</p>
      <svg class="gini-globe-deciles" viewBox="0 0 300 132" role="img"></svg>
      <p class="gini-globe-share">Les 10 % les plus aisés reçoivent ${pct(parts[9])} ${escapeHtml(quoi)}, les 10 % les plus modestes ${pct(parts[0])}.</p>` : ""}`;
    G.panelBody.querySelectorAll("button[data-outil]").forEach((button) => {
      button.addEventListener("click", () => G.setOutil(button.dataset.outil, true));
    });
    const live = `${entry.name} : ${outil.short} ${value == null ? "non disponible" : outil.fmt(value)}.`;
    if (G.live.textContent !== live) G.live.textContent = live;
    if (!parts) return;

    const color = entry.nc ? colorNc : colorReal;
    const svg = d3.select(G.panelBody).select("svg");
    svg.attr("aria-label", `${entry.name} : ${parts.map((p, i) => `${ordinal(i + 1)} dixième ${pct(p)}`).join(", ")}.`);
    const rc = rough.svg(svg.node());
    const max = Math.max(30, Math.ceil(d3.max(parts) / 10) * 10);
    const x = d3.scaleBand().domain(d3.range(10)).range([34, 296]).padding(0.22);
    const y = d3.scaleLinear().domain([0, max]).range([104, 18]);
    [0, 10, max].forEach((t) => {
      svg.append("line").attr("x1", 30).attr("x2", 296).attr("y1", y(t)).attr("y2", y(t))
        .attr("stroke", t ? gridColor : "#bdb4a6").attr("stroke-dasharray", t ? "2 4" : null);
      label(svg, `${t} %`, 26, y(t), { anchor: "end", size: 10, weight: 700, color: muted });
    });
    parts.forEach((part, k) => {
      roughRect(svg, rc, x(k), y(part), x.bandwidth(), y(0) - y(part), {
        fill: color, stroke: hatchColor(color), strokeWidth: 0.8, hachureGap: 2.6, seed: `globe-panneau-${entry.iso3}-${k}`
      });
    });
    roughLine(svg, rc, 30, y(10), 296, y(10), { stroke: colorEq, strokeWidth: 1.2, dash: [5, 4], roughness: 0.5, seed: "globe-panneau-egalite" });
    label(svg, "égalité : 10 %", 36, y(10) - 8, { size: 9.5, weight: 700, color: colorEq, halo: true });
    label(svg, pct(parts[9]), x(9) + x.bandwidth(), y(parts[9]) - 8, { anchor: "end", size: 11, weight: 700, halo: true });
    label(svg, "← plus modestes", 34, 120, { size: 10, weight: 700, color: muted });
    label(svg, "plus aisés →", 296, 120, { anchor: "end", size: 10, weight: 700, color: muted });
  }

  // ---------------------------------------------------------------------------
  // Figures
  // ---------------------------------------------------------------------------

  const charts = {
    // Dix barres (part du revenu de chaque dixième) et courbe de Lorenz
    // correspondante : deux situations théoriques et les pays de
    // gini-monde.csv cités dans data-exemples ; « NCL » y désigne la
    // Nouvelle-Calédonie, dont les parts viennent de data-nc-src (Isee).
    explication: {
      load: (root) => Promise.all([loadCsv(root.dataset.src), root.dataset.ncSrc ? loadCsv(root.dataset.ncSrc) : Promise.resolve([])]),
      init(ctx, [rows, rowsNc]) {
        const exemples = String(ctx.root.dataset.exemples || "").split(",").map((code) => code.trim()).filter(Boolean);
        ctx.presets = {
          egalite: {
            label: "Égalité parfaite",
            sub: "Situation théorique : chaque dixième de la population reçoit 10 % du revenu total",
            parts: Array(10).fill(10),
            color: colorOther
          }
        };
        exemples.forEach((code) => {
          if (code === "NCL") {
            const annee = Number(ctx.root.dataset.ncAnnee) || 2019;
            const parts = d3.range(1, 11).map((k) => rowsNc.find((r) => r.annee === annee && r.decile === k)?.part);
            const published = Number(ctx.root.dataset.ncGini);
            if (parts.some((p) => !Number.isFinite(p)) || !Number.isFinite(published)) throw new Error(`Déciles ou indice absents : NCL ${annee}`);
            ctx.presets.NCL = {
              label: "Nouvelle-Calédonie",
              sub: `Nouvelle-Calédonie, ${annee} : part du total des niveaux de vie reçue par chaque dixième de la population (Isee)`,
              parts,
              published,
              publisher: "l’Isee",
              color: colorNc
            };
            return;
          }
          const row = rows.find((r) => r.iso3 === code);
          if (!row) throw new Error(`Pays absent des données : ${code}`);
          const parts = partsOf(row);
          if (parts.some((p) => !Number.isFinite(p))) throw new Error(`Déciles incomplets : ${code}`);
          const name = countryName(row);
          const total = row.mesure === "revenu" ? "du revenu total" : "de la consommation totale";
          ctx.presets[code] = {
            label: name,
            sub: `${name}, ${row.annee} : part ${total} reçue par chaque dixième de la population (${mesureLabel(row.mesure)})`,
            parts,
            published: row.gini,
            publisher: "la Banque mondiale",
            color: colorReal
          };
        });
        ctx.presets.extreme = {
          label: "Les 10 % les plus aisés ont tout",
          sub: "Situation théorique : les 10 % les plus aisés reçoivent tout le revenu, les autres rien",
          parts: [...Array(9).fill(0), 100],
          color: colorOther
        };
        ctx.state = { preset: exemples[0] || "egalite" };
        return [buttonGroup("Situation représentée", Object.entries(ctx.presets).map(([key, preset]) => [key, preset.label]), ctx.state.preset, (value) => {
          ctx.state.preset = value;
          ctx.redraw();
        })];
      },
      draw(ctx) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const preset = ctx.presets[ctx.state.preset];
        const { points, gini: g } = lorenzOf(preset.parts);
        const key = `${ctx.key}-${ctx.state.preset}`;
        let y = drawHeader(svg, ctx, W, preset.sub);

        // Valeur de l'indice, au-dessus des deux panneaux.
        label(svg, `Indice de Gini : ${gini(g)}`, 18, y + 6, { family: fontSketch, size: compact ? 21 : 25, weight: 700, color: preset.color });
        const formula = "= surface hachurée ÷ surface du triangle sous la diagonale";
        if (compact) {
          y = paragraph(svg, formula, 18, y + 28, W - 36, { size: 11, lineHeight: 15, weight: 700, color: muted }) + 7;
        } else {
          label(svg, formula, 18 + textW(`Indice de Gini : ${gini(g)}`, 25) * 0.86 + 14, y + 8, { size: 12.5, weight: 700, color: muted });
          y += 36;
        }
        // Pays réel : l'indice dessiné ici (dix groupes) diffère un peu de
        // l'indice publié, calculé personne par personne.
        if (preset.published != null) {
          const note = `Calculé sur ces dix groupes. Indice publié par ${preset.publisher}, calculé personne par personne : ${gini(preset.published)}`;
          wrap(note, compact ? Math.floor((W - 36) / 6) : Math.floor((W - 36) / 6.6)).forEach((line) => {
            label(svg, line, 18, y - 6, { size: compact ? 10.5 : 11.5, weight: 700, color: muted });
            y += compact ? 14 : 15;
          });
          y += 4;
        }

        // Panneau des barres.
        const barsLeft = compact ? 46 : 62;
        const barsRight = compact ? W - 14 : W * 0.5 - 18;
        const barsTop = y + 26;
        const barsHeight = compact ? 200 : 290;
        const barsBottom = barsTop + barsHeight;
        const ymax = 30;
        const yScale = d3.scaleLinear().domain([0, ymax]).range([barsBottom, barsTop]);
        const band = d3.scaleBand().domain(d3.range(1, 11)).range([barsLeft, barsRight]).padding(compact ? 0.18 : 0.24);
        panelTitle(svg, "Part du revenu total de chaque dixième", 18, y + 4, ctx);
        [0, 10, 20, 30].forEach((t) => {
          svg.append("line").attr("x1", barsLeft).attr("x2", barsRight).attr("y1", yScale(t)).attr("y2", yScale(t))
            .attr("stroke", t ? gridColor : "#bdb4a6").attr("stroke-width", 1).attr("stroke-dasharray", t ? "2 4" : null);
          label(svg, `${t} %`, barsLeft - 7, yScale(t), { anchor: "end", size: compact ? 10 : 11, weight: 700, color: muted });
        });
        preset.parts.forEach((part, index) => {
          const decile = index + 1;
          const x0 = band(decile);
          const bw = band.bandwidth();
          const capped = part > ymax;
          const top = yScale(Math.min(part, ymax));
          if (part > 0) {
            roughRect(svg, rc, x0, top, bw, barsBottom - top, {
              fill: preset.color, stroke: hatchColor(preset.color), hachureGap: compact ? 2.8 : 3.2, seed: `${key}-barre-${decile}`
            });
          }
          if (capped) {
            // Barre coupée : la valeur dépasse l'échelle.
            const zig = d3.range(0, 7).map((i) => [x0 - 2 + (i * (bw + 4)) / 6, top + 10 + (i % 2 ? -4 : 4)]);
            svg.append("polyline").attr("points", zig.map((p) => p.join(",")).join(" "))
              .attr("fill", "none").attr("stroke", paper).attr("stroke-width", 5);
            svg.append("polyline").attr("points", zig.map((p) => p.join(",")).join(" "))
              .attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1);
          }
          // Sur petit écran, sans le signe % (porté par l'axe), pour que les
          // valeurs voisines ne se chevauchent pas.
          label(svg, compact ? share(part) : pct(part), x0 + bw / 2, (capped ? barsTop : top) - 9, {
            anchor: "middle", size: compact ? 9.5 : 11, weight: 700, color: part > 0 ? ink : muted, halo: true
          });
          label(svg, ordinal(decile), x0 + bw / 2, barsBottom + 13, { anchor: "middle", size: compact ? 9.5 : 11, weight: 700, color: muted });
          const before = d3.sum(preset.parts.slice(0, decile)) / (d3.sum(preset.parts) || 1) * 100;
          const name = `${ordinal(decile)} dixième${decile === 1 ? " (les 10 % les plus modestes)" : decile === 10 ? " (les 10 % les plus aisés)" : ""}`;
          hitArea(svg, ctx, x0, barsTop - 16, bw, barsBottom - barsTop + 30,
            `${name} : ${pct(part)} du revenu total`,
            () => tip(name, [`Part du revenu total : ${pct(part)}`, decile > 1 ? `Les ${decile * 10} % les plus modestes, ensemble : ${pct(before)}` : ""]));
        });
        // Égalité : 10 % par dixième. Libellé à gauche, au-dessus des barres
        // basses (et des valeurs quand toutes les barres atteignent 10 %).
        roughLine(svg, rc, barsLeft, yScale(10), barsRight, yScale(10), { stroke: colorEq, strokeWidth: 1.4, dash: [6, 5], roughness: 0.5, seed: `${ctx.key}-egalite` });
        const eqLabelY = yScale(10) - (preset.parts[0] >= 10 ? 26 : 9);
        label(svg, "égalité : 10 % chacun", barsLeft + 4, eqLabelY, { size: compact ? 10 : 11, weight: 700, color: colorEq, halo: true });
        label(svg, "← plus modestes", barsLeft, barsBottom + 31, { size: compact ? 10 : 11, weight: 700, color: muted });
        label(svg, "plus aisés →", barsRight, barsBottom + 31, { anchor: "end", size: compact ? 10 : 11, weight: 700, color: muted });

        // Panneau de la courbe de Lorenz.
        const lzTitleY = compact ? barsBottom + 66 : y + 4;
        const size = compact ? Math.min(W - 78, 300) : Math.min(barsHeight, W * 0.5 - 120);
        const lzLeft = compact ? 58 : W * 0.5 + 76;
        const lzTop = compact ? lzTitleY + 22 : barsTop;
        const lx = d3.scaleLinear().domain([0, 1]).range([lzLeft, lzLeft + size]);
        const ly = d3.scaleLinear().domain([0, 1]).range([lzTop + size, lzTop]);
        panelTitle(svg, "Courbe de Lorenz", compact ? 18 : W * 0.5 + 22, lzTitleY, ctx);
        const ticks = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
        ticks.forEach((t) => {
          svg.append("line").attr("x1", lx(t)).attr("x2", lx(t)).attr("y1", ly(0)).attr("y2", ly(1))
            .attr("stroke", t ? gridColor : "#bdb4a6").attr("stroke-dasharray", t ? "2 4" : null);
          svg.append("line").attr("x1", lx(0)).attr("x2", lx(1)).attr("y1", ly(t)).attr("y2", ly(t))
            .attr("stroke", t ? gridColor : "#bdb4a6").attr("stroke-dasharray", t ? "2 4" : null);
          label(svg, `${nf0.format(t * 100)} %`, lx(t), ly(0) + 13, { anchor: "middle", size: compact ? 9.5 : 10.5, weight: 700, color: muted });
          label(svg, `${nf0.format(t * 100)} %`, lx(0) - 6, ly(t), { anchor: "end", size: compact ? 9.5 : 10.5, weight: 700, color: muted });
        });
        label(svg, "part de la population, des plus modestes aux plus aisés", lx(0.5), ly(0) + 30, { anchor: "middle", size: compact ? 10 : 11, weight: 700, color: muted });
        label(svg, "part cumulée du revenu", lx(0) - (compact ? 36 : 40), ly(0.5), { anchor: "middle", size: compact ? 10 : 11, weight: 700, color: muted, rotate: -90 });
        const curve = points.map(([px, py]) => [lx(px), ly(py)]);
        if (g > 0.001) {
          roughPolygon(svg, rc, curve, { fill: preset.color, hachureGap: compact ? 3.6 : 4.2, fillWeight: 0.8, seed: `${key}-aire` });
        }
        roughLine(svg, rc, lx(0), ly(0), lx(1), ly(1), { stroke: colorEq, strokeWidth: 1.4, dash: [6, 5], roughness: 0.5, seed: `${ctx.key}-diagonale` });
        label(svg, "égalité parfaite", lx(0.6), ly(0.6) - 9, { anchor: "middle", size: compact ? 10 : 11, weight: 700, color: colorEq, rotate: -45, halo: true });
        roughCurve(svg, rc, curve, { stroke: ink, strokeWidth: 1.7, seed: `${key}-courbe` });
        points.slice(1, -1).forEach(([px, py], index) => {
          svg.append("circle").attr("cx", lx(px)).attr("cy", ly(py)).attr("r", compact ? 2.6 : 3.1)
            .attr("fill", paper).attr("stroke", ink).attr("stroke-width", 1.2);
          const share = py * 100;
          const node = svg.append("circle").attr("class", "gini-hit gini-hit-point")
            .attr("cx", lx(px)).attr("cy", ly(py)).attr("r", 9).attr("fill", "transparent");
          bindTip(node, ctx, () => tip(`Les ${(index + 1) * 10} % les plus modestes`, [`Part cumulée du revenu total : ${pct(share)}`]));
        });
        // Lecture : la moitié la plus modeste, annotée dans le triangle
        // supérieur, toujours vide.
        const half = points[5][1] * 100;
        svg.append("circle").attr("cx", lx(0.5)).attr("cy", ly(points[5][1])).attr("r", compact ? 4 : 4.6)
          .attr("fill", preset.color).attr("stroke", ink).attr("stroke-width", 1.1);
        const noteX = lx(0.03);
        const noteY = ly(0.93);
        label(svg, "Les 50 % les plus modestes", noteX, noteY, { size: compact ? 10.5 : 11.5, weight: 700, halo: true });
        label(svg, `reçoivent ${pct(half)} du revenu total`, noteX, noteY + (compact ? 14 : 15), { size: compact ? 10.5 : 11.5, weight: 700, halo: true });
        roughLine(svg, rc, lx(0.2), noteY + (compact ? 22 : 24), lx(0.5) - 4, ly(points[5][1]) - 5, { stroke: muted, strokeWidth: 0.8, seed: `${key}-lecture` });

        const bottom = compact ? ly(0) + 46 : Math.max(barsBottom + 44, ly(0) + 44);
        const height = drawFooter(svg, rc, ctx, W, bottom);
        finish(svg, ctx, W, height, `${preset.label} : ${preset.parts.map((p, i) => `${ordinal(i + 1)} dixième ${pct(p)}`).join(", ")}. Les 50 % les plus modestes reçoivent ${pct(half)} du revenu total. Indice de Gini : ${gini(g)}.`);
      }
    },

    // Globe orthographique : pays colorés par classe de l'outil choisi, petits
    // États insulaires en points, Nouvelle-Calédonie cerclée à l'encre. Le
    // globe tourne au glissement (souris), avec les boutons de région ou vers
    // le pays choisi ; un panneau HTML détaille le pays sélectionné. Changer
    // d'outil redessine le globe dans la même orientation. Pendant la
    // rotation, seules les formes nettes sont redessinées ; les traits
    // rough.js reviennent à l'arrêt.
    globe: {
      load: (root) => Promise.all([
        loadCsv(root.dataset.src),
        loadCsv(root.dataset.ocdeSrc),
        loadCsv(root.dataset.ncSrc),
        loadJson(root.dataset.geoSrc),
        loadCsv(root.dataset.decilesNcSrc),
        loadCsv(root.dataset.horsSrc)
      ]),
      init(ctx, [rows, ocdeRows, ncRows, geo, decilesNc, hors]) {
        const partsNc = decilesNc.filter((r) => r.annee === 2019).sort((a, b) => a.decile - b.decile).map((r) => r.part);
        const features = rewindFeatures(geo);
        const featureByIso = new Map(features.map((f) => [f.properties.iso3, f]));
        const ncFeature = featureByIso.get("NCL");
        // Valeurs calédoniennes : définition officielle (low) et niveau de vie
        // monétaire (high), absent pour la part des 10 % les plus aisés.
        const ncValues = Object.fromEntries(GLOBE_OUTILS.map((o) => {
          const row = ncRows.find((d) => d.indicateur === o.id);
          return [o.id, row && Number.isFinite(row.nc_2019)
            ? { low: row.nc_2019, high: Number.isFinite(row.nc_2019_harmonise) ? row.nc_2019_harmonise : null }
            : null];
        }));
        if (partsNc.length !== 10 || !ncFeature || Object.values(ncValues).some((v) => !v)) {
          throw new Error("Données calédoniennes incomplètes");
        }
        // Un pays par code, présent à la Banque mondiale, à l'OCDE ou aux deux
        // (la Nouvelle-Zélande n'est qu'à l'OCDE).
        const entries = new Map();
        const entryOf = (d) => {
          if (!entries.has(d.iso3)) {
            const feature = featureByIso.get(d.iso3);
            entries.set(d.iso3, {
              iso3: d.iso3, name: countryName(d), bm: null, ocde: null, parts: null,
              centre: feature ? mainCentroid(feature) : [d.lon, d.lat]
            });
          }
          return entries.get(d.iso3);
        };
        rows.forEach((d) => Object.assign(entryOf(d), { bm: d, parts: partsOf(d) }));
        ocdeRows.forEach((d) => { entryOf(d).ocde = d; });
        entries.set("NCL", {
          iso3: "NCL", name: "Nouvelle-Calédonie", nc: true, ncValues, parts: partsNc, centre: mainCentroid(ncFeature)
        });
        const pays = Array.from(entries.values()).filter((e) => !e.nc);
        ctx.globe = {
          rows, features, featureByIso, entries, ncFeature, ncValues,
          // Valeurs triées des pays, par outil (rang, légende).
          values: new Map(GLOBE_OUTILS.map((o) => [o.id, pays.map((e) => globeValue(e, o)).filter((v) => v != null).sort(d3.ascending)])),
          // Pays absents du fond de carte : un point à la capitale.
          points: rows.filter((d) => !featureByIso.has(d.iso3) && Number.isFinite(d.lon) && Number.isFinite(d.lat)),
          hors: new Map(hors.map((d) => [d.iso3, d])),
          filename: ctx.root.dataset.filename || ctx.key,
          outil: () => GLOBE_OUTILS.find((o) => o.id === ctx.state.outil)
        };
        // Outil et région de départ : ceux de la figure, ou d'un lien du texte
        // suivi avant la fin du chargement.
        const depart = GLOBE_OUTILS.some((o) => o.id === ctx.root.dataset.indicateur) ? ctx.root.dataset.indicateur : "gini";
        const vue = GLOBE_VUES.find((v) => v.id === ctx.root.dataset.vue) || GLOBE_VUES[0];
        ctx.state = { selected: "NCL", outil: depart, rotation: [-vue.centre[0], -vue.centre[1], 0] };
        ctx.root.classList.add("gini-figure--globe");

        const outils = buttonGroup("Outil affiché sur le globe", GLOBE_OUTILS.map((o) => [o.id, o.button]), depart, (value) => {
          ctx.globe.setOutil(value);
        });
        const views = buttonGroup("Centrer le globe sur une région", GLOBE_VUES.map((v) => [v.id, v.label]), vue.id, (value) => {
          if (ctx.globeView) ctx.globeView(value);
        });
        const selectLabel = document.createElement("label");
        selectLabel.className = "habitat-map-control-label";
        selectLabel.append("Pays");
        const select = document.createElement("select");
        select.className = "habitat-map-select";
        Array.from(entries.values())
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))
          .forEach((entry) => {
            const option = document.createElement("option");
            option.value = entry.iso3;
            option.textContent = entry.nc ? "Nouvelle-Calédonie (Isee)" : entry.name;
            select.appendChild(option);
          });
        select.value = ctx.state.selected;
        select.addEventListener("change", () => {
          if (ctx.globeSelect) ctx.globeSelect(select.value, true);
        });
        selectLabel.appendChild(select);

        const panel = document.createElement("div");
        panel.className = "gini-globe-panel";
        const live = document.createElement("p");
        live.className = "visually-hidden";
        live.setAttribute("aria-live", "polite");
        const body = document.createElement("div");
        const hint = document.createElement("p");
        hint.className = "gini-globe-hint";
        hint.textContent = finePointer
          ? "Faites glisser le globe pour le tourner. Cliquez sur un pays, ou choisissez-le dans la liste, pour l’afficher ici."
          : "Touchez un pays, choisissez une région ou un pays dans la liste pour l’afficher ici.";
        panel.append(live, body, hint);
        ctx.root.appendChild(panel);
        Object.assign(ctx.globe, { views, outils, select, panelBody: body, live });
        // `focus` : rend le focus au bouton du panneau, recréé au redessin.
        ctx.globe.setOutil = (id, focus) => {
          if (!GLOBE_OUTILS.some((o) => o.id === id)) return;
          ctx.state.outil = id;
          setPressed(outils, id);
          ctx.redraw();
          if (focus) {
            const button = body.querySelector(`button[data-outil="${id}"]`);
            if (button) button.focus();
          }
        };
        ctx.root.giniGlobe = {
          show(id, region) {
            if (id && id !== ctx.state.outil) ctx.globe.setOutil(id);
            if (region && ctx.globeView) {
              setPressed(views, region);
              ctx.globeView(region);
            }
          }
        };
        return [controlGroup("Outil", outils), controlGroup("Centrer sur", views), selectLabel];
      },
      draw(ctx) {
        const G = ctx.globe;
        const outil = G.outil();
        const nc = G.ncValues[outil.id];
        const values = G.values.get(outil.id);
        const bm = outil.source === "bm";
        const { svg, key } = ctx;
        svg.interrupt("rotation");
        svg.on(".drag", null);
        svg.selectAll("*").remove();
        // Titre, source et nom du fichier exporté suivent l'outil affiché.
        ctx.title = outil.title;
        ctx.source = [bm ? ctx.root.dataset.source : ctx.root.dataset.sourceOcde, outil.note].filter(Boolean).join(" ");
        ctx.root.dataset.filename = `${G.filename}-${outil.id.replace(/_/g, "-")}`;
        const download = ctx.root.querySelector(".habitat-sketch-download");
        if (download) download.setAttribute("aria-label", `Télécharger la figure « ${ctx.title} » en PNG`);
        // Deux colonnes (globe, panneau) au-delà de 860 px ; en dessous, le
        // globe occupe la largeur et le panneau passe dessous.
        const wide = ctx.root.clientWidth >= 860;
        ctx.root.classList.toggle("is-wide", wide);
        const W = wide ? 620 : Math.max(300, Math.min(ctx.width, 640));
        ctx.compact = W < 520;
        const compact = ctx.compact;
        const rc = rough.svg(svg.node());
        const y0 = drawHeader(svg, ctx, W, outil.subtitle);
        const R = compact ? Math.floor(W / 2 - 16) : Math.min(Math.floor(W / 2 - 24), 280);
        const cx = W / 2;
        const cy = y0 + R + 2;
        const projection = d3.geoOrthographic()
          .scale(R).translate([cx, cy]).clipAngle(90).precision(0.5)
          .rotate(ctx.state.rotation);
        const path = d3.geoPath(projection);
        const centre = () => {
          const r = projection.rotate();
          return [-r[0], -r[1]];
        };
        const visible = (lonLat, margin = 0.03) => d3.geoDistance(lonLat, centre()) < Math.PI / 2 - margin;
        const project = (lonLat) => projection(lonLat) || [-1000, -1000];

        const defs = svg.append("defs");
        const noData = defs.append("pattern")
          .attr("id", `${key}-sans-donnee`).attr("patternUnits", "userSpaceOnUse")
          .attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)");
        noData.append("rect").attr("width", 6).attr("height", 6).attr("fill", noDataColor);
        noData.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
          .attr("stroke", noDataStroke).attr("stroke-width", 0.9);
        // Grain crayonné posé sur les aplats de couleur.
        const pencil = defs.append("pattern")
          .attr("id", `${key}-crayon`).attr("patternUnits", "userSpaceOnUse")
          .attr("width", 8).attr("height", 8).attr("patternTransform", "rotate(-38)");
        pencil.append("path").attr("d", "M -2 2 L 10 2 M -2 6 L 10 6")
          .attr("stroke", paper).attr("stroke-width", 0.7).attr("stroke-dasharray", "5 1.6 2 1.4").attr("opacity", 0.5);
        const noDataFill = `url(#${key}-sans-donnee)`;
        // Teinte d'un pays : classe de l'outil ; sinon hachures « sans
        // valeur » (Banque mondiale) ou terre neutre (hors des pays de l'OCDE).
        const valueOf = (iso3) => globeValue(G.entries.get(iso3), outil);
        const fillOf = (iso3) => {
          if (iso3 === "ATA") return landColor;
          const value = valueOf(iso3);
          if (value != null) return globeColor(outil, value);
          return bm ? noDataFill : landColor;
        };

        const globe = svg.append("g").attr("class", "gini-globe");
        const sphere = globe.append("path").datum({ type: "Sphere" }).attr("fill", oceanColor);
        const graticule = globe.append("path").datum(d3.geoGraticule10())
          .attr("fill", "none").attr("stroke", "#cfc6b6").attr("stroke-width", 0.5).attr("stroke-dasharray", "2 4");
        const countries = globe.append("g").selectAll("path")
          .data(G.features.filter((f) => f.properties.iso3 !== "NCL"))
          .join("path")
          .attr("class", (d) => `gini-pays${G.entries.has(d.properties.iso3) ? " has-data" : ""}`)
          .attr("fill", (d) => fillOf(d.properties.iso3))
          .attr("stroke", paper).attr("stroke-width", 0.55).attr("stroke-linejoin", "round");
        const settledPaths = [
          globe.append("path")
            .datum({ type: "FeatureCollection", features: G.features.filter((f) => f.properties.iso3 !== "NCL" && valueOf(f.properties.iso3) != null) })
            .attr("class", "gini-globe-settled").attr("fill", `url(#${key}-crayon)`).attr("pointer-events", "none"),
          // Contours repassés au crayon, légèrement décalés.
          globe.append("path")
            .datum({ type: "FeatureCollection", features: G.features })
            .attr("class", "gini-globe-settled").attr("fill", "none")
            .attr("stroke", ink).attr("stroke-opacity", 0.32).attr("stroke-width", 0.6)
            .attr("stroke-dasharray", "7 1.4 2.5 1.6").attr("transform", "translate(0.7 0.5)")
            .attr("pointer-events", "none")
        ];
        const ncShape = globe.append("path").datum(G.ncFeature)
          .attr("class", "gini-pays has-data")
          .attr("fill", globeColor(outil, nc.low)).attr("stroke", ink).attr("stroke-width", 0.8);
        const selectedShape = globe.append("path")
          .attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1.8).attr("stroke-linejoin", "round")
          .attr("pointer-events", "none");
        const roughLayer = globe.append("g").attr("class", "gini-globe-settled").attr("pointer-events", "none");
        // Petits États insulaires : seulement pour les outils de la Banque
        // mondiale (aucun n'est suivi par l'OCDE).
        const pointMarks = globe.append("g").selectAll("g")
          .data(bm ? G.points : [])
          .join("g")
          .attr("class", "gini-globe-point");
        pointMarks.append("circle").attr("class", "gini-globe-point-mark")
          .attr("r", compact ? 3.4 : 4).attr("fill", (d) => globeColor(outil, outil.value(d))).attr("stroke", ink).attr("stroke-width", 0.9);
        pointMarks.append("circle").attr("class", "gini-hit").attr("r", 9).attr("fill", "transparent");
        // Repère de la Nouvelle-Calédonie : anneau net pendant la rotation,
        // anneau rough.js à l'arrêt.
        const ncMarker = globe.append("g").attr("pointer-events", "none");
        const ringR = compact ? 13 : 16;
        ncMarker.append("circle").attr("class", "gini-globe-moving")
          .attr("r", ringR).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1.5);
        const ncTitle = label(ncMarker, "Nouvelle-Calédonie", 0, 0, { family: fontSketch, size: compact ? 14 : 16, weight: 700, halo: true, haloWidth: 4 });
        const ncValue = label(ncMarker, `${fourchette(outil, nc)} (Isee)`, 0, 0, { size: compact ? 10.5 : 11.5, weight: 700, halo: true, haloWidth: 3.5 });
        const selectedPoint = globe.append("circle")
          .attr("r", compact ? 7 : 8).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1.6).attr("pointer-events", "none");
        // Contour du globe, fixe : un trait net qui borde exactement la
        // sphère (les terres ne le dépassent jamais), doublé d'un trait de
        // crayon juste à l'extérieur. Un cercle rough.js de cette taille
        // s'écarte de plusieurs pixels avec l'ajustement par défaut
        // (curveFitting 0,95) : il est resserré ici.
        svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", R)
          .attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1).attr("pointer-events", "none");
        appendRough(svg, rc.circle(cx, cy, 2 * R + 7, {
          stroke: ink, strokeWidth: 0.9, roughness: 0.7, bowing: 0.5, curveFitting: 0.995, seed: seed(`${key}-sphere`)
        }), 0.55);

        function drawRough() {
          roughLayer.selectAll("*").remove();
          const ncEntry = G.entries.get("NCL");
          if (visible(ncEntry.centre)) {
            const [x, y] = project(ncEntry.centre);
            appendRough(roughLayer, rc.circle(x, y, 2 * ringR, { stroke: ink, strokeWidth: 1.5, roughness: 1.2, bowing: 1, seed: seed(`${key}-anneau`) }));
          }
          const feature = G.featureByIso.get(ctx.state.selected);
          if (feature && ctx.state.selected !== "NCL") {
            const d = path(feature);
            if (d) {
              appendRough(roughLayer, rc.path(d, { stroke: ink, strokeWidth: 1.1, roughness: 1.1, bowing: 0.8, seed: seed(`${key}-${ctx.state.selected}`) }));
            }
          }
        }

        function update(settled) {
          // Mémorisée à chaque image : un redessin (redimensionnement, autre
          // outil) en pleine rotation repart de l'orientation courante.
          ctx.state.rotation = projection.rotate();
          svg.classed("is-moving", !settled);
          sphere.attr("d", path);
          graticule.attr("d", path);
          countries.attr("d", path);
          ncShape.attr("d", path);
          pointMarks
            .attr("display", (d) => (visible([d.lon, d.lat]) ? null : "none"))
            .attr("transform", (d) => {
              const [x, y] = project([d.lon, d.lat]);
              return `translate(${x},${y})`;
            });
          const selected = G.entries.get(ctx.state.selected);
          const feature = G.featureByIso.get(ctx.state.selected);
          selectedShape.attr("d", feature && !selected.nc ? path(feature) : null);
          const onPoint = !feature && visible(selected.centre);
          selectedPoint.attr("display", onPoint ? null : "none");
          if (onPoint) {
            const [x, y] = project(selected.centre);
            selectedPoint.attr("cx", x).attr("cy", y);
          }
          const ncCentre = G.entries.get("NCL").centre;
          ncMarker.attr("display", visible(ncCentre) ? null : "none");
          const [nx, ny] = project(ncCentre);
          ncMarker.select("circle").attr("cx", nx).attr("cy", ny);
          // Étiquette du côté du globe où il reste de la place.
          const right = nx < cx + R * 0.3;
          const tx = right ? nx + ringR + 6 : nx - ringR - 6;
          const anchor = right ? "start" : "end";
          ncTitle.attr("x", tx).attr("y", ny + 2).attr("text-anchor", anchor);
          ncValue.attr("x", tx).attr("y", ny + (compact ? 17 : 19)).attr("text-anchor", anchor);
          if (settled) {
            settledPaths.forEach((p) => p.attr("d", path));
            drawRough();
          }
        }

        // Survol : nom et valeur ; clic : sélection.
        const tipFor = (iso3, nom) => {
          const entry = G.entries.get(iso3);
          if (entry && entry.nc) {
            return tip("Nouvelle-Calédonie", [
              nc.high == null ? `${outil.label} : ${outil.fmt(nc.low)} (Isee, 2019)` : `${outil.fmt(nc.low)} : définition officielle (Isee, 2019)`,
              nc.high == null ? null : `${outil.fmt(nc.high)} : sans l’autoconsommation, comme pour l’Insee`,
              "Absente des bases de la Banque mondiale et de l’OCDE"
            ]);
          }
          const value = globeValue(entry, outil);
          if (value != null) {
            const row = bm ? entry.bm : entry.ocde;
            return tip(entry.name, [
              `${outil.label} : ${outil.fmt(value)}`,
              bm ? `Enquête ${row.annee}, ${mesureLabel(row.mesure)}` : `OCDE, ${row.annee}`,
              bm ? GROUPE_LABEL[row.groupe] : null
            ]);
          }
          if (iso3 === "ATA") return null;
          if (iso3 === "GUF") return tip("Guyane", ["Comparée à part, avec la France et les Outre-mer : voir plus haut"]);
          const autres = entry ? "Sélectionnez-le pour voir les autres outils" : null;
          if (!bm) return tip(entry ? entry.name : (nom || iso3), [`Hors des ${values.length} pays suivis par l’OCDE`, autres]);
          if (entry) return tip(entry.name, ["Pas dans la base de la Banque mondiale", autres]);
          const hors = G.hors.get(iso3);
          const motif = !hors ? "Absent de la base de la Banque mondiale"
            : hors.motif === "ancienne" ? `Dernière enquête nationale : ${hors.derniere}, avant 2010`
              : hors.motif === "urbain" ? "Enquête limitée aux villes : pas de valeur nationale"
                : "Sans groupe de revenu à la Banque mondiale : non retenu";
          return tip(nom || iso3, ["Pas de valeur dans la comparaison", motif]);
        };
        const showTip = (event, html) => {
          if (!html || svg.classed("is-moving")) {
            ctx.tooltip.style.opacity = 0;
            return;
          }
          ctx.tooltip.innerHTML = html;
          positionTooltip(ctx.root, ctx.tooltip, event);
        };
        const hideTip = () => { ctx.tooltip.style.opacity = 0; };
        d3.selectAll([...countries.nodes(), ncShape.node()])
          .on("pointerenter pointermove", (event, d) => showTip(event, tipFor(d.properties.iso3, d.properties.nom)))
          .on("pointerleave", hideTip)
          .on("click", (event, d) => select(d.properties.iso3, true));
        pointMarks
          .on("pointerenter pointermove", (event, d) => showTip(event, tipFor(d.iso3)))
          .on("pointerleave", hideTip)
          .on("click", (event, d) => select(d.iso3, true));

        function rotateTo(lonLat) {
          const start = projection.rotate();
          const target = [-lonLat[0], Math.max(-70, Math.min(70, -lonLat[1])), 0];
          // Plus court chemin en longitude.
          target[0] = start[0] + ((((target[0] - start[0]) % 360) + 540) % 360) - 180;
          svg.interrupt("rotation");
          hideTip();
          const finish = () => {
            projection.rotate(target);
            ctx.state.rotation = target;
            update(true);
          };
          const distance = d3.geoDistance(lonLat, centre());
          if (reducedMotion || distance < 0.02) {
            finish();
            return;
          }
          const step = d3.interpolate(start, target);
          svg.transition("rotation")
            .duration(Math.min(1400, 450 + distance * 450))
            .ease(d3.easeCubicInOut)
            .tween("rotation", () => (t) => {
              projection.rotate(step(t));
              update(false);
            })
            .on("end", finish);
        }

        function select(iso3, recentre) {
          const entry = G.entries.get(iso3);
          if (!entry) return;
          ctx.state.selected = iso3;
          G.select.value = iso3;
          renderGlobePanel(ctx);
          updateMarker();
          if (recentre) {
            setPressed(G.views, null);
            rotateTo(entry.centre);
          } else {
            update(true);
          }
        }
        ctx.globeSelect = select;
        ctx.globeView = (id) => {
          const vue = GLOBE_VUES.find((v) => v.id === id);
          if (vue) rotateTo(vue.centre);
        };

        if (finePointer) {
          let frame = null;
          let pending = null;
          svg.classed("is-draggable", true);
          svg.call(d3.drag()
            .on("start", (event) => {
              svg.interrupt("rotation");
              event.subject.rotation = projection.rotate();
              event.subject.pointer = [event.x, event.y];
              pending = null;
              hideTip();
            })
            .on("drag", (event) => {
              const start = event.subject.rotation;
              const [x0, y0p] = event.subject.pointer;
              // Un pixel au centre du globe : 1/R radian.
              const k = 180 / Math.PI / R;
              pending = [start[0] + (event.x - x0) * k, Math.max(-70, Math.min(70, start[1] - (event.y - y0p) * k)), 0];
              if (frame !== null) return;
              frame = window.requestAnimationFrame(() => {
                frame = null;
                projection.rotate(pending);
                update(false);
              });
            })
            .on("end", () => {
              if (frame !== null) window.cancelAnimationFrame(frame);
              frame = null;
              if (!pending) return;
              projection.rotate(pending);
              ctx.state.rotation = pending;
              pending = null;
              setPressed(G.views, null);
              update(true);
            }));
        } else {
          svg.classed("is-draggable", false);
        }

        // Légende : rampe des six classes, de même largeur ; un trait par
        // pays, placé à l'intérieur de sa classe ; repère du pays sélectionné.
        const legendLeft = 18;
        const legendWidth = Math.min(W - 36, 440);
        const bounds = [outil.bornes[0], ...outil.seuils, outil.bornes[1]];
        const lx = d3.scaleLinear()
          .domain(bounds)
          .range(bounds.map((b, i) => legendLeft + (i * legendWidth) / (bounds.length - 1)))
          .clamp(true);
        let ly = cy + R + (compact ? 46 : 52);
        const legend = svg.append("g").attr("class", "gini-globe-legend");
        values.forEach((value) => {
          legend.append("line").attr("x1", lx(value)).attr("x2", lx(value)).attr("y1", ly).attr("y2", ly + 10)
            .attr("stroke", ink).attr("stroke-opacity", 0.4).attr("stroke-width", 0.8);
        });
        GLOBE_COULEURS.forEach((color, i) => {
          legend.append("rect").attr("x", lx(bounds[i])).attr("y", ly + 12).attr("width", lx(bounds[i + 1]) - lx(bounds[i])).attr("height", 14)
            .attr("fill", color).attr("stroke", paper).attr("stroke-width", 1);
        });
        outil.seuils.forEach((t) => {
          label(legend, outil.tick(t), lx(t), ly + 38, { anchor: "middle", size: compact ? 10 : 11, weight: 700, color: muted });
        });
        label(legend, "← plus égalitaire", legendLeft, ly + 55, { size: compact ? 10 : 11, weight: 700, color: muted });
        label(legend, "plus inégalitaire →", legendLeft + legendWidth, ly + 55, { anchor: "end", size: compact ? 10 : 11, weight: 700, color: muted });
        // Ordonnée de la rampe figée ici : `ly` avance ensuite pour les clés,
        // et le repère est déplacé à chaque sélection.
        const rampY = ly;
        const marker = legend.append("g").attr("pointer-events", "none");
        marker.append("path").attr("d", "M 0 -2 L -5 -11 L 5 -11 Z").attr("fill", ink);
        const markerText = label(marker, "", 0, -20, { anchor: "middle", size: compact ? 11 : 12, weight: 700, halo: true });
        function updateMarker() {
          const entry = G.entries.get(ctx.state.selected);
          const value = globeValue(entry, outil);
          marker.attr("display", value == null ? "none" : null);
          if (value == null) return;
          const x = lx(value);
          const text = `${entry.nc ? "Nouvelle-Calédonie" : entry.name} : ${outil.fmt(value)}`;
          const half = textW(text, compact ? 11 : 12) / 2;
          marker.attr("transform", `translate(${x},${rampY})`);
          markerText.text(text).attr("x", Math.max(legendLeft + half, Math.min(legendLeft + legendWidth - half, x)) - x);
        }
        updateMarker();

        // Clés secondaires : un trait par pays, sans valeur (Banque mondiale)
        // ou hors des pays de l'OCDE, petit État insulaire, Nouvelle-Calédonie.
        ly += compact ? 76 : 80;
        const keys = [
          { type: "tick", text: "un trait : un pays" },
          bm ? { type: "nodata", text: "pas de valeur dans la comparaison" } : { type: "outside", text: `hors des ${values.length} pays de l’OCDE` },
          bm ? { type: "point", text: "petit État insulaire" } : null,
          { type: "nc", text: `Nouvelle-Calédonie (Isee) : ${fourchette(outil, nc)}` }
        ].filter(Boolean);
        let kx = legendLeft;
        const keySize = compact ? 10.5 : 11.5;
        keys.forEach((item) => {
          const width = 20 + textW(item.text, keySize);
          if (kx + width > W - 18 && kx > legendLeft) {
            kx = legendLeft;
            ly += 20;
          }
          if (item.type === "tick") {
            [2, 6, 11].forEach((dx) => {
              legend.append("line").attr("x1", kx + dx).attr("x2", kx + dx).attr("y1", ly - 5).attr("y2", ly + 5)
                .attr("stroke", ink).attr("stroke-opacity", 0.55).attr("stroke-width", 0.8);
            });
          } else if (item.type === "nodata" || item.type === "outside") {
            legend.append("rect").attr("x", kx).attr("y", ly - 6).attr("width", 13).attr("height", 12)
              .attr("fill", item.type === "nodata" ? noDataFill : landColor).attr("stroke", noDataStroke).attr("stroke-width", 0.6);
          } else if (item.type === "point") {
            legend.append("circle").attr("cx", kx + 6).attr("cy", ly).attr("r", 4)
              .attr("fill", GLOBE_COULEURS[1]).attr("stroke", ink).attr("stroke-width", 0.9);
          } else {
            legend.append("circle").attr("cx", kx + 6).attr("cy", ly).attr("r", 6)
              .attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1.5);
          }
          label(legend, item.text, kx + 19, ly, { size: keySize, weight: 700 });
          kx += width + 16;
        });

        update(true);
        renderGlobePanel(ctx);
        const height = drawFooter(svg, rc, ctx, W, ly + 22);
        const pays = Array.from(G.entries.values()).filter((e) => !e.nc);
        const extremes = [values[0], values[values.length - 1]].map((v) => ({ v, entry: pays.find((e) => globeValue(e, outil) === v) }));
        finish(svg, ctx, W, height, `Globe de ${values.length} pays colorés selon leur ${outil.short}, de ${outil.fmt(extremes[0].v)} (${extremes[0].entry.name}) à ${outil.fmt(extremes[1].v)} (${extremes[1].entry.name}). La Nouvelle-Calédonie, absente des bases de la Banque mondiale et de l’OCDE, est signalée à part : ${fourchette(outil, nc)} selon l’Isee. Le panneau voisin détaille le pays choisi et ses cinq outils ; les tableaux de l’article donnent la valeur de chaque pays.`);
      }
    },

    // Barres horizontales : France et Outre-mer, définitions rapprochées,
    // pour l'indicateur choisi (indice de Gini, rapports D9/D1 ou S80/S20).
    "outre-mer": {
      load: (root) => loadCsv(root.dataset.src),
      init(ctx) {
        ctx.state = { indicateur: "gini" };
        return [buttonGroup("Indicateur", OUTRE_MER.map((o) => [o.id, o.button]), ctx.state.indicateur, (value) => {
          ctx.state.indicateur = value;
          ctx.redraw();
        })];
      },
      draw(ctx, rows) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const ind = OUTRE_MER.find((o) => o.id === ctx.state.indicateur);
        const data = rows.filter((d) => Number.isFinite(d[ind.id])).sort((a, b) => b[ind.id] - a[ind.id]);
        const missing = rows.filter((d) => !Number.isFinite(d[ind.id])).map((d) => d.territoire);
        let y = drawHeader(svg, ctx, W, `${ind.label} des niveaux de vie ; Nouvelle-Calédonie sans l’autoconsommation, comme pour l’Insee`);
        const left = compact ? 18 : 210;
        const right = W - (compact ? 52 : 70);
        const x = d3.scaleLinear().domain([0, ind.max]).range([left, right]);
        const barH = compact ? 18 : 22;
        const step = compact ? 50 : 38;
        const top = y + 12;
        const bottom = top + data.length * step;
        d3.range(0, ind.max + 1e-9, ind.step).forEach((t) => {
          svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", top - 4).attr("y2", bottom)
            .attr("stroke", t ? gridColor : "#bdb4a6").attr("stroke-dasharray", t ? "2 4" : null);
          label(svg, ind.tick(t), x(t), bottom + 13, { anchor: "middle", size: compact ? 10 : 11, weight: 700, color: muted });
        });
        data.forEach((d, index) => {
          const isNc = d.territoire === "Nouvelle-Calédonie";
          const color = isNc ? colorNc : colorOther;
          const value = d[ind.id];
          const cy = top + index * step + (compact ? 30 : step / 2);
          const name = `${d.territoire} (${d.annee})`;
          if (compact) {
            label(svg, name, left, cy - barH / 2 - 9, { size: 11.5, weight: 700, color: isNc ? colorNc : ink });
          } else {
            label(svg, name, left - 12, cy, { anchor: "end", size: 12.5, weight: 700, color: isNc ? colorNc : ink });
          }
          roughRect(svg, rc, x(0), cy - barH / 2, x(value) - x(0), barH, {
            fill: color, stroke: hatchColor(color), strokeWidth: isNc ? 1.2 : 0.8, seed: `${ctx.key}-${ind.id}-${d.territoire}`
          });
          label(svg, ind.fmt(value), x(value) + 7, cy, { size: compact ? 12 : 13, weight: 700, color: isNc ? colorNc : ink });
          const source = String(d.source).replace("BDF", "enquête Budget de famille").replace("ERFS", "enquête Revenus fiscaux et sociaux");
          hitArea(svg, ctx, x(0), cy - barH / 2 - 4, Math.max(40, x(value) - x(0) + 40), barH + 8,
            `${name} : ${ind.button} ${ind.fmt(value)}`,
            () => tip(d.territoire, [`${ind.label} : ${ind.fmt(value)}`, source]));
        });
        label(svg, "plus à droite, plus inégalitaire →", right, bottom + 31, { anchor: "end", size: compact ? 10 : 11, weight: 700, color: muted });
        let footerY = bottom + 46;
        if (missing.length) {
          const noteX = compact ? 18 : left;
          footerY = paragraph(svg, `${missing.join(", ")} : ${ind.button} non publié dans le tableau de l’Isee.`, noteX, bottom + 49, W - 18 - noteX, { size: compact ? 10 : 11, weight: 700, color: muted }) + 2;
        }
        const height = drawFooter(svg, rc, ctx, W, footerY);
        finish(svg, ctx, W, height, `${ind.label}. ${data.map((d) => `${d.territoire} (${d.annee}) : ${ind.fmt(d[ind.id])}`).join(", ")}`);
      }
    },

    // Dix habitants, un par dixième de la population, et la pile de francs
    // que reçoit chacun sur 100 francs de niveaux de vie.
    partage: {
      load: (root) => loadCsv(root.dataset.src),
      init() {
        return [];
      },
      draw(ctx, rows) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const annee = Number(ctx.root.dataset.annee) || 2019;
        const parts = d3.range(1, 11).map((k) => {
          const row = rows.find((d) => d.annee === annee && d.decile === k);
          if (!row) throw new Error(`Décile absent : ${annee}, ${k}`);
          return row.part;
        });
        const half = d3.sum(parts.slice(0, 5));
        let y = drawHeader(svg, ctx, W, compact
          ? `Sur 100 francs de niveaux de vie, ce que reçoit chaque dixième de la population (${annee})`
          : `Sur 100 francs de niveaux de vie, ce que reçoit chaque dixième de la population en ${annee}, du plus modeste au plus aisé`);
        const band = d3.scaleBand().domain(d3.range(10)).range([18, W - 18]).paddingInner(compact ? 0.1 : 0.22);
        const bw = band.bandwidth();
        const pileW = Math.min(bw * 0.66, 44);
        const pileMax = compact ? 160 : 220;
        const top = y + (compact ? 30 : 34);
        const pileBase = top + pileMax;
        const yP = d3.scaleLinear().domain([0, 30]).range([pileBase, top]);
        const personH = compact ? Math.max(30, Math.min(44, bw * 1.25)) : Math.min(66, bw * 0.9);
        const personBase = pileBase + 10 + personH;
        const small = compact ? 10 : 11.5;

        // La moitié la plus modeste, ensemble : accolade au-dessus des cinq
        // premières piles, toujours basses.
        const bx0 = band(0) + bw / 2 - pileW / 2;
        const bx1 = band(4) + bw / 2 + pileW / 2;
        const by = yP(Math.max(compact ? 16 : 14, d3.max(parts.slice(0, 5)) + 6));
        roughLine(svg, rc, bx0, by, bx1, by, { stroke: ink, strokeWidth: 1, seed: `${ctx.key}-accolade` });
        [bx0, bx1].forEach((bx, i) => roughLine(svg, rc, bx, by, bx, by + 7, { stroke: ink, strokeWidth: 1, seed: `${ctx.key}-accolade-${i}` }));
        label(svg, compact ? `les 50 % les plus modestes : ${share(half)} F` : `ensemble, les 50 % les plus modestes reçoivent ${share(half)} F`, bx0, by - 11, {
          size: compact ? 10.5 : 12, weight: 700, halo: true
        });

        // Égalité : 10 francs chacun.
        roughLine(svg, rc, 18, yP(10), W - 18, yP(10), { stroke: colorEq, strokeWidth: 1.3, dash: [6, 5], roughness: 0.5, seed: `${ctx.key}-egalite` });
        // Sur petit écran, au-dessus du trait : en dessous, le libellé
        // chevaucherait les valeurs des piles du milieu.
        label(svg, compact ? "égalité : 10 F chacun" : "à égalité parfaite : 10 francs chacun", 20, yP(10) + (compact ? -9 : 11), { size: small, weight: 700, color: colorEq, halo: true });

        parts.forEach((part, k) => {
          const cx = band(k) + bw / 2;
          const px = cx - pileW / 2;
          roughRect(svg, rc, px, yP(part), pileW, pileBase - yP(part), {
            fill: colorNc, stroke: hatchColor(colorNc), hachureGap: compact ? 2.4 : 3, seed: `${ctx.key}-pile-${k}`
          });
          // Une pièce par franc.
          for (let f = 1; f < part - 0.2; f += 1) {
            svg.append("line").attr("x1", px + 1).attr("x2", px + pileW - 1).attr("y1", yP(f)).attr("y2", yP(f))
              .attr("stroke", hatchColor(colorNc)).attr("stroke-width", 0.8).attr("stroke-opacity", 0.6).attr("pointer-events", "none");
          }
          label(svg, `${share(part)} F`, cx, yP(part) - 9, { anchor: "middle", size: compact ? 10 : 12.5, weight: 700, halo: true });
          roughSilhouette(svg, rc, cx, personBase, personH, { seed: `${ctx.key}-habitant-${k}`, strokeWidth: k === 0 || k === 9 ? 1.4 : 1 });
          label(svg, ordinal(k + 1), cx, personBase + 13, { anchor: "middle", size: compact ? 9.5 : 11, weight: 700, color: muted });
          const name = `${ordinal(k + 1)} dixième${k === 0 ? " (les 10 % les plus modestes)" : k === 9 ? " (les 10 % les plus aisés)" : ""}`;
          hitArea(svg, ctx, band(k), top - 16, bw, personBase - top + 30,
            `${name} : ${share(part)} francs sur 100`,
            () => tip(name, [`${share(part)} francs sur 100`, `soit ${pct(part)} du total des niveaux de vie`]));
        });
        label(svg, "← plus modestes", 18, personBase + 31, { size: small, weight: 700, color: muted });
        label(svg, "plus aisés →", W - 18, personBase + 31, { anchor: "end", size: small, weight: 700, color: muted });
        const height = drawFooter(svg, rc, ctx, W, personBase + 46);
        finish(svg, ctx, W, height, `Sur 100 francs de niveaux de vie en ${annee} : ${parts.map((p, i) => `${ordinal(i + 1)} dixième ${share(p)} F`).join(", ")}. Ensemble, les 50 % les plus modestes reçoivent ${share(half)} F, les 10 % les plus aisés ${share(parts[9])} F.`);
      }
    },

    // Outil 3 : échelle des niveaux de vie, en Nouvelle-Calédonie et en France
    // métropolitaine. Neuf seuils (D1 à D9) partagent chaque population en dix
    // groupes de même taille. Pour comparer deux monnaies et deux niveaux de
    // prix, chaque seuil est placé par rapport au niveau de vie médian de son
    // territoire : les deux médianes, et les deux seuils de pauvreté (la moitié
    // de la médiane), sont alignés. Les montants restent en F CFP et en euros.
    echelle: {
      load: (root) => Promise.all([loadCsv(root.dataset.src), loadCsv(root.dataset.franceSrc)]),
      init() {
        return [];
      },
      draw(ctx, [rowsNc, rowsFrance]) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const d = ctx.root.dataset;
        const seuilsOf = (rows, annee) => d3.range(1, 10).map((k) => {
          const row = rows.find((r) => r.annee === annee && r.decile === k);
          if (!row || !Number.isFinite(row.seuil)) throw new Error(`Seuil absent : ${annee}, D${k}`);
          return row.seuil;
        });
        const annee = Number(d.annee) || 2019;
        const anneeFrance = Number(d.franceAnnee) || 2018;
        // Sur petit écran, le sous-titre dit déjà « par unité de consommation ».
        const unite = compact ? "par mois" : "par mois et par unité de consommation";
        const panels = [
          {
            name: "Nouvelle-Calédonie", meta: `Isee, ${annee} · F CFP ${unite}`,
            seuils: seuilsOf(rowsNc, annee), rapport: Number(d.d9D1), pauvrete: Number(d.seuilPauvrete), fmt: fcfp, color: colorNc
          },
          {
            name: "France métropolitaine", meta: `Insee, ${anneeFrance} · euros ${unite}`,
            seuils: seuilsOf(rowsFrance, anneeFrance), rapport: Number(d.franceD9D1), fmt: euros, color: colorOther
          }
        ];
        // France : la moitié du niveau de vie médian, comme pour l'Isee.
        panels[1].pauvrete = panels[1].seuils[4] / 2;
        if (panels.some((p) => !Number.isFinite(p.rapport) || !Number.isFinite(p.pauvrete))) throw new Error("Rapport D9/D1 ou seuil de pauvreté absent");
        const tauxPauvrete = Number(d.pauvrete);
        const harmonise = Number(d.ncHarmonise);
        let y = drawHeader(svg, ctx, W, compact
          ? "Niveau de vie mensuel par unité de consommation, rapporté au niveau de vie médian de chaque territoire"
          : "Niveau de vie mensuel par unité de consommation, rapporté au niveau de vie médian de chaque territoire : neuf seuils partagent la population en dix groupes de même taille");
        const left = compact ? 22 : 40;
        const right = W - (compact ? 22 : 40);
        // En multiple du niveau de vie médian : jusqu'à trois fois la médiane.
        const max = 3;
        const x = d3.scaleLinear().domain([0, max]).range([left, right]);
        const small = compact ? 10 : 11.5;
        const personH = compact ? 30 : 40;
        const gap = compact ? 18 : 22;
        const panelH = 64 + 26 + personH + (compact ? 18 : 22) + 34;
        const firstRail = y + 64 + 26 + personH;
        const lastRail = y + panelH + gap + 64 + 26 + personH + (compact ? 18 : 22);

        // Médianes alignées : un trait commun aux deux échelles.
        svg.append("line").attr("x1", x(1)).attr("x2", x(1)).attr("y1", firstRail - personH).attr("y2", lastRail + 4)
          .attr("stroke", "#bdb4a6").attr("stroke-dasharray", "2 4").attr("pointer-events", "none");

        panels.forEach((p, i) => {
          const py = y + i * (panelH + gap);
          const key = `${ctx.key}-${i}`;
          const median = p.seuils[4];
          const xs = p.seuils.map((s) => x(s / median));
          const xp = x(p.pauvrete / median);
          label(svg, p.name, 18, py + 6, { family: fontSketch, size: compact ? 17 : 19, weight: 700, color: p.color, halo: true });
          wrap(p.meta, compact ? Math.floor((W - 36) / 5.9) : 140).forEach((line, k) => label(svg, line, 18, py + 25 + k * 13, { size: compact ? 10 : 11.5, weight: 700, color: muted, halo: true }));
          const arrowY = py + 64;
          const railTop = arrowY + 26 + personH;
          const railBottom = railTop + (compact ? 18 : 22);

          // Rapport D9/D1 : flèche entre les deux personnes.
          roughLine(svg, rc, xs[0], arrowY, xs[8], arrowY, { stroke: ink, strokeWidth: 1.3, seed: `${key}-fleche` });
          [[xs[0], 1], [xs[8], -1]].forEach(([ax, dir], j) => {
            svg.append("path").attr("d", `M${ax},${arrowY}l${7 * dir},-4v8z`).attr("fill", ink).attr("pointer-events", "none");
            roughLine(svg, rc, ax, arrowY + 4, ax, railTop - personH - 4, { stroke: muted, strokeWidth: 0.8, dash: [3, 3], roughness: 0.4, seed: `${key}-repere-${j}` });
          });
          label(svg, `× ${ratio(p.rapport)} : rapport D9/D1`, (xs[0] + xs[8]) / 2, arrowY - 11, {
            anchor: "middle", family: fontSketch, size: compact ? 15 : 18, weight: 700, color: p.color, halo: true
          });

          // Sous le seuil de pauvreté : zone hachurée dans l'échelle.
          roughRect(svg, rc, x(0), railTop, xp - x(0), railBottom - railTop, {
            fill: p.color, stroke: "none", hachureGap: 3.2, fillWeight: 0.9, seed: `${key}-pauvrete`
          }).attr("opacity", 0.75);
          roughLine(svg, rc, xp, railTop - 4, xp, railBottom + 6, { stroke: p.color, strokeWidth: 1.4, dash: [5, 4], roughness: 0.4, seed: `${key}-seuil` });

          // Montants et barreaux.
          [railTop, railBottom].forEach((ry, j) => roughLine(svg, rc, x(0), ry, x(max), ry, { strokeWidth: 1.6, seed: `${key}-montant-${j}` }));
          label(svg, "→", x(max) + 4, (railTop + railBottom) / 2, { size: 14, weight: 700, color: muted });
          xs.forEach((rx, k) => {
            roughLine(svg, rc, rx, railTop, rx, railBottom, { strokeWidth: k === 4 ? 2.4 : 1.3, seed: `${key}-barreau-${k}` });
          });
          // Les deux personnes comparées : à la limite des 10 % les plus
          // modestes (D1) et à l'entrée des 10 % les plus aisés (D9).
          [0, 8].forEach((k) => roughSilhouette(svg, rc, xs[k], railTop - 2, personH, { seed: `${key}-personne-${k}`, strokeWidth: 1.3 }));
          // Seuils intermédiaires nommés au-dessus de l'échelle, entre les deux
          // personnes, sur grand écran.
          if (!compact) {
            [1, 2, 3, 5, 6, 7].forEach((k) => label(svg, `D${k + 1}`, xs[k], railTop - 9, { anchor: "middle", size: 10, weight: 700, color: muted, halo: true }));
          }

          // Libellés sous l'échelle.
          const labelY = railBottom + 14;
          [[0, "D1"], [4, "médiane"], [8, "D9"]].forEach(([k, name]) => {
            label(svg, name, xs[k], labelY, { anchor: "middle", size: compact ? 10.5 : 12, weight: 700 });
            label(svg, p.fmt(p.seuils[k]), xs[k], labelY + 15, { anchor: "middle", size: compact ? 10.5 : 12, weight: 700, color: k === 4 ? ink : muted });
          });

          // Un dixième de la population par intervalle, au survol et au clavier.
          const bounds = [0, ...p.seuils.map((s) => s / median), max];
          d3.range(10).forEach((k) => {
            const name = k === 0 ? "Les 10 % les plus modestes" : k === 9 ? "Les 10 % les plus aisés" : `${ordinal(k + 1)} dixième de la population`;
            const range = k === 0 ? `moins de ${p.fmt(p.seuils[0])} par mois` : k === 9 ? `plus de ${p.fmt(p.seuils[8])} par mois` : `de ${p.fmt(p.seuils[k - 1])} à ${p.fmt(p.seuils[k])} par mois`;
            hitArea(svg, ctx, x(bounds[k]), railTop - 4, Math.max(4, x(bounds[k + 1]) - x(bounds[k])), railBottom - railTop + 8,
              `${p.name}, ${name.toLowerCase()} : ${range}`, () => tip(`${p.name} · ${name}`, [range, "par unité de consommation"]));
          });
        });

        // Axe commun, en pourcentage du niveau de vie médian.
        const axisY = y + 2 * panelH + gap + 8;
        svg.append("line").attr("x1", x(0)).attr("x2", x(max)).attr("y1", axisY).attr("y2", axisY).attr("stroke", "#bdb4a6");
        d3.range(0, max + 1e-9, compact ? 1 : 0.5).forEach((t) => {
          svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", axisY).attr("y2", axisY + 4).attr("stroke", "#bdb4a6");
          label(svg, `${nf0.format(t * 100)} %`, x(t), axisY + 14, { anchor: t === max ? "end" : "middle", size: compact ? 9.5 : 10.5, weight: 700, color: muted });
        });
        label(svg, "en % du niveau de vie médian de chaque territoire", x(0), axisY + 30, { size: compact ? 9.5 : 10.5, weight: 700, color: muted });

        // Légende et notes.
        let noteY = axisY + 52;
        panels.forEach((p, i) => {
          roughRect(svg, rc, left + i * 20, noteY - 6, 16, 12, { fill: p.color, stroke: "none", hachureGap: 3, fillWeight: 0.9, seed: `${ctx.key}-cle-${i}` }).attr("opacity", 0.75);
        });
        const notes = [
          [`Sous le seuil de pauvreté, la moitié du niveau de vie médian : ${fcfp(panels[0].pauvrete)} en Nouvelle-Calédonie, ${euros(panels[1].pauvrete)} en France. Il dépasse le D1 en Nouvelle-Calédonie, où ${taux(tauxPauvrete)} de la population vit en dessous ; il reste sous le D1 en France, où moins de 10 % de la population vit en dessous.`, left + 46],
          ["Entre deux barreaux : un dixième de la population.", left]
        ];
        if (Number.isFinite(harmonise)) notes.push([`Sans l’autoconsommation, comme pour l’Insee, le rapport calédonien est de ${ratio(harmonise)}.`, left]);
        notes.forEach(([text, nx]) => {
          noteY = paragraph(svg, text, nx, noteY, right - nx, { size: small, lineHeight: 15, weight: 700, color: muted }) + 3;
        });
        const height = drawFooter(svg, rc, ctx, W, noteY + 4);
        finish(svg, ctx, W, height, panels.map((p) => `${p.name} (${p.meta}) : ${p.seuils.map((s, k) => `D${k + 1} ${p.fmt(s)}`).join(", ")} ; le seuil D9 est ${ratio(p.rapport)} fois plus élevé que le seuil D1 ; seuil de pauvreté ${p.fmt(p.pauvrete)}`).join(". ") + `. Rapportés au niveau de vie médian, le D1 et le D9 valent ${pct(100 * panels[0].seuils[0] / panels[0].seuils[4])} et ${pct(100 * panels[0].seuils[8] / panels[0].seuils[4])} en Nouvelle-Calédonie, ${pct(100 * panels[1].seuils[0] / panels[1].seuils[4])} et ${pct(100 * panels[1].seuils[8] / panels[1].seuils[4])} en France.`);
      }
    },

    // Cent silhouettes par territoire : celles des personnes qui vivent sous
    // le seuil de pauvreté (moitié du niveau de vie médian) sont colorées.
    pauvrete: {
      load: () => Promise.resolve(null),
      init() {
        return [];
      },
      draw(ctx) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const d = ctx.root.dataset;
        const panels = [
          { name: "Nouvelle-Calédonie", meta: d.ncMeta, value: Number(d.nc), extra: Number(d.ncHarmonise), color: colorNc },
          { name: "France", meta: d.franceMeta, value: Number(d.france), color: colorOther }
        ];
        if (panels.some((p) => !Number.isFinite(p.value))) throw new Error("Taux de pauvreté absents");
        let y = drawHeader(svg, ctx, W, "Sur 100 personnes, combien vivent sous le seuil de pauvreté, fixé à la moitié du niveau de vie médian ?");
        // Les deux grilles côte à côte, y compris sur petit écran, où le nom,
        // le taux et la source s'empilent au-dessus de chaque grille.
        const gap = compact ? 18 : 40;
        const panelW = (W - 36 - gap) / 2;
        const cell = Math.min(34, panelW / 10);
        const gridH = 10 * cell;
        const metaLines = panels.map((p) => (compact ? wrap(p.meta, Math.floor(panelW / (9.5 * 0.58))) : [p.meta]));
        const gridTop = compact ? 56 + 12 * d3.max(metaLines, (lines) => lines.length) : 44;
        const panelH = gridTop + 14 + gridH;
        panels.forEach((p, i) => {
          const px = 18 + i * (panelW + gap);
          const py = y;
          if (compact) {
            label(svg, p.name, px, py + 4, { family: fontSketch, size: 13.5, weight: 700, color: p.color });
            label(svg, taux(p.value), px, py + 28, { family: fontSketch, size: 24, weight: 700, color: p.color });
            metaLines[i].forEach((line, k) => label(svg, line, px, py + 50 + 12 * k, { size: 9.5, weight: 700, color: muted }));
          } else {
            label(svg, p.name, px, py + 6, { family: fontSketch, size: 19, weight: 700, color: p.color });
            label(svg, p.meta, px, py + 26, { size: 11.5, weight: 700, color: muted });
            label(svg, taux(p.value), px + 10 * cell, py + 14, { anchor: "end", family: fontSketch, size: 30, weight: 700, color: p.color });
          }
          const filled = Math.round(p.value);
          const extra = Number.isFinite(p.extra) ? Math.round(p.extra) : filled;
          d3.range(100).forEach((n) => {
            const cx = px + (n % 10) * cell + cell / 2;
            const base = py + gridTop + Math.floor(n / 10) * cell + cell * 0.92;
            const below = n < filled;
            const more = !below && n < extra;
            drawSilhouette(svg, cx, base, cell * 0.84, {
              fill: below ? p.color : paper,
              stroke: below ? hatchColor(p.color) : more ? p.color : "#c9bfae",
              strokeWidth: more ? 1.1 : 0.8,
              dash: more ? "2 1.6" : null
            });
          });
          const lines = [`${taux(p.value)} sous le seuil, soit environ ${filled} personnes sur 100`];
          if (extra > filled) lines.push(`${taux(p.extra)} sans l’autoconsommation, comme pour l’OCDE`);
          hitArea(svg, ctx, px, py - 8, 10 * cell, panelH, `${p.name} (${p.meta}) : ${lines.join(" ; ")}`, () => tip(p.name, [p.meta, ...lines]));
        });
        const bottom = y + panelH + 12;
        // Légende.
        const legend = [
          { fill: colorNc, stroke: hatchColor(colorNc), text: "sous le seuil de pauvreté" },
          { fill: paper, stroke: colorNc, dash: "2 1.6", text: compact ? "en plus, sans l’autoconsommation" : `en plus, sans l’autoconsommation (${taux(panels[0].extra)})` }
        ];
        let ly = bottom + 8;
        let lx = 18;
        legend.forEach((item) => {
          const width = 24 + textW(item.text, compact ? 10.5 : 11.5);
          if (lx + width > W - 18 && lx > 18) {
            lx = 18;
            ly += 22;
          }
          drawSilhouette(svg, lx + 7, ly + 8, 16, { fill: item.fill, stroke: item.stroke, dash: item.dash, strokeWidth: 1 });
          label(svg, item.text, lx + 20, ly, { size: compact ? 10.5 : 11.5, weight: 700 });
          lx += width + 18;
        });
        const noteEnd = paragraph(svg, "Une silhouette pour 1 % de la population ; valeurs arrondies.", 18, ly + 24, W - 36, { size: compact ? 10 : 11, lineHeight: 14, weight: 700, color: muted });
        const height = drawFooter(svg, rc, ctx, W, noteEnd + 2);
        finish(svg, ctx, W, height, panels.map((p) => `${p.name} (${p.meta}) : ${taux(p.value)} de la population sous le seuil de pauvreté`).join(" ; ") + `. Sans l’autoconsommation, le taux calédonien est de ${taux(panels[0].extra)}.`);
      }
    },

    // Outil 1 : le gâteau des revenus coupé en dix parts, une par dixième de
    // la population, en Nouvelle-Calédonie et dans un pays de la Banque
    // mondiale. La part des 10 % les plus aisés est hachurée ; un trait vert
    // marque celle qu'ils auraient à égalité parfaite (10 %).
    gateau: {
      load: (root) => Promise.all([loadCsv(root.dataset.src), loadCsv(root.dataset.mondeSrc)]),
      init() {
        return [];
      },
      draw(ctx, [deciles, monde]) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const annee = Number(ctx.root.dataset.annee) || 2019;
        const ncParts = d3.range(1, 11).map((k) => {
          const row = deciles.find((d) => d.annee === annee && d.decile === k);
          if (!row) throw new Error(`Décile absent : ${annee}, ${k}`);
          return row.part;
        });
        const pays = monde.find((d) => d.iso3 === ctx.root.dataset.pays);
        if (!pays) throw new Error(`Pays absent : ${ctx.root.dataset.pays}`);
        const panels = [
          { name: "Nouvelle-Calédonie", meta: `Isee, ${annee} · niveau de vie`, parts: ncParts, color: colorNc },
          { name: countryName(pays), meta: `Banque mondiale, ${pays.annee} · ${mesureLabel(pays.mesure)}`, parts: partsOf(pays), color: colorReal }
        ];
        let y = drawHeader(svg, ctx, W, "Le gâteau des revenus coupé en dix parts, une par dixième de la population : quelle part revient aux 10 % les plus aisés ?");
        const gap = 30;
        const panelW = compact ? W - 36 : (W - 36 - gap) / 2;
        const R = Math.max(70, Math.min(compact ? 100 : 112, panelW / 2 - 50));
        const panelH = 44 + 2 * R + 58;
        const small = compact ? 10.5 : 11.5;
        const arc = d3.arc().innerRadius(0).outerRadius(R);
        const eq = (2 * Math.PI) / 10;
        panels.forEach((p, i) => {
          const px = 18 + (compact ? 0 : i * (panelW + gap));
          const py = y + (compact ? i * (panelH + 18) : 0);
          const cx = px + panelW / 2;
          const cy = py + 44 + R;
          label(svg, p.name, px, py + 6, { family: fontSketch, size: compact ? 17 : 19, weight: 700, color: p.color });
          label(svg, p.meta, px, py + 25, { size: small, weight: 700, color: muted });
          // Parts dans le sens des aiguilles d'une montre depuis midi : les
          // 10 % les plus aisés, puis les autres dixièmes, du 9e au 1er.
          const total = d3.sum(p.parts);
          let a = 0;
          const slices = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((k) => {
            const a0 = a;
            a += (2 * Math.PI * p.parts[k]) / total;
            return { k, a0, a1: a };
          });
          svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", R).attr("fill", paper);
          slices.slice(1).forEach((s) => {
            svg.append("path").attr("d", arc({ startAngle: s.a0, endAngle: s.a1 })).attr("transform", `translate(${cx},${cy})`)
              .attr("fill", "#f1ebdf").attr("stroke", "#c9bfae").attr("stroke-width", 0.8).attr("pointer-events", "none");
          });
          // Part des 10 % les plus aisés, hachurée (angles de rough.js comptés
          // depuis 3 heures, ceux de d3 depuis midi).
          const top = slices[0];
          appendRough(svg, rc.arc(cx, cy, 2 * R, 2 * R, top.a0 - Math.PI / 2, top.a1 - Math.PI / 2, true, {
            fill: p.color, fillStyle: "hachure", hachureGap: 3, hachureAngle: -41, fillWeight: 1, stroke: ink, strokeWidth: 1.3, roughness: 0.9, bowing: 0.6, seed: seed(`${ctx.key}-${i}-part`)
          }));
          appendRough(svg, rc.circle(cx, cy, 2 * R, { stroke: ink, strokeWidth: 1.1, roughness: 0.7, bowing: 0.5, curveFitting: 0.99, seed: seed(`${ctx.key}-${i}-gateau`) }));
          // À égalité parfaite, la part s'arrêterait au trait vert.
          roughLine(svg, rc, cx, cy, cx + (R + 8) * Math.sin(eq), cy - (R + 8) * Math.cos(eq), {
            stroke: colorEq, strokeWidth: 1.7, dash: [5, 4], roughness: 0.4, seed: `${ctx.key}-${i}-egalite`
          });
          label(svg, "à égalité : 10 %", cx + (R + 12) * Math.sin(eq) + 2, cy - (R + 12) * Math.cos(eq) - 4, { size: small, weight: 700, color: colorEq, halo: true });
          // Valeur dans la part, loin du trait d'égalité.
          const mid = top.a0 + 0.76 * (top.a1 - top.a0);
          label(svg, pct(p.parts[9]), cx + R * 0.62 * Math.sin(mid), cy - R * 0.62 * Math.cos(mid), {
            anchor: "middle", family: fontSketch, size: compact ? 24 : 28, weight: 700, halo: true, haloWidth: 5
          });
          label(svg, `10 % les plus aisés : ${pct(p.parts[9])}`, cx, cy + R + 24, { anchor: "middle", size: compact ? 11.5 : 12.5, weight: 700, color: p.color });
          label(svg, `10 % les plus modestes : ${pct(p.parts[0])}`, cx, cy + R + 41, { anchor: "middle", size: small, weight: 700, color: muted });
          hitArea(svg, ctx, cx - R, cy - R, 2 * R, 2 * R,
            `${p.name} (${p.meta}) : les 10 % les plus aisés reçoivent ${pct(p.parts[9])} du total, les 10 % les plus modestes ${pct(p.parts[0])}`,
            () => tip(p.name, [p.meta, `10 % les plus aisés : ${pct(p.parts[9])} du total`, `10 % les plus modestes : ${pct(p.parts[0])}`, "À égalité parfaite : 10 % chacun"]));
        });
        const bottom = y + (compact ? 2 * panelH + 18 : panelH);
        const noteEnd = paragraph(svg, "Une part du gâteau par dixième de la population ; hachurée, celle des 10 % les plus aisés.", 18, bottom + 4, W - 36, { size: compact ? 10 : 11, lineHeight: 14, weight: 700, color: muted });
        const height = drawFooter(svg, rc, ctx, W, noteEnd + 2);
        finish(svg, ctx, W, height, panels.map((p) => `${p.name} (${p.meta}) : les 10 % les plus aisés reçoivent ${pct(p.parts[9])} du total`).join(" ; ") + ". À égalité parfaite, ils en recevraient 10 %.");
      }
    },

    // Outil 2 : cinq piles de francs par territoire, une par cinquième de la
    // population, en Nouvelle-Calédonie et en France métropolitaine, à la
    // même échelle. Le rapport S80/S20 compare la dernière pile à la première
    // et laisse de côté les trois du milieu, estompées. Côte à côte sur grand
    // écran, l'un sous l'autre sur petit écran.
    quintiles: {
      load: (root) => Promise.all([loadCsv(root.dataset.src), loadCsv(root.dataset.franceSrc)]),
      init() {
        return [];
      },
      draw(ctx, [rowsNc, rowsFrance]) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const d = ctx.root.dataset;
        const quintilesOf = (rows, annee) => d3.range(5).map((q) => {
          const pair = rows.filter((r) => r.annee === annee && Math.ceil(r.decile / 2) === q + 1);
          if (pair.length !== 2) throw new Error(`Cinquième incomplet : ${annee}, ${q + 1}`);
          return d3.sum(pair, (r) => r.part);
        });
        const annee = Number(d.annee) || 2019;
        const anneeFrance = Number(d.franceAnnee) || 2018;
        // Rapports du tableau de l'Isee ; les piles sont tirées de la courbe
        // de Lorenz (Isee) et des niveaux de vie moyens de chaque dixième
        // (Insee), à l'arrondi près.
        const panels = [
          { name: "Nouvelle-Calédonie", meta: `Isee, ${annee} · niveau de vie`, parts: quintilesOf(rowsNc, annee), rapport: Number(d.s80S20), color: colorNc },
          { name: "France métropolitaine", meta: `Insee, ${anneeFrance} · niveau de vie`, parts: quintilesOf(rowsFrance, anneeFrance), rapport: Number(d.france), color: colorOther }
        ];
        if (panels.some((p) => !Number.isFinite(p.rapport))) throw new Error("Rapport S80/S20 absent");
        const harmonise = Number(d.ncHarmonise);
        let y = drawHeader(svg, ctx, W, "Sur 100 francs de niveaux de vie, ce que reçoit chaque cinquième de la population, du plus modeste au plus aisé");
        const gap = compact ? 26 : 40;
        const panelW = compact ? W - 36 : (W - 36 - gap) / 2;
        const padding = compact ? 0.16 : 0.26;
        // Libellés plus étroits que les piles, sur trois lignes, quand la
        // place manque.
        const narrow = panelW / (5 - padding) < 90;
        const small = compact ? 10 : 11.5;
        const pileMax = compact ? 150 : 190;
        const personH = compact ? 24 : 32;
        const panelH = 64 + 30 + pileMax + 10 + personH + 14 + (narrow ? 3 : 2) * 13 + 8;
        panels.forEach((p, i) => {
          const px = 18 + (compact ? 0 : i * (panelW + gap));
          const py = y + (compact ? i * (panelH + gap) : 0);
          const key = `${ctx.key}-${i}`;
          label(svg, p.name, px, py + 6, { family: fontSketch, size: compact ? 17 : 19, weight: 700, color: p.color });
          label(svg, p.meta, px, py + 25, { size: small, weight: 700, color: muted });
          const band = d3.scaleBand().domain(d3.range(5)).range([px, px + panelW]).paddingInner(padding);
          const bw = band.bandwidth();
          const pileW = Math.min(bw * 0.72, 64);
          const centre = (q) => band(q) + bw / 2;
          const arrowY = py + 64;
          const top = arrowY + 30;
          const pileBase = top + pileMax;
          const yP = d3.scaleLinear().domain([0, 48]).range([pileBase, top]);
          const personBase = pileBase + 10 + personH;

          // Le rapport : flèche de la première pile à la dernière.
          const x0 = centre(0);
          const x1 = centre(4);
          roughLine(svg, rc, x0, arrowY, x1, arrowY, { stroke: ink, strokeWidth: 1.3, seed: `${key}-fleche` });
          svg.append("path").attr("d", `M${x1},${arrowY}l-8,-4v8z`).attr("fill", ink).attr("pointer-events", "none");
          [[x0, p.parts[0]], [x1, p.parts[4]]].forEach(([ax, part], j) => {
            roughLine(svg, rc, ax, arrowY + 4, ax, yP(part) - 24, { stroke: muted, strokeWidth: 0.8, dash: [3, 3], roughness: 0.4, seed: `${key}-repere-${j}` });
          });
          label(svg, `× ${ratio(p.rapport)} : rapport S80/S20`, (x0 + x1) / 2, arrowY - 12, {
            anchor: "middle", family: fontSketch, size: compact ? 16 : 18, weight: 700, color: p.color, halo: true
          });

          // Égalité : 20 francs par cinquième.
          roughLine(svg, rc, px, yP(20), px + panelW, yP(20), { stroke: colorEq, strokeWidth: 1.3, dash: [6, 5], roughness: 0.5, seed: `${key}-egalite` });
          label(svg, "égalité : 20 F", px + 2, yP(20) - 9, { size: small, weight: 700, color: colorEq, halo: true });

          // Les trois cinquièmes du milieu, que le rapport ne regarde pas.
          label(svg, "60 % du milieu : ignorés", centre(2), yP(d3.max(p.parts.slice(1, 4))) - 30, {
            anchor: "middle", size: small, weight: 700, color: muted, halo: true
          });

          const noms = narrow
            ? [["les 20 %", "plus", "modestes"], ["2e"], ["3e"], ["4e"], ["les 20 %", "plus", "aisés"]]
            : [["les 20 % les", "plus modestes"], ["2e", "cinquième"], ["3e", "cinquième"], ["4e", "cinquième"], ["les 20 % les", "plus aisés"]];
          p.parts.forEach((part, q) => {
            const cx = centre(q);
            const pileX = cx - pileW / 2;
            const extreme = q === 0 || q === 4;
            if (extreme) {
              roughRect(svg, rc, pileX, yP(part), pileW, pileBase - yP(part), {
                fill: p.color, stroke: hatchColor(p.color), strokeWidth: 1.1, hachureGap: compact ? 2.6 : 3, seed: `${key}-pile-${q}`
              });
              // Une pièce par franc.
              for (let f = 1; f < part - 0.2; f += 1) {
                svg.append("line").attr("x1", pileX + 1).attr("x2", pileX + pileW - 1).attr("y1", yP(f)).attr("y2", yP(f))
                  .attr("stroke", hatchColor(p.color)).attr("stroke-width", 0.8).attr("stroke-opacity", 0.6).attr("pointer-events", "none");
              }
            } else {
              roughRect(svg, rc, pileX, yP(part), pileW, pileBase - yP(part), {
                fill: "#e7e0d3", stroke: "#bdb4a6", strokeWidth: 0.8, hachureGap: 4, seed: `${key}-pile-${q}`
              }).attr("opacity", 0.75);
            }
            label(svg, `${share(part)} F`, cx, yP(part) - 10, {
              anchor: "middle", family: extreme ? fontSketch : fontText, size: extreme ? (compact ? 16 : 18) : (compact ? 10 : 11.5), weight: 700, color: extreme ? ink : muted, halo: true
            });
            // Deux silhouettes par pile : deux dixièmes de la population.
            [-1, 1].forEach((side, j) => {
              const sx = cx + side * Math.min(pileW * 0.24, 11);
              if (extreme) {
                roughSilhouette(svg, rc, sx, personBase, personH, { seed: `${key}-habitant-${q}-${j}`, strokeWidth: 1.2 });
              } else {
                drawSilhouette(svg, sx, personBase, personH, { stroke: "#bdb4a6", strokeWidth: 0.9 });
              }
            });
            noms[q].forEach((line, k) => {
              label(svg, line, cx, personBase + 14 + k * 13, { anchor: "middle", size: compact ? 9.5 : 10.5, weight: 700, color: extreme ? ink : muted });
            });
            const name = q === 0 ? "Les 20 % les plus modestes" : q === 4 ? "Les 20 % les plus aisés" : `${ordinal(q + 1)} cinquième de la population`;
            hitArea(svg, ctx, band(q), top - 10, bw, personBase - top + 40,
              `${p.name}, ${name.toLowerCase()} : ${share(part)} francs sur 100`,
              () => tip(`${p.name} · ${name}`, [p.meta, `${share(part)} francs sur 100`, extreme ? "Compté dans le rapport S80/S20" : "Ignoré par le rapport S80/S20"]));
          });
        });
        const bottom = y + (compact ? 2 * panelH + gap : panelH);
        const notes = ["Une pile par cinquième de la population, à la même échelle pour les deux territoires ; estompées, les trois du milieu."];
        if (Number.isFinite(harmonise)) notes.push(`Sans l’autoconsommation, comme pour l’Insee, le rapport calédonien est de ${ratio(harmonise)}.`);
        let noteY = bottom + 4;
        notes.forEach((text) => {
          noteY = paragraph(svg, text, 18, noteY, W - 36, { size: compact ? 10 : 11, lineHeight: 14, weight: 700, color: muted });
        });
        const height = drawFooter(svg, rc, ctx, W, noteY + 2);
        finish(svg, ctx, W, height, panels.map((p) => `${p.name} (${p.meta}) : ${p.parts.map((v, q) => `${ordinal(q + 1)} cinquième ${share(v)} F`).join(", ")} ; les 20 % les plus aisés reçoivent ${ratio(p.rapport)} fois plus que les 20 % les plus modestes`).join(". ") + ". Le rapport S80/S20 ignore les trois cinquièmes du milieu.");
      }
    },

    // Une règle graduée pour l'outil choisi, le rapport S80/S20 d'abord : les
    // pays de l'OCDE en points, la Nouvelle-Calédonie en rouge, de la
    // définition officielle (point plein) au niveau de vie monétaire (point
    // creux). Sont nommés quelques repères et tous les pays qui font plus que
    // la Nouvelle-Calédonie.
    regles: {
      load: (root) => Promise.all([loadCsv(root.dataset.src), loadCsv(root.dataset.ncSrc)]),
      init(ctx) {
        const depart = REGLES.some((r) => r.id === ctx.root.dataset.indicateur) ? ctx.root.dataset.indicateur : "s80_s20";
        ctx.state = { indicateur: depart };
        ctx.filenameBase = ctx.root.dataset.filename || ctx.key;
        return [controlGroup("Outil", buttonGroup("Outil comparé", REGLES.map((r) => [r.id, r.label]), depart, (value) => {
          ctx.state.indicateur = value;
          ctx.redraw();
        }))];
      },
      draw(ctx, [rows, ncRows]) {
        const { svg, width: W, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const regle = REGLES.find((r) => r.id === ctx.state.indicateur);
        const ncRow = ncRows.find((d) => d.indicateur === regle.id);
        if (!ncRow || !Number.isFinite(ncRow.nc_2019)) throw new Error(`Indicateur calédonien absent : ${regle.id}`);
        const nc = { low: ncRow.nc_2019, high: Number.isFinite(ncRow.nc_2019_harmonise) ? ncRow.nc_2019_harmonise : null };
        const items = rows.filter((d) => Number.isFinite(d[regle.id]));
        const bm = regle.id === "part_haut10";
        const year = (d) => (bm ? d.annee_bm : d.annee);
        // Titre, nom du fichier exporté et bouton suivent l'outil.
        ctx.title = `${regle.label} : la Nouvelle-Calédonie face aux pays de l’OCDE`;
        ctx.root.dataset.filename = `${ctx.filenameBase}-${regle.id.replace(/_/g, "-")}`;
        const download = ctx.root.querySelector(".habitat-sketch-download");
        if (download) download.setAttribute("aria-label", `Télécharger la figure « ${ctx.title} » en PNG`);
        let y = drawHeader(svg, ctx, W, bm
          ? `${items.length} pays de l’OCDE dont la Banque mondiale mesure le revenu, dernière enquête depuis 2010 ; Nouvelle-Calédonie en 2019`
          : `${items.length} pays suivis par l’OCDE, dernière année disponible depuis 2015 ; Nouvelle-Calédonie en 2019`);

        // La Nouvelle-Calédonie et son rang, en tête.
        const above = items.filter((d) => d[regle.id] > nc.low);
        const aboveH = nc.high == null ? null : items.filter((d) => d[regle.id] > nc.high).length;
        const ncText = nc.high == null ? regle.fmt(nc.low) : `${regle.fmt(nc.low)} à ${regle.fmt(nc.high)}`;
        const rank = `${above.length} pays sur ${items.length} font plus${aboveH == null ? "" : `, ${aboveH} face au niveau de vie monétaire`}`;
        label(svg, `Nouvelle-Calédonie : ${ncText}`, 18, y + 6, { family: fontSketch, size: compact ? 18 : 22, weight: 700, color: colorNc });
        y = paragraph(svg, rank, 18, y + (compact ? 26 : 30), W - 36, { size: compact ? 11 : 12.5, lineHeight: 15, weight: 700, color: muted }) + (compact ? 7 : 9);

        // Légende.
        const legendSize = compact ? 10.5 : 11.5;
        const r = compact ? 4.4 : 6;
        const legend = [
          { type: "dot", text: "un pays" },
          nc.high == null ? null : { type: "nc", text: compact ? "Nouvelle-Calédonie : officiel → monétaire" : "Nouvelle-Calédonie : définition officielle (plein) → niveau de vie monétaire, comme l’OCDE (creux)" },
          { type: "median", text: "médiane des pays" },
          { type: "out", text: "au-delà de la règle" }
        ].filter(Boolean);
        let lx = 18;
        legend.forEach((item, index) => {
          const width = (item.type === "nc" ? 36 : 22) + textW(item.text, legendSize);
          if (lx + width > W - 18 && lx > 18) {
            lx = 18;
            y += 18;
          }
          const cy = y + 2;
          if (item.type === "dot") {
            svg.append("circle").attr("cx", lx + 5).attr("cy", cy).attr("r", r * 0.8).attr("fill", colorDot).attr("stroke", paper).attr("stroke-width", 0.6);
          } else if (item.type === "nc") {
            svg.append("line").attr("x1", lx + 4).attr("x2", lx + 22).attr("y1", cy).attr("y2", cy).attr("stroke", colorNc).attr("stroke-width", 3);
            svg.append("circle").attr("cx", lx + 4).attr("cy", cy).attr("r", 4.5).attr("fill", colorNc).attr("stroke", paper);
            svg.append("circle").attr("cx", lx + 22).attr("cy", cy).attr("r", 4.5).attr("fill", paper).attr("stroke", colorNc).attr("stroke-width", 1.6);
          } else if (item.type === "median") {
            svg.append("line").attr("x1", lx + 5).attr("x2", lx + 5).attr("y1", cy - 7).attr("y2", cy + 7).attr("stroke", ink).attr("stroke-width", 1.6);
          } else {
            svg.append("path").attr("d", `M${lx},${cy - 5}l9,5l-9,5z`).attr("fill", colorDot);
          }
          label(svg, item.text, lx + (item.type === "nc" ? 30 : 15), cy, { size: legendSize, weight: 700 });
          lx += width + (index < legend.length - 1 ? 16 : 0);
        });
        y += 22;

        const left = compact ? 18 : 30;
        const right = W - (compact ? 24 : 36);
        const labelSize = compact ? 10.5 : 12;
        const laneH = compact ? 15 : 17;
        const [d0, d1] = regle.domain;
        const x = d3.scaleLinear().domain(regle.domain).range([left, right]);
        const clamp = (v) => x(Math.min(d1, Math.max(d0, v)));
        const median = d3.median(items, (d) => d[regle.id]);
        const placed = dodge(items, (d) => clamp(d[regle.id]), r, compact ? 0.6 : 1);
        const ys = d3.extent(placed, (p) => p.y);
        const bx0 = x(nc.low);
        const bx1 = nc.high == null ? bx0 : x(nc.high);
        const nommes = new Set([...REGLES_REPERES, ...above.map((d) => d.iso3)]);
        const labels = placed
          .filter((p) => nommes.has(p.d.iso3) || p.d[regle.id] > d1)
          .map((p) => ({ p, x: p.x, text: p.d[regle.id] > d1 ? `${countryName(p.d)} ${regle.fmt(p.d[regle.id])} →` : countryName(p.d) }));
        labels.push({ x: (bx0 + bx1) / 2, text: "Nouvelle-Calédonie", nc: true });
        const lanes = laneLabels(labels, labelSize, left, right);
        const swarmTop = y + lanes * laneH + 14;
        const center = swarmTop + r + 2 - ys[0];
        const axisY = center + ys[1] + r + 12;

        // Axe gradué.
        d3.range(d0, d1 + 1e-9, regle.step).forEach((t) => {
          svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", swarmTop - 4).attr("y2", axisY)
            .attr("stroke", gridColor).attr("stroke-dasharray", "2 4");
          const every = regle.labelEvery || regle.step;
          if (!compact || Math.abs((t - d0) / every - Math.round((t - d0) / every)) < 1e-6) {
            label(svg, regle.tick(t), x(t), axisY + 13, { anchor: "middle", size: compact ? 10 : 11, weight: 700, color: muted });
          }
        });
        svg.append("line").attr("x1", left).attr("x2", right).attr("y1", axisY).attr("y2", axisY).attr("stroke", "#bdb4a6");

        // Nouvelle-Calédonie : bande de la définition officielle au niveau
        // de vie monétaire.
        if (nc.high != null) {
          svg.append("rect").attr("x", bx0).attr("y", swarmTop - 4).attr("width", bx1 - bx0).attr("height", axisY - swarmTop + 4)
            .attr("fill", colorNc).attr("fill-opacity", 0.1).attr("pointer-events", "none");
          roughRect(svg, rc, bx0, center - 6, bx1 - bx0, 12, { fill: colorNc, stroke: colorNc, hachureGap: 2.4, fillWeight: 0.8, seed: `${ctx.key}-${regle.id}-bande` });
        }
        roughLine(svg, rc, bx0, swarmTop - 4, bx0, axisY, { stroke: colorNc, strokeWidth: 1, dash: [5, 4], roughness: 0.4, seed: `${ctx.key}-${regle.id}-nc` }).attr("opacity", 0.8);

        // Médiane des pays.
        svg.append("line").attr("x1", x(median)).attr("x2", x(median)).attr("y1", center + ys[0] - r - 6).attr("y2", center + ys[1] + r + 6)
          .attr("stroke", ink).attr("stroke-width", 1.8).attr("pointer-events", "none");
        label(svg, `médiane : ${regle.fmt(median)}`, x(median), axisY + 30, { anchor: "middle", size: compact ? 10.5 : 11.5, weight: 700 });

        // Pays.
        placed.forEach((p) => {
          const d = p.d;
          const value = d[regle.id];
          const isHi = nommes.has(d.iso3);
          const name = countryName(d);
          let node;
          if (value > d1) {
            node = svg.append("path").attr("d", `M${p.x - 4},${center + p.y - 7}l12,7l-12,7z`).attr("fill", isHi ? ink : colorDot);
          } else {
            node = svg.append("circle").attr("cx", p.x).attr("cy", center + p.y).attr("r", isHi ? r + 0.8 : r)
              .attr("fill", isHi ? ink : colorDot).attr("stroke", paper).attr("stroke-width", 0.6);
          }
          node.attr("class", `gini-dot${isHi ? " is-highlight" : ""}`);
          if (isHi || value > d1) {
            node.attr("tabindex", 0).attr("role", "img").attr("aria-label", `${name} : ${regle.label.toLowerCase()} ${regle.fmt(value)} (${year(d)})`);
          }
          bindTip(node, ctx, () => tip(name, [`${regle.label} : ${regle.fmt(value)}`, `${bm ? "Banque mondiale" : "OCDE"}, ${year(d)}`]));
        });

        // Repères calédoniens par-dessus les points.
        svg.append("circle").attr("cx", bx0).attr("cy", center).attr("r", r + 1.8)
          .attr("fill", colorNc).attr("stroke", paper).attr("stroke-width", 1.2).attr("pointer-events", "none");
        if (nc.high != null) {
          svg.append("circle").attr("cx", bx1).attr("cy", center).attr("r", r + 1.8)
            .attr("fill", paper).attr("stroke", colorNc).attr("stroke-width", 1.8).attr("pointer-events", "none");
        }
        const ncTip = nc.high == null
          ? [`${regle.fmt(nc.low)} (Isee, 2019)`]
          : [`${regle.fmt(nc.low)} : définition officielle (Isee, 2019)`, `${regle.fmt(nc.high)} : niveau de vie monétaire, sans autoconsommation`];
        hitArea(svg, ctx, bx0 - 10, center - 11, bx1 - bx0 + 20, 22,
          `Nouvelle-Calédonie, ${regle.label.toLowerCase()} : ${ncText} ; ${rank}`,
          () => tip("Nouvelle-Calédonie", [regle.label, ...ncTip, rank]));

        // Étiquettes.
        labels.forEach((item) => {
          const ly = swarmTop - 9 - item.lane * laneH;
          const targetY = item.nc ? center - r - 4 : center + item.p.y - r - 1.5;
          const targetX = item.nc ? (bx0 + bx1) / 2 : item.p.x;
          svg.append("line").attr("x1", targetX).attr("x2", item.lx).attr("y1", targetY).attr("y2", ly + 6)
            .attr("stroke", item.nc ? colorNc : muted).attr("stroke-width", 0.8).attr("pointer-events", "none");
          label(svg, item.text, item.lx, ly, { anchor: "middle", size: labelSize, weight: 700, color: item.nc ? colorNc : ink, halo: true });
        });
        label(svg, "plus à droite, plus inégalitaire →", right, axisY + 48, { anchor: "end", size: compact ? 10 : 11, weight: 700, color: muted });
        // Source de la part des 10 % : sous la flèche sur petit écran.
        const noteY = compact ? axisY + 66 : axisY + 48;
        const noteEnd = regle.note ? paragraph(svg, regle.note, 18, noteY, compact ? W - 36 : right - 18 - textW("plus à droite, plus inégalitaire →", 11) - 20, { size: compact ? 10 : 11, lineHeight: 14, weight: 700, color: muted }) + 2 : axisY + 64;
        const height = drawFooter(svg, rc, ctx, W, noteEnd);
        finish(svg, ctx, W, height, `${regle.label} : Nouvelle-Calédonie ${ncText} ; ${rank} ; médiane des pays ${regle.fmt(median)}. ${above.length ? `Font plus : ${above.map((d) => `${countryName(d)} (${regle.fmt(d[regle.id])})`).join(", ")}.` : ""} Le tableau qui suit la figure donne la valeur de chaque pays.`);
      }
    }
  };

  function mount(root) {
    const type = root.dataset.giniChart;
    const chart = charts[type];
    if (!chart) return;
    const ctx = {
      root,
      key: root.id || `gini-${type}`,
      title: root.dataset.title || "",
      source: root.dataset.source || ""
    };
    chart.load(root).then((data) => {
      root.querySelectorAll(".habitat-sketch-loading").forEach((node) => node.remove());
      const tools = document.createElement("div");
      tools.className = "habitat-sketch-tools";
      const controls = document.createElement("div");
      controls.className = "gini-controls";
      tools.appendChild(controls);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "habitat-sketch-download";
      button.textContent = "Télécharger en PNG";
      button.setAttribute("aria-label", `Télécharger la figure « ${ctx.title} » en PNG`);
      tools.appendChild(button);
      root.appendChild(tools);
      const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgNode.setAttribute("role", "img");
      root.appendChild(svgNode);
      const tooltip = document.createElement("div");
      tooltip.className = "habitat-tooltip gini-tooltip";
      tooltip.setAttribute("aria-hidden", "true");
      root.appendChild(tooltip);
      ctx.svg = d3.select(svgNode);
      ctx.tooltip = tooltip;
      ctx.redraw = () => {
        tooltip.style.opacity = 0;
        chart.draw(ctx, data);
      };
      chart.init(ctx, data).forEach((node) => controls.appendChild(node));

      let lastWidth = 0;
      const render = () => {
        const available = Math.floor(root.clientWidth - 8);
        if (!available || Math.abs(available - lastWidth) < 8) return;
        lastWidth = available;
        ctx.width = Math.max(300, Math.min(available, 1100));
        ctx.compact = ctx.width < 640;
        chart.draw(ctx, data);
      };
      render();
      button.addEventListener("click", () => downloadPng(svgNode, button, `${root.dataset.filename || ctx.key}-contours-nc.png`));
      if (window.ResizeObserver) {
        let timer;
        new ResizeObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(render, 150);
        }).observe(root);
      }
    }).catch((error) => {
      console.error(error);
      fail(root, "Les données de la figure n’ont pas pu être chargées. Les valeurs restent disponibles dans le texte et dans les fichiers de données.");
    });
  }

  figures.forEach(mount);

  // Liens « Afficher … sur le globe » : choisissent l'outil ou la région,
  // puis la page défile jusqu'au globe. Si le globe n'est pas encore
  // chargé, le choix est noté sur la figure et repris au chargement.
  document.querySelectorAll("a[data-globe-indicateur], a[data-globe-vue]").forEach((link) => {
    link.addEventListener("click", () => {
      const root = document.getElementById(String(link.getAttribute("href") || "").replace(/^#/, ""));
      if (!root) return;
      const { globeIndicateur: outil, globeVue: vue } = link.dataset;
      if (root.giniGlobe) {
        root.giniGlobe.show(outil, vue);
        return;
      }
      if (outil) root.dataset.indicateur = outil;
      if (vue) root.dataset.vue = vue;
    });
  });

  // ---------------------------------------------------------------------------
  // Tableau des pays
  // ---------------------------------------------------------------------------

  // Tableau : légende, en-têtes et lignes déjà triées ; `numeric` donne le
  // nombre de colonnes chiffrées, alignées à droite, en fin de ligne.
  function buildTable(className, captionText, headers, entries, numeric) {
    const table = document.createElement("table");
    table.className = className;
    const caption = document.createElement("caption");
    caption.textContent = captionText;
    table.appendChild(caption);
    const thead = table.createTHead().insertRow();
    headers.forEach((text, index) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      if (index >= headers.length - numeric) th.className = "is-num";
      thead.appendChild(th);
    });
    const body = table.createTBody();
    entries.forEach((entry) => {
      const tr = body.insertRow();
      if (entry.nc) tr.className = "gini-table-nc";
      entry.cells.forEach((value, index) => {
        const cell = index === 0 ? document.createElement("th") : document.createElement("td");
        if (index === 0) cell.scope = "row";
        if (index >= entry.cells.length - numeric) cell.className = "is-num";
        cell.textContent = value;
        tr.appendChild(cell);
      });
    });
    return table;
  }

  const fillTables = {
    monde(details) {
      return Promise.all([loadCsv(details.dataset.src), loadCsv(details.dataset.ncSrc)]).then(([rows, ncRows]) => {
        const nc = (id) => ncRows.find((d) => d.indicateur === id) || {};
        // Valeur officielle, et niveau de vie monétaire entre parenthèses.
        const ncCell = (id, fmt) => {
          const { nc_2019: low, nc_2019_harmonise: high } = nc(id);
          if (!Number.isFinite(low)) return "–";
          return Number.isFinite(high) ? `${fmt(low)} (${fmt(high)} sans autoconsommation)` : fmt(low);
        };
        const entries = rows.map((d) => ({
          gini: d.gini, pays: countryName(d),
          cells: [countryName(d), GROUPE_LABEL[d.groupe] || d.groupe, d.annee, mesureLabel(d.mesure), pct(d.d10), ratio(d.s80_s20), gini(d.gini)]
        }));
        if (Number.isFinite(nc("gini").nc_2019)) {
          entries.push({
            gini: nc("gini").nc_2019, pays: "Nouvelle-Calédonie", nc: true,
            cells: ["Nouvelle-Calédonie (Isee)", GROUPE_LABEL.HIC, 2019, "niveau de vie par unité de consommation",
              ncCell("part_haut10", pct), ncCell("s80_s20", ratio), ncCell("gini", gini)]
          });
        }
        entries.sort((a, b) => b.gini - a.gini || a.pays.localeCompare(b.pays, "fr"));
        return buildTable("gini-table",
          `Indice de Gini, part du total reçue par les 10 % les plus aisés et rapport S80/S20 (calculé à partir des parts des dixièmes), dernière enquête nationale depuis 2010 (${rows.length} pays, Banque mondiale), de l’indice le plus élevé au plus bas.`,
          ["Pays", "Groupe de revenu", "Enquête", "Mesure", "Part des 10 % les plus aisés", "S80/S20", "Indice de Gini"], entries, 3);
      });
    },
    ocde(details) {
      return Promise.all([loadCsv(details.dataset.src), loadCsv(details.dataset.ncSrc)]).then(([rows, ncRows]) => {
        const nc = (id) => ncRows.find((d) => d.indicateur === id) || {};
        const dash = (value, fmt) => (Number.isFinite(value) ? fmt(value) : "–");
        const entries = rows.map((d) => ({
          gini: d.gini, pays: countryName(d),
          cells: [countryName(d), d.annee, dash(d.part_haut10, pct), ratio(d.s80_s20), ratio(d.d9_d1), gini(d.gini), taux(d.pauvrete)]
        }));
        [["nc_2019", "Nouvelle-Calédonie (Isee, définition officielle)"], ["nc_2019_harmonise", "Nouvelle-Calédonie (Isee, niveau de vie monétaire)"]].forEach(([key, name]) => {
          entries.push({
            gini: nc("gini")[key], pays: name, nc: true,
            cells: [name, 2019, dash(nc("part_haut10")[key], pct), dash(nc("s80_s20")[key], ratio), dash(nc("d9_d1")[key], ratio), dash(nc("gini")[key], gini), dash(nc("pauvrete")[key], taux)]
          });
        });
        entries.sort((a, b) => b.gini - a.gini || a.pays.localeCompare(b.pays, "fr"));
        return buildTable("gini-table gini-table--ocde",
          `Quatre indicateurs de l’OCDE (dernière année depuis 2015, ${rows.length} pays) et part des 10 % les plus aisés de la Banque mondiale (revenu par personne), de l’indice de Gini le plus élevé au plus bas. Taux de pauvreté : seuil de 50 % du revenu médian.`,
          ["Pays", "Année", "Part des 10 % les plus aisés", "S80/S20", "D9/D1", "Indice de Gini", "Taux de pauvreté"], entries, 5);
      });
    }
  };

  function fillTable(details) {
    const container = details.querySelector("div") || details;
    const fill = fillTables[details.dataset.giniTable];
    if (!fill) return;
    fill(details).then((table) => container.replaceChildren(table)).catch((error) => {
      console.error(error);
    });
  }

  tables.forEach(fillTable);

  // ---------------------------------------------------------------------------
  // Croquis des fiches de la boîte à outils (viewBox 160 × 84) et du ménage
  // (300 × 124). Les valeurs, portées par les attributs data-*, figurent
  // aussi dans le texte voisin.
  // ---------------------------------------------------------------------------

  // Valeurs numériques d'un attribut (séparées par des virgules) ; une valeur
  // illisible arrête le croquis plutôt que de produire des tracés NaN.
  const numbers = (value) => {
    const list = String(value || "").split(",").map(Number);
    if (!list.length || !list.every(Number.isFinite)) throw new Error(`Valeurs illisibles : ${value}`);
    return list;
  };
  const number = (value) => numbers(value)[0];

  const iconSketches = {
    part_haut10(svg, rc, node) {
      const parts = numbers(node.dataset.parts);
      const x = d3.scaleBand().domain(d3.range(10)).range([10, 150]).padding(0.18);
      const y = d3.scaleLinear().domain([0, 30]).range([76, 8]);
      parts.forEach((part, k) => {
        const color = k === 9 ? colorNc : colorOther;
        roughRect(svg, rc, x(k), y(part), x.bandwidth(), y(0) - y(part), {
          fill: color, stroke: hatchColor(color), hachureGap: 2.2, strokeWidth: 0.7, seed: `icone-haut10-${k}`
        }).attr("opacity", k === 9 ? 1 : 0.5);
      });
      roughLine(svg, rc, 6, y(10), 154, y(10), { stroke: colorEq, strokeWidth: 1.1, dash: [4, 3], roughness: 0.4, seed: "icone-haut10-egalite" });
      svg.append("line").attr("x1", 6).attr("x2", 154).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#bdb4a6");
    },
    s80_s20(svg, rc, node) {
      const y = d3.scaleLinear().domain([0, 50]).range([76, 8]);
      [[number(node.dataset.bas), 22, colorOther], [number(node.dataset.haut), 104, colorNc]].forEach(([value, x0, color], i) => {
        roughRect(svg, rc, x0, y(value), 34, y(0) - y(value), { fill: color, stroke: hatchColor(color), hachureGap: 2.4, strokeWidth: 0.8, seed: `icone-s80-${i}` });
      });
      svg.append("line").attr("x1", 10).attr("x2", 150).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#bdb4a6");
      label(svg, `× ${ratio(number(node.dataset.ratio))}`, 80, 38, { anchor: "middle", family: fontSketch, size: 18, weight: 700, color: colorNc });
      roughLine(svg, rc, 62, 52, 98, 52, { stroke: ink, strokeWidth: 1, seed: "icone-s80-fleche" });
      svg.append("path").attr("d", "M100,52l-6,-3.5v7z").attr("fill", ink);
    },
    d9_d1(svg, rc, node) {
      const x = d3.scaleLinear().domain([0, 500000]).range([10, 150]);
      const d1 = x(number(node.dataset.d1));
      const d9 = x(number(node.dataset.d9));
      [62, 72].forEach((ry, i) => roughLine(svg, rc, 10, ry, 150, ry, { strokeWidth: 1.1, seed: `icone-d9-montant-${i}` }));
      [d1, d9].forEach((rx, i) => {
        roughLine(svg, rc, rx, 62, rx, 72, { strokeWidth: 1.8, seed: `icone-d9-barreau-${i}` });
        roughSilhouette(svg, rc, rx, 61, 26, { seed: `icone-d9-personne-${i}` });
      });
      roughLine(svg, rc, d1, 14, d9, 14, { stroke: ink, strokeWidth: 1, seed: "icone-d9-fleche" });
      svg.append("path").attr("d", `M${d9},14l-6,-3.5v7z`).attr("fill", ink);
      label(svg, `× ${ratio(number(node.dataset.ratio))}`, (d1 + d9) / 2, 26, { anchor: "middle", family: fontSketch, size: 16, weight: 700, color: colorNc, halo: true });
    },
    gini(svg, rc, node) {
      const { points } = lorenzOf(numbers(node.dataset.parts));
      const x = d3.scaleLinear().domain([0, 1]).range([46, 114]);
      const y = d3.scaleLinear().domain([0, 1]).range([78, 10]);
      const curve = points.map(([px, py]) => [x(px), y(py)]);
      svg.append("rect").attr("x", x(0)).attr("y", y(1)).attr("width", x(1) - x(0)).attr("height", y(0) - y(1)).attr("fill", "none").attr("stroke", "#bdb4a6");
      roughPolygon(svg, rc, curve, { fill: colorNc, hachureGap: 3, fillWeight: 0.8, seed: "icone-gini-aire" });
      roughLine(svg, rc, x(0), y(0), x(1), y(1), { stroke: colorEq, strokeWidth: 1.1, dash: [4, 3], roughness: 0.4, seed: "icone-gini-diagonale" });
      roughCurve(svg, rc, curve, { strokeWidth: 1.3, seed: "icone-gini-courbe" });
    },
    pauvrete(svg, rc, node) {
      const filled = Math.round(number(node.dataset.taux));
      d3.range(100).forEach((n) => {
        svg.append("circle").attr("cx", 46 + (n % 10) * 7.6).attr("cy", 8 + Math.floor(n / 10) * 7.6).attr("r", 2.7)
          .attr("fill", n < filled ? colorNc : paper).attr("stroke", n < filled ? hatchColor(colorNc) : "#c9bfae").attr("stroke-width", 0.7);
      });
    },
    menage(svg, rc) {
      const people = [
        { x: 32, h: 68, uc: "1", who: "1er adulte" },
        { x: 92, h: 64, uc: "0,5", who: "2e adulte" },
        { x: 150, h: 44, uc: "0,3", who: "enfant" },
        { x: 200, h: 40, uc: "0,3", who: "enfant" }
      ];
      people.forEach((p, i) => {
        roughSilhouette(svg, rc, p.x, 84, p.h, { seed: `menage-${i}`, fill: i < 2 ? colorOther : colorNc, hachureGap: 3 });
        label(svg, p.uc, p.x, 100, { anchor: "middle", family: fontSketch, size: 17, weight: 700 });
        label(svg, p.who, p.x, 116, { anchor: "middle", size: 9.5, weight: 700, color: muted });
      });
      [62, 121, 175].forEach((px) => label(svg, "+", px, 100, { anchor: "middle", family: fontSketch, size: 17, weight: 700, color: muted }));
      label(svg, "= 2,1", 290, 92, { anchor: "end", family: fontSketch, size: 26, weight: 700, color: colorNc });
      label(svg, "unités de", 290, 108, { anchor: "end", size: 9.5, weight: 700, color: muted });
      label(svg, "consommation", 290, 120, { anchor: "end", size: 9.5, weight: 700, color: muted });
    }
  };

  icons.forEach((node) => {
    const draw = iconSketches[node.dataset.giniIcon];
    const svg = d3.select(node);
    svg.selectAll("*").remove();
    try {
      if (!draw) throw new Error(`Croquis inconnu : ${node.dataset.giniIcon}`);
      draw(svg, rough.svg(node), node);
    } catch (error) {
      console.error(error);
      svg.selectAll("*").remove();
    }
  });

  // ---------------------------------------------------------------------------
  // Croquis du résumé « En bref » (viewBox 420 × 240)
  // ---------------------------------------------------------------------------

  function signature(svg) {
    label(svg, "contours.nc", 414, 233, { anchor: "end", family: fontSketch, size: 11, weight: 700, color: muted });
  }

  function caption(svg, text) {
    label(svg, text, 6, 233, { size: 8.5, weight: 700, color: muted });
  }

  // Barres horizontales : libellés à gauche, valeurs nettes en bout de barre.
  function briefBars(svg, rc, items, { key, max, left = 150, top = 16, bottom = 210 }) {
    const x = d3.scaleLinear().domain([0, max]).range([left, 372]);
    const step = (bottom - top) / items.length;
    const barH = Math.min(24, step * 0.58);
    items.forEach((item, index) => {
      const cy = top + step * index + step / 2;
      const color = item.nc ? colorNc : colorOther;
      label(svg, item.label, left - 8, cy, { anchor: "end", size: 10.5, weight: 700, color: item.nc ? colorNc : ink });
      roughRect(svg, rc, x(0), cy - barH / 2, x(item.value) - x(0), barH, {
        fill: color, stroke: hatchColor(color), strokeWidth: item.nc ? 1.1 : 0.8, hachureGap: 2.8, seed: `${key}-${index}`
      });
      label(svg, gini(item.value), x(item.value) + 6, cy, { size: 11, weight: 700, color: item.nc ? colorNc : ink });
    });
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top).attr("y2", bottom).attr("stroke", "#bdb4a6");
  }

  const sketches = {
    globe(svg, rc, node, data) {
      const features = rewindFeatures(data.geo);
      const byIso = new Map(data.monde.map((d) => [d.iso3, d]));
      const withShape = new Set(features.map((f) => f.properties.iso3));
      const projection = d3.geoOrthographic().scale(100).translate([118, 116]).rotate([25, -8, 0]).clipAngle(90).precision(0.6);
      const path = d3.geoPath(projection);
      const defs = svg.append("defs");
      const pattern = defs.append("pattern").attr("id", "brief-globe-sans-donnee").attr("patternUnits", "userSpaceOnUse")
        .attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)");
      pattern.append("rect").attr("width", 5).attr("height", 5).attr("fill", noDataColor);
      pattern.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5).attr("stroke", noDataStroke).attr("stroke-width", 0.8);
      svg.append("path").datum({ type: "Sphere" }).attr("d", path).attr("fill", oceanColor);
      svg.append("path").datum(d3.geoGraticule10()).attr("d", path).attr("fill", "none").attr("stroke", "#cfc6b6").attr("stroke-width", 0.4).attr("stroke-dasharray", "2 3");
      features.forEach((feature) => {
        const row = byIso.get(feature.properties.iso3);
        svg.append("path").datum(feature).attr("d", path)
          .attr("fill", row ? globeColor(GLOBE_GINI, row.gini) : feature.properties.iso3 === "ATA" ? landColor : "url(#brief-globe-sans-donnee)")
          .attr("stroke", paper).attr("stroke-width", 0.4);
      });
      const centre = [-25, 8];
      data.monde.filter((d) => !withShape.has(d.iso3) && Number.isFinite(d.lon) && d3.geoDistance([d.lon, d.lat], centre) < Math.PI / 2 - 0.05)
        .forEach((d) => {
          const [px, py] = projection([d.lon, d.lat]);
          svg.append("circle").attr("cx", px).attr("cy", py).attr("r", 2.6).attr("fill", globeColor(GLOBE_GINI, d.gini)).attr("stroke", ink).attr("stroke-width", 0.7);
        });
      svg.append("circle").attr("cx", 118).attr("cy", 116).attr("r", 100).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 0.9);
      appendRough(svg, rc.circle(118, 116, 205, { stroke: ink, strokeWidth: 0.8, roughness: 0.7, curveFitting: 0.995, seed: seed("brief-globe-sphere") }), 0.55);
      // Échelle des couleurs, et place de la Nouvelle-Calédonie (absente de
      // cette face du globe) sur cette échelle.
      label(svg, "Indice de Gini", 236, 30, { family: fontSketch, size: 15, weight: 700 });
      const lx0 = 236;
      const lx1 = 408;
      const ly = 124;
      const cw = (lx1 - lx0) / GLOBE_COULEURS.length;
      GLOBE_COULEURS.forEach((color, i) => {
        svg.append("rect").attr("x", lx0 + i * cw).attr("y", ly).attr("width", cw).attr("height", 14).attr("fill", color);
      });
      GLOBE_GINI.seuils.forEach((t, i) => {
        const tx = lx0 + (i + 1) * cw;
        svg.append("line").attr("x1", tx).attr("x2", tx).attr("y1", ly + 14).attr("y2", ly + 18).attr("stroke", muted);
        if (i % 2 === 0) label(svg, gini(t), tx, ly + 27, { anchor: "middle", size: 9.5, weight: 700, color: muted });
      });
      label(svg, "← égalitaire", lx0, ly + 44, { size: 9, weight: 700, color: muted });
      label(svg, "inégalitaire →", lx1, ly + 44, { anchor: "end", size: 9, weight: 700, color: muted });
      const bounds = [GLOBE_GINI.bornes[0], ...GLOBE_GINI.seuils, GLOBE_GINI.bornes[1]];
      const k = globeClass(GLOBE_GINI, data.gini);
      const mx = lx0 + cw * (k + (data.gini - bounds[k]) / (bounds[k + 1] - bounds[k]));
      svg.append("path").attr("d", `M${mx},${ly - 2}l-6,-9h12z`).attr("fill", colorNc);
      label(svg, gini(data.gini), mx, ly - 22, { anchor: "middle", family: fontSketch, size: 18, weight: 700, color: colorNc, halo: true });
      label(svg, "Nouvelle-Calédonie", mx, ly - 44, { anchor: "middle", size: 11, weight: 700, color: colorNc, halo: true });
      svg.append("rect").attr("x", lx0).attr("y", 188).attr("width", 18).attr("height", 12)
        .attr("fill", "url(#brief-globe-sans-donnee)").attr("stroke", noDataStroke).attr("stroke-width", 0.5);
      label(svg, "pas d’indice", lx0 + 24, 194, { size: 9.5, weight: 700, color: muted });
      caption(svg, "Dernière enquête depuis 2010 · Banque mondiale, Isee");
      signature(svg);
    },
    // Les cinq outils, Nouvelle-Calédonie et France : sur chaque ligne, la
    // plus grande des deux valeurs occupe toute la longueur.
    outils(svg, rc, node, data) {
      const nc = (id) => {
        const row = data.nc.find((d) => d.indicateur === id);
        if (!row) throw new Error(`Indicateur calédonien absent : ${id}`);
        return row;
      };
      const france = data.monde.find((d) => d.iso3 === "FRA");
      if (!france) throw new Error("Pays absent des données : FRA");
      // Sous le nom de l'outil, une glose en clair (`note`).
      const rows = [
        { name: ["Part des 10 %", "les plus aisés"], fmt: pct, nc: nc("part_haut10").nc_2019, fr: france.d10 },
        { name: ["Rapport S80/S20"], note: "20 % aisés ÷ 20 % modestes", fmt: ratio, nc: nc("s80_s20").nc_2019, fr: nc("s80_s20").france_2018 },
        { name: ["Rapport D9/D1"], note: "haut ÷ bas de l’échelle", fmt: ratio, nc: nc("d9_d1").nc_2019, fr: nc("d9_d1").france_2018 },
        { name: ["Indice de Gini"], note: "de 0 (égalité) à 1", fmt: gini, nc: nc("gini").nc_2019, fr: nc("gini").france_2018 },
        { name: ["Taux de pauvreté"], fmt: taux, nc: nc("pauvrete").nc_2019, fr: data.pauvreteFrance }
      ];
      if (rows.some((r) => !Number.isFinite(r.nc) || !Number.isFinite(r.fr))) throw new Error("Valeurs des cinq outils absentes");
      [[colorNc, "Nouvelle-Calédonie, 2019", 142], [colorOther, "France", 296]].forEach(([color, text, x0], i) => {
        roughRect(svg, rc, x0, 9, 14, 10, { fill: color, stroke: hatchColor(color), hachureGap: 2.2, strokeWidth: 0.8, seed: `brief-outils-cle-${i}` });
        label(svg, text, x0 + 20, 14, { size: 10, weight: 700, color });
      });
      rows.forEach((r, i) => {
        const cy = 46 + i * 38;
        const lines = r.note ? [...r.name, r.note] : r.name;
        lines.forEach((line, k) => {
          const note = r.note && k === lines.length - 1;
          label(svg, line, 8, cy + (k - (lines.length - 1) / 2) * 12, { size: note ? 8.5 : 10.5, weight: 700, color: note ? muted : ink });
        });
        const x = d3.scaleLinear().domain([0, Math.max(r.nc, r.fr)]).range([142, 336]);
        roughRect(svg, rc, x(0), cy - 12, x(r.nc) - x(0), 11, { fill: colorNc, stroke: hatchColor(colorNc), hachureGap: 2.4, strokeWidth: 0.9, seed: `brief-outils-nc-${i}` });
        roughRect(svg, rc, x(0), cy + 1, x(r.fr) - x(0), 11, { fill: colorOther, stroke: hatchColor(colorOther), hachureGap: 2.4, strokeWidth: 0.8, seed: `brief-outils-fr-${i}` });
        label(svg, r.fmt(r.nc), x(r.nc) + 6, cy - 6.5, { size: 11, weight: 700, color: colorNc });
        label(svg, r.fmt(r.fr), x(r.fr) + 6, cy + 6.5, { size: 10, weight: 700, color: colorOther });
      });
      svg.append("line").attr("x1", 142).attr("x2", 142).attr("y1", 28).attr("y2", 216).attr("stroke", "#bdb4a6");
      caption(svg, "France : Insee 2018, Banque mondiale et OCDE 2023 · Isee");
      signature(svg);
    },
    // Part du total des niveaux de vie reçue par chaque cinquième de la
    // population, Nouvelle-Calédonie et France métropolitaine côte à côte.
    quintiles(svg, rc, node, data) {
      const quintilesOf = (rows, annee) => d3.range(5).map((q) => {
        const pair = rows.filter((d) => d.annee === annee && Math.ceil(d.decile / 2) === q + 1);
        if (pair.length !== 2) throw new Error(`Cinquième incomplet : ${annee}, ${q + 1}`);
        return d3.sum(pair, (d) => d.part);
      });
      const series = [
        { parts: quintilesOf(data.deciles, 2019), color: colorNc, text: "Nouvelle-Calédonie, 2019", x0: 40 },
        { parts: quintilesOf(data.decilesFrance, 2018), color: colorOther, text: "France métropolitaine, 2018", x0: 220 }
      ];
      const x = d3.scaleBand().domain(d3.range(5)).range([40, 400]).paddingInner(0.16);
      const inner = d3.scaleBand().domain([0, 1]).range([0, x.bandwidth()]).paddingInner(0.08);
      const y = d3.scaleLinear().domain([0, 50]).range([196, 40]);
      series.forEach((s, i) => {
        roughRect(svg, rc, s.x0, 9, 14, 10, { fill: s.color, stroke: hatchColor(s.color), hachureGap: 2.2, strokeWidth: 0.8, seed: `brief-quintiles-cle-${i}` });
        label(svg, s.text, s.x0 + 20, 14, { size: 10, weight: 700, color: s.color });
        s.parts.forEach((part, q) => {
          const bx = x(q) + inner(i);
          roughRect(svg, rc, bx, y(part), inner.bandwidth(), y(0) - y(part), {
            fill: s.color, stroke: hatchColor(s.color), strokeWidth: i ? 0.8 : 1, hachureGap: 2.6, seed: `brief-quintile-${i}-${q}`
          });
          label(svg, pct(part), bx + inner.bandwidth() / 2, y(part) - 8, { anchor: "middle", size: 9.5, weight: 700, color: i ? colorOther : ink, halo: true });
        });
      });
      svg.append("line").attr("x1", 34).attr("x2", 404).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#bdb4a6");
      roughLine(svg, rc, 34, y(20), 404, y(20), { stroke: colorEq, strokeWidth: 1.3, dash: [6, 5], roughness: 0.5, seed: "brief-quintiles-egalite" });
      label(svg, "égalité : 20 %", 36, y(20) - 9, { size: 9.5, weight: 700, color: colorEq, halo: true });
      label(svg, "20 % les plus modestes", x(0), y(0) + 13, { size: 9.5, weight: 700, color: muted });
      label(svg, "20 % les plus aisés", x(4) + x.bandwidth(), y(0) + 13, { anchor: "end", size: 9.5, weight: 700, color: muted });
      caption(svg, "Part du total des niveaux de vie · Isee 2019, Insee 2018");
      signature(svg);
    },
    "outre-mer"(svg, rc, node, data) {
      const items = data.outreMer.filter((d) => Number.isFinite(d.gini)).sort((a, b) => b.gini - a.gini).map((d) => ({
        label: d.territoire, value: d.gini, nc: d.territoire === "Nouvelle-Calédonie"
      }));
      briefBars(svg, rc, items, { key: "brief-om", max: 0.5, left: 136 });
      caption(svg, "Définitions rapprochées par l’Isee · 2017-2019");
      signature(svg);
    },
    partage(svg, rc, node, data) {
      const parts = d3.range(1, 11).map((k) => {
        const row = data.deciles.find((d) => d.annee === 2019 && d.decile === k);
        if (!row) throw new Error(`Décile absent : ${k}`);
        return row.part;
      });
      const band = d3.scaleBand().domain(d3.range(10)).range([14, 406]).paddingInner(0.18);
      const bw = band.bandwidth();
      const pileW = bw * 0.64;
      const y = d3.scaleLinear().domain([0, 30]).range([150, 22]);
      roughLine(svg, rc, 12, y(10), 408, y(10), { stroke: colorEq, strokeWidth: 1.2, dash: [5, 4], roughness: 0.5, seed: "brief-partage-egalite" });
      label(svg, "égalité : 10 F chacun", 14, y(10) - 9, { size: 9, weight: 700, color: colorEq, halo: true });
      parts.forEach((part, k) => {
        const cx = band(k) + bw / 2;
        const px = cx - pileW / 2;
        roughRect(svg, rc, px, y(part), pileW, y(0) - y(part), { fill: colorNc, stroke: hatchColor(colorNc), hachureGap: 2.4, seed: `brief-partage-pile-${k}` });
        for (let f = 1; f < part - 0.2; f += 1) {
          svg.append("line").attr("x1", px + 1).attr("x2", px + pileW - 1).attr("y1", y(f)).attr("y2", y(f))
            .attr("stroke", hatchColor(colorNc)).attr("stroke-width", 0.7).attr("stroke-opacity", 0.6);
        }
        label(svg, `${share(part)} F`, cx, y(part) - 8, { anchor: "middle", family: k === 9 || k === 0 ? fontSketch : fontText, size: k === 9 || k === 0 ? 14 : 9.5, weight: 700, halo: true });
        roughSilhouette(svg, rc, cx, 196, 36, { seed: `brief-partage-habitant-${k}` });
      });
      label(svg, "plus modestes", 14, 210, { size: 8.5, weight: 700, color: muted });
      label(svg, "plus aisés", 406, 210, { anchor: "end", size: 8.5, weight: 700, color: muted });
      caption(svg, "Sur 100 francs de niveaux de vie, 2019 · Isee");
      signature(svg);
    },
    pauvrete(svg, rc, node, data) {
      const cell = 18;
      const filled = Math.round(data.pauvrete);
      d3.range(100).forEach((n) => {
        const cx = 22 + (n % 10) * cell + cell / 2;
        const base = 18 + Math.floor(n / 10) * cell + cell * 0.92;
        drawSilhouette(svg, cx, base, cell * 0.84, {
          fill: n < filled ? colorNc : paper, stroke: n < filled ? hatchColor(colorNc) : "#c9bfae", strokeWidth: 0.8
        });
      });
      label(svg, taux(data.pauvrete), 226, 62, { family: fontSketch, size: 40, weight: 700, color: colorNc });
      label(svg, "sous le seuil de pauvreté", 228, 94, { size: 11, weight: 700 });
      label(svg, "Nouvelle-Calédonie, 2019", 228, 110, { size: 9.5, weight: 700, color: muted });
      label(svg, `France : ${taux(data.pauvreteFrance)}`, 228, 150, { family: fontSketch, size: 19, weight: 700, color: colorOther });
      label(svg, `OCDE, ${data.franceAnnee}, même seuil`, 228, 170, { size: 9.5, weight: 700, color: muted });
      caption(svg, "Une silhouette pour 1 % · Isee, OCDE");
      signature(svg);
    },
    regles(svg, rc, node, data) {
      // Une seule règle, celle du rapport S80/S20, comme à la fin de l'article.
      const regle = REGLES.find((d) => d.id === "s80_s20");
      const row = data.nc.find((d) => d.indicateur === regle.id);
      if (!row) throw new Error(`Indicateur calédonien absent : ${regle.id}`);
      const items = data.ocde.filter((d) => Number.isFinite(d[regle.id]));
      const [d0, d1] = regle.domain;
      const x = d3.scaleLinear().domain(regle.domain).range([24, 392]);
      const cy = 138;
      const axisY = 172;
      const median = d3.median(items, (d) => d[regle.id]);
      label(svg, regle.label, 8, 20, { family: fontSketch, size: 16, weight: 700 });
      label(svg, "20 % les plus aisés ÷ 20 % les plus modestes", 8, 38, { size: 9.5, weight: 700, color: muted });
      // Nouvelle-Calédonie : de la définition officielle au niveau de vie
      // monétaire.
      const bx0 = x(row.nc_2019);
      const bx1 = x(row.nc_2019_harmonise);
      roughRect(svg, rc, bx0, cy - 22, bx1 - bx0, 44, { fill: colorNc, stroke: "none", hachureGap: 2.8, fillWeight: 0.8, seed: "brief-regles-bande" }).attr("opacity", 0.55);
      label(svg, "Nouvelle-Calédonie", (bx0 + bx1) / 2, 62, { anchor: "middle", family: fontSketch, size: 15, weight: 700, color: colorNc });
      label(svg, `${regle.fmt(row.nc_2019)} à ${regle.fmt(row.nc_2019_harmonise)}`, (bx0 + bx1) / 2, 82, { anchor: "middle", size: 11, weight: 700, color: colorNc });
      svg.append("line").attr("x1", (bx0 + bx1) / 2).attr("x2", (bx0 + bx1) / 2).attr("y1", 90).attr("y2", cy - 24).attr("stroke", colorNc).attr("stroke-width", 0.9);
      // Axe, médiane et pays.
      svg.append("line").attr("x1", x(d0)).attr("x2", x(d1)).attr("y1", axisY).attr("y2", axisY).attr("stroke", "#bdb4a6");
      d3.range(d0, d1 + 1e-9, regle.step).forEach((t) => {
        svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", axisY).attr("y2", axisY + 4).attr("stroke", "#bdb4a6");
        label(svg, regle.tick(t), x(t), axisY + 14, { anchor: "middle", size: 9.5, weight: 700, color: muted });
      });
      const placed = dodge(items, (d) => x(Math.min(d1, d[regle.id])), 3.4, 0.5);
      placed.forEach((p) => {
        const py = cy + Math.max(-26, Math.min(26, p.y));
        const france = p.d.iso3 === "FRA";
        if (p.d[regle.id] > d1) {
          svg.append("path").attr("d", `M${p.x - 3},${py - 6}l10,6l-10,6z`).attr("fill", colorDot);
        } else {
          svg.append("circle").attr("cx", p.x).attr("cy", py).attr("r", france ? 4.4 : 3.4).attr("fill", france ? ink : colorDot).attr("stroke", paper).attr("stroke-width", 0.5);
        }
        if (france) {
          svg.append("line").attr("x1", p.x).attr("x2", p.x).attr("y1", py - 5).attr("y2", 92).attr("stroke", muted).attr("stroke-width", 0.8);
          label(svg, `France : ${regle.fmt(p.d[regle.id])}`, p.x, 84, { anchor: "middle", size: 11, weight: 700, halo: true });
        }
      });
      svg.append("line").attr("x1", x(median)).attr("x2", x(median)).attr("y1", cy - 30).attr("y2", cy + 30).attr("stroke", ink).attr("stroke-width", 1.6);
      label(svg, `médiane : ${regle.fmt(median)}`, x(median), axisY + 30, { anchor: "middle", size: 10, weight: 700 });
      svg.append("circle").attr("cx", bx0).attr("cy", cy).attr("r", 5).attr("fill", colorNc).attr("stroke", paper).attr("stroke-width", 1);
      svg.append("circle").attr("cx", bx1).attr("cy", cy).attr("r", 5).attr("fill", paper).attr("stroke", colorNc).attr("stroke-width", 1.8);
      caption(svg, `${items.length} pays de l’OCDE, dernière année · OCDE, Isee`);
      signature(svg);
    }
  };

  function drawBrief(root, container) {
    return Promise.all([
      loadCsv(root.dataset.decilesSrc),
      loadCsv(root.dataset.mondeSrc),
      loadCsv(root.dataset.outreMerSrc),
      loadJson(root.dataset.geoSrc),
      loadCsv(root.dataset.ocdeSrc),
      loadCsv(root.dataset.indicateursSrc),
      loadCsv(root.dataset.decilesFranceSrc)
    ]).then(([deciles, monde, outreMer, geo, ocde, indicateurs, decilesFrance]) => {
      // Valeurs portées par les attributs : une valeur illisible arrête les
      // croquis plutôt que de produire des tracés NaN.
      const data = {
        deciles, decilesFrance, monde, outreMer, geo, ocde,
        nc: indicateurs,
        gini: number(root.dataset.giniNc),
        pauvrete: number(root.dataset.pauvrete), pauvreteFrance: number(root.dataset.pauvreteFrance), franceAnnee: root.dataset.franceAnnee
      };
      container.querySelectorAll("svg[data-brief-sketch]").forEach((node) => {
        const draw = sketches[node.dataset.briefSketch];
        const svg = d3.select(node);
        svg.selectAll("*").remove();
        try {
          if (!draw) throw new Error(`Croquis inconnu : ${node.dataset.briefSketch}`);
          draw(svg, rough.svg(node), node, data);
        } catch (error) {
          console.error(error);
          svg.selectAll("*").remove();
          label(svg, "Croquis indisponible", 210, 120, { anchor: "middle", size: 11, weight: 700, color: muted });
        }
      });
    }).catch((error) => {
      console.error(error);
      container.querySelectorAll("svg[data-brief-sketch]").forEach((node) => {
        d3.select(node).selectAll("*").remove();
        label(d3.select(node), "Croquis indisponible", 210, 120, { anchor: "middle", size: 11, weight: 700, color: muted });
      });
    });
  }

  // Le résumé peut déjà être ouvert par un lien direct (?lecture=en-bref)
  // avant le chargement de ce script.
  briefs.forEach((root) => {
    let drawn = false;
    const start = (container) => {
      if (drawn) return;
      drawn = true;
      drawBrief(root, container);
    };
    root.addEventListener("contours-brief:open", (event) => start(event.detail?.dialog || root));
    if (root.contoursBrief?.isOpen()) start(root.contoursBrief.dialog);
  });
})();
