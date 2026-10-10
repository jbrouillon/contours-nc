// Croquis des diapositives « En bref » de l'article « Pourquoi la population se
// concentre autour de Nouméa ? ». Ils reprennent, au format 420 × 240 des
// diapositives, les écrans de la campagne sociale (dépôt contours-nc-social,
// articles/concentration-population-noumea-pacifique) et lisent les mêmes blocs
// de données que les graphiques de l'article (<script id="…-data">) : mêmes
// séries, mêmes couleurs. Ils sont dessinés à la première ouverture du résumé
// (événement « contours-brief:open »).
(() => {
  "use strict";

  const roots = Array.from(document.querySelectorAll("[data-concentration-brief]"));
  if (!roots.length || !window.d3 || !window.rough) return;

  const ink = "#252525";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const gnColor = "#2f6b45";
  const noumeaColor = "#c54832";
  const couronneColor = "#d6a21f";
  const otherColor = "#7a8c8d";
  const sketchFont = "Cabin Sketch, sans-serif";
  const format0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const format1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (x) => `${format1.format(x)} %`;
  const int = (x) => format0.format(x);
  const signedInt = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${format0.format(Math.abs(x))}`;

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
    return append(parent, rc.path(d, roughOptions(options, { fill: "none", stroke: ink, strokeWidth: 0.8, roughness: 0.9, bowing: 0.5 })), options.opacity);
  }

  function roughRect(parent, rc, x, y, width, height, options = {}) {
    return append(parent, rc.rectangle(x, y, width, height, roughOptions(options, {
      fill: "none", fillStyle: "hachure", stroke: ink, strokeWidth: 0.7, roughness: 1, bowing: 0.8
    })), options.opacity);
  }

  function roughLine(parent, rc, x1, y1, x2, y2, options = {}) {
    return append(parent, rc.line(x1, y1, x2, y2, roughOptions(options, { stroke: ink, strokeWidth: 0.8, roughness: 1, bowing: 0.6 })), options.opacity);
  }

  function roughCircle(parent, rc, x, y, diameter, options = {}) {
    return append(parent, rc.circle(x, y, diameter, roughOptions(options, {
      fill: paper, fillStyle: "hachure", hachureGap: 2.4, fillWeight: 0.6, stroke: ink, strokeWidth: 0.6, roughness: 0.9
    })), options.opacity);
  }

  function hatchColor(color) {
    const lab = d3.lab(color);
    return d3.lab(Math.max(10, lab.l - 30), lab.a, lab.b).formatHex();
  }

  function bar(parent, rc, x, y, width, height, color, seedKey, opacity = 0.88) {
    if (width <= 0 || height <= 0) return;
    parent.append("rect").attr("x", x).attr("y", y).attr("width", width).attr("height", height).attr("fill", color).attr("fill-opacity", opacity);
    roughRect(parent, rc, x, y, width, height, {
      fill: hatchColor(color), fillStyle: "hachure", hachureAngle: -41, hachureGap: 3, fillWeight: 0.5,
      stroke: hatchColor(color), strokeWidth: 0.6, roughness: 0.9, opacity: 0.55, seed: seedKey
    });
  }

  // Largeur approximative d'un texte : les croquis sont dessinés dans des
  // diapositives masquées, où la mesure réelle d'un texte vaut 0.
  const textWidth = (text, size) => String(text).length * size * 0.56;

  function signature(svg, x = 416, anchor = "end") {
    label(svg, "contours.nc", x, 235, { anchor, size: 8.5, weight: 760, color: muted });
  }

  // Générateur pseudo-aléatoire déterministe pour la simulation de forces.
  function lcg(seedValue) {
    let state = seedValue >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  // Clé de commune de l'article (normalizeKey) : sans accents, en majuscules.
  function normalizeKey(value) {
    return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function rewind(features) {
    const flip = (polygon) => polygon.map((ring) => ring.slice().reverse());
    const fix = (polygon) => (d3.geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI ? flip(polygon) : polygon);
    return features.map((feature) => {
      const g = feature.geometry;
      return { ...feature, geometry: { ...g, coordinates: g.type === "Polygon" ? fix(g.coordinates) : g.coordinates.map(fix) } };
    });
  }

  // --- Données : blocs JSON de la page -------------------------------------------

  let cache = null;

  function payload(id) {
    const node = document.getElementById(`${id}-data`);
    if (!node) throw new Error(`Données absentes : ${id}`);
    return JSON.parse(node.textContent);
  }

  function loadData() {
    if (cache) return cache;
    const map = payload("carte-population-communes");
    cache = {
      map,
      communes: rewind(map.geojson.features),
      concentration: payload("chart-concentration"),
      migrations: payload("chart-migrations-internes"),
      arrivals: payload("chart-arrivees-exterieures"),
      work: payload("chart-emplois-residence"),
      pacific: payload("chart-pacifique-villes")
    };
    return cache;
  }

  function series(data, serie) {
    return data.concentration.data.filter((d) => d.serie === serie).sort((a, b) => a.annee - b.annee);
  }

  function gnShare(data, year) {
    const row = data.concentration.data.find((d) => d.serie === "Grand Nouméa" && d.annee === year);
    if (!row) throw new Error(`Part absente : ${year}`);
    return row.valeur;
  }

  function migration(data, region, periode) {
    const row = data.migrations.data.find((d) => d.serie === region && d.periode === periode);
    if (!row) throw new Error(`Solde absent : ${region} ${periode}`);
    return row.valeur;
  }

  // --- Communes en cercles ----------------------------------------------------
  // Comme la carte animée de l'article : aire proportionnelle à la population,
  // même échelle pour toutes les années, cercles écartés de leur commune
  // seulement autant que nécessaire. Kouaoua et Poum n'ont pas de cercle avant
  // leur création.

  function circleFrame(data, width, height, ratio) {
    const maxPop = d3.max(data.map.data, (d) => d.population || 0);
    const maxRadius = Math.min(width, height) * ratio;
    const margin = maxRadius * 0.7;
    const projection = d3.geoMercator().fitExtent([[margin, margin], [width - margin, height - margin]], { type: "FeatureCollection", features: data.communes });
    return { radius: d3.scaleSqrt().domain([0, maxPop]).range([0, maxRadius]), path: d3.geoPath(projection), width, height };
  }

  function layoutYear(data, frame, year) {
    const rows = new Map(data.map.data.filter((d) => d.annee === year).map((d) => [normalizeKey(d.key), d]));
    const nodes = data.communes.map((feature) => {
      const key = normalizeKey(feature.properties.commune);
      const row = rows.get(key);
      if (!row) throw new Error(`Commune absente : ${feature.properties.commune} ${year}`);
      const [cx, cy] = frame.path.centroid(feature);
      const population = Number.isFinite(row.population) ? row.population : null;
      return { key, name: row.commune, gn: row.isGrandNoumea, population, r: population ? Math.max(1.2, frame.radius(population)) : 0, x: cx, y: cy, cx, cy };
    });
    const present = nodes.filter((d) => d.population);
    const simulation = d3.forceSimulation(present)
      .randomSource(lcg(year))
      .force("x", d3.forceX((d) => d.cx).strength(0.06))
      .force("y", d3.forceY((d) => d.cy).strength(0.06))
      .force("collide", d3.forceCollide((d) => d.r + 1.2).strength(1).iterations(4))
      .stop();
    for (let i = 0; i < 600; i += 1) {
      simulation.tick();
      present.forEach((d) => {
        d.x = Math.max(d.r + 2, Math.min(frame.width - d.r - 2, d.x));
        d.y = Math.max(d.r + 2, Math.min(frame.height - d.r - 2, d.y));
      });
    }
    return nodes;
  }

  function drawCircles(parent, rc, data, frame, nodes, seedPrefix) {
    parent.append("path").attr("d", data.communes.map((f) => frame.path(f)).join(""))
      .attr("fill", "#ece4d3").attr("stroke", "#b9b1a5").attr("stroke-width", 0.5).attr("stroke-linejoin", "round");
    nodes.filter((d) => d.r > 0).sort((a, b) => d3.descending(a.r, b.r)).forEach((d) => {
      const color = d.gn ? gnColor : "#c9b48a";
      roughCircle(parent, rc, d.x, d.y, d.r * 2, {
        fill: color, hachureGap: d.gn ? 2.6 : 1.8, fillWeight: d.gn ? 0.7 : 0.5,
        stroke: d.gn ? hatchColor(gnColor) : "#7b6a4a", strokeWidth: d.gn ? 1.1 : 0.5, seed: `brief-${seedPrefix}-${d.key}`
      });
    });
  }

  const sketches = {
    cercles(svg, rc, node, data) {
      const frame = circleFrame(data, 420, 240, 0.15);
      const nodes = layoutYear(data, frame, Number(node.dataset.annee));
      drawCircles(svg, rc, data, frame, nodes, "cercle");
      const gnNodes = nodes.filter((d) => d.gn);
      gnNodes.filter((d) => d.r > 10).forEach((d) => {
        label(svg, d.name, d.x, d.y, { anchor: "middle", size: Math.max(8, Math.min(10.5, d.r * 0.42)), weight: 850, halo: true });
      });
      const left = d3.min(gnNodes, (d) => d.x - d.r);
      const bottom = d3.max(gnNodes, (d) => d.y + d.r);
      label(svg, "Grand Nouméa", left - 6, bottom - 22, { anchor: "end", size: 17, family: sketchFont, color: gnColor, halo: true, haloWidth: 3.5 });
      label(svg, `${pct(gnShare(data, Number(node.dataset.annee)))} des habitants`, left - 6, bottom - 6, { anchor: "end", size: 9.5, weight: 850, color: gnColor, halo: true });
      signature(svg);
    },

    // La carte animée de l'article, figée à deux recensements.
    evolution(svg, rc, node, data) {
      const years = node.dataset.annees.split("|").map(Number);
      const gap = 10;
      const panelW = (420 - gap * (years.length - 1)) / years.length;
      years.forEach((year, index) => {
        const g = svg.append("g").attr("transform", `translate(${index * (panelW + gap)},0)`);
        g.append("rect").attr("width", panelW).attr("height", 226).attr("fill", paper);
        roughRect(g, rc, 0, 0, panelW, 226, { stroke: "#b9b1a5", strokeWidth: 0.8, seed: `brief-evolution-cadre-${year}` });
        label(g, String(year), 8, 14, { size: 18, family: sketchFont });
        label(g, `Grand Nouméa : ${pct(gnShare(data, year))}`, 8, 32, { size: 9.5, weight: 850, color: gnColor });
        const map = g.append("g").attr("transform", "translate(0,40)");
        const frame = circleFrame(data, panelW, 184, 0.2);
        drawCircles(map, rc, data, frame, layoutYear(data, frame, year), `evolution-${year}`);
      });
      signature(svg);
    },

    // Parts de la population : Nouméa, couronne et Grand Nouméa.
    courbes(svg, rc, node, data) {
      const keys = [["Grand Nouméa", gnColor, 2.2], ["Nouméa", noumeaColor, 1.6], ["Couronne périurbaine", couronneColor, 1.6]];
      const left = 30;
      const right = 330;
      const top = 10;
      const bottom = 212;
      const years = series(data, "Nouméa").map((d) => d.annee);
      const x = d3.scaleLinear().domain(d3.extent(years)).range([left, right]);
      const y = d3.scaleLinear().domain([0, 80]).range([bottom, top]);
      [0, 20, 40, 60, 80].forEach((t) => {
        svg.append("line").attr("x1", left).attr("x2", right).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#d5ccbe").attr("stroke-dasharray", "2 4");
        label(svg, `${t} %`, left - 4, y(t), { anchor: "end", size: 8.5, color: muted });
      });
      [1956, 1976, 1996, 2019].forEach((year) => label(svg, String(year), x(year), bottom + 11, { anchor: "middle", size: 8.5, color: muted }));
      const ends = [];
      keys.forEach(([serie, color, strokeWidth]) => {
        const points = series(data, serie).map((d) => [x(d.annee), y(d.valeur)]);
        roughPath(svg, rc, d3.line()(points), { stroke: color, strokeWidth, seed: `brief-courbe-${serie}` });
        points.forEach(([px, py], i) => svg.append("circle").attr("cx", px).attr("cy", py).attr("r", 2.3).attr("fill", color));
        const last = series(data, serie).at(-1);
        ends.push({ serie, color, y: y(last.valeur), value: last.valeur });
      });
      ends.sort((a, b) => a.y - b.y).forEach((end, i, list) => {
        if (i && end.y - list[i - 1].y < 22) end.y = list[i - 1].y + 22;
        label(svg, end.serie === "Couronne périurbaine" ? "Couronne" : end.serie, right + 8, end.y - 5, { size: 9.5, weight: 850, color: hatchColor(end.color) });
        label(svg, pct(end.value), right + 8, end.y + 6, { size: 9.5, weight: 800, color: end.color });
      });
      const peak = d3.greatest(series(data, "Nouméa"), (d) => d.valeur);
      label(svg, `${peak.annee} : ${pct(peak.valeur)}`, x(peak.annee), y(peak.valeur) - 10, { anchor: "middle", size: 9, weight: 850, color: noumeaColor, halo: true });
      signature(svg);
    },

    // Solde des déménagements par période : Grand Nouméa, Nord-Ouest et les
    // trois autres régions réunies (la somme des cinq soldes est nulle).
    soldes(svg, rc, node, data) {
      const periods = data.migrations.options.periods;
      const others = data.migrations.options.series.filter((r) => r !== "Grand Nouméa" && r !== "Nord Ouest");
      const groups = [
        ["Grand Nouméa", gnColor, (p) => migration(data, "Grand Nouméa", p)],
        ["Nord-Ouest", couronneColor, (p) => migration(data, "Nord Ouest", p)],
        ["Îles, Nord-Est, Sud rural", otherColor, (p) => d3.sum(others, (r) => migration(data, r, p))]
      ];
      const left = 38;
      const right = 416;
      const top = 30;
      const bottom = 212;
      const all = periods.flatMap((p) => groups.map(([, , f]) => f(p)));
      const y = d3.scaleLinear().domain([Math.min(0, d3.min(all)), d3.max(all)]).nice().range([bottom, top]);
      const x0 = d3.scaleBand().domain(periods).range([left, right]).paddingInner(0.2);
      const x1 = d3.scaleBand().domain(groups.map((g) => g[0])).range([0, x0.bandwidth()]).padding(0.08);
      y.ticks(4).forEach((t) => {
        svg.append("line").attr("x1", left).attr("x2", right).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#d5ccbe").attr("stroke-dasharray", "2 4");
        label(svg, signedInt(t), left - 4, y(t), { anchor: "end", size: 8, color: muted });
      });
      periods.forEach((periode) => {
        groups.forEach(([name, color, f], g) => {
          const value = f(periode);
          const bx = x0(periode) + x1(name);
          bar(svg, rc, bx, Math.min(y(value), y(0)), x1.bandwidth(), Math.abs(y(value) - y(0)), color, `brief-solde-${periode}-${g}`);
          if (g === 0) label(svg, signedInt(value), bx + x1.bandwidth() / 2, y(value) - 6, { anchor: "middle", size: 8, weight: 850, color: hatchColor(color), halo: true });
        });
        label(svg, periode.replace("-", "–"), x0(periode) + x0.bandwidth() / 2, bottom + 11, { anchor: "middle", size: 8.5, weight: 750, color: muted });
      });
      roughLine(svg, rc, left, y(0), right, y(0), { strokeWidth: 1, seed: "brief-soldes-zero" });
      let lx = left;
      groups.forEach(([name, color], g) => {
        bar(svg, rc, lx, 4, 10, 10, color, `brief-soldes-legende-${g}`);
        label(svg, name, lx + 14, 9, { size: 9, weight: 850, color: hatchColor(color) });
        lx += 14 + textWidth(name, 9) + 14;
      });
      signature(svg, 4, "start");
    },

    // Arrivées de l'extérieur, en 100 % par période.
    arrivees(svg, rc, node, data) {
      const rows = d3.groups(data.arrivals.data, (d) => d.periode).map(([periode, items]) => {
        const gn = items.find((d) => d.serie === "grand_noumea").valeur;
        const rest = items.find((d) => d.serie === "reste").valeur;
        return { periode, part: (100 * gn) / (gn + rest) };
      });
      const left = 62;
      const right = 414;
      const top = 22;
      const rowHeight = (220 - top) / rows.length;
      const x = d3.scaleLinear().domain([0, 100]).range([left, right]);
      label(svg, "s’installent dans le Grand Nouméa", left, 9, { size: 9, weight: 850, color: gnColor });
      label(svg, "ailleurs", right, 9, { anchor: "end", size: 9, weight: 850, color: hatchColor(otherColor) });
      rows.forEach((row, index) => {
        const y0 = top + index * rowHeight + rowHeight * 0.18;
        const h = rowHeight * 0.64;
        label(svg, row.periode.replace("-", "–"), left - 6, y0 + h / 2, { anchor: "end", size: 8.5, color: muted });
        bar(svg, rc, x(0), y0, x(row.part) - x(0), h, gnColor, `brief-arrivees-gn-${index}`);
        bar(svg, rc, x(row.part), y0, x(100) - x(row.part), h, otherColor, `brief-arrivees-reste-${index}`, 0.55);
        label(svg, pct(row.part), x(0) + 6, y0 + h / 2, { size: 10, weight: 850, color: paper });
      });
      svg.append("line").attr("x1", x(80)).attr("x2", x(80)).attr("y1", top - 4).attr("y2", 222).attr("stroke", ink).attr("stroke-width", 1).attr("stroke-dasharray", "4 4");
      label(svg, "8 sur 10", x(80) - 4, top - 4, { anchor: "end", size: 8.5, weight: 850, halo: true });
      signature(svg);
    },

    // Lieu d'habitation et lieu de travail des personnes en emploi.
    travail(svg, rc, node, data) {
      const zones = data.work.options.zones;
      const measures = [["Personnes en emploi qui y habitent", "y habitent", couronneColor], ["Personnes qui y travaillent", "y travaillent", gnColor]];
      const left = 4;
      const top = 22;
      const groupHeight = (222 - top) / zones.length;
      const barHeight = Math.min(18, (groupHeight - 16) / 2 - 2);
      const x = d3.scaleLinear().domain([0, 60]).range([left, 370]);
      let lx = left;
      measures.forEach(([, text, color], m) => {
        bar(svg, rc, lx, 4, 10, 10, color, `brief-travail-legende-${m}`);
        const legend = `personnes en emploi qui ${text}`;
        label(svg, legend, lx + 14, 9, { size: 9, weight: 850, color: hatchColor(color) });
        lx += 14 + textWidth(legend, 9) + 14;
      });
      zones.forEach((zone, z) => {
        const y0 = top + z * groupHeight;
        label(svg, zone === "Couronne périurbaine" ? "Couronne (Dumbéa, Mont-Dore, Païta)" : zone, left, y0 + 7, { size: 9.5, weight: 850 });
        measures.forEach(([mesure, , color], m) => {
          const row = data.work.data.find((d) => d.zone === zone && d.mesure === mesure);
          if (!row) throw new Error(`Emploi absent : ${zone}`);
          const by = y0 + 15 + m * (barHeight + 2);
          bar(svg, rc, x(0), by, x(row.valeur) - x(0), barHeight, color, `brief-travail-${z}-${m}`);
          label(svg, pct(row.valeur), x(row.valeur) + 5, by + barHeight / 2, { size: 9, weight: 850, color: hatchColor(color) });
        });
      });
      signature(svg);
    },

    // Capitale seule (cercle vide) et agglomération ou ville associée (cercle
    // plein), en part de la population ; l'astérisque reprend l'indicateur
    // « estimation » de l'article.
    pacifique(svg, rc, node, data) {
      const rows = data.pacific.data.filter((d) => Number.isFinite(d.noyau) && Number.isFinite(d.elargi)).sort((a, b) => d3.descending(a.elargi, b.elargi));
      const left = 116;
      const right = 380;
      const top = 22;
      const rowHeight = (214 - top) / rows.length;
      const x = d3.scaleLinear().domain([0, 80]).range([left, right]);
      [0, 20, 40, 60, 80].forEach((t) => {
        svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", top - 4).attr("y2", 214).attr("stroke", "#d5ccbe").attr("stroke-dasharray", "2 4");
        label(svg, `${t} %`, x(t), 222, { anchor: "middle", size: 8, color: muted });
      });
      svg.append("circle").attr("cx", left + 4).attr("cy", 8).attr("r", 4).attr("fill", paper).attr("stroke", noumeaColor).attr("stroke-width", 1.5);
      label(svg, "capitale seule", left + 12, 8, { size: 9, weight: 850, color: noumeaColor });
      const bx = left + 12 + textWidth("capitale seule", 9) + 16;
      svg.append("circle").attr("cx", bx).attr("cy", 8).attr("r", 4).attr("fill", gnColor);
      label(svg, "agglomération", bx + 8, 8, { size: 9, weight: 850, color: gnColor });
      rows.forEach((row, index) => {
        const cy = top + index * rowHeight + rowHeight / 2;
        const isNC = row.cas === "Nouvelle-Calédonie";
        if (isNC) svg.append("rect").attr("x", 0).attr("y", cy - rowHeight / 2 + 1).attr("width", 420).attr("height", rowHeight - 2).attr("fill", "#e7efe3");
        label(svg, `${row.cas}${row.estimation ? " *" : ""}`, left - 8, cy, { anchor: "end", size: 8.5, weight: isNC ? 850 : 750, color: isNC ? gnColor : ink });
        roughLine(svg, rc, x(row.noyau), cy, x(row.elargi), cy, { stroke: "#8f877b", strokeWidth: 1.2, roughness: 0.5, seed: `brief-pac-${index}` });
        svg.append("circle").attr("cx", x(row.noyau)).attr("cy", cy).attr("r", 3.6).attr("fill", paper).attr("stroke", noumeaColor).attr("stroke-width", 1.4);
        svg.append("circle").attr("cx", x(row.elargi)).attr("cy", cy).attr("r", 3.8).attr("fill", gnColor);
        label(svg, pct(row.elargi), x(row.elargi) + 7, cy, { size: 8.5, weight: 850, color: gnColor });
      });
      label(svg, "* périmètre large ou estimé", 4, 235, { size: 8, color: muted });
      signature(svg);
    }
  };

  function drawAll(container) {
    const data = loadData();
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
  }

  roots.forEach((root) => {
    let started = false;
    const start = (container) => {
      if (started) return;
      started = true;
      try {
        drawAll(container);
      } catch (error) {
        console.error(error);
        container.querySelectorAll("svg[data-brief-sketch]").forEach((node) => {
          label(d3.select(node), "Croquis indisponible : données absentes", 210, 120, { anchor: "middle", size: 10, color: muted });
        });
      }
    };
    root.addEventListener("contours-brief:open", (event) => start(event.detail?.dialog || root));
    if (root.contoursBrief?.isOpen()) start(root.contoursBrief.dialog);
  });
})();
