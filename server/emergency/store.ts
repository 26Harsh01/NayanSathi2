import fs from 'fs';
import path from 'path';
import type { Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createDefaultEmergencySettings,
  type AuditLogEntry,
  type ServerEmergencyAlert,
  type ServerEmergencyContact,
  type ServerEmergencySettings,
  type ServerNotificationLog,
} from './types';

interface PersistedEmergencyStore {
  contactsByPatient: Record<string, ServerEmergencyContact[]>;
  settingsByPatient: Record<string, ServerEmergencySettings>;
  alertsByPatient: Record<string, ServerEmergencyAlert[]>;
  auditLogs: AuditLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'emergency-store.json');

const state: PersistedEmergencyStore = {
  contactsByPatient: {},
  settingsByPatient: {},
  alertsByPatient: {},
  auditLogs: [],
};

const sseClientsByPatient = new Map<string, Set<Response>>();
const rateLimitBuckets = new Map<string, number[]>();

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdminClient;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function loadStoreFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as Partial<PersistedEmergencyStore>;
    if (parsed.contactsByPatient && typeof parsed.contactsByPatient === 'object') {
      state.contactsByPatient = parsed.contactsByPatient;
    }
    if (parsed.settingsByPatient && typeof parsed.settingsByPatient === 'object') {
      state.settingsByPatient = parsed.settingsByPatient;
    }
    if (parsed.alertsByPatient && typeof parsed.alertsByPatient === 'object') {
      state.alertsByPatient = parsed.alertsByPatient;
    }
    if (Array.isArray(parsed.auditLogs)) {
      state.auditLogs = parsed.auditLogs.slice(0, 500);
    }
  } catch (err) {
    console.warn('Could not load emergency store from disk:', err);
  }
}

function saveStoreToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.warn('Could not persist emergency store to disk:', err);
  }
}

loadStoreFromDisk();

export function checkRateLimit(bucketKey: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = (rateLimitBuckets.get(bucketKey) || []).filter((t) => now - t < windowMs);
  if (existing.length >= maxRequests) {
    rateLimitBuckets.set(bucketKey, existing);
    return false;
  }
  existing.push(now);
  rateLimitBuckets.set(bucketKey, existing);
  return true;
}

export function addAuditLog(patientId: string, action: string, actor: string, detail: string): void {
  const entry: AuditLogEntry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patientId,
    action,
    actor,
    detail,
    timestamp: new Date().toISOString(),
  };
  state.auditLogs = [entry, ...state.auditLogs].slice(0, 500);
  saveStoreToDisk();
}

export function getAuditLogsForPatient(patientId: string): AuditLogEntry[] {
  return state.auditLogs.filter((l) => l.patientId === patientId).slice(0, 100);
}

export function registerSseClient(patientId: string, res: Response): void {
  let set = sseClientsByPatient.get(patientId);
  if (!set) {
    set = new Set();
    sseClientsByPatient.set(patientId, set);
  }
  set.add(res);
}

export function unregisterSseClient(patientId: string, res: Response): void {
  const set = sseClientsByPatient.get(patientId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    sseClientsByPatient.delete(patientId);
  }
}

export function broadcastPatientEvent(
  patientId: string,
  event: string,
  payload: unknown
): void {
  const clients = sseClientsByPatient.get(patientId);
  if (!clients || clients.size === 0) return;
  const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(serialized);
    } catch {
      clients.delete(res);
    }
  }
}

export function getPatientContacts(patientId: string): ServerEmergencyContact[] {
  return state.contactsByPatient[patientId] || [];
}

export function setPatientContacts(
  patientId: string,
  contacts: ServerEmergencyContact[]
): ServerEmergencyContact[] {
  state.contactsByPatient[patientId] = contacts;
  saveStoreToDisk();
  return contacts;
}

export function getPatientEmergencySettings(patientId: string): ServerEmergencySettings {
  if (!state.settingsByPatient[patientId]) {
    state.settingsByPatient[patientId] = createDefaultEmergencySettings(patientId);
    saveStoreToDisk();
  }
  return state.settingsByPatient[patientId];
}

