import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import { dispatchWaveToContacts, partitionAuthorizedRecipients } from './dispatcher';
import { getSmsConfigStatus } from './sms-provider';
import {
  addAuditLog,
  broadcastPatientEvent,
  checkRateLimit,
  findAlertById,
  findAlertByIdempotencyKey,
  getActiveSosAlertForPatient,
  getAuditLogsForPatient,
  getPatientAlerts,
  getPatientContacts,
  getPatientEmergencySettings,
  getSupabaseAdmin,
  isUuid,
  registerSseClient,
  saveAlert,
  setPatientContacts,
  unregisterSseClient,
  updateDeliveryStatusByProviderMessageId,
  updatePatientEmergencySettings,
} from './store';
import {
  DEFAULT_SOS_MESSAGE_EN,
  isValidE164,
  normalizeE164Candidate,
  type ServerEmergencyAlert,
  type ServerEmergencyContact,
  type ServerEmergencySettings,
} from './types';
import { getWhatsAppConfigStatus } from './whatsapp-provider';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{3,80}$/;

function parsePatientId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return SAFE_ID_REGEX.test(trimmed) ? trimmed : null;
}

async function authorizePatientScope(
  req: Request,
  requestedPatientId: string
): Promise<{ authorized: boolean; actorLabel: string; error?: string }> {
  const admin = getSupabaseAdmin();
  const authHeader = req.headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

  if (admin && isUuid(requestedPatientId)) {
    if (!bearer) {
      return {
        authorized: false,
        actorLabel: 'anonymous',
        error: 'Authentication bearer token is required for cloud-backed patient emergency records.',
      };
    }

    const { data, error } = await admin.auth.getUser(bearer);
    if (error || !data?.user) {
      return {
        authorized: false,
        actorLabel: 'invalid_token',
        error: 'Invalid or expired authentication session.',
      };
    }

    const callerId = data.user.id;
    if (callerId === requestedPatientId) {
      return { authorized: true, actorLabel: data.user.email || callerId };
    }

    const { data: rel } = await admin
      .from('caregiver_relationships')
      .select('consent_granted')
      .eq('patient_id', requestedPatientId)
      .eq('caregiver_id', callerId)
      .eq('consent_granted', true)
      .maybeSingle();

    if (!rel?.consent_granted) {
      return {
        authorized: false,
        actorLabel: callerId,
        error: 'Forbidden: caller is not authorized for this patient.',
      };
    }
    return { authorized: true, actorLabel: data.user.email || callerId };
  }

  // Local / preview patient profile mode: enforce explicit header/param match to prevent cross-patient leaks
  const headerPatientId = parsePatientId(req.headers['x-nayansathi-patient-id']);
  if (headerPatientId && headerPatientId !== requestedPatientId) {
    return {
      authorized: false,
      actorLabel: headerPatientId,
      error: 'Forbidden: patient scope mismatch.',
    };
  }

  return { authorized: true, actorLabel: requestedPatientId };
}

