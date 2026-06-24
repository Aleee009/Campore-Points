/* ═══════════════════════════════════════════════════════════════
   Service Worker — Camporé Points
   Background Sync + Precache (inyectado por vite-plugin-pwa)
   ═══════════════════════════════════════════════════════════════ */

import { precacheAndRoute } from 'workbox-precaching';

// Precachea todos los assets generados por Vite (inyectado en build)
precacheAndRoute(self.__WB_MANIFEST);

/* ── Constantes ── */
const DB_NAME = 'campore-offline-queue';
const STORE_NAME = 'pending-scores';
const SYNC_TAG = 'sync-scores';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwTwT_-ngPeQt3deqDE8omSL7MCsqHewTwpO5dEBfnnFNPBbr2DJm2RqS-Ypc5abRM_Fg/exec';

/* ── IndexedDB helpers (duplicados en el SW porque no comparte módulos con la app) ── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
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

function getAllPending() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function removePending(id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

/* ── Background Sync handler ── */
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingScores());
  }
});

async function syncPendingScores() {
  const pending = await getAllPending();
  if (!pending.length) return;

  let failCount = 0;

  for (const item of pending) {
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify(item.payload),
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors'
      });
      // mode: 'no-cors' siempre da status 0 / type opaque, lo cual es "éxito" para GAS
      await removePending(item.id);
    } catch (err) {
      console.warn('[SW] Error enviando puntuación pendiente:', err);
      failCount++;
    }
  }

  // Si quedaron items sin enviar, lanzamos error para que el navegador reintente
  if (failCount > 0) {
    throw new Error(`${failCount} puntuación(es) no se pudieron enviar, se reintentará.`);
  }

  // Notificar a los clientes que la cola se vació
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_COMPLETE', remaining: 0 });
  }
}

/* ── Mensaje desde la app para forzar sync (fallback) ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_SYNC') {
    event.waitUntil(syncPendingScores());
  }
});
