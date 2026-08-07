import {
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  THEME_OPTIONS,
  IDLE_TIMEOUT_OPTIONS,
  createDefaultStore,
  normalizeStore,
  startSession,
  extendSession,
  stopSession,
  expireIfIdle,
  replaceSessions,
} from "./lib/model.js";
import { localDayBounds, totalBetween } from "./lib/analytics.js";
import { syncPublicTotals } from "./global/leaderboard-client.js";

const WATCHDOG_ALARM = "time-on-x-watchdog";
const GLOBAL_SYNC_ALARM = "time-on-x-global-sync";
const HEARTBEAT_GRACE_MS = 15_000;
// X_TIME_* is a compatibility protocol, not a user-facing product name.
let operationQueue = Promise.resolve();

function enqueue(operation) {
  operationQueue = operationQueue.then(operation, operation);
  return operationQueue;
}

async function readStore() {
  const result = await chrome.storage.local.get([STORAGE_KEY, THEME_STORAGE_KEY]);
  const store = normalizeStore(result[STORAGE_KEY]);
  if (THEME_OPTIONS.includes(result[THEME_STORAGE_KEY])) {
    store.settings.theme = result[THEME_STORAGE_KEY];
  }
  return store;
}

async function writeStore(store) {
  const normalized = normalizeStore(store);
  await chrome.storage.local.set({
    [STORAGE_KEY]: normalized,
    [THEME_STORAGE_KEY]: normalized.settings.theme,
  });
  await updateBadge(normalized);
}

async function syncGlobalStore(store = null) {
  try {
    const snapshot = store || await readStore();
    return await syncPublicTotals(snapshot.sessions);
  } catch (error) {
    return { ok: false, reason: error?.body?.message || error?.message || "sync-failed" };
  }
}

async function updateBadge(store) {
  const { start, end } = localDayBounds();
  const milliseconds = totalBetween(store.sessions, start, end);
  const minutes = Math.floor(milliseconds / 60_000);
  let text = "";
  if (minutes > 0 && minutes < 60) text = `${minutes}m`;
  if (minutes >= 60) text = `${Math.floor(minutes / 60)}h`;

  await chrome.action.setBadgeBackgroundColor({ color: "#6C5CE7" });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({
    title: minutes > 0 ? `Time on X — ${minutes} min today` : "Time on X — no time today",
  });
}

function isXUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "x.com" || hostname === "www.x.com" ||
      hostname === "twitter.com" || hostname === "www.twitter.com";
  } catch {
    return false;
  }
}

async function isWindowFocused(windowId) {
  try {
    const window = await chrome.windows.get(windowId);
    return window.focused && window.state !== "minimized";
  } catch {
    return false;
  }
}

function safeMessageTime(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(fallback, Math.max(fallback - 60_000, numeric));
}

async function handleContentSignal(message, sender) {
  if (!sender.tab || !isXUrl(sender.url || sender.tab.url || "")) return;
  const now = Date.now();
  const store = await readStore();
  const sameTrackedTab = store.tracking?.tabId === sender.tab.id;

  if (message.type === "X_TIME_HIDDEN" || !message.visible || !message.focused) {
    if (sameTrackedTab) {
      stopSession(store, now);
      await writeStore(store);
    }
    return;
  }

  const focused = sender.tab.active && (await isWindowFocused(sender.tab.windowId));
  const systemState = await chrome.idle.queryState(
    store.settings.idleTimeoutSeconds,
  );
  if (!focused || systemState !== "active") {
    if (sameTrackedTab) {
      stopSession(store, now);
      await writeStore(store);
    }
    return;
  }

  if (store.tracking && !sameTrackedTab) stopSession(store, now);
  expireIfIdle(store, now);

  const intentionalSignal =
    message.type === "X_TIME_VIEW" || message.type === "X_TIME_ACTIVITY";
  const reportedActivity = safeMessageTime(message.lastActivityAt, now);
  const hasRecentReportedActivity =
    Number(message.lastActivityAt) > 0 &&
    now - reportedActivity <= store.settings.idleTimeoutSeconds * 1000;

  if (!store.tracking && (intentionalSignal || hasRecentReportedActivity)) {
    startSession(
      store,
      { tabId: sender.tab.id, windowId: sender.tab.windowId },
      now,
    );
  }

  if (!store.tracking) {
    await writeStore(store);
    return;
  }

  if (intentionalSignal || hasRecentReportedActivity) {
    store.tracking.lastActivityAt = intentionalSignal ? now : reportedActivity;
  }
  store.tracking.lastSeenAt = now;
  extendSession(store, now);
  await writeStore(store);
}

async function stopCurrent(at = Date.now()) {
  const store = await readStore();
  if (!store.tracking) return;
  stopSession(store, at);
  await writeStore(store);
}

async function probeTab(tabId) {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: "X_TIME_CHECK_STATE" }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Content script did not respond")), 1_000),
      ),
    ]);
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || !response?.visible || !response?.focused) return;
    await handleContentSignal(
      { type: "X_TIME_VIEW", ...response },
      { tab, url: tab.url },
    );
  } catch {
    // Non-X tabs do not have the content script, which is expected.
  }
}

async function probeFocusedWindow() {
  try {
    const window = await chrome.windows.getLastFocused();
    if (!window.focused || window.id === chrome.windows.WINDOW_ID_NONE) return;
    const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
    if (tab?.id !== undefined) await probeTab(tab.id);
  } catch {
    // Chrome can briefly have no normal focused window.
  }
}

