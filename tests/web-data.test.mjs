import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardSummary,
  formatCompactDuration,
  recentDailySeries,
  yearHeatmap,
} from "../web/shared/data.js";

test("recentDailySeries fills missing UTC days", () => {
  const now = Date.UTC(2026, 7, 2, 12);
  const rows = [
    { date: "2026-07-31", durationMs: 10_000 },
    { date: "2026-08-02", durationMs: 20_000 },
  ];
  assert.deepEqual(
    recentDailySeries(rows, 4, now).map((item) => [item.key, item.durationMs]),
    [
      ["2026-07-30", 0],
      ["2026-07-31", 10_000],
      ["2026-08-01", 0],
      ["2026-08-02", 20_000],
    ],
  );
});

test("dashboardSummary uses Monday week and calendar boundaries", () => {
  const now = Date.UTC(2026, 7, 2, 12);
  const rows = [
    { date: "2025-12-31", durationMs: 1_000 },
    { date: "2026-07-26", durationMs: 2_000 },
    { date: "2026-07-27", durationMs: 3_000 },
    { date: "2026-08-01", durationMs: 4_000 },
    { date: "2026-08-02", durationMs: 5_000 },
  ];
  assert.deepEqual(dashboardSummary(rows, now), {
    today: 5_000,
    week: 12_000,
    month: 9_000,
    year: 14_000,
  });
});

test("yearHeatmap produces every UTC calendar day", () => {
  assert.equal(yearHeatmap([], 2026).length, 365);
  assert.equal(yearHeatmap([], 2028).length, 366);
});

test("formatCompactDuration produces concise dashboard labels", () => {
  assert.equal(formatCompactDuration(0), "0 min");
  assert.equal(formatCompactDuration(35 * 60_000), "35 min");
  assert.equal(formatCompactDuration(2 * 60 * 60_000), "2 hr");
  assert.equal(formatCompactDuration(2 * 60 * 60_000 + 15 * 60_000), "2 hr 15 min");
});
