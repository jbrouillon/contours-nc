/**
 * contours-banner.js
 * Module ES pour intégrer la bannière animée contours.nc dans un site Quarto.
 *
 * Arborescence conseillée :
 * assets/
 *   js/contours-banner.js
 *   data/nc_logo.geojson
 *
 * Le fichier nc_logo.geojson doit être placé dans assets/data/.
 */

export async function renderContoursBanner(target = "#contours-banner", options = {}) {
  const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm")
  const rough = await import("https://cdn.jsdelivr.net/npm/roughjs@4.6.6/+esm")

  const container = typeof target === "string" ? document.querySelector(target) : target
  if (!container) {
    throw new Error(`[contours-banner] Conteneur introuvable : ${target}`)
  }

  const width = options.width ?? 1400
  const height = options.height ?? 520
  const background = options.background ?? "#f7f1e3"
  const animate = options.animate ?? true
  const sectionTitle = options.sectionTitle ?? null
  const mainTitle = options.mainTitle ?? "contours.nc"
  const innerTitleLabel = options.innerTitle ?? mainTitle
  const showThemeBadges = options.showThemeBadges ?? !sectionTitle
  const palette = options.palette ?? ["#455d44", "#e0ab1e", "#c54832", "#111"]
  const defaultSubtitleLines = sectionTitle
    ? [{ x: 850, y: 294, text: sectionTitle, fontSize: 54, anchor: "middle" }]
    : [
        { x: 575, y: 255, text: "Blog de recherche en sciences sociales", fontSize: 34 },
        { x: 680, y: 305, text: "en Nouvelle-Calédonie", fontSize: 34 }
      ]
  const subtitleLines = (options.subtitleLines ?? defaultSubtitleLines).map((line) => {
    if (Array.isArray(line)) {
      return {
        x: line[0],
        y: line[1],
        text: line[2],
        fontSize: line[3] ?? 34,
        anchor: line[4] ?? "start"
      }
    }

    return {
      fontSize: 34,
      anchor: "start",
      ...line
    }
  })
  const geojsonUrl = options.geojsonUrl ?? new URL("../data/nc_logo.geojson", import.meta.url).href

  container.innerHTML = ""
  container.classList.add("contours-banner-container")

const svg = d3.create("svg")
  .attr("viewBox", [0, 0, width, height])
  .style("width", "100%")
  .style("background", background)

const rc = rough.default.svg(svg.node())

let T = 0

function draw(el, delay = 95, duration = 850) {
  svg.node().appendChild(el)

  const parts = el.querySelectorAll
    ? [...el.querySelectorAll("path, line, polygon, circle, ellipse, rect")]
    : []

  for (const p of parts) {
    let len = 500
    try { len = p.getTotalLength() } catch {}

    p.style.strokeDasharray = len
    p.style.strokeDashoffset = len
    p.style.opacity = 1

    const fill = p.getAttribute("fill")
    if (fill && fill !== "none") p.setAttribute("fill-opacity", 0)

    if (!animate) {
      p.style.strokeDashoffset = 0
      if (fill && fill !== "none") p.setAttribute("fill-opacity", 1)
      continue
    }

    setTimeout(() => {
      p.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration, easing: "ease-out", fill: "forwards" }
      )

      if (fill && fill !== "none") {
        setTimeout(() => {
          p.animate(
            [{ fillOpacity: 0 }, { fillOpacity: 1 }],
            { duration: duration * 0.45, easing: "ease-out", fill: "forwards" }
          )
        }, duration * 0.55)
      }
    }, T + delay)
  }

  T += delay
}

function fadeText(selection, delay = 0, duration = 900) {
  if (!animate) {
    selection.style("opacity", 1)
    return
  }

  selection.style("opacity", 0)

  setTimeout(() => {
    selection
      .transition()
      .duration(duration)
      .style("opacity", 1)
  }, T + delay)

  T += delay
}

