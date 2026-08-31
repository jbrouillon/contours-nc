import { Window } from "npm:happy-dom";

const browserWindow = new Window({ url: "http://127.0.0.1:8765/index.html" });
globalThis.window = browserWindow;
globalThis.document = browserWindow.document;
globalThis.navigator = browserWindow.navigator;
browserWindow.document.body.innerHTML = '<div id="climate-map"></div>';

browserWindow.matchMedia = query => ({
  matches: query.includes("max-width: 760px") || query.includes("max-width: 1239px"),
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() { return true; }
});

let atlasObserverCallback = null;
browserWindow.IntersectionObserver = class {
  constructor(callback) {
    atlasObserverCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
};

const rasterContext = {
  fillStyle: "",
  fillRect() {}
};
browserWindow.HTMLCanvasElement.prototype.getContext = () => rasterContext;
browserWindow.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,iVBORw0KGgo=";

const nativeFetch = globalThis.fetch;
const DATA_ROOT = "../../assets/data/pacific-climate-fingerprints";
const localFiles = new Map([
  [`${DATA_ROOT}/climate_interactive.csv`, "text/csv"],
  [`${DATA_ROOT}/global_context.csv`, "text/csv"],
  [`${DATA_ROOT}/territory_context.csv`, "text/csv"],
  [`${DATA_ROOT}/eez.geojson`, "application/json"]
]);
let requestedLand = "";
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (localFiles.has(url)) {
    return new Response(await Deno.readTextFile(url), {
      headers: { "content-type": localFiles.get(url) }
    });
  }
  if (url.includes("world-atlas@2/land-")) {
    requestedLand = url;
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

const beforeAtlas = {
  renderMode: document.querySelector(".climate-explorer")?.dataset.renderMode,
  land: requestedLand,
  svgWidth: document.querySelector(".map-svg")?.getAttribute("width"),
  svgHeight: document.querySelector(".map-svg")?.getAttribute("height"),
  zones: document.querySelectorAll("path.zone").length,
  sketchZones: document.querySelectorAll("path.zone-sketch").length,
  mapFilters: document.querySelectorAll(".map-svg filter").length,
  zoneTextures: document.querySelectorAll(".zone-pencil-texture").length,
  roughCoasts: document.querySelectorAll(".rough-coast").length,
  portraitStripes: document.querySelectorAll(".portrait-stripe").length,
  portraitRasters: document.querySelectorAll(".portrait-ribbon-raster").length,
  wallRows: document.querySelectorAll(".ribbon-row").length,
  detailRows: document.querySelectorAll(".ribbon-detail-metric-row").length
};

if (beforeAtlas.renderMode !== "lite" || beforeAtlas.land !== "" || beforeAtlas.svgWidth !== "900" || beforeAtlas.svgHeight !== "650" || beforeAtlas.zones !== 21 || beforeAtlas.sketchZones !== 0 || beforeAtlas.mapFilters !== 0 || beforeAtlas.zoneTextures !== 0 || beforeAtlas.roughCoasts !== 0 || beforeAtlas.portraitStripes !== 0 || beforeAtlas.portraitRasters !== 1 || beforeAtlas.wallRows !== 0 || beforeAtlas.detailRows !== 0 || !atlasObserverCallback) {
  throw new Error(JSON.stringify(beforeAtlas));
}

const compactScroller = document.querySelector(".scrolly-steps");
const compactScrollSteps = [...document.querySelectorAll(".scroll-step")];
let compactScrollOffset = 0;
Object.defineProperty(compactScroller, "clientWidth", { configurable: true, value: 600 });
compactScroller.getBoundingClientRect = () => ({ top: 0, bottom: 180, left: 0, right: 600, width: 600, height: 180 });
compactScrollSteps.forEach((step, index) => {
  step.getBoundingClientRect = () => {
    const left = index * 340 - compactScrollOffset;
    return { top: 0, bottom: 160, left, right: left + 320, width: 320, height: 160 };
  };
});
compactScrollOffset = 3 * 340 + 160 - compactScroller.clientWidth / 2;
compactScroller.dispatchEvent(new browserWindow.Event("scroll"));
await new Promise(resolve => browserWindow.requestAnimationFrame(resolve));
if (!document.querySelector('.scroll-step[data-step="rainfall"]').classList.contains("is-active") || document.querySelector(".year-output")?.textContent !== "2015") {
  throw new Error("Horizontal scrolling did not activate the closest compact story scene immediately");
}
document.querySelector('.scroll-step[data-step="opening"]').dispatchEvent(new browserWindow.Event("click", { bubbles: true }));

atlasObserverCallback([{ isIntersecting: true }]);
await new Promise(resolve => setTimeout(resolve, 50));

const afterAtlas = {
  wallRows: document.querySelectorAll(".ribbon-row").length,
  wallStripes: document.querySelectorAll(".ribbon-stripe").length,
  wallRasters: document.querySelectorAll(".ribbon-wall-raster").length,
  detailRows: document.querySelectorAll(".ribbon-detail-metric-row").length,
  detailStripes: document.querySelectorAll(".ribbon-detail-stripe").length,
  detailRasters: document.querySelectorAll(".ribbon-detail-raster").length,
  wallViewBox: document.querySelector(".ribbon-wall")?.getAttribute("viewBox"),
  detailViewBox: document.querySelector(".ribbon-detail-svg")?.getAttribute("viewBox")
};

if (afterAtlas.wallRows !== 22 || afterAtlas.wallStripes !== 0 || afterAtlas.wallRasters !== 22 || afterAtlas.detailRows !== 4 || afterAtlas.detailStripes !== 0 || afterAtlas.detailRasters !== 4 || afterAtlas.wallViewBox !== "0 0 420 650" || afterAtlas.detailViewBox !== "0 0 440 430") {
  throw new Error(JSON.stringify(afterAtlas));
}

console.log(JSON.stringify({ beforeAtlas, afterAtlas, status: "ok" }));
browserWindow.close();
