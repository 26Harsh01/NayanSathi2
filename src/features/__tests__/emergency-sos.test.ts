import fs from 'fs';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  buildSmsHandoffUri,
  buildWhatsAppHandoffUrl,
  validateContactInput,
  validateE164PhoneNumber,
} from '../contacts/contact-utils';
import { createOfflineLocalAlert } from '../emergency/emergency-api';
import {
  deriveAggregateAlertStatus,
  dispatchWaveToContacts,
  partitionAuthorizedRecipients,
} from '../../../server/emergency/dispatcher';
import { processDueEscalations } from '../../../server/emergency/escalation-worker';
import {
  findAlertById,
  getActiveSosAlertForPatient,
  getPatientAlerts,
  getPatientContacts,
  saveAlert,
  setPatientContacts,
  updateDeliveryStatusByProviderMessageId,
  updatePatientEmergencySettings,
} from '../../../server/emergency/store';
import {
  createDefaultEmergencySettings,
  type ServerEmergencyAlert,
  type ServerEmergencyContact,
} from '../../../server/emergency/types';

const TEST_PATIENT_A = 'test_sos_patient_a';
const TEST_PATIENT_B = 'test_sos_patient_b';
const STORE_PATH = path.resolve(process.cwd(), '.data', 'emergency-store.json');

