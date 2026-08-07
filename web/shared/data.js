const DAY_MS = 86_400_000;

export function utcKey(value = Date.now()) {
  return new Date(value).toISOString().slice(0, 10);
}

export function completeDailySeries(rows, start, count) {
  const totals = new Map(
    (rows || []).map((row) => [row.date, Math.max(0, Number(row.durationMs) || 0)]),
  );
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * DAY_MS);
    const key = utcKey(date);
    return { key, date, durationMs: totals.get(key) || 0 };
  });
}

export function recentDailySeries(rows, count = 30, now = Date.now()) {
  const today = Date.parse(`${utcKey(now)}T00:00:00Z`);
  return completeDailySeries(rows, today - (count - 1) * DAY_MS, count);
}

export function dashboardSummary(rows, now = Date.now()) {
  const date = new Date(now);
  const todayKey = utcKey(now);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const weekStart = utcKey(Date.parse(`${todayKey}T00:00:00Z`) - mondayOffset * DAY_MS);
  const monthStart = `${todayKey.slice(0, 7)}-01`;
  const yearStart = `${todayKey.slice(0, 4)}-01-01`;
  const total = (start) => (rows || []).reduce(
    (sum, row) => sum + (row.date >= start && row.date <= todayKey ? Math.max(0, Number(row.durationMs) || 0) : 0),
    0,
  );
  return {
    today: total(todayKey),
    week: total(weekStart),
    month: total(monthStart),
    year: total(yearStart),
  };
}

export function yearHeatmap(rows, year = new Date().getUTCFullYear()) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return completeDailySeries(rows, start, Math.round((end - start) / DAY_MS));
}

export function formatCompactDuration(milliseconds) {
  const totalMinutes = Math.max(0, Math.round(Number(milliseconds || 0) / 60_000));
  if (totalMinutes < 1) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function periodDailySeries(rows, period) {
  if (period.type === "yearly") {
    const totals = new Map();
    for (const row of rows || []) {
      if (row.date < period.startKey || row.date > period.endKey) continue;
      const key = row.date.slice(0, 7);
      totals.set(key, (totals.get(key) || 0) + Math.max(0, Number(row.durationMs) || 0));
    }
    return Array.from({ length: 12 }, (_, month) => {
      const date = new Date(Date.UTC(new Date(period.start).getUTCFullYear(), month, 1));
      const key = date.toISOString().slice(0, 7);
      return {
        key,
        label: date.toLocaleDateString(undefined, { timeZone: "UTC", month: "short" }),
        durationMs: totals.get(key) || 0,
      };
    });
  }

  const count = Math.round((period.end - period.start) / DAY_MS);
  return completeDailySeries(rows, period.start, count).map((item) => ({
    ...item,
    label: period.type === "daily"
      ? "Today"
      : item.date.toLocaleDateString(undefined, {
          timeZone: "UTC",
          weekday: period.type === "weekly" ? "short" : undefined,
          day: period.type === "monthly" ? "numeric" : undefined,
        }),
  }));
}
