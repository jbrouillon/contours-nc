import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";

const DATA = {
  climate: "../../data/pacific-climate-fingerprints/processed/climate_obs.csv",
  eez: "../../assets/data/pacific-climate-fingerprints/eez.geojson",
  land: "https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json"
};

const YEAR_DOMAIN = [1850, 2025];
const YEAR_TICKS = [1850, 2000, 2025];

const countryToCode = new Map([
  ["American Samoa", "AS"],
  ["Cook Islands", "CK"],
  ["Fiji", "FJ"],
  ["Guam", "GU"],
  ["Kiribati", "KI"],
  ["Marshall Islands", "MH"],
  ["Micronesia", "FM"],
  ["Nauru", "NR"],
  ["New Caledonia", "NC"],
  ["Niue", "NU"],
  ["Northern Mariana Islands", "MP"],
  ["Palau", "PW"],
  ["Papua New Guinea", "PG"],
  ["Polynesie Francaise", "PF"],
  ["Samoa", "WS"],
  ["Solomon Islands", "SB"],
  ["Tokelau", "TK"],
  ["Tonga", "TO"],
  ["Tuvalu", "TV"],
  ["Vanuatu", "VU"],
  ["Wallis et Futuna", "WF"]
]);

const territoryNames = new Map([
  ["AS", "American Samoa"],
  ["CK", "Cook Islands"],
  ["FJ", "Fiji"],
  ["FM", "Micronesia"],
  ["GU", "Guam"],
  ["KI", "Kiribati"],
  ["MH", "Marshall Islands"],
  ["MP", "Northern Mariana Islands"],
  ["NC", "New Caledonia"],
  ["NR", "Nauru"],
  ["NU", "Niue"],
  ["PF", "French Polynesia"],
  ["PG", "Papua New Guinea"],
  ["PN", "Pitcairn Islands"],
  ["PW", "Palau"],
  ["SB", "Solomon Islands"],
  ["TK", "Tokelau"],
  ["TO", "Tonga"],
  ["TV", "Tuvalu"],
  ["VU", "Vanuatu"],
  ["WF", "Wallis and Futuna"],
  ["WS", "Samoa"]
]);

const anchors = {
  AS: [-170.7, -14.3], CK: [-159.8, -21.2], FJ: [178.1, -17.8],
  FM: [158.2, 6.9], GU: [144.8, 13.5], KI: [-157.3, 1.8],
  MH: [171.2, 7.1], MP: [145.7, 15.2], NC: [165.6, -21.5],
  NR: [166.9, -0.5], NU: [-169.9, -19.0], PF: [-149.5, -17.6],
  PG: [145.0, -6.3], PW: [134.5, 7.5], SB: [160.2, -9.6],
  TK: [-171.8, -9.1], TO: [-175.2, -21.2], TV: [179.2, -8.5],
  VU: [167.5, -16.3], WF: [-177.2, -13.3], WS: [-172.1, -13.8]
};

function territoryLabel(code) {
  return `${territoryNames.get(code) ?? code} (${code})`;
}

function curvedCalloutPath(x1, y1, x2, y2, bend = 0.28) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx + (-dy * bend);
  const cy = my + (dx * bend);
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

function smoothSeries(raw, k = 7) {
  return raw.map((d, i) => ({
    ...d,
    smooth: d3.mean(
      raw.slice(
        Math.max(0, i - Math.floor(k / 2)),
        Math.min(raw.length, i + Math.floor(k / 2) + 1)
      ),
      x => x.OBS_VALUE
    )
  }));
}

function temperatureSeries(climate, code) {
  const data = climate.filter(d => d.GEO_PICT === code);
  const sea = data.filter(d => d.signal === "sea");
  const land = data.filter(d => d.signal === "land");

  return d3.rollups(
    [...sea, ...land],
    v => d3.mean(v, d => d.OBS_VALUE),
    d => d.TIME_PERIOD
  )
    .map(([year, value]) => ({ TIME_PERIOD: +year, OBS_VALUE: value }))
    .filter(d => Number.isFinite(d.TIME_PERIOD) && Number.isFinite(d.OBS_VALUE))
    .sort((a, b) => d3.ascending(a.TIME_PERIOD, b.TIME_PERIOD));
}

