import {
  dailyTotals,
  formatDuration,
  hourlyTotals,
  localDayBounds,
  sessionsWithin,
  totalBetween,
} from "../lib/analytics.js";
import { createDefaultStore, normalizeStore } from "../lib/model.js";
import { applyThemePreference } from "../lib/theme.js";

const todayTotal = document.getElementById("todayTotal");
const weekTotal = document.getElementById("weekTotal");
const todaySessions = document.getElementById("todaySessions");
const miniChart = document.getElementById("miniChart");
const status = document.getElementById("status");
const extensionApi = globalThis.chrome;
let stopThemeObserver = () => {};

async function render() {
  let store = createDefaultStore();
  try {
    store = normalizeStore(await extensionApi?.runtime?.sendMessage({ type: "X_TIME_GET_SNAPSHOT" }));
  } catch {
    // The zero state remains useful if the worker is restarting.
  }

  const bounds = localDayBounds();
  const todayMs = totalBetween(store.sessions, bounds.start, bounds.end);
  const weekMs = dailyTotals(store.sessions, new Date(), 7)
    .reduce((total, day) => total + day.duration, 0);
  const count = sessionsWithin(store.sessions, bounds.start, bounds.end).length;
  todayTotal.textContent = formatDuration(todayMs);
  weekTotal.textContent = formatDuration(weekMs, { compact: true });
  todaySessions.textContent = String(count);
  stopThemeObserver();
  stopThemeObserver = applyThemePreference(store.settings.theme);

  const trackingNow = store.tracking && Date.now() - store.tracking.lastSeenAt <= 15_000;
  status.classList.toggle("is-tracking", Boolean(trackingNow));
  status.lastChild.textContent = trackingNow ? "Tracking active X tab" : "Not tracking";

  const totals = hourlyTotals(store.sessions);
  const max = Math.max(...totals, 1);
  miniChart.replaceChildren();
  totals.forEach((duration, hour) => {
    const bar = document.createElement("div");
    bar.className = "mini-bar";
    bar.style.height = duration > 0 ? `${Math.max(4, (duration / max) * 100)}%` : "0";
    bar.title = `${String(hour).padStart(2, "0")}:00–${String(hour + 1).padStart(2, "0")}:00 · ${formatDuration(duration)}`;
    miniChart.append(bar);
  });
}

async function openPage(path) {
  if (!extensionApi?.tabs) {
    window.location.href = path;
    return;
  }
  await extensionApi.tabs.create({ url: extensionApi.runtime.getURL(path.replace(/^\.\.\//, "")) });
  window.close();
}
document.getElementById("openDashboard").addEventListener("click", () => void openPage("../dashboard/dashboard.html"));
document.getElementById("openRankings").addEventListener("click", () => void openPage("../leaderboard/leaderboard.html"));
document.getElementById("openSettings").addEventListener("click", () => void openPage("../settings/settings.html"));

void render();
