import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import type {
  EmergencyAlert,
  EmergencyContact,
  EmergencyProviderStatus,
  EmergencySettings,
  Language,
} from '../../types';
import { getPatientScopedStorageKey } from '../storage/patient-accounts';

const OFFLINE_ALERTS_KEY = 'nayanSathi.offlineEmergencyAlerts.v1';
const LOCAL_SETTINGS_KEY = 'nayanSathi.emergencySettings.v1';

export interface EmergencyStatusResponse {
  providers: EmergencyProviderStatus;
  activeAlert: EmergencyAlert | null;
  alerts: EmergencyAlert[];
  settings: EmergencySettings;
  contactsCount: number;
}

export interface TriggerSosPayload {
  patientId: string;
  patientName: string;
  patientPhotoUrl?: string;
  alertType: 'sos' | 'test';
  language: Language;
  messageText?: string;
  latitude: number | null;
  longitude: number | null;
  locationShared: boolean;
  locationStatus: 'shared' | 'unavailable' | 'denied' | 'disabled';
  idempotencyKey: string;
  contacts: EmergencyContact[];
  targetContactId?: string;
  simulateTest?: boolean;
}

export interface TriggerSosResult {
  ok: boolean;
  offlineFallback?: boolean;
  duplicatePrevented?: boolean;
  alert?: EmergencyAlert;
  warning?: string;
  error?: string;
  skippedContacts?: Array<{ contactId: string; name: string; reason: string }>;
}

function getBackendBaseUrl(): string {
  return (import.meta.env.VITE_BACKEND_API_URL as string | undefined)?.replace(/\/$/, '') || '';
}

async function buildAuthHeaders(patientId: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-NayanSathi-Patient-Id': patientId,
  };
  if (isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
  }
  return headers;
}

export function createDefaultClientEmergencySettings(patientId: string): EmergencySettings {
  return {
    patientId,
    whatsappEnabled: true,
    smsEnabled: true,
    notificationPriority: 'whatsapp_first',
    locationSharingEnabled: false,
    escalationEnabled: true,
    escalationIntervalSec: 120,
    confirmationMode: 'two_step',
    customMessageEn:
      'An emergency assistance request has been activated. Please contact the patient immediately and provide assistance.',
    customMessageHi:
      'आपातकालीन सहायता अनुरोध सक्रिय किया गया है। कृपया तुरंत रोगी से संपर्क करें और सहायता प्रदान करें।',
    smsDltTemplateId: '',
    smsDltEntityId: '',
    testSimulationMode: false,
    updatedAt: new Date().toISOString(),
  };
}

export function readLocalEmergencySettings(patientId: string): EmergencySettings {
  if (typeof window === 'undefined') return createDefaultClientEmergencySettings(patientId);
  try {
    const raw = window.localStorage.getItem(getPatientScopedStorageKey(LOCAL_SETTINGS_KEY, patientId));
    if (!raw) return createDefaultClientEmergencySettings(patientId);
    return {
      ...createDefaultClientEmergencySettings(patientId),
      ...(JSON.parse(raw) as Partial<EmergencySettings>),
      patientId,
    };
  } catch {
    return createDefaultClientEmergencySettings(patientId);
  }
}

export function writeLocalEmergencySettings(patientId: string, settings: EmergencySettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getPatientScopedStorageKey(LOCAL_SETTINGS_KEY, patientId),
      JSON.stringify(settings)
    );
  } catch {
    // ignore storage errors
  }
}

export function readOfflineEmergencyAlerts(patientId: string): EmergencyAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getPatientScopedStorageKey(OFFLINE_ALERTS_KEY, patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmergencyAlert[]) : [];
  } catch {
    return [];
  }
}

export function writeOfflineEmergencyAlerts(patientId: string, alerts: EmergencyAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getPatientScopedStorageKey(OFFLINE_ALERTS_KEY, patientId),
      JSON.stringify(alerts.slice(0, 25))
    );
  } catch {
    // ignore storage errors
  }
}

export function createOfflineLocalAlert(payload: TriggerSosPayload): EmergencyAlert {
  const mapLink =
    payload.locationShared && payload.latitude !== null && payload.longitude !== null
      ? `https://maps.google.com/?q=${payload.latitude.toFixed(6)},${payload.longitude.toFixed(6)}`
      : undefined;

  return {
    id: `local_sos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    patientId: payload.patientId,
    patientName: payload.patientName,
    patientPhotoUrl: payload.patientPhotoUrl,
    createdAt: new Date().toISOString(),
    alertType: payload.alertType,
    messageText:
      payload.messageText ||
      'Emergency assistance requested. Remote notification could not be confirmed (offline/unreachable).',
    latitude: payload.locationShared ? payload.latitude : null,
    longitude: payload.locationShared ? payload.longitude : null,
    locationShared: payload.locationShared,
    locationStatus: payload.locationStatus,
    mapLink,
    currentStatus: 'failed',
    escalationStage: 0,
    idempotencyKey: payload.idempotencyKey,
    isOfflineQueued: true,
    notificationLogs: [],
  };
}

export async function fetchEmergencyStatus(patientId: string): Promise<EmergencyStatusResponse | null> {
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/status?patientId=${encodeURIComponent(patientId)}`,
      { headers }
    );
    if (!res.ok) return null;
    return (await res.json()) as EmergencyStatusResponse;
  } catch {
    return null;
  }
}

