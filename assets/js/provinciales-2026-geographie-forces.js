(() => {
  "use strict";

  // Cartes comparées 2019-2026 (une instance par province), synthèse
  // communale et intra-communale, croquis des diapositives « En bref ».
  const mapRoots = Array.from(document.querySelectorAll("[data-provinciales-geographie]"));
  const briefRoots = Array.from(document.querySelectorAll("[data-provinciales-brief]"));
  const scatterRoots = Array.from(document.querySelectorAll("[data-provinciales-scatter]"));
  if ((!mapRoots.length && !briefRoots.length && !scatterRoots.length) || !window.d3 || !window.rough) return;

  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const frame = "#d5ccbe";
  const noData = "#e9e5dd";
  const decrease = "#c54832";
  const increase = "#237a67";
  // Classes d'évolution : du recul fort (rouge) à la hausse forte (vert).
  const deltaColors = ["#7a1f14", "#bc4630", "#e8957b", "#f1ebe1", "#86c4aa", "#2c8a6b", "#11503e"];
  const NODATA = -1e6;
  const FLOOR = -1000;
  const provinceSlug = {
    "Province Sud": "sud",
    "Province Nord": "nord",
    "Province des Iles": "iles"
  };
  const provinceFromSlug = Object.fromEntries(
    Object.entries(provinceSlug).map(([province, slug]) => [slug, province])
  );
  const provinceDisplay = {
    "Province Sud": "province Sud",
    "Province Nord": "province Nord",
    "Province des Iles": "province des Îles"
  };
  const defaultForce = {
    "Province Sud": "loyaliste",
    "Province Nord": "uc_flnks",
    "Province des Iles": "dynamique_autochtone"
  };
  const format0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const format1 = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const formatKm = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  const signed1 = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always"
  });

  // ---------------------------------------------------------------------------
  // Outils partagés
  // ---------------------------------------------------------------------------

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
      .attr("font-family", options.family || "Atkinson Hyperlegible, sans-serif")
      .attr("font-size", options.size || 12)
      .attr("font-weight", options.weight || 400)
      .attr("fill", options.color || ink)
      .attr("paint-order", options.halo ? "stroke" : null)
      .attr("stroke", options.halo ? paper : null)
      .attr("stroke-width", options.halo ? (options.haloWidth || 2.8) : null)
      .attr("stroke-linejoin", options.halo ? "round" : null)
      .attr("pointer-events", "none")
      .text(text);
  }

  function roughPath(parent, rc, pathData, options = {}) {
    if (!pathData) return null;
    const node = rc.path(pathData, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "solid",
      hachureGap: options.hachureGap,
      hachureAngle: options.hachureAngle,
      fillWeight: options.fillWeight,
      stroke: options.stroke == null ? ink : options.stroke,
      strokeWidth: options.strokeWidth == null ? 0.9 : options.strokeWidth,
      roughness: options.roughness == null ? 1.25 : options.roughness,
      bowing: options.bowing == null ? 0.85 : options.bowing,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: seed(options.seed || pathData.slice(0, 100))
    });
    parent.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughRect(parent, rc, x, y, width, height, options = {}) {
    const node = rc.rectangle(x, y, width, height, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap,
      hachureAngle: options.hachureAngle,
      fillWeight: options.fillWeight,
      stroke: options.stroke == null ? ink : options.stroke,
      strokeWidth: options.strokeWidth == null ? 0.6 : options.strokeWidth,
      roughness: options.roughness == null ? 1.5 : options.roughness,
      bowing: options.bowing == null ? 1.2 : options.bowing,
      seed: seed(options.seed || `${x}-${y}-${width}-${height}`)
    });
    parent.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughCircle(parent, rc, x, y, diameter, options = {}) {
    const node = rc.circle(x, y, diameter, {
      fill: options.fill || paper,
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 2.2 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -38 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.7 : options.fillWeight,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.75 : options.strokeWidth,
      roughness: options.roughness == null ? 1.25 : options.roughness,
      bowing: options.bowing == null ? 0.8 : options.bowing,
      seed: seed(options.seed || `${x}-${y}-${diameter}`)
    });
    parent.node().appendChild(node);
    return d3.select(node).attr("pointer-events", "none");
  }

  function positionTooltip(container, tooltip, event) {
    const bounds = container.getBoundingClientRect();
    const margin = 10;
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

  function downloadPng(svg, button, filename) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "…";
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const box = svg.viewBox.baseVal;
    const width = box?.width || svg.clientWidth;
    const height = box?.height || svg.clientHeight;
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
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
        button.disabled = false;
        button.textContent = previous;
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      button.disabled = false;
      button.textContent = previous;
    };
    image.src = url;
  }

  // Seuils arrondis tirés des quantiles des valeurs : chaque classe couvre une
  // part comparable du territoire, ce qui maximise le contraste visible. Les
  // seuils sont arrondis à un pas lisible puis dédoublonnés.
  function roundedBreaks(sorted, probabilities, minimum = -Infinity) {
    const span = (d3.quantileSorted(sorted, 0.98) || 0) - (d3.quantileSorted(sorted, 0.02) || 0);
    const unit = span > 40 ? 5 : span > 16 ? 2 : 1;
    const breaks = [];
    probabilities.forEach((probability) => {
      const value = Math.max(minimum, Math.round(d3.quantileSorted(sorted, probability) / unit) * unit);
      if (!breaks.length || value > breaks[breaks.length - 1]) breaks.push(value);
    });
    return breaks;
  }

  // Classes de score partagées par 2019 et 2026. Luminosité régulièrement
  // espacée (L* de 95 à 22) dans la teinte de la force ; l'écart des hachures
  // se resserre en parallèle, pour ne pas dépendre de la seule couleur.
  function scoreClasses(color, values, classCount = 7) {
    const sorted = values.filter((value) => Number.isFinite(value) && value > FLOOR).sort(d3.ascending);
    const breaks = roundedBreaks(sorted, d3.range(1, classCount).map((k) => k / classCount))
      .filter((value) => value > 0 && value < 100);
    const count = breaks.length + 1;
    const base = d3.lch(color);
    const chroma = Math.max(base.c, 38);
    // Une teinte claire (jaune UNI) s'arrête à un ocre soutenu plutôt qu'à un
    // brun, pour rester reconnaissable.
    const light = base.l > 70;
    const darkest = light ? 45 : 22;
    const ramp = (t) => d3.lch(
      96 - (96 - darkest) * t,
      chroma * (light ? 0.5 + 0.7 * t : 0.22 + 0.85 * t),
      base.h
    );
    const labels = d3.range(count).map((index) => {
      if (count === 1) return "toutes valeurs";
      if (index === 0) return `< ${format0.format(breaks[0])}`;
      if (index === count - 1) return `≥ ${format0.format(breaks[count - 2])}`;
      return `${format0.format(breaks[index - 1])}–${format0.format(breaks[index])}`;
    });
    return {
      thresholds: [FLOOR, ...breaks],
      colors: d3.range(count).map((index) => ramp(count === 1 ? 0.6 : index / (count - 1)).formatHex()),
      labels,
      hatch: d3.range(count).map((index) => ({
        angle: -41,
        gap: count === 1 ? 3.4 : 5 - (2.6 * index) / (count - 1)
      }))
    };
  }

  // Sept classes symétriques : une bande centrale fixe de ±1 point, puis
  // trois niveaux de recul et trois niveaux de hausse dont les deux seuils
  // extérieurs suivent la distribution des écarts absolus. Reculs et hausses
  // sont hachurés dans des sens opposés.
  function deltaClasses(values) {
    const sorted = values.filter((value) => Number.isFinite(value) && value > FLOOR)
      .map(Math.abs).sort(d3.ascending);
    const [second, third] = roundedBreaks(sorted, [0.4, 0.8], 2);
    const a = 1;
    const b = Math.max(second || 2, 2);
    const c = Math.max(third || b + 1, b + 1);
    const signed = (value) => (value > 0 ? `+${format0.format(value)}` : `−${format0.format(-value)}`);
    return {
      thresholds: [FLOOR, -c, -b, -a, a, b, c],
      colors: deltaColors,
      labels: [
        `< ${signed(-c)}`,
        `${signed(-c)} à ${signed(-b)}`,
        `${signed(-b)} à ${signed(-a)}`,
        `±${format0.format(a)}`,
        `${signed(a)} à ${signed(b)}`,
        `${signed(b)} à ${signed(c)}`,
        `≥ ${signed(c)}`
      ],
      hatch: [
        { angle: 45, gap: 2.4 },
        { angle: 45, gap: 3.3 },
        { angle: 45, gap: 4.6 },
        null,
        { angle: -45, gap: 4.6 },
        { angle: -45, gap: 3.3 },
        { angle: -45, gap: 2.4 }
      ]
    };
  }

  function classIndex(classes, value) {
    if (!Number.isFinite(value)) return -1;
    return Math.max(0, d3.bisectRight(classes.thresholds, value) - 1);
  }

  function textColor(color) {
    const lab = d3.lab(color);
    return lab.l > 55 ? d3.lab(48, lab.a, lab.b).formatHex() : color;
  }

  function hatchColor(color) {
    const lab = d3.lab(color);
    return d3.lab(Math.max(10, lab.l - 30), lab.a, lab.b).formatHex();
  }

  function ringsToPath(geometry, transform) {
    let pathData = "";
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([x, y], index) => {
          const [px, py] = transform(x, y);
          pathData += `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
        });
        pathData += "Z";
      });
    });
    return pathData;
  }

  // Bandes de classes vectorisées par marching squares. Chaque bande est la
  // différence entre deux isolignes emboîtées, rendue en pair-impair.
  function classBands(grid, values, thresholds) {
    const contours = d3.contours()
      .size([grid.nx, grid.ny])
      .thresholds(thresholds)(values);
    const transform = (x, y) => [grid.ox + x * grid.step, grid.oy + y * grid.step];
    const outlines = contours.map((contour) => ringsToPath(contour, transform));
    return outlines.map((outline, index) => ({
      index,
      outline,
      d: outline ? outline + (outlines[index + 1] || "") : ""
    }));
  }

  function titleCaseCommune(value, province) {
    const raw = String(value || "").toLocaleLowerCase("fr-FR");
    const special = new Map([
      ["ile des pins", "Île des Pins"],
      ["l'ile-des-pins", "Île des Pins"],
      ["île-des-pins", "Île des Pins"],
      ["mont dore", "Mont-Dore"],
      ["le mont-dore", "Mont-Dore"],
      ["kaala gomen", "Kaala-Gomen"],
      ["kaala-gomen", "Kaala-Gomen"],
      ["kalaa-gomen", "Kaala-Gomen"],
      ["bouloupari", "Boulouparis"]
    ]);
    let labelText = special.get(raw) || raw.replace(/(^|[-' ])\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr-FR"));
    if (/^poya$/i.test(labelText)) labelText = province === "Province Nord" ? "Poya Nord" : "Poya Sud";
    return labelText;
  }

  // Clé de jointure entre les communes du fond de carte et celles des
  // synthèses (accents, tirets et variantes d'orthographe neutralisés).
  function communeKey(name, province) {
    return titleCaseCommune(name, province)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  // Nom lisible d'un lieu de vote qui accueille plusieurs bureaux : les
  // numéros finaux (« Hôtel de Ville 1 », « 2 »…) sont retirés.
  function placeName(names) {
    const stems = Array.from(new Set(names.map((name) => String(name || "").replace(/\s+\d+$/, "").trim())));
    return stems.filter(Boolean).join(" · ") || "Lieu de vote";
  }

  // ---------------------------------------------------------------------------
  // Chargement partagé des données (une seule requête par fichier)
  // ---------------------------------------------------------------------------

  const requests = new Map();

  // Typage automatique, sauf pour les identifiants de liste (« 2026-10 »),
  // que d3.autoType lirait comme des dates.
  function typeRow(row) {
    const listId = row.liste_id;
    const typed = d3.autoType(row);
    if (listId !== undefined) typed.liste_id = listId;
    return typed;
  }

  function request(url, type) {
    const absolute = new URL(url, document.baseURI).href;
    if (!requests.has(absolute)) {
      requests.set(absolute, type === "csv" ? d3.csv(absolute, typeRow) : d3.json(absolute));
    }
    return requests.get(absolute);
  }

  function loadData(element) {
    const set = element.dataset;
    const optional = (url, type, fallback) => (url ? request(url, type) : Promise.resolve(fallback));
    return Promise.all([
      optional(set.points, "csv", []),
      optional(set.boundary, "json", null),
      optional(set.communes, "json", null),
      optional(set.summary, "csv", []),
      optional(set.communeSummary, "csv", []),
      optional(set.metadata, "json", {}),
      optional(set.lists, "csv", []),
      optional(set.listVotes, "csv", []),
      optional(set.matches, "csv", [])
    ]).then(([points, boundaries, communes, summary, communeSummary, metadata, lists, listVotes, matches]) => ({
      points, boundaries, communes, summary, communeSummary, metadata, lists, listVotes, matches
    }));
  }

  // ---------------------------------------------------------------------------
  // Cartes : une instance par conteneur, initialisée à l'approche de l'écran
  // ---------------------------------------------------------------------------

  function start(root) {
    if (root.dataset.geographyStarted) return;
    root.dataset.geographyStarted = "true";
    loadData(root)
      .then((data) => mount(root, data))
      .catch((error) => {
        root.innerHTML = `<p class="geography-map-error">La carte n’a pas pu être chargée (${escapeHtml(error.message)}).</p>`;
      });
  }

  function startScatter(root) {
    if (root.dataset.scatterStarted) return;
    root.dataset.scatterStarted = "true";
    loadData(root)
      .then((data) => mountScatter(root, data))
      .catch((error) => {
        root.innerHTML = `<p class="geography-map-error">Le graphique n’a pas pu être chargé (${escapeHtml(error.message)}).</p>`;
      });
  }

  const starters = new Map([...mapRoots.map((root) => [root, start]), ...scatterRoots.map((root) => [root, startScatter])]);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        starters.get(entry.target)(entry.target);
      });
    }, { rootMargin: "600px 0px" });
    starters.forEach((_, root) => observer.observe(root));
  } else {
    starters.forEach((launch, root) => launch(root));
  }

  function mount(root, data) {
    const { points, boundaries, communes, summary, communeSummary, metadata, lists, listVotes } = data;
    const uid = root.id || `geography-${mapRoots.indexOf(root) + 1}`;
    const zoomViews = metadata.smoothing?.zoom_views || {};
    const activeProvince = provinceFromSlug[root.dataset.province] || "Province Sud";
    let activeForce = root.dataset.force || defaultForce[activeProvince];
    let activeZoom = null;
    // Les résultats communaux, observés, sont la vue par défaut ; le lissage,
    // plus fragile, reste une option.
    let mode = "communes";
    let showPoints = true;
    let updateToken = 0;
    let compact = root.clientWidth < 700;

    function compactWidth() {
      return Math.max(300, Math.min(440, Math.floor(root.clientWidth - 8)));
    }

    root.innerHTML = "";
    root.classList.add("geography-compare-map", "habitat-sketch--mobile-fluid");

    // --- Contrôles -----------------------------------------------------------
    const controls = document.createElement("div");
    controls.className = "geography-map-controls";

    const forceLabel = document.createElement("label");
    forceLabel.className = "habitat-map-control-label geography-force-control";
    forceLabel.appendChild(document.createTextNode("Famille ou liste"));
    const forceSelect = document.createElement("select");
    forceSelect.className = "habitat-map-select";
    forceSelect.setAttribute("aria-label", `Force politique ou indicateur cartographié, ${provinceDisplay[activeProvince]}`);
    forceLabel.appendChild(forceSelect);
    controls.appendChild(forceLabel);

    const modeGroup = document.createElement("div");
    modeGroup.className = "geography-mode-switch";
    modeGroup.setAttribute("role", "group");
    modeGroup.setAttribute("aria-label", "Mode d’affichage de la carte");
    const modeButtons = [
      ["communes", "Communes"],
      ["bureaux", "Bureaux"],
      ["smooth", "Lissage"]
    ].map(([value, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "habitat-sketch-download geography-mode-button";
      button.dataset.mode = value;
      button.textContent = text;
      modeGroup.appendChild(button);
      return button;
    });
    controls.appendChild(modeGroup);

    const actions = document.createElement("div");
    actions.className = "geography-map-actions";
    const zoomButton = document.createElement("button");
    zoomButton.type = "button";
    zoomButton.className = "habitat-sketch-download geography-zoom-toggle";
    const pointsButton = document.createElement("button");
    pointsButton.type = "button";
    pointsButton.className = "habitat-sketch-download geography-points-toggle";
    pointsButton.textContent = "Bureaux visibles";
    pointsButton.setAttribute("aria-pressed", "true");
    const download = document.createElement("button");
    download.type = "button";
    download.className = "habitat-sketch-download";
    download.textContent = "PNG";
    download.setAttribute("aria-label", "Télécharger la comparaison cartographique en PNG");
    actions.append(zoomButton, pointsButton, download);
    controls.appendChild(actions);
    root.appendChild(controls);

    const status = document.createElement("p");
    status.className = "geography-map-status";
    status.setAttribute("aria-live", "polite");
    root.appendChild(status);

    const guide = document.createElement("div");
    guide.className = "geography-map-guide";
    root.appendChild(guide);

    const svg = d3.select(root).append("svg").attr("role", "img").attr("class", "geography-map-svg");
    const defs = svg.append("defs");
    const content = svg.append("g").attr("class", "geography-content");

    const chartWrap = document.createElement("div");
    chartWrap.className = "geography-commune-chart";
    root.appendChild(chartWrap);
    const chartSvg = d3.select(chartWrap).append("svg").attr("role", "img");

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip geography-map-tooltip";
    tooltip.setAttribute("role", "status");
    root.appendChild(tooltip);

    let layout;
    let activeBoundary;
    let activeCommunes;
    let communeRings = [];
    let localProjection;
    let localPath;
    let viewRect;
    let bandwidthKm;
    let displayRadiusKm;
    let probes = [];
    const gridCache = new Map();
    const cellCache = new Map();

    function zoomAvailable() {
      return Object.keys(zoomViews).find((key) => zoomViews[key].province === activeProvince) || null;
    }

    // Hauteur de panneau ajustée à la forme du territoire affiché (province
    // entière ou emprise agrandie), bornée pour les provinces très compactes.
    function panelHeightFor(panelWidth, mapTop, maxHeight) {
      const project = d3.geoMercator();
      let bounds;
      if (activeZoom) {
        const [west, south, east, north] = zoomViews[activeZoom].bbox;
        bounds = [project([west, north]), project([east, south])];
      } else {
        bounds = d3.geoPath(project).bounds({
          type: "FeatureCollection",
          features: boundaries.features.filter((feature) => feature.properties.province === activeProvince)
        });
      }
      const ratio = (bounds[1][1] - bounds[0][1]) / (bounds[1][0] - bounds[0][0]);
      return Math.min(maxHeight, Math.ceil(mapTop + 20 + (panelWidth - 20) * ratio));
    }

    // Nombre de panneaux : une carte par année, plus l'évolution pour une
    // famille comparée, sauf en vue Bureaux (les bureaux ne sont pas
    // identiques d'un scrutin à l'autre).
    function panelCount() {
      const years = getSeries(activeForce).years.length;
      return years + (years === 2 && mode !== "bureaux" ? 1 : 0);
    }

    function computeLayout() {
      const mapTop = 58;
      const count = panelCount();
      if (compact) {
        // Sur mobile, une unité du dessin vaut un pixel : les textes gardent
        // leur taille nominale au lieu d'être réduits avec la figure.
        const width = compactWidth();
        const panelWidth = width - 20;
        const panelHeight = panelHeightFor(panelWidth, mapTop, mapTop + 430);
        const panelGap = 18;
        const panelTop = 100;
        const legendTop = panelTop + count * panelHeight + (count - 1) * panelGap + 44;
        return {
          count,
          width,
          height: legendTop + (count === 3 ? (mode === "smooth" ? 250 : 190) : (mode === "smooth" ? 176 : 110)),
          panelWidth,
          panelHeight,
          mapTop,
          panelTop,
          step: 3,
          origin: (index) => [10, panelTop + index * (panelHeight + panelGap)],
          legend: {
            score: [10, legendTop, width - 20],
            delta: [10, legendTop + 80, width - 20],
            notes: [10, legendTop + (count === 3 ? 142 : 62)]
          }
        };
      }
      const panelWidth = 555;
      const gap = 18;
      const panelTop = 92;
      const panelHeight = panelHeightFor(panelWidth, mapTop, 640);
      const legendX = 26 + panelWidth + gap + 20;
      const origin = (index) => [26 + (index === 1 ? panelWidth + gap : 0), index < 2 ? panelTop : panelTop + panelHeight + gap];
      if (count === 2) {
        // Deux années côte à côte, légende en dessous.
        const legendTop = panelTop + panelHeight + 62;
        return {
          count, width: 1180, height: legendTop + 92, panelWidth, panelHeight, mapTop, panelTop,
          step: activeZoom ? 4 : 5, origin,
          legend: { score: [26, legendTop, 555], delta: [legendX, legendTop, 515], notes: [legendX, legendTop + 4] }
        };
      }
      // Une liste : un panneau, légendes à droite ; une famille : 2 × 2.
      const rowTwo = count === 1 ? panelTop : panelTop + panelHeight + gap;
      return {
        count,
        width: 1180,
        height: rowTwo + panelHeight + 30,
        panelWidth,
        panelHeight,
        mapTop,
        panelTop,
        step: activeZoom ? 4 : 5,
        origin,
        legend: {
          score: [legendX, rowTwo + 70, 515],
          delta: [legendX, rowTwo + 160, 515],
          notes: [legendX, rowTwo + (count === 1 ? 140 : 236)]
        }
      };
    }

    function updateForceOptions() {
      const families = summary
        .filter((d) => d.province === activeProvince && d.annee === 2026)
        .sort((a, b) => d3.ascending(a.ordre, b.ordre));
      const groups = [
        ["Familles politiques · 2019 → 2026", families.map((row) => [row.force, row.force_label])],
        ...[2026, 2019].map((year) => [
          `Listes ${year} · une seule année`,
          lists
            .filter((d) => d.province === activeProvince && d.annee === year)
            .sort((a, b) => d3.ascending(a.ordre, b.ordre))
            .map((row) => [`liste:${row.liste_id}`, `${row.liste_label} (${format1.format(row.score)} %)`])
        ])
      ].filter(([, options]) => options.length);
      const possible = new Set(groups.flatMap(([, options]) => options.map(([value]) => value)));
      if (!possible.has(activeForce)) activeForce = defaultForce[activeProvince];
      if (!possible.has(activeForce)) activeForce = families[0].force;
      forceSelect.replaceChildren();
      groups.forEach(([title, options]) => {
        const group = document.createElement("optgroup");
        group.label = title;
        options.forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          group.appendChild(option);
        });
        forceSelect.appendChild(group);
      });
      forceSelect.value = activeForce;
    }

    function updateButtons() {
      modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
      // En vue Bureaux, les cercles sont la carte elle-même.
      pointsButton.hidden = mode === "bureaux";
      const available = zoomAvailable();
      zoomButton.hidden = !available;
      if (available) {
        const name = zoomViews[available].label;
        zoomButton.setAttribute("aria-pressed", String(Boolean(activeZoom)));
        zoomButton.textContent = activeZoom
          ? (compact ? "Province entière" : "Revenir à la province")
          : (compact ? "Zoom Nouméa" : `Zoom : ${name}`);
        zoomButton.setAttribute(
          "aria-label",
          activeZoom ? "Revenir à la vue de la province entière" : `Agrandir la carte sur le ${name}`
        );
      }
    }

    function selectGeography() {
      activeBoundary = {
        type: "FeatureCollection",
        features: boundaries.features.filter((feature) => feature.properties.province === activeProvince)
      };
      activeCommunes = communes.features.filter(
        (feature) => feature.properties.province === activeProvince &&
          feature.geometry && feature.geometry.coordinates.length
      );
      const extent = [[10, layout.mapTop], [layout.panelWidth - 10, layout.panelHeight - 10]];
      const zoom = activeZoom ? zoomViews[activeZoom] : null;
      if (zoom) {
        const [west, south, east, north] = zoom.bbox;
        localProjection = d3.geoMercator().fitExtent(extent, {
          type: "MultiPoint",
          coordinates: [[west, south], [east, north]]
        });
        const [x0, y0] = localProjection([west, north]);
        const [x1, y1] = localProjection([east, south]);
        viewRect = { x0, y0, x1, y1 };
        bandwidthKm = Number(zoom.bandwidth_km);
        displayRadiusKm = Number(zoom.display_radius_km);
      } else {
        localProjection = d3.geoMercator().fitExtent(extent, activeBoundary);
        viewRect = { x0: 0, y0: layout.mapTop - 4, x1: layout.panelWidth, y1: layout.panelHeight };
        bandwidthKm = Number(metadata.smoothing?.bandwidth_km?.[activeProvince]) || 12;
        displayRadiusKm = Number(metadata.smoothing?.display_radius_km?.[activeProvince]) || bandwidthKm * 3;
      }
      localPath = d3.geoPath(localProjection);
      // Anneaux communaux projetés, pour un test d'appartenance plan
      // insensible à l'orientation des anneaux (pair-impair).
      communeRings = activeCommunes.map((feature) => {
        const geometry = feature.geometry;
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        return polygons.flat().map((ring) => ring.map((point) => localProjection(point)));
      });
    }

    function communeAt(point) {
      const index = communeRings.findIndex((rings) =>
        rings.reduce((inside, ring) => (d3.polygonContains(ring, point) ? !inside : inside), false)
      );
      return index < 0 ? null : activeCommunes[index];
    }

    function inView([x, y], margin = 0) {
      return x >= viewRect.x0 - margin && x <= viewRect.x1 + margin &&
        y >= viewRect.y0 - margin && y <= viewRect.y1 + margin;
    }

    // Une série est soit une famille politique comparée entre 2019 et 2026,
    // soit une liste, cartographiée pour sa seule année : les listes ne se
    // succèdent pas terme à terme d'un scrutin à l'autre.
    const seriesCache = new Map();
    const bureauIndex = new Map(
      points
        .filter((d) => d.province === activeProvince && d.force === "participation")
        .map((d) => [`${d.annee}|${d.commune}|${Number(d.code_bv)}`, d])
    );

    function getSeries(key) {
      if (seriesCache.has(key)) return seriesCache.get(key);
      let series;
      if (String(key).startsWith("liste:")) {
        const id = key.slice(6);
        const info = lists.find((d) => d.province === activeProvince && d.liste_id === id);
        if (!info) return getSeries(defaultForce[activeProvince]);
        const year = info.annee;
        const rows = listVotes
          .filter((d) => d.province === activeProvince && d.liste_id === id)
          .map((vote) => {
            const base = bureauIndex.get(`${vote.annee}|${vote.commune}|${Number(vote.code_bv)}`);
            if (!base) return null;
            return {
              ...base,
              force: key,
              voix: vote.voix,
              denominateur: base.exprimes,
              pct: base.exprimes > 0 ? 100 * vote.voix / base.exprimes : NaN
            };
          })
          .filter(Boolean);
        const communeScores = d3.rollups(rows, (values) => {
          const score = 100 * d3.sum(values, (d) => d.voix) / d3.sum(values, (d) => d.denominateur);
          return {
            commune: values[0].commune,
            score_2019: year === 2019 ? score : NaN,
            score_2026: year === 2026 ? score : NaN,
            evolution_points: NaN
          };
        }, (d) => d.commune).map(([, row]) => [communeKey(row.commune, activeProvince), row]);
        series = {
          key,
          kind: "list",
          years: [year],
          label: info.liste_label,
          color: info.couleur,
          participation: false,
          rows,
          communes: new Map(communeScores),
          score: { [year]: info.score }
        };
      } else {
        const info2019 = summary.find((d) => d.province === activeProvince && d.annee === 2019 && d.force === key);
        const info2026 = summary.find((d) => d.province === activeProvince && d.annee === 2026 && d.force === key);
        if (!info2026) return getSeries(defaultForce[activeProvince]);
        series = {
          key,
          kind: "force",
          years: [2019, 2026],
          label: info2026.force_label,
          color: info2026.couleur,
          participation: key === "participation",
          rows: points.filter((d) => d.province === activeProvince && d.force === key),
          communes: new Map(
            communeSummary
              .filter((d) => d.province === activeProvince && d.force === key && d.annee === 2026)
              .map((row) => [communeKey(row.commune, activeProvince), row])
          ),
          score: { 2019: info2019?.score, 2026: info2026.score }
        };
      }
      seriesCache.set(key, series);
      return series;
    }

    function pointsFor(year, spatialOnly = true) {
      return getSeries(activeForce).rows.filter(
        (d) => d.annee === year && (!spatialOnly || d.spatial_include !== false)
      );
    }

    function lastYear() {
      const years = getSeries(activeForce).years;
      return years[years.length - 1];
    }

    function yearValue(row, year) {
      return row ? row[`score_${year}`] : NaN;
    }

    // --- Lissage ---------------------------------------------------------------

    // Cellules terrestres de la vue, calculées une seule fois par emprise.
    // Les distances sont ensuite calculées dans un plan local
    // (équirectangulaire centré sur la vue), dont l'écart à la distance
    // géodésique reste négligeable à l'échelle d'une province.
    function viewCells() {
      const key = `${activeZoom || "province"}-${layout.width}`;
      if (cellCache.has(key)) return cellCache.get(key);
      const step = layout.step;
      const nx = Math.ceil((viewRect.x1 - viewRect.x0) / step) + 2;
      const ny = Math.ceil((viewRect.y1 - viewRect.y0) / step) + 2;
      const ox = viewRect.x0 - step;
      const oy = viewRect.y0 - step;
      const center = localProjection.invert([(viewRect.x0 + viewRect.x1) / 2, (viewRect.y0 + viewRect.y1) / 2]);
      const kmX = 111.32 * Math.cos(center[1] * Math.PI / 180);
      const kmY = 110.574;
      // Masque terre/mer : le polygone provincial est rastérisé à la
      // résolution de la grille, bien plus vite qu'un test point par point.
      const canvas = document.createElement("canvas");
      canvas.width = nx;
      canvas.height = ny;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.setTransform(1 / step, 0, 0, 1 / step, -ox / step, -oy / step);
      context.beginPath();
      d3.geoPath(localProjection, context)(activeBoundary);
      context.fill();
      const mask = context.getImageData(0, 0, nx, ny).data;
      const index = [];
      const xs = [];
      const ys = [];
      for (let j = 1; j < ny - 1; j += 1) {
        for (let i = 1; i < nx - 1; i += 1) {
          if (mask[4 * (j * nx + i) + 3] < 128) continue;
          const geographic = localProjection.invert([ox + (i + 0.5) * step, oy + (j + 0.5) * step]);
          if (!geographic) continue;
          index.push(j * nx + i);
          xs.push(geographic[0] * kmX);
          ys.push(geographic[1] * kmY);
        }
      }
      const cells = {
        nx, ny, ox, oy, step, kmX, kmY,
        index: Int32Array.from(index),
        xs: Float64Array.from(xs),
        ys: Float64Array.from(ys)
      };
      cellCache.set(key, cells);
      return cells;
    }

    // Grille de lissage gaussien, entourée d'une couronne sans donnée pour
    // que les isolignes se referment toujours à l'intérieur de la vue. Les
    // poids au-delà de cinq portées (< 4e-6) sont ignorés. La distance au
    // bureau le plus proche est conservée pour signaler les estimations
    // fragiles.
    function makeGrid(year, force) {
      const key = `${activeZoom || "province"}-${layout.width}-${year}-${force}`;
      if (gridCache.has(key)) return gridCache.get(key);
      const cells = viewCells();
      const rows = pointsFor(year);
      const rx = Float64Array.from(rows, (row) => row.longitude * cells.kmX);
      const ry = Float64Array.from(rows, (row) => row.latitude * cells.kmY);
      const voix = Float64Array.from(rows, (row) => row.voix);
      const base = Float64Array.from(rows, (row) => row.denominateur);
      const cutoff2 = Math.pow(5 * bandwidthKm, 2);
      const radius2 = displayRadiusKm * displayRadiusKm;
      const inverse = -0.5 / (bandwidthKm * bandwidthKm);
      const values = new Float64Array(cells.nx * cells.ny).fill(NODATA);
      const near = new Float64Array(cells.nx * cells.ny).fill(-1);
      for (let c = 0; c < cells.index.length; c += 1) {
        const x = cells.xs[c];
        const y = cells.ys[c];
        let numerator = 0;
        let denominator = 0;
        let nearest = Infinity;
        for (let r = 0; r < rx.length; r += 1) {
          const dx = rx[r] - x;
          const dy = ry[r] - y;
          const distance2 = dx * dx + dy * dy;
          if (distance2 < nearest) nearest = distance2;
          if (distance2 > cutoff2) continue;
          const weight = Math.exp(distance2 * inverse);
          numerator += weight * voix[r];
          denominator += weight * base[r];
        }
        near[cells.index[c]] = Math.sqrt(nearest);
        if (nearest <= radius2 && denominator > 0) values[cells.index[c]] = 100 * numerator / denominator;
      }
      const grid = { nx: cells.nx, ny: cells.ny, ox: cells.ox, oy: cells.oy, step: cells.step, values, near };
      gridCache.set(key, grid);
      return grid;
    }

    // --- Bureaux -----------------------------------------------------------------

    function siteRows(year, force) {
      return d3.rollups(
        pointsFor(year),
        (values) => {
          const voix = d3.sum(values, (d) => d.voix);
          const denominateur = d3.sum(values, (d) => d.denominateur);
          return {
            longitude: values[0].longitude,
            latitude: values[0].latitude,
            commune: values[0].commune,
            place: placeName(values.map((d) => d.bureau_nom)),
            codes: values.map((d) => Number(d.code_bv)).sort(d3.ascending),
            bureaux: values.length,
            voix,
            denominateur,
            pct: denominateur > 0 ? 100 * voix / denominateur : NaN,
            inscrits: d3.sum(values, (d) => d.inscrits)
          };
        },
        (d) => `${Number(d.longitude).toFixed(5)}-${Number(d.latitude).toFixed(5)}`
      ).map(([, value]) => value);
    }

    function officeLabel(site) {
      return site.bureaux > 1
        ? `${site.bureaux} bureaux (nᵒˢ ${site.codes.join(", ")})`
        : `Bureau nᵒ ${site.codes[0]}`;
    }

    function addMarkers(group, year, force, rc, classes = null) {
      const sites = siteRows(year, force)
        .map((site) => ({ ...site, xy: localProjection([site.longitude, site.latitude]) }))
        .filter((site) => site.xy && inView(site.xy))
        .sort((a, b) => d3.descending(a.inscrits, b.inscrits));
      const radius = d3.scaleSqrt()
        .domain([0, d3.max(sites, (d) => d.inscrits) || 1])
        .range(mode === "bureaux"
          ? (activeZoom ? [8, 18] : [5.5, 15])
          : (activeZoom ? [6, 13] : [4.6, 10]));
      const markers = group.append("g").attr("class", "geography-office-markers");
      sites.forEach((site, index) => {
        roughCircle(markers, rc, site.xy[0], site.xy[1], radius(site.inscrits), {
          fill: classes ? classes.colors[classIndex(classes, site.pct)] || paper : paper,
          fillStyle: "solid",
          stroke: ink,
          strokeWidth: 0.85,
          roughness: 0.9,
          seed: `${uid}-${year}-${force}-${index}`
        });
      });
      const unit = getSeries(activeForce).participation ? "inscrits" : "exprimés";
      markers.selectAll("circle.geography-office-hit")
        .data(sites)
        .join("circle")
        .attr("class", "geography-office-hit")
        .attr("cx", (d) => d.xy[0])
        .attr("cy", (d) => d.xy[1])
        .attr("r", (d) => Math.max(5.5, radius(d.inscrits) / 2 + 1.5))
        .attr("fill", "transparent")
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr("aria-label", (d) => `${d.place}, ${d.commune}, ${officeLabel(d)}, ${year} : ${format1.format(d.pct)} %`)
        .on("pointerenter focus", function(event, d) {
          hideProbe();
          tooltip.innerHTML = [
            `<strong>${escapeHtml(d.place)}</strong>`,
            `<span>${escapeHtml(d.commune)} · ${year} · ${escapeHtml(officeLabel(d))}</span>`,
            `<div class="geography-tip-score">${format1.format(d.pct)} %</div>`,
            `<span>${format0.format(d.voix)} sur ${format0.format(d.denominateur)} ${unit}</span>`,
            d.bureaux > 1
              ? `<span class="habitat-tooltip-note">Résultat cumulé des bureaux installés dans ce lieu.</span>`
              : ""
          ].join("");
          positionTooltip(root, tooltip, event.type === "focus" ? focusPointer(this) : event);
        })
        .on("pointermove", (event) => positionTooltip(root, tooltip, event))
        .on("pointerleave blur", () => { tooltip.style.opacity = 0; });
    }

    // --- Habillage -----------------------------------------------------------------

    function communeLabels() {
      if (!activeZoom) {
        return activeCommunes.map((feature) => ({
          name: titleCaseCommune(feature.properties.commune, activeProvince),
          xy: localPath.centroid(feature),
          area: localPath.area(feature)
        }));
      }
      // En vue agrandie, le centroïde communal tombe souvent hors cadre : le
      // libellé est placé au barycentre des lieux de vote visibles.
      return zoomViews[activeZoom].communes.map((name) => {
        const sites = siteRows(lastYear(), activeForce)
          .filter((site) => site.commune === name)
          .map((site) => localProjection([site.longitude, site.latitude]))
          .filter((xy) => xy && inView(xy));
        return {
          name,
          xy: sites.length ? [d3.mean(sites, (d) => d[0]), d3.mean(sites, (d) => d[1]) - 16] : [NaN, NaN]
        };
      });
    }

    function addMapFurniture(group, panelIndex, rc) {
      group.append("path")
        .attr("d", activeCommunes.map((feature) => localPath(feature)).join(""))
        .attr("fill", "none")
        .attr("stroke", "#4f4942")
        .attr("stroke-width", activeZoom ? 0.9 : 0.55)
        .attr("stroke-opacity", mode === "communes" ? 0.8 : 0.55)
        .attr("stroke-dasharray", activeZoom ? "5 2.5" : null)
        .attr("stroke-linejoin", "round")
        .attr("pointer-events", "none");
      roughPath(group, rc, localPath(activeBoundary), {
        stroke: ink,
        strokeWidth: activeZoom ? 1.05 : 1.15,
        roughness: activeZoom ? 0.9 : 1.2,
        bowing: 1,
        seed: `${activeProvince}-${activeZoom || "province"}-coast-${panelIndex}`
      });
    }

    // Libellés communaux sans chevauchement : les plus grandes communes sont
    // placées d'abord, un libellé qui en recouvrirait un autre est omis (la
    // commune reste nommée au survol).
    function addLabels(group) {
      const size = activeZoom ? 12.5 : 9.6;
      const placed = [];
      communeLabels()
        .filter(({ xy }) => Number.isFinite(xy[0]) && Number.isFinite(xy[1]) && inView(xy, -6))
        .sort((a, b) => d3.descending(a.area || 0, b.area || 0))
        .forEach(({ name, xy }) => {
          const halfWidth = (name.length * size * 0.56) / 2 + 3;
          const halfHeight = size / 2 + 2;
          const box = [xy[0] - halfWidth, xy[1] - halfHeight, xy[0] + halfWidth, xy[1] + halfHeight];
          const collides = placed.some((other) =>
            box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1]
          );
          if (collides) return;
          placed.push(box);
          // Un libellé proche du bord est décalé vers l'intérieur du cadre.
          const x = Math.min(Math.max(xy[0], viewRect.x0 + halfWidth + 2), viewRect.x1 - halfWidth - 2);
          label(group, name, x, xy[1], {
            anchor: "middle",
            size,
            weight: 800,
            color: "#3f3a35",
            halo: true,
            haloWidth: 3.2
          });
        });
    }

    function panelTitle(group, title, subtitle, color) {
      label(group, title, layout.panelWidth / 2, 18, {
        anchor: "middle",
        family: "Cabin Sketch, sans-serif",
        size: 21,
        weight: 700,
        color
      });
      label(group, subtitle, layout.panelWidth / 2, 42, {
        anchor: "middle",
        size: 11.5,
        weight: 800,
        color: muted
      });
    }

    function textureOptions(color, hatch, key) {
      return {
        fill: hatchColor(color),
        fillStyle: "hachure",
        hachureAngle: hatch.angle,
        hachureGap: hatch.gap,
        fillWeight: 0.55,
        stroke: "none",
        strokeWidth: 0,
        roughness: 1.4,
        bowing: 1,
        opacity: 0.5,
        seed: key
      };
    }

    function drawSurface(group, rc, grid, values, classes, panelIndex) {
      const bands = classBands(grid, values, classes.thresholds);
      const fills = group.append("g").attr("class", "geography-surface").attr("pointer-events", "none");
      const texture = group.append("g").attr("pointer-events", "none");
      bands.forEach((band) => {
        if (!band.d) return;
        const color = classes.colors[band.index];
        fills.append("path")
          .attr("d", band.d)
          .attr("fill", color)
          .attr("fill-rule", "evenodd");
        const hatch = classes.hatch[band.index];
        if (hatch) {
          roughPath(texture, rc, band.d, textureOptions(
            color, hatch, `${uid}-${activeZoom || "province"}-${activeForce}-${panelIndex}-${band.index}`
          ));
        }
      });
      // Limites de classes : fines courbes de niveau.
      group.append("path")
        .attr("d", bands.slice(1).map((band) => band.outline).join(""))
        .attr("fill", "none")
        .attr("stroke", ink)
        .attr("stroke-width", 0.6)
        .attr("stroke-opacity", 0.35)
        .attr("stroke-linejoin", "round")
        .attr("pointer-events", "none");
    }

    // Zones à plus d'une portée de lissage du bureau le plus proche : la
    // couleur y est extrapolée. Un lavis de papier la pâlit, et un pointillé
    // discret en marque la limite.
    function drawFarOverlay(group, rc, grid, near, panelIndex) {
      const [contour] = d3.contours().size([grid.nx, grid.ny]).thresholds([bandwidthKm])(near);
      const transform = (x, y) => [grid.ox + x * grid.step, grid.oy + y * grid.step];
      const pathData = contour ? ringsToPath(contour, transform) : "";
      if (!pathData) return;
      group.append("path")
        .attr("class", "geography-far-wash")
        .attr("d", pathData)
        .attr("fill", paper)
        .attr("fill-opacity", 0.5)
        .attr("stroke", ink)
        .attr("stroke-width", 0.7)
        .attr("stroke-opacity", 0.4)
        .attr("stroke-dasharray", "1.5 3")
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
    }

    function drawCommuneFills(group, rc, rows, accessor, classes, panelIndex) {
      activeCommunes.forEach((feature, index) => {
        const row = rows.get(communeKey(feature.properties.commune, activeProvince));
        const value = row ? accessor(row) : NaN;
        const pathData = localPath(feature);
        const classId = classIndex(classes, value);
        const color = classId < 0 ? noData : classes.colors[classId];
        group.append("path")
          .attr("d", pathData)
          .attr("fill", color)
          .attr("pointer-events", "none");
        const hatch = classId < 0 ? null : classes.hatch[classId];
        if (hatch) {
          roughPath(group, rc, pathData, textureOptions(
            color, hatch, `${uid}-commune-${activeForce}-${panelIndex}-${index}`
          ));
        }
      });
    }

    function hideProbe() {
      probes.forEach((probe) => probe.attr("opacity", 0));
    }

    // Lecture au survol : un repère commun aux trois panneaux et une
    // infobulle donnant 2019, 2026 et l'évolution au même endroit.
    function readSurface(event, node, grids) {
      const [px, py] = d3.pointer(event, node);
      const commune = communeAt([px, py]);
      if (!commune) {
        hideProbe();
        tooltip.style.opacity = 0;
        return;
      }
      const series = getSeries(activeForce);
      const values = {};
      let caption;
      if (mode !== "smooth") {
        const row = series.communes.get(communeKey(commune.properties.commune, activeProvince));
        series.years.forEach((year) => { values[year] = yearValue(row, year); });
        caption = mode === "bureaux"
          ? "Résultat de toute la commune ; survolez un cercle pour un bureau"
          : "Résultat communal, non lissé";
      } else {
        const reference = grids[series.years[0]];
        const i = Math.floor((px - reference.ox) / reference.step);
        const j = Math.floor((py - reference.oy) / reference.step);
        const index = j * reference.nx + i;
        series.years.forEach((year) => { values[year] = grids[year].values[index]; });
        const distance = d3.max(series.years, (year) => grids[year].near[index]);
        caption = distance > bandwidthKm
          ? `Estimation lissée, fragile : bureau le plus proche à ${formatKm.format(distance)} km`
          : "Estimation lissée à cet endroit";
      }
      probes.forEach((probe) => probe.attr("transform", `translate(${px},${py})`).attr("opacity", 1));
      const name = titleCaseCommune(commune.properties.commune, activeProvince);
      const unit = series.participation ? "des inscrits" : "des exprimés";
      const valid = series.years.every((year) => Number.isFinite(values[year]) && values[year] > FLOOR);
      const lines = series.years.map((year) => `<span>${year}</span><b>${format1.format(values[year])} %</b>`);
      if (valid && series.years.length === 2) {
        const delta = values[2026] - values[2019];
        lines.push(`<span>Évolution</span><b class="${delta >= 0 ? "is-up" : "is-down"}">${signed1.format(delta)} pts</b>`);
      }
      tooltip.innerHTML = valid
        ? [
          `<strong>${escapeHtml(name)}</strong>`,
          `<span>${caption} (% ${unit})</span>`,
          `<div class="geography-tip-grid">`,
          ...lines,
          `</div>`
        ].join("")
        : [
          `<strong>${escapeHtml(name)}</strong>`,
          mode !== "smooth"
            ? "<span>Pas de résultat pour cette commune.</span>"
            : `<span>Pas d’estimation : plus de ${formatKm.format(displayRadiusKm)} km d’un bureau cartographié.</span>`
        ].join("");
      positionTooltip(root, tooltip, event);
    }

    function drawLegend(x, y, width, title, classes, key) {
      const legend = content.append("g").attr("class", "geography-legend");
      const rc = rough.svg(legend.node());
      label(legend, title, x, y - 16, { size: compact ? 9.4 : 10.8, weight: 850, color: muted });
      const count = classes.colors.length;
      const itemWidth = width / count;
      classes.colors.forEach((color, index) => {
        const gx = x + index * itemWidth;
        const swatchWidth = itemWidth - 5;
        legend.append("rect")
          .attr("x", gx)
          .attr("y", y)
          .attr("width", swatchWidth)
          .attr("height", 17)
          .attr("fill", color);
        const hatch = classes.hatch[index];
        roughRect(legend, rc, gx, y, swatchWidth, 17, {
          fill: hatch ? hatchColor(color) : "none",
          fillStyle: "hachure",
          hachureAngle: hatch?.angle,
          hachureGap: hatch?.gap,
          fillWeight: 0.55,
          stroke: ink,
          strokeWidth: 0.5,
          opacity: 0.6,
          seed: `legend-${key}-${index}-${color}`
        });
        label(legend, classes.labels[index], gx + swatchWidth / 2, y + 31, {
          anchor: "middle",
          size: compact ? 8.8 : 10.4,
          weight: 750,
          color: muted
        });
      });
    }

    // Texte de note découpé en lignes selon la largeur disponible (mobile).
    function noteText(parent, text, x, y, width) {
      const maxChars = Math.max(24, Math.floor(width / 5.4));
      const lines = [];
      text.split(" ").forEach((word) => {
        const last = lines[lines.length - 1];
        if (last && (last + " " + word).length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
      });
      lines.forEach((line, index) => label(parent, line, x, y + index * 13, { size: 10.2, color: muted }));
      return lines.length;
    }

    function drawNotes(x, y) {
      const notes = content.append("g").attr("class", "geography-notes");
      const rc = rough.svg(notes.node());
      const textWidth = (compact ? layout.width - 20 : 515) - 26;
      let cursor = y;
      const next = (lineCount) => { cursor += 13 * lineCount + 9; };
      if (mode === "bureaux") {
        roughCircle(notes, rc, x + 9, cursor, 12, { fill: paper, fillStyle: "solid", seed: `${uid}-note-office` });
        noteText(notes, "Un cercle par lieu de vote, de taille proportionnelle aux inscrits.", x + 26, cursor, textWidth);
        return;
      }
      notes.append("rect")
        .attr("x", x).attr("y", cursor - 6).attr("width", 18).attr("height", 12)
        .attr("fill", noData).attr("stroke", "#b9b1a5").attr("stroke-width", 0.6);
      const noDataText = mode === "communes"
        ? "Commune sans résultat comparable."
        : `Plus de ${formatKm.format(displayRadiusKm)} km d’un bureau : pas d’estimation.`;
      next(noteText(notes, noDataText, x + 26, cursor, textWidth));
      if (mode !== "smooth") return;
      // Même teinte, normale puis pâlie, pour montrer l'effet du lavis.
      notes.append("rect")
        .attr("x", x).attr("y", cursor - 6).attr("width", 18).attr("height", 12)
        .attr("fill", "#5b79ad");
      notes.append("rect")
        .attr("x", x + 9).attr("y", cursor - 6).attr("width", 9).attr("height", 12)
        .attr("fill", paper).attr("fill-opacity", 0.5)
        .attr("stroke", ink).attr("stroke-opacity", 0.4).attr("stroke-width", 0.7)
        .attr("stroke-dasharray", "1.5 3");
      next(noteText(
        notes,
        `Couleur pâlie : à plus de ${formatKm.format(bandwidthKm)} km du bureau le plus proche, estimation fragile.`,
        x + 26, cursor, textWidth
      ));
      roughCircle(notes, rc, x + 9, cursor, 11, { fill: "#5b79ad", fillStyle: "solid", seed: `${uid}-note-real` });
      noteText(notes, "Cercle : résultat réel du lieu de vote, sur la même échelle.", x + 26, cursor, textWidth);
    }

    function drawTitle(series) {
      const place = activeZoom ? zoomViews[activeZoom].label : provinceDisplay[activeProvince];
      const period = series.years.join(" → ");
      const method = {
        communes: "résultats par commune",
        bureaux: "résultats par lieu de vote",
        smooth: `estimation lissée sur ${formatKm.format(bandwidthKm)} km`
      }[mode];
      // Formulation neutre, valable pour une famille, une liste ou la
      // participation, quel que soit le genre du nom.
      const question = series.kind === "list"
        ? `implantation en ${series.years[0]}`
        : "gains et reculs";
      if (compact) {
        const maxChars = Math.floor((layout.width - 20) / 10);
        const titleText = series.label.length > maxChars ? `${series.label.slice(0, maxChars - 1)}…` : series.label;
        label(content, titleText, 10, 26, { family: "Cabin Sketch, sans-serif", size: 19, weight: 700 });
        label(content, `${place} · ${period}`, 10, 54, { size: 12, weight: 800, color: muted });
        label(content, method, 10, 74, { size: 11.5, weight: 700, color: muted });
        return;
      }
      const titleText = `${series.label} : ${question}`;
      label(content, titleText.length > 74 ? series.label : titleText, 26, 28, {
        family: "Cabin Sketch, sans-serif", size: titleText.length > 60 ? 22 : 27, weight: 700
      });
      label(content, `${place} · ${period} · ${method}`, 26, 60, {
        size: 13, weight: 780, color: muted
      });
    }

    function updateGuide(series) {
      const two = series.years.length === 2;
      const unit = series.participation ? "la participation" : "le score";
      const texts = {
        communes: [
          `Chaque commune est colorée selon ${unit} observé${series.participation ? "e" : ""} sur l’ensemble de ses bureaux : c’est le résultat officiel, sans estimation.`,
          two
            ? "Les deux premières cartes partagent la même échelle ; la troisième montre l’écart en points entre 2019 et 2026."
            : `La liste n’existant qu’en ${series.years[0]}, une seule carte est présentée.`,
          "Les cercles blancs situent les lieux de vote. Pour voir les écarts à l’intérieur d’une commune, passez à la vue <strong>Bureaux</strong>."
        ],
        bureaux: [
          "Chaque cercle est un lieu de vote, coloré selon son résultat observé et de taille proportionnelle à ses inscrits. C’est la lecture la plus fine, sans aucune estimation.",
          two
            ? "L’évolution n’est pas cartographiée bureau par bureau : la liste des bureaux et leurs périmètres changent d’un scrutin à l’autre. Comparez les deux années côte à côte, ou revenez à la vue <strong>Communes</strong>."
            : "Survolez un cercle pour lire le nom du lieu, les numéros de bureaux et le résultat.",
          "Dans le Grand Nouméa, le bouton <strong>Zoom</strong> sépare les lieux de vote très rapprochés."
        ].slice(0, activeProvince === "Province Sud" ? 3 : 2),
        smooth: [
          `<strong>Estimation.</strong> La couleur de chaque point combine les bureaux voisins dans un rayon d’environ ${formatKm.format(bandwidthKm)} km, en donnant plus de poids aux plus proches et aux plus grands : on lit des tendances territoriales, pas des résultats.`,
          "Les cercles gardent la couleur de leur résultat réel : un cercle qui tranche avec la surface autour signale un bureau atypique que le lissage atténue.",
          "Loin de tout bureau, la couleur pâlit. En cas de doute, la vue <strong>Bureaux</strong> montre les résultats observés."
        ]
      };
      guide.innerHTML = `<p class="geography-map-guide-title">Comment lire cette carte</p><ul>${
        texts[mode].map((text) => `<li>${text}</li>`).join("")
      }</ul>`;
    }

    // Résultat brut (non lissé) des communes de la vue agrandie.
    function zoomScore(year) {
      const names = new Set(zoomViews[activeZoom].communes);
      const rows = pointsFor(year, false).filter((d) => names.has(d.commune));
      const denominator = d3.sum(rows, (d) => d.denominateur);
      return denominator > 0 ? 100 * d3.sum(rows, (d) => d.voix) / denominator : NaN;
    }

    async function update() {
      const token = ++updateToken;
      const series = getSeries(activeForce);
      activeForce = series.key;
      layout = computeLayout();
      selectGeography();
      updateButtons();
      status.textContent = mode === "smooth" ? "Calcul du lissage spatial…" : "Préparation de la carte…";
      updateGuide(series);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      if (token !== updateToken) return;

      const two = series.years.length === 2;
      const showDelta = two && mode !== "bureaux";
      const grids = {};
      let deltaValues;
      let deltaNear;
      let scoreScale;
      let deltaScale;
      const rows = series.communes;
      if (mode === "smooth") {
        series.years.forEach((year) => { grids[year] = makeGrid(year, activeForce); });
        const reference = grids[series.years[0]];
        if (two) {
          deltaValues = new Float64Array(reference.values.length).fill(NODATA);
          deltaNear = new Float64Array(reference.values.length).fill(-1);
          grids[2019].values.forEach((value, index) => {
            const next = grids[2026].values[index];
            if (value > FLOOR && next > FLOOR) deltaValues[index] = next - value;
            deltaNear[index] = Math.max(grids[2019].near[index], grids[2026].near[index]);
          });
          deltaScale = deltaClasses(Array.from(deltaValues));
        }
        scoreScale = scoreClasses(
          series.color,
          series.years.flatMap((year) => Array.from(grids[year].values))
        );
      } else if (mode === "bureaux") {
        scoreScale = scoreClasses(
          series.color,
          series.years.flatMap((year) => siteRows(year, activeForce).map((site) => site.pct)),
          6
        );
      } else {
        const values = Array.from(rows.values());
        scoreScale = scoreClasses(
          series.color,
          values.flatMap((row) => series.years.map((year) => yearValue(row, year))),
          5
        );
        if (two) deltaScale = deltaClasses(values.map((row) => row.evolution_points));
      }

      svg.attr("viewBox", `0 0 ${layout.width} ${layout.height}`);
      defs.selectAll("*").remove();
      content.selectAll("*").remove();
      probes = [];
      tooltip.style.opacity = 0;

      drawTitle(series);

      const where = activeZoom ? `dans le ${zoomViews[activeZoom].label}` : `dans la ${provinceDisplay[activeProvince]}`;
      const raw = {};
      series.years.forEach((year) => { raw[year] = activeZoom ? zoomScore(year) : series.score[year]; });
      const rawDelta = two ? raw[2026] - raw[2019] : NaN;
      const panels = series.years.map((year) => ({
        year,
        title: String(year),
        subtitle: `${format1.format(raw[year])} % ${where}`,
        values: grids[year]?.values,
        near: grids[year]?.near,
        accessor: (row) => yearValue(row, year),
        classes: scoreScale,
        headingColor: textColor(series.color)
      }));
      if (showDelta) {
        panels.push({
          year: null,
          title: "Évolution",
          subtitle: `${signed1.format(rawDelta)} points ${where}`,
          values: deltaValues,
          near: deltaNear,
          accessor: (row) => row.evolution_points,
          classes: deltaScale,
          headingColor: rawDelta >= 0 ? increase : decrease
        });
      }
      const surfaceGrid = grids[series.years[0]];

      panels.forEach((panel, panelIndex) => {
        const [x, y] = layout.origin(panelIndex);
        const group = content.append("g")
          .attr("class", `geography-panel geography-panel-${panelIndex}`)
          .attr("transform", `translate(${x},${y})`);
        const rc = rough.svg(group.node());
        roughRect(group, rc, 0, 0, layout.panelWidth, layout.panelHeight, {
          stroke: frame,
          strokeWidth: 0.7,
          roughness: 1.6,
          bowing: 1.3,
          opacity: 0.9,
          seed: `panel-${uid}-${panelIndex}-${compact}`
        });
        panelTitle(group, panel.title, panel.subtitle, panel.headingColor);

        const viewClipId = `${uid}-view-${panelIndex}`;
        defs.append("clipPath").attr("id", viewClipId).append("rect")
          .attr("x", viewRect.x0).attr("y", viewRect.y0)
          .attr("width", viewRect.x1 - viewRect.x0).attr("height", viewRect.y1 - viewRect.y0);
        const landClipId = `${uid}-land-${panelIndex}`;
        defs.append("clipPath").attr("id", landClipId).append("path")
          .attr("d", localPath(activeBoundary));

        const framed = group.append("g").attr("clip-path", `url(#${viewClipId})`);
        const land = framed.append("g").attr("clip-path", `url(#${landClipId})`);
        land.append("path").attr("d", localPath(activeBoundary)).attr("fill", noData);
        if (mode === "smooth") {
          drawSurface(land, rc, surfaceGrid, panel.values, panel.classes, panelIndex);
          drawFarOverlay(land, rc, surfaceGrid, panel.near, panelIndex);
        } else if (mode === "bureaux") {
          land.append("path").attr("d", localPath(activeBoundary)).attr("fill", "#f4f0e8");
        } else {
          drawCommuneFills(land, rc, rows, panel.accessor, panel.classes, panelIndex);
        }
        addMapFurniture(framed, panelIndex, rc);
        framed.append("rect")
          .attr("class", "geography-surface-hit")
          .attr("x", viewRect.x0).attr("y", viewRect.y0)
          .attr("width", viewRect.x1 - viewRect.x0).attr("height", viewRect.y1 - viewRect.y0)
          .attr("fill", "transparent")
          .on("pointermove pointerdown", (event) => readSurface(event, group.node(), grids))
          .on("pointerleave", () => {
            hideProbe();
            tooltip.style.opacity = 0;
          });
        const probe = framed.append("g")
          .attr("class", "geography-probe")
          .attr("pointer-events", "none")
          .attr("opacity", 0);
        probe.append("circle").attr("r", 6.5).attr("fill", "none").attr("stroke", paper).attr("stroke-width", 3.4);
        probe.append("circle").attr("r", 6.5).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 1.5);
        probes.push(probe);
        if (panel.year && (mode === "bureaux" || showPoints)) {
          addMarkers(framed, panel.year, activeForce, rc, mode === "communes" ? null : scoreScale);
        }
        addLabels(framed);
        if (activeZoom) {
          roughRect(group, rc, viewRect.x0, viewRect.y0, viewRect.x1 - viewRect.x0, viewRect.y1 - viewRect.y0, {
            stroke: ink, strokeWidth: 0.7, roughness: 1.2, opacity: 0.55,
            seed: `zoom-frame-${uid}-${panelIndex}`
          });
        }
      });

      const baseLabel = series.participation ? "% DES INSCRITS" : "% DES EXPRIMÉS";
      const scoreTitle = {
        communes: `SCORE COMMUNAL (${baseLabel})`,
        bureaux: `SCORE DU LIEU DE VOTE (${baseLabel})`,
        smooth: `SCORE LISSÉ ET DES BUREAUX (${baseLabel})`
      }[mode];
      drawLegend(
        ...layout.legend.score,
        compact || !two ? scoreTitle : `${scoreTitle} · MÊME ÉCHELLE 2019 ET 2026`,
        scoreScale,
        `${uid}-score`
      );
      if (showDelta) drawLegend(...layout.legend.delta, "ÉVOLUTION 2026 − 2019 (POINTS)", deltaScale, `${uid}-delta`);
      drawNotes(...layout.legend.notes);
      label(content, "contours.nc", layout.width - 15, layout.height - 13, {
        anchor: "end", family: "Cabin Sketch, sans-serif", size: 12,
        weight: 700, color: "#777066", halo: true
      });

      const place = activeZoom ? `le ${zoomViews[activeZoom].label}` : `la ${provinceDisplay[activeProvince]}`;
      svg.attr(
        "aria-label",
        two
          ? `${series.label} dans ${place}, ${{ communes: "par commune", bureaux: "par lieu de vote", smooth: "scores lissés" }[mode]} : ` +
            `${format1.format(raw[2019])} % en 2019, ${format1.format(raw[2026])} % en 2026, ` +
            `soit ${signed1.format(rawDelta)} points. Trois cartes : 2019, 2026 et évolution locale.`
          : `${series.label} dans ${place} en ${series.years[0]}, ${{ communes: "par commune", bureaux: "par lieu de vote", smooth: "scores lissés" }[mode]} : ` +
            `${format1.format(raw[series.years[0]])} % des exprimés.`
      );
      status.textContent = {
        communes: "Vue Communes : résultats observés par commune.",
        bureaux: "Vue Bureaux : résultats observés par lieu de vote.",
        smooth: `Vue Lissage : estimation sur ${formatKm.format(bandwidthKm)} km${activeZoom ? ", plus fine que la vue provinciale" : ""}.`
      }[mode];
      drawCommuneChart();
      root.dataset.geographyReady = "true";
      window.__provincialesGeoReady = true;
    }

    // --- Synthèse communale et intra-communale ---------------------------------

    // Une ligne par commune : score 2019 (cercle vide) → 2026 (cercle plein),
    // ou score de l'année pour une liste, et chaque bureau de la dernière
    // année en trait vertical, pour lire l'écart interne à la commune.
    function drawCommuneChart() {
      const series = getSeries(activeForce);
      const two = series.years.length === 2;
      const year = lastYear();
      const rows = Array.from(series.communes.values())
        .filter((row) => Number.isFinite(yearValue(row, year)))
        .sort((a, b) => d3.descending(yearValue(a, year), yearValue(b, year)));
      const yearOffices = pointsFor(year, false);
      const offices = d3.group(yearOffices, (d) => d.commune);
      const width = compact ? compactWidth() : 1180;
      const nameWidth = compact ? 86 : 170;
      const deltaWidth = two ? (compact ? 44 : 110) : 20;
      const left = 20 + nameWidth;
      const right = width - 20 - deltaWidth;
      const rowHeight = compact ? 30 : 28;
      const top = compact ? 104 : 96;
      const height = top + rows.length * rowHeight + 46;
      const allValues = rows.flatMap((row) => series.years.map((y) => yearValue(row, y)))
        .concat(yearOffices.map((d) => d.pct))
        .filter(Number.isFinite);
      const maxValue = Math.min(100, Math.ceil((d3.max(allValues) || 10) / 10) * 10);
      const x = d3.scaleLinear().domain([0, maxValue]).range([left, right]);
      const unit = series.participation ? "inscrits" : "exprimés";
      const color = series.color;

      chartSvg.selectAll("*").remove();
      chartSvg.attr("viewBox", `0 0 ${width} ${height}`);
      const rc = rough.svg(chartSvg.node());

      label(chartSvg, compact ? "Par commune, par bureau" : "Commune par commune, bureau par bureau", 20, 28, {
        family: "Cabin Sketch, sans-serif", size: compact ? 18 : 24, weight: 700
      });
      label(chartSvg, compact ? `${provinceDisplay[activeProvince]} · résultats bruts, % des ${unit}` : `${series.label} · ${provinceDisplay[activeProvince]} · résultats bruts, % des ${unit}`, 20, 55, {
        size: compact ? 10.5 : 12.5, weight: 780, color: muted
      });

      // Légende de lecture.
      const keyY = compact ? 80 : 76;
      let keyX = compact ? 20 : left;
      if (two) {
        roughCircle(chartSvg, rc, keyX + 6, keyY, 10, { fill: paper, fillStyle: "solid", seed: `${uid}-key-19` });
        label(chartSvg, "2019", keyX + 16, keyY, { size: 10.5, weight: 750, color: muted });
        keyX += 56;
      }
      roughCircle(chartSvg, rc, keyX + 6, keyY, 11, { fill: color, fillStyle: "solid", seed: `${uid}-key-26` });
      // Les traits des bureaux restent lisibles même pour une teinte claire.
      label(chartSvg, String(year), keyX + 17, keyY, { size: 10.5, weight: 750, color: muted });
      chartSvg.append("line")
        .attr("x1", keyX + 62).attr("x2", keyX + 62).attr("y1", keyY - 6).attr("y2", keyY + 6)
        .attr("stroke", hatchColor(color)).attr("stroke-width", 1.6).attr("stroke-opacity", 0.75);
      label(chartSvg, compact ? `un bureau en ${year}` : `un bureau de vote en ${year} (écart interne à la commune)`, keyX + 70, keyY, {
        size: 10.5, weight: 750, color: muted
      });

      // Axe.
      const ticks = x.ticks(compact ? 2 : 8);
      const axis = chartSvg.append("g").attr("pointer-events", "none");
      ticks.forEach((tick) => {
        axis.append("line")
          .attr("x1", x(tick)).attr("x2", x(tick))
          .attr("y1", top - 6).attr("y2", top + rows.length * rowHeight)
          .attr("stroke", frame).attr("stroke-width", 0.8)
          .attr("stroke-dasharray", tick === 0 ? null : "3 3");
        label(axis, `${format0.format(tick)} %`, x(tick), height - 26, {
          anchor: "middle", size: 10, weight: 700, color: muted
        });
      });
      if (two && !compact) {
        label(chartSvg, "Évolution", right + 18, top - 14, { size: 10.5, weight: 850, color: muted });
      }

      rows.forEach((row, index) => {
        const y = top + index * rowHeight + rowHeight / 2;
        const name = titleCaseCommune(row.commune, activeProvince);
        const list = (offices.get(row.commune) || []).filter((d) => Number.isFinite(d.pct));
        const current = yearValue(row, year);
        const previous = two ? row.score_2019 : NaN;
        const delta = two ? row.evolution_points : NaN;
        const g = chartSvg.append("g").attr("class", "geography-chart-row");
        if (index % 2 === 0) {
          g.append("rect")
            .attr("x", 14).attr("y", y - rowHeight / 2).attr("width", width - 28).attr("height", rowHeight)
            .attr("fill", "#f6f1e7").attr("opacity", 0.6);
        }
        label(g, name, 20 + nameWidth - 10, y, {
          anchor: "end", size: compact ? 10.2 : 11.8, weight: 800
        });
        if (list.length > 1) {
          const extent = d3.extent(list, (d) => d.pct);
          g.append("rect")
            .attr("x", x(extent[0])).attr("y", y - 7)
            .attr("width", Math.max(1, x(extent[1]) - x(extent[0]))).attr("height", 14)
            .attr("rx", 3)
            .attr("fill", color).attr("fill-opacity", 0.12);
        }
        list.forEach((office) => {
          g.append("line")
            .attr("x1", x(office.pct)).attr("x2", x(office.pct))
            .attr("y1", y - 7).attr("y2", y + 7)
            .attr("stroke", hatchColor(color))
            .attr("stroke-width", 1.3)
            .attr("stroke-opacity", 0.55);
        });
        if (Number.isFinite(previous)) {
          g.append("line")
            .attr("x1", x(previous)).attr("x2", x(current))
            .attr("y1", y).attr("y2", y)
            .attr("stroke", ink).attr("stroke-width", 1.4);
          roughCircle(g, rc, x(previous), y, 10, {
            fill: paper, fillStyle: "solid", strokeWidth: 1, roughness: 0.8,
            seed: `${uid}-${activeForce}-${row.commune}-19`
          });
        }
        roughCircle(g, rc, x(current), y, 12, {
          fill: color, fillStyle: "solid", strokeWidth: 1, roughness: 0.8,
          seed: `${uid}-${activeForce}-${row.commune}-${year}`
        });
        if (Number.isFinite(delta)) {
          label(g, `${signed1.format(delta)}${compact ? "" : " pts"}`, right + (compact ? 8 : 18), y, {
            size: compact ? 10 : 11.5, weight: 850, color: delta >= 0 ? increase : decrease
          });
        }
        const description = [
          `${name} : ${format1.format(current)} % en ${year}`,
          two ? (Number.isFinite(previous) ? `${format1.format(previous)} % en 2019` : "pas de comparaison 2019") : "",
          Number.isFinite(delta) ? `${signed1.format(delta)} points` : "",
          list.length > 1
            ? `bureaux de ${format1.format(d3.min(list, (d) => d.pct))} à ${format1.format(d3.max(list, (d) => d.pct))} %`
            : ""
        ].filter(Boolean).join(", ");
        g.append("rect")
          .attr("class", "geography-chart-hit")
          .attr("x", 14).attr("y", y - rowHeight / 2).attr("width", width - 28).attr("height", rowHeight)
          .attr("fill", "transparent")
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr("aria-label", description)
          .on("pointermove pointerenter focus", function(event) {
            const isFocus = event.type === "focus";
            const px = isFocus ? NaN : d3.pointer(event, chartSvg.node())[0];
            const nearest = isFocus || !list.length
              ? null
              : list.reduce((best, office) => (
                Math.abs(x(office.pct) - px) < Math.abs(x(best.pct) - px) ? office : best
              ), list[0]);
            const closeEnough = nearest && Math.abs(x(nearest.pct) - px) <= 4;
            tooltip.innerHTML = closeEnough
              ? [
                `<strong>${escapeHtml(placeName([nearest.bureau_nom]))}</strong>`,
                `<span>${escapeHtml(name)} · bureau nᵒ ${Number(nearest.code_bv)} · ${year}</span>`,
                `<div class="geography-tip-score">${format1.format(nearest.pct)} %</div>`,
                `<span>${format0.format(nearest.voix)} sur ${format0.format(nearest.denominateur)} ${unit}</span>`
              ].join("")
              : [
                `<strong>${escapeHtml(name)}</strong>`,
                `<div class="geography-tip-grid">`,
                two
                  ? `<span>2019</span><b>${Number.isFinite(previous) ? `${format1.format(previous)} %` : "—"}</b>`
                  : "",
                `<span>${year}</span><b>${format1.format(current)} %</b>`,
                Number.isFinite(delta)
                  ? `<span>Évolution</span><b class="${delta >= 0 ? "is-up" : "is-down"}">${signed1.format(delta)} pts</b>`
                  : "",
                list.length > 1
                  ? `<span>Bureaux ${year}</span><b>${format0.format(d3.min(list, (d) => d.pct))}–${format0.format(d3.max(list, (d) => d.pct))} %</b>`
                  : "",
                `</div>`,
                `<span class="habitat-tooltip-note">${list.length} bureau${list.length > 1 ? "x" : ""} en ${year}.</span>`
              ].join("");
            positionTooltip(root, tooltip, isFocus ? focusPointer(this) : event);
          })
          .on("pointerleave blur", () => { tooltip.style.opacity = 0; });
      });

      roughRect(chartSvg, rc, 8, 6, width - 16, height - 12, {
        stroke: frame, strokeWidth: 0.7, roughness: 1.5, opacity: 0.9, seed: `${uid}-chart-frame`
      });
      label(chartSvg, "contours.nc", width - 18, height - 12, {
        anchor: "end", family: "Cabin Sketch, sans-serif", size: 11, weight: 700, color: "#777066"
      });
      chartSvg.attr(
        "aria-label",
        two
          ? `${series.label}, ${provinceDisplay[activeProvince]} : score de chaque commune en 2019 et en 2026, ` +
            "et dispersion des résultats des bureaux de vote de 2026 à l’intérieur de chaque commune."
          : `${series.label}, ${provinceDisplay[activeProvince]} : score de chaque commune en ${year}, ` +
            `et dispersion des résultats des bureaux de vote à l’intérieur de chaque commune.`
      );
    }

    // --- Événements --------------------------------------------------------------

    updateForceOptions();
    forceSelect.addEventListener("change", () => {
      activeForce = forceSelect.value;
      update();
    });
    modeButtons.forEach((button) => button.addEventListener("click", () => {
      if (mode === button.dataset.mode) return;
      mode = button.dataset.mode;
      update();
    }));
    zoomButton.addEventListener("click", () => {
      activeZoom = activeZoom ? null : zoomAvailable();
      update();
    });
    pointsButton.addEventListener("click", () => {
      showPoints = !showPoints;
      pointsButton.setAttribute("aria-pressed", String(showPoints));
      pointsButton.textContent = showPoints ? "Bureaux visibles" : "Bureaux masqués";
      update();
    });
    download.addEventListener("click", () => downloadPng(
      svg.node(),
      download,
      `provinciales-${getSeries(activeForce).years.join("-")}-${provinceSlug[activeProvince]}-${activeZoom ? "grand-noumea-" : ""}${{ communes: "communes", bureaux: "bureaux", smooth: "lissage" }[mode]}-${activeForce.replace(/[^a-z0-9-]+/gi, "-")}-contours-nc.png`
    ));

    let resizeTimer;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = root.clientWidth < 700;
        if (next === compact && (!compact || Math.abs(compactWidth() - layout.width) < 12)) return;
        compact = next;
        update();
      }, 180);
    });

    update();
  }

  // ---------------------------------------------------------------------------
  // Nuages de points : bureaux appariés, 2019 en abscisse, 2026 en ordonnée
  // ---------------------------------------------------------------------------

  // Score de chaque bureau (clé « commune|numéro ») pour une famille, une liste
  // (« liste:2019-11 »), la participation ou l'abstention.
  function seriesBureauValues(points, listVotes, province, key, year) {
    const values = new Map();
    if (String(key).startsWith("liste:")) {
      const id = key.slice(6);
      const base = new Map(
        points
          .filter((d) => d.province === province && d.annee === year && d.force === "participation")
          .map((d) => [`${d.commune}|${Number(d.code_bv)}`, d.exprimes])
      );
      listVotes
        .filter((d) => d.province === province && d.liste_id === id && d.annee === year)
        .forEach((d) => {
          const exprimes = base.get(`${d.commune}|${Number(d.code_bv)}`);
          if (exprimes > 0) values.set(`${d.commune}|${Number(d.code_bv)}`, 100 * d.voix / exprimes);
        });
    } else {
      const force = key === "abstention" ? "participation" : key;
      points
        .filter((d) => d.province === province && d.annee === year && d.force === force)
        .forEach((d) => {
          values.set(`${d.commune}|${Number(d.code_bv)}`, key === "abstention" ? 100 - d.pct : d.pct);
        });
    }
    return values;
  }

  function matchedPairs(matches, province) {
    return matches
      .filter((d) => d.province === province && (d.methode === "nom" || d.methode === "numero"))
      .map((d) => ({
        commune: d.commune,
        code2019: Number(d.code_bv_2019),
        code2026: Number(d.code_bv_2026),
        name2019: d.nom_2019,
        name2026: d.nom_2026,
        inscrits2019: d.inscrits_2019,
        inscrits2026: d.inscrits_2026,
        // Électorat modifié de plus de 40 % : comparaison fragile.
        unstable: !(d.inscrits_2026 / d.inscrits_2019 >= 0.6 && d.inscrits_2026 / d.inscrits_2019 <= 1.6)
      }));
  }

  function mountScatter(root, data) {
    const { points, summary, lists, listVotes, matches } = data;
    const uid = root.id || `nuage-${scatterRoots.indexOf(root) + 1}`;
    const province = provinceFromSlug[root.dataset.province] || "Province Sud";
    const defaults = [
      [root.dataset.xA, root.dataset.yA],
      [root.dataset.xB, root.dataset.yB]
    ];
    let compact = root.clientWidth < 700;
    let highlight = "";

    // Bureaux appariés de la province (audit : appariement_bureaux_2019_2026.csv).
    const pairs = matchedPairs(matches, province);
    // Couleur par commune : palette catégorielle ; les communes qui comptent le
    // plus de bureaux reçoivent les teintes les plus distinctes.
    const communePalette = [
      "#4e79a7", "#e15759", "#59a14f", "#f28e2b", "#b07aa1", "#76b7b2", "#edc948", "#9c755f", "#ff9da7",
      "#499894", "#d37295", "#86bcb6", "#8cd17d", "#a0cbe8", "#ffbe7d", "#bab0ac", "#f1ce63", "#79706e"
    ];
    const communeCounts = d3.rollup(pairs, (values) => values.length, (d) => d.commune);
    const communesList = Array.from(communeCounts.keys()).sort((a, b) =>
      d3.descending(communeCounts.get(a), communeCounts.get(b)) || a.localeCompare(b, "fr")
    );
    const communeColor = new Map(communesList.map((name, index) => [name, communePalette[index % communePalette.length]]));

    // --- Séries disponibles ----------------------------------------------------
    const families = summary
      .filter((d) => d.province === province && d.annee === 2026 && d.force !== "participation")
      .sort((a, b) => d3.ascending(a.ordre, b.ordre));
    const familyInfo = new Map(families.map((d) => [d.force, d]));
    const listInfo = new Map(lists.filter((d) => d.province === province).map((d) => [`liste:${d.liste_id}`, d]));
    const valueCache = new Map();

    function seriesLabel(key, year) {
      if (key === "participation") return "Participation";
      if (key === "abstention") return "Abstention";
      if (listInfo.has(key)) return listInfo.get(key).liste_label;
      return familyInfo.get(key)?.force_label || key;
    }

    function seriesColor(key) {
      if (key === "participation") return "#d18b24";
      if (key === "abstention") return "#6f6a8f";
      if (listInfo.has(key)) return listInfo.get(key).couleur;
      return familyInfo.get(key)?.couleur || ink;
    }

    function seriesUnit(key) {
      return key === "participation" || key === "abstention" ? "des inscrits" : "des exprimés";
    }

    function valuesFor(key, year) {
      const cacheKey = `${key}|${year}`;
      if (!valueCache.has(cacheKey)) {
        valueCache.set(cacheKey, seriesBureauValues(points, listVotes, province, key, year));
      }
      return valueCache.get(cacheKey);
    }

    function optionsFor(year) {
      const yearLists = Array.from(listInfo.entries())
        .filter(([, d]) => d.annee === year)
        .sort((a, b) => d3.ascending(a[1].ordre, b[1].ordre));
      return [
        ["Familles politiques", families.map((d) => [d.force, d.force_label])],
        [`Listes ${year}`, yearLists.map(([key, d]) => [key, `${d.liste_label} (${format1.format(d.score)} %)`])],
        ["Mobilisation", [["participation", "Participation"], ["abstention", "Abstention"]]]
      ];
    }

    // --- Structure ------------------------------------------------------------------
    root.innerHTML = "";
    root.classList.add("geography-scatter", "habitat-sketch--mobile-fluid");
    const toolbar = document.createElement("div");
    toolbar.className = "geography-map-controls";
    // Légende des communes : chaque bouton met sa commune en évidence dans les
    // deux graphiques ; un second clic, ou « Toutes », rétablit l'ensemble.
    const legend = document.createElement("div");
    legend.className = "geography-scatter-legend";
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", "Communes : mettre une commune en évidence");
    const legendButtons = [["", "Toutes"], ...communesList.map((name) => [name, titleCaseCommune(name, province)])]
      .map(([value, text]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "geography-scatter-chip";
        button.dataset.commune = value;
        if (value) {
          const swatch = document.createElement("span");
          swatch.className = "geography-scatter-swatch";
          swatch.style.background = communeColor.get(value);
          swatch.setAttribute("aria-hidden", "true");
          button.appendChild(swatch);
        }
        button.appendChild(document.createTextNode(text));
        legend.appendChild(button);
        return button;
      });
    toolbar.appendChild(legend);
    root.appendChild(toolbar);

    const grid = document.createElement("div");
    grid.className = "geography-scatter-grid";
    root.appendChild(grid);
    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip geography-map-tooltip";
    tooltip.setAttribute("role", "status");
    root.appendChild(tooltip);

    const charts = defaults.map(([xKey, yKey], index) => {
      const card = document.createElement("figure");
      card.className = "geography-scatter-card";
      const controls = document.createElement("div");
      controls.className = "geography-scatter-controls";
      const makeSelect = (year, selected, text) => {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(text));
        const select = document.createElement("select");
        select.className = "habitat-map-select";
        select.setAttribute("aria-label", `${text}, graphique ${index + 1}`);
        optionsFor(year).forEach(([title, options]) => {
          if (!options.length) return;
          const group = document.createElement("optgroup");
          group.label = title;
          options.forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            group.appendChild(option);
          });
          select.appendChild(group);
        });
        select.value = selected;
        if (select.value !== selected) select.selectedIndex = 0;
        labelNode.appendChild(select);
        controls.appendChild(labelNode);
        return select;
      };
      const xSelect = makeSelect(2019, xKey, "2019 (abscisse)");
      const ySelect = makeSelect(2026, yKey, "2026 (ordonnée)");
      card.appendChild(controls);
      const svgNode = d3.select(card).append("svg").attr("role", "img").attr("tabindex", 0);
      const caption = document.createElement("figcaption");
      caption.className = "geography-scatter-caption";
      card.appendChild(caption);
      grid.appendChild(card);
      const chart = { index, xSelect, ySelect, svg: svgNode, caption, focus: -1, sites: [] };
      xSelect.addEventListener("change", () => draw(chart));
      ySelect.addEventListener("change", () => draw(chart));
      return chart;
    });

    function showTip(chart, site, pointer) {
      const xKey = chart.xSelect.value;
      const yKey = chart.ySelect.value;
      const delta = site.y - site.x;
      const sameSeries = xKey === yKey;
      tooltip.innerHTML = [
        `<strong>${escapeHtml(placeName([site.name2026]))}</strong>`,
        `<span>${escapeHtml(titleCaseCommune(site.commune, province))} · bureau nᵒ ${site.code2019}${site.code2019 !== site.code2026 ? ` (nᵒ ${site.code2026} en 2026)` : ""}</span>`,
        `<div class="geography-tip-grid">`,
        `<span>2019 · ${escapeHtml(seriesLabel(xKey))}</span><b>${format1.format(site.x)} %</b>`,
        `<span>2026 · ${escapeHtml(seriesLabel(yKey))}</span><b>${format1.format(site.y)} %</b>`,
        sameSeries ? `<span>Évolution</span><b class="${delta >= 0 ? "is-up" : "is-down"}">${signed1.format(delta)} pts</b>` : "",
        `<span>Inscrits</span><b>${format0.format(site.inscrits2019)} → ${format0.format(site.inscrits2026)}</b>`,
        `</div>`,
        site.unstable ? `<span class="habitat-tooltip-note">Électorat modifié de plus de 40 % : comparaison fragile.</span>` : ""
      ].join("");
      positionTooltip(root, tooltip, pointer);
    }

    function draw(chart) {
      const xKey = chart.xSelect.value;
      const yKey = chart.ySelect.value;
      const xs = valuesFor(xKey, 2019);
      const ys = valuesFor(yKey, 2026);
      const sites = pairs
        .map((pair) => ({
          ...pair,
          x: xs.get(`${pair.commune}|${pair.code2019}`),
          y: ys.get(`${pair.commune}|${pair.code2026}`)
        }))
        .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
        .sort((a, b) => d3.ascending(a.x, b.x));
      chart.sites = sites;
      chart.focus = -1;

      const width = compact ? Math.max(300, Math.min(440, root.clientWidth - 8)) : 560;
      const height = compact ? width + 40 : 520;
      const margin = { top: 74, right: 18, bottom: 54, left: 52 };
      // Chaque axe suit l'étendue de ses propres résultats : un petit score
      // reste lisible au lieu d'être écrasé par l'échelle de l'autre axe.
      const niceMax = (value) => Math.min(100, d3.scaleLinear().domain([0, Math.max(4, value * 1.06)]).nice().domain()[1]);
      const xMax = niceMax(d3.max(sites, (d) => d.x) || 10);
      const yMax = niceMax(d3.max(sites, (d) => d.y) || 10);
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const x = d3.scaleLinear().domain([0, xMax]).range([margin.left, margin.left + plotWidth]);
      const y = d3.scaleLinear().domain([0, yMax]).range([margin.top + plotHeight, margin.top]);
      const radius = d3.scaleSqrt().domain([0, d3.max(pairs, (d) => d.inscrits2026) || 1]).range([2.5, compact ? 8 : 10]);
      const svg = chart.svg;
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      const rc = rough.svg(svg.node());

      // Titre court : libellés sans sigle entre parenthèses, tronqués à la largeur.
      const short = (key) => seriesLabel(key).replace(/\s*\(.*\)\s*$/, "");
      const maxChars = Math.floor((width - 20) / 9);
      const titleText = `${short(xKey)} → ${short(yKey)}`;
      label(svg, titleText.length > maxChars ? `${titleText.slice(0, maxChars - 1)}…` : titleText, 10, 18, {
        family: "Cabin Sketch, sans-serif", size: compact ? 16 : 18, weight: 700
      });
      label(svg, `${sites.length} bureaux présents en 2019 et en 2026 · ${titleCaseCommune(highlight, province) || provinceDisplay[province]}`, 10, 40, {
        size: 11, weight: 750, color: muted
      });

      // Axes et grille.
      const axis = svg.append("g").attr("pointer-events", "none");
      const tickFormat = (tick) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(tick)} %`;
      x.ticks(compact ? 4 : 6).forEach((tick) => {
        axis.append("line").attr("x1", x(tick)).attr("x2", x(tick)).attr("y1", y(0)).attr("y2", y(yMax))
          .attr("stroke", frame).attr("stroke-width", 0.7).attr("stroke-dasharray", tick ? "3 3" : null);
        label(axis, tickFormat(tick), x(tick), y(0) + 14, { anchor: "middle", size: 10, weight: 700, color: muted });
      });
      y.ticks(compact ? 4 : 6).forEach((tick) => {
        axis.append("line").attr("x1", x(0)).attr("x2", x(xMax)).attr("y1", y(tick)).attr("y2", y(tick))
          .attr("stroke", frame).attr("stroke-width", 0.7).attr("stroke-dasharray", tick ? "3 3" : null);
        label(axis, tickFormat(tick), x(0) - 6, y(tick), { anchor: "end", size: 10, weight: 700, color: muted });
      });
      label(axis, `2019 · % ${seriesUnit(xKey)}`, x(xMax), y(0) + 34, { anchor: "end", size: 10.5, weight: 800, color: muted });
      label(axis, `2026 · % ${seriesUnit(yKey)}`, x(0), y(yMax) - 10, { size: 10.5, weight: 800, color: muted });
      // Diagonale : même score en 2019 et en 2026, tracée jusqu'au plus petit
      // des deux maximums (les axes n'ont pas la même échelle).
      const diagonal = Math.min(xMax, yMax);
      roughPath(svg, rc, `M${x(0)},${y(0)}L${x(diagonal)},${y(diagonal)}`, {
        stroke: ink, strokeWidth: 0.9, roughness: 1.1, opacity: 0.55, seed: `${uid}-diag-${chart.index}`
      });
      label(svg, "même score", x(diagonal * 0.72) + 6, y(diagonal * 0.72) + 2, {
        size: 10, weight: 800, color: muted, halo: true
      });

      // Points crayonnés : aplat léger puis hachures dans la couleur de la
      // commune. Les plus gros d'abord, pour garder les petits visibles ; la
      // commune mise en évidence passe au premier plan.
      const isActive = (site) => !highlight || site.commune === highlight;
      const ordered = sites.slice().sort((a, b) =>
        d3.ascending(isActive(a), isActive(b)) || d3.descending(a.inscrits2026, b.inscrits2026)
      );
      const dots = svg.append("g").attr("class", "geography-scatter-dots").attr("pointer-events", "none");
      ordered.forEach((site) => {
        const active = isActive(site);
        const fill = active ? communeColor.get(site.commune) : "#d9d3c8";
        const r = radius(site.inscrits2026);
        dots.append("circle")
          .attr("cx", x(site.x)).attr("cy", y(site.y)).attr("r", r)
          .attr("fill", site.unstable ? paper : fill)
          .attr("fill-opacity", active ? 0.42 : 0.35);
        roughCircle(dots, rc, x(site.x), y(site.y), r * 2, {
          fill: site.unstable ? "none" : fill,
          fillStyle: "hachure",
          hachureGap: Math.max(1.4, r * 0.38),
          hachureAngle: -41,
          fillWeight: active ? 0.9 : 0.6,
          stroke: active ? ink : "#b9b1a5",
          strokeWidth: site.unstable ? 1.1 : 0.7,
          roughness: 0.9,
          seed: `${uid}-${chart.index}-${site.commune}-${site.code2026}`
        });
        if (site.unstable) {
          dots.append("circle").attr("cx", x(site.x)).attr("cy", y(site.y)).attr("r", r + 2.5)
            .attr("fill", "none").attr("stroke", ink).attr("stroke-width", 0.8).attr("stroke-dasharray", "2 2");
        }
      });

      // Corrélation (chaque bureau compte une fois).
      const r = sites.length > 2 ? pearson(sites) : NaN;
      const corrText = Number.isFinite(r) ? `r = ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(r)}` : "";
      label(svg, corrText, x(0) + 8, y(yMax) + 12, { size: 11.5, weight: 850, halo: true });

      const marker = svg.append("circle").attr("r", 9).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 2)
        .attr("opacity", 0).attr("pointer-events", "none");
      const delaunay = d3.Delaunay.from(sites, (d) => x(d.x), (d) => y(d.y));
      const focusSite = (site, pointer) => {
        marker.attr("cx", x(site.x)).attr("cy", y(site.y)).attr("opacity", 1);
        showTip(chart, site, pointer);
      };
      svg.append("rect")
        .attr("x", margin.left - 8).attr("y", margin.top - 8)
        .attr("width", plotWidth + 16).attr("height", plotHeight + 16)
        .attr("fill", "transparent")
        .on("pointermove pointerdown", (event) => {
          const [px, py] = d3.pointer(event, svg.node());
          const index = delaunay.find(px, py);
          const site = sites[index];
          if (!site || Math.hypot(x(site.x) - px, y(site.y) - py) > 24) {
            marker.attr("opacity", 0);
            tooltip.style.opacity = 0;
            return;
          }
          chart.focus = index;
          focusSite(site, event);
        })
        .on("pointerleave", () => { marker.attr("opacity", 0); tooltip.style.opacity = 0; });
      svg.on("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Escape"].includes(event.key) || !sites.length) return;
        event.preventDefault();
        if (event.key === "Escape") { marker.attr("opacity", 0); tooltip.style.opacity = 0; return; }
        chart.focus = (chart.focus + (event.key === "ArrowRight" ? 1 : -1) + sites.length) % sites.length;
        const site = sites[chart.focus];
        const box = svg.node().getBoundingClientRect();
        const scale = box.width / width;
        focusSite(site, { clientX: box.left + x(site.x) * scale, clientY: box.top + y(site.y) * scale });
      });
      svg.on("blur", () => { marker.attr("opacity", 0); tooltip.style.opacity = 0; });

      roughRect(svg, rc, 2, 2, width - 4, height - 4, { stroke: frame, strokeWidth: 0.7, roughness: 1.4, seed: `${uid}-frame-${chart.index}` });
      label(svg, "contours.nc", width - 10, height - 10, { anchor: "end", family: "Cabin Sketch, sans-serif", size: 11, weight: 700, color: "#777066" });
      svg.attr(
        "aria-label",
        `Nuage de points, ${provinceDisplay[province]} : ${sites.length} bureaux de vote présents en 2019 et 2026. ` +
        `En abscisse, ${seriesLabel(xKey)} en 2019 ; en ordonnée, ${seriesLabel(yKey)} en 2026` +
        (corrText ? ` ; corrélation ${corrText}.` : ".") +
        " Flèches gauche et droite pour parcourir les bureaux."
      );
      const unstable = sites.filter((d) => d.unstable).length;
      chart.caption.textContent =
        (xKey === yKey
          ? "Au-dessus de la diagonale, le score progresse dans le bureau ; en dessous, il recule. "
          : "La diagonale sert de repère : au-dessus, la série de 2026 fait mieux dans le bureau que celle de 2019. ") +
        "Couleur selon la commune, taille selon les inscrits de 2026 ; les deux axes ont chacun leur échelle." +
        (unstable ? ` Cercles en pointillé : ${unstable} bureau${unstable > 1 ? "x" : ""} dont l’électorat a changé de plus de 40 %.` : "");
    }

    function pearson(sites) {
      const mx = d3.mean(sites, (d) => d.x);
      const my = d3.mean(sites, (d) => d.y);
      const sxy = d3.sum(sites, (d) => (d.x - mx) * (d.y - my));
      const sxx = d3.sum(sites, (d) => (d.x - mx) ** 2);
      const syy = d3.sum(sites, (d) => (d.y - my) ** 2);
      return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
    }

    function updateLegend() {
      legendButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.commune === highlight)));
    }
    legendButtons.forEach((button) => button.addEventListener("click", () => {
      highlight = highlight === button.dataset.commune ? "" : button.dataset.commune;
      updateLegend();
      charts.forEach(draw);
    }));
    updateLegend();
    let resizeTimer;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        compact = root.clientWidth < 700;
        charts.forEach(draw);
      }, 180);
    });
    charts.forEach(draw);
    root.dataset.scatterReady = "true";
  }

  // ---------------------------------------------------------------------------
  // Croquis des diapositives « En bref » : cartes communales simplifiées
  // ---------------------------------------------------------------------------

  // Le composant générique déplace les diapositives dans un dialogue : il le
  // transmet dans l'événement d'ouverture.
  briefRoots.forEach((briefRoot) => {
    let started = false;
    const draw = (container) => {
      if (started) return;
      started = true;
      loadData(briefRoot)
        .then((data) => {
          container.querySelectorAll("[data-brief-sketch]").forEach((node) => drawBriefSketch(node, data));
        })
        .catch(() => {
          started = false;
        });
    };
    briefRoot.addEventListener("contours-brief:open", (event) => draw(event.detail?.dialog || briefRoot));
    if (briefRoot.contoursBrief?.isOpen()) draw(briefRoot.contoursBrief.dialog);
  });

  // Croquis de nuage de points : un point par bureau présent aux deux
  // scrutins, en vert s'il progresse, en rouge s'il recule. Même échelle sur les
  // deux axes, pour que la diagonale « même score » soit lisible d'un coup d'œil.
  function drawScatterSketch(node, data) {
    const province = provinceFromSlug[node.dataset.province];
    const xKey = node.dataset.x;
    const yKey = node.dataset.y;
    const svg = d3.select(node);
    svg.selectAll("*").remove();
    const rc = rough.svg(node);
    const xs = seriesBureauValues(data.points, data.listVotes, province, xKey, 2019);
    const ys = seriesBureauValues(data.points, data.listVotes, province, yKey, 2026);
    const sites = matchedPairs(data.matches, province)
      .map((pair) => ({
        ...pair,
        x: xs.get(`${pair.commune}|${pair.code2019}`),
        y: ys.get(`${pair.commune}|${pair.code2026}`)
      }))
      .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
    const maxValue = Math.min(100, d3.scaleLinear()
      .domain([0, (d3.max(sites, (d) => Math.max(d.x, d.y)) || 10) * 1.05]).nice().domain()[1]);
    const minValue = Math.max(0, d3.scaleLinear()
      .domain([(d3.min(sites, (d) => Math.min(d.x, d.y)) || 0) * 0.95, maxValue]).nice().domain()[0]);
    const x = d3.scaleLinear().domain([minValue, maxValue]).range([48, 238]);
    const y = d3.scaleLinear().domain([minValue, maxValue]).range([206, 16]);
    const radius = d3.scaleSqrt().domain([0, d3.max(sites, (d) => d.inscrits2026) || 1]).range([2.2, 7]);
    // Pour un indicateur dont la hausse est défavorable (abstention), le
    // rouge signale la hausse.
    const inverse = node.dataset.inverse === "true";
    const upColor = inverse ? decrease : increase;
    const downColor = inverse ? increase : decrease;

    [minValue, maxValue].forEach((tick) => {
      label(svg, `${format0.format(tick)} %`, x(tick), 220, { anchor: "middle", size: 9, weight: 750, color: muted });
      label(svg, `${format0.format(tick)} %`, 42, y(tick), { anchor: "end", size: 9, weight: 750, color: muted });
    });
    svg.append("rect").attr("x", 48).attr("y", 16).attr("width", 190).attr("height", 190)
      .attr("fill", "none").attr("stroke", frame).attr("stroke-width", 0.8);
    label(svg, "2019 →", 238, 234, { anchor: "end", size: 9.5, weight: 850, color: muted });
    label(svg, "2026 ↑", 48, 9, { size: 9.5, weight: 850, color: muted });
    roughPath(svg, rc, `M${x(minValue)},${y(minValue)}L${x(maxValue)},${y(maxValue)}`, {
      stroke: ink, strokeWidth: 1, roughness: 1, opacity: 0.6, seed: `brief-diag-${node.dataset.briefSketch}`
    });
    sites
      .slice()
      .sort((a, b) => d3.descending(a.inscrits2026, b.inscrits2026))
      .forEach((site, index) => {
        const up = site.y > site.x;
        const fill = up ? upColor : downColor;
        roughCircle(svg, rc, x(site.x), y(site.y), radius(site.inscrits2026) * 2, {
          fill, fillStyle: "hachure", hachureGap: 1.6, fillWeight: 0.8, stroke: ink, strokeWidth: 0.55,
          roughness: 0.8, seed: `brief-${node.dataset.briefSketch}-${index}`
        });
      });

    // Décompte, à droite du graphique.
    const ups = sites.filter((d) => d.y > d.x).length;
    const downs = sites.length - ups;
    label(svg, `${ups}`, 262, 64, { family: "Cabin Sketch, sans-serif", size: 34, weight: 700, color: upColor });
    label(svg, `bureau${ups > 1 ? "x" : ""} en hausse`, 262, 90, { size: 11.5, weight: 850, color: upColor });
    label(svg, `${downs}`, 262, 138, { family: "Cabin Sketch, sans-serif", size: 34, weight: 700, color: downColor });
    label(svg, `bureau${downs > 1 ? "x" : ""} en recul`, 262, 164, { size: 11.5, weight: 850, color: downColor });
    label(svg, "au-dessus de la diagonale : hausse", 262, 196, { size: 8.6, weight: 700, color: muted });
    label(svg, "contours.nc", 410, 237, { anchor: "end", size: 7.5, weight: 760, color: muted });
  }

  // Triptyque : une petite carte d'évolution par province, en vert les
  // communes où l'indicateur progresse, en rouge celles où il recule.
  function drawTriptychSketch(node, data) {
    const svg = d3.select(node);
    svg.selectAll("*").remove();
    const rc = rough.svg(node);
    const panels = (node.dataset.panels || "").split(";").map((item) => {
      const [slug, force, title] = item.split("|");
      return { province: provinceFromSlug[slug], force, title };
    });
    const width = 420 / panels.length;
    panels.forEach((panel, panelIndex) => {
      const x0 = panelIndex * width;
      const rows = data.communeSummary.filter(
        (d) => d.province === panel.province && d.force === panel.force && d.annee === 2026
      );
      const byKey = new Map(rows.map((row) => [communeKey(row.commune, panel.province), row]));
      const classes = deltaClasses(rows.map((row) => row.evolution_points));
      const boundary = {
        type: "FeatureCollection",
        features: data.boundaries.features.filter((feature) => feature.properties.province === panel.province)
      };
      const projection = d3.geoMercator().fitExtent([[x0 + 6, 34], [x0 + width - 6, 200]], boundary);
      const path = d3.geoPath(projection);
      data.communes.features
        .filter((feature) => feature.properties.province === panel.province && feature.geometry && feature.geometry.coordinates.length)
        .forEach((feature, index) => {
          const row = byKey.get(communeKey(feature.properties.commune, panel.province));
          const classId = classIndex(classes, row ? row.evolution_points : NaN);
          const fill = classId < 0 ? noData : classes.colors[classId];
          const pathData = path(feature);
          svg.append("path").attr("d", pathData).attr("fill", fill)
            .attr("stroke", "#5b544c").attr("stroke-width", 0.35).attr("stroke-opacity", 0.6);
          const hatch = classId < 0 ? null : classes.hatch[classId];
          if (hatch) {
            roughPath(svg, rc, pathData, {
              fill: hatchColor(fill), fillStyle: "hachure", hachureAngle: hatch.angle, hachureGap: hatch.gap,
              fillWeight: 0.5, stroke: "none", strokeWidth: 0, roughness: 1.3, opacity: 0.5,
              seed: `brief-tri-${panelIndex}-${index}`
            });
          }
        });
      roughPath(svg, rc, path(boundary), {
        stroke: ink, strokeWidth: 0.9, roughness: 1.1, seed: `brief-tri-coast-${panelIndex}`
      });
      label(svg, panel.title, x0 + width / 2, 14, { anchor: "middle", size: 11.5, weight: 850 });
      label(svg, provinceDisplay[panel.province].replace(/^province /, ""), x0 + width / 2, 28, {
        anchor: "middle", size: 9.5, weight: 750, color: muted
      });
    });
    // Légende commune aux trois cartes.
    svg.append("rect").attr("x", 112).attr("y", 214).attr("width", 14).attr("height", 9).attr("fill", deltaColors[5]);
    label(svg, "hausse", 131, 219, { size: 9.5, weight: 800, color: muted });
    svg.append("rect").attr("x", 190).attr("y", 214).attr("width", 14).attr("height", 9).attr("fill", deltaColors[1]);
    label(svg, "recul", 209, 219, { size: 9.5, weight: 800, color: muted });
    svg.append("rect").attr("x", 258).attr("y", 214).attr("width", 14).attr("height", 9).attr("fill", deltaColors[3])
      .attr("stroke", "#b9b1a5").attr("stroke-width", 0.5);
    label(svg, "stable", 277, 219, { size: 9.5, weight: 800, color: muted });
    label(svg, "contours.nc", 410, 237, { anchor: "end", size: 7.5, weight: 760, color: muted });
  }

  function drawBriefSketch(node, data) {
    if (node.dataset.sketchType === "scatter") {
      drawScatterSketch(node, data);
      return;
    }
    if (node.dataset.sketchType === "triptych") {
      drawTriptychSketch(node, data);
      return;
    }
    const province = provinceFromSlug[node.dataset.province];
    const force = node.dataset.force;
    const variable = node.dataset.variable || "score_2026";
    const highlights = new Set((node.dataset.highlight || "").split("|").filter(Boolean));
    const svg = d3.select(node);
    svg.selectAll("*").remove();
    const rc = rough.svg(node);
    const rows = data.communeSummary.filter(
      (d) => d.province === province && d.force === force && d.annee === 2026
    );
    const byKey = new Map(rows.map((row) => [communeKey(row.commune, province), row]));
    const color = rows[0]?.couleur || ink;
    const classes = variable === "evolution_points"
      ? deltaClasses(rows.map((row) => row.evolution_points))
      : scoreClasses(color, rows.flatMap((row) => [row.score_2019, row.score_2026]), 5);
    const features = data.communes.features.filter(
      (feature) => feature.properties.province === province && feature.geometry && feature.geometry.coordinates.length
    );
    const boundary = {
      type: "FeatureCollection",
      features: data.boundaries.features.filter((feature) => feature.properties.province === province)
    };
    const projection = d3.geoMercator().fitExtent([[12, 10], [408, 196]], boundary);
    const path = d3.geoPath(projection);
    features.forEach((feature, index) => {
      const row = byKey.get(communeKey(feature.properties.commune, province));
      const value = row ? row[variable] : NaN;
      const classId = classIndex(classes, value);
      const fill = classId < 0 ? noData : classes.colors[classId];
      const pathData = path(feature);
      svg.append("path").attr("d", pathData).attr("fill", fill).attr("stroke", "#5b544c")
        .attr("stroke-width", 0.45).attr("stroke-opacity", 0.6);
      const hatch = classId < 0 ? null : classes.hatch[classId];
      if (hatch) {
        roughPath(svg, rc, pathData, {
          fill: hatchColor(fill), fillStyle: "hachure", hachureAngle: hatch.angle,
          hachureGap: hatch.gap + 0.6, fillWeight: 0.6, stroke: "none", strokeWidth: 0,
          roughness: 1.4, opacity: 0.5, seed: `brief-${node.dataset.briefSketch}-${index}`
        });
      }
    });
    roughPath(svg, rc, path(boundary), {
      stroke: ink, strokeWidth: 1.1, roughness: 1.2, seed: `brief-coast-${node.dataset.briefSketch}`
    });
    const placedLabels = [];
    features.forEach((feature) => {
      const row = byKey.get(communeKey(feature.properties.commune, province));
      const name = titleCaseCommune(feature.properties.commune, province);
      if (!row || !highlights.has(name)) return;
      const [cx, cy] = path.centroid(feature);
      if (!Number.isFinite(cx)) return;
      const value = row[variable];
      const text = variable === "evolution_points"
        ? `${name} ${signed1.format(value)}`
        : `${name} ${format1.format(value)} %`;
      roughCircle(svg, rc, cx, cy, 7, { fill: ink, fillStyle: "solid", seed: `brief-dot-${name}` });
      // Étiquette à droite du point, décalée vers le bas si elle en
      // recouvre une autre, et ramenée à gauche près du bord.
      const width = text.length * 6.6;
      let x = cx + 7;
      if (x + width > 414) x = cx - 7 - width;
      let y = cy - 9;
      while (placedLabels.some((box) => x < box[2] && x + width > box[0] && y - 8 < box[3] && y + 8 > box[1])) y += 15;
      placedLabels.push([x, y - 8, x + width, y + 8]);
      label(svg, text, x, y, { size: 12, weight: 850, halo: true, haloWidth: 3.4 });
    });
    // Légende compacte.
    const count = classes.colors.length;
    const itemWidth = 396 / count;
    classes.colors.forEach((fill, index) => {
      const x = 12 + index * itemWidth;
      svg.append("rect").attr("x", x).attr("y", 206).attr("width", itemWidth - 3).attr("height", 9).attr("fill", fill);
      label(svg, classes.labels[index], x + (itemWidth - 3) / 2, 225, {
        anchor: "middle", size: 8.6, weight: 750, color: muted
      });
    });
    label(svg, "contours.nc", 410, 237, { anchor: "end", size: 7.5, weight: 760, color: muted });
  }
})();
