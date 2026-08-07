import { formatDuration } from "../lib/analytics.js";
import { STORAGE_KEY, createDefaultStore, normalizeStore } from "../lib/model.js";
import { applyThemePreference } from "../lib/theme.js";
import { aggregateLeaderboard, communitySeries, normalizeHandle } from "../global/periods.js";
import { CONSENT_VERSION, getProfileForOwner, globalErrorMessage, isGlobalLeaderboardConfigured, joinGlobalLeaderboard, leaveGlobalLeaderboard, lookupXProfile, sendLoginCode, signInWithCode, signOutGlobal, subscribeGlobalAuth, subscribeLeaderboard } from "../global/leaderboard-client.js";

const extensionApi = globalThis.chrome;
const ids = ["activeParticipants", "combinedTime", "averageTime", "periodLabel", "participantCount", "communityChart", "leaderboardRows", "leaderboardEmpty", "participationIntro", "setupState", "signedOutState", "claimState", "joinedState", "emailForm", "email", "codeForm", "code", "claimForm", "handle", "lookupProfile", "profilePreview", "consent", "claimSignOut", "currentProfile", "syncStatus", "syncNow", "leave", "signOut", "accountMessage", "chartTooltip"];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let store = createDefaultStore();
let periodType = "daily";
let period;
let data = { profiles: [], dailyTotals: [] };
let user = null;
let profile = null;
let pendingEmail = "";
let pendingXProfile = null;
let unsubscribeBoard = () => {};
let stopThemeObserver = () => {};

function avatarFor(item) {
  if (/^https:\/\//.test(item.avatarUrl || "")) {
    const image = document.createElement("img");
    image.className = "leaderboard-avatar";
    image.src = item.avatarUrl;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    return image;
  }
  const avatar = document.createElement("span");
  avatar.className = "leaderboard-avatar";
  avatar.textContent = String(item.handle || "X").slice(0, 1).toUpperCase();
  return avatar;
}

function renderProfile(container, item) {
  container.replaceChildren(avatarFor(item));
  const copy = document.createElement("div"); copy.className = "profile-copy";
  const name = document.createElement("strong"); name.textContent = item.displayName || item.handle;
  const handle = document.createElement("span"); handle.textContent = `@${item.handle}`;
  copy.append(name, handle); container.append(copy);
}

function renderBoard() {
  if (!period) return;
  const rows = aggregateLeaderboard(data.profiles || [], data.dailyTotals || [], period, profile?.publicId || "");
  const combined = rows.reduce((sum, row) => sum + row.durationMs, 0);
  elements.periodLabel.textContent = period.label;
  elements.participantCount.textContent = `${data.profiles?.length || 0} ${(data.profiles?.length || 0) === 1 ? "profile" : "profiles"}`;
  elements.activeParticipants.textContent = String(rows.length);
  elements.combinedTime.textContent = formatDuration(combined);
  elements.averageTime.textContent = formatDuration(rows.length ? combined / rows.length : 0);
  elements.leaderboardRows.replaceChildren();
  elements.leaderboardEmpty.hidden = rows.length > 0;
  const maximum = Math.max(...rows.map((row) => row.durationMs), 1);
  rows.forEach((item) => {
    const row = document.createElement("a");
    row.className = `leaderboard-row rank-${item.rank}${item.isCurrentUser ? " is-current" : ""}`;
    row.style.setProperty("--leaderboard-bar", `${item.durationMs / maximum * 100}%`);
    row.href = `https://x.com/${encodeURIComponent(item.handle)}`;
    row.target = "_blank";
    row.rel = "noopener noreferrer";
    row.setAttribute("aria-label", `Open ${item.displayName || `@${item.handle}`} on X`);
    const rank = document.createElement("span"); rank.className = "leaderboard-rank"; rank.textContent = `#${item.rank}`;
    const person = document.createElement("div"); person.className = "leaderboard-person"; person.append(avatarFor(item));
    const copy = document.createElement("div"); const name = document.createElement("strong"); name.textContent = item.displayName || item.handle; const note = document.createElement("span"); note.textContent = `@${item.handle}${item.isCurrentUser ? " · you" : ""}`; copy.append(name, note); person.append(copy);
    const duration = document.createElement("strong"); duration.className = "leaderboard-duration"; duration.textContent = formatDuration(item.durationMs);
    row.append(rank, person, duration); elements.leaderboardRows.append(row);
  });
  renderCommunityChart();
}

