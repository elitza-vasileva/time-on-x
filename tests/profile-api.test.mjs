import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../api/profile.js";

function withProfileEnvironment(t) {
  const previousKey = process.env.SCRAPECREATORS_API_KEY;
  const previousOrigins = process.env.PROFILE_ALLOWED_ORIGINS;
  process.env.SCRAPECREATORS_API_KEY = "test-secret";
  process.env.PROFILE_ALLOWED_ORIGINS = "chrome-extension://allowedextension";
  t.after(() => {
    if (previousKey === undefined) delete process.env.SCRAPECREATORS_API_KEY;
    else process.env.SCRAPECREATORS_API_KEY = previousKey;
    if (previousOrigins === undefined) delete process.env.PROFILE_ALLOWED_ORIGINS;
    else process.env.PROFILE_ALLOWED_ORIGINS = previousOrigins;
  });
}

test("profile endpoint accepts only configured extension origins", async (t) => {
  withProfileEnvironment(t);
  const response = await GET(new Request("https://timeonx.com/api/profile?handle=OpenAI", {
    headers: { Origin: "chrome-extension://differentextension" },
  }));
  assert.equal(response.status, 403);
});

test("profile endpoint sends only the normalized handle and returns safe public fields", async (t) => {
  withProfileEnvironment(t);
  const previousFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (request) => {
    upstreamRequest = request;
    return Response.json({
      rest_id: "123456789",
      legacy: {
        name: "OpenAI",
        screen_name: "OpenAI",
        profile_image_url_https: "https://pbs.twimg.com/profile_images/1/avatar_normal.jpg",
      },
    });
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const response = await GET(new Request("https://timeonx.com/api/profile?handle=https%3A%2F%2Fx.com%2FOpenAI", {
    headers: { Origin: "chrome-extension://allowedextension" },
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(new URL(upstreamRequest).searchParams.get("handle"), "OpenAI");
  assert.equal(new URL(upstreamRequest).searchParams.get("cache_max_age"), "7d");
  assert.deepEqual(body, {
    handle: "OpenAI",
    displayName: "OpenAI",
    avatarUrl: "https://pbs.twimg.com/profile_images/1/avatar_normal.jpg",
    xUserId: "123456789",
  });
});
