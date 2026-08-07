import { build } from "esbuild";

await build({
  entryPoints: ["global/instant-runtime-entry.js"],
  bundle: true,
  format: "esm",
  outfile: "global/instant-runtime.js",
  platform: "browser",
  target: "chrome120",
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

console.log("Built global/instant-runtime.js");
