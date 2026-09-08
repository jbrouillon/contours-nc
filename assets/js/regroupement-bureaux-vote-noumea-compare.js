(() => {
  "use strict";

  const root = document.querySelector("[data-access-compare-v2]");
  if (!root || !window.d3 || !window.rough) return;

  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const grid = "#ded8cf";
  const red = "#c54832";
  const green = "#237a67";
  const blue = "#2f7d9f";
  const palette = ["#237d78", "#70a765", "#c99732", "#df6d30", "#c84336", "#862e3e", "#4c2030"];
  const format1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const format0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

  const modeDefinitions = {
    walk: {
      label: "À pied",
      prefix: "",
      thresholds: [10, 15, 20, 30, 45, 60],
      legend: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "≥ 60"],
      legendTitle: "TEMPS À L’ALLER · MINUTES",
      note: "Échelle commune aux trois modes · marche à 5 km/h · 20 min = 40 min aller-retour"
    },
    car: {
      label: "Avec une voiture",
      buttonLabel: "Avec voiture",
      prefix: "car_",
      thresholds: [10, 15, 20, 30, 45, 60],
      legend: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "≥ 60"],
      legendTitle: "MEILLEUR TEMPS, MARCHE OU VOITURE · MINUTES",
      note: "Échelle commune aux trois modes · plus court entre marche directe et voiture porte-à-porte"
    },
    bus: {
      label: "À pied ou en bus",
      buttonLabel: "Pied ou bus",
      prefix: "bus_",
      thresholds: [10, 15, 20, 30, 45, 60],
      legend: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "≥ 60"],
      legendTitle: "MEILLEUR TEMPS, MARCHE DIRECTE OU TANÉO · MINUTES",
      note: "Échelle commune aux trois modes · plus court entre marche directe et Tanéo"
    }
  };
  const scenarioDefinitions = {
    centres_8: { label: "8 lieux · municipales", short: "8 LIEUX", sourceGroup: "centres_8" },
    centres_9: { label: "9 lieux · provinciales", short: "9 LIEUX", sourceGroup: "centres_9" }
  };
  const sourceLabels = {
    R01: "Hôtel de ville",
    R02: "Wawanabu",
    R03: "Jean-Noyant",
    R04: "Jean-Lèques",
    R05: "Laubarède",
    R06: "Ollivaud",
    R07: "Marie-Courtot",
    R08: "Ko We Kara",
    R09: "Kaméré",
    R10: "Vincent-Kafoa"
  };

  Promise.all([
    d3.csv(root.dataset.cells, d3.autoType),
    d3.json(root.dataset.boundary),
    d3.json(root.dataset.routes),
    d3.json(root.dataset.points),
    d3.csv(root.dataset.stats, d3.autoType),
    d3.json(root.dataset.metadata),
    d3.json(root.dataset.iris),
    d3.json(root.dataset.stops),
    d3.csv(root.dataset.methodStats, d3.autoType)
  ]).then(draw).catch((error) => {
    root.innerHTML = `<p class="access-map-error">La comparaison n’a pas pu être chargée (${error.message}).</p>`;
  });

  function seed(value) {
    let hash = 2166136261;
    for (const char of String(value || "contours")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 2147483646) + 1;
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
      .text(text);
  }

  function roughPath(parent, rc, pathData, options = {}) {
    if (!pathData) return null;
    const node = rc.path(pathData, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "solid",
      hachureAngle: options.hachureAngle,
      hachureGap: options.hachureGap,
      fillWeight: options.fillWeight,
      stroke: options.stroke == null ? ink : options.stroke,
      strokeWidth: options.strokeWidth == null ? 1 : options.strokeWidth,
      roughness: options.roughness == null ? 1.75 : options.roughness,
      bowing: options.bowing == null ? 1.25 : options.bowing,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: seed(options.seed || pathData.slice(0, 100))
    });
    parent.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughCircle(parent, rc, x, y, diameter, options = {}) {
    const node = rc.circle(x, y, diameter, {
      fill: options.fill || paper,
      fillStyle: options.fillStyle || "solid",
      hachureGap: options.hachureGap || 2.5,
      fillWeight: options.fillWeight || 0.7,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 1 : options.strokeWidth,
      roughness: options.roughness == null ? 1.65 : options.roughness,
      bowing: options.bowing == null ? 1.2 : options.bowing,
      seed: seed(options.seed || `${x}-${y}-${diameter}`)
    });
    parent.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function pencilFilters(svg, key, frequency = 0.036, displacement = 1.8) {
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
    const slug = key.replace(/[^a-zA-Z0-9]+/g, "-");
    const make = (suffix, freq, scale, filterSeed) => {
      const id = `pencil-${slug}-${suffix}`;
      const filter = defs.append("filter")
        .attr("id", id).attr("x", "-12%").attr("y", "-12%")
        .attr("width", "124%").attr("height", "124%");
      filter.append("feTurbulence")
        .attr("type", "turbulence").attr("baseFrequency", freq)
        .attr("numOctaves", 1).attr("seed", filterSeed).attr("result", "noise");
      filter.append("feDisplacementMap")
        .attr("in", "SourceGraphic").attr("in2", "noise").attr("scale", scale)
        .attr("xChannelSelector", "R").attr("yChannelSelector", "G");
      return `url(#${id})`;
    };
    const filterSeed = seed(key) % 997;
    return {
      primary: make("a", frequency, displacement, filterSeed),
      secondary: make("b", frequency * 2, displacement + 1.6, filterSeed + 17)
    };
  }

  function pencilStroke(parent, pathData, filters, options = {}) {
    if (!pathData) return;
    const common = (selection) => selection
      .attr("d", pathData).attr("fill", "none")
      .attr("stroke", options.stroke || ink)
      .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
      .attr("vector-effect", "non-scaling-stroke");
    common(parent.append("path"))
      .attr("stroke-width", options.strokeWidth || 0.5)
      .attr("stroke-opacity", options.opacity == null ? 0.48 : options.opacity)
      .attr("filter", filters.primary);
    common(parent.append("path"))
      .attr("stroke-width", (options.strokeWidth || 0.5) * 0.52)
      .attr("stroke-opacity", options.secondaryOpacity == null ? 0.23 : options.secondaryOpacity)
      .attr("filter", filters.secondary);
  }

  function positionTooltip(tooltip, event) {
    const bounds = root.getBoundingClientRect();
    const margin = 10;
    const gap = 15;
    tooltip.style.opacity = 0;
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const pointerX = event.clientX - bounds.left + root.scrollLeft;
    const pointerY = event.clientY - bounds.top;
    let x = pointerX + gap;
    let y = pointerY + gap;
    if (x + width > root.scrollLeft + bounds.width - margin) x = pointerX - width - gap;
    if (y + height > bounds.height - margin) y = pointerY - height - gap;
    tooltip.style.left = `${Math.max(root.scrollLeft + margin, x)}px`;
    tooltip.style.top = `${Math.max(margin, y)}px`;
    tooltip.style.opacity = 1;
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

  function fieldFor(mode, scenario, destinationMethod = "nearest") {
    if (mode === "walk" && destinationMethod === "assigned") {
      return `assigned_${scenario}`;
    }
    return `${modeDefinitions[mode].prefix}${scenario}`;
  }

  function draw([cells, boundary, routes, points, stats, metadata, iris, busStops, methodStats]) {
    const requested = new URLSearchParams(window.location.search);
    let activeMode = Object.prototype.hasOwnProperty.call(modeDefinitions, requested.get("mode"))
      ? requested.get("mode")
      : "walk";
    let activeScenario = Object.prototype.hasOwnProperty.call(scenarioDefinitions, requested.get("regroupement"))
      ? requested.get("regroupement")
      : "centres_9";
    let activeDestinationMethod = requested.get("affectation") === "proche"
      ? "nearest"
      : "assigned";
    root.innerHTML = "";
    root.classList.add("access-compare-map");

    const controls = document.createElement("div");
    controls.className = "access-compare-controls";
    const modeGroup = document.createElement("div");
    modeGroup.className = "access-mode-buttons";
    modeGroup.setAttribute("role", "group");
    modeGroup.setAttribute("aria-label", "Mode de déplacement");
    Object.entries(modeDefinitions).forEach(([key, definition]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.mode = key;
      button.textContent = definition.buttonLabel || definition.label;
      button.setAttribute("aria-pressed", String(key === activeMode));
      button.addEventListener("click", () => {
        activeMode = key;
        modeGroup.querySelectorAll("button").forEach((node) => {
          node.setAttribute("aria-pressed", String(node.dataset.mode === activeMode));
        });
        const url = new URL(window.location.href);
        url.searchParams.set("mode", activeMode);
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        update();
      });
      modeGroup.appendChild(button);
    });
    controls.appendChild(modeGroup);
    const assignmentLabel = document.createElement("label");
    assignmentLabel.className = "habitat-map-control-label access-assignment-control";
    assignmentLabel.appendChild(document.createTextNode("Destination"));
    const assignmentSelect = document.createElement("select");
    assignmentSelect.className = "habitat-map-select";
    assignmentSelect.setAttribute("aria-label", "Méthode d’affectation du lieu de vote");
    [
      ["nearest", "Lieu le plus proche"],
      ["assigned", "Bureau attribué au secteur"]
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      option.selected = value === activeDestinationMethod;
      assignmentSelect.appendChild(option);
    });
    assignmentSelect.addEventListener("change", () => {
      activeDestinationMethod = assignmentSelect.value;
      const url = new URL(window.location.href);
      if (activeDestinationMethod === "nearest") {
        url.searchParams.set("affectation", "proche");
      } else {
        url.searchParams.delete("affectation");
      }
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      update();
    });
    assignmentLabel.appendChild(assignmentSelect);
    controls.appendChild(assignmentLabel);
    const scenarioLabel = document.createElement("label");
    scenarioLabel.className = "habitat-map-control-label";
    scenarioLabel.appendChild(document.createTextNode("Comparer avec"));
    const scenarioSelect = document.createElement("select");
    scenarioSelect.className = "habitat-map-select";
    scenarioSelect.setAttribute("aria-label", "Maillage regroupé comparé");
    Object.entries(scenarioDefinitions).forEach(([key, definition]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = definition.label;
      option.selected = key === activeScenario;
      scenarioSelect.appendChild(option);
    });
    scenarioSelect.addEventListener("change", () => {
      activeScenario = scenarioSelect.value;
      const url = new URL(window.location.href);
      url.searchParams.set("regroupement", activeScenario);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      update();
    });
    scenarioLabel.appendChild(scenarioSelect);
    controls.appendChild(scenarioLabel);
    const download = document.createElement("button");
    download.type = "button";
    download.className = "habitat-sketch-download";
    download.textContent = "PNG";
    download.setAttribute("aria-label", "Télécharger la comparaison en PNG");
    controls.appendChild(download);
    root.appendChild(controls);

    const width = 1180;
    const height = 760;
    const svg = d3.select(root).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Deux cartes comparant les temps de trajet vers les bureaux habituels et les lieux regroupés");
    const rc = rough.svg(svg.node());
    download.addEventListener("click", () => downloadPng(
      svg.node(), download,
      `noumea-accessibilite-${activeMode}-${activeDestinationMethod}-${activeScenario}-contours-nc.png`
    ));
    svg.append("defs");
    const title = label(svg, "Atteindre un lieu de vote : deux Nouméa côte à côte", 26, 34, {
      family: "Cabin Sketch, sans-serif", size: 28, weight: 700
    });
    const subtitle = label(svg, "", 26, 69, { size: 13, weight: 760, color: muted });
    const panelY = 102;
    const panelWidth = 548;
    const panelHeight = 558;
    const panelGap = 32;
    const panelX = [26, 26 + panelWidth + panelGap];
    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip access-compare-tooltip";
    tooltip.setAttribute("role", "status");
    root.appendChild(tooltip);

    const localProjection = d3.geoIdentity().reflectY(true)
      .fitExtent([[10, 62], [panelWidth - 10, panelHeight - 12]], boundary);
    const path = d3.geoPath(localProjection);
    const boundaryPath = path(boundary);
    const routePath = path(routes);
    cells.forEach((cell) => {
      cell.projected = localProjection([cell.longitude, cell.latitude]);
    });
    const delaunay = d3.Delaunay.from(cells, (d) => d.projected[0], (d) => d.projected[1]);
    const quadtree = d3.quadtree(cells, (d) => d.projected[0], (d) => d.projected[1]);
    const smoothingRadius = 31;
    const smoothingRadiusSquared = smoothingRadius * smoothingRadius;
    const sigmaSquared = Math.pow(smoothingRadius / 2.35, 2);
    const nx = 96;
    const cellSize = panelWidth / nx;
    const ny = Math.ceil(panelHeight / cellSize);
    const contourPath = d3.geoPath(d3.geoIdentity().scale(cellSize));
    const surfaceCache = new Map();

    function polygonContainsPoint(coordinates, point) {
      if (!coordinates?.length || !d3.polygonContains(coordinates[0], point)) return false;
      return !coordinates.slice(1).some((hole) => d3.polygonContains(hole, point));
    }

    function featureContainsPoint(feature, point) {
      const geometry = feature?.geometry;
      if (!geometry) return false;
      if (geometry.type === "Polygon") return polygonContainsPoint(geometry.coordinates, point);
      if (geometry.type === "MultiPolygon") {
        return geometry.coordinates.some((polygon) => polygonContainsPoint(polygon, point));
      }
      return false;
    }

    function irisForCell(datum) {
      if (Object.prototype.hasOwnProperty.call(datum, "irisFeature")) return datum.irisFeature;
      const point = [Number(datum.longitude), Number(datum.latitude)];
      datum.irisFeature = iris.features.find((feature) => featureContainsPoint(feature, point)) || null;
      return datum.irisFeature;
    }

    function localAverage(x, y, field) {
      let total = 0;
      let weights = 0;
      quadtree.visit((node, x0, y0, x1, y1) => {
        if (x0 > x + smoothingRadius || x1 < x - smoothingRadius ||
            y0 > y + smoothingRadius || y1 < y - smoothingRadius) return true;
        if (!node.length) {
          let leaf = node;
          do {
            const point = leaf.data;
            const value = point[field] == null ? NaN : Number(point[field]);
            const dx = point.projected[0] - x;
            const dy = point.projected[1] - y;
            const distanceSquared = dx * dx + dy * dy;
            if (Number.isFinite(value) && distanceSquared <= smoothingRadiusSquared) {
              const weight = Math.exp(-distanceSquared / (2 * sigmaSquared)) * Math.max(0.2, point.pop);
              total += value * weight;
              weights += weight;
            }
            leaf = leaf.next;
          } while (leaf);
        }
        return false;
      });
      return weights ? total / weights : -999;
    }

    function contoursFor(field, thresholds) {
      const cacheKey = `${field}|${thresholds.join("-")}`;
      if (surfaceCache.has(cacheKey)) return surfaceCache.get(cacheKey);
      const values = new Array(nx * ny);
      for (let gy = 0; gy < ny; gy += 1) {
        for (let gx = 0; gx < nx; gx += 1) {
          values[gx + gy * nx] = localAverage((gx + 0.5) * cellSize, (gy + 0.5) * cellSize, field);
        }
      }
      const contours = d3.contours()
        .size([nx, ny])
        .smooth(true)
        .thresholds([-998.5, ...thresholds])(values);
      surfaceCache.set(cacheKey, contours);
      return contours;
    }

    function createPanel(index) {
      const group = svg.append("g").attr("transform", `translate(${panelX[index]},${panelY})`);
      const clipId = `access-compare-clip-${index}`;
      svg.select("defs").append("clipPath").attr("id", clipId)
        .append("path").attr("d", boundaryPath);
      label(group, "", 4, 16, { size: 11, weight: 900, color: muted }).attr("class", "panel-kicker");
      label(group, "", 4, 39, {
        family: "Cabin Sketch, sans-serif", size: 19, weight: 700
      }).attr("class", "panel-stat");
      group.append("path").attr("d", boundaryPath).attr("fill", "#f2ecdf").attr("stroke", "none");
      const surface = group.append("g").attr("clip-path", `url(#${clipId})`);
      const linework = group.append("g").attr("clip-path", `url(#${clipId})`).attr("pointer-events", "none");
      const filters = pencilFilters(svg, `compare-routes-${index}`, 0.043, 1.45);
      pencilStroke(linework, routePath, filters, {
        stroke: "#514c46", strokeWidth: 0.3, opacity: 0.22, secondaryOpacity: 0.1
      });
      const busMarkers = group.append("g")
        .attr("clip-path", `url(#${clipId})`)
        .attr("pointer-events", "none");
      const sources = group.append("g").attr("pointer-events", "none");
      const hover = group.append("g").attr("pointer-events", "none").style("opacity", 0);
      hover.append("circle")
        .attr("r", 6.5).attr("fill", paper).attr("fill-opacity", 0.72)
        .attr("stroke", ink).attr("stroke-width", 1.5).attr("stroke-dasharray", "3 2");
      const coastFilters = pencilFilters(svg, `compare-coast-${index}`, 0.026, 3.8);
      const coast = group.append("g").attr("pointer-events", "none");
      pencilStroke(coast, boundaryPath, coastFilters, {
        stroke: "#302d29", strokeWidth: 0.78, opacity: 0.57, secondaryOpacity: 0.26
      });
      roughPath(coast, rc, boundaryPath, {
        fill: "none", stroke: "#2f2a26", strokeWidth: 1.2,
        roughness: 2.35, bowing: 1.75, opacity: 0.9, seed: `compare-coast-${index}`
      });
      const irisOutline = group.append("g")
        .attr("class", "access-compare-iris-outline")
        .attr("clip-path", `url(#${clipId})`)
        .attr("pointer-events", "none");
      const hit = group.append("path")
        .attr("d", boundaryPath).attr("fill", "transparent").style("cursor", "crosshair");
      const busStopHits = group.append("g")
        .attr("clip-path", `url(#${clipId})`);
      return { group, surface, busMarkers, sources, hover, irisOutline, hit, busStopHits };
    }

    const panels = [createPanel(0), createPanel(1)];

    function drawSurface(panel, field, definition, panelIndex) {
      panel.surface.selectAll("*").remove();
      svg.select("defs").selectAll(`[data-surface-mask="${panelIndex}"]`).remove();
      const contours = contoursFor(field, definition.thresholds);
      contours.forEach((contour, index) => {
        const color = palette[Math.min(index, palette.length - 1)];
        const pathData = contourPath(contour);
        const upperPathData = index < contours.length - 1
          ? contourPath(contours[index + 1])
          : null;
        const maskId = `access-band-${panelIndex}-${field}-${index}`
          .replace(/[^a-zA-Z0-9_-]/g, "-");
        const mask = svg.select("defs").append("mask")
          .attr("id", maskId)
          .attr("maskUnits", "userSpaceOnUse")
          .attr("maskContentUnits", "userSpaceOnUse")
          .attr("data-surface-mask", panelIndex);
        mask.append("rect")
          .attr("x", 0).attr("y", 0)
          .attr("width", panelWidth).attr("height", panelHeight)
          .attr("fill", "black");
        mask.append("path")
          .attr("d", pathData)
          .attr("fill", "white")
          .attr("fill-rule", "evenodd");
        if (upperPathData) {
          mask.append("path")
            .attr("d", upperPathData)
            .attr("fill", "black")
            .attr("fill-rule", "evenodd");
        }
        panel.surface.append("path")
          .attr("d", pathData)
          .attr("fill", color)
          .attr("fill-opacity", 0.34)
          .attr("fill-rule", "evenodd")
          .attr("stroke", "none")
          .attr("mask", `url(#${maskId})`);
        const texture = roughPath(panel.surface, rc, pathData, {
          fill: color, fillStyle: "hachure",
          hachureAngle: -43 + seed(`${field}-${index}`) % 11,
          hachureGap: 2.65, fillWeight: 0.7,
          stroke: color, strokeWidth: 0.16,
          roughness: 1.75, bowing: 1.25, opacity: 0.96,
          seed: `compare-surface-${panelIndex}-${field}-${index}`
        });
        if (texture) texture.attr("mask", `url(#${maskId})`);
      });
    }

    function drawSources(panel, sourceGroup, panelIndex) {
      panel.sources.selectAll("*").remove();
      const selected = points.features.filter((feature) => feature.properties.source_group === sourceGroup);
      selected.forEach((feature, index) => {
        const projected = localProjection(feature.geometry.coordinates);
        if (!projected) return;
        const grouped = sourceGroup !== "bureaux_complets";
        roughCircle(panel.sources, rc, projected[0], projected[1], grouped ? 10 : 4.8, {
          fill: grouped ? paper : red,
          fillStyle: grouped ? "solid" : "hachure",
          stroke: grouped ? ink : "#7b352d",
          strokeWidth: grouped ? 1.35 : 0.55,
          roughness: grouped ? 1.55 : 0.95,
          opacity: grouped ? 1 : 0.84,
          seed: `compare-source-${panelIndex}-${sourceGroup}-${index}`
        });
        if (grouped) {
          const sourceId = feature.properties.source_id;
          const sourceLabel = sourceLabels[sourceId] || feature.properties.source_nom;
          label(panel.sources, sourceLabel, projected[0] + 7, projected[1] - 8, {
            family: "Cabin Sketch, sans-serif", size: 7.6, weight: 700, color: ink
          }).attr("paint-order", "stroke").attr("stroke", paper).attr("stroke-width", 2.7);
        }
      });
    }

    function drawIrisOutline(panel, feature, panelIndex) {
      panel.irisOutline.selectAll("*").remove();
      if (!feature) return;
      const pathData = path(feature);
      panel.irisOutline.append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", paper)
        .attr("stroke-width", 5)
        .attr("stroke-opacity", 0.92)
        .attr("stroke-linejoin", "round")
        .attr("vector-effect", "non-scaling-stroke");
      roughPath(panel.irisOutline, rc, pathData, {
        fill: "none", stroke: blue, strokeWidth: 2.2,
        roughness: 1.65, bowing: 1.3, opacity: 1,
        seed: `compare-iris-${panelIndex}-${feature.properties.codgeo}`
      });
    }

    function drawBusStops(panel, panelIndex) {
      panel.busMarkers.selectAll("*").remove();
      panel.busStopHits.selectAll("*").remove();
      if (activeMode !== "bus") return;
      const visibleStops = busStops.features
        .map((feature) => ({ feature, point: localProjection(feature.geometry.coordinates) }))
        .filter((item) => item.point);
      panel.busMarkers.selectAll("circle")
        .data(visibleStops)
        .join("circle")
        .attr("cx", (d) => d.point[0])
        .attr("cy", (d) => d.point[1])
        .attr("r", 2.15)
        .attr("fill", blue)
        .attr("fill-opacity", 0.88)
        .attr("stroke", paper)
        .attr("stroke-width", 0.72)
        .attr("vector-effect", "non-scaling-stroke");
      panel.busStopHits.selectAll("circle")
        .data(visibleStops)
        .join("circle")
        .attr("cx", (d) => d.point[0])
        .attr("cy", (d) => d.point[1])
        .attr("r", 5)
        .attr("fill", "transparent")
        .style("cursor", "help")
        .on("pointerenter pointermove", (event, d) => {
          event.stopPropagation();
          panels.forEach((item, index) => {
            item.hover.style("opacity", 0);
            drawIrisOutline(item, null, index);
          });
          const lines = d.feature.properties.lignes
            ? `<br><span>Lignes actives : ${d.feature.properties.lignes}</span>`
            : "";
          tooltip.innerHTML = `<div class="access-tip-kicker">Arrêt Tanéo actif</div>` +
            `<strong>${d.feature.properties.stop_name}</strong>${lines}` +
            `<div class="habitat-tooltip-note">Offre du samedi utilisée pour la reconstitution</div>`;
          positionTooltip(tooltip, event);
        })
        .on("pointerleave", () => { tooltip.style.opacity = 0; });
    }

    function statFor(mode, scenario) {
      if (mode === "walk") {
        return methodStats.find((row) => (
          row.method === activeDestinationMethod && row.scenario === scenario
        ));
      }
      return stats.find((row) => row.mode === mode && row.scenario === scenario);
    }

    function showTooltip(event, datum) {
      const leftField = fieldFor(activeMode, "bureaux_complets", activeDestinationMethod);
      const rightField = fieldFor(activeMode, activeScenario, activeDestinationMethod);
      const leftValue = datum[leftField] == null ? NaN : Number(datum[leftField]);
      const rightValue = datum[rightField] == null ? NaN : Number(datum[rightField]);
      const difference = rightValue - leftValue;
      const scenario = scenarioDefinitions[activeScenario];
      const irisFeature = irisForCell(datum);
      const irisName = irisFeature?.properties?.libgeo
        ? `<div class="access-tip-location">IRIS · <b>${irisFeature.properties.libgeo}</b></div>`
        : "";
      const busStop = activeMode === "bus" && datum.bus_arret_proche
        ? `<div class="access-tip-stop"><span>Arrêt actif le plus proche</span><b>${datum.bus_arret_proche}</b> · ${format1.format(datum.bus_marche_arret_min)} min à pied</div>`
        : "";
      const assignedGroupedId = datum[`assigned_${activeScenario}_id`];
      const assignedDetails = activeMode === "walk" && activeDestinationMethod === "assigned"
        ? `<div class="access-tip-stop"><span>Secteur attribué</span><b>${String(datum.code_bv_affectation).padStart(4, "0")} · ${datum.secteur_affectation}</b><br><span>Lieu regroupé</span><b>${sourceLabels[assignedGroupedId] || assignedGroupedId}</b></div>`
        : "";
      const fastestMode = (scenarioKey) => {
        if (activeMode === "walk") return "";
        const walkingValue = datum[scenarioKey];
        const walking = walkingValue == null ? NaN : Number(walkingValue);
        const alternativeField = activeMode === "car"
          ? `car_motorized_${scenarioKey}`
          : `bus_transit_${scenarioKey}`;
        const alternativeValue = datum[alternativeField];
        const alternative = alternativeValue == null ? NaN : Number(alternativeValue);
        if (!Number.isFinite(alternative) || walking <= alternative) return " · marche directe";
        return activeMode === "car" ? " · voiture" : " · Tanéo";
      };
      tooltip.innerHTML = [
        `<div class="access-tip-kicker">Cellule habitée de 100 m · avant lissage</div>`,
        irisName,
        `<strong>${format0.format(datum.pop)} habitants estimés</strong>`,
        `<div class="access-tip-comparison">`,
        `<span><i class="access-tip-dot access-tip-dot--reference"></i>57 bureaux <b>${Number.isFinite(leftValue) ? `${format1.format(leftValue)} min${fastestMode("bureaux_complets")}` : "non calculé"}</b></span>`,
        `<span><i class="access-tip-dot access-tip-dot--grouped"></i>${scenario.short.toLowerCase()} <b>${Number.isFinite(rightValue) ? `${format1.format(rightValue)} min${fastestMode(activeScenario)}` : "non calculé"}</b></span>`,
        `</div>`,
        Number.isFinite(difference)
          ? `<div class="access-tip-delta ${difference > 0 ? "is-longer" : "is-shorter"}">${difference > 0 ? "+" : ""}${format1.format(difference)} min avec le regroupement</div>`
          : "",
        assignedDetails,
        busStop,
        `<div class="habitat-tooltip-note">${modeDefinitions[activeMode].label} · ${activeMode === "walk" && activeDestinationMethod === "assigned" ? "bureau attribué" : "lieu le plus proche"} · valeur modélisée</div>`
      ].join("");
      positionTooltip(tooltip, event);
    }

    panels.forEach((panel) => {
      panel.hit.on("pointerenter pointermove", (event) => {
        const [x, y] = d3.pointer(event, panel.group.node());
        const index = delaunay.find(x, y);
        const datum = cells[index];
        const dx = datum.projected[0] - x;
        const dy = datum.projected[1] - y;
        if (dx * dx + dy * dy > smoothingRadiusSquared * 1.8) {
          tooltip.style.opacity = 0;
          panels.forEach((item, itemIndex) => {
            item.hover.style("opacity", 0);
            drawIrisOutline(item, null, itemIndex);
          });
          return;
        }
        panels.forEach((item) => item.hover
          .attr("transform", `translate(${datum.projected[0]},${datum.projected[1]})`)
          .style("opacity", 0.95));
        const irisFeature = irisForCell(datum);
        panels.forEach((item, index) => drawIrisOutline(item, irisFeature, index));
        showTooltip(event, datum);
      }).on("pointerleave", () => {
        tooltip.style.opacity = 0;
        panels.forEach((item, index) => {
          item.hover.style("opacity", 0);
          drawIrisOutline(item, null, index);
        });
      });
    });

    const legend = svg.append("g").attr("transform", "translate(28,704)");
    const sourceKey = svg.append("g").attr("transform", `translate(${width - 430},66)`);
    sourceKey.append("circle")
      .attr("r", 2.4).attr("fill", red).attr("stroke", "#7b352d").attr("stroke-width", 0.6);
    label(sourceKey, "bureau habituel", 8, 0, { size: 10.3, weight: 780, color: muted });
    sourceKey.append("circle")
      .attr("cx", 122).attr("r", 4.5).attr("fill", paper).attr("stroke", ink).attr("stroke-width", 1.15);
    label(sourceKey, "lieu regroupé", 131, 0, { size: 10.3, weight: 780, color: muted });
    const busKey = svg.append("g").attr("transform", `translate(${width - 178},66)`);
    busKey.append("circle")
      .attr("r", 3.2).attr("fill", blue).attr("stroke", paper).attr("stroke-width", 0.8);
    label(busKey, "arrêts Tanéo actifs", 9, 0, { size: 10.5, weight: 800, color: blue });
    function drawLegend(definition) {
      legend.selectAll("*").remove();
      label(legend, definition.legendTitle, 0, -18, { size: 10.5, weight: 900, color: ink });
      const itemWidth = 1110 / palette.length;
      const legendField = fieldFor(activeMode, activeScenario, activeDestinationMethod);
      palette.forEach((color, index) => {
        const x = index * itemWidth;
        legend.append("rect")
          .attr("x", x).attr("y", 0).attr("width", 28).attr("height", 16)
          .attr("fill", color).attr("fill-opacity", 0.34);
        roughPath(legend, rc, `M${x},0H${x + 28}V16H${x}Z`, {
          fill: color, fillStyle: "hachure",
          hachureAngle: -43 + seed(`${legendField}-${index}`) % 11,
          hachureGap: 2.65, fillWeight: 0.7, stroke: color,
          strokeWidth: 0.16, roughness: 1.75, bowing: 1.25, opacity: 0.96,
          seed: `compare-legend-${activeMode}-${index}`
        });
        label(legend, definition.legend[index], x + 37, 8, { size: 10.5, weight: 750, color: muted });
      });
    }

    function update() {
      const definition = modeDefinitions[activeMode];
      const scenario = scenarioDefinitions[activeScenario];
      const leftField = fieldFor(activeMode, "bureaux_complets", activeDestinationMethod);
      const rightField = fieldFor(activeMode, activeScenario, activeDestinationMethod);
      title.text(`Atteindre un lieu de vote ${definition.label.toLowerCase()} : deux Nouméa côte à côte`);
      subtitle.text(
        activeMode === "walk" && activeDestinationMethod === "assigned"
          ? "Destination imposée par le secteur électoral · marche à 5 km/h · 20 min = 40 min aller-retour"
          : definition.note
      );
      assignmentLabel.hidden = activeMode !== "walk";
      const panelSettings = [
        { field: leftField, scenario: "bureaux_complets", kicker: "MAILLAGE HABITUEL · 57 BUREAUX", source: "bureaux_complets" },
        { field: rightField, scenario: activeScenario, kicker: `REGROUPEMENT · ${scenario.short}`, source: scenario.sourceGroup }
      ];
      panelSettings.forEach((settings, index) => {
        const stat = statFor(activeMode, settings.scenario);
        panels[index].group.select(".panel-kicker").text(settings.kicker);
        panels[index].group.select(".panel-stat").text(
          stat ? `${format1.format(stat.moyenne)} min en moyenne` : "Temps moyen non disponible"
        );
        drawSurface(panels[index], settings.field, definition, index);
        drawSources(panels[index], settings.source, index);
        drawBusStops(panels[index], index);
      });
      busKey.style("display", activeMode === "bus" ? null : "none");
      drawLegend(definition);
      tooltip.style.opacity = 0;
      panels.forEach((item, index) => {
        item.hover.style("opacity", 0);
        drawIrisOutline(item, null, index);
      });
    }

    label(svg, `contours.nc · grille SPC 2020 · BDROUTE ${metadata.routes.data_version}`, width - 25, height - 17, {
      anchor: "end", size: 10.5, weight: 800, color: "#8a8277"
    }).attr("class", "contours-chart-signature");
    update();
  }
})();
