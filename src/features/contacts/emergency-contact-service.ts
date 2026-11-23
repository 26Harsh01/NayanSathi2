import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import type { EmergencyContact } from '../../types';
import {
  normalizePhoneNumber,
  validateContactInput,
  type ContactInput,
} from './contact-utils';

export const EMERGENCY_CONTACTS_STORAGE_KEY = 'nayanSathi.emergencyContacts';
export const LEGACY_CONTACTS_STORAGE_KEY = 'nayansathi_contacts_v1';
export const CONTACTS_CHANGED_EVENT = 'nayansathi:contacts-changed';

export type ContactStorageMode = 'local' | 'supabase';

export interface ContactLoadResult {
  contacts: EmergencyContact[];
  mode: ContactStorageMode;
  corrupted: boolean;
  error?: string;
}

export interface ContactMutationResult {
  ok: boolean;
  contacts: EmergencyContact[];
  contact?: EmergencyContact;
  mode: ContactStorageMode;
  error?: string;
  fieldErrors?: Partial<Record<'name' | 'relationship' | 'phone' | 'email', string>>;
}

interface RawLegacyContact {
  id?: unknown;
  name?: unknown;
  relation?: unknown;
  relationship?: unknown;
  phone?: unknown;
  email?: unknown;
  isPrimary?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface SupabaseContactRow {
  id: string;
  patient_id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

function generateContactId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isLegacyBlankPlaceholder(raw: RawLegacyContact): boolean {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  return (name === '' || name === 'Primary Caregiver') && phone === '' && email === '';
}

function sanitizeStoredRecord(raw: unknown): EmergencyContact | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as RawLegacyContact;
  if (isLegacyBlankPlaceholder(item)) return null;

  const name = typeof item.name === 'string' ? item.name.trim() : '';
  const relationshipRaw =
    typeof item.relationship === 'string'
      ? item.relationship
      : typeof item.relation === 'string'
        ? item.relation
        : '';
  const relationship = relationshipRaw.trim();
  const phone = typeof item.phone === 'string' ? normalizePhoneNumber(item.phone) : '';
  const email = typeof item.email === 'string' ? item.email.trim() : '';

  if (!name || !phone) return null;

  const nowIso = new Date().toISOString();
  const createdAt =
    typeof item.createdAt === 'string' && item.createdAt.trim() ? item.createdAt : nowIso;
  const updatedAt =
    typeof item.updatedAt === 'string' && item.updatedAt.trim() ? item.updatedAt : createdAt;

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateContactId(),
    name,
    relationship,
    phone,
    email,
    isPrimary: Boolean(item.isPrimary),
    createdAt,
    updatedAt,
  };
}

/**
 * Ensures at most one contact is marked primary, promotes the first contact if needed,
 * and orders the primary contact first.
 */
export function enforcePrimaryInvariant(
  contacts: EmergencyContact[],
  preferredPrimaryId?: string
): EmergencyContact[] {
  if (contacts.length === 0) return [];

  let primaryId = preferredPrimaryId;
  if (!primaryId || !contacts.some((c) => c.id === primaryId)) {
    const existingPrimary = contacts.find((c) => c.isPrimary);
    primaryId = existingPrimary ? existingPrimary.id : contacts[0].id;
  }

  const normalized = contacts.map((c) => ({
    ...c,
    isPrimary: c.id === primaryId,
  }));

  return [
    ...normalized.filter((c) => c.isPrimary),
    ...normalized.filter((c) => !c.isPrimary),
  ];
}

function checkDuplicateContact(
  contacts: EmergencyContact[],
  normalizedPhone: string,
  normalizedEmail: string,
  excludeId?: string
): string | null {
  const emailLower = normalizedEmail.toLowerCase();
  for (const c of contacts) {
    if (excludeId && c.id === excludeId) continue;
    if (c.phone && c.phone === normalizedPhone) {
      return 'An emergency contact with this phone number already exists.';
    }
    if (emailLower && c.email && c.email.toLowerCase() === emailLower) {
      return 'An emergency contact with this email address already exists.';
    }
  }
  return null;
}

function dispatchContactsChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT));
  }
}

function getLocalStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readContactsFromLocalStorage(): ContactLoadResult {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return {
      contacts: [],
      mode: 'local',
      corrupted: false,
      error: 'Browser storage is unavailable in this environment.',
    };
  }

  try {
    let raw = storage.getItem(EMERGENCY_CONTACTS_STORAGE_KEY);
    let migratedFromLegacy = false;

    if (raw === null) {
      const legacyRaw = storage.getItem(LEGACY_CONTACTS_STORAGE_KEY);
      if (legacyRaw !== null) {
        raw = legacyRaw;
        migratedFromLegacy = true;
      }
    }

    if (!raw) {
      return { contacts: [], mode: 'local', corrupted: false };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        contacts: [],
        mode: 'local',
        corrupted: true,
        error: 'Stored emergency contacts data was invalid and could not be loaded.',
      };
    }

    const sanitized = enforcePrimaryInvariant(
      parsed
        .map(sanitizeStoredRecord)
        .filter((item): item is EmergencyContact => item !== null)
    );

    if (migratedFromLegacy) {
      if (sanitized.length > 0) {
        storage.setItem(EMERGENCY_CONTACTS_STORAGE_KEY, JSON.stringify(sanitized));
      }
      storage.removeItem(LEGACY_CONTACTS_STORAGE_KEY);
    }

    return { contacts: sanitized, mode: 'local', corrupted: false };
  } catch {
    return {
      contacts: [],
      mode: 'local',
      corrupted: true,
      error: 'Stored emergency contact JSON could not be parsed. Save a contact to repair storage.',
    };
  }
}

function writeContactsToLocalStorage(contacts: EmergencyContact[]): { ok: boolean; error?: string } {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return {
      ok: false,
      error: 'Cannot save contact because browser storage is unavailable.',
    };
  }

  try {
    const normalized = enforcePrimaryInvariant(contacts);
    if (normalized.length === 0) {
      storage.removeItem(EMERGENCY_CONTACTS_STORAGE_KEY);
      storage.removeItem(LEGACY_CONTACTS_STORAGE_KEY);
    } else {
      const payload = JSON.stringify(normalized);
      storage.setItem(EMERGENCY_CONTACTS_STORAGE_KEY, payload);
      // Verify the write actually persisted
      if (storage.getItem(EMERGENCY_CONTACTS_STORAGE_KEY) !== payload) {
        return {
          ok: false,
          error: 'Browser storage did not retain the saved emergency contact.',
        };
      }
    }
    dispatchContactsChanged();
    return { ok: true };
  } catch (err: unknown) {
    const detail =
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Browser storage quota exceeded. Clear unused data and try again.'
        : 'Unable to save emergency contact to browser storage.';
    return { ok: false, error: detail };
  }
}

interface SupabaseContext {
  client: NonNullable<ReturnType<typeof getSupabaseClient>>;
  patientId: string;
}

async function getAuthenticatedSupabaseContext(): Promise<{
  ctx: SupabaseContext | null;
  error?: string;
}> {
  if (!isSupabaseConfigured) return { ctx: null };
  const client = getSupabaseClient();
  if (!client) return { ctx: null };

  try {
    const {
      data: { session },
      error: sessionError,
    } = await client.auth.getSession();

    if (sessionError) {
      return { ctx: null, error: 'Unable to verify cloud session for emergency contacts.' };
    }

    const user = session?.user;
    if (!user) {
      // Supabase keys exist in env, but no user is signed in -> fall back cleanly to Local Demo Mode.
      return { ctx: null };
    }

    // Check if the signed-in user is an explicitly consented caregiver acting for a patient
    const { data: userRow } = await client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    let patientId = user.id;
    if (userRow?.role === 'caregiver') {
      const { data: rel, error: relError } = await client
        .from('caregiver_relationships')
        .select('patient_id')
        .eq('caregiver_id', user.id)
        .eq('consent_granted', true)
        .eq('can_edit_phrases', true)
        .order('granted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (relError) {
        return { ctx: null, error: 'Could not verify caregiver authorization for patient contacts.' };
      }
      if (!rel?.patient_id) {
        return {
          ctx: null,
          error: 'No authorized patient link found for this caregiver account.',
        };
      }
      patientId = rel.patient_id;
    }

    return { ctx: { client, patientId } };
  } catch {
    return { ctx: null, error: 'Could not connect to Supabase to verify authorization.' };
  }
}