if (!document.querySelector("#contours-font")) {
  const link = document.createElement("link")
  link.id = "contours-font"
  link.rel = "stylesheet"
  link.href = "https://fonts.googleapis.com/css2?family=Cabin+Sketch:wght@700&display=swap"
  document.head.append(link)
}

////////////////////////////////////////////////
// Hexagone
////////////////////////////////////////////////

draw(
  rc.polygon(
    [
      [95, 115],
      [300, 35],
      [500, 115],
      [500, 385],
      [300, 470],
      [95, 385]
    ],
    {
      stroke: "#111",
      strokeWidth: 3.2,
      roughness: 1.8,
      bowing: 1.6
    }
  ),
  80,
  1200
)
////////////////////////////////////////////////
// Carte NC — version propre avec nc_logo.geojson
////////////////////////////////////////////////

////////////////////////////////////////////////
// Carte NC — plus grande, plus sketch, derrière la case
////////////////////////////////////////////////

let ncGeo = null
try {
  const response = await fetch(geojsonUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  ncGeo = await response.json()
} catch (error) {
  console.warn(`[contours-banner] Impossible de charger le GeoJSON : ${geojsonUrl}`, error)
}

if (ncGeo) {
const mapW = 205
const mapH = 138

const projection = d3.geoIdentity()
  .reflectY(true)
  .fitExtent([[0, 0], [mapW, mapH]], ncGeo)

const pathGen = d3.geoPath(projection)
const rawPath = pathGen(ncGeo)

const ncX = 140
const ncY = 78
const rot = -10

// remplissage léger
const ncFill = rc.path(rawPath, {
  stroke: "none",
  fill: "rgba(69,93,68,0.045)",
  fillStyle: "hachure",
  hachureGap: 8,
  hachureAngle: -35,
  roughness: 3.0,
  bowing: 2.4,
  disableMultiStroke: false
})

ncFill.setAttribute(
  "transform",
  `translate(${ncX},${ncY}) rotate(${rot} ${mapW / 2} ${mapH / 2})`
)

ncFill.style.opacity = 0.65
draw(ncFill, 40, 700)

// contours multiples plus crayonnés
for (let i = 0; i < 6; i++) {
  const p = rc.path(rawPath, {
    stroke: "#111",
    strokeWidth: i === 0 ? 0.95 : 0.28,
    fill: "none",
    roughness: 3.0 + i * 0.6,
    bowing: 2.8,
    curveFitting: 0.65,
    disableMultiStroke: false
  })

  p.setAttribute(
    "transform",
    `translate(${ncX + (Math.random() - 0.5) * 2.5},
               ${ncY + (Math.random() - 0.5) * 2.5})
     rotate(${rot} ${mapW / 2} ${mapH / 2})`
  )

  p.style.opacity = i === 0 ? 0.58 : 0.18

  draw(p, 18, 650)
}
}
////////////////////////////////////////////////
// Barplot hexagone
////////////////////////////////////////////////

const cols = ["#455d44", "#73884c", "#e0ab1e", "#b73d28"]
const x0 = 135
const y0 = 265

for (let i = 0; i < 4; i++) {
  draw(
    rc.rectangle(
      x0 + i * 28,
      y0 - i * 20,
      16,
      52 + i * 18,
      {
        fill: cols[i],
        fillStyle: "hachure",
        stroke: "#111",
        strokeWidth: 1.5,
        roughness: 1.6
      }
    ),
    80,
    800
  )
}

////////////////////////////////////////////////
// Case kanak
////////////////////////////////////////////////

const hutTop = [320, 160]
const hutBaseY = 330

draw(
  rc.path(`
    M245 ${hutBaseY}
    C265 255, 295 190, ${hutTop[0]} ${hutTop[1]}
    C345 190, 380 255, 400 ${hutBaseY}
    M245 ${hutBaseY}
    C290 350, 355 350, 400 ${hutBaseY}
  `, {
    stroke: "#111",
    strokeWidth: 3,
    roughness: 1.7
  }),
  80,
  1100
)

for (let x of [258,272,286,300,314,328,342,356,370,384]) {
  draw(
    rc.line(hutTop[0], hutTop[1], x, hutBaseY, {
      stroke: "#111",
      strokeWidth: 1.15,
      roughness: 2.1
    }),
    35,
    650
  )
}

for (let x of [266,286,306,334,354,374]) {
  draw(
    rc.line(x, hutBaseY, x, 365, {
      stroke: "#111",
      strokeWidth: 1.7,
      roughness: 1.8
    }),
    40,
    650
  )
}

draw(
  rc.path(`
    M306 365
    C306 340, 334 340, 334 365
  `, {
    stroke: "#111",
    strokeWidth: 3,
    roughness: 1.5
  }),
  60,
  700
)

draw(
  rc.path(`
    M255 340
    C295 350, 360 350, 405 340
  `, {
    stroke: "rgba(0,0,0,.30)",
    strokeWidth: 1,
    roughness: 2.8
  }),
  60,
  700
)

////////////////////////////////////////////////
// Flèche faîtière kanak
////////////////////////////////////////////////

const fx = 320

draw(
  rc.line(fx, 60, fx, 196, {
    stroke: "#111",
    strokeWidth: 2.4,
    roughness: 1.1
  }),
  70,
  850
)

draw(
  rc.path(`
    M${fx} 42
    C${fx-5} 55, ${fx-4} 67, ${fx} 78
    C${fx+4} 67, ${fx+5} 55, ${fx} 42
  `, {
    stroke: "#111",
    strokeWidth: 2,
    fill: "none",
    roughness: 1.2
  }),
  60,
  800
)

for (const [cy, w, h] of [
  [88, 18, 16],
  [108, 25, 10],
  [124, 21, 13],
  [142, 29, 9],
  [158, 22, 13]
]) {
  draw(
    rc.ellipse(fx, cy, w, h, {
      stroke: "#111",
      strokeWidth: 2,
      fill: "none",
      roughness: 1.4
    }),
    50,
    650
  )
}

for (const y of [101, 116, 135, 151]) {
  draw(
    rc.line(fx - 22, y, fx + 22, y, {
      stroke: "#111",
      strokeWidth: 1.4,
      roughness: 1.6
    }),
    35,
    500
  )
}

draw(
  rc.path(`
    M${fx-13} 170
    C${fx-8} 184, ${fx-4} 192, ${fx} 198
    C${fx+4} 192, ${fx+8} 184, ${fx+13} 170
  `, {
    stroke: "#111",
    strokeWidth: 1.8,
    fill: "none",
    roughness: 1.5
  }),
  60,
  700
)

////////////////////////////////////////////////
// Stats dans l'hexagone
////////////////////////////////////////////////

draw(
  rc.path(`
    M340 155
    L375 160
    L405 182
    L435 145
    L465 168
  `, {
    stroke: "#2f6b45",
    strokeWidth: 2.2,
    roughness: 1.4
  }),
  70,
  900
)

for (const [x, y, c] of [
  [350,185,"#2f6b45"],
  [375,160,"#2f6b45"],
  [405,182,"#d6a21f"],
  [435,145,"#d6a21f"],
  [465,168,"#c54832"]
]) {
  draw(
    rc.circle(x, y, 8, {
      stroke: "#111",
      strokeWidth: 1,
      fill: c,
      fillStyle: "solid",
      roughness: 1.2
    }),
    45,
    550
  )
}

for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    draw(
      rc.circle(415 + col * 20, 190 + row * 20, 5, {
        stroke: "#111",
        strokeWidth: 0.9,
        fill: ["#2f6b45", "#d6a21f", "#c54832", "#111"][(row + col) % 4],
        fillStyle: "solid",
        roughness: 1.2
      }),
      25,
      400
    )
  }
}

