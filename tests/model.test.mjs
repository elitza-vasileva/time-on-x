import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultStore,
  coalesceSessions,
  expireIfIdle,
  normalizeStore,
  startSession,
  extendSession,
  stopSession,
} from "../lib/model.js";

test("a session extends while its activity window is valid", () => {
  const store = createDefaultStore();
  startSession(store, { tabId: 4, windowId: 2 }, 1_000);
  store.tracking.lastActivityAt = 20_000;
  extendSession(store, 50_000);
  assert.equal(store.sessions[0].s, 1_000);
  assert.equal(store.sessions[0].e, 50_000);
});

test("session extension is capped at the inactivity timeout", () => {
  const store = createDefaultStore();
  startSession(store, { tabId: 4, windowId: 2 }, 1_000);
  extendSession(store, 120_000);
  assert.equal(store.sessions[0].e, 61_000);
});

test("idle expiry finalizes tracking at the exact timeout", () => {
  const store = createDefaultStore();
  startSession(store, { tabId: 4, windowId: 2 }, 10_000);
  assert.equal(expireIfIdle(store, 69_999), false);
  assert.equal(expireIfIdle(store, 70_000), true);
  assert.equal(store.tracking, null);
  assert.equal(store.sessions[0].e, 70_000);
});

test("zero-length sessions are removed when stopped", () => {
  const store = createDefaultStore();
  startSession(store, { tabId: 4, windowId: 2 }, 10_000);
  stopSession(store, 10_000);
  assert.equal(store.sessions.length, 0);
});

test("normalizeStore rejects malformed sessions and settings", () => {
  const store = normalizeStore({
    sessions: [
      { id: "good", s: 1, e: 2 },
      { id: "bad", s: 5, e: 2 },
    ],
    settings: { idleTimeoutSeconds: 17 },
  });
  assert.equal(store.sessions.length, 1);
  assert.equal(store.settings.idleTimeoutSeconds, 60);
  assert.equal(store.settings.theme, "system");
});

test("version 1 worker-wake fragments are repaired without merging real breaks", () => {
  const repaired = coalesceSessions([
    { id: "a", s: 1_000, e: 5_000 },
    { id: "b", s: 5_400, e: 9_000 },
    { id: "c", s: 12_000, e: 15_000 },
  ]);
  assert.deepEqual(repaired.map(({ s, e }) => ({ s, e })), [
    { s: 1_000, e: 9_000 },
    { s: 12_000, e: 15_000 },
  ]);
});

test("normalizing a version 1 store coalesces historical worker fragments", () => {
  const store = normalizeStore({
    version: 1,
    sessions: [
      { id: "a", s: 1_000, e: 5_000 },
      { id: "b", s: 5_100, e: 8_000 },
    ],
    settings: { idleTimeoutSeconds: 60 },
  });
  assert.equal(store.version, 3);
  assert.equal(store.sessions.length, 1);
  assert.equal(store.sessions[0].e - store.sessions[0].s, 7_000);
});

test("theme preferences survive normalization and invalid values fall back", () => {
  assert.equal(normalizeStore({ settings: { theme: "dark" } }).settings.theme, "dark");
  assert.equal(normalizeStore({ settings: { theme: "neon" } }).settings.theme, "system");
});