function sanitizeIncomingContacts(rawList: unknown): ServerEmergencyContact[] {
  if (!Array.isArray(rawList)) return [];
  const clean: ServerEmergencyContact[] = [];
  for (const item of rawList.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim().slice(0, 80) : '';
    const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 100) : '';
    const phone =
      typeof obj.phone === 'string' ? normalizeE164Candidate(obj.phone) : '';
    if (!id || !name || !phone) continue;

    const whatsappNumber =
      typeof obj.whatsappNumber === 'string' ? normalizeE164Candidate(obj.whatsappNumber) : '';

    const allowedChannels = new Set([
      'whatsapp',
      'sms',
      'whatsapp_then_sms',
      'sms_then_whatsapp',
      'call_only',
    ]);
    const preferredChannel =
      typeof obj.preferredChannel === 'string' && allowedChannels.has(obj.preferredChannel)
        ? (obj.preferredChannel as ServerEmergencyContact['preferredChannel'])
        : 'whatsapp_then_sms';

    const allowedRoles = new Set([
      'primary_caregiver',
      'secondary_caregiver',
      'family_member',
      'emergency_support',
    ]);
    const role =
      typeof obj.role === 'string' && allowedRoles.has(obj.role)
        ? (obj.role as ServerEmergencyContact['role'])
        : obj.isPrimary
          ? 'primary_caregiver'
          : 'family_member';

    const consentStatus =
      obj.consentStatus === 'granted' || obj.consentStatus === 'revoked'
        ? obj.consentStatus
        : 'pending';
    const verificationStatus =
      obj.verificationStatus === 'verified' || obj.verificationStatus === 'pending'
        ? obj.verificationStatus
        : 'unverified';

    clean.push({
      id,
      name,
      relationship: typeof obj.relationship === 'string' ? obj.relationship.trim().slice(0, 60) : '',
      phone,
      whatsappNumber,
      whatsappOptIn: Boolean(obj.whatsappOptIn && whatsappNumber && isValidE164(whatsappNumber)),
      email: typeof obj.email === 'string' ? obj.email.trim().slice(0, 254) : '',
      preferredChannel,
      role,
      isPrimary: Boolean(obj.isPrimary),
      isActive: obj.isActive !== false,
      consentStatus,
      verificationStatus,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    });
  }
  return clean;
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createEmergencyRouter() {
  const router = express.Router();

  // Provider readiness + active alert + settings
  router.get('/status', async (req: Request, res: Response) => {
    const patientId = parsePatientId(req.query.patientId);
    if (!patientId) {
      return res.status(400).json({ error: 'Valid patientId query parameter is required.' });
    }
    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    const wa = getWhatsAppConfigStatus();
    const sms = getSmsConfigStatus();
    const alerts = getPatientAlerts(patientId);
    const activeAlert = getActiveSosAlertForPatient(patientId);
    const settings = getPatientEmergencySettings(patientId);
    const contacts = getPatientContacts(patientId);

    return res.json({
      providers: {
        whatsappConfigured: wa.configured,
        whatsappTemplateName: wa.templateName,
        smsConfigured: sms.configured,
        smsProvider: sms.provider,
        supabaseConfigured: Boolean(getSupabaseAdmin()),
        webhookVerifyConfigured: Boolean(wa.verifyToken),
      },
      activeAlert,
      alerts: alerts.slice(0, 25),
      settings,
      contactsCount: contacts.length,
      auditLogs: getAuditLogsForPatient(patientId).slice(0, 25),
    });
  });

  // Real-time Server-Sent Events stream for Caregiver Portal & Patient Status Screen
  router.get('/stream', async (req: Request, res: Response) => {
    const patientId = parsePatientId(req.query.patientId);
    if (!patientId) {
      return res.status(400).json({ error: 'Valid patientId query parameter is required.' });
    }
    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    registerSseClient(patientId, res);
    res.write(
      `event: init\ndata: ${JSON.stringify({
        activeAlert: getActiveSosAlertForPatient(patientId),
        alerts: getPatientAlerts(patientId).slice(0, 25),
      })}\n\n`
    );

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unregisterSseClient(patientId, res);
    });
  });

  // Sync patient emergency contacts to server store
  router.get('/contacts/:patientId', async (req: Request, res: Response) => {
    const patientId = parsePatientId(req.params.patientId);
    if (!patientId) return res.status(400).json({ error: 'Invalid patientId.' });
    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    return res.json({ contacts: getPatientContacts(patientId) });
  });

  router.put('/contacts/:patientId', async (req: Request, res: Response) => {
    const patientId = parsePatientId(req.params.patientId);
    if (!patientId) return res.status(400).json({ error: 'Invalid patientId.' });
    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    const contacts = sanitizeIncomingContacts((req.body as { contacts?: unknown })?.contacts);
    setPatientContacts(patientId, contacts);
    addAuditLog(
      patientId,
      'emergency_contacts_synced',
      auth.actorLabel,
      `Synchronized ${contacts.length} emergency contact(s).`
    );
    return res.json({ ok: true, contacts });
  });

  // Emergency Settings CRUD
  router.get('/settings/:patientId', async (req: Request, res: Response) => {
    const patientId = parsePatientId(req.params.patientId);
    if (!patientId) return res.status(400).json({ error: 'Invalid patientId.' });
    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    return res.json({ settings: getPatientEmergencySettings(patientId) });
  });

  router.put('/settings/:patientId', async (req: Request, res: Response) => {
    const patientId = parsePatientId(req.params.patientId);
    if (!patientId) return res.status(400).json({ error: 'Invalid patientId.' });
    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    const body = (req.body || {}) as Partial<ServerEmergencySettings>;
    const patch: Partial<ServerEmergencySettings> = {};
    if (typeof body.whatsappEnabled === 'boolean') patch.whatsappEnabled = body.whatsappEnabled;
    if (typeof body.smsEnabled === 'boolean') patch.smsEnabled = body.smsEnabled;
    if (
      body.notificationPriority === 'whatsapp_first' ||
      body.notificationPriority === 'sms_first' ||
      body.notificationPriority === 'parallel'
    ) {
      patch.notificationPriority = body.notificationPriority;
    }
    if (typeof body.locationSharingEnabled === 'boolean') {
      patch.locationSharingEnabled = body.locationSharingEnabled;
    }
    if (typeof body.escalationEnabled === 'boolean') patch.escalationEnabled = body.escalationEnabled;
    if (typeof body.escalationIntervalSec === 'number') {
      patch.escalationIntervalSec = body.escalationIntervalSec;
    }
    if (body.confirmationMode === 'two_step' || body.confirmationMode === 'single_step') {
      patch.confirmationMode = body.confirmationMode;
    }
    if (typeof body.customMessageEn === 'string') {
      patch.customMessageEn = body.customMessageEn.trim().slice(0, 500);
    }
    if (typeof body.customMessageHi === 'string') {
      patch.customMessageHi = body.customMessageHi.trim().slice(0, 500);
    }
    if (typeof body.smsDltTemplateId === 'string') {
      patch.smsDltTemplateId = body.smsDltTemplateId.trim().slice(0, 80);
    }
    if (typeof body.smsDltEntityId === 'string') {
      patch.smsDltEntityId = body.smsDltEntityId.trim().slice(0, 80);
    }
    if (typeof body.testSimulationMode === 'boolean') {
      patch.testSimulationMode = body.testSimulationMode;
    }

    const updated = updatePatientEmergencySettings(patientId, patch);
    addAuditLog(patientId, 'emergency_settings_updated', auth.actorLabel, 'Updated Emergency SOS settings.');
    return res.json({ ok: true, settings: updated });
  });

  // Trigger Emergency SOS (or explicit Test Alert)
  router.post('/trigger', async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const patientId = parsePatientId(body.patientId);
    if (!patientId) {
      return res.status(400).json({ error: 'Valid patientId is required.' });
    }

    const auth = await authorizePatientScope(req, patientId);
    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error });
    }

    const alertType = body.alertType === 'test' ? 'test' : 'sos';
    const rateKey = `trigger:${patientId}:${req.ip || 'unknown'}`;
    if (!checkRateLimit(rateKey, alertType === 'test' ? 10 : 6, 60_000)) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many emergency trigger requests in a short window. Please wait a moment or call directly.',
      });
    }

    // Optionally accept fresh contact list snapshot in same payload if server store wasn't synced yet
    if (Array.isArray(body.contacts)) {
      const synced = sanitizeIncomingContacts(body.contacts);
      setPatientContacts(patientId, synced);
    }

    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 120)
        : `idem_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // 1. Idempotency check
    const existingByIdem = findAlertByIdempotencyKey(patientId, idempotencyKey);
    if (existingByIdem) {
      return res.json({
        ok: true,
        duplicatePrevented: true,
        alert: existingByIdem,
      });
    }

    // 2. Duplicate active SOS alert prevention
    if (alertType === 'sos') {
      const activeSos = getActiveSosAlertForPatient(patientId);
      if (activeSos) {
        return res.json({
          ok: true,
          duplicatePrevented: true,
          alert: activeSos,
          message:
            'An active Emergency SOS alert is already in progress. Resolve it before initiating a new alert.',
        });
      }
    }

    const settings = getPatientEmergencySettings(patientId);
    const contacts = getPatientContacts(patientId);
    const { primaryRecipients, secondaryRecipients, skippedContacts } =
      partitionAuthorizedRecipients(contacts);

    const patientName =
      typeof body.patientName === 'string' && body.patientName.trim()
        ? body.patientName.trim().slice(0, 100)
        : 'Patient';
    const patientPhotoUrl =
      typeof body.patientPhotoUrl === 'string' && body.patientPhotoUrl.startsWith('data:image/')
        ? body.patientPhotoUrl.slice(0, 180_000)
        : undefined;

    const language = body.language === 'hi' ? 'hi' : 'en';
    const customMessageText =
      typeof body.messageText === 'string' && body.messageText.trim()
        ? body.messageText.trim().slice(0, 500)
        : language === 'hi'
          ? settings.customMessageHi || DEFAULT_SOS_MESSAGE_EN
          : settings.customMessageEn || DEFAULT_SOS_MESSAGE_EN;

    const latRaw = typeof body.latitude === 'number' && Number.isFinite(body.latitude) ? body.latitude : null;
    const lngRaw = typeof body.longitude === 'number' && Number.isFinite(body.longitude) ? body.longitude : null;
    const validCoords =
      latRaw !== null &&
      lngRaw !== null &&
      latRaw >= -90 &&
      latRaw <= 90 &&
      lngRaw >= -180 &&
      lngRaw <= 180;

    const locationShared = Boolean(settings.locationSharingEnabled && body.locationShared && validCoords);
    const locationStatus: ServerEmergencyAlert['locationStatus'] = !settings.locationSharingEnabled
      ? 'disabled'
      : locationShared
        ? 'shared'
        : body.locationStatus === 'denied'
          ? 'denied'
          : 'unavailable';

    const mapLink =
      locationShared && latRaw !== null && lngRaw !== null
        ? `https://maps.google.com/?q=${latRaw.toFixed(6)},${lngRaw.toFixed(6)}`
        : '';

    const nowIso = new Date().toISOString();
    const shouldScheduleEscalation =
      alertType === 'sos' && settings.escalationEnabled && secondaryRecipients.length > 0;
    const nextEscalationAt = shouldScheduleEscalation
      ? new Date(Date.now() + settings.escalationIntervalSec * 1000).toISOString()
      : undefined;

    const alert: ServerEmergencyAlert = {
      id: crypto.randomUUID(),
      patientId,
      patientName,
      patientPhotoUrl,
      createdAt: nowIso,
      alertType,
      messageText:
        alertType === 'test'
          ? `[TEST ALERT - NOT A REAL EMERGENCY] ${customMessageText}`
          : customMessageText,
      latitude: locationShared ? latRaw : null,
      longitude: locationShared ? lngRaw : null,
      locationShared,
      locationStatus,
      mapLink,
      currentStatus: 'alert_created',
      escalationStage: 0,
      nextEscalationAt,
      idempotencyKey,
      notificationLogs: [],
    };

    saveAlert(alert);
    addAuditLog(
      patientId,
      alertType === 'test' ? 'emergency_test_triggered' : 'emergency_sos_triggered',
      auth.actorLabel,
      `Alert ${alert.id} created. Eligible primary recipients: ${primaryRecipients.length}, secondary: ${secondaryRecipients.length}, skipped: ${skippedContacts.length}.`
    );
    broadcastPatientEvent(patientId, 'alert:created', alert);

    const simulateExplicitly = alertType === 'test' && Boolean(body.simulateTest || settings.testSimulationMode);

    if (primaryRecipients.length === 0) {
      const failedAlert: ServerEmergencyAlert = {
        ...alert,
        currentStatus: 'failed',
      };
      saveAlert(failedAlert);
      broadcastPatientEvent(patientId, 'alert:updated', failedAlert);
      return res.json({
        ok: true,
        duplicatePrevented: false,
        alert: failedAlert,
        skippedContacts,
        warning:
          contacts.length === 0
            ? 'No emergency contacts registered.'
            : 'No active, consented, and verified contacts are available for automated WhatsApp/SMS notifications.',
      });
    }

    const targetWave =
      alertType === 'test' && typeof body.targetContactId === 'string'
        ? primaryRecipients
            .concat(secondaryRecipients)
            .filter((c) => c.id === body.targetContactId)
        : primaryRecipients;

    const finalAlert = await dispatchWaveToContacts({
      alert,
      contacts: targetWave.length > 0 ? targetWave : primaryRecipients,
      settings,
      simulateExplicitly,
      waveLabel: alertType === 'test' ? 'test_alert' : 'primary',
    });

    return res.json({
      ok: true,
      duplicatePrevented: false,
      alert: finalAlert,
      skippedContacts,
    });
  });

  // Caregiver Acknowledge Alert
  router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
    const alert = findAlertById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'Emergency alert not found.' });

    const auth = await authorizePatientScope(req, alert.patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    const body = (req.body || {}) as { caregiverName?: unknown };
    const caregiverName =
      typeof body.caregiverName === 'string' && body.caregiverName.trim()
        ? body.caregiverName.trim().slice(0, 100)
        : 'Authorized Caregiver';

    if (alert.currentStatus === 'resolved') {
      return res.status(409).json({ error: 'Alert is already resolved.' });
    }

    const updated: ServerEmergencyAlert = {
      ...alert,
      currentStatus: 'caregiver_acknowledged',
      acknowledgedBy: alert.acknowledgedBy || caregiverName,
      acknowledgedAt: alert.acknowledgedAt || new Date().toISOString(),
      nextEscalationAt: undefined,
    };
    saveAlert(updated);
    addAuditLog(alert.patientId, 'emergency_alert_acknowledged', caregiverName, `Acknowledged ${alert.id}`);
    broadcastPatientEvent(alert.patientId, 'alert:updated', updated);

    return res.json({ ok: true, alert: updated });
  });

  // Caregiver Mark Assistance In Progress
  router.post('/alerts/:alertId/in-progress', async (req: Request, res: Response) => {
    const alert = findAlertById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'Emergency alert not found.' });

    const auth = await authorizePatientScope(req, alert.patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    const body = (req.body || {}) as { caregiverName?: unknown };
    const caregiverName =
      typeof body.caregiverName === 'string' && body.caregiverName.trim()
        ? body.caregiverName.trim().slice(0, 100)
        : alert.acknowledgedBy || 'Authorized Caregiver';

    if (alert.currentStatus === 'resolved') {
      return res.status(409).json({ error: 'Alert is already resolved.' });
    }

    const updated: ServerEmergencyAlert = {
      ...alert,
      currentStatus: 'assistance_in_progress',
      acknowledgedBy: alert.acknowledgedBy || caregiverName,
      acknowledgedAt: alert.acknowledgedAt || new Date().toISOString(),
      nextEscalationAt: undefined,
    };
    saveAlert(updated);
    addAuditLog(alert.patientId, 'emergency_assistance_in_progress', caregiverName, `Marked ${alert.id} in progress.`);
    broadcastPatientEvent(alert.patientId, 'alert:updated', updated);

    return res.json({ ok: true, alert: updated });
  });

  // Resolve Alert (preserves history, allows future alerts)
  router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
    const alert = findAlertById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'Emergency alert not found.' });

    const auth = await authorizePatientScope(req, alert.patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    const body = (req.body || {}) as { resolvedBy?: unknown };
    const resolvedBy =
      typeof body.resolvedBy === 'string' && body.resolvedBy.trim()
        ? body.resolvedBy.trim().slice(0, 100)
        : 'Caregiver';

    const updated: ServerEmergencyAlert = {
      ...alert,
      currentStatus: 'resolved',
      resolvedBy,
      resolvedAt: new Date().toISOString(),
      nextEscalationAt: undefined,
    };
    saveAlert(updated);
    addAuditLog(alert.patientId, 'emergency_alert_resolved', resolvedBy, `Resolved ${alert.id}`);
    broadcastPatientEvent(alert.patientId, 'alert:updated', updated);

    return res.json({ ok: true, alert: updated });
  });

  // Manual retry for failed notifications
  router.post('/alerts/:alertId/retry', async (req: Request, res: Response) => {
    const alert = findAlertById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'Emergency alert not found.' });

    const auth = await authorizePatientScope(req, alert.patientId);
    if (!auth.authorized) return res.status(403).json({ error: auth.error });

    if (alert.currentStatus === 'resolved') {
      return res.status(409).json({ error: 'Cannot retry notifications on a resolved alert.' });
    }

    if (!checkRateLimit(`retry:${alert.id}`, 3, 60_000)) {
      return res.status(429).json({ error: 'Retry rate limit reached. Wait a moment before retrying.' });
    }

    const settings = getPatientEmergencySettings(alert.patientId);
    const contacts = getPatientContacts(alert.patientId);
    const { primaryRecipients, secondaryRecipients } = partitionAuthorizedRecipients(contacts);
    const allEligible = [...primaryRecipients, ...(alert.escalationStage > 0 ? secondaryRecipients : [])];

    const updated = await dispatchWaveToContacts({
      alert,
      contacts: allEligible,
      settings,
      simulateExplicitly: alert.alertType === 'test' && settings.testSimulationMode,
      waveLabel: 'manual_retry',
    });

    return res.json({ ok: true, alert: updated });
  });

  // Meta WhatsApp Cloud API Webhook Verification (GET)
  router.get('/webhooks/whatsapp', (req: Request, res: Response) => {
    const cfg = getWhatsAppConfigStatus();
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : '';
    const token = typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : '';
    const challenge = typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : '';

    if (
      mode === 'subscribe' &&
      cfg.verifyToken &&
      token &&
      timingSafeEquals(token, cfg.verifyToken)
    ) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  // Meta WhatsApp Cloud API Delivery Status Webhook (POST)
  router.post('/webhooks/whatsapp', (req: Request, res: Response) => {
    const cfg = getWhatsAppConfigStatus();
    if (cfg.appSecret) {
      const signature = req.headers['x-hub-signature-256'];
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (typeof signature !== 'string' || !rawBody) {
        return res.sendStatus(403);
      }
      const expected = `sha256=${crypto
        .createHmac('sha256', cfg.appSecret)
        .update(rawBody)
        .digest('hex')}`;
      if (!timingSafeEquals(signature, expected)) {
        return res.sendStatus(403);
      }
    }

    const payload = (req.body || {}) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id?: string;
              status?: string;
              timestamp?: string;
              errors?: Array<{ code?: number; title?: string; message?: string }>;
            }>;
          };
        }>;
      }>;
    };

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        for (const st of change.value?.statuses || []) {
          if (!st.id || !st.status) continue;
          const mapped =
            st.status === 'delivered'
              ? 'delivered'
              : st.status === 'read'
                ? 'read'
                : st.status === 'sent'
                  ? 'sent'
                  : st.status === 'failed'
                    ? 'failed'
                    : null;
          if (!mapped) continue;
          const errMsg = st.errors?.[0]
            ? `Meta delivery failed (${st.errors[0].code ?? ''}): ${st.errors[0].title || st.errors[0].message || ''}`
            : undefined;
          const deliveredIso = st.timestamp
            ? new Date(Number(st.timestamp) * 1000).toISOString()
            : undefined;
          updateDeliveryStatusByProviderMessageId(st.id, mapped, errMsg, deliveredIso);
        }
      }
    }

    return res.sendStatus(200);
  });

  // SMS Provider Delivery Callback Webhook (Twilio / Indian DLT)
  router.post('/webhooks/sms', express.urlencoded({ extended: false }), (req: Request, res: Response) => {
    const smsCfg = getSmsConfigStatus();
    // If Twilio Auth Token is configured and X-Twilio-Signature is present, verify it
    const twilioSig = req.headers['x-twilio-signature'];
    if (smsCfg.provider === 'twilio' && smsCfg.authToken && typeof twilioSig === 'string') {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host') || '';
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;
      const bodyObj = (req.body || {}) as Record<string, string>;
      const sortedKeys = Object.keys(bodyObj).sort();
      const dataStr = fullUrl + sortedKeys.map((k) => `${k}${bodyObj[k]}`).join('');
      const expected = crypto
        .createHmac('sha1', smsCfg.authToken)
        .update(dataStr)
        .digest('base64');
      if (!timingSafeEquals(twilioSig, expected)) {
        return res.sendStatus(403);
      }
    }

    const body = (req.body || {}) as Record<string, string>;
    const msgId = body.MessageSid || body.SmsSid || body.request_id || body.message_id;
    const rawStatus = (body.MessageStatus || body.SmsStatus || body.status || '').toLowerCase();
    const errorDetail = body.ErrorMessage || body.ErrorCode || body.reason;

    if (msgId && rawStatus) {
      const mapped =
        rawStatus === 'delivered'
          ? 'delivered'
          : rawStatus === 'sent'
            ? 'sent'
            : rawStatus === 'failed' || rawStatus === 'undelivered'
              ? 'failed'
              : null;
      if (mapped) {
        updateDeliveryStatusByProviderMessageId(
          msgId,
          mapped,
          mapped === 'failed' ? errorDetail || `SMS ${rawStatus}` : undefined
        );
      }
    }

    return res.sendStatus(200);
  });

  return router;
}
