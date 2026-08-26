import { Window } from "npm:happy-dom";

const browserWindow = new Window({ url: "http://127.0.0.1:8765/index.html" });
globalThis.window = browserWindow;
globalThis.document = browserWindow.document;
globalThis.navigator = browserWindow.navigator;
browserWindow.document.body.innerHTML = '<div id="climate-map"></div>';

const { translate } = await import("../../assets/js/pacific-climate-fingerprints/climate-i18n.js");
const i18nSource = await Deno.readTextFile("../../assets/js/pacific-climate-fingerprints/climate-i18n.js");
const enStart = i18nSource.indexOf("  en: {");
const frStart = i18nSource.indexOf("  fr: {");
const copyEnd = i18nSource.indexOf("\n};\n\nconst TERRITORIES");
const extractKeys = block => [...block.matchAll(/^\s{4}"([^"]+)":/gm)].map(match => match[1]);
const enKeys = extractKeys(i18nSource.slice(enStart, frStart));
const frKeys = extractKeys(i18nSource.slice(frStart, copyEnd));
if (enKeys.length !== frKeys.length || enKeys.some((key, index) => key !== frKeys[index])) {
  throw new Error("English and French translation keys are not aligned");
}
enKeys.forEach(key => {
  const placeholders = language => [...translate(language, key).matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map(match => match[1])
    .sort()
    .join(",");
  if (placeholders("en") !== placeholders("fr")) {
    throw new Error(`Translation placeholders differ for ${key}`);
  }
});

const nativeFetch = globalThis.fetch;
const DATA_ROOT = "../../assets/data/pacific-climate-fingerprints";
const DATA = {
  climate: `${DATA_ROOT}/climate_interactive.csv`,
  globalContext: `${DATA_ROOT}/global_context.csv`,
  territoryContext: `${DATA_ROOT}/territory_context.csv`,
  eez: `${DATA_ROOT}/eez.geojson`
};
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === DATA.climate) {
    return new Response(await Deno.readTextFile(DATA.climate), {
      headers: { "content-type": "text/csv" }
    });
  }
  if (url === DATA.globalContext) {
    return new Response(await Deno.readTextFile(DATA.globalContext), {
      headers: { "content-type": "text/csv" }
    });
  }
  if (url === DATA.territoryContext) {
    return new Response(await Deno.readTextFile(DATA.territoryContext), {
      headers: { "content-type": "text/csv" }
    });
  }
  if (url === DATA.eez) {
    return new Response(await Deno.readTextFile(DATA.eez), {
      headers: { "content-type": "application/json" }
    });
  }
  if (url.includes("world-atlas@2/land-50m.json")) {
    return new Response(JSON.stringify({
      type: "Topology",
      objects: { land: { type: "GeometryCollection", geometries: [] } },
      arcs: []
    }), { headers: { "content-type": "application/json" } });
  }
  return nativeFetch(input, init);
};

await import("../../assets/js/pacific-climate-fingerprints/climate-map-interactive.js");
await new Promise(resolve => setTimeout(resolve, 1500));

const error = document.querySelector(".climate-error");
if (error) throw new Error(error.textContent);

const actual = {
  zones: document.querySelectorAll("path.zone").length,
  sketchZones: document.querySelectorAll("path.zone-sketch").length,
  tabs: document.querySelectorAll(".metric-tab").length,
  stories: document.querySelectorAll(".story-step").length,
  scrollSteps: document.querySelectorAll(".scroll-step").length,
  wallRows: document.querySelectorAll(".ribbon-row").length,
  detailMetricRows: document.querySelectorAll(".ribbon-detail-metric-row").length,
  detailEvolution: document.querySelectorAll(".ribbon-detail-evolution").length,
  territorySummary: document.querySelector(".territory-summary-text")?.textContent,
  portraitStripes: document.querySelectorAll(".portrait-stripe").length,
  detailStripes: document.querySelectorAll(".ribbon-detail-stripe").length,
  detailTitle: document.querySelector(".ribbon-detail-title")?.textContent,
  detailMetric: document.querySelector(".ribbon-detail-metric")?.textContent,
  tooltipPortal: document.querySelector(".ribbon-tooltip")?.parentElement === document.body,
  contextTitle: document.querySelector(".context-title")?.textContent,
  contextValue: document.querySelector(".context-value")?.textContent,
  title: document.querySelector(".panel-title")?.textContent,
  year: document.querySelector(".year-output")?.textContent
};

