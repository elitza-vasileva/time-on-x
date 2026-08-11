import {
  deletePayoutPeriod,
  globalErrorMessage,
  savePayoutPeriod,
  sendLoginCode,
  signInWithCode,
  signOutGlobal,
  subscribeGlobalAuth,
  subscribeOwnerDashboard,
} from "./shared/instant.js";
import {
  activeDayExtremes,
  formatCompactDuration,
  payoutPeriodStats,
  pearsonCorrelation,
  recentDailySeries,
  utcKey,
  yearHeatmap,
} from "./shared/data.js";
import { attachTooltip } from "./shared/tooltip.js";

const ids = [
  "loadingState", "signedOutState", "dashboardState", "emailForm", "email", "codeForm", "code", "authMessage",
  "accountName", "accountEmail", "signOut", "dashboardContext", "emptyDashboard", "dashboardContent",
  "todayTotal", "weekTotal", "monthTotal", "yearTotal", "trendTotal", "trendChart",
  "profileHandle", "lastSynced", "heatmapTitle", "yearHeatmap", "todayDetailTotal", "todayDate",
  "todayHeading", "todayComparison", "todayComparisonBar", "trendHeading", "trendDescription",
  "highestDayTime", "highestDayDate", "lowestDayTime", "lowestDayDate", "overviewView", "payoutsView",
  "payoutForm", "payoutStart", "payoutEnd", "payoutAmount", "payoutFormMessage", "payoutCount", "payoutTotal",
  "payoutTrackedTime", "correlationValue", "correlationLabel", "payoutComparisonEmpty", "payoutComparisonChart",
  "correlationBadge", "correlationPlot", "correlationHeadline", "correlationDescription", "payoutHistory",
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

function setPayoutMessage(message = "", success = false) {
  elements.payoutFormMessage.textContent = message;
  elements.payoutFormMessage.classList.toggle("is-success", success);
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

function formatBarDuration(milliseconds) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatFullDate(key) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function renderExtremes(rows) {
  const extremes = activeDayExtremes(rows, trendRange);
  for (const type of ["highest", "lowest"]) {
    const item = extremes[type];
    elements[`${type}DayTime`].textContent = item ? formatCompactDuration(item.durationMs) : "—";
    elements[`${type}DayDate`].textContent = item ? formatFullDate(item.key) : "No active days in this range";
  }
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
    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = formatBarDuration(item.durationMs);
    bar.append(value);
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
  renderExtremes(rows);
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

function money(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value || 0);
}

function shortDate(key, includeYear = false) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC", month: "short", day: "numeric", year: includeYear ? "numeric" : undefined,
  });
}

function payoutRange(item) {
  return `${shortDate(item.startDate)} – ${shortDate(item.endDate, true)}`;
}

function correlationCopy(value, count) {
  if (value === null) return {
    badge: count < 2 ? "Needs 2+ periods" : "Not enough variation",
    headline: count < 2 ? "Add at least two payouts" : "The current periods are too similar",
    description: count < 2
      ? "Two fully tracked periods create an early directional signal. Three or more make the pattern more informative."
      : "Correlation needs variation in both tracked time and payout amount.",
  };
  const direction = value >= 0 ? "positive" : "negative";
  const strength = Math.abs(value) >= 0.7 ? "strong" : Math.abs(value) >= 0.4 ? "moderate" : "weak";
  return {
    badge: `${strength} ${direction}`,
    headline: count === 2 ? `Early ${direction} signal` : `${strength[0].toUpperCase()}${strength.slice(1)} ${direction} relationship`,
    description: count === 2
      ? `Across these first two periods, more time is associated with ${direction === "positive" ? "a higher" : "a lower"} payout. Add more periods before drawing conclusions.`
      : `Across ${count} periods, more time is associated with ${direction === "positive" ? "higher" : "lower"} payouts.`,
  };
}

