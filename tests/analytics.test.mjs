import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyTotals,
  formatDuration,
  hourlyTotals,
  localDayBounds,
  overlapMs,
  relatableComparison,
  sessionsWithin,
  totalBetween,
  weeklyTotals,
} from "../lib/analytics.js";

test("overlapMs clips sessions to a requested range", () => {
  const session = { s: 1_000, e: 5_000 };
  assert.equal(overlapMs(session, 2_000, 4_000), 2_000);
  assert.equal(overlapMs(session, 6_000, 8_000), 0);
});

test("totalBetween sums only overlapping portions", () => {
  const sessions = [
    { s: 0, e: 2_000 },
    { s: 3_000, e: 7_000 },
  ];
  assert.equal(totalBetween(sessions, 1_000, 5_000), 3_000);
});

test("hourlyTotals splits a session across local hour boundaries", () => {
  const date = new Date(2026, 6, 18, 12);
  const session = {
    s: new Date(2026, 6, 18, 9, 45).getTime(),
    e: new Date(2026, 6, 18, 10, 15).getTime(),
  };
  const totals = hourlyTotals([session], date);
  assert.equal(totals[9], 15 * 60_000);
  assert.equal(totals[10], 15 * 60_000);
  assert.equal(totals.reduce((sum, value) => sum + value, 0), 30 * 60_000);
});

test("dailyTotals keeps a cross-midnight session in both days", () => {
  const session = {
    s: new Date(2026, 6, 17, 23, 50).getTime(),
    e: new Date(2026, 6, 18, 0, 10).getTime(),
  };
  const totals = dailyTotals([session], new Date(2026, 6, 18, 12), 2);
  assert.deepEqual(totals.map((day) => day.duration), [10 * 60_000, 10 * 60_000]);
});

test("weeklyTotals creates contiguous seven-day buckets ending on the anchor day", () => {
  const session = {
    s: new Date(2026, 6, 12, 23, 50).getTime(),
    e: new Date(2026, 6, 13, 0, 10).getTime(),
  };
  const totals = weeklyTotals([session], new Date(2026, 6, 19, 12), 2);
  assert.deepEqual(totals.map((week) => week.duration), [10 * 60_000, 10 * 60_000]);
  assert.equal(totals[0].end, totals[1].start);
  assert.equal(new Date(totals[1].end - 1).getDate(), 19);
});

test("sessionsWithin returns clipped time frames", () => {
  const bounds = localDayBounds(new Date(2026, 6, 18, 12));
  const result = sessionsWithin([
    { id: "a", s: bounds.start - 10_000, e: bounds.start + 20_000 },
  ], bounds.start, bounds.end);
  assert.equal(result[0].clippedStart, bounds.start);
  assert.equal(result[0].clippedEnd, bounds.start + 20_000);
});

test("formatDuration supports readable and compact output", () => {
  assert.equal(formatDuration(3_661_000), "1 hr 1 min");
  assert.equal(formatDuration(125_000, { compact: true }), "2m");
  assert.equal(formatDuration(8_000), "8 sec");
});

test("relatableComparison chooses a human-scale duration reference", () => {
  assert.equal(
    relatableComparison(25 * 60_000),
    "That is about as long as a Pomodoro sprint.",
  );
  assert.match(relatableComparison(4 * 60 * 60_000), /2\.0× the length of a feature-length film/);
  assert.match(relatableComparison(60_000), /of an average song/);
});
