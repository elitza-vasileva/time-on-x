import {
  globalErrorMessage,
  sendLoginCode,
  signInWithCode,
  signOutGlobal,
  subscribeGlobalAuth,
  subscribeOwnerDashboard,
} from "./shared/instant.js";
import { formatCompactDuration, recentDailySeries, yearHeatmap } from "./shared/data.js";
import { attachTooltip } from "./shared/tooltip.js";

const ids = [
  "loadingState", "signedOutState", "dashboardState", "emailForm", "email", "codeForm", "code", "authMessage",
  "accountName", "accountEmail", "signOut", "dashboardContext", "emptyDashboard", "dashboardContent",
  "todayTotal", "weekTotal", "monthTotal", "yearTotal", "trendTotal", "trendChart",
  "profileHandle", "lastSynced", "heatmapTitle", "yearHeatmap", "todayDetailTotal", "todayDate",
  "todayHeading", "todayComparison", "todayComparisonBar", "trendHeading", "trendDescription",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let pendingEmail = "";
let unsubscribeDashboard = () => {};
let dashboardRows = [];
let trendRange = 7;

function setAuthMessage(message = "", success = false) {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.toggle("is-success", success);
}

function showState(state) {
  elements.loadingState.hidden = state !== "loading";
  elements.signedOutState.hidden = state !== "signed-out";
  elements.dashboardState.hidden = state !== "dashboard";
}

function rollingSummary(rows) {
  const series = recentDailySeries(rows, 30);
  const today = series.at(-1)?.durationMs || 0;
  const last7 = series.slice(-7).reduce((sum, item) => sum + item.durationMs, 0);
  const last30 = series.reduce((sum, item) => sum + item.durationMs, 0);
  const synced = rows.reduce((sum, item) => sum + Math.max(0, Number(item.durationMs) || 0), 0);
  return { today, last7, average30: last30 / 30, synced };
}

function trendSeries(rows, range) {
  const daily = recentDailySeries(rows, range);
  if (range !== 84) return daily.map((item) => ({ ...item, startKey: item.key, endKey: item.key }));
  return Array.from({ length: 12 }, (_, index) => {
    const week = daily.slice(index * 7, index * 7 + 7);
    return {
      key: week[0].key,
      startKey: week[0].key,
      endKey: week.at(-1).key,
      date: week[0].date,
      durationMs: week.reduce((sum, item) => sum + item.durationMs, 0),
    };
  });
}

function renderTrend(rows) {
  const series = trendSeries(rows, trendRange);
  const maximum = Math.max(...series.map((item) => item.durationMs), 1);
  const total = series.reduce((sum, item) => sum + item.durationMs, 0);
  elements.trendTotal.textContent = `${formatCompactDuration(total)} total`;
  elements.trendHeading.textContent = trendRange === 84 ? "12-week trend" : `${trendRange}-day trend`;
  elements.trendDescription.textContent = trendRange === 84
    ? "Each bar combines one seven-day UTC week."
    : "One bar per UTC day, synced from your extension.";
  elements.trendChart.className = `trend-bars trend-range-${trendRange}`;
  elements.trendChart.style.setProperty("--columns", String(series.length));
  elements.trendChart.replaceChildren();

  series.forEach((item, index) => {
    const column = document.createElement("div");
    column.className = "bar-column";
    const wrap = document.createElement("div");
    wrap.className = "bar-wrap";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = item.durationMs ? `${Math.max(2, item.durationMs / maximum * 100)}%` : "2px";
    if (trendRange === 7) {
      const value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = `${Math.round(item.durationMs / 60_000)} min`;
      bar.append(value);
    }
    const label = document.createElement("span");
    label.className = "bar-label";
    const shouldLabel = trendRange !== 30 || index % 5 === 0 || index === series.length - 1;
    if (shouldLabel) {
      const top = document.createElement("b");
      const bottom = document.createElement("small");
      top.textContent = item.date.toLocaleDateString(undefined, {
        timeZone: "UTC",
        weekday: trendRange === 7 ? "short" : undefined,
        month: trendRange === 7 ? undefined : "short",
      });
      bottom.textContent = String(item.date.getUTCDate());
      label.append(top, bottom);
    }
    wrap.append(bar);
    column.append(wrap, label);
    elements.trendChart.append(column);
    attachTooltip(column, {
      title: trendRange === 84 ? `${item.startKey} – ${item.endKey}` : item.key,
      detail: `${formatCompactDuration(item.durationMs)} on X`,
    });
  });
}

function renderHeatmap(rows) {
  const year = new Date().getUTCFullYear();
  const series = yearHeatmap(rows, year);
  const maximum = Math.max(...series.map((item) => item.durationMs), 1);
  elements.heatmapTitle.textContent = `${year} activity map`;
  elements.yearHeatmap.replaceChildren();
  const firstWeekday = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const mondayIndex = (firstWeekday + 6) % 7;
  for (let index = 0; index < mondayIndex; index += 1) {
    const spacer = document.createElement("span");
    spacer.setAttribute("aria-hidden", "true");
    elements.yearHeatmap.append(spacer);
  }
  series.forEach((item) => {
    const cell = document.createElement("i");
    const level = item.durationMs ? Math.max(1, Math.ceil(item.durationMs / maximum * 4)) : 0;
    cell.className = `level-${level}`;
    attachTooltip(cell, { title: item.key, detail: `${formatCompactDuration(item.durationMs)} on X`, focusable: item.durationMs > 0 });
    elements.yearHeatmap.append(cell);
  });
}

function renderToday(summary) {
  const now = new Date();
  elements.todayHeading.textContent = "Today";
  elements.todayDate.textContent = now.toLocaleDateString(undefined, {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  elements.todayDetailTotal.textContent = formatCompactDuration(summary.today);
  const ratio = summary.average30 ? summary.today / summary.average30 : 0;
  elements.todayComparisonBar.style.width = `${Math.min(100, ratio * 100)}%`;
  if (!summary.today && !summary.average30) elements.todayComparison.textContent = "No synced activity yet";
  else if (!summary.average30) elements.todayComparison.textContent = "Your first active day";
  else {
    const difference = Math.round(Math.abs(ratio - 1) * 100);
    elements.todayComparison.textContent = ratio >= 1
      ? `${difference}% above your daily average`
      : `${difference}% below your daily average`;
  }
}

function renderDashboard(result) {
  if (result.error) {
    elements.dashboardContext.textContent = globalErrorMessage(result.error);
    return;
  }
  const data = result.data || { profiles: [], dailyTotals: [] };
  const rows = data.dailyTotals || [];
  const profile = data.profiles?.[0] || null;
  elements.emptyDashboard.hidden = rows.length > 0;
  elements.dashboardContent.hidden = rows.length === 0;
  if (!rows.length) return;

  dashboardRows = rows;
  const summary = rollingSummary(rows);
  elements.todayTotal.textContent = formatCompactDuration(summary.today);
  elements.weekTotal.textContent = formatCompactDuration(summary.last7);
  elements.monthTotal.textContent = formatCompactDuration(summary.average30);
  elements.yearTotal.textContent = formatCompactDuration(summary.synced);
  elements.accountName.textContent = profile?.handle ? `@${profile.handle}` : "Time on X member";
  elements.profileHandle.textContent = profile?.handle ? `@${profile.handle}` : "Your synced account";
  elements.lastSynced.textContent = profile?.lastSyncedAt
    ? `Last synced ${new Date(profile.lastSyncedAt).toLocaleString()}`
    : "Daily totals are available; a sync timestamp was not recorded.";
  renderToday(summary);
  renderTrend(rows);
  renderHeatmap(rows);
}

document.querySelectorAll("[data-trend]").forEach((button) => button.addEventListener("click", () => {
  trendRange = Number(button.dataset.trend);
  document.querySelectorAll("[data-trend]").forEach((item) => {
    const active = item === button;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderTrend(dashboardRows);
}));

elements.emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  pendingEmail = elements.email.value.trim();
  setAuthMessage("Sending your one-time code…", true);
  try {
    await sendLoginCode(pendingEmail);
    elements.codeForm.hidden = false;
    elements.code.focus();
    setAuthMessage("Code sent. Check your inbox.", true);
  } catch (error) {
    pendingEmail = "";
    setAuthMessage(globalErrorMessage(error));
  }
});

elements.codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthMessage("Verifying…", true);
  try {
    await signInWithCode(pendingEmail, elements.code.value);
    pendingEmail = "";
    elements.code.value = "";
  } catch (error) {
    setAuthMessage(globalErrorMessage(error));
  }
});

elements.signOut.addEventListener("click", async () => {
  await signOutGlobal();
});

subscribeGlobalAuth((auth) => {
  if (auth?.error) {
    showState("signed-out");
    setAuthMessage(globalErrorMessage(auth.error));
    return;
  }
  if (auth?.isLoading) {
    showState("loading");
    return;
  }
  unsubscribeDashboard();
  if (!auth?.user) {
    elements.codeForm.hidden = true;
    showState("signed-out");
    return;
  }
  elements.accountEmail.textContent = auth.user.email || "Signed in securely";
  showState("dashboard");
  unsubscribeDashboard = subscribeOwnerDashboard(auth.user.id, renderDashboard);
});
