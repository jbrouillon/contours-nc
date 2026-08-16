(() => {
  "use strict";
  const ink = "#282522";
  const muted = "#625d55";
  const paper = "#fffdf8";
  const grid = "#ded8cf";
  const red = "#c54832";
  const mapState = new Map();
  const mapSecondaryState = new Map();
  const mapYearState = new Map();
  const mapViewState = new Map();
  const scatterXState = new Map();
  const scatterYState = new Map();
  const scatterYearState = new Map();
  const scatterViewState = new Map();
  const explorerMatrixViewState = new Map();
  const explorerMatrixOrderState = new Map();
  const explorerMatrixYearState = new Map();
  const explorerMatrixMetricsState = new Map();
  const explorerIndicatorPanelState = new Map();
  const explorerMatrixScaleState = new Map();
  const correlationMatrixYearState = new Map();
  const correlationMatrixViewState = new Map();
  const correlationMatrixScaleState = new Map();
  const correlationMatrixMetricsState = new Map();
  const correlationIndicatorPanelState = new Map();
  const cachedBundle = {};
  const bundlePromises = new Map();
  const loadedBundleScopes = new Set();
  const activeChartIds = new Set();
  const renderRequestIds = new Map();
  let chartObserver = null;
  let lastViewportWidth = window.innerWidth;

  const correlationSpectralPalette = [
    "#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf",
    "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"
  ];

  const metricDefinitions = {
    taux_nes_hors_nc: {
      label: "Personnes nées hors de Nouvelle-Calédonie",
      control: "Nés hors de NC",
      rate: "taux_nes_hors_nc",
      numerator: "nes_hors_nc",
      denominator: "population_totale",
      numeratorLabel: "personnes nées hors de Nouvelle-Calédonie",
      denominatorLabel: "habitants",
      thresholds: [15, 25, 35, 45, 55],
      colors: ["#d53e4f", "#fc8d59", "#fee08b", "#e6f598", "#99d594", "#3288bd"]
    },
    taux_chomage: {
      label: "Chômage parmi les actifs",
      control: "Chômage",
      rate: "taux_chomage",
      numerator: "chomeurs",
      denominator: "actifs",
      numeratorLabel: "personnes au chômage",
      denominatorLabel: "personnes actives",
      thresholds: [5, 10, 15, 20, 25],
      colors: ["#f5eee4", "#ead9c5", "#e2bd84", "#d89258", "#c85d3e", "#8e2f27"]
    },
    taux_cdd: {
      label: "CDD et stages parmi les personnes en emploi",
      control: "CDD et stages",
      rate: "taux_cdd",
      numerator: "cdd",
      denominator: "emplois",
      numeratorLabel: "CDD ou stages",
      denominatorLabel: "personnes en emploi",
      thresholds: [10, 15, 20, 25, 35],
      colors: ["#f5eee4", "#ead8b8", "#deb96e", "#d18d45", "#bd5b32", "#843126"]
    },
    taux_cadres: {
      label: "Cadres et professions intermédiaires parmi les personnes en emploi",
      control: "Cadres et professions intermédiaires",
      rate: "taux_cadres",
      numerator: "cadres",
      denominator: "emplois_csp",
      numeratorLabel: "cadres ou professions intermédiaires",
      denominatorLabel: "personnes en emploi classées par CSP",
      thresholds: [15, 25, 35, 45, 55],
      colors: ["#f1ece2", "#dce3cf", "#b9d0ae", "#85b087", "#528565", "#2f5f46"]
    },
    taux_employes_ouvriers: {
      label: "Employés et ouvriers parmi les personnes en emploi",
      control: "Employés et ouvriers",
      rate: "taux_employes_ouvriers",
      numerator: "employes_ouvriers",
      denominator: "emplois_csp",
      numeratorLabel: "employés ou ouvriers",
      denominatorLabel: "personnes en emploi classées par CSP",
      thresholds: [30, 40, 50, 60, 70],
      colors: ["#f7f0e6", "#ead9c2", "#dbb887", "#c98e54", "#a96536", "#74402d"]
    },
    taux_langue: {
      label: "15 ans ou plus comprenant ou parlant une langue kanak",
      control: "Connaissance d’une langue kanak",
      rate: "taux_langue",
      numerator: "connait_langue",
      denominator: "population_15_plus",
      numeratorLabel: "personnes comprenant ou parlant une langue kanak",
      denominatorLabel: "personnes de 15 ans ou plus",
      thresholds: [5, 15, 30, 50, 70],
      colors: ["#f1f0e7", "#d9e5df", "#b4d2cb", "#7fb5ae", "#4a8e8b", "#245f68"]
    },
    taux_non_reseau: {
      label: "Population non raccordée au réseau général d’électricité",
      control: "Non-raccordement électrique",
      rate: "taux_non_reseau",
      numerator: "non_raccordes",
      denominator: "population_residences_principales",
      numeratorLabel: "personnes non raccordées au réseau général",
      denominatorLabel: "habitants des résidences principales",
      thresholds: [1, 5, 10, 25, 50],
      colors: ["#f5f0e7", "#eadcc6", "#e0bd8b", "#d58b57", "#c65338", "#843126"]
    },
    taux_sans_diplome: {
      label: "Personnes de 15 ans ou plus sans diplôme",
      control: "Sans diplôme",
      rate: "taux_sans_diplome",
      numerator: "sans_diplome",
      denominator: "population_15_plus_diplome",
      numeratorLabel: "personnes sans diplôme",
      denominatorLabel: "personnes de 15 ans ou plus",
      thresholds: [5, 10, 20, 30, 40],
      colors: ["#f6f0e8", "#ead8ca", "#dfb797", "#ce8763", "#ad5540", "#77352c"]
    },
    taux_locataires: {
      label: "Population des résidences principales vivant en location",
      control: "Locataires",
      rate: "taux_locataires",
      numerator: "locataires",
      denominator: "population_residences_principales_occupation",
      numeratorLabel: "personnes vivant en location",
      denominatorLabel: "habitants des résidences principales",
      thresholds: [20, 35, 50, 65, 80],
      colors: ["#eef2f4", "#d4e1e8", "#aacbd8", "#73a8bd", "#427c99", "#28546f"]
    },
    taux_sans_eau: {
      label: "Population sans eau courante à l’intérieur du logement",
      control: "Sans eau intérieure",
      rate: "taux_sans_eau",
      numerator: "sans_eau",
      denominator: "population_residences_principales_eau",
      numeratorLabel: "personnes sans eau courante à l’intérieur",
      denominatorLabel: "habitants des résidences principales",
      thresholds: [1, 5, 10, 20, 40],
      colors: ["#edf3f4", "#d1e4e7", "#9fcbd1", "#67a8b1", "#3e7d89", "#28545f"]
    },
    taux_sans_internet: {
      label: "Population des ménages ordinaires sans accès à internet",
      control: "Sans internet",
      rate: "taux_sans_internet",
      numerator: "sans_internet",
      denominator: "population_menages_equipement",
      numeratorLabel: "personnes sans accès à internet",
      denominatorLabel: "habitants des ménages ordinaires",
      thresholds: [10, 20, 30, 45, 60],
      colors: ["#f4f1e8", "#e4dec3", "#cbc491", "#a8a35e", "#7b7d3e", "#52582d"]
    },
    taux_sans_automobile: {
      label: "Population des ménages ordinaires sans automobile",
      control: "Sans automobile",
      rate: "taux_sans_automobile",
      numerator: "sans_automobile",
      denominator: "population_menages_vehicules",
      numeratorLabel: "personnes sans automobile dans le ménage",
      denominatorLabel: "habitants des ménages ordinaires",
      thresholds: [10, 20, 30, 40, 55],
      colors: ["#f2f0e9", "#dedbc9", "#bbb99a", "#90906b", "#646847", "#41462f"]
    }
  };

  const explorerMetricOrder = [
    "taux_nes_hors_nc",
    "taux_sans_diplome",
    "taux_chomage",
    "taux_cdd",
    "taux_employes_ouvriers",
    "taux_cadres",
    "taux_langue",
    "taux_locataires",
    "taux_non_reseau",
    "taux_sans_eau",
    "taux_sans_internet",
    "taux_sans_automobile"
  ];

  const ncMetricDefinitions = {
    taux_chomage: {
      label: "Chômage parmi les actifs",
      control: "Chômage",
      rate: "taux_chomage",
      thresholds: [8, 12, 20, 30, 40],
      colors: ["#f5eee4", "#ead9c5", "#e2bd84", "#d89258", "#c85d3e", "#8e2f27"]
    },
    taux_emploi: {
      label: "Emploi parmi les 15–64 ans",
      control: "Taux d’emploi",
      rate: "taux_emploi",
      thresholds: [45, 55, 62, 70, 75],
      colors: ["#f1ece2", "#dce3cf", "#b9d0ae", "#85b087", "#528565", "#2f5f46"]
    },
    taux_cdd: {
      label: "CDD parmi les personnes en emploi",
      control: "CDD",
      rate: "taux_cdd",
      thresholds: [15, 20, 25, 30, 40],
      colors: ["#f5eee4", "#ead8b8", "#deb96e", "#d18d45", "#bd5b32", "#843126"]
    },
    taux_cadres: {
      label: "Cadres et professions intermédiaires parmi les personnes en emploi",
      control: "Cadres et prof. intermédiaires",
      rate: "taux_cadres",
      thresholds: [10, 20, 30, 40, 50],
      colors: ["#f1ece2", "#dce3cf", "#b9d0ae", "#85b087", "#528565", "#2f5f46"]
    },
    taux_employes_ouvriers: {
      label: "Employés et ouvriers parmi les personnes en emploi",
      control: "Employés et ouvriers",
      rate: "taux_employes_ouvriers",
      thresholds: [40, 50, 60, 70, 80],
      colors: ["#f7f0e6", "#ead9c2", "#dbb887", "#c98e54", "#a96536", "#74402d"]
    },
    taux_bepc_moins: {
      label: "Diplôme le plus élevé : BEPC ou niveau inférieur",
      control: "BEPC ou moins",
      rate: "taux_bepc_moins",
      thresholds: [25, 35, 45, 55, 65],
      colors: ["#f6f0e8", "#ead8ca", "#dfb797", "#ce8763", "#ad5540", "#77352c"]
    },
    taux_bac3_plus: {
      label: "Diplôme de niveau bac +3 ou plus",
      control: "Bac +3 ou plus",
      rate: "taux_bac3_plus",
      thresholds: [2, 5, 10, 20, 35],
      colors: ["#f1ece2", "#dce3cf", "#b9d0ae", "#85b087", "#528565", "#2f5f46"]
    },
    taux_tribu: {
      label: "Personnes résidant en tribu",
      control: "Résidence en tribu",
      rate: "taux_tribu",
      thresholds: [1, 15, 50, 80, 95],
      colors: ["#f1f0e7", "#d9e5df", "#b4d2cb", "#7fb5ae", "#4a8e8b", "#245f68"]
    },
    taux_nes_hors_nc: {
      label: "Personnes nées hors de Nouvelle-Calédonie",
      control: "Nés hors de NC",
      rate: "taux_nes_hors_nc",
      thresholds: [5, 10, 20, 35, 50],
      colors: ["#f0eef5", "#ddd8e9", "#beb3d4", "#9584b6", "#6c568f", "#49356c"]
    },
    taux_familles_monoparentales: {
      label: "Familles monoparentales parmi les ménages",
      control: "Familles monoparentales",
      rate: "taux_familles_monoparentales",
      thresholds: [6, 8, 10, 12, 14],
      colors: ["#f7efe6", "#eadac8", "#dcb995", "#c98d64", "#a95e42", "#783a32"]
    },
    taux_65_plus: {
      label: "Personnes de 65 ans ou plus",
      control: "65 ans ou plus",
      rate: "taux_65_plus",
      thresholds: [7, 9, 11, 14, 18],
      colors: ["#f3efe7", "#e4dcc8", "#c9bd98", "#a99a68", "#7b7448", "#514f33"]
    },
    taux_locataires: {
      label: "Ménages locataires",
      control: "Ménages locataires",
      rate: "taux_locataires",
      thresholds: [5, 15, 30, 50, 70],
      colors: ["#eef2f4", "#d4e1e8", "#aacbd8", "#73a8bd", "#427c99", "#28546f"]
    },
    taux_sans_electricite: {
      label: "Ménages non raccordés au réseau général d’électricité",
      control: "Sans électricité du réseau",
      rate: "taux_sans_electricite",
      thresholds: [1, 3, 7, 15, 30],
      colors: ["#f5f0e7", "#eadcc6", "#e0bd8b", "#d58b57", "#c65338", "#843126"]
    },
    taux_sans_eau: {
      label: "Ménages sans point d’eau courante individuel",
      control: "Sans point d’eau individuel",
      rate: "taux_sans_eau",
      thresholds: [1, 3, 5, 10, 25],
      colors: ["#edf3f4", "#d1e4e7", "#9fcbd1", "#67a8b1", "#3e7d89", "#28545f"]
    },
    taux_sans_internet: {
      label: "Ménages sans accès à internet",
      control: "Sans internet",
      rate: "taux_sans_internet",
      thresholds: [20, 35, 50, 65, 80],
      colors: ["#f4f1e8", "#e4dec3", "#cbc491", "#a8a35e", "#7b7d3e", "#52582d"]
    },
    taux_sans_vehicule: {
      label: "Ménages sans véhicule",
      control: "Sans véhicule",
      rate: "taux_sans_vehicule",
      thresholds: [15, 25, 35, 50, 65],
      colors: ["#f2f0e9", "#dedbc9", "#bbb99a", "#90906b", "#646847", "#41462f"]
    },
    taux_navetteurs: {
      label: "Actifs travaillant dans une autre commune",
      control: "Navetteurs sortants",
      rate: "taux_navetteurs",
      thresholds: [10, 20, 30, 45, 60],
      colors: ["#edf2f4", "#d2e0e6", "#a7c5d1", "#70a3b5", "#447a91", "#2b5266"]
    },
    taux_salaries_public: {
      label: "Salariés du secteur public parmi les personnes en emploi",
      control: "Salariés du public",
      rate: "taux_salaries_public",
      thresholds: [15, 20, 25, 30, 40],
      colors: ["#f0eef5", "#ddd8e9", "#beb3d4", "#9584b6", "#6c568f", "#49356c"]
    },
    taux_marche: {
      label: "Marche comme mode principal de transport",
      control: "Déplacements à pied",
      rate: "taux_marche",
      thresholds: [8, 15, 25, 40, 60],
      colors: ["#f2f2e9", "#dfe4cc", "#bdcb9d", "#91aa6b", "#628143", "#40572f"]
    },
    taux_transport_commun: {
      label: "Transport en commun comme mode principal",
      control: "Transports en commun",
      rate: "taux_transport_commun",
      thresholds: [3, 7, 12, 20, 35],
      colors: ["#eef2f4", "#d4e1e8", "#aacbd8", "#73a8bd", "#427c99", "#28546f"]
    }
  };

  // ColorBrewer Spectral (6 classes), appliquee aux cartes des deux echelles :
  // la teinte devient un repere de niveau commun, tandis que les seuils
  // restent propres a chaque indicateur.
  const spectralPalette = Object.freeze([
    "#d53e4f",
    "#fc8d59",
    "#fee08b",
    "#e6f598",
    "#99d594",
    "#3288bd"
  ]);
  Object.values(metricDefinitions).forEach((definition) => {
    definition.colors = spectralPalette;
  });
  Object.values(ncMetricDefinitions).forEach((definition) => {
    definition.colors = spectralPalette;
  });

  const ncMetricOrder = [
    "taux_tribu",
    "taux_nes_hors_nc",
    "taux_bepc_moins",
    "taux_bac3_plus",
    "taux_chomage",
    "taux_emploi",
    "taux_cdd",
    "taux_cadres",
    "taux_employes_ouvriers",
    "taux_salaries_public",
    "taux_familles_monoparentales",
    "taux_65_plus",
    "taux_locataires",
    "taux_sans_electricite",
    "taux_sans_eau",
    "taux_sans_internet",
    "taux_sans_vehicule",
    "taux_navetteurs",
    "taux_marche",
    "taux_transport_commun"
  ];

  const fmtInt = (value) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(value));

  const fmtPct = (value) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value) + " %";

  function payload(id) {
    const node = document.getElementById(`${id}-data`);
    return node ? JSON.parse(node.textContent) : null;
  }

  function mapBundle() {
    return cachedBundle;
  }

  async function loadMapBundle(scope) {
    if (loadedBundleScopes.has(scope)) return cachedBundle;
    if (bundlePromises.has(scope)) return bundlePromises.get(scope);
    const node = document.getElementById("habitat-map-bundle-data");
    if (!node) return null;

    const promise = (async () => {
      const source = scope === "nc" ? node.dataset.ncSrc : node.dataset.grandSrc;
      const legacySource = node.dataset.src;
      if (source || legacySource) {
        const response = await fetch(source || legacySource, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error(`Chargement des données impossible (${response.status})`);
        }
        Object.assign(cachedBundle, await response.json());
        loadedBundleScopes.add(scope);
        if (legacySource) {
          loadedBundleScopes.add("grand");
          loadedBundleScopes.add("nc");
        }
      } else {
        Object.assign(cachedBundle, JSON.parse(node.textContent));
        loadedBundleScopes.add("grand");
        loadedBundleScopes.add("nc");
      }
      return cachedBundle;
    })();

    bundlePromises.set(scope, promise);
    try {
      return await promise;
    } catch (error) {
      bundlePromises.delete(scope);
      throw error;
    }
  }

  function slug(text) {
    return String(text || "carte")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function roughSeed(value) {
    let hash = 2166136261;
    for (const char of String(value || "contours")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 2147483646) + 1;
  }

  function downloadPng(id, button) {
    const el = document.getElementById(id);
    const svg = el?.querySelector("svg");
    if (!svg) return;

    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "…";

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const viewBox = svg.viewBox.baseVal;
    const width = viewBox?.width || svg.clientWidth;
    const height = viewBox?.height || svg.clientHeight;
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();

    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = paper;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${slug(id)}-contours-nc.png`;
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

  function base(id, height, minWidth, configureTools = null) {
    const el = document.getElementById(id);
    if (!el) return null;
    el.innerHTML = "";
    el.tabIndex = 0;

    const tools = document.createElement("div");
    tools.className = "habitat-sketch-tools";
    if (configureTools) configureTools(tools);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "habitat-sketch-download";
    button.textContent = "PNG";
    button.setAttribute("aria-label", "Télécharger la figure en PNG");
    button.addEventListener("click", () => downloadPng(id, button));
    tools.appendChild(button);
    el.appendChild(tools);

    const width = Math.max(minWidth, Math.round(el.clientWidth || minWidth));
    const svg = d3.select(el)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", el.dataset.sketchChart || "Carte")
      .style("background", paper);

    return {
      el,
      svg,
      rc: rough.svg(svg.node()),
      width,
      height
    };
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
      .text(text);
  }

  function wrap(selection, width) {
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
            .attr("dy", `${++lineNumber * 1.05}em`)
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
      roughness: options.roughness == null ? 0.8 : options.roughness,
      bowing: options.bowing == null ? 0.5 : options.bowing,
      stroke: options.stroke == null ? color : options.stroke,
      strokeWidth: options.strokeWidth == null ? 1.1 : options.strokeWidth,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: roughSeed(options.seed || `${x}-${y}-${width}-${height}-${color}`)
    });
    g.node().appendChild(node);
    const selection = d3.select(node);
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  function roughCircle(g, rc, cx, cy, diameter, color, options = {}) {
    const node = rc.circle(cx, cy, diameter, {
      fill: options.fill == null ? color : options.fill,
      fillStyle: options.fillStyle || "hachure",
      hachureGap: options.hachureGap == null ? 2.8 : options.hachureGap,
      hachureAngle: options.hachureAngle == null ? -38 : options.hachureAngle,
      fillWeight: options.fillWeight == null ? 0.72 : options.fillWeight,
      roughness: options.roughness == null ? 1.55 : options.roughness,
      bowing: options.bowing == null ? 1.05 : options.bowing,
      stroke: options.stroke == null ? color : options.stroke,
      strokeWidth: options.strokeWidth == null ? 0.8 : options.strokeWidth,
      disableMultiStroke: options.disableMultiStroke || false,
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
      roughness: options.roughness == null ? 0.7 : options.roughness,
      bowing: options.bowing == null ? 0.45 : options.bowing,
      stroke: options.stroke || paper,
      strokeWidth: options.strokeWidth == null ? 1.05 : options.strokeWidth,
      disableMultiStroke: options.disableMultiStroke || false,
      seed: roughSeed(options.seed || pathData.slice(0, 80))
    });
    g.node().appendChild(node);
    const selection = d3.select(node);
    if (options.opacity != null) selection.attr("opacity", options.opacity);
    return selection;
  }

  // Effet de trait au crayon inspiré de la couche « sketch » de geoviz
  // (Nicolas Lambert / RIATE, licence MIT) : deux contours sont légèrement
  // déformés par des bruits de fréquences différentes.
  function pencilFilters(svg, key, options = {}) {
    let defs = svg.select("defs");
    if (defs.empty()) defs = svg.insert("defs", ":first-child");
    const id = slug(key);
    const baseFrequency = options.baseFrequency || 0.035;
    const displacement = options.displacement || 2;
    const seed = roughSeed(key) % 997;

    function createFilter(filterId, frequency, scale, filterSeed) {
      const filter = defs.append("filter")
        .attr("id", filterId)
        .attr("x", "-12%")
        .attr("y", "-12%")
        .attr("width", "124%")
        .attr("height", "124%");
      filter.append("feTurbulence")
        .attr("type", "turbulence")
        .attr("baseFrequency", frequency)
        .attr("numOctaves", 1)
        .attr("seed", filterSeed)
        .attr("result", "pencilNoise");
      filter.append("feDisplacementMap")
        .attr("in", "SourceGraphic")
        .attr("in2", "pencilNoise")
        .attr("scale", scale)
        .attr("xChannelSelector", "R")
        .attr("yChannelSelector", "G");
      return `url(#${filterId})`;
    }

    return {
      primary: createFilter(`pencil-a-${id}`, baseFrequency, displacement, seed),
      secondary: createFilter(`pencil-b-${id}`, baseFrequency * 2, displacement + 1.6, seed + 17)
    };
  }

  function pencilStroke(g, pathData, filters, options = {}) {
    if (!pathData) return;
    const color = options.stroke || ink;
    const width = options.strokeWidth == null ? 0.7 : options.strokeWidth;
    const common = (selection) => selection
      .attr("d", pathData)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("vector-effect", "non-scaling-stroke");

    common(g.append("path"))
      .attr("stroke-width", width)
      .attr("stroke-opacity", options.opacity == null ? 0.55 : options.opacity)
      .attr("filter", filters.primary);
    common(g.append("path"))
      .attr("stroke-width", width * 0.52)
      .attr("stroke-opacity", options.secondaryOpacity == null ? 0.28 : options.secondaryOpacity)
      .attr("filter", filters.secondary);
  }

  function curveContext(curve) {
    return {
      moveTo(x, y) {
        curve.lineStart();
        curve.point(x, y);
      },
      lineTo(x, y) {
        curve.point(x, y);
      },
      closePath() {
        curve.lineEnd();
      }
    };
  }

  function geoCurvePath(curveFactory, projection, object) {
    if (!object) return null;
    const context = d3.path();
    d3.geoPath(projection, curveContext(curveFactory(context)))(object);
    return context.toString();
  }

  function chartTitle(svg, text, width) {
    return label(svg, text, 20, 30, {
      family: "Cabin Sketch, sans-serif",
      size: 24,
      weight: 700
    }).call(wrap, width - 45);
  }

  function colorFor(value, definition) {
    const index = d3.bisectRight(definition.thresholds, value);
    return definition.colors[Math.min(index, definition.colors.length - 1)];
  }

  function legendLabel(index, thresholds) {
    if (index === 0) return `< ${thresholds[0]} %`;
    if (index === thresholds.length) return `≥ ${thresholds[index - 1]} %`;
    return `${thresholds[index - 1]}–< ${thresholds[index]} %`;
  }

  function drawLegend(svg, rc, definition, x, y, availableWidth) {
    const itemWidth = Math.min(145, availableWidth / definition.colors.length);
    definition.colors.forEach((color, index) => {
      const gx = x + index * itemWidth;
      svg.append("rect")
        .attr("x", gx)
        .attr("y", y - 8)
        .attr("width", 21)
        .attr("height", 15)
        .attr("fill", color)
        .attr("fill-opacity", 0.88);
      roughRect(svg, rc, gx, y - 8, 21, 15, "none", {
        fill: "none",
        stroke: ink,
        strokeWidth: 0.58,
        roughness: 1.65,
        bowing: 1.35,
        disableMultiStroke: false,
        opacity: 0.58,
        seed: `legend-${definition.rate}-${index}`
      });
      label(svg, legendLabel(index, definition.thresholds), gx + 28, y, {
        size: 10.5,
        weight: 750,
        color: muted
      });
    });
  }

  function renderRoughMap(id, p) {
    const bundle = mapBundle();
    if (!bundle) return;

    const allowedMetrics = Array.isArray(p.options.metrics)
      ? p.options.metrics
      : explorerMetricOrder;
    const defaultLeft = allowedMetrics.includes(p.options.defaultLeft)
      ? p.options.defaultLeft
      : "taux_nes_hors_nc";
    const defaultRight = allowedMetrics.includes(p.options.defaultRight)
      ? p.options.defaultRight
      : "taux_cadres";
    const storedLeft = mapState.get(id);
    const storedRight = mapSecondaryState.get(id);
    const currentLeft = allowedMetrics.includes(storedLeft) ? storedLeft : defaultLeft;
    let currentRight = allowedMetrics.includes(storedRight) ? storedRight : defaultRight;
    if (currentRight === currentLeft) {
      currentRight = allowedMetrics.find((metric) => metric !== currentLeft) || currentRight;
    }

    const currentYear = mapYearState.get(id) || p.options.defaultYear || 2019;
    const storedView = mapViewState.get(id);
    const defaultView = p.options.defaultView === "noumea" ? "noumea" : "grand";
    const currentView = ["grand", "noumea"].includes(storedView)
      ? storedView
      : defaultView;
    const compact = window.innerWidth < 760;
    const height = compact ? 1240 : 685;

    const ctx = base(id, height, compact ? 720 : 1080, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      const metricChoices = allowedMetrics.map((metric) => ({
        value: metric,
        label: metricDefinitions[metric].label
      }));
      addSelect("Carte gauche", "Indicateur de la carte de gauche", metricChoices, currentLeft, (value) => {
        if (value === currentRight) mapSecondaryState.set(id, currentLeft);
        mapState.set(id, value);
        renderRoughMap(id, p);
      });
      addSelect("Carte droite", "Indicateur de la carte de droite", metricChoices, currentRight, (value) => {
        if (value === currentLeft) mapState.set(id, currentRight);
        mapSecondaryState.set(id, value);
        renderRoughMap(id, p);
      });
      addSelect(
        "Année",
        "Année des cartes",
        [
          { value: 2014, label: "2014" },
          { value: 2019, label: "2019" }
        ],
        currentYear,
        (value) => {
          mapYearState.set(id, +value);
          renderRoughMap(id, p);
        }
      );
      addSelect(
        "Vue",
        "Emprise cartographique",
        [
          { value: "grand", label: "Grand Nouméa" },
          { value: "noumea", label: "Nouméa agrandi" }
        ],
        currentView,
        (value) => {
          mapViewState.set(id, value);
          renderRoughMap(id, p);
        }
      );
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    chartTitle(svg, p.options.title, width);
    const activeViewLabel = currentView === "noumea" ? "Nouméa agrandi" : "Grand Nouméa";
    label(
      svg,
      `${currentYear} · ${activeViewLabel} · chaque indicateur utilise sa propre légende`,
      20,
      62,
      { size: 12.5, weight: 750, color: muted }
    );

    const features = bundle.geometry.features || [];
    const linework = bundle.linework || {};
    const rows = bundle.data.map((row) => ({ ...row, annee: +row.annee }));
    const byYearAndId = new Map(rows.map((row) => [`${row.annee}|${row.map_id}`, row]));
    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function showTooltip(event, year, row, definition) {
      const value = +row[definition.rate];
      const numerator = +row[definition.numerator];
      const denominator = +row[definition.denominator];
      const sourceNote = row.quartiers_sources !== row.quartier
        ? `<br><span class="habitat-tooltip-note">Quartiers Isee réunis : ${row.quartiers_sources}</span>`
        : "";
      tooltip.innerHTML = [
        `<strong>${row.quartier}</strong>`,
        `<span>${row.commune} · ${year}</span><br>`,
        `${definition.label} : <b>${fmtPct(value)}</b><br>`,
        `${fmtInt(numerator)} ${definition.numeratorLabel}<br>`,
        `sur ${fmtInt(denominator)} ${definition.denominatorLabel}`,
        sourceNote
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    function drawView(parent, year, subset, extent, viewName, definition) {
      const collection = { type: "FeatureCollection", features: subset };
      const projection = d3.geoIdentity().reflectY(true).fitExtent(extent, collection);
      const path = d3.geoPath(projection);
      const fillGroup = parent.append("g");
      const textureGroup = parent.append("g").attr("pointer-events", "none");
      const boundaryGroup = parent.append("g");
      const hitGroup = parent.append("g");
      const filterKey = `${id}-${year}-${viewName}-${definition.rate}`;
      const internalFilters = pencilFilters(svg, `${filterKey}-internal`, {
        baseFrequency: viewName === "grand" ? 0.048 : 0.036,
        displacement: viewName === "grand" ? 1.55 : 1.95
      });
      const outlineFilters = pencilFilters(svg, `${filterKey}-outline`, {
        baseFrequency: 0.026,
        displacement: viewName === "grand" ? 3.6 : 4.2
      });

      subset.forEach((feature) => {
        const row = byYearAndId.get(`${year}|${feature.properties.map_id}`);
        if (!row) return;
        const pathData = path(feature);
        const value = +row[definition.rate];
        const pencilColor = colorFor(value, definition);
        fillGroup.append("path")
          .attr("d", pathData)
          .attr("fill", pencilColor)
          .attr("fill-opacity", 0.34)
          .attr("stroke", "none");

        roughPath(textureGroup, rc, pathData, {
          fill: pencilColor,
          fillStyle: "hachure",
          hachureAngle: -43 + roughSeed(`${feature.properties.map_id}-${definition.rate}`) % 11,
          hachureGap: viewName === "grand" ? 3.15 : 2.65,
          fillWeight: viewName === "grand" ? 0.64 : 0.7,
          stroke: pencilColor,
          strokeWidth: 0.16,
          roughness: 1.75,
          bowing: 1.25,
          opacity: 0.96,
          seed: `map-pencil-${id}-${year}-${viewName}-${definition.rate}-${feature.properties.map_id}`
        });

        const hit = hitGroup.append("path")
          .attr("d", pathData)
          .attr("fill", "transparent")
          .attr("stroke", "transparent")
          .attr("stroke-width", 0.8)
          .attr("stroke-linejoin", "round")
          .attr("vector-effect", "non-scaling-stroke")
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${row.quartier}, ${year}, ${definition.label.toLowerCase()} : ${fmtPct(value)}`
          );
        hit
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 1.35);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              };
            }
            showTooltip(pointerEvent, year, row, definition);
          })
          .on("pointermove", (event) => showTooltip(event, year, row, definition))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", "transparent");
            tooltip.style.opacity = 0;
          });
      });

      const area = viewName === "noumea" ? linework.noumea_area : linework.grand_area;
      const sketchArea = linework.sketch_areas?.[viewName] || area;

      const quarterLines = viewName === "noumea"
        ? linework.noumea_quartiers
        : linework.quartiers;
      pencilStroke(boundaryGroup, path(quarterLines), internalFilters, {
        stroke: "#554f47",
        strokeWidth: viewName === "grand" ? 0.34 : 0.48,
        opacity: viewName === "grand" ? 0.47 : 0.54,
        secondaryOpacity: viewName === "grand" ? 0.22 : 0.27
      });
      if (viewName === "grand") {
        pencilStroke(boundaryGroup, path(linework.communes), outlineFilters, {
          stroke: "#403b36",
          strokeWidth: 0.72,
          opacity: 0.62,
          secondaryOpacity: 0.32
        });
        roughPath(boundaryGroup, rc, path(linework.communes), {
          fill: "none",
          stroke: "#403b36",
          strokeWidth: 0.56,
          roughness: 1.9,
          bowing: 1.35,
          opacity: 0.56,
          seed: `map-communes-${id}-${year}-${definition.rate}`
        });
      }
      const curvedOutline = geoCurvePath(d3.curveBasisClosed, projection, area);
      pencilStroke(boundaryGroup, curvedOutline, outlineFilters, {
        stroke: "#302d29",
        strokeWidth: viewName === "grand" ? 0.72 : 0.8,
        opacity: 0.55,
        secondaryOpacity: 0.25
      });
      roughPath(boundaryGroup, rc, path(sketchArea), {
        fill: "none",
        stroke: "#2f2a26",
        strokeWidth: viewName === "grand" ? 1.12 : 1.24,
        roughness: 2.35,
        bowing: 1.75,
        opacity: 0.9,
        seed: `map-coast-${id}-${year}-${viewName}-${definition.rate}`
      });
    }

    function drawCompactLegend(parent, definition, panelWidth) {
      const x = 18;
      const y = 110;
      const itemWidth = (panelWidth - 36) / definition.colors.length;
      definition.colors.forEach((color, index) => {
        const itemX = x + index * itemWidth;
        parent.append("rect")
          .attr("x", itemX)
          .attr("y", y - 6)
          .attr("width", 16)
          .attr("height", 13)
          .attr("fill", color)
          .attr("fill-opacity", 0.34);
        roughRect(parent, rc, itemX, y - 7, 16, 13, color, {
          fill: color,
          fillStyle: "hachure",
          hachureAngle: -38,
          hachureGap: 2.35,
          fillWeight: 0.68,
          stroke: color,
          strokeWidth: 0.42,
          roughness: 1.75,
          bowing: 1.2,
          opacity: 0.96,
          seed: `compact-legend-${id}-${definition.rate}-${index}`
        });
        label(parent, legendLabel(index, definition.thresholds), itemX + 20, y, {
          size: 10.8,
          weight: 750,
          color: muted
        });
      });
    }

    const panelGap = compact ? 26 : 28;
    const panelX = compact ? 28 : 24;
    const panelTop = 86;
    const panelWidth = compact ? width - 56 : (width - 2 * panelX - panelGap) / 2;
    const panelHeight = compact ? 540 : 565;
    const noumeaFeatures = features.filter((feature) => feature.properties.commune === "Nouméa");
    const activeFeatures = currentView === "noumea" ? noumeaFeatures : features;
    const panels = [currentLeft, currentRight].map((metric) => metricDefinitions[metric]);

    panels.forEach((definition, index) => {
      const x = compact ? panelX : panelX + index * (panelWidth + panelGap);
      const y = compact ? panelTop + index * (panelHeight + panelGap) : panelTop;
      const panel = svg.append("g").attr("transform", `translate(${x},${y})`);
      roughRect(panel, rc, 0, 0, panelWidth, panelHeight, "none", {
        fill: "none",
        stroke: grid,
        strokeWidth: 0.58,
        roughness: 1.7,
        bowing: 1.35,
        disableMultiStroke: false,
        opacity: 0.72,
        seed: `panel-${id}-${currentYear}-${definition.rate}`
      });
      label(panel, definition.label, 18, 24, {
        family: "Cabin Sketch, sans-serif",
        size: compact ? 20 : 19,
        weight: 700
      }).call(wrap, panelWidth - 36);
      label(panel, `${currentYear} · ${activeViewLabel}`, 18, 78, {
        size: 10.5,
        weight: 800,
        color: muted
      });
      drawCompactLegend(panel, definition, panelWidth);
      drawView(
        panel,
        currentYear,
        activeFeatures,
        [[14, 134], [panelWidth - 14, panelHeight - 16]],
        currentView,
        definition
      );
    });

    label(svg, "contours.nc · Isee, recensements 2014 et 2019", width - 18, height - 14, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderNcRoughMap(id, p) {
    const bundle = mapBundle();
    if (!bundle?.nc_geometry || !bundle?.nc_data) return;

    const allowedMetrics = (Array.isArray(p.options.metrics)
      ? p.options.metrics
      : ncMetricOrder).filter((metric) => ncMetricDefinitions[metric]);
    const defaultLeft = allowedMetrics.includes(p.options.defaultLeft)
      ? p.options.defaultLeft
      : "taux_tribu";
    const defaultRight = allowedMetrics.includes(p.options.defaultRight)
      ? p.options.defaultRight
      : "taux_sans_internet";
    const storedLeft = mapState.get(id);
    const storedRight = mapSecondaryState.get(id);
    const currentLeft = allowedMetrics.includes(storedLeft) ? storedLeft : defaultLeft;
    let currentRight = allowedMetrics.includes(storedRight) ? storedRight : defaultRight;
    if (currentRight === currentLeft) {
      currentRight = allowedMetrics.find((metric) => metric !== currentLeft) || currentRight;
    }

    const validViews = ["nc", "sud", "nord", "iles"];
    const storedView = mapViewState.get(id);
    const defaultView = validViews.includes(p.options.defaultView)
      ? p.options.defaultView
      : "nc";
    const currentView = validViews.includes(storedView) ? storedView : defaultView;
    const viewLabels = {
      nc: "Nouvelle-Calédonie",
      sud: "Province Sud",
      nord: "Province Nord",
      iles: "Îles Loyauté"
    };
    const compact = window.innerWidth < 760;
    const height = compact ? 1240 : 685;

    const ctx = base(id, height, compact ? 720 : 1080, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      const metricChoices = allowedMetrics.map((metric) => ({
        value: metric,
        label: ncMetricDefinitions[metric].label
      }));
      addSelect("Carte gauche", "Indicateur de la carte NC de gauche", metricChoices, currentLeft, (value) => {
        if (value === currentRight) mapSecondaryState.set(id, currentLeft);
        mapState.set(id, value);
        renderNcRoughMap(id, p);
      });
      addSelect("Carte droite", "Indicateur de la carte NC de droite", metricChoices, currentRight, (value) => {
        if (value === currentLeft) mapState.set(id, currentRight);
        mapSecondaryState.set(id, value);
        renderNcRoughMap(id, p);
      });
      addSelect(
        "Vue",
        "Emprise de la carte NC",
        validViews.map((view) => ({ value: view, label: viewLabels[view] })),
        currentView,
        (value) => {
          mapViewState.set(id, value);
          renderNcRoughMap(id, p);
        }
      );
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    chartTitle(svg, p.options.title, width);
    label(
      svg,
      `RGP 2019 · ${viewLabels[currentView]} · chaque indicateur utilise sa propre légende`,
      20,
      62,
      { size: 12.5, weight: 750, color: muted }
    );

    const features = bundle.nc_geometry.features || [];
    const linework = bundle.nc_linework || {};
    const rows = bundle.nc_data || [];
    const byId = new Map(rows.map((row) => [String(row.map_id), row]));
    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function featureInView(feature) {
      const province = feature.properties.province;
      if (currentView === "nc") return true;
      if (currentView === "sud") return province === "Province Sud";
      if (currentView === "nord") return province === "Province Nord";
      return province === "Îles Loyauté";
    }

    function showTooltip(event, row, definition) {
      const rawValue = row[definition.rate];
      const hasValue = rawValue != null && Number.isFinite(+rawValue);
      tooltip.innerHTML = [
        `<strong>${row.iris}</strong>`,
        `<span>${row.commune} · ${row.province} · 2019</span><br>`,
        `${definition.label} : <b>${hasValue ? fmtPct(+rawValue) : "non disponible"}</b><br>`,
        `${fmtInt(+row.population || 0)} habitants dans l’IRIS`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    function drawView(parent, subset, extent, definition) {
      const collection = { type: "FeatureCollection", features: subset };
      // Les polygones Isee suivent l'orientation RFC 7946. Une projection
      // spherique D3 peut alors lire certains anneaux comme l'exterieur du
      // globe. L'identite reflechie, deja employee pour le Grand Noumea,
      // evite cette ambiguite et reste fidele aux faibles ecarts de latitude.
      const projection = d3.geoIdentity().reflectY(true).fitExtent(extent, collection);
      const path = d3.geoPath(projection);
      const clipId = slug(`${id}-${currentView}-${definition.rate}-clip`);
      parent.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", extent[0][0])
        .attr("y", extent[0][1])
        .attr("width", extent[1][0] - extent[0][0])
        .attr("height", extent[1][1] - extent[0][1]);
      const clipped = parent.append("g").attr("clip-path", `url(#${clipId})`);
      const fillGroup = clipped.append("g");
      const textureGroup = clipped.append("g").attr("pointer-events", "none");
      const boundaryGroup = clipped.append("g");
      const hitGroup = clipped.append("g");
      const filterKey = `${id}-${currentView}-${definition.rate}`;
      const outlineFilters = pencilFilters(svg, `${filterKey}-outline`, {
        baseFrequency: 0.032,
        displacement: currentView === "nc" ? 1.35 : 1.75
      });

      subset.forEach((feature) => {
        const row = byId.get(String(feature.properties.map_id));
        if (!row) return;
        const pathData = path(feature);
        const rawValue = row[definition.rate];
        const hasValue = rawValue != null && Number.isFinite(+rawValue);
        const value = hasValue ? +rawValue : null;
        const pencilColor = hasValue ? colorFor(value, definition) : "#c7c2b9";
        fillGroup.append("path")
          .attr("d", pathData)
          .attr("fill", pencilColor)
          .attr("fill-opacity", hasValue ? 0.36 : 0.16)
          .attr("stroke", "none");

        roughPath(textureGroup, rc, pathData, {
          fill: pencilColor,
          fillStyle: "hachure",
          hachureAngle: -43 + roughSeed(`${feature.properties.map_id}-${definition.rate}`) % 11,
          hachureGap: currentView === "nc" ? 3.35 : 2.75,
          fillWeight: currentView === "nc" ? 0.62 : 0.7,
          stroke: "none",
          strokeWidth: 0,
          roughness: 1.75,
          bowing: 1.2,
          opacity: hasValue ? 0.97 : 0.58,
          seed: `nc-map-pencil-${id}-${currentView}-${definition.rate}-${feature.properties.map_id}`
        });

        const hit = hitGroup.append("path")
          .attr("d", pathData)
          .attr("fill", "transparent")
          .attr("stroke", "transparent")
          .attr("stroke-width", 0.8)
          .attr("stroke-linejoin", "round")
          .attr("vector-effect", "non-scaling-stroke")
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${row.iris}, ${row.commune}, 2019, ${definition.label.toLowerCase()} : ` +
            `${hasValue ? fmtPct(value) : "non disponible"}`
          );
        hit
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 1.35);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              };
            }
            showTooltip(pointerEvent, row, definition);
          })
          .on("pointermove", (event) => showTooltip(event, row, definition))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", "transparent");
            tooltip.style.opacity = 0;
          });
      });

      const sketchArea = linework.sketch_areas?.[currentView] || linework.area;

      boundaryGroup.append("path")
        .attr("d", path(linework.iris))
        .attr("fill", "none")
        .attr("stroke", "#4f4942")
        .attr("stroke-width", currentView === "nc" ? 0.035 : 0.06)
        .attr("stroke-opacity", currentView === "nc" ? 0.06 : 0.1)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("vector-effect", "non-scaling-stroke");

      pencilStroke(boundaryGroup, path(linework.communes), outlineFilters, {
        stroke: "#49423b",
        strokeWidth: currentView === "nc" ? 0.13 : 0.22,
        opacity: currentView === "nc" ? 0.18 : 0.28,
        secondaryOpacity: currentView === "nc" ? 0.04 : 0.08
      });

      roughPath(boundaryGroup, rc, path(linework.provinces), {
        fill: "none",
        stroke: "#332e29",
        strokeWidth: currentView === "nc" ? 0.35 : 0.48,
        roughness: 2.05,
        bowing: 1.55,
        disableMultiStroke: false,
        opacity: 0.36,
        seed: `nc-map-provinces-${id}-${currentView}-${definition.rate}`
      });

      pencilStroke(boundaryGroup, path(linework.area), outlineFilters, {
        stroke: "#3b3630",
        strokeWidth: currentView === "nc" ? 0.1 : 0.15,
        opacity: 0.08,
        secondaryOpacity: 0.02
      });
      roughPath(boundaryGroup, rc, path(sketchArea), {
        fill: "none",
        stroke: "#2f2a26",
        strokeWidth: currentView === "nc" ? 0.48 : 0.62,
        roughness: 2.35,
        bowing: 1.75,
        disableMultiStroke: false,
        opacity: 0.56,
        seed: `nc-map-coast-${id}-${currentView}-${definition.rate}`
      });
    }

    function drawCompactLegend(parent, definition, panelWidth) {
      const x = 18;
      const y = 110;
      const itemWidth = (panelWidth - 36) / definition.colors.length;
      definition.colors.forEach((color, index) => {
        const itemX = x + index * itemWidth;
        parent.append("rect")
          .attr("x", itemX)
          .attr("y", y - 6)
          .attr("width", 16)
          .attr("height", 13)
          .attr("fill", color)
          .attr("fill-opacity", 0.34);
        roughRect(parent, rc, itemX, y - 7, 16, 13, color, {
          fill: color,
          fillStyle: "hachure",
          hachureAngle: -38,
          hachureGap: 2.35,
          fillWeight: 0.68,
          stroke: color,
          strokeWidth: 0.42,
          roughness: 1.75,
          bowing: 1.2,
          opacity: 0.96,
          seed: `compact-legend-nc-${id}-${definition.rate}-${index}`
        });
        label(parent, legendLabel(index, definition.thresholds), itemX + 20, y, {
          size: 10.8,
          weight: 750,
          color: muted
        });
      });
    }

    const panelGap = compact ? 26 : 28;
    const panelX = compact ? 28 : 24;
    const panelTop = 86;
    const panelWidth = compact ? width - 56 : (width - 2 * panelX - panelGap) / 2;
    const panelHeight = compact ? 540 : 565;
    const activeFeatures = features.filter(featureInView);
    const panels = [currentLeft, currentRight].map((metric) => ncMetricDefinitions[metric]);

    panels.forEach((definition, index) => {
      const x = compact ? panelX : panelX + index * (panelWidth + panelGap);
      const y = compact ? panelTop + index * (panelHeight + panelGap) : panelTop;
      const panel = svg.append("g").attr("transform", `translate(${x},${y})`);
      roughRect(panel, rc, 0, 0, panelWidth, panelHeight, "none", {
        fill: "none",
        stroke: grid,
        strokeWidth: 0.58,
        roughness: 1.7,
        bowing: 1.35,
        disableMultiStroke: false,
        opacity: 0.72,
        seed: `panel-nc-${id}-${currentView}-${definition.rate}`
      });
      label(panel, definition.label, 18, 24, {
        family: "Cabin Sketch, sans-serif",
        size: compact ? 20 : 19,
        weight: 700
      }).call(wrap, panelWidth - 36);
      label(panel, `2019 · ${viewLabels[currentView]}`, 18, 78, {
        size: 10.5,
        weight: 800,
        color: muted
      });
      drawCompactLegend(panel, definition, panelWidth);
      drawView(
        panel,
        activeFeatures,
        [[14, 134], [panelWidth - 14, panelHeight - 16]],
        definition
      );
    });

    label(svg, "contours.nc · Isee, RGP 2019 · 162 IRIS", width - 18, height - 14, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderNcScatterPlot(id, p) {
    const bundle = mapBundle();
    if (!bundle?.nc_data) return;

    const allowedMetrics = (Array.isArray(p.options.metrics)
      ? p.options.metrics
      : ncMetricOrder).filter((metric) => ncMetricDefinitions[metric]);
    const defaultX = allowedMetrics.includes(p.options.defaultX)
      ? p.options.defaultX
      : "taux_nes_hors_nc";
    const defaultY = allowedMetrics.includes(p.options.defaultY)
      ? p.options.defaultY
      : "taux_cadres";
    const storedX = scatterXState.get(id);
    const storedY = scatterYState.get(id);
    const currentX = allowedMetrics.includes(storedX) ? storedX : defaultX;
    let currentY = allowedMetrics.includes(storedY) ? storedY : defaultY;
    if (currentY === currentX) {
      currentY = allowedMetrics.find((metric) => metric !== currentX) || currentY;
    }

    const validViews = ["nc", "sud", "nord", "iles"];
    const viewLabels = {
      nc: "Nouvelle-Calédonie",
      sud: "Province Sud",
      nord: "Province Nord",
      iles: "Îles Loyauté"
    };
    const storedView = scatterViewState.get(id);
    const defaultView = validViews.includes(p.options.defaultView)
      ? p.options.defaultView
      : "nc";
    const currentView = validViews.includes(storedView) ? storedView : defaultView;
    const provinceColors = {
      "Province Sud": "#c54832",
      "Province Nord": "#245f68",
      "Îles Loyauté": "#d6a21f"
    };

    function rowInView(row) {
      if (currentView === "nc") return true;
      if (currentView === "sud") return row.province === "Province Sud";
      if (currentView === "nord") return row.province === "Province Nord";
      return row.province === "Îles Loyauté";
    }

    const rows = bundle.nc_data
      .filter((row) => +row.population > 0)
      .filter(rowInView)
      .map((row) => ({
        ...row,
        population: +row.population,
        x: row[currentX] == null ? null : +row[currentX],
        y: row[currentY] == null ? null : +row[currentY]
      }))
      .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

    const compact = window.innerWidth < 760;
    const height = compact ? 690 : 650;
    const ctx = base(id, height, compact ? 760 : 940, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      const metricChoices = allowedMetrics.map((metric) => ({
        value: metric,
        label: ncMetricDefinitions[metric].label
      }));
      addSelect("Axe horizontal", "Variable de l’axe horizontal", metricChoices, currentX, (value) => {
        if (value === currentY) scatterYState.set(id, currentX);
        scatterXState.set(id, value);
        renderNcScatterPlot(id, p);
      });
      addSelect("Axe vertical", "Variable de l’axe vertical", metricChoices, currentY, (value) => {
        if (value === currentX) scatterXState.set(id, currentY);
        scatterYState.set(id, value);
        renderNcScatterPlot(id, p);
      });
      addSelect(
        "Vue",
        "Périmètre du nuage de points",
        validViews.map((view) => ({ value: view, label: viewLabels[view] })),
        currentView,
        (value) => {
          scatterViewState.set(id, value);
          renderNcScatterPlot(id, p);
        }
      );
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-scatter", "habitat-scatter-nc");
    chartTitle(svg, p.options.title, width);

    if (rows.length < 2) {
      label(svg, "Pas assez d’IRIS renseignés pour calculer la corrélation.", 20, 80, {
        size: 13,
        weight: 750,
        color: muted
      });
      return;
    }

    const meanX = d3.mean(rows, (row) => row.x);
    const meanY = d3.mean(rows, (row) => row.y);
    const covariance = d3.sum(rows, (row) => (row.x - meanX) * (row.y - meanY));
    const varianceX = d3.sum(rows, (row) => (row.x - meanX) ** 2);
    const varianceY = d3.sum(rows, (row) => (row.y - meanY) ** 2);
    const correlation = varianceX > 0 && varianceY > 0
      ? covariance / Math.sqrt(varianceX * varianceY)
      : NaN;
    const correlationLabel = Number.isFinite(correlation)
      ? new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(correlation)
      : "non calculable";

    label(
      svg,
      `r de Pearson = ${correlationLabel} · ${rows.length} IRIS · ${viewLabels[currentView]} · 2019`,
      20,
      66,
      { size: 12.5, weight: 800, color: muted }
    );

    ["Province Sud", "Province Nord", "Îles Loyauté"].forEach((province, index) => {
      const x = 20 + index * 145;
      svg.append("circle")
        .attr("cx", x + 6)
        .attr("cy", 94)
        .attr("r", 5.5)
        .attr("fill", provinceColors[province])
        .attr("fill-opacity", 0.24);
      roughCircle(svg, rc, x + 6, 94, 11, provinceColors[province], {
        hachureGap: 2.5,
        fillWeight: 0.7,
        roughness: 1.65,
        opacity: 0.9,
        seed: `scatter-nc-legend-${province}`
      });
      label(svg, province, x + 18, 94, { size: 11.5, weight: 800, color: muted });
    });
    label(svg, "taille du point = population", width - 20, 94, {
      anchor: "end",
      size: 11.5,
      weight: 800,
      color: muted
    });

    function paddedDomain(values) {
      let [minimum, maximum] = d3.extent(values);
      if (minimum === maximum) {
        minimum -= 1;
        maximum += 1;
      }
      const padding = Math.max(1, (maximum - minimum) * 0.08);
      return [Math.max(0, minimum - padding), Math.min(100, maximum + padding)];
    }

    const margin = { top: 122, right: 36, bottom: 78, left: 88 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const xScale = d3.scaleLinear()
      .domain(paddedDomain(rows.map((row) => row.x)))
      .nice()
      .range([margin.left, margin.left + innerWidth]);
    const yScale = d3.scaleLinear()
      .domain(paddedDomain(rows.map((row) => row.y)))
      .nice()
      .range([margin.top + innerHeight, margin.top])
      .clamp(true);
    const radius = d3.scaleSqrt()
      .domain(d3.extent(rows, (row) => row.population))
      .range([3.2, compact ? 10.5 : 9]);

    const gridGroup = svg.append("g");
    gridGroup.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(() => ""));
    gridGroup.append("g")
      .attr("transform", `translate(0,${margin.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(7).tickSize(-innerHeight).tickFormat(() => ""));
    gridGroup.selectAll(".domain").remove();
    gridGroup.selectAll("line")
      .attr("stroke", grid)
      .attr("stroke-opacity", 0.72)
      .attr("stroke-dasharray", "3,5");

    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${margin.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat((value) => `${value} %`));
    const yAxis = svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((value) => `${value} %`));
    [xAxis, yAxis].forEach((axis) => {
      axis.selectAll("text")
        .attr("font-family", "Atkinson Hyperlegible, sans-serif")
        .attr("font-size", 11.5)
        .attr("font-weight", 700)
        .attr("fill", muted);
      axis.selectAll("path, line").attr("stroke", "#6f685e").attr("stroke-opacity", 0.7);
    });

    roughRect(svg, rc, margin.left, margin.top, innerWidth, innerHeight, "none", {
      fill: "none",
      stroke: "#6f685e",
      strokeWidth: 0.68,
      roughness: 1.85,
      bowing: 1.2,
      opacity: 0.46,
      seed: `scatter-nc-frame-${id}-${currentView}-${currentX}-${currentY}`
    });

    label(svg, ncMetricDefinitions[currentX].label, margin.left + innerWidth / 2, height - 27, {
      anchor: "middle",
      size: 12,
      weight: 850,
      color: ink
    });
    label(svg, ncMetricDefinitions[currentY].label, 21, margin.top + innerHeight / 2, {
      anchor: "middle",
      size: 12,
      weight: 850,
      color: ink
    }).attr("transform", `rotate(-90,21,${margin.top + innerHeight / 2})`);

    if (varianceX > 0) {
      const slope = covariance / varianceX;
      const intercept = meanY - slope * meanX;
      const x1 = xScale.domain()[0];
      const x2 = xScale.domain()[1];
      roughPath(
        svg,
        rc,
        `M${xScale(x1)},${yScale(intercept + slope * x1)}L${xScale(x2)},${yScale(intercept + slope * x2)}`,
        {
          fill: "none",
          stroke: red,
          strokeWidth: 2.05,
          roughness: 1.8,
          bowing: 1.15,
          opacity: 0.86,
          seed: `scatter-nc-${id}-${currentView}-${currentX}-${currentY}`
        }
      );
    }

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function showTooltip(event, row) {
      tooltip.innerHTML = [
        `<strong>${row.iris}</strong>`,
        `<span>${row.commune} · ${row.province} · 2019</span><br>`,
        `${ncMetricDefinitions[currentX].label} : <b>${fmtPct(row.x)}</b><br>`,
        `${ncMetricDefinitions[currentY].label} : <b>${fmtPct(row.y)}</b><br>`,
        `${fmtInt(row.population)} habitants`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    rows.forEach((row) => {
      const pointRadius = radius(row.population);
      roughCircle(
        svg,
        rc,
        xScale(row.x),
        yScale(row.y),
        pointRadius * 2,
        provinceColors[row.province] || muted,
        {
          hachureGap: Math.max(2.2, pointRadius * 0.48),
          fillWeight: 0.72,
          roughness: 1.7,
          bowing: 1.1,
          strokeWidth: 0.72,
          opacity: 0.9,
          seed: `scatter-nc-point-${id}-${row.map_id}-${currentX}-${currentY}`
        }
      );
      const point = svg.append("circle")
        .attr("cx", xScale(row.x))
        .attr("cy", yScale(row.y))
        .attr("r", pointRadius)
        .attr("fill", "transparent")
        .attr("stroke", paper)
        .attr("stroke-width", 0.9)
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr(
          "aria-label",
          `${row.iris}, ${row.commune}, 2019, ` +
          `${ncMetricDefinitions[currentX].label.toLowerCase()} ${fmtPct(row.x)}, ` +
          `${ncMetricDefinitions[currentY].label.toLowerCase()} ${fmtPct(row.y)}`
        );
      point
        .on("pointerenter focus", function(event) {
          d3.select(this).attr("stroke", red).attr("stroke-width", 2.3);
          let pointerEvent = event;
          if (event.type === "focus") {
            const rect = this.getBoundingClientRect();
            pointerEvent = {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2
            };
          }
          showTooltip(pointerEvent, row);
        })
        .on("pointermove", (event) => showTooltip(event, row))
        .on("pointerleave blur", function() {
          d3.select(this).attr("stroke", paper).attr("stroke-width", 0.9);
          tooltip.style.opacity = 0;
        });
    });

    label(svg, "contours.nc · Isee, RGP 2019 · corrélation non pondérée", width - 18, height - 14, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderSocialHousing(id, p) {
    const rows = (p.data || []).map((row) => ({
      ...row,
      annee: +row.annee,
      logements: +row.logements,
      total: +row.total,
      part: +row.part
    }));
    if (!rows.length) return;

    const order = ["Nouméa", "Dumbéa", "Mont-Dore", "Païta", "Autres communes"];
    const colorByPlace = new Map(rows.map((row) => [row.territoire, row.couleur]));
    const compact = window.innerWidth < 760;
    const height = compact ? 545 : 510;
    const ctx = base(id, height, compact ? 760 : 940);
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-social-chart");
    chartTitle(svg, p.options.title, width);
    label(svg, "Répartition du parc des principaux opérateurs sociaux", 20, 63, {
      size: 12.5,
      weight: 750,
      color: muted
    });

    const legendGap = (width - 42) / order.length;
    order.forEach((place, index) => {
      const x = 21 + index * legendGap;
      const color = colorByPlace.get(place) || muted;
      svg.append("rect")
        .attr("x", x)
        .attr("y", 84)
        .attr("width", 20)
        .attr("height", 15)
        .attr("fill", color)
        .attr("fill-opacity", 0.3);
      roughRect(svg, rc, x, 84, 20, 15, color, {
        fillStyle: "hachure",
        hachureAngle: -38,
        hachureGap: 3.5,
        fillWeight: 0.72,
        stroke: color,
        strokeWidth: 0.45,
        roughness: 1.1,
        bowing: 0.75,
        disableMultiStroke: true,
        opacity: 0.88,
        seed: `social-legend-${place}`
      });
      label(svg, place, x + 27, 92, { size: 11, weight: 780, color: ink });
    });

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    const margin = { left: 112, right: 35 };
    const x = d3.scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]);
    const barWidth = x(100) - x(0);
    const barHeight = 62;
    const years = [2011, 2017];
    const yByYear = new Map([[2011, 174], [2017, 294]]);

    [0, 25, 50, 75, 100].forEach((tick) => {
      svg.append("line")
        .attr("x1", x(tick))
        .attr("x2", x(tick))
        .attr("y1", 140)
        .attr("y2", 378)
        .attr("stroke", grid)
        .attr("stroke-width", tick === 0 || tick === 100 ? 0.85 : 0.65)
        .attr("stroke-dasharray", tick === 0 || tick === 100 ? null : "3 5");
      label(svg, `${tick} %`, x(tick), 391, {
        anchor: tick === 0 ? "start" : tick === 100 ? "end" : "middle",
        size: 10.5,
        weight: 750,
        color: muted
      });
    });

    function positionTooltip(event, row) {
      tooltip.innerHTML = [
        `<strong>${row.territoire}</strong>`,
        `<span>${row.annee}</span><br>`,
        `${fmtInt(row.logements)} logements<br>`,
        `<b>${fmtPct(row.part)}</b> du parc représenté`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    years.forEach((year) => {
      const y = yByYear.get(year);
      const yearRows = rows
        .filter((row) => row.annee === year)
        .sort((a, b) => order.indexOf(a.territoire) - order.indexOf(b.territoire));
      const total = d3.sum(yearRows, (row) => row.logements);
      let cumulative = 0;

      label(svg, String(year), 24, y + barHeight / 2, {
        family: "Cabin Sketch, sans-serif",
        size: 29,
        weight: 700
      });
      label(svg, `${fmtInt(total)} logements`, width - margin.right, y - 17, {
        anchor: "end",
        size: 12,
        weight: 850,
        color: muted
      });

      yearRows.forEach((row) => {
        const start = cumulative;
        cumulative += row.part;
        const segmentX = x(start);
        const segmentWidth = Math.max(0, x(cumulative) - x(start));
        const color = row.couleur || colorByPlace.get(row.territoire) || muted;

        svg.append("rect")
          .attr("x", segmentX)
          .attr("y", y)
          .attr("width", segmentWidth)
          .attr("height", barHeight)
          .attr("fill", color)
          .attr("fill-opacity", 0.3);
        roughRect(svg, rc, segmentX, y, segmentWidth, barHeight, color, {
          fillStyle: "hachure",
          hachureAngle: -38,
          hachureGap: 4.2,
          fillWeight: 0.75,
          stroke: paper,
          strokeWidth: 0.55,
          roughness: 1.12,
          bowing: 0.78,
          disableMultiStroke: true,
          opacity: 0.88,
          seed: `social-${year}-${row.territoire}`
        });

        if (row.part >= 7) {
          label(svg, fmtPct(row.part), segmentX + segmentWidth / 2, y + barHeight / 2, {
            anchor: "middle",
            size: 12,
            weight: 900,
            color: ink
          });
        }

        const hit = svg.append("rect")
          .attr("x", segmentX)
          .attr("y", y)
          .attr("width", segmentWidth)
          .attr("height", barHeight)
          .attr("fill", "transparent")
          .attr("stroke", "transparent")
          .attr("stroke-width", 1.5)
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${row.territoire}, ${year} : ${fmtInt(row.logements)} logements, ${fmtPct(row.part)} du parc représenté`
          );

        hit
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
            }
            positionTooltip(pointerEvent, row);
          })
          .on("pointermove", (event) => positionTooltip(event, row))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", "transparent");
            tooltip.style.opacity = 0;
          });
      });

      roughRect(svg, rc, x(0), y, barWidth, barHeight, "none", {
        fill: "none",
        stroke: ink,
        strokeWidth: 0.7,
        roughness: 1.18,
        bowing: 0.82,
        disableMultiStroke: true,
        seed: `social-bar-frame-${year}`
      });
    });

    const cardY = 420;
    const cardGap = 22;
    const cardWidth = (width - 42 - cardGap) / 2;
    [
      { value: "+23,7 %", note: "de logements entre 2011 et 2017", color: "#d6a21f" },
      { value: "46,8 %", note: "de la hausse se situe à Dumbéa", color: red }
    ].forEach((card, index) => {
      const cardX = 21 + index * (cardWidth + cardGap);
      roughRect(svg, rc, cardX, cardY, cardWidth, 58, paper, {
        fill: paper,
        stroke: card.color,
        strokeWidth: 1.05,
        roughness: 1.2,
        bowing: 0.9,
        seed: `social-callout-${index}`
      });
      label(svg, card.value, cardX + 16, cardY + 22, {
        family: "Cabin Sketch, sans-serif",
        size: 21,
        weight: 700,
        color: card.color
      });
      label(svg, card.note, cardX + 122, cardY + 30, {
        size: 11.5,
        weight: 780,
        color: ink
      }).call(wrap, cardWidth - 138);
    });

    label(svg, "contours.nc · Isee, SIC, FSH et SEM Agglo", width - 18, height - 13, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderSegregationHeatmap(id, p) {
    const numericFields = [
      "taux_chomage",
      "taux_cdd",
      "taux_cadres",
      "taux_langue",
      "taux_non_reseau",
      "rang_chomage",
      "rang_cdd",
      "rang_cadres",
      "rang_langue",
      "rang_non_reseau",
      "indice_socioeco"
    ];
    const rows = (p.data || []).map((row) => {
      const parsed = { ...row, annee: +row.annee };
      numericFields.forEach((field) => {
        parsed[field] = row[field] == null ? null : +row[field];
      });
      return parsed;
    });
    if (!rows.length) return;

    const columns = [
      {
        key: "taux_chomage",
        rank: "rang_chomage",
        label: "Chômage",
        detail: "parmi les actifs",
        aria: "chômage parmi les actifs",
        colors: ["#f8f0e7", "#efd9c7", "#e5b790", "#d8845c", "#a94432"]
      },
      {
        key: "taux_cdd",
        rank: "rang_cdd",
        label: "CDD et stages",
        detail: "parmi les personnes en emploi",
        aria: "CDD et stages parmi les personnes en emploi",
        colors: ["#f8f1df", "#eedcae", "#dfbd6e", "#c99336", "#8f5b1e"]
      },
      {
        key: "taux_cadres",
        rank: "rang_cadres",
        label: "Cadres et prof. interm.",
        detail: "parmi les personnes en emploi",
        aria: "cadres et professions intermédiaires parmi les personnes en emploi",
        colors: ["#f0f2e9", "#d6e2cc", "#a9c99d", "#71a77a", "#326747"]
      },
      {
        key: "taux_langue",
        rank: "rang_langue",
        label: "Langue kanak",
        detail: "indicateur spatial indirect",
        aria: "connaissance d’une langue kanak, indicateur spatial indirect",
        colors: ["#edf3f1", "#d1e4df", "#9dc9c1", "#5fa59f", "#245f68"]
      },
      {
        key: "taux_non_reseau",
        rank: "rang_non_reseau",
        label: "Non-raccordement",
        detail: "au réseau général d’électricité",
        aria: "non-raccordement au réseau général d’électricité",
        colors: ["#f7f0e8", "#eadac7", "#dcb88d", "#c98656", "#873f2d"]
      }
    ];

    const currentView = heatmapViewState.get(id) || "noumea";
    const currentOrder = heatmapOrderState.get(id) || "socioeco";
    const visibleRows = rows
      .filter((row) => currentView === "grand" || row.commune === "Nouméa")
      .sort((a, b) => {
        if (currentOrder === "langue") {
          return (b.taux_langue - a.taux_langue) || a.quartier.localeCompare(b.quartier, "fr");
        }
        if (currentOrder === "alpha") {
          return a.commune.localeCompare(b.commune, "fr") || a.quartier.localeCompare(b.quartier, "fr");
        }
        return (b.indice_socioeco - a.indice_socioeco) || a.quartier.localeCompare(b.quartier, "fr");
      });

    const compact = window.innerWidth < 760;
    const rowHeight = compact ? 30 : 28;
    const matrixTop = 202;
    const height = matrixTop + visibleRows.length * rowHeight + 55;
    const ctx = base(id, height, compact ? 1120 : 1080, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = choice.value === selected;
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      addSelect(
        "Vue",
        "Périmètre de la heatmap",
        [
          { value: "noumea", label: "Nouméa" },
          { value: "grand", label: "Grand Nouméa" }
        ],
        currentView,
        (value) => {
          heatmapViewState.set(id, value);
          renderSegregationHeatmap(id, p);
        }
      );
      addSelect(
        "Tri",
        "Ordre des quartiers",
        [
          { value: "socioeco", label: "Profil socio-économique" },
          { value: "langue", label: "Connaissance d’une langue kanak" },
          { value: "alpha", label: "Ordre alphabétique" }
        ],
        currentOrder,
        (value) => {
          heatmapOrderState.set(id, value);
          renderSegregationHeatmap(id, p);
        }
      );
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-heatmap");
    chartTitle(svg, p.options.title, width);
    label(
      svg,
      `${visibleRows.length} zones · recensement 2019`,
      20,
      66,
      { size: 12.5, weight: 750, color: muted }
    );

    const labelWidth = 294;
    const matrixRight = width - 20;
    const cellWidth = (matrixRight - labelWidth) / columns.length;

    label(svg, "Dans chaque colonne", 20, 99, { size: 10.5, weight: 850, color: muted });
    const legendColors = ["#f5f0e7", "#e4c9a7", "#c8885d", "#843f31"];
    legendColors.forEach((color, index) => {
      svg.append("rect")
        .attr("x", 132 + index * 25)
        .attr("y", 91)
        .attr("width", 23)
        .attr("height", 16)
        .attr("fill", color);
    });
    label(svg, "part faible", 238, 99, { size: 10.5, weight: 750, color: muted });
    label(svg, "→", 298, 99, { size: 12, weight: 850, color: muted });
    label(svg, "part élevée", 319, 99, { size: 10.5, weight: 750, color: muted });
    label(svg, "La couleur indique un rang relatif ; la case affiche le taux.", width - 20, 99, {
      anchor: "end",
      size: 10.5,
      weight: 750,
      color: muted
    });

    const groups = [
      { start: 0, span: 3, text: "POSITION SOCIO-ÉCONOMIQUE", color: "#c54832" },
      { start: 3, span: 1, text: "PROXY COMMUNAUTAIRE", color: "#245f68" },
      { start: 4, span: 1, text: "CONDITION MATÉRIELLE", color: "#8f5b1e" }
    ];
    groups.forEach((group) => {
      const x = labelWidth + group.start * cellWidth;
      const groupWidth = group.span * cellWidth;
      svg.append("line")
        .attr("x1", x + 5)
        .attr("x2", x + groupWidth - 5)
        .attr("y1", 124)
        .attr("y2", 124)
        .attr("stroke", group.color)
        .attr("stroke-width", 3);
      label(svg, group.text, x + groupWidth / 2, 115, {
        anchor: "middle",
        size: 9.5,
        weight: 900,
        color: group.color
      });
    });

    label(svg, "Quartier", 18, 166, { size: 11.5, weight: 900, color: ink });
    columns.forEach((column, index) => {
      const center = labelWidth + index * cellWidth + cellWidth / 2;
      label(svg, column.label, center, 153, {
        anchor: "middle",
        size: 11.5,
        weight: 900,
        color: ink
      }).call(wrap, cellWidth - 14);
      label(svg, column.detail, center, 181, {
        anchor: "middle",
        size: 9.5,
        weight: 720,
        color: muted
      }).call(wrap, cellWidth - 12);
    });

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function heatColor(rank, palette) {
      if (rank == null || Number.isNaN(rank)) return "#ece8e0";
      const index = Math.min(palette.length - 1, Math.floor(rank / (100 / palette.length)));
      return palette[Math.max(0, index)];
    }

    function showTooltip(event, row, column) {
      const value = row[column.key];
      const sourceNote = row.quartiers_sources !== row.quartier
        ? `<br><span class="habitat-tooltip-note">Quartiers Isee réunis : ${row.quartiers_sources}</span>`
        : "";
      tooltip.innerHTML = [
        `<strong>${row.quartier}</strong>`,
        `<span>${row.commune} · 2019</span><br>`,
        `${column.aria} : <b>${value == null ? "non disponible" : fmtPct(value)}</b>`,
        sourceNote
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    visibleRows.forEach((row, rowIndex) => {
      const y = matrixTop + rowIndex * rowHeight;
      if (rowIndex % 2 === 0) {
        svg.append("rect")
          .attr("x", 10)
          .attr("y", y)
          .attr("width", width - 30)
          .attr("height", rowHeight)
          .attr("fill", "#f8f5ef");
      }

      const fullRowLabel = currentView === "grand" ? `${row.quartier} · ${row.commune}` : row.quartier;
      const maxLabelLength = currentView === "grand" ? 40 : 44;
      const rowLabel = fullRowLabel.length > maxLabelLength
        ? `${fullRowLabel.slice(0, maxLabelLength - 1)}…`
        : fullRowLabel;
      label(svg, rowLabel, 18, y + rowHeight / 2, {
        size: 10.5,
        weight: 760,
        color: ink
      });

      columns.forEach((column, columnIndex) => {
        const x = labelWidth + columnIndex * cellWidth;
        const value = row[column.key];
        const rank = row[column.rank];
        const fill = heatColor(rank, column.colors);
        const cell = svg.append("rect")
          .attr("x", x + 1.5)
          .attr("y", y + 1.5)
          .attr("width", cellWidth - 3)
          .attr("height", rowHeight - 3)
          .attr("fill", fill)
          .attr("stroke", paper)
          .attr("stroke-width", 1)
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${row.quartier}, ${row.commune}, 2019, ${column.aria} : ${value == null ? "non disponible" : fmtPct(value)}`
          );

        label(svg, value == null ? "—" : fmtPct(value), x + cellWidth / 2, y + rowHeight / 2, {
          anchor: "middle",
          size: 10.5,
          weight: 900,
          color: rank >= 70 ? paper : ink
        }).attr("pointer-events", "none");

        cell
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 2);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
            }
            showTooltip(pointerEvent, row, column);
          })
          .on("pointermove", (event) => showTooltip(event, row, column))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", paper).attr("stroke-width", 1);
            tooltip.style.opacity = 0;
          });
      });
    });

    roughRect(
      svg,
      rc,
      labelWidth,
      matrixTop,
      matrixRight - labelWidth,
      visibleRows.length * rowHeight,
      "none",
      {
        fill: "none",
        stroke: ink,
        strokeWidth: 0.65,
        roughness: 1.1,
        bowing: 0.7,
        disableMultiStroke: true,
        seed: `heatmap-frame-${currentView}`
      }
    );

    [3, 4].forEach((boundary) => {
      const x = labelWidth + boundary * cellWidth;
      svg.append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 124)
        .attr("y2", matrixTop + visibleRows.length * rowHeight)
        .attr("stroke", boundary === 3 ? "#245f68" : "#8f5b1e")
        .attr("stroke-width", 2.2);
    });

    label(svg, "contours.nc · Isee, recensement 2019", width - 18, height - 17, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderExplorerMatrixLegacy(id, p) {
    const bundle = mapBundle();
    if (!bundle) return;

    const currentYear = explorerMatrixYearState.get(id) || 2019;
    const currentView = explorerMatrixViewState.get(id) || "noumea";
    const currentOrder = explorerMatrixOrderState.get(id) || "socioeco";
    const defaultMetrics = [
      "taux_nes_hors_nc",
      "taux_cadres",
      "taux_sans_diplome",
      "taux_chomage",
      "taux_langue",
      "taux_sans_internet"
    ];
    const selectedMetrics = explorerMatrixMetricsState.get(id) || defaultMetrics;
    const allRows = bundle.data
      .filter((row) => +row.annee === +currentYear)
      .map((row) => {
        const parsed = { ...row, annee: +row.annee };
        explorerMetricOrder.forEach((metric) => {
          parsed[metric] = row[metric] == null ? null : +row[metric];
        });
        return parsed;
      });

    const ranks = new Map();
    explorerMetricOrder.forEach((metric) => {
      const sorted = allRows
        .map((row) => row[metric])
        .filter((value) => value != null && !Number.isNaN(value))
        .sort((a, b) => a - b);
      const denominator = Math.max(1, sorted.length - 1);
      ranks.set(metric, new Map(allRows.map((row) => {
        const value = row[metric];
        if (value == null || Number.isNaN(value)) return [row.map_id, null];
        return [row.map_id, 100 * sorted.findIndex((candidate) => candidate >= value) / denominator];
      })));
    });

    const disadvantageMetrics = [
      "taux_sans_diplome",
      "taux_chomage",
      "taux_cdd",
      "taux_employes_ouvriers",
      "taux_non_reseau",
      "taux_sans_eau",
      "taux_sans_internet",
      "taux_sans_automobile"
    ];
    allRows.forEach((row) => {
      const values = disadvantageMetrics
        .map((metric) => ranks.get(metric).get(row.map_id))
        .filter((value) => value != null);
      const cadresRank = ranks.get("taux_cadres").get(row.map_id);
      if (cadresRank != null) values.push(100 - cadresRank);
      row.indice_socioeco = d3.mean(values);
    });

    const viewCommunes = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta"
    };
    const visibleRows = allRows
      .filter((row) => currentView === "grand" || row.commune === viewCommunes[currentView])
      .sort((a, b) => {
        if (currentOrder === "langue") {
          return (b.taux_langue - a.taux_langue) || a.quartier.localeCompare(b.quartier, "fr");
        }
        if (currentOrder === "alpha") {
          return a.commune.localeCompare(b.commune, "fr") || a.quartier.localeCompare(b.quartier, "fr");
        }
        return (b.indice_socioeco - a.indice_socioeco) || a.quartier.localeCompare(b.quartier, "fr");
      });

    const compact = window.innerWidth < 760;
    const rowHeight = compact ? 25 : 23;
    const matrixTop = 153;
    const height = matrixTop + visibleRows.length * rowHeight + 48;
    const minWidth = Math.max(980, 294 + selectedMetrics.length * 132 + 20);
    const ctx = base(id, height, minWidth, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      addSelect(
        "Année",
        "Année de la matrice",
        [
          { value: 2014, label: "2014" },
          { value: 2019, label: "2019" }
        ],
        currentYear,
        (value) => {
          explorerMatrixYearState.set(id, +value);
          render(id);
        }
      );
      addSelect(
        "Vue",
        "Périmètre de la matrice",
        [
          { value: "noumea", label: "Nouméa" },
          { value: "dumbea", label: "Dumbéa" },
          { value: "montdore", label: "Mont-Dore" },
          { value: "paita", label: "Païta" },
          { value: "grand", label: "Grand Nouméa" }
        ],
        currentView,
        (value) => {
          explorerMatrixViewState.set(id, value);
          render(id);
        }
      );
      addSelect(
        "Tri",
        "Ordre des quartiers",
        [
          { value: "socioeco", label: "Profil socio-économique" },
          { value: "langue", label: "Connaissance d’une langue kanak" },
          { value: "alpha", label: "Ordre alphabétique" }
        ],
        currentOrder,
        (value) => {
          explorerMatrixOrderState.set(id, value);
          render(id);
        }
      );

      const details = document.createElement("details");
      details.className = "habitat-indicator-picker";
      details.open = explorerIndicatorPanelState.get(id) || false;
      details.addEventListener("toggle", () => {
        explorerIndicatorPanelState.set(id, details.open);
      });
      const summary = document.createElement("summary");
      summary.textContent = `Indicateurs (${selectedMetrics.length})`;
      details.appendChild(summary);
      const choices = document.createElement("div");
      choices.className = "habitat-indicator-picker-grid";
      explorerMetricOrder.forEach((metric) => {
        const choice = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = metric;
        checkbox.checked = selectedMetrics.includes(metric);
        checkbox.addEventListener("change", () => {
          const next = new Set(selectedMetrics);
          if (checkbox.checked) next.add(metric);
          else next.delete(metric);
          if (!next.size) {
            checkbox.checked = true;
            return;
          }
          explorerMatrixMetricsState.set(
            id,
            explorerMetricOrder.filter((candidate) => next.has(candidate))
          );
          explorerIndicatorPanelState.set(id, true);
          render(id);
        });
        choice.appendChild(checkbox);
        choice.appendChild(document.createTextNode(metricDefinitions[metric].control));
        choices.appendChild(choice);
      });
      details.appendChild(choices);
      tools.appendChild(details);
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-heatmap", "habitat-explorer");
    chartTitle(svg, p.options.title, width);
    label(svg, `${visibleRows.length} quartiers · ${currentYear}`, 20, 66, {
      size: 12.5,
      weight: 750,
      color: muted
    });
    label(
      svg,
      "Dans chaque colonne : du rouge (part faible) au bleu (part élevée) ; la case affiche le taux.",
      20,
      94,
      { size: 10.5, weight: 750, color: muted }
    );

    const labelWidth = 294;
    const matrixRight = width - 20;
    const cellWidth = (matrixRight - labelWidth) / selectedMetrics.length;
    label(svg, "Quartier", 18, 126, { size: 11.5, weight: 900, color: ink });
    selectedMetrics.forEach((metric, index) => {
      const definition = metricDefinitions[metric];
      const center = labelWidth + index * cellWidth + cellWidth / 2;
      label(svg, definition.control, center, 126, {
        anchor: "middle",
        size: 10.5,
        weight: 900,
        color: metric === "taux_langue" ? "#245f68" : ink
      }).call(wrap, cellWidth - 12);
      if (metric === "taux_langue") {
        label(svg, "indicateur indirect", center, 145, {
          anchor: "middle",
          size: 8.7,
          weight: 800,
          color: "#245f68"
        });
      }
    });

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function heatColor(rank, palette) {
      if (rank == null || Number.isNaN(rank)) return "#ece8e0";
      const index = Math.min(palette.length - 1, Math.floor(rank / (100 / palette.length)));
      return palette[Math.max(0, index)];
    }

    function showTooltip(event, row, metric) {
      const definition = metricDefinitions[metric];
      const value = row[metric];
      const numerator = +row[definition.numerator];
      const denominator = +row[definition.denominator];
      tooltip.innerHTML = [
        `<strong>${row.quartier}</strong>`,
        `<span>${row.commune} · ${currentYear}</span><br>`,
        `${definition.control} : <b>${value == null ? "non disponible" : fmtPct(value)}</b><br>`,
        `${fmtInt(numerator)} ${definition.numeratorLabel}<br>`,
        `sur ${fmtInt(denominator)} ${definition.denominatorLabel}`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    visibleRows.forEach((row, rowIndex) => {
      const y = matrixTop + rowIndex * rowHeight;
      if (rowIndex % 2 === 0) {
        svg.append("rect")
          .attr("x", 10)
          .attr("y", y)
          .attr("width", width - 30)
          .attr("height", rowHeight)
          .attr("fill", "#f8f5ef");
      }
      const fullRowLabel = currentView === "grand" ? `${row.quartier} · ${row.commune}` : row.quartier;
      const rowLabel = fullRowLabel.length > 42 ? `${fullRowLabel.slice(0, 41)}…` : fullRowLabel;
      label(svg, rowLabel, 18, y + rowHeight / 2, { size: 10.2, weight: 760, color: ink });

      selectedMetrics.forEach((metric, columnIndex) => {
        const definition = metricDefinitions[metric];
        const x = labelWidth + columnIndex * cellWidth;
        const value = row[metric];
        const rank = ranks.get(metric).get(row.map_id);
        const cellColor = heatColor(rank, definition.colors);
        svg.append("rect")
          .attr("x", x + 1.5)
          .attr("y", y + 1.5)
          .attr("width", cellWidth - 3)
          .attr("height", rowHeight - 3)
          .attr("fill", cellColor)
          .attr("fill-opacity", 0.2)
          .attr("stroke", "none");
        roughRect(svg, rc, x + 1.5, y + 1.5, cellWidth - 3, rowHeight - 3, cellColor, {
          fill: cellColor,
          fillStyle: "hachure",
          hachureAngle: -43 + roughSeed(`${row.map_id}-${metric}`) % 11,
          hachureGap: 3.1,
          fillWeight: 0.54,
          stroke: cellColor,
          strokeWidth: 0.35,
          roughness: 1.55,
          bowing: 1,
          opacity: 0.88,
          seed: `explorer-pencil-${currentYear}-${row.map_id}-${metric}`
        });
        const cell = svg.append("rect")
          .attr("x", x + 1.5)
          .attr("y", y + 1.5)
          .attr("width", cellWidth - 3)
          .attr("height", rowHeight - 3)
          .attr("fill", "transparent")
          .attr("stroke", paper)
          .attr("stroke-width", 1)
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${row.quartier}, ${row.commune}, ${currentYear}, ${definition.control.toLowerCase()} : ${value == null ? "non disponible" : fmtPct(value)}`
          );
        label(svg, value == null ? "—" : fmtPct(value), x + cellWidth / 2, y + rowHeight / 2, {
          anchor: "middle",
          size: 10.2,
          weight: 900,
          color: ink
        }).attr("pointer-events", "none");
        cell
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 2);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
            }
            showTooltip(pointerEvent, row, metric);
          })
          .on("pointermove", (event) => showTooltip(event, row, metric))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", paper).attr("stroke-width", 1);
            tooltip.style.opacity = 0;
          });
      });
    });

    roughRect(svg, rc, labelWidth, matrixTop, matrixRight - labelWidth, visibleRows.length * rowHeight, "none", {
      fill: "none",
      stroke: ink,
      strokeWidth: 0.65,
      roughness: 1.1,
      bowing: 0.7,
      disableMultiStroke: true,
      seed: `explorer-matrix-${currentYear}-${currentView}`
    });
    label(svg, "contours.nc · Isee, recensements 2014 et 2019", width - 18, height - 16, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderCorrelationMatrixLegacy(id, p) {
    const bundle = mapBundle();
    if (!bundle) return;

    const allowedMetrics = (Array.isArray(p.options.metrics)
      ? p.options.metrics
      : explorerMetricOrder).filter((metric) => metricDefinitions[metric]);
    const currentYear = correlationMatrixYearState.get(id) || p.options.defaultYear || 2019;
    const validViews = ["noumea", "dumbea", "montdore", "paita", "grand"];
    const storedView = correlationMatrixViewState.get(id);
    const currentView = validViews.includes(storedView)
      ? storedView
      : (validViews.includes(p.options.defaultView) ? p.options.defaultView : "grand");
    const viewCommunes = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta"
    };
    const viewLabels = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta",
      grand: "Grand Nouméa"
    };
    const rows = bundle.data
      .filter((row) => +row.annee === +currentYear)
      .filter((row) => currentView === "grand" || row.commune === viewCommunes[currentView])
      .map((row) => {
        const parsed = { ...row };
        allowedMetrics.forEach((metric) => {
          parsed[metric] = row[metric] == null ? null : +row[metric];
        });
        return parsed;
      });

    function pairwiseCorrelation(metricA, metricB) {
      const pairs = rows
        .map((row) => [row[metricA], row[metricB]])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      if (pairs.length < 3) return { value: null, n: pairs.length };
      const meanA = d3.mean(pairs, (pair) => pair[0]);
      const meanB = d3.mean(pairs, (pair) => pair[1]);
      let covariance = 0;
      let varianceA = 0;
      let varianceB = 0;
      pairs.forEach(([a, b]) => {
        covariance += (a - meanA) * (b - meanB);
        varianceA += (a - meanA) ** 2;
        varianceB += (b - meanB) ** 2;
      });
      const denominator = Math.sqrt(varianceA * varianceB);
      return {
        value: denominator > 0 ? Math.max(-1, Math.min(1, covariance / denominator)) : null,
        n: pairs.length
      };
    }

    function correlationColor(value) {
      if (!Number.isFinite(value)) return "#c7c2b9";
      const position = Math.round(((Math.max(-1, Math.min(1, value)) + 1) / 2) *
        (correlationSpectralPalette.length - 1));
      return correlationSpectralPalette[position];
    }

    function correlationText(value) {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: "exceptZero"
      }).format(value);
    }

    const cellSize = 59;
    const labelWidth = 282;
    const matrixTop = 252;
    const matrixWidth = allowedMetrics.length * cellSize;
    const minWidth = Math.max(1080, labelWidth + matrixWidth + 34);
    const height = matrixTop + allowedMetrics.length * cellSize + 58;
    const ctx = base(id, height, minWidth, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      addSelect(
        "Année",
        "Année de la matrice de corrélations",
        [
          { value: 2014, label: "2014" },
          { value: 2019, label: "2019" }
        ],
        currentYear,
        (value) => {
          correlationMatrixYearState.set(id, +value);
          render(id);
        }
      );
      addSelect(
        "Vue",
        "Territoire de la matrice de corrélations",
        [
          { value: "noumea", label: "Nouméa" },
          { value: "dumbea", label: "Dumbéa" },
          { value: "montdore", label: "Mont-Dore" },
          { value: "paita", label: "Païta" },
          { value: "grand", label: "Grand Nouméa" }
        ],
        currentView,
        (value) => {
          correlationMatrixViewState.set(id, value);
          render(id);
        }
      );
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-correlation-matrix", "habitat-explorer");
    chartTitle(svg, p.options.title, width);
    label(svg, `${rows.length} quartiers · ${currentYear} · ${viewLabels[currentView]}`, 20, 66, {
      size: 12.5,
      weight: 750,
      color: muted
    });
    label(svg, "Relation opposée", 20, 105, { size: 10, weight: 800, color: muted });
    correlationSpectralPalette.forEach((color, index) => {
      const x = 117 + index * 24;
      svg.append("rect")
        .attr("x", x)
        .attr("y", 98)
        .attr("width", 20)
        .attr("height", 14)
        .attr("fill", color)
        .attr("fill-opacity", 0.2);
      roughRect(svg, rc, x, 98, 20, 14, color, {
        fill: color,
        fillStyle: "hachure",
        hachureAngle: -38,
        hachureGap: 2.7,
        fillWeight: 0.55,
        stroke: color,
        strokeWidth: 0.35,
        roughness: 1.55,
        bowing: 0.9,
        opacity: 0.9,
        seed: `correlation-legend-${index}`
      });
    });
    label(svg, "Pas de relation linéaire nette", 381, 105, {
      size: 10,
      weight: 800,
      color: muted
    });
    label(svg, "Évolution parallèle", 544, 105, { size: 10, weight: 800, color: muted });
    label(svg, "−1", 117, 126, { size: 10, weight: 900, color: ink });
    label(svg, "0", 247, 126, { anchor: "middle", size: 10, weight: 900, color: ink });
    label(svg, "+1", 377, 126, { anchor: "end", size: 10, weight: 900, color: ink });
    label(
      svg,
      "Chaque case donne le coefficient r. La diagonale vaut toujours +1 et le tableau se lit de la même façon dans les deux sens.",
      20,
      153,
      { size: 10.5, weight: 750, color: muted }
    ).call(wrap, Math.min(width - 40, 940));

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function showTooltip(event, metricA, metricB, correlation) {
      const value = correlation.value;
      const direction = !Number.isFinite(value)
        ? "calcul impossible"
        : Math.abs(value) < 0.2
          ? "relation linéaire très faible"
          : value > 0
            ? "les deux indicateurs tendent à évoluer ensemble"
            : "les deux indicateurs tendent à évoluer en sens inverse";
      tooltip.innerHTML = [
        `<strong>${metricDefinitions[metricA].control}</strong>`,
        `<span>avec ${metricDefinitions[metricB].control}</span><br>`,
        `Coefficient : <b>${correlationText(value)}</b><br>`,
        `${direction}<br>`,
        `<span class="habitat-tooltip-note">${correlation.n} quartiers renseignés</span>`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    allowedMetrics.forEach((metric, index) => {
      const definition = metricDefinitions[metric];
      const y = matrixTop + index * cellSize + cellSize / 2;
      label(svg, definition.control, labelWidth - 12, y, {
        anchor: "end",
        size: 10.2,
        weight: 800,
        color: ink
      });
      const x = labelWidth + index * cellSize + cellSize / 2;
      label(svg, definition.control, 0, 0, {
        size: 9.7,
        weight: 800,
        color: ink
      }).attr("transform", `translate(${x - 3},${matrixTop - 13}) rotate(-52)`);
    });

    allowedMetrics.forEach((metricA, rowIndex) => {
      allowedMetrics.forEach((metricB, columnIndex) => {
        const correlation = pairwiseCorrelation(metricA, metricB);
        const cellColor = correlationColor(correlation.value);
        const x = labelWidth + columnIndex * cellSize;
        const y = matrixTop + rowIndex * cellSize;
        svg.append("rect")
          .attr("x", x + 2)
          .attr("y", y + 2)
          .attr("width", cellSize - 4)
          .attr("height", cellSize - 4)
          .attr("fill", cellColor)
          .attr("fill-opacity", 0.2);
        roughRect(svg, rc, x + 2, y + 2, cellSize - 4, cellSize - 4, cellColor, {
          fill: cellColor,
          fillStyle: "hachure",
          hachureAngle: -43 + roughSeed(`${metricA}-${metricB}`) % 11,
          hachureGap: 3.25,
          fillWeight: 0.58,
          stroke: cellColor,
          strokeWidth: 0.38,
          roughness: 1.65,
          bowing: 1.05,
          opacity: 0.9,
          seed: `correlation-pencil-${currentYear}-${currentView}-${metricA}-${metricB}`
        });
        const hit = svg.append("rect")
          .attr("x", x + 1)
          .attr("y", y + 1)
          .attr("width", cellSize - 2)
          .attr("height", cellSize - 2)
          .attr("fill", "transparent")
          .attr("stroke", paper)
          .attr("stroke-width", 1)
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${metricDefinitions[metricA].control} et ${metricDefinitions[metricB].control} : ` +
            `coefficient ${correlationText(correlation.value)}, ${correlation.n} quartiers renseignés`
          );
        label(svg, correlationText(correlation.value), x + cellSize / 2, y + cellSize / 2, {
          anchor: "middle",
          size: 10.3,
          weight: 900,
          color: ink
        }).attr("pointer-events", "none");
        hit
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 2.3);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              };
            }
            showTooltip(pointerEvent, metricA, metricB, correlation);
          })
          .on("pointermove", (event) => showTooltip(event, metricA, metricB, correlation))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", paper).attr("stroke-width", 1);
            tooltip.style.opacity = 0;
          });
      });
    });

    roughRect(svg, rc, labelWidth, matrixTop, matrixWidth, matrixWidth, "none", {
      fill: "none",
      stroke: ink,
      strokeWidth: 0.75,
      roughness: 1.25,
      bowing: 0.8,
      disableMultiStroke: true,
      seed: `correlation-matrix-${currentYear}-${currentView}`
    });
    label(svg, "contours.nc · Isee, recensements 2014 et 2019", width - 18, height - 17, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function renderExplorerMatrix(id, p) {
    const currentScale = explorerMatrixScaleState.get(id) || p.options.defaultScale || "grand";
    const isNc = currentScale === "nc";
    const bundle = mapBundle();
    if (isNc ? !bundle?.nc_data : !bundle?.data) return;

    const scaleKey = `${id}|${currentScale}`;
    const definitions = isNc ? ncMetricDefinitions : metricDefinitions;
    const metricOrder = isNc ? ncMetricOrder : explorerMetricOrder;
    const defaultMetrics = isNc
      ? ["taux_tribu", "taux_sans_internet", "taux_bepc_moins", "taux_chomage", "taux_cadres"]
      : ["taux_nes_hors_nc", "taux_cadres", "taux_sans_diplome", "taux_chomage", "taux_sans_internet"];
    const storedMetrics = explorerMatrixMetricsState.get(scaleKey);
    const selectedMetrics = (storedMetrics || defaultMetrics)
      .filter((metric) => metricOrder.includes(metric) && definitions[metric]);
    const currentYear = isNc ? 2019 : (explorerMatrixYearState.get(id) || p.options.defaultYear || 2019);
    const viewChoices = isNc
      ? [
        { value: "nc", label: "Toute la Nouvelle-Calédonie" },
        { value: "sud", label: "Province Sud" },
        { value: "nord", label: "Province Nord" },
        { value: "iles", label: "Îles Loyauté" }
      ]
      : [
        { value: "grand", label: "Grand Nouméa" },
        { value: "noumea", label: "Nouméa" },
        { value: "dumbea", label: "Dumbéa" },
        { value: "montdore", label: "Mont-Dore" },
        { value: "paita", label: "Païta" }
      ];
    const validViews = viewChoices.map((choice) => choice.value);
    const storedView = explorerMatrixViewState.get(scaleKey);
    const requestedDefault = isNc
      ? (p.options.defaultNcView || "nc")
      : (p.options.defaultView || "grand");
    const currentView = validViews.includes(storedView)
      ? storedView
      : (validViews.includes(requestedDefault) ? requestedDefault : validViews[0]);
    const viewLabel = viewChoices.find((choice) => choice.value === currentView)?.label || "";
    const currentOrder = explorerMatrixOrderState.get(scaleKey) || "socioeco";
    const viewCommunes = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta"
    };
    const viewProvinces = {
      sud: "Province Sud",
      nord: "Province Nord",
      iles: "Îles Loyauté"
    };

    const allRows = (isNc ? bundle.nc_data : bundle.data)
      .filter((row) => isNc ? +row.population > 0 : +row.annee === +currentYear)
      .map((row) => {
        const parsed = {
          ...row,
          map_id: String(row.map_id),
          unit: isNc ? row.iris : row.quartier,
          region: isNc ? row.province : row.commune,
          population: isNc ? +row.population : null
        };
        metricOrder.forEach((metric) => {
          parsed[metric] = row[metric] == null ? null : +row[metric];
        });
        return parsed;
      });

    const ranks = new Map();
    metricOrder.forEach((metric) => {
      const sorted = allRows
        .map((row) => row[metric])
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const denominator = Math.max(1, sorted.length - 1);
      ranks.set(metric, new Map(allRows.map((row) => {
        const value = row[metric];
        return [
          row.map_id,
          Number.isFinite(value) ? 100 * d3.bisectLeft(sorted, value) / denominator : null
        ];
      })));
    });

    const disadvantageMetrics = isNc
      ? [
        "taux_bepc_moins", "taux_chomage", "taux_cdd", "taux_employes_ouvriers",
        "taux_sans_electricite", "taux_sans_eau", "taux_sans_internet", "taux_sans_vehicule"
      ]
      : [
        "taux_sans_diplome", "taux_chomage", "taux_cdd", "taux_employes_ouvriers",
        "taux_non_reseau", "taux_sans_eau", "taux_sans_internet", "taux_sans_automobile"
      ];
    const advantageMetrics = isNc
      ? ["taux_emploi", "taux_bac3_plus", "taux_cadres"]
      : ["taux_cadres"];
    allRows.forEach((row) => {
      const values = disadvantageMetrics
        .map((metric) => ranks.get(metric)?.get(row.map_id))
        .filter(Number.isFinite);
      advantageMetrics.forEach((metric) => {
        const rank = ranks.get(metric)?.get(row.map_id);
        if (Number.isFinite(rank)) values.push(100 - rank);
      });
      row.indice_socioeco = d3.mean(values);
    });

    const visibleRows = allRows
      .filter((row) => {
        if (isNc) return currentView === "nc" || row.province === viewProvinces[currentView];
        return currentView === "grand" || row.commune === viewCommunes[currentView];
      })
      .sort((a, b) => {
        if (currentOrder === "territorial") {
          const metric = isNc ? "taux_tribu" : "taux_langue";
          return (b[metric] - a[metric]) || a.unit.localeCompare(b.unit, "fr");
        }
        if (currentOrder === "alpha") {
          return a.region.localeCompare(b.region, "fr") || a.unit.localeCompare(b.unit, "fr");
        }
        return (b.indice_socioeco - a.indice_socioeco) || a.unit.localeCompare(b.unit, "fr");
      });

    const compact = window.innerWidth < 760;
    const rowHeight = isNc ? (compact ? 24 : 22) : (compact ? 26 : 24);
    const matrixTop = 220;
    const height = matrixTop + visibleRows.length * rowHeight + 50;
    const labelWidth = isNc ? 360 : 330;
    const minWidth = Math.max(1100, labelWidth + selectedMetrics.length * 175 + 24);
    const ctx = base(id, height, minWidth, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      addSelect(
        "Échelle",
        "Échelle géographique de la matrice",
        [
          { value: "nc", label: "Nouvelle-Calédonie · IRIS" },
          { value: "grand", label: "Grand Nouméa · quartiers" }
        ],
        currentScale,
        (value) => {
          explorerMatrixScaleState.set(id, value);
          render(id);
        }
      );
      if (!isNc) {
        addSelect(
          "Année",
          "Année de la matrice",
          [{ value: 2014, label: "2014" }, { value: 2019, label: "2019" }],
          currentYear,
          (value) => {
            explorerMatrixYearState.set(id, +value);
            render(id);
          }
        );
      }
      addSelect("Territoire", "Territoire affiché dans la matrice", viewChoices, currentView, (value) => {
        explorerMatrixViewState.set(scaleKey, value);
        render(id);
      });
      addSelect(
        "Tri",
        "Ordre des zones",
        [
          { value: "socioeco", label: "Profil socio-économique" },
          {
            value: "territorial",
            label: isNc ? "Résidence en tribu" : "Connaissance d’une langue kanak"
          },
          { value: "alpha", label: "Ordre alphabétique" }
        ],
        currentOrder,
        (value) => {
          explorerMatrixOrderState.set(scaleKey, value);
          render(id);
        }
      );

      const details = document.createElement("details");
      details.className = "habitat-indicator-picker";
      details.open = explorerIndicatorPanelState.get(id) || false;
      details.addEventListener("toggle", () => explorerIndicatorPanelState.set(id, details.open));
      const summary = document.createElement("summary");
      summary.textContent = `Indicateurs (${selectedMetrics.length})`;
      details.appendChild(summary);
      const choices = document.createElement("div");
      choices.className = "habitat-indicator-picker-grid";
      metricOrder.forEach((metric) => {
        const choice = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = metric;
        checkbox.checked = selectedMetrics.includes(metric);
        checkbox.addEventListener("change", () => {
          const next = new Set(selectedMetrics);
          if (checkbox.checked) next.add(metric);
          else next.delete(metric);
          if (!next.size) {
            checkbox.checked = true;
            return;
          }
          explorerMatrixMetricsState.set(scaleKey, metricOrder.filter((candidate) => next.has(candidate)));
          explorerIndicatorPanelState.set(id, true);
          render(id);
        });
        choice.appendChild(checkbox);
        choice.appendChild(document.createTextNode(definitions[metric].label));
        choices.appendChild(choice);
      });
      details.appendChild(choices);
      tools.appendChild(details);
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-heatmap", "habitat-profile-matrix", "habitat-explorer");
    chartTitle(svg, p.options.title, width);
    label(
      svg,
      `${visibleRows.length} ${isNc ? "IRIS" : "quartiers"} · ${viewLabel} · ${currentYear}`,
      20,
      66,
      { size: 13.5, weight: 800, color: muted }
    );
    label(
      svg,
      "Dans chaque colonne : rouge = valeur faible, bleu = valeur élevée. Le nombre affiche le taux exact.",
      20,
      96,
      { size: 12, weight: 800, color: muted }
    );

    const matrixRight = width - 20;
    const cellWidth = (matrixRight - labelWidth) / selectedMetrics.length;
    label(svg, isNc ? "IRIS" : "Quartier", 18, 146, { size: 13.2, weight: 900, color: ink });
    selectedMetrics.forEach((metric, index) => {
      const center = labelWidth + index * cellWidth + cellWidth / 2;
      label(svg, definitions[metric].label, center, 146, {
        anchor: "middle",
        size: 12.4,
        weight: 900,
        color: ink
      }).call(wrap, cellWidth - 18);
    });

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function heatColor(rank, palette) {
      if (!Number.isFinite(rank)) return "#c7c2b9";
      const index = Math.min(palette.length - 1, Math.floor(rank / (100 / palette.length)));
      return palette[Math.max(0, index)];
    }

    function showTooltip(event, row, metric) {
      const definition = definitions[metric];
      const value = row[metric];
      const details = isNc
        ? `${fmtInt(row.population)} habitants dans l’IRIS`
        : (() => {
          const numerator = +row[definition.numerator];
          const denominator = +row[definition.denominator];
          return Number.isFinite(numerator) && Number.isFinite(denominator)
            ? `${fmtInt(numerator)} ${definition.numeratorLabel}<br>sur ${fmtInt(denominator)} ${definition.denominatorLabel}`
            : "Effectifs détaillés non disponibles";
        })();
      tooltip.innerHTML = [
        `<strong>${row.unit}</strong>`,
        `<span>${isNc ? `${row.commune} · ${row.province}` : row.commune} · ${currentYear}</span><br>`,
        `${definition.label} : <b>${Number.isFinite(value) ? fmtPct(value) : "non disponible"}</b><br>`,
        details
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    visibleRows.forEach((row, rowIndex) => {
      const y = matrixTop + rowIndex * rowHeight;
      if (rowIndex % 2 === 0) {
        svg.append("rect")
          .attr("x", 10)
          .attr("y", y)
          .attr("width", width - 30)
          .attr("height", rowHeight)
          .attr("fill", "#f8f5ef");
      }
      const fullLabel = currentView === (isNc ? "nc" : "grand")
        ? `${row.unit} · ${row.commune}`
        : row.unit;
      const rowLabel = fullLabel.length > 52 ? `${fullLabel.slice(0, 51)}…` : fullLabel;
      label(svg, rowLabel, 18, y + rowHeight / 2, {
        size: isNc ? 9.8 : 10.7,
        weight: 780,
        color: ink
      });

      selectedMetrics.forEach((metric, columnIndex) => {
        const x = labelWidth + columnIndex * cellWidth;
        const value = row[metric];
        const rank = ranks.get(metric)?.get(row.map_id);
        const cellColor = heatColor(rank, definitions[metric].colors);
        svg.append("rect")
          .attr("x", x + 1.5)
          .attr("y", y + 1.5)
          .attr("width", cellWidth - 3)
          .attr("height", rowHeight - 3)
          .attr("fill", cellColor)
          .attr("fill-opacity", 0.34);
        roughRect(svg, rc, x + 1.5, y + 1.5, cellWidth - 3, rowHeight - 3, cellColor, {
          fill: cellColor,
          fillStyle: "hachure",
          hachureAngle: -43 + roughSeed(`${row.map_id}-${metric}`) % 11,
          hachureGap: 2.55,
          fillWeight: 0.68,
          stroke: cellColor,
          strokeWidth: 0.38,
          roughness: 1.6,
          bowing: 1.05,
          opacity: 0.96,
          seed: `profile-pencil-${currentScale}-${currentYear}-${row.map_id}-${metric}`
        });
        const hit = svg.append("rect")
          .attr("x", x + 1.5)
          .attr("y", y + 1.5)
          .attr("width", cellWidth - 3)
          .attr("height", rowHeight - 3)
          .attr("fill", "transparent")
          .attr("stroke", paper)
          .attr("stroke-width", 1)
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${row.unit}, ${row.region}, ${currentYear}, ${definitions[metric].label.toLowerCase()} : ` +
            `${Number.isFinite(value) ? fmtPct(value) : "non disponible"}`
          );
        label(svg, Number.isFinite(value) ? fmtPct(value) : "—", x + cellWidth / 2, y + rowHeight / 2, {
          anchor: "middle",
          size: isNc ? 9.5 : 10.5,
          weight: 900,
          color: ink
        }).attr("pointer-events", "none");
        hit
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 2);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
            }
            showTooltip(pointerEvent, row, metric);
          })
          .on("pointermove", (event) => showTooltip(event, row, metric))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", paper).attr("stroke-width", 1);
            tooltip.style.opacity = 0;
          });
      });
    });

    roughRect(svg, rc, labelWidth, matrixTop, matrixRight - labelWidth, visibleRows.length * rowHeight, "none", {
      fill: "none",
      stroke: ink,
      strokeWidth: 0.68,
      roughness: 1.15,
      bowing: 0.75,
      disableMultiStroke: true,
      seed: `profile-matrix-${currentScale}-${currentYear}-${currentView}`
    });
    label(
      svg,
      isNc ? "contours.nc · Isee, RGP 2019 · échelle IRIS" : "contours.nc · Isee, recensements 2014 et 2019",
      width - 18,
      height - 16,
      { anchor: "end", size: 11.5, weight: 800, color: "#8a8277" }
    );
  }

  function renderCorrelationMatrix(id, p) {
    const currentScale = correlationMatrixScaleState.get(id) || p.options.defaultScale || "grand";
    const isNc = currentScale === "nc";
    const bundle = mapBundle();
    if (isNc ? !bundle?.nc_data : !bundle?.data) return;

    const scaleKey = `${id}|${currentScale}`;
    const definitions = isNc ? ncMetricDefinitions : metricDefinitions;
    const requestedMetrics = isNc
      ? (Array.isArray(p.options.ncMetrics) ? p.options.ncMetrics : ncMetricOrder)
      : (Array.isArray(p.options.metrics) ? p.options.metrics : explorerMetricOrder);
    const availableMetrics = requestedMetrics.filter((metric) => definitions[metric]);
    const defaultMetrics = isNc
      ? [
        "taux_tribu", "taux_sans_internet", "taux_bepc_moins", "taux_chomage",
        "taux_cadres", "taux_emploi", "taux_sans_vehicule"
      ]
      : [
        "taux_nes_hors_nc", "taux_cadres", "taux_sans_diplome", "taux_chomage",
        "taux_langue", "taux_sans_internet", "taux_locataires"
      ];
    const storedMetrics = correlationMatrixMetricsState.get(scaleKey);
    const baseMetrics = (storedMetrics || defaultMetrics)
      .filter((metric) => availableMetrics.includes(metric));
    const currentYear = isNc ? 2019 : (correlationMatrixYearState.get(id) || p.options.defaultYear || 2019);
    const viewChoices = isNc
      ? [
        { value: "nc", label: "Toute la Nouvelle-Calédonie" },
        { value: "sud", label: "Province Sud" },
        { value: "nord", label: "Province Nord" },
        { value: "iles", label: "Îles Loyauté" }
      ]
      : [
        { value: "grand", label: "Grand Nouméa" },
        { value: "noumea", label: "Nouméa" },
        { value: "dumbea", label: "Dumbéa" },
        { value: "montdore", label: "Mont-Dore" },
        { value: "paita", label: "Païta" }
      ];
    const validViews = viewChoices.map((choice) => choice.value);
    const storedView = correlationMatrixViewState.get(scaleKey);
    const requestedDefault = isNc
      ? (p.options.defaultNcView || "nc")
      : (p.options.defaultView || "grand");
    const currentView = validViews.includes(storedView)
      ? storedView
      : (validViews.includes(requestedDefault) ? requestedDefault : validViews[0]);
    const viewLabel = viewChoices.find((choice) => choice.value === currentView)?.label || "";
    const viewCommunes = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta"
    };
    const viewProvinces = {
      sud: "Province Sud",
      nord: "Province Nord",
      iles: "Îles Loyauté"
    };
    const rows = (isNc ? bundle.nc_data : bundle.data)
      .filter((row) => isNc ? +row.population > 0 : +row.annee === +currentYear)
      .filter((row) => {
        if (isNc) return currentView === "nc" || row.province === viewProvinces[currentView];
        return currentView === "grand" || row.commune === viewCommunes[currentView];
      })
      .map((row) => {
        const parsed = { ...row };
        baseMetrics.forEach((metric) => {
          parsed[metric] = row[metric] == null ? null : +row[metric];
        });
        return parsed;
      });

    const correlationCache = new Map();
    function pairwiseCorrelation(metricA, metricB) {
      const key = [metricA, metricB].sort().join("|");
      if (correlationCache.has(key)) return correlationCache.get(key);
      const pairs = rows
        .map((row) => [row[metricA], row[metricB]])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      if (pairs.length < 3) {
        const result = { value: null, n: pairs.length };
        correlationCache.set(key, result);
        return result;
      }
      const meanA = d3.mean(pairs, (pair) => pair[0]);
      const meanB = d3.mean(pairs, (pair) => pair[1]);
      let covariance = 0;
      let varianceA = 0;
      let varianceB = 0;
      pairs.forEach(([a, b]) => {
        covariance += (a - meanA) * (b - meanB);
        varianceA += (a - meanA) ** 2;
        varianceB += (b - meanB) ** 2;
      });
      const denominator = Math.sqrt(varianceA * varianceB);
      const result = {
        value: denominator > 0 ? Math.max(-1, Math.min(1, covariance / denominator)) : null,
        n: pairs.length
      };
      correlationCache.set(key, result);
      return result;
    }

    function clusteredOrder(metrics) {
      let clusters = metrics.map((metric) => [metric]);
      function strength(clusterA, clusterB) {
        const values = [];
        clusterA.forEach((metricA) => clusterB.forEach((metricB) => {
          const value = pairwiseCorrelation(metricA, metricB).value;
          if (Number.isFinite(value)) values.push(Math.abs(value));
        }));
        return values.length ? d3.mean(values) : 0;
      }
      function orientedMerge(clusterA, clusterB) {
        const reverseA = [...clusterA].reverse();
        const reverseB = [...clusterB].reverse();
        const candidates = [
          [...clusterA, ...clusterB],
          [...reverseA, ...clusterB],
          [...clusterA, ...reverseB],
          [...reverseA, ...reverseB]
        ];
        return candidates.sort((left, right) => {
          const leftBoundary = pairwiseCorrelation(left[clusterA.length - 1], left[clusterA.length]).value;
          const rightBoundary = pairwiseCorrelation(right[clusterA.length - 1], right[clusterA.length]).value;
          return Math.abs(rightBoundary || 0) - Math.abs(leftBoundary || 0);
        })[0];
      }
      while (clusters.length > 1) {
        let bestI = 0;
        let bestJ = 1;
        let bestStrength = -1;
        for (let i = 0; i < clusters.length; i += 1) {
          for (let j = i + 1; j < clusters.length; j += 1) {
            const candidateStrength = strength(clusters[i], clusters[j]);
            if (candidateStrength > bestStrength) {
              bestStrength = candidateStrength;
              bestI = i;
              bestJ = j;
            }
          }
        }
        const merged = orientedMerge(clusters[bestI], clusters[bestJ]);
        clusters = clusters.filter((_, index) => index !== bestI && index !== bestJ);
        clusters.push(merged);
      }
      return clusters[0] || metrics;
    }

    const orderedMetrics = clusteredOrder(baseMetrics);
    function correlationColor(value) {
      if (!Number.isFinite(value)) return "#c7c2b9";
      const position = Math.round(((Math.max(-1, Math.min(1, value)) + 1) / 2) *
        (correlationSpectralPalette.length - 1));
      return correlationSpectralPalette[position];
    }
    function correlationText(value) {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: "exceptZero"
      }).format(value);
    }

    const cellSize = isNc ? 72 : 78;
    const labelWidth = isNc ? 430 : 420;
    const matrixTop = 485;
    const matrixWidth = orderedMetrics.length * cellSize;
    const minWidth = Math.max(1120, labelWidth + matrixWidth + 34);
    const height = matrixTop + matrixWidth + 58;
    const ctx = base(id, height, minWidth, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }
      addSelect(
        "Échelle",
        "Échelle géographique de la matrice de corrélations",
        [
          { value: "nc", label: "Nouvelle-Calédonie · IRIS" },
          { value: "grand", label: "Grand Nouméa · quartiers" }
        ],
        currentScale,
        (value) => {
          correlationMatrixScaleState.set(id, value);
          render(id);
        }
      );
      if (!isNc) {
        addSelect(
          "Année",
          "Année de la matrice de corrélations",
          [{ value: 2014, label: "2014" }, { value: 2019, label: "2019" }],
          currentYear,
          (value) => {
            correlationMatrixYearState.set(id, +value);
            render(id);
          }
        );
      }
      addSelect("Territoire", "Territoire de la matrice de corrélations", viewChoices, currentView, (value) => {
        correlationMatrixViewState.set(scaleKey, value);
        render(id);
      });

      const details = document.createElement("details");
      details.className = "habitat-indicator-picker";
      details.open = correlationIndicatorPanelState.get(id) || false;
      details.addEventListener("toggle", () => correlationIndicatorPanelState.set(id, details.open));
      const summary = document.createElement("summary");
      summary.textContent = `Indicateurs (${baseMetrics.length})`;
      details.appendChild(summary);
      const choices = document.createElement("div");
      choices.className = "habitat-indicator-picker-grid";
      availableMetrics.forEach((metric) => {
        const choice = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = metric;
        checkbox.checked = baseMetrics.includes(metric);
        checkbox.addEventListener("change", () => {
          const next = new Set(baseMetrics);
          if (checkbox.checked) next.add(metric);
          else next.delete(metric);
          if (next.size < 2) {
            checkbox.checked = true;
            return;
          }
          correlationMatrixMetricsState.set(
            scaleKey,
            availableMetrics.filter((candidate) => next.has(candidate))
          );
          correlationIndicatorPanelState.set(id, true);
          render(id);
        });
        choice.appendChild(checkbox);
        choice.appendChild(document.createTextNode(definitions[metric].label));
        choices.appendChild(choice);
      });
      details.appendChild(choices);
      tools.appendChild(details);
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-correlation-matrix", "habitat-explorer");
    chartTitle(svg, p.options.title, width);
    label(
      svg,
      `${rows.length} ${isNc ? "IRIS" : "quartiers"} · ${viewLabel} · ${currentYear}`,
      20,
      66,
      { size: 13.5, weight: 800, color: muted }
    );
    label(svg, "Sens et force de la corrélation", 20, 94, { size: 12, weight: 900, color: ink });
    const legendX = 20;
    const legendY = 108;
    const legendCellWidth = 30;
    correlationSpectralPalette.forEach((color, index) => {
      const x = legendX + index * legendCellWidth;
      svg.append("rect")
        .attr("x", x)
        .attr("y", legendY)
        .attr("width", legendCellWidth - 2)
        .attr("height", 17)
        .attr("fill", color)
        .attr("fill-opacity", 0.34);
      roughRect(svg, rc, x, legendY, legendCellWidth - 2, 17, color, {
        fill: color,
        fillStyle: "hachure",
        hachureAngle: -38,
        hachureGap: 2.35,
        fillWeight: 0.68,
        stroke: color,
        strokeWidth: 0.38,
        roughness: 1.6,
        bowing: 0.95,
        opacity: 0.96,
        seed: `correlation-legend-${index}`
      });
    });
    const legendWidth = correlationSpectralPalette.length * legendCellWidth - 2;
    label(svg, "−1 · sens inverse", legendX, 144, { size: 11.2, weight: 850, color: muted });
    label(svg, "0 · pas de lien linéaire", legendX + legendWidth / 2, 144, {
      anchor: "middle",
      size: 11.2,
      weight: 850,
      color: muted
    });
    label(svg, "+1 · même sens", legendX + legendWidth, 144, {
      anchor: "end",
      size: 11.2,
      weight: 850,
      color: muted
    });
    label(
      svg,
      "Plus |r| se rapproche de 1, plus la relation linéaire est forte. Près de 0, elle est faible ou absente.",
      20,
      174,
      { size: 11.5, weight: 800, color: muted }
    ).call(wrap, Math.min(width - 40, 1030));
    label(
      svg,
      "Les variables sont regroupées automatiquement : les associations les plus fortes apparaissent côte à côte et forment des blocs.",
      20,
      202,
      { size: 11.5, weight: 800, color: muted }
    ).call(wrap, Math.min(width - 40, 1030));

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);
    function showTooltip(event, metricA, metricB, correlation) {
      const value = correlation.value;
      const magnitude = !Number.isFinite(value)
        ? "calcul impossible"
        : Math.abs(value) < 0.3
          ? "relation faible"
          : Math.abs(value) < 0.6
            ? "relation modérée"
            : Math.abs(value) < 0.8
              ? "relation forte"
              : "relation très forte";
      const direction = Number.isFinite(value)
        ? (value >= 0 ? "dans le même sens" : "en sens inverse")
        : "";
      tooltip.innerHTML = [
        `<strong>${definitions[metricA].label}</strong>`,
        `<span>avec ${definitions[metricB].label}</span><br>`,
        `Coefficient : <b>${correlationText(value)}</b><br>`,
        `${magnitude}${direction ? `, ${direction}` : ""}<br>`,
        `<span class="habitat-tooltip-note">${correlation.n} ${isNc ? "IRIS" : "quartiers"} renseignés</span>`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    orderedMetrics.forEach((metric, index) => {
      const y = matrixTop + index * cellSize + cellSize / 2;
      label(svg, definitions[metric].label, labelWidth - 12, y, {
        anchor: "end",
        size: isNc ? 11.4 : 11.8,
        weight: 850,
        color: ink
      });
      const x = labelWidth + index * cellSize + cellSize / 2;
      label(svg, definitions[metric].label, 0, 0, {
        size: isNc ? 11.3 : 11.8,
        weight: 850,
        color: ink
      }).attr("transform", `translate(${x - 3},${matrixTop - 14}) rotate(-54)`);
    });

    orderedMetrics.forEach((metricA, rowIndex) => {
      orderedMetrics.forEach((metricB, columnIndex) => {
        const correlation = pairwiseCorrelation(metricA, metricB);
        const cellColor = correlationColor(correlation.value);
        const x = labelWidth + columnIndex * cellSize;
        const y = matrixTop + rowIndex * cellSize;
        svg.append("rect")
          .attr("x", x + 2)
          .attr("y", y + 2)
          .attr("width", cellSize - 4)
          .attr("height", cellSize - 4)
          .attr("fill", cellColor)
          .attr("fill-opacity", 0.34);
        roughRect(svg, rc, x + 2, y + 2, cellSize - 4, cellSize - 4, cellColor, {
          fill: cellColor,
          fillStyle: "hachure",
          hachureAngle: -43 + roughSeed(`${metricA}-${metricB}`) % 11,
          hachureGap: 2.65,
          fillWeight: 0.68,
          stroke: cellColor,
          strokeWidth: 0.4,
          roughness: 1.65,
          bowing: 1.05,
          opacity: 0.96,
          seed: `correlation-pencil-${currentScale}-${currentYear}-${currentView}-${metricA}-${metricB}`
        });
        const hit = svg.append("rect")
          .attr("x", x + 1)
          .attr("y", y + 1)
          .attr("width", cellSize - 2)
          .attr("height", cellSize - 2)
          .attr("fill", "transparent")
          .attr("stroke", paper)
          .attr("stroke-width", 1)
          .attr("tabindex", 0)
          .attr("role", "img")
          .attr(
            "aria-label",
            `${definitions[metricA].label} et ${definitions[metricB].label} : ` +
            `coefficient ${correlationText(correlation.value)}, ${correlation.n} ${isNc ? "IRIS" : "quartiers"} renseignés`
          );
        label(svg, correlationText(correlation.value), x + cellSize / 2, y + cellSize / 2, {
          anchor: "middle",
          size: isNc ? 10.5 : 11,
          weight: 900,
          color: ink
        }).attr("pointer-events", "none");
        hit
          .on("pointerenter focus", function(event) {
            d3.select(this).attr("stroke", red).attr("stroke-width", 2.3);
            let pointerEvent = event;
            if (event.type === "focus") {
              const rect = this.getBoundingClientRect();
              pointerEvent = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
            }
            showTooltip(pointerEvent, metricA, metricB, correlation);
          })
          .on("pointermove", (event) => showTooltip(event, metricA, metricB, correlation))
          .on("pointerleave blur", function() {
            d3.select(this).attr("stroke", paper).attr("stroke-width", 1);
            tooltip.style.opacity = 0;
          });
      });
    });

    roughRect(svg, rc, labelWidth, matrixTop, matrixWidth, matrixWidth, "none", {
      fill: "none",
      stroke: ink,
      strokeWidth: 0.78,
      roughness: 1.25,
      bowing: 0.8,
      disableMultiStroke: true,
      seed: `correlation-matrix-${currentScale}-${currentYear}-${currentView}`
    });
    label(
      svg,
      isNc ? "contours.nc · Isee, RGP 2019 · corrélations entre IRIS" : "contours.nc · Isee, recensements 2014 et 2019",
      width - 18,
      height - 17,
      { anchor: "end", size: 11.5, weight: 800, color: "#8a8277" }
    );
  }

  function renderScatterPlot(id, p) {
    const bundle = mapBundle();
    if (!bundle) return;

    const allowedMetrics = Array.isArray(p.options.metrics)
      ? p.options.metrics
      : explorerMetricOrder;
    const defaultX = allowedMetrics.includes(p.options.defaultX)
      ? p.options.defaultX
      : "taux_nes_hors_nc";
    const defaultY = allowedMetrics.includes(p.options.defaultY)
      ? p.options.defaultY
      : "taux_cadres";
    const storedX = scatterXState.get(id);
    const storedY = scatterYState.get(id);
    const currentX = allowedMetrics.includes(storedX) ? storedX : defaultX;
    let currentY = allowedMetrics.includes(storedY) ? storedY : defaultY;
    if (currentY === currentX) {
      currentY = allowedMetrics.find((metric) => metric !== currentX) || currentY;
    }

    const currentYear = scatterYearState.get(id) || p.options.defaultYear || 2019;
    const validViews = ["noumea", "dumbea", "montdore", "paita", "grand"];
    const storedView = scatterViewState.get(id);
    const defaultView = validViews.includes(p.options.defaultView)
      ? p.options.defaultView
      : "noumea";
    const currentView = validViews.includes(storedView) ? storedView : defaultView;
    const viewCommunes = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta"
    };
    const viewLabels = {
      noumea: "Nouméa",
      dumbea: "Dumbéa",
      montdore: "Mont-Dore",
      paita: "Païta",
      grand: "Grand Nouméa"
    };
    const communeColors = {
      "Nouméa": "#2f6b45",
      "Dumbéa": "#d6a21f",
      "Mont-Dore": "#c54832",
      "Païta": "#245f68"
    };

    const rows = bundle.data
      .filter((row) => +row.annee === +currentYear)
      .filter((row) => currentView === "grand" || row.commune === viewCommunes[currentView])
      .map((row) => ({
        ...row,
        x: row[currentX] == null ? null : +row[currentX],
        y: row[currentY] == null ? null : +row[currentY]
      }))
      .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

    const compact = window.innerWidth < 760;
    const height = compact ? 670 : 635;
    const ctx = base(id, height, compact ? 760 : 940, (tools) => {
      function addSelect(labelText, ariaLabel, choices, selected, onChange) {
        const labelNode = document.createElement("label");
        labelNode.className = "habitat-map-control-label";
        labelNode.appendChild(document.createTextNode(labelText));
        const control = document.createElement("select");
        control.className = "habitat-map-select";
        control.setAttribute("aria-label", ariaLabel);
        choices.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = String(choice.value) === String(selected);
          control.appendChild(option);
        });
        control.addEventListener("change", () => onChange(control.value));
        labelNode.appendChild(control);
        tools.appendChild(labelNode);
      }

      const metricChoices = allowedMetrics.map((metric) => ({
        value: metric,
        label: metricDefinitions[metric].label
      }));
      addSelect("Axe horizontal", "Variable de l’axe horizontal", metricChoices, currentX, (value) => {
        if (value === currentY) scatterYState.set(id, currentX);
        scatterXState.set(id, value);
        render(id);
      });
      addSelect("Axe vertical", "Variable de l’axe vertical", metricChoices, currentY, (value) => {
        if (value === currentX) scatterXState.set(id, currentY);
        scatterYState.set(id, value);
        render(id);
      });
      addSelect(
        "Année",
        "Année du nuage de points",
        [
          { value: 2014, label: "2014" },
          { value: 2019, label: "2019" }
        ],
        currentYear,
        (value) => {
          scatterYearState.set(id, +value);
          render(id);
        }
      );
      addSelect(
        "Vue",
        "Périmètre du nuage de points",
        [
          { value: "noumea", label: "Nouméa" },
          { value: "dumbea", label: "Dumbéa" },
          { value: "montdore", label: "Mont-Dore" },
          { value: "paita", label: "Païta" },
          { value: "grand", label: "Grand Nouméa" }
        ],
        currentView,
        (value) => {
          scatterViewState.set(id, value);
          render(id);
        }
      );
    });
    if (!ctx) return;

    const { el, svg, rc, width } = ctx;
    el.classList.add("habitat-scatter");
    chartTitle(svg, p.options.title, width);

    if (rows.length < 2) {
      label(svg, "Pas assez de quartiers renseignés pour calculer la corrélation.", 20, 80, {
        size: 13,
        weight: 750,
        color: muted
      });
      return;
    }

    const meanX = d3.mean(rows, (row) => row.x);
    const meanY = d3.mean(rows, (row) => row.y);
    const covariance = d3.sum(rows, (row) => (row.x - meanX) * (row.y - meanY));
    const varianceX = d3.sum(rows, (row) => (row.x - meanX) ** 2);
    const varianceY = d3.sum(rows, (row) => (row.y - meanY) ** 2);
    const correlation = varianceX > 0 && varianceY > 0
      ? covariance / Math.sqrt(varianceX * varianceY)
      : NaN;
    const correlationLabel = Number.isFinite(correlation)
      ? new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(correlation)
      : "non calculable";

    label(
      svg,
      `r de Pearson = ${correlationLabel} · ${rows.length} quartiers · ${viewLabels[currentView]} · ${currentYear}`,
      20,
      66,
      { size: 12.5, weight: 800, color: muted }
    );

    if (currentView === "grand") {
      ["Nouméa", "Dumbéa", "Mont-Dore", "Païta"].forEach((commune, index) => {
        const x = 20 + index * 132;
        svg.append("circle")
          .attr("cx", x + 6)
          .attr("cy", 94)
          .attr("r", 5.5)
          .attr("fill", communeColors[commune])
          .attr("fill-opacity", 0.24);
        roughCircle(svg, rc, x + 6, 94, 11, communeColors[commune], {
          hachureGap: 2.5,
          fillWeight: 0.7,
          roughness: 1.65,
          opacity: 0.9,
          seed: `scatter-legend-${commune}`
        });
        label(svg, commune, x + 18, 94, { size: 11.5, weight: 800, color: muted });
      });
    }

    function paddedDomain(values) {
      let [minimum, maximum] = d3.extent(values);
      if (minimum === maximum) {
        minimum -= 1;
        maximum += 1;
      }
      const padding = Math.max(1, (maximum - minimum) * 0.08);
      return [Math.max(0, minimum - padding), Math.min(100, maximum + padding)];
    }

    const margin = {
      top: currentView === "grand" ? 122 : 100,
      right: 36,
      bottom: 78,
      left: 88
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const xDomain = paddedDomain(rows.map((row) => row.x));
    const yDomain = paddedDomain(rows.map((row) => row.y));
    const xScale = d3.scaleLinear()
      .domain(xDomain)
      .nice()
      .range([margin.left, margin.left + innerWidth]);
    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .nice()
      .range([margin.top + innerHeight, margin.top])
      .clamp(true);

    const gridGroup = svg.append("g");
    gridGroup.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(() => ""));
    gridGroup.append("g")
      .attr("transform", `translate(0,${margin.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(7).tickSize(-innerHeight).tickFormat(() => ""));
    gridGroup.selectAll(".domain").remove();
    gridGroup.selectAll("line")
      .attr("stroke", grid)
      .attr("stroke-opacity", 0.72)
      .attr("stroke-dasharray", "3,5");

    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${margin.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat((value) => `${value} %`));
    const yAxis = svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((value) => `${value} %`));
    [xAxis, yAxis].forEach((axis) => {
      axis.selectAll("text")
        .attr("font-family", "Atkinson Hyperlegible, sans-serif")
        .attr("font-size", 11.5)
        .attr("font-weight", 700)
        .attr("fill", muted);
      axis.selectAll("path, line").attr("stroke", "#6f685e").attr("stroke-opacity", 0.7);
    });

    roughRect(svg, rc, margin.left, margin.top, innerWidth, innerHeight, "none", {
      fill: "none",
      stroke: "#6f685e",
      strokeWidth: 0.68,
      roughness: 1.85,
      bowing: 1.2,
      opacity: 0.46,
      seed: `scatter-frame-${id}-${currentYear}-${currentView}-${currentX}-${currentY}`
    });

    label(svg, metricDefinitions[currentX].label, margin.left + innerWidth / 2, height - 27, {
      anchor: "middle",
      size: 12,
      weight: 850,
      color: ink
    });
    label(svg, metricDefinitions[currentY].label, 21, margin.top + innerHeight / 2, {
      anchor: "middle",
      size: 12,
      weight: 850,
      color: ink
    }).attr("transform", `rotate(-90,21,${margin.top + innerHeight / 2})`);

    if (varianceX > 0) {
      const slope = covariance / varianceX;
      const intercept = meanY - slope * meanX;
      const x1 = xScale.domain()[0];
      const x2 = xScale.domain()[1];
      roughPath(
        svg,
        rc,
        `M${xScale(x1)},${yScale(intercept + slope * x1)}L${xScale(x2)},${yScale(intercept + slope * x2)}`,
        {
          fill: "none",
          stroke: red,
          strokeWidth: 2.05,
          roughness: 1.8,
          bowing: 1.15,
          opacity: 0.86,
          seed: `scatter-regression-${id}-${currentYear}-${currentView}-${currentX}-${currentY}`
        }
      );
    }

    const tooltip = document.createElement("div");
    tooltip.className = "habitat-tooltip";
    el.appendChild(tooltip);

    function showTooltip(event, row) {
      tooltip.innerHTML = [
        `<strong>${row.quartier}</strong>`,
        `<span>${row.commune} · ${currentYear}</span><br>`,
        `${metricDefinitions[currentX].label} : <b>${fmtPct(row.x)}</b><br>`,
        `${metricDefinitions[currentY].label} : <b>${fmtPct(row.y)}</b>`
      ].join("");
      const bounds = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
      tooltip.style.opacity = 1;
    }

    rows.forEach((row) => {
      const pointRadius = compact ? 6.8 : 6;
      roughCircle(
        svg,
        rc,
        xScale(row.x),
        yScale(row.y),
        pointRadius * 2,
        communeColors[row.commune] || muted,
        {
          hachureGap: 2.6,
          fillWeight: 0.72,
          roughness: 1.7,
          bowing: 1.1,
          strokeWidth: 0.72,
          opacity: 0.92,
          seed: `scatter-point-${id}-${row.map_id}-${currentYear}-${currentX}-${currentY}`
        }
      );
      const point = svg.append("circle")
        .attr("cx", xScale(row.x))
        .attr("cy", yScale(row.y))
        .attr("r", pointRadius)
        .attr("fill", "transparent")
        .attr("stroke", paper)
        .attr("stroke-width", 0.9)
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr(
          "aria-label",
          `${row.quartier}, ${row.commune}, ${currentYear}, ` +
          `${metricDefinitions[currentX].label.toLowerCase()} ${fmtPct(row.x)}, ` +
          `${metricDefinitions[currentY].label.toLowerCase()} ${fmtPct(row.y)}`
        );
      point
        .on("pointerenter focus", function(event) {
          d3.select(this).attr("stroke", red).attr("stroke-width", 2.4);
          let pointerEvent = event;
          if (event.type === "focus") {
            const rect = this.getBoundingClientRect();
            pointerEvent = {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2
            };
          }
          showTooltip(pointerEvent, row);
        })
        .on("pointermove", (event) => showTooltip(event, row))
        .on("pointerleave blur", function() {
          d3.select(this).attr("stroke", paper).attr("stroke-width", 0.9);
          tooltip.style.opacity = 0;
        });
    });

    label(svg, "contours.nc · Isee, recensements 2014 et 2019", width - 18, height - 14, {
      anchor: "end",
      size: 11,
      weight: 800,
      color: "#8a8277"
    });
  }

  function requiredBundleScope(id, p) {
    if (["nc-rough-map", "nc-segregation-scatter"].includes(p.options.type)) {
      return "nc";
    }
    if (["rough-map", "segregation-scatter"].includes(p.options.type)) {
      return "grand";
    }
    if (p.options.type === "segregation-matrix") {
      const scale = explorerMatrixScaleState.get(id) || p.options.defaultScale || "grand";
      return scale === "nc" ? "nc" : "grand";
    }
    if (p.options.type === "segregation-correlation-matrix") {
      const scale = correlationMatrixScaleState.get(id) || p.options.defaultScale || "grand";
      return scale === "nc" ? "nc" : "grand";
    }
    return "grand";
  }

  function lazyMessage(el, text) {
    const message = document.createElement("p");
    message.className = "habitat-sketch-loading";
    message.setAttribute("role", "status");
    message.textContent = text;
    el.replaceChildren(message);
    el.classList.add("habitat-sketch--lazy");
  }

  function unloadChart(el) {
    if (activeChartIds.has(el.id)) {
      const height = Math.ceil(el.getBoundingClientRect().height);
      el.style.minHeight = `${Math.max(420, height)}px`;
    }
    renderRequestIds.set(el.id, (renderRequestIds.get(el.id) || 0) + 1);
    activeChartIds.delete(el.id);
    el.setAttribute("aria-busy", "false");
    lazyMessage(el, "La visualisation sera chargée à l’approche de l’écran.");
  }

  async function render(id) {
    const p = payload(id);
    if (!p || !p.options) return;
    const el = document.getElementById(id);
    if (!el) return;

    const requestId = (renderRequestIds.get(id) || 0) + 1;
    renderRequestIds.set(id, requestId);
    const wasActive = activeChartIds.has(id);
    el.setAttribute("aria-busy", "true");
    if (!wasActive) lazyMessage(el, "Chargement de la visualisation…");

    try {
      await loadMapBundle(requiredBundleScope(id, p));
      if (renderRequestIds.get(id) !== requestId) return;
      if (chartObserver && !el.dataset.nearViewport) {
        unloadChart(el);
        return;
      }

      el.style.removeProperty("min-height");
      el.classList.remove("habitat-sketch--lazy");
      if (p.options.type === "rough-map") renderRoughMap(id, p);
      if (p.options.type === "nc-rough-map") renderNcRoughMap(id, p);
      if (p.options.type === "segregation-scatter") renderScatterPlot(id, p);
      if (p.options.type === "nc-segregation-scatter") renderNcScatterPlot(id, p);
      if (p.options.type === "segregation-matrix") renderExplorerMatrix(id, p);
      if (p.options.type === "segregation-correlation-matrix") renderCorrelationMatrix(id, p);
      activeChartIds.add(id);
      el.setAttribute("aria-busy", "false");
    } catch (error) {
      if (renderRequestIds.get(id) !== requestId) return;
      console.error(error);
      activeChartIds.delete(id);
      el.setAttribute("aria-busy", "false");
      lazyMessage(el, "Les données de cette visualisation n’ont pas pu être chargées.");
    }
  }

  function renderAll() {
    if (!window.d3 || !window.rough) {
      document.querySelectorAll(".habitat-sketch").forEach((el) => {
        el.innerHTML = "<p style='padding:1rem'>Le moteur cartographique n’a pas pu être chargé.</p>";
      });
      return;
    }

    const charts = [...document.querySelectorAll(".habitat-sketch[id]")];
    if (!("IntersectionObserver" in window)) {
      charts.forEach((el) => void render(el.id));
      return;
    }

    if (chartObserver) chartObserver.disconnect();
    chartObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (entry.isIntersecting) {
          el.dataset.nearViewport = "true";
          if (!activeChartIds.has(el.id)) void render(el.id);
        } else {
          delete el.dataset.nearViewport;
          unloadChart(el);
        }
      });
    }, {
      rootMargin: "700px 0px",
      threshold: 0.01
    });

    charts.forEach((el) => {
      if (!activeChartIds.has(el.id)) {
        lazyMessage(el, "La visualisation sera chargée à l’approche de l’écran.");
      }
      chartObserver.observe(el);
    });
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    const viewportWidth = window.innerWidth;
    if (Math.abs(viewportWidth - lastViewportWidth) < 12) return;
    lastViewportWidth = viewportWidth;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      activeChartIds.forEach((id) => void render(id));
    }, 220);
  });
  document.addEventListener("DOMContentLoaded", renderAll);
  document.addEventListener("quarto:render", renderAll);
  window.ContoursHabitat = { render, renderAll };
})();
