import {
  dailyTotals,
  dateInputValue,
  formatDuration,
  hourlyTotals,
  localDayBounds,
  parseLocalDate,
  relatableComparison,
  sessionsWithin,
  totalBetween,
  weeklyTotals,
} from "../lib/analytics.js";
import { STORAGE_KEY, createDefaultStore, normalizeStore } from "../lib/model.js";
import { applyThemePreference } from "../lib/theme.js";

const elements = Object.fromEntries(
  [
    "trackingStatus", "todayTotal", "todayContext", "weekTotal", "averageTotal",
    "allTimeTotal", "sessionCount", "selectedDayTitle", "datePicker", "hourlyChart",
    "selectedDayTotal", "timeline", "dailyChart", "trendTitle", "trendRangeLabel",
    "trendComparison", "trendTotal", "trend7Days", "trend30Days", "trend12Weeks",
    "previousTrendPeriod", "nextTrendPeriod", "previousDay", "nextDay", "todayButton",
    "heatmapYearTotal", "heatmapMonths", "heatmapGrid", "sharePeriod",
    "shareCustomDates", "shareStartDate", "shareEndDate", "generateShareCard",
    "shareDialog", "closeShareDialog", "shareCanvas", "downloadShareCard",
    "shareCardOnX", "chartTooltip", "toast",
  ].map((id) => [id, document.getElementById(id)]),
);

let store = createDefaultStore();
let selectedDate = new Date();
let trendRange = "7d";
let trendPageOffset = 0;
let generatedShareCard = null;
let toastTimer;
let stopThemeObserver = () => {};
const extensionApi = globalThis.chrome;

const TREND_RANGES = {
  "7d": { title: "7-day trend", bucketCount: 7, pageDays: 7, bucket: "day" },
  "30d": { title: "30-day trend", bucketCount: 30, pageDays: 30, bucket: "day" },
  "12w": { title: "12-week trend", bucketCount: 12, pageDays: 84, bucket: "week" },
};

async function refresh() {
  if (!extensionApi?.runtime?.sendMessage) {
    store = createPreviewStore();
    render();
    return;
  }
  try {
    store = normalizeStore(await extensionApi.runtime.sendMessage({ type: "X_TIME_GET_SNAPSHOT" }));
  } catch {
    const stored = await extensionApi.storage.local.get(STORAGE_KEY);
    store = normalizeStore(stored[STORAGE_KEY]);
  }
  render();
}

function render() {
  renderStatus();
  renderSummary();
  renderSelectedDay();
  renderTrend();
  renderHeatmap();
  stopThemeObserver();
  stopThemeObserver = applyThemePreference(store.settings.theme);
}

function renderStatus() {
  const trackingNow =
    store.tracking && Date.now() - store.tracking.lastSeenAt <= 15_000;
  elements.trackingStatus.classList.toggle("is-tracking", Boolean(trackingNow));
  elements.trackingStatus.classList.toggle("is-paused", !trackingNow);
  elements.trackingStatus.querySelector("span:last-child").textContent = trackingNow
    ? "Tracking active X tab"
    : "Not tracking";
}

function renderSummary() {
  const today = localDayBounds();
  const todayMs = totalBetween(store.sessions, today.start, today.end);
  const sevenDays = dailyTotals(store.sessions, new Date(), 7);
  const thirtyDays = dailyTotals(store.sessions, new Date(), 30);
  const allTimeMs = store.sessions.reduce((sum, session) => sum + (session.e - session.s), 0);

  elements.todayTotal.textContent = formatDuration(todayMs);
  elements.weekTotal.textContent = formatDuration(
    sevenDays.reduce((sum, day) => sum + day.duration, 0),
  );
  elements.averageTotal.textContent = formatDuration(
    thirtyDays.reduce((sum, day) => sum + day.duration, 0) / 30,
  );
  elements.allTimeTotal.textContent = formatDuration(allTimeMs);
  elements.sessionCount.textContent = `${store.sessions.length} ${store.sessions.length === 1 ? "visit" : "visits"} recorded`;
  elements.todayContext.textContent = store.tracking ? "Counting active time on X now" : "Your active time on X";
}

