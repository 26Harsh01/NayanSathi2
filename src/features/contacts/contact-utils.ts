import type {
  EmergencyConsentStatus,
  EmergencyContactRole,
  EmergencyNotificationChannel,
  EmergencyVerificationStatus,
} from '../../types';

export interface ContactInput {
  name: string;
  relationship: string;
  phone: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
  email: string;
  preferredChannel?: EmergencyNotificationChannel;
  role?: EmergencyContactRole;
  isPrimary?: boolean;
  isActive?: boolean;
  consentStatus?: EmergencyConsentStatus;
  verificationStatus?: EmergencyVerificationStatus;
}

export interface ValidationResult<T = string> {
  valid: boolean;
  normalized: T;
  error?: string;
}

export interface ContactValidationResult {
  valid: boolean;
  normalized: {
    name: string;
    relationship: string;
    phone: string;
    whatsappNumber: string;
    whatsappOptIn: boolean;
    email: string;
    preferredChannel: EmergencyNotificationChannel;
    role: EmergencyContactRole;
    isPrimary: boolean;
    isActive: boolean;
    consentStatus: EmergencyConsentStatus;
    verificationStatus: EmergencyVerificationStatus;
  };
  fieldErrors: Partial<
    Record<'name' | 'relationship' | 'phone' | 'whatsappNumber' | 'email', string>
  >;
  error?: string;
}

const SAFE_EMAIL_REGEX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

/**
 * Normalizes a telephone number by removing formatting characters (spaces, hyphens,
 * parentheses, dots) while preserving a leading '+' international country code.
 */
export function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) return hasPlus ? '+' : '';
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Validates user-entered phone input.
 * Allows standard formatting characters (' ', '-', '(', ')', '.') and a leading '+'.
 * Rejects alphabetical characters and numbers outside 7..15 digits.
 */
export function validatePhoneNumber(raw: string): ValidationResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      error: 'Phone number is required.',
    };
  }

  // Disallow unexpected characters like letters or extra '+' signs in the middle
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      error: 'Phone number may only contain digits, spaces, hyphens, parentheses, and a leading +.',
    };
  }

  const normalized = normalizePhoneNumber(trimmed);
  const digits = normalized.startsWith('+') ? normalized.slice(1) : normalized;

  if (normalized.startsWith('+') && digits.startsWith('0')) {
    return {
      valid: false,
      normalized: '',
      error: 'International phone numbers starting with + must use a valid country code (cannot start with +0).',
    };
  }

  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      error: 'Enter a valid phone number with 7 to 15 digits (including country code if international).',
    };
  }

  return {
    valid: true,
    normalized,
  };
}

/**
 * Strict E.164 international phone validation (+<country_code><subscriber_number>, 8..15 digits total).
 * Required for automated WhatsApp Cloud API and SMS dispatch.
 */
export function validateE164PhoneNumber(raw: string): ValidationResult<string> {
  const base = validatePhoneNumber(raw);
  if (!base.valid) return base;
  if (!/^\+[1-9]\d{6,14}$/.test(base.normalized)) {
    return {
      valid: false,
      normalized: '',
      error: 'Include the international country code starting with + (E.164 format, e.g. +919876543210).',
    };
  }
  return base;
}

/**
 * Validates an email address. When required=false, empty strings are accepted as unconfigured.
 */
export function validateEmailAddress(raw: string, required = false): ValidationResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: !required,
      normalized: '',
      error: required ? 'Email address is required.' : undefined,
    };
  }

  if (trimmed.length > 254 || /[\r\n]/.test(trimmed) || !SAFE_EMAIL_REGEX.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      error: 'Enter a valid email address (for example, caregiver@example.com).',
    };
  }

  return {
    valid: true,
    normalized: trimmed,
  };
}

