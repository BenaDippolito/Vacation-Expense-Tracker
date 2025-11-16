# Vacation Expense Tracker — Demo

Status: demo — a small offline-first expense tracker prototype with a minimal Express backend.

This repository contains a lightweight demo that demonstrates:

- A simple frontend (HTML + vanilla JS) to add expenses, show a list, and render basic charts (Chart.js).
- Local storage using IndexedDB (`src/idb.js`) so the app works offline.
- A basic Express server (`server.js`) providing `/api/expenses` and `/api/sync` and persisting data into `data/expenses.json`.
- Service worker caching for an app-shell (`src/sw.js`).

Quick start

1. Install dependencies

```powershell
npm install
```

2. Run the app

```powershell
npm start
# or for development with auto-reload (requires internet to fetch npx/nodemon)
npm run dev
```

3. Open the app in your browser:

```
http://localhost:3000
```

What is implemented

- `index.html` — the app shell and UI (forms, list, charts).
- `src/app.js` — main client logic: add expense, render list, export CSV, sync to `/api/sync`, and update charts.
- `src/idb.js` — small IndexedDB wrapper exposing `addExpense`, `getAllExpenses`, `putExpense`, `markSynced`.
- `src/ui/` — tiny UI helpers (`components.js`, `expenseList.js`) used by the frontend.
- `src/sw.js` — service worker that precaches the app shell and provides simple fetch handling.
- `server.js` — Express server that serves the static site and implements `/api/expenses` and `/api/sync`. Receipts sent as data URLs are saved under `data/uploads/` and the saved path is returned.
- `data/expenses.json` — server-side storage file (created automatically by the server if missing).

API endpoints

- `GET /api/expenses` — returns the current server-side array from `data/expenses.json`.
- `POST /api/sync` — accepts an expense object or an array of expenses. If an item contains a `receiptData` data URL, the server decodes and saves it to `data/uploads/` and replaces the data URL with a web-accessible path. The server appends incoming items to `data/expenses.json` and returns a JSON response with saved items.

Project structure

```
index.html
package.json
server.js
README.md
data/
  expenses.json
  uploads/  (created at runtime)
src/
  app.js
  idb.js
  styles.css
  sw.js
  ui/
    components.js
    expenseList.js
```

Usage notes

- Add expenses using the form in the UI. Receipts can be chosen as image files and are stored in the browser's IndexedDB until you press `Sync`.
- Click `Sync` to POST unsynced items to `/api/sync`; the server will save any receipt images to `data/uploads/` and return saved items. The client then marks items as synced.
- Click `Export CSV` to download a CSV of locally stored expenses.
- The app registers a service worker (`src/sw.js`) to cache the app shell for offline use.

Development tips

- The app runs on port `3000` by default (see `server.js`).
- Server data lives in `data/expenses.json` — to reset server-side state, stop the server and remove that file.
- The server will create `data/uploads/` automatically when saving receipts.

Limitations & TODOs

- This is a demo scaffold. It intentionally keeps auth, per-user separation, and robust data merging out of scope.
- The README previously contained an extended design/roadmap; that content can be found in the repo's issue tracker or re-added under a `docs/` folder if you want to expand the project.

Contributing

- Fork, create a feature branch, and open a PR. Keep changes focused and include screenshots for UI changes.

License

MIT


  - idb.js
    - Expose: openDB(), getAll(store), put(store, item), get(store, id), delete(store, id), clear(store)
    - Schema: database name "vacation-expenses", version 1
      - objectStore "expenses" keyPath "id" (uuid)
      - indices: byDate, byCategory, bySynced (boolean)
  - sync.js
    - Expose: enqueueExpense(exp), syncNow(), startAutoSync(), stopAutoSync()
    - Manage retry/backoff, conflict resolution hooks, and events for UI updates

