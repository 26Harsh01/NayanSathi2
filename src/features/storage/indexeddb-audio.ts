/**
 * Patient-scoped IndexedDB audio blob storage for the Music module.
 * Stores only user-uploaded permitted audio files and verifies format support
 * against browser playback capabilities.
 */

const AUDIO_DB_NAME = 'nayansathi_audio_db_v1';
const AUDIO_STORE_NAME = 'tracks';
const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB local browser limit

const ACCEPTED_AUDIO_MIME_PREFIXES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
];

const memoryAudioFallback = new Map<string, { blob: Blob; mimeType: string }>();

function openAudioDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(AUDIO_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
          db.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function buildAudioAssetKey(patientId: string, assetId: string): string {
  const safePatient = patientId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAsset = assetId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safePatient}:${safeAsset}`;
}

export function inferAudioMimeType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return '';
}

export function validateAudioFileForBrowser(file: File): {
  ok: boolean;
  mimeType: string;
  error?: string;
} {
  if (file.size === 0) {
    return { ok: false, mimeType: '', error: 'The selected audio file is empty.' };
  }
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return {
      ok: false,
      mimeType: '',
      error: 'Audio file must be 50 MB or smaller for browser storage.',
    };
  }
  const mimeType = inferAudioMimeType(file);
  if (!mimeType || !ACCEPTED_AUDIO_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return {
      ok: false,
      mimeType: '',
      error: 'Unsupported audio file type. Please choose MP3, WAV, OGG, M4A, AAC, FLAC, or WebM.',
    };
  }
  if (typeof document !== 'undefined') {
    const probe = document.createElement('audio');
    if (typeof probe.canPlayType === 'function') {
      const support = probe.canPlayType(mimeType);
      if (support === '') {
        return {
          ok: false,
          mimeType,
          error: `This browser cannot decode "${mimeType}" audio files. Try MP3, WAV, or OGG.`,
        };
      }
    }
  }
  return { ok: true, mimeType };
}

export function probeAudioDurationSec(blob: Blob): Promise<number> {
  if (typeof window === 'undefined' || typeof URL === 'undefined' || typeof Audio === 'undefined') {
    return Promise.resolve(0);
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio();
    const cleanup = () => {
      audio.src = '';
      URL.revokeObjectURL(objectUrl);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 3000);
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : 0;
      cleanup();
      resolve(dur);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(0);
    };
    audio.src = objectUrl;
  });
}

export async function savePatientAudioBlob(
  patientId: string,
  assetId: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const key = buildAudioAssetKey(patientId, assetId);
  memoryAudioFallback.set(key, { blob, mimeType });

  const db = await openAudioDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
      tx.objectStore(AUDIO_STORE_NAME).put({
        key,
        patientId,
        assetId,
        blob,
        mimeType,
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

export async function loadPatientAudioBlob(
  patientId: string,
  assetId: string
): Promise<{ blob: Blob; mimeType: string } | null> {
  if (!assetId) return null;
  const key = buildAudioAssetKey(patientId, assetId);
  const mem = memoryAudioFallback.get(key);
  if (mem) return mem;

  const db = await openAudioDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE_NAME, 'readonly');
      const req = tx.objectStore(AUDIO_STORE_NAME).get(key);
      req.onsuccess = () => {
        const res = req.result as { blob?: Blob; mimeType?: string } | undefined;
        if (res?.blob instanceof Blob) {
          const entry = { blob: res.blob, mimeType: res.mimeType || res.blob.type || 'audio/mpeg' };
          memoryAudioFallback.set(key, entry);
          db.close();
          resolve(entry);
          return;
        }
        db.close();
        resolve(null);
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

export async function deletePatientAudioBlob(patientId: string, assetId: string): Promise<void> {
  const key = buildAudioAssetKey(patientId, assetId);
  memoryAudioFallback.delete(key);

  const db = await openAudioDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
      tx.objectStore(AUDIO_STORE_NAME).delete(key);
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

export async function deleteAllAudioForPatient(patientId: string): Promise<void> {
  const prefix = `${patientId.replace(/[^a-zA-Z0-9_-]/g, '_')}:`;
  for (const k of Array.from(memoryAudioFallback.keys())) {
    if (k.startsWith(prefix)) {
      memoryAudioFallback.delete(k);
    }
  }

  const db = await openAudioDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
      const store = tx.objectStore(AUDIO_STORE_NAME);
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