function completeCommunitySeries() {
  const source = new Map(communitySeries(data.dailyTotals || [], period).map((item) => [item.key, item.durationMs]));
  const rows = [];
  if (period.type === "yearly") {
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(Date.UTC(new Date(period.start).getUTCFullYear(), month, 1));
      const key = date.toISOString().slice(0, 7);
      rows.push({ key, label: date.toLocaleDateString(undefined, { timeZone: "UTC", month: "short" }), durationMs: source.get(key) || 0 });
    }
    return rows;
  }
  for (let time = period.start; time < period.end; time += 86_400_000) {
    const date = new Date(time); const key = date.toISOString().slice(0, 10);
    const label = period.type === "weekly" ? date.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short" }) : period.type === "daily" ? "Today" : String(date.getUTCDate());
    rows.push({ key, label, durationMs: source.get(key) || 0 });
  }
  return rows;
}

function renderCommunityChart() {
  const rows = completeCommunitySeries();
  const maximum = Math.max(...rows.map((row) => row.durationMs), 1);
  elements.communityChart.replaceChildren();
  rows.forEach((item) => {
    const column = document.createElement("div"); column.className = "community-column";
    const detail = `${item.key} · ${formatDuration(item.durationMs)} combined`;
    column.title = detail; column.setAttribute("aria-label", detail);
    column.addEventListener("mouseenter", (event) => showTooltip(event, detail)); column.addEventListener("mousemove", positionTooltip); column.addEventListener("mouseleave", hideTooltip);
    const wrap = document.createElement("div"); wrap.className = "community-bar-wrap"; const bar = document.createElement("div"); bar.className = "community-bar"; bar.style.height = item.durationMs ? `${Math.max(3, item.durationMs / maximum * 100)}%` : "2px"; wrap.append(bar);
    const label = document.createElement("span"); label.className = "community-label"; label.textContent = item.label; column.append(wrap, label); elements.communityChart.append(column);
  });
}

function showTooltip(event, text) { elements.chartTooltip.textContent = text; elements.chartTooltip.classList.add("is-visible"); positionTooltip(event); }
function positionTooltip(event) { elements.chartTooltip.style.left = `${Math.min(innerWidth - elements.chartTooltip.offsetWidth - 12, event.clientX + 14)}px`; elements.chartTooltip.style.top = `${Math.min(innerHeight - elements.chartTooltip.offsetHeight - 12, event.clientY + 14)}px`; }
function hideTooltip() { elements.chartTooltip.classList.remove("is-visible"); }