- UI modules
  - expenseForm.js
    - Fields: date, amount, currency, category, merchant, notes, receiptFile (image)
    - Validate amount & date; optional OCR hook for receipt text
    - On submit: create expense with id, createdAt, synced=false; save to IDB
    - Inline image preview: convert to data URL, store as receiptData in IDB
  - expenseList.js
    - Shows list grouped by day / category
    - Filter controls: date range, category, amount range, search text
    - Bulk actions: mark as reimbursed, export selected, delete selected
    - Per-item: edit, view receipt modal, toggle synced state (manual)
    - Edit + Delete UX (new)
      - Edit: inline edit or modal form pre-filled from IDB; validate and save locally (optimistic update) then enqueue for sync.
      - Delete: show confirmation modal for destructive deletes; offer "Undo" snackbar for soft-deletes (5–10s).
      - Soft-delete pattern: set deleted=true and deletedAt timestamp in local store, hide from normal lists, show an "Archived/Deleted" view where users can recover before permanent removal.
      - Accessibility: ensure edit and delete controls are keyboard-focusable and announce actions (ARIA live region for undo).
      - Example client flow:
        1. User clicks edit -> open modal with fields -> user saves -> update IDB (updatedAt, synced=false) -> refresh list immediately -> enqueue item for sync.
        2. User clicks delete -> set deleted=true locally and show Undo toast -> if undone, clear deleted flag; otherwise keep deleted and mark synced=false -> enqueue delete for sync.
    - Category identification & grouping (new)
      - UI: each expense item should display a visible category badge (text + optional icon) and a color accent. Example fields shown inline:
        - [Date] [Amount] [Merchant] [Category badge] [Sync state / actions]
      - Grouping modes:
        - Group-by-category view: show category headers with collapsible lists of expenses belonging to that category.
        - Group-by-day-with-category-subgroups: primary grouping by day, secondary grouping by category.
        - Toggle switch in UI to switch between "By Date" and "By Category" groupings.
      - Aggregation: display category totals (sum of amounts) in the category header and an overall total for the current filter.
      - Accessibility: category headers should be semantic headings (h3/h4) and include aggregate text for screen readers (e.g., "Meals — 12 items, $320 total").
      - Visual hints:
        - Color palette: assign stable colors per category (persist mapping in local settings) or derive colors via hashing category name.
        - Badge styles: small rounded pill with category name and optional icon; use ARIA label.
      - Interaction patterns:
        - Clicking a category header filters list to that category (or toggles expanded/collapsed).
        - Right-click or long-press on a category header opens quick actions: "Export category", "Archive category", "Add expense to category".
      - Example client query patterns (idb.js / sync.js):
        - Get expenses grouped by category (pseudo):
          const all = await db.getAll('expenses'); // excludes deleted
          const groups = all.reduce((acc, e) => {
          acc[e.category = acc[e.category] || { items: [], total: 0 };
          acc[e.category].items.push(e);
          acc[e.category].total += e.amount;
          return acc;
          }, {});
        - Or use IDB index 'byCategory' to iterate per-category for large datasets.
      - UI perf notes:
        - For large result sets, page/group lazy-load: render category headers first and load items on expand.
        - Cache computed category totals and update incrementally on add/edit/delete to avoid recomputing entire list.
  - receiptViewer.js
    - Modal/lightbox for viewing image at full size, download button
    - Show metadata & link to server-hosted image post-sync
  - charts.js
    - Doughnut/Bar for category breakdown and daily spend
    - Dynamically update when IDB changes
    - Analytics category filter (new)
      - Goal: allow users to filter analytics by category (single or multi-select) and update the doughnut/bar charts to show a breakdown based on the selected categories or to drill into a specific category.
      - UI controls:
        - Multi-select dropdown with search (typeahead) for categories.
        - Category "chips" row above charts for quick toggles; chips show name + color + total.
        - "All" / "None" quick actions and a Reset button.
        - Option to click a chart segment to drill down to that category (syncs with the filter controls).
      - Expected behaviors:
        - When no category is selected, charts show full dataset (all non-deleted expenses).
        - When one or more categories selected, charts are recalculated using only expenses that match selected categories and current active date/filter scope.
        - Selecting a category toggles inclusion; UI updates counts/totals and the charts animate to new values.
        - Drill-down: clicking a doughnut segment sets the filter to that category and optionally expands the expense list for that category.
      - Data flow / implementation notes:
        - Use IDB index 'byCategory' or fetch all filtered items from IDB and compute per-category aggregations.
        - Debounce filter input (e.g., 150–300ms) to avoid excessive re-renders for large datasets.
        - Compute aggregated data once and reuse for both the doughnut and bar charts to keep them consistent.
      - Example pseudo-code (charts.js)
        - Event wiring:
          - categoryFilter.onChange -> updateChartsWithFilter(selectedCategories)
          - chart.onSegmentClick -> categoryFilter.set(selectedCategory)
        - Update logic (pseudo):
          const updateChartsWithFilter = async (selectedCategories = []) => {
          // read current date range / other filters
          const expenses = await db.queryExpenses({ dateFrom, dateTo, categories: selectedCategories });
          // compute aggregates per category
          const agg = aggregateByCategory(expenses); // { category: { total, count } }
          // prepare datasets for doughnut and bar
          const labels = Object.keys(agg);
          const totals = labels.map(l => agg[l].total);
          doughnutChart.update({ labels, datasets: [{ data: totals, backgroundColor: labels.map(col => colorForCategory(col)) }] });
          barChart.update(...);
          // update UI chips with totals and counts
          updateCategoryChips(labels.map(l => ({ name: l, total: agg[l].total, count: agg[l].count })));
          }
      - Performance and UX considerations:
        - For large datasets, prefer using IDB cursors on the byCategory index to compute aggregates without loading all items into memory.
        - Cache computed aggregates keyed by filter parameters and invalidate on writes (add/edit/delete).
        - Animate chart transitions and show a subtle loading spinner while charts recalc.
        - Persist user's last selected categories in local settings so filters survive reloads.
      - Accessibility:
        - Ensure filter controls are keyboard operable and provide aria-live updates for totals and chart descriptions.
        - Provide text summary of the current breakdown below the charts for screen readers (e.g., "Meals: $320 (40%), Transport: $240 (30%)...").
      - Sync with expense list:
        - When filter changes, expenseList should read the same filter state and render only matching items or auto-scroll to the relevant category group.
        - Clicking an expense in the list can highlight the same category chip and update charts if needed.
  - notifications / status
    - Live sync indicator: idle, syncing, success (timestamp), error (message)
    - Toasts for user actions and errors

Offline-first & sync flow

- Local-first write: all writes persist to IDB immediately and update UI.
- Unsynced expense shape (stored in IDB):
  {
  id: "uuid",
  date: "2025-11-15",
  amount: 123.45,
  currency: "USD",
  category: "Meals",
  merchant: "Cafe X",
  notes: "...",
  receiptData: "data:image/jpeg;base64,...", // optional
  createdAt: 1630000000000,
  updatedAt: 1630000000000,
  synced: false,
  serverId: null
  }
- Sync process (sync.js)

  1. Gather expenses with synced === false OR items with a changed `deleted` flag.
  2. For updates: send full expense objects; server validates and returns canonical updated item.
  3. For deletes: either
     - send items with deleted: true and deletedAt timestamp (soft delete), or
     - call DELETE /api/expenses/:id for immediate hard-delete (optional).
  4. Server processes updates and deletes, returns canonical items and statuses per id.
  5. Client updates local IDB based on server response (set synced=true, update serverId/receiptUrl, or remove permanently if server indicates hard-delete completed).
  6. On partial failures, keep items unsynced and report to UI.

- Conflict strategy (edits & deletes)
  - Include updatedAt timestamps per item so the server can perform last-write-wins or return a conflict response if the server has a newer version.
  - For delete vs update conflicts: server should prefer the most recent updatedAt; if a delete wins, return a tombstone response so clients remove the item.

Backend components (detailed)

- server.js (Express)
  - Middleware: helmet (security headers), express.json({limit: '10mb'}) for data URLs, cors (if needed), morgan (optional)
  - Static serve: serve `index.html`, `src/` assets, and `data/uploads/`
  - GET /api/health -> { status: 'ok', uptime: ... }
  - GET /api/expenses -> read data/expenses.json and return array
  - POST /api/sync -> accept array or single item
    - Validate incoming schema minimally (date, amount, id)
    - For each item containing receiptData (data URL):
      - decode base64, write to data/uploads/<uuid>.<ext>
      - replace receiptData with receiptUrl (e.g. /data/uploads/xxx.jpg)
    - Merge: read data/expenses.json, append or replace by serverId/id
    - Persist combined list into data/expenses.json atomically (write to temp file then rename)
    - Return canonical list of processed items or the processed subset
  - Security: for demo, keep simple; for prod, require auth and store per-user
  - File I/O: ensure uploads directory exists; sanitize filenames

Data model (canonical)

- Expense
  - id: string (client UUID)
  - serverId: string|null (server-assigned unique id if different)
  - date: ISO date string
  - amount: number (minor units or float with currency)
  - currency: string (ISO 4217)
  - category: string (user-defined or from taxonomy)
  - merchant: string
  - notes: string
  - receiptData: string|null (data URL — client-only; not sent to server after upload)
  - receiptUrl: string|null (server-hosted path e.g. /data/uploads/xxx.jpg)
  - createdAt, updatedAt: epoch ms
  - synced: boolean
  - reimbursed: boolean
  - tags: string[] (optional)
  - deleted: boolean (default false) — soft-delete marker
  - deletedAt: epoch ms|null — when the item was marked deleted
  - lastModifiedBy: string|null — optional client id or device id that made last change

API contract examples

- GET /api/expenses
  Response: 200 OK
  [
  { id, serverId, date, amount, currency, category, merchant, notes, receiptUrl, createdAt, updatedAt, deleted, deletedAt }
  ]

- POST /api/sync
  Request: { expenses: [ {...Expense...} ] } or a single object

  - For edits: send full updated expense with updatedAt and id.
  - For deletes: send expense with deleted: true and deletedAt (soft delete).
    Response: 200 OK
    { processed: [ { id, status: 'updated'|'created'|'deleted'|'conflict', item: {...canonical Expense...} } ], errors: [ { id, message } ] }

- Optional endpoints (recommended)
  - PUT /api/expenses/:id
    - Update single expense; request body is partial or full expense object.
    - Response: 200 OK { item: {...} } or 409 on conflict.
  - DELETE /api/expenses/:id
    - Hard-delete server-side; for demo prefer soft-delete via POST /api/sync with deleted:true.
    - Response: 200 OK { id, status: 'deleted' } or 404.

Service Worker strategies (src/sw.js)

- App shell caching (install)
  - Precache: index.html, styles.css, app.js, vendor libs (Chart.js)
- Runtime caching
  - Stale-while-revalidate for static assets
  - Network-first for API /api/sync and /api/expenses with a fallback to cached response
- Background sync (optional)
  - Use Background Sync API to retry when connectivity returns (requires HTTPS or localhost)
  - Fallback: queue in sync.js and retry with exponential backoff

IndexedDB schema & reasoning

- Use a thin promise wrapper (idb or custom)
- One database "vacation-expenses", store "expenses"
- Indexes: date, category, synced
  - Ensure the "byCategory" index exists to efficiently query/group by category.
- Use UUIDs for keys to allow client creation offline
- Keep receipts small on client (compress images before storing) to avoid huge IDB usage

Testing & CI

- Unit tests
  - idb wrapper
  - sync manager: mock fetch and filesystem
  - small UI units with Jest + jsdom
- End-to-end
  - Cypress to test adding expenses offline and syncing
- CI (GitHub Actions)
  - run lint, unit tests, build step
  - optional: deploy to static host and Node server container

Security & privacy

- Do not store sensitive PII unencrypted in the public repo.
- For production:
  - Use proper authentication and per-user storage
  - Use signed URLs or a storage service (S3/Blob) instead of writing to server disk
  - Scan uploads for malware and limit file types & sizes
  - GDPR: provide export and delete features

Performance & cost considerations

- Avoid storing large images in IndexedDB; compress client-side (canvas -> toDataURL with quality)
- For high-volume users, move receipts to cloud storage; use client to upload directly (presigned URLs)
- Paginate GET /api/expenses or provide server-side filters

Accessibility

- Ensure forms and buttons are reachable via keyboard.
- Provide ARIA labels on charts and dynamic content.
- Color contrast and scalable typography.

UX improvement suggestions (prioritized)

1. Image handling
   - Compress images client-side (resize to reasonable max width) before storing & uploading.
   - Allow direct camera capture on mobile (input accept="image/\*" capture="environment").
   - Add progress indicator for receipt uploads during sync.
2. Smart categorization
   - Add simple ML rule engine or rule-based mapping from merchant/notes to categories.
   - Offer quick-suggest categories based on past entries.
3. Multi-currency & conversion
   - Persist currency with each expense.
   - Offer live conversion to a base currency using an exchange-rate API (cache rates).
4. OCR for receipts
   - Client-side Tesseract integration to pre-fill merchant/amount/date.
   - Make OCR optional and asynchronous.
5. Conflict resolution & multi-device
   - Add per-field lastModified timestamps and server-side merge UI.
6. Offline reconnection UX
   - Visual queue showing pending items and ETA for sync attempts.
   - Retry/backoff with user controls (pause/force retry).
7. Analytics & budgeting
   - Budgets per trip; alerts when budget approaches/exceeds.
   - Export to CSV and connect to third-party accounting tools.
8. Privacy & data controls
   - Allow user to purge local cache or download all receipts as an archive.

Roadmap & next steps

- Short term (dev days)
  1. Flesh out idb.js, sync.js, basic UI components, server sync handler.
  2. Add service worker caching and ensure offline add/edit works.
  3. Implement POST /api/sync receipt saving and return canonical items.
- Medium term (weeks)
  1. Add image compression + camera capture and UX improvements.
  2. Add OCR stub and optional integration.
  3. Add tests & CI.
- Long term (months)
  1. Move to backed DB with auth (SQLite/Postgres + JWT).
  2. Multi-user support, per-user storage, and RBAC.
  3. Migrate receipts to blob storage and use presigned uploads.

Developer notes & implementation tips

- Use small, focused modules — avoid one huge app.js. Compose from small files in src/ui.
- Use events or a tiny state manager (Observable) to notify charts and lists when IDB changes.
- When writing files on server: write to temp file first and rename to avoid partial writes.
- Keep data/exports and uploads in .gitignore to avoid accidental commits.

Example expense JSON (client-side)
{
"id": "uuid-v4",
"date": "2025-11-15",
"amount": 24.50,
"currency": "USD",
"category": "Meals",
"merchant": "Cafe X",
"notes": "Lunch at airport",
"receiptData": "data:image/jpeg;base64,...", // only client-side
"createdAt": 1630000000000,
"updatedAt": 1630000000000,
"synced": false
}

Contributing

- Fork repo, create feature branch, open PR with summary and screenshots.
- Add tests for new features and ensure lint & build pass.

License & credits

- This scaffold is demo-only. Choose a license (MIT recommended) and add LICENSE file.

## Design & Presentation — Inclusive, welcoming UI (make it more appealing to women)

Goal

- Make the app feel warm, supportive, and professional while remaining neutral and inclusive. Focus on approachable visual language, clear microcopy, and UX patterns that reduce friction (simple forms, forgiving undo, helpful defaults).

Visual system (practical)

- Palette (example CSS variables you can add to src/styles.css):
  :root {
  --bg: #fffaf6;
  --surface: #ffffff;
  --muted: #6b6b6b;
  --accent: #d46c8f; /_ warm rose _/
  --accent-2: #7aa2c7; /_ soft teal _/
  --success: #62b26f;
  --danger: #e76f51;
  --chip-bg: #fff0f4;
  --card-shadow: 0 6px 18px rgba(23,23,23,0.06);
  --radius: 12px;
  --max-width: 960px;
  }
- Typography
  - Primary: "Inter", "System UI", sans-serif for clarity.
  - Secondary heading accent: a humanist serif or rounded display for titles (optional).
  - Sizes: use generous line-height and 16–18px base font for readability.
- Spacing & shape
  - Use rounded corners (8–14px) and soft shadows to create a friendly, tactile UI.
  - Larger hit targets for mobile (min 44px height buttons).

Microcopy & tone

- Use friendly, concise microcopy. Prefer "You" and "Let's" over impersonal system-speak.
- Examples:
  - Form submit: "Save expense" → "Save this expense"
  - Empty list: "No items" → "No expenses yet — add your first receipt"
  - Sync status: "Sync failed" → "Sync paused — we’ll retry. Tap to try now."
  - Undo toast: "Deleted" → "Expense archived — Undo"
- Onboarding hint text
  - Short tips when user first opens the app: "Quick tip: tap the camera icon to snap a receipt. We'll compress images automatically."

Imagery & icons

- Use real micro-illustrations for empty states (travel scenes, luggage, coffee) with diverse representation. Prefer illustrations over photos for universality.
- Icons: rounded, friendly icon set (Feather / Heroicons with rounded styling). Use icons to support actions (camera, receipt, chart).
- Avoid gendered stereotypes in imagery; include diverse representation where people are shown.

UX patterns & flows

- Soften error states — show clear recovery steps.
- Prefill and smart suggestions:
  - Suggest categories based on merchant and past entries.
  - Offer quick-add templates (e.g., "Taxi", "Coffee") with single-tap amounts.
- Forgiving deletion:
  - Soft-delete with Undo (5–10s) and "Archived" view for recovery.
- Confirmation & help:
  - For destructive actions show clear labels and a short reason why.

Accessibility & inclusion

- Ensure 4.5:1 contrast for body text and 3:1 for large text.
- Keyboard/focus styles & visible outlines.
- All dynamic updates announced via ARIA live regions (sync status, undo available).
- Localize microcopy and date/number formatting.
- Color-blind friendly palettes and non-color indications (icons, badges).

Analytics & charts presentation

- Use softer color variants for chart segments; provide clear legends and percentage/amount tooltips.
- Provide "Filter by category" chips above charts (chips show totals) and searchable multi-select.
- When a user filters, animate charts and show a text summary (e.g. "Showing 3 categories — $420 total").

Implementation hints (frontend)

- styles.css: copy the CSS variables above and use consistent tokens for spacing, radius, and colors.
- components: implement CategoryChip component (color swatch + label + total), accessible buttons, and large touch targets.
- expenseList: show category badge with color and icon. Add a "Group by" toggle preserving last selection in local storage.
- charts.js: map category -> color via deterministic hash (or persisted user mapping) to keep color stable across sessions.

Design QA and research

- Test with diverse women users for tasks like adding an expense, syncing, and finding receipts.
- Pay attention to language: avoid patronizing phrasing; prefer empathy and efficiency.
- Iterate based on short usability sessions (5–7 tasks, 10–15 minutes).

{ 
## Files added / implementation notes

I added a minimal stylesheet and two small UI helper modules to make it easier to apply the inclusive design tokens and category UI described above:

- src/styles.css — theme variables and small utility classes (color tokens, chip, buttons).
- src/ui/components.js — small CategoryChip component (vanilla JS DOM helper).
- src/ui/expenseList.js — grouping helper + render stub that demonstrates grouping by category.

These files are intentionally small and framework-agnostic so you can adopt them into your UI stack (vanilla, React, Svelte, etc.). See the code files in the repo for exact tokens and usage examples.

Microcopy tweaks (applied)
- Use softer, more helpful copy across status messages and empty states (examples shown earlier).
- Prefer action-friendly button labels: "Save this expense", "Add receipt", "Undo archive".
- Inline hints for mobile camera capture: "Tap camera to snap receipt — we shrink images for you."

}
