(() => {
  // Keep X_TIME_* stable across rebrands: open tabs retain their injected script until refresh.
  const HEARTBEAT_INTERVAL_MS = 5_000;
  const ACTIVITY_THROTTLE_MS = 1_500;
  let lastActivityAt = 0;
  let lastActivitySentAt = 0;

  const pageState = () => ({
    visible: document.visibilityState === "visible",
    focused: document.hasFocus(),
    lastActivityAt,
  });

  const send = (type) => {
    try {
      chrome.runtime.sendMessage({ type, ...pageState() }).catch(() => {});
    } catch {
      // The extension may be reloading; the next heartbeat will retry.
    }
  };

  const recordActivity = (event) => {
    if (!event.isTrusted || document.visibilityState !== "visible") return;
    const now = Date.now();
    lastActivityAt = now;
    if (now - lastActivitySentAt < ACTIVITY_THROTTLE_MS) return;
    lastActivitySentAt = now;
    send("X_TIME_ACTIVITY");
  };

  const activityEvents = [
    "pointerdown",
    "pointermove",
    "keydown",
    "scroll",
    "touchstart",
    "wheel",
  ];
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, recordActivity, {
      capture: true,
      passive: true,
    });
  });

  document.addEventListener("visibilitychange", () => {
    send(document.visibilityState === "visible" ? "X_TIME_VIEW" : "X_TIME_HIDDEN");
  });
  // These must observe the window itself only. Capture mode would also receive
  // focus/blur from controls inside X and incorrectly split one visit.
  window.addEventListener("focus", () => send("X_TIME_VIEW"));
  window.addEventListener("blur", () => send("X_TIME_HIDDEN"));
  window.addEventListener("pagehide", () => send("X_TIME_HIDDEN"));

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "X_TIME_CHECK_STATE") {
      sendResponse(pageState());
    }
  });

  const heartbeat = () => {
    if (document.visibilityState === "visible") send("X_TIME_HEARTBEAT");
  };
  setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => send("X_TIME_VIEW"), {
      once: true,
    });
  } else {
    send("X_TIME_VIEW");
  }
})();