export async function syncContactsToServer(
  patientId: string,
  contacts: EmergencyContact[]
): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/contacts/${encodeURIComponent(patientId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ contacts }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveEmergencySettingsOnServer(
  patientId: string,
  patch: Partial<EmergencySettings>
): Promise<EmergencySettings | null> {
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/settings/${encodeURIComponent(patientId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(patch),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { settings?: EmergencySettings };
    return data.settings ?? null;
  } catch {
    return null;
  }
}

export async function triggerEmergencySosApi(
  payload: TriggerSosPayload
): Promise<TriggerSosResult> {
  try {
    const headers = await buildAuthHeaders(payload.patientId);
    const res = await fetch(`${getBackendBaseUrl()}/api/emergency/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as TriggerSosResult & { message?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error || `Emergency API returned HTTP ${res.status}`,
      };
    }

    return data;
  } catch (err) {
    // Network / offline fallback — create a local emergency event and explicitly state notification could NOT be confirmed!
    const offlineAlert = createOfflineLocalAlert(payload);
    return {
      ok: false,
      offlineFallback: true,
      alert: offlineAlert,
      error:
        err instanceof Error
          ? `Server unreachable (${err.message}). Remote notification was NOT sent—use direct phone calling or SMS handoff below.`
          : 'No internet connection. Remote notification was NOT sent—use direct phone calling or SMS handoff below.',
    };
  }
}

export async function acknowledgeEmergencyAlertApi(
  patientId: string,
  alertId: string,
  caregiverName: string
): Promise<EmergencyAlert | null> {
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/alerts/${encodeURIComponent(alertId)}/acknowledge`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ caregiverName }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { alert?: EmergencyAlert };
    return data.alert ?? null;
  } catch {
    return null;
  }
}

export async function markEmergencyInProgressApi(
  patientId: string,
  alertId: string,
  caregiverName: string
): Promise<EmergencyAlert | null> {
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/alerts/${encodeURIComponent(alertId)}/in-progress`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ caregiverName }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { alert?: EmergencyAlert };
    return data.alert ?? null;
  } catch {
    return null;
  }
}

export async function resolveEmergencyAlertApi(
  patientId: string,
  alertId: string,
  resolvedBy: string
): Promise<EmergencyAlert | null> {
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/alerts/${encodeURIComponent(alertId)}/resolve`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolvedBy }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { alert?: EmergencyAlert };
    return data.alert ?? null;
  } catch {
    return null;
  }
}

export async function retryEmergencyAlertApi(
  patientId: string,
  alertId: string
): Promise<EmergencyAlert | null> {
  try {
    const headers = await buildAuthHeaders(patientId);
    const res = await fetch(
      `${getBackendBaseUrl()}/api/emergency/alerts/${encodeURIComponent(alertId)}/retry`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { alert?: EmergencyAlert };
    return data.alert ?? null;
  } catch {
    return null;
  }
}

export function subscribeToEmergencyStream(
  patientId: string,
  handlers: {
    onInit?: (data: { activeAlert: EmergencyAlert | null; alerts: EmergencyAlert[] }) => void;
    onAlert?: (alert: EmergencyAlert) => void;
    onSettings?: (settings: EmergencySettings) => void;
  }
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const url = `${getBackendBaseUrl()}/api/emergency/stream?patientId=${encodeURIComponent(patientId)}`;
  const es = new EventSource(url);

  es.addEventListener('init', (ev) => {
    try {
      const parsed = JSON.parse((ev as MessageEvent<string>).data) as {
        activeAlert: EmergencyAlert | null;
        alerts: EmergencyAlert[];
      };
      handlers.onInit?.(parsed);
    } catch {
      // ignore parse errors
    }
  });

  const handleAlertEvent = (ev: Event) => {
    try {
      const alert = JSON.parse((ev as MessageEvent<string>).data) as EmergencyAlert;
      handlers.onAlert?.(alert);
    } catch {
      // ignore parse errors
    }
  };

  es.addEventListener('alert:created', handleAlertEvent);
  es.addEventListener('alert:updated', handleAlertEvent);
  es.addEventListener('settings:updated', (ev) => {
    try {
      const settings = JSON.parse((ev as MessageEvent<string>).data) as EmergencySettings;
      handlers.onSettings?.(settings);
    } catch {
      // ignore parse errors
    }
  });

  return () => {
    es.close();
  };
}
