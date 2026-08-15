import { normalizeHandle } from "../global/periods.js";

function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin, env) },
  });
}

export function normalizeProfilePayload(data, fallbackHandle) {
  const legacy = data?.legacy || {};
  const canonicalHandle = normalizeHandle(legacy.screen_name || fallbackHandle);
  if (!canonicalHandle) return null;
  const avatarUrl = String(legacy.profile_image_url_https || "");
  return {
    handle: canonicalHandle,
    displayName: String(legacy.name || canonicalHandle).slice(0, 80),
    avatarUrl: /^https:\/\/pbs\.twimg\.com\//i.test(avatarUrl) ? avatarUrl : "",
    xUserId: /^\d{1,24}$/.test(String(data?.rest_id || "")) ? String(data.rest_id) : "",
  };
}

export default {
  async fetch(request, env, context) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin, env);
    if (cors["Access-Control-Allow-Origin"] === "null") return json({ error: "Origin not allowed." }, 403, origin, env);
    if (!env.SCRAPECREATORS_API_KEY) return json({ error: "Profile lookup is not configured." }, 503, origin, env);

    const input = await request.json().catch(() => ({}));
    const handle = normalizeHandle(input.handle);
    if (!handle) return json({ error: "Enter a valid X handle or profile link." }, 400, origin, env);

    const cacheKey = new Request(`https://time-on-x-profile-cache.invalid/${handle.toLowerCase()}`);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(cached.body, { status: cached.status, headers: { ...Object.fromEntries(cached.headers), ...cors } });

    const upstream = await fetch(`https://api.scrapecreators.com/v1/twitter/profile?handle=${encodeURIComponent(handle)}&cache_max_age=7d`, {
      headers: { "x-api-key": env.SCRAPECREATORS_API_KEY },
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = upstream.status === 404 ? "That X profile was not found." : "The X profile service is temporarily unavailable.";
      return json({ error: message }, upstream.status === 404 ? 404 : 502, origin, env);
    }

    const payload = normalizeProfilePayload(data, handle);
    if (!payload) return json({ error: "The returned X profile was invalid." }, 502, origin, env);
    const response = json(payload, 200, origin, env);
    const cachedResponse = new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
    context.waitUntil(cache.put(cacheKey, cachedResponse));
    return response;
  },
};
