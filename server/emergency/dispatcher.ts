import crypto from 'crypto';
import {
  addAuditLog,
  appendNotificationLog,
  broadcastPatientEvent,
  saveAlert,
} from './store';
import {
  isValidE164,
  maskPhoneForDisplay,
  normalizeE164Candidate,
  type ServerEmergencyAlert,
  type ServerEmergencyContact,
  type ServerEmergencySettings,
  type ServerNotificationLog,
} from './types';
import { sendWhatsAppEmergencyTemplate } from './whatsapp-provider';
import { sendSmsEmergencyFallback } from './sms-provider';

export interface EligibleRecipientsResult {
  primaryRecipients: ServerEmergencyContact[];
  secondaryRecipients: ServerEmergencyContact[];
  skippedContacts: Array<{ contactId: string; name: string; reason: string }>;
}

export function partitionAuthorizedRecipients(
  contacts: ServerEmergencyContact[]
): EligibleRecipientsResult {
  const primaryRecipients: ServerEmergencyContact[] = [];
  const secondaryRecipients: ServerEmergencyContact[] = [];
  const skippedContacts: Array<{ contactId: string; name: string; reason: string }> = [];

  for (const c of contacts) {
    const isActive = c.isActive !== false;
    if (!isActive) {
      skippedContacts.push({ contactId: c.id, name: c.name, reason: 'Contact is inactive.' });
      continue;
    }

    const consent = c.consentStatus ?? 'pending';
    if (consent !== 'granted') {
      skippedContacts.push({
        contactId: c.id,
        name: c.name,
        reason: 'Recipient opt-in consent has not been granted.',
      });
      continue;
    }

    const verified = c.verificationStatus ?? 'unverified';
    if (verified !== 'verified') {
      skippedContacts.push({
        contactId: c.id,
        name: c.name,
        reason: 'Contact phone/WhatsApp number is not yet verified.',
      });
      continue;
    }

    if (c.preferredChannel === 'call_only') {
      skippedContacts.push({
        contactId: c.id,
        name: c.name,
        reason: 'Contact channel is set to direct call only.',
      });
      continue;
    }

    if (c.isPrimary || c.role === 'primary_caregiver') {
      primaryRecipients.push(c);
    } else {
      secondaryRecipients.push(c);
    }
  }

  // If no primary contacts are marked primary among authorized ones, promote all authorized contacts to initial wave
  if (primaryRecipients.length === 0 && secondaryRecipients.length > 0) {
    return {
      primaryRecipients: secondaryRecipients,
      secondaryRecipients: [],
      skippedContacts,
    };
  }

  return { primaryRecipients, secondaryRecipients, skippedContacts };
}

function getTargetWhatsAppNumber(contact: ServerEmergencyContact): string | null {
  if (!contact.whatsappOptIn) return null;
  const candidate = normalizeE164Candidate(contact.whatsappNumber || '');
  return isValidE164(candidate) ? candidate : null;
}

function getTargetSmsNumber(contact: ServerEmergencyContact): string | null {
  const candidate = normalizeE164Candidate(contact.phone || '');
  return isValidE164(candidate) ? candidate : null;
}

function computeNextAttemptNumber(alert: ServerEmergencyAlert, recipientId: string, channel: 'whatsapp' | 'sms'): number {
  return (
    alert.notificationLogs.filter(
      (l) => l.recipientId === recipientId && l.channel === channel
    ).length + 1
  );
}

