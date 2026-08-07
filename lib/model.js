// These legacy keys stay stable so upgrading the renamed extension preserves local history and theme settings.
export const STORAGE_KEY = "xTimeStore";
export const THEME_STORAGE_KEY = "xTimeTheme";
export const STORE_VERSION = 3;
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 60;
export const IDLE_TIMEOUT_OPTIONS = [30, 60, 120, 300];
export const THEME_OPTIONS = ["system", "light", "dark"];

export function createDefaultStore() {
  return {
    version: STORE_VERSION,
    sessions: [],
    tracking: null,
    settings: {
      idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
      theme: "system",
    },
  };
}

export function normalizeStore(value) {
  const fallback = createDefaultStore();
  if (!value || typeof value !== "object") return fallback;

  let sessions = Array.isArray(value.sessions)
    ? value.sessions
        .filter(isValidSession)
        .map((session) => ({
          id: String(session.id),
          s: Number(session.s),
          e: Number(session.e),
        }))
        .sort((a, b) => a.s - b.s)
    : [];

  // Version 1 could split one visit whenever Chrome restarted the MV3 worker.
  // Those fragments are adjacent within milliseconds, so join only tiny gaps.
  if (Number(value.version || 1) < STORE_VERSION) {
    sessions = coalesceSessions(sessions, 1_500);
  }

  const requestedTimeout = Number(value.settings?.idleTimeoutSeconds);
  const idleTimeoutSeconds = IDLE_TIMEOUT_OPTIONS.includes(requestedTimeout)
    ? requestedTimeout
    : DEFAULT_IDLE_TIMEOUT_SECONDS;
  const theme = THEME_OPTIONS.includes(value.settings?.theme)
    ? value.settings.theme
    : "system";

  const tracking = normalizeTracking(value.tracking, sessions);

  return {
    version: STORE_VERSION,
    sessions,
    tracking,
    settings: { idleTimeoutSeconds, theme },
  };
}

export function coalesceSessions(sessions, maxGapMs = 1_500) {
  const sorted = sessions
    .filter(isValidSession)
    .map((session) => ({ ...session, s: Number(session.s), e: Number(session.e) }))
    .sort((a, b) => a.s - b.s);
  const merged = [];
  for (const session of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && session.s - previous.e <= maxGapMs) {
      previous.e = Math.max(previous.e, session.e);
    } else {
      merged.push({ ...session });
    }
  }
  return merged;
}

export function isValidSession(session) {
  return (
    session &&
    Number.isFinite(Number(session.s)) &&
    Number.isFinite(Number(session.e)) &&
    Number(session.e) >= Number(session.s) &&
    session.id !== undefined
  );
}

function normalizeTracking(value, sessions) {
  if (!value || typeof value !== "object") return null;
  const sessionExists = sessions.some((session) => session.id === String(value.sessionId));
  const numericFields = [
    value.tabId,
    value.windowId,
    value.lastActivityAt,
    value.lastSeenAt,
  ].every((field) => Number.isFinite(Number(field)));

  if (!sessionExists || !numericFields) return null;
  return {
    tabId: Number(value.tabId),
    windowId: Number(value.windowId),
    sessionId: String(value.sessionId),
    lastActivityAt: Number(value.lastActivityAt),
    lastSeenAt: Number(value.lastSeenAt),
  };
}

export function startSession(store, context, at) {
  const id = createSessionId(at);
  store.sessions.push({ id, s: at, e: at });
  store.tracking = {
    tabId: context.tabId,
    windowId: context.windowId,
    sessionId: id,
    lastActivityAt: at,
    lastSeenAt: at,
  };
  return store.tracking;
}

export function extendSession(store, through) {
  if (!store.tracking) return;
  const session = store.sessions.find(
    (candidate) => candidate.id === store.tracking.sessionId,
  );
  if (!session) {
    store.tracking = null;
    return;
  }

  const timeoutMs = store.settings.idleTimeoutSeconds * 1000;
  const eligibleThrough = Math.min(
    through,
    store.tracking.lastActivityAt + timeoutMs,
  );
  session.e = Math.max(session.e, eligibleThrough);
}

export function stopSession(store, at) {
  if (!store.tracking) return;
  extendSession(store, at);
  const sessionId = store.tracking.sessionId;
  store.tracking = null;
  store.sessions = store.sessions.filter(
    (session) => session.id !== sessionId || session.e > session.s,
  );
}

export function expireIfIdle(store, at) {
  if (!store.tracking) return false;
  const expiresAt =
    store.tracking.lastActivityAt + store.settings.idleTimeoutSeconds * 1000;
  if (at < expiresAt) return false;
  stopSession(store, expiresAt);
  return true;
}

export function replaceSessions(store, sessions) {
  store.sessions = sessions
    .filter(isValidSession)
    .map((session, index) => ({
      id: `${Number(session.s)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      s: Number(session.s),
      e: Number(session.e),
    }))
    .sort((a, b) => a.s - b.s);
  store.tracking = null;
}

function createSessionId(at) {
  return `${at}-${Math.random().toString(36).slice(2, 9)}`;
}