////////////////////////////////////////////////
// Texte dans l'hexagone
////////////////////////////////////////////////

const innerTitle = svg.append("text")
  .attr("x", 165)
  .attr("y", 392)
  .attr("font-family", "Cabin Sketch")
  .attr("font-weight", 700)
  .attr("font-size", 48)
  .attr("letter-spacing", "0.02em")
  .attr("fill", "#1f1f1f")
  .style("text-shadow", `
    0.22px 0.22px 0 #111,
    -0.22px -0.22px 0 #111,
    0 0 1px rgba(0,0,0,.25)
  `)
  .text(innerTitleLabel)

fadeText(innerTitle, 150, 900)

for (let i = 0; i < 4; i++) {
  draw(
    rc.line(178 + i * 54, 416, 220 + i * 54, 416, {
      stroke: palette[i],
      strokeWidth: 4.5,
      roughness: 1.5
    }),
    45,
    650
  )
}

////////////////////////////////////////////////
// Titre principal
////////////////////////////////////////////////

const title = svg.append("text")
  .attr("x", 560)
  .attr("y", 170)
  .attr("font-size", 95)
  .attr("font-family", "Cabin Sketch")
  .attr("font-weight", 700)
  .attr("letter-spacing", "0.012em")
  .attr("fill", "#1f1f1f")
  .style("text-shadow", `
    0.25px 0.25px 0 #111,
    -0.25px -0.25px 0 #111,
    0 0 1px rgba(0,0,0,.28)
  `)
  .text(mainTitle)

