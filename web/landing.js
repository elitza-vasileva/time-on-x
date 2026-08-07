import { aggregateLeaderboard, leaderboardPeriod } from "../global/periods.js";
import { subscribeLeaderboard } from "./shared/instant.js";
import { formatCompactDuration } from "./shared/data.js";

const elements = Object.fromEntries(
  ["liveParticipants", "liveTime", "liveAverage", "liveStatus", "landingLeaderboard"]
    .map((id) => [id, document.getElementById(id)]),
);

function renderInitials(handle) {
  const avatar = document.createElement("span");
  avatar.className = "initial-avatar";
  avatar.textContent = String(handle || "?").slice(0, 1).toUpperCase();
  return avatar;
}

function renderLandingBoard(result) {
  if (result.error) {
    elements.liveStatus.textContent = "The public board is temporarily unavailable.";
    elements.landingLeaderboard.innerHTML = '<p class="empty-copy">Rankings will be back shortly.</p>';
    return;
  }
  const data = result.data || { profiles: [], dailyTotals: [] };
  const period = result.period || leaderboardPeriod("daily");
  const rows = aggregateLeaderboard(data.profiles || [], data.dailyTotals || [], period);
  const combined = rows.reduce((sum, row) => sum + row.durationMs, 0);
  elements.liveParticipants.textContent = String(rows.length);
  elements.liveTime.textContent = formatCompactDuration(combined);
  elements.liveAverage.textContent = formatCompactDuration(rows.length ? combined / rows.length : 0);
  elements.liveStatus.textContent = rows.length ? "Live from consented daily totals" : "The board is ready for its first participant";
  elements.landingLeaderboard.replaceChildren();
  if (!rows.length) {
    elements.landingLeaderboard.innerHTML = '<p class="empty-copy">No published time today yet.</p>';
    return;
  }
  rows.slice(0, 5).forEach((item) => {
    const link = document.createElement("a");
    link.className = "preview-row";
    link.href = `https://x.com/${encodeURIComponent(item.handle)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const rank = document.createElement("strong"); rank.textContent = `#${item.rank}`;
    const person = document.createElement("span"); person.className = "preview-person"; person.append(renderInitials(item.handle));
    const copy = document.createElement("span"); const handle = document.createElement("b"); handle.textContent = `@${item.handle}`; const note = document.createElement("small"); note.textContent = "Self-declared"; copy.append(handle, note); person.append(copy);
    const duration = document.createElement("b"); duration.textContent = formatCompactDuration(item.durationMs);
    link.append(rank, person, duration); elements.landingLeaderboard.append(link);
  });
}

subscribeLeaderboard("daily", renderLandingBoard);

const heatmap = document.querySelector(".mini-heatmap");
for (let index = 0; index < 126; index += 1) {
  const cell = document.createElement("i");
  cell.style.setProperty("--level", String((index * 7 + index % 5) % 5));
  heatmap.append(cell);
}
