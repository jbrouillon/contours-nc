(function() {
  "use strict";

  const root = document.querySelector("[data-vote-brief]");
  if (!root) return;

  const pageTitle = document.querySelector("#title-block-header h1.title");
  const versionMarker = "[Version 2]";
  if (pageTitle && pageTitle.textContent.trim().startsWith(versionMarker)) {
    const titleText = pageTitle.textContent.trim().slice(versionMarker.length).trim();
    const marker = document.createElement("span");
    marker.className = "article-title-version";
    const markerText = document.createElement("span");
    markerText.className = "article-title-version__text";
    markerText.textContent = versionMarker;
    if (window.rough && typeof window.rough.svg === "function") {
      const sketch = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      sketch.classList.add("article-title-version__sketch");
      sketch.setAttribute("viewBox", "0 0 120 34");
      sketch.setAttribute("preserveAspectRatio", "none");
      sketch.setAttribute("aria-hidden", "true");
      const frame = window.rough.svg(sketch).rectangle(4, 4, 112, 26, {
        seed: 2026,
        roughness: 1.55,
        bowing: 1.25,
        stroke: "#3f6651",
        strokeWidth: 1.25,
        fill: "#dfe9df",
        fillStyle: "hachure",
        hachureGap: 7,
        fillWeight: 0.4
      });
      sketch.appendChild(frame);
      marker.appendChild(sketch);
    }
    marker.appendChild(markerText);
    pageTitle.replaceChildren(marker, document.createTextNode(` ${titleText}`));
  }

  const dialog = root.querySelector("[data-vote-brief-dialog]");
  const openButton = root.querySelector("[data-vote-brief-open]");
  const closeControls = root.querySelectorAll("[data-vote-brief-close]");
  const previousButton = root.querySelector("[data-vote-brief-prev]");
  const nextButton = root.querySelector("[data-vote-brief-next]");
  const counter = root.querySelector("[data-vote-brief-count]");
  const dots = root.querySelector("[data-vote-brief-dots]");
  const stage = root.querySelector(".vote-brief-stage");
  const slides = Array.from(root.querySelectorAll("[data-vote-brief-slide]"));
  let activeIndex = 0;
  let previousFocus = null;
  let touchStartX = null;
  let sketchLoadPromise = null;

  // Le dialogue sort du conteneur de l'article pour rester réellement calé
  // sur la fenêtre, y compris lorsque la grille Quarto déborde sur mobile.
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
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  slides.forEach((slide, index) => {
    slide.id = `vote-brief-slide-${index + 1}`;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "vote-brief-dot";
    dot.setAttribute("aria-label", `Afficher la diapositive ${index + 1}`);
    dot.setAttribute("aria-controls", slide.id);
    dot.addEventListener("click", () => showSlide(index));
    dots.appendChild(dot);
  });

  function showSlide(index) {
    activeIndex = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.hidden = !isActive;
      slide.setAttribute("aria-hidden", String(!isActive));
    });
    Array.from(dots.children).forEach((dot, dotIndex) => {
      if (dotIndex === activeIndex) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
    counter.textContent = `${activeIndex + 1} / ${slides.length}`;
    previousButton.disabled = activeIndex === 0;
    nextButton.textContent = activeIndex === slides.length - 1 ? "Terminer" : "Suivant →";
    if (!dialog.hidden) updateAddress(true);
  }

  function openBrief(updateUrl = true) {
    if (!sketchLoadPromise) sketchLoadPromise = drawSketches();
    previousFocus = document.activeElement;
    dialog.hidden = false;
    document.body.classList.add("vote-brief-is-open");
    if (updateUrl) showSlide(0);
    else showSlide(activeIndex);
    requestAnimationFrame(() => {
      dialog.querySelector("[data-vote-brief-close]").focus({ preventScroll: true });
    });
  }

  function closeBrief(updateUrl = true) {
    dialog.hidden = true;
    document.body.classList.remove("vote-brief-is-open");
    if (updateUrl) updateAddress(false);
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  }

  openButton.addEventListener("click", () => openBrief(true));
  closeControls.forEach((control) => control.addEventListener("click", () => closeBrief(true)));
  previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton.addEventListener("click", () => {
    if (activeIndex === slides.length - 1) closeBrief(true);
    else showSlide(activeIndex + 1);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeBrief(true);
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
    if (event.key === "Escape") closeBrief(true);
    if (event.key === "ArrowRight") showSlide(activeIndex + 1);
    if (event.key === "ArrowLeft") showSlide(activeIndex - 1);
    if (event.key === "Tab") {
      const focusable = Array.from(dialog.querySelectorAll("button:not([disabled]), a[href]"));
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

  const svgNamespace = "http://www.w3.org/2000/svg";
  const colors = {
    ink: "#282521",
    muted: "#746d63",
    paper: "#fffdf8",
    green: "#3f6651",
    yellow: "#d6a21f",
    red: "#c95b43",
    blue: "#34788a"
  };

  function addLabel(svg, text, x, y, options = {}) {
    const node = document.createElementNS(svgNamespace, "text");
    node.textContent = text;
    node.setAttribute("x", x);
    node.setAttribute("y", y);
    node.setAttribute("fill", options.color || colors.ink);
    node.setAttribute("font-size", options.size || 15);
    node.setAttribute("font-weight", options.weight || 750);
    node.setAttribute("font-family", "system-ui, sans-serif");
    if (options.anchor) node.setAttribute("text-anchor", options.anchor);
    svg.appendChild(node);
    return node;
  }

  function addSignature(svg) {
    const mark = addLabel(svg, "contours.nc", 412, 235, {
      anchor: "end", size: 7.5, weight: 760, color: colors.muted
    });
    mark.setAttribute("paint-order", "stroke");
    mark.setAttribute("stroke", colors.paper);
    mark.setAttribute("stroke-width", 1.8);
    mark.setAttribute("stroke-linejoin", "round");
  }

  function addRough(svg, drawable) {
    svg.appendChild(drawable);
  }

  function baseOptions(fill, seed) {
    return {
      seed,
      roughness: 1.35,
      bowing: 1.25,
      stroke: colors.ink,
      strokeWidth: 1.6,
      fill,
      fillStyle: "hachure",
      hachureGap: 5
    };
  }

  function drawTime(svg, rc, leftLabel, leftValue, rightLabel, rightValue) {
    addLabel(svg, leftLabel, 28, 52, { size: 14 });
    addRough(svg, rc.rectangle(28, 68, 180, 46, baseOptions(colors.green, 11)));
    addLabel(svg, leftValue, 220, 98, { size: 18, color: colors.green });
    addLabel(svg, rightLabel, 28, 153, { size: 14 });
    addRough(svg, rc.rectangle(28, 169, 280, 46, baseOptions(colors.red, 12)));
    addLabel(svg, rightValue, 320, 199, { size: 18, color: colors.red });
  }

  function drawDistance(svg, rc) {
    for (let index = 0; index < 10; index += 1) {
      const x = 45 + (index % 5) * 82;
      const y = 73 + Math.floor(index / 5) * 84;
      const highlighted = index < 2;
      addRough(svg, rc.circle(x, y, 42, {
        ...baseOptions(highlighted ? colors.red : colors.paper, 30 + index),
        stroke: highlighted ? colors.red : colors.muted,
        fillStyle: highlighted ? "cross-hatch" : "hachure"
      }));
      addRough(svg, rc.line(x, y + 22, x, y + 45, {
        seed: 70 + index,
        roughness: 1.4,
        stroke: highlighted ? colors.red : colors.muted,
        strokeWidth: 2
      }));
    }
    addLabel(svg, "≈ 1 habitant sur 5", 210, 232, { anchor: "middle", size: 16, color: colors.red });
  }

  function drawVehicle(svg, rc) {
    for (let index = 0; index < 10; index += 1) {
      const x = 33 + (index % 5) * 78;
      const y = 45 + Math.floor(index / 5) * 82;
      const highlighted = index < 3;
      addRough(svg, rc.rectangle(x, y, 54, 39, {
        ...baseOptions(highlighted ? colors.yellow : colors.paper, 100 + index),
        stroke: highlighted ? colors.yellow : colors.muted
      }));
      addRough(svg, rc.circle(x + 13, y + 43, 10, {
        seed: 130 + index,
        roughness: 1.2,
        stroke: colors.ink,
        strokeWidth: 1.5
      }));
      addRough(svg, rc.circle(x + 42, y + 43, 10, {
        seed: 160 + index,
        roughness: 1.2,
        stroke: colors.ink,
        strokeWidth: 1.5
      }));
    }
    addLabel(svg, "près de 3 ménages sur 10", 210, 222, { anchor: "middle", size: 16, color: colors.yellow });
  }

  function drawAbstention(svg, rc) {
    const x = (value) => 105 + (value / 70) * 275;
    addLabel(svg, "Abstention aux municipales 2026", 22, 25, { size: 14, weight: 800 });
    [0, 20, 40, 60].forEach((value) => {
      addRough(svg, rc.line(x(value), 52, x(value), 190, {
        seed: 200 + value,
        roughness: 0.8,
        stroke: "#ded6ca",
        strokeWidth: 1
      }));
      addLabel(svg, `${value} %`, x(value), 207, { anchor: "middle", size: 10.5, color: colors.muted });
    });
    const sectors = [
      { label: "PK6 Nord", value: 38.0, y: 88, color: colors.green, seed: 280 },
      { label: "Portes-de-Fer", value: 66.9, y: 151, color: colors.red, seed: 300 }
    ];
    sectors.forEach((item) => {
      addLabel(svg, item.label, 95, item.y, { anchor: "end", size: 12.5, color: item.color });
      addRough(svg, rc.rectangle(x(0), item.y - 8, x(item.value) - x(0), 16, {
        seed: item.seed,
        roughness: 1.25,
        bowing: 0.9,
        stroke: item.color,
        strokeWidth: 1,
        fill: item.color,
        fillStyle: "hachure",
        hachureGap: 2.5,
        fillWeight: 1
      }));
      addLabel(svg, `${String(item.value).replace(".", ",")} %`, x(item.value) + 10, item.y, {
        size: 13,
        weight: 800,
        color: item.color
      });
    });
    addLabel(svg, "Du minimum au maximum : 28,9 points", 242, 229, { anchor: "middle", size: 13, color: colors.ink, weight: 800 });
  }

  function drawProvincialAbstention(svg, rc) {
    const x = (value) => 105 + (value / 60) * 275;
    addLabel(svg, "Abstention aux provinciales 2026", 22, 25, { size: 14, weight: 800 });
    [0, 20, 40, 60].forEach((value) => {
      addRough(svg, rc.line(x(value), 52, x(value), 190, {
        seed: 700 + value,
        roughness: 0.8,
        stroke: "#ded6ca",
        strokeWidth: 1
      }));
      addLabel(svg, `${value} %`, x(value), 207, { anchor: "middle", size: 10.5, color: colors.muted });
    });
    [
      { label: "N’Géa", value: 15.1, y: 88, color: colors.green, seed: 780 },
      { label: "Centre-ville", value: 54.3, y: 151, color: colors.red, seed: 800 }
    ].forEach((item) => {
      addLabel(svg, item.label, 95, item.y, { anchor: "end", size: 12.5, color: item.color });
      addRough(svg, rc.rectangle(x(0), item.y - 8, x(item.value) - x(0), 16, {
        seed: item.seed,
        roughness: 1.25,
        bowing: 0.9,
        stroke: item.color,
        strokeWidth: 1,
        fill: item.color,
        fillStyle: "hachure",
        hachureGap: 3.5,
        fillWeight: 0.85
      }));
      addLabel(svg, `${String(item.value).replace(".", ",")} %`, x(item.value) + 10, item.y, {
        size: 13, weight: 800, color: item.color
      });
    });
    addLabel(svg, "Du minimum au maximum : 39,2 points", 242, 229, { anchor: "middle", size: 13, color: colors.ink, weight: 800 });
  }

  function drawMeshFallback(svg, rc) {
    addLabel(svg, "37 lieux · 57 bureaux", 105, 24, { anchor: "middle", size: 12.5, weight: 850 });
    addLabel(svg, "9 lieux", 315, 24, { anchor: "middle", size: 14, weight: 850 });
    addRough(svg, rc.rectangle(27, 39, 156, 175, {
      ...baseOptions("#efe7d8", 850), fillStyle: "solid", strokeWidth: 1.2
    }));
    addRough(svg, rc.rectangle(237, 39, 156, 175, {
      ...baseOptions("#efe7d8", 851), fillStyle: "solid", strokeWidth: 1.2
    }));
    for (let index = 0; index < 57; index += 1) {
      const x = 40 + (index % 8) * 18;
      const y = 53 + Math.floor(index / 8) * 21;
      addRough(svg, rc.circle(x, y, 4.5, {
        seed: 860 + index, roughness: 1.1, stroke: colors.red, strokeWidth: 0.8,
        fill: colors.red, fillStyle: "solid"
      }));
    }
    for (let index = 0; index < 9; index += 1) {
      const x = 264 + (index % 3) * 50;
      const y = 74 + Math.floor(index / 3) * 53;
      addRough(svg, rc.circle(x, y, 10, {
        seed: 930 + index, roughness: 1.5, stroke: colors.ink, strokeWidth: 1.5,
        fill: colors.paper, fillStyle: "solid"
      }));
    }
  }

  function drawGainFallback(svg, rc) {
    addLabel(svg, "gain apporté par le 9e lieu", 22, 24, { size: 14, weight: 850 });
    [
      { x: 76, y: 159, r: 104, color: "#2d789c", seed: 980 },
      { x: 183, y: 126, r: 74, color: "#79b7c1", seed: 981 },
      { x: 292, y: 102, r: 47, color: "#bed8cf", seed: 982 }
    ].forEach((item) => {
      addRough(svg, rc.circle(item.x, item.y, item.r, {
        seed: item.seed, roughness: 1.7, stroke: item.color, strokeWidth: 1,
        fill: item.color, fillStyle: "hachure", hachureGap: 5, fillWeight: 0.75
      }));
    });
    addLabel(svg, "Kaméré", 80, 102, { anchor: "middle", size: 13, weight: 850 });
    addLabel(svg, "bleu foncé : gain le plus fort", 397, 223, { anchor: "end", size: 11, color: colors.muted });
  }

  function drawCompactLegend(svg, rc, title, labels, palette, y = 198, seedBase = 2200) {
    const itemWidth = 400 / labels.length;
    addLabel(svg, title, 210, y, {
      anchor: "middle", size: 9.4, weight: 820, color: colors.muted
    });
    labels.forEach((text, index) => {
      const center = 10 + itemWidth * index + itemWidth / 2;
      const width = Math.min(34, itemWidth - 8);
      d3.select(svg).append("rect")
        .attr("x", center - width / 2).attr("y", y + 7)
        .attr("width", width).attr("height", 10)
        .attr("fill", palette[index]).attr("fill-opacity", 0.34);
      const swatch = rc.rectangle(center - width / 2, y + 7, width, 10, {
        seed: seedBase + index,
        roughness: 1.75,
        bowing: 1.25,
        stroke: palette[index],
        strokeWidth: 0.16,
        fill: palette[index],
        fillStyle: "hachure",
        hachureAngle: -43 + ((seedBase + index) % 11),
        hachureGap: 2.65,
        fillWeight: 0.7
      });
      swatch.setAttribute("opacity", "0.96");
      addRough(svg, swatch);
      addLabel(svg, text, center, y + 29, {
        anchor: "middle", size: labels.length > 6 ? 7.3 : 8.2,
        weight: 760, color: colors.muted
      });
    });
  }

  function drawMiniSourceMap(svg, rc, boundary, points) {
    const selection = d3.select(svg);
    const panels = [
      { key: "bureaux_complets", label: "37 lieux · 57 bureaux", extent: [[12, 35], [202, 207]], color: colors.red },
      { key: "centres_9", label: "9 lieux regroupés", extent: [[218, 35], [408, 207]], color: colors.green }
    ];
    panels.forEach((panel, panelIndex) => {
      const projection = d3.geoIdentity().reflectY(true).fitExtent(panel.extent, boundary);
      const path = d3.geoPath(projection);
      selection.append("path")
        .attr("d", path(boundary))
        .attr("fill", "#eee5d5")
        .attr("fill-opacity", 0.95)
        .attr("stroke", "none");
      addRough(svg, rc.path(path(boundary), {
        seed: 1010 + panelIndex,
        roughness: 1.45,
        bowing: 1.1,
        stroke: colors.ink,
        strokeWidth: 1.05,
        fill: "none"
      }));
      points.features
        .filter((feature) => feature.properties.source_group === panel.key)
        .forEach((feature, index) => {
          const [x, y] = projection(feature.geometry.coordinates);
          addRough(svg, rc.circle(x, y, panel.key === "centres_9" ? 8.5 : 3.8, {
            seed: 1040 + panelIndex * 100 + index,
            roughness: panel.key === "centres_9" ? 1.45 : 0.95,
            stroke: panel.key === "centres_9" ? colors.ink : "#7b352d",
            strokeWidth: panel.key === "centres_9" ? 1.35 : 0.55,
            fill: panel.key === "centres_9" ? colors.green : colors.red,
            fillStyle: "solid"
          }));
        });
      addLabel(svg, panel.label, (panel.extent[0][0] + panel.extent[1][0]) / 2, 20, {
        anchor: "middle", size: 13, weight: 850, color: panel.color
      });
    });
    addLabel(svg, "un point = un bureau ou un lieu de vote", 210, 230, {
      anchor: "middle", size: 9.6, weight: 760, color: colors.muted
    });
  }

  function appendRoughContourSurface(svg, rc, configuration) {
    const selection = d3.select(svg);
    const defs = selection.select("defs").empty() ? selection.append("defs") : selection.select("defs");
    const [[x0, y0], [x1, y1]] = configuration.extent;
    const gridStep = 3;
    const nx = Math.max(2, Math.ceil((x1 - x0) / gridStep));
    const ny = Math.max(2, Math.ceil((y1 - y0) / gridStep));
    const values = new Array(nx * ny);
    for (let gy = 0; gy < ny; gy += 1) {
      for (let gx = 0; gx < nx; gx += 1) {
        const value = configuration.averageAt(
          x0 + (gx + 0.5) * gridStep,
          y0 + (gy + 0.5) * gridStep
        );
        values[gx + gy * nx] = value == null ? -999 : value;
      }
    }
    const contours = d3.contours()
      .size([nx, ny])
      .smooth(true)
      .thresholds([-998.5, ...configuration.thresholds])(values);
    const contourPath = d3.geoPath(
      d3.geoIdentity().scale(gridStep).translate([x0, y0])
    );
    const layer = selection.append("g")
      .attr("clip-path", `url(#${configuration.clipId})`);

    contours.forEach((contour, index) => {
      const color = configuration.scale(contour.value);
      const pathData = contourPath(contour);
      const upperPathData = index < contours.length - 1
        ? contourPath(contours[index + 1])
        : null;
      const maskId = `${configuration.clipId}-band-${index}`;
      const mask = defs.append("mask")
        .attr("id", maskId)
        .attr("maskUnits", "userSpaceOnUse")
        .attr("maskContentUnits", "userSpaceOnUse");
      mask.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", 420).attr("height", 240)
        .attr("fill", "black");
      mask.append("path")
        .attr("d", pathData)
        .attr("fill", "white")
        .attr("fill-rule", "evenodd");
      if (upperPathData) {
        mask.append("path")
          .attr("d", upperPathData)
          .attr("fill", "black")
          .attr("fill-rule", "evenodd");
      }
      layer.append("path")
        .attr("d", pathData)
        .attr("fill", color)
        .attr("fill-opacity", 0.34)
        .attr("fill-rule", "evenodd")
        .attr("stroke", "none")
        .attr("mask", `url(#${maskId})`);
      const texture = rc.path(pathData, {
        seed: configuration.seedBase + index,
        roughness: 1.75,
        bowing: 1.25,
        stroke: color,
        strokeWidth: 0.16,
        fill: color,
        fillStyle: "hachure",
        hachureAngle: -43 + ((configuration.seedBase + index) % 11),
        hachureGap: 2.65,
        fillWeight: 0.7
      });
      texture.setAttribute("opacity", "0.96");
      texture.setAttribute("mask", `url(#${maskId})`);
      layer.node().appendChild(texture);
    });
  }

  function drawMiniCellMap(svg, rc, cells, boundary, field, type, points) {
    const projection = d3.geoIdentity().reflectY(true).fitExtent([[22, 32], [398, 181]], boundary);
    const path = d3.geoPath(projection);
    const projected = cells.map((d) => ({ ...d, point: projection([d.longitude, d.latitude]) }));
    const sample = projected[Math.floor(projected.length / 2)];
    const cellWidth = Math.abs(projection([sample.longitude + 0.000974, sample.latitude])[0] - sample.point[0]);
    const cellHeight = Math.abs(projection([sample.longitude, sample.latitude + 0.0009])[1] - sample.point[1]);
    const radius = Math.max(9, ((cellWidth + cellHeight) / 2) * 5);
    const radiusSq = radius * radius;
    const sigmaSq = Math.pow(radius / 2.35, 2);
    const tree = d3.quadtree(projected, (d) => d.point[0], (d) => d.point[1]);
    const scale = type === "gain"
      ? d3.scaleThreshold().domain([-25, -15, -8, -3, -0.1]).range(["#165a86", "#287da0", "#50a1b5", "#8dc4c1", "#c8d9cb", "#eee4cf"])
      : type === "delta"
        ? d3.scaleThreshold().domain([-5, 0, 5, 10, 20]).range(["#287b9e", "#78b7bd", "#eee2c8", "#eac741", "#df762e", "#b93631"])
        : d3.scaleThreshold().domain([10, 15, 20, 30, 45, 60]).range(["#237d78", "#70a765", "#c99732", "#df6d30", "#c84336", "#862e3e", "#4c2030"]);

    function averageAt(x, y) {
      let weighted = 0;
      let weights = 0;
      tree.visit((node, x0, y0, x1, y1) => {
        if (x0 > x + radius || x1 < x - radius || y0 > y + radius || y1 < y - radius) return true;
        if (!node.length) {
          let leaf = node;
          do {
            const point = leaf.data;
            const dx = point.point[0] - x;
            const dy = point.point[1] - y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq <= radiusSq) {
              const weight = Math.exp(-distanceSq / (2 * sigmaSq));
              weighted += point[field] * weight;
              weights += weight;
            }
            leaf = leaf.next;
          } while (leaf);
        }
        return false;
      });
      return weights ? weighted / weights : null;
    }

    const selection = d3.select(svg);
    const clipId = `brief-map-clip-${type}`;
    selection.append("defs").append("clipPath")
      .attr("id", clipId)
      .append("path")
      .attr("d", path(boundary));
    selection.append("path")
      .attr("d", path(boundary))
      .attr("fill", "#e9e1d2")
      .attr("fill-opacity", 0.86)
      .attr("stroke", "none");
    appendRoughContourSurface(svg, rc, {
      extent: [[20, 30], [400, 183]],
      averageAt,
      thresholds: scale.domain(),
      scale,
      clipId,
      seedBase: type === "delta" ? 1310 : type === "gain" ? 1340 : 1370
    });
    if (points) {
      const visiblePoints = points.features.filter((feature) => {
        if (type === "gain") return ["R09", "R10"].includes(feature.properties.source_id);
        return feature.properties.source_group === "centres_9";
      });
      visiblePoints.forEach((feature, index) => {
        const [x, y] = projection(feature.geometry.coordinates);
        addRough(svg, rc.circle(x, y, type === "gain" ? 10 : 6.5, {
          seed: 1200 + index + (type === "gain" ? 30 : 0),
          roughness: 1.4,
          stroke: colors.ink,
          strokeWidth: type === "gain" ? 1.7 : 1.15,
          fill: colors.paper,
          fillStyle: "solid"
        }));
        if (type === "gain") {
          const labelText = feature.properties.source_id === "R09" ? "Kaméré" : "Vincent-Kafoa";
          const leftSide = feature.properties.source_id === "R09";
          addLabel(svg, labelText, x + (leftSide ? -8 : 8), y - 9, {
            anchor: leftSide ? "end" : "start", size: 10.5, weight: 850, color: colors.ink
          }).setAttribute("paint-order", "stroke");
        }
      });
    }
    addRough(svg, rc.path(path(boundary), {
      seed: type === "delta" ? 411 : type === "gain" ? 413 : 412,
      roughness: 1.25,
      bowing: 1.1,
      stroke: colors.ink,
      strokeWidth: 1.25,
      fill: "none"
    }));
    const title = type === "delta"
      ? "écart avec les bureaux habituels"
      : type === "gain"
        ? "gain apporté par le 9e lieu"
        : "temps de marche · 9 lieux";
    addLabel(svg, title, 22, 20, {
      size: 13, weight: 800, color: colors.ink
    });
    if (type === "time") {
      drawCompactLegend(
        svg, rc, "temps aller à pied · minutes",
        ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "60+"],
        scale.range(),
        195
      );
    } else {
      const legend = type === "delta"
        ? "bleu : baisse · rouge : hausse"
        : "bleu foncé : gain le plus fort";
      addLabel(svg, legend, 397, 20, {
        anchor: "end", size: 11, weight: 700, color: colors.muted
      });
    }
  }

  function drawMiniPairMap(svg, rc, cells, boundary, points, configuration, busStops = null) {
    const selection = d3.select(svg);
    const panels = configuration.panels;
    const scale = d3.scaleThreshold()
      .domain(configuration.thresholds)
      .range(["#237d78", "#70a765", "#c99732", "#df6d30", "#c84336", "#862e3e", "#4c2030"]);
    const extents = [
      [[10, 35], [202, 182]],
      [[218, 35], [410, 182]]
    ];

    panels.forEach((panel, panelIndex) => {
      const extent = extents[panelIndex];
      const projection = d3.geoIdentity().reflectY(true).fitExtent(extent, boundary);
      const path = d3.geoPath(projection);
      const projected = cells
        .map((row) => ({ ...row, point: projection([row.longitude, row.latitude]) }))
        .filter((row) => row[panel.field] != null && Number.isFinite(Number(row[panel.field])));
      const tree = d3.quadtree(projected, (row) => row.point[0], (row) => row.point[1]);
      const radius = 12;
      const radiusSquared = radius * radius;
      const sigmaSquared = Math.pow(radius / 2.35, 2);

      function averageAt(x, y) {
        let total = 0;
        let weights = 0;
        tree.visit((node, x0, y0, x1, y1) => {
          if (x0 > x + radius || x1 < x - radius || y0 > y + radius || y1 < y - radius) return true;
          if (!node.length) {
            let leaf = node;
            do {
              const row = leaf.data;
              const dx = row.point[0] - x;
              const dy = row.point[1] - y;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared <= radiusSquared) {
                const weight = Math.exp(-distanceSquared / (2 * sigmaSquared)) * Math.max(0.2, row.pop);
                total += Number(row[panel.field]) * weight;
                weights += weight;
              }
              leaf = leaf.next;
            } while (leaf);
          }
          return false;
        });
        return weights ? total / weights : null;
      }

      const clipId = `brief-pair-${configuration.type}-${panelIndex}`;
      const defs = selection.select("defs").empty() ? selection.append("defs") : selection.select("defs");
      defs.append("clipPath").attr("id", clipId)
        .append("path").attr("d", path(boundary));
      selection.append("path").attr("d", path(boundary)).attr("fill", "#eee5d5");
      appendRoughContourSurface(svg, rc, {
        extent,
        averageAt,
        thresholds: configuration.thresholds,
        scale,
        clipId,
        seedBase: 1500 + panelIndex * 100 + configuration.type.length * 17
      });

      if (configuration.showBusStops && busStops) {
        const stopLayer = selection.append("g")
          .attr("clip-path", `url(#${clipId})`)
          .attr("pointer-events", "none");
        stopLayer.selectAll("circle")
          .data(busStops.features)
          .join("circle")
          .attr("cx", (feature) => projection(feature.geometry.coordinates)[0])
          .attr("cy", (feature) => projection(feature.geometry.coordinates)[1])
          .attr("r", 1.15)
          .attr("fill", "#2f7d9f")
          .attr("fill-opacity", 0.9)
          .attr("stroke", colors.paper)
          .attr("stroke-width", 0.38);
      }

      points.features
        .filter((feature) => feature.properties.source_group === panel.source)
        .forEach((feature, index) => {
          const [x, y] = projection(feature.geometry.coordinates);
          const grouped = panel.source !== "bureaux_complets";
          addRough(svg, rc.circle(x, y, grouped ? 7.2 : 3.1, {
            seed: 1800 + panelIndex * 100 + index,
            roughness: grouped ? 1.45 : 0.9,
            stroke: grouped ? colors.ink : "#7b352d",
            strokeWidth: grouped ? 1.1 : 0.5,
            fill: grouped ? colors.paper : colors.red,
            fillStyle: grouped ? "solid" : "hachure"
          }));
        });
      addRough(svg, rc.path(path(boundary), {
        seed: 1700 + panelIndex,
        roughness: 1.65,
        bowing: 1.25,
        stroke: colors.ink,
        strokeWidth: 1.05,
        fill: "none"
      }));
      addLabel(svg, panel.label, (extent[0][0] + extent[1][0]) / 2, 20, {
        anchor: "middle", size: 12.2, weight: 850, color: panelIndex ? colors.red : colors.green
      });
    });
    if (configuration.showBusStops) {
      selection.append("circle")
        .attr("cx", 210).attr("cy", 31).attr("r", 2.3)
        .attr("fill", "#2f7d9f").attr("stroke", colors.paper).attr("stroke-width", 0.6);
      addLabel(svg, "points bleus : arrêts Tanéo actifs", 217, 31, {
        size: 8.8, weight: 800, color: "#2f7d9f"
      });
    }
    drawCompactLegend(
      svg, rc, configuration.legend,
      configuration.legendLabels,
      scale.range(),
      195
    );
  }

  function drawMiniAreaMap(svg, rc, boundary, collection, field, type) {
    const projection = d3.geoIdentity().reflectY(true).fitExtent([[24, 29], [396, 181]], boundary);
    const path = d3.geoPath(projection);
    const clipId = `brief-area-map-clip-${type}`;
    const selection = d3.select(svg);
    selection.append("defs").append("clipPath")
      .attr("id", clipId)
      .append("path")
      .attr("d", path(boundary));
    const areaLayer = selection.append("g")
      .attr("clip-path", `url(#${clipId})`);
    const thresholds = type === "vehicles"
      ? [10, 20, 30, 40]
      : type === "municipal"
        ? [45, 50, 55, 60]
        : [20, 30, 40, 50];
    const scale = d3.scaleThreshold()
      .domain(thresholds)
      .range(["#a9d5aa", "#69b88b", "#e4c43e", "#de742d", "#b73532"]);
    const baseLayer = areaLayer.append("g");
    const textureLayer = areaLayer.append("g").attr("pointer-events", "none");
    collection.features.forEach((feature, index) => {
      const color = scale(feature.properties[field]);
      const pathData = path(feature);
      baseLayer.append("path")
        .attr("d", pathData)
        .attr("fill", color)
        .attr("fill-opacity", 0.34)
        .attr("stroke", "none");
      const node = rc.path(pathData, {
        seed: 500 + index + (type === "vehicles" ? 0 : type === "municipal" ? 100 : 200),
        roughness: 1.75,
        bowing: 1.25,
        stroke: color,
        strokeWidth: 0.16,
        fill: color,
        fillStyle: "hachure",
        hachureAngle: -43 + ((500 + index + (type === "vehicles" ? 0 : type === "municipal" ? 100 : 200)) % 11),
        hachureGap: 2.65,
        fillWeight: 0.7
      });
      node.setAttribute("opacity", "0.96");
      textureLayer.node().appendChild(node);
    });
    addRough(svg, rc.path(path(boundary), {
      seed: type === "vehicles" ? 621 : 622,
      roughness: 1.35,
      bowing: 1.1,
      stroke: colors.ink,
      strokeWidth: 1.3,
      fill: "none"
    }));
    const title = type === "vehicles"
      ? "ménages sans véhicule · IRIS"
      : type === "municipal"
        ? "abstention municipales · secteurs"
        : "abstention provinciales · secteurs";
    addLabel(svg, title, 24, 18, {
      size: 13, weight: 800, color: colors.ink
    });
    const legendLabels = type === "vehicles"
      ? ["< 10", "10–20", "20–30", "30–40", "40+"]
      : type === "municipal"
        ? ["< 45", "45–50", "50–55", "55–60", "60+"]
        : ["< 20", "20–30", "30–40", "40–50", "50+"];
    drawCompactLegend(
      svg, rc,
      type === "vehicles" ? "part des ménages sans véhicule · %" : "abstention · % des inscrits",
      legendLabels,
      scale.range(),
      195
    );
  }

  function fallbackSketches() {
    if (!window.rough || typeof window.rough.svg !== "function") return;
    dialog.querySelectorAll("[data-vote-brief-sketch]").forEach((svg) => {
      svg.replaceChildren();
      const rc = window.rough.svg(svg);
      const type = svg.dataset.voteBriefSketch;
      if (type === "mesh") drawMeshFallback(svg, rc);
      if (type === "pair9") drawTime(svg, rc, "37 lieux", "données", "9 lieux", "recalculées");
      if (type === "pair8") drawTime(svg, rc, "8 lieux", "données", "9 lieux", "recalculées");
      if (type === "carpair") drawTime(svg, rc, "37 lieux", "données", "9 lieux", "recalculées");
      if (type === "buspair") drawTime(svg, rc, "37 lieux", "données", "9 lieux", "recalculées");
      if (type === "time9") drawDistance(svg, rc);
      if (type === "gain9") drawGainFallback(svg, rc);
      if (type === "vehicle") drawVehicle(svg, rc);
      if (type === "municipal") drawAbstention(svg, rc);
      if (type === "provincial") drawProvincialAbstention(svg, rc);
      addSignature(svg);
    });
  }

  async function drawSketches() {
    if (!window.d3 || !window.rough || !root.dataset.cells || !root.dataset.boundary) {
      fallbackSketches();
      return;
    }
    try {
      const [cells, boundary, points, iris, secteurs, busStops] = await Promise.all([
        d3.csv(root.dataset.cells, d3.autoType),
        d3.json(root.dataset.boundary),
        d3.json(root.dataset.points),
        d3.json(root.dataset.iris),
        d3.json(root.dataset.secteurs),
        d3.json(root.dataset.stops)
      ]);
      dialog.querySelectorAll("[data-vote-brief-sketch]").forEach((svg) => {
        svg.replaceChildren();
        const rc = window.rough.svg(svg);
        const type = svg.dataset.voteBriefSketch;
        if (type === "mesh") drawMiniSourceMap(svg, rc, boundary, points);
        if (type === "pair9") drawMiniPairMap(svg, rc, cells, boundary, points, {
          type,
          thresholds: [10, 15, 20, 30, 45, 60],
          legend: "temps aller à pied · minutes",
          legendLabels: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "60+"],
          panels: [
            { field: "assigned_bureaux_complets", source: "bureaux_complets", label: "37 lieux · 57 bureaux" },
            { field: "assigned_centres_9", source: "centres_9", label: "9 lieux" }
          ]
        });
        if (type === "time9") drawMiniCellMap(svg, rc, cells, boundary, "assigned_centres_9", "time", points);
        if (type === "pair8") drawMiniPairMap(svg, rc, cells, boundary, points, {
          type,
          thresholds: [10, 15, 20, 30, 45, 60],
          legend: "temps aller à pied · minutes",
          legendLabels: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "60+"],
          panels: [
            { field: "assigned_centres_8", source: "centres_8", label: "8 lieux" },
            { field: "assigned_centres_9", source: "centres_9", label: "9 lieux" }
          ]
        });
        if (type === "carpair") drawMiniPairMap(svg, rc, cells, boundary, points, {
          type,
          thresholds: [10, 15, 20, 30, 45, 60],
          legend: "meilleur temps : marche ou voiture · minutes",
          legendLabels: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "60+"],
          panels: [
            { field: "car_assigned_bureaux_complets", source: "bureaux_complets", label: "37 lieux · 57 bureaux" },
            { field: "car_assigned_centres_9", source: "centres_9", label: "9 lieux" }
          ]
        });
        if (type === "buspair") drawMiniPairMap(svg, rc, cells, boundary, points, {
          type,
          showBusStops: true,
          thresholds: [10, 15, 20, 30, 45, 60],
          legend: "médiane : marche directe ou Tanéo · minutes",
          legendLabels: ["< 10", "10–15", "15–20", "20–30", "30–45", "45–60", "60+"],
          panels: [
            { field: "bus_assigned_bureaux_complets", source: "bureaux_complets", label: "37 lieux · 57 bureaux" },
            { field: "bus_assigned_centres_9", source: "centres_9", label: "9 lieux" }
          ]
        }, busStops);
        if (type === "vehicle") drawMiniAreaMap(svg, rc, boundary, iris, "percent_menages_sans_vehicules", "vehicles");
        if (type === "municipal") drawMiniAreaMap(svg, rc, boundary, secteurs, "abstention_municipales", "municipal");
        if (type === "provincial") drawMiniAreaMap(svg, rc, boundary, secteurs, "abstention_provinciales", "provincial");
        addSignature(svg);
      });
    } catch (error) {
      fallbackSketches();
    }
  }

  const requestedParams = new URLSearchParams(window.location.search);
  const requestedSlide = Number.parseInt(requestedParams.get("slide"), 10);
  if (Number.isFinite(requestedSlide)) {
    activeIndex = Math.max(0, Math.min(requestedSlide - 1, slides.length - 1));
  }
  showSlide(activeIndex);
  if (requestedParams.get("lecture") === "en-bref") openBrief(false);
})();