if (actual.zones !== 21 || actual.sketchZones !== 42 || actual.tabs !== 4 || actual.stories !== 3 || actual.scrollSteps !== 6 || actual.wallRows !== 22 || actual.detailMetricRows !== 4 || actual.detailEvolution !== 4 || !actual.territorySummary?.includes("ocean and land are warmer") || actual.portraitStripes !== 176 || actual.detailStripes !== 430 || actual.detailTitle !== "New Caledonia" || actual.detailMetric !== "4 indicators · 1 shared timeline" || !actual.tooltipPortal || actual.contextTitle !== "The backdrop, not a local score" || actual.contextValue !== "427.4" || actual.title !== "New Caledonia" || actual.year !== "2025") {
  throw new Error(JSON.stringify(actual));
}

document.querySelector('.language-button[data-lang="fr"]').click();
await new Promise(resolve => setTimeout(resolve, 50));
const frenchCopy = {
  header: document.querySelector(".explorer-header h1")?.textContent,
  lede: document.querySelector(".lede")?.textContent,
  prompt: document.querySelector(".explore-prompt")?.textContent,
  question: document.querySelector(".map-question")?.textContent,
  atlasTitle: document.querySelector("#ribbon-atlas-title")?.textContent,
  atlasIntro: document.querySelector(".ribbon-atlas-intro")?.textContent,
  contextTitle: document.querySelector(".context-title")?.textContent,
  panelTitle: document.querySelector(".panel-title")?.textContent,
  summary: document.querySelector(".territory-summary-text")?.textContent,
  seaTitle: document.querySelector("#story-sea-rise h2")?.textContent
};
if (frenchCopy.header !== "Un même Pacifique, vingt-deux trajectoires climatiques." || !frenchCopy.lede?.includes("sans masquer les différences") || frenchCopy.prompt !== "Choisissez l’indicateur à afficher pour l’ensemble des territoires." || frenchCopy.question !== "Température de la mer : plus chaude ou plus fraîche que la normale ?" || frenchCopy.atlasTitle !== "Vingt-deux trajectoires climatiques" || !frenchCopy.atlasIntro?.includes("les quatre séries climatiques") || frenchCopy.contextTitle !== "Une tendance mondiale, pas un bilan local" || frenchCopy.panelTitle !== "Nouvelle-Calédonie" || !frenchCopy.summary?.includes("leurs niveaux de référence") || frenchCopy.seaTitle !== "Le niveau marin s’élève") {
  throw new Error(JSON.stringify(frenchCopy));
}
document.querySelector('.language-button[data-lang="en"]').click();
await new Promise(resolve => setTimeout(resolve, 50));
if (document.querySelector(".panel-title")?.textContent !== "New Caledonia" || document.querySelector(".explorer-header h1")?.textContent !== "One Pacific. Twenty-two climate trajectories.") {
  throw new Error("Switching back to English failed");
}

const mapTooltipZone = document.querySelector('path.zone[data-code="FJ"]');
mapTooltipZone.dispatchEvent(new browserWindow.MouseEvent("pointerenter", { bubbles: true, clientX: 320, clientY: 240 }));
mapTooltipZone.dispatchEvent(new browserWindow.MouseEvent("pointermove", { bubbles: true, clientX: 340, clientY: 250 }));
await new Promise(resolve => browserWindow.requestAnimationFrame(resolve));
const mapTooltip = document.querySelector(".climate-tooltip");
if (mapTooltip.hidden || !mapTooltip.style.transform.includes("translate3d")) {
  throw new Error("Map tooltip positioning failed");
}
mapTooltipZone.dispatchEvent(new browserWindow.MouseEvent("pointerleave", { bubbles: true }));

const ribbonTooltipStripe = document.querySelector("rect.ribbon-stripe");
ribbonTooltipStripe.dispatchEvent(new browserWindow.MouseEvent("pointerenter", { bubbles: true, clientX: 520, clientY: 430 }));
ribbonTooltipStripe.dispatchEvent(new browserWindow.MouseEvent("pointermove", { bubbles: true, clientX: 540, clientY: 440 }));
await new Promise(resolve => browserWindow.requestAnimationFrame(resolve));
const testedRibbonTooltip = document.querySelector(".ribbon-tooltip");
if (testedRibbonTooltip.hidden || !testedRibbonTooltip.style.transform.includes("translate3d")) {
  throw new Error("Ribbon tooltip positioning failed");
}
ribbonTooltipStripe.dispatchEvent(new browserWindow.MouseEvent("pointerleave", { bubbles: true }));