function renderPayoutComparison(stats) {
  elements.payoutComparisonEmpty.hidden = stats.length > 0;
  elements.payoutComparisonChart.hidden = stats.length === 0;
  elements.payoutComparisonChart.replaceChildren();
  if (!stats.length) return;
  const maximumTime = Math.max(...stats.map((item) => item.durationMs), 1);
  const maximumMoney = Math.max(...stats.map((item) => item.amount), 1);
  elements.payoutComparisonChart.style.setProperty("--payout-columns", String(stats.length));
  stats.forEach((item) => {
    const group = document.createElement("div");
    group.className = "payout-bar-group";
    const values = document.createElement("div");
    values.className = "payout-bar-values";
    const timeValue = document.createElement("strong");
    timeValue.textContent = formatCompactDuration(item.durationMs);
    const moneyValue = document.createElement("strong");
    moneyValue.textContent = money(item.amount);
    values.append(timeValue, moneyValue);
    const bars = document.createElement("div");
    bars.className = "payout-bars";
    const timeBar = document.createElement("i");
    timeBar.className = "time-bar";
    timeBar.style.height = item.durationMs ? `${Math.max(3, item.durationMs / maximumTime * 100)}%` : "3px";
    const moneyBar = document.createElement("i");
    moneyBar.className = "money-bar";
    moneyBar.style.height = `${Math.max(3, item.amount / maximumMoney * 100)}%`;
    bars.append(timeBar, moneyBar);
    const label = document.createElement("span");
    label.textContent = `${payoutRange(item)}${item.isPartial ? " · partial" : ""}`;
    group.append(values, bars, label);
    elements.payoutComparisonChart.append(group);
    attachTooltip(timeBar, { title: payoutRange(item), detail: `${formatCompactDuration(item.durationMs)} tracked on X` });
    attachTooltip(moneyBar, { title: payoutRange(item), detail: `${money(item.amount)} payout` });
  });
}

function renderCorrelation(stats) {
  const comparable = stats.filter((item) => item.durationMs > 0 && !item.isPartial);
  const value = pearsonCorrelation(comparable.map((item) => ({ x: item.durationMs, y: item.amount })));
  const copy = correlationCopy(value, comparable.length);
  elements.correlationValue.textContent = value === null ? "—" : value.toFixed(2);
  elements.correlationLabel.textContent = copy.badge;
  elements.correlationBadge.textContent = copy.badge;
  elements.correlationHeadline.textContent = copy.headline;
  elements.correlationDescription.textContent = copy.description;
  elements.correlationPlot.replaceChildren();
  const yLabel = document.createElement("div");
  yLabel.className = "plot-y-label";
  yLabel.textContent = "Higher payout";
  const xLabel = document.createElement("div");
  xLabel.className = "plot-x-label";
  xLabel.textContent = "More time on X";
  elements.correlationPlot.append(yLabel, xLabel);
  if (!comparable.length) {
    const empty = document.createElement("p");
    empty.className = "plot-empty";
    empty.textContent = "Saved payout periods will appear here.";
    elements.correlationPlot.append(empty);
    return;
  }
  const maxTime = Math.max(...comparable.map((item) => item.durationMs), 1);
  const maxPayout = Math.max(...comparable.map((item) => item.amount), 1);
  comparable.forEach((item, index) => {
    const point = document.createElement("button");
    point.type = "button";
    point.className = "correlation-point";
    point.style.left = `${8 + item.durationMs / maxTime * 84}%`;
    point.style.top = `${92 - item.amount / maxPayout * 84}%`;
    point.textContent = String(index + 1);
    elements.correlationPlot.append(point);
    attachTooltip(point, {
      title: payoutRange(item),
      detail: `${formatCompactDuration(item.durationMs)} · ${money(item.amount)}`,
    });
  });
}

function renderPayoutHistory(stats) {
  elements.payoutHistory.replaceChildren();
  if (!stats.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No payouts saved yet.";
    elements.payoutHistory.append(empty);
    return;
  }
  [...stats].reverse().forEach((item) => {
    const row = document.createElement("article");
    row.className = "payout-history-row";
    const range = document.createElement("div");
    range.innerHTML = `<strong>${payoutRange(item)}</strong><small>${item.isPartial ? `Partial tracking from ${shortDate(item.firstTrackedDate, true)}` : "Start included · end excluded"}</small>`;
    const time = document.createElement("div");
    time.innerHTML = `<span>Time on X</span><strong>${formatCompactDuration(item.durationMs)}</strong>`;
    const amount = document.createElement("div");
    amount.innerHTML = `<span>Payout</span><strong>${money(item.amount)}</strong>`;
    const rate = document.createElement("div");
    rate.innerHTML = `<span>Per tracked hour</span><strong>${item.dollarsPerHour === null ? "—" : money(item.dollarsPerHour)}</strong>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-payout";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete the ${payoutRange(item)} payout?`)) return;
      remove.disabled = true;
      try {
        await deletePayoutPeriod(item.id);
        setPayoutMessage("Payout deleted.", true);
      } catch (error) {
        remove.disabled = false;
        setPayoutMessage(globalErrorMessage(error));
      }
    });
    row.append(range, time, amount, rate, remove);
    elements.payoutHistory.append(row);
  });
}

