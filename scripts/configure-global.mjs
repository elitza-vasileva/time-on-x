import fs from "node:fs";

const [appId] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(appId || "")) {
  throw new Error("Usage: node scripts/configure-global.mjs <instant-app-uuid>");
}

const configPath = "global/config.js";
const config = fs.readFileSync(configPath, "utf8")
  .replace(/export const INSTANT_APP_ID = ".*?";/, `export const INSTANT_APP_ID = "${appId}";`);
fs.writeFileSync(configPath, config);
console.log(`Configured InstantDB app ${appId}. Run npm run package next.`);
