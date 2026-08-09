let tooltip;

function getTooltip() {
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");
  const title = document.createElement("strong");
  const detail = document.createElement("span");
  tooltip.append(title, detail);
  document.body.append(tooltip);
  return tooltip;
}

function positionTooltip(target, event) {
  const node = getTooltip();
  const rect = target.getBoundingClientRect();
  const pointerX = event?.clientX || rect.left + rect.width / 2;
  const anchorY = event?.clientY || rect.top;
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, pointerX - width / 2));
  const preferredTop = anchorY - height - 15;
  const top = preferredTop > 10 ? preferredTop : Math.min(window.innerHeight - height - 10, rect.bottom + 12);
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function showTooltip(target, title, detail, event) {
  const node = getTooltip();
  node.querySelector("strong").textContent = title;
  node.querySelector("span").textContent = detail;
  node.classList.add("is-visible");
  node.setAttribute("aria-hidden", "false");
  positionTooltip(target, event);
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.classList.remove("is-visible");
  tooltip.setAttribute("aria-hidden", "true");
}

export function attachTooltip(target, { title, detail, focusable = true }) {
  target.removeAttribute("title");
  if (focusable) target.tabIndex = 0;
  target.setAttribute("aria-label", `${title}. ${detail}`);
  target.addEventListener("pointerenter", (event) => showTooltip(target, title, detail, event));
  target.addEventListener("pointermove", (event) => positionTooltip(target, event));
  target.addEventListener("pointerleave", hideTooltip);
  if (focusable) {
    target.addEventListener("focus", () => showTooltip(target, title, detail));
    target.addEventListener("blur", hideTooltip);
  }
}
