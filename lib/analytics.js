export function overlapMs(session, rangeStart, rangeEnd) {
  return Math.max(
    0,
    Math.min(Number(session.e), rangeEnd) -
      Math.max(Number(session.s), rangeStart),
  );
}

export function totalBetween(sessions, rangeStart, rangeEnd) {
  return sessions.reduce(
    (total, session) => total + overlapMs(session, rangeStart, rangeEnd),
    0,
  );
}

export function localDayBounds(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { start: start.getTime(), end: end.getTime() };
}

export function hourlyTotals(sessions, value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Array.from({ length: 24 }, (_, hour) => {
    const start = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      0,
      0,
      0,
    ).getTime();
    const end = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour + 1,
      0,
      0,
      0,
    ).getTime();
    return totalBetween(sessions, start, end);
  });
}

export function dailyTotals(sessions, endDate = new Date(), dayCount = 7) {
  const anchor = new Date(endDate);
  anchor.setHours(0, 0, 0, 0);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - (dayCount - 1 - index));
    const { start, end } = localDayBounds(date);
    return { date, start, end, duration: totalBetween(sessions, start, end) };
  });
}

export function weeklyTotals(sessions, endDate = new Date(), weekCount = 12) {
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(0, 0, 0, 0);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  return Array.from({ length: weekCount }, (_, index) => {
    const startDate = new Date(rangeEnd);
    startDate.setDate(rangeEnd.getDate() - (weekCount - index) * 7);
    const endDateForBucket = new Date(startDate);
    endDateForBucket.setDate(startDate.getDate() + 7);
    const start = startDate.getTime();
    const end = endDateForBucket.getTime();
    return {
      date: startDate,
      start,
      end,
      duration: totalBetween(sessions, start, end),
    };
  });
}

export function sessionsWithin(sessions, rangeStart, rangeEnd) {
  return sessions
    .filter((session) => overlapMs(session, rangeStart, rangeEnd) > 0)
    .map((session) => ({
      ...session,
      clippedStart: Math.max(session.s, rangeStart),
      clippedEnd: Math.min(session.e, rangeEnd),
    }))
    .sort((a, b) => a.clippedStart - b.clippedStart);
}

export function formatDuration(milliseconds, options = {}) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (options.compact) {
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  if (hours > 0) return `${hours} hr ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} sec`;
  return `${seconds} sec`;
}

export function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const RELATABLE_DURATIONS = [
  { milliseconds: 3.5 * 60_000, label: "an average song" },
  { milliseconds: 8 * 60_000, label: "boiling an egg" },
  { milliseconds: 25 * 60_000, label: "a Pomodoro sprint" },
  { milliseconds: 30 * 60_000, label: "a sitcom episode" },
  { milliseconds: 60 * 60_000, label: "a recreational 10K run" },
  { milliseconds: 2 * 60 * 60_000, label: "a feature-length film" },
  { milliseconds: 8 * 60 * 60_000, label: "a full workday" },
];

export function relatableComparison(milliseconds) {
  if (milliseconds <= 0) return "A clean slate — not even one song yet.";
  const reference = RELATABLE_DURATIONS.reduce((closest, candidate) => {
    const distance = Math.abs(Math.log(milliseconds / candidate.milliseconds));
    return distance < closest.distance ? { ...candidate, distance } : closest;
  }, { ...RELATABLE_DURATIONS[0], distance: Infinity });
  const ratio = milliseconds / reference.milliseconds;
  if (ratio < 0.75) {
    return `That is about ${Math.max(1, Math.round(ratio * 100))}% of ${reference.label}.`;
  }
  if (ratio <= 1.35) return `That is about as long as ${reference.label}.`;
  return `That is ${ratio.toFixed(ratio >= 10 ? 0 : 1)}× the length of ${reference.label}.`;
}