async function dispatchToSingleContact(params: {
  alert: ServerEmergencyAlert;
  contact: ServerEmergencyContact;
  settings: ServerEmergencySettings;
  simulateExplicitly: boolean;
}): Promise<ServerNotificationLog[]> {
  const { alert, contact, settings, simulateExplicitly } = params;
  const logs: ServerNotificationLog[] = [];
  const timestampText = new Date(alert.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const locationText =
    alert.locationShared && alert.mapLink
      ? `${alert.latitude?.toFixed(5)}, ${alert.longitude?.toFixed(5)} (${alert.mapLink})`
      : 'Location unavailable';

  const contactPref = contact.preferredChannel || 'whatsapp_then_sms';
  const tryWhatsApp =
    settings.whatsappEnabled &&
    contactPref !== 'sms' &&
    contactPref !== 'call_only';
  const trySms =
    settings.smsEnabled &&
    contactPref !== 'whatsapp' &&
    contactPref !== 'call_only';

  const runWhatsApp = async (): Promise<boolean> => {
    const waE164 = getTargetWhatsAppNumber(contact);
    const attemptNumber = computeNextAttemptNumber(alert, contact.id, 'whatsapp');

    if (!waE164) {
      const log: ServerNotificationLog = {
        id: crypto.randomUUID(),
        alertId: alert.id,
        recipientId: contact.id,
        recipientName: contact.name,
        recipientRole: contact.role,
        channel: 'whatsapp',
        destination: maskPhoneForDisplay(contact.whatsappNumber || contact.phone),
        provider: simulateExplicitly ? 'simulation_test' : 'meta_whatsapp_cloud',
        attemptNumber,
        deliveryStatus: 'failed',
        failureReason: contact.whatsappOptIn
          ? 'Valid E.164 WhatsApp number (with + country code) is not configured for this contact.'
          : 'WhatsApp number is not confirmed as WhatsApp-enabled/opted-in; refusing to assume WhatsApp availability.',
        isSimulated: simulateExplicitly,
        sentAt: new Date().toISOString(),
      };
      appendNotificationLog(alert.id, log);
      logs.push(log);
      return false;
    }

    if (simulateExplicitly) {
      const log: ServerNotificationLog = {
        id: crypto.randomUUID(),
        alertId: alert.id,
        recipientId: contact.id,
        recipientName: contact.name,
        recipientRole: contact.role,
        channel: 'whatsapp',
        destination: maskPhoneForDisplay(waE164),
        provider: 'simulation_test',
        providerMessageId: `sim_wa_${crypto.randomUUID().slice(0, 8)}`,
        attemptNumber,
        deliveryStatus: 'simulated',
        failureReason: 'Test Simulation Mode: No real WhatsApp message was transmitted.',
        isSimulated: true,
        sentAt: new Date().toISOString(),
      };
      appendNotificationLog(alert.id, log);
      logs.push(log);
      return true;
    }

    const res = await sendWhatsAppEmergencyTemplate({
      toE164: waE164,
      patientName: alert.patientName,
      timestampText,
      locationText,
      alertType: alert.alertType,
      customMessage: alert.messageText,
    });

    const log: ServerNotificationLog = {
      id: crypto.randomUUID(),
      alertId: alert.id,
      recipientId: contact.id,
      recipientName: contact.name,
      recipientRole: contact.role,
      channel: 'whatsapp',
      destination: maskPhoneForDisplay(waE164),
      provider: 'meta_whatsapp_cloud',
      providerMessageId: res.providerMessageId,
      attemptNumber,
      deliveryStatus: res.deliveryStatus,
      failureReason: res.failureReason,
      isSimulated: false,
      sentAt: new Date().toISOString(),
    };
    appendNotificationLog(alert.id, log);
    logs.push(log);
    return res.deliveryStatus === 'submitted' || res.deliveryStatus === 'sent' || res.deliveryStatus === 'delivered';
  };

  const runSms = async (): Promise<boolean> => {
    const smsE164 = getTargetSmsNumber(contact);
    const attemptNumber = computeNextAttemptNumber(alert, contact.id, 'sms');

    if (!smsE164) {
      const log: ServerNotificationLog = {
        id: crypto.randomUUID(),
        alertId: alert.id,
        recipientId: contact.id,
        recipientName: contact.name,
        recipientRole: contact.role,
        channel: 'sms',
        destination: maskPhoneForDisplay(contact.phone),
        provider: simulateExplicitly ? 'simulation_test' : 'twilio_sms',
        attemptNumber,
        deliveryStatus: 'failed',
        failureReason: 'Valid E.164 phone number (+country code) is required for SMS delivery.',
        isSimulated: simulateExplicitly,
        sentAt: new Date().toISOString(),
      };
      appendNotificationLog(alert.id, log);
      logs.push(log);
      return false;
    }

    if (simulateExplicitly) {
      const log: ServerNotificationLog = {
        id: crypto.randomUUID(),
        alertId: alert.id,
        recipientId: contact.id,
        recipientName: contact.name,
        recipientRole: contact.role,
        channel: 'sms',
        destination: maskPhoneForDisplay(smsE164),
        provider: 'simulation_test',
        providerMessageId: `sim_sms_${crypto.randomUUID().slice(0, 8)}`,
        attemptNumber,
        deliveryStatus: 'simulated',
        failureReason: 'Test Simulation Mode: No real SMS was transmitted.',
        isSimulated: true,
        sentAt: new Date().toISOString(),
      };
      appendNotificationLog(alert.id, log);
      logs.push(log);
      return true;
    }

    const res = await sendSmsEmergencyFallback({
      toE164: smsE164,
      patientName: alert.patientName,
      timestampText,
      locationText,
      customMessage: alert.messageText,
      dltTemplateId: settings.smsDltTemplateId,
      dltEntityId: settings.smsDltEntityId,
    });

    const log: ServerNotificationLog = {
      id: crypto.randomUUID(),
      alertId: alert.id,
      recipientId: contact.id,
      recipientName: contact.name,
      recipientRole: contact.role,
      channel: 'sms',
      destination: maskPhoneForDisplay(smsE164),
      provider: res.provider,
      providerMessageId: res.providerMessageId,
      attemptNumber,
      deliveryStatus: res.deliveryStatus,
      failureReason: res.failureReason,
      isSimulated: false,
      sentAt: new Date().toISOString(),
    };
    appendNotificationLog(alert.id, log);
    logs.push(log);
    return res.deliveryStatus === 'submitted' || res.deliveryStatus === 'sent' || res.deliveryStatus === 'delivered';
  };

  if (settings.notificationPriority === 'parallel') {
    if (tryWhatsApp) await runWhatsApp();
    if (trySms) await runSms();
  } else if (
    contactPref === 'sms_then_whatsapp' ||
    (settings.notificationPriority === 'sms_first' && contactPref !== 'whatsapp_then_sms')
  ) {
    const smsOk = trySms ? await runSms() : false;
    if (!smsOk && tryWhatsApp) {
      await runWhatsApp();
    }
  } else {
    // Default: WhatsApp first, fallback to SMS when WhatsApp fails or is unconfigured/unavailable
    const waOk = tryWhatsApp ? await runWhatsApp() : false;
    if (!waOk && trySms) {
      await runSms();
    }
  }

  return logs;
}

export function deriveAggregateAlertStatus(
  alert: ServerEmergencyAlert
): ServerEmergencyAlert['currentStatus'] {
  if (alert.resolvedAt) return 'resolved';
  if (alert.currentStatus === 'assistance_in_progress') return 'assistance_in_progress';
  if (alert.acknowledgedAt) return 'caregiver_acknowledged';

  const logs = alert.notificationLogs;
  if (logs.length === 0) return 'failed';

  const hasConfirmedDelivery = logs.some(
    (l) => l.deliveryStatus === 'delivered' || l.deliveryStatus === 'read'
  );
  if (hasConfirmedDelivery) return 'delivered';

  const hasSubmittedOrSimulated = logs.some(
    (l) =>
      l.deliveryStatus === 'submitted' ||
      l.deliveryStatus === 'sent' ||
      l.deliveryStatus === 'queued' ||
      l.deliveryStatus === 'simulated'
  );
  if (hasSubmittedOrSimulated) return 'notification_submitted';

  return 'failed';
}

export async function dispatchWaveToContacts(params: {
  alert: ServerEmergencyAlert;
  contacts: ServerEmergencyContact[];
  settings: ServerEmergencySettings;
  simulateExplicitly: boolean;
  waveLabel: string;
}): Promise<ServerEmergencyAlert> {
  let latest: ServerEmergencyAlert = {
    ...params.alert,
    currentStatus: 'notification_sending',
  };
  saveAlert(latest);
  broadcastPatientEvent(latest.patientId, 'alert:updated', latest);

  for (const contact of params.contacts) {
    const logs = await dispatchToSingleContact({
      alert: latest,
      contact,
      settings: params.settings,
      simulateExplicitly: params.simulateExplicitly,
    });
    latest = {
      ...latest,
      notificationLogs: [...latest.notificationLogs, ...logs],
    };
  }

  latest = {
    ...latest,
    currentStatus: deriveAggregateAlertStatus(latest),
  };
  saveAlert(latest);
  addAuditLog(
    latest.patientId,
    `emergency_dispatch_${params.waveLabel}`,
    'system',
    `Dispatched to ${params.contacts.length} contact(s); status=${latest.currentStatus}`
  );
  broadcastPatientEvent(latest.patientId, 'alert:updated', latest);
  return latest;
}