function rainShiftFor(climate, code) {
  const rows = climate.filter(d => d.GEO_PICT === code && d.signal === "rain");
  const before = rows.filter(d => d.TIME_PERIOD < 2000);
  const after = rows.filter(d => d.TIME_PERIOD >= 2000);

  const wetBefore = d3.mean(before, d => d.OBS_VALUE > 0.5 ? 1 : 0) ?? 0;
  const wetAfter = d3.mean(after, d => d.OBS_VALUE > 0.5 ? 1 : 0) ?? 0;
  const dryBefore = d3.mean(before, d => d.OBS_VALUE < -0.5 ? 1 : 0) ?? 0;
  const dryAfter = d3.mean(after, d => d.OBS_VALUE < -0.5 ? 1 : 0) ?? 0;

  return (wetAfter - wetBefore) - (dryAfter - dryBefore);
}

function rainShiftLabel(value) {
  const points = Math.round(Math.abs(value ?? 0) * 100);
  return {
    points,
    color: (value ?? 0) >= 0 ? "#087d89" : "#b36a1f",
    text: (value ?? 0) >= 0 ? `Rain +${points}` : `Rain -${points}`
  };
}

function drawTemperatureRibbon(g, values, { x0, y, w, h, opacity = 0.9 }) {
  const x = d3.scaleLinear().domain(YEAR_DOMAIN).range([x0, x0 + w]);

  g.selectAll("rect.heat")
    .data(values)
    .join("rect")
    .attr("class", "heat")
    .attr("x", d => x(d.TIME_PERIOD))
    .attr("y", y)
    .attr("width", Math.max(1.05, w / 175))
    .attr("height", h)
    .attr("rx", 0.6)
    .attr("fill", d => {
      const v = Math.max(-1, Math.min(1, d.smooth));
      return d3.interpolateRdBu(1 - ((v + 1) / 2));
    })
    .attr("opacity", opacity);
}

function addRibbonFrame(g, rc, { x0, y, w, h, stroke = "rgba(30,30,25,.52)" }) {
  g.node().appendChild(rc.rectangle(x0 - 1, y - 1, w + 2, h + 2, {
    roughness: 2.15,
    bowing: 1.35,
    stroke,
    strokeWidth: 0.9,
    fill: "none"
  }));
}

function drawRibbonYearTicks(g, { x0, y, w, tickY = y, labelY, fontSize = 8, labelTicks = [1850, 2025] }) {
  const x = d3.scaleLinear().domain(YEAR_DOMAIN).range([x0, x0 + w]);

  g.selectAll("line.year-tick")
    .data(YEAR_TICKS)
    .join("line")
    .attr("class", "year-tick")
    .attr("x1", d => x(d))
    .attr("x2", d => x(d))
    .attr("y1", tickY)
    .attr("y2", tickY + 5)
    .attr("stroke", "rgba(30,30,25,.62)")
    .attr("stroke-width", 0.75);

  g.selectAll("text.year-label")
    .data(labelTicks)
    .join("text")
    .attr("class", "year-label")
    .attr("x", d => x(d))
    .attr("y", labelY)
    .attr("text-anchor", d => d === YEAR_DOMAIN[0] ? "start" : d === YEAR_DOMAIN[1] ? "end" : "middle")
    .style("font-size", `${fontSize}px`)
    .style("font-weight", 700)
    .style("fill", "rgba(35,35,30,.72)")
    .text(d => d);
}

