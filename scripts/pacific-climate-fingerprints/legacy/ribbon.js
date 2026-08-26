import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";

const DATA = {
  climate: "../../data/pacific-climate-fingerprints/processed/climate_obs.csv"
};

const YEAR_DOMAIN = [1850, 2025];

function smoothSeries(raw, k = 7) {
  return raw.map((d, i) => ({
    ...d,
    smooth: d3.mean(
      raw.slice(Math.max(0, i - Math.floor(k / 2)), Math.min(raw.length, i + Math.floor(k / 2) + 1)),
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

function drawTemperatureRibbon(g, values, { x0, y, w, h }) {
  const x = d3.scaleLinear().domain(YEAR_DOMAIN).range([x0, x0 + w]);

  g.selectAll("rect.heat")
    .data(values)
    .join("rect")
    .attr("x", d => x(d.TIME_PERIOD))
    .attr("y", y)
    .attr("width", Math.max(1.05, w / 175))
    .attr("height", h)
    .attr("fill", d => {
      const v = Math.max(-1, Math.min(1, d.smooth));
      return d3.interpolateRdBu(1 - ((v + 1) / 2));
    });
}

function drawRibbon(parent, rc, code, climate, { x, y }) {
  const g = parent.append("g").attr("transform", `translate(${x},${y})`);

  g.append("text")
    .attr("x", 0)
    .attr("y", 13)
    .style("font-family", "Georgia, serif")
    .style("font-size", "9px")
    .style("font-weight", 900)
    .text(code);

  drawTemperatureRibbon(g, smoothSeries(temperatureSeries(climate, code), 7), {
    x0: 42,
    y: 4,
    w: 100,
    h: 10
  });

  g.node().appendChild(rc.rectangle(41, 3, 102, 12, {
    roughness: 2,
    bowing: 1.2,
    stroke: "rgba(35,35,30,.36)",
    strokeWidth: 0.9,
    fill: "none"
  }));
}

async function buildRibbons() {
  const climateRaw = await d3.csv(DATA.climate, d3.autoType);
  const climate = climateRaw.filter(d =>
    d.GEO_PICT &&
    d.signal &&
    Number.isFinite(d.TIME_PERIOD) &&
    Number.isFinite(d.OBS_VALUE)
  );

  const codes = Array.from(new Set(climate.map(d => d.GEO_PICT))).sort();

  const width = 760;
  const height = 430;

  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("background", "#f4efe3");

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f4efe3");

  const rc = rough.svg(svg.node());

  svg.append("text")
    .attr("x", 28)
    .attr("y", 38)
    .style("font-family", "Georgia, serif")
    .style("font-size", "22px")
    .style("font-weight", 850)
    .text("Pacific temperature ribbons");

  svg.append("text")
    .attr("x", 28)
    .attr("y", 60)
    .style("font-size", "11px")
    .style("font-weight", 700)
    .style("fill", "#555")
    .text("Temperature anomalies, 1850–2025 · moyenne mer + terre, lissée 7 ans");

  svg.append("text").attr("x", 70).attr("y", 88).style("font-size", "8px").style("font-weight", 700).text("1850");
  svg.append("text").attr("x", 170).attr("y", 88).style("font-size", "8px").style("font-weight", 700).attr("text-anchor", "end").text("2025");
  svg.append("text").attr("x", 300).attr("y", 88).style("font-size", "8px").style("font-weight", 700).text("1850");
  svg.append("text").attr("x", 400).attr("y", 88).style("font-size", "8px").style("font-weight", 700).attr("text-anchor", "end").text("2025");
  svg.append("text").attr("x", 530).attr("y", 88).style("font-size", "8px").style("font-weight", 700).text("1850");
  svg.append("text").attr("x", 630).attr("y", 88).style("font-size", "8px").style("font-weight", 700).attr("text-anchor", "end").text("2025");

  codes.forEach((code, i) => {
    const col = Math.floor(i / 8);
    const row = i % 8;

    drawRibbon(svg, rc, code, climate, {
      x: 28 + col * 230,
      y: 100 + row * 34
    });
  });

  return svg.node();
}

function downloadPng(svgNode) {
  const width = +svgNode.getAttribute("width");
  const height = +svgNode.getAttribute("height");

  const source = new XMLSerializer().serializeToString(svgNode);
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
    ctx.drawImage(img, 0, 0);

    const link = document.createElement("a");
    link.download = "ribbons_pacifique.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    URL.revokeObjectURL(url);
  };

  img.src = url;
}

const root = document.querySelector("#ribbons-pacifique");
root.innerHTML = "";

const svgNode = await buildRibbons();
root.append(svgNode);

const button = document.createElement("button");
button.textContent = "Exporter PNG";
button.onclick = () => downloadPng(svgNode);
root.append(button);
