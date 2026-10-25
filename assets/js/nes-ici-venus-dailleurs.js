(() => {
  "use strict";

  // Figures et croquis de l'article « Nés ici ou en métropole ».
  //
  // Comparaison principale : personnes nées en Nouvelle-Calédonie et personnes
  // nées en métropole ou dans un DOM ; les autres lieux de naissance servent de
  // repères.
  //
  // - Figures : éléments [data-origines-chart] dont les attributs data-*
  //   portent la source des données, le titre et le pied de figure. Les
  //   figures ciblées (« ecarts », « diplomes », « generations », « arrivees »,
  //   « diplome-egal », « logement ») sont fixes ; « generations-installation »,
  //   « carte » et « profils » ont des contrôles.
  //   Les données sont les fichiers produits par
  //   posts/nes-ici-ou-ailleurs-inegalites-nouvelle-caledonie/analysis.R.
  // - Croquis du résumé « En bref » : svg[data-brief-sketch] dans la section
  //   [data-origines-brief], dessinés à la première ouverture du résumé
  //   (événement « contours-brief:open »), avec les mêmes couleurs, classes et
  //   graines que les figures.
  const figures = Array.from(document.querySelectorAll("[data-origines-chart]"));
  const briefs = Array.from(document.querySelectorAll("[data-origines-brief]"));
  if (!figures.length && !briefs.length) return;
  if (!window.d3 || !window.rough) {
    figures.forEach((root) => fail(root, "Le graphique n’a pas pu être chargé (bibliothèques manquantes). Les valeurs restent disponibles dans le tableau qui suit."));
    return;
  }

  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const frame = "#d5ccbe";
  const gridColor = "#e7e0d3";
  const noData = "#d6d0c4";
  const fontText = "Atkinson Hyperlegible, sans-serif";
  const fontSketch = "Cabin Sketch, sans-serif";

  const NC = "Nés en Nouvelle-Calédonie";
  // Clé des données pour les personnes nées en métropole ou dans un DOM.
  const METRO = "Métropole ou DOM";
  const ENSEMBLE = "Ensemble des 25-64 ans";

  // Couleurs constantes dans toute la page : vert pour les natifs, bleu pour
  // les personnes nées en métropole (comme dans la carte et parmi les lieux de
  // naissance), teintes de bleu de plus en plus claires pour les arrivées
  // anciennes. La forme double toujours la couleur.
  const colorNc = "#2f6b45";
  const colorMetro = "#2f5673";
  const DURATIONS = [
    { groupe: "Arrivés en 2015-2019", label: "arrivés en 2015-2019", court: "2015-2019", color: "#1c3a52", shape: "circle" },
    { groupe: "Arrivés en 2005-2014", label: "arrivés en 2005-2014", court: "2005-2014", color: "#2f5673", shape: "square" },
    { groupe: "Arrivés en 1990-2004", label: "arrivés en 1990-2004", court: "1990-2004", color: "#5f84a5", shape: "diamond" },
    { groupe: "Arrivés avant 1990", label: "arrivés avant 1990", court: "avant 1990", color: "#94b0c9", shape: "triangle" },
    { groupe: "Année non déclarée", label: "année d’arrivée non déclarée", court: "non déclarée", color: "#8f877b", shape: "ring" }
  ];
  const ORIGINS = [
    { groupe: "Métropole ou DOM", label: "Nés en métropole ou dans un DOM", court: "Métropole ou DOM", color: "#2f5673" },
    { groupe: "Étranger", label: "Nés à l’étranger", court: "Étranger", color: "#887c3b" },
    { groupe: "Polynésie française", label: "Nés en Polynésie française", court: "Polynésie française", color: "#c98d63" },
    { groupe: "Wallis-et-Futuna", label: "Nés à Wallis-et-Futuna", court: "Wallis-et-Futuna", color: "#a8633f" }
  ];
  // Âge à l'arrivée : une seule teinte, celle des personnes nées en métropole,
  // pour ne pas évoquer les périodes d'installation ; position et en-tête les
  // distinguent.
  const AGE_ARRIVAL = [
    { groupe: "Arrivés avant 16 ans", label: "arrivés avant 16 ans", court: "avant 16 ans", lignes: ["avant", "16 ans"] },
    { groupe: "Arrivés à 16-24 ans", label: "arrivés à 16-24 ans", court: "à 16-24 ans", lignes: ["à 16-24", "ans"] },
    { groupe: "Arrivés à 25 ans ou plus", label: "arrivés à 25 ans ou plus", court: "à 25 ans ou plus", lignes: ["à 25 ans", "ou plus"] }
  ];
  const SMALL = 200;
  const linkColor = "#a39b8f";
  const NC_POINT = { color: colorNc, shape: "circle", label: "Nés en Nouvelle-Calédonie" };
  const METRO_POINT = { color: colorMetro, shape: "square", label: "Nés en métropole ou dans un DOM" };
  // Libellés des effectifs dans les infobulles.
  const COUNT_NAMES = {
    "Nés en Nouvelle-Calédonie": "natifs",
    "Nés en métropole ou dans un DOM": "nés en métropole ou dans un DOM",
    "Ensemble des 25-64 ans": "ensemble des 25-64 ans"
  };
  // Diplôme le plus élevé : teintes sépia, sans lien avec les couleurs des
  // groupes, du plus bas (clair) au plus élevé (foncé).
  const DIPLOMES = [
    { id: "Aucun diplôme", color: "#f1ebdf" },
    { id: "CEP ou brevet", color: "#e2d4b9" },
    { id: "CAP ou BEP", color: "#cbb28a" },
    { id: "Baccalauréat", color: "#a88b61" },
    { id: "Bac +2", color: "#7b6445" },
    { id: "Bac +3 ou plus", color: "#4b3d2b" }
  ];
  // Indicateurs de la carte des IRIS : seuils et couleurs des classes.
  const MAP_METRICS = {
    pct_metro: {
      label: "Nés en métropole ou dans un DOM",
      thresholds: [2, 5, 10, 20, 40],
      colors: ["#eef2f5", "#d4e0ea", "#a9c2d6", "#7a9fbd", "#4f7a9e", "#2f5673"]
    },
    pct_hors: {
      label: "Nés hors de Nouvelle-Calédonie (tous lieux)",
      thresholds: [5, 10, 20, 35, 50],
      colors: ["#f0eef5", "#ddd8e9", "#beb3d4", "#9584b6", "#6c568f", "#49356c"]
    },
    pct_wf_pf: {
      label: "Nés à Wallis-et-Futuna ou en Polynésie française",
      thresholds: [1, 2, 4, 7, 10],
      colors: ["#f6efe9", "#ecd8c8", "#ddb595", "#c98d63", "#a8633f", "#7a3f26"]
    },
    pct_etranger: {
      label: "Nés à l’étranger",
      thresholds: [1, 2, 4, 7, 10],
      colors: ["#f4f1e6", "#e6dfc0", "#d0c48c", "#b1a35c", "#887c3b", "#5c5427"]
    },
    pct_hors_2014: {
      label: "Vivaient hors du pays cinq ans plus tôt (2014)",
      thresholds: [1, 2, 5, 10, 20],
      colors: ["#f3eef0", "#e5d3dc", "#cfaabd", "#b07c99", "#8a5274", "#5e3150"]
    }
  };

  const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int0 = (value) => nf0.format(value);
  const ans = (value) => `${int0(value)} an${Math.round(value) >= 2 ? "s" : ""}`;
  // Moins de 10 % : une décimale ; au-delà, un entier.
  const pct = (value) => (value == null || !Number.isFinite(value) ? "n.c." : `${Math.abs(value) < 10 ? nf1.format(value) : nf0.format(value)} %`);

  // ---------------------------------------------------------------------------
  // Outils partagés
  // ---------------------------------------------------------------------------

  function fail(root, message) {
    root.querySelectorAll(".habitat-sketch-loading").forEach((node) => node.remove());
    const p = document.createElement("p");
    p.className = "habitat-sketch-loading origines-error";
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
      .attr("paint-order", options.halo ? "stroke" : null)
      .attr("stroke", options.halo ? paper : null)
      .attr("stroke-width", options.halo ? (options.haloWidth || 3) : null)
      .attr("stroke-linejoin", options.halo ? "round" : null)
      .attr("pointer-events", "none")
      .text(text);
  }

  // Coupe un texte en lignes d'au plus `maxChars` caractères. Les textes des
  // diapositives masquées ne peuvent pas être mesurés : la largeur est estimée.
  function wrap(text, maxChars) {
    const words = String(text).split(/\s+/);
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

  function appendRough(parent, node, opacity) {
    parent.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (opacity != null) selection.attr("opacity", opacity);
    return selection;
  }

  function hatchColor(color) {
    const lab = d3.lab(color);
    return d3.lab(Math.max(10, lab.l - 30), lab.a, lab.b).formatHex();
  }

  function roughRect(parent, rc, x, y, width, height, options = {}) {
    return appendRough(parent, rc.rectangle(x, y, Math.max(0.5, width), height, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 3.2 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -41 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.8 : options.fillWeight,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      strokeLineDash: options.dash || undefined,
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

  function roughPath(parent, rc, d, options = {}) {
    if (!d) return null;
    return appendRough(parent, rc.path(d, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 3 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -41 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.5 : options.fillWeight,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      roughness: options.roughness == null ? 1.1 : options.roughness,
      bowing: 0.8,
      seed: seed(options.seed)
    }), options.opacity);
  }

  // Symbole d'une période d'arrivée : la forme double la couleur.
  function marker(parent, rc, shape, x, y, size, color, key) {
    const h = size / 2;
    const common = { fill: color, fillStyle: "solid", stroke: ink, strokeWidth: 0.7, roughness: 0.45, seed: seed(key) };
    let node;
    if (shape === "circle") node = rc.circle(x, y, size, common);
    else if (shape === "ring") node = rc.circle(x, y, size * 0.95, { ...common, fill: paper, stroke: color, strokeWidth: 2 });
    else if (shape === "square") node = rc.rectangle(x - h * 0.9, y - h * 0.9, h * 1.8, h * 1.8, common);
    else if (shape === "diamond") node = rc.polygon([[x, y - h * 1.2], [x + h * 1.2, y], [x, y + h * 1.2], [x - h * 1.2, y]], common);
    else node = rc.polygon([[x, y - h * 1.15], [x + h * 1.15, y + h * 0.9], [x - h * 1.15, y + h * 0.9]], common);
    return appendRough(parent, node);
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
      .attr("class", "origines-hit")
      .attr("x", x).attr("y", y).attr("width", Math.max(1, width)).attr("height", height)
      .attr("fill", "transparent")
      .attr("tabindex", 0)
      .attr("role", "img")
      .attr("aria-label", aria);
    return bindTip(rect, ctx, html);
  }

  function downloadPng(svg, button, filename) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "…";
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll(".origines-hit").forEach((node) => node.remove());
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

  // L'indicateur porte la hiérarchie principale ; le message analytique et le
  // champ restent en sous-titre. Renvoie l'ordonnée libre.
  function drawHeader(svg, ctx, width, title, subtitle) {
    const compact = ctx.compact;
    const mainTitle = title || ctx.title;
    const details = [ctx.title !== mainTitle ? ctx.title : "", subtitle].filter(Boolean).join(" · ");
    ctx.currentTitle = mainTitle;
    if (ctx.downloadButton) {
      ctx.downloadButton.setAttribute("aria-label", `Télécharger la figure « ${mainTitle} » en PNG`);
    }
    let y = 28;
    wrap(mainTitle, compact ? Math.floor((width - 36) / 10.5) : Math.floor((width - 36) / 12)).forEach((line) => {
      label(svg, line, 18, y, { family: fontSketch, size: compact ? 19 : 23, weight: 700 });
      y += compact ? 23 : 27;
    });
    if (details) {
      wrap(details, compact ? Math.floor((width - 36) / 6.3) : Math.floor((width - 36) / 6.9)).forEach((line) => {
        label(svg, line, 18, y - 2, { size: compact ? 11.5 : 12.5, weight: 700, color: muted });
        y += compact ? 15 : 17;
      });
    }
    return y + 10;
  }

  // Source et signature ; renvoie la hauteur totale.
  function drawFooter(svg, rc, ctx, width, y) {
    roughLine(svg, rc, 18, y, width - 18, y, { stroke: frame, strokeWidth: 0.7, roughness: 0.6, seed: `${ctx.key}-pied` });
    let yy = y + 15;
    const lines = wrap(ctx.source, ctx.compact ? Math.floor((width - 120) / 5.8) : Math.floor((width - 140) / 6.2));
    lines.forEach((line, index) => label(svg, line, 18, yy + index * 14, { size: ctx.compact ? 10 : 10.5, weight: 700, color: muted }));
    label(svg, "contours.nc", width - 18, yy, { anchor: "end", family: fontSketch, size: 14, weight: 700, color: muted });
    yy += lines.length * 14;
    return yy + 4;
  }

  function niceMax(max) {
    if (!Number.isFinite(max) || max <= 0) return 10;
    const step = max > 50 ? 20 : max > 20 ? 10 : 5;
    return Math.min(100, Math.ceil((max * 1.04) / step) * step);
  }

  function drawAxis(svg, x, top, bottom, ctx) {
    const ticks = x.ticks(ctx.compact ? 4 : 6);
    ticks.forEach((t) => {
      svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", top).attr("y2", bottom)
        .attr("stroke", gridColor).attr("stroke-width", 1).attr("stroke-dasharray", t ? "2 4" : null);
      label(svg, `${int0(t)} %`, x(t), top - 9, { anchor: "middle", size: ctx.compact ? 10 : 11, weight: 700, color: muted });
    });
  }

  function svgFlag(selected) {
    return selected ? "true" : "false";
  }

  // Largeur estimée d'un texte : les figures peuvent être dessinées hors
  // affichage, où la mesure réelle vaut 0.
  const textW = (text, size) => String(text).length * size * 0.56;
  const pts = (value) => `${nf1.format(value)} point${Math.abs(value) >= 2 ? "s" : ""}`;

  // Grille horizontale et graduations à gauche (figures verticales).
  function drawYAxis(svg, y, left, right, ctx, ticks) {
    (ticks || y.ticks(ctx.compact ? 4 : 5)).forEach((t) => {
      svg.append("line").attr("x1", left).attr("x2", right).attr("y1", y(t)).attr("y2", y(t))
        .attr("stroke", t ? gridColor : "#bdb4a6").attr("stroke-width", 1).attr("stroke-dasharray", t ? "2 4" : null);
      label(svg, `${int0(t)} %`, left - 6, y(t), { anchor: "end", size: ctx.compact ? 10 : 11, weight: 700, color: muted });
    });
  }

  // Légende des deux groupes (forme et couleur), avec repère facultatif.
  function drawGroupLegend(svg, rc, ctx, x0, y, options = {}) {
    const items = [
      { ...NC_POINT, label: options.ncLabel || NC_POINT.label },
      { ...METRO_POINT, label: options.metroLabel || METRO_POINT.label }
    ];
    if (options.ensemble) items.push({ tick: true, label: options.ensemble });
    const size = ctx.compact ? 11 : 12;
    let x = x0;
    items.forEach((item, index) => {
      const w = textW(item.label, size) + 30;
      if (x + w > ctx.width - 12 && x > x0) {
        x = x0;
        y += 20;
      }
      if (item.tick) {
        svg.append("line").attr("x1", x + 7).attr("x2", x + 7).attr("y1", y - 7).attr("y2", y + 7).attr("stroke", ink).attr("stroke-width", 1.6);
      } else {
        marker(svg, rc, item.shape, x + 7, y, 11, item.color, `${ctx.key}-legende-${index}`);
      }
      label(svg, item.label, x + 18, y, { size, weight: 800, color: item.tick ? ink : item.color });
      x += w;
    });
    return y + 14;
  }

  // Valeur écrite à côté d'un symbole, du côté `side` (-1 gauche, 1 droite) ;
  // au-dessus (ou au-dessous) du symbole si elle sortirait des bornes.
  function sideValue(svg, text, x, y, side, offset, bounds, options = {}) {
    const size = options.size || 12;
    const w = textW(text, size);
    const start = side > 0 ? x + offset : x - offset - w;
    if (start < bounds[0] || start + w > bounds[1]) {
      const dy = (offset + size * 0.45) * (options.fallback === "below" ? 1 : -1);
      return label(svg, text, x, y + dy, { anchor: "middle", size, weight: 850, color: options.color, halo: true, haloWidth: 2.5 });
    }
    return label(svg, text, side > 0 ? x + offset : x - offset, y, { anchor: side > 0 ? "start" : "end", size, weight: 850, color: options.color, halo: true, haloWidth: 2.5 });
  }

  // Haltère : deux valeurs sur une même ligne, reliées par un trait.
  function dumbbell(svg, rc, ctx, x, cy, a, b, key, bounds, fallback) {
    const size = ctx.compact ? 11 : 12;
    const ok = (p) => Number.isFinite(p.value);
    if (ok(a) && ok(b)) {
      roughLine(svg, rc, x(a.value), cy, x(b.value), cy, { stroke: linkColor, strokeWidth: 2.4, roughness: 0.45, seed: `${key}-lien` });
    }
    [a, b].forEach((p, index) => {
      if (ok(p)) marker(svg, rc, p.shape, x(p.value), cy, size, p.color, `${key}-${index}`);
    });
    if (!ok(a) || !ok(b)) return;
    const [lo, hi] = a.value <= b.value ? [a, b] : [b, a];
    const textSize = ctx.compact ? 11 : 12;
    sideValue(svg, pct(lo.value), x(lo.value), cy, -1, size * 0.75 + 3, bounds, { size: textSize, color: lo.color, fallback });
    sideValue(svg, pct(hi.value), x(hi.value), cy, 1, size * 0.75 + 3, bounds, { size: textSize, color: hi.color, fallback });
  }

  function roughPolyline(parent, rc, points, options = {}) {
    return appendRough(parent, rc.linearPath(points, {
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 1.8 : options.strokeWidth,
      strokeLineDash: options.dash || undefined,
      roughness: options.roughness == null ? 0.55 : options.roughness,
      bowing: 0.5,
      seed: seed(options.seed)
    }), options.opacity);
  }

  // Titre de panneau, en crayon.
  function panelTitle(svg, text, x, y, ctx, sub) {
    label(svg, text, x, y, { family: fontSketch, size: ctx.compact ? 15 : 16, weight: 700 });
    if (sub) label(svg, sub, x + textW(text, ctx.compact ? 15 : 16) * 0.92 + 8, y + 1, { size: ctx.compact ? 10.5 : 11, weight: 700, color: muted });
  }

  // Ajuste la hauteur et le résumé accessible d'une figure fixe.
  function finish(svg, ctx, width, height, aria) {
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
    const context = ctx.title && ctx.title !== ctx.currentTitle ? `${ctx.title}. ` : "";
    svg.attr("aria-label", `${ctx.currentTitle || ctx.title}. ${context}${aria}`);
  }

  // Cible ronde, au survol et au clavier.
  function hitCircle(parent, ctx, cx, cy, r, aria, html) {
    const node = parent.append("circle")
      .attr("class", "origines-hit")
      .attr("cx", cx).attr("cy", cy).attr("r", r)
      .attr("fill", "transparent")
      .attr("tabindex", 0)
      .attr("role", "img")
      .attr("aria-label", aria);
    return bindTip(node, ctx, html);
  }

  // Écarte verticalement des étiquettes trop proches, dans [min, max].
  function spread(items, gap, min, max) {
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
    }
    const overflow = items.length ? items[items.length - 1].y - max : 0;
    if (overflow > 0) items.forEach((item) => { item.y -= overflow; });
    for (let i = items.length - 2; i >= 0; i -= 1) {
      if (items[i + 1].y - items[i].y < gap) items[i].y = items[i + 1].y - gap;
    }
    if (items.length && items[0].y < min) {
      const shift = min - items[0].y;
      items.forEach((item) => { item.y += shift; });
    }
    return items;
  }

  function tipSimple(title, line, note) {
    return `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(line)}</span>${note ? `<span class="habitat-tooltip-note">${escapeHtml(note)}</span>` : ""}`;
  }

  // Deux groupes (ou plus) comparés sur un indicateur ; `items` : [libellé, ligne].
  function tipComparaison(title, sub, items, effectifKey = "effectif_champ") {
    const counts = items.filter(([, row]) => row && Number.isFinite(row[effectifKey]))
      .map(([name, row]) => `${int0(row[effectifKey])} ${COUNT_NAMES[name] || name.toLowerCase()}`);
    return `<strong>${escapeHtml(title)}</strong>
      ${sub ? `<span>${escapeHtml(sub)}</span>` : ""}
      <div class="origines-tip-grid">${items.map(([name, row]) => `<span>${escapeHtml(name)}</span><b>${pct(row?.taux)}</b>`).join("")}</div>
      ${counts.length ? `<span class="habitat-tooltip-note">Effectifs du champ : ${escapeHtml(counts.join(", "))}.</span>` : ""}`;
  }

  function tipDiplomes(name, items) {
    const total = d3.sum(items, ([, row]) => row?.effectif || 0);
    return `<strong>${escapeHtml(name)}</strong>
      <div class="origines-tip-grid">${items.map(([diplome, row]) => `<span>${escapeHtml(diplome)}</span><b>${pct(row?.part)}</b>`).join("")}</div>
      <span class="habitat-tooltip-note">${int0(total)} personnes de 25 à 64 ans.</span>`;
  }

  // Case de la matrice génération × date d'installation ; `natif` : la case
  // des natifs du même âge, absente pour les natifs eux-mêmes.
  function tipGeneration(name, classe, indicator, row, natif) {
    const title = `<strong>${escapeHtml(name)}, ${escapeHtml(classe)} ans en 2019</strong>`;
    if (!row) return `${title}<span>Donnée indisponible.</span>`;
    const small = row.effectif_champ < SMALL ? `<span class="habitat-tooltip-note">Effectif limité : à lire avec prudence.</span>` : "";
    return `${title}
      <span>${escapeHtml(indicator.libelle)}</span>
      <div class="origines-tip-grid">
        <span>Taux observé</span><b>${pct(row.taux)}</b>
        ${natif ? `<span>Natifs du même âge</span><b>${pct(natif.taux)}</b>` : ""}
        ${Number.isFinite(row.age_arrivee_median) ? `<span>Âge médian à l’arrivée</span><b>${ans(row.age_arrivee_median)}</b>` : ""}
      </div>
      <span class="habitat-tooltip-note">${int0(row.effectif)} sur ${int0(row.effectif_champ)} ${escapeHtml(indicator.champ)}.</span>${small}`;
  }

  // ---------------------------------------------------------------------------
  // Données
  // ---------------------------------------------------------------------------

  const cache = new Map();

  // Tableau brut ; clé distincte de loadProfils, qui lit aussi des CSV.
  function loadCsv(src) {
    const key = `csv|${src}`;
    if (!cache.has(key)) {
      const promise = d3.csv(src, d3.autoType).then((rows) => {
        if (!rows.length) throw new Error(`Données vides : ${src}`);
        return rows;
      });
      promise.catch(() => cache.delete(key));
      cache.set(key, promise);
    }
    return cache.get(key);
  }

  function loadProfils(src) {
    if (!cache.has(src)) {
      const promise = d3.csv(src, d3.autoType).then((rows) => {
        const index = new Map(rows.map((r) => [`${r.territoire}|${r.regroupement}|${r.groupe}|${r.indicateur}`, r]));
        const indicators = [];
        rows.forEach((r) => {
          if (!indicators.some((i) => i.id === r.indicateur)) {
            indicators.push({ id: r.indicateur, theme: r.theme, libelle: r.libelle, champ: r.champ });
          }
        });
        if (!indicators.length) throw new Error("Données vides");
        return {
          indicators,
          get: (territoire, regroupement, groupe, indicateur) => index.get(`${territoire}|${regroupement}|${groupe}|${indicateur}`)
        };
      });
      promise.catch(() => cache.delete(src));
      cache.set(src, promise);
    }
    return cache.get(src);
  }

  // d3 attend des anneaux extérieurs dans le sens horaire, ce que le GeoJSON ne
  // garantit pas : tout polygone qui couvrirait plus d'un hémisphère est
  // retourné, y compris dans une collection. Sans cela, d3 dessinerait le
  // complément du polygone, soit le globe entier.
  function rewindGeometry(g) {
    const flip = (polygon) => polygon.map((ring) => ring.slice().reverse());
    const fix = (polygon) => (d3.geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI ? flip(polygon) : polygon);
    if (!g) return g;
    if (g.type === "Polygon") return { ...g, coordinates: fix(g.coordinates) };
    if (g.type === "MultiPolygon") return { ...g, coordinates: g.coordinates.map(fix) };
    if (g.type === "GeometryCollection") return { ...g, geometries: g.geometries.map(rewindGeometry) };
    return g;
  }

  function rewind(features) {
    return features.map((feature) => ({ ...feature, geometry: rewindGeometry(feature.geometry) }));
  }

  // Polygones d'une couche de terre, pour la côte crayonnée.
  function polygonsOf(features) {
    const out = [];
    const visit = (g) => {
      if (!g) return;
      if (g.type === "Polygon") out.push(g.coordinates);
      else if (g.type === "MultiPolygon") out.push(...g.coordinates);
      else if (g.type === "GeometryCollection") g.geometries.forEach(visit);
    };
    features.forEach((f) => visit(f.geometry));
    return out;
  }

  function loadIris(src) {
    if (!cache.has(src)) {
      const promise = d3.json(src).then((bundle) => {
        const iris = rewind(bundle.iris.features);
        if (!iris.length) throw new Error("Géométrie vide");
        // Un IRIS du Grand Nouméa se lit dans l'agrandissement s'il touche son
        // emprise ; sinon, dans la vue d'ensemble.
        const [west, south, east, north] = bundle.vue_gn;
        iris.forEach((feature) => {
          const [[x0, y0], [x1, y1]] = d3.geoBounds(feature);
          feature.properties.dans_gn = Boolean(feature.properties.grand_noumea) && x1 >= west && x0 <= east && y1 >= south && y0 <= north;
        });
        return {
          iris,
          terreNc: rewind(bundle.terre_nc.features),
          terreGn: rewind(bundle.terre_gn.features),
          vue: bundle.vue_gn
        };
      });
      promise.catch(() => cache.delete(src));
      cache.set(src, promise);
    }
    return cache.get(src);
  }

  const valueOf = (row, mode) => (row ? (mode === "std" ? row.taux_age_sexe_identiques : row.taux) : null);
  const modeLabel = (mode) => (mode === "std" ? " · à âge et sexe comparables" : "");

  function tipProfil(name, indicator, row, territoireLabel) {
    if (!row) return `<strong>${escapeHtml(name)}</strong><span>Donnée indisponible.</span>`;
    const small = row.effectif_champ < SMALL ? `<span class="habitat-tooltip-note">Effectif limité : à lire avec prudence.</span>` : "";
    return `<strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(indicator.libelle)} · ${escapeHtml(territoireLabel)}</span>
      <div class="origines-tip-grid">
        <span>Taux observé</span><b>${pct(row.taux)}</b>
        <span>À âge et sexe comparables</span><b>${pct(row.taux_age_sexe_identiques)}</b>
      </div>
      <span class="habitat-tooltip-note">${int0(row.effectif)} sur ${int0(row.effectif_champ)} ${escapeHtml(indicator.champ)}.</span>${small}`;
  }

  // ---------------------------------------------------------------------------
  // Contrôles
  // ---------------------------------------------------------------------------

  function indicatorSelect(ctx, indicators, onChange) {
    const wrapLabel = document.createElement("label");
    wrapLabel.className = "habitat-map-control-label";
    wrapLabel.textContent = "Indicateur";
    const select = document.createElement("select");
    select.className = "habitat-map-select";
    d3.groups(indicators, (i) => i.theme).forEach(([theme, items]) => {
      const group = document.createElement("optgroup");
      group.label = theme;
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.libelle;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
    select.value = ctx.state.indicateur;
    select.addEventListener("change", () => onChange(select.value));
    wrapLabel.appendChild(select);
    return wrapLabel;
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
      button.setAttribute("aria-pressed", svgFlag(value === current));
      button.addEventListener("click", () => {
        buttons.forEach((b, i) => b.setAttribute("aria-pressed", svgFlag(options[i][0] === value)));
        onChange(value);
      });
      group.appendChild(button);
      return button;
    });
    return group;
  }

  // ---------------------------------------------------------------------------
  // Figures
  // ---------------------------------------------------------------------------

  const charts = {
    // Barres : natifs, personnes nées en métropole puis leur détail selon
    // l'année de la dernière installation, enfin les autres lieux de
    // naissance. Repère : ensemble des 25-64 ans.
    profils: {
      load: (root) => loadProfils(root.dataset.src),
      init(ctx, data) {
        ctx.state = { indicateur: ctx.root.dataset.defaultIndicator || "bac3", territoire: "Nouvelle-Calédonie", mode: "brut" };
        return [
          indicatorSelect(ctx, data.indicators, (value) => { ctx.state.indicateur = value; ctx.redraw(); }),
          buttonGroup("Territoire", [["Nouvelle-Calédonie", "Nouvelle-Calédonie"], ["Province Sud", "Province Sud"]], ctx.state.territoire,
            (value) => { ctx.state.territoire = value; ctx.redraw(); }),
          buttonGroup("Mode de calcul", [["brut", "Taux observés"], ["std", "À âge et sexe comparables"]], ctx.state.mode,
            (value) => { ctx.state.mode = value; ctx.redraw(); })
        ];
      },
      draw(ctx, data) {
        const { svg, width, compact, state } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const indicator = data.indicators.find((i) => i.id === state.indicateur) || data.indicators[0];
        const t = state.territoire;
        const rows = [
          { reg: "naissance2", groupe: NC, label: NC, color: colorNc, level: 0 },
          { reg: "naissance", groupe: METRO, label: METRO_POINT.label, color: colorMetro, level: 0 },
          ...DURATIONS.map((d, i) => ({
            reg: "naissance_anciennete", groupe: `${METRO} · ${d.groupe}`, label: d.label, color: d.color, level: 1,
            caption: i ? null : "dont, selon l’année de leur dernière installation :"
          })),
          ...ORIGINS.filter((o) => o.groupe !== METRO).map((o, i) => ({
            reg: "naissance", groupe: o.groupe, label: o.label, color: o.color, level: 1,
            caption: i ? null : "Autres lieux de naissance hors du pays :"
          }))
        ].map((r) => ({ ...r, row: data.get(t, r.reg, r.groupe, indicator.id) }));
        const ensemble = data.get(t, "ensemble", ENSEMBLE, indicator.id);
        let y = drawHeader(svg, ctx, width, indicator.libelle, `En % des ${indicator.champ} · ${t}${modeLabel(state.mode)}`);

        const left = compact ? 18 : 268;
        const right = width - (compact ? 58 : 72);
        const max = d3.max([...rows.map((r) => valueOf(r.row, state.mode)), valueOf(ensemble, state.mode)]);
        const x = d3.scaleLinear().domain([0, niceMax(max)]).range([left, right]);
        y += 14;
        const top = y;
        const heights = rows.map((r) => (compact ? (r.level ? 40 : 46) : (r.level ? 30 : 38)));
        const captionH = compact ? 22 : 24;
        const bottom = top + d3.sum(heights) + rows.filter((r) => r.caption).length * captionH + 6;
        drawAxis(svg, x, top, bottom, ctx);

        rows.forEach((r, index) => {
          if (r.caption) {
            label(svg, r.caption, compact ? 18 : 30, y + captionH / 2,
              { size: compact ? 11 : 12, weight: 700, color: muted });
            y += captionH;
          }
          const h = heights[index];
          const barH = r.level ? (compact ? 13 : 15) : (compact ? 16 : 19);
          const labelX = compact ? (r.level ? 30 : 18) : (r.level ? 44 : 18);
          const barY = compact ? y + 18 : y + (h - barH) / 2;
          const value = valueOf(r.row, state.mode);
          const text = r.level ? `${r.label.charAt(0).toUpperCase()}${r.label.slice(1)}` : r.label;
          label(svg, text, labelX, compact ? y + 8 : y + h / 2, {
            size: compact ? 11.5 : (r.level ? 12 : 13), weight: r.level ? 700 : 850, color: r.level ? ink : r.color
          });
          if (Number.isFinite(value)) {
            const fill = r.color;
            roughRect(svg, rc, x(0), barY, x(value) - x(0), barH, {
              fill, hachureGap: r.level ? 2.6 : 2.2, fillWeight: r.level ? 0.9 : 1.1, stroke: hatchColor(fill),
              dash: r.row.effectif_champ < SMALL ? [3, 2] : null, seed: `${ctx.key}-${r.groupe}`
            });
            label(svg, pct(value), x(value) + 7, barY + barH / 2, { size: compact ? 12 : 13, weight: 850, color: r.level ? ink : r.color });
          } else {
            label(svg, "non calculé", x(0) + 6, barY + barH / 2, { size: 11, weight: 700, color: muted });
          }
          const aria = `${text} : ${pct(value)}`;
          hitArea(svg, ctx, 0, y, width, h, aria, () => tipProfil(text, indicator, r.row, t));
          y += h;
        });

        // Repère : ensemble des 25-64 ans.
        const ref = valueOf(ensemble, state.mode);
        if (Number.isFinite(ref)) {
          roughLine(svg, rc, x(ref), top - 2, x(ref), bottom, { stroke: "#c54832", strokeWidth: 1.2, dash: [5, 4], seed: `${ctx.key}-ref` });
          label(svg, `Ensemble : ${pct(ref)}`, x(ref), bottom + 12, { anchor: x(ref) > width - 120 ? "end" : "middle", size: compact ? 10.5 : 11.5, weight: 800, color: "#c54832" });
        }
        const height = drawFooter(svg, rc, ctx, width, bottom + 30);
        svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
        svg.attr("aria-label", `${indicator.libelle}. ${ctx.title}. ${t} : ${rows.map((r) => `${r.label} ${pct(valueOf(r.row, state.mode))}`).join(" ; ")}.`);
      }
    },

    // Haltères : natifs et personnes nées en métropole sur huit indicateurs,
    // regroupés par domaine. Repère : ensemble des 25-64 ans.
    ecarts: {
      load: (root) => loadProfils(root.dataset.src),
      init: () => [],
      draw(ctx, data) {
        const { svg, width, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const t = "Nouvelle-Calédonie";
        const themes = [
          ["Diplôme", [["bac3", "Diplômés d’un bac +3 ou plus"], ["sans_diplome", "Sans aucun diplôme"]]],
          ["Emploi", [["emploi", "En emploi"], ["chomage", "Au chômage (parmi les actifs)"], ["cadres", "Cadres (parmi les salariés)"]]],
          ["Logement", [["proprietaire", "Ménage propriétaire du logement"], ["surpeuplement", "Logement surpeuplé"], ["sans_internet", "Logement sans accès à internet"]]]
        ];
        let y = drawHeader(svg, ctx, width, "Diplôme, emploi et logement", "Huit indicateurs parmi les 25-64 ans, en % du champ de chacun · recensement de 2019");
        y = drawGroupLegend(svg, rc, ctx, 18, y, { ensemble: "Ensemble des 25-64 ans" });
        const left = compact ? 22 : 290;
        const right = width - (compact ? 26 : 48);
        const x = d3.scaleLinear().domain([0, 100]).range([left, right]);
        const rowH = compact ? 52 : 34;
        const themeH = compact ? 26 : 28;
        const top = y + 26;
        const bottom = top + d3.sum(themes, ([, items]) => items.length) * rowH + themes.length * themeH;
        drawAxis(svg, x, top, bottom, ctx);
        y = top;
        const parts = [];
        themes.forEach(([theme, items], ti) => {
          if (ti) svg.append("line").attr("x1", 18).attr("x2", width - 18).attr("y1", y + 2).attr("y2", y + 2).attr("stroke", frame).attr("stroke-width", 0.8);
          label(svg, theme, 18, y + themeH / 2 + 3, { family: fontSketch, size: compact ? 14 : 15, weight: 700, color: muted });
          y += themeH;
          items.forEach(([id, name]) => {
            const indicator = data.indicators.find((i) => i.id === id);
            const nc = data.get(t, "naissance2", NC, id);
            const metro = data.get(t, "naissance", METRO, id);
            const ens = data.get(t, "ensemble", ENSEMBLE, id);
            const cy = compact ? y + 32 : y + rowH / 2;
            label(svg, name, compact ? 18 : 30, compact ? y + 10 : cy, { size: compact ? 11.5 : 12.5, weight: 800 });
            if (ens) {
              svg.append("line").attr("x1", x(ens.taux)).attr("x2", x(ens.taux)).attr("y1", cy - 9).attr("y2", cy + 9)
                .attr("stroke", ink).attr("stroke-width", 1.6);
            }
            // Sur mobile, le libellé occupe le haut de la ligne : une valeur
            // sans place à côté de son symbole passe dessous.
            dumbbell(svg, rc, ctx, x, cy, { ...NC_POINT, value: nc?.taux }, { ...METRO_POINT, value: metro?.taux },
              `${ctx.key}-${id}`, [compact ? 4 : left - 4, width - 4], compact ? "below" : "above");
            const aria = `${name} : ${pct(nc?.taux)} des natifs, ${pct(metro?.taux)} des personnes nées en métropole ou dans un DOM`;
            parts.push(aria);
            hitArea(svg, ctx, 0, y, width, rowH, aria, () => tipComparaison(name, indicator ? `En % des ${indicator.champ}` : "", [
              [NC_POINT.label, nc], [METRO_POINT.label, metro], ["Ensemble des 25-64 ans", ens]
            ]));
            y += rowH;
          });
        });
        const height = drawFooter(svg, rc, ctx, width, bottom + 14);
        finish(svg, ctx, width, height, `${parts.join(" ; ")}.`);
      }
    },

    // Barres empilées : répartition par diplôme, natifs, personnes nées en
    // métropole, puis les autres lieux de naissance hors du pays.
    diplomes: {
      load: (root) => loadCsv(root.dataset.src),
      init: () => [],
      draw(ctx, rows) {
        const { svg, width, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const groups = [
          { groupe: NC, label: NC, color: colorNc, level: 0 },
          { groupe: METRO, label: METRO_POINT.label, color: colorMetro, level: 0 },
          ...ORIGINS.filter((o) => o.groupe !== METRO).map((o) => ({ groupe: o.groupe, label: o.label, color: hatchColor(o.color), level: 1 }))
        ];
        const get = (groupe, diplome) => rows.find((r) => r.groupe === groupe && r.diplome === diplome);
        let y = drawHeader(svg, ctx, width, "Diplôme le plus élevé", "Répartition des personnes de 25 à 64 ans, en % · recensement de 2019");
        const size = compact ? 10.5 : 11.5;
        let lx = 18;
        DIPLOMES.forEach((d) => {
          const w = textW(d.id, size) + 28;
          if (lx + w > width - 12 && lx > 18) {
            lx = 18;
            y += 20;
          }
          svg.append("rect").attr("x", lx).attr("y", y - 6).attr("width", 14).attr("height", 12).attr("fill", d.color)
            .attr("stroke", "#8f877b").attr("stroke-width", 0.6);
          label(svg, d.id, lx + 19, y, { size, weight: 800, color: muted });
          lx += w;
        });
        y += 24;
        const left = compact ? 18 : 250;
        const right = width - 18;
        const x = d3.scaleLinear().domain([0, 100]).range([left, right]);
        const captionH = compact ? 24 : 26;
        const parts = [];
        groups.forEach((g, gi) => {
          if (gi === 2) {
            label(svg, "Autres lieux de naissance hors du pays :", compact ? 18 : 30, y + captionH / 2, { size: compact ? 11 : 12, weight: 700, color: muted });
            y += captionH;
          }
          const rowH = compact ? 46 : (g.level ? 32 : 38);
          const barH = compact ? 20 : (g.level ? 20 : 24);
          const barY = compact ? y + 18 : y + (rowH - barH) / 2;
          label(svg, g.label, compact ? (g.level ? 28 : 18) : (g.level ? 44 : 18), compact ? y + 8 : y + rowH / 2, {
            size: compact ? 11.5 : (g.level ? 12 : 13), weight: g.level ? 800 : 850, color: g.color
          });
          let acc = 0;
          const items = DIPLOMES.map((d) => [d.id, get(g.groupe, d.id)]);
          DIPLOMES.forEach((d, di) => {
            const row = items[di][1];
            const value = row ? row.part : 0;
            const x0 = x(acc);
            const w = x(acc + value) - x0;
            svg.append("rect").attr("x", x0).attr("y", barY).attr("width", Math.max(0, w)).attr("height", barH).attr("fill", d.color);
            if (w > 2) {
              roughRect(svg, rc, x0, barY, w, barH, {
                fill: hatchColor(d.color), hachureGap: 3.4, fillWeight: 0.45, stroke: "none", strokeWidth: 0,
                roughness: 0.9, opacity: 0.45, seed: `${ctx.key}-${g.groupe}-${di}`
              });
            }
            const text = pct(value);
            if (w > textW(text, 11) + 8) {
              label(svg, text, x0 + w / 2, barY + barH / 2, { anchor: "middle", size: compact ? 10.5 : 11, weight: 850, color: di >= 3 ? paper : ink });
            }
            acc += value;
          });
          roughRect(svg, rc, x(0), barY, x(100) - x(0), barH, { stroke: ink, strokeWidth: 0.9, roughness: 0.6, seed: `${ctx.key}-${g.groupe}-cadre` });
          const aria = `${g.label} : ${items.map(([d, row]) => `${d.toLowerCase()} ${pct(row?.part)}`).join(", ")}`;
          parts.push(aria);
          hitArea(svg, ctx, 0, y, width, rowH, aria, () => tipDiplomes(g.label, items));
          y += rowH;
        });
        const height = drawFooter(svg, rc, ctx, width, y + 12);
        finish(svg, ctx, width, height, `${parts.join(" ; ")}.`);
      }
    },

    // Deux panneaux : sans diplôme et bac +3 ou plus selon la classe d'âge,
    // des plus âgés (à gauche) aux plus jeunes.
    generations: {
      load: (root) => loadCsv(root.dataset.src),
      init: () => [],
      draw(ctx, rows) {
        const { svg, width, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const classes = ["55-64", "45-54", "35-44", "25-34"];
        const panels = [
          { id: "sans_diplome", title: "Sans aucun diplôme" },
          { id: "bac3", title: "Bac +3 ou plus", gap: true }
        ];
        const get = (cl, groupe, ind) => rows.find((r) => r.classe_age === cl && r.groupe === groupe && r.indicateur === ind);
        const max = niceMax(d3.max(rows, (r) => r.taux));
        let y = drawHeader(svg, ctx, width, "Sans diplôme et diplômés d’un bac +3 ou plus", "Part des personnes concernées dans chaque classe d’âge, en % · recensement de 2019");
        y = drawGroupLegend(svg, rc, ctx, 18, y) + 12;
        const gapX = 40;
        const panelW = compact ? width - 36 : (width - 36 - gapX) / 2;
        const panelH = compact ? 236 : 290;
        const parts = [];
        panels.forEach((p, pi) => {
          const px = compact ? 18 : 18 + pi * (panelW + gapX);
          const py = compact ? y + pi * (panelH + 16) : y;
          panelTitle(svg, p.title, px, py + 8, ctx);
          const left = px + 40;
          const right = px + panelW - 46;
          const top = py + 32;
          const bottom = py + panelH - 28;
          const ys = d3.scaleLinear().domain([0, max]).range([bottom, top]);
          const xs = d3.scalePoint().domain(classes).range([left + 16, right - 8]);
          drawYAxis(svg, ys, left, right, ctx);
          classes.forEach((cl) => label(svg, `${cl} ans`, xs(cl), bottom + 15, { anchor: "middle", size: compact ? 10.5 : 11.5, weight: 700, color: muted }));
          const series = [[NC, NC_POINT], [METRO, METRO_POINT]].map(([groupe, style]) => ({
            groupe, style, points: classes.map((cl) => ({ cl, row: get(cl, groupe, p.id) }))
          }));
          series.forEach((s) => roughPolyline(svg, rc, s.points.map((pt) => [xs(pt.cl), ys(pt.row.taux)]), {
            stroke: s.style.color, strokeWidth: 2, seed: `${ctx.key}-${p.id}-${s.groupe}`
          }));
          // Écart entre les deux groupes, chez les plus âgés et les plus jeunes.
          if (p.gap) {
            [classes[0], classes[classes.length - 1]].forEach((cl, k) => {
              const a = get(cl, NC, p.id).taux;
              const b = get(cl, METRO, p.id).taux;
              roughLine(svg, rc, xs(cl), ys(a) - 9, xs(cl), ys(b) + 9, { stroke: muted, strokeWidth: 0.9, dash: [3, 3], seed: `${ctx.key}-ecart-${cl}` });
              label(svg, `écart : ${pts(b - a)}`, xs(cl) + (k ? -8 : 8), (ys(a) + ys(b)) / 2, {
                anchor: k ? "end" : "start", size: compact ? 10 : 11, weight: 800, color: muted, halo: true
              });
            });
          }
          series.forEach((s, si) => {
            const other = series[1 - si];
            s.points.forEach((pt, i) => {
              const cx = xs(pt.cl);
              const cy = ys(pt.row.taux);
              marker(svg, rc, s.style.shape, cx, cy, compact ? 10 : 11, s.style.color, `${ctx.key}-${p.id}-${s.groupe}-${pt.cl}`);
              const textSize = compact ? 11 : 12;
              if (i === classes.length - 1) {
                label(svg, pct(pt.row.taux), cx + 10, cy, { size: textSize, weight: 850, color: s.style.color, halo: true });
              } else if (i === 0) {
                const above = pt.row.taux >= other.points[i].row.taux;
                label(svg, pct(pt.row.taux), cx, cy + (above ? -14 : 15), { anchor: "middle", size: textSize, weight: 850, color: s.style.color, halo: true });
              }
              const name = `${s.style.label}, ${pt.cl} ans`;
              hitCircle(svg, ctx, cx, cy, 10, `${p.title}, ${name} : ${pct(pt.row.taux)}`,
                () => tipSimple(name, `${p.title} : ${pct(pt.row.taux)}`, `${int0(pt.row.effectif)} personnes dans cette classe d’âge.`));
            });
          });
          parts.push(`${p.title} : ${pct(get("55-64", NC, p.id).taux)} des natifs de 55-64 ans, ${pct(get("25-34", NC, p.id).taux)} des natifs de 25-34 ans ; ${pct(get("55-64", METRO, p.id).taux)} et ${pct(get("25-34", METRO, p.id).taux)} chez les personnes nées en métropole ou dans un DOM`);
        });
        const end = compact ? y + 2 * panelH + 16 : y + panelH;
        const height = drawFooter(svg, rc, ctx, width, end + 10);
        finish(svg, ctx, width, height, `${parts.join(" ; ")}.`);
      }
    },

    // Lignes : bac +3 ou plus selon la période d'arrivée, un trait par lieu de
    // naissance, plus épais pour la métropole. Repère horizontal : les natifs
    // du pays.
    arrivees: {
      load: (root) => loadProfils(root.dataset.src),
      init: () => [],
      draw(ctx, data) {
        const { svg, width, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const t = "Nouvelle-Calédonie";
        const indicator = data.indicators.find((i) => i.id === "bac3");
        const periods = DURATIONS.slice(0, 4).reverse();
        const series = ORIGINS.map((o) => ({
          ...o,
          text: hatchColor(o.color),
          points: periods.map((d) => ({ d, row: data.get(t, "naissance_anciennete", `${o.groupe} · ${d.groupe}`, "bac3") })).filter((pt) => pt.row)
        }));
        const natif = data.get(t, "naissance2", NC, "bac3").taux;
        let y = drawHeader(svg, ctx, width, indicator.libelle, "En % des 25-64 ans, selon la période de la dernière installation · recensement de 2019");
        if (compact) {
          let lx = 18;
          series.forEach((s, i) => {
            const w = textW(s.court, 11) + 30;
            if (lx + w > width - 12 && lx > 18) {
              lx = 18;
              y += 20;
            }
            roughLine(svg, rc, lx, y, lx + 16, y, { stroke: s.color, strokeWidth: 2.4, roughness: 0.4, seed: `${ctx.key}-legende-${i}` });
            label(svg, s.court, lx + 21, y, { size: 11, weight: 800, color: s.text });
            lx += w;
          });
          y += 14;
        }
        const max = niceMax(d3.max(series.flatMap((s) => s.points.map((pt) => pt.row.taux))));
        const left = 52;
        const right = width - (compact ? 54 : 210);
        const top = y + 16;
        const bottom = top + (compact ? 250 : 300);
        const ys = d3.scaleLinear().domain([0, max]).range([bottom, top]);
        const xs = d3.scalePoint().domain(periods.map((d) => d.groupe)).range([left + 26, right - 8]);
        drawYAxis(svg, ys, left, right, ctx);
        periods.forEach((d) => label(svg, d.court, xs(d.groupe), bottom + 15, { anchor: "middle", size: compact ? 10.5 : 11.5, weight: 700, color: muted }));
        label(svg, "Période de la dernière installation", (left + right) / 2, bottom + 33, { anchor: "middle", size: compact ? 10.5 : 11, weight: 800, color: muted });
        roughLine(svg, rc, left, ys(natif), right, ys(natif), { stroke: colorNc, strokeWidth: 1.5, dash: [6, 4], seed: `${ctx.key}-natifs` });
        if (compact) {
          label(svg, `Nés en Nouvelle-Calédonie : ${pct(natif)}`, left + 4, ys(natif) - 9, { size: 10.5, weight: 850, color: colorNc, halo: true });
        }
        series.forEach((s) => {
          const main = s.groupe === METRO;
          roughPolyline(svg, rc, s.points.map((pt) => [xs(pt.d.groupe), ys(pt.row.taux)]), {
            stroke: s.color, strokeWidth: main ? 3.2 : 1.8, opacity: main ? null : 0.85, seed: `${ctx.key}-${s.groupe}`
          });
          s.points.forEach((pt) => {
            const cx = xs(pt.d.groupe);
            const cy = ys(pt.row.taux);
            const node = marker(svg, rc, "circle", cx, cy, (compact ? 9 : 10) + (main ? 2 : 0), s.color, `${ctx.key}-${s.groupe}-${pt.d.groupe}`);
            if (pt.row.effectif_champ < SMALL) node.attr("opacity", 0.45);
            const name = `${s.label}, ${pt.d.label}`;
            hitCircle(svg, ctx, cx, cy, 9, `${name} : ${pct(pt.row.taux)}`, () => tipProfil(name, indicator, pt.row, t));
          });
        });
        const ends = series.map((s) => {
          const last = s.points[s.points.length - 1].row;
          return { text: compact ? pct(last.taux) : `${s.court} · ${pct(last.taux)}`, y: ys(last.taux), color: s.text };
        });
        if (!compact) ends.push({ text: `Natifs du pays · ${pct(natif)}`, y: ys(natif), color: colorNc });
        spread(ends, compact ? 14 : 16, top, bottom);
        ends.forEach((e) => label(svg, e.text, right + 10, e.y, { size: compact ? 11 : 12, weight: 850, color: e.color }));
        const height = drawFooter(svg, rc, ctx, width, bottom + 46);
        finish(svg, ctx, width, height, `${series.map((s) => `${s.label} : de ${pct(s.points[0].row.taux)} pour les arrivées d’avant 1990 à ${pct(s.points[s.points.length - 1].row.taux)} pour celles de 2015-2019`).join(" ; ")} ; nés en Nouvelle-Calédonie : ${pct(natif)}.`);
      }
    },

    // Haltères en deux panneaux : chômage et cadres par niveau de diplôme, puis
    // l'ensemble observé et à structure identique.
    "diplome-egal": {
      load: (root) => loadCsv(root.dataset.src),
      init: () => [],
      draw(ctx, rows) {
        const { svg, width, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const OBS = "Ensemble (taux observé)";
        const STD = "Ensemble, à âge, sexe et diplôme identiques";
        const niveaux = [...DIPLOMES.map((d) => d.id), OBS, STD];
        const names = compact
          ? { [OBS]: "Ensemble, observé", [STD]: "À âge, sexe et diplôme identiques" }
          : { [OBS]: "Ensemble, taux observé", [STD]: "Ensemble, à âge, sexe et diplôme identiques" };
        const panels = [
          { id: "chomage", title: "Chômage déclaré", sub: "en % des actifs" },
          { id: "cadres", title: "Cadres", sub: "en % des salariés" }
        ];
        const get = (ind, niveau, groupe) => rows.find((r) => r.indicateur === ind && r.niveau === niveau && r.groupe === groupe);
        let y = drawHeader(svg, ctx, width, "Chômage déclaré et accès aux postes de cadre", "Personnes de 25 à 64 ans selon le diplôme le plus élevé · recensement de 2019");
        y = drawGroupLegend(svg, rc, ctx, 18, y) + 14;
        const labelW = compact ? 124 : 210;
        const gapX = 36;
        const rowH = compact ? 36 : 32;
        const sepH = 18;
        const panelW = compact ? width - labelW - 30 : (width - labelW - gapX - 36) / 2;
        const parts = [];
        const drawPanel = (p, plotLeft, plotRight, top, withLabels) => {
          panelTitle(svg, p.title, withLabels && compact ? 18 : plotLeft, top, ctx, p.sub);
          const max = niceMax(d3.max(rows.filter((r) => r.indicateur === p.id), (r) => r.taux));
          const x = d3.scaleLinear().domain([0, max]).range([plotLeft, plotRight]);
          const axisTop = top + 36;
          let yy = axisTop + 4;
          const rowYs = niveaux.map((niveau, i) => {
            if (i === DIPLOMES.length) yy += sepH;
            const cy = yy + rowH / 2;
            yy += rowH;
            return cy;
          });
          drawAxis(svg, x, axisTop, yy, ctx);
          const sepY = rowYs[DIPLOMES.length] - rowH / 2 - sepH / 2;
          svg.append("line").attr("x1", withLabels ? 18 : plotLeft - 10).attr("x2", plotRight + 10).attr("y1", sepY).attr("y2", sepY)
            .attr("stroke", frame).attr("stroke-width", 0.8);
          niveaux.forEach((niveau, i) => {
            const cy = rowYs[i];
            const nc = get(p.id, niveau, NC);
            const metro = get(p.id, niveau, METRO);
            const name = names[niveau] || niveau;
            if (withLabels) {
              const maxChars = Math.floor((labelW - 14) / (compact ? 5.8 : 6.6));
              const lines = wrap(name, maxChars);
              lines.forEach((line, li) => label(svg, line, 18, cy + (li - (lines.length - 1) / 2) * 13, {
                size: compact ? 10.5 : 12, weight: i >= DIPLOMES.length ? 850 : 800
              }));
            }
            // Sur bureau, les valeurs basses peuvent déborder à gauche du tracé
            // (colonne des libellés ou espace entre les panneaux).
            dumbbell(svg, rc, ctx, x, cy, { ...NC_POINT, value: nc?.taux }, { ...METRO_POINT, value: metro?.taux },
              `${ctx.key}-${p.id}-${i}`, [plotLeft - (compact ? 4 : 34), plotRight + 30]);
            const aria = `${p.title}, ${name} : ${pct(nc?.taux)} des natifs, ${pct(metro?.taux)} des personnes nées en métropole ou dans un DOM`;
            parts.push(aria);
            hitArea(svg, ctx, plotLeft - 12, cy - rowH / 2, plotRight - plotLeft + 44, rowH, aria,
              () => tipComparaison(`${p.title} · ${name}`, p.sub, [[NC_POINT.label, nc], [METRO_POINT.label, metro]], "effectif_champ"));
          });
          return yy;
        };
        let end;
        if (compact) {
          const plotLeft = labelW + 8;
          const plotRight = width - 30;
          const first = drawPanel(panels[0], plotLeft, plotRight, y, true);
          end = drawPanel(panels[1], plotLeft, plotRight, first + 24, true);
        } else {
          const plotLeft = 18 + labelW;
          end = Math.max(
            drawPanel(panels[0], plotLeft, plotLeft + panelW, y, true),
            drawPanel(panels[1], plotLeft + panelW + gapX, plotLeft + 2 * panelW + gapX, y, false)
          );
        }
        const height = drawFooter(svg, rc, ctx, width, end + 14);
        finish(svg, ctx, width, height, `${parts.join(" ; ")}.`);
      }
    },

    // Barres groupées : surpeuplement et accès à internet par province.
    logement: {
      load: (root) => loadCsv(root.dataset.src),
      init: () => [],
      draw(ctx, rows) {
        const { svg, width, compact } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const panels = [
          { id: "surpeuplement", title: "Logement surpeuplé" },
          { id: "sans_internet", title: "Logement sans accès à internet" }
        ];
        const provinces = [["Sud", "Province Sud"], ["Nord", "Province Nord"], ["Iles", "Îles Loyauté"]];
        const get = (prov, groupe, ind) => rows.find((r) => r.province === prov && r.groupe === groupe && r.indicateur === ind);
        let y = drawHeader(svg, ctx, width, "Surpeuplement et accès à internet", "Personnes de 25 à 64 ans vivant en logement ordinaire, en %, selon la province de résidence · recensement de 2019");
        y = drawGroupLegend(svg, rc, ctx, 18, y) + 12;
        const gapX = 40;
        const panelW = compact ? width - 36 : (width - 36 - gapX) / 2;
        const panelH = compact ? 230 : 270;
        const parts = [];
        panels.forEach((p, pi) => {
          const px = compact ? 18 : 18 + pi * (panelW + gapX);
          const py = compact ? y + pi * (panelH + 16) : y;
          panelTitle(svg, p.title, px, py + 8, ctx);
          const left = px + 40;
          const right = px + panelW - 4;
          const top = py + 34;
          const bottom = py + panelH - 26;
          const max = niceMax(d3.max(rows.filter((r) => r.indicateur === p.id), (r) => r.taux));
          const ys = d3.scaleLinear().domain([0, max]).range([bottom, top]);
          drawYAxis(svg, ys, left, right, ctx);
          const groupW = (right - left) / provinces.length;
          const barW = Math.min(46, groupW * 0.32);
          provinces.forEach(([prov, provLabel], i) => {
            const cx = left + groupW * (i + 0.5);
            label(svg, provLabel, cx, bottom + 15, { anchor: "middle", size: compact ? 10.5 : 11.5, weight: 800, color: muted });
            const values = [];
            [[NC, colorNc], [METRO, colorMetro]].forEach(([groupe, color], k) => {
              const row = get(prov, groupe, p.id);
              if (!row) return;
              const bx = cx + (k ? 3 : -3 - barW);
              roughRect(svg, rc, bx, ys(row.taux), barW, bottom - ys(row.taux), {
                fill: color, hachureGap: 2.3, fillWeight: 1, stroke: hatchColor(color),
                dash: row.effectif_champ < SMALL ? [3, 2] : null, seed: `${ctx.key}-${p.id}-${prov}-${k}`
              });
              label(svg, pct(row.taux), bx + barW / 2, ys(row.taux) - 9, { anchor: "middle", size: compact ? 11 : 12, weight: 850, color });
              values.push([groupe === NC ? NC_POINT.label : METRO_POINT.label, row]);
            });
            const aria = `${p.title}, ${provLabel} : ${values.map(([n, r]) => `${COUNT_NAMES[n] || n.toLowerCase()} ${pct(r.taux)}`).join(", ")}`;
            parts.push(aria);
            hitArea(svg, ctx, cx - groupW / 2 + 4, top, groupW - 8, bottom - top, aria,
              () => tipComparaison(`${p.title} · ${provLabel}`, "En % des personnes en logement ordinaire", values, "effectif_champ"));
          });
          svg.append("line").attr("x1", left).attr("x2", right).attr("y1", bottom).attr("y2", bottom).attr("stroke", ink).attr("stroke-width", 0.9);
        });
        const end = compact ? y + 2 * panelH + 16 : y + panelH;
        const height = drawFooter(svg, rc, ctx, width, end + 8);
        finish(svg, ctx, width, height, `${parts.join(" ; ")}.`);
      }
    },

    // Matrice : classes d'âge de 2019 (lignes, des plus âgés aux plus jeunes)
    // croisées avec la date d'installation des personnes nées en métropole
    // (colonnes), exprimée par la période de la dernière installation ou par
    // l'âge à l'arrivée. Toutes les barres partagent une échelle ; le trait
    // vert situe les natifs du même âge.
    "generations-installation": {
      load: (root) => Promise.all([loadCsv(root.dataset.src), loadProfils(root.dataset.profilsSrc)])
        .then(([rows, profils]) => ({ rows, indicators: profils.indicators })),
      init(ctx, data) {
        ctx.state = {
          indicateur: ctx.root.dataset.defaultIndicator || "bac3",
          regroupement: ctx.root.dataset.defaultRegroupement === "age_arrivee" ? "age_arrivee" : "anciennete"
        };
        return [
          indicatorSelect(ctx, data.indicators, (value) => { ctx.state.indicateur = value; ctx.redraw(); }),
          buttonGroup("Regrouper les personnes nées en métropole selon", [["anciennete", "Période d’installation"], ["age_arrivee", "Âge à l’arrivée"]],
            ctx.state.regroupement, (value) => { ctx.state.regroupement = value; ctx.redraw(); })
        ];
      },
      draw(ctx, data) {
        const { svg, width, compact, state } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const indicator = data.indicators.find((i) => i.id === state.indicateur) || data.indicators[0];
        const byAge = state.regroupement === "age_arrivee";
        const classes = ["55-64", "45-54", "35-44", "25-34"];
        const rows = data.rows.filter((r) => r.regroupement === state.regroupement && r.indicateur === indicator.id);
        const get = (classe, groupe) => rows.find((r) => r.classe_age === classe && r.groupe === groupe);

        const labelW = compact ? 56 : 128;
        const sepW = compact ? 8 : 18;
        const gridLeft = 18 + labelW;
        const gridRight = width - 18;
        const nCols = 1 + (byAge ? AGE_ARRIVAL.length : 4);
        const colW = (gridRight - gridLeft - sepW) / nCols;
        const colX = (i) => gridLeft + i * colW + (i ? sepW : 0);
        const pad = compact ? 3 : 10;
        const headSize = compact ? 10 : 11.5;
        // En-têtes : la première variante dont toutes les lignes tiennent.
        const fits = (text) => textW(text, headSize) <= colW - pad - 2;
        const pick = (variants) => variants.find((lines) => lines.every(fits)) || variants[variants.length - 1];
        const split = (text) => (text.includes(" ")
          ? [text.slice(0, text.indexOf(" ")), text.slice(text.indexOf(" ") + 1)]
          : [text.slice(0, text.indexOf("-") + 1), text.slice(text.indexOf("-") + 1)]);
        const lighter = (color) => (d3.lab(color).l > 45 ? hatchColor(color) : color);
        const cols = [
          { groupe: NC, label: NC, color: colorNc, text: colorNc, natif: true, head: pick([[NC], ["Nés en", "Nouvelle-Calédonie"], ["Natifs"]]) },
          ...(byAge
            ? AGE_ARRIVAL.map((a) => ({ groupe: a.groupe, label: `${METRO_POINT.label}, ${a.label}`, color: colorMetro, text: colorMetro, head: pick([[a.court], a.lignes]) }))
            : DURATIONS.slice(0, 4).map((d) => ({
              groupe: d.groupe, label: `${METRO_POINT.label}, ${d.label}`, color: d.color, text: lighter(d.color), head: pick([[d.court], split(d.court)])
            })))
        ];
        const max = niceMax(d3.max(classes.flatMap((cl) => cols.map((c) => get(cl, c.groupe)?.taux))));

        let y = drawHeader(svg, ctx, width, indicator.libelle, `En % des ${indicator.champ}, selon l’âge en 2019 et ${byAge ? "l’âge à l’arrivée" : "la période de la dernière installation"} · recensement de 2019`);
        // Légende : repère des natifs, petits effectifs, échelle commune.
        const legendSize = compact ? 10.5 : 11.5;
        let lx = 18;
        [
          { kind: "tick", text: "natifs du même âge" },
          { kind: "dash", text: `moins de ${SMALL} personnes` },
          { kind: "scale", text: `barres de 0 à ${int0(max)} %` }
        ].forEach((item) => {
          const offset = item.kind === "scale" ? 0 : 20;
          const w = textW(item.text, legendSize) + offset;
          if (lx + w > width - 12 && lx > 18) {
            lx = 18;
            y += 18;
          }
          if (item.kind === "tick") {
            roughLine(svg, rc, lx + 6, y - 7, lx + 6, y + 7, { stroke: colorNc, strokeWidth: 1.6, dash: [3, 2], roughness: 0.4, seed: `${ctx.key}-legende-natifs` });
          } else if (item.kind === "dash") {
            svg.append("rect").attr("x", lx).attr("y", y - 5).attr("width", 14).attr("height", 10).attr("fill", "none")
              .attr("stroke", ink).attr("stroke-width", 0.8).attr("stroke-dasharray", "3 2");
          }
          label(svg, item.text, lx + offset, y, { size: legendSize, weight: 800, color: item.kind === "tick" ? colorNc : muted });
          lx += w + 18;
        });
        y += 28;

        // En-tête de groupe au-dessus des personnes nées en métropole.
        const spanX = colX(1) + pad;
        const spanText = byAge
          ? "Nés en métropole ou dans un DOM, selon l’âge à l’arrivée"
          : "Nés en métropole ou dans un DOM, selon la période de la dernière installation";
        const spanLines = wrap(spanText, Math.max(10, Math.floor((gridRight - spanX) / (headSize * 0.58))));
        spanLines.forEach((line, i) => label(svg, line, spanX, y + i * 14, { size: headSize, weight: 850, color: colorMetro }));
        y += (spanLines.length - 1) * 14 + 10;
        roughLine(svg, rc, spanX, y, gridRight - pad, y, { stroke: colorMetro, strokeWidth: 0.9, roughness: 0.5, seed: `${ctx.key}-groupe` });
        y += 14;
        const headLines = d3.max(cols, (c) => c.head.length);
        cols.forEach((c, i) => c.head.forEach((line, li) => {
          label(svg, line, colX(i) + pad, y + (li + headLines - c.head.length) * 13, { size: headSize, weight: 850, color: c.text });
        }));
        y += (headLines - 1) * 13 + 12;

        const rowH = compact ? 50 : 64;
        const gridTop = y;
        const gridBottom = gridTop + classes.length * rowH;
        roughLine(svg, rc, colX(1) - sepW / 2, gridTop, colX(1) - sepW / 2, gridBottom, { stroke: frame, strokeWidth: 1, roughness: 0.5, seed: `${ctx.key}-separation` });
        const parts = [];
        classes.forEach((classe, ri) => {
          const top = gridTop + ri * rowH;
          svg.append("line").attr("x1", 18).attr("x2", gridRight).attr("y1", top).attr("y2", top).attr("stroke", gridColor).attr("stroke-width", 1);
          const [a0, a1] = classe.split("-").map(Number);
          label(svg, `${classe} ans`, 18, top + rowH / 2 - 7, { size: compact ? 11 : 13, weight: 850 });
          label(svg, compact ? `${2019 - a1}-${String(2019 - a0).slice(2)}` : `nés en ${2019 - a1}-${2019 - a0}`, 18, top + rowH / 2 + 9,
            { size: compact ? 9.5 : 11, weight: 700, color: muted });
          const natif = get(classe, NC);
          const rowParts = [];
          cols.forEach((c, ci) => {
            const row = get(classe, c.groupe);
            const value = row?.taux;
            const x0 = colX(ci) + pad;
            const barW = colW - 2 * pad;
            const xs = d3.scaleLinear().domain([0, max]).range([x0, x0 + barW]);
            const valueY = top + (compact ? 14 : 17);
            const barY = top + (compact ? 24 : 28);
            const barH = compact ? 9 : 11;
            svg.append("rect").attr("x", x0).attr("y", barY).attr("width", barW).attr("height", barH)
              .attr("fill", "none").attr("stroke", gridColor).attr("stroke-width", 0.8);
            if (Number.isFinite(value)) {
              roughRect(svg, rc, x0, barY, xs(value) - x0, barH, {
                fill: c.color, hachureGap: 2.2, fillWeight: 1, stroke: hatchColor(c.color),
                dash: row.effectif_champ < SMALL ? [3, 2] : null, seed: `${ctx.key}-${classe}-${c.groupe}`
              });
              label(svg, pct(value), x0, valueY, { size: compact ? 11.5 : 13, weight: 850, color: c.text });
            } else {
              label(svg, "n.c.", x0, valueY, { size: 11, weight: 700, color: muted });
            }
            // Repère des natifs, sur un liseré papier pour rester visible sur
            // les barres foncées.
            if (!c.natif && Number.isFinite(natif?.taux)) {
              svg.append("line").attr("x1", xs(natif.taux)).attr("x2", xs(natif.taux)).attr("y1", barY - 5).attr("y2", barY + barH + 5)
                .attr("stroke", paper).attr("stroke-width", 4).attr("stroke-linecap", "round");
              roughLine(svg, rc, xs(natif.taux), barY - 5, xs(natif.taux), barY + barH + 5,
                { stroke: colorNc, strokeWidth: 1.8, dash: [3, 2], roughness: 0.4, seed: `${ctx.key}-natifs-${classe}-${ci}` });
            }
            // Âge médian à l'arrivée, si la place le permet.
            const age = row?.age_arrivee_median;
            if (!compact && !byAge && Number.isFinite(age)) {
              const text = [`arrivés à ${ans(age)} (médiane)`, `à ${ans(age)} (médiane)`].find((t) => textW(t, 10.5) <= barW);
              if (text) label(svg, text, x0, barY + barH + 13, { size: 10.5, weight: 700, color: muted });
            }
            rowParts.push(`${c.natif ? "natifs" : c.label.replace(`${METRO_POINT.label}, `, "")} ${pct(value)}`);
            hitArea(svg, ctx, colX(ci), top, colW, rowH, `${c.label}, ${classe} ans : ${pct(value)}`,
              () => tipGeneration(c.label, classe, indicator, row, c.natif ? null : natif));
          });
          parts.push(`${classe} ans : ${rowParts.join(", ")}`);
        });
        svg.append("line").attr("x1", 18).attr("x2", gridRight).attr("y1", gridBottom).attr("y2", gridBottom).attr("stroke", gridColor).attr("stroke-width", 1);
        const height = drawFooter(svg, rc, ctx, width, gridBottom + 14);
        finish(svg, ctx, width, height, `${indicator.libelle}, selon la classe d’âge en 2019 et ${byAge ? "l’âge à l’arrivée" : "la période d’installation"} : ${parts.join(" ; ")}.`);
      }
    },

    // Carte des IRIS : vue d'ensemble et agrandissement du Grand Nouméa.
    carte: {
      load: (root) => loadIris(root.dataset.src),
      init(ctx) {
        ctx.state = { metric: ctx.root.dataset.defaultMetric || "pct_hors" };
        const wrapLabel = document.createElement("label");
        wrapLabel.className = "habitat-map-control-label";
        wrapLabel.textContent = "Indicateur";
        const select = document.createElement("select");
        select.className = "habitat-map-select";
        Object.entries(MAP_METRICS).forEach(([key, def]) => {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = def.label;
          select.appendChild(option);
        });
        select.value = ctx.state.metric;
        select.addEventListener("change", () => { ctx.state.metric = select.value; ctx.redraw(); });
        wrapLabel.appendChild(select);
        return [wrapLabel];
      },
      draw(ctx, data) {
        const { svg, width, compact, state } = ctx;
        svg.selectAll("*").remove();
        const rc = rough.svg(svg.node());
        const def = { key: state.metric, ...MAP_METRICS[state.metric] };
        let y = drawHeader(svg, ctx, width, def.label, "En % des habitants de chaque IRIS · recensement de 2019");
        y = drawMapLegend(svg, rc, def, 18, y + 2, Math.min(width - 36, 520), ctx) + 12;

        const pad = 18;
        let ncBox;
        let gnBox;
        if (compact) {
          const w = width - 2 * pad;
          gnBox = [[pad, y], [pad + w, y + Math.round(w * 0.82)]];
          ncBox = [[pad, gnBox[1][1] + 12], [pad + w, gnBox[1][1] + 12 + Math.round(w * 0.8)]];
        } else {
          const w = width - 2 * pad - 14;
          const h = Math.round(w * 0.5);
          ncBox = [[pad, y], [pad + Math.round(w * 0.43), y + h]];
          gnBox = [[ncBox[1][0] + 14, y], [width - pad, y + h]];
        }
        const nc = drawMapPanel(svg, rc, ctx, data, def, ncBox, { title: "Nouvelle-Calédonie", terre: data.terreNc, focusable: (p) => !p.dans_gn, key: "nc" });
        drawMapPanel(svg, rc, ctx, data, def, gnBox, { title: "Grand Nouméa", terre: data.terreGn, bbox: data.vue, focusable: (p) => p.dans_gn, key: "gn" });
        // Emprise de l'agrandissement sur la vue d'ensemble.
        const [west, south, east, north] = data.vue;
        const [ax, ay] = nc.projection([west, north]);
        const [bx, by] = nc.projection([east, south]);
        roughRect(svg, rc, ax, ay, bx - ax, by - ay, { stroke: ink, strokeWidth: 1.1, roughness: 0.7, seed: `${ctx.key}-emprise` });
        if (!compact) {
          roughLine(svg, rc, bx, (ay + by) / 2, gnBox[0][0], (gnBox[0][1] + gnBox[1][1]) / 2,
            { stroke: muted, strokeWidth: 0.8, roughness: 0.6, seed: `${ctx.key}-rappel` });
        }

        const bottom = Math.max(ncBox[1][1], gnBox[1][1]);
        const note = wrap("Gris : IRIS sans habitant. Survolez ou sélectionnez un IRIS au clavier pour lire ses valeurs.",
          Math.floor((width - 36) / (compact ? 5.6 : 6.2)));
        note.forEach((line, index) => label(svg, line, 18, bottom + 14 + index * 13, { size: compact ? 10 : 11, weight: 700, color: muted }));
        const height = drawFooter(svg, rc, ctx, width, bottom + 19 + note.length * 13);
        svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
        svg.attr("aria-label", `${def.label}. ${ctx.title}. Carte des IRIS de Nouvelle-Calédonie et agrandissement du Grand Nouméa.`);
      }
    }
  };

  function classOf(value, def) {
    if (value == null || !Number.isFinite(+value)) return -1;
    return Math.min(d3.bisectRight(def.thresholds, +value), def.colors.length - 1);
  }

  function legendLabel(index, thresholds) {
    if (index === 0) return `< ${thresholds[0]} %`;
    if (index === thresholds.length) return `≥ ${thresholds[index - 1]} %`;
    return `${thresholds[index - 1]}–${thresholds[index]} %`;
  }

  function drawMapLegend(svg, rc, def, x, y, width, ctx) {
    const item = width / def.colors.length;
    def.colors.forEach((fill, index) => {
      const x0 = x + index * item;
      svg.append("rect").attr("x", x0).attr("y", y).attr("width", item - 4).attr("height", 11).attr("fill", fill);
      roughRect(svg, rc, x0, y, item - 4, 11, {
        fill: hatchColor(fill), hachureGap: index ? 3 - index * 0.2 : 4, fillWeight: 0.45, strokeWidth: 0.5,
        roughness: 1, opacity: 0.7, seed: `${ctx.key}-legende-${def.key}-${index}`
      });
      label(svg, legendLabel(index, def.thresholds), x0 + (item - 4) / 2, y + 23, { anchor: "middle", size: ctx.compact ? 10 : 11, weight: 800, color: muted });
    });
    return y + 30;
  }

  let clipCounter = 0;

  function drawMapPanel(svg, rc, ctx, data, def, box, options) {
    const [[x0, y0], [x1, y1]] = box;
    svg.append("rect").attr("x", x0).attr("y", y0).attr("width", x1 - x0).attr("height", y1 - y0).attr("fill", paper);
    roughRect(svg, rc, x0, y0, x1 - x0, y1 - y0, { stroke: "#b9b1a5", strokeWidth: 0.8, seed: `${ctx.key}-${options.key}-cadre` });
    label(svg, options.title, x0 + 8, y0 + 13, { family: fontSketch, size: ctx.compact ? 14 : 15, weight: 700 });
    const inner = [[x0 + 4, y0 + 24], [x1 - 4, y1 - 4]];
    const projection = d3.geoMercator();
    if (options.bbox) {
      const [west, south, east, north] = options.bbox;
      projection.fitExtent(inner, { type: "MultiPoint", coordinates: [[west, south], [east, north]] });
    } else {
      projection.fitExtent(inner, { type: "FeatureCollection", features: options.terre });
    }
    const path = d3.geoPath(projection);
    const id = `origines-clip-${++clipCounter}`;
    svg.append("defs").append("clipPath").attr("id", id).append("rect")
      .attr("x", inner[0][0]).attr("y", inner[0][1]).attr("width", inner[1][0] - inner[0][0]).attr("height", inner[1][1] - inner[0][1]);
    const g = svg.append("g").attr("clip-path", `url(#${id})`);
    const [[ix0, iy0], [ix1, iy1]] = inner;
    data.iris.forEach((feature) => {
      const p = feature.properties;
      const bounds = path.bounds(feature);
      if (bounds[1][0] < ix0 || bounds[0][0] > ix1 || bounds[1][1] < iy0 || bounds[0][1] > iy1) return;
      const d = path(feature);
      if (!d) return;
      const value = p.population > 0 ? p[def.key] : null;
      const cls = classOf(value, def);
      const fill = cls < 0 ? noData : def.colors[cls];
      const node = g.append("path").attr("d", d).attr("fill", fill).attr("stroke", "#4f4942").attr("stroke-width", options.key === "gn" ? 0.45 : 0.3)
        .attr("stroke-opacity", 0.55).attr("stroke-linejoin", "round");
      if (cls >= 0) {
        roughPath(g, rc, d, {
          fill: hatchColor(fill), hachureGap: cls ? 3.4 - cls * 0.3 : 4.4, fillWeight: 0.5, stroke: "none", strokeWidth: 0,
          roughness: 1.2, opacity: cls ? 0.45 : 0.3, seed: `${ctx.key}-${options.key}-${p.id}`
        });
      }
      if (options.focusable(p)) {
        node.attr("class", "origines-iris").attr("tabindex", 0).attr("role", "img")
          .attr("aria-label", `${p.iris} (${p.commune}) : ${p.population > 0 ? pct(p[def.key]) : "sans habitant"}`);
        bindTip(node, ctx, () => tipIris(p, def));
      }
    });
    // Côte crayonnée : grandes îles au crayon, îlots en trait simple.
    const small = [];
    polygonsOf(options.terre).forEach((coordinates, index) => {
      const shape = { type: "Polygon", coordinates };
      const d = path(shape);
      if (!d) return;
      if (path.area(shape) < 30) small.push(d);
      else roughPath(g, rc, d, { strokeWidth: 0.9, roughness: 0.9, seed: `${ctx.key}-${options.key}-cote-${index}` });
    });
    if (small.length) g.append("path").attr("d", small.join("")).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 0.5);
    return { projection, path, inner };
  }

  function tipIris(p, def) {
    if (!(p.population > 0)) return `<strong>${escapeHtml(p.iris)}</strong><span>${escapeHtml(p.commune)} · IRIS sans habitant recensé.</span>`;
    const others = Object.keys(MAP_METRICS).filter((k) => k !== def.key);
    return `<strong>${escapeHtml(p.iris)}</strong>
      <span>${escapeHtml(p.commune)} · ${int0(p.population)} habitants</span>
      <div class="origines-tip-grid">
        <span><b>${escapeHtml(def.label)}</b></span><b>${pct(p[def.key])}</b>
        ${others.map((k) => `<span>${escapeHtml(MAP_METRICS[k].label)}</span><b>${pct(p[k])}</b>`).join("")}
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Montage des figures
  // ---------------------------------------------------------------------------

  function mount(root) {
    const type = root.dataset.originesChart;
    const chart = charts[type];
    if (!chart) return;
    const ctx = {
      root,
      key: root.id || `origines-${type}`,
      title: root.dataset.title || "",
      source: root.dataset.source || ""
    };
    chart.load(root).then((data) => {
      root.querySelectorAll(".habitat-sketch-loading").forEach((node) => node.remove());
      const tools = document.createElement("div");
      tools.className = "habitat-sketch-tools";
      const controls = document.createElement("div");
      controls.className = "origines-controls";
      tools.appendChild(controls);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "habitat-sketch-download";
      button.textContent = "Télécharger en PNG";
      button.setAttribute("aria-label", `Télécharger la figure « ${ctx.title} » en PNG`);
      ctx.downloadButton = button;
      tools.appendChild(button);
      root.appendChild(tools);
      const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgNode.setAttribute("role", "img");
      root.appendChild(svgNode);
      const tooltip = document.createElement("div");
      tooltip.className = "habitat-tooltip origines-tooltip";
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
      fail(root, "Les données de la figure n’ont pas pu être chargées. Les valeurs restent disponibles dans le tableau qui suit.");
    });
  }

  figures.forEach(mount);

  // ---------------------------------------------------------------------------
  // Croquis du résumé « En bref » (viewBox 420 × 240)
  // ---------------------------------------------------------------------------

  function signature(svg) {
    label(svg, "contours.nc", 414, 233, { anchor: "end", family: fontSketch, size: 11, weight: 700, color: muted });
  }

  function caption(svg, text) {
    label(svg, text, 6, 233, { size: 8.5, weight: 760, color: muted });
  }

  // Barres horizontales : libellés à gauche, valeurs nettes en bout de barre.
  function briefBars(svg, rc, items, { key, max, left = 150, top = 14, bottom = 214, refValue = null, refLabel = "" }) {
    const x = d3.scaleLinear().domain([0, max]).range([left, 372]);
    const step = (bottom - top) / items.length;
    const barH = Math.min(items.length <= 2 ? 34 : 22, step * 0.58);
    items.forEach((item, index) => {
      const cy = top + step * index + step / 2;
      const lines = wrap(item.label, Math.floor((left - 12) / 5.4));
      lines.forEach((line, i) => label(svg, line, 6, cy + (i - (lines.length - 1) / 2) * 11, {
        size: 9.5, weight: 850, color: item.labelColor || ink
      }));
      if (!Number.isFinite(item.value)) return;
      roughRect(svg, rc, x(0), cy - barH / 2, x(item.value) - x(0), barH, {
        fill: item.color, hachureGap: 2, fillWeight: 1, stroke: hatchColor(item.color), seed: `brief-${key}-${item.label}`
      });
      label(svg, pct(item.value), x(item.value) + 5, cy, { size: 11, weight: 850, color: item.labelColor || ink });
    });
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top).attr("y2", bottom).attr("stroke", ink).attr("stroke-width", 0.8);
    if (Number.isFinite(refValue)) {
      roughLine(svg, rc, x(refValue), top - 4, x(refValue), bottom, { stroke: colorNc, strokeWidth: 1.3, dash: [4, 3], seed: `brief-${key}-ref` });
      label(svg, refLabel, x(refValue) + 3, bottom + 8, { size: 8.5, weight: 850, color: colorNc });
    }
  }

  const sketches = {
    // Natifs et personnes nées en métropole, un indicateur.
    ecart(svg, rc, node, data) {
      const ind = node.dataset.indicateur;
      const t = "Nouvelle-Calédonie";
      const items = [
        { label: NC, value: data.profils.get(t, "naissance2", NC, ind).taux, color: colorNc, labelColor: colorNc },
        { label: METRO_POINT.label, value: data.profils.get(t, "naissance", METRO, ind).taux, color: colorMetro, labelColor: colorMetro }
      ];
      briefBars(svg, rc, items, { key: `ecart-${ind}`, max: niceMax(d3.max(items, (i) => i.value)), top: 30, bottom: 200 });
      const indicator = data.profils.indicators.find((i) => i.id === ind);
      caption(svg, `${indicator.libelle} · ${indicator.champ}`);
      signature(svg);
    },

    // Les cinq lieux de naissance, triés.
    origines(svg, rc, node, data) {
      const ind = node.dataset.indicateur;
      const t = "Nouvelle-Calédonie";
      const items = [{ groupe: "Nouvelle-Calédonie", label: "Nouvelle-Calédonie", color: colorNc }, ...ORIGINS.map((o) => ({ groupe: o.groupe, label: o.court, color: o.color }))]
        .map((o) => ({ ...o, labelColor: o.color === colorNc ? colorNc : hatchColor(o.color), value: data.profils.get(t, "naissance", o.groupe, ind).taux }))
        .sort((a, b) => d3.descending(a.value, b.value));
      briefBars(svg, rc, items, { key: `origines-${ind}`, max: niceMax(d3.max(items, (i) => i.value)), left: 118, top: 8, bottom: 214 });
      const indicator = data.profils.indicators.find((i) => i.id === ind);
      caption(svg, `${indicator.libelle} selon le lieu de naissance · 25-64 ans`);
      signature(svg);
    },

    // Personnes nées en métropole selon la période d'arrivée, avec le repère
    // des natifs.
    anciennete(svg, rc, node, data) {
      const ind = node.dataset.indicateur;
      const t = "Nouvelle-Calédonie";
      const items = DURATIONS.slice(0, 4).map((d) => ({
        label: `Arrivés ${d.court === "avant 1990" ? "avant 1990" : `en ${d.court}`}`,
        value: data.profils.get(t, "naissance_anciennete", `${METRO} · ${d.groupe}`, ind).taux,
        color: d.color,
        labelColor: hatchColor(d.color)
      }));
      const ref = data.profils.get(t, "naissance2", NC, ind).taux;
      briefBars(svg, rc, items, {
        key: `anciennete-${ind}`, max: niceMax(d3.max(items, (i) => i.value)), left: 128, top: 8, bottom: 206,
        refValue: ref, refLabel: `Nés en Nouvelle-Calédonie : ${pct(ref)}`
      });
      const indicator = data.profils.indicators.find((i) => i.id === ind);
      caption(svg, `${indicator.libelle} · nés en métropole ou dans un DOM, 25-64 ans`);
      signature(svg);
    },

    // Une classe d'âge : natifs, puis personnes nées en métropole selon leur
    // âge à l'arrivée.
    generation(svg, rc, node, data) {
      const ind = node.dataset.indicateur;
      const classe = node.dataset.classe;
      const rows = (data.generations || []).filter((r) => r.regroupement === "age_arrivee" && r.classe_age === classe && r.indicateur === ind);
      const value = (groupe) => rows.find((r) => r.groupe === groupe)?.taux;
      const items = [
        { label: NC, value: value(NC), color: colorNc, labelColor: colorNc },
        ...AGE_ARRIVAL.map((a) => ({ label: `Nés en métropole, ${a.label}`, value: value(a.groupe), color: colorMetro, labelColor: colorMetro }))
      ];
      if (items.some((i) => !Number.isFinite(i.value))) throw new Error("Données du croquis « generation » absentes");
      briefBars(svg, rc, items, { key: `generation-${ind}-${classe}`, max: niceMax(d3.max(items, (i) => i.value)), left: 150, top: 8, bottom: 214 });
      const indicator = data.profils.indicators.find((i) => i.id === ind);
      caption(svg, `${indicator.libelle} · ${classe} ans en 2019`);
      signature(svg);
    },

    // Deux indicateurs, natifs et personnes nées en métropole côte à côte.
    paires(svg, rc, node, data) {
      const ids = node.dataset.indicateurs.split(",");
      const t = "Nouvelle-Calédonie";
      const groups = ids.map((id) => ({
        indicator: data.profils.indicators.find((i) => i.id === id),
        nc: data.profils.get(t, "naissance2", NC, id).taux,
        metro: data.profils.get(t, "naissance", METRO, id).taux
      }));
      const max = niceMax(d3.max(groups, (g) => Math.max(g.nc, g.metro)));
      const y = d3.scaleLinear().domain([0, max]).range([196, 30]);
      const groupW = 404 / groups.length;
      groups.forEach((g, gi) => {
        const cx = 8 + groupW * gi + groupW / 2;
        wrap(g.indicator.libelle, 30).forEach((line, li) => label(svg, line, cx, 8 + li * 11, { anchor: "middle", size: 9.5, weight: 850 }));
        [["nc", colorNc], ["metro", colorMetro]].forEach(([k, color], bi) => {
          const bx = cx + (bi ? 8 : -62);
          roughRect(svg, rc, bx, y(g[k]), 54, 196 - y(g[k]), { fill: color, hachureGap: 2.2, fillWeight: 1, stroke: hatchColor(color), seed: `brief-paires-${g.indicator.id}-${k}` });
          label(svg, pct(g[k]), bx + 27, y(g[k]) - 9, { anchor: "middle", size: 11.5, weight: 850, color });
        });
        svg.append("line").attr("x1", cx - 72).attr("x2", cx + 72).attr("y1", 196).attr("y2", 196).attr("stroke", ink).attr("stroke-width", 0.8);
      });
      label(svg, "■ Nés en Nouvelle-Calédonie", 6, 210, { size: 9, weight: 850, color: colorNc });
      label(svg, "■ Nés en métropole ou dans un DOM", 160, 210, { size: 9, weight: 850, color: colorMetro });
      caption(svg, "Personnes de 25 à 64 ans");
      signature(svg);
    },

    // Chômage par niveau de diplôme : natifs et personnes nées en métropole.
    "diplome-egal"(svg, rc, node, data) {
      const rows = (data.diplome || []).filter((r) => r.indicateur === "chomage");
      if (!rows.length) throw new Error("Données du croquis « diplome-egal » absentes");
      const left = 112;
      const x = d3.scaleLinear().domain([0, niceMax(d3.max(rows, (r) => r.taux))]).range([left, 380]);
      const top = 10;
      const step = 182 / DIPLOMES.length;
      DIPLOMES.forEach((d, i) => {
        const cy = top + step * i + step / 2;
        const nc = rows.find((r) => r.niveau === d.id && r.groupe === NC)?.taux;
        const metro = rows.find((r) => r.niveau === d.id && r.groupe === METRO)?.taux;
        label(svg, d.id, 6, cy, { size: 9.5, weight: 850 });
        svg.append("line").attr("x1", left).attr("x2", 380).attr("y1", cy).attr("y2", cy).attr("stroke", gridColor).attr("stroke-width", 0.6);
        if (!Number.isFinite(nc) || !Number.isFinite(metro)) return;
        roughLine(svg, rc, x(metro), cy, x(nc), cy, { stroke: linkColor, strokeWidth: 2.2, roughness: 0.45, seed: `brief-diplome-${i}` });
        marker(svg, rc, "square", x(metro), cy, 9, colorMetro, `brief-diplome-h-${i}`);
        marker(svg, rc, "circle", x(nc), cy, 9, colorNc, `brief-diplome-n-${i}`);
        label(svg, pct(nc), x(nc) + 8, cy, { size: 9.5, weight: 850, color: colorNc });
        if (x(metro) - 8 - textW(pct(metro), 9.5) > left) label(svg, pct(metro), x(metro) - 8, cy, { anchor: "end", size: 9.5, weight: 850, color: colorMetro });
      });
      label(svg, "● Nés en Nouvelle-Calédonie", 6, 210, { size: 9, weight: 850, color: colorNc });
      label(svg, "■ Nés en métropole ou dans un DOM", 170, 210, { size: 9, weight: 850, color: colorMetro });
      caption(svg, "Chômage déclaré selon le diplôme · actifs de 25 à 64 ans");
      signature(svg);
    },

    // Part des natifs dans la population et parmi les personnes pauvres.
    pauvrete(svg, rc, node) {
      const population = parseFloat(node.dataset.population);
      const pauvres = parseFloat(node.dataset.pauvres);
      briefBars(svg, rc, [
        { label: "Dans l’ensemble de la population", value: population, color: colorNc, labelColor: colorNc },
        { label: "Parmi les personnes pauvres", value: pauvres, color: colorNc, labelColor: colorNc }
      ], { key: "pauvrete", max: 100, top: 30, bottom: 200 });
      caption(svg, "Part des natifs du pays · 2019 · Isee (recensement, enquête BDF)");
      signature(svg);
    },

    // Vue d'ensemble réduite (dernière diapositive).
    "carte-nc"(svg, rc, node, data) {
      const def = { key: node.dataset.metric, ...MAP_METRICS[node.dataset.metric] };
      const projection = d3.geoMercator().fitExtent([[8, 8], [412, 222]], { type: "FeatureCollection", features: data.iris.terreNc });
      const path = d3.geoPath(projection);
      data.iris.iris.forEach((feature) => {
        const p = feature.properties;
        const cls = classOf(p.population > 0 ? p[def.key] : null, def);
        svg.append("path").attr("d", path(feature)).attr("fill", cls < 0 ? noData : def.colors[cls]).attr("stroke", "#4f4942").attr("stroke-width", 0.25).attr("stroke-opacity", 0.45);
      });
      polygonsOf(data.iris.terreNc).forEach((coordinates, index) => {
        const shape = { type: "Polygon", coordinates };
        if (path.area(shape) > 20) roughPath(svg, rc, path(shape), { strokeWidth: 0.9, roughness: 1, seed: `brief-nc-cote-${index}` });
      });
      caption(svg, "Recensement de 2019 · 271 407 habitants · 162 IRIS");
      signature(svg);
    },

    // Nouméa et ses abords, avec la légende des classes. Le cadrage suit le
    // plus grand polygone de chaque IRIS de la commune, pour écarter les îlots
    // éloignés ; les communes voisines remplissent les côtés.
    "carte-gn"(svg, rc, node, data) {
      const def = { key: node.dataset.metric, ...MAP_METRICS[node.dataset.metric] };
      const box = [[6, 6], [414, 196]];
      const largest = (polygons) => polygons.reduce((a, b) => (d3.geoArea({ type: "Polygon", coordinates: b }) > d3.geoArea({ type: "Polygon", coordinates: a }) ? b : a));
      const noumea = data.iris.iris
        .filter((f) => f.properties.commune === "Nouméa")
        .map((f) => largest(polygonsOf([f])));
      const projection = d3.geoMercator().fitExtent(box, { type: "MultiPolygon", coordinates: noumea });
      const path = d3.geoPath(projection);
      const clip = `origines-brief-clip-${++clipCounter}`;
      svg.append("defs").append("clipPath").attr("id", clip).append("rect")
        .attr("x", box[0][0]).attr("y", box[0][1]).attr("width", box[1][0] - box[0][0]).attr("height", box[1][1] - box[0][1]);
      const g = svg.append("g").attr("clip-path", `url(#${clip})`);
      data.iris.iris.forEach((feature) => {
        const p = feature.properties;
        if (!p.grand_noumea) return;
        const d = path(feature);
        if (!d) return;
        const cls = classOf(p.population > 0 ? p[def.key] : null, def);
        g.append("path").attr("d", d).attr("fill", cls < 0 ? noData : def.colors[cls]).attr("stroke", "#4f4942").attr("stroke-width", 0.35).attr("stroke-opacity", 0.5);
      });
      polygonsOf(data.iris.terreGn).forEach((coordinates, index) => {
        const shape = { type: "Polygon", coordinates };
        if (path.area(shape) > 20) roughPath(g, rc, path(shape), { strokeWidth: 0.9, roughness: 1, seed: `brief-gn-cote-${index}` });
      });
      def.colors.forEach((fill, index) => {
        const x0 = 6 + index * 54;
        svg.append("rect").attr("x", x0).attr("y", 204).attr("width", 14).attr("height", 9).attr("fill", fill).attr("stroke", "#8f877b").attr("stroke-width", 0.5);
        label(svg, legendLabel(index, def.thresholds), x0 + 17, 208.5, { size: 8.5, weight: 800, color: muted });
      });
      caption(svg, `${def.label}, % par IRIS · 2019`);
      signature(svg);
    },

    // Répartition des 25-64 ans selon le lieu de naissance.
    composition(svg, rc, node, data) {
      const t = "Nouvelle-Calédonie";
      const total = data.profils.get(t, "ensemble", ENSEMBLE, "bac3").effectif_champ;
      const items = [{ groupe: "Nouvelle-Calédonie", label: "Nouvelle-Calédonie", color: colorNc }, ...ORIGINS.map((o) => ({ groupe: o.groupe, label: o.court, color: o.color }))]
        .map((o) => ({
          ...o,
          labelColor: o.color === colorNc ? colorNc : hatchColor(o.color),
          value: 100 * data.profils.get(t, "naissance", o.groupe, "bac3").effectif_champ / total
        }))
        .sort((a, b) => d3.descending(a.value, b.value));
      briefBars(svg, rc, items, { key: "composition", max: 100, left: 118, top: 8, bottom: 214 });
      caption(svg, "Répartition des 25-64 ans selon le lieu de naissance · 2019");
      signature(svg);
    }
  };

  function drawBrief(root, container) {
    const profilsSrc = root.dataset.profilsSrc;
    const irisSrc = root.dataset.irisSrc;
    const diplomeSrc = root.dataset.diplomeSrc;
    const generationsSrc = root.dataset.generationsSrc;
    return Promise.all([
      loadProfils(profilsSrc),
      loadIris(irisSrc),
      diplomeSrc ? loadCsv(diplomeSrc) : Promise.resolve(null),
      generationsSrc ? loadCsv(generationsSrc) : Promise.resolve(null)
    ]).then(([profils, iris, diplome, generations]) => {
      const data = { profils, iris, diplome, generations };
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