function drawClimateCard(parent, rc, code, climate, { x, y, width = 220, height = 86, rotate = 0 }) {
  const g = parent.append("g")
    .attr("class", "climate-card")
    .attr("transform", `translate(${x},${y}) rotate(${rotate}) translate(${-width / 2},${-height / 2})`);

  const x0 = 64;
  const w = width - x0 - 14;

  g.append("rect")
    .attr("x", 5)
    .attr("y", 7)
    .attr("width", width - 2)
    .attr("height", height - 3)
    .attr("rx", 6)
    .attr("fill", "rgba(30,25,15,.14)");

  const cardBox = rc.rectangle(1, 1, width - 2, height - 2, {
    roughness: 2.75,
    bowing: 1.95,
    stroke: "rgba(22,24,22,.84)",
    strokeWidth: 1.45,
    fill: "rgba(255,253,242,.98)",
    fillStyle: "solid"
  });
  g.node().appendChild(cardBox);

  g.append("line")
    .attr("x1", 8).attr("x2", width - 10)
    .attr("y1", 38).attr("y2", 38)
    .attr("stroke", "rgba(40,40,30,.20)")
    .attr("stroke-width", 0.9);

  const rainShift = rainShiftFor(climate, code);
  const rain = rainShiftLabel(rainShift);

  g.append("text")
    .attr("x", 8).attr("y", 18)
    .style("font-family", "Georgia, serif")
    .style("font-weight", 800)
    .style("font-size", "12px")
    .style("fill", "#171717")
    .text(territoryLabel(code));

  g.append("text")
    .attr("x", 8).attr("y", 32)
    .style("font-size", "10.5px")
    .style("font-weight", 800)
    .style("fill", rain.color)
    .text(rain.text);

  g.append("text")
    .attr("x", 8).attr("y", 58)
    .style("font-size", "8.6px")
    .style("font-weight", 800)
    .style("fill", "#333")
    .text("TEMP");

  g.append("text")
    .attr("x", 8).attr("y", 69)
    .style("font-size", "7px")
    .style("font-weight", 700)
    .style("fill", "rgba(45,45,38,.66)")
    .text("anom.");

  drawTemperatureRibbon(g, smoothSeries(temperatureSeries(climate, code), 7), {
    x0,
    y: 50,
    w,
    h: 14,
    opacity: 0.94
  });

  addRibbonFrame(g, rc, {
    x0,
    y: 50,
    w,
    h: 14,
    stroke: "rgba(25,25,20,.58)"
  });

  drawRibbonYearTicks(g, {
    x0,
    y: 67,
    w,
    tickY: 66,
    labelY: 81,
    fontSize: 8.1,
    labelTicks: [1850, 2025]
  });
}

function drawClimateRibbonMini(parent, rc, code, climate, { x, y, width = 300, height = 20, compact = false }) {
  const g = parent.append("g").attr("transform", `translate(${x},${y})`);
  const x0 = compact ? 42 : 128;
  const w = width - x0 - 4;
  const label = compact ? code : territoryLabel(code);

  g.append("text")
    .attr("x", 0).attr("y", 13)
    .style("font-family", "Georgia, serif")
    .style("font-size", compact ? "9px" : "7.5px")
    .style("font-weight", 900)
    .style("fill", "#222")
    .text(label);

  drawTemperatureRibbon(g, smoothSeries(temperatureSeries(climate, code), 7), {
    x0,
    y: 4,
    w,
    h: compact ? 10 : 9,
    opacity: 0.91
  });

  addRibbonFrame(g, rc, {
    x0,
    y: 4,
    w,
    h: compact ? 10 : 9,
    stroke: "rgba(35,35,30,.36)"
  });

  return height;
}

function addLegend(svg, defs, rc, { x, y, width, height, id, title, left, right, caption, stops }) {
  const grad = defs.append("linearGradient")
    .attr("id", id)
    .attr("x1", "0%")
    .attr("x2", "100%");

  stops.forEach(([offset, color]) => {
    grad.append("stop")
      .attr("offset", `${offset * 100}%`)
      .attr("stop-color", color);
  });

  svg.append("text")
    .attr("x", x).attr("y", y - 8)
    .style("font-size", "10.5px")
    .style("font-weight", 800)
    .style("fill", "#323936")
    .text(title);

  svg.append("rect")
    .attr("x", x).attr("y", y)
    .attr("width", width).attr("height", height)
    .attr("rx", 4)
    .attr("fill", `url(#${id})`);

  svg.node().appendChild(rc.rectangle(x, y, width, height, {
    roughness: 2,
    bowing: 1.25,
    stroke: "rgba(30,30,25,.58)",
    strokeWidth: 0.85,
    fill: "none"
  }));

  svg.append("text")
    .attr("x", x).attr("y", y + 24)
    .style("font-size", "9px")
    .style("font-weight", 700)
    .style("fill", "#555")
    .text(left);

  svg.append("text")
    .attr("x", x + width).attr("y", y + 24)
    .attr("text-anchor", "end")
    .style("font-size", "9px")
    .style("font-weight", 700)
    .style("fill", "#555")
    .text(right);

  const captionLines = Array.isArray(caption) ? caption : caption ? [caption] : [];
  captionLines.forEach((line, i) => {
    svg.append("text")
      .attr("x", x)
      .attr("y", y + 39 + i * 11)
      .style("font-size", "8.6px")
      .style("fill", "#54514a")
      .text(line);
  });
}