afterAll(() => {
  // Clean up test file created during unit test run if it only contains test data
  try {
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as {
        contactsByPatient?: Record<string, unknown>;
        settingsByPatient?: Record<string, unknown>;
        alertsByPatient?: Record<string, unknown>;
        auditLogs?: Array<{ patientId?: string }>;
      };
      for (const pid of [TEST_PATIENT_A, TEST_PATIENT_B]) {
        if (parsed.contactsByPatient) delete parsed.contactsByPatient[pid];
        if (parsed.settingsByPatient) delete parsed.settingsByPatient[pid];
        if (parsed.alertsByPatient) delete parsed.alertsByPatient[pid];
      }
      if (Array.isArray(parsed.auditLogs)) {
        parsed.auditLogs = parsed.auditLogs.filter(
          (l) => l.patientId !== TEST_PATIENT_A && l.patientId !== TEST_PATIENT_B
        );
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
  } catch {
    // ignore cleanup errors
  }
});

function makeContact(overrides: Partial<ServerEmergencyContact> = {}): ServerEmergencyContact {
  const now = new Date().toISOString();
  return {
    id: `c_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Priya Caregiver',
    relationship: 'Daughter',
    phone: '+919876543210',
    whatsappNumber: '+919876543210',
    whatsappOptIn: true,
    email: 'priya@example.com',
    preferredChannel: 'whatsapp_then_sms',
    role: 'primary_caregiver',
    isPrimary: true,
    isActive: true,
    consentStatus: 'granted',
    verificationStatus: 'verified',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Emergency SOS System — Validation, Authorization, Dispatch, Escalation & Offline Fallback', () => {
  it('enforces E.164 international format and refuses to assume WhatsApp opt-in without explicit E.164 WhatsApp number', () => {
    expect(validateE164PhoneNumber('+91 98765 43210')).toEqual({
      valid: true,
      normalized: '+919876543210',
    });
    expect(validateE164PhoneNumber('9876543210').valid).toBe(false);
    expect(validateE164PhoneNumber('+0987654321').valid).toBe(false);

    const invalidWaOptIn = validateContactInput({
      name: 'Rohan',
      relationship: 'Son',
      phone: '+919876543210',
      whatsappNumber: '',
      whatsappOptIn: true,
      email: '',
    });
    expect(invalidWaOptIn.valid).toBe(false);
    expect(invalidWaOptIn.fieldErrors.whatsappNumber).toBeTruthy();

    const smsUri = buildSmsHandoffUri('+91 98765 43210', 'Need help now');
    expect(smsUri).toBe('sms:+919876543210?body=Need%20help%20now');
    const waUrl = buildWhatsAppHandoffUrl('+91 98765 43210', 'Need help now');
    expect(waUrl).toBe('https://wa.me/919876543210?text=Need%20help%20now');
  });

  it('authorizes only active, consented, verified non-call-only contacts and partitions primary vs secondary', () => {
    const primary = makeContact({ id: 'c_primary', isPrimary: true, role: 'primary_caregiver' });
    const secondary = makeContact({
      id: 'c_sec',
      isPrimary: false,
      role: 'secondary_caregiver',
      phone: '+919811122233',
    });
    const unconsented = makeContact({ id: 'c_noconsent', consentStatus: 'pending' });
    const unverified = makeContact({ id: 'c_unver', verificationStatus: 'unverified' });
    const inactive = makeContact({ id: 'c_inactive', isActive: false });
    const callOnly = makeContact({ id: 'c_call', preferredChannel: 'call_only' });

    const res = partitionAuthorizedRecipients([
      primary,
      secondary,
      unconsented,
      unverified,
      inactive,
      callOnly,
    ]);

    expect(res.primaryRecipients.map((c) => c.id)).toEqual(['c_primary']);
    expect(res.secondaryRecipients.map((c) => c.id)).toEqual(['c_sec']);
    expect(res.skippedContacts.map((s) => s.contactId).sort()).toEqual([
      'c_call',
      'c_inactive',
      'c_noconsent',
      'c_unver',
    ]);
  });

  it('never reports delivered merely on submission, separates simulation mode, and handles WhatsApp->SMS fallback honestly', async () => {
    const contact = makeContact({
      id: 'c_no_wa_optin',
      whatsappOptIn: false,
      whatsappNumber: '',
      preferredChannel: 'whatsapp_then_sms',
    });
    const settings = createDefaultEmergencySettings(TEST_PATIENT_A);

    const baseAlert: ServerEmergencyAlert = {
      id: `alert_test_${Date.now()}`,
      patientId: TEST_PATIENT_A,
      patientName: 'Aarav',
      createdAt: new Date().toISOString(),
      alertType: 'test',
      messageText: '[TEST ALERT] Help needed',
      latitude: null,
      longitude: null,
      locationShared: false,
      locationStatus: 'disabled',
      currentStatus: 'alert_created',
      escalationStage: 0,
      idempotencyKey: `idem_sim_${Date.now()}`,
      notificationLogs: [],
    };
    saveAlert(baseAlert);

    // 1. Live mode without WhatsApp/SMS env vars configured must honestly fail rather than faking delivery
    const unconfiguredResult = await dispatchWaveToContacts({
      alert: baseAlert,
      contacts: [contact],
      settings,
      simulateExplicitly: false,
      waveLabel: 'unit_test_unconfigured',
    });
    expect(unconfiguredResult.currentStatus).toBe('failed');
    expect(unconfiguredResult.notificationLogs.some((l) => l.channel === 'whatsapp' && l.deliveryStatus === 'failed')).toBe(true);
    expect(
      unconfiguredResult.notificationLogs.some(
        (l) =>
          l.channel === 'sms' &&
          (l.deliveryStatus === 'failed' || l.deliveryStatus === 'skipped_unconfigured')
      )
    ).toBe(true);

    // 2. Explicit simulation mode marks simulated (never claims 'delivered')
    const waContact = makeContact({ id: 'c_wa_sim' });
    const simAlertBase: ServerEmergencyAlert = {
      ...baseAlert,
      id: `alert_sim_${Date.now()}`,
      idempotencyKey: `idem_sim2_${Date.now()}`,
      notificationLogs: [],
    };
    saveAlert(simAlertBase);
    const simResult = await dispatchWaveToContacts({
      alert: simAlertBase,
      contacts: [waContact],
      settings,
      simulateExplicitly: true,
      waveLabel: 'unit_test_sim',
    });
    expect(simResult.currentStatus).toBe('notification_submitted');
    expect(simResult.notificationLogs[0].deliveryStatus).toBe('simulated');
    expect(simResult.notificationLogs[0].isSimulated).toBe(true);

    // 3. Webhook delivery update promotes 'submitted' -> 'delivered'
    const msgId = simResult.notificationLogs[0].providerMessageId!;
    const promoted = updateDeliveryStatusByProviderMessageId(msgId, 'delivered');
    expect(promoted?.currentStatus).toBe('delivered');
    expect(deriveAggregateAlertStatus(promoted!)).toBe('delivered');
  });

  it('escalates unacknowledged active SOS alerts once to secondary contacts and isolates patients', async () => {
    const primary = makeContact({
      id: 'c_esc_pri',
      isPrimary: true,
      role: 'primary_caregiver',
    });
    const secondary = makeContact({
      id: 'c_esc_sec',
      name: 'Secondary Uncle',
      isPrimary: false,
      role: 'secondary_caregiver',
      phone: '+919822233344',
      whatsappNumber: '+919822233344',
    });
    setPatientContacts(TEST_PATIENT_A, [primary, secondary]);
    setPatientContacts(TEST_PATIENT_B, [
      makeContact({ id: 'c_b_only', name: 'Patient B Contact', phone: '+919800000001' }),
    ]);

    updatePatientEmergencySettings(TEST_PATIENT_A, {
      escalationEnabled: true,
      escalationIntervalSec: 30,
    });

    const pastDueIso = new Date(Date.now() - 5000).toISOString();
    const activeSos: ServerEmergencyAlert = {
      id: `alert_esc_${Date.now()}`,
      patientId: TEST_PATIENT_A,
      patientName: 'Aarav',
      createdAt: new Date(Date.now() - 35_000).toISOString(),
      alertType: 'sos',
      messageText: 'Immediate help needed',
      latitude: 28.6139,
      longitude: 77.209,
      locationShared: true,
      locationStatus: 'shared',
      mapLink: 'https://maps.google.com/?q=28.613900,77.209000',
      currentStatus: 'notification_submitted',
      escalationStage: 0,
      nextEscalationAt: pastDueIso,
      idempotencyKey: `idem_esc_${Date.now()}`,
      notificationLogs: [],
    };
    saveAlert(activeSos);

    // Verify patient B cannot see patient A's active alert or contacts
    expect(getPatientContacts(TEST_PATIENT_B).map((c) => c.id)).toEqual(['c_b_only']);
    expect(getActiveSosAlertForPatient(TEST_PATIENT_B)).toBeNull();
    expect(getPatientAlerts(TEST_PATIENT_A).some((a) => a.id === activeSos.id)).toBe(true);

    await processDueEscalations();

    const afterEscalation = findAlertById(activeSos.id)!;
    expect(afterEscalation.escalationStage).toBe(1);
    expect(afterEscalation.nextEscalationAt).toBeUndefined();
    expect(
      afterEscalation.notificationLogs.some((l) => l.recipientId === 'c_esc_sec')
    ).toBe(true);

    // Calling processDueEscalations again must NOT escalate repeatedly
    const logCountBefore = afterEscalation.notificationLogs.length;
    await processDueEscalations();
    const afterSecondRun = findAlertById(activeSos.id)!;
    expect(afterSecondRun.notificationLogs.length).toBe(logCountBefore);
  });

  it('creates an honest offline local SOS alert when network/API is unreachable', () => {
    const offlineAlert = createOfflineLocalAlert({
      patientId: TEST_PATIENT_B,
      patientName: 'Meera',
      alertType: 'sos',
      language: 'en',
      latitude: null,
      longitude: null,
      locationShared: false,
      locationStatus: 'unavailable',
      idempotencyKey: 'idem_offline_1',
      contacts: [],
    });

    expect(offlineAlert.isOfflineQueued).toBe(true);
    expect(offlineAlert.currentStatus).toBe('failed');
    expect(offlineAlert.locationShared).toBe(false);
    expect(offlineAlert.messageText.toLowerCase()).toContain('could not be confirmed');
  });
});