function renderSelectedDay() {
  elements.datePicker.value = dateInputValue(selectedDate);
  const todayValue = dateInputValue(new Date());
  const selectedValue = dateInputValue(selectedDate);
  elements.nextDay.disabled = selectedValue >= todayValue;
  elements.selectedDayTitle.textContent = selectedValue === todayValue
    ? "Today"
    : selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const bounds = localDayBounds(selectedDate);
  const selectedSessions = sessionsWithin(store.sessions, bounds.start, bounds.end);
  const selectedTotal = totalBetween(store.sessions, bounds.start, bounds.end);
  elements.selectedDayTotal.textContent = formatDuration(selectedTotal);
  renderHourlyChart(hourlyTotals(store.sessions, selectedDate));
  renderTimeline(selectedSessions, bounds);
}

function renderHourlyChart(totals) {
  elements.hourlyChart.replaceChildren();
  const max = Math.max(...totals, 1);
  totals.forEach((duration, hour) => {
    const column = document.createElement("div");
    column.className = "hour-column";
    const detail = `${String(hour).padStart(2, "0")}:00–${String(hour + 1).padStart(2, "0")}:00 · ${formatDuration(duration)}`;
    column.setAttribute("aria-label", detail);
    attachTooltip(column, detail);

    const wrap = document.createElement("div");
    wrap.className = "hour-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "hour-bar";
    bar.style.height = duration > 0 ? `${Math.max(3, (duration / max) * 100)}%` : "0";
    wrap.append(bar);

    const label = document.createElement("span");
    label.className = "hour-label";
    label.textContent = hour % 3 === 0 ? String(hour).padStart(2, "0") : "";
    column.append(wrap, label);
    elements.hourlyChart.append(column);
  });
}

function renderTimeline(sessions, bounds) {
  elements.timeline.replaceChildren();
  const dayLength = bounds.end - bounds.start;
  sessions.forEach((session) => {
    const segment = document.createElement("div");
    segment.className = "timeline-session";
    segment.style.left = `${((session.clippedStart - bounds.start) / dayLength) * 100}%`;
    segment.style.width = `${((session.clippedEnd - session.clippedStart) / dayLength) * 100}%`;
    const detail = `${formatTime(session.clippedStart)}–${formatTime(session.clippedEnd)} · ${formatDuration(session.clippedEnd - session.clippedStart)}`;
    segment.setAttribute("aria-label", detail);
    attachTooltip(segment, detail);
    elements.timeline.append(segment);
  });
}

