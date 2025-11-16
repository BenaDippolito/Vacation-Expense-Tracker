(function () {
  function $(sel) {
    return document.querySelector(sel);
  }

  function generateId() {
    return "e" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  }

  // Simple palette and color picker for categories
  const CATEGORY_COLORS = [
    "#3AA0FF",
    "#FFB86B",
    "#8EF5C2",
    "#D3B5FF",
    "#F6D365",
  ];
  function colorForCategory(name) {
    if (!name) return "#ddd";
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
    return CATEGORY_COLORS[Math.abs(h) % CATEGORY_COLORS.length];
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  async function addExpense(ev) {
    ev.preventDefault();
    const date = $("#date").value || new Date().toISOString().slice(0, 10);
    const amount = parseFloat($("#amount").value || 0);
    const category = $("#category").value;
    const traveler = $("#traveler").value || "";
    const description = $("#description").value || "";
    const file = $("#receipt").files && $("#receipt").files[0];
    const receiptData = await readFileAsDataURL(file);

    const exp = {
      id: generateId(),
      date,
      amount,
      category,
      traveler,
      description,
      receiptData,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    try {
      await vetIdb.addExpense(exp);
      $("#expense-form").reset();
      renderExpenses();
      // refresh category filter options when new category added
      populateCategoryFilter();
      updateCharts();
    } catch (err) {
      console.error("Add failed", err);
      alert("Failed to save expense locally");
    }
  }

  // Populate the category filter select from stored expenses (dynamic)
  async function populateCategoryFilter() {
    const select = document.getElementById("category-filter");
    if (!select) return;
    const all = await vetIdb.getAllExpenses();
    const cats = new Set();
    let hasUncategorized = false;
    all.forEach((i) => {
      const c = i.category && String(i.category).trim();
      if (c) cats.add(c);
      else hasUncategorized = true;
    });

    // remember previous selection
    const prev = window.__vetCategoryFilter || select.value || "All";

    // clear and add base option
    select.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "All";
    optAll.textContent = "All categories";
    select.appendChild(optAll);

    // add sorted categories
    Array.from(cats)
      .sort()
      .forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        select.appendChild(o);
      });

    // add Uncategorized option if there are items without a category
    if (hasUncategorized) {
      const u = document.createElement("option");
      u.value = "Uncategorized";
      u.textContent = "Uncategorized";
      select.appendChild(u);
    }

    // restore previous selection if available, else default to All
    if (prev && Array.from(select.options).some((o) => o.value === prev)) {
      select.value = prev;
      window.__vetCategoryFilter = prev;
    } else {
      select.value = "All";
      window.__vetCategoryFilter = "All";
    }

    const status = document.getElementById("chart-filter-status");
    if (status)
      status.textContent =
        window.__vetCategoryFilter === "All"
          ? "Showing all categories"
          : `Showing ${window.__vetCategoryFilter}`;
  }

  async function renderExpenses() {
    const list = $("#expenses-list");
    list.innerHTML = "";
    const all = await vetIdb.getAllExpenses();
    const filter = window.__vetCategoryFilter || "All";
    const items =
      filter === "All"
        ? all
        : all.filter((i) => {
            const c =
              (i.category && String(i.category).trim()) || "Uncategorized";
            return c === filter;
          });
    if (!items.length) {
      list.innerHTML = '<li class="muted">No expenses yet.</li>';
      return;
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    items.forEach((it) => {
      const li = document.createElement("li");
      const thumb = it.receiptData
        ? `<img src="${it.receiptData}" class="thumb" alt="receipt" />`
        : "";
      const cat =
        (it.category && String(it.category).trim()) || "Uncategorized";
      const sw = `<span class="category-swatch" style="background:${colorForCategory(
        cat
      )}"></span>`;
      li.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center">
          ${thumb}
          <div>
            <div style="display:flex;gap:8px;align-items:center">
              <strong>${it.description || it.category}</strong>
              <span class="category-chip" title="${cat}">${sw}<span>${cat}</span></span>
            </div>
            <div class="muted">${it.date} • ${it.traveler || "—"}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div>$${Number(it.amount).toFixed(2)}</div>
          <div class="muted">${it.synced ? "synced" : "pending"}</div>
        </div>
      `;
      // add edit action
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditExpense(it, li));
      actions.appendChild(editBtn);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  // Start inline edit for an expense inside given list item
  function startEditExpense(item, li) {
    // create form fields pre-filled
    li.innerHTML = "";
    const form = document.createElement("form");
    form.className = "edit-form";
    form.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label style="flex:1">Date<input type="date" name="date" value="${
          item.date || ""
        }" /></label>
        <label style="flex:1">Amount<input type="number" step="0.01" name="amount" value="${Number(
          item.amount || 0
        ).toFixed(2)}" /></label>
        <label style="flex:1">Category<input type="text" name="category" value="${
          item.category || ""
        }" /></label>
        <label style="flex:1">Traveler<input type="text" name="traveler" value="${
          item.traveler || ""
        }" /></label>
        <label style="flex:1 1 100%">Description<input type="text" name="description" value="${(
          item.description || ""
        ).replace(/"/g, "&quot;")}" /></label>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button type="submit" class="btn">Save</button>
        <button type="button" class="btn btn-ghost" id="cancel-edit">Cancel</button>
      </div>
    `;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const updated = Object.assign({}, item, {
        date: fd.get("date"),
        amount: parseFloat(fd.get("amount") || 0),
        category: (fd.get("category") || "").trim(),
        traveler: fd.get("traveler") || "",
        description: fd.get("description") || "",
        updatedAt: Date.now(),
        synced: false,
      });
      try {
        await vetIdb.putExpense(updated);
        // refresh filter options and UI
        await populateCategoryFilter();
        await renderExpenses();
        await updateCharts();
      } catch (err) {
        console.error("Update failed", err);
        alert("Failed to update expense");
      }
    });

    form.querySelector("#cancel-edit")?.addEventListener("click", (e) => {
      // cancel: re-render full list
      renderExpenses();
    });

    li.appendChild(form);
  }

  async function syncToServer() {
    const items = await vetIdb.getAllExpenses();
    const unsynced = items.filter((i) => !i.synced);
    if (!unsynced.length) return alert("All items already synced");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unsynced),
      });
      if (!res.ok) throw new Error("Sync failed");
      const body = await res.json();
      // body.items contains server-side saved items (with receiptData possibly replaced by server path)
      if (body && Array.isArray(body.items)) {
        // reconcile server items into local DB
        for (const s of body.items) {
          const local = items.find((i) => i.id === s.id);
          if (local) {
            local.synced = true;
            if (s.receiptData) local.receiptData = s.receiptData;
            await vetIdb.putExpense(local);
          }
        }
      } else {
        // fallback: mark as synced
        await vetIdb.markSynced(unsynced.map((i) => i.id));
      }
      await renderExpenses();
      alert("Synced " + unsynced.length + " items");
    } catch (err) {
      console.error("Sync error", err);
      alert("Sync failed — try again when online");
    }
  }

  function download(filename, text) {
    const a = document.createElement("a");
    const blob = new Blob([text], { type: "text/csv" });
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportCSV() {
    const items = await vetIdb.getAllExpenses();
    if (!items.length) return alert("No data to export");
    const headers = [
      "id",
      "date",
      "amount",
      "category",
      "traveler",
      "description",
      "createdAt",
      "synced",
    ];
    const rows = items.map((it) =>
      headers
        .map((h) => '"' + String(it[h] ?? "").replace(/"/g, '""') + '"')
        .join(",")
    );
    const csv = headers.join(",") + "\n" + rows.join("\n");
    download("vacation-expenses.csv", csv);
  }

  let pieChart = null,
    lineChart = null;
  async function updateCharts() {
    const all = await vetIdb.getAllExpenses();
    const filter = window.__vetCategoryFilter || "All";
    const items =
      filter === "All" ? all : all.filter((i) => i.category === filter);
    // pie by category
    const byCat = items.reduce((acc, it) => {
      const key =
        (it.category && String(it.category).trim()) || "Uncategorized";
      acc[key] = (acc[key] || 0) + (Number(it.amount) || 0);
      return acc;
    }, {});
    const catLabels = Object.keys(byCat);
    const catValues = catLabels.map((l) => byCat[l]);

    // line by date (sum per date, oldest->newest)
    const byDate = items.reduce((acc, it) => {
      acc[it.date] = (acc[it.date] || 0) + (Number(it.amount) || 0);
      return acc;
    }, {});
    const dates = Object.keys(byDate).sort();
    const dateValues = dates.map((d) => byDate[d]);

    const pieCtx = document.getElementById("pie-chart").getContext("2d");
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: "pie",
      data: {
        labels: catLabels,
        datasets: [
          {
            data: catValues,
            backgroundColor: catLabels.map((c) => colorForCategory(c)),
          },
        ],
      },
    });

    const lineCtx = document.getElementById("line-chart").getContext("2d");
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(lineCtx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Expenses",
            data: dateValues,
            fill: false,
            borderColor: "#1f7aef",
          },
        ],
      },
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("#expense-form").addEventListener("submit", addExpense);
    $("#sync-btn").addEventListener("click", syncToServer);
    $("#export-csv").addEventListener("click", exportCSV);
    const select = document.getElementById("category-filter");
    if (select) {
      // default filter
      window.__vetCategoryFilter = select.value || "All";
      select.addEventListener("change", (e) => {
        window.__vetCategoryFilter = e.target.value;
        const status = document.getElementById("chart-filter-status");
        if (status)
          status.textContent =
            window.__vetCategoryFilter === "All"
              ? "Showing all categories"
              : `Showing ${window.__vetCategoryFilter}`;
        renderExpenses();
        updateCharts();
      });
    }
    await renderExpenses();
    await updateCharts();
  });

  // Expose for console/debug
  window.vetApp = { renderExpenses, updateCharts, syncToServer };
})();
