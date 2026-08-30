import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";
import {
  initialLanguage,
  localizeEnsoPhase,
  localizedNumber,
  localizedPopulation,
  persistLanguage,
  territoryName as localizedTerritoryName,
  translate
} from "./climate-i18n.js";

const mobileLite = window.matchMedia(
  "(max-width: 760px), (pointer: coarse) and (max-width: 1024px)"
).matches;
const DATA_ROOT = "../../assets/data/pacific-climate-fingerprints";

const DATA = {
  climate: `${DATA_ROOT}/climate_interactive.csv`,
  globalContext: `${DATA_ROOT}/global_context.csv`,
  territoryContext: `${DATA_ROOT}/territory_context.csv`,
  eez: `${DATA_ROOT}/eez.geojson`,
  sources: `${DATA_ROOT}/SOURCES.md`,
  land: "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"
};

const SOURCE_URLS = {
  climate: "https://stats.pacificdata.org/vis?df%5Bds%5D=ds%3ASPC2&df%5Bid%5D=DF_CLIMATE_CHANGE&df%5Bag%5D=SPC&df%5Bvs%5D=1.0",
  co2: "https://gml.noaa.gov/ccgg/trends/data.html",
  enso: "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
  population: "https://stats.pacificdata.org/vis?df%5Bds%5D=ds%3ASPC2&df%5Bid%5D=DF_NMDI_POP&df%5Bag%5D=SPC&df%5Bvs%5D=1.0"
};

const metricAccents = {
  ocean: "#a64b45",
  land: "#9f403d",
  rain: "#2474a6",
  sea_level: "#416f96"
};

const playbackStartByMetric = {
  ocean: 1960,
  land: 1960,
  rain: 1979,
  sea_level: 1993
};

const metrics = {
  ocean: {
    tabKey: "metric.ocean.tab",
    labelKey: "metric.ocean.label",
    unit: "°C",
    domain: [-1, 0, 1],
    colors: ["#3f7197", "#fff4dc", "#b64f47"],
    lowKey: "metric.ocean.low",
    highKey: "metric.ocean.high",
    descriptionKey: "metric.ocean.description",
    noteKey: "metric.ocean.note",
    readingKey: "metric.ocean.reading"
  },
  land: {
    tabKey: "metric.land.tab",
    labelKey: "metric.land.label",
    unit: "°C",
    domain: [-1, 0, 1],
    colors: ["#456f91", "#fff4dc", "#a94440"],
    lowKey: "metric.land.low",
    highKey: "metric.land.high",
    descriptionKey: "metric.land.description",
    noteKey: "metric.land.note",
    readingKey: "metric.land.reading"
  },
  rain: {
    tabKey: "metric.rain.tab",
    labelKey: "metric.rain.label",
    unit: "mm",
    domain: [-60, 0, 60],
    colors: ["#d7672d", "#fff1c9", "#2475a7"],
    lowKey: "metric.rain.low",
    highKey: "metric.rain.high",
    descriptionKey: "metric.rain.description",
    noteKey: "metric.rain.note",
    readingKey: "metric.rain.reading"
  },
  sea_level: {
    tabKey: "metric.sea.tab",
    labelKey: "metric.sea.label",
    unit: "cm",
    domain: [-15, 0, 15],
    colors: ["#d1a348", "#fff4dc", "#416f96"],
    lowKey: "metric.sea.low",
    highKey: "metric.sea.high",
    descriptionKey: "metric.sea.description",
    noteKey: "metric.sea.note",
    readingKey: "metric.sea.reading"
  }
};

const metricScaleCache = new WeakMap();

const chapters = [
  {
    id: "warming",
    number: "01",
    indicator: "ocean",
    indicators: ["ocean", "land"],
    tabKey: "chapter.warming.tab",
    headlineKey: "chapter.warming.headline",
    bodyKey: "chapter.warming.body"
  },
  {
    id: "rainfall",
    number: "02",
    indicator: "rain",
    tabKey: "chapter.rain.tab",
    headlineKey: "chapter.rain.headline",
    bodyKey: "chapter.rain.body"
  },
  {
    id: "sea-rise",
    number: "03",
    indicator: "sea_level",
    tabKey: "chapter.sea.tab",
    headlineKey: "chapter.sea.headline",
    bodyKey: "chapter.sea.body"
  }
];

const countryToCode = new Map([
  ["American Samoa", "AS"], ["Cook Islands", "CK"], ["Fiji", "FJ"],
  ["Guam", "GU"], ["Kiribati", "KI"], ["Marshall Islands", "MH"],
  ["Micronesia", "FM"], ["Nauru", "NR"], ["New Caledonia", "NC"],
  ["Niue", "NU"], ["Northern Mariana Islands", "MP"], ["Palau", "PW"],
  ["Papua New Guinea", "PG"], ["Polynesie Francaise", "PF"], ["Samoa", "WS"],
  ["Solomon Islands", "SB"], ["Tokelau", "TK"], ["Tonga", "TO"],
  ["Tuvalu", "TV"], ["Vanuatu", "VU"], ["Wallis et Futuna", "WF"]
]);

const anchors = {
  AS: [-170.7, -14.3], CK: [-159.8, -21.2], FJ: [178.1, -17.8],
  FM: [158.2, 6.9], GU: [144.8, 13.5], KI: [-157.3, 1.8],
  MH: [171.2, 7.1], MP: [145.7, 15.2], NC: [165.6, -21.5],
  NR: [166.9, -0.5], NU: [-169.9, -19.0], PF: [-149.5, -17.6],
  PG: [145.0, -6.3], PN: [-130.1, -25.1], PW: [134.5, 7.5], SB: [160.2, -9.6],
  TK: [-171.8, -9.1], TO: [-175.2, -21.2], TV: [179.2, -8.5],
  VU: [167.5, -16.3], WF: [-177.2, -13.3], WS: [-172.1, -13.8]
};

const root = document.querySelector("#climate-map");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const compactStoryQuery = window.matchMedia("(max-width: 1239px)");
const isCompactStory = () => compactStoryQuery.matches;
const state = {
  indicator: "ocean",
  chapter: "warming",
  year: 2025,
  selected: "NC",
  compared: null,
  playing: false,
  lang: initialLanguage()
};
let playback = null;
let activeScrollStep = null;
let sceneEffectTimer = null;
let contextFrameKind = null;
let contextRenderState = null;
let atlasReady = !mobileLite;

function t(key, variables = {}) {
  return translate(state.lang, key, variables);
}

function metricText(metric, field) {
  return t(metric[`${field}Key`]);
}

function chapterText(chapter, field) {
  return chapter ? t(chapter[`${field}Key`]) : "";
}

function territoryLabel(code) {
  return localizedTerritoryName(state.lang, code);
}

function stableSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 + 1;
}

function planarRingArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function normalizeD3PolygonWinding(feature) {
  const orientPolygon = polygon => polygon.map((ring, index) => {
    const area = planarRingArea(ring);
    const shouldReverse = index === 0 ? area > 0 : area < 0;
    return shouldReverse ? [...ring].reverse() : ring;
  });
  const geometry = feature.geometry;
  if (geometry?.type === "Polygon") {
    return { ...feature, geometry: { ...geometry, coordinates: orientPolygon(geometry.coordinates) } };
  }
  if (geometry?.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map(orientPolygon)
      }
    };
  }
  return feature;
}

function appendRough(svgSelection, node, className) {
  node.setAttribute("class", className);
  svgSelection.node().appendChild(node);
  return d3.select(node);
}

function appendRasterRibbon(selection, rows, {
  domain,
  color,
  x,
  y,
  width,
  height,
  className
}) {
  if (!rows.length) return null;
  const start = Math.floor(domain[0]);
  const end = Math.ceil(domain[1]);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, end - start + 1);
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#dedbd0";
  context.fillRect(0, 0, canvas.width, 1);
  rows.forEach(row => {
    const column = Math.round(row.year) - start;
    if (column < 0 || column >= canvas.width || !Number.isFinite(row.value)) return;
    context.fillStyle = color(row.value);
    context.fillRect(column, 0, 1, 1);
  });

  try {
    return selection.append("image")
      .attr("class", className)
      .attr("x", x)
      .attr("y", y)
      .attr("width", width)
      .attr("height", height)
      .attr("preserveAspectRatio", "none")
      .attr("href", canvas.toDataURL("image/png"));
  } catch {
    return null;
  }
}