function mapSupabaseRow(row: SupabaseContactRow): EmergencyContact {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    phone: normalizePhoneNumber(row.phone),
    email: row.email || '',
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadEmergencyContactsService(): Promise<ContactLoadResult> {
  const { ctx, error: ctxError } = await getAuthenticatedSupabaseContext();
  if (ctxError) {
    return { contacts: [], mode: 'supabase', corrupted: false, error: ctxError };
  }

  if (ctx) {
    try {
      const { data, error } = await ctx.client
        .from('emergency_contacts')
        .select('id, patient_id, name, relationship, phone, email, is_primary, created_at, updated_at')
        .eq('patient_id', ctx.patientId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        return {
          contacts: [],
          mode: 'supabase',
          corrupted: false,
          error: `Failed to load emergency contacts from database: ${error.message}`,
        };
      }

      const mapped = enforcePrimaryInvariant(((data || []) as SupabaseContactRow[]).map(mapSupabaseRow));
      return { contacts: mapped, mode: 'supabase', corrupted: false };
    } catch {
      return {
        contacts: [],
        mode: 'supabase',
        corrupted: false,
        error: 'Network error while loading emergency contacts from database.',
      };
    }
  }

  return readContactsFromLocalStorage();
}

export async function addEmergencyContactService(
  input: ContactInput
): Promise<ContactMutationResult> {
  const validation = validateContactInput(input);
  if (!validation.valid) {
    return {
      ok: false,
      contacts: [],
      mode: 'local',
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    };
  }

  const loaded = await loadEmergencyContactsService();
  if (loaded.error && !loaded.corrupted) {
    return { ok: false, contacts: loaded.contacts, mode: loaded.mode, error: loaded.error };
  }

  const existing = loaded.contacts;
  const dupError = checkDuplicateContact(
    existing,
    validation.normalized.phone,
    validation.normalized.email
  );
  if (dupError) {
    return { ok: false, contacts: existing, mode: loaded.mode, error: dupError };
  }

  const shouldBePrimary = existing.length === 0 || validation.normalized.isPrimary;
  const nowIso = new Date().toISOString();

  const { ctx, error: ctxError } = await getAuthenticatedSupabaseContext();
  if (ctxError) {
    return { ok: false, contacts: existing, mode: 'supabase', error: ctxError };
  }

  if (ctx) {
    try {
      if (shouldBePrimary && existing.some((c) => c.isPrimary)) {
        const { error: clearErr } = await ctx.client
          .from('emergency_contacts')
          .update({ is_primary: false, updated_at: nowIso })
          .eq('patient_id', ctx.patientId)
          .eq('is_primary', true);

        if (clearErr) {
          return {
            ok: false,
            contacts: existing,
            mode: 'supabase',
            error: `Failed to update existing primary contact: ${clearErr.message}`,
          };
        }
      }

      const { data, error } = await ctx.client
        .from('emergency_contacts')
        .insert({
          patient_id: ctx.patientId,
          name: validation.normalized.name,
          relationship: validation.normalized.relationship,
          phone: validation.normalized.phone,
          email: validation.normalized.email,
          is_primary: shouldBePrimary,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id, patient_id, name, relationship, phone, email, is_primary, created_at, updated_at')
        .single();

      if (error || !data) {
        return {
          ok: false,
          contacts: existing,
          mode: 'supabase',
          error: error?.message || 'Failed to save emergency contact to database.',
        };
      }

      const created = mapSupabaseRow(data as SupabaseContactRow);
      const next = enforcePrimaryInvariant(
        [...existing, created],
        shouldBePrimary ? created.id : undefined
      );
      return { ok: true, contacts: next, contact: created, mode: 'supabase' };
    } catch {
      return {
        ok: false,
        contacts: existing,
        mode: 'supabase',
        error: 'Database connection error while saving emergency contact.',
      };
    }
  }

  const created: EmergencyContact = {
    id: generateContactId(),
    name: validation.normalized.name,
    relationship: validation.normalized.relationship,
    phone: validation.normalized.phone,
    email: validation.normalized.email,
    isPrimary: shouldBePrimary,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const next = enforcePrimaryInvariant(
    [...existing, created],
    shouldBePrimary ? created.id : undefined
  );
  const writeRes = writeContactsToLocalStorage(next);
  if (!writeRes.ok) {
    return { ok: false, contacts: existing, mode: 'local', error: writeRes.error };
  }

  return {
    ok: true,
    contacts: next,
    contact: next.find((c) => c.id === created.id) ?? created,
    mode: 'local',
  };
}

export async function updateEmergencyContactService(
  id: string,
  input: ContactInput
): Promise<ContactMutationResult> {
  const validation = validateContactInput(input);
  if (!validation.valid) {
    return {
      ok: false,
      contacts: [],
      mode: 'local',
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    };
  }

  const loaded = await loadEmergencyContactsService();
  if (loaded.error && !loaded.corrupted) {
    return { ok: false, contacts: loaded.contacts, mode: loaded.mode, error: loaded.error };
  }

  const existing = loaded.contacts;
  const target = existing.find((c) => c.id === id);
  if (!target) {
    return {
      ok: false,
      contacts: existing,
      mode: loaded.mode,
      error: 'The contact you are trying to update no longer exists.',
    };
  }

  const dupError = checkDuplicateContact(
    existing,
    validation.normalized.phone,
    validation.normalized.email,
    id
  );
  if (dupError) {
    return { ok: false, contacts: existing, mode: loaded.mode, error: dupError };
  }

  const shouldBePrimary =
    existing.length === 1 || validation.normalized.isPrimary || target.isPrimary;
  const nowIso = new Date().toISOString();

  const { ctx, error: ctxError } = await getAuthenticatedSupabaseContext();
  if (ctxError) {
    return { ok: false, contacts: existing, mode: 'supabase', error: ctxError };
  }

  if (ctx) {
    try {
      if (shouldBePrimary) {
        const { error: clearErr } = await ctx.client
          .from('emergency_contacts')
          .update({ is_primary: false, updated_at: nowIso })
          .eq('patient_id', ctx.patientId)
          .neq('id', id)
          .eq('is_primary', true);

        if (clearErr) {
          return {
            ok: false,
            contacts: existing,
            mode: 'supabase',
            error: `Failed to update primary flag: ${clearErr.message}`,
          };
        }
      }

      const { data, error } = await ctx.client
        .from('emergency_contacts')
        .update({
          name: validation.normalized.name,
          relationship: validation.normalized.relationship,
          phone: validation.normalized.phone,
          email: validation.normalized.email,
          is_primary: shouldBePrimary,
          updated_at: nowIso,
        })
        .eq('id', id)
        .eq('patient_id', ctx.patientId)
        .select('id, patient_id, name, relationship, phone, email, is_primary, created_at, updated_at')
        .single();

      if (error || !data) {
        return {
          ok: false,
          contacts: existing,
          mode: 'supabase',
          error: error?.message || 'Failed to update emergency contact in database.',
        };
      }

      const updated = mapSupabaseRow(data as SupabaseContactRow);
      const next = enforcePrimaryInvariant(
        existing.map((c) => (c.id === id ? updated : c)),
        shouldBePrimary ? id : undefined
      );
      return { ok: true, contacts: next, contact: updated, mode: 'supabase' };
    } catch {
      return {
        ok: false,
        contacts: existing,
        mode: 'supabase',
        error: 'Database connection error while updating emergency contact.',
      };
    }
  }

  const updated: EmergencyContact = {
    ...target,
    name: validation.normalized.name,
    relationship: validation.normalized.relationship,
    phone: validation.normalized.phone,
    email: validation.normalized.email,
    isPrimary: shouldBePrimary,
    updatedAt: nowIso,
  };

  const next = enforcePrimaryInvariant(
    existing.map((c) => (c.id === id ? updated : c)),
    shouldBePrimary ? id : undefined
  );
  const writeRes = writeContactsToLocalStorage(next);
  if (!writeRes.ok) {
    return { ok: false, contacts: existing, mode: 'local', error: writeRes.error };
  }

  return {
    ok: true,
    contacts: next,
    contact: next.find((c) => c.id === id) ?? updated,
    mode: 'local',
  };
}

export async function deleteEmergencyContactService(id: string): Promise<ContactMutationResult> {
  const loaded = await loadEmergencyContactsService();
  if (loaded.error && !loaded.corrupted) {
    return { ok: false, contacts: loaded.contacts, mode: loaded.mode, error: loaded.error };
  }

  const existing = loaded.contacts;
  const target = existing.find((c) => c.id === id);
  if (!target) {
    return {
      ok: false,
      contacts: existing,
      mode: loaded.mode,
      error: 'Emergency contact was not found.',
    };
  }

  const { ctx, error: ctxError } = await getAuthenticatedSupabaseContext();
  if (ctxError) {
    return { ok: false, contacts: existing, mode: 'supabase', error: ctxError };
  }

  if (ctx) {
    try {
      const { error } = await ctx.client
        .from('emergency_contacts')
        .delete()
        .eq('id', id)
        .eq('patient_id', ctx.patientId);

      if (error) {
        return {
          ok: false,
          contacts: existing,
          mode: 'supabase',
          error: `Failed to delete emergency contact: ${error.message}`,
        };
      }

      const remaining = existing.filter((c) => c.id !== id);
      const next = enforcePrimaryInvariant(remaining);
      if (next.length > 0 && !remaining.some((c) => c.isPrimary)) {
        await ctx.client
          .from('emergency_contacts')
          .update({ is_primary: true, updated_at: new Date().toISOString() })
          .eq('id', next[0].id)
          .eq('patient_id', ctx.patientId);
      }

      return { ok: true, contacts: next, mode: 'supabase' };
    } catch {
      return {
        ok: false,
        contacts: existing,
        mode: 'supabase',
        error: 'Database connection error while deleting emergency contact.',
      };
    }
  }

  const next = enforcePrimaryInvariant(existing.filter((c) => c.id !== id));
  const writeRes = writeContactsToLocalStorage(next);
  if (!writeRes.ok) {
    return { ok: false, contacts: existing, mode: 'local', error: writeRes.error };
  }

  return { ok: true, contacts: next, mode: 'local' };
}

export async function setPrimaryEmergencyContactService(
  id: string
): Promise<ContactMutationResult> {
  const loaded = await loadEmergencyContactsService();
  if (loaded.error && !loaded.corrupted) {
    return { ok: false, contacts: loaded.contacts, mode: loaded.mode, error: loaded.error };
  }

  const existing = loaded.contacts;
  const target = existing.find((c) => c.id === id);
  if (!target) {
    return {
      ok: false,
      contacts: existing,
      mode: loaded.mode,
      error: 'Selected contact does not exist.',
    };
  }

  const nowIso = new Date().toISOString();
  const { ctx, error: ctxError } = await getAuthenticatedSupabaseContext();
  if (ctxError) {
    return { ok: false, contacts: existing, mode: 'supabase', error: ctxError };
  }

  if (ctx) {
    try {
      const { error: clearErr } = await ctx.client
        .from('emergency_contacts')
        .update({ is_primary: false, updated_at: nowIso })
        .eq('patient_id', ctx.patientId)
        .eq('is_primary', true);

      if (clearErr) {
        return {
          ok: false,
          contacts: existing,
          mode: 'supabase',
          error: `Failed to update primary contact: ${clearErr.message}`,
        };
      }

      const { error: setErr } = await ctx.client
        .from('emergency_contacts')
        .update({ is_primary: true, updated_at: nowIso })
        .eq('id', id)
        .eq('patient_id', ctx.patientId);

      if (setErr) {
        return {
          ok: false,
          contacts: existing,
          mode: 'supabase',
          error: `Failed to set primary contact: ${setErr.message}`,
        };
      }

      const next = enforcePrimaryInvariant(
        existing.map((c) => ({ ...c, isPrimary: c.id === id, updatedAt: nowIso })),
        id
      );
      return { ok: true, contacts: next, contact: next[0], mode: 'supabase' };
    } catch {
      return {
        ok: false,
        contacts: existing,
        mode: 'supabase',
        error: 'Database connection error while updating primary contact.',
      };
    }
  }

  const next = enforcePrimaryInvariant(
    existing.map((c) => (c.id === id ? { ...c, isPrimary: true, updatedAt: nowIso } : c)),
    id
  );
  const writeRes = writeContactsToLocalStorage(next);
  if (!writeRes.ok) {
    return { ok: false, contacts: existing, mode: 'local', error: writeRes.error };
  }

  return { ok: true, contacts: next, contact: next[0], mode: 'local' };
}

export async function clearAllEmergencyContactsService(): Promise<ContactMutationResult> {
  const { ctx, error: ctxError } = await getAuthenticatedSupabaseContext();
  if (ctxError) {
    return { ok: false, contacts: [], mode: 'supabase', error: ctxError };
  }

  if (ctx) {
    try {
      const { error } = await ctx.client
        .from('emergency_contacts')
        .delete()
        .eq('patient_id', ctx.patientId);

      if (error) {
        return {
          ok: false,
          contacts: [],
          mode: 'supabase',
          error: `Failed to clear contacts: ${error.message}`,
        };
      }
      return { ok: true, contacts: [], mode: 'supabase' };
    } catch {
      return {
        ok: false,
        contacts: [],
        mode: 'supabase',
        error: 'Database connection error while clearing contacts.',
      };
    }
  }

  const res = writeContactsToLocalStorage([]);
  return res.ok
    ? { ok: true, contacts: [], mode: 'local' }
    : { ok: false, contacts: [], mode: 'local', error: res.error };
}