function addLegendPanel(svg, defs, rc, { x, y, width, height, colorRain }) {
  const g = svg.append("g")
    .attr("class", "legend-panel")
    .attr("transform", `translate(${x},${y})`);

  g.append("rect")
    .attr("x", 5)
    .attr("y", 6)
    .attr("width", width)
    .attr("height", height)
    .attr("rx", 6)
    .attr("fill", "rgba(30,25,15,.10)");

  g.node().appendChild(rc.rectangle(0, 0, width, height, {
    roughness: 2.55,
    bowing: 1.7,
    stroke: "rgba(35,35,28,.62)",
    strokeWidth: 1.05,
    fill: "rgba(255,253,244,.94)",
    fillStyle: "solid"
  }));

  g.append("text")
    .attr("x", 16)
    .attr("y", 23)
    .style("font-family", "Georgia, serif")
    .style("font-size", "15px")
    .style("font-weight", 800)
    .style("fill", "#20211d")
    .text("Legende");

  g.append("text")
    .attr("x", 16)
    .attr("y", 40)
    .style("font-size", "9.5px")
    .style("fill", "#56554e")
    .text("Lecture rapide des indicateurs.");

  addLegend(g, defs, rc, {
    x: 16,
    y: 63,
    width: width - 32,
    height: 10,
    id: "heat-gradient-sketch",
    title: "Rubans temperature",
    left: "plus frais",
    right: "plus chaud",
    caption: [
      "Temp = moyenne mer + terre, lissee 7 ans.",
      "Chaque trait vertical couvre 1850-2025."
    ],
    stops: d3.range(0, 1.01, 0.05).map(t => [t, d3.interpolateRdBu(1 - t)])
  });

  addLegend(g, defs, rc, {
    x: 16,
    y: 139,
    width: width - 32,
    height: 10,
    id: "rain-gradient-sketch",
    title: "ZEE: pluie apres 2000",
    left: "plus sec",
    right: "plus humide",
    caption: [
      "Gain = part apres 2000 - part avant.",
      "Indice = gain humide - gain sec."
    ],
    stops: d3.range(0, 1.01, 0.05).map(t => [t, colorRain(-0.7 + t * 1.4)])
  });
}

function drawRoughGeoPaths(parent, rc, features, path, optionsFor) {
  features.forEach(feature => {
    const d = path(feature);
    if (!d) return;
    parent.node().appendChild(rc.path(d, optionsFor(feature)));
  });
}

function addTitleBlock(svg) {
  svg.append("text")
    .attr("x", 34).attr("y", 48)
    .style("font-family", "Georgia, serif")
    .style("font-size", "29px")
    .style("font-weight", 850)
    .style("fill", "#111")
    .style("stroke", "rgba(244,239,227,.82)")
    .style("stroke-width", "3px")
    .style("paint-order", "stroke")
    .text("One Pacific, different climate futures");

  svg.append("text")
    .attr("x", 34).attr("y", 72)
    .style("font-size", "11.5px")
    .style("font-weight", 700)
    .style("fill", "#464843")
    .style("stroke", "rgba(244,239,227,.74)")
    .style("stroke-width", "2px")
    .style("paint-order", "stroke")
    .text("All Pacific territories warmed since 1850 — but rainfall shifts after 2000 diverge sharply.");

  svg.append("text")
    .attr("x", 34).attr("y", 91)
    .style("font-size", "10px")
    .style("font-weight", 750)
    .style("fill", "#5a574e")
    .style("stroke", "rgba(244,239,227,.72)")
    .style("stroke-width", "2px")
    .style("paint-order", "stroke")
    .text("EEZ color = wetter/drier balance · ribbons = temperature anomalies, 1850–2025");
}

