import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateLeaderboard,
  communitySeries,
  leaderboardPeriod,
  normalizeHandle,
  utcDailyTotals,
} from "../global/periods.js";

test("weekly leaderboard period starts Monday and ends Sunday in UTC", () => {
  const period = leaderboardPeriod("weekly", Date.parse("2026-07-19T18:00:00Z"));
  assert.equal(period.startKey, "2026-07-13");
  assert.equal(period.endKey, "2026-07-19");
});

test("monthly leaderboard uses a calendar month, not a rolling month", () => {
  const period = leaderboardPeriod("monthly", Date.parse("2026-07-19T18:00:00Z"));
  assert.equal(period.startKey, "2026-07-01");
  assert.equal(period.endKey, "2026-07-31");
});

test("yearly leaderboard uses a calendar year", () => {
  const period = leaderboardPeriod("yearly", Date.parse("2026-07-19T18:00:00Z"));
  assert.equal(period.startKey, "2026-01-01");
  assert.equal(period.endKey, "2026-12-31");
});

test("UTC daily totals split a visit at UTC midnight", () => {
  const sessions = [{
    id: "cross-midnight",
    s: Date.parse("2026-07-18T23:50:00Z"),
    e: Date.parse("2026-07-19T00:20:00Z"),
  }];
  const rows = utcDailyTotals(sessions, Date.parse("2026-07-19T10:00:00Z"), 2);
  assert.deepEqual(rows.map((row) => row.durationMs), [600_000, 1_200_000]);
});

test("leaderboard sums selected days and ranks ties by handle", () => {
  const profiles = [
    { publicId: "b", handleLower: "zoe", handle: "Zoe", consentVersion: "v" },
    { publicId: "a", handleLower: "ada", handle: "Ada", consentVersion: "v" },
  ];
  const rows = [
    { publicId: "b", date: "2026-07-19", durationMs: 60_000 },
    { publicId: "a", date: "2026-07-19", durationMs: 60_000 },
    { publicId: "a", date: "2026-06-01", durationMs: 999_000 },
  ];
  const period = leaderboardPeriod("daily", Date.parse("2026-07-19T10:00:00Z"));
  const result = aggregateLeaderboard(profiles, rows, period, "a");
  assert.deepEqual(result.map((row) => [row.rank, row.handle, row.isCurrentUser]), [
    [1, "Ada", true],
    [2, "Zoe", false],
  ]);
});

test("consenting profiles remain visible before their first synced total", () => {
  const profiles = [
    { publicId: "a", handleLower: "ada", handle: "Ada", consentVersion: "v", public: true },
    { publicId: "b", handleLower: "bea", handle: "Bea", consentVersion: "v", public: true },
    { publicId: "c", handleLower: "cy", handle: "Cy", consentVersion: "v", public: false },
  ];
  const period = leaderboardPeriod("daily", Date.parse("2026-07-19T10:00:00Z"));
  const result = aggregateLeaderboard(profiles, [
    { publicId: "b", date: "2026-07-19", durationMs: 60_000 },
  ], period, "a");
  assert.deepEqual(result.map((row) => [row.rank, row.handle, row.durationMs]), [
    [1, "Bea", 60_000],
    [2, "Ada", 0],
  ]);
});

test("X handles are normalized and validated", () => {
  assert.equal(normalizeHandle("  @OpenAI  "), "OpenAI");
  assert.equal(normalizeHandle("not-valid!"), null);
  assert.equal(normalizeHandle("abcdefghijklmnop"), null);
});

test("community series combines all participants by month for yearly charts", () => {
  const period = leaderboardPeriod("yearly", Date.parse("2026-07-19T18:00:00Z"));
  const result = communitySeries([
    { date: "2026-01-02", durationMs: 1000 },
    { date: "2026-01-03", durationMs: 2000 },
    { date: "2026-02-01", durationMs: 4000 },
  ], period);
  assert.deepEqual(result.map(({ key, durationMs }) => [key, durationMs]), [["2026-01", 3000], ["2026-02", 4000]]);
});
