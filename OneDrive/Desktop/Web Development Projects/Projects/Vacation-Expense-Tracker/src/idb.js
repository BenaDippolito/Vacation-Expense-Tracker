(function (global) {
  const DB_NAME = "vet-db";
  const STORE = "expenses";
  const VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = fn(store);
      } catch (err) {
        reject(err);
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  function addExpense(exp) {
    return withStore("readwrite", (store) => store.add(exp));
  }

  function putExpense(exp) {
    return withStore("readwrite", (store) => store.put(exp));
  }

  function getAllExpenses() {
    return new Promise(async (resolve, reject) => {
      const db = await openDB();
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function markSynced(ids = []) {
    return new Promise(async (resolve, reject) => {
      const db = await openDB();
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let count = 0;
      ids.forEach((id) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const it = getReq.result;
          if (it) {
            it.synced = true;
            store.put(it);
            count++;
          }
        };
      });
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }

  global.vetIdb = { addExpense, getAllExpenses, putExpense, markSynced };
})(this);
