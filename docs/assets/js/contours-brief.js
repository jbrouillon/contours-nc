(() => {
  "use strict";

  // Diapositives « En bref » communes à tout le site.
  //
  // L'auteur écrit seulement les diapositives :
  //
  //   <section class="contours-brief" data-contours-brief
  //            data-brief-lede="Six écrans pour…">
  //     <article class="contours-brief-slide">
  //       <div class="contours-brief-copy">
  //         <p class="contours-brief-step">1 · Thème</p>
  //         <h3>Phrase-résultat.</h3>
  //         <p class="contours-brief-big"><span>40 %</span></p>
  //         <p>Précision ou source.</p>
  //       </div>
  //       <svg class="contours-brief-sketch" data-brief-sketch="…" viewBox="0 0 420 240"
  //            role="img" aria-label="…"></svg>
  //     </article>
  //   </section>
  //
  // Sans JavaScript, les diapositives restent lisibles à la suite les unes des
  // autres. Avec JavaScript, ce script construit le bouton de lancement, le
  // dialogue, la navigation et les points. À la première ouverture, il émet
  // l'événement « contours-brief:open » sur la section (detail.dialog) pour
  // que l'article dessine ses croquis.

  const roots = Array.from(document.querySelectorAll("[data-contours-brief]"));
  if (!roots.length) return;

  const params = new URLSearchParams(window.location.search);
  let openRoot = null;

  function element(tag, className, attributes = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  roots.forEach((root, rootIndex) => {
    const slides = Array.from(root.querySelectorAll(".contours-brief-slide"));
    if (!slides.length) return;
    const key = root.id || `en-bref-${rootIndex + 1}`;
    const titleId = `${key}-titre`;
    const count = slides.length;
    let activeIndex = 0;
    let previousFocus = null;
    let touchStartX = null;
    let announced = false;

    // --- Lancement ---------------------------------------------------------------
    const launch = element("div", "contours-brief-launch");
    const launchCopy = element("div");
    const kicker = element("p", "contours-brief-kicker");
    kicker.textContent = "Lecture express";
    const lede = element("p", "contours-brief-lede");
    lede.textContent = root.dataset.briefLede || `${count} écrans pour l’essentiel de l’article.`;
    launchCopy.append(kicker, lede);
    const openButton = element("button", "contours-brief-open", { type: "button", "aria-haspopup": "dialog" });
    openButton.innerHTML = "Voir l’article en bref <span aria-hidden=\"true\">→</span>";
    launch.append(launchCopy, openButton);

    // --- Dialogue ------------------------------------------------------------------
    const dialog = element("div", "contours-brief-dialog", {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId
    });
    dialog.hidden = true;
    const panel = element("div", "contours-brief-panel");
    const header = element("header", "contours-brief-header");
    const headerCopy = element("div");
    const headerKicker = element("p", "contours-brief-kicker");
    headerKicker.textContent = "Lecture express";
    const title = element("h2", null, { id: titleId });
    title.textContent = root.dataset.briefTitle || "En bref";
    headerCopy.append(headerKicker, title);
    const tools = element("div", "contours-brief-header-tools");
    const counter = element("span", "contours-brief-count", { "aria-live": "polite" });
    const closeButton = element("button", "contours-brief-close", { type: "button", "aria-label": "Fermer le résumé" });
    closeButton.textContent = "×";
    tools.append(counter, closeButton);
    header.append(headerCopy, tools);

    const stage = element("div", "contours-brief-stage");
    slides.forEach((slide, index) => {
      slide.id = slide.id || `${key}-diapositive-${index + 1}`;
      slide.setAttribute("aria-roledescription", "diapositive");
      slide.setAttribute("aria-label", `${index + 1} sur ${count}`);
      stage.appendChild(slide);
    });

    const nav = element("footer", "contours-brief-nav");
    const previousButton = element("button", null, { type: "button" });
    previousButton.textContent = "← Précédent";
    const dots = element("div", "contours-brief-dots", { role: "group", "aria-label": "Choisir une diapositive" });
    const nextButton = element("button", null, { type: "button" });
    slides.forEach((slide, index) => {
      const dot = element("button", "contours-brief-dot", {
        type: "button",
        "aria-label": `Afficher la diapositive ${index + 1}`,
        "aria-controls": slide.id
      });
      dot.addEventListener("click", () => showSlide(index));
      dots.appendChild(dot);
    });
    nav.append(previousButton, dots, nextButton);
    panel.append(header, stage, nav);
    dialog.appendChild(panel);

    root.replaceChildren(launch);
    root.classList.add("is-enhanced");
    // Le dialogue sort de l'article pour rester calé sur la fenêtre, y compris
    // lorsque la grille Quarto déborde sur mobile.
    document.body.appendChild(dialog);

    function updateAddress(isOpen) {
      const url = new URL(window.location.href);
      if (isOpen) {
        url.searchParams.set("lecture", "en-bref");
        url.searchParams.set("slide", String(activeIndex + 1));
      } else {
        url.searchParams.delete("lecture");
        url.searchParams.delete("slide");
      }
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    function showSlide(index) {
      activeIndex = Math.max(0, Math.min(index, count - 1));
      slides.forEach((slide, slideIndex) => {
        slide.hidden = slideIndex !== activeIndex;
      });
      Array.from(dots.children).forEach((dot, dotIndex) => {
        if (dotIndex === activeIndex) dot.setAttribute("aria-current", "step");
        else dot.removeAttribute("aria-current");
      });
      counter.textContent = `${activeIndex + 1} / ${count}`;
      previousButton.disabled = activeIndex === 0;
      nextButton.textContent = activeIndex === count - 1 ? "Terminer" : "Suivant →";
      if (!dialog.hidden) updateAddress(true);
    }

    function open(index = 0, updateUrl = true) {
      if (openRoot && openRoot !== root) openRoot.contoursBrief.close(false);
      openRoot = root;
      previousFocus = document.activeElement;
      dialog.hidden = false;
      document.body.classList.add("contours-brief-is-open");
      showSlide(index);
      if (!updateUrl) updateAddress(true);
      if (!announced) {
        announced = true;
        root.dispatchEvent(new CustomEvent("contours-brief:open", { detail: { dialog, slides } }));
      }
      window.requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
    }

    function close(updateUrl = true) {
      if (dialog.hidden) return;
      dialog.hidden = true;
      document.body.classList.remove("contours-brief-is-open");
      if (openRoot === root) openRoot = null;
      if (updateUrl) updateAddress(false);
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    }

    root.contoursBrief = { dialog, open, close, isOpen: () => !dialog.hidden };

    openButton.addEventListener("click", () => open(0));
    closeButton.addEventListener("click", () => close());
    previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
    nextButton.addEventListener("click", () => {
      if (activeIndex === count - 1) close();
      else showSlide(activeIndex + 1);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
      // Un lien interne ferme le résumé avant de rejoindre la section visée.
      const link = event.target.closest("a[href^='#']");
      if (link) close();
    });
    stage.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    stage.addEventListener("touchend", (event) => {
      if (touchStartX == null) return;
      const delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 55) showSlide(activeIndex + (delta < 0 ? 1 : -1));
      touchStartX = null;
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (dialog.hidden) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") showSlide(activeIndex + 1);
      else if (event.key === "ArrowLeft") showSlide(activeIndex - 1);
      else if (event.key === "Tab") {
        const focusable = Array.from(dialog.querySelectorAll("button:not([disabled]), a[href], [tabindex='0']"))
          .filter((node) => node.offsetParent !== null);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    showSlide(0);
    // Lien direct : ?lecture=en-bref&slide=3 (premier résumé de la page).
    if (rootIndex === 0 && params.get("lecture") === "en-bref") {
      const requested = Number.parseInt(params.get("slide"), 10);
      open(Number.isFinite(requested) ? requested - 1 : 0, false);
    }
  });
})();
