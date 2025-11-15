(function () {
  function $(sel) {
    return document.querySelector(sel);
  }

  function generateId() {
    return "e" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
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
      updateCharts();
    } catch (err) {
      console.error("Add failed", err);
      alert("Failed to save expense locally");
    }
  }

  async function renderExpenses() {
    const list = $("#expenses-list");
    list.innerHTML = "";
    const items = await vetIdb.getAllExpenses();
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
      li.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center">
          ${thumb}
          <div>
            <strong>${it.description || it.category}</strong>
            <div class="muted">${it.date} • ${it.traveler || "—"}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div>$${Number(it.amount).toFixed(2)}</div>
          <div class="muted">${it.synced ? "synced" : "pending"}</div>
        </div>
      `;
      list.appendChild(li);
    });
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
          const local = items.find(i=>i.id === s.id);
          if (local) {
            local.synced = true;
            if (s.receiptData) local.receiptData = s.receiptData;
            await vetIdb.putExpense(local);
          }
        }
      } else {
        // fallback: mark as synced
        await vetIdb.markSynced(unsynced.map(i=>i.id));
      }
      await renderExpenses();
      alert('Synced ' + unsynced.length + ' items');
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
    const items = await vetIdb.getAllExpenses();
    // pie by category
    const byCat = items.reduce((acc, it) => {
      acc[it.category] = (acc[it.category] || 0) + (Number(it.amount) || 0);
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
            backgroundColor: ["#3AA0FF", "#FFB86B", "#8EF5C2", "#D3B5FF"],
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
    await renderExpenses();
    await updateCharts();
  });

  // Expose for console/debug
  window.vetApp = { renderExpenses, updateCharts, syncToServer };
})();