function renderTrend() {
  const config = TREND_RANGES[trendRange];
  const anchor = trendAnchor(config, trendPageOffset);
  const previousAnchor = new Date(anchor);
  previousAnchor.setDate(previousAnchor.getDate() - config.pageDays);
  const buckets = config.bucket === "week"
    ? weeklyTotals(store.sessions, anchor, config.bucketCount)
    : dailyTotals(store.sessions, anchor, config.bucketCount);
  const previousBuckets = config.bucket === "week"
    ? weeklyTotals(store.sessions, previousAnchor, config.bucketCount)
    : dailyTotals(store.sessions, previousAnchor, config.bucketCount);
  const total = buckets.reduce((sum, bucket) => sum + bucket.duration, 0);
  const previousTotal = previousBuckets.reduce((sum, bucket) => sum + bucket.duration, 0);
  const max = Math.max(...buckets.map((bucket) => bucket.duration), 1);

  elements.trendTitle.textContent = config.title;
  elements.trendRangeLabel.textContent = formatTrendRange(
    buckets[0].start,
    buckets[buckets.length - 1].end,
  );
  elements.trendTotal.textContent = formatDuration(total);
  elements.trendComparison.textContent = comparisonText(total, previousTotal);
  elements.nextTrendPeriod.disabled = trendPageOffset >= 0;

  const buttonRanges = [
    [elements.trend7Days, "7d"],
    [elements.trend30Days, "30d"],
    [elements.trend12Weeks, "12w"],
  ];
  buttonRanges.forEach(([button, range]) => {
    const active = range === trendRange;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  elements.dailyChart.className = `daily-chart range-${trendRange === "12w" ? "12w" : config.bucketCount}`;
  elements.dailyChart.replaceChildren();
  buckets.forEach((bucket) => {
    const column = document.createElement("div");
    const isToday = config.bucket === "day" && dateInputValue(bucket.date) === dateInputValue();
    column.className = `day-column${isToday ? " is-today" : ""}`;
    const detail = config.bucket === "week"
      ? `${formatTrendRange(bucket.start, bucket.end)} · ${formatDuration(bucket.duration)}`
      : `${bucket.date.toLocaleDateString()} · ${formatDuration(bucket.duration)}`;
    column.setAttribute("aria-label", detail);
    attachTooltip(column, detail);
    const wrap = document.createElement("div");
    wrap.className = "day-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "day-bar";
    bar.style.height = bucket.duration > 0 ? `${Math.max(2, (bucket.duration / max) * 100)}%` : "0";
    const value = document.createElement("span");
    value.className = "day-value";
    value.textContent = `${Math.round(bucket.duration / 60_000)} min`;
    bar.append(value);
    wrap.append(bar);
    const label = document.createElement("span");
    label.className = "day-label";
    renderTrendBucketLabel(label, bucket, config);
    column.append(wrap, label);
    elements.dailyChart.append(column);
  });
}

function trendAnchor(config, pageOffset) {
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + pageOffset * config.pageDays);
  return anchor;
}

function renderTrendBucketLabel(label, bucket, config) {
  if (config.bucket === "week") {
    label.textContent = bucket.date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return;
  }

  label.classList.add("day-label-date");
  const weekday = document.createElement("span");
  weekday.className = "day-weekday";
  weekday.textContent = bucket.date.toLocaleDateString(undefined, {
    weekday: "short",
  });
  const date = document.createElement("span");
  date.className = "day-date-number";
  date.textContent = bucket.date.toLocaleDateString(undefined, {
    day: "numeric",
  });
  label.append(weekday, date);
}

function formatTrendRange(start, end) {
  const first = new Date(start);
  const last = new Date(end - 1);
  const firstText = first.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const lastText = last.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${firstText} – ${lastText}`;
}

function comparisonText(current, previous) {
  if (previous === 0 && current === 0) return "No activity in either period";
  if (previous === 0) return "New activity compared with the previous period";
  const percent = Math.round((Math.abs(current - previous) / previous) * 100);
  if (percent === 0) return "About the same as the previous period";
  return `${percent}% ${current > previous ? "more" : "less"} than the previous period`;
}

function renderHeatmap() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + ((7 - today.getDay()) % 7));
  const days = dailyTotals(store.sessions, endSunday, 53 * 7);
  const todayBounds = localDayBounds(today);
  const visibleDays = days.filter((day) => day.start < todayBounds.end);
  const max = Math.max(...visibleDays.map((day) => day.duration), 1);
  const total = visibleDays.reduce((sum, day) => sum + day.duration, 0);

  elements.heatmapYearTotal.textContent = `${formatDuration(total)} in 12 months`;
  elements.heatmapGrid.replaceChildren();
  elements.heatmapMonths.replaceChildren();

  let lastMonthKey = "";
  days.forEach((day, index) => {
    const cell = document.createElement("div");
    const future = day.start >= todayBounds.end;
    const ratio = day.duration / max;
    const level = day.duration === 0 ? 0 : ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
    cell.className = `heat-cell level-${level}${future ? " is-future" : ""}`;
    const detail = future
      ? `${day.date.toLocaleDateString()} · future date`
      : `${day.date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · ${formatDuration(day.duration)}`;
    cell.setAttribute("aria-label", detail);
    attachTooltip(cell, detail);
    elements.heatmapGrid.append(cell);

    const monthKey = `${day.date.getFullYear()}-${day.date.getMonth()}`;
    if (monthKey !== lastMonthKey && day.date.getDate() <= 7) {
      const month = document.createElement("span");
      month.className = "heatmap-month-label";
      month.textContent = day.date.toLocaleDateString(undefined, { month: "short" });
      month.style.left = `${Math.floor(index / 7) * 16}px`;
      elements.heatmapMonths.append(month);
      lastMonthKey = monthKey;
    }
  });
}

function attachTooltip(target, text) {
  target.title = text;
  target.addEventListener("mouseenter", (event) => showChartTooltip(event, text));
  target.addEventListener("mousemove", (event) => positionChartTooltip(event));
  target.addEventListener("mouseleave", hideChartTooltip);
}

function showChartTooltip(event, text) {
  elements.chartTooltip.textContent = text;
  elements.chartTooltip.classList.add("is-visible");
  positionChartTooltip(event);
}

function positionChartTooltip(event) {
  const padding = 12;
  const width = elements.chartTooltip.offsetWidth;
  const height = elements.chartTooltip.offsetHeight;
  const left = Math.min(window.innerWidth - width - padding, event.clientX + 14);
  const top = Math.max(padding, Math.min(window.innerHeight - height - padding, event.clientY + 14));
  elements.chartTooltip.style.left = `${left}px`;
  elements.chartTooltip.style.top = `${top}px`;
}

function hideChartTooltip() {
  elements.chartTooltip.classList.remove("is-visible");
}

function formatTime(timestamp, seconds = false) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
  });
}

function shiftSelectedDay(amount) {
  selectedDate.setDate(selectedDate.getDate() + amount);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (selectedDate > today) selectedDate = today;
  renderSelectedDay();
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function exportJson() {
  const backup = {
    format: "time-on-x-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: store.settings,
    sessions: store.sessions,
  };
  download(
    `time-on-x-backup-${dateInputValue()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json",
  );
  showToast("JSON backup downloaded");
}

function exportCsv() {
  const rows = ["start_local,end_local,start_iso,end_iso,duration_seconds"];
  store.sessions.forEach((session) => {
    rows.push([
      csvCell(new Date(session.s).toLocaleString()),
      csvCell(new Date(session.e).toLocaleString()),
      new Date(session.s).toISOString(),
      new Date(session.e).toISOString(),
      Math.round((session.e - session.s) / 1000),
    ].join(","));
  });
  download(`time-on-x-sessions-${dateInputValue()}.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  showToast("CSV export downloaded");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function buildShareCardData() {
  const today = new Date();
  const todayBounds = localDayBounds(today);
  const period = elements.sharePeriod.value;
  let start;
  let end;
  let periodLabel;

  if (period === "today") {
    ({ start, end } = todayBounds);
    periodLabel = `Today · ${today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  } else if (period === "custom") {
    if (!elements.shareStartDate.value || !elements.shareEndDate.value) {
      throw new Error("Choose both custom dates first.");
    }
    start = localDayBounds(parseLocalDate(elements.shareStartDate.value)).start;
    end = localDayBounds(parseLocalDate(elements.shareEndDate.value)).end;
    if (start >= end) throw new Error("The start date must be before or equal to the end date.");
    if (end > todayBounds.end) throw new Error("The custom period cannot end in the future.");
    periodLabel = formatTrendRange(start, end);
  } else {
    const dayCount = period === "7d" ? 7 : 30;
    const days = dailyTotals(store.sessions, today, dayCount);
    start = days[0].start;
    end = days[days.length - 1].end;
    periodLabel = period === "7d" ? "Last 7 days" : "Last 30 days";
  }

  const total = totalBetween(store.sessions, start, end);
  const rawSeries = period === "today"
    ? hourlyTotals(store.sessions, today)
    : dailySeriesBetween(start, end);
  const periodDays = period === "today" ? 1 : rawSeries.length;
  const previousStartDate = new Date(start);
  previousStartDate.setDate(previousStartDate.getDate() - periodDays);
  const previousTotal = totalBetween(store.sessions, previousStartDate.getTime(), start);
  const series = compactSeries(rawSeries, 30);
  const lead = period === "today" ? "Today, I spent" : "In this period, I spent";
  const compactDuration = formatDuration(total, { compact: true });
  const fun = relatableComparison(total);
  return {
    total,
    series,
    periodLabel,
    lead,
    compactDuration,
    fun,
    comparison: comparisonText(total, previousTotal),
    shareText: `${lead} ${compactDuration} on X. ${fun} #TimeOnX`,
    filename: `time-on-x-${dateInputValue(new Date(end - 1))}.png`,
  };
}

function dailySeriesBetween(start, end) {
  const series = [];
  const cursor = new Date(start);
  while (cursor.getTime() < end && series.length < 4_000) {
    const bounds = localDayBounds(cursor);
    series.push(totalBetween(store.sessions, bounds.start, Math.min(bounds.end, end)));
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

function compactSeries(series, maximumBars) {
  if (series.length <= maximumBars) return series;
  const groupSize = Math.ceil(series.length / maximumBars);
  const compacted = [];
  for (let index = 0; index < series.length; index += groupSize) {
    compacted.push(
      series.slice(index, index + groupSize).reduce((sum, value) => sum + value, 0),
    );
  }
  return compacted;
}

function drawShareCard(data) {
  const canvas = elements.shareCanvas;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#171522");
  background.addColorStop(0.58, "#241d39");
  background.addColorStop(1, "#4c3db5");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(130, 111, 239, .2)";
  context.beginPath();
  context.arc(1060, 80, 260, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, .05)";
  context.beginPath();
  context.arc(1030, 610, 330, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(64, 54, 64, 64, 18);
  context.fill();
  context.fillStyle = "#171522";
  context.font = "800 31px Arial, sans-serif";
  context.fillText("X", 84, 97);
  context.fillStyle = "#ffffff";
  context.font = "800 25px Arial, sans-serif";
  context.fillText("TIME ON X", 150, 86);
  context.fillStyle = "#aaa2bb";
  context.font = "600 15px Arial, sans-serif";
  context.fillText(data.periodLabel, 150, 110);

  context.fillStyle = "#bdb3ff";
  context.font = "800 18px Arial, sans-serif";
  context.fillText(data.lead.toUpperCase(), 64, 190);
  context.fillStyle = "#ffffff";
  context.font = "800 94px Arial, sans-serif";
  context.fillText(data.compactDuration, 58, 282);
  context.fillStyle = "#ffffff";
  context.font = "700 27px Arial, sans-serif";
  context.fillText("on X", 66, 323);

  context.fillStyle = "#c8c1d2";
  context.font = "600 20px Arial, sans-serif";
  drawWrappedText(context, data.fun, 64, 370, 650, 29);
  context.fillStyle = "#9f94ea";
  context.font = "700 16px Arial, sans-serif";
  context.fillText(data.comparison, 64, 426);

  const chartX = 64;
  const chartY = 472;
  const chartWidth = 1072;
  const chartHeight = 120;
  context.strokeStyle = "rgba(255,255,255,.15)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(chartX, chartY + chartHeight);
  context.lineTo(chartX + chartWidth, chartY + chartHeight);
  context.stroke();
  const max = Math.max(...data.series, 1);
  const gap = Math.max(4, Math.min(10, chartWidth / data.series.length * 0.2));
  const barWidth = (chartWidth - gap * (data.series.length - 1)) / data.series.length;
  const barGradient = context.createLinearGradient(0, chartY, 0, chartY + chartHeight);
  barGradient.addColorStop(0, "#b8aaff");
  barGradient.addColorStop(1, "#715ee7");
  context.fillStyle = barGradient;
  data.series.forEach((value, index) => {
    if (value <= 0) return;
    const barHeight = Math.max(5, (value / max) * chartHeight);
    const x = chartX + index * (barWidth + gap);
    const y = chartY + chartHeight - barHeight;
    context.beginPath();
    context.roundRect(x, y, Math.max(2, barWidth), barHeight, Math.min(7, barWidth / 2));
    context.fill();
  });

  context.fillStyle = "#aaa2bb";
  context.font = "600 14px Arial, sans-serif";
  context.fillText("ACTIVE + VISIBLE TIME · STORED ON DEVICE", 64, 638);
  context.textAlign = "right";
  context.fillText("time on x", 1100, 638);
  context.textAlign = "left";
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, currentY);
}

function shareCanvasBlob() {
  return new Promise((resolve, reject) => {
    elements.shareCanvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The share image could not be created.")),
      "image/png",
    );
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function downloadGeneratedShareCard() {
  if (!generatedShareCard) return;
  downloadBlob(await shareCanvasBlob(), generatedShareCard.filename);
  showToast("Share card downloaded");
}

async function shareGeneratedCardOnX() {
  if (!generatedShareCard) return;
  const blob = await shareCanvasBlob();
  const file = new File([blob], generatedShareCard.filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: generatedShareCard.shareText });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  downloadBlob(blob, generatedShareCard.filename);
  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(generatedShareCard.shareText)}`;
  if (extensionApi?.tabs) {
    await extensionApi.tabs.create({ url: intentUrl });
  } else {
    window.open(intentUrl, "_blank", "noopener");
  }
  showToast("PNG downloaded — attach it to the prepared X post");
}

async function importJson(file) {
  try {
    if (!extensionApi?.runtime?.sendMessage) {
      throw new Error("Restore is available only in the installed extension.");
    }
    const parsed = JSON.parse(await file.text());
    if (!["time-on-x-backup", "x-time-backup"].includes(parsed.format) || !Array.isArray(parsed.sessions)) {
      throw new Error("This is not a Time on X backup file.");
    }
    if (!confirm(`Replace your current history with ${parsed.sessions.length} imported visits?`)) return;
    const result = await extensionApi.runtime.sendMessage({
      type: "X_TIME_IMPORT_DATA",
      sessions: parsed.sessions,
      settings: parsed.settings,
    });
    if (!result?.ok) throw new Error("The backup could not be imported.");
    await refresh();
    showToast(`${result.count} visits restored`);
  } catch (error) {
    alert(error.message || "The selected file could not be imported.");
  } finally {
    elements.importJson.value = "";
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2_400);
}

elements.previousDay.addEventListener("click", () => shiftSelectedDay(-1));
elements.nextDay.addEventListener("click", () => shiftSelectedDay(1));
elements.todayButton.addEventListener("click", () => {
  selectedDate = new Date();
  renderSelectedDay();
});
elements.datePicker.addEventListener("change", () => {
  selectedDate = parseLocalDate(elements.datePicker.value);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (selectedDate > today) selectedDate = today;
  renderSelectedDay();
});
[
  [elements.trend7Days, "7d"],
  [elements.trend30Days, "30d"],
  [elements.trend12Weeks, "12w"],
].forEach(([button, range]) => {
  button.addEventListener("click", () => {
    trendRange = range;
    trendPageOffset = 0;
    renderTrend();
  });
});
elements.previousTrendPeriod.addEventListener("click", () => {
  trendPageOffset -= 1;
  renderTrend();
});
elements.nextTrendPeriod.addEventListener("click", () => {
  if (trendPageOffset < 0) trendPageOffset += 1;
  renderTrend();
});
elements.sharePeriod.addEventListener("change", () => {
  elements.shareCustomDates.hidden = elements.sharePeriod.value !== "custom";
});
elements.generateShareCard.addEventListener("click", () => {
  try {
    generatedShareCard = buildShareCardData();
    drawShareCard(generatedShareCard);
    elements.shareDialog.showModal();
  } catch (error) {
    alert(error.message || "The share card could not be generated.");
  }
});
elements.closeShareDialog.addEventListener("click", () => elements.shareDialog.close());
elements.downloadShareCard.addEventListener("click", () => void downloadGeneratedShareCard());
elements.shareCardOnX.addEventListener("click", () => void shareGeneratedCardOnX());
elements.shareDialog.addEventListener("click", (event) => {
  if (event.target === elements.shareDialog) elements.shareDialog.close();
});


extensionApi?.storage?.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]?.newValue) {
    store = normalizeStore(changes[STORAGE_KEY].newValue);
    render();
  }
});

function createPreviewStore() {
  const preview = createDefaultStore();
  const now = new Date();
  const add = (daysAgo, startHour, startMinute, durationMinutes) => {
    const start = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() - daysAgo,
      startHour, startMinute, 0, 0,
    ).getTime();
    preview.sessions.push({
      id: `preview-${daysAgo}-${startHour}-${startMinute}`,
      s: start,
      e: start + durationMinutes * 60_000,
    });
  };
  add(0, 8, 42, 14);
  add(0, 12, 7, 28);
  add(0, 17, 23, 9);
  add(1, 10, 15, 42);
  add(2, 18, 5, 23);
  add(3, 9, 30, 31);
  add(5, 14, 12, 48);
  add(7, 11, 4, 19);
  add(9, 20, 18, 37);
  add(12, 7, 50, 25);
  for (let daysAgo = 16; daysAgo < 90; daysAgo += 4) {
    add(daysAgo, 8 + (daysAgo % 11), daysAgo % 47, 12 + (daysAgo % 39));
  }
  return preview;
}

const shareToday = new Date();
const shareWeekAgo = new Date(shareToday);
shareWeekAgo.setDate(shareToday.getDate() - 6);
elements.shareStartDate.value = dateInputValue(shareWeekAgo);
elements.shareEndDate.value = dateInputValue(shareToday);
elements.shareStartDate.max = dateInputValue(shareToday);
elements.shareEndDate.max = dateInputValue(shareToday);

void refresh();