function signed(value, digits = 1) {
  if (!Number.isFinite(value)) return t("common.noData");
  const fixed = localizedNumber(state.lang, Math.abs(value), digits);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${fixed}`;
}

function metricColorScaleText(metric) {
  return t("ribbon.colorScale", {
    low: `${signed(metric.domain[0])} ${metric.unit}`,
    lowLabel: metricText(metric, "low"),
    mid: t("map.reference"),
    high: `${signed(metric.domain[2])} ${metric.unit}`,
    highLabel: metricText(metric, "high")
  });
}

function metricColorScaleCompactText(metric) {
  return t("ribbon.colorScaleCompact", {
    low: `${signed(metric.domain[0])} ${metric.unit}`,
    high: `${signed(metric.domain[2])} ${metric.unit}`
  });
}

function appendRibbonColorKey(group, metric, x, y) {
  const compact = mobileLite;
  const panelWidth = compact ? 278 : 610;
  const key = group.append("g")
    .attr("class", `ribbon-detail-color-key${compact ? " is-compact" : ""}`)
    .attr("transform", `translate(${x},${y})`);
  key.append("rect")
    .attr("class", "ribbon-detail-color-key-bg")
    .attr("x", -7)
    .attr("y", -5)
    .attr("width", panelWidth)
    .attr("height", 18)
    .attr("rx", 5);
  key.selectAll("rect.ribbon-detail-color-swatch")
    .data(metric.colors)
    .join("rect")
    .attr("class", "ribbon-detail-color-swatch")
    .attr("x", (_, index) => index * 13)
    .attr("y", 0)
    .attr("width", 13)
    .attr("height", 8)
    .attr("fill", color => color);
  key.append("text")
    .attr("x", metric.colors.length * 13 + 9)
    .attr("y", 8)
    .text(compact ? metricColorScaleCompactText(metric) : metricColorScaleText(metric));
}

function formatValue(value, metric) {
  if (!Number.isFinite(value)) return t("common.noData");
  return `${signed(value, 1)} ${metric.unit}`;
}

function formatPopulation(value) {
  return localizedPopulation(state.lang, value);
}

function metricScale(metric) {
  if (!metricScaleCache.has(metric)) {
    metricScaleCache.set(metric, d3.scaleDiverging()
      .domain(metric.domain)
      .interpolator(d3.interpolateRgbBasis(metric.colors))
      .clamp(true));
  }
  return metricScaleCache.get(metric);
}

function closestRow(rows, year) {
  if (!rows?.length) return null;
  const index = d3.bisector(d => d.year).center(rows, year);
  return rows[index] ?? null;
}

function rainClass(row) {
  if (!Number.isFinite(row?.value)) return null;
  const uncertaintyBand = Number.isFinite(row.standard_error) ? row.standard_error * 2 : 0;
  if (row.value > uncertaintyBand) return "wetter";
  if (row.value < -uncertaintyBand) return "drier";
  return "near";
}

function buildPortraitHistory(rows, indicator, windowSize = 10) {
  if (!rows.length) {
    return {
      baselineStart: null,
      baselineEnd: null,
      baselineMean: NaN,
      rollingRows: [],
      cumulativeRows: [],
      summaryByYear: new Map()
    };
  }

  const preferredStart = playbackStartByMetric[indicator] ?? rows[0].year;
  const baselineStart = Math.max(rows[0].year, preferredStart);
  const baselineEnd = baselineStart + windowSize - 1;
  const baselineRows = rows.filter(d => d.year >= baselineStart && d.year <= baselineEnd);
  const baselineComplete = baselineRows.length === windowSize;
  const baselineMean = baselineComplete ? d3.mean(baselineRows, d => d.value) : NaN;
  const rollingRows = [];
  const cumulativeRows = [];
  const summaryByYear = new Map();
  let cumulativeBalance = 0;

  rows.forEach(row => {
    cumulativeBalance += row.value;
    cumulativeRows.push({ year: row.year, value: cumulativeBalance });

    const currentWindow = rows.filter(d => d.year >= row.year - windowSize + 1 && d.year <= row.year);
    const windowComplete = currentWindow.length === windowSize;
    const currentMean = windowComplete ? d3.mean(currentWindow, d => d.value) : NaN;
    if (windowComplete) rollingRows.push({ year: row.year, value: currentMean });

    if (indicator === "rain") {
      const counts = { drier: 0, near: 0, wetter: 0 };
      currentWindow.forEach(d => {
        const classification = rainClass(d);
        if (classification) counts[classification] += 1;
      });
      summaryByYear.set(row.year, {
        ready: true,
        cumulativeBalance,
        currentWindow,
        recentBalance: d3.sum(currentWindow, d => d.value),
        counts
      });
      return;
    }

    const baselineProgress = row.year < baselineStart
      ? 0
      : baselineRows.filter(d => d.year <= row.year).length;
    const ready = baselineComplete && row.year >= baselineEnd && windowComplete;
    summaryByYear.set(row.year, ready
      ? {
          ready: true,
          baselineMean,
          currentMean,
          shift: currentMean - baselineMean,
          currentWindow
        }
      : {
          ready: false,
          baselineProgress
        });
  });

  return {
    baselineStart,
    baselineEnd,
    baselineMean,
    rollingRows,
    cumulativeRows,
    summaryByYear
  };
}

function createShell() {
  root.innerHTML = `
    <section class="climate-explorer" data-render-mode="${mobileLite ? "lite" : "full"}" lang="${state.lang}" aria-label="${t("ui.explorerAria")}" aria-busy="true">
      <header class="explorer-header">
        <div>
          <p class="eyebrow">${t("header.eyebrow")}</p>
          <h1>${t("header.title")}</h1>
          <p class="lede">${t("header.lede")}</p>
          <p class="hero-formula" aria-label="${t("header.formulaAria")}">
            <span>${t("header.formulaSignals")}</span>
            <b aria-hidden="true">+</b>
            <span>${t("header.formulaTerritories")}</span>
            <b aria-hidden="true">→</b>
            <strong>${t("header.formulaResult")}</strong>
          </p>
        </div>
        <div class="header-actions">
          <div class="language-switch" role="group" aria-label="${t("language.group")}">
            <svg class="language-switch-sketch" viewBox="0 0 150 50" preserveAspectRatio="none" aria-hidden="true"></svg>
            <button type="button" class="language-button" data-lang="fr" aria-pressed="${state.lang === "fr"}" aria-label="${t("language.french")}">FR</button>
            <span aria-hidden="true">|</span>
            <button type="button" class="language-button" data-lang="en" aria-pressed="${state.lang === "en"}" aria-label="${t("language.english")}">EN</button>
          </div>
          <div class="header-stamp" aria-hidden="true">${t("header.stamp")}</div>
        </div>
      </header>

      <nav class="story-nav" aria-label="${t("nav.storyAria")}">
        ${chapters.map(chapter => `
          <button type="button" class="story-step" data-chapter="${chapter.id}" aria-current="${chapter.id === state.chapter ? "step" : "false"}">
            <span class="story-number">${chapter.number}</span>
            <span class="story-step-label">${chapterText(chapter, "tab")}</span>
          </button>`).join("")}
      </nav>

      <section class="story-voice" aria-live="polite">
        <div>
          <p class="story-kicker"></p>
          <h2 class="story-headline"></h2>
          <p class="story-body"></p>
        </div>
        <p class="story-stat"></p>
      </section>

      <section class="context-bridge" data-context="co2" aria-label="${t("context.defaultAria")}">
        <svg class="context-frame" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="context-copy">
          <p class="context-kicker"></p>
          <p class="context-reading"><strong class="context-value"></strong><span class="context-unit"></span></p>
          <h3 class="context-title"></h3>
          <p class="context-note"></p>
          <a class="context-source" target="_blank" rel="noreferrer">${t("source.view")}</a>
        </div>
        <figure class="context-figure">
          <svg class="context-chart" viewBox="0 0 360 118" role="img"></svg>
          <figcaption class="context-chart-caption"></figcaption>
        </figure>
      </section>

      <div class="time-controls">
        <button type="button" class="play-button" data-testid="play-years" aria-label="${t("controls.playAria")}">
          <span class="play-icon" aria-hidden="true">▶</span><span class="play-text">${t("controls.play")}</span>
        </button>
        <label class="year-slider-label">
          <span class="sr-only">${t("controls.selectedYear")}</span>
          <input data-testid="year-slider" class="year-slider" type="range" step="1">
        </label>
        <output class="year-output" aria-live="polite">${state.year}</output>
        <button type="button" class="reset-view">${t("controls.reset")}</button>
      </div>

      <div class="explore-row">
        <span class="explore-prompt">${t("explore.prompt")}</span>
        <small class="explore-help">${t("explore.help")}</small>
        <div class="metric-tabs" role="group" aria-label="${t("explore.indicatorAria")}">
          ${Object.entries(metrics).map(([key, metric]) => `
            <button type="button" class="metric-tab" data-indicator="${key}" aria-pressed="${key === state.indicator}">
              <span class="metric-tab-label">${metricText(metric, "tab")}</span>
              <small>${metric.unit}</small>
              <span class="metric-help" aria-hidden="true">?</span>
            </button>`).join("")}
        </div>
        <details class="method-drawer">
          <summary>
            <span>${t("method.summary")}</span>
            <small class="method-current"></small>
          </summary>
          <div class="method-grid">
            <div>
              <p class="method-label">${t("method.measureLabel")}</p>
              <p class="method-measure"></p>
            </div>
            <div>
              <p class="method-label">${t("method.referenceLabel")}</p>
              <p class="method-reference"></p>
            </div>
            <div>
              <p class="method-label">${t("method.coverageLabel")}</p>
              <p class="method-coverage"></p>
            </div>
            <div>
              <p class="method-label">${t("method.missingLabel")}</p>
              <p class="method-missing">${t("method.missing")}</p>
            </div>
          </div>
          <div class="method-actions">
            <a class="method-source" href="${SOURCE_URLS.climate}" target="_blank" rel="noreferrer">${t("method.source")}</a>
            <a class="method-download" href="${DATA.climate}" download>${t("method.download")}</a>
          </div>
        </details>
      </div>

      <div class="climate-workspace">
        <div class="map-stage">
          <div class="map-copy">
            <p class="map-question"></p>
            <details class="map-explainer">
              <summary><span aria-hidden="true">?</span>${t("map.explain")}</summary>
              <div class="map-explainer-body">
                <p class="map-note"></p>
                <p class="map-reading-guide"></p>
              </div>
            </details>
            <label class="territory-picker">
              <span>${t("map.territoryLabel")}</span>
              <select class="territory-select" aria-label="${t("map.territoryAria")}"></select>
            </label>
            <p class="map-impact" aria-live="polite">
              <strong class="map-impact-value"></strong>
              <span class="map-impact-label"></span>
            </p>
          </div>
          <svg class="map-svg" width="900" height="650" viewBox="0 0 900 650" role="group" aria-label="${t("map.aria")}"></svg>
          <div class="map-year" aria-hidden="true"></div>
          <div class="climate-tooltip" role="status" hidden></div>
          <div class="legend" aria-label="${t("map.legendAria")}">
            <div class="legend-label legend-low"></div>
            <div class="legend-ramp"><span class="legend-mid"></span></div>
            <div class="legend-label legend-high"></div>
          </div>
          <p class="drag-hint">${t("map.dragHint")}</p>
        </div>

        <aside class="territory-panel" data-portrait="ocean">
          <svg class="territory-frame" viewBox="0 0 1000 1200" preserveAspectRatio="none" aria-hidden="true"></svg>
          <p class="panel-kicker">${t("portrait.kicker")}</p>
          <h2 class="panel-title"></h2>
          <p class="panel-code"></p>
          <div class="portrait-summary">
            <svg class="portrait-summary-sketch" viewBox="0 0 1000 360" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div class="portrait-now">
              <p class="portrait-reading-kicker">${t("portrait.thisYear")}</p>
              <div class="panel-reading">
                <span class="panel-value"></span>
                <span class="panel-year"></span>
              </div>
            </div>
            <div class="portrait-shift">
              <p class="portrait-shift-kicker">${t("portrait.longTerm")}</p>
              <strong class="portrait-shift-value"></strong>
              <span class="portrait-shift-years"></span>
              <svg class="portrait-shift-spark" viewBox="0 0 132 42" role="img"></svg>
              <p class="portrait-shift-note"></p>
            </div>
          </div>
          <p class="portrait-live-summary sr-only" aria-live="polite" aria-atomic="true"></p>
          <div class="portrait-ribbon-block">
            <div class="portrait-ribbon-heading">
              <span>${t("portrait.fullArchive")}</span><span class="portrait-ribbon-years"></span>
            </div>
            <svg class="territory-ribbon" viewBox="0 0 310 62" role="img"></svg>
          </div>
          <figure class="detail-figure">
            <svg class="detail-chart" viewBox="0 0 310 190" role="img"></svg>
            <figcaption class="detail-chart-caption"></figcaption>
          </figure>
          <div class="panel-context">
            <p class="panel-context-kicker">${t("portrait.contextLatest")}</p>
            <div class="panel-stats"></div>
          </div>
          <p class="panel-method"></p>
        </aside>
      </div>

      <section class="ribbon-atlas" aria-labelledby="ribbon-atlas-title">
        <div class="ribbon-atlas-heading">
          <div>
            <p class="panel-kicker">${t("atlas.kicker")}</p>
            <h2 id="ribbon-atlas-title">${t("atlas.title")}</h2>
          </div>
          <p class="ribbon-atlas-intro">${t("atlas.intro")}</p>
        </div>
        <div class="ribbon-overview">
          <p class="ribbon-wall-active"></p>
          <div class="ribbon-wall-wrap">
            <svg class="ribbon-wall" viewBox="0 0 1180 360" role="group" aria-label="${t("atlas.aria")}"></svg>
          </div>
        </div>
        <aside class="ribbon-detail" data-indicator="${state.indicator}" aria-labelledby="ribbon-detail-title">
          <div class="ribbon-detail-heading">
            <div>
              <p class="panel-kicker">${t("atlas.detailKicker")}</p>
              <h3 id="ribbon-detail-title" class="ribbon-detail-title"></h3>
            </div>
            <div class="ribbon-detail-meta">
              <p class="ribbon-detail-metric"></p>
              <label class="territory-compare-control">
                <span>${t("comparison.label")}</span>
                <select class="territory-compare-select" aria-label="${t("comparison.label")}">
                  <option value="">${t("comparison.none")}</option>
                </select>
              </label>
              <button type="button" class="portrait-export">${t("atlas.export")}</button>
            </div>
          </div>
          <div class="territory-climate-summary" aria-live="polite">
            <p class="territory-summary-kicker">${t("atlas.summaryKicker")}</p>
            <p class="territory-summary-text"></p>
          </div>
          <p class="ribbon-detail-summary"></p>
          <ul class="ribbon-reading-key" aria-label="${t("atlas.detailKicker")}">
            <li>${t("atlas.readingStripe")}</li>
            <li>${t("atlas.readingTime")}</li>
            <li>${t("atlas.readingZero")}</li>
            <li>${t("atlas.readingBlank")}</li>
          </ul>
          <figure class="ribbon-detail-figure">
            <svg class="ribbon-detail-svg" viewBox="0 0 1100 430" role="group" tabindex="0"></svg>
            <figcaption class="ribbon-detail-caption"></figcaption>
          </figure>
          <p class="ribbon-detail-reading" aria-live="polite">
            <strong class="ribbon-detail-value"></strong>
            <span class="ribbon-detail-year"></span>
          </p>
          <section class="ribbon-comparison" aria-label="${t("comparison.kicker")}" hidden>
          <div class="ribbon-comparison-toolbar">
            <p class="ribbon-comparison-guide">${t("comparison.guide")}</p>
            <button type="button" class="comparison-remove">${t("comparison.remove")}</button>
          </div>
          <div class="comparison-contrast" aria-live="polite">
            <div>
              <p class="comparison-contrast-kicker">${t("comparison.contrastKicker")}</p>
              <h4 class="comparison-contrast-title"></h4>
            </div>
            <ul>
              <li data-contrast="heat"></li>
              <li data-contrast="rain"></li>
              <li data-contrast="sea"></li>
            </ul>
          </div>
          <figure class="ribbon-detail-figure">
            <svg class="ribbon-comparison-svg ribbon-detail-svg" viewBox="0 0 1100 640" role="group" tabindex="0"></svg>
            <figcaption class="ribbon-comparison-caption ribbon-detail-caption"></figcaption>
          </figure>
          <p class="ribbon-comparison-reading ribbon-detail-reading" aria-live="polite">
            <strong class="ribbon-comparison-value ribbon-detail-value"></strong>
            <span class="ribbon-comparison-year ribbon-detail-year"></span>
          </p>
          </section>
        </aside>
        <section class="story-conclusion" aria-labelledby="story-conclusion-title">
          <div class="story-conclusion-heading">
            <div>
              <p class="panel-kicker">${t("conclusion.kicker")}</p>
              <h3 id="story-conclusion-title"></h3>
            </div>
            <p class="story-conclusion-lede">${t("conclusion.lede")}</p>
          </div>
          <div class="conclusion-cards">
            <article class="conclusion-card" data-conclusion="heat">
              <span class="conclusion-index">01</span>
              <h4>${t("conclusion.heat")}</h4>
              <p></p>
              <small></small>
            </article>
            <article class="conclusion-card" data-conclusion="rain">
              <span class="conclusion-index">02</span>
              <h4>${t("conclusion.rain")}</h4>
              <p></p>
              <small></small>
            </article>
            <article class="conclusion-card" data-conclusion="sea">
              <span class="conclusion-index">03</span>
              <h4>${t("conclusion.sea")}</h4>
              <p></p>
              <small></small>
            </article>
          </div>
          <div class="conclusion-footnote">
            <p>${t("conclusion.caveat")}</p>
            <a href="${DATA.sources}">${t("conclusion.source")} →</a>
          </div>
        </section>
        <div class="ribbon-tooltip" role="status" hidden></div>
      </section>
  </section>`;
}

function setupScrollyLayout() {
  const explorer = root.querySelector(".climate-explorer");
  const storyNav = root.querySelector(".story-nav");
  const storyVoice = root.querySelector(".story-voice");
  const contextBridge = root.querySelector(".context-bridge");
  const timeControls = root.querySelector(".time-controls");
  const exploreRow = root.querySelector(".explore-row");
  const workspace = root.querySelector(".climate-workspace");
  const territoryPanel = root.querySelector(".territory-panel");
  const ribbonAtlas = root.querySelector(".ribbon-atlas");

  const scrolly = document.createElement("section");
  scrolly.className = "scrolly-story";
  scrolly.setAttribute("aria-label", t("scrolly.aria"));

  const graphic = document.createElement("div");
  graphic.className = "scrolly-graphic";

  const steps = document.createElement("div");
  steps.className = "scrolly-steps";
  if (isCompactStory()) steps.tabIndex = 0;
  steps.innerHTML = `
    <article id="story-opening" class="scroll-step is-active" data-step="opening" data-chapter="warming" data-indicator="ocean" data-year="2025">
      <div class="scroll-card">
        <p class="scroll-number">${t("scrolly.opening.number")}</p>
        <h2>${t("scrolly.opening.title")}</h2>
        <p>${t(isCompactStory() ? "scrolly.opening.bodyCompact" : "scrolly.opening.bodyDesktop")}</p>
        <span class="scroll-cue">${t(isCompactStory() ? "scrolly.opening.cueCompact" : "scrolly.opening.cueDesktop")}</span>
      </div>
    </article>
    <article id="story-warming" class="scroll-step" data-step="warming" data-chapter="warming" data-indicator="ocean" data-year="2025" data-start-year="1960" data-autoplay="true" data-duration="3000">
      <div class="scroll-card">
        <p class="scroll-number">${t("scrolly.warming.number")}</p>
        <h2>${t("scrolly.warming.title")}</h2>
        <p>${t(isCompactStory() ? "scrolly.warming.bodyCompact" : "scrolly.warming.bodyDesktop")}</p>
        <p class="scroll-evidence">${t("scrolly.warming.evidence")}</p>
      </div>
    </article>
    <article id="story-warming-land" class="scroll-step" data-step="warming-land" data-chapter="warming" data-indicator="land" data-year="2025" data-start-year="1960" data-autoplay="true" data-duration="2200">
      <div class="scroll-card">
        <p class="scroll-number">${t("scrolly.landWarming.number")}</p>
        <h2>${t("scrolly.landWarming.title")}</h2>
        <p>${t(isCompactStory() ? "scrolly.landWarming.bodyCompact" : "scrolly.landWarming.bodyDesktop")}</p>
        <p class="scroll-evidence">${t("scrolly.landWarming.evidence")}</p>
      </div>
    </article>
    <article id="story-rainfall" class="scroll-step" data-step="rainfall" data-chapter="rainfall" data-indicator="rain" data-year="2015">
      <div class="scroll-card">
        <p class="scroll-number">${t("scrolly.rain.number")}</p>
        <h2>${t("scrolly.rain.title")}</h2>
        <p>${t("scrolly.rain.body")}</p>
        <p class="scroll-evidence">${t("scrolly.rain.evidence")}</p>
      </div>
    </article>
    <article id="story-sea-rise" class="scroll-step" data-step="sea-rise" data-chapter="sea-rise" data-indicator="sea_level" data-year="2023">
      <div class="scroll-card">
        <p class="scroll-number">${t("scrolly.sea.number")}</p>
        <h2>${t("scrolly.sea.title")}</h2>
        <p>${t("scrolly.sea.body")}</p>
        <p class="scroll-evidence">${t("scrolly.sea.evidence")}</p>
      </div>
    </article>
    <article id="story-explore" class="scroll-step scroll-step-explore" data-step="explore">
      <div class="scroll-card">
        <p class="scroll-number">${t("scrolly.explore.number")}</p>
        <h2>${t("scrolly.explore.title")}</h2>
        <p>${t("scrolly.explore.body")}</p>
        <span class="scroll-cue">${t("scrolly.explore.cue")}</span>
      </div>
    </article>`;

  const storyControls = document.createElement("div");
  storyControls.className = "story-controls";
  storyControls.innerHTML = `
    <button type="button" class="story-control story-previous">
      <span aria-hidden="true">←</span>
      <span class="story-control-label">${t("scrolly.previous")}</span>
    </button>
    <div class="story-progress-wrap">
      <output class="story-progress" role="status" aria-live="polite" aria-atomic="true"></output>
      <span class="story-progress-track" aria-hidden="true"><span></span></span>
    </div>
    <button type="button" class="story-control story-next">
      <span class="story-control-label">${t("scrolly.next")}</span>
      <span aria-hidden="true">→</span>
    </button>
    <p class="story-instructions">${t("scrolly.instructions")}</p>`;

  storyVoice.classList.add("sr-only");
  explorer.dataset.storyStep = "opening";
  explorer.insertBefore(scrolly, storyNav);
  graphic.append(storyVoice, workspace);
  workspace.prepend(storyNav, timeControls);
  territoryPanel.insertBefore(contextBridge, territoryPanel.querySelector(".panel-context"));
  scrolly.append(steps, storyControls, graphic);
  explorer.insertBefore(exploreRow, ribbonAtlas);
}

function updateStoryAccessibility() {
  const steps = Array.from(root.querySelectorAll(".scroll-step"));
  if (!steps.length) return;
  const activeIndex = Math.max(0, steps.findIndex(step => step.classList.contains("is-active")));

  steps.forEach((step, index) => {
    const isActive = index === activeIndex;
    const title = step.querySelector("h2")?.textContent?.trim() || "";
    step.setAttribute("role", "group");
    step.setAttribute("aria-roledescription", t("scrolly.slide"));
    step.setAttribute("aria-label", t("scrolly.slideLabel", {
      current: index + 1,
      total: steps.length,
      title
    }));
    if (isActive) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });

  const current = activeIndex + 1;
  const progress = root.querySelector(".story-progress");
  if (progress) {
    progress.textContent = t("scrolly.progress", { current, total: steps.length });
    progress.setAttribute("aria-label", t("scrolly.progressAria", { current, total: steps.length }));
  }
  root.querySelector(".story-progress-wrap")?.style.setProperty(
    "--story-progress",
    `${(current / steps.length) * 100}%`
  );
  const previous = root.querySelector(".story-previous");
  const next = root.querySelector(".story-next");
  if (previous) previous.disabled = activeIndex === 0;
  if (next) next.disabled = activeIndex === steps.length - 1;
}

function updateMethodDrawer() {
  const metric = metrics[state.indicator];
  const current = root.querySelector(".method-current");
  const measure = root.querySelector(".method-measure");
  const reference = root.querySelector(".method-reference");
  const coverage = root.querySelector(".method-coverage");
  if (current) current.textContent = metricText(metric, "tab");
  if (measure) measure.textContent = metricText(metric, "description");
  if (reference) reference.textContent = metricText(metric, "reading");
  if (coverage) coverage.textContent = metricText(metric, "note");
}

function applyStaticCopy() {
  const setText = (selector, key) => {
    const node = root.querySelector(selector);
    if (node) node.textContent = t(key);
  };
  const setHtml = (selector, key) => {
    const node = root.querySelector(selector);
    if (node) node.innerHTML = t(key);
  };
  const setAria = (selector, key) => {
    root.querySelector(selector)?.setAttribute("aria-label", t(key));
  };

  document.documentElement.lang = state.lang;
  document.documentElement.setAttribute("xml:lang", state.lang);
  document.title = t("page.title");
  const sourceNote = document.querySelector(".climate-note");
  if (sourceNote) sourceNote.innerHTML = t("source.note");
  const explorer = root.querySelector(".climate-explorer");
  explorer?.setAttribute("lang", state.lang);
  explorer?.setAttribute("aria-label", t("ui.explorerAria"));

  setText(".eyebrow", "header.eyebrow");
  setText(".explorer-header h1", "header.title");
  setText(".lede", "header.lede");
  setText(".hero-formula span:first-child", "header.formulaSignals");
  setText(".hero-formula span:nth-of-type(2)", "header.formulaTerritories");
  setText(".hero-formula strong", "header.formulaResult");
  setAria(".hero-formula", "header.formulaAria");
  setHtml(".header-stamp", "header.stamp");
  setAria(".language-switch", "language.group");
  root.querySelectorAll(".language-button").forEach(button => {
    button.setAttribute("aria-pressed", button.dataset.lang === state.lang ? "true" : "false");
    button.setAttribute("aria-label", t(button.dataset.lang === "fr" ? "language.french" : "language.english"));
  });

  setAria(".story-nav", "nav.storyAria");
  root.querySelectorAll(".story-step").forEach(button => {
    const chapter = chapters.find(item => item.id === button.dataset.chapter);
    const label = button.querySelector(".story-step-label");
    if (chapter && label) label.textContent = chapterText(chapter, "tab");
  });
  setAria(".context-bridge", "context.defaultAria");
  setText(".play-text", "controls.play");
  setAria(".play-button", "controls.playAria");
  setText(".year-slider-label .sr-only", "controls.selectedYear");
  setText(".reset-view", "controls.reset");
  setText(".explore-prompt", "explore.prompt");
  setText(".explore-help", "explore.help");
  setAria(".metric-tabs", "explore.indicatorAria");
  root.querySelectorAll(".metric-tab").forEach(button => {
    const metric = metrics[button.dataset.indicator];
    if (metric) {
      button.querySelector(".metric-tab-label").textContent = metricText(metric, "tab");
      button.dataset.tooltip = metricText(metric, "reading");
      button.setAttribute("aria-description", metricText(metric, "reading"));
      button.setAttribute("aria-label", `${metricText(metric, "tab")}. ${metricText(metric, "reading")}`);
    }
  });
  setText(".method-drawer summary > span", "method.summary");
  setText(".method-grid > div:nth-child(1) .method-label", "method.measureLabel");
  setText(".method-grid > div:nth-child(2) .method-label", "method.referenceLabel");
  setText(".method-grid > div:nth-child(3) .method-label", "method.coverageLabel");
  setText(".method-grid > div:nth-child(4) .method-label", "method.missingLabel");
  setText(".method-missing", "method.missing");
  setText(".method-source", "method.source");
  setText(".method-download", "method.download");
  updateMethodDrawer();
  setAria(".map-svg", "map.aria");
  setAria(".legend", "map.legendAria");
  setText(".territory-picker > span", "map.territoryLabel");
  setAria(".territory-select", "map.territoryAria");
  setText(".map-explainer summary", "map.explain");
  const explainerSummary = root.querySelector(".map-explainer summary");
  if (explainerSummary) explainerSummary.insertAdjacentHTML("afterbegin", '<span aria-hidden="true">?</span>');
  setText(".drag-hint", "map.dragHint");
  setText(".territory-panel > .panel-kicker", "portrait.kicker");
  setText(".portrait-reading-kicker", "portrait.thisYear");
  setText(".portrait-ribbon-heading > span:first-child", "portrait.fullArchive");
  setText(".panel-context-kicker", "portrait.contextLatest");
  setText(".ribbon-atlas .panel-kicker", "atlas.kicker");
  setText("#ribbon-atlas-title", "atlas.title");
  setText(".ribbon-atlas-intro", "atlas.intro");
  setText(".ribbon-detail .panel-kicker", "atlas.detailKicker");
  setText(".portrait-export", "atlas.export");
  setText(".territory-compare-control > span", "comparison.label");
  setAria(".territory-compare-select", "comparison.label");
  setText('.territory-compare-select option[value=""]', "comparison.none");
  setText(".territory-summary-kicker", "atlas.summaryKicker");
  setText(".ribbon-reading-key li:nth-child(1)", "atlas.readingStripe");
  setText(".ribbon-reading-key li:nth-child(2)", "atlas.readingTime");
  setText(".ribbon-reading-key li:nth-child(3)", "atlas.readingZero");
  setText(".ribbon-reading-key li:nth-child(4)", "atlas.readingBlank");
  setAria(".ribbon-comparison", "comparison.kicker");
  setText(".comparison-remove", "comparison.remove");
  setText(".ribbon-comparison-guide", "comparison.guide");
  setText(".comparison-contrast-kicker", "comparison.contrastKicker");
  setText(".story-conclusion .panel-kicker", "conclusion.kicker");
  setText(".story-conclusion-lede", "conclusion.lede");
  setText('.conclusion-card[data-conclusion="heat"] h4', "conclusion.heat");
  setText('.conclusion-card[data-conclusion="rain"] h4', "conclusion.rain");
  setText('.conclusion-card[data-conclusion="sea"] h4', "conclusion.sea");
  setText(".conclusion-footnote p", "conclusion.caveat");
  setText(".conclusion-footnote a", "conclusion.source");
  setAria(".ribbon-wall", "atlas.aria");
  setAria(".scrolly-story", "scrolly.aria");
  setAria(".scrolly-steps", "scrolly.instructions");
  setText(".story-previous .story-control-label", "scrolly.previous");
  setAria(".story-previous", "scrolly.previousAria");
  setText(".story-next .story-control-label", "scrolly.next");
  setAria(".story-next", "scrolly.nextAria");
  setText(".story-instructions", "scrolly.instructions");

  const scrollyCopy = [
    ["#story-opening .scroll-number", "scrolly.opening.number"],
    ["#story-opening h2", "scrolly.opening.title"],
    ["#story-opening .scroll-card > p:not(.scroll-number):not(.scroll-live-stat)", isCompactStory() ? "scrolly.opening.bodyCompact" : "scrolly.opening.bodyDesktop"],
    ["#story-opening .scroll-cue", isCompactStory() ? "scrolly.opening.cueCompact" : "scrolly.opening.cueDesktop"],
    ["#story-warming .scroll-number", "scrolly.warming.number"],
    ["#story-warming h2", "scrolly.warming.title"],
    ["#story-warming .scroll-card > p:not(.scroll-number):not(.scroll-evidence)", isCompactStory() ? "scrolly.warming.bodyCompact" : "scrolly.warming.bodyDesktop"],
    ["#story-warming .scroll-evidence", "scrolly.warming.evidence"],
    ["#story-warming-land .scroll-number", "scrolly.landWarming.number"],
    ["#story-warming-land h2", "scrolly.landWarming.title"],
    ["#story-warming-land .scroll-card > p:not(.scroll-number):not(.scroll-evidence)", isCompactStory() ? "scrolly.landWarming.bodyCompact" : "scrolly.landWarming.bodyDesktop"],
    ["#story-warming-land .scroll-evidence", "scrolly.landWarming.evidence"],
    ["#story-rainfall .scroll-number", "scrolly.rain.number"],
    ["#story-rainfall h2", "scrolly.rain.title"],
    ["#story-rainfall .scroll-card > p:not(.scroll-number):not(.scroll-evidence)", "scrolly.rain.body"],
    ["#story-rainfall .scroll-evidence", "scrolly.rain.evidence"],
    ["#story-sea-rise .scroll-number", "scrolly.sea.number"],
    ["#story-sea-rise h2", "scrolly.sea.title"],
    ["#story-sea-rise .scroll-card > p:not(.scroll-number):not(.scroll-evidence)", "scrolly.sea.body"],
    ["#story-sea-rise .scroll-evidence", "scrolly.sea.evidence"],
    ["#story-explore .scroll-number", "scrolly.explore.number"],
    ["#story-explore h2", "scrolly.explore.title"],
    ["#story-explore .scroll-card > p:not(.scroll-number)", "scrolly.explore.body"],
    ["#story-explore .scroll-cue", "scrolly.explore.cue"]
  ];
  scrollyCopy.forEach(([selector, key]) => setText(selector, key));
  updateStoryAccessibility();
}

function drawLanguageSwitchSketch() {
  const sketch = d3.select(root).select(".language-switch-sketch");
  sketch.selectAll("*").remove();
  if (!sketch.node()) return;
  const roughSketch = rough.svg(sketch.node());
  appendRough(sketch, roughSketch.rectangle(4, 5, 142, 40, {
    seed: stableSeed("language-switch-frame"),
    stroke: "rgba(31, 41, 40, 0.7)",
    strokeWidth: 1.15,
    roughness: 1.8,
    bowing: 1.35,
    fill: "rgba(255, 250, 240, 0.74)",
    fillStyle: "solid"
  }), "language-switch-frame");
  appendRough(sketch, roughSketch.line(75, 9, 75, 41, {
    seed: stableSeed("language-switch-divider"),
    stroke: "rgba(31, 41, 40, 0.32)",
    strokeWidth: 0.8,
    roughness: 1.75,
    bowing: 1.2
  }), "language-switch-divider");
}

async function build() {
  createShell();
  setupScrollyLayout();
  applyStaticCopy();
  persistLanguage(state.lang);
  drawLanguageSwitchSketch();

  const [raw, globalContext, territoryContext, eez, landTopo] = await Promise.all([
    d3.csv(DATA.climate, d => ({
      code: d.code,
      indicator: d.indicator,
      year: +d.year,
      value: +d.value,
      standard_error: d.standard_error === "" ? NaN : +d.standard_error
    })),
    d3.csv(DATA.globalContext, d => ({
      ...d,
      year: +d.year,
      co2_ppm: d.co2_ppm === "" ? NaN : +d.co2_ppm,
      oni_mean: d.oni_mean === "" ? NaN : +d.oni_mean,
      oni_peak: d.oni_peak === "" ? NaN : +d.oni_peak
    })),
    d3.csv(DATA.territoryContext, d => ({
      ...d,
      year: +d.year,
      population: d.population === "" ? NaN : +d.population,
      station_count_latest: d.station_count_latest === "" ? NaN : +d.station_count_latest,
      station_year_latest: d.station_year_latest === "" ? NaN : +d.station_year_latest
    })),
d3.json(DATA.eez),
d3.json(DATA.land).catch(error => {
  console.warn(
    "World land layer unavailable; continuing with the climate zones.",
    error
  );
  return null;
})
  ]);

  const byMetric = d3.group(raw, d => d.indicator, d => d.code);
  const rowByMetricYearCode = d3.rollup(
    raw,
    rows => rows[0],
    d => d.indicator,
    d => d.year,
    d => d.code
  );
  const yearsByMetric = new Map(
    Object.keys(metrics).map(key => [key, Array.from(new Set(raw.filter(d => d.indicator === key).map(d => d.year))).sort(d3.ascending)])
  );
  const ribbonCodes = Array.from(new Set(raw.map(d => d.code))).sort(d3.ascending);
  const ribbonMetricKeys = Object.keys(metrics);
  const ribbonYearDomain = d3.extent(raw, d => d.year);
  const territoryContextByCode = d3.group(territoryContext, d => d.code);

  const features = eez.features.map(feature => ({
    ...normalizeD3PolygonWinding(feature),
    code: countryToCode.get(feature.properties.country)
  })).filter(d => d.code);

  const land = landTopo?.objects?.land
    ? topojson.feature(landTopo, landTopo.objects.land)
    : { type: "FeatureCollection", features: [] };
  const svg = d3.select(root).select(".map-svg");
  const ribbonWall = d3.select(root).select(".ribbon-wall");
  const ribbonDetail = d3.select(root).select(".ribbon-detail-svg");
  const ribbonComparison = d3.select(root).select(".ribbon-comparison-svg");
  const roughMap = rough.svg(svg.node());
  const stage = root.querySelector(".map-stage");
  const tooltip = root.querySelector(".climate-tooltip");
  const ribbonTooltip = root.querySelector(".ribbon-tooltip");
  document.body.appendChild(ribbonTooltip);
  const slider = root.querySelector(".year-slider");
  const playButton = root.querySelector(".play-button");
  const explorer = root.querySelector(".climate-explorer");
  const mapQuestion = root.querySelector(".map-question");
  const mapYear = root.querySelector(".map-year");
  const yearOutput = root.querySelector(".year-output");
  let ribbonX = null;
  let ribbonSignature = null;
  let ribbonRenderTimer = null;
  let ribbonDetailState = null;
  let ribbonComparisonState = null;
  let panelRenderState = null;
  let mapTooltipFrame = null;
  let mapTooltipPoint = null;
  let mapTooltipBounds = null;
  let mapTooltipSize = null;
  let mapTooltipContentKey = null;
  let mapTooltipLayoutKey = null;
  let ribbonTooltipFrame = null;
  let ribbonTooltipPoint = null;
  let ribbonTooltipSize = null;
  let ribbonTooltipContentKey = null;
  let ribbonTooltipLayoutKey = null;
  const initialRotation = [-172, 8, 0];
  const projection = d3.geoOrthographic()
    .rotate(initialRotation)
    .scale(330)
    .translate([455, 348])
    .clipAngle(90)
    .precision(1.15);
  const path = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();

  const defs = svg.append("defs");

  const pencilHatch = defs.append("pattern")
    .attr("id", "map-pencil-hatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 13)
    .attr("height", 13)
    .attr("patternTransform", "rotate(-9)");
  pencilHatch.append("path")
    .attr("d", "M -3 3 L 16 3 M -3 9 L 16 9")
    .attr("fill", "none")
    .attr("stroke", "rgba(27, 55, 54, 0.16)")
    .attr("stroke-width", 0.55)
    .attr("stroke-dasharray", "7 2.5");

  const zoneTextureClipPaths = new Map((mobileLite ? [] : features).map(feature => {
    const clipPath = defs.append("clipPath")
      .attr("id", `zone-texture-clip-${feature.code.toLowerCase()}`)
      .append("path")
      .datum(feature);
    return [feature.code, clipPath];
  }));

  svg.append("rect").attr("class", "map-paper-texture").attr("width", 900).attr("height", 650);
  svg.append("path").datum({ type: "Sphere" }).attr("class", "ocean-sphere");
  svg.append("path").datum(graticule).attr("class", "graticule");
  svg.append("path").datum(land).attr("class", "world-land");
  svg.append("path").datum(land).attr("class", "world-land-hatch");
  if (!mobileLite) {
    svg.append("path").datum({ type: "Sphere" }).attr("class", "ocean-sphere-sketch ocean-sphere-sketch-echo");
    svg.append("path").datum({ type: "Sphere" }).attr("class", "ocean-sphere-sketch");
    svg.append("path").datum(graticule).attr("class", "graticule-sketch");
    svg.append("path").datum(land).attr("class", "world-land-sketch world-land-sketch-echo");
    svg.append("path").datum(land).attr("class", "world-land-sketch");
  }
  const roughCoastLayer = svg.append("g")
    .attr("class", "rough-coast-layer")
    .attr("pointer-events", "none");

  const zoneLayer = svg.append("g").attr("class", "zone-layer");
  const zones = zoneLayer.selectAll("path.zone")
    .data(features)
    .join("path")
    .attr("class", "zone")
    .attr("tabindex", mobileLite ? -1 : 0)
    .attr("role", "button")
    .attr("data-code", d => d.code)
    .on("pointerenter", mobileLite ? null : (event, d) => showTooltip(event, d.code))
    .on("pointermove", mobileLite ? null : event => scheduleMapTooltipPosition(event, false))
    .on("pointerleave", hideTooltip)
    .on("focus", (event, d) => showTooltip(event, d.code, true))
    .on("blur", hideTooltip)
    .on("click", (_, d) => selectTerritory(d.code))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTerritory(d.code);
      }
    });

  const zoneTextureLayer = svg.append("g")
    .attr("class", "zone-pencil-texture-layer")
    .attr("pointer-events", "none");

  const sketchZones = mobileLite
    ? d3.select(null)
    : svg.append("g")
      .attr("class", "zone-sketch-layer")
      .selectAll("path.zone-sketch")
      .data(features)
      .join("path")
      .attr("class", "zone-sketch");

  const sketchZonesEcho = mobileLite
    ? d3.select(null)
    : svg.append("g")
      .attr("class", "zone-sketch-layer zone-sketch-layer-echo")
      .selectAll("path.zone-sketch-echo")
      .data(features)
      .join("path")
      .attr("class", "zone-sketch zone-sketch-echo");

  const labelLayer = svg.append("g").attr("class", "map-labels");
  const labels = labelLayer.selectAll("text")
    .data(Object.entries(anchors).map(([code, coordinates]) => ({ code, coordinates })))
    .join("text")
    .attr("class", "map-code")
    .text(d => d.code);

  const marker = svg.append("g").attr("class", "selection-marker");
  if (!mobileLite) {
    const roughMarker = roughMap.circle(0, 0, 28, {
      seed: stableSeed("map-selection-marker"),
      stroke: "#132e31",
      strokeWidth: 1.35,
      roughness: 2.2,
      bowing: 1.8,
      fill: "none"
    });
    roughMarker.setAttribute("class", "selection-marker-rough");
    marker.node().appendChild(roughMarker);
  }
  marker.append("circle").attr("r", 4);

  function currentRows(code) {
    return byMetric.get(state.indicator)?.get(code) ?? [];
  }

  function populateTerritoryPicker() {
    const select = root.querySelector(".territory-select");
    if (!select) return;
    const codes = Array.from(new Set(features.map(feature => feature.code)))
      .sort((a, b) => d3.ascending(territoryLabel(a), territoryLabel(b)));
    const options = codes.map(code => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${territoryLabel(code)} · ${code}`;
      return option;
    });
    select.replaceChildren(...options);
    select.value = state.selected;
  }

  function populateComparisonSelect() {
    const select = root.querySelector(".territory-compare-select");
    if (!select) return;
    if (state.compared === state.selected || !ribbonCodes.includes(state.compared)) {
      state.compared = null;
      ribbonComparisonState = null;
    }
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = t("comparison.none");
    const options = ribbonCodes
      .filter(code => code !== state.selected)
      .sort((a, b) => d3.ascending(territoryLabel(a), territoryLabel(b)))
      .map(code => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = `${territoryLabel(code)} · ${code}`;
        return option;
      });
    select.replaceChildren(emptyOption, ...options);
    select.value = state.compared ?? "";
  }

  function currentRow(code) {
    return rowByMetricYearCode
      .get(state.indicator)
      ?.get(state.year)
      ?.get(code) ?? null;
  }

  function currentValue(code) {
    return currentRow(code)?.value ?? NaN;
  }

  function updateNarrative() {
    const metric = metrics[state.indicator];
    const chapter = chapters.find(d => d.id === state.chapter);
    const observations = features.map(d => currentRow(d.code)).filter(Boolean);
    const values = observations.map(d => d.value).filter(Number.isFinite);
    const positive = values.filter(d => d > 0).length;
    const negative = values.filter(d => d < 0).length;
    const rainfall = {
      wetter: observations.filter(d => rainClass(d) === "wetter").length,
      drier: observations.filter(d => rainClass(d) === "drier").length,
      near: observations.filter(d => rainClass(d) === "near").length
    };

    const metricLabel = metricText(metric, "label");
    let headline = chapter ? chapterText(chapter, "headline") : t("story.defaultHeadline");
    let body = chapter ? chapterText(chapter, "body") : t("story.defaultBody");
    let stat = t("story.observed", { count: values.length });
    let impactValue = `${values.length}`;
    let impactLabel = t("story.observedYear", { year: state.year });
    const impactNode = root.querySelector(".map-impact-value");
    impactNode.classList.remove("is-rain-balance");

    if (state.indicator === "ocean" || state.indicator === "land") {
      stat = t("story.warmer", { positive, count: values.length, year: state.year });
      impactValue = `${positive}/${values.length}`;
      impactLabel = t("story.warmerLabel", { year: state.year });
    } else if (state.indicator === "rain") {
      stat = t("story.rainStat", {
        wetter: rainfall.wetter,
        drier: rainfall.drier,
        near: rainfall.near ? t("story.rainNear", { count: rainfall.near }) : "",
        year: state.year
      });
      impactValue = `
        <span class="rain-impact-side is-drier"><b>${rainfall.drier}</b><small>${t("story.rainDrier")}</small></span>
        ${rainfall.near ? `<span class="rain-impact-side is-near"><b>${rainfall.near}</b><small>${t("story.rainNearShort")}</small></span>` : ""}
        <span class="rain-impact-side is-wetter"><b>${rainfall.wetter}</b><small>${t("story.rainWetter")}</small></span>`;
      impactLabel = t("story.rainLabel", { year: state.year });
      impactNode.classList.add("is-rain-balance");
    } else if (state.indicator === "sea_level") {
      stat = t("story.seaStat", { positive, negative, year: state.year });
      impactValue = `${positive}/${values.length}`;
      impactLabel = t("story.seaLabel", { year: state.year });
    }

    root.querySelector(".story-kicker").textContent = chapter
      ? t("story.chapterKicker", { number: chapter.number, metric: metricLabel })
      : t("story.freeKicker", { metric: metricLabel });
    root.querySelector(".story-headline").textContent = headline;
    root.querySelector(".story-body").textContent = body;
    root.querySelector(".story-stat").textContent = stat;
    if (state.indicator === "rain") {
      impactNode.innerHTML = impactValue;
    } else {
      impactNode.textContent = impactValue;
    }
    root.querySelector(".map-impact-label").textContent = impactLabel;
    root.querySelector(".climate-explorer").dataset.indicator = state.indicator;
    const openingStat = root.querySelector(".scroll-live-stat");
    if (openingStat) openingStat.textContent = stat;
    root.querySelectorAll(".story-step").forEach(button => {
      button.setAttribute("aria-current", button.dataset.chapter === state.chapter ? "step" : "false");
    });
  }

  function territoryContextRow(code, year = state.year) {
    const rows = territoryContextByCode.get(code) ?? [];
    return rows.find(d => d.year === year) ?? rows.at(-1) ?? null;
  }

  function contextRowAtOrBefore(rows, year) {
    return d3.greatest(rows.filter(row => row.year <= year), row => row.year) ?? null;
  }

  function ensureContextChart(chart, key, buildChart) {
    if (!contextRenderState || contextRenderState.key !== key) {
      chart.selectAll("*").remove();
      contextRenderState = { key, ...buildChart(chart) };
    }
    return contextRenderState;
  }

  function updateContextDescription(renderState, title, description) {
    renderState.a11yTitle.text(title);
    renderState.a11yDescription.text(description);
  }

  function updateContextBridge() {
    const bridge = root.querySelector(".context-bridge");
    const chart = d3.select(root).select(".context-chart");
    const source = root.querySelector(".context-source");
    const valueNode = root.querySelector(".context-value");
    const unitNode = root.querySelector(".context-unit");
    const kickerNode = root.querySelector(".context-kicker");
    const titleNode = root.querySelector(".context-title");
    const noteNode = root.querySelector(".context-note");
    const captionNode = root.querySelector(".context-chart-caption");
    valueNode.textContent = "";
    unitNode.textContent = "";
    captionNode.textContent = "";

    const width = 360;
    const height = 118;
    const margin = { top: 15, right: 16, bottom: 24, left: 18 };

    if (state.indicator === "rain") {
      const rows = globalContext.filter(d => Number.isFinite(d.oni_mean));
      const current = rows.find(d => d.year === state.year);
      const mappedRows = features.map(d => currentRow(d.code)).filter(Boolean);
      const driest = d3.least(mappedRows, d => d.value);
      const wettest = d3.greatest(mappedRows, d => d.value);

      bridge.dataset.context = "rain";
      kickerNode.textContent = t("context.enso.kicker");
      titleNode.textContent = t("context.enso.title");
      valueNode.textContent = current ? localizeEnsoPhase(state.lang, current.enso_phase) : t("context.enso.outside");
      unitNode.textContent = current
        ? t("context.enso.unit", { year: state.year, value: signed(current.oni_mean, 2) })
        : t("context.enso.begins");
      noteNode.textContent = current
        ? t("context.enso.note")
        : t("context.enso.noteBefore");
      captionNode.textContent = driest && wettest
        ? t("context.enso.caption", {
            dryCode: driest.code,
            dryValue: signed(driest.value),
            wetCode: wettest.code,
            wetValue: signed(wettest.value)
          })
        : t("context.enso.captionEmpty");
      source.href = SOURCE_URLS.enso;
      source.textContent = t("context.enso.source");
      bridge.setAttribute("aria-label", t("context.enso.aria", { year: state.year }));
      drawContextFrame("rain", "#2474a6");
      const renderState = ensureContextChart(
        chart,
        `enso:${state.lang}`,
        currentChart => buildEnsoGauge(currentChart, width, height)
      );
      updateContextDescription(
        renderState,
        t("context.enso.chartTitle", { year: state.year }),
        current
          ? t("context.enso.chartDescription", {
              phase: localizeEnsoPhase(state.lang, current.enso_phase),
              value: signed(current.oni_mean, 2)
            })
          : t("context.enso.chartBefore")
      );
      updateEnsoGauge(renderState, current);
      return;
    }

    if (state.indicator === "sea_level") {
      const rows = (territoryContextByCode.get(state.selected) ?? []).filter(d => Number.isFinite(d.population));
      const current = contextRowAtOrBefore(rows, state.year);
      const first = rows[0];
      const title = territoryLabel(state.selected);
      const change = current && first ? (current.population / first.population - 1) * 100 : NaN;

      bridge.dataset.context = "population";
      kickerNode.textContent = t("context.population.kicker");
      titleNode.textContent = t("context.population.title", { territory: title });
      valueNode.textContent = formatPopulation(current?.population);
      unitNode.textContent = current
        ? t("context.population.unit", {
            year: current.year,
            estimate: current.population_status === "E" ? t("common.estimateShort") : ""
          })
        : t("context.population.none");
      noteNode.textContent = t("context.population.note", { territory: title });
      captionNode.textContent = first && current
        ? t("context.population.caption", {
            first: formatPopulation(first.population),
            firstYear: first.year,
            current: formatPopulation(current.population),
            currentYear: current.year,
            change: Number.isFinite(change) ? ` · ${signed(change, 0)}%` : ""
          })
        : t("context.population.unavailable");
      source.href = SOURCE_URLS.population;
      source.textContent = t("context.population.source");
      bridge.setAttribute("aria-label", t("context.population.aria", { territory: title }));
      drawContextFrame("population", "#356b6b");
      let renderState;
      if (rows.length) {
        const x = d3.scaleLinear().domain(d3.extent(rows, d => d.year)).range([margin.left, width - margin.right]);
        const y = d3.scaleLinear().domain([0, d3.max(rows, d => d.population) * 1.06]).nice().range([height - margin.bottom, margin.top]);
        renderState = ensureContextChart(
          chart,
          `population:${state.lang}:${state.selected}`,
          currentChart => buildRoughTrend(currentChart, rows, x, y, d => d.population, {
            accent: "#356b6b",
            seedKey: `population-${state.selected}`,
            height,
            margin,
            formatEndpoint: formatPopulation
          })
        );
        updateRoughTrendYear(renderState, state.year);
      } else {
        renderState = ensureContextChart(
          chart,
          `population-empty:${state.lang}:${state.selected}`,
          currentChart => buildEmptyContextChart(currentChart, width, height, t("context.population.unavailable"))
        );
      }
      updateContextDescription(
        renderState,
        t("context.population.chartTitle", { territory: title }),
        current
          ? t("context.population.chartDescription", {
              population: formatPopulation(current.population),
              year: current.year
            })
          : t("context.population.chartEmpty")
      );
      return;
    }

    const rows = globalContext.filter(d => Number.isFinite(d.co2_ppm));
    const current = contextRowAtOrBefore(rows, state.year);
    const first = rows[0];
    const x = d3.scaleLinear().domain(d3.extent(rows, d => d.year)).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([d3.min(rows, d => d.co2_ppm) - 5, d3.max(rows, d => d.co2_ppm) + 3]).nice().range([height - margin.bottom, margin.top]);

    bridge.dataset.context = "co2";
    kickerNode.textContent = t("context.co2.kicker");
    titleNode.textContent = t("context.co2.title");
    valueNode.textContent = current ? localizedNumber(state.lang, current.co2_ppm, 1, 1) : "1959 →";
    unitNode.textContent = current
      ? t("context.co2.unit", {
          year: current.year,
          change: signed(current.co2_ppm - first.co2_ppm, 0)
        })
      : t("context.co2.before");
    noteNode.textContent = t("context.co2.note");
    captionNode.textContent = current
      ? t("context.co2.caption", {
          first: localizedNumber(state.lang, first.co2_ppm, 0),
          firstYear: first.year,
          latest: localizedNumber(state.lang, current.co2_ppm, 0),
          latestYear: current.year
        })
      : t("context.co2.captionBefore", {
          first: localizedNumber(state.lang, first.co2_ppm, 0),
          firstYear: first.year
        });
    source.href = SOURCE_URLS.co2;
    source.textContent = t("context.co2.source");
    bridge.setAttribute("aria-label", t("context.co2.aria", { year: state.year }));
    drawContextFrame("co2", "#995f49");
    const renderState = ensureContextChart(
      chart,
      `co2:${state.lang}`,
      currentChart => buildRoughTrend(currentChart, rows, x, y, d => d.co2_ppm, {
        accent: "#995f49",
        seedKey: "co2",
        height,
        margin,
        formatEndpoint: value => localizedNumber(state.lang, value, 0)
      })
    );
    updateContextDescription(
      renderState,
      t("context.co2.chartTitle"),
      current
        ? t("context.co2.chartDescription", {
            value: localizedNumber(state.lang, current.co2_ppm, 1, 1),
            year: current.year,
            change: signed(current.co2_ppm - first.co2_ppm, 0)
          })
        : t("context.co2.chartBefore", {
            value: localizedNumber(state.lang, first.co2_ppm, 1, 1)
          })
    );
    updateRoughTrendYear(renderState, state.year);
  }

  function drawContextFrame(kind, accent) {
    const frame = d3.select(root).select(".context-frame");
    if (contextFrameKind === kind && !frame.selectAll("*").empty()) return;
    contextFrameKind = kind;
    frame.selectAll("*").remove();
    const roughFrame = rough.svg(frame.node());

    appendRough(frame, roughFrame.rectangle(12, 12, 976, 236, {
      seed: stableSeed(`context-frame-${kind}`),
      stroke: "#263b39",
      strokeWidth: 2.1,
      roughness: 1.75,
      bowing: 1.3,
      fill: "none"
    }), "context-frame-line");

    appendRough(frame, roughFrame.rectangle(36, 25, 190, 19, {
      seed: stableSeed(`context-swatch-${kind}`),
      stroke: "none",
      fill: accent,
      fillStyle: "hachure",
      fillWeight: 1.15,
      hachureAngle: -7,
      hachureGap: 7,
      roughness: 1.3
    }), "context-frame-swatch");
  }

  function createContextChartShell(chart) {
    return {
      a11yTitle: chart.append("title").attr("class", "context-a11y-title"),
      a11yDescription: chart.append("desc").attr("class", "context-a11y-description")
    };
  }

  function buildEmptyContextChart(chart, width, height, label) {
    const shell = createContextChartShell(chart);
    chart.append("text")
      .attr("class", "context-empty-label")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text(label);
    return { ...shell, type: "empty" };
  }

  function buildEnsoGauge(chart, width, height) {
    const shell = createContextChartShell(chart);
    const roughChart = rough.svg(chart.node());
    const x = d3.scaleLinear().domain([-2.5, 2.5]).range([28, width - 28]).clamp(true);
    const top = 28;
    const gaugeHeight = 42;
    const zones = [
      { key: "la-nina", from: -2.5, to: -0.5, label: "LA NIÑA", fill: "#6d9dcc", angle: -45 },
      { key: "neutral", from: -0.5, to: 0.5, label: t("context.enso.neutral"), fill: "#d9d1ba", angle: -8 },
      { key: "el-nino", from: 0.5, to: 2.5, label: "EL NIÑO", fill: "#d87959", angle: 45 }
    ];

    zones.forEach(zone => {
      appendRough(chart, roughChart.rectangle(
        x(zone.from),
        top,
        x(zone.to) - x(zone.from),
        gaugeHeight,
        {
          seed: stableSeed(`enso-zone-${zone.key}`),
          stroke: "#334845",
          strokeWidth: 0.75,
          roughness: 1.3,
          bowing: 0.8,
          fill: zone.fill,
          fillStyle: "hachure",
          fillWeight: 0.75,
          hachureGap: 5.5,
          hachureAngle: zone.angle
        }
      ), `context-enso-zone is-${zone.key}`);

      chart.append("text")
        .attr("class", "context-zone-label")
        .attr("x", (x(zone.from) + x(zone.to)) / 2)
        .attr("y", 91)
        .attr("text-anchor", "middle")
        .text(zone.label);
    });

    [-0.5, 0.5].forEach((threshold, index) => {
      appendRough(chart, roughChart.line(x(threshold), top - 3, x(threshold), top + gaugeHeight + 5, {
        seed: stableSeed(`enso-threshold-${index}`),
        stroke: "#334845",
        strokeWidth: 0.8,
        roughness: 1.1,
        bowing: 0.6
      }), "context-threshold");
    });

    const markerLine = chart.append("g").attr("class", "context-year-marker");
    appendRough(markerLine, roughChart.line(0, 14, 0, top + gaugeHeight + 7, {
      seed: stableSeed("enso-marker"),
      stroke: "#172b2c",
      strokeWidth: 2,
      roughness: 1.55,
      bowing: 1
    }), "context-rough-marker");

    const markerDot = chart.append("g").attr("class", "context-current-point");
    appendRough(markerDot, roughChart.circle(0, 0, 14, {
      seed: stableSeed("enso-dot"),
      stroke: "#172b2c",
      strokeWidth: 1.6,
      fill: "#fffaf0",
      fillStyle: "solid",
      roughness: 1.7
    }), "context-marker-dot");

    const markerLabel = chart.append("text")
      .attr("class", "context-marker-label")
      .attr("y", 11)
      .attr("text-anchor", "middle");
    const emptyLabel = chart.append("text")
      .attr("class", "context-empty-label")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text(t("context.enso.gaugeBefore"));

    return {
      ...shell,
      type: "enso",
      x,
      markerLine,
      markerDot,
      markerLabel,
      emptyLabel,
      markerY: top + gaugeHeight / 2
    };
  }

  function updateEnsoGauge(renderState, current) {
    const visible = Boolean(current);
    renderState.markerLine.style("display", visible ? null : "none");
    renderState.markerDot.style("display", visible ? null : "none");
    renderState.markerLabel.style("display", visible ? null : "none");
    renderState.emptyLabel.style("display", visible ? "none" : null);
    if (!visible) return;

    const markerX = renderState.x(current.oni_mean);
    renderState.markerLine.attr("transform", `translate(${markerX},0)`);
    renderState.markerDot.attr("transform", `translate(${markerX},${renderState.markerY})`);
    renderState.markerLabel
      .attr("x", markerX)
      .text(signed(current.oni_mean, 2));
  }

  function buildRoughTrend(chart, rows, x, y, valueAccessor, options) {
    const { accent, seedKey, height, margin, formatEndpoint } = options;
    const shell = createContextChartShell(chart);
    const roughChart = rough.svg(chart.node());
    const baseline = height - margin.bottom;
    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(valueAccessor(d)))
      .curve(d3.curveMonotoneX);
    const area = d3.area()
      .x(d => x(d.year))
      .y0(baseline)
      .y1(d => y(valueAccessor(d)))
      .curve(d3.curveMonotoneX);

    const clipId = `context-reveal-${stableSeed(`${seedKey}-${state.lang}`)}`;
    const clipRect = chart.append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", margin.left - 4)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", height);
    const revealedLayer = chart.append("g")
      .attr("class", "context-revealed-trend")
      .attr("clip-path", `url(#${clipId})`);

    appendRough(revealedLayer, roughChart.path(area(rows), {
      seed: stableSeed(`${seedKey}-area`),
      stroke: accent,
      strokeWidth: 0.45,
      fill: accent,
      fillStyle: "hachure",
      fillWeight: 0.65,
      hachureGap: 6,
      hachureAngle: -42,
      roughness: 1.25,
      bowing: 0.7
    }), "context-rough-area");

    appendRough(revealedLayer, roughChart.path(line(rows), {
      seed: stableSeed(`${seedKey}-line`),
      stroke: accent,
      strokeWidth: 2,
      fill: "none",
      roughness: 1.45,
      bowing: 0.9
    }), "context-rough-line");

    drawContextTimeAxis(chart, x, height, margin, roughChart, seedKey);

    const first = rows[0];
    const firstEndpoint = chart.append("g").attr("class", "context-first-endpoint");
    appendRough(firstEndpoint, roughChart.circle(x(first.year), y(valueAccessor(first)), 7.5, {
      seed: stableSeed(`${seedKey}-endpoint-first`),
      stroke: accent,
      strokeWidth: 1.35,
      fill: "#fffaf0",
      fillStyle: "solid",
      roughness: 1.4
    }), "context-endpoint");
    firstEndpoint.append("text")
      .attr("class", "context-endpoint-label")
      .attr("x", x(first.year) + 5)
      .attr("y", Math.max(11, y(valueAccessor(first)) - 7))
      .attr("text-anchor", "start")
      .text(formatEndpoint(valueAccessor(first)));

    const markerLine = chart.append("g").attr("class", "context-year-marker");
    appendRough(markerLine, roughChart.line(0, margin.top, 0, baseline, {
      seed: stableSeed(`${seedKey}-year-marker`),
      stroke: "#203735",
      strokeWidth: 1.25,
      roughness: 1.55,
      bowing: 0.9
    }), "context-rough-marker");

    const currentPoint = chart.append("g").attr("class", "context-current-point");
    appendRough(currentPoint, roughChart.circle(0, 0, 7.5, {
      seed: stableSeed(`${seedKey}-endpoint-current`),
      stroke: accent,
      strokeWidth: 1.35,
      fill: "#fffaf0",
      fillStyle: "solid",
      roughness: 1.4
    }), "context-endpoint");
    const currentLabel = chart.append("text").attr("class", "context-endpoint-label context-current-label");

    return {
      ...shell,
      type: "trend",
      rows,
      x,
      y,
      valueAccessor,
      formatEndpoint,
      clipRect,
      firstEndpoint,
      markerLine,
      currentPoint,
      currentLabel
    };
  }

  function updateRoughTrendYear(renderState, year) {
    const current = contextRowAtOrBefore(renderState.rows, year);
    const visible = Boolean(current);
    renderState.firstEndpoint.style("display", visible ? null : "none");
    renderState.markerLine.style("display", visible ? null : "none");
    renderState.currentPoint.style("display", visible ? null : "none");
    renderState.currentLabel.style("display", visible ? null : "none");

    if (!visible) {
      renderState.clipRect.attr("width", 0);
      return;
    }

    const first = renderState.rows[0];
    const currentX = renderState.x(current.year);
    const currentY = renderState.y(renderState.valueAccessor(current));
    const revealStart = renderState.x(first.year) - 4;
    renderState.clipRect.attr("width", Math.max(0, currentX - revealStart + 4));
    renderState.markerLine.attr("transform", `translate(${currentX},0)`);

    const isFirst = current.year === first.year;
    renderState.currentPoint
      .style("display", isFirst ? "none" : null)
      .attr("transform", `translate(${currentX},${currentY})`);

    const [rangeStart, rangeEnd] = renderState.x.range();
    const alignEnd = currentX > rangeStart + (rangeEnd - rangeStart) * 0.72;
    renderState.currentLabel
      .style("display", isFirst ? "none" : null)
      .attr("x", currentX + (alignEnd ? -5 : 5))
      .attr("y", Math.max(11, currentY - 7))
      .attr("text-anchor", alignEnd ? "end" : "start")
      .text(renderState.formatEndpoint(renderState.valueAccessor(current)));
  }

  function drawContextTimeAxis(chart, x, height, margin, roughChart, seedKey) {
    const y = height - margin.bottom;
    const [start, end] = x.domain();
    appendRough(chart, roughChart.line(x(start), y, x(end), y, {
      seed: stableSeed(`${seedKey}-axis`),
      stroke: "#4c5c58",
      strokeWidth: 0.9,
      roughness: 1.25,
      bowing: 0.7
    }), "context-rough-axis");

    [start, end].forEach((year, index) => {
      appendRough(chart, roughChart.line(x(year), y - 3, x(year), y + 4, {
        seed: stableSeed(`${seedKey}-tick-${index}`),
        stroke: "#4c5c58",
        strokeWidth: 0.8,
        roughness: 1.15
      }), "context-rough-tick");
      chart.append("text")
        .attr("class", "context-axis-label")
        .attr("x", x(year))
        .attr("y", height - 5)
        .attr("text-anchor", index ? "end" : "start")
        .text(d3.format("d")(year));
    });
  }

  function drawPortraitSummarySketch(kind, accent) {
    const sketch = d3.select(root).select(".portrait-summary-sketch");
    sketch.selectAll("*").remove();
    const roughSketch = rough.svg(sketch.node());

    appendRough(sketch, roughSketch.rectangle(13, 13, 974, 334, {
      seed: stableSeed(`${kind}-portrait-summary-frame`),
      stroke: "rgba(31, 41, 40, 0.58)",
      strokeWidth: 1.3,
      roughness: 1.7,
      bowing: 1.15,
      fill: "rgba(255, 250, 240, 0.3)",
      fillStyle: "solid"
    }), "portrait-summary-frame");

    appendRough(sketch, roughSketch.line(505, 32, 505, 326, {
      seed: stableSeed(`${kind}-portrait-summary-divider`),
      stroke: "rgba(31, 41, 40, 0.3)",
      strokeWidth: 1,
      roughness: 1.9,
      bowing: 1.3
    }), "portrait-summary-divider");

    appendRough(sketch, roughSketch.rectangle(536, 31, 326, 25, {
      seed: stableSeed(`${kind}-portrait-summary-swatch`),
      stroke: "none",
      fill: accent,
      fillStyle: "hachure",
      fillWeight: 0.8,
      hachureAngle: -7,
      hachureGap: 7,
      roughness: 1.35
    }), "portrait-summary-swatch");
  }

  function drawPortraitShiftSpark(history, metric, title) {
    const spark = d3.select(root).select(".portrait-shift-spark");
    spark.selectAll("*").remove();
    const rows = state.indicator === "rain" ? history.cumulativeRows : history.rollingRows;
    const metricLabel = metricText(metric, "label");
    const sparkTitle = state.indicator === "rain"
      ? t("spark.rainTitle", { territory: title })
      : t("spark.shiftTitle", { metric: metricLabel, territory: title });
    spark.append("title").text(sparkTitle);
    const description = spark.append("desc").attr("class", "portrait-shift-spark-desc");
    if (!rows.length) {
      description.text(t("spark.insufficient"));
      panelRenderState.shiftSpark = null;
      return;
    }

    const width = 132;
    const height = 42;
    const margin = { top: 5, right: 5, bottom: 5, left: 5 };
    const x = d3.scaleLinear()
      .domain(d3.extent(rows, d => d.year))
      .range([margin.left, width - margin.right]);
    const values = rows.map(d => d.value).concat(0);
    const extent = d3.extent(values);
    const padding = Math.max((extent[1] - extent[0]) * 0.12, state.indicator === "rain" ? 4 : 0.12);
    const y = d3.scaleLinear()
      .domain([extent[0] - padding, extent[1] + padding])
      .range([height - margin.bottom, margin.top]);
    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);
    const roughSpark = rough.svg(spark.node());
    const clipId = "portrait-shift-history-clip";
    const progressClip = spark.append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top - 2)
      .attr("height", height - margin.top - margin.bottom + 4)
      .attr("width", 0);

    appendRough(spark, roughSpark.line(margin.left, y(0), width - margin.right, y(0), {
      seed: stableSeed(`${state.indicator}-${title}-shift-zero`),
      stroke: "rgba(31, 41, 40, 0.3)",
      strokeWidth: 0.7,
      roughness: 1.25,
      bowing: 0.8
    }), "portrait-shift-zero");

    appendRough(spark, roughSpark.path(line(rows), {
      seed: stableSeed(`${state.indicator}-${title}-shift-archive`),
      stroke: "#65736f",
      strokeWidth: 1,
      roughness: 1.3,
      bowing: 0.8,
      fill: "none",
      simplification: 0.25
    }), "portrait-shift-archive");

    const progressLine = appendRough(spark, roughSpark.path(line(rows), {
      seed: stableSeed(`${state.indicator}-${title}-shift-progress`),
      stroke: metricAccents[state.indicator],
      strokeWidth: 1.65,
      roughness: 1.45,
      bowing: 0.9,
      fill: "none",
      simplification: 0.22
    }), "portrait-shift-progress");
    progressLine.attr("clip-path", `url(#${clipId})`);

    appendRough(spark, roughSpark.circle(0, 0, 6, {
      seed: stableSeed(`${state.indicator}-${title}-shift-dot`),
      stroke: metricAccents[state.indicator],
      strokeWidth: 1.15,
      roughness: 1.5,
      fill: "#fffaf0",
      fillStyle: "solid"
    }), "portrait-shift-dot");

    panelRenderState.shiftSpark = {
      x,
      y,
      rows,
      rowsByYear: new Map(rows.map(d => [d.year, d])),
      bounds: [margin.left, width - margin.right],
      clip: progressClip,
      description
    };
  }

  function drawTerritoryFrame(kind, accent) {
    const frame = d3.select(root).select(".territory-frame");
    frame.selectAll("*").remove();
    const roughFrame = rough.svg(frame.node());

    appendRough(frame, roughFrame.rectangle(13, 13, 974, 1174, {
      seed: stableSeed(`territory-frame-${kind}`),
      stroke: "#263b39",
      strokeWidth: 2.1,
      roughness: 1.75,
      bowing: 1.3,
      fill: "none"
    }), "territory-frame-line");

    appendRough(frame, roughFrame.rectangle(40, 31, 245, 21, {
      seed: stableSeed(`territory-swatch-${kind}`),
      stroke: "none",
      fill: accent,
      fillStyle: "hachure",
      fillWeight: 1.1,
      hachureAngle: -7,
      hachureGap: 7,
      roughness: 1.3
    }), "territory-frame-swatch");
  }

  function drawTerritoryRibbon(rows, metric, title) {
    const ribbon = d3.select(root).select(".territory-ribbon");
    ribbon.selectAll("*").remove();
    const metricLabel = metricText(metric, "label");
    ribbon.attr("aria-label", rows.length
      ? t("ribbon.aria", { metric: metricLabel, territory: title })
      : t("ribbon.noneAria", { metric: metricLabel, territory: title }));
    ribbon.append("title").text(rows.length
      ? t("ribbon.archive", { metric: metricLabel, territory: title })
      : t("ribbon.noneArchive", { metric: metricLabel, territory: title }));
    ribbon.append("desc").text(rows.length
      ? t("ribbon.description")
      : t("ribbon.noneDescription"));
    if (!rows.length) return;

    const roughRibbon = mobileLite ? null : rough.svg(ribbon.node());
    const width = 310;
    const yearDomain = d3.extent(rows, d => d.year);
    const x = d3.scaleLinear().domain(yearDomain).range([7, width - 7]);
    const color = metricScale(metric);
    const stripeWidth = Math.max(1, x(rows[0].year + 1) - x(rows[0].year) + 0.45);

    const raster = appendRasterRibbon(ribbon, rows, {
      domain: yearDomain,
      color,
      x: 7,
      y: 12,
      width: width - 14,
      height: 30,
      className: "portrait-ribbon-raster"
    });
    if (!raster) {
      ribbon.selectAll("rect.portrait-stripe")
        .data(rows)
        .join("rect")
        .attr("class", "portrait-stripe")
        .attr("x", d => x(d.year))
        .attr("y", (_, i) => 12 + ((i % 5) - 2) * 0.18)
        .attr("width", stripeWidth)
        .attr("height", (_, i) => 30 + ((i % 4) - 1.5) * 0.24)
        .attr("fill", d => color(d.value));
    }

    ribbon.append("rect")
      .attr("class", "portrait-ribbon-future")
      .attr("y", 11)
      .attr("height", 32);

    if (mobileLite) {
      ribbon.append("rect")
        .attr("class", "portrait-ribbon-frame")
        .attr("x", 6).attr("y", 11)
        .attr("width", width - 12).attr("height", 32)
        .attr("fill", "none")
        .attr("stroke", "rgba(31, 41, 40, 0.72)");
    } else {
      appendRough(ribbon, roughRibbon.rectangle(6, 11, width - 12, 32, {
        seed: stableSeed(`${state.indicator}-${title}-portrait-frame`),
        stroke: "rgba(31, 41, 40, 0.72)",
        strokeWidth: 1.05,
        roughness: 2.25,
        bowing: 1.65,
        fill: "rgba(31, 41, 40, 0.12)",
        fillStyle: "hachure",
        hachureAngle: -8,
        hachureGap: 7,
        fillWeight: 0.45
      }), "portrait-ribbon-frame rough-ribbon-frame");
    }

    ribbon.append("text").attr("class", "portrait-ribbon-year").attr("x", 7).attr("y", 57).text(rows[0].year);
    ribbon.append("text").attr("class", "portrait-ribbon-year").attr("x", width - 7).attr("y", 57).attr("text-anchor", "end").text(rows.at(-1).year);

    if (mobileLite) {
      ribbon.append("line")
        .attr("class", "portrait-year-marker")
        .attr("x1", 0).attr("x2", 0).attr("y1", 7).attr("y2", 48)
        .attr("stroke", metricAccents[state.indicator])
        .attr("stroke-width", 1.55);
    } else {
      appendRough(ribbon, roughRibbon.line(0, 7, 0, 48, {
        seed: stableSeed(`${state.indicator}-${title}-ribbon-marker`),
        stroke: metricAccents[state.indicator],
        strokeWidth: 1.55,
        roughness: 1.8,
        bowing: 1.35
      }), "portrait-year-marker rough-year-marker");
    }

    panelRenderState.ribbonX = x;
    panelRenderState.ribbonBounds = [7, width - 7];
  }

  function drawRibbonWall() {
    const metric = metrics[state.indicator];
    const years = yearsByMetric.get(state.indicator);
    const color = metricScale(metric);
    const splitAt = mobileLite ? ribbonCodes.length : Math.ceil(ribbonCodes.length / 2);
    const stripX = mobileLite ? 110 : 145;
    const stripWidth = mobileLite ? 280 : 390;
    const stripHeight = 13;
    const roughWall = mobileLite ? null : rough.svg(ribbonWall.node());
    const roughFrameTemplates = mobileLite ? [] : d3.range(2).map(index => {
      const template = roughWall.rectangle(stripX, -1, stripWidth, stripHeight + 2, {
        seed: stableSeed(`${state.indicator}-atlas-template-${index}`),
        stroke: "rgba(31, 41, 40, 0.62)",
        strokeWidth: 0.8,
        roughness: 1.7,
        bowing: 1.15
      });
      template.setAttribute("class", "ribbon-frame rough-ribbon-frame");
      return template;
    });
    ribbonX = d3.scaleLinear().domain([years[0], years.at(-1)]).range([stripX, stripX + stripWidth]);
    const stripeWidth = Math.max(1, ribbonX(years[0] + 1) - ribbonX(years[0]) + 0.35);

    ribbonWall
      .attr("viewBox", mobileLite ? "0 0 420 650" : "0 0 1180 360")
      .selectAll("*").remove();

    d3.range(mobileLite ? 1 : 2).forEach(col => {
      const x0 = col === 0 ? (mobileLite ? 15 : 22) : 612;
      ribbonWall.append("text").attr("class", "ribbon-axis-year").attr("x", x0 + stripX).attr("y", 25).text(years[0]);
      ribbonWall.append("text").attr("class", "ribbon-axis-year").attr("x", x0 + stripX + stripWidth).attr("y", 25).attr("text-anchor", "end").text(years.at(-1));
    });

    const rows = ribbonWall.selectAll("g.ribbon-row")
      .data(ribbonCodes)
      .join("g")
      .attr("class", "ribbon-row")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", code => t("selection.select", { territory: territoryLabel(code) }))
      .attr("data-code", code => code)
      .attr("transform", (_, i) => {
        const col = mobileLite || i < splitAt ? 0 : 1;
        const row = col === 0 ? i : i - splitAt;
        return `translate(${col === 0 ? (mobileLite ? 15 : 22) : 612},${42 + row * 27})`;
      })
      .on("click", (_, code) => selectTerritory(code, { revealDetail: true }))
      .on("focus", (event, code) => {
        const values = byMetric.get(state.indicator)?.get(code) ?? [];
        showRibbonTooltip(event, code, closestRow(values, state.year), true);
      })
      .on("blur", hideRibbonTooltip)
      .on("keydown", (event, code) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectTerritory(code, { revealDetail: true });
        }
      });

    rows.append("rect")
      .attr("class", "ribbon-row-bg")
      .attr("x", -8).attr("y", -5)
      .attr("width", mobileLite ? 400 : 550).attr("height", 24)
      .attr("rx", 7);

    rows.append("text")
      .attr("class", "ribbon-territory")
      .attr("x", 0).attr("y", 10)
      .text(code => `${code}  ${territoryLabel(code)}`);

    rows.each(function(code) {
      const group = d3.select(this);
      const values = byMetric.get(state.indicator)?.get(code) ?? [];
      const raster = appendRasterRibbon(group, values, {
        domain: [years[0], years.at(-1)],
        color,
        x: stripX,
        y: 0,
        width: stripWidth,
        height: stripHeight,
        className: "ribbon-wall-raster"
      });
      if (raster || mobileLite) {
        if (!raster) {
          group.append("rect")
            .attr("class", "ribbon-wall-raster")
            .attr("x", stripX).attr("y", 0)
            .attr("width", stripWidth).attr("height", stripHeight)
            .attr("fill", "#dedbd0");
        }
        const inspectRow = event => closestRow(
          values,
          Math.round(ribbonX.invert(d3.pointer(event, this)[0]))
        );
        group.append("rect")
          .attr("class", "ribbon-band-hit")
          .attr("x", stripX).attr("y", 0)
          .attr("width", stripWidth).attr("height", stripHeight)
          .attr("fill", "transparent")
          .on("pointerenter pointermove", event => {
            const row = inspectRow(event);
            if (row) showRibbonTooltip(event, code, row);
          })
          .on("pointerleave", hideRibbonTooltip);
        if (mobileLite) {
          group.append("rect")
            .attr("class", "ribbon-frame")
            .attr("x", stripX).attr("y", -1)
            .attr("width", stripWidth).attr("height", stripHeight + 2)
            .attr("fill", "none")
            .attr("stroke", "rgba(31, 41, 40, 0.62)");
          group.append("line")
            .attr("class", "ribbon-wall-marker")
            .attr("x1", 0).attr("x2", 0)
            .attr("y1", -4).attr("y2", stripHeight + 4)
            .attr("stroke", "rgba(24, 47, 47, 0.88)")
            .attr("stroke-width", 1.05);
        } else {
          const roughFrame = roughFrameTemplates[stableSeed(code) % roughFrameTemplates.length].cloneNode(true);
          roughFrame.setAttribute("transform", `translate(0 ${((stableSeed(code) % 5) - 2) * 0.08})`);
          this.appendChild(roughFrame);
          appendRough(group, roughWall.line(0, -4, 0, stripHeight + 4, {
            seed: stableSeed(`${state.indicator}-${code}-atlas-marker`),
            stroke: "rgba(24, 47, 47, 0.88)",
            strokeWidth: 1.05,
            roughness: 1.7,
            bowing: 1.25
          }), "ribbon-wall-marker rough-year-marker");
        }
      } else {
        group.selectAll("rect.ribbon-stripe")
          .data(values)
          .join("rect")
          .attr("class", "ribbon-stripe")
          .attr("x", d => ribbonX(d.year))
          .attr("y", (_, i) => ((i % 5) - 2) * 0.12)
          .attr("width", stripeWidth)
          .attr("height", (_, i) => stripHeight + ((i % 4) - 1.5) * 0.18)
          .attr("fill", d => color(d.value))
          .on("pointerenter", (event, row) => showRibbonTooltip(event, code, row))
          .on("pointermove", (event, row) => showRibbonTooltip(event, code, row))
          .on("pointerleave", hideRibbonTooltip);
        const roughFrame = roughFrameTemplates[stableSeed(code) % roughFrameTemplates.length].cloneNode(true);
        roughFrame.setAttribute("transform", `translate(0 ${((stableSeed(code) % 5) - 2) * 0.08})`);
        this.appendChild(roughFrame);
        appendRough(group, roughWall.line(0, -4, 0, stripHeight + 4, {
          seed: stableSeed(`${state.indicator}-${code}-atlas-marker`),
          stroke: "rgba(24, 47, 47, 0.88)",
          strokeWidth: 1.05,
          roughness: 1.7,
          bowing: 1.25
        }), "ribbon-wall-marker rough-year-marker");
      }
    });

    ribbonSignature = `${state.indicator}:${state.lang}`;
    root.querySelector(".ribbon-wall-active").textContent = t("atlas.wallActive", {
      metric: metricText(metric, "label")
    });
    updateRibbonWallState();
    root.querySelector(".ribbon-atlas").classList.remove("is-updating");
  }

  function scheduleRibbonWall() {
    if (!atlasReady) return;
    window.clearTimeout(ribbonRenderTimer);
    root.querySelector(".ribbon-atlas").classList.add("is-updating");
    ribbonRenderTimer = window.setTimeout(() => {
      drawRibbonWall();
      ribbonRenderTimer = null;
    }, 0);
  }

  function updateRibbonWallState() {
    if (!ribbonX || ribbonSignature !== `${state.indicator}:${state.lang}`) return;
    const years = yearsByMetric.get(state.indicator);
    const inRange = state.year >= years[0] && state.year <= years.at(-1);
    ribbonWall.selectAll(".ribbon-row").classed("is-selected", code => code === state.selected);
    ribbonWall.selectAll(".ribbon-wall-marker")
      .attr("transform", `translate(${ribbonX(state.year)} 0)`)
      .attr("visibility", inRange ? "visible" : "hidden");
  }

  function ensureAtlasRendered() {
    if (atlasReady) return;
    atlasReady = true;
    const atlas = root.querySelector(".ribbon-atlas");
    atlas?.classList.remove("is-deferred");
    drawRibbonWall();
    renderRibbonDetail();
  }

  function setupDeferredAtlas() {
    if (atlasReady) return;
    const atlas = root.querySelector(".ribbon-atlas");
    if (!atlas) return;
    atlas.classList.add("is-deferred");
    atlas.addEventListener("focusin", ensureAtlasRendered, { once: true });
    atlas.addEventListener("pointerdown", ensureAtlasRendered, { once: true });
    if ("IntersectionObserver" in window) {
      const observer = new window.IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        ensureAtlasRendered();
      }, { rootMargin: "700px 0px" });
      observer.observe(atlas);
    } else {
      ensureAtlasRendered();
    }
  }

  function scheduleRibbonTooltipPosition(event, keyboard) {
    const targetBounds = event.currentTarget?.getBoundingClientRect?.();
    const pointerX = keyboard ? targetBounds?.left + targetBounds?.width / 2 : event.clientX;
    const pointerY = keyboard ? targetBounds?.top + targetBounds?.height / 2 : event.clientY;
    ribbonTooltipPoint = { x: pointerX ?? 20, y: pointerY ?? 20 };
    if (ribbonTooltipFrame !== null) return;
    ribbonTooltipFrame = window.requestAnimationFrame(() => {
      ribbonTooltipFrame = null;
      if (!ribbonTooltipPoint || ribbonTooltip.hidden) return;
      const size = ribbonTooltipSize ?? { width: 240, height: 120 };
      const left = Math.max(10, Math.min(ribbonTooltipPoint.x + 14, window.innerWidth - size.width - 12));
      const top = Math.max(10, Math.min(ribbonTooltipPoint.y + 14, window.innerHeight - size.height - 12));
      ribbonTooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    });
  }

  function showRibbonTooltip(event, code, row, keyboard = false, metricKey = state.indicator) {
    const contentKey = `${state.lang}:${metricKey}:${code}:${row?.year ?? "none"}`;
    if (contentKey !== ribbonTooltipContentKey) {
      const metric = metrics[metricKey];
      const rainReading = metricKey === "rain" && row
        ? t({
            wetter: "rain.class.wetter",
            drier: "rain.class.drier",
            near: "rain.class.near"
          }[rainClass(row)])
        : "";
      ribbonTooltip.innerHTML = `
        <strong>${territoryLabel(code)}</strong>
        <span>${metricText(metric, "label")}</span>
        <b>${row ? formatValue(row.value, metric) : t("common.noData")}</b>
        <small>${row ? `${row.year}${rainReading ? ` · ${rainReading}` : ""}` : t("atlas.detailNoObservation")}</small>`;
      ribbonTooltipContentKey = contentKey;
      const layoutKey = `${state.lang}:${metricKey}:${code}`;
      ribbonTooltip.hidden = false;
      if (!ribbonTooltipSize || layoutKey !== ribbonTooltipLayoutKey) {
        ribbonTooltipSize = {
          width: Math.min(240, Math.max(190, window.innerWidth - 24)),
          height: 112
        };
        ribbonTooltipLayoutKey = layoutKey;
      }

      if (state.compared && (code === state.selected || code === state.compared) && row) {
        updateRibbonComparisonReading(row, metricKey, code);
      } else if (code === state.selected && row) {
        updateRibbonDetailReading(row, metricKey);
      }
    }
    ribbonTooltip.hidden = false;
    scheduleRibbonTooltipPosition(event, keyboard);
  }

  function hideRibbonTooltip() {
    if (ribbonTooltipFrame !== null) {
      window.cancelAnimationFrame(ribbonTooltipFrame);
      ribbonTooltipFrame = null;
    }
    ribbonTooltipPoint = null;
    ribbonTooltipContentKey = null;
    ribbonTooltip.hidden = true;
    updateRibbonDetailYear();
    updateRibbonComparisonYear();
  }

  function updateRibbonDetailReading(row, metricKey = state.indicator) {
    const metric = metrics[metricKey];
    const value = root.querySelector(".ribbon-detail-value");
    const year = root.querySelector(".ribbon-detail-year");
    if (!row) {
      value.textContent = `${metricText(metric, "tab")} · ${t("common.noData")}`;
      year.textContent = t("atlas.detailNoObservation");
      return;
    }
    const rainReading = metricKey === "rain"
      ? t({
          wetter: "rain.class.wetter",
          drier: "rain.class.drier",
          near: "rain.class.near"
        }[rainClass(row)])
      : "";
    value.textContent = `${metricText(metric, "tab")} · ${formatValue(row.value, metric)}`;
    year.textContent = `${row.year}${rainReading ? ` · ${rainReading}` : ""}`;
  }

  function updateRibbonComparisonReading(row, metricKey = state.indicator, code = state.compared) {
    if (!state.compared) return;
    const metric = metrics[metricKey];
    const value = root.querySelector(".ribbon-comparison-value");
    const year = root.querySelector(".ribbon-comparison-year");
    if (!row) {
      value.textContent = `${metricText(metric, "tab")} · ${t("common.noData")}`;
      year.textContent = t("atlas.detailNoObservation");
      return;
    }
    const rainReading = metricKey === "rain"
      ? t({
          wetter: "rain.class.wetter",
          drier: "rain.class.drier",
          near: "rain.class.near"
        }[rainClass(row)])
      : "";
    value.textContent = `${territoryLabel(code)} · ${metricText(metric, "tab")} · ${formatValue(row.value, metric)}`;
    year.textContent = `${row.year}${rainReading ? ` · ${rainReading}` : ""}`;
  }

  function updateRibbonDetailYear() {
    if (!ribbonDetailState) return;
    const { seriesByMetric, x } = ribbonDetailState;
    ribbonDetail.selectAll(".ribbon-detail-metric-row")
      .classed("is-active-metric", d => d.metricKey === state.indicator)
      .each(function(d) {
        const group = d3.select(this);
        const series = seriesByMetric.get(d.metricKey);
        const inRange = state.year >= ribbonYearDomain[0] && state.year <= ribbonYearDomain[1];
        group.select(".ribbon-detail-marker")
          .attr("transform", `translate(${x(state.year)},0)`)
          .attr("visibility", inRange ? "visible" : "hidden");
      });
    ribbonDetail.selectAll(".ribbon-detail-stripe")
      .classed("is-current", stripe => stripe.year === state.year);
    const activeSeries = seriesByMetric.get(state.indicator);
    updateRibbonDetailReading(activeSeries?.rowsByYear.get(state.year) ?? null, state.indicator);
  }

  function updateRibbonComparisonYear() {
    if (!ribbonComparisonState || !state.compared) return;
    const { seriesByMetric, x } = ribbonComparisonState;
    ribbonComparison.selectAll(".ribbon-detail-metric-row")
      .classed("is-active-metric", d => d.metricKey === state.indicator)
      .each(function() {
        const inRange = state.year >= ribbonYearDomain[0] && state.year <= ribbonYearDomain[1];
        d3.select(this).select(".ribbon-detail-marker")
          .attr("transform", `translate(${x(state.year)},0)`)
          .attr("visibility", inRange ? "visible" : "hidden");
      });
    ribbonComparison.selectAll(".ribbon-detail-stripe")
      .classed("is-current", stripe => stripe.year === state.year);
    const activePair = seriesByMetric.get(state.indicator);
    const primaryRow = activePair?.primary.rowsByYear.get(state.year) ?? null;
    const secondaryRow = activePair?.secondary.rowsByYear.get(state.year) ?? null;
    const metric = metrics[state.indicator];
    root.querySelector(".ribbon-comparison-value").textContent = `${metricText(metric, "tab")} · ${territoryLabel(state.selected)} ${formatValue(primaryRow?.value, metric)} ↔ ${territoryLabel(state.compared)} ${formatValue(secondaryRow?.value, metric)}`;
    root.querySelector(".ribbon-comparison-year").textContent = `${state.year} · ${t("comparison.sameScale")}`;
  }

  function summarizeIndicatorEvolution(rows, metricKey) {
    const metric = metrics[metricKey];
    if (metricKey === "rain") {
      if (rows.length < 20) {
        return { category: "noData", text: t("atlas.evolutionNotEnough") };
      }
      const recent = rows.slice(-10);
      const previous = rows.slice(-20, -10);
      const shift = d3.mean(recent, row => row.value) - d3.mean(previous, row => row.value);
      const spread = d3.deviation(recent, row => row.value) ?? 0;
      const threshold = Math.max(3, spread * 0.35);
      const category = shift > threshold
        ? "wetter"
        : shift < -threshold
          ? "drier"
          : spread >= 5
            ? "variable"
            : "stable";
      const key = {
        wetter: "atlas.evolutionRainWetter",
        drier: "atlas.evolutionRainDrier",
        variable: "atlas.evolutionRainVariable",
        stable: "atlas.evolutionRainStable"
      }[category];
      return {
        category,
        shift,
        text: t(key, { value: signed(shift, 0) })
      };
    }

    const history = buildPortraitHistory(rows, metricKey);
    const latest = rows.at(-1);
    const summary = latest ? history.summaryByYear.get(latest.year) : null;
    if (!summary?.ready) {
      return { category: "noData", text: t("atlas.evolutionNotEnough") };
    }
    const threshold = metricKey === "sea_level" ? 0.75 : 0.15;
    const category = summary.shift > threshold ? "up" : summary.shift < -threshold ? "down" : "stable";
    const digits = metricKey === "sea_level" ? 0 : 1;
    const icon = category === "up" ? "↗" : category === "down" ? "↘" : "→";
    const currentWindow = summary.currentWindow;
    return {
      category,
      shift: summary.shift,
      text: t("atlas.evolutionDecade", {
        icon,
        value: signed(summary.shift, digits),
        unit: metric.unit,
        baseline: `${history.baselineStart}—${history.baselineEnd}`,
        current: `${currentWindow[0].year}—${currentWindow.at(-1).year}`
      })
    };
  }

  function territorySummary(title, series) {
    const evolution = new Map(series.map(item => [item.metricKey, item.evolution]));
    const ocean = evolution.get("ocean")?.category;
    const land = evolution.get("land")?.category;
    const clauses = [];

    if (ocean === "up" && land === "up") {
      clauses.push(t("atlas.summaryWarmingBoth"));
    } else {
      if (ocean && ocean !== "noData") {
        clauses.push(t({ up: "atlas.summaryOceanUp", down: "atlas.summaryOceanDown", stable: "atlas.summaryOceanStable" }[ocean]));
      }
      if (land && land !== "noData") {
        clauses.push(t({ up: "atlas.summaryLandUp", down: "atlas.summaryLandDown", stable: "atlas.summaryLandStable" }[land]));
      }
    }

    const rain = evolution.get("rain")?.category;
    if (rain && rain !== "noData") {
      clauses.push(t({
        wetter: "atlas.summaryRainWetter",
        drier: "atlas.summaryRainDrier",
        variable: "atlas.summaryRainVariable",
        stable: "atlas.summaryRainStable"
      }[rain]));
    }

    const sea = evolution.get("sea_level")?.category;
    if (sea && sea !== "noData") {
      clauses.push(t({ up: "atlas.summarySeaUp", down: "atlas.summarySeaDown", stable: "atlas.summarySeaStable" }[sea]));
    }

    return t("atlas.summaryLead", {
      territory: title,
      sentence: clauses.join("; ") || t("atlas.summaryNoData")
    });
  }

  function portraitSignalItems(series) {
    const evolution = new Map(series.map(item => [item.metricKey, item.evolution]));
    const ocean = evolution.get("ocean");
    const land = evolution.get("land");
    const heatParts = [];
    if (ocean?.category === "up" && land?.category === "up") {
      heatParts.push(t("atlas.summaryWarmingBoth"));
    } else {
      if (ocean?.category && ocean.category !== "noData") {
        heatParts.push(t({ up: "atlas.summaryOceanUp", down: "atlas.summaryOceanDown", stable: "atlas.summaryOceanStable" }[ocean.category]));
      }
      if (land?.category && land.category !== "noData") {
        heatParts.push(t({ up: "atlas.summaryLandUp", down: "atlas.summaryLandDown", stable: "atlas.summaryLandStable" }[land.category]));
      }
    }

    const rain = evolution.get("rain");
    const rainSentence = rain?.category && rain.category !== "noData"
      ? t({
          wetter: "atlas.summaryRainWetter",
          drier: "atlas.summaryRainDrier",
          variable: "atlas.summaryRainVariable",
          stable: "atlas.summaryRainStable"
        }[rain.category])
      : "";
    const sea = evolution.get("sea_level");
    const seaSentence = sea?.category && sea.category !== "noData"
      ? t({ up: "atlas.summarySeaUp", down: "atlas.summarySeaDown", stable: "atlas.summarySeaStable" }[sea.category])
      : "";

    return [
      {
        key: "heat",
        title: t("conclusion.heat"),
        sentence: heatParts.join("; ") || t("conclusion.noData"),
        detail: [ocean?.text, land?.text].filter(Boolean).join(" · ") || t("atlas.evolutionNotEnough"),
        status: ocean?.category === "up" || land?.category === "up" ? "up" : ocean?.category ?? land?.category ?? "noData"
      },
      {
        key: "rain",
        title: t("conclusion.rain"),
        sentence: rainSentence || t("conclusion.noData"),
        detail: rain?.text || t("atlas.evolutionNotEnough"),
        status: rain?.category ?? "noData"
      },
      {
        key: "sea",
        title: t("conclusion.sea"),
        sentence: seaSentence || t("conclusion.noData"),
        detail: sea?.text || t("atlas.evolutionNotEnough"),
        status: sea?.category ?? "noData"
      }
    ];
  }

  function updatePortraitConclusion(title, series) {
    const sentenceCase = value => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
    portraitSignalItems(series).forEach(item => {
      const card = root.querySelector(`.conclusion-card[data-conclusion="${item.key}"]`);
      if (!card) return;
      card.dataset.status = item.status;
      card.querySelector("p").textContent = sentenceCase(item.sentence);
      card.querySelector("small").textContent = item.detail;
    });

    root.querySelector("#story-conclusion-title").textContent = t("conclusion.title", { territory: title });
  }

  function canvasRoundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function wrapCanvasText(context, value, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(value).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    const visibleLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let finalLine = visibleLines[maxLines - 1];
      while (context.measureText(`${finalLine}…`).width > maxWidth && finalLine.length > 1) {
        finalLine = finalLine.slice(0, -1);
      }
      visibleLines[maxLines - 1] = `${finalLine.trim()}…`;
    }
    visibleLines.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
    return y + visibleLines.length * lineHeight;
  }

  async function exportTerritoryPortrait() {
    const button = root.querySelector(".portrait-export");
    const originalLabel = t("atlas.export");
    button.disabled = true;
    button.textContent = t("atlas.exportPreparing");

    try {
      const title = territoryLabel(state.selected);
      const series = ribbonMetricKeys.map(metricKey => {
        const rows = [...(byMetric.get(metricKey)?.get(state.selected) ?? [])]
          .sort((a, b) => d3.ascending(a.year, b.year));
        return {
          metricKey,
          metric: metrics[metricKey],
          rows,
          evolution: summarizeIndicatorEvolution(rows, metricKey)
        };
      });
      const signals = portraitSignalItems(series);
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = 1540;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      if (document.fonts?.load) {
        await document.fonts.load('700 70px "Cabin Sketch"').catch(() => undefined);
      }
      const roughExport = rough.canvas(canvas);

      context.fillStyle = "#f3eddf";
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (let y = 32; y < canvas.height; y += 32) {
        roughExport.line(0, y, canvas.width, y + 4, {
          seed: stableSeed(`${state.selected}-paper-${y}`),
          stroke: "rgba(31, 41, 40, 0.035)",
          strokeWidth: 0.8,
          roughness: 1.25,
          bowing: 0.8
        });
      }
      // Rough Canvas treats `fill: "none"` as a hachure color; omit fill for an outline-only frame.
      roughExport.rectangle(72, 48, 1656, 1434, {
        seed: stableSeed(`${state.selected}-export-outer-frame`),
        stroke: "rgba(31, 41, 40, 0.58)",
        strokeWidth: 2.4,
        roughness: 1.8,
        bowing: 1.3
      });

      context.fillStyle = "#356b6b";
      context.font = '800 24px "Segoe Print", "Bradley Hand", cursive';
      context.fillText(t("header.eyebrow"), 110, 88);
      context.fillStyle = "#1f2928";
      context.font = '700 70px "Cabin Sketch", sans-serif';
      context.fillText(title, 110, 170);
      context.fillStyle = "#356b6b";
      context.font = '700 27px "Segoe Print", "Bradley Hand", cursive';
      context.fillText(t("header.formulaResult"), 112, 214);
      roughExport.line(108, 229, 710, 226, {
        seed: stableSeed(`${state.selected}-export-title-underline`),
        stroke: "rgba(53, 107, 107, 0.72)",
        strokeWidth: 2.2,
        roughness: 1.7,
        bowing: 1.35
      });

      context.fillStyle = "rgba(255, 250, 240, 0.82)";
      canvasRoundRect(context, 104, 250, 1592, 112, 20);
      context.fill();
      roughExport.rectangle(104, 250, 1592, 112, {
        seed: stableSeed(`${state.selected}-export-summary`),
        stroke: "rgba(31, 41, 40, 0.42)",
        strokeWidth: 1.8,
        roughness: 1.65,
        bowing: 1.15,
        fill: "rgba(53, 107, 107, 0.1)",
        fillStyle: "hachure",
        fillWeight: 1.05,
        hachureAngle: -42,
        hachureGap: 13
      });
      context.fillStyle = "#34433f";
      context.font = "700 29px Georgia, serif";
      wrapCanvasText(context, territorySummary(title, series), 138, 300, 1520, 38, 2);

      context.fillStyle = "#356b6b";
      context.font = '800 20px "Segoe Print", "Bradley Hand", cursive';
      context.fillText(t("conclusion.kicker"), 110, 405);
      const signalAccents = ["#a64b45", "#2474a6", "#416f96"];
      signals.forEach((signal, index) => {
        const x = 104 + index * 532;
        const y = 430;
        const cardWidth = 506;
        context.fillStyle = "rgba(255, 250, 240, 0.86)";
        canvasRoundRect(context, x, y, cardWidth, 174, 18);
        context.fill();
        roughExport.rectangle(x, y, cardWidth, 174, {
          seed: stableSeed(`${state.selected}-${signal.key}-export-card`),
          stroke: "rgba(31, 41, 40, 0.46)",
          strokeWidth: 1.8,
          roughness: 1.8,
          bowing: 1.3,
          fill: `${signalAccents[index]}1c`,
          fillStyle: "hachure",
          fillWeight: 1.15,
          hachureAngle: index % 2 ? 42 : -42,
          hachureGap: 11
        });
        context.fillStyle = signalAccents[index];
        context.fillRect(x, y, cardWidth, 7);
        roughExport.line(x + 2, y + 8, x + cardWidth - 2, y + 6, {
          seed: stableSeed(`${state.selected}-${signal.key}-export-swatch`),
          stroke: signalAccents[index],
          strokeWidth: 2.2,
          roughness: 1.65,
          bowing: 1.2
        });
        context.fillStyle = "#34433f";
        context.font = '700 27px "Cabin Sketch", sans-serif';
        context.fillText(signal.title, x + 24, y + 45);
        context.fillStyle = "#34433f";
        context.font = "700 20px Georgia, serif";
        wrapCanvasText(context, signal.sentence, x + 24, y + 78, cardWidth - 48, 27, 2);
        context.fillStyle = signalAccents[index];
        context.font = '700 16px "Segoe Print", "Bradley Hand", cursive';
        wrapCanvasText(context, signal.detail, x + 24, y + 140, cardWidth - 48, 21, 2);
      });

      const bandStart = 470;
      const bandEnd = 1660;
      const bandWidth = bandEnd - bandStart;
      const domainStart = ribbonYearDomain[0];
      const domainEnd = ribbonYearDomain[1];
      series.forEach((item, index) => {
        const y = 665 + index * 180;
        const color = metricScale(item.metric);
        context.fillStyle = "#1f2928";
        context.font = '700 31px "Cabin Sketch", sans-serif';
        context.fillText(metricText(item.metric, "tab"), 112, y + 34);
        context.fillStyle = metricAccents[item.metricKey];
        context.font = '700 18px "Segoe Print", "Bradley Hand", cursive';
        wrapCanvasText(context, item.evolution.text, 112, y + 66, 315, 24, 3);

        context.fillStyle = "rgba(255, 253, 247, 0.9)";
        canvasRoundRect(context, bandStart, y - 42, bandWidth, 30, 7);
        context.fill();
        roughExport.rectangle(bandStart, y - 42, bandWidth, 30, {
          seed: stableSeed(`${state.selected}-${item.metricKey}-export-colour-key`),
          stroke: "rgba(53, 76, 72, 0.42)",
          strokeWidth: 1,
          roughness: 1.25,
          bowing: 0.9
        });
        item.metric.colors.forEach((swatch, swatchIndex) => {
          context.fillStyle = swatch;
          context.fillRect(bandStart + 12 + swatchIndex * 17, y - 33, 17, 11);
        });
        context.fillStyle = "#52615d";
        context.font = '700 16px "Segoe Print", "Bradley Hand", cursive';
        context.fillText(metricColorScaleText(item.metric), bandStart + 74, y - 22);

        context.fillStyle = "rgba(31, 41, 40, 0.08)";
        context.fillRect(bandStart, y, bandWidth, 72);
        const yearWidth = bandWidth / (domainEnd - domainStart + 1);
        item.rows.forEach(row => {
          context.fillStyle = color(row.value);
          context.fillRect(
            bandStart + (row.year - domainStart) * yearWidth,
            y,
            Math.max(2, yearWidth + 0.5),
            72
          );
        });
        roughExport.rectangle(bandStart, y, bandWidth, 72, {
          seed: stableSeed(`${state.selected}-${item.metricKey}-export-band`),
          stroke: "rgba(31, 41, 40, 0.62)",
          strokeWidth: 1.8,
          roughness: 1.75,
          bowing: 1.25,
          fill: "rgba(31, 41, 40, 0.13)",
          fillStyle: "hachure",
          fillWeight: 0.9,
          hachureAngle: index % 2 ? 44 : -44,
          hachureGap: 10
        });
        context.fillStyle = "#65706c";
        context.font = '700 18px "Segoe Print", "Bradley Hand", cursive';
        context.textAlign = "left";
        context.fillText(String(domainStart), bandStart, y + 105);
        context.textAlign = "center";
        context.fillText(t("ribbon.timeAxis"), (bandStart + bandEnd) / 2, y + 105);
        context.textAlign = "right";
        context.fillText(String(domainEnd), bandEnd, y + 105);
        context.textAlign = "left";
      });

      roughExport.line(110, 1380, 1690, 1380, {
        seed: stableSeed(`${state.selected}-export-footer`),
        stroke: "rgba(53, 107, 107, 0.5)",
        strokeWidth: 1.5,
        roughness: 1.55,
        bowing: 1
      });
      context.fillStyle = "#52615d";
      context.font = "20px Georgia, serif";
      wrapCanvasText(context, t("conclusion.caveat"), 112, 1419, 1570, 28, 2);
      context.fillStyle = "#356b6b";
      context.font = '700 18px "Segoe Print", "Bradley Hand", cursive';
      context.fillText(t("atlas.exportFooter"), 112, 1500);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error("png")), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pacific-climate-fingerprint-${state.selected.toLowerCase()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      button.textContent = t("atlas.exportReady");
    } catch (error) {
      console.error(error);
      button.textContent = t("atlas.exportError");
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
      }, 1700);
    }
  }

  function seriesForTerritory(code) {
    return ribbonMetricKeys.map(metricKey => {
      const rows = [...(byMetric.get(metricKey)?.get(code) ?? [])]
        .sort((a, b) => d3.ascending(a.year, b.year));
      return {
        metricKey,
        metric: metrics[metricKey],
        rows,
        rowsByYear: new Map(rows.map(row => [row.year, row])),
        years: yearsByMetric.get(metricKey),
        evolution: summarizeIndicatorEvolution(rows, metricKey)
      };
    });
  }

  function comparisonHeatSignal(series) {
    const evolution = new Map(series.map(item => [item.metricKey, item.evolution.category]));
    const ocean = evolution.get("ocean");
    const land = evolution.get("land");
    if (ocean === "noData" && land === "noData") return t("comparison.category.noData");
    if (ocean === "up" && land === "up") return t("comparison.heatBothUp");
    if (ocean === "up" || land === "up") return t("comparison.heatOneUp");
    if (ocean === "stable" && land === "stable") return t("comparison.heatStable");
    return t("comparison.heatMixed");
  }

  function comparisonCategorySignal(series, metricKey) {
    const category = series.find(item => item.metricKey === metricKey)?.evolution.category ?? "noData";
    return t(`comparison.category.${category}`);
  }

  function updateComparisonContrast(primarySeries, secondarySeries) {
    if (!state.compared) return;
    const primary = territoryLabel(state.selected);
    const secondary = territoryLabel(state.compared);
    root.querySelector(".comparison-contrast-title").textContent = t("comparison.contrastTitle", { primary, secondary });
    root.querySelector('[data-contrast="heat"]').textContent = t("comparison.heatCompare", {
      primary,
      secondary,
      primarySignal: comparisonHeatSignal(primarySeries),
      secondarySignal: comparisonHeatSignal(secondarySeries)
    });
    root.querySelector('[data-contrast="rain"]').textContent = t("comparison.rainCompare", {
      primary,
      secondary,
      primarySignal: comparisonCategorySignal(primarySeries, "rain"),
      secondarySignal: comparisonCategorySignal(secondarySeries, "rain")
    });
    root.querySelector('[data-contrast="sea"]').textContent = t("comparison.seaCompare", {
      primary,
      secondary,
      primarySignal: comparisonCategorySignal(primarySeries, "sea_level"),
      secondarySignal: comparisonCategorySignal(secondarySeries, "sea_level")
    });
  }

  function renderRibbonComparison(primarySeries = null) {
    const section = root.querySelector(".ribbon-comparison");
    const detailPanel = root.querySelector(".ribbon-detail");
    const detailKicker = detailPanel.querySelector(".ribbon-detail-heading .panel-kicker");
    const detailTitle = root.querySelector(".ribbon-detail-title");
    const detailMetric = root.querySelector(".ribbon-detail-metric");
    if (!state.compared) {
      section.hidden = true;
      detailPanel.classList.remove("is-comparing");
      detailKicker.textContent = t("atlas.detailKicker");
      detailTitle.textContent = territoryLabel(state.selected);
      detailMetric.textContent = t("atlas.detailMetric");
      ribbonComparison.selectAll("*").remove();
      ribbonComparisonState = null;
      return;
    }

    const primaryTitle = territoryLabel(state.selected);
    const secondaryTitle = territoryLabel(state.compared);
    const primary = primarySeries ?? seriesForTerritory(state.selected);
    const secondary = seriesForTerritory(state.compared);
    const primaryByMetric = new Map(primary.map(item => [item.metricKey, item]));
    const secondaryByMetric = new Map(secondary.map(item => [item.metricKey, item]));
    const pairs = ribbonMetricKeys.map(metricKey => ({
      metricKey,
      metric: metrics[metricKey],
      primary: primaryByMetric.get(metricKey),
      secondary: secondaryByMetric.get(metricKey)
    }));
    const seriesByMetric = new Map(pairs.map(item => [item.metricKey, item]));
    const width = mobileLite ? 440 : 1100;
    const stripX = mobileLite ? 150 : 260;
    const stripRight = width - (mobileLite ? 12 : 30);
    const stripHeight = 30;
    const rowStart = 46;
    const rowGap = 148;
    const x = d3.scaleLinear().domain(ribbonYearDomain).range([stripX, stripRight]);
    const stripeWidth = Math.max(2, x(ribbonYearDomain[0] + 1) - x(ribbonYearDomain[0]) + 0.5);
    const roughComparison = mobileLite ? null : rough.svg(ribbonComparison.node());

    section.hidden = false;
    detailPanel.classList.add("is-comparing");
    detailKicker.textContent = t("comparison.kicker");
    detailTitle.textContent = t("comparison.contrastTitle", { primary: primaryTitle, secondary: secondaryTitle });
    detailMetric.textContent = t("comparison.metric");
    root.querySelector(".ribbon-comparison-caption").textContent = t("atlas.detailCompareCaption");
    updateComparisonContrast(primary, secondary);

    ribbonComparison.selectAll("*").remove();
    ribbonComparison
      .attr("viewBox", `0 0 ${width} 640`)
      .attr("aria-label", t("comparison.pairedAria", { primary: primaryTitle, secondary: secondaryTitle }));
    ribbonComparison.append("title").text(t("comparison.pairedAria", { primary: primaryTitle, secondary: secondaryTitle }));
    ribbonComparison.append("desc").text(t("comparison.guide"));
    ribbonComparison.append("text")
      .attr("class", "ribbon-detail-axis-label")
      .attr("x", stripX).attr("y", 23)
      .text(ribbonYearDomain[0]);
    ribbonComparison.append("text")
      .attr("class", "ribbon-detail-axis-label")
      .attr("x", stripRight).attr("y", 23)
      .attr("text-anchor", "end")
      .text(ribbonYearDomain[1]);
    ribbonComparison.append("text")
      .attr("class", "ribbon-detail-axis-label ribbon-detail-axis-caption")
      .attr("x", (stripX + stripRight) / 2).attr("y", 23)
      .attr("text-anchor", "middle")
      .text(t("ribbon.timeAxis"));

    const metricRows = ribbonComparison.selectAll("g.ribbon-detail-metric-row")
      .data(pairs)
      .join("g")
      .attr("class", d => `ribbon-detail-metric-row${d.metricKey === state.indicator ? " is-active-metric" : ""}`)
      .attr("data-indicator", d => d.metricKey)
      .attr("transform", (_, index) => `translate(0,${rowStart + index * rowGap})`);

    metricRows.append("rect")
      .attr("class", "ribbon-detail-row-bg comparison-pair-bg")
      .attr("x", 8).attr("y", -10)
      .attr("width", width - 16).attr("height", 136)
      .attr("rx", 10);
    metricRows.append("text")
      .attr("class", "ribbon-detail-row-title")
      .attr("x", 20).attr("y", 12)
      .text(d => `${metricText(d.metric, "tab")} · ${d.metric.unit}`);

    metricRows.each(function(d) {
      const group = d3.select(this);
      const color = metricScale(d.metric);
      if (!mobileLite) {
        appendRough(group, roughComparison.rectangle(8, -10, width - 16, 136, {
          seed: stableSeed(`${d.metricKey}-comparison-row`),
          stroke: "rgba(53, 76, 72, 0.32)",
          strokeWidth: 0.9,
          roughness: 1.55,
          bowing: 1.1,
          fill: "none"
        }), "chart-sketch-frame comparison-row-sketch");
      }
      const lanes = [
        { key: "primary", code: state.selected, title: primaryTitle, series: d.primary, y: 25 },
        { key: "secondary", code: state.compared, title: secondaryTitle, series: d.secondary, y: 72 }
      ];

      lanes.forEach(laneData => {
        const lane = group.append("g")
          .datum(laneData)
          .attr("class", `comparison-country-lane comparison-country-lane-${laneData.key}`)
          .attr("role", "button")
          .attr("tabindex", 0)
          .attr("aria-label", `${laneData.title}. ${metricText(d.metric, "label")}. ${laneData.series.evolution.text}`);
        lane.append("text")
          .attr("class", "comparison-country-label")
          .attr("x", 20).attr("y", laneData.y + 10)
          .text(`${laneData.title} · ${laneData.code}`);
        lane.append("foreignObject")
          .attr("class", "comparison-pair-evolution-fo")
          .attr("x", 20).attr("y", laneData.y + 12)
          .attr("width", mobileLite ? 120 : 222).attr("height", 28)
          .append("xhtml:div")
          .attr("class", `comparison-pair-evolution is-${laneData.series.evolution.category}`)
          .text(laneData.series.evolution.text);
        lane.append("rect")
          .attr("class", "ribbon-detail-band-bg")
          .attr("x", stripX).attr("y", laneData.y)
          .attr("width", stripRight - stripX).attr("height", stripHeight);
        const raster = appendRasterRibbon(lane, laneData.series.rows, {
          domain: ribbonYearDomain,
          color,
          x: stripX,
          y: laneData.y,
          width: stripRight - stripX,
          height: stripHeight,
          className: "ribbon-detail-raster"
        });
        const laneStripes = raster
          ? d3.select(null)
          : lane.selectAll("rect.ribbon-detail-stripe")
            .data(laneData.series.rows)
            .join("rect")
            .attr("class", "ribbon-detail-stripe")
            .attr("x", row => x(row.year))
            .attr("y", (_, index) => laneData.y + ((index % 5) - 2) * 0.16)
            .attr("width", stripeWidth)
            .attr("height", (_, index) => stripHeight + ((index % 4) - 1.5) * 0.2)
            .attr("fill", row => color(row.value));
        const laneStripeByYear = new Map();
        laneStripes.each(function(row) {
          laneStripeByYear.set(row.year, this);
        });
        if (mobileLite) {
          lane.append("rect")
            .attr("class", "ribbon-detail-frame")
            .attr("x", stripX).attr("y", laneData.y)
            .attr("width", stripRight - stripX).attr("height", stripHeight)
            .attr("fill", "none")
            .attr("stroke", "rgba(31, 41, 40, 0.72)");
        } else {
          appendRough(lane, roughComparison.rectangle(stripX, laneData.y, stripRight - stripX, stripHeight, {
            seed: stableSeed(`${d.metricKey}-${laneData.key}-comparison-band`),
            stroke: "rgba(31, 41, 40, 0.72)",
            strokeWidth: 1.05,
            roughness: 1.8,
            bowing: 1.25,
            fill: "none"
          }), "ribbon-detail-frame rough-ribbon-frame");
        }

        const inspectRow = event => closestRow(laneData.series.rows, Math.round(x.invert(d3.pointer(event, ribbonComparison.node())[0])));
        let inspectedYear = null;
        lane.append("rect")
          .attr("class", "ribbon-detail-hit")
          .attr("x", stripX).attr("y", laneData.y)
          .attr("width", stripRight - stripX).attr("height", stripHeight)
          .on("pointerenter pointermove", event => {
            const row = inspectRow(event);
            if (!row) return;
            if (row.year !== inspectedYear) {
              group.select(".comparison-pair-marker")
                .attr("transform", `translate(${x(row.year)},0)`)
                .attr("visibility", "visible");
              laneStripeByYear.get(inspectedYear)?.classList.remove("is-current");
              laneStripeByYear.get(row.year)?.classList.add("is-current");
              inspectedYear = row.year;
            }
            showRibbonTooltip(event, laneData.code, row, false, d.metricKey);
          })
          .on("pointerleave", () => {
            inspectedYear = null;
            hideRibbonTooltip();
          })
          .on("click", event => {
            const row = inspectRow(event);
            if (!row) return;
            configureMetric(d.metricKey, { year: row.year, animate: false });
          });

        lane.on("focus", event => {
          const row = laneData.series.rowsByYear.get(state.year) ?? closestRow(laneData.series.rows, state.year);
          if (row) showRibbonTooltip(event, laneData.code, row, true, d.metricKey);
        }).on("blur", hideRibbonTooltip)
          .on("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key) || !laneData.series.rows.length) return;
            event.preventDefault();
            const currentIndex = Math.max(0, d3.bisector(row => row.year).center(laneData.series.rows, state.year));
            const nextIndex = event.key === "Home"
              ? 0
              : event.key === "End"
                ? laneData.series.rows.length - 1
                : event.key === "ArrowLeft" || event.key === "ArrowRight"
                  ? Math.max(0, Math.min(laneData.series.rows.length - 1, currentIndex + (event.key === "ArrowLeft" ? -1 : 1)))
                  : currentIndex;
            configureMetric(d.metricKey, { year: laneData.series.rows[nextIndex].year, animate: false });
          });
      });

      appendRibbonColorKey(group, d.metric, stripX, -8);
      const marker = group.append("g").attr("class", "ribbon-detail-marker comparison-pair-marker");
      if (mobileLite) {
        marker.append("line")
          .attr("x1", 0).attr("x2", 0).attr("y1", 20).attr("y2", 108)
          .attr("stroke", "rgba(24, 46, 47, 0.82)")
          .attr("stroke-width", 1.15);
      } else {
        appendRough(marker, roughComparison.line(0, 20, 0, 108, {
          seed: stableSeed(`${d.metricKey}-comparison-marker`),
          stroke: "rgba(24, 46, 47, 0.82)",
          strokeWidth: 1.15,
          roughness: 1.65,
          bowing: 1.15
        }), "rough-year-marker");
      }
    });

    ribbonComparisonState = {
      key: `${state.compared}:${state.lang}`,
      x,
      seriesByMetric
    };
    updateRibbonComparisonYear();
  }

  function renderRibbonDetail() {
    const title = territoryLabel(state.selected);
    const detailPanel = root.querySelector(".ribbon-detail");
    const detailTitle = root.querySelector(".ribbon-detail-title");
    const detailMetric = root.querySelector(".ribbon-detail-metric");
    const detailSummary = root.querySelector(".ribbon-detail-summary");
    const detailCaption = root.querySelector(".ribbon-detail-caption");
    const width = mobileLite ? 440 : 1100;
    const stripX = mobileLite ? 140 : 240;
    const stripRight = width - (mobileLite ? 12 : 32);
    const stripHeight = 42;
    const rowStart = 48;
    const rowGap = 96;
    const x = d3.scaleLinear().domain(ribbonYearDomain).range([stripX, stripRight]);
    const stripeWidth = Math.max(2, x(ribbonYearDomain[0] + 1) - x(ribbonYearDomain[0]) + 0.5);
    const roughDetail = mobileLite ? null : rough.svg(ribbonDetail.node());
    const series = ribbonMetricKeys.map(metricKey => {
      const rows = [...(byMetric.get(metricKey)?.get(state.selected) ?? [])]
        .sort((a, b) => d3.ascending(a.year, b.year));
      return {
        metricKey,
        metric: metrics[metricKey],
        rows,
        rowsByYear: new Map(rows.map(row => [row.year, row])),
        years: yearsByMetric.get(metricKey),
        evolution: summarizeIndicatorEvolution(rows, metricKey)
      };
    });
    const seriesByMetric = new Map(series.map(item => [item.metricKey, item]));

    detailPanel.dataset.indicator = "compare";
    detailTitle.textContent = title;
    detailMetric.textContent = t("atlas.detailMetric");
    const exportButton = root.querySelector(".portrait-export");
    exportButton.textContent = t("atlas.export");
    exportButton.setAttribute("aria-label", t("atlas.exportAria", { territory: title }));
    root.querySelector(".territory-summary-text").textContent = territorySummary(title, series);
    updatePortraitConclusion(title, series);
    detailSummary.textContent = t("atlas.detailCompareSummary", { territory: title });
    detailCaption.textContent = t("atlas.detailCompareCaption");

    ribbonDetail.selectAll("*").remove();
    ribbonDetail
      .attr("viewBox", `0 0 ${width} 430`)
      .attr("aria-label", t("atlas.detailCompareAria", { territory: title }));
    ribbonDetail.append("title").text(t("atlas.detailCompareAria", { territory: title }));
    ribbonDetail.append("desc").text(t("atlas.detailCompareCaption"));

    ribbonDetail.append("text")
      .attr("class", "ribbon-detail-axis-label")
      .attr("x", stripX).attr("y", 23)
      .text(ribbonYearDomain[0]);
    ribbonDetail.append("text")
      .attr("class", "ribbon-detail-axis-label")
      .attr("x", stripRight).attr("y", 23)
      .attr("text-anchor", "end")
      .text(ribbonYearDomain[1]);
    ribbonDetail.append("text")
      .attr("class", "ribbon-detail-axis-label ribbon-detail-axis-caption")
      .attr("x", (stripX + stripRight) / 2).attr("y", 23)
      .attr("text-anchor", "middle")
      .text(t("ribbon.timeAxis"));

    const metricRows = ribbonDetail.selectAll("g.ribbon-detail-metric-row")
      .data(series)
      .join("g")
      .attr("class", d => `ribbon-detail-metric-row${d.metricKey === state.indicator ? " is-active-metric" : ""}`)
      .attr("data-indicator", d => d.metricKey)
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", d => `${metricText(d.metric, "label")}. ${d.evolution.text}. ${metricText(d.metric, "reading")}`)
      .attr("transform", (_, index) => `translate(0,${rowStart + index * rowGap})`);

    metricRows.append("rect")
      .attr("class", "ribbon-detail-row-bg")
      .attr("x", 8).attr("y", -8)
      .attr("width", width - 16).attr("height", 88)
      .attr("rx", 10);
    metricRows.append("text")
      .attr("class", "ribbon-detail-row-title")
      .attr("x", 20).attr("y", 17)
      .text(d => metricText(d.metric, "tab"));
    metricRows.append("text")
      .attr("class", "ribbon-detail-row-range")
      .attr("x", 20).attr("y", 36)
      .text(d => d.rows.length
        ? t("atlas.detailMetricRange", { start: d.rows[0].year, end: d.rows.at(-1).year, unit: d.metric.unit })
        : t("common.noArchive"));
    metricRows.append("foreignObject")
      .attr("class", "ribbon-detail-evolution-fo")
      .attr("x", 20).attr("y", 43)
      .attr("width", mobileLite ? 108 : 205).attr("height", 40)
      .append("xhtml:div")
      .attr("class", d => `ribbon-detail-evolution is-${d.evolution.category}`)
      .text(d => d.evolution.text);
    metricRows.append("rect")
      .attr("class", "ribbon-detail-band-bg")
      .attr("x", stripX).attr("y", 4)
      .attr("width", stripRight - stripX).attr("height", stripHeight);

    metricRows.each(function(d) {
      const group = d3.select(this);
      const color = metricScale(d.metric);
      if (!mobileLite) {
        appendRough(group, roughDetail.rectangle(8, -8, width - 16, 88, {
          seed: stableSeed(`${state.selected}-${d.metricKey}-detail-row`),
          stroke: "rgba(53, 76, 72, 0.3)",
          strokeWidth: 0.9,
          roughness: 1.5,
          bowing: 1.05,
          fill: "none"
        }), "chart-sketch-frame ribbon-detail-row-sketch");
      }
      const raster = appendRasterRibbon(group, d.rows, {
        domain: ribbonYearDomain,
        color,
        x: stripX,
        y: 4,
        width: stripRight - stripX,
        height: stripHeight,
        className: "ribbon-detail-raster"
      });
      const detailStripes = raster
        ? d3.select(null)
        : group.selectAll("rect.ribbon-detail-stripe")
          .data(d.rows)
          .join("rect")
          .attr("class", "ribbon-detail-stripe")
          .attr("x", row => x(row.year))
          .attr("y", (_, index) => 4 + ((index % 5) - 2) * 0.22)
          .attr("width", stripeWidth)
          .attr("height", (_, index) => stripHeight + ((index % 4) - 1.5) * 0.25)
          .attr("fill", row => color(row.value));
      const detailStripeByYear = new Map();
      detailStripes.each(function(row) {
        detailStripeByYear.set(row.year, this);
      });
      if (mobileLite) {
        group.append("rect")
          .attr("class", "ribbon-detail-frame")
          .attr("x", stripX).attr("y", 4)
          .attr("width", stripRight - stripX).attr("height", stripHeight)
          .attr("fill", "none")
          .attr("stroke", "rgba(31, 41, 40, 0.72)");
      } else {
        appendRough(group, roughDetail.rectangle(stripX, 4, stripRight - stripX, stripHeight, {
          seed: stableSeed(`${state.selected}-${d.metricKey}-detail-band`),
          stroke: "rgba(31, 41, 40, 0.72)",
          strokeWidth: 1.15,
          roughness: 1.85,
          bowing: 1.3,
          fill: "none"
        }), "ribbon-detail-frame rough-ribbon-frame");
      }
      appendRibbonColorKey(group, d.metric, stripX, -10);
      const marker = group.append("g").attr("class", "ribbon-detail-marker");
      if (mobileLite) {
        marker.append("line")
          .attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 50)
          .attr("stroke", "rgba(24, 46, 47, 0.82)")
          .attr("stroke-width", 1.15);
      } else {
        appendRough(marker, roughDetail.line(0, 0, 0, 50, {
          seed: stableSeed(`${state.selected}-${d.metricKey}-detail-marker`),
          stroke: "rgba(24, 46, 47, 0.82)",
          strokeWidth: 1.15,
          roughness: 1.65,
          bowing: 1.15
        }), "rough-year-marker");
      }

      const inspectRow = event => closestRow(d.rows, Math.round(x.invert(d3.pointer(event, ribbonDetail.node())[0])));
      let inspectedYear = null;
      group.append("rect")
        .attr("class", "ribbon-detail-hit")
        .attr("x", stripX).attr("y", 0)
        .attr("width", stripRight - stripX).attr("height", 50)
        .on("pointerenter pointermove", event => {
          const row = inspectRow(event);
          if (!row) return;
          if (row.year !== inspectedYear) {
            marker.attr("transform", `translate(${x(row.year)},0)`).attr("visibility", "visible");
            detailStripeByYear.get(inspectedYear)?.classList.remove("is-current");
            detailStripeByYear.get(row.year)?.classList.add("is-current");
            inspectedYear = row.year;
          }
          showRibbonTooltip(event, state.selected, row, false, d.metricKey);
        })
        .on("pointerleave", () => {
          inspectedYear = null;
          hideRibbonTooltip();
        })
        .on("click", event => {
          const row = inspectRow(event);
          if (!row) return;
          configureMetric(d.metricKey, { year: row.year, animate: false });
        });
    });

    metricRows.on("focus", (event, d) => {
      const row = d.rowsByYear.get(state.year) ?? closestRow(d.rows, state.year);
      if (row) showRibbonTooltip(event, state.selected, row, true, d.metricKey);
    }).on("blur", hideRibbonTooltip)
      .on("keydown", (event, d) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key) || !d.rows.length) return;
        event.preventDefault();
        const currentIndex = Math.max(0, d3.bisector(row => row.year).center(d.rows, state.year));
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? d.rows.length - 1
            : event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? Math.max(0, Math.min(d.rows.length - 1, currentIndex + (event.key === "ArrowLeft" ? -1 : 1)))
              : currentIndex;
        configureMetric(d.metricKey, { year: d.rows[nextIndex].year, animate: false });
      });

    ribbonDetailState = {
      key: `${state.selected}:${state.lang}`,
      x,
      seriesByMetric
    };
    updateRibbonDetailYear();
    renderRibbonComparison(series);
  }

  function updateRibbonDetail() {
    const expectedKey = `${state.selected}:${state.lang}`;
    if (!ribbonDetailState || ribbonDetailState.key !== expectedKey) {
      renderRibbonDetail();
      return;
    }
    updateRibbonDetailYear();
    updateRibbonComparisonYear();
  }

  function updateSelectionMarker() {
    const selectedPoint = projection(anchors[state.selected]);
    const selectedVisible = anchors[state.selected]
      ? d3.geoDistance(anchors[state.selected], projection.invert(projection.translate())) < Math.PI / 2
      : false;
    marker
      .attr("transform", selectedPoint ? `translate(${selectedPoint[0]},${selectedPoint[1]})` : null)
      .attr("visibility", selectedVisible ? "visible" : "hidden");
  }

  function renderGeometry(interactive = false) {
    svg.select(".ocean-sphere").attr("d", path);
    svg.select(".graticule").attr("d", path);
    svg.select(".world-land").attr("d", path);
    svg.select(".world-land-hatch").attr("d", path);
    zones.attr("d", path);
    if (!interactive) {
      svg.selectAll(".ocean-sphere-sketch").attr("d", path);
      svg.select(".graticule-sketch").attr("d", path);
      svg.selectAll(".world-land-sketch").attr("d", path);
      sketchZones.attr("d", path);
      sketchZonesEcho.attr("d", path);
      zoneTextureClipPaths.forEach(clipPath => clipPath.attr("d", path));
    }

    labels.each(function(d) {
      const point = projection(d.coordinates);
      const visible = d3.geoDistance(d.coordinates, projection.invert(projection.translate())) < Math.PI / 2;
      d3.select(this)
        .attr("x", point?.[0] ?? -100)
        .attr("y", point?.[1] ?? -100)
        .attr("visibility", visible ? "visible" : "hidden");
    });

    updateSelectionMarker();
  }

  function zoneTextureColor(code) {
    const metric = metrics[state.indicator];
    const row = currentRow(code);
    return row && Number.isFinite(row.value)
      ? metricScale(metric)(row.value)
      : "#aaa79d";
  }

  function updateZoneTextureColors() {
    zoneTextureLayer.selectAll(".zone-pencil-texture")
      .style("--zone-pencil-color", d => zoneTextureColor(d.code))
      .attr("opacity", d => {
        if (!Number.isFinite(currentValue(d.code))) return 0.16;
        return d.code === state.selected ? 0.96 : 0.72;
      });
  }

  // Reprise du principe des cartes Contours NC : une sous-couche colorée,
  // des hachures Rough.js masquées territoire par territoire, puis des côtes
  // redessinées par-dessus les deux contours SVG légèrement déplacés.
  function renderSketchTextures() {
    zoneTextureLayer.selectAll("*").remove();
    zoneTextureLayer.attr("data-selected", state.selected ?? "");
    zoneTextureLayer.attr("data-rendered", "true");
    roughCoastLayer.selectAll("*").remove();
    if (mobileLite) return;

    features.forEach(feature => {
      const pathData = path(feature);
      if (!pathData || d3.geoArea(feature) >= Math.PI) return;
      const isSelected = feature.code === state.selected;
      const angleJitter = stableSeed(`zone-angle-${feature.code}`) % 15;
      const node = roughMap.path(pathData, {
        fill: zoneTextureColor(feature.code),
        fillStyle: "hachure",
        hachureAngle: -49 + angleJitter,
        hachureGap: isSelected ? 2.9 : 3.65,
        fillWeight: isSelected ? 0.72 : 0.58,
        roughness: isSelected ? 2 : 1.75,
        bowing: isSelected ? 1.35 : 1.15,
        stroke: "none",
        strokeWidth: 0,
        disableMultiStroke: false,
        seed: stableSeed(`zone-pencil-${feature.code}`)
      });
      node.setAttribute("class", "zone-pencil-texture");
      node.setAttribute("data-code", feature.code);
      node.setAttribute("clip-path", `url(#zone-texture-clip-${feature.code.toLowerCase()})`);
      zoneTextureLayer.node().appendChild(node);
      d3.select(node)
        .datum(feature)
        .style("--zone-pencil-color", zoneTextureColor(feature.code));
    });
    updateZoneTextureColors();

    [
      {
        datum: { type: "Sphere" },
        className: "rough-coast rough-coast-sphere",
        stroke: "#244b4d",
        strokeWidth: 0.72,
        roughness: 1.9,
        bowing: 1.35,
        seed: "pacific-sphere"
      },
      {
        datum: land,
        className: "rough-coast rough-coast-land",
        stroke: "#34412f",
        strokeWidth: 0.78,
        roughness: 2.35,
        bowing: 1.75,
        seed: "pacific-land"
      }
    ].forEach(spec => {
      const pathData = path(spec.datum);
      if (!pathData) return;
      const node = roughMap.path(pathData, {
        fill: "none",
        stroke: spec.stroke,
        strokeWidth: spec.strokeWidth,
        roughness: spec.roughness,
        bowing: spec.bowing,
        disableMultiStroke: false,
        seed: stableSeed(spec.seed)
      });
      node.setAttribute("class", spec.className);
      roughCoastLayer.node().appendChild(node);
    });
  }

  function updateMap(animate = true, { detail = false, secondary = true, temporalOnly = false } = {}) {
    const metric = metrics[state.indicator];
    const color = metricScale(metric);
    const rowsThisYear = rowByMetricYearCode.get(state.indicator)?.get(state.year);
    zones.interrupt();
    const target = animate && !reducedMotion && !mobileLite
      ? zones.transition().duration(220).ease(d3.easeCubicOut)
      : zones;

    target
      .attr("fill", d => {
        const row = rowsThisYear?.get(d.code);
        if (!row) return "#d8d5c8";
        return color(row.value);
      })
      .attr("fill-opacity", d => Number.isFinite(rowsThisYear?.get(d.code)?.value) ? 0.48 : 0.16);

    const mapQuestionKey = {
      ocean: "map.oceanQuestion",
      land: "map.landQuestion",
      rain: "map.rainQuestion",
      sea_level: "map.seaQuestion"
    }[state.indicator];
    mapQuestion.textContent = t(mapQuestionKey, { year: state.year });
    mapYear.textContent = state.year;
    yearOutput.textContent = state.year;
    slider.value = state.year;
    slider.setAttribute("aria-valuetext", `${state.year} · ${metricText(metric, "label")}`);

    if (temporalOnly) return;

    zones
      .classed("is-selected", d => d.code === state.selected)
      .attr("aria-label", d => {
        const row = rowsThisYear?.get(d.code);
        const rainfallReading = state.indicator === "rain" && row
          ? `, ${t({
              drier: "rain.class.drier",
              near: "rain.class.near",
              wetter: "rain.class.wetter"
            }[rainClass(row)])}`
          : "";
        return t("map.zoneReading", {
          territory: territoryLabel(d.code),
          value: formatValue(row?.value, metric),
          year: state.year,
          rain: rainfallReading
        });
      });

    root.querySelector(".map-note").textContent = state.indicator === "rain"
      ? t("map.rainNote")
      : metricText(metric, "note");
    root.querySelector(".map-reading-guide").textContent = metricText(metric, "reading");
    root.querySelector(".legend-low").textContent = state.indicator === "rain"
      ? `${signed(metric.domain[0])} ${metric.unit} · ${t("map.rainDrier")}`
      : `${metricText(metric, "low")} · ${signed(metric.domain[0])} ${metric.unit}`;
    root.querySelector(".legend-high").textContent = state.indicator === "rain"
      ? `${signed(metric.domain[2])} ${metric.unit} · ${t("map.rainWetter")}`
      : `${signed(metric.domain[2])} ${metric.unit} · ${metricText(metric, "high")}`;
    root.querySelector(".legend-mid").textContent = state.indicator === "rain" ? t("map.rainNear") : t("map.reference");
    root.querySelector(".legend-ramp").style.background = `linear-gradient(90deg, ${metric.colors.join(", ")})`;
    if (detail) renderGeometry();
    if (zoneTextureLayer.attr("data-rendered") !== "true") {
      renderSketchTextures();
    } else if (!state.playing) {
      updateZoneTextureColors();
    }
    updateNarrative();
    updateContextBridge();
    const portraitKey = `${state.indicator}:${state.selected}`;
    if (!panelRenderState || panelRenderState.key !== portraitKey) {
      renderPanel();
    } else {
      updatePanelYear();
    }
    if (secondary && atlasReady) {
      updateRibbonWallState();
      updateRibbonDetail();
    }
  }

  function renderPanel() {
    const metric = metrics[state.indicator];
    const rows = currentRows(state.selected);
    const title = territoryLabel(state.selected);
    const metricLabel = metricText(metric, "label");
    const context = (territoryContextByCode.get(state.selected) ?? []).at(-1) ?? null;
    const panel = root.querySelector(".territory-panel");
    const accent = metricAccents[state.indicator];
    const history = buildPortraitHistory(rows, state.indicator);

    panelRenderState = {
      key: `${state.indicator}:${state.selected}`,
      metric,
      rows,
      rowsByYear: new Map(rows.map(d => [d.year, d])),
      title,
      history,
      ribbonX: null,
      ribbonBounds: null,
      chartX: null,
      chartY: null,
      chartBounds: null,
      chartClip: null,
      shiftSpark: null
    };

    panel.dataset.portrait = state.indicator;
    root.querySelector(".panel-title").textContent = title;
    root.querySelector(".panel-code").textContent = `${state.selected} · ${metricLabel}`;
    root.querySelector(".portrait-ribbon-years").textContent = rows.length ? `${rows[0].year}—${rows.at(-1).year}` : "";
    root.querySelector(".panel-method").textContent = !rows.length
      ? t("panel.noArchiveMethod")
      : state.indicator === "rain"
        ? t("panel.rainMethod")
        : t("panel.shiftMethod", { start: history.baselineStart, end: history.baselineEnd });
    root.querySelector(".panel-stats").innerHTML = `
      <div><span>${t("panel.population", {
        year: context?.year ?? "—",
        estimate: context?.population_status === "E" ? t("common.estimateShort") : ""
      })}</span><strong>${formatPopulation(context?.population)}</strong></div>
      <div><span>${t("panel.stations", {
        year: Number.isFinite(context?.station_year_latest) ? context.station_year_latest : t("common.latest")
      })}</span><strong>${Number.isFinite(context?.station_count_latest)
        ? localizedNumber(state.lang, context.station_count_latest, 0)
        : t("common.noData")}</strong></div>`;

    drawTerritoryFrame(state.indicator, accent);
    drawPortraitSummarySketch(state.indicator, accent);
    drawPortraitShiftSpark(history, metric, title);
    drawTerritoryRibbon(rows, metric, title);
    drawDetailChart(rows, metric, title);
    updatePanelYear();
  }

  function updatePortraitShift() {
    const { history, metric, rows, title } = panelRenderState;
    const kicker = root.querySelector(".portrait-shift-kicker");
    const value = root.querySelector(".portrait-shift-value");
    const years = root.querySelector(".portrait-shift-years");
    const note = root.querySelector(".portrait-shift-note");
    const section = root.querySelector(".portrait-shift");
    const summary = history.summaryByYear.get(state.year);
    const digits = state.indicator === "sea_level" || state.indicator === "rain" ? 0 : 1;
    const compactPeriod = (start, end) => {
      const endLabel = Math.floor(start / 100) === Math.floor(end / 100)
        ? String(end).slice(-2)
        : String(end);
      return `${start}–${endLabel}`;
    };

    function updateSpark() {
      const spark = panelRenderState.shiftSpark;
      if (!spark) return;
      const currentSparkRow = spark.rowsByYear.get(state.year);
      if (!currentSparkRow) {
        spark.clip.attr("width", 0);
        d3.select(root).select(".portrait-shift-dot").attr("visibility", "hidden");
        spark.description.text(t("spark.notBegun", { year: state.year }));
        return;
      }
      const markerX = spark.x(currentSparkRow.year);
      const markerY = spark.y(currentSparkRow.value);
      spark.clip.attr("width", Math.max(0, markerX - spark.bounds[0]));
      d3.select(root).select(".portrait-shift-dot")
        .attr("transform", `translate(${markerX},${markerY})`)
        .attr("visibility", "visible");
      spark.description.text(state.indicator === "rain"
        ? t("spark.rainDescription", {
            territory: title,
            value: signed(currentSparkRow.value, 0),
            year: state.year
          })
        : t("spark.shiftDescription", {
            metric: metricText(metric, "label"),
            territory: title,
            value: signed(currentSparkRow.value, digits),
            unit: metric.unit,
            year: state.year
          }));
    }

    updateSpark();
    years.classList.toggle("is-period", state.indicator !== "rain" && Boolean(summary?.ready));
    if (!rows.length) {
      section.dataset.state = "empty";
      kicker.textContent = t("shift.view");
      value.textContent = t("common.noArchive");
      years.textContent = "";
      note.textContent = t("shift.noObservations");
      return t("shift.noArchiveAnnouncement");
    }

    if (state.indicator === "rain" && summary) {
      const window = summary.currentWindow;
      const rangeFull = window.length ? `${window[0].year}–${window.at(-1).year}` : `${state.year}`;
      const range = window.length ? compactPeriod(window[0].year, window.at(-1).year) : `${state.year}`;
      const countParts = [
        t(summary.counts.drier === 1 ? "shift.rainCountDrierOne" : "shift.rainCountDrier", { count: summary.counts.drier }),
        summary.counts.near
          ? t(summary.counts.near === 1 ? "shift.rainCountNearOne" : "shift.rainCountNear", { count: summary.counts.near })
          : "",
        t(summary.counts.wetter === 1 ? "shift.rainCountWetterOne" : "shift.rainCountWetter", { count: summary.counts.wetter })
      ].filter(Boolean);
      section.dataset.state = "ready";
      kicker.textContent = t("shift.rainKicker");
      value.textContent = `${signed(summary.cumulativeBalance, 0)} ${metric.unit}`;
      years.textContent = t("shift.rainYears", { year: rows[0].year });
      note.textContent = `${range}: ${signed(summary.recentBalance, 0)} ${metric.unit} · ${countParts.join(" · ")}`;
      return t("shift.rainAnnouncement", {
        value: signed(summary.cumulativeBalance, 0),
        start: rows[0].year,
        counts: countParts.join(", "),
        range: rangeFull
      });
    }

    if (!summary?.ready) {
      const progress = summary?.baselineProgress ?? 0;
      section.dataset.state = "building";
      kicker.textContent = t("shift.tenYear");
      value.textContent = `${progress}/10`;
      years.textContent = t("shift.building", { start: history.baselineStart, end: history.baselineEnd });
      note.textContent = t("shift.buildingNote");
      return t("shift.buildingAnnouncement", { progress });
    }

    const currentWindow = summary.currentWindow;
    const currentRange = `${currentWindow[0].year}–${currentWindow.at(-1).year}`;
    const baselineRangeCompact = compactPeriod(history.baselineStart, history.baselineEnd);
    const currentRangeCompact = compactPeriod(currentWindow[0].year, currentWindow.at(-1).year);
    const roundedShift = +summary.shift.toFixed(digits);
    const direction = roundedShift === 0
      ? t("shift.little")
      : state.indicator === "sea_level"
        ? t(roundedShift > 0 ? "shift.higher" : "shift.lower")
        : t(roundedShift > 0 ? "shift.warmer" : "shift.cooler");
    section.dataset.state = "ready";
    kicker.textContent = t("shift.tenYear");
    value.textContent = `${signed(summary.shift, digits)} ${metric.unit}`;
    years.textContent = `${baselineRangeCompact} → ${currentRangeCompact}`;
    note.textContent = `${signed(summary.baselineMean, digits)} → ${signed(summary.currentMean, digits)} ${metric.unit} · ${direction}`;
    return t("shift.announcement", {
      value: signed(summary.shift, digits),
      unit: metric.unit,
      direction,
      current: currentRange,
      start: history.baselineStart,
      end: history.baselineEnd
    });
  }

  function updatePanelYear() {
    const expectedKey = `${state.indicator}:${state.selected}`;
    if (!panelRenderState || panelRenderState.key !== expectedKey) {
      renderPanel();
      return;
    }

    const { metric, rows, rowsByYear, title } = panelRenderState;
    const current = rowsByYear.get(state.year);
    const rainfallReading = state.indicator === "rain" && current
      ? t({
          wetter: "rain.class.wetter",
          drier: "rain.class.drier",
          near: "rain.class.nearPanel"
        }[rainClass(current)])
      : "";

    root.querySelector(".panel-value").textContent = formatValue(current?.value, metric);
    root.querySelector(".panel-year").textContent = current
      ? t("panel.inYear", { year: state.year, rain: rainfallReading ? ` · ${rainfallReading}` : "" })
      : t("panel.noObservation", { year: state.year });
    const longTermAnnouncement = updatePortraitShift();
    const liveSummary = current
      ? t("panel.live", {
          territory: title,
          value: formatValue(current.value, metric),
          year: state.year,
          rain: rainfallReading ? `, ${rainfallReading}` : "",
          longTerm: longTermAnnouncement
        })
      : t("panel.liveEmpty", {
          territory: title,
          year: state.year,
          longTerm: longTermAnnouncement
        });
    root.querySelector(".portrait-live-summary").textContent = liveSummary;

    if (!rows.length) {
      root.querySelector(".detail-chart-caption").textContent = t("chart.noArchive");
      root.querySelector(".territory-panel").setAttribute("aria-label", liveSummary);
      return;
    }
    const inRange = state.year >= rows[0].year && state.year <= rows.at(-1).year;

    if (panelRenderState.ribbonX && panelRenderState.ribbonBounds) {
      const [start, end] = panelRenderState.ribbonBounds;
      const markerX = panelRenderState.ribbonX(state.year);
      d3.select(root).select(".portrait-year-marker")
        .attr("transform", `translate(${markerX},0)`)
        .attr("visibility", inRange ? "visible" : "hidden");
      d3.select(root).select(".portrait-ribbon-future")
        .attr("x", inRange ? Math.max(start, markerX) : start)
        .attr("width", inRange ? Math.max(0, end - markerX) : end - start)
        .attr("visibility", state.year >= rows.at(-1).year ? "hidden" : "visible");
    }

    if (panelRenderState.chartX && panelRenderState.chartY && panelRenderState.chartBounds) {
      const [start, end, top, bottom] = panelRenderState.chartBounds;
      const markerX = panelRenderState.chartX(state.year);
      d3.select(root).select(".detail-year-marker")
        .attr("transform", `translate(${markerX},0)`)
        .attr("visibility", inRange ? "visible" : "hidden");

      if (panelRenderState.chartClip) {
        panelRenderState.chartClip
          .attr("width", inRange ? Math.max(0, Math.min(end, markerX) - start) : 0);
      }

      const dot = d3.select(root).select(".year-dot");
      const label = d3.select(root).select(".portrait-current-label");
      if (current) {
        const markerY = panelRenderState.chartY(current.value);
        const nearRight = markerX > end - 58;
        dot
          .attr("transform", `translate(${markerX},${markerY})`)
          .attr("visibility", "visible");
        label
          .attr("x", markerX + (nearRight ? -7 : 7))
          .attr("y", Math.max(top + 8, Math.min(bottom - 7, markerY - 8)))
          .attr("text-anchor", nearRight ? "end" : "start")
          .attr("visibility", "visible")
          .text(`${signed(current.value)} ${metric.unit}`);
      } else {
        dot.attr("visibility", "hidden");
        label.attr("visibility", "hidden");
      }
    }

    const metricLabel = metricText(metric, "label");
    root.querySelector(".detail-chart-caption").textContent = t("chart.caption", {
      year: state.year,
      start: rows[0].year,
      end: rows.at(-1).year
    });
    d3.select(root).select(".portrait-chart-desc")
      .text(current
        ? t("chart.description", {
            metric: metricLabel,
            territory: title,
            value: formatValue(current.value, metric),
            year: state.year
          })
        : t("chart.descriptionEmptyYear", {
            metric: metricLabel,
            territory: title,
            year: state.year
          }));
    root.querySelector(".territory-panel").setAttribute(
      "aria-label",
      liveSummary
    );
  }

  function drawDetailChart(rows, metric, title) {
    const chart = d3.select(root).select(".detail-chart");
    chart.selectAll("*").remove();
    const metricLabel = metricText(metric, "label");
    chart.attr("aria-label", rows.length
      ? t("chart.aria", { metric: metricLabel, territory: title })
      : t("chart.noneAria", { metric: metricLabel, territory: title }));
    chart.append("title").text(rows.length
      ? t("ribbon.archive", { metric: metricLabel, territory: title })
      : t("ribbon.noneArchive", { metric: metricLabel, territory: title }));
    const chartDescription = chart.append("desc").attr("class", "portrait-chart-desc");
    if (!rows.length) {
      chartDescription.text(t("ribbon.noneDescription"));
      return;
    }

    const roughChart = rough.svg(chart.node());
    const accent = metricAccents[state.indicator];
    const width = 310;
    const height = 190;
    const margin = { top: 18, right: 14, bottom: 28, left: 28 };
    const x = d3.scaleLinear().domain(d3.extent(rows, d => d.year)).range([margin.left, width - margin.right]);
    const extent = d3.extent(rows, d => d.value);
    const padding = Math.max((extent[1] - extent[0]) * 0.15, metric.unit === "°C" ? 0.2 : 2);
    const y = d3.scaleLinear().domain([Math.min(extent[0] - padding, 0), Math.max(extent[1] + padding, 0)]).nice().range([height - margin.bottom, margin.top]);
    const line = d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX);
    const area = d3.area().x(d => x(d.year)).y0(y(0)).y1(d => y(d.value)).curve(d3.curveMonotoneX);
    const clipId = "territory-history-clip";

    const defs = chart.append("defs");
    const progressClip = defs.append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top - 4)
      .attr("height", height - margin.top - margin.bottom + 8)
      .attr("width", 0);

    appendRough(chart, roughChart.path(area(rows), {
      seed: stableSeed(`${state.indicator}-${title}-portrait-area`),
      stroke: accent,
      strokeWidth: 0.4,
      fill: accent,
      fillStyle: "hachure",
      fillWeight: 0.65,
      hachureGap: 6,
      hachureAngle: -42,
      roughness: 1.25,
      bowing: 0.7
    }), "portrait-chart-area");

    appendRough(chart, roughChart.line(margin.left, y(0), width - margin.right, y(0), {
      seed: stableSeed(`${state.indicator}-${title}-zero`),
      stroke: "rgba(31, 41, 40, 0.4)",
      strokeWidth: 0.8,
      roughness: 1.15,
      bowing: 0.8
    }), "zero-line rough-zero-line");

    appendRough(chart, roughChart.path(line(rows), {
      seed: stableSeed(`${state.indicator}-${title}-archive-line`),
      stroke: "#52635f",
      strokeWidth: 1.25,
      roughness: 1.2,
      bowing: 0.7,
      fill: "none",
      simplification: 0.22
    }), "chart-line chart-line-archive rough-chart-line");

    const progressLine = appendRough(chart, roughChart.path(line(rows), {
      seed: stableSeed(`${state.indicator}-${title}-progress-line`),
      stroke: accent,
      strokeWidth: 1.9,
      roughness: 1.35,
      bowing: 0.78,
      fill: "none",
      simplification: 0.2
    }), "chart-progress-line rough-chart-line");
    progressLine.attr("clip-path", `url(#${clipId})`);

    const baseline = height - margin.bottom;
    appendRough(chart, roughChart.line(margin.left, baseline, width - margin.right, baseline, {
      seed: stableSeed(`${state.indicator}-${title}-portrait-axis`),
      stroke: "#4c5c58",
      strokeWidth: 0.85,
      roughness: 1.25,
      bowing: 0.7
    }), "portrait-rough-axis");

    [rows[0], rows.at(-1)].forEach((row, index) => {
      chart.append("text")
        .attr("class", "portrait-axis-label")
        .attr("x", x(row.year))
        .attr("y", height - 6)
        .attr("text-anchor", index ? "end" : "start")
        .text(row.year);
    });

    chart.append("text")
      .attr("class", "portrait-scale-label")
      .attr("x", margin.left - 4)
      .attr("y", margin.top + 3)
      .attr("text-anchor", "end")
      .text(signed(y.domain()[1]));
    chart.append("text")
      .attr("class", "portrait-scale-label")
      .attr("x", margin.left - 4)
      .attr("y", baseline - 2)
      .attr("text-anchor", "end")
      .text(signed(y.domain()[0]));

    appendRough(chart, roughChart.line(0, margin.top, 0, baseline, {
      seed: stableSeed(`${state.indicator}-${title}-chart-marker`),
      stroke: accent,
      strokeWidth: 1.1,
      roughness: 1.65,
      bowing: 1.1
    }), "year-marker detail-year-marker rough-year-marker");

    appendRough(chart, roughChart.circle(0, 0, 9, {
      seed: stableSeed(`${state.indicator}-${title}-chart-dot`),
      stroke: accent,
      strokeWidth: 1.5,
      roughness: 1.6,
      fill: "#fffaf0",
      fillStyle: "solid"
    }), "year-dot rough-year-dot");

    chart.append("text")
      .attr("class", "portrait-current-label")
      .attr("visibility", "hidden");

    panelRenderState.chartX = x;
    panelRenderState.chartY = y;
    panelRenderState.chartBounds = [margin.left, width - margin.right, margin.top, baseline];
    panelRenderState.chartClip = progressClip;
  }

  function scheduleMapTooltipPosition(event, keyboard) {
    if (keyboard || !mapTooltipBounds || event.type === "pointerenter") {
      mapTooltipBounds = stage.getBoundingClientRect();
    }
    mapTooltipPoint = keyboard
      ? { x: 18, y: 112 }
      : {
          x: event.clientX - mapTooltipBounds.left,
          y: event.clientY - mapTooltipBounds.top
        };
    if (mapTooltipFrame !== null) return;
    mapTooltipFrame = window.requestAnimationFrame(() => {
      mapTooltipFrame = null;
      if (!mapTooltipPoint || tooltip.hidden || !mapTooltipBounds) return;
      const size = mapTooltipSize ?? { width: 210, height: 72 };
      const left = keyboard
        ? mapTooltipPoint.x
        : Math.max(12, Math.min(mapTooltipPoint.x + 16, mapTooltipBounds.width - size.width - 12));
      const top = keyboard
        ? mapTooltipPoint.y
        : Math.max(92, Math.min(mapTooltipPoint.y - 18, mapTooltipBounds.height - size.height - 12));
      tooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    });
  }

  function showTooltip(event, code, keyboard = false) {
    const contentKey = `${state.lang}:${state.indicator}:${state.year}:${code}`;
    if (contentKey !== mapTooltipContentKey) {
      const metric = metrics[state.indicator];
      const row = currentRow(code);
      const rainReading = state.indicator === "rain" && row
        ? t({
            wetter: "rain.class.wetter",
            drier: "rain.class.drier",
            near: "rain.class.near"
          }[rainClass(row)])
        : "";
      tooltip.innerHTML = `
        <strong>${territoryLabel(code)}</strong>
        <span>${formatValue(row?.value, metric)} · ${state.year}${rainReading ? `<br>${rainReading}` : ""}</span>`;
      tooltip.hidden = false;
      mapTooltipContentKey = contentKey;
      const layoutKey = `${state.lang}:${state.indicator}:${code}:${Boolean(rainReading)}`;
      if (!mapTooltipSize || layoutKey !== mapTooltipLayoutKey) {
        mapTooltipSize = {
          width: 210,
          height: state.indicator === "rain" ? 76 : 58
        };
        mapTooltipLayoutKey = layoutKey;
      }
    }
    tooltip.hidden = false;
    scheduleMapTooltipPosition(event, keyboard);
  }

  function hideTooltip() {
    if (mapTooltipFrame !== null) {
      window.cancelAnimationFrame(mapTooltipFrame);
      mapTooltipFrame = null;
    }
    mapTooltipPoint = null;
    tooltip.hidden = true;
  }

  function selectTerritory(code, { revealDetail = false } = {}) {
    state.selected = code;
    const territorySelect = root.querySelector(".territory-select");
    if (territorySelect) territorySelect.value = code;
    updateSelectionMarker();
    populateComparisonSelect();
    hideTooltip();
    hideRibbonTooltip();
    updateMap(false);
    if (revealDetail) {
      window.requestAnimationFrame(() => {
        root.querySelector(".ribbon-detail")?.scrollIntoView?.({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    }
  }

  function configureMetric(key, { year = null, animate = true } = {}) {
    stopPlayback();
    state.indicator = key;
    state.chapter = chapters.find(chapter => (
      chapter.indicators ?? [chapter.indicator]
    ).includes(key))?.id ?? null;
    const years = yearsByMetric.get(key);
    state.year = Number.isFinite(year) && years.includes(year) ? year : years.at(-1);
    slider.min = years[0];
    slider.max = years.at(-1);
    slider.value = state.year;
    root.querySelectorAll(".metric-tab").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.indicator === key ? "true" : "false");
    });
    const mapExplainer = root.querySelector(".map-explainer");
    if (mapExplainer) mapExplainer.open = false;
    updateMethodDrawer();
    updateMap(animate);
    if (ribbonSignature !== `${state.indicator}:${state.lang}`) scheduleRibbonWall();
  }

  function triggerSceneEffect() {
    if (mobileLite) return;
    const explorer = root.querySelector(".climate-explorer");
    window.clearTimeout(sceneEffectTimer);
    explorer.classList.remove("scene-kick");
    void explorer.offsetWidth;
    explorer.classList.add("scene-kick");
    sceneEffectTimer = window.setTimeout(() => explorer.classList.remove("scene-kick"), 900);
  }

  function activateScrollStep(step) {
    if (!step) return;
    if (activeScrollStep === step) {
      updateStoryAccessibility();
      return;
    }
    activeScrollStep = step;
    root.querySelectorAll(".scroll-step").forEach(node => node.classList.toggle("is-active", node === step));
    updateStoryAccessibility();
    root.querySelector(".climate-explorer").dataset.storyStep = step.dataset.step;

    const key = step.dataset.indicator;
    if (!key) {
      if (step.dataset.step === "explore" && ribbonSignature === null) scheduleRibbonWall();
      return;
    }
    const year = +step.dataset.year;
    const startYear = +step.dataset.startYear;
    const autoplayEnabled = step.dataset.autoplay === "true" && !isCompactStory() && !reducedMotion;
    configureMetric(key, {
      year: autoplayEnabled && Number.isFinite(startYear) ? startYear : year,
      animate: !reducedMotion && !autoplayEnabled
    });
    state.chapter = step.dataset.chapter || state.chapter;
    updateNarrative();
    triggerSceneEffect();

    if (autoplayEnabled) {
      window.requestAnimationFrame(() => {
        if (activeScrollStep === step) {
          startPlayback({ duration: +step.dataset.duration || null });
        }
      });
    }
  }

  function setPlaybackLiveRegions(mode) {
    [".story-voice", ".year-output", ".map-impact", ".portrait-live-summary"].forEach(selector => {
      root.querySelector(selector)?.setAttribute("aria-live", mode);
    });
  }

  function stopPlayback() {
    if (playback) window.cancelAnimationFrame(playback);
    playback = null;
    state.playing = false;
    explorer.classList.remove("is-playing");
    playButton.querySelector(".play-icon").textContent = "▶";
    playButton.querySelector(".play-text").textContent = t("controls.play");
    playButton.setAttribute("aria-label", t("controls.playAria"));
    setPlaybackLiveRegions("polite");
  }

  function startPlayback({ duration = null } = {}) {
    const years = yearsByMetric.get(state.indicator);
    stopPlayback();

    let startIndex = years.indexOf(state.year);
    if (startIndex < 0 || startIndex >= years.length - 1) {
      const preferredStart = playbackStartByMetric[state.indicator] ?? years[0];
      const preferredIndex = years.indexOf(preferredStart);
      startIndex = preferredIndex >= 0 ? preferredIndex : 0;
      state.year = years[startIndex];
      updateMap(false);
    }

    if (reducedMotion) {
      state.year = years.at(-1);
      updateMap(false);
      return;
    }

    const totalDuration = duration ?? Math.min(3600, Math.max(2200, (years.length - startIndex) * 38));
    let startedAt = null;
    let lastIndex = startIndex;
    state.playing = true;
    explorer.classList.remove("is-scrubbing");
    explorer.classList.add("is-playing");
    setPlaybackLiveRegions("off");
    playButton.querySelector(".play-icon").textContent = "Ⅱ";
    playButton.querySelector(".play-text").textContent = t("controls.pause");
    playButton.setAttribute("aria-label", t("controls.pauseAria"));
    updateMap(false, { detail: false, secondary: false, temporalOnly: true });

    const tick = now => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / totalDuration);
      const index = Math.min(
        years.length - 1,
        startIndex + Math.floor(progress * (years.length - 1 - startIndex))
      );

      if (index !== lastIndex) {
        lastIndex = index;
        state.year = years[index];
        updateMap(false, { detail: false, secondary: false, temporalOnly: true });
      }

      if (progress >= 1) {
        stopPlayback();
        state.year = years.at(-1);
        updateMap(false);
        return;
      }

      playback = window.requestAnimationFrame(tick);
    };

    playback = window.requestAnimationFrame(tick);
  }

  function setLanguage(language) {
    if ((language !== "en" && language !== "fr") || language === state.lang) return;
    stopPlayback();
    state.lang = language;
    persistLanguage(language);
    hideTooltip();
    hideRibbonTooltip();
    applyStaticCopy();
    panelRenderState = null;
    ribbonSignature = null;
    ribbonDetailState = null;
    ribbonComparisonState = null;
    populateTerritoryPicker();
    populateComparisonSelect();
    updateMap(false);
    scheduleRibbonWall();
  }

  root.querySelectorAll(".language-button").forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });

  root.querySelectorAll(".metric-tab").forEach(button => {
    button.addEventListener("click", () => configureMetric(button.dataset.indicator));
  });

  root.querySelector(".portrait-export").addEventListener("click", exportTerritoryPortrait);

  const territorySelect = root.querySelector(".territory-select");
  territorySelect.addEventListener("change", event => selectTerritory(event.target.value));
  populateTerritoryPicker();

  const comparisonSelect = root.querySelector(".territory-compare-select");
  comparisonSelect.addEventListener("change", event => {
    state.compared = event.target.value || null;
    ribbonComparisonState = null;
    hideRibbonTooltip();
    renderRibbonComparison();
  });
  root.querySelector(".comparison-remove").addEventListener("click", () => {
    state.compared = null;
    comparisonSelect.value = "";
    ribbonComparisonState = null;
    hideRibbonTooltip();
    renderRibbonComparison();
    comparisonSelect.focus();
  });
  populateComparisonSelect();

  root.querySelectorAll(".story-step").forEach(button => {
    button.addEventListener("click", () => {
      const chapter = chapters.find(d => d.id === button.dataset.chapter);
      if (!chapter) return;
      const step = root.querySelector(`.scroll-step[data-step="${chapter.id}"]`);
      activateScrollStep(step);
      step?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
  });

  const scrollSteps = Array.from(root.querySelectorAll(".scroll-step"));
  scrollSteps.forEach(step => step.addEventListener("click", () => activateScrollStep(step)));

  const scrollyStepsNode = root.querySelector(".scrolly-steps");
  const previousStoryButton = root.querySelector(".story-previous");
  const nextStoryButton = root.querySelector(".story-next");
  let storyActivationTimer = null;

  function showStoryStep(index) {
    const target = scrollSteps[Math.max(0, Math.min(scrollSteps.length - 1, index))];
    if (!target) return;
    activateScrollStep(target);
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center"
    });
  }

  function moveStoryStep(direction) {
    const activeIndex = Math.max(0, scrollSteps.indexOf(activeScrollStep));
    showStoryStep(activeIndex + direction);
  }

  previousStoryButton.addEventListener("click", () => moveStoryStep(-1));
  nextStoryButton.addEventListener("click", () => moveStoryStep(1));
  scrollyStepsNode.addEventListener("keydown", event => {
    if (!isCompactStory() || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    moveStoryStep(event.key === "ArrowLeft" ? -1 : 1);
  });

  function activateClosestScrollStep() {
    const focus = isCompactStory()
      ? scrollyStepsNode.getBoundingClientRect().left + scrollyStepsNode.clientWidth / 2
      : window.innerHeight * 0.5;
    const closest = d3.least(scrollSteps, step => {
      const bounds = step.getBoundingClientRect();
      const center = isCompactStory()
        ? (bounds.left + bounds.right) / 2
        : (bounds.top + bounds.bottom) / 2;
      return Math.abs(center - focus);
    });
    activateScrollStep(closest);
  }

  function scheduleStoryActivation() {
    window.clearTimeout(storyActivationTimer);
    storyActivationTimer = window.setTimeout(activateClosestScrollStep, 70);
  }

  scrollyStepsNode.addEventListener("scroll", scheduleStoryActivation, { passive: true });
  window.addEventListener("scroll", scheduleStoryActivation, { passive: true });
  let previousCompactMode = isCompactStory();
  window.addEventListener("resize", () => {
    mapTooltipBounds = null;
    mapTooltipSize = null;
    ribbonTooltipSize = null;
    const compactMode = isCompactStory();
    if (compactMode !== previousCompactMode) {
      previousCompactMode = compactMode;
      if (compactMode) scrollyStepsNode.tabIndex = 0;
      else scrollyStepsNode.removeAttribute("tabindex");
      applyStaticCopy();
    }
    scheduleStoryActivation();
  }, { passive: true });
  activateClosestScrollStep();

  let sliderRenderFrame = null;

  slider.addEventListener("input", event => {
    if (state.playing) stopPlayback();
    explorer.classList.add("is-scrubbing");
    state.year = +event.target.value;
    if (sliderRenderFrame !== null) return;
    sliderRenderFrame = window.requestAnimationFrame(() => {
      sliderRenderFrame = null;
      updateMap(false, { detail: false, secondary: false, temporalOnly: true });
    });
  });

  slider.addEventListener("change", event => {
    if (sliderRenderFrame !== null) {
      window.cancelAnimationFrame(sliderRenderFrame);
      sliderRenderFrame = null;
    }
    explorer.classList.remove("is-scrubbing");
    state.year = +event.target.value;
    updateMap(false);
  });

  slider.addEventListener("blur", () => {
    if (!explorer.classList.contains("is-scrubbing")) return;
    explorer.classList.remove("is-scrubbing");
    updateMap(false);
  });

  playButton.addEventListener("click", () => {
    if (state.playing) {
      stopPlayback();
      updateMap(false);
    } else {
      startPlayback();
    }
  });
  root.querySelector(".reset-view").addEventListener("click", () => {
    projection.rotate(initialRotation);
    renderGeometry();
    renderSketchTextures();
  });

  if (!mobileLite) {
    let dragRenderFrame = null;
    let pendingRotation = null;
    const renderPendingRotation = (full = false) => {
      if (pendingRotation) projection.rotate(pendingRotation);
      pendingRotation = null;
      renderGeometry(!full);
    };
    svg.call(d3.drag()
      .on("start", event => {
        event.subject.rotation = projection.rotate();
        event.subject.pointer = [event.x, event.y];
        hideTooltip();
        stage.classList.add("is-rotating");
      })
      .on("drag", event => {
        const start = event.subject.rotation ?? initialRotation;
        const origin = event.subject.pointer ?? [event.x, event.y];
        pendingRotation = [
          start[0] + (event.x - origin[0]) / 3,
          Math.max(-55, Math.min(55, start[1] - (event.y - origin[1]) / 3)),
          0
        ];
        if (dragRenderFrame !== null) return;
        dragRenderFrame = window.requestAnimationFrame(() => {
          dragRenderFrame = null;
          renderPendingRotation(false);
        });
      })
      .on("end", () => {
        if (dragRenderFrame !== null) {
          window.cancelAnimationFrame(dragRenderFrame);
          dragRenderFrame = null;
        }
        renderPendingRotation(true);
        renderSketchTextures();
        stage.classList.remove("is-rotating");
      }));
  }

  renderGeometry();
  configureMetric(state.indicator);
  setupDeferredAtlas();
  explorer.setAttribute("aria-busy", "false");
}

build().catch(error => {
  console.error(error);
  document.documentElement.lang = state.lang;
  document.documentElement.setAttribute("xml:lang", state.lang);
  root.innerHTML = `<div class="climate-error"><strong>${t("error.title")}</strong><br>${t("error.detail")}</div>`;
});