async function runWatchdog() {
  const now = Date.now();
  const store = await readStore();
  if (!store.tracking) {
    await updateBadge(store);
    return;
  }

  const heartbeatMissing = now - store.tracking.lastSeenAt > HEARTBEAT_GRACE_MS;
  const expired = expireIfIdle(store, now);
  if (heartbeatMissing && store.tracking) {
    stopSession(store, store.tracking.lastSeenAt);
  }
  if (heartbeatMissing || expired) await writeStore(store);
}

async function initialize({ openDashboard = false, finalizeExisting = false } = {}) {
  try {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  } catch {
    // Older compatible Chromium builds may not expose setAccessLevel.
  }

  const store = await readStore();
  if (finalizeExisting && store.tracking) {
    stopSession(store, store.tracking.lastSeenAt);
  }
  chrome.idle.setDetectionInterval(store.settings.idleTimeoutSeconds);
  await chrome.alarms.create(WATCHDOG_ALARM, { periodInMinutes: 0.5 });
  await chrome.alarms.create(GLOBAL_SYNC_ALARM, { periodInMinutes: 15 });
  await writeStore(store);
  await probeFocusedWindow();
  void syncGlobalStore(store);
  if (openDashboard) await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
}

chrome.runtime.onInstalled.addListener((details) => {
  void enqueue(() => initialize({
    openDashboard: details.reason === "install",
    finalizeExisting: true,
  }));
});

chrome.runtime.onStartup.addListener(() => {
  void enqueue(() => initialize({ finalizeExisting: true }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const contentTypes = new Set([
    "X_TIME_VIEW",
    "X_TIME_ACTIVITY",
    "X_TIME_HEARTBEAT",
    "X_TIME_HIDDEN",
  ]);

  if (contentTypes.has(message?.type)) {
    void enqueue(() => handleContentSignal(message, sender));
    return false;
  }

  if (message?.type === "X_TIME_GET_SNAPSHOT") {
    void enqueue(async () => {
      const store = await readStore();
      sendResponse(store);
    });
    return true;
  }

  if (message?.type === "X_TIME_SET_IDLE_TIMEOUT") {
    void enqueue(async () => {
      const seconds = Number(message.seconds);
      if (!IDLE_TIMEOUT_OPTIONS.includes(seconds)) {
        sendResponse({ ok: false, error: "Unsupported timeout" });
        return;
      }
      const store = await readStore();
      if (store.tracking) stopSession(store, Date.now());
      store.settings.idleTimeoutSeconds = seconds;
      chrome.idle.setDetectionInterval(seconds);
      await writeStore(store);
      sendResponse({ ok: true });
      await probeFocusedWindow();
    });
    return true;
  }

  if (message?.type === "X_TIME_SET_THEME") {
    void enqueue(async () => {
      const theme = String(message.theme || "");
      if (!THEME_OPTIONS.includes(theme)) {
        sendResponse({ ok: false, error: "Unsupported theme" });
        return;
      }
      const store = await readStore();
      store.settings.theme = theme;
      await writeStore(store);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "X_TIME_SYNC_GLOBAL") {
    void enqueue(async () => {
      const result = await syncGlobalStore();
      sendResponse(result);
    });
    return true;
  }

  if (message?.type === "X_TIME_CLEAR_DATA") {
    void enqueue(async () => {
      const current = await readStore();
      const clean = createDefaultStore();
      clean.settings = current.settings;
      await writeStore(clean);
      sendResponse({ ok: true });
      void syncGlobalStore(clean);
      await probeFocusedWindow();
    });
    return true;
  }

  if (message?.type === "X_TIME_IMPORT_DATA") {
    void enqueue(async () => {
      const store = await readStore();
      const sessions = Array.isArray(message.sessions) ? message.sessions : [];
      replaceSessions(store, sessions);
      const importedTimeout = Number(message.settings?.idleTimeoutSeconds);
      if (IDLE_TIMEOUT_OPTIONS.includes(importedTimeout)) {
        store.settings.idleTimeoutSeconds = importedTimeout;
        chrome.idle.setDetectionInterval(importedTimeout);
      }
      if (["system", "light", "dark"].includes(message.settings?.theme)) {
        store.settings.theme = message.settings.theme;
      }
      await writeStore(store);
      sendResponse({ ok: true, count: store.sessions.length });
      void syncGlobalStore(store);
      await probeFocusedWindow();
    });
    return true;
  }

  return false;
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void enqueue(async () => {
    const store = await readStore();
    if (store.tracking && store.tracking.tabId !== activeInfo.tabId) {
      stopSession(store, Date.now());
      await writeStore(store);
    }
    await probeTab(activeInfo.tabId);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  void enqueue(async () => {
    const store = await readStore();
    if (store.tracking?.tabId === tabId) {
      stopSession(store, Date.now());
      await writeStore(store);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void enqueue(async () => {
    const store = await readStore();
    if (store.tracking?.tabId === tabId) {
      stopSession(store, Date.now());
      await writeStore(store);
    }
  });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  void enqueue(async () => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await stopCurrent();
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    const store = await readStore();
    if (store.tracking && store.tracking.tabId !== tab?.id) {
      stopSession(store, Date.now());
      await writeStore(store);
    }
    if (tab?.id !== undefined) await probeTab(tab.id);
  });
});

chrome.idle.onStateChanged.addListener((state) => {
  void enqueue(async () => {
    if (state !== "active") {
      await stopCurrent();
      return;
    }
    await probeFocusedWindow();
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WATCHDOG_ALARM) void enqueue(runWatchdog);
  if (alarm.name === GLOBAL_SYNC_ALARM) void enqueue(() => syncGlobalStore());
});

void enqueue(() => initialize());
