/*
 * Slide-story runtime for Pacific Climate Fingerprints.
 *
 * Keeps climate-map-interactive.js untouched and loads it after two targeted
 * runtime patches:
 *   1. enable the existing D3 globe drag on mobile/coarse pointers;
 *   2. disable scroll-position-driven story activation so the story behaves
 *      as explicit slides controlled by buttons/swipe/keyboard.
 */

const coreUrl = new URL("./climate-map-interactive.js", import.meta.url);
const i18nUrl = new URL("./climate-i18n.js", import.meta.url);

async function loadPatchedCore() {
  const response = await fetch(coreUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Unable to load climate core (${response.status})`);

  let source = await response.text();

  // Blob modules cannot resolve the core's relative i18n import, so make it absolute.
  source = source.replace(
    'from "./climate-i18n.js";',
    `from ${JSON.stringify(i18nUrl.href)};`
  );

  // The core deliberately skips d3.drag() when mobileLite is true. Enable only
  // this existing drag block while keeping every other mobileLite optimisation.
  const dragGate = "if (!mobileLite) {\n    let dragRenderFrame = null;";
  if (source.includes(dragGate)) {
    source = source.replace(
      dragGate,
      "if (true) {\n    let dragRenderFrame = null;"
    );
  } else {
    console.warn("Pacific Climate: mobile globe drag gate was not found; core loaded without that patch.");
  }

  // Slide mode is explicit navigation. Do not let vertical page scrolling select
  // a story card behind the user's back.
  const windowScrollActivation = 'window.addEventListener("scroll", scheduleStoryActivation, { passive: true });';
  if (source.includes(windowScrollActivation)) {
    source = source.replace(
      windowScrollActivation,
      "// Slide mode: vertical page scrolling must not change the active story step."
    );
  }

  const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(blobUrl);
  } finally {
    // Imports have already been resolved by this point.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }
}

function setupSlides() {
  const root = document.querySelector("#climate-map");
  const scrolly = root?.querySelector(".scrolly-story");
  const stepsNode = root?.querySelector(".scrolly-steps");
  const steps = Array.from(root?.querySelectorAll(".scroll-step") ?? []);
  const previous = root?.querySelector(".story-previous");
  const next = root?.querySelector(".story-next");
  const controls = root?.querySelector(".story-controls");
  const explorer = root?.querySelector(".climate-explorer");

  if (!scrolly || !stepsNode || !steps.length || !previous || !next || !controls) return false;
  if (scrolly.dataset.slideMode === "true") return true;

  scrolly.dataset.slideMode = "true";
  scrolly.classList.add("is-slide-story");
  explorer?.classList.add("has-slide-story");
  stepsNode.setAttribute("tabindex", "0");

  const progress = document.createElement("div");
  progress.className = "story-slide-progress";
  progress.setAttribute("aria-live", "polite");
  progress.innerHTML = `
    <span class="story-slide-count"></span>
    <div class="story-slide-dots" aria-hidden="true"></div>
  `;
  const dots = progress.querySelector(".story-slide-dots");
  steps.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = "story-slide-dot";
    dot.dataset.index = String(index);
    dots.appendChild(dot);
  });
  previous.insertAdjacentElement("afterend", progress);

  const activeIndex = () => {
    const index = steps.findIndex(step => step.classList.contains("is-active"));
    return index >= 0 ? index : 0;
  };

  const update = () => {
    const index = activeIndex();
    progress.querySelector(".story-slide-count").textContent = `${index + 1} / ${steps.length}`;
    progress.querySelectorAll(".story-slide-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
    previous.disabled = index === 0;
    previous.setAttribute("aria-disabled", String(index === 0));
    next.classList.toggle("is-final", index === steps.length - 1);
    next.setAttribute("data-slide-index", String(index));
  };

  // Existing core buttons remain the source of truth for changing the climate state.
  // On the final slide, clicking Next moves naturally into free exploration.
  next.addEventListener("click", () => {
    if (activeIndex() !== steps.length - 1) return;
    const destination = root.querySelector(".explore-row") || root.querySelector(".ribbon-atlas");
    destination?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Swipe only on the narrative card area. The globe has its own touch gesture.
  let touchStart = null;
  stepsNode.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { passive: true });
  stepsNode.addEventListener("pointerup", event => {
    if (!touchStart || event.pointerId !== touchStart.id) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
    if (dx < 0) next.click();
    else previous.click();
  }, { passive: true });
  stepsNode.addEventListener("pointercancel", () => { touchStart = null; }, { passive: true });

  stepsNode.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    (event.key === "ArrowRight" ? next : previous).click();
  });

  // Observe the core's is-active class rather than duplicating its state machine.
  const observer = new MutationObserver(update);
  steps.forEach(step => observer.observe(step, { attributes: true, attributeFilter: ["class"] }));
  update();

  // Avoid the loading/fallback-card flash once the application exists.
  root.querySelector(".climate-fallback")?.setAttribute("aria-hidden", "true");
  return true;
}

async function boot() {
  try {
    await loadPatchedCore();
  } catch (error) {
    console.error("Pacific Climate slide runtime failed; loading the unmodified core.", error);
    await import(coreUrl.href);
  }

  if (setupSlides()) return;
  const observer = new MutationObserver(() => {
    if (!setupSlides()) return;
    observer.disconnect();
  });
  observer.observe(document.querySelector("#climate-map") ?? document.body, {
    childList: true,
    subtree: true
  });
}

boot();
