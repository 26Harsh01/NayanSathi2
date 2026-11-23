import type { PatientAccountSummary } from '../../types';

export const DEFAULT_LOCAL_PATIENT_ID = 'patient_default';
const ACTIVE_PATIENT_KEY = 'nayanSathi.activePatientId';
const PATIENT_DIRECTORY_KEY = 'nayanSathi.patientDirectory';
export const ACTIVE_PATIENT_CHANGED_EVENT = 'nayansathi:active-patient-changed';

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getActivePatientId(): string {
  const storage = safeStorage();
  if (!storage) return DEFAULT_LOCAL_PATIENT_ID;
  const val = storage.getItem(ACTIVE_PATIENT_KEY);
  return val && val.trim() ? val.trim() : DEFAULT_LOCAL_PATIENT_ID;
}

export function listPatientAccounts(): PatientAccountSummary[] {
  const storage = safeStorage();
  const fallback: PatientAccountSummary[] = [
    {
      id: DEFAULT_LOCAL_PATIENT_ID,
      displayName: 'Primary Local Profile',
      createdAt: new Date(0).toISOString(),
    },
  ];
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(PATIENT_DIRECTORY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const clean = parsed.filter(
      (item): item is PatientAccountSummary =>
        Boolean(item && typeof item.id === 'string' && typeof item.displayName === 'string')
    );
    return clean.length > 0 ? clean : fallback;
  } catch {
    return fallback;
  }
}

function saveDirectory(list: PatientAccountSummary[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(PATIENT_DIRECTORY_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export function setActivePatientId(patientId: string): void {
  const storage = safeStorage();
  if (!storage) return;
  const accounts = listPatientAccounts();
  if (!accounts.some((a) => a.id === patientId)) {
    saveDirectory([
      ...accounts,
      { id: patientId, displayName: 'User Profile', createdAt: new Date().toISOString() },
    ]);
  }
  storage.setItem(ACTIVE_PATIENT_KEY, patientId);
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(ACTIVE_PATIENT_CHANGED_EVENT, { detail: { patientId } }));
  }
}

export function createPatientAccount(displayName: string): PatientAccountSummary {
  const id = `patient_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const summary: PatientAccountSummary = {
    id,
    displayName: displayName.trim() || 'New Profile',
    createdAt: new Date().toISOString(),
  };
  const next = [...listPatientAccounts(), summary];
  saveDirectory(next);
  setActivePatientId(id);
  return summary;
}

export function updatePatientAccountDisplayName(patientId: string, displayName: string): void {
  const clean = displayName.trim();
  if (!clean) return;
  const next = listPatientAccounts().map((acc) =>
    acc.id === patientId ? { ...acc, displayName: clean } : acc
  );
  saveDirectory(next);
}

export function removePatientAccountFromDirectory(patientId: string): string {
  const remaining = listPatientAccounts().filter((a) => a.id !== patientId);
  if (remaining.length === 0) {
    const fresh: PatientAccountSummary = {
      id: DEFAULT_LOCAL_PATIENT_ID,
      displayName: 'Primary Local Profile',
      createdAt: new Date().toISOString(),
    };
    saveDirectory([fresh]);
    setActivePatientId(fresh.id);
    return fresh.id;
  }
  saveDirectory(remaining);
  const nextId = remaining[0].id;
  setActivePatientId(nextId);
  return nextId;
}

export function getPatientScopedStorageKey(baseKey: string, patientId = getActivePatientId()): string {
  if (patientId === DEFAULT_LOCAL_PATIENT_ID) {
    return baseKey;
  }
  return `nayanSathi.u.${patientId}.${baseKey}`;
}
