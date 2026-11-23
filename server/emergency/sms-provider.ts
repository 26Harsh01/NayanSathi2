import type { DeliveryStatus } from './types';

export interface SmsSendParams {
  toE164: string;
  patientName: string;
  timestampText: string;
  locationText: string;
  customMessage?: string;
  dltTemplateId?: string;
  dltEntityId?: string;
}

export interface SmsSendResult {
  provider: 'twilio_sms' | 'india_dlt_sms';
  deliveryStatus: DeliveryStatus;
  providerMessageId?: string;
  failureReason?: string;
  httpStatus?: number;
}

export function getSmsConfigStatus() {
  const providerRaw = (process.env.SMS_PROVIDER?.trim() || 'twilio').toLowerCase();
  const provider: 'twilio' | 'india_dlt_gateway' =
    providerRaw === 'india_dlt_gateway' || providerRaw === 'msg91' || providerRaw === 'dlt'
      ? 'india_dlt_gateway'
      : 'twilio';

  const accountSid = process.env.SMS_ACCOUNT_SID?.trim() || '';
  const authToken = process.env.SMS_AUTH_TOKEN?.trim() || '';
  const senderId = process.env.SMS_SENDER_ID?.trim() || '';
  const gatewayUrl = process.env.SMS_GATEWAY_URL?.trim() || '';
  const dltTemplateId = process.env.SMS_DLT_TEMPLATE_ID?.trim() || '';
  const dltEntityId = process.env.SMS_DLT_ENTITY_ID?.trim() || '';

  const configured =
    provider === 'twilio'
      ? Boolean(accountSid && authToken && senderId)
      : Boolean(authToken && senderId && gatewayUrl);

  return {
    provider,
    configured,
    accountSid,
    authToken,
    senderId,
    gatewayUrl,
    dltTemplateId,
    dltEntityId,
  };
}

export function buildEmergencySmsText(params: SmsSendParams): string {
  const baseLine =
    params.customMessage?.trim() ||
    `${params.patientName} has activated an emergency assistance request at ${params.timestampText}. Please contact the patient immediately.`;
  return [
    'NAYANSATHI EMERGENCY ALERT:',
    baseLine,
    `Patient: ${params.patientName}`,
    `Time: ${params.timestampText}`,
    `Location: ${params.locationText}`,
    'This is an automated emergency notification.',
  ].join('\n');
}

function isIndianPhoneNumber(e164: string): boolean {
  return e164.startsWith('+91');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendSmsEmergencyFallback(params: SmsSendParams): Promise<SmsSendResult> {
  const cfg = getSmsConfigStatus();
  const providerLabel = cfg.provider === 'india_dlt_gateway' ? 'india_dlt_sms' : 'twilio_sms';

  if (!cfg.configured) {
    return {
      provider: providerLabel,
      deliveryStatus: 'skipped_unconfigured',
      failureReason:
        cfg.provider === 'twilio'
          ? 'SMS provider is not configured on the server (set SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, and SMS_SENDER_ID).'
          : 'Indian DLT SMS gateway is not configured on the server (set SMS_GATEWAY_URL, SMS_AUTH_TOKEN, SMS_SENDER_ID, and DLT template/entity IDs).',
    };
  }

  if (!/^\+[1-9]\d{6,14}$/.test(params.toE164.trim())) {
    return {
      provider: providerLabel,
      deliveryStatus: 'failed',
      failureReason: 'Invalid E.164 recipient phone number for SMS delivery.',
    };
  }

  const bodyText = buildEmergencySmsText(params);

  // Indian DLT gateway path (e.g. MSG91 / Fast2SMS / DLT-compliant HTTPS gateway)
  if (cfg.provider === 'india_dlt_gateway') {
    const dltTemplateId = params.dltTemplateId?.trim() || cfg.dltTemplateId;
    const dltEntityId = params.dltEntityId?.trim() || cfg.dltEntityId;
    if (isIndianPhoneNumber(params.toE164) && !dltTemplateId) {
      return {
        provider: 'india_dlt_sms',
        deliveryStatus: 'failed',
        failureReason:
          'Indian (+91) DLT SMS route requires an approved DLT Template ID (SMS_DLT_TEMPLATE_ID).',
      };
    }

    try {
      const response = await fetch(cfg.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: cfg.authToken,
          Authorization: `Bearer ${cfg.authToken}`,
        },
        body: JSON.stringify({
          sender: cfg.senderId,
          template_id: dltTemplateId,
          entity_id: dltEntityId,
          mobiles: params.toE164.replace('+', ''),
          to: params.toE164,
          message: bodyText,
          var1: params.patientName,
          var2: params.timestampText,
          var3: params.locationText,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        request_id?: string;
        message_id?: string;
        message?: string;
        type?: string;
      };

      if (response.ok && payload.type !== 'error') {
        return {
          provider: 'india_dlt_sms',
          deliveryStatus: 'submitted',
          providerMessageId: payload.request_id || payload.message_id || `dlt_${Date.now()}`,
          httpStatus: response.status,
        };
      }

      return {
        provider: 'india_dlt_sms',
        deliveryStatus: 'failed',
        failureReason: payload.message || `Indian SMS gateway returned HTTP ${response.status}`,
        httpStatus: response.status,
      };
    } catch (err) {
      return {
        provider: 'india_dlt_sms',
        deliveryStatus: 'failed',
        failureReason:
          err instanceof Error ? `SMS gateway network error: ${err.message}` : 'SMS gateway network error',
      };
    }
  }

  // Twilio REST API path
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`;
  const authHeader = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
  const form = new URLSearchParams({
    To: params.toE164,
    From: cfg.senderId,
    Body: bodyText,
  });

  const statusCallback = process.env.SMS_STATUS_CALLBACK_URL?.trim();
  if (statusCallback) {
    form.set('StatusCallback', statusCallback);
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(8000),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        sid?: string;
        status?: string;
        message?: string;
        code?: number;
      };

      if (response.ok && payload.sid) {
        // Twilio accepted the message (`queued` / `accepted`); do NOT report delivered until webhook confirms!
        return {
          provider: 'twilio_sms',
          deliveryStatus: 'submitted',
          providerMessageId: payload.sid,
          httpStatus: response.status,
        };
      }

      if ((response.status >= 500 || response.status === 429) && attempt < maxAttempts) {
        await sleep(350 * attempt);
        continue;
      }

      return {
        provider: 'twilio_sms',
        deliveryStatus: 'failed',
        failureReason: payload.message
          ? `Twilio error (${payload.code ?? response.status}): ${payload.message}`
          : `Twilio HTTP ${response.status}`,
        httpStatus: response.status,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error reaching SMS provider';
      if (attempt < maxAttempts) {
        await sleep(350 * attempt);
        continue;
      }
      return {
        provider: 'twilio_sms',
        deliveryStatus: 'failed',
        failureReason: `Network interruption sending SMS alert: ${msg}`,
      };
    }
  }

  return {
    provider: 'twilio_sms',
    deliveryStatus: 'failed',
    failureReason: 'Exhausted SMS delivery attempts.',
  };
}