function renderPayouts(rows, payouts) {
  const stats = payoutPeriodStats(rows, payouts);
  const payoutTotal = stats.reduce((sum, item) => sum + item.amount, 0);
  const trackedTotal = stats.reduce((sum, item) => sum + item.durationMs, 0);
  elements.payoutCount.textContent = String(stats.length);
  elements.payoutTotal.textContent = money(payoutTotal);
  elements.payoutTrackedTime.textContent = formatCompactDuration(trackedTotal);
  renderPayoutComparison(stats);
  renderCorrelation(stats);
  renderPayoutHistory(stats);
}

function renderDashboard(result) {
  if (result.error) {
    elements.dashboardContext.textContent = globalErrorMessage(result.error);
    return;
  }
  const data = result.data || { profiles: [], dailyTotals: [], payouts: [] };
  const rows = data.dailyTotals || [];
  const payouts = data.payouts || [];
  const profile = data.profiles?.[0] || null;
  dashboardRows = rows;
  elements.emptyDashboard.hidden = rows.length > 0;
  elements.dashboardContent.hidden = rows.length === 0;
  elements.accountName.textContent = profile?.handle ? `@${profile.handle}` : "Time on X member";
  elements.profileHandle.textContent = profile?.handle ? `@${profile.handle}` : "Your synced account";
  renderPayouts(rows, payouts);
  if (!rows.length) return;

  const summary = rollingSummary(rows);
  elements.todayTotal.textContent = formatCompactDuration(summary.today);
  elements.weekTotal.textContent = formatCompactDuration(summary.last7);
  elements.monthTotal.textContent = formatCompactDuration(summary.average30);
  elements.yearTotal.textContent = formatCompactDuration(summary.synced);
  elements.lastSynced.textContent = profile?.lastSyncedAt
    ? `Last synced ${new Date(profile.lastSyncedAt).toLocaleString()}`
    : "Daily totals are available; a sync timestamp was not recorded.";
  renderToday(summary);
  renderTrend(rows);
  renderHeatmap(rows);
}

function setDefaultPayoutDates() {
  if (elements.payoutStart.value || elements.payoutEnd.value) return;
  const end = Date.parse(`${utcKey()}T00:00:00Z`);
  elements.payoutEnd.value = utcKey(end);
  elements.payoutStart.value = utcKey(end - 14 * 86_400_000);
}

document.querySelectorAll("[data-dashboard-view]").forEach((button) => button.addEventListener("click", () => {
  const view = button.dataset.dashboardView;
  document.querySelectorAll("[data-dashboard-view]").forEach((item) => {
    const active = item === button;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
  });
  elements.overviewView.hidden = view !== "overview";
  elements.payoutsView.hidden = view !== "payouts";
  if (view === "payouts") setDefaultPayoutDates();
}));

document.querySelectorAll("[data-trend]").forEach((button) => button.addEventListener("click", () => {
  trendRange = Number(button.dataset.trend);
  document.querySelectorAll("[data-trend]").forEach((item) => {
    const active = item === button;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderTrend(dashboardRows);
}));

elements.payoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = elements.payoutForm.querySelector("button[type='submit']");
  submit.disabled = true;
  setPayoutMessage("Saving payout…", true);
  try {
    const result = await savePayoutPeriod({
      startDate: elements.payoutStart.value,
      endDate: elements.payoutEnd.value,
      amount: elements.payoutAmount.value,
    });
    elements.payoutAmount.value = "";
    setPayoutMessage(result.updated ? "Existing payout period updated." : "Payout period saved.", true);
  } catch (error) {
    setPayoutMessage(globalErrorMessage(error));
  } finally {
    submit.disabled = false;
  }
});

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
  setDefaultPayoutDates();
  unsubscribeDashboard = subscribeOwnerDashboard(auth.user.id, renderDashboard);
});
