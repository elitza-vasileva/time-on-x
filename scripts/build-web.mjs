import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "web");
const output = resolve(root, "web-dist");

// Vercel builds from a clean checkout, so generate the InstantDB browser
// runtime before bundling website entry points that import it.
await build({
  entryPoints: [resolve(root, "global", "instant-runtime-entry.js")],
  bundle: true,
  format: "esm",
  outfile: resolve(root, "global", "instant-runtime.js"),
  platform: "browser",
  target: "chrome120",
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "assets"), { recursive: true });
await mkdir(resolve(output, "rankings"), { recursive: true });
await mkdir(resolve(output, "dashboard"), { recursive: true });
await mkdir(resolve(output, "privacy"), { recursive: true });

await build({
  entryPoints: {
    analytics: resolve(source, "shared", "analytics.js"),
    landing: resolve(source, "landing.js"),
    rankings: resolve(source, "rankings.js"),
    dashboard: resolve(source, "dashboard.js"),
  },
  bundle: true,
  format: "esm",
  outdir: resolve(output, "assets"),
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

await Promise.all([
  cp(resolve(source, "index.html"), resolve(output, "index.html")),
  cp(resolve(source, "rankings.html"), resolve(output, "rankings", "index.html")),
  cp(resolve(source, "dashboard.html"), resolve(output, "dashboard", "index.html")),
  cp(resolve(source, "privacy.html"), resolve(output, "privacy", "index.html")),
  cp(resolve(source, "site.css"), resolve(output, "assets", "site.css")),
  cp(resolve(root, "icons", "icon-128.png"), resolve(output, "assets", "icon.png")),
]);

console.log(`Built web app in ${output}`);
