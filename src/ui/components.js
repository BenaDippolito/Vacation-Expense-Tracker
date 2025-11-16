// Minimal, framework-agnostic UI helpers.

export function CategoryChip({ name, total, color, onClick } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "category-chip";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("title", `${name} — ${formatCurrency(total)}`);
  btn.addEventListener("click", (e) => {
    btn.setAttribute(
      "aria-pressed",
      btn.getAttribute("aria-pressed") === "true" ? "false" : "true"
    );
    if (onClick) onClick(e, name);
  });

  const sw = document.createElement("span");
  sw.className = "category-swatch";
  sw.style.background = color || "#ddd";
  sw.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.textContent = name;

  const amt = document.createElement("span");
  amt.className = "muted";
  amt.style.marginLeft = "8px";
  amt.textContent = formatCurrency(total);

  btn.appendChild(sw);
  btn.appendChild(label);
  btn.appendChild(amt);

  return btn;

  function formatCurrency(v) {
    if (v == null) return "";
    return typeof v === "number" ? `$${v.toFixed(2)}` : String(v);
  }
}
