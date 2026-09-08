(() => {
  "use strict";

  const root = document.querySelector("[data-access-map-v2]");
  if (!root || !window.d3 || !window.rough) return;

  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const grid = "#ded8cf";
  const red = "#c54832";
  const format1 = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  const modes = {
    centres_9: {
      label: "9 centres regroupés",
      title: "Temps de marche vers l’un des 9 centres",
      field: "centres_9",
      sourceGroup: "centres_9",
      type: "time"
    },
    bureaux_complets: {
      label: "Bureaux habituels",
      title: "Temps de marche vers le bureau habituel le plus proche",
      field: "bureaux_complets",
      sourceGroup: "bureaux_complets",
      type: "time"
    },
    centres_8: {
      label: "8 centres regroupés",
      title: "Temps de marche vers l’un des 8 centres",
      field: "centres_8",
      sourceGroup: "centres_8",
      type: "time"
    },
    delta_9_vs_full: {
      label: "Écart : 9 centres – bureaux habituels",
      title: "Allongement par rapport aux bureaux habituels",
      field: "delta_9_vs_full",
      sourceGroup: "centres_9",
      type: "delta"
    }
  };

  const sourceLabels = {
    R01: { text: "Hôtel de ville", dx: 10, dy: -10, anchor: "start" },
    R02: { text: "Wawanabu", dx: -10, dy: -10, anchor: "end" },
    R03: { text: "Salle Jean-Noyant", dx: 10, dy: 13, anchor: "start" },
    R04: { text: "Collège Jean-Lèques", dx: 10, dy: 14, anchor: "start" },
    R05: { text: "École Laubarède", dx: 10, dy: 13, anchor: "start" },
    R06: { text: "Collège Ollivaud", dx: 10, dy: -10, anchor: "start" },
    R07: { text: "Marie-Courtot / Gervolino", dx: -10, dy: -10, anchor: "end" },
    R09: { text: "Collège de Kaméré", dx: 10, dy: -10, anchor: "start" },
    R10: { text: "Vincent-Kafoa", dx: 10, dy: -10, anchor: "start" }
  };

  const urls = {
    cells: root.dataset.cells,
    boundary: root.dataset.boundary,
    routes: root.dataset.routes,
    points: root.dataset.points,
    stats: root.dataset.stats,
    metadata: root.dataset.metadata
  };

  Promise.all([
    d3.csv(urls.cells, d3.autoType),
    d3.json(urls.boundary),
    d3.json(urls.routes),
    d3.json(urls.points),
    d3.csv(urls.stats, d3.autoType),
    d3.json(urls.metadata)
  ]).then((payload) => draw(...payload)).catch((error) => {
    root.innerHTML = `<p class="access-map-error">La carte interactive n’a pas pu être chargée (${error.message}).</p>`;
  });

  function roughSeed(value) {
    let hash = 2166136261;
    for (const char of String(value || "contours")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 2147483646) + 1;
  }

  function label(g, text, x, y, options = {}) {
    return g.append("text")
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

  function wrap(selection, width) {
    selection.each(function() {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      const x = text.attr("x");
      const y = text.attr("y");
      let line = [];
      let lineNumber = 0;
      let word;
      text.text(null);
      let tspan = text.append("tspan").attr("x", x).attr("y", y);
      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width && line.length > 1) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", `${++lineNumber * 1.05}em`)
            .text(word);
        }
      }
    });
  }

  function roughRect(g, rc, x, y, width, height, color, options = {}) {
    const node = rc.rectangle(x, y, width, height, {
      fill: options.fill == null ? color : options.fill,
      fillStyle: options.fillStyle || "solid",
      hachureGap: options.hachureGap,
      hachureAngle: options.hachureAngle,
      fillWeight: options.fillWeight,
      roughness: options.roughness == null ? 0.8 : options.roughness,
      bowing: options.bowing == null ? 0.5 : options.bowing,
      stroke: options.stroke == null ? color : options.stroke,
      strokeWidth: options.strokeWidth == null ? 1.1 : options.strokeWidth,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: roughSeed(options.seed || `${x}-${y}-${width}-${height}-${color}`)
    });
    g.node().appendChild(node);
    const selection = d3.select(node);
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughCircle(g, rc, cx, cy, diameter, color, options = {}) {
    const node = rc.circle(cx, cy, diameter, {
      fill: options.fill == null ? color : options.fill,
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 2.8 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -38 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.72 : options.fillWeight,
      roughness: options.roughness == null ? 1.55 : options.roughness,
      bowing: options.bowing == null ? 1.05 : options.bowing,
      stroke: options.stroke == null ? color : options.stroke,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: roughSeed(options.seed || `${cx}-${cy}-${diameter}-${color}`)
    });
    g.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughPath(g, rc, pathData, options = {}) {
    if (!pathData) return null;
    const node = rc.path(pathData, {
      fill: options.fill || "none",
      fillStyle: options.fillStyle || "solid",
      hachureGap: options.hachureGap,
      hachureAngle: options.hachureAngle,
      fillWeight: options.fillWeight,
      roughness: options.roughness == null ? 0.7 : options.roughness,
      bowing: options.bowing == null ? 0.45 : options.bowing,
      stroke: options.stroke || paper,
      strokeWidth: options.strokeWidth == null ? 1.05 : options.strokeWidth,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: roughSeed(options.seed || pathData.slice(0, 80))
    });
    g.node().appendChild(node);
    const selection = d3.select(node);
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function pencilFilters(svg, key, options = {}) {
    let defs = svg.select("defs");
    if (defs.empty()) defs = svg.insert("defs", ":first-child");
    const slug = String(key).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    const frequency = options.baseFrequency || 0.035;
    const displacement = options.displacement || 2;
    const seed = roughSeed(key) % 997;

    function make(id, baseFrequency, scale, filterSeed) {
      const filter = defs.append("filter")
        .attr("id", id)
        .attr("x", "-12%")
        .attr("y", "-12%")
        .attr("width", "124%")
        .attr("height", "124%");
      filter.append("feTurbulence")
        .attr("type", "turbulence")
        .attr("baseFrequency", baseFrequency)
        .attr("numOctaves", 1)
        .attr("seed", filterSeed)
        .attr("result", "pencilNoise");
      filter.append("feDisplacementMap")
        .attr("in", "SourceGraphic")
        .attr("in2", "pencilNoise")
        .attr("scale", scale)
        .attr("xChannelSelector", "R")
        .attr("yChannelSelector", "G");
      return `url(#${id})`;
    }

    return {
      primary: make(`pencil-a-${slug}`, frequency, displacement, seed),
      secondary: make(`pencil-b-${slug}`, frequency * 2, displacement + 1.6, seed + 17)
    };
  }

  function pencilStroke(g, pathData, filters, options = {}) {
    if (!pathData) return;
    const color = options.stroke || ink;
    const width = options.strokeWidth == null ? 0.7 : options.strokeWidth;
    const common = (selection) => selection
      .attr("d", pathData)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("vector-effect", "non-scaling-stroke");
    common(g.append("path"))
      .attr("stroke-width", width)
      .attr("stroke-opacity", options.opacity == null ? 0.55 : options.opacity)
      .attr("filter", filters.primary);
    common(g.append("path"))
      .attr("stroke-width", width * 0.52)
      .attr("stroke-opacity", options.secondaryOpacity == null ? 0.28 : options.secondaryOpacity)
      .attr("filter", filters.secondary);
  }

  function signed(value) {
    return `${value > 0 ? "+" : ""}${format1.format(value)} min`;
  }

  function weightedShare(rows, field, threshold) {
    const total = d3.sum(rows, (d) => d.pop);
    return 100 * d3.sum(rows.filter((d) => d[field] > threshold), (d) => d.pop) / total;
  }

  function positionTooltip(rootNode, tooltip, event) {
    const bounds = rootNode.getBoundingClientRect();
    const gap = 14;
    const margin = 8;
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    tooltip.style.transform = "none";
    tooltip.style.opacity = 0;
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;
    let x = pointerX + gap;
    let y = pointerY + gap;
    if (x + tipWidth > bounds.width - margin) x = pointerX - tipWidth - gap;
    if (y + tipHeight > bounds.height - margin) y = pointerY - tipHeight - gap;
    tooltip.style.left = `${Math.max(margin, x)}px`;
    tooltip.style.top = `${Math.max(margin, y)}px`;
    tooltip.style.opacity = 1;
  }

  function draw(cells, boundary, routes, points, stats, metadata) {
    let activeMode = "centres_9";
    let smoothView = true;
    root.innerHTML = "";
    root.tabIndex = 0;

    const tools = document.createElement("div");
    tools.className = "habitat-sketch-tools";
    const scenarioLabel = document.createElement("label");
    scenarioLabel.className = "habitat-map-control-label";
    scenarioLabel.appendChild(document.createTextNode("Scénario"));
    const scenarioSelect = document.createElement("select");
    scenarioSelect.className = "habitat-map-select";
    scenarioSelect.setAttribute("aria-label", "Scénario cartographié");
    Object.entries(modes).forEach(([key, mode]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = mode.label;
      option.selected = key === activeMode;
      scenarioSelect.appendChild(option);
    });
    scenarioLabel.appendChild(scenarioSelect);
    tools.appendChild(scenarioLabel);

    const smoothingButton = document.createElement("button");
    smoothingButton.type = "button";
    smoothingButton.className = "habitat-sketch-download access-smoothing-toggle";
    smoothingButton.setAttribute("aria-pressed", "true");
    smoothingButton.textContent = "Vue lissée · 500 m";
    tools.appendChild(smoothingButton);

    const download = document.createElement("button");
    download.type = "button";
    download.className = "habitat-sketch-download";
    download.textContent = "PNG";
    download.setAttribute("aria-label", "Télécharger la figure en PNG");
    tools.appendChild(download);
    root.appendChild(tools);

    const width = Math.max(760, Math.round(root.clientWidth || 760));
    const height = 720;
    const svg = d3.select(root)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-labelledby", "access-map-v2-title access-map-v2-desc")
      .style("background", paper);
    const rc = rough.svg(svg.node());

    svg.append("title")
      .attr("id", "access-map-v2-title")
      .text("Accessibilité piétonne des lieux de vote à Nouméa");
    svg.append("desc")
      .attr("id", "access-map-v2-desc")
      .text("Carte interactive comparant les bureaux habituels, huit centres, neuf centres et l’écart entre les configurations.");
    const defs = svg.append("defs");

    const title = label(svg, modes[activeMode].title, 20, 30, {
      family: "Cabin Sketch, sans-serif",
      size: 24,
      weight: 700
    }).call(wrap, width - 45);
    const subtitle = label(svg, "Surface lissée à 500 m · valeurs exactes au survol", 20, 66, {
      size: 12.5,
      weight: 750,
      color: muted
    });

    const sideWidth = 224;
    const mapExtent = [[28, 98], [width - sideWidth - 22, height - 43]];
    const projection = d3.geoIdentity().reflectY(true).fitExtent(mapExtent, boundary);
    const path = d3.geoPath(projection);
    const boundaryPath = path(boundary);
    const routePath = path(routes);

    defs.append("clipPath")
      .attr("id", "access-map-v2-clip")
      .append("path")
      .attr("d", boundaryPath);

    const timeScale = d3.scaleThreshold()
      .domain([10, 15, 20, 30, 45, 60])
      .range(["#9fcfa6", "#55ae83", "#ead34b", "#ee9838", "#d95735", "#ae3436", "#61232e"]);
    const deltaScale = d3.scaleThreshold()
      .domain([-10, -5, 0, 5, 10, 20, 30])
      .range(["#125b88", "#3f91ae", "#8fc5c0", "#eee2c8", "#eac741", "#e27f31", "#bf3b31", "#64242d"]);
    const palettes = Array.from(new Set([...timeScale.range(), ...deltaScale.range()]));
    const patternId = new Map();
    palettes.forEach((color, index) => {
      const id = `access-hachure-${index}`;
      patternId.set(color, id);
      const pattern = defs.append("pattern")
        .attr("id", id)
        .attr("width", 10)
        .attr("height", 10)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", `rotate(${-43 + index % 9})`);
      pattern.append("rect")
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", color)
        .attr("fill-opacity", 0.92);
      pattern.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", 10)
        .attr("stroke", "#332f2a")
        .attr("stroke-width", 0.65)
        .attr("stroke-opacity", 0.1);
    });
    const surfacePattern = defs.append("pattern")
      .attr("id", "access-surface-pencil")
      .attr("width", 14)
      .attr("height", 14)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(-41)");
    surfacePattern.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 14)
      .attr("stroke", "#2f2b27")
      .attr("stroke-width", 0.65)
      .attr("stroke-opacity", 0.09);

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip access-map-tooltip";
    root.appendChild(tooltip);

    const mapG = svg.append("g");
    mapG.append("path")
      .attr("d", boundaryPath)
      .attr("fill", "#f5efe4")
      .attr("stroke", "none");

    const routeG = mapG.append("g")
      .attr("clip-path", "url(#access-map-v2-clip)")
      .attr("pointer-events", "none");
    const routeFilters = pencilFilters(svg, "access-routes", {
      baseFrequency: 0.045,
      displacement: 1.4
    });
    pencilStroke(routeG, routePath, routeFilters, {
      stroke: "#554f47",
      strokeWidth: 0.42,
      opacity: 0.28,
      secondaryOpacity: 0.14
    });

    const lonStep = 0.000974;
    const latStep = 0.0009;
    const sample = cells[Math.floor(cells.length / 2)];
    const samplePoint = projection([sample.longitude, sample.latitude]);
    const cellWidth = Math.max(1.5, Math.abs(projection([sample.longitude + lonStep, sample.latitude])[0] - samplePoint[0]) * 1.03);
    const cellHeight = Math.max(1.5, Math.abs(projection([sample.longitude, sample.latitude + latStep])[1] - samplePoint[1]) * 1.03);
    cells.forEach((d) => {
      d.projected = projection([d.longitude, d.latitude]);
    });

    const smoothingRadiusPx = Math.max(12, ((cellWidth + cellHeight) / 2) * 5);
    const smoothingRadiusSq = smoothingRadiusPx * smoothingRadiusPx;
    const smoothingSigmaSq = Math.pow(smoothingRadiusPx / 2.35, 2);
    const quadtree = d3.quadtree(cells, (d) => d.projected[0], (d) => d.projected[1]);
    const delaunay = d3.Delaunay.from(cells, (d) => d.projected[0], (d) => d.projected[1]);
    const surfaceCache = new Map();

    function localAverage(x, y, field) {
      let weighted = 0;
      let weights = 0;
      quadtree.visit((node, x0, y0, x1, y1) => {
        if (x0 > x + smoothingRadiusPx || x1 < x - smoothingRadiusPx ||
            y0 > y + smoothingRadiusPx || y1 < y - smoothingRadiusPx) return true;
        if (!node.length) {
          let leaf = node;
          do {
            const point = leaf.data;
            const dx = point.projected[0] - x;
            const dy = point.projected[1] - y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq <= smoothingRadiusSq) {
              const weight = Math.exp(-distanceSq / (2 * smoothingSigmaSq));
              weighted += point[field] * weight;
              weights += weight;
            }
            leaf = leaf.next;
          } while (leaf);
        }
        return false;
      });
      return weights ? weighted / weights : null;
    }

    function smoothedSurface(mode) {
      if (surfaceCache.has(mode.field)) return surfaceCache.get(mode.field);
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width);
      canvas.height = height;
      const context = canvas.getContext("2d");
      const scale = mode.type === "delta" ? deltaScale : timeScale;
      const step = 4;
      context.globalAlpha = 0.97;
      for (let y = mapExtent[0][1]; y <= mapExtent[1][1]; y += step) {
        for (let x = mapExtent[0][0]; x <= mapExtent[1][0]; x += step) {
          const value = localAverage(x, y, mode.field);
          if (value == null) continue;
          context.fillStyle = scale(value);
          context.fillRect(x - 1, y - 1, step + 2, step + 2);
        }
      }
      const url = canvas.toDataURL("image/png");
      surfaceCache.set(mode.field, url);
      return url;
    }

    const surfaceG = mapG.append("g")
      .attr("clip-path", "url(#access-map-v2-clip)")
      .attr("pointer-events", "none");
    const surfaceImage = surfaceG.append("image")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("preserveAspectRatio", "none");
    surfaceG.append("rect")
      .attr("x", mapExtent[0][0])
      .attr("y", mapExtent[0][1])
      .attr("width", mapExtent[1][0] - mapExtent[0][0])
      .attr("height", mapExtent[1][1] - mapExtent[0][1])
      .attr("fill", "url(#access-surface-pencil)");

    const cellG = mapG.append("g")
      .attr("clip-path", "url(#access-map-v2-clip)")
      .attr("pointer-events", "none");
    const cellRects = cellG.selectAll("rect.access-cell")
      .data(cells)
      .join("rect")
      .attr("class", "access-cell")
      .attr("x", (d) => d.projected[0] - cellWidth / 2)
      .attr("y", (d) => d.projected[1] - cellHeight / 2)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("stroke", "none");

    const hoverMarker = mapG.append("rect")
      .attr("width", Math.max(7, cellWidth + 3))
      .attr("height", Math.max(7, cellHeight + 3))
      .attr("rx", 2)
      .attr("fill", "none")
      .attr("stroke", ink)
      .attr("stroke-width", 1.25)
      .attr("stroke-dasharray", "3 2")
      .attr("pointer-events", "none")
      .style("opacity", 0);
    mapG.append("path")
      .attr("d", boundaryPath)
      .attr("class", "access-map-hit-area")
      .attr("fill", "transparent")
      .on("pointerenter pointermove", (event) => {
        const [x, y] = d3.pointer(event, svg.node());
        const index = delaunay.find(x, y);
        const datum = cells[index];
        const dx = datum.projected[0] - x;
        const dy = datum.projected[1] - y;
        if (dx * dx + dy * dy > smoothingRadiusSq) {
          tooltip.style.opacity = 0;
          hoverMarker.style("opacity", 0);
          return;
        }
        hoverMarker
          .attr("x", datum.projected[0] - Math.max(7, cellWidth + 3) / 2)
          .attr("y", datum.projected[1] - Math.max(7, cellHeight + 3) / 2)
          .style("opacity", 0.82);
        showCellTooltip(event, datum);
      })
      .on("pointerleave", () => {
        tooltip.style.opacity = 0;
        hoverMarker.style("opacity", 0);
      });
    routeG.raise();

    const boundaryG = mapG.append("g").attr("pointer-events", "none");
    const coastFilters = pencilFilters(svg, "access-coast", {
      baseFrequency: 0.026,
      displacement: 4.1
    });
    pencilStroke(boundaryG, boundaryPath, coastFilters, {
      stroke: "#302d29",
      strokeWidth: 0.82,
      opacity: 0.58,
      secondaryOpacity: 0.27
    });
    roughPath(boundaryG, rc, boundaryPath, {
      fill: "none",
      stroke: "#2f2a26",
      strokeWidth: 1.2,
      roughness: 2.35,
      bowing: 1.75,
      opacity: 0.9,
      seed: "access-map-coast"
    });

    const pointsG = mapG.append("g");
    const labelsG = mapG.append("g").attr("pointer-events", "none");
    const sideX = width - sideWidth + 4;
    const legendG = svg.append("g").attr("transform", `translate(${sideX},112)`);
    const metricsG = svg.append("g").attr("transform", `translate(${sideX},430)`);
    roughRect(svg, rc, sideX - 13, 93, sideWidth - 4, 558, "none", {
      fill: "none",
      stroke: grid,
      strokeWidth: 0.58,
      roughness: 1.7,
      bowing: 1.35,
      opacity: 0.72,
      seed: "access-map-side-panel"
    });

    function showCellTooltip(event, d) {
      const mode = modes[activeMode];
      const value = d[mode.field];
      tooltip.innerHTML = [
        `<strong>${mode.type === "delta" ? signed(value) : `${format1.format(value)} min`}</strong>`,
        `<span>Population estimée : ${format1.format(d.pop)}</span><br>`,
        `<span>Bureaux habituels : ${format1.format(d.bureaux_complets)} min</span><br>`,
        `<span>9 centres : ${format1.format(d.centres_9)} min</span><br>`,
        `<span>Écart : ${signed(d.delta_9_vs_full)}</span>`
      ].join("");
      positionTooltip(root, tooltip, event);
    }

    function drawLegend(mode) {
      legendG.selectAll("*").remove();
      const isDelta = mode.type === "delta";
      const colors = isDelta ? deltaScale.range() : timeScale.range();
      const labels = isDelta
        ? ["< −10", "−10 à −5", "−5 à 0", "0 à +5", "+5 à +10", "+10 à +20", "+20 à +30", "≥ +30"]
        : ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "≥ 60"];
      label(legendG, isDelta ? "ÉCART EN MINUTES" : "TEMPS EN MINUTES", 0, 0, {
        size: 10.5,
        weight: 900,
        color: ink
      });
      labels.forEach((text, index) => {
        const y = 19 + index * 35;
        legendG.append("rect")
          .attr("x", 0)
          .attr("y", y - 8)
          .attr("width", 22)
          .attr("height", 16)
          .attr("fill", colors[index])
          .attr("fill-opacity", 0.9);
        roughRect(legendG, rc, 0, y - 8, 22, 16, colors[index], {
          fill: colors[index],
          fillStyle: "hachure",
          hachureAngle: -38,
          hachureGap: 4.5,
          fillWeight: 0.52,
          stroke: colors[index],
          strokeWidth: 0.42,
          roughness: 1.75,
          bowing: 1.2,
          opacity: 0.96,
          seed: `access-legend-${mode.field}-${index}`
        });
        label(legendG, text, 31, y, { size: 10.5, weight: 750, color: muted });
      });
    }

    function drawMetrics(modeKey) {
      metricsG.selectAll("*").remove();
      const statKey = modeKey === "delta_9_vs_full" ? "centres_9" : modeKey;
      const stat = stats.find((d) => d.variable === statKey);
      const reference = stats.find((d) => d.variable === "bureaux_complets");
      if (!stat) return;
      const rows = modeKey === "delta_9_vs_full"
        ? [
          ["HAUSSE MOYENNE", signed(stat.moyenne - reference.moyenne)],
          ["POP. > +10 MIN", `${format1.format(weightedShare(cells, "delta_9_vs_full", 10))} %`]
        ]
        : [
          ["TEMPS MOYEN", `${format1.format(stat.moyenne)} min`],
          ["POP. > 30 MIN", `${format1.format(stat.part_pop_plus_30)} %`]
        ];
      rows.forEach((row, index) => {
        const y = index * 75;
        label(metricsG, row[0], 0, y, { size: 10, weight: 900, color: muted });
        label(metricsG, row[1], 0, y + 29, {
          family: "Cabin Sketch, sans-serif",
          size: 27,
          weight: 700,
          color: index === 0 ? red : ink
        });
      });
    }

    function drawSources(mode) {
      pointsG.interrupt().style("opacity", 0);
      labelsG.interrupt().style("opacity", 0);
      pointsG.selectAll("*").remove();
      labelsG.selectAll("*").remove();
      const selected = points.features.filter((feature) => feature.properties.source_group === mode.sourceGroup);
      selected.forEach((feature, index) => {
        const projected = projection(feature.geometry.coordinates);
        if (!projected) return;
        const grouped = mode.sourceGroup !== "bureaux_complets";
        roughCircle(pointsG, rc, projected[0], projected[1], grouped ? 12 : 6.5, grouped ? ink : red, {
          fill: grouped ? paper : red,
          fillStyle: grouped ? "solid" : "hachure",
          hachureGap: 2,
          stroke: grouped ? ink : "#7f3f2f",
          strokeWidth: grouped ? 1.8 : 0.9,
          roughness: grouped ? 1.7 : 1.15,
          opacity: grouped ? 1 : 0.82,
          seed: `access-source-${mode.sourceGroup}-${index}`
        });
        if (grouped) {
          const sourceLabel = sourceLabels[feature.properties.source_id] || {
            text: feature.properties.source_nom,
            dx: 9,
            dy: -8,
            anchor: "start"
          };
          label(
            labelsG,
            sourceLabel.text,
            projected[0] + sourceLabel.dx,
            projected[1] + sourceLabel.dy,
            {
              anchor: sourceLabel.anchor,
              family: "Cabin Sketch, sans-serif",
              size: 9.2,
              weight: 700,
              color: ink
            }
          )
            .attr("paint-order", "stroke")
            .attr("stroke", paper)
            .attr("stroke-width", 3.2)
            .attr("stroke-linejoin", "round");
        }
      });
      pointsG.transition().duration(220).style("opacity", 1);
      labelsG.transition().duration(220).style("opacity", 1);
    }

    function updateView(mode, animate = true) {
      const duration = animate ? 260 : 0;
      const scale = mode.type === "delta" ? deltaScale : timeScale;
      cellRects
        .interrupt()
        .transition()
        .duration(duration)
        .attr("fill", (d) => `url(#${patternId.get(scale(d[mode.field]))})`)
        .attr("stroke", (d) => scale(d[mode.field]))
        .attr("stroke-opacity", 0.16)
        .attr("stroke-width", 0.2);
      if (smoothView) surfaceImage.attr("href", smoothedSurface(mode));
      surfaceG.interrupt().transition().duration(duration).style("opacity", smoothView ? 1 : 0);
      cellG.interrupt().transition().duration(duration).style("opacity", smoothView ? 0 : 1);
      smoothingButton.setAttribute("aria-pressed", String(smoothView));
      smoothingButton.textContent = smoothView ? "Vue lissée · 500 m" : "Voir le lissage · 500 m";
      subtitle.text(smoothView
        ? "Surface lissée à 500 m · valeurs exactes au survol"
        : "Cellules habitées de 100 m · valeurs exactes au survol");
    }

    function update(modeKey) {
      activeMode = modeKey;
      const mode = modes[modeKey];
      title.text(mode.title).call(wrap, width - 45);
      updateView(mode);
      drawLegend(mode);
      drawMetrics(modeKey);
      drawSources(mode);
    }

    label(svg, `contours.nc · grille SPC 2020 · BDROUTE ${metadata.routes.data_version}`, width - 18, height - 15, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });

    scenarioSelect.addEventListener("change", () => update(scenarioSelect.value));
    smoothingButton.addEventListener("click", () => {
      smoothView = !smoothView;
      updateView(modes[activeMode]);
    });
    download.addEventListener("click", () => downloadPng(svg.node(), download, `noumea-accessibilite-${activeMode}.png`));
    update(activeMode);
  }

  function downloadPng(svg, button, filename) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "…";
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const viewBox = svg.viewBox.baseVal;
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewBox.width * 2);
      canvas.height = Math.ceil(viewBox.height * 2);
      const context = canvas.getContext("2d");
      context.fillStyle = paper;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
})();
