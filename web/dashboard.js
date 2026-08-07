import {
  globalErrorMessage,
  sendLoginCode,
  signInWithCode,
  signOutGlobal,
  subscribeGlobalAuth,
  subscribeOwnerDashboard,
} from "./shared/instant.js";
import {
  dashboardSummary,
  formatCompactDuration,
  recentDailySeries,
  yearHeatmap,
} from "./shared/data.js";

const ids = [
  "loadingState", "signedOutState", "dashboardState", "emailForm", "email", "codeForm", "code", "authMessage",
  "accountName", "accountEmail", "signOut", "dashboardContext", "emptyDashboard", "dashboardContent",
  "todayTotal", "weekTotal", "monthTotal", "yearTotal", "trendTotal", "trendChart",
  "profileHandle", "lastSynced", "heatmapTitle", "yearHeatmap",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let pendingEmail = "";
let unsubscribeDashboard = () => {};

function setAuthMessage(message = "", success = false) {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.toggle("is-success", success);
}

function showState(state) {
  elements.loadingState.hidden = state !== "loading";
  elements.signedOutState.hidden = state !== "signed-out";
  elements.dashboardState.hidden = state !== "dashboard";
}

function renderTrend(rows) {
  const series = recentDailySeries(rows, 30);
  const maximum = Math.max(...series.map((item) => item.durationMs), 1);
  const total = series.reduce((sum, item) => sum + item.durationMs, 0);
  elements.trendTotal.textContent = `${formatCompactDuration(total)} total`;
  elements.trendChart.replaceChildren();
  series.forEach((item, index) => {
    const column = document.createElement("div"); column.className = "bar-column"; column.title = `${item.key} · ${formatCompactDuration(item.durationMs)}`;
    const wrap = document.createElement("div"); wrap.className = "bar-wrap";
    const bar = document.createElement("div"); bar.className = "bar"; bar.style.height = item.durationMs ? `${Math.max(2, item.durationMs / maximum * 100)}%` : "2px";
    const label = document.createElement("span"); label.className = "bar-label"; label.textContent = index % 5 === 0 || index === series.length - 1 ? String(item.date.getUTCDate()) : "";
    wrap.append(bar); column.append(wrap, label); elements.trendChart.append(column);
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
    const spacer = document.createElement("span"); spacer.setAttribute("aria-hidden", "true"); elements.yearHeatmap.append(spacer);
  }
  series.forEach((item) => {
    const cell = document.createElement("i");
    const level = item.durationMs ? Math.max(1, Math.ceil(item.durationMs / maximum * 4)) : 0;
    cell.className = `level-${level}`;
    cell.title = `${item.key} · ${formatCompactDuration(item.durationMs)}`;
    elements.yearHeatmap.append(cell);
  });
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
  const summary = dashboardSummary(rows);
  elements.todayTotal.textContent = formatCompactDuration(summary.today);
  elements.weekTotal.textContent = formatCompactDuration(summary.week);
  elements.monthTotal.textContent = formatCompactDuration(summary.month);
  elements.yearTotal.textContent = formatCompactDuration(summary.year);
  elements.accountName.textContent = profile?.handle ? `@${profile.handle}` : "Time on X member";
  elements.profileHandle.textContent = profile?.handle ? `@${profile.handle}` : "Your synced account";
  elements.lastSynced.textContent = profile?.lastSyncedAt
    ? `Last synced ${new Date(profile.lastSyncedAt).toLocaleString()}`
    : "Daily totals are available; a sync timestamp was not recorded.";
  renderTrend(rows);
  renderHeatmap(rows);
}

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