function addExportButtons(container, svgNode, { width, height }) {
  const controls = document.createElement("div");
  Object.assign(controls.style, {
    position: "absolute",
    bottom: "18px",
    right: "18px",
    zIndex: 30,
    display: "flex",
    gap: "8px"
  });

  function makeButton(label) {
    const button = document.createElement("button");
    button.textContent = label;
    Object.assign(button.style, {
      padding: "8px 11px",
      border: "1px solid rgba(40,35,25,.18)",
      borderRadius: "9px",
      background: "rgba(255,253,248,.92)",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,.12)",
      font: "12px system-ui, sans-serif"
    });
    return button;
  }

  function serializedSvg() {
    const cloned = svgNode.cloneNode(true);
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    cloned.setAttribute("width", width);
    cloned.setAttribute("height", height);
    cloned.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      text { dominant-baseline: auto; }
      .export-hidden { display: none; }
    `;
    cloned.insertBefore(style, cloned.firstChild);

    return new XMLSerializer().serializeToString(cloned);
  }

  const svgButton = makeButton("Export SVG");
  svgButton.onclick = () => {
    const blob = new Blob([serializedSvg()], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pacific_climate_sketch.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  const pngButton = makeButton("Export PNG");
  pngButton.onclick = () => {
    const source = serializedSvg();
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const scale = 4;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#f4efe3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = "pacific_climate_sketch.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("PNG export failed. Use Export SVG, then convert it with Inkscape or your browser.");
    };

    img.src = url;
  };

  controls.append(svgButton, pngButton);
  container.append(controls);
}

async function buildClimateMap() {
  const [climateRaw, eez, landTopo] = await Promise.all([
    d3.csv(DATA.climate, d3.autoType),
    d3.json(DATA.eez),
    d3.json(DATA.land)
  ]);

  const climate = climateRaw
    .filter(d => d.GEO_PICT && d.signal && Number.isFinite(d.TIME_PERIOD) && Number.isFinite(d.OBS_VALUE));

  const landFeature = topojson.feature(landTopo, landTopo.objects.land);

  const width = 1280;
  const height = 720;
  const callouts = ["PG", "NC", "KI", "TO"];

  const colorRain = d3.scaleDiverging()
    .domain([-0.7, 0, 0.7])
    .interpolator(t => d3.interpolateRgbBasis(["#d98f4e", "#f6f3ec", "#6bc6d9"])(t));

  const rainShiftByCode = new Map(
    Array.from(new Set(climate.map(d => d.GEO_PICT)))
      .map(code => [code, rainShiftFor(climate, code)])
  );

  const features = eez.features
    .map(d => {
      const code = countryToCode.get(d.properties.country);
      return { ...d, code, rainShift: rainShiftByCode.get(code) };
    })
    .filter(d => d.code);

  const projection = d3.geoOrthographic()
    .rotate([-175, 10])
    .scale(550)
    .translate([width / 2 + 100, height / 2 + 30])
    .clipAngle(90)
    .precision(1.2);

  const path = d3.geoPath(projection);

  const div = d3.create("div")
    .style("position", "relative")
    .style("width", `${width}px`)
    .style("height", `${height}px`)
    .style("overflow", "hidden")
    .style("background", "#f4efe3")
    .style("font-family", "system-ui, sans-serif");

  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Pacific climate sketch map")
    .style("display", "block")
    .style("background", "#f4efe3");

  const defs = svg.append("defs");

  defs.append("filter")
    .attr("id", "paperNoise")
    .html(`
      <feTurbulence type="fractalNoise" baseFrequency="0.52" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.055"/></feComponentTransfer>
    `);

  const hatch = defs.append("pattern")
    .attr("id", "diagonalHatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 7)
    .attr("height", 7);

  hatch.append("path")
    .attr("d", "M-1,1 l2,-2 M0,7 l7,-7 M6,8 l2,-2")
    .attr("stroke", "rgba(30,50,55,.22)")
    .attr("stroke-width", 0.7)
    .attr("fill", "none");

  const dryHatch = defs.append("pattern")
    .attr("id", "dryHatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8);

  dryHatch.append("path")
    .attr("d", "M-1,8 l9,-9 M4,9 l5,-5")
    .attr("stroke", "rgba(154,94,19,.32)")
    .attr("stroke-width", 0.85)
    .attr("fill", "none");

  const wetWaves = defs.append("pattern")
    .attr("id", "wetWaves")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 12)
    .attr("height", 8);

  wetWaves.append("path")
    .attr("d", "M0,4 C3,1 5,7 8,4 S11,1 14,4")
    .attr("stroke", "rgba(11,102,93,.30)")
    .attr("stroke-width", 0.85)
    .attr("fill", "none");

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f4efe3");

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("filter", "url(#paperNoise)")
    .attr("opacity", 1);

  const rc = rough.svg(svg.node());

  svg.node().appendChild(rc.circle(width / 2 + 100, height / 2 + 30, 1110, {
    roughness: 3.1,
    bowing: 2.05,
    stroke: "rgba(35,65,80,.34)",
    strokeWidth: 1.15,
    fill: "#edf7f6",
    fillStyle: "hachure",
    hachureGap: 13,
    hachureAngle: 58,
    fillWeight: 0.38
  }));

  const mapG = svg.append("g");

  mapG.append("path")
    .datum(landFeature)
    .attr("d", path)
    .attr("fill", "rgba(132,146,105,.18)")
    .attr("stroke", "rgba(35,45,30,.18)")
    .attr("stroke-width", 0.4)
    .attr("opacity", 0.7);

  mapG.selectAll("path.fill")
    .data(features)
    .join("path")
    .attr("class", "fill")
    .attr("d", path)
    .attr("fill", d => d.rainShift == null ? "rgba(190,200,205,0.08)" : colorRain(d.rainShift))
    .attr("opacity", 0.46)
    .attr("stroke", "none");

  mapG.selectAll("path.rain-texture")
    .data(features.filter(d => d.rainShift != null && Math.abs(d.rainShift) >= 0.08))
    .join("path")
    .attr("class", "rain-texture")
    .attr("d", path)
    .attr("fill", d => d.rainShift >= 0 ? "url(#wetWaves)" : "url(#dryHatch)")
    .attr("opacity", 0.58)
    .attr("stroke", "none");

  drawRoughGeoPaths(mapG, rc, features, path, () => ({
    roughness: 2.55,
    bowing: 1.75,
    stroke: "rgba(24,42,48,.47)",
    strokeWidth: 1,
    fill: "none"
  }));

  drawRoughGeoPaths(mapG, rc, features, path, () => ({
    roughness: 3.3,
    bowing: 1.95,
    stroke: "rgba(24,42,48,.16)",
    strokeWidth: 1.65,
    fill: "none"
  }));

  mapG.append("path")
    .datum(landFeature)
    .attr("d", path)
    .attr("fill", "rgba(133,146,103,.34)")
    .attr("stroke", "rgba(43,56,38,.48)")
    .attr("stroke-width", 0.55)
    .attr("stroke-linejoin", "round")
    .attr("opacity", 0.82);

  const landSketchPath = path(landFeature);
  if (landSketchPath) {
    mapG.node().appendChild(rc.path(landSketchPath, {
      roughness: 2.8,
      bowing: 1.8,
      stroke: "rgba(38,52,35,.34)",
      strokeWidth: 0.9,
      fill: "none"
    }));
  }

  addLegendPanel(svg, defs, rc, {
    x: width - 382,
    y: 30,
    width: 350,
    height: 214,
    colorRain
  });

  // Matrix is now pure SVG, so SVG/PNG export includes it reliably.
  const matrix = svg.append("g")
    .attr("transform", "translate(32,100)");

  matrix.node().appendChild(rc.rectangle(0, 0, 326, 338, {
    roughness: 2.05,
    bowing: 1.35,
    stroke: "rgba(45,40,30,.40)",
    strokeWidth: 0.95,
    fill: "rgba(255,253,242,.91)",
    fillStyle: "solid"
  }));

  matrix.append("text")
    .attr("x", 12)
    .attr("y", 18)
    .style("font-family", "Georgia, serif")
    .style("font-weight", 800)
    .style("font-size", "14px")
    .style("fill", "#222")
    .text("All territories");

  matrix.append("text")
    .attr("x", 12)
    .attr("y", 34)
    .style("font-family", "system-ui, sans-serif")
    .style("font-size", "10px")
    .style("fill", "#666")
    .text("temperature ribbons · 1850–2025");

  matrix.append("text")
    .attr("x", 54)
    .attr("y", 49)
    .style("font-size", "8px")
    .style("font-weight", 700)
    .style("fill", "rgba(40,40,35,.55)")
    .text("1850");

  matrix.append("text")
    .attr("x", 153)
    .attr("y", 49)
    .attr("text-anchor", "end")
    .style("font-size", "8px")
    .style("font-weight", 700)
    .style("fill", "rgba(40,40,35,.55)")
    .text("2025");

  matrix.append("text")
    .attr("x", 210)
    .attr("y", 49)
    .style("font-size", "8px")
    .style("font-weight", 700)
    .style("fill", "rgba(40,40,35,.55)")
    .text("1850");

  matrix.append("text")
    .attr("x", 309)
    .attr("y", 49)
    .attr("text-anchor", "end")
    .style("font-size", "8px")
    .style("font-weight", 700)
    .style("fill", "rgba(40,40,35,.55)")
    .text("2025");

  const matrixCodes = Array.from(new Set(climate.map(d => d.GEO_PICT)))
    .filter(Boolean)
    .sort();
  const splitAt = Math.ceil(matrixCodes.length / 2);

  matrixCodes.forEach((code, i) => {
    const col = i < splitAt ? 0 : 1;
    const row = col === 0 ? i : i - splitAt;
    drawClimateRibbonMini(matrix, rc, code, climate, {
      x: col === 0 ? 12 : 168,
      y: 56 + row * 24.2,
      width: 144,
      height: 20,
      compact: true
    });
  });

  const overlay = svg.append("g");

  const offsets = {
    PG: [12, 24],
    NC: [-130, 104],
    KI: [-150, 54],
    TO: [178, 96]
  };

  const labelData = Object.entries(anchors)
    .map(([code, ll]) => {
      const p = projection(ll);
      if (!p) return null;
      const [dx, dy] = offsets[code] ?? [0, 0];
      return {
        code,
        x: p[0],
        y: p[1],
        cardX: p[0] + dx,
        cardY: p[1] + dy,
        rainShift: rainShiftByCode.get(code)
      };
    })
    .filter(Boolean);

  labelData
    .filter(d => !callouts.includes(d.code))
    .forEach(d => {
      overlay.append("text")
        .attr("x", d.x + 4).attr("y", d.y - 3)
        .text(d.code)
        .style("font-family", "Georgia, serif")
        .style("font-size", "8.7px")
        .style("font-weight", 800)
        .style("fill", "#26343a")
        .style("stroke", "rgba(255,253,242,.82)")
        .style("stroke-width", "2.2px")
        .style("paint-order", "stroke");
    });

  labelData
    .filter(d => callouts.includes(d.code))
    .forEach(d => {
      const targetX = d.cardX + (d.cardX > d.x ? -108 : 108);
      const targetY = d.cardY + 16;

      overlay.node().appendChild(rc.path(
        curvedCalloutPath(d.x, d.y, targetX, targetY, d.cardX > d.x ? 0.20 : -0.20),
        {
          roughness: 1.8,
          bowing: 1.35,
          stroke: "rgba(20,35,38,.86)",
          strokeWidth: 0.9,
          fill: "none"
        }
      ));

      drawClimateCard(overlay, rc, d.code, climate, {
        x: d.cardX,
        y: d.cardY,
        width: 220,
        height: 86,
        rotate: d.cardX > d.x ? -2.2 : 1.8
      });
    });

  addTitleBlock(svg);

  div.node().append(svg.node());
  addExportButtons(div.node(), svg.node(), { width, height });

  return div.node();
}

const root = document.querySelector("#climate-map");
root.innerHTML = "";
root.append(await buildClimateMap());