fadeText(title, 200, 1200)

////////////////////////////////////////////////
// Ligne couleurs
////////////////////////////////////////////////

for (let i = 0; i < 4; i++) {
  draw(
    rc.line(585 + i * 115, 210, 675 + i * 115, 210, {
      stroke: palette[i],
      strokeWidth: 8,
      roughness: 1.4
    }),
    75,
    850
  )
}

////////////////////////////////////////////////
// Sous-titre
////////////////////////////////////////////////

const subtitles = svg.selectAll(".subtitle")
  .data(subtitleLines)
  .enter()
  .append("text")
  .attr("class", "subtitle")
  .attr("x", d => d.x)
  .attr("y", d => d.y)
  .attr("font-family", "Cabin Sketch")
  .attr("font-weight", 700)
  .attr("font-size", d => d.fontSize)
  .attr("letter-spacing", "0.012em")
  .attr("text-anchor", d => d.anchor)
  .attr("fill", "#1f1f1f")
  .style("text-shadow", `
    0.18px 0.18px 0 #111,
    -0.18px -0.18px 0 #111,
    0 0 1px rgba(0,0,0,.20)
  `)
  .text(d => d.text)

fadeText(subtitles, 200, 900)

////////////////////////////////////////////////
// Pastilles thématiques
////////////////////////////////////////////////

