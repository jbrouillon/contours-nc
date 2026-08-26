const repositoryRoot = new URL("../../", import.meta.url);
const pageUrl = new URL("docs/posts/pacific-climate-fingerprints/index.html", repositoryRoot);
const page = await Deno.readTextFile(pageUrl);

const fail = message => {
  throw new Error(message);
};

const exists = async url => {
  try {
    await Deno.stat(url);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};

const resolveReference = reference => {
  const url = reference.startsWith("/")
    ? new URL(`docs${reference}`, repositoryRoot)
    : new URL(reference, pageUrl);
  if (url.protocol !== "file:") return url;
  const finalSegment = url.pathname.split("/").at(-1);
  return finalSegment?.includes(".") ? url : new URL(`${url.href.replace(/\/$/, "")}/index.html`);
};

const localReferences = [...page.matchAll(/\b(?:href|src)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(reference => !reference.startsWith("#"))
  .map(reference => reference.split("#", 1)[0].split("?", 1)[0])
  .filter(Boolean)
  .map(resolveReference)
  .filter(url => url.protocol === "file:");

const missingReferences = [];
for (const url of new Map(localReferences.map(item => [item.href, item])).values()) {
  if (!await exists(url)) missingReferences.push(url.href);
}
if (missingReferences.length) {
  fail(`Missing local page resources:\n${missingReferences.join("\n")}`);
}

if (!/<meta name="robots" content="noindex, nofollow">/.test(page)) {
  fail("The unpublished page is missing its noindex, nofollow directive");
}
if (!/<meta name="quarto:status" content="draft">/.test(page)) {
  fail("The generated page is not marked as a Quarto draft");
}

const publicIndexes = [
  "docs/index.html",
  "docs/index.xml",
  "docs/listings.json",
  "docs/search.json",
  "docs/sitemap.xml"
];
for (const path of publicIndexes) {
  const content = await Deno.readTextFile(new URL(path, repositoryRoot));
  if (content.includes("posts/pacific-climate-fingerprints")) {
    fail(`The unpublished page is referenced by ${path}`);
  }
}

const publicationFiles = [
  "assets/css/pacific-climate-fingerprints.css",
  "assets/js/pacific-climate-fingerprints/climate-i18n.js",
  "assets/js/pacific-climate-fingerprints/climate-map-interactive.js",
  "assets/data/pacific-climate-fingerprints/SOURCES.md",
  "assets/data/pacific-climate-fingerprints/climate_interactive.csv",
  "assets/data/pacific-climate-fingerprints/eez.geojson",
  "assets/data/pacific-climate-fingerprints/global_context.csv",
  "assets/data/pacific-climate-fingerprints/territory_context.csv"
];

const hexDigest = async url => {
  const bytes = await Deno.readFile(url);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
};

let publishedAssetBytes = 0;
for (const sourcePath of publicationFiles) {
  const sourceUrl = new URL(sourcePath, repositoryRoot);
  const publishedPath = `docs/${sourcePath}`;
  const publishedUrl = new URL(publishedPath, repositoryRoot);
  if (!await exists(sourceUrl) || !await exists(publishedUrl)) {
    fail(`Missing source or published asset for ${sourcePath}`);
  }
  if (await hexDigest(sourceUrl) !== await hexDigest(publishedUrl)) {
    fail(`Source and docs copies differ for ${sourcePath}`);
  }
  publishedAssetBytes += (await Deno.stat(publishedUrl)).size;
}

const cname = (await Deno.readTextFile(new URL("docs/CNAME", repositoryRoot))).trim();
if (cname !== "contours.nc") fail(`Unexpected docs/CNAME value: ${cname}`);
if (!await exists(new URL("docs/.nojekyll", repositoryRoot))) fail("docs/.nojekyll is missing");

console.log(JSON.stringify({
  localReferences: new Set(localReferences.map(url => url.href)).size,
  missingReferences: missingReferences.length,
  publicationFiles: publicationFiles.length,
  publishedAssetBytes,
  unlisted: true,
  noindex: true,
  cname,
  status: "ok"
}));
