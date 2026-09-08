const LABEL_SELECTOR = [
  ".listing-update-banner",
  ".quarto-category",
  ".listing-category",
  ".quarto-title-meta-heading",
  ".home-kicker",
  ".dossier-kicker",
  ".resource-kicker",
  ".gallery-kicker",
  ".home-feature__eyebrow",
  ".dossier-card__phase",
  ".viz-gallery-card__meta",
  ".resource-card__meta",
  ".dossier-tag",
  ".viz-gallery-tag",
  ".resource-tag",
  ".article-related-kicker",
  ".destination-method-kicker",
  ".vote-brief-kicker",
  ".vote-brief-step"
].join(",");

const svgNamespace = "http://www.w3.org/2000/svg";
const states = new WeakMap();
let roughPromise;

function roughSeed(value) {
  let hash = 2166136261;
  for (const character of String(value || "contours-label")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 2147483646) + 1;
}

function loadRough() {
  if (!roughPromise) {
    roughPromise = import("https://cdn.jsdelivr.net/npm/roughjs@4.6.6/+esm")
      .then((module) => module.default);
  }
  return roughPromise;
}

function contentKey(element) {
  return `${element.className}|${element.textContent.trim()}`;
}

function prepareLabel(element) {
  if (states.has(element) || element.closest("svg")) return states.get(element);

  const content = document.createElement("span");
  content.className = "contours-sketch-label__content";
  while (element.firstChild) content.appendChild(element.firstChild);

  const sketch = document.createElementNS(svgNamespace, "svg");
  sketch.classList.add("contours-sketch-label__sketch");
  sketch.setAttribute("aria-hidden", "true");
  sketch.setAttribute("preserveAspectRatio", "none");

  element.append(sketch, content);
  element.classList.add("contours-sketch-label");

  const seed = roughSeed(contentKey(element));
  element.style.setProperty("--sketch-label-rotation", `${((seed % 7) - 3) * 0.12}deg`);
  const state = { content, sketch, seed, frame: 0 };
  states.set(element, state);
  return state;
}

function drawLabel(element, rough) {
  const state = prepareLabel(element);
  if (!state || !element.isConnected) return;
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(() => {
    const bounds = element.getBoundingClientRect();
    if (bounds.width < 4 || bounds.height < 4) return;

    const bleed = 5;
    const width = Math.round(bounds.width * 10) / 10;
    const height = Math.round(bounds.height * 10) / 10;
    state.sketch.replaceChildren();
    state.sketch.setAttribute("viewBox", `0 0 ${width + bleed * 2} ${height + bleed * 2}`);

    const rc = rough.svg(state.sketch);
    const frame = rc.rectangle(bleed, bleed, width, height, {
      seed: state.seed,
      roughness: 1.55,
      bowing: 1.25,
      stroke: "#3f6651",
      strokeWidth: 1.15,
      fill: "#dfe9df",
      fillStyle: "hachure",
      hachureAngle: -42 + (state.seed % 9),
      hachureGap: 7,
      fillWeight: 0.4
    });
    state.sketch.appendChild(frame);
  });
}

async function decorate(root = document) {
  const elements = [];
  if (root instanceof Element && root.matches(LABEL_SELECTOR)) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll(LABEL_SELECTOR));
  const pending = elements.filter((element) => !states.has(element) && !element.closest("svg"));
  if (!pending.length) return;

  const rough = await loadRough();
  pending.forEach((element) => drawLabel(element, rough));

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => drawLabel(entry.target, rough));
    });
    pending.forEach((element) => observer.observe(element));
  }
}

async function start() {
  if (document.fonts?.ready) await document.fonts.ready;
  await decorate(document);
  const mutations = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) decorate(node);
      });
    });
  });
  mutations.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
