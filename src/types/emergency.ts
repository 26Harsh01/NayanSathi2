export type EmergencyContactRole =
  | 'primary_caregiver'
  | 'secondary_caregiver'
  | 'family_member'
  | 'emergency_support';

export type EmergencyNotificationChannel =
  | 'whatsapp'
  | 'sms'
  | 'whatsapp_then_sms'
  | 'sms_then_whatsapp'
  | 'call_only';

export type EmergencyConsentStatus = 'granted' | 'pending' | 'revoked';

export type EmergencyVerificationStatus = 'verified' | 'unverified' | 'pending';

export type EmergencyAlertStatus =
  | 'alert_created'
  | 'notification_sending'
  | 'notification_submitted'
  | 'delivered'
  | 'failed'
  | 'caregiver_acknowledged'
  | 'assistance_in_progress'
  | 'resolved';

export type EmergencyDeliveryStatus =
  | 'queued'
  | 'submitted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped_unconfigured'
  | 'simulated';

export type EmergencyNotificationPriority = 'whatsapp_first' | 'sms_first' | 'parallel';

export type EmergencyConfirmationMode = 'two_step' | 'single_step';

export interface EmergencySettings {
  patientId: string;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  notificationPriority: EmergencyNotificationPriority;
  locationSharingEnabled: boolean;
  escalationEnabled: boolean;
  escalationIntervalSec: number; // 30..900
  confirmationMode: EmergencyConfirmationMode;
  customMessageEn: string;
  customMessageHi: string;
  smsDltTemplateId?: string;
  smsDltEntityId?: string;
  testSimulationMode: boolean;
  updatedAt: string;
}

export interface EmergencyNotificationLog {
  id: string;
  alertId: string;
  recipientId: string;
  recipientName: string;
  recipientRole?: EmergencyContactRole;
  channel: 'whatsapp' | 'sms';
  destination: string;
  provider: 'meta_whatsapp_cloud' | 'twilio_sms' | 'india_dlt_sms' | 'simulation_test';
  providerMessageId?: string;
  attemptNumber: number;
  deliveryStatus: EmergencyDeliveryStatus;
  failureReason?: string;
  isSimulated: boolean;
  sentAt: string;
  deliveredAt?: string;
}

export interface EmergencyAlert {
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
  currentStatus: EmergencyAlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  escalationStage: number;
  nextEscalationAt?: string;
  idempotencyKey: string;
  isOfflineQueued?: boolean;
  notificationLogs: EmergencyNotificationLog[];
}

export interface EmergencyProviderStatus {
  whatsappConfigured: boolean;
  whatsappTemplateName: string;
  smsConfigured: boolean;
  smsProvider: string;
  supabaseConfigured: boolean;
  webhookVerifyConfigured: boolean;
}
