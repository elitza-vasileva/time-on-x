import fs from "node:fs";

const [profileUrl] = process.argv.slice(2);
let parsed;
try { parsed = new URL(profileUrl); } catch { throw new Error("Usage: npm run configure:profile -- https://YOUR-WORKER.example/profile"); }
if (parsed.protocol !== "https:") throw new Error("The profile endpoint must use HTTPS.");

const configPath = "global/config.js";
let config = fs.readFileSync(configPath, "utf8");
const previousUrl = config.match(/export const PROFILE_LOOKUP_URL = "(.*?)";/)?.[1] || "";
const previousOrigin = previousUrl ? new URL(previousUrl).origin : "";
config = config.replace(/export const PROFILE_LOOKUP_URL = ".*?";/, `export const PROFILE_LOOKUP_URL = "${parsed.toString()}";`);
fs.writeFileSync(configPath, config);

const manifestPath = "manifest.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.host_permissions = manifest.host_permissions.filter((value) => value !== `${previousOrigin}/*`);
if (!manifest.host_permissions.includes(`${parsed.origin}/*`)) manifest.host_permissions.push(`${parsed.origin}/*`);
let csp = manifest.content_security_policy.extension_pages;
if (previousOrigin) csp = csp.replace(`${previousOrigin} `, "");
if (!csp.includes(`${parsed.origin} `)) csp = csp.replace("connect-src 'self'", `connect-src 'self' ${parsed.origin}`);
manifest.content_security_policy.extension_pages = csp;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Configured profile lookup at ${parsed.toString()}.`);