document.querySelector('.scroll-step[data-step="rainfall"]').dispatchEvent(new browserWindow.Event("click", { bubbles: true }));
if (document.querySelector(".year-output")?.textContent !== "2015" || !document.querySelector('.scroll-step[data-step="rainfall"]').classList.contains("is-active")) {
  throw new Error("Rainfall scroll scene was not activated");
}
const slider = document.querySelector('[data-testid="year-slider"]');
slider.value = "2000";
slider.dispatchEvent(new browserWindow.Event("input", { bubbles: true }));
document.querySelector('path.zone[data-code="TO"]').dispatchEvent(new browserWindow.Event("click", { bubbles: true }));

const interaction = {
  year: document.querySelector(".year-output")?.textContent,
  title: document.querySelector(".panel-title")?.textContent,
  question: document.querySelector(".map-question")?.textContent,
  headline: document.querySelector(".story-headline")?.textContent,
  contextKicker: document.querySelector(".context-kicker")?.textContent,
  portraitStripes: document.querySelectorAll(".portrait-stripe").length
};

if (interaction.year !== "2000" || interaction.title !== "Tonga" || interaction.portraitStripes !== 47 || !interaction.contextKicker.includes("ENSO") || !interaction.question.includes("rainfall deficit or surplus") || interaction.headline !== "One Pacific, opposite rain") {
  throw new Error(JSON.stringify(interaction));
}

document.querySelector('[data-chapter="sea-rise"]').click();
const seaInteraction = {
  year: document.querySelector(".year-output")?.textContent,
  contextTitle: document.querySelector(".context-title")?.textContent,
  current: document.querySelector('[data-chapter="sea-rise"]').getAttribute("aria-current")
};
if (seaInteraction.year !== "2023" || seaInteraction.contextTitle !== "Tonga, in people" || seaInteraction.current !== "step") {
  throw new Error(JSON.stringify(seaInteraction));
}

document.querySelector('.ribbon-row[data-code="PN"]').dispatchEvent(new browserWindow.Event("click", { bubbles: true }));
if (document.querySelector(".panel-title")?.textContent !== "Pitcairn Islands" || document.querySelector(".ribbon-detail-title")?.textContent !== "Pitcairn Islands" || document.querySelector(".climate-error")) {
  throw new Error("Ribbon-only territory selection failed");
}

document.querySelector('path.zone[data-code="NC"]').dispatchEvent(new browserWindow.Event("click", { bubbles: true }));
let exportStrokeCount = 0;
let exportTextCount = 0;
let exportBezierCount = 0;
let exportInvalidNoneFillCount = 0;
const canvasStates = [];
const mockCanvasContext = {
  globalAlpha: 1,
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  font: "",
  textAlign: "left",
  save() {
    canvasStates.push({
      globalAlpha: this.globalAlpha,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font,
      textAlign: this.textAlign
    });
  },
  restore() { Object.assign(this, canvasStates.pop() ?? {}); },
  beginPath() {},
  closePath() {},
  moveTo() {},
  lineTo() {},
  bezierCurveTo() { exportBezierCount += 1; },
  arcTo() {},
  setLineDash() {},
  clip() {},
  fill() {},
  fillRect() {},
  stroke() {
    exportStrokeCount += 1;
    if (this.strokeStyle === "none") exportInvalidNoneFillCount += 1;
  },
  fillText() { exportTextCount += 1; },
  measureText(value) { return { width: String(value).length * 10 }; }
};
browserWindow.HTMLCanvasElement.prototype.getContext = () => mockCanvasContext;
browserWindow.HTMLCanvasElement.prototype.toBlob = function(callback) {
  callback(new Blob(["png"], { type: "image/png" }));
};
browserWindow.HTMLAnchorElement.prototype.click = function() {};
document.querySelector(".portrait-export").click();
await new Promise(resolve => setTimeout(resolve, 50));
if (exportStrokeCount < 40 || exportBezierCount < 200 || exportTextCount < 20 || exportInvalidNoneFillCount) {
  throw new Error(JSON.stringify({ exportStrokeCount, exportBezierCount, exportTextCount, exportInvalidNoneFillCount }));
}

console.log(JSON.stringify({ ...actual, interaction, exportStrokeCount, exportBezierCount, exportTextCount, exportInvalidNoneFillCount, status: "ok" }));
browserWindow.close();
