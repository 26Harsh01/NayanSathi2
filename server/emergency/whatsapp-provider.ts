import type { DeliveryStatus } from './types';

export interface WhatsAppSendParams {
  toE164: string;
  patientName: string;
  timestampText: string;
  locationText: string;
  alertType: 'sos' | 'test';
  customMessage?: string;
}

export interface WhatsAppSendResult {
  deliveryStatus: DeliveryStatus;
  providerMessageId?: string;
  failureReason?: string;
  httpStatus?: number;
}

export function getWhatsAppConfigStatus() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || '';
  const templateName =
    process.env.WHATSAPP_EMERGENCY_TEMPLATE_NAME?.trim() || 'nayansathi_emergency_alert';
  const templateLang = process.env.WHATSAPP_EMERGENCY_TEMPLATE_LANG?.trim() || 'en';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '';
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || '';

  return {
    configured: Boolean(accessToken && phoneNumberId),
    accessToken,
    phoneNumberId,
    businessAccountId,
    templateName,
    templateLang,
    verifyToken,
    appSecret,
  };
}

function classifyMetaError(code: number | undefined, message: string, httpStatus: number): string {
  if (httpStatus === 401 || httpStatus === 403 || code === 190) {
    return `WhatsApp credentials expired or unauthorized (Meta code ${code ?? httpStatus}): ${message}`;
  }
  if (httpStatus === 429 || code === 130429 || code === 80007 || code === 131056) {
    return `WhatsApp API rate limit exceeded (Meta code ${code ?? httpStatus}): ${message}`;
  }
  if (code === 131026 || code === 131030) {
    return `Recipient number is not registered on WhatsApp or not in allowed list (Meta code ${code}): ${message}`;
  }
  if (code === 132000 || code === 132001 || code === 132012 || code === 132005) {
    return `WhatsApp emergency template rejected or parameter mismatch (Meta code ${code}): ${message}`;
  }
  if (code === 131047 || code === 131051) {
    return `Recipient opt-in or message type rejected (Meta code ${code}): ${message}`;
  }
  return `WhatsApp Cloud API error (${code ?? httpStatus}): ${message}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWhatsAppEmergencyTemplate(
  params: WhatsAppSendParams
): Promise<WhatsAppSendResult> {
  const cfg = getWhatsAppConfigStatus();
  if (!cfg.configured) {
    return {
      deliveryStatus: 'skipped_unconfigured',
      failureReason:
        'WhatsApp Business Cloud API is not configured on the server (set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID).',
    };
  }

  const cleanRecipient = params.toE164.replace(/[^\d]/g, '');
  if (!/^\d{7,15}$/.test(cleanRecipient)) {
    return {
      deliveryStatus: 'failed',
      failureReason: 'Invalid recipient phone number for WhatsApp Cloud API (E.164 required).',
    };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanRecipient,
    type: 'template',
    template: {
      name: cfg.templateName,
      language: {
        code: cfg.templateLang,
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              parameter_name: 'patient_name',
              text: params.patientName.slice(0, 120) || 'Patient',
            },
            {
              type: 'text',
              parameter_name: 'timestamp',
              text: params.timestampText.slice(0, 80),
            },
            {
              type: 'text',
              parameter_name: 'location_or_not_shared',
              text: params.locationText.slice(0, 200),
            },
          ],
        },
      ],
    },
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string; message_status?: string }>;
        error?: { code?: number; message?: string; error_data?: { details?: string } };
      };

      if (response.ok && Array.isArray(payload.messages) && payload.messages[0]?.id) {
        // Meta accepted the request; actual delivery is confirmed asynchronously via webhook!
        return {
          deliveryStatus: 'submitted',
          providerMessageId: payload.messages[0].id,
          httpStatus: response.status,
        };
      }

      const errCode = payload.error?.code;
      const errDetail = payload.error?.error_data?.details || payload.error?.message || `HTTP ${response.status}`;
      const reason = classifyMetaError(errCode, errDetail, response.status);

      // Retry only on transient 5xx or temporary rate limit
      if ((response.status >= 500 || response.status === 429) && attempt < maxAttempts) {
        await sleep(350 * attempt);
        continue;
      }

      return {
        deliveryStatus: 'failed',
        failureReason: reason,
        httpStatus: response.status,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error reaching WhatsApp Cloud API';
      if (attempt < maxAttempts) {
        await sleep(350 * attempt);
        continue;
      }
      return {
        deliveryStatus: 'failed',
        failureReason: `Network interruption sending WhatsApp alert: ${msg}`,
      };
    }
  }

  return {
    deliveryStatus: 'failed',
    failureReason: 'Exhausted WhatsApp delivery attempts.',
  };
}
