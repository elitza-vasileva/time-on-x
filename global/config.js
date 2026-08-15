// Public client configuration. The InstantDB app ID is safe to ship in the
// extension; permissions in instant.perms.ts protect writes. Never place an
// Instant admin token in this file.
export const INSTANT_APP_ID = "98a6542b-b4c9-4a76-81b0-d4bc03e95de7";

// ScrapeCreators requests are proxied through the website so the API key never
// enters the extension. Configure the key and allowed extension origin in Vercel.
export const PROFILE_LOOKUP_URL = "https://timeonx.com/api/profile";

export const CONSENT_VERSION = "2026-07-22-v2";

export function isGlobalLeaderboardConfigured() {
  return /^[0-9a-f-]{36}$/i.test(INSTANT_APP_ID);
}
