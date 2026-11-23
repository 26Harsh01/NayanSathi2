export type ContactRole =
  | 'primary_caregiver'
  | 'secondary_caregiver'
  | 'family_member'
  | 'emergency_support';

export type NotificationChannelPref =
  | 'whatsapp'
  | 'sms'
  | 'whatsapp_then_sms'
  | 'sms_then_whatsapp'
  | 'call_only';

export type ConsentStatus = 'granted' | 'pending' | 'revoked';
export type VerificationStatus = 'verified' | 'unverified' | 'pending';

export type AlertStatus =
  | 'alert_created'
  | 'notification_sending'
  | 'notification_submitted'
  | 'delivered'
  | 'failed'
  | 'caregiver_acknowledged'
  | 'assistance_in_progress'
  | 'resolved';

export type DeliveryStatus =
  | 'queued'
  | 'submitted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped_unconfigured'
  | 'simulated';

export interface ServerEmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
  email: string;
  preferredChannel?: NotificationChannelPref;
  role?: ContactRole;
  isPrimary: boolean;
  isActive?: boolean;
  consentStatus?: ConsentStatus;
  verificationStatus?: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServerEmergencySettings {
  patientId: string;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  notificationPriority: 'whatsapp_first' | 'sms_first' | 'parallel';
  locationSharingEnabled: boolean;
  escalationEnabled: boolean;
  escalationIntervalSec: number;
  confirmationMode: 'two_step' | 'single_step';
  customMessageEn: string;
  customMessageHi: string;
  smsDltTemplateId?: string;
  smsDltEntityId?: string;
  testSimulationMode: boolean;
  updatedAt: string;
}

export interface ServerNotificationLog {
  id: string;
  alertId: string;
  recipientId: string;
  recipientName: string;
  recipientRole?: ContactRole;
  channel: 'whatsapp' | 'sms';
  destination: string;
  provider: 'meta_whatsapp_cloud' | 'twilio_sms' | 'india_dlt_sms' | 'simulation_test';
  providerMessageId?: string;
  attemptNumber: number;
  deliveryStatus: DeliveryStatus;
  failureReason?: string;
  isSimulated: boolean;
  sentAt: string;
  deliveredAt?: string;
}

export interface ServerEmergencyAlert {
  id: string;
  patientId: string;
  patientName: string;
  patientPhotoUrl?: string;
  createdAt: string;
  alertType: 'sos' | 'test';
  messageText: string;
  latitude: number | null;
  longitude: number | null;
  locationShared: boolean;
  locationStatus: 'shared' | 'unavailable' | 'denied' | 'disabled';
  mapLink?: string;
  currentStatus: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  escalationStage: number;
  nextEscalationAt?: string;
  idempotencyKey: string;
  notificationLogs: ServerNotificationLog[];
}

export interface AuditLogEntry {
  id: string;
  patientId: string;
  action: string;
  actor: string;
  detail: string;
  timestamp: string;
}

export const DEFAULT_SOS_MESSAGE_EN =
  'An emergency assistance request has been activated. Please contact the patient immediately and provide assistance.';
export const DEFAULT_SOS_MESSAGE_HI =
  'आपातकालीन सहायता अनुरोध सक्रिय किया गया है। कृपया तुरंत रोगी से संपर्क करें और सहायता प्रदान करें।';

export function createDefaultEmergencySettings(patientId: string): ServerEmergencySettings {
  return {
    patientId,
    whatsappEnabled: true,
    smsEnabled: true,
    notificationPriority: 'whatsapp_first',
    locationSharingEnabled: false,
    escalationEnabled: true,
    escalationIntervalSec: 120,
    confirmationMode: 'two_step',
    customMessageEn: DEFAULT_SOS_MESSAGE_EN,
    customMessageHi: DEFAULT_SOS_MESSAGE_HI,
    smsDltTemplateId: '',
    smsDltEntityId: '',
    testSimulationMode: false,
    updatedAt: new Date().toISOString(),
  };
}

export function isValidE164(raw: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(raw.trim());
}

export function normalizeE164Candidate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

export function maskPhoneForDisplay(phone: string): string {
  const clean = phone.trim();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}
