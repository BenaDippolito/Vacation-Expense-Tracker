import { CategoryChip } from "./components.js";

// Group expenses by category (returns { categoryName: { items: [], total: number } })
export function groupByCategory(expenses = []) {
  return expenses.reduce((acc, e) => {
    if (e.deleted) return acc;
    const key = e.category || "Uncategorized";
    const bucket = acc[key] || (acc[key] = { items: [], total: 0 });
    bucket.items.push(e);
    bucket.total += Number(e.amount || 0);
    return acc;
  }, {});
}

// Render category groups into a container.
// options: { container: DOMNode, groups: object, colorForCategory: fn, onItemClick: fn, onCategoryClick: fn }
export function renderCategoryGroups(options = {}) {
  const {
    container,
    groups = {},
    colorForCategory = () => "#ccc",
    onItemClick,
    onCategoryClick,
  } = options;
  if (!container) return;
  container.innerHTML = "";
  Object.keys(groups)
    .sort()
    .forEach((cat) => {
      const meta = groups[cat];
      const header = document.createElement("div");
      header.className = "row";
      const chip = CategoryChip({
        name: cat,
        total: meta.total,
        color: colorForCategory(cat),
        onClick: () => onCategoryClick && onCategoryClick(cat),
      });
      header.appendChild(chip);

      const list = document.createElement("div");
      list.className = "card";
      meta.items.forEach((item) => {
        const itemEl = document.createElement("div");
        itemEl.className = "expense-item";
        itemEl.innerHTML = `
        <div class="meta">
          <div><strong>${item.merchant || "—"}</strong></div>
          <div class="muted">${new Date(item.date).toLocaleDateString()}</div>
        </div>
        <div><strong>$${Number(item.amount || 0).toFixed(2)}</strong></div>
      `;
        itemEl.addEventListener(
          "click",
          () => onItemClick && onItemClick(item)
        );
        list.appendChild(itemEl);
      });

      container.appendChild(header);
      container.appendChild(list);
    });
}
