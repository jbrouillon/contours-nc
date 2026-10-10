// Croquis des diapositives « En bref » de l'article « Explorer les disparités
// territoriales en Nouvelle-Calédonie ». Ils reprennent, au format 420 × 240
// des diapositives, les écrans de la campagne sociale (dépôt contours-nc-social,
// articles/disparites-territoriales-nouvelle-caledonie) : mêmes données, mêmes
// seuils et couleurs de classes que la carte des IRIS de l'article
// (ncMetricDefinitions dans disparites-territoriales-nouvelle-caledonie.js),
// r de Pearson comme dans son nuage de points. Les croquis sont dessinés à la
// première ouverture du résumé (événement « contours-brief:open »).
(() => {
  "use strict";

  const roots = Array.from(document.querySelectorAll("[data-disparites-brief]"));
  if (!roots.length || !window.d3 || !window.rough) return;

  const ink = "#252525";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const noData = "#d6d0c4";
  const gnColor = "#2f6b45";
  const restColor = "#c98d3a";
  const trendColor = "#c54832";
  const GN = ["Nouméa", "Dumbéa", "Mont-Dore", "Païta"];
  // Emprise du Grand Nouméa (article Provinciales 2026) et cadrage resserré
  // sur l'agglomération : ouest, sud, est, nord.
  const GN_BBOX = [166.34, -22.32, 166.64, -22.11];
  const AGGLO_BBOX = [166.385, -22.33, 166.585, -22.18];

  const metrics = {
    taux_sans_internet: {
      label: "Ménages sans accès à internet",
      thresholds: [20, 35, 50, 65, 80],
      colors: ["#f4f1e8", "#e4dec3", "#cbc491", "#a8a35e", "#7b7d3e", "#52582d"]
    },
    taux_chomage: {
      label: "Chômage parmi les actifs",
      thresholds: [8, 12, 20, 30, 40],
      colors: ["#f5eee4", "#ead9c5", "#e2bd84", "#d89258", "#c85d3e", "#8e2f27"]
    },
    taux_bac3_plus: {
      label: "Diplômés d’un bac +3 ou plus",
      thresholds: [2, 5, 10, 20, 35],
      colors: ["#f1ece2", "#dce3cf", "#b9d0ae", "#85b087", "#528565", "#2f5f46"]
    },
    taux_nes_hors_nc: {
      label: "Nés hors de Nouvelle-Calédonie",
      thresholds: [5, 10, 20, 35, 50],
      colors: ["#f0eef5", "#ddd8e9", "#beb3d4", "#9584b6", "#6c568f", "#49356c"]
    }
  };

  // --- Outils ------------------------------------------------------------------

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
      .attr("font-size", options.size || 9)
      .attr("font-weight", options.weight || 750)
      .attr("fill", options.color || ink)
      .attr("paint-order", options.halo ? "stroke" : null)
      .attr("stroke", options.halo ? paper : null)
      .attr("stroke-width", options.halo ? (options.haloWidth || 2.6) : null)
      .attr("stroke-linejoin", options.halo ? "round" : null)
      .text(text);
  }

  function append(parent, node, opacity) {
    parent.node().appendChild(node);
    const selection = d3.select(node);
    if (opacity != null) selection.attr("opacity", opacity);
    return selection;
  }

  function roughOptions(options, defaults) {
    const merged = { ...defaults, ...options };
    merged.seed = seed(options.seed);
    delete merged.opacity;
    return merged;
  }

  function roughPath(parent, rc, d, options = {}) {
    if (!d) return null;
    return append(parent, rc.path(d, roughOptions(options, {
      fill: "none", stroke: ink, strokeWidth: 0.8, roughness: 1.1, bowing: 0.8
    })), options.opacity);
  }

  function roughRect(parent, rc, x, y, width, height, options = {}) {
    return append(parent, rc.rectangle(x, y, width, height, roughOptions(options, {
      fill: "none", fillStyle: "hachure", stroke: ink, strokeWidth: 0.7, roughness: 1.1, bowing: 0.8
    })), options.opacity);
  }

  function roughLine(parent, rc, x1, y1, x2, y2, options = {}) {
    return append(parent, rc.line(x1, y1, x2, y2, roughOptions(options, {
      stroke: ink, strokeWidth: 0.8, roughness: 1, bowing: 0.6
    })), options.opacity);
  }

  function roughCircle(parent, rc, x, y, diameter, options = {}) {
    return append(parent, rc.circle(x, y, diameter, roughOptions(options, {
      fill: paper, fillStyle: "hachure", hachureGap: 1.6, fillWeight: 0.6, stroke: ink, strokeWidth: 0.5, roughness: 0.8
    })), options.opacity);
  }

  function hatchColor(color) {
    const lab = d3.lab(color);
    return d3.lab(Math.max(10, lab.l - 30), lab.a, lab.b).formatHex();
  }

  function signature(svg) {
    label(svg, "contours.nc", 416, 235, { anchor: "end", size: 8.5, weight: 760, color: muted });
  }

  const inGN = (row) => GN.includes(row.commune);

  // Classe d'une valeur, comme colorFor dans l'article (d3.bisectRight).
  function classOf(value, definition) {
    if (value == null || !Number.isFinite(+value)) return -1;
    return Math.min(d3.bisectRight(definition.thresholds, +value), definition.colors.length - 1);
  }

  function legendLabel(index, thresholds) {
    if (index === 0) return `< ${thresholds[0]} %`;
    if (index === thresholds.length) return `≥ ${thresholds[index - 1]} %`;
    return `${thresholds[index - 1]}–${thresholds[index]} %`;
  }

  function pearson(rows, xKey, yKey) {
    const pairs = rows.filter((r) => Number.isFinite(r[xKey]) && Number.isFinite(r[yKey]));
    const mx = d3.mean(pairs, (r) => r[xKey]);
    const my = d3.mean(pairs, (r) => r[yKey]);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    pairs.forEach((r) => {
      sxy += (r[xKey] - mx) * (r[yKey] - my);
      sxx += (r[xKey] - mx) ** 2;
      syy += (r[yKey] - my) ** 2;
    });
    return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, intercept: my - (sxy / sxx) * mx };
  }

  // --- Données -------------------------------------------------------------------

  // d3 attend des anneaux dans le sens horaire ; les IRIS mêlent les deux
  // orientations d'un polygone à l'autre : chaque polygone qui couvrirait plus
  // d'un hémisphère est retourné.
  function rewind(features) {
    const flip = (polygon) => polygon.map((ring) => ring.slice().reverse());
    const fix = (polygon) => (d3.geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI ? flip(polygon) : polygon);
    return features.map((feature) => {
      const g = feature.geometry;
      if (!g) return feature;
      return { ...feature, geometry: { ...g, coordinates: g.type === "Polygon" ? fix(g.coordinates) : g.coordinates.map(fix) } };
    });
  }

  let dataPromise = null;

  // Même fichier que les cartes de l'article (données de #habitat-map-bundle-data).
  function loadData() {
    if (dataPromise) return dataPromise;
    const node = document.getElementById("habitat-map-bundle-data");
    if (!node || !node.dataset.ncSrc) return Promise.reject(new Error("Données cartographiques absentes"));
    dataPromise = fetch(node.dataset.ncSrc, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`Chargement impossible (${response.status})`);
        return response.json();
      })
      .then((bundle) => {
        const byId = new Map(bundle.nc_data.map((row) => [String(row.map_id), row]));
        return {
          features: rewind(bundle.nc_geometry.features).map((feature) => ({ ...feature, row: byId.get(String(feature.properties.map_id)) || {} })),
          populated: bundle.nc_data.filter((row) => row.population > 0),
          area: rewind(bundle.nc_linework.area.features),
          communes: bundle.nc_linework.communes,
          provinces: bundle.nc_linework.provinces
        };
      });
    dataPromise.catch(() => {
      dataPromise = null;
    });
    return dataPromise;
  }

  // --- Cartes --------------------------------------------------------------------

  function drawIris(parent, rc, data, path, definition, { seedKey, gap = 3.2, irisStroke = 0.25 }) {
    data.features.forEach((feature) => {
      const id = classOf(feature.row[definition.key], definition);
      const fill = id < 0 ? noData : definition.colors[id];
      const d = path(feature);
      if (!d) return;
      parent.append("path").attr("d", d).attr("fill", fill);
      // La première classe, presque couleur papier, garde une hachure lâche.
      if (id >= 0) {
        roughPath(parent, rc, d, {
          fill: hatchColor(fill), fillStyle: "hachure", hachureAngle: -41, hachureGap: id ? gap - id * 0.25 : gap * 1.3,
          fillWeight: 0.5, stroke: "none", strokeWidth: 0, roughness: 1.2, opacity: id ? 0.45 : 0.3,
          seed: `brief-${seedKey}-${feature.properties.map_id}`
        });
      }
    });
    parent.append("path").attr("d", data.features.map((f) => path(f)).join(""))
      .attr("fill", "none").attr("stroke", "#4f4942").attr("stroke-width", irisStroke).attr("stroke-opacity", 0.45).attr("stroke-linejoin", "round");
    parent.append("path").attr("d", path(data.communes)).attr("fill", "none")
      .attr("stroke", "#3b3630").attr("stroke-width", 0.6).attr("stroke-opacity", 0.5).attr("stroke-linejoin", "round");
  }

  // Côte : grandes îles crayonnées, îlots en trait simple.
  function drawCoast(parent, rc, path, features, seedKey, minArea = 20, strokeWidth = 0.9) {
    const small = [];
    features.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
      .forEach((coordinates, index) => {
        const shape = { type: "Polygon", coordinates };
        const d = path(shape);
        if (!d) return;
        if (path.area(shape) < minArea) small.push(d);
        else roughPath(parent, rc, d, { strokeWidth, roughness: 1, seed: `brief-${seedKey}-cote-${index}` });
      });
    if (small.length) parent.append("path").attr("d", small.join("")).attr("fill", "none").attr("stroke", ink).attr("stroke-width", 0.5);
  }

  function boxProjection(box, bbox) {
    const [west, south, east, north] = bbox;
    return d3.geoMercator().fitExtent(box, { type: "MultiPoint", coordinates: [[west, south], [east, north]] }).clipExtent(box);
  }

  function boxIsFree(projection, area, [x0, y0, x1, y1]) {
    for (let i = 0; i <= 6; i += 1) {
      for (let j = 0; j <= 6; j += 1) {
        const point = projection.invert([x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * j / 6]);
        if (point && area.some((feature) => d3.geoContains(feature, point))) return false;
      }
    }
    return true;
  }

  let clipCounter = 0;

  // Panneau d'une emprise du Grand Nouméa : cadre de papier, IRIS, côte.
  function drawPanel(svg, rc, data, definition, box, { bbox, seedKey, names = null, nameSize = 7.5, title = null }) {
    const [[x0, y0], [x1, y1]] = box;
    svg.append("rect").attr("x", x0).attr("y", y0).attr("width", x1 - x0).attr("height", y1 - y0).attr("fill", paper);
    roughRect(svg, rc, x0, y0, x1 - x0, y1 - y0, { stroke: "#b9b1a5", strokeWidth: 0.8, seed: `brief-${seedKey}-cadre` });
    const inner = [[x0 + 3, y0 + 3], [x1 - 3, y1 - 3]];
    const projection = boxProjection(inner, bbox);
    const path = d3.geoPath(projection);
    const id = `brief-clip-${++clipCounter}`;
    svg.append("defs").append("clipPath").attr("id", id).append("rect")
      .attr("x", inner[0][0]).attr("y", inner[0][1]).attr("width", inner[1][0] - inner[0][0]).attr("height", inner[1][1] - inner[0][1]);
    const g = svg.append("g").attr("clip-path", `url(#${id})`);
    drawIris(g, rc, data, path, definition, { seedKey, gap: 2.6, irisStroke: 0.35 });
    drawCoast(g, rc, path, data.area, seedKey, 8, 0.8);
    if (names) quartierLabels(svg, data, path, inner, nameSize, names);
    if (title) label(svg, title, x0 + 5, y0 + 9, { size: 9.5, weight: 850, halo: true });
    return projection;
  }

  const quartiers = [
    [/^Centre ville/, "Centre-ville"], [/^Anse Vata/, "Anse Vata"], [/^Ouémo/, "Ouémo"], [/Magenta/, "Magenta"],
    [/^Rivi.re Sal.e/, "Rivière-Salée"], [/^Ducos$/, "Ducos"], [/^Nouville/, "Nouville"], [/^Koutio/, "Koutio"],
    [/^Boulari/, "Boulari"], [/^Val Plaisance/, "Val Plaisance"], [/^N'Géa/, "N’Géa"], [/^Normandie/, "Normandie"]
  ];

  function quartierLabels(svg, data, path, box, size, only) {
    const groups = d3.rollups(
      data.features.filter((f) => GN.includes(f.properties.commune))
        .map((f) => [quartiers.find(([pattern]) => pattern.test(f.properties.map_label || ""))?.[1], f])
        .filter(([name]) => name && only.includes(name)),
      (items) => {
        const shape = { type: "FeatureCollection", features: items.map(([, f]) => f) };
        return { area: path.area(shape), xy: path.centroid(shape) };
      },
      ([name]) => name
    ).sort((a, b) => d3.descending(a[1].area, b[1].area));
    const placed = [];
    groups.forEach(([name, g]) => {
      const [x, y] = g.xy;
      if (!Number.isFinite(x)) return;
      const half = (name.length * size * 0.55) / 2 + 2;
      const b = [x - half, y - size * 0.6, x + half, y + size * 0.6];
      if (b[0] < box[0][0] || b[2] > box[1][0] || b[1] < box[0][1] || b[3] > box[1][1]) return;
      if (placed.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return;
      placed.push(b);
      label(svg, name, x, y, { anchor: "middle", size, weight: 800, color: "#3f3a35", halo: true, haloWidth: 2.2 });
    });
  }

  // Légende de l'article : une case par classe, chaque classe libellée.
  function drawLegend(svg, rc, definition, x, y, width, seedKey) {
    const item = width / definition.colors.length;
    definition.colors.forEach((fill, index) => {
      const x0 = x + index * item;
      svg.append("rect").attr("x", x0).attr("y", y).attr("width", item - 3).attr("height", 8).attr("fill", fill);
      roughRect(svg, rc, x0, y, item - 3, 8, {
        fill: hatchColor(fill), fillStyle: "hachure", hachureAngle: -41, hachureGap: index ? 3 - index * 0.2 : 4,
        fillWeight: 0.45, strokeWidth: 0.5, roughness: 1, opacity: 0.7, seed: `brief-${seedKey}-legende-${index}`
      });
      label(svg, legendLabel(index, definition.thresholds), x0 + (item - 3) / 2, y + 18, { anchor: "middle", size: 9, weight: 800, color: muted });
    });
  }

  // Légende compacte : seuils écrits aux limites des classes.
  function drawCompactLegend(svg, rc, definition, x, y, width, seedKey) {
    const item = width / definition.colors.length;
    definition.colors.forEach((fill, index) => {
      svg.append("rect").attr("x", x + index * item).attr("y", y).attr("width", item).attr("height", 7).attr("fill", fill);
      roughRect(svg, rc, x + index * item, y, item, 7, {
        fill: hatchColor(fill), fillStyle: "hachure", hachureAngle: -41, hachureGap: index ? 3 - index * 0.2 : 4,
        fillWeight: 0.45, strokeWidth: 0.45, roughness: 1, opacity: 0.6, seed: `brief-${seedKey}-legende-${index}`
      });
    });
    definition.thresholds.forEach((t, index) => {
      const last = index === definition.thresholds.length - 1;
      label(svg, last ? `${t} %` : String(t), x + (index + 1) * item, y + 16, { anchor: "middle", size: 8.5, weight: 800, color: muted });
    });
  }

  function definitionOf(key) {
    if (!metrics[key]) throw new Error(`Indicateur inconnu : ${key}`);
    return { key, ...metrics[key] };
  }

  const sketches = {
    // Les 162 zones, avec l'agrandissement du Grand Nouméa logé dans la mer au
    // sud-ouest de la Grande Terre ; version réduite sans légende.
    carte(svg, rc, node, data) {
      const definition = definitionOf(node.dataset.metric);
      const minimal = node.dataset.minimal === "true";
      const seedKey = `carte-${definition.key}${minimal ? "-mini" : ""}`;
      const mapBox = minimal ? [[6, 6], [414, 228]] : [[4, 4], [416, 196]];
      const projection = d3.geoMercator().fitExtent(mapBox, { type: "FeatureCollection", features: data.area });
      const path = d3.geoPath(projection);
      drawIris(svg, rc, data, path, definition, { seedKey });
      roughPath(svg, rc, path(data.provinces), { stroke: "#332e29", strokeWidth: 0.6, roughness: 1.4, opacity: 0.45, seed: `brief-${seedKey}-provinces` });
      drawCoast(svg, rc, path, data.area, seedKey);
      if (minimal) {
        label(svg, "20 indicateurs · 162 zones · 58 quartiers", 6, 232, { size: 10, weight: 850, color: muted });
        signature(svg);
        return;
      }
      const [west, south, east, north] = GN_BBOX;
      const [ax, ay] = projection([west, north]);
      const [bx, by] = projection([east, south]);
      roughRect(svg, rc, ax, ay, bx - ax, by - ay, { strokeWidth: 1, roughness: 0.8, seed: `brief-${seedKey}-emprise` });
      let inset = null;
      for (let size = 0.6; size > 0.2 && !inset; size -= 0.04) {
        const w = (mapBox[1][0] - mapBox[0][0]) * size;
        const h = Math.min((mapBox[1][1] - mapBox[0][1]) * size * 1.2, w * 0.72);
        const candidate = [mapBox[0][0], mapBox[1][1] - h, mapBox[0][0] + w, mapBox[1][1]];
        if (boxIsFree(projection, data.area, candidate)) inset = candidate;
      }
      if (inset) {
        drawPanel(svg, rc, data, definition, [[inset[0], inset[1]], [inset[2], inset[3]]], { bbox: GN_BBOX, seedKey: `${seedKey}-gn`, title: "Grand Nouméa" });
        roughLine(svg, rc, ax, by, inset[2], inset[1], { strokeWidth: 0.7, opacity: 0.7, seed: `brief-${seedKey}-rappel` });
      }
      drawLegend(svg, rc, definition, 6, 206, 330, seedKey);
      signature(svg);
    },

    // L'agglomération seule, quartiers nommés, repère de situation.
    "grand-noumea"(svg, rc, node, data) {
      const definition = definitionOf(node.dataset.metric);
      const seedKey = `gn-${definition.key}`;
      const box = [[2, 2], [418, 196]];
      const projection = drawPanel(svg, rc, data, definition, box, {
        bbox: AGGLO_BBOX, seedKey, nameSize: 9.5,
        names: ["Rivière-Salée", "Ducos", "Magenta", "Ouémo", "Anse Vata", "Koutio", "Nouville", "Boulari", "Val Plaisance"]
      });
      // Repère de situation dans le premier coin du cadre qui tombe en mer.
      const w = 74;
      const h = 46;
      const corners = [[8, 196 - h - 6], [418 - w - 6, 196 - h - 6], [418 - w - 6, 8], [8, 8]];
      const corner = corners.find(([cx, cy]) => boxIsFree(projection, data.area, [cx, cy, cx + w, cy + h])) || corners[0];
      svg.append("rect").attr("x", corner[0] - 2).attr("y", corner[1] - 2).attr("width", w + 4).attr("height", h + 4).attr("fill", paper).attr("stroke", "#b9b1a5").attr("stroke-width", 0.5);
      const loc = d3.geoMercator().fitExtent([corner, [corner[0] + w, corner[1] + h]], { type: "FeatureCollection", features: data.area });
      const locPath = d3.geoPath(loc);
      svg.append("path").attr("d", data.area.map((f) => locPath(f)).join("")).attr("fill", "#e9e2d3").attr("stroke", ink).attr("stroke-width", 0.4);
      const [west, south, east, north] = AGGLO_BBOX;
      const [ax, ay] = loc([west, north]);
      const [bx, by] = loc([east, south]);
      svg.append("rect").attr("x", ax - 1.5).attr("y", ay - 1.5).attr("width", bx - ax + 3).attr("height", by - ay + 3)
        .attr("fill", "none").attr("stroke", trendColor).attr("stroke-width", 1.2);
      drawLegend(svg, rc, definition, 6, 206, 330, seedKey);
      signature(svg);
    },

    // Deux indicateurs sur l'agglomération, côte à côte.
    "deux-cartes"(svg, rc, node, data) {
      const keys = [node.dataset.gauche, node.dataset.droite];
      keys.forEach((key, index) => {
        const definition = definitionOf(key);
        const x0 = index ? 213 : 2;
        label(svg, definition.label, x0 + 2, 7, { size: 9, weight: 850, color: definition.colors[5] });
        drawPanel(svg, rc, data, definition, [[x0, 14], [x0 + 205, 200]], {
          bbox: AGGLO_BBOX, seedKey: `deux-${key}`, nameSize: 8.5, names: ["Rivière-Salée", "Magenta", "Anse Vata", "Koutio"]
        });
        drawCompactLegend(svg, rc, definition, x0 + 4, 206, 197, `deux-${key}`);
      });
      signature(svg);
    },

    // Un point par zone habitée, taille selon la population, couleur selon
    // l'appartenance au Grand Nouméa ; droite de tendance rouge comme dans
    // l'article.
    nuage(svg, rc, node, data) {
      const xKey = node.dataset.x;
      const yKey = node.dataset.y;
      const rows = data.populated.filter((r) => Number.isFinite(r[xKey]) && Number.isFinite(r[yKey]));
      const fit = pearson(rows, xKey, yKey);
      const left = 34;
      const right = 410;
      const top = 16;
      const bottom = 204;
      const x = d3.scaleLinear().domain([0, 100]).range([left, right]);
      const yMax = Math.ceil(d3.max(rows, (r) => r[yKey]) / 10) * 10;
      const y = d3.scaleLinear().domain([0, yMax]).range([bottom, top]);
      const radius = d3.scaleSqrt().domain([0, d3.max(rows, (r) => r.population)]).range([0, 8]);
      svg.append("rect").attr("x", left).attr("y", top).attr("width", right - left).attr("height", bottom - top).attr("fill", paper);
      x.ticks(5).forEach((t) => label(svg, `${t} %`, x(t), bottom + 10, { anchor: "middle", size: 8.5, color: muted }));
      y.ticks(5).forEach((t) => {
        svg.append("line").attr("x1", left).attr("x2", right).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e1d9cb").attr("stroke-dasharray", "2 4");
        label(svg, `${t} %`, left - 4, y(t), { anchor: "end", size: 8.5, color: muted });
      });
      roughRect(svg, rc, left, top, right - left, bottom - top, { stroke: "#b9b1a5", strokeWidth: 0.6, seed: "brief-nuage-cadre" });
      rows.slice().sort((a, b) => d3.descending(a.population, b.population) || d3.ascending(String(a.map_id), String(b.map_id))).forEach((row) => {
        const color = inGN(row) ? gnColor : restColor;
        roughCircle(svg, rc, x(row[xKey]), y(row[yKey]), Math.max(3, radius(row.population) * 2), {
          fill: color, stroke: hatchColor(color), seed: `brief-nuage-${row.map_id}`
        });
      });
      const x1 = Math.min(100, (yMax - fit.intercept) / fit.slope);
      roughLine(svg, rc, x(0), y(fit.intercept), x(x1), y(fit.intercept + fit.slope * x1), { stroke: trendColor, strokeWidth: 1.4, roughness: 0.7, seed: "brief-nuage-tendance" });
      const gnCount = rows.filter(inGN).length;
      [[gnColor, `Grand Nouméa (${gnCount} zones)`], [restColor, `reste du pays (${rows.length - gnCount} zones)`]].forEach(([color, text], index) => {
        roughCircle(svg, rc, left + 10, top + 11 + index * 15, 8, { fill: color, stroke: hatchColor(color), seed: `brief-nuage-legende-${index}` });
        label(svg, text, left + 19, top + 11 + index * 15, { size: 9.5, weight: 850, color: hatchColor(color), halo: true });
      });
      label(svg, "Ménages sans internet →", right, 229, { anchor: "end", size: 9.5, weight: 850 });
      label(svg, "↑ Chômage", left, 7, { size: 9.5, weight: 850 });
      label(svg, "contours.nc", 6, 235, { size: 8.5, weight: 760, color: muted });
    }
  };

  function drawAll(container) {
    return loadData().then((data) => {
      container.querySelectorAll("svg[data-brief-sketch]").forEach((node) => {
        const draw = sketches[node.dataset.briefSketch];
        const svg = d3.select(node);
        svg.selectAll("*").remove();
        try {
          if (!draw) throw new Error(`Croquis inconnu : ${node.dataset.briefSketch}`);
          draw(svg, rough.svg(node), node, data);
        } catch (error) {
          svg.selectAll("*").remove();
          label(svg, "Croquis indisponible", 210, 120, { anchor: "middle", size: 11, color: muted });
          console.error(error);
        }
      });
    });
  }

  roots.forEach((root) => {
    let started = false;
    const start = (container) => {
      if (started) return;
      started = true;
      drawAll(container).catch((error) => {
        started = false;
        console.error(error);
        container.querySelectorAll("svg[data-brief-sketch]").forEach((node) => {
          label(d3.select(node), "Croquis indisponible : données non chargées", 210, 120, { anchor: "middle", size: 10, color: muted });
        });
      });
    };
    root.addEventListener("contours-brief:open", (event) => start(event.detail?.dialog || root));
    if (root.contoursBrief?.isOpen()) start(root.contoursBrief.dialog);
  });
})();