function subscribeToBoard() {
  unsubscribeBoard();
  document.querySelectorAll("[data-period]").forEach((button) => { const active = button.dataset.period === periodType; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
  unsubscribeBoard = subscribeLeaderboard(periodType, (result) => { if (result.error) return setMessage(globalErrorMessage(result.error)); period = result.period; data = result.data || { profiles: [], dailyTotals: [] }; renderBoard(); });
}

function renderAccount() {
  const configured = isGlobalLeaderboardConfigured();
  const participating = profile?.public && profile.consentVersion === CONSENT_VERSION;
  elements.participationIntro.hidden = Boolean(participating) || !configured;
  elements.setupState.hidden = configured;
  elements.signedOutState.hidden = !configured || Boolean(user);
  elements.claimState.hidden = !configured || !user || Boolean(participating);
  elements.joinedState.hidden = !configured || !user || !participating;
  elements.codeForm.hidden = !pendingEmail;
  if (profile && !participating && !elements.handle.value) elements.handle.value = profile.handle || "";
  if (participating) { renderProfile(elements.currentProfile, profile); elements.syncStatus.textContent = profile.lastSyncedAt ? `Last synced ${new Date(profile.lastSyncedAt).toLocaleString()}. Daily totals use UTC.` : "Your totals have not synced yet."; }
}
function setMessage(message = "", success = false) { elements.accountMessage.textContent = message; elements.accountMessage.classList.toggle("is-success", success); }

async function previewXProfile() {
  const handle = normalizeHandle(elements.handle.value);
  if (!handle) throw new Error("Enter a valid X handle.");
  setMessage("Looking up that public X profile…", true);
  elements.lookupProfile.disabled = true;
  try {
    pendingXProfile = await lookupXProfile(handle);
    renderProfile(elements.profilePreview, pendingXProfile);
    elements.profilePreview.hidden = false;
    setMessage(pendingXProfile.profileFetched ? "Profile found. Confirm consent to join." : "Profile lookup is not configured yet; your handle and initial will be used.", true);
    return pendingXProfile;
  } finally {
    elements.lookupProfile.disabled = false;
  }
}

async function syncNow(feedback = true) {
  if (!profile) return;
  if (feedback) setMessage("Syncing this year's daily totals…", true);
  try { const result = await extensionApi.runtime.sendMessage({ type: "X_TIME_SYNC_GLOBAL" }); if (!result?.ok) throw new Error(`Sync unavailable: ${result?.reason || "unknown error"}.`); profile = { ...profile, lastSyncedAt: result.syncedAt || Date.now() }; renderAccount(); if (feedback) setMessage("Public totals are up to date.", true); }
  catch (error) { setMessage(globalErrorMessage(error)); }
}

document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => { periodType = button.dataset.period; subscribeToBoard(); }));
elements.emailForm.addEventListener("submit", async (event) => { event.preventDefault(); setMessage("Sending your login code…", true); try { pendingEmail = elements.email.value.trim(); await sendLoginCode(pendingEmail); renderAccount(); elements.code.focus(); setMessage("Code sent. Check your inbox.", true); } catch (error) { pendingEmail = ""; setMessage(globalErrorMessage(error)); } });
elements.codeForm.addEventListener("submit", async (event) => { event.preventDefault(); setMessage("Verifying code…", true); try { await signInWithCode(pendingEmail, elements.code.value); pendingEmail = ""; elements.code.value = ""; setMessage("Signed in. Add your public handle.", true); } catch (error) { setMessage(globalErrorMessage(error)); } });
elements.handle.addEventListener("input", () => { pendingXProfile = null; elements.profilePreview.hidden = true; });
elements.lookupProfile.addEventListener("click", () => void previewXProfile().catch((error) => setMessage(globalErrorMessage(error))));
elements.claimForm.addEventListener("submit", async (event) => { event.preventDefault(); setMessage("Creating your public profile…", true); try { const handle = normalizeHandle(elements.handle.value); const selectedProfile = pendingXProfile?.handle.toLowerCase() === handle?.toLowerCase() ? pendingXProfile : await previewXProfile(); profile = await joinGlobalLeaderboard(selectedProfile, elements.consent.checked); renderAccount(); renderBoard(); await syncNow(false); setMessage("You joined the public rankings.", true); } catch (error) { setMessage(globalErrorMessage(error)); } });
elements.syncNow.addEventListener("click", () => void syncNow(true));
elements.leave.addEventListener("click", async () => { if (!confirm("Leave the public rankings and permanently delete your public handle and totals? Your local history will stay on this device.")) return; try { await leaveGlobalLeaderboard(); profile = null; renderAccount(); renderBoard(); setMessage("Your public profile and totals were deleted.", true); } catch (error) { setMessage(globalErrorMessage(error)); } });
async function signOut() { try { await signOutGlobal(); user = null; profile = null; renderAccount(); renderBoard(); setMessage("Signed out on this device.", true); } catch (error) { setMessage(globalErrorMessage(error)); } }
elements.signOut.addEventListener("click", () => void signOut()); elements.claimSignOut.addEventListener("click", () => void signOut());

async function start() {
  try { store = normalizeStore(await extensionApi.runtime.sendMessage({ type: "X_TIME_GET_SNAPSHOT" })); } catch { const stored = await extensionApi?.storage?.local?.get(STORAGE_KEY); store = normalizeStore(stored?.[STORAGE_KEY]); }
  stopThemeObserver(); stopThemeObserver = applyThemePreference(store.settings.theme);
  subscribeToBoard(); renderAccount();
  subscribeGlobalAuth(async (auth) => { if (auth?.error) return setMessage(globalErrorMessage(auth.error)); user = auth?.user || null; profile = user ? await getProfileForOwner(user.id).catch((error) => { setMessage(globalErrorMessage(error)); return null; }) : null; renderAccount(); renderBoard(); if (profile?.consentVersion === CONSENT_VERSION) void syncNow(false); });
}
extensionApi?.storage?.onChanged.addListener((changes, areaName) => { if (areaName === "local" && changes[STORAGE_KEY]?.newValue) { store = normalizeStore(changes[STORAGE_KEY].newValue); stopThemeObserver(); stopThemeObserver = applyThemePreference(store.settings.theme); } });
void start();
