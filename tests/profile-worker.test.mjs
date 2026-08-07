import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfilePayload } from "../server/profile-worker.js";

test("ScrapeCreators profile data is reduced to safe public fields", () => {
  assert.deepEqual(normalizeProfilePayload({
    rest_id: "221838349",
    legacy: {
      name: "Austen Allred",
      screen_name: "Austen",
      profile_image_url_https: "https://pbs.twimg.com/profile_images/1/avatar_normal.jpg",
    },
  }, "fallback"), {
    handle: "Austen",
    displayName: "Austen Allred",
    avatarUrl: "https://pbs.twimg.com/profile_images/1/avatar_normal.jpg",
    xUserId: "221838349",
  });
});

test("profile normalization rejects invalid handles and non-X avatar hosts", () => {
  assert.equal(normalizeProfilePayload({ legacy: { screen_name: "bad!" } }, "fallback"), null);
  assert.equal(normalizeProfilePayload({ legacy: { screen_name: "valid", profile_image_url_https: "https://example.com/avatar.png" } }, "fallback").avatarUrl, "");
});
