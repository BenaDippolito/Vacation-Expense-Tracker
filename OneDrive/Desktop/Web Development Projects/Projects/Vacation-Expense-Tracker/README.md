# Vacation Expense Tracker (Scaffold)

This is a minimal scaffold for an offline-first Vacation Expense Tracker demo.

Features included in this scaffold:

- Mobile-first single-page UI (`index.html`)
- Offline storage using IndexedDB
- Service worker for caching app shell
- Simple Node `express` backend with an `/api/sync` endpoint that saves synced expenses to `data/expenses.json`
- Basic charts using Chart.js and CSV export

## Quick start (Windows PowerShell)

1. Install dependencies

```powershell
npm install
```

2. Run the server

```powershell
npm start
```

3. Open the app in your browser:

```
http://localhost:3000
```

Notes and next steps:

- OCR receipt scanning and multi-user auth are not implemented in this scaffold — these are integration points noted in the UI.
- This project stores receipts as small data URLs in IndexedDB for demo purposes. For production, you'd want to upload files to a dedicated storage service.
- To develop faster, run `npm run dev` (requires `nodemon`).
