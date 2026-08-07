import { aggregateLeaderboard } from "../global/periods.js";
import { subscribeLeaderboard } from "./shared/instant.js";
import { formatCompactDuration, periodDailySeries } from "./shared/data.js";

const elements = Object.fromEntries([
  "activeParticipants", "profileCount", "combinedTime", "metricPeriod",
  "averageTime", "periodLabel", "rankingList", "communityChart",
].map((id) => [id, document.getElementById(id)]));

let periodType = "daily";
let unsubscribe = () => {};

function initials(handle) {
  const avatar = document.createElement("span");
  avatar.className = "initial-avatar";
  avatar.textContent = String(handle || "?").slice(0, 1).toUpperCase();
  return avatar;
}

function renderChart(rows, period) {
  const series = periodDailySeries(rows, period);
  const maximum = Math.max(...series.map((item) => item.durationMs), 1);
  elements.communityChart.style.setProperty("--columns", String(series.length));
  elements.communityChart.replaceChildren();
  series.forEach((item, index) => {
    const column = document.createElement("div"); column.className = "bar-column";
    column.title = `${item.key} · ${formatCompactDuration(item.durationMs)} combined`;
    const wrap = document.createElement("div"); wrap.className = "bar-wrap";
    const bar = document.createElement("div"); bar.className = "bar"; bar.style.height = item.durationMs ? `${Math.max(2, item.durationMs / maximum * 100)}%` : "2px";
    if (series.length <= 12) { const value = document.createElement("span"); value.className = "bar-value"; value.textContent = formatCompactDuration(item.durationMs); bar.append(value); }
    const label = document.createElement("span"); label.className = "bar-label"; label.textContent = series.length <= 12 || index % 5 === 0 || index === series.length - 1 ? item.label : "";
    wrap.append(bar); column.append(wrap, label); elements.communityChart.append(column);
  });
}

function render(result) {
  if (result.error) {
    elements.rankingList.innerHTML = '<p class="empty-copy">The rankings are temporarily unavailable.</p>';
    return;
  }
  const data = result.data || { profiles: [], dailyTotals: [] };
  const rows = aggregateLeaderboard(data.profiles || [], data.dailyTotals || [], result.period);
  const combined = rows.reduce((sum, row) => sum + row.durationMs, 0);
  elements.activeParticipants.textContent = String(rows.length);
  elements.profileCount.textContent = `${data.profiles?.length || 0} consented ${(data.profiles?.length || 0) === 1 ? "profile" : "profiles"}`;
  elements.combinedTime.textContent = formatCompactDuration(combined);
  elements.averageTime.textContent = formatCompactDuration(rows.length ? combined / rows.length : 0);
  elements.periodLabel.textContent = result.period.label;
  elements.metricPeriod.textContent = result.period.label;
  elements.rankingList.replaceChildren();
  if (!rows.length) elements.rankingList.innerHTML = '<p class="empty-copy">No published time in this period yet.</p>';
  const maximum = Math.max(...rows.map((row) => row.durationMs), 1);
  rows.forEach((item) => {
    const row = document.createElement("a");
    row.className = `ranking-row rank-${item.rank}`;
    row.style.setProperty("--bar", `${item.durationMs / maximum * 100}%`);
    row.href = `https://x.com/${encodeURIComponent(item.handle)}`;
    row.target = "_blank"; row.rel = "noopener noreferrer";
    const rank = document.createElement("span"); rank.className = "ranking-rank"; rank.textContent = `#${item.rank}`;
    const person = document.createElement("span"); person.className = "ranking-person"; person.append(initials(item.handle));
    const copy = document.createElement("div"); const name = document.createElement("strong"); name.textContent = `@${item.handle}`; const badge = document.createElement("span"); badge.className = "unverified-chip"; badge.textContent = "UNVERIFIED"; name.append(badge); const note = document.createElement("small"); note.textContent = "Self-declared profile"; copy.append(name, note); person.append(copy);
    const duration = document.createElement("strong"); duration.className = "ranking-duration"; duration.textContent = formatCompactDuration(item.durationMs);
    row.append(rank, person, duration); elements.rankingList.append(row);
  });
  renderChart(data.dailyTotals || [], result.period);
}

function subscribe() {
  unsubscribe();
  document.querySelectorAll("[data-period]").forEach((button) => {
    const active = button.dataset.period === periodType;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  unsubscribe = subscribeLeaderboard(periodType, render);
}

document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => {
  periodType = button.dataset.period;
  subscribe();
}));

subscribe();
