/* ═══════════════════════════════════════════════════════════════
   offlineQueue.js — Cola offline con IndexedDB
   Guarda puntuaciones pendientes y registra Background Sync
   ═══════════════════════════════════════════════════════════════ */

const DB_NAME = 'campore-offline-queue';
const STORE_NAME = 'pending-scores';
const DB_VERSION = 1;
const SYNC_TAG = 'sync-scores';

/* ── Abrir / crear la base de datos ── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Encolar un array de payloads ── */
export async function enqueuePayloads(payloads) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const payload of payloads) {
    store.add({ payload, createdAt: Date.now() });
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  // Registrar Background Sync
  await requestSync();
}

/* ── Obtener todos los items pendientes ── */
export async function getAllPending() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Eliminar un item por id ── */
export async function removePending(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ── Contar items pendientes ── */
export async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Registrar Background Sync ── */
async function requestSync() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    // Intentar Background Sync nativo
    if ('sync' in reg) {
      await reg.sync.register(SYNC_TAG);
      return;
    }
  } catch (e) {
    console.warn('[offlineQueue] Error registrando sync:', e);
  }

  // Fallback: si estamos online ahora, pedirle al SW que envíe directamente
  if (navigator.onLine) {
    forceSyncViaMessage();
  }
}

/* ── Fallback: enviar mensaje al SW para que sincronice ── */
export async function forceSyncViaMessage() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: 'FORCE_SYNC' });
    }
  } catch (e) {
    console.warn('[offlineQueue] Error en forceSyncViaMessage:', e);
  }
}
