import { formatDuration } from "../lib/analytics.js";
import {
  STORAGE_KEY,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  createDefaultStore,
  normalizeStore,
} from "../lib/model.js";
import { applyThemePreference } from "../lib/theme.js";

const extensionApi = globalThis.chrome;
const elements = Object.fromEntries(["idleTimeout", "exportCsv", "exportJson", "importJson", "clearData", "toast"].map((id) => [id, document.getElementById(id)]));
let store = createDefaultStore();
let toastTimer;
let stopThemeObserver = () => {};
let themeInteractionRevision = 0;

function renderTheme() {
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === store.settings.theme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  stopThemeObserver();
  stopThemeObserver = applyThemePreference(store.settings.theme);
}

async function refresh() {
  const revisionAtStart = themeInteractionRevision;
  let nextStore;
  try {
    nextStore = normalizeStore(await extensionApi.runtime.sendMessage({ type: "X_TIME_GET_SNAPSHOT" }));
  } catch {
    const stored = await extensionApi?.storage?.local?.get([STORAGE_KEY, THEME_STORAGE_KEY]);
    nextStore = normalizeStore(stored?.[STORAGE_KEY]);
    const savedTheme = stored?.[THEME_STORAGE_KEY]
      || globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    if (THEME_OPTIONS.includes(savedTheme)) nextStore.settings.theme = savedTheme;
  }
  if (revisionAtStart !== themeInteractionRevision) {
    nextStore.settings.theme = store.settings.theme;
  }
  store = nextStore;
  elements.idleTimeout.value = String(store.settings.idleTimeoutSeconds);
  renderTheme();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

elements.idleTimeout.addEventListener("change", async () => {
  const result = await extensionApi.runtime.sendMessage({ type: "X_TIME_SET_IDLE_TIMEOUT", seconds: Number(elements.idleTimeout.value) });
  if (result?.ok) { await refresh(); showToast("Inactivity timeout updated"); }
});

document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", async () => {
  const previousTheme = store.settings.theme;
  const theme = button.dataset.themeChoice;
  if (!THEME_OPTIONS.includes(theme)) return;
  const revision = ++themeInteractionRevision;
  store.settings.theme = theme;
  renderTheme();
  try {
    let result;
    if (!extensionApi?.runtime?.sendMessage && !extensionApi?.storage?.local) {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
      result = { ok: true };
    } else {
      try {
        result = await extensionApi?.runtime?.sendMessage?.({ type: "X_TIME_SET_THEME", theme });
      } catch {
        result = null;
      }
    }
    if (!result?.ok && extensionApi?.storage?.local) {
      const stored = await extensionApi.storage.local.get(STORAGE_KEY);
      const current = normalizeStore(stored[STORAGE_KEY]);
      current.settings.theme = theme;
      await extensionApi.storage.local.set({
        [STORAGE_KEY]: current,
        [THEME_STORAGE_KEY]: theme,
      });
      result = { ok: true };
    }
    if (!result?.ok) throw new Error(result?.error || "Theme could not be saved.");
    showToast(`${theme[0].toUpperCase()}${theme.slice(1)} theme selected`);
  } catch (error) {
    if (revision === themeInteractionRevision) {
      store.settings.theme = previousTheme;
      renderTheme();
    }
    showToast(error.message || "Theme could not be saved");
  }
}));

elements.exportJson.addEventListener("click", () => download(`time-on-x-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "Time on X", exportedAt: new Date().toISOString(), version: store.version, settings: store.settings, sessions: store.sessions }, null, 2), "application/json"));
elements.exportCsv.addEventListener("click", () => {
  const rows = [["started", "ended", "duration_seconds"], ...store.sessions.map((session) => [new Date(session.s).toISOString(), new Date(session.e).toISOString(), Math.round((session.e - session.s) / 1000)])];
  download(`time-on-x-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv");
});
elements.importJson.addEventListener("change", async () => {
  const file = elements.importJson.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.sessions)) throw new Error("This is not a valid Time on X backup.");
    if (!confirm(`Replace your current history with ${parsed.sessions.length} imported visits?`)) return;
    const result = await extensionApi.runtime.sendMessage({ type: "X_TIME_IMPORT_DATA", sessions: parsed.sessions, settings: parsed.settings });
    if (!result?.ok) throw new Error("The backup could not be imported.");
    await refresh();
    showToast(`${result.count} visits restored (${formatDuration(store.sessions.reduce((sum, item) => sum + item.e - item.s, 0))})`);
  } catch (error) { alert(error.message || "The selected file could not be imported."); }
  finally { elements.importJson.value = ""; }
});
elements.clearData.addEventListener("click", async () => {
  if (!confirm("Permanently delete every recorded Time on X visit on this device?")) return;
  await extensionApi.runtime.sendMessage({ type: "X_TIME_CLEAR_DATA" });
  await refresh();
  showToast("All local Time on X history cleared");
});

extensionApi?.storage?.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const savedTheme = changes[THEME_STORAGE_KEY]?.newValue;
  if (changes[STORAGE_KEY]?.newValue) {
    const currentTheme = store.settings.theme;
    store = normalizeStore(changes[STORAGE_KEY].newValue);
    store.settings.theme = THEME_OPTIONS.includes(savedTheme)
      ? savedTheme
      : currentTheme;
    elements.idleTimeout.value = String(store.settings.idleTimeoutSeconds);
    renderTheme();
    return;
  }
  if (THEME_OPTIONS.includes(savedTheme)) {
    store.settings.theme = savedTheme;
    renderTheme();
  }
});
void refresh();