export function updatePatientEmergencySettings(
  patientId: string,
  patch: Partial<ServerEmergencySettings>
): ServerEmergencySettings {
  const current = getPatientEmergencySettings(patientId);
  const next: ServerEmergencySettings = {
    ...current,
    ...patch,
    patientId,
    escalationIntervalSec: Math.max(
      30,
      Math.min(900, Number(patch.escalationIntervalSec ?? current.escalationIntervalSec) || 120)
    ),
    updatedAt: new Date().toISOString(),
  };
  state.settingsByPatient[patientId] = next;
  saveStoreToDisk();

  // Optional async mirror to Supabase if configured with UUID patientId
  const admin = getSupabaseAdmin();
  if (admin && isUuid(patientId)) {
    void admin
      .from('emergency_settings')
      .upsert(
        {
          patient_id: patientId,
          whatsapp_enabled: next.whatsappEnabled,
          sms_enabled: next.smsEnabled,
          notification_priority: next.notificationPriority,
          location_sharing_enabled: next.locationSharingEnabled,
          escalation_enabled: next.escalationEnabled,
          escalation_interval: next.escalationIntervalSec,
          confirmation_mode: next.confirmationMode,
          custom_message_en: next.customMessageEn,
          custom_message_hi: next.customMessageHi,
          sms_dlt_template_id: next.smsDltTemplateId || '',
          sms_dlt_entity_id: next.smsDltEntityId || '',
          test_simulation_mode: next.testSimulationMode,
          updated_at: next.updatedAt,
        },
        { onConflict: 'patient_id' }
      )
      .then(({ error }) => {
        if (error) console.warn('Supabase emergency_settings sync failed:', error.message);
      });
  }

  broadcastPatientEvent(patientId, 'settings:updated', next);
  return next;
}

export function getPatientAlerts(patientId: string): ServerEmergencyAlert[] {
  return state.alertsByPatient[patientId] || [];
}

export function getActiveSosAlertForPatient(patientId: string): ServerEmergencyAlert | null {
  const alerts = getPatientAlerts(patientId);
  return (
    alerts.find((a) => a.alertType === 'sos' && a.currentStatus !== 'resolved') ?? null
  );
}

export function findAlertById(alertId: string): ServerEmergencyAlert | null {
  for (const alerts of Object.values(state.alertsByPatient)) {
    const found = alerts.find((a) => a.id === alertId);
    if (found) return found;
  }
  return null;
}

export function findAlertByIdempotencyKey(
  patientId: string,
  idempotencyKey: string
): ServerEmergencyAlert | null {
  return (
    getPatientAlerts(patientId).find((a) => a.idempotencyKey === idempotencyKey) ?? null
  );
}

export function saveAlert(alert: ServerEmergencyAlert): ServerEmergencyAlert {
  const list = getPatientAlerts(alert.patientId);
  const idx = list.findIndex((a) => a.id === alert.id);
  const nextList =
    idx >= 0
      ? list.map((a) => (a.id === alert.id ? alert : a))
      : [alert, ...list].slice(0, 100);
  state.alertsByPatient[alert.patientId] = nextList;
  saveStoreToDisk();

  // Optional async mirror to Supabase if configured with UUID patientId
  const admin = getSupabaseAdmin();
  if (admin && isUuid(alert.patientId) && isUuid(alert.id)) {
    void admin
      .from('emergency_alerts')
      .upsert(
        {
          id: alert.id,
          patient_id: alert.patientId,
          patient_name: alert.patientName,
          created_at: alert.createdAt,
          alert_type: alert.alertType,
          message_text: alert.messageText,
          latitude: alert.latitude,
          longitude: alert.longitude,
          location_shared: alert.locationShared,
          location_status: alert.locationStatus,
          map_link: alert.mapLink || '',
          current_status: alert.currentStatus,
          acknowledged_by: alert.acknowledgedBy || null,
          acknowledged_at: alert.acknowledgedAt || null,
          resolved_by: alert.resolvedBy || null,
          resolved_at: alert.resolvedAt || null,
          escalation_stage: alert.escalationStage,
          next_escalation_at: alert.nextEscalationAt || null,
          idempotency_key: alert.idempotencyKey,
        },
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) console.warn('Supabase emergency_alerts sync failed:', error.message);
      });
  }

  return alert;
}

