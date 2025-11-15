const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DATA_FILE = path.join(DATA_DIR, "expenses.json");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname)));

async function ensureDataFile() {
  try {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    try {
      await fs.promises.access(DATA_FILE);
    } catch (err) {
      await fs.promises.writeFile(DATA_FILE, "[]", "utf8");
    }
  } catch (err) {
    console.error("Failed to ensure data file:", err);
  }
}

function dataUrlToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!matches) return null;
  const mime = matches[1];
  const b64 = matches[2];
  const buf = Buffer.from(b64, "base64");
  return { buf, mime };
}

function extFromMime(mime) {
  if (!mime) return "bin";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  return "bin";
}

app.post("/api/sync", async (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ error: "No payload" });

  const items = Array.isArray(payload) ? payload : [payload];
  await ensureDataFile();

  try {
    const raw = await fs.promises.readFile(DATA_FILE, "utf8");
    const existing = JSON.parse(raw || "[]");

    // Process receipts: if item.receiptData is a data URL, save as file and replace with path
    for (const item of items) {
      if (item.receiptData && String(item.receiptData).startsWith("data:")) {
        const parsed = dataUrlToBuffer(item.receiptData);
        if (parsed) {
          const ext = extFromMime(parsed.mime);
          const filename = `${item.id || Date.now()}.${ext}`;
          const outPath = path.join(UPLOADS_DIR, filename);
          await fs.promises.writeFile(outPath, parsed.buf);
          // make path accessible from web root
          item.receiptData = `/data/uploads/${filename}`;
        }
      }
      item._serverReceivedAt = new Date().toISOString();
    }

    const merged = existing.concat(items);
    await fs.promises.writeFile(
      DATA_FILE,
      JSON.stringify(merged, null, 2),
      "utf8"
    );

    res.json({ saved: items.length, items });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).json({ error: "Failed to save" });
  }
});

app.get("/api/expenses", async (req, res) => {
  await ensureDataFile();
  try {
    const raw = await fs.promises.readFile(DATA_FILE, "utf8");
    const existing = JSON.parse(raw || "[]");
    res.json(existing);
  } catch (err) {
    console.error("Error reading data:", err);
    res.status(500).json({ error: "Failed to read data" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
