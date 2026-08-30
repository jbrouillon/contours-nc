import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

const mobileLite = window.matchMedia(
  "(max-width: 760px), (pointer: coarse) and (max-width: 1024px)"
).matches;

if (mobileLite) {
  const LAND_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

  try {
    const landTopo = await d3.json(LAND_URL);
    const land = landTopo?.objects?.land
      ? topojson.feature(landTopo, landTopo.objects.land)
      : null;

    if (land) {
      const applyLand = () => {
        const svg = d3.select("#climate-map .map-svg");
        if (svg.empty()) return false;

        const worldLand = svg.select(".world-land");
        const worldLandHatch = svg.select(".world-land-hatch");
        if (worldLand.empty()) return false;

        // Reuse the exact orthographic projection used by the main map.
        // On mobile the globe is not draggable, so the initial rotation is stable.
        const projection = d3.geoOrthographic()
          .rotate([-172, 8, 0])
          .scale(330)
          .translate([455, 348])
          .clipAngle(90)
          .precision(1.15);

        const path = d3.geoPath(projection);

        worldLand.datum(land).attr("d", path);

        if (!worldLandHatch.empty()) {
          worldLandHatch.datum(land).attr("d", path);
        }

        return true;
      };

      // The main module builds and updates the SVG asynchronously.
      // Keep reapplying the lightweight land geometry briefly so its later
      // render passes cannot replace it with the empty mobile FeatureCollection.
      let frames = 0;
      const keepLandAlive = () => {
        applyLand();
        frames += 1;
        if (frames < 180) requestAnimationFrame(keepLandAlive);
      };
      requestAnimationFrame(keepLandAlive);

      // Also reapply after DOM/SVG mutations (chapter/year updates, initial render).
      const root = document.querySelector("#climate-map");
      if (root) {
        const observer = new MutationObserver(() => applyLand());
        observer.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["d", "class"]
        });

        // No need to keep observing forever: mobile has no globe drag.
        setTimeout(() => observer.disconnect(), 10000);
      }
    }
  } catch (error) {
    console.warn("Mobile territory land layer unavailable.", error);
  }
}
