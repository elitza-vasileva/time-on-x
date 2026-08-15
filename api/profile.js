import { normalizeHandle } from "../global/periods.js";
import { normalizeProfilePayload } from "../server/profile-worker.js";

function allowedOrigins() {
  return String(process.env.PROFILE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(origin, cache = false) {
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": cache ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" : "no-store",
    "Vary": "Origin",
  };
}

function json(body, status, origin, cache = false) {
  return Response.json(body, { status, headers: corsHeaders(origin, cache) });
}

export function OPTIONS(request) {
  const origin = request.headers.get("Origin") || "";
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request) {
  const origin = request.headers.get("Origin") || "";
  const cors = corsHeaders(origin);
  if (!process.env.SCRAPECREATORS_API_KEY || !allowedOrigins().length) {
    return json({ error: "Profile lookup is not configured." }, 503, origin);
  }
  if (cors["Access-Control-Allow-Origin"] === "null") {
    return json({ error: "Origin not allowed." }, 403, origin);
  }

  const handle = normalizeHandle(new URL(request.url).searchParams.get("handle"));
  if (!handle) return json({ error: "Enter a valid X handle or profile link." }, 400, origin);

  const upstreamUrl = new URL("https://api.scrapecreators.com/v1/twitter/profile");
  upstreamUrl.searchParams.set("handle", handle);
  upstreamUrl.searchParams.set("cache_max_age", "7d");
  const upstream = await fetch(upstreamUrl, {
    headers: { "x-api-key": process.env.SCRAPECREATORS_API_KEY },
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = upstream.status === 404 ? "That X profile was not found." : "The X profile service is temporarily unavailable.";
    return json({ error: message }, upstream.status === 404 ? 404 : 502, origin);
  }

  const profile = normalizeProfilePayload(data, handle);
  if (!profile) return json({ error: "The returned X profile was invalid." }, 502, origin);
  return json(profile, 200, origin, true);
}