export function appendNotificationLog(
  alertId: string,
  log: ServerNotificationLog
): ServerEmergencyAlert | null {
  const alert = findAlertById(alertId);
  if (!alert) return null;
  const exists = alert.notificationLogs.some((l) => l.id === log.id);
  const updated: ServerEmergencyAlert = {
    ...alert,
    notificationLogs: exists
      ? alert.notificationLogs.map((l) => (l.id === log.id ? log : l))
      : [...alert.notificationLogs, log],
  };
  saveAlert(updated);

  const admin = getSupabaseAdmin();
  if (admin && isUuid(alert.patientId) && isUuid(alert.id) && isUuid(log.id)) {
    void admin
      .from('emergency_notification_logs')
      .upsert(
        {
          id: log.id,
          alert_id: alert.id,
          patient_id: alert.patientId,
          recipient_id: log.recipientId,
          recipient_name: log.recipientName,
          recipient_role: log.recipientRole || '',
          channel: log.channel,
          destination: log.destination,
          provider: log.provider,
          provider_message_id: log.providerMessageId || null,
          attempt_number: log.attemptNumber,
          delivery_status: log.deliveryStatus,
          failure_reason: log.failureReason || null,
          is_simulated: log.isSimulated,
          sent_at: log.sentAt,
          delivered_at: log.deliveredAt || null,
        },
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) console.warn('Supabase emergency_notification_logs sync failed:', error.message);
      });
  }

  return updated;
}

export function updateDeliveryStatusByProviderMessageId(
  providerMessageId: string,
  nextDeliveryStatus: ServerNotificationLog['deliveryStatus'],
  failureReason?: string,
  deliveredAt?: string
): ServerEmergencyAlert | null {
  for (const alerts of Object.values(state.alertsByPatient)) {
    for (const alert of alerts) {
      const targetLog = alert.notificationLogs.find(
        (l) => l.providerMessageId && l.providerMessageId === providerMessageId
      );
      if (!targetLog) continue;

      const updatedLog: ServerNotificationLog = {
        ...targetLog,
        deliveryStatus: nextDeliveryStatus,
        failureReason: failureReason ?? targetLog.failureReason,
        deliveredAt:
          deliveredAt ??
          (nextDeliveryStatus === 'delivered' || nextDeliveryStatus === 'read'
            ? new Date().toISOString()
            : targetLog.deliveredAt),
      };

      const updatedLogs = alert.notificationLogs.map((l) =>
        l.id === targetLog.id ? updatedLog : l
      );

      let nextAlertStatus = alert.currentStatus;
      if (
        (nextDeliveryStatus === 'delivered' || nextDeliveryStatus === 'read') &&
        (alert.currentStatus === 'notification_submitted' ||
          alert.currentStatus === 'notification_sending' ||
          alert.currentStatus === 'failed')
      ) {
        nextAlertStatus = 'delivered';
      } else if (
        nextDeliveryStatus === 'failed' &&
        updatedLogs.every((l) => l.deliveryStatus === 'failed' || l.deliveryStatus === 'skipped_unconfigured') &&
        alert.currentStatus === 'notification_submitted'
      ) {
        nextAlertStatus = 'failed';
      }

      const updatedAlert: ServerEmergencyAlert = {
        ...alert,
        currentStatus: nextAlertStatus,
        notificationLogs: updatedLogs,
      };
      saveAlert(updatedAlert);
      appendNotificationLog(updatedAlert.id, updatedLog);
      broadcastPatientEvent(updatedAlert.patientId, 'alert:updated', updatedAlert);
      return updatedAlert;
    }
  }
  return null;
}

export function getAllAlertsPendingEscalation(nowMs = Date.now()): ServerEmergencyAlert[] {
  const due: ServerEmergencyAlert[] = [];
  for (const alerts of Object.values(state.alertsByPatient)) {
    for (const alert of alerts) {
      if (
        alert.alertType === 'sos' &&
        !alert.acknowledgedAt &&
        !alert.resolvedAt &&
        alert.currentStatus !== 'resolved' &&
        alert.currentStatus !== 'caregiver_acknowledged' &&
        alert.currentStatus !== 'assistance_in_progress' &&
        alert.escalationStage === 0 &&
        alert.nextEscalationAt
      ) {
        const dueMs = Date.parse(alert.nextEscalationAt);
        if (!Number.isNaN(dueMs) && nowMs >= dueMs) {
          due.push(alert);
        }
      }
    }
  }
  return due;
}
