import test from "node:test";
import assert from "node:assert/strict";
import {
  activeDayExtremes,
  dashboardSummary,
  formatCompactDuration,
  payoutPeriodStats,
  pearsonCorrelation,
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

test("activeDayExtremes ignores zero days and returns dates with the highest and lowest activity", () => {
  const now = Date.UTC(2026, 7, 3, 12);
  const result = activeDayExtremes([
    { date: "2026-08-01", durationMs: 30_000 },
    { date: "2026-08-02", durationMs: 10_000 },
  ], 4, now);
  assert.equal(result.highest.key, "2026-08-01");
  assert.equal(result.lowest.key, "2026-08-02");
});

test("payoutPeriodStats uses an exclusive end date so adjacent periods do not overlap", () => {
  const stats = payoutPeriodStats([
    { date: "2026-07-17", durationMs: 1_000 },
    { date: "2026-07-18", durationMs: 2_000 },
    { date: "2026-08-01", durationMs: 4_000 },
  ], [
    { id: "a", startDate: "2026-06-20", endDate: "2026-07-18", amountCents: 6244 },
    { id: "b", startDate: "2026-07-18", endDate: "2026-08-01", amountCents: 8872 },
  ]);
  assert.deepEqual(stats.map((item) => item.durationMs), [1_000, 2_000]);
  assert.deepEqual(stats.map((item) => item.amount), [62.44, 88.72]);
  assert.deepEqual(stats.map((item) => item.isPartial), [true, false]);
});

test("pearsonCorrelation reports positive, negative, and insufficient series", () => {
  assert.equal(pearsonCorrelation([{ x: 1, y: 2 }]), null);
  assert.equal(pearsonCorrelation([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]), 1);
  assert.equal(pearsonCorrelation([{ x: 1, y: 6 }, { x: 2, y: 4 }, { x: 3, y: 2 }]), -1);
});