export function validateContactInput(input: ContactInput): ContactValidationResult {
  const name = input.name.trim();
  const relationship = input.relationship.trim();
  const fieldErrors: ContactValidationResult['fieldErrors'] = {};

  if (!name) {
    fieldErrors.name = 'Caregiver name is required.';
  } else if (name.length > 100) {
    fieldErrors.name = 'Caregiver name must be 100 characters or fewer.';
  }

  if (relationship.length > 60) {
    fieldErrors.relationship = 'Relationship must be 60 characters or fewer.';
  }

  const phoneCheck = validatePhoneNumber(input.phone);
  if (!phoneCheck.valid) {
    fieldErrors.phone = phoneCheck.error || 'Enter a valid phone number.';
  }

  const rawWa = (input.whatsappNumber ?? '').trim();
  let normalizedWa = '';
  if (rawWa || input.whatsappOptIn) {
    if (!rawWa && input.whatsappOptIn) {
      fieldErrors.whatsappNumber =
        'Enter an E.164 WhatsApp number (e.g. +919876543210) or uncheck WhatsApp-enabled.';
    } else if (rawWa) {
      const waCheck = validateE164PhoneNumber(rawWa);
      if (!waCheck.valid) {
        fieldErrors.whatsappNumber = waCheck.error || 'Enter a valid E.164 WhatsApp number.';
      } else {
        normalizedWa = waCheck.normalized;
      }
    }
  }

  const emailCheck = validateEmailAddress(input.email, false);
  if (!emailCheck.valid) {
    fieldErrors.email = emailCheck.error || 'Enter a valid email address.';
  }

  const isPrimary = Boolean(input.isPrimary);
  const role: EmergencyContactRole =
    input.role ?? (isPrimary ? 'primary_caregiver' : 'family_member');
  const preferredChannel: EmergencyNotificationChannel =
    input.preferredChannel ?? 'whatsapp_then_sms';

  const errorList = Object.values(fieldErrors).filter(Boolean);
  return {
    valid: errorList.length === 0,
    normalized: {
      name,
      relationship,
      phone: phoneCheck.normalized,
      whatsappNumber: normalizedWa,
      whatsappOptIn: Boolean(input.whatsappOptIn && normalizedWa),
      email: emailCheck.normalized,
      preferredChannel,
      role,
      isPrimary,
      isActive: input.isActive !== false,
      consentStatus: input.consentStatus ?? 'pending',
      verificationStatus: input.verificationStatus ?? 'unverified',
    },
    fieldErrors,
    error: errorList[0],
  };
}

/**
 * Builds a sanitized `tel:` URI from a saved or raw phone number.
 * Returns null if the number is missing or invalid.
 */
export function buildTelUri(phone: string): string | null {
  const check = validatePhoneNumber(phone);
  if (!check.valid || !check.normalized) return null;
  return `tel:${check.normalized}`;
}

/**
 * Builds a sanitized `sms:` URI for device handoff when internet/API is unavailable.
 */
export function buildSmsHandoffUri(phone: string, body: string): string | null {
  const check = validatePhoneNumber(phone);
  if (!check.valid || !check.normalized) return null;
  const cleanBody = body.replace(/\r\n/g, '\n').trim().slice(0, 480);
  return `sms:${check.normalized}?body=${encodeURIComponent(cleanBody)}`;
}

/**
 * Builds a sanitized `https://wa.me/...` handoff link for manual device fallback.
 */
export function buildWhatsAppHandoffUrl(phone: string, body: string): string | null {
  const check = validateE164PhoneNumber(phone);
  if (!check.valid || !check.normalized) return null;
  const digits = check.normalized.slice(1);
  const cleanBody = body.replace(/\r\n/g, '\n').trim().slice(0, 480);
  return `https://wa.me/${digits}?text=${encodeURIComponent(cleanBody)}`;
}

/**
 * Builds a sanitized `mailto:` URI from a saved email address.
 * Returns null if no valid email is configured.
 */
export function buildMailtoUri(
  email: string,
  options?: { subject?: string; body?: string }
): string | null {
  const check = validateEmailAddress(email, true);
  if (!check.valid || !check.normalized) return null;

  const cleanSubject = (options?.subject ?? 'Message from NayanSathi')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const cleanBody = (options?.body ?? '').replace(/\r\n/g, '\n').trim();

  const params = new URLSearchParams();
  if (cleanSubject) {
    params.set('subject', cleanSubject);
  }
  if (cleanBody) {
    params.set('body', cleanBody);
  }

  const query = params.toString();
  return query ? `mailto:${check.normalized}?${query}` : `mailto:${check.normalized}`;
}
