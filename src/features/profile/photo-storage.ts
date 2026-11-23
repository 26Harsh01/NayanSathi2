import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import type { PhotoCropConfig, UserProfilePhotoMeta } from '../../types';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const IDB_DB_NAME = 'nayansathi_media_db';
const IDB_STORE_NAME = 'profile_photos';
const IDB_VERSION = 1;
const SUPABASE_BUCKET = 'user-avatars';

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  error?: string;
}

/**
 * Validates file extension, declared MIME type, file size limit, and binary magic header bytes.
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPG, PNG, or WebP image.',
    };
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      valid: false,
      error: 'Image file size must be between 1 byte and 5 MB.',
    };
  }

  try {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng =
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47;
    const isWebp =
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50;

    if (file.type === 'image/jpeg' && !isJpeg) {
      return { valid: false, error: 'File contents do not match a valid JPEG image.' };
    }
    if (file.type === 'image/png' && !isPng) {
      return { valid: false, error: 'File contents do not match a valid PNG image.' };
    }
    if (file.type === 'image/webp' && !isWebp) {
      return { valid: false, error: 'File contents do not match a valid WebP image.' };
    }

    return {
      valid: true,
      mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
    };
  } catch {
    return { valid: false, error: 'Unable to read the selected image file.' };
  }
}

export async function cropAndEncodeImage(
  imageSrc: string,
  crop: PhotoCropConfig,
  outputSize = 480,
  outputMime: 'image/webp' | 'image/jpeg' = 'image/webp'
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image for cropping.'));
    el.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context is unavailable.');
  }

  ctx.clearRect(0, 0, outputSize, outputSize);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outputSize, outputSize);

  const baseScale = Math.max(outputSize / img.naturalWidth, outputSize / img.naturalHeight);
  const zoom = Math.max(1, Math.min(2.5, crop.zoom || 1));
  const drawnW = img.naturalWidth * baseScale * zoom;
  const drawnH = img.naturalHeight * baseScale * zoom;

  const maxShiftX = Math.max(0, (drawnW - outputSize) * 0.5);
  const maxShiftY = Math.max(0, (drawnH - outputSize) * 0.5);

  const clampedOffX = Math.max(-100, Math.min(100, crop.offsetX || 0)) / 100;
  const clampedOffY = Math.max(-100, Math.min(100, crop.offsetY || 0)) / 100;

  const drawX = (outputSize - drawnW) * 0.5 + clampedOffX * maxShiftX;
  const drawY = (outputSize - drawnH) * 0.5 + clampedOffY * maxShiftY;

  ctx.drawImage(img, drawX, drawY, drawnW, drawnH);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      outputMime,
      0.88
    );
  });

  if (blob) return blob;

  // Fallback to PNG/JPEG if WebP encoder is unavailable in an environment
  const fallbackBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
  });
  if (!fallbackBlob) {
    throw new Error('Unable to encode cropped image.');
  }
  return fallbackBlob;
}

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open photo database.'));
  });
}

function makeIndexedDbKey(userId: string, slotKey: string): string {
  return `${userId}::${slotKey}`;
}

export async function putPhotoBlobInIndexedDb(
  userId: string,
  slotKey: string,
  blob: Blob
): Promise<void> {
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).put(blob, makeIndexedDbKey(userId, slotKey));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save photograph in IndexedDB.'));
  });
  db.close();
}

export async function getPhotoBlobFromIndexedDb(
  userId: string,
  slotKey: string
): Promise<Blob | null> {
  try {
    const db = await openPhotoDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(makeIndexedDbKey(userId, slotKey));
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function deletePhotoBlobFromIndexedDb(
  userId: string,
  slotKey: string
): Promise<void> {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).delete(makeIndexedDbKey(userId, slotKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore cleanup errors if IndexedDB unavailable
  }
}

export async function deleteAllUserPhotosFromIndexedDb(userId: string): Promise<void> {
  try {
    const db = await openPhotoDb();
    const prefix = `${userId}::`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore if IndexedDB unavailable
  }
}

/**
 * Saves a validated, cropped photo either to private Supabase Storage (if signed in)
 * or locally in IndexedDB, returning persisted metadata and a fresh display object URL.
 */
export async function saveUserPhotoAsset(params: {
  userId: string;
  slotKey: string;
  blob: Blob;
  crop: PhotoCropConfig;
}): Promise<{ meta: UserProfilePhotoMeta; objectUrl: string }> {
  const { userId, slotKey, blob, crop } = params;
  const nowIso = new Date().toISOString();
  const mime = (
    ALLOWED_IMAGE_MIME_TYPES.has(blob.type) ? blob.type : 'image/webp'
  ) as 'image/jpeg' | 'image/png' | 'image/webp';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';

  // Always cache locally in IndexedDB for instant offline load
  await putPhotoBlobInIndexedDb(userId, slotKey, blob);

  let storageKind: 'indexeddb' | 'supabase' = 'indexeddb';
  let remotePath: string | undefined;

  if (isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session?.user) {
        const safeSlot = slotKey.replace(/[^a-zA-Z0-9_-]/g, '_');
        const path = `${userId}/${safeSlot}.${ext}`;
        const { error: uploadErr } = await client.storage
          .from(SUPABASE_BUCKET)
          .upload(path, blob, { contentType: mime, upsert: true });

        if (!uploadErr) {
          storageKind = 'supabase';
          remotePath = path;
          await client.from('user_profile_photos').upsert(
            {
              user_id: userId,
              slot_key: slotKey,
              storage_path: path,
              mime_type: mime,
              size_bytes: blob.size,
              crop_zoom: crop.zoom,
              crop_offset_x: crop.offsetX,
              crop_offset_y: crop.offsetY,
              updated_at: nowIso,
            },
            { onConflict: 'user_id,slot_key' }
          );
        }
      }
    }
  }

  const meta: UserProfilePhotoMeta = {
    id: `${userId}_${slotKey}_${Date.now()}`,
    userId,
    slotKey,
    storageKind,
    mimeType: mime,
    sizeBytes: blob.size,
    crop,
    remotePath,
    updatedAt: nowIso,
  };

  const objectUrl = URL.createObjectURL(blob);
  return { meta, objectUrl };
}

export async function loadUserPhotoUrl(
  meta: UserProfilePhotoMeta | undefined
): Promise<string | null> {
  if (!meta) return null;

  // Prefer IndexedDB fast local blob first
  const localBlob = await getPhotoBlobFromIndexedDb(meta.userId, meta.slotKey);
  if (localBlob) {
    return URL.createObjectURL(localBlob);
  }

  if (meta.storageKind === 'supabase' && meta.remotePath && isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      const { data } = await client.storage
        .from(SUPABASE_BUCKET)
        .createSignedUrl(meta.remotePath, 3600);
      if (data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  return null;
}

export async function removeUserPhotoAsset(
  userId: string,
  slotKey: string,
  meta?: UserProfilePhotoMeta
): Promise<void> {
  await deletePhotoBlobFromIndexedDb(userId, slotKey);

  if (meta?.remotePath && isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session?.user) {
        await client.storage.from(SUPABASE_BUCKET).remove([meta.remotePath]);
        await client
          .from('user_profile_photos')
          .delete()
          .eq('user_id', userId)
          .eq('slot_key', slotKey);
      }
    }
  }
}
