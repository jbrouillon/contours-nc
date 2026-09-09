(() => {
  "use strict";

  if (!window.d3 || !window.rough) return;

  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const grid = "#ded8cf";
  const green = "#347858";
  const yellow = "#e4b72f";
  const orange = "#e47b31";
  const red = "#c54832";
  const blue = "#247b9a";
  const citySectors = [
    { key: "north-east", label: "Nord-Est", short: "Nord-Est", color: "#287a62" },
    { key: "east", label: "Est", short: "Est", color: "#247b9a" },
    { key: "south", label: "Sud", short: "Sud", color: "#df7b2f" },
    { key: "west", label: "Ouest", short: "Ouest", color: "#7b6096" },
    { key: "ducos", label: "Presqu’île de Ducos", short: "Ducos", color: "#c54832" }
  ];
  const format0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const format1 = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
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
      .attr("text-decoration", options.decoration || null)
      .text(text);
  }

  function wrap(selection, width, lineHeight = 1.05) {
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
            .attr("dy", `${++lineNumber * lineHeight}em`)
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
      roughness: options.roughness == null ? 1.25 : options.roughness,
      bowing: options.bowing == null ? 0.85 : options.bowing,
      stroke: options.stroke == null ? color : options.stroke,
      strokeWidth: options.strokeWidth == null ? 0.9 : options.strokeWidth,
      seed: roughSeed(options.seed || `${x}-${y}-${width}-${height}-${color}`)
    });
    g.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughCircle(g, rc, cx, cy, diameter, color, options = {}) {
    const node = rc.circle(cx, cy, diameter, {
      fill: options.fill == null ? color : options.fill,
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 2.5 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -38 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.85 : options.fillWeight,
      roughness: options.roughness == null ? 1.5 : options.roughness,
      bowing: options.bowing == null ? 1.05 : options.bowing,
      stroke: options.stroke == null ? color : options.stroke,
      strokeWidth: options.strokeWidth == null ? 0.9 : options.strokeWidth,
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
      roughness: options.roughness == null ? 1.1 : options.roughness,
      bowing: options.bowing == null ? 0.8 : options.bowing,
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      seed: roughSeed(options.seed || pathData.slice(0, 80))
    });
    g.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughLine(g, rc, x1, y1, x2, y2, options = {}) {
    const node = rc.line(x1, y1, x2, y2, {
      stroke: options.stroke || ink,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      roughness: options.roughness == null ? 1.15 : options.roughness,
      bowing: options.bowing == null ? 0.9 : options.bowing,
      seed: roughSeed(options.seed || `${x1}-${y1}-${x2}-${y2}`)
    });
    g.node().appendChild(node);
    const selection = d3.select(node).attr("pointer-events", "none");
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughArrow(g, rc, x1, y1, x2, y2, options = {}) {
    const color = options.stroke || ink;
    roughLine(g, rc, x1, y1, x2, y2, options);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = options.headLength || 9;
    [-0.48, 0.48].forEach((offset, index) => {
      roughLine(
        g, rc, x2, y2,
        x2 - Math.cos(angle + offset) * length,
        y2 - Math.sin(angle + offset) * length,
        { ...options, stroke: color, seed: `${options.seed || "arrow"}-head-${index}` }
      );
    });
  }

  function slug(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function citySectorFor(irisName) {
    const name = slug(irisName);
    const rules = [
      ["ducos", ["logicoop", "ducos", "kamere", "koumourou", "numbo", "tindu"]],
      ["east", ["aerodrome", "magenta", "ouemo", "portes-de-fer", "quatrieme-kilometre"]],
      ["north-east", ["tina", "pk-6", "sixieme-kilometre", "septieme-kilometre", "normandie", "riviere-salee"]],
      ["west", ["centre-ville", "vallee-du-tir", "doniambo", "montagne-coupee", "montravel", "nouville", "quartier-latin", "vallee-du-genie", "artillerie"]],
      ["south", ["anse-vata", "motor-pool", "receiving", "n-gea", "trianon", "orphelinat", "faubourg-blanchot", "vallee-des-colons", "val-plaisance", "baie-des-citrons"]]
    ];
    const match = rules.find(([, fragments]) => fragments.some((fragment) => name.includes(fragment)));
    return citySectors.find((sector) => sector.key === match?.[0]) || {
      key: "other", label: "Autre secteur", short: "Autre", color: muted
    };
  }

  function addSignature(svg, width, height) {
    const signature = svg.selectAll("text.contours-chart-signature")
      .data(["contours.nc"])
      .join("text")
      .attr("class", "contours-chart-signature")
      .attr("x", width - 12)
      .attr("y", height - 11)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-family", "Cabin Sketch, Atkinson Hyperlegible, sans-serif")
      .attr("font-size", 10.5)
      .attr("font-weight", 700)
      .attr("fill", "#777066")
      .attr("paint-order", "stroke")
      .attr("stroke", paper)
      .attr("stroke-width", 2.2)
      .attr("stroke-linejoin", "round")
      .text((value) => value);
    signature.raise();
    return signature;
  }

  function downloadPng(svg, button, filename) {
    if (!svg) return;
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

  function base(root, height, minWidth, configureTools = null) {
    root.innerHTML = "";
    root.tabIndex = 0;
    const tools = document.createElement("div");
    tools.className = "habitat-sketch-tools";
    if (configureTools) configureTools(tools);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "habitat-sketch-download";
    button.textContent = "PNG";
    button.setAttribute("aria-label", "Télécharger la figure en PNG");
    tools.appendChild(button);
    root.appendChild(tools);
    const width = Math.max(minWidth, Math.round(root.clientWidth || minWidth));
    const svg = d3.select(root).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", root.dataset.sketchChart || "Visualisation")
      .style("background", paper);
    window.requestAnimationFrame(() => addSignature(svg, width, height));
    button.addEventListener("click", () => downloadPng(svg.node(), button, `${slug(root.id)}-contours-nc.png`));
    return { root, svg, rc: rough.svg(svg.node()), width, height };
  }

  function tooltipFor(root) {
    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip access-map-tooltip";
    root.appendChild(tooltip);
    return {
      show(event, html) {
        tooltip.innerHTML = html;
        const bounds = root.getBoundingClientRect();
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
      },
      hide() { tooltip.style.opacity = 0; }
    };
  }

  function drawDistribution(root, cells) {
    const chart = base(root, 500, 900);
    const { svg, rc, width } = chart;
    const fields = [
      { key: "bureaux_complets", label: "37 lieux habituels", color: green },
      { key: "centres_8", label: "8 lieux", color: orange },
      { key: "centres_9", label: "9 lieux", color: red }
    ];
    label(svg, "La distribution entière se décale", 24, 30, {
      family: "Cabin Sketch, sans-serif", size: 25, weight: 700
    });
    label(svg, "Part de la population par tranche de 5 minutes de marche", 24, 61, {
      size: 12.5, weight: 750, color: muted
    });

    const outerLeft = 46;
    const outerRight = 22;
    const gap = 24;
    const panelWidth = (width - outerLeft - outerRight - gap * 2) / 3;
    const plotTop = 115;
    const plotBottom = 435;
    const thresholds = d3.range(0, 101, 5);
    const bin = d3.bin().domain([0, 100]).thresholds(thresholds);
    const series = fields.map((field) => {
      const bins = bin(cells.map((d) => ({ value: Math.min(99.999, d[field.key]), pop: d.pop })).map((d) => d.value));
      const total = d3.sum(cells, (d) => d.pop);
      bins.forEach((bucket) => {
        bucket.share = 100 * d3.sum(cells.filter((d) => {
          const value = Math.min(99.999, d[field.key]);
          return value >= bucket.x0 && value < bucket.x1;
        }), (d) => d.pop) / total;
      });
      return { ...field, bins };
    });
    const maxShare = d3.max(series, (s) => d3.max(s.bins, (d) => d.share));
    const yMax = Math.max(10, Math.ceil(maxShare / 5) * 5);

    series.forEach((seriesItem, panelIndex) => {
      const x0 = outerLeft + panelIndex * (panelWidth + gap);
      const x = d3.scaleLinear().domain([0, 100]).range([x0, x0 + panelWidth]);
      const y = d3.scaleLinear().domain([0, yMax]).range([plotBottom, plotTop]);
      label(svg, seriesItem.label, x0, 91, {
        family: "Cabin Sketch, sans-serif", size: 17, weight: 700, color: seriesItem.color
      });
      d3.range(0, yMax + 0.1, 5).forEach((tick) => {
        roughLine(svg, rc, x0, y(tick), x0 + panelWidth, y(tick), {
          stroke: grid, strokeWidth: 0.55, opacity: 0.72, seed: `dist-grid-${panelIndex}-${tick}`
        });
        if (panelIndex === 0) label(svg, `${tick} %`, x0 - 8, y(tick), {
          anchor: "end", size: 10, color: muted
        });
      });
      seriesItem.bins.forEach((bucket, index) => {
        const barX = x(bucket.x0) + 1;
        const barW = Math.max(1, x(bucket.x1) - x(bucket.x0) - 2);
        const barY = y(bucket.share);
        roughRect(svg, rc, barX, barY, barW, plotBottom - barY, seriesItem.color, {
          fill: seriesItem.color,
          fillStyle: "hachure",
          hachureAngle: -42 + (index % 5),
          hachureGap: 2.2,
          fillWeight: 0.95,
          stroke: seriesItem.color,
          strokeWidth: 0.6,
          roughness: 1.1,
          opacity: 0.96,
          seed: `dist-${seriesItem.key}-${index}`
        });
      });
      roughLine(svg, rc, x0, plotBottom, x0 + panelWidth, plotBottom, {
        stroke: ink, strokeWidth: 0.9, seed: `dist-axis-${panelIndex}`
      });
      [0, 30, 60, 90].forEach((tick) => {
        roughLine(svg, rc, x(tick), plotBottom, x(tick), plotBottom + 5, {
          stroke: ink, strokeWidth: 0.75, seed: `dist-tick-${panelIndex}-${tick}`
        });
        label(svg, `${tick} min`, x(tick), plotBottom + 17, { anchor: "middle", size: 10.5, color: muted });
      });
    });
    label(svg, "Les valeurs supérieures à 100 minutes seraient regroupées dans la dernière classe.", width - 22, 478, {
      anchor: "end", size: 10.5, color: muted
    });
  }

  function drawScatter(root, rows) {
    const chart = base(root, 620, 900);
    const { svg, rc, width } = chart;
    const margin = { top: 104, right: 42, bottom: 82, left: 78 };
    const x = d3.scaleLinear()
      .domain([0, Math.ceil(d3.max(rows, (d) => d.percent_menages_sans_vehicules) / 10) * 10])
      .nice()
      .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear()
      .domain([Math.min(-5, d3.min(rows, (d) => d.mean_delta_9_vs_full)), d3.max(rows, (d) => d.mean_delta_9_vs_full) + 3])
      .nice()
      .range([620 - margin.bottom, margin.top]);
    const radius = d3.scaleSqrt()
      .domain(d3.extent(rows, (d) => d.menages_sans_vehicules))
      .range([5, 17]);
    const color = d3.scaleThreshold().domain([20, 35, 50]).range([green, yellow, orange, red]);
    const tip = tooltipFor(root);

    label(svg, "Quand l’éloignement rencontre la faible motorisation", 24, 30, {
      family: "Cabin Sketch, sans-serif", size: 24, weight: 700
    });
    label(svg, "Chaque cercle est un IRIS · taille : nombre estimé de ménages sans véhicule", 24, 62, {
      size: 12.5, weight: 750, color: muted
    });

    x.ticks(7).forEach((tick) => {
      roughLine(svg, rc, x(tick), margin.top, x(tick), 620 - margin.bottom, {
        stroke: grid, strokeWidth: 0.55, opacity: 0.65, seed: `scatter-x-${tick}`
      });
      label(svg, `${format0.format(tick)} %`, x(tick), 620 - margin.bottom + 18, {
        anchor: "middle", size: 10.5, color: muted
      });
    });
    y.ticks(7).forEach((tick) => {
      roughLine(svg, rc, margin.left, y(tick), width - margin.right, y(tick), {
        stroke: tick === 0 ? ink : grid,
        strokeWidth: tick === 0 ? 1 : 0.55,
        opacity: tick === 0 ? 0.75 : 0.65,
        seed: `scatter-y-${tick}`
      });
      label(svg, `${tick > 0 ? "+" : ""}${format0.format(tick)} min`, margin.left - 10, y(tick), {
        anchor: "end", size: 10.5, color: muted
      });
    });
    label(svg, "Ménages sans véhicule", (margin.left + width - margin.right) / 2, 592, {
      anchor: "middle", size: 12, weight: 800, color: muted
    });
    const yTitle = label(svg, "Hausse moyenne avec 9 lieux", 20, (margin.top + 620 - margin.bottom) / 2, {
      anchor: "middle", size: 12, weight: 800, color: muted
    });
    yTitle.attr("transform", `rotate(-90,20,${(margin.top + 620 - margin.bottom) / 2})`);

    const topLabels = new Set([...rows].sort((a, b) => b.indice_cumul - a.indice_cumul).slice(0, 7).map((d) => d.codgeo));
    rows.forEach((d) => {
      const cx = x(d.percent_menages_sans_vehicules);
      const cy = y(d.mean_delta_9_vs_full);
      const r = radius(d.menages_sans_vehicules);
      roughCircle(svg, rc, cx, cy, r * 2, color(d.percent_menages_sans_vehicules), {
        fillStyle: "hachure",
        hachureGap: 2.2,
        fillWeight: 0.9,
        stroke: ink,
        strokeWidth: 0.65,
        opacity: 0.9,
        seed: `scatter-${d.codgeo}`
      });
      svg.append("circle")
        .attr("cx", cx).attr("cy", cy).attr("r", Math.max(8, r))
        .attr("fill", "transparent").attr("tabindex", 0)
        .on("pointerenter pointermove", (event) => tip.show(event,
          `<strong>${d.libgeo}</strong><br><span>Sans véhicule : ${format1.format(d.percent_menages_sans_vehicules)} %</span><br>` +
          `<span>Hausse moyenne : ${d.mean_delta_9_vs_full > 0 ? "+" : ""}${format1.format(d.mean_delta_9_vs_full)} min</span><br>` +
          `<span>${format0.format(d.menages_sans_vehicules)} ménages sans véhicule</span>`))
        .on("pointerleave blur", tip.hide);
      if (topLabels.has(d.codgeo)) {
        const anchor = cx > width * 0.72 ? "end" : "start";
        label(svg, d.libgeo, cx + (anchor === "end" ? -r - 4 : r + 4), cy - r - 2, {
          anchor, size: 10.5, weight: 800, color: ink
        }).call(wrap, 125, 1);
      }
    });
  }

  function drawAbstentionPair(root, boundary, routes, secteurs, stats) {
    const panels = [
      {
        key: "municipal",
        title: "Municipales 2026",
        subtitle: "8 lieux · premier tour",
        field: "abstention_municipales",
        enrolled: "inscrits_municipales",
        thresholds: [40, 45, 50, 55, 60],
        labels: ["< 40", "40–45", "45–50", "50–55", "55–60", "≥ 60"]
      },
      {
        key: "provincial",
        title: "Provinciales 2026",
        subtitle: "9 lieux · scrutin du 28 juin",
        field: "abstention_provinciales",
        enrolled: "inscrits_provinciales",
        thresholds: [20, 25, 30, 35, 40],
        labels: ["< 20", "20–25", "25–30", "30–35", "35–40", "≥ 40"]
      }
    ];
    const palette = ["#91c4a1", "#55a17f", "#c8b94f", "#e2a13a", "#dc6c35", "#aa3036"];
    const { svg, rc, width, height } = base(root, 720, 1120);
    const tip = tooltipFor(root);
    const margin = 24;
    const gap = 38;
    const panelWidth = (width - margin * 2 - gap) / 2;
    const panelTop = 106;
    const panelBottom = 548;

    label(svg, "Taux d’abstention par secteur électoral", 24, 31, {
      family: "Cabin Sketch, sans-serif", size: 27, weight: 700
    });
    label(svg, "Part des inscrits n’ayant pas voté · une légende propre à chaque scrutin", 24, 65, {
      size: 12.8, weight: 760, color: muted
    });

    panels.forEach((panel, panelIndex) => {
      const panelX = margin + panelIndex * (panelWidth + gap);
      const extent = [[panelX + 8, panelTop], [panelX + panelWidth - 8, panelBottom]];
      const projection = d3.geoIdentity().reflectY(true).fitExtent(extent, boundary);
      const path = d3.geoPath(projection);
      const scale = d3.scaleThreshold().domain(panel.thresholds).range(palette);
      const clipId = `abstention-pair-${root.id || "map"}-${panel.key}`;
      const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
      defs.append("clipPath").attr("id", clipId)
        .append("path").attr("d", path(boundary));

      label(svg, panel.title, panelX + 8, 88, {
        family: "Cabin Sketch, sans-serif", size: 20, weight: 700,
        color: panelIndex ? red : green
      });
      const cityRow = stats.find((row) => panel.key === "municipal"
        ? row.scrutin.startsWith("Municipales")
        : row.scrutin.startsWith("Provinciales"));
      label(svg, `${panel.subtitle} · ${format1.format(cityRow.abstention)} % à Nouméa`,
        panelX + panelWidth - 8, 88, {
          anchor: "end", size: 11.2, weight: 760, color: muted
        });

      svg.append("path").attr("d", path(boundary))
        .attr("fill", "#f3eee3").attr("stroke", "none");
      const areas = svg.append("g").attr("clip-path", `url(#${clipId})`);
      secteurs.features.forEach((feature, index) => {
        const color = scale(Number(feature.properties[panel.field]));
        const pathData = path(feature);
        areas.append("path")
          .attr("d", pathData)
          .attr("fill", color)
          .attr("fill-opacity", 0.34)
          .attr("stroke", "none");
        roughPath(areas, rc, pathData, {
          fill: color, fillStyle: "hachure",
          hachureAngle: -44 + (index % 9),
          hachureGap: 2.65, fillWeight: 0.7,
          stroke: color, strokeWidth: 0.16,
          roughness: 1.75, bowing: 1.25, opacity: 0.96,
          seed: `abstention-pair-${panel.key}-${feature.properties.code_bv}`
        });
      });
      roughPath(svg.append("g").attr("clip-path", `url(#${clipId})`), rc, path(routes), {
        fill: "none", stroke: "#777067", strokeWidth: 0.34,
        roughness: 1.4, opacity: 0.18, seed: `abstention-routes-${panel.key}`
      });
      roughPath(svg, rc, path(boundary), {
        fill: "none", stroke: "#2f2a26", strokeWidth: 1.15,
        roughness: 2.2, bowing: 1.65, opacity: 0.9,
        seed: `abstention-outline-${panel.key}`
      });

      svg.append("g").selectAll("path")
        .data(secteurs.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "transparent")
        .attr("stroke", "transparent")
        .attr("stroke-width", 2.2)
        .attr("vector-effect", "non-scaling-stroke")
        .attr("tabindex", 0)
        .on("pointerenter pointermove", function(event, feature) {
          d3.select(this).attr("stroke", blue);
          const p = feature.properties;
          const atypical = p.code_bv === "0057"
            ? "<br><em>Mairie 3 : bureau dérogatoire, très peu d’inscrits</em>"
            : "";
          tip.show(event,
            `<strong>BV ${p.code_bv} · ${p.bureau_nom_habituel}</strong><br>` +
            `<span>Abstention : ${format1.format(p[panel.field])} %</span><br>` +
            `<span>Participation : ${format1.format(100 - p[panel.field])} %</span><br>` +
            `<span>${format0.format(p[panel.enrolled])} inscrits</span>${atypical}`);
        })
        .on("pointerleave blur", function() {
          d3.select(this).attr("stroke", "transparent");
          tip.hide();
        });

      label(svg, "ABSTENTION · % DES INSCRITS", panelX + 8, 578, {
        size: 10.2, weight: 900, color: ink
      });
      const itemWidth = (panelWidth - 16) / panel.labels.length;
      panel.labels.forEach((legendLabel, index) => {
        const x = panelX + 8 + index * itemWidth;
        svg.append("rect")
          .attr("x", x).attr("y", 594).attr("width", 25).attr("height", 15)
          .attr("fill", palette[index]).attr("fill-opacity", 0.34);
        roughRect(svg, rc, x, 594, 25, 15, palette[index], {
          fill: palette[index], fillStyle: "hachure",
          hachureAngle: -44 + (index % 9), hachureGap: 2.65, fillWeight: 0.7,
          stroke: palette[index], strokeWidth: 0.16,
          roughness: 1.75, bowing: 1.25, opacity: 0.96,
          seed: `abstention-pair-legend-${panel.key}-${index}`
        });
        label(svg, legendLabel, x + 31, 602, {
          size: 9.3, weight: 760, color: muted
        });
      });
    });

    label(svg,
      "Lecture : du vert pour les taux les plus faibles au rouge pour les plus élevés, dans chaque scrutin.",
      width / 2, height - 27, { anchor: "middle", size: 11.2, weight: 760, color: blue }
    );
  }

  function drawContextMap(root, boundary, routes, iris, secteurs, stats) {
    const modes = {
      municipal: {
        label: "Abstention · municipales 2026",
        title: "Abstention aux municipales 2026",
        field: "abstention_municipales",
        enrolled: "inscrits_municipales",
        type: "sectors",
        thresholds: [25, 35, 45, 55, 65],
        labels: ["< 25 %", "25–35 %", "35–45 %", "45–55 %", "55–65 %", "≥ 65 %"]
      },
      provincial: {
        label: "Abstention · provinciales 2026",
        title: "Abstention aux provinciales 2026",
        field: "abstention_provinciales",
        enrolled: "inscrits_provinciales",
        type: "sectors",
        thresholds: [20, 30, 40, 50, 60],
        labels: ["< 20 %", "20–30 %", "30–40 %", "40–50 %", "50–60 %", "≥ 60 %"]
      },
      vehicles: {
        label: "Ménages sans véhicule",
        title: "Ménages sans véhicule, par IRIS",
        field: "percent_menages_sans_vehicules",
        type: "iris",
        thresholds: [10, 20, 30, 40, 50],
        labels: ["< 10 %", "10–20 %", "20–30 %", "30–40 %", "40–50 %", "≥ 50 %"]
      }
    };
    if (root.dataset.layout === "pair") {
      drawAbstentionPair(root, boundary, routes, secteurs, stats);
      return;
    }
    const allowedKeys = (root.dataset.modes || Object.keys(modes).join(","))
      .split(",")
      .map((key) => key.trim())
      .filter((key) => Object.prototype.hasOwnProperty.call(modes, key));
    const availableModes = Object.fromEntries(allowedKeys.map((key) => [key, modes[key]]));
    const requestedMode = new URLSearchParams(window.location.search).get(root.dataset.query || "contexte");
    const defaultMode = Object.prototype.hasOwnProperty.call(availableModes, root.dataset.default)
      ? root.dataset.default
      : allowedKeys[0];
    let active = Object.prototype.hasOwnProperty.call(availableModes, requestedMode)
      ? requestedMode
      : defaultMode;
    let selector;
    const chart = base(root, 690, 900, (tools) => {
      const control = document.createElement("label");
      control.className = "habitat-map-control-label";
      control.appendChild(document.createTextNode("Carte"));
      selector = document.createElement("select");
      selector.className = "habitat-map-select";
      selector.setAttribute("aria-label", "Indicateur cartographié");
      Object.entries(availableModes).forEach(([key, mode]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = mode.label;
        option.selected = key === active;
        selector.appendChild(option);
      });
      control.appendChild(selector);
      if (allowedKeys.length > 1) tools.appendChild(control);
    });
    const { svg, rc, width } = chart;
    const sideWidth = 230;
    const extent = [[24, 102], [width - sideWidth - 24, 652]];
    const projection = d3.geoIdentity().reflectY(true).fitExtent(extent, boundary);
    const path = d3.geoPath(projection);
    const palette = ["#a9d5aa", "#69b88b", "#328d73", "#e7c83f", "#df742d", "#b73532"];
    const tip = tooltipFor(root);
    const title = label(svg, modes[active].title, 22, 31, {
      family: "Cabin Sketch, sans-serif", size: 25, weight: 700
    });
    const subtitle = label(svg, "Lire les écarts entre secteurs, sans déduire une causalité", 22, 64, {
      size: 12.5, weight: 750, color: muted
    });
    const mapBase = svg.append("g");
    roughPath(mapBase, rc, path(boundary), {
      fill: "#f3eee3", fillStyle: "solid", stroke: ink, strokeWidth: 1.1,
      roughness: 1.7, opacity: 0.9, seed: "context-boundary"
    });
    const clipId = `vote-context-map-clip-${root.id || Math.random().toString(36).slice(2)}`;
    svg.append("defs").append("clipPath")
      .attr("id", clipId)
      .append("path")
      .attr("d", path(boundary));
    const map = svg.append("g")
      .attr("clip-path", `url(#${clipId})`)
      .attr("pointer-events", "none");
    roughPath(map, rc, path(routes), {
      fill: "none", stroke: "#777067", strokeWidth: 0.42,
      roughness: 1.4, opacity: 0.25, seed: "context-routes"
    });
    const layer = svg.append("g").attr("clip-path", `url(#${clipId})`);
    const hitLayer = svg.append("g").attr("clip-path", `url(#${clipId})`);
    const boundaryOutline = svg.append("g").attr("pointer-events", "none");
    roughPath(boundaryOutline, rc, path(boundary), {
      fill: "none", stroke: "#2f2a26", strokeWidth: 1.24,
      roughness: 2.35, bowing: 1.75, opacity: 0.9,
      seed: `context-outline-${root.id || "map"}`
    });
    const hoverOutline = svg.append("g")
      .attr("class", "vote-context-hover-outline")
      .attr("clip-path", `url(#${clipId})`)
      .attr("pointer-events", "none");
    let activeHoverKey = null;

    function drawHoverOutline(feature, key) {
      if (key === activeHoverKey) return;
      activeHoverKey = key;
      hoverOutline.selectAll("*").remove();
      if (!feature) return;
      const pathData = path(feature);
      hoverOutline.append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", paper)
        .attr("stroke-width", 5)
        .attr("stroke-opacity", 0.9)
        .attr("stroke-linejoin", "round")
        .attr("vector-effect", "non-scaling-stroke");
      roughPath(hoverOutline, rc, pathData, {
        fill: "none", stroke: blue, strokeWidth: 2.2,
        roughness: 1.7, bowing: 1.35, opacity: 1,
        seed: `context-hover-${active}-${key}`
      });
    }
    const sideX = width - sideWidth + 6;
    roughRect(svg, rc, sideX - 13, 98, sideWidth - 8, 574, "none", {
      fill: "none", stroke: grid, strokeWidth: 0.65, roughness: 1.6,
      opacity: 0.8, seed: "context-side"
    });
    const side = svg.append("g").attr("transform", `translate(${sideX},118)`);

    function showIrisTip(event, feature) {
      const p = feature.properties;
      tip.show(event, `<strong>${p.libgeo}</strong><br>` +
        `<span>${format1.format(p.percent_menages_sans_vehicules)} % de ménages sans véhicule</span><br>` +
        `<span>${format0.format(p.menages_sans_vehicules)} ménages estimés</span>`);
    }

    function showSectorTip(event, feature, mode) {
      const p = feature.properties;
      tip.show(event, `<strong>BV ${p.code_bv} · ${p.bureau_nom_habituel}</strong><br>` +
        `<span>Abstention : ${format1.format(p[mode.field])} %</span><br>` +
        `<span>Participation : ${format1.format(100 - p[mode.field])} %</span><br>` +
        `<span>${format0.format(p[mode.enrolled])} inscrits</span>`);
    }

    function redraw() {
      const mode = availableModes[active];
      const scale = d3.scaleThreshold().domain(mode.thresholds).range(palette);
      tip.hide();
      drawHoverOutline(null, null);
      layer.interrupt().style("opacity", 0.18);
      side.interrupt().style("opacity", 0.18);
      layer.selectAll("*").remove();
      hitLayer.selectAll("*").remove();
      side.selectAll("*").remove();
      title.text(mode.title);
      subtitle.text(mode.type === "iris"
        ? "RGP 2019 · part des ménages, par IRIS"
        : "Résultats par secteur électoral officiel de la Ville de Nouméa");

      const features = mode.type === "iris" ? iris.features : secteurs.features;
      features.forEach((feature, index) => {
        const color = scale(feature.properties[mode.field]);
        const key = mode.type === "iris" ? feature.properties.codgeo : feature.properties.code_bv;
        const pathData = path(feature);
        layer.append("path")
          .attr("d", pathData)
          .attr("fill", color)
          .attr("fill-opacity", 0.34)
          .attr("stroke", "none");
        roughPath(layer, rc, pathData, {
          fill: color, fillStyle: "hachure", hachureAngle: -44 + (index % 9),
          hachureGap: 2.65, fillWeight: 0.7, stroke: color, strokeWidth: 0.16,
          roughness: 1.75, bowing: 1.25, opacity: 0.96, seed: `context-area-${active}-${key}`
        });
      });
      hitLayer.selectAll("path").data(features).join("path")
        .attr("d", path).attr("fill", "transparent").attr("tabindex", 0)
        .on("pointerenter pointermove", (event, feature) => {
          const key = mode.type === "iris" ? feature.properties.codgeo : feature.properties.code_bv;
          drawHoverOutline(feature, key);
          if (mode.type === "iris") showIrisTip(event, feature);
          else showSectorTip(event, feature, mode);
        })
        .on("pointerleave blur", () => {
          drawHoverOutline(null, null);
          tip.hide();
        });
      map.raise();
      boundaryOutline.raise();
      hoverOutline.raise();
      hitLayer.raise();

      label(side, "LÉGENDE", 0, 0, { size: 10.5, weight: 900, color: ink });
      mode.labels.forEach((text, index) => {
        const y = 25 + index * 36;
        side.append("rect")
          .attr("x", 0).attr("y", y - 9).attr("width", 28).attr("height", 18)
          .attr("fill", palette[index]).attr("fill-opacity", 0.34);
        roughRect(side, rc, 0, y - 9, 28, 18, palette[index], {
          fill: palette[index], fillStyle: "hachure", hachureGap: 2.65,
          hachureAngle: -44 + (index % 9), fillWeight: 0.7, stroke: palette[index],
          strokeWidth: 0.16, roughness: 1.75, bowing: 1.25, opacity: 0.96,
          seed: `context-legend-area-${active}-${index}`
        });
        label(side, text, 38, y, { size: 10.8, weight: 760, color: muted });
      });

      const statY = 269;
      if (mode.type === "iris") {
        const households = d3.sum(iris.features, (d) => d.properties.nb_de_menages);
        const without = d3.sum(iris.features, (d) => d.properties.menages_sans_vehicules);
        label(side, `${format1.format(100 * without / households)} %`, 0, statY, {
          family: "Cabin Sketch, sans-serif", size: 31, weight: 700, color: green
        });
        label(side, "des ménages à Nouméa", 0, statY + 31, { size: 11.5, weight: 820, color: ink });
        label(side, "sans véhicule (RGP 2019)", 0, statY + 49, { size: 11.5, weight: 820, color: ink });
      } else {
        const row = stats.find((d) => mode.field === "abstention_municipales"
          ? d.scrutin.startsWith("Municipales")
          : d.scrutin.startsWith("Provinciales"));
        label(side, `${format1.format(row.abstention)} %`, 0, statY, {
          family: "Cabin Sketch, sans-serif", size: 31, weight: 700, color: red
        });
        label(side, "d’abstention à Nouméa", 0, statY + 31, { size: 11.5, weight: 820, color: ink });
        label(side, `${format0.format(row.inscrits)} inscrits`, 0, statY + 50, { size: 11, weight: 720, color: muted });
      }
      const note = label(side,
        mode.type === "iris"
          ? "Une couleur décrit un IRIS."
          : "Une couleur décrit le secteur d’affectation d’un bureau de vote.",
        0, 374, { size: 10.8, weight: 650, color: muted }
      );
      note.call(wrap, sideWidth - 31, 1.08);
      layer.transition().duration(260).style("opacity", 1);
      side.transition().duration(260).style("opacity", 1);
    }

    if (selector) {
      selector.addEventListener("change", () => {
        active = selector.value;
        const url = new URL(window.location.href);
        url.searchParams.set(root.dataset.query || "contexte", active);
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        redraw();
      });
    }
    redraw();
  }

  function drawAbstentionDots(root, rows) {
    const modes = {
      municipal: {
        title: "Municipales 2026", subtitle: "8 lieux regroupés",
        field: "abstention_municipales", enrolled: "inscrits_municipales",
        voters: "votants_municipales", abstentions: "abstentions_municipales",
        name: "bureau_nom_resultats_municipales", color: orange
      },
      provincial: {
        title: "Provinciales 2026", subtitle: "9 lieux regroupés",
        field: "abstention_provinciales", enrolled: "inscrits_provinciales",
        voters: "votants_provinciales", abstentions: "abstentions_provinciales",
        name: "bureau_nom_provinciales", color: blue
      }
    };
    const requested = new URLSearchParams(window.location.search).get("abstention");
    const defaultMode = Object.prototype.hasOwnProperty.call(modes, root.dataset.default)
      ? root.dataset.default
      : "provincial";
    let active = Object.prototype.hasOwnProperty.call(modes, requested) ? requested : defaultMode;
    let selectedCode = "";
    let modeSelect;
    let bureauSelect;
    const compact = (root.clientWidth || window.innerWidth) < 560;
    const chart = base(root, compact ? 475 : 455, 360, (tools) => {
      function addControl(text, ariaLabel) {
        const control = document.createElement("label");
        control.className = "habitat-map-control-label";
        control.append(`${text} `);
        const select = document.createElement("select");
        select.className = "habitat-map-select";
        select.setAttribute("aria-label", ariaLabel);
        control.appendChild(select);
        tools.appendChild(control);
        return select;
      }
      modeSelect = addControl("Scrutin", "Choisir le scrutin");
      Object.entries(modes).forEach(([key, mode]) => {
        modeSelect.appendChild(new Option(mode.title, key));
      });
      modeSelect.value = active;
      bureauSelect = addControl("Repérer", "Repérer un bureau de vote");
    });
    const { svg, rc, width, height } = chart;
    const tip = tooltipFor(root);
    function number(row) {
      return String(Number(row.code_bv)).padStart(2, "0");
    }

    function shortName(value) {
      return String(value || "")
        .replace(/^École\s+/i, "")
        .replace(/^Ecole\s+/i, "")
        .replace(/\s+-\s+Bureau Dérogatoire$/i, " · dérogatoire");
    }

    function placeDots(data, x, centerY) {
      const placed = [];
      const step = compact ? 12 : 13;
      const minimum = compact ? 11.5 : 12.5;
      const offsets = [0];
      for (let level = 1; level <= 11; level += 1) offsets.push(-level * step, level * step);
      data.slice().sort((a, b) => a.value - b.value).forEach((row) => {
        row.px = x(row.value);
        row.py = centerY;
        for (const offset of offsets) {
          const candidate = centerY + offset;
          const collision = placed.some((other) =>
            Math.hypot(other.px - row.px, other.py - candidate) < minimum
          );
          if (!collision) {
            row.py = candidate;
            break;
          }
        }
        placed.push(row);
      });
      return data;
    }

    function render() {
      svg.selectAll("*").remove();
      const mode = modes[active];
      const allData = rows
        .map((row) => ({
          ...row,
          value: Number(row[mode.field]),
          citySector: citySectorFor(row.iris_libgeo)
        }))
        .filter((row) => Number.isFinite(row.value));
      const data = allData.filter((row) => row.code_bv !== "0057");
      const extent = d3.extent(data, (row) => row.value);
      const cityRate = 100 * d3.sum(allData, (row) => Number(row[mode.abstentions])) /
        d3.sum(allData, (row) => Number(row[mode.enrolled]));
      const left = compact ? 38 : 54;
      const right = compact ? 18 : 30;
      const plotTop = compact ? 178 : 164;
      const plotBottom = compact ? 337 : 323;
      const domainMin = Math.max(0, Math.floor((extent[0] - 5) / 10) * 10);
      const domainMax = Math.min(100, Math.ceil((extent[1] + 5) / 10) * 10);
      const x = d3.scaleLinear().domain([domainMin, domainMax]).range([left, width - right]);

      bureauSelect.replaceChildren(new Option("Choisir un bureau…", ""));
      data.slice().sort((a, b) => Number(a.code_bv) - Number(b.code_bv)).forEach((row) => {
        bureauSelect.appendChild(new Option(
          `${number(row)} · ${shortName(row[mode.name] || row.bureau_nom_habituel)}`,
          row.code_bv
        ));
      });
      bureauSelect.value = selectedCode;

      label(svg, compact ? "Abstention par bureau" : "Taux d’abstention par bureau de vote", 22, 29, {
        family: "Cabin Sketch, sans-serif", size: compact ? 20 : 25, weight: 700
      });
      label(svg, compact ? "Position = abstention · couleur = secteur" : "Un point = un bureau · position = taux d’abstention · couleur = secteur de la ville", 22, compact ? 60 : 61, {
        size: compact ? 10.3 : 12, weight: 740, color: muted
      });
      label(svg, mode.title, 22, compact ? 94 : 91, {
        family: "Cabin Sketch, sans-serif", size: compact ? 17 : 20,
        weight: 700, color: mode.color
      });
      label(svg,
        `${mode.subtitle} · hors Mairie 3 : ${format1.format(extent[0])} à ${format1.format(extent[1])} %`,
        22, compact ? 119 : 116,
        { size: compact ? 9.5 : 11, weight: 760, color: muted }
      );
      label(svg, "PLUS DE PARTICIPATION", left, plotTop - 21, {
        size: compact ? 8.1 : 9.2, weight: 900, color: green
      });
      label(svg, "PLUS D’ABSTENTION", width - right, plotTop - 21, {
        anchor: "end", size: compact ? 8.1 : 9.2, weight: 900, color: red
      });

      const ticks = d3.range(domainMin, domainMax + 0.1, 10);
      ticks.forEach((tick) => {
        roughLine(svg, rc, x(tick), plotTop, x(tick), plotBottom, {
          stroke: grid, strokeWidth: tick % 20 === 0 ? 0.75 : 0.45,
          roughness: 0.8, opacity: tick % 20 === 0 ? 0.75 : 0.45,
          seed: `abstention-dot-grid-${active}-${tick}`
        });
        label(svg, `${tick} %`, x(tick), plotBottom + 19, {
          anchor: "middle", size: compact ? 8.1 : 9, weight: 720, color: muted
        });
      });
      label(svg, "TAUX D’ABSTENTION · % DES INSCRITS", width / 2, plotBottom + 33, {
        anchor: "middle", size: compact ? 8.8 : 10, weight: 900, color: ink
      });
      roughLine(svg, rc, x(cityRate), plotTop - 3, x(cityRate), plotBottom + 3, {
        stroke: ink, strokeWidth: 1.5, roughness: 1.45, opacity: 0.86,
        seed: `abstention-dot-average-${active}`
      });
      label(svg, `moyenne · ${format1.format(cityRate)} %`, x(cityRate) + 5, plotTop - 7, {
        size: compact ? 8.1 : 9.1, weight: 850, color: ink
      });

      const nodes = placeDots(data, x, (plotTop + plotBottom) / 2);
      nodes.forEach((row) => {
        const color = row.citySector.color;
        roughCircle(svg, rc, row.px, row.py, 9.5, color, {
          fill: color, fillStyle: "solid", stroke: color,
          strokeWidth: 1.1, roughness: 1.5,
          seed: `abstention-dot-${active}-${row.code_bv}`
        });
      });

      const legendWidths = [61, 41, 42, 49, 52];
      const legendWidth = 60 + d3.sum(legendWidths);
      const legendY = plotBottom + 53;
      let legendX = Math.max(20, (width - legendWidth) / 2);
      label(svg, "SECTEUR", legendX, legendY, {
        size: compact ? 8.7 : 9, weight: 900, color: muted
      });
      legendX += 60;
      citySectors.forEach((sector, index) => {
        roughCircle(svg, rc, legendX + 4, legendY, 7.5, sector.color, {
          fill: sector.color, fillStyle: "solid", stroke: sector.color,
          strokeWidth: 0.8, roughness: 1.3,
          seed: `abstention-sector-legend-${sector.key}`
        });
        label(svg, sector.short, legendX + 11, legendY, {
          size: compact ? 9.2 : 9.4, weight: 780, color: muted
        });
        legendX += legendWidths[index];
      });

      const focusLayer = svg.append("g").attr("pointer-events", "none");
      const statusMain = label(svg, "Survolez un point ou utilisez le menu « Repérer ».", 22, height - 27, {
        size: compact ? 9.4 : 10.8, weight: 780, color: blue
      });
      const statusPlace = label(svg, "", 22, height - 13, {
        size: compact ? 8.8 : 9.8, weight: 720, color: muted
      });

      function focus(row, event = null) {
        focusLayer.selectAll("*").remove();
        if (!row) {
          statusMain.text("Survolez un point ou utilisez le menu « Repérer ».");
          statusPlace.text("");
          return;
        }
        const color = row.citySector.color;
        roughCircle(focusLayer, rc, row.px, row.py, 18, color, {
          fill: "none", stroke: ink, strokeWidth: 1.5,
          roughness: 1.8, seed: `abstention-focus-${active}-${row.code_bv}`
        });
        statusMain.text(
          `Bureau ${number(row)} · ${shortName(row[mode.name] || row.bureau_nom_habituel)} · ` +
          `${format1.format(row.value)} % d’abstention`
        );
        statusPlace.text(`IRIS · ${row.iris_libgeo}`);
        if (event) tip.show(event,
          `<strong>Bureau ${number(row)} · ${row[mode.name] || row.bureau_nom_habituel}</strong><br>` +
          `<span>IRIS · ${row.iris_libgeo}</span><br>` +
          `<span>Secteur de la ville · ${row.citySector.label}</span><br>` +
          `<span>Abstention : ${format1.format(row.value)} %</span><br>` +
          `<span>Participation : ${format1.format(100 - row.value)} %</span><br>` +
          `<span>${format0.format(Number(row[mode.enrolled]))} inscrits · ${format0.format(Number(row[mode.voters]))} votants</span>`
        );
      }

      svg.append("g").selectAll("circle")
        .data(nodes).join("circle")
        .attr("cx", (row) => row.px).attr("cy", (row) => row.py)
        .attr("r", compact ? 13 : 14).attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("mouseenter", (event, row) => focus(row, event))
        .on("mousemove", (event, row) => focus(row, event))
        .on("mouseleave", () => {
          tip.hide();
          focus(nodes.find((row) => row.code_bv === selectedCode));
        })
        .on("click", (_, row) => {
          selectedCode = row.code_bv;
          bureauSelect.value = selectedCode;
          focus(row);
        });

      label(svg, "Mairie 3 n’est pas affiché : bureau dérogatoire, trois votants.", 22, height - 49, {
        size: compact ? 8.1 : 9.5, weight: 700, color: muted
      });
      focus(nodes.find((row) => row.code_bv === selectedCode));
      addSignature(svg, width, height);
    }

    modeSelect.addEventListener("change", () => {
      active = modeSelect.value;
      selectedCode = "";
      const url = new URL(window.location.href);
      url.searchParams.set("abstention", active);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      render();
    });
    bureauSelect.addEventListener("change", () => {
      selectedCode = bureauSelect.value;
      render();
    });
    render();
  }

  function drawMethod(root) {
    const chart = base(root, 285, 820);
    const { svg, rc, width } = chart;
    label(svg, "Le calcul en trois étapes", 24, 30, {
      family: "Cabin Sketch, sans-serif", size: 25, weight: 700
    });
    label(svg, "Le même principe est appliqué aux trois configurations", 24, 62, {
      size: 12.5, weight: 750, color: muted
    });

    const gap = 64;
    const nodeWidth = (width - 56 - gap * 2) / 3;
    const column = [28, 28 + nodeWidth + gap, 28 + (nodeWidth + gap) * 2];
    const nodes = [
      { id: "population", x: column[0], y: 103, h: 92, title: "1 · Localiser les habitants", note: "grille SPC · maille de 100 m", color: green },
      { id: "routes", x: column[1], y: 103, h: 92, title: "2 · Suivre les rues", note: "trajet le plus court à pied", color: orange },
      { id: "result", x: column[2], y: 103, h: 92, title: "3 · Comparer", note: "maillage habituel, 8 ou 9 lieux", color: red }
    ];
    const byId = new Map(nodes.map((d) => [d.id, d]));

    function right(id) {
      const d = byId.get(id);
      return [d.x + nodeWidth, d.y + d.h / 2];
    }
    function left(id) {
      const d = byId.get(id);
      return [d.x, d.y + d.h / 2];
    }
    function arrow(from, to) {
      const a = right(from);
      const b = left(to);
      roughArrow(svg, rc, a[0] + 4, a[1], b[0] - 7, b[1], {
        stroke: ink, strokeWidth: 1.05, roughness: 1.65,
        seed: `method-${from}-${to}`
      });
    }

    arrow("population", "routes");
    arrow("routes", "result");

    nodes.forEach((d, index) => {
      roughRect(svg, rc, d.x, d.y, nodeWidth, d.h, d.color, {
        fill: d.color,
        fillStyle: "hachure",
        hachureAngle: -43 + (index % 8),
        hachureGap: 5,
        fillWeight: 0.48,
        stroke: d.color,
        strokeWidth: 1,
        roughness: 1.55,
        opacity: 0.58,
        seed: `method-node-${d.id}`
      });
      label(svg, d.title, d.x + 13, d.y + d.h / 2 - 13, {
        family: "Cabin Sketch, sans-serif", size: 15, weight: 700, color: ink
      }).call(wrap, nodeWidth - 22, 1);
      label(svg, d.note, d.x + 13, d.y + d.h / 2 + 20, {
        size: 10.8, weight: 760, color: muted
      }).call(wrap, nodeWidth - 22, 1);
    });
    label(svg, "Hypothèse commune : marche à 5 km/h vers le bureau de vote le plus proche.", width - 25, 254, {
      anchor: "end", size: 11, weight: 760, color: muted
    });
  }

  function showError(root, error) {
    root.innerHTML = `<p class="access-map-error">La visualisation n’a pas pu être chargée (${error.message}).</p>`;
  }

  const distribution = document.querySelector("[data-vote-distribution-v2]");
  if (distribution) {
    d3.csv(distribution.dataset.cells, d3.autoType)
      .then((rows) => drawDistribution(distribution, rows))
      .catch((error) => showError(distribution, error));
  }

  document.querySelectorAll("[data-vote-context-map-v2]").forEach((contextMap) => {
    Promise.all([
      d3.json(contextMap.dataset.boundary),
      d3.json(contextMap.dataset.routes),
      d3.json(contextMap.dataset.iris),
      d3.json(contextMap.dataset.secteurs),
      d3.csv(contextMap.dataset.stats, d3.autoType)
    ]).then((payload) => drawContextMap(contextMap, ...payload))
      .catch((error) => showError(contextMap, error));
  });

  const abstentionSpread = document.querySelector("[data-vote-abstention-spread-v2]");
  if (abstentionSpread) {
    d3.csv(abstentionSpread.dataset.rows, (row) => {
      const parsed = d3.autoType({ ...row });
      parsed.code_bv = String(row.code_bv || "").padStart(4, "0");
      return parsed;
    })
      .then((rows) => drawAbstentionDots(abstentionSpread, rows))
      .catch((error) => showError(abstentionSpread, error));
  }

  const method = document.querySelector("[data-vote-method-v2]");
  if (method) drawMethod(method);

})();
