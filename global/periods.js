const DAY_MS = 86_400_000;

export function utcDateKey(value = Date.now()) {
  return new Date(value).toISOString().slice(0, 10);
}

export function utcDayBounds(value = Date.now()) {
  const date = new Date(value);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return { start, end: start + DAY_MS };
}

export function leaderboardPeriod(type, value = Date.now()) {
  const date = new Date(value);
  const day = utcDayBounds(date);
  let start = day.start;
  let end = day.end;

  if (type === "weekly") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    start -= mondayOffset * DAY_MS;
    end = start + 7 * DAY_MS;
  } else if (type === "monthly") {
    start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  } else if (type === "yearly") {
    start = Date.UTC(date.getUTCFullYear(), 0, 1);
    end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  }

  return {
    type,
    start,
    end,
    startKey: utcDateKey(start),
    endKey: utcDateKey(end - 1),
    label: periodLabel(type, start, end),
  };
}

export function periodLabel(type, start, end) {
  const options = { timeZone: "UTC", month: "short", day: "numeric" };
  if (type === "daily") {
    return `${new Date(start).toLocaleDateString(undefined, {
      ...options,
      weekday: "short",
      year: "numeric",
    })} · UTC`;
  }

  const first = new Date(start).toLocaleDateString(undefined, options);
  const last = new Date(end - 1).toLocaleDateString(undefined, {
    ...options,
    year: "numeric",
  });
  return `${first} – ${last} · UTC`;
}

export function utcDailyTotals(sessions, now = Date.now(), dayCount = 3) {
  const today = utcDayBounds(now);
  const rows = [];
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const start = today.start - offset * DAY_MS;
    const end = start + DAY_MS;
    let durationMs = 0;
    for (const session of sessions) {
      durationMs += Math.max(0, Math.min(Number(session.e), end) - Math.max(Number(session.s), start));
    }
    rows.push({ date: utcDateKey(start), start, end, durationMs });
  }
  return rows;
}

export function aggregateLeaderboard(profiles, dailyTotals, period, currentPublicId = "") {
  const totalsByProfile = new Map();
  for (const row of dailyTotals) {
    if (row.date < period.startKey || row.date > period.endKey) continue;
    const duration = Math.max(0, Math.min(DAY_MS, Number(row.durationMs) || 0));
    totalsByProfile.set(row.publicId, (totalsByProfile.get(row.publicId) || 0) + duration);
  }

  return profiles
    .filter((profile) => profile.public !== false && profile.consentVersion)
    .map((profile) => ({
      ...profile,
      durationMs: totalsByProfile.get(profile.publicId) || 0,
      isCurrentUser: profile.publicId === currentPublicId,
    }))
    .sort((left, right) =>
      right.durationMs - left.durationMs ||
      String(left.handleLower).localeCompare(String(right.handleLower)),
    )
    .map((profile, index) => ({ ...profile, rank: index + 1 }));
}

export function normalizeHandle(value) {
  let handle = String(value || "").trim();
  if (!handle) return null;

  const looksLikeProfileUrl = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\//i.test(handle);
  if (looksLikeProfileUrl) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`);
      const hostname = parsed.hostname.toLowerCase();
      const allowedHosts = new Set(["x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"]);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (!allowedHosts.has(hostname) || segments.length !== 1) return null;
      handle = decodeURIComponent(segments[0]);
    } catch {
      return null;
    }
  }

  handle = handle.replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  if (new Set(["compose", "explore", "home", "i", "intent", "login", "messages", "notifications", "search", "settings", "share", "signup"]).has(handle.toLowerCase())) return null;
  return handle;
}

export function communitySeries(dailyTotals, period) {
  const totals = new Map();
  const type = period.type;
  for (const row of dailyTotals) {
    if (row.date < period.startKey || row.date > period.endKey) continue;
    const date = new Date(`${row.date}T00:00:00Z`);
    let key = row.date;
    let label = date.toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" });
    if (type === "yearly") {
      key = row.date.slice(0, 7);
      label = date.toLocaleDateString(undefined, { timeZone: "UTC", month: "short" });
    }
    totals.set(key, { key, label, durationMs: (totals.get(key)?.durationMs || 0) + Math.max(0, Number(row.durationMs) || 0) });
  }
  return [...totals.values()].sort((left, right) => left.key.localeCompare(right.key));
}
