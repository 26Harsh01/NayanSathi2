/**
 * Patient-scoped IndexedDB store for photographs (profile photo, belongings, important people,
 * favourites, custom items). Validates image types and resizes on canvas so local storage remains
 * responsive and resilient without hitting small localStorage quotas.
 */

const DB_NAME = 'nayansathi_media_db_v1';
const STORE_NAME = 'images';
const MAX_DIMENSION = 640;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const memoryFallback = new Map<string, string>();

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function buildScopedAssetKey(patientId: string, assetId: string): string {
  const safePatient = patientId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAsset = assetId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safePatient}:${safeAsset}`;
}

export async function processImageFileToDataUrl(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Please choose a JPEG, PNG, WebP, or GIF image file.');
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error('Image file must be 6 MB or smaller.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed reading the selected image file.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined') return rawDataUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export async function savePatientImage(
  patientId: string,
  assetId: string,
  dataUrl: string
): Promise<void> {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image payload.');
  }
  const key = buildScopedAssetKey(patientId, assetId);
  memoryFallback.set(key, dataUrl);

  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        key,
        patientId,
        assetId,
        dataUrl,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadPatientImage(
  patientId: string,
  assetId: string
): Promise<string | null> {
  if (!assetId) return null;
  const key = buildScopedAssetKey(patientId, assetId);
  const mem = memoryFallback.get(key);
  if (mem) return mem;

  const db = await openMediaDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const result = req.result as { dataUrl?: string } | undefined;
        const val = typeof result?.dataUrl === 'string' ? result.dataUrl : null;
        if (val) memoryFallback.set(key, val);
        db.close();
        resolve(val);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function loadAllImagesForPatient(
  patientId: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const prefix = `${patientId.replace(/[^a-zA-Z0-9_-]/g, '_')}:`;

  for (const [k, v] of memoryFallback.entries()) {
    if (k.startsWith(prefix)) {
      out[k.slice(prefix.length)] = v;
    }
  }

  const db = await openMediaDb();
  if (!db) return out;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        for (const row of rows) {
          if (
            row &&
            typeof row.key === 'string' &&
            row.key.startsWith(prefix) &&
            typeof row.dataUrl === 'string'
          ) {
            const assetId = row.key.slice(prefix.length);
            out[assetId] = row.dataUrl;
            memoryFallback.set(row.key, row.dataUrl);
          }
        }
        db.close();
        resolve(out);
      };
      req.onerror = () => {
        db.close();
        resolve(out);
      };
    } catch {
      db.close();
      resolve(out);
    }
  });
}

export async function deleteAllImagesForPatient(patientId: string): Promise<void> {
  const prefix = `${patientId.replace(/[^a-zA-Z0-9_-]/g, '_')}:`;
  for (const k of Array.from(memoryFallback.keys())) {
    if (k.startsWith(prefix)) {
      memoryFallback.delete(k);
    }
  }

  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = Array.isArray(req.result) ? req.result : [];
        for (const k of keys) {
          if (typeof k === 'string' && k.startsWith(prefix)) {
            store.delete(k);
          }
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
