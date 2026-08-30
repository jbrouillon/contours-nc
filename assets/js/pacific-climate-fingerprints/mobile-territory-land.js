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
      const projection = d3.geoOrthographic()
        .rotate([-172, 8, 0])
        .scale(330)
        .translate([455, 348])
        .clipAngle(90)
        .precision(1.15);

      const path = d3.geoPath(projection);

      const applyLand = () => {
        const svg = d3.select("#climate-map .map-svg");
        if (svg.empty()) {
          requestAnimationFrame(applyLand);
          return;
        }

        const worldLand = svg.select(".world-land");
        const worldLandHatch = svg.select(".world-land-hatch");

        if (worldLand.empty()) {
          requestAnimationFrame(applyLand);
          return;
        }

        worldLand.datum(land).attr("d", path);

        if (!worldLandHatch.empty()) {
          worldLandHatch.datum(land).attr("d", path);
        }
      };

      applyLand();
    }
  } catch (error) {
    console.warn("Mobile territory land layer unavailable.", error);
  }
}