function themeBadge(cx, cy, tx, color, label1, label2, kind) {
  draw(
    rc.circle(cx, cy, 58, {
      stroke: "#111",
      strokeWidth: 1.8,
      fill: color,
      fillStyle: "hachure",
      roughness: 1.6
    }),
    60,
    850
  )
if (kind === "people") {

  // tête
  draw(
    rc.circle(cx, cy - 10, 18, {
      stroke:"#111",
      strokeWidth:1.7,
      fill:"#f7f1e3",
      fillStyle:"solid",
      roughness:1.4
    }),
    35,
    500
  )

  // épaules / buste
  draw(
    rc.path(`
      M${cx-20} ${cy+18}
      C${cx-15} ${cy+3},
       ${cx+15} ${cy+3},
       ${cx+20} ${cy+18}
    `,{
      stroke:"#111",
      strokeWidth:1.8,
      roughness:1.5
    }),
    35,
    500
  )
}

  if (kind === "bars") {
    draw(
      rc.path(`
        M${cx-28} ${cy+28}
        L${cx+28} ${cy+28}
        M${cx-28} ${cy-24}
        L${cx-28} ${cy+28}
      `, {
        stroke:"#111",
        strokeWidth:1.3,
        roughness:1.2
      }),
      40,
      600
    )

    for (let i = 0; i < 4; i++) {
      const h = 16 + i * 8
      draw(
        rc.rectangle(
          cx - 20 + i * 12,
          cy + 28 - h,
          8,
          h,
          {
            stroke:"#111",
            strokeWidth:1.3,
            fill:"#f7f1e3",
            fillStyle:"solid",
            roughness:1.2
          }
        ),
        35,
        500
      )
    }
  }

  if (kind === "line") {
    draw(
      rc.path(`
        M${cx-30} ${cy+16}
        L${cx-12} ${cy-5}
        L${cx+4} ${cy+8}
        L${cx+22} ${cy-20}
        L${cx+34} ${cy-5}
      `, {
        stroke:"#111",
        strokeWidth:2,
        roughness:1.3
      }),
      40,
      600
    )

    for (const [dx, dy] of [[-30,16],[-12,-5],[4,8],[22,-20],[34,-5]]) {
      draw(
        rc.circle(cx + dx, cy + dy, 7, {
          stroke:"#111",
          fill:"#f7f1e3",
          fillStyle:"solid"
        }),
        40,
        450
      )
    }
  }

  const t1 = svg.append("text")
    .attr("x", tx)
    .attr("y", cy - 7)
    .attr("font-family", "Cabin Sketch")
    .attr("font-size", 20)
    .attr("font-weight", 700)
    .attr("fill", "#1f1f1f")
    .text(label1)

  const t2 = svg.append("text")
    .attr("x", tx)
    .attr("y", cy + 23)
    .attr("font-family", "Cabin Sketch")
    .attr("font-size", 20)
    .attr("font-weight", 700)
    .attr("fill", "#1f1f1f")
    .text(label2)

  fadeText(t1, 60, 650)
  fadeText(t2, 20, 650)
}

if (showThemeBadges) {
  themeBadge(535, 365, 590, "#2f6b45", "Territoires", "et sociétés", "people")

  draw(rc.line(710, 328, 710, 402, {
    stroke: "#111",
    strokeWidth: 1,
    roughness: 1.2
  }), 60, 650)

  themeBadge(765, 365, 820, "#d6a21f", "Données", "et analyses", "bars")

  draw(rc.line(935, 328, 935, 402, {
    stroke: "#111",
    strokeWidth: 1,
    roughness: 1.2
  }), 60, 650)

  themeBadge(990, 365, 1045, "#c54832", "Cartes", "et graphiques", "line")
}

////////////////////////////////////////////////
// Frises haut/bas
////////////////////////////////////////////////

for (const y of [28, height - 28]) {
  draw(
    rc.line(80, y, 1320, y, {
      stroke: "#111",
      strokeWidth: 1.5,
      roughness: 1.2
    }),
    30,
    800
  )

  for (let x = 90; x < 1300; x += 34) {
    draw(
      rc.polygon(
        [
          [x, y],
          [x + 16, y + (y < 100 ? 18 : -18)],
          [x + 32, y]
        ],
        {
          stroke: "#111",
          strokeWidth: 1.1,
          fill: ["#455d44", "#e0ab1e", "#c54832"][Math.floor(x / 34) % 3],
          fillStyle: "hachure",
          roughness: 1.4
        }
      ),
      8,
      350
    )
  }
}

  container.appendChild(svg.node())
  return svg.node()
}

export const renderContoursSketch = renderContoursBanner
export function renderContoursSectionBanner(target, options = {}) {
  return renderContoursBanner(target, {
    showThemeBadges: false,
    ...options
  })
}
export default renderContoursBanner
