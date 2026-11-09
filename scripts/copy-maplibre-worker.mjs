// MapLibre resolves its web worker next to its own module URL, which bundlers break.
// Serve the worker from /maplibre/ instead; copied here so it always matches the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
