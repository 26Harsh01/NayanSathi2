import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { useEmergencySos } from '../../context/EmergencySosContext';
import {
  buildSmsHandoffUri,
  buildTelUri,
  buildWhatsAppHandoffUrl,
} from '../../features/contacts/contact-utils';
import type { EmergencyAlert, EmergencyAlertStatus, EmergencyDeliveryStatus } from '../../types';
import { GazeButton } from '../gaze/GazeButton';

interface EmergencyStatusScreenProps {
  alert: EmergencyAlert;
  onClose?: () => void;
}

const ALERT_STATUS_META: Record<
  EmergencyAlertStatus,
  { labelEn: string; labelHi: string; toneClass: string }
> = {
  alert_created: {
    labelEn: 'Alert Created',
    labelHi: 'अलर्ट बनाया गया',
    toneClass: 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
  },
  notification_sending: {
    labelEn: 'Notification Sending...',
    labelHi: 'सूचना भेजी जा रही है...',
    toneClass: 'bg-sky-100 text-sky-900 border-sky-400 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700',
  },
  notification_submitted: {
    labelEn: 'Notification Submitted (Awaiting Delivery Receipt)',
    labelHi: 'प्रदाता को भेजा गया (डिलीवरी पुष्टि प्रतीक्षारत)',
    toneClass: 'bg-teal-100 text-teal-900 border-teal-400 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-700',
  },
  delivered: {
    labelEn: 'Delivered to Recipient',
    labelHi: 'प्राप्तकर्ता तक पहुँचाया गया',
    toneClass: 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700',
  },
  failed: {
    labelEn: 'Remote Notification Failed — Call Directly Below',
    labelHi: 'ऑटो-सूचना विफल — नीचे से सीधे कॉल करें',
    toneClass: 'bg-red-100 text-red-900 border-red-400 dark:bg-red-950/70 dark:text-red-200 dark:border-red-700',
  },
  caregiver_acknowledged: {
    labelEn: 'Caregiver Acknowledged',
    labelHi: 'देखभालकर्ता ने पुष्टि की',
    toneClass: 'bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-600',
  },
  assistance_in_progress: {
    labelEn: 'Assistance In Progress',
    labelHi: 'सहायता जारी है',
    toneClass: 'bg-teal-100 text-teal-900 border-teal-500 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-600',
  },
  resolved: {
    labelEn: 'Resolved',
    labelHi: 'समाधान हो गया',
    toneClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  },
};

function deliveryLabel(status: EmergencyDeliveryStatus, lang: 'en' | 'hi'): string {
  switch (status) {
    case 'submitted':
      return lang === 'hi' ? 'प्रदाता को भेजा गया' : 'Submitted (awaiting receipt)';
    case 'sent':
      return lang === 'hi' ? 'प्रदाता द्वारा भेजा गया' : 'Sent by provider';
    case 'delivered':
      return lang === 'hi' ? 'डिलीवर हुआ' : 'Delivered';
    case 'read':
      return lang === 'hi' ? 'पढ़ा गया' : 'Read';
    case 'failed':
      return lang === 'hi' ? 'विफल' : 'Failed';
    case 'simulated':
      return lang === 'hi' ? 'टेस्ट सिमुलेशन (वास्तविक नहीं)' : 'Test Simulation (Not sent)';
    case 'skipped_unconfigured':
      return lang === 'hi' ? 'कॉन्फ़िगर नहीं' : 'Not configured';
    default:
      return lang === 'hi' ? 'कतार में' : 'Queued';
  }
}

export const EmergencyStatusScreen: React.FC<EmergencyStatusScreenProps> = ({
  alert,
  onClose,
}) => {
  const { settings, profile } = useAppState();
  const { contacts, primaryContact } = useEmergencyContacts();
  const {
    isOnline,
    skippedContactsNotice,
    triggerError,
    resolveAlert,
    retryAlert,
  } = useEmergencySos();

  const lang = settings.communication.language;
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    () => primaryContact?.id ?? contacts[0]?.id ?? null
  );
  const [showOtherContacts, setShowOtherContacts] = useState(false);
  const [confirmCall, setConfirmCall] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedContactId || !contacts.some((c) => c.id === selectedContactId)) {
      setSelectedContactId(primaryContact?.id ?? contacts[0]?.id ?? null);
    }
  }, [contacts, primaryContact, selectedContactId]);

  useEffect(() => {
    return () => {
      if (dialTimerRef.current !== null) {
        window.clearTimeout(dialTimerRef.current);
      }
    };
  }, []);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? primaryContact ?? contacts[0] ?? null,
    [contacts, primaryContact, selectedContactId]
  );

  const statusMeta = ALERT_STATUS_META[alert.currentStatus] || ALERT_STATUS_META.alert_created;
  const telUri = activeContact ? buildTelUri(activeContact.phone) : null;
  const handoffText = [
    `NAYANSATHI EMERGENCY SOS`,
    `Patient: ${alert.patientName}`,
    `Time: ${new Date(alert.createdAt).toLocaleString()}`,
    `Message: ${alert.messageText}`,
    alert.mapLink ? `Location: ${alert.mapLink}` : `Location: unavailable`,
  ].join('\n');
  const smsHandoffUri = activeContact ? buildSmsHandoffUri(activeContact.phone, handoffText) : null;
  const waHandoffUrl = activeContact
    ? buildWhatsAppHandoffUrl(activeContact.whatsappNumber || activeContact.phone, handoffText)
    : null;

  const safeMapLink =
    alert.mapLink && alert.mapLink.startsWith('https://maps.google.com/?q=')
      ? alert.mapLink
      : null;

  const hasRemoteFailure =
    alert.isOfflineQueued ||
    alert.currentStatus === 'failed' ||
    (alert.notificationLogs.length > 0 &&
      alert.notificationLogs.every(
        (l) => l.deliveryStatus === 'failed' || l.deliveryStatus === 'skipped_unconfigured'
      ));

  const handleDialClick = () => {
    if (!activeContact) return;
    setConfirmCall(false);
    setFeedback(
      lang === 'hi'
        ? `${activeContact.name} (${activeContact.phone}) को कॉल करने के लिए डिवाइस डायलर खोलने का अनुरोध किया गया।`
        : `Requested your device phone dialer for ${activeContact.name} (${activeContact.phone}). A web browser cannot confirm call connection—check your phone.`
    );
    if (dialTimerRef.current !== null) window.clearTimeout(dialTimerRef.current);
    dialTimerRef.current = window.setTimeout(() => {
      if (typeof document !== 'undefined' && !document.hidden && document.hasFocus()) {
        setFeedback(
          lang === 'hi'
            ? `कोई कॉलिंग ऐप नहीं खुला। कृपया फ़ोन से सीधे ${activeContact.phone} डायल करें।`
            : `No tel: handler responded on this desktop browser. Please dial ${activeContact.phone} directly on a phone.`
        );
      }
    }, 900);
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setFeedback(
        lang === 'hi' ? `नंबर ${phone} कॉपी किया गया।` : `Copied ${phone} to clipboard.`
      );
    } catch {
      setFeedback(`Please dial manually: ${phone}`);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    const ok = await retryAlert(alert.id);
    setRetrying(false);
    setFeedback(
      ok
        ? lang === 'hi'
          ? 'सूचना पुनः भेजने का प्रयास किया गया।'
          : 'Re-attempted automated notification dispatch.'
        : lang === 'hi'
          ? 'पुनः प्रयास विफल रहा — कृपया सीधे कॉल या SMS हैंडऑफ़ का उपयोग करें।'
          : 'Retry failed — please use direct calling or device SMS/WhatsApp handoff below.'
    );
  };

  const handleResolve = async () => {
    setResolving(true);
    const resolvedBy = profile.preferredName || profile.name || 'Patient';
    const ok = await resolveAlert(alert.id, resolvedBy);
    setResolving(false);
    setConfirmResolve(false);
    if (ok && onClose) {
      onClose();
    }
  };

  return (
    <div className="space-y-5" role="region" aria-label="Emergency Alert Status">
      {/* Top Status Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-red-200 dark:border-red-900/60 pb-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-700 text-white text-xs font-bold uppercase tracking-wide">
              <AlertTriangle className="w-3.5 h-3.5" />
              {alert.alertType === 'test' ? 'TEST ALERT' : 'SOS ACTIVE'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${statusMeta.toneClass}`}
            >
              {alert.currentStatus === 'caregiver_acknowledged' ||
              alert.currentStatus === 'delivered' ||
              alert.currentStatus === 'resolved' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>{lang === 'hi' ? statusMeta.labelHi : statusMeta.labelEn}</span>
            </span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {lang === 'hi' ? 'आपातकालीन अलर्ट सक्रिय' : 'Emergency Alert Activated'}
          </h2>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            Alert ID: {alert.id.slice(0, 14)} · {new Date(alert.createdAt).toLocaleString()}
          </p>
        </div>

        {onClose && (
          <GazeButton gazeId="sos_status_minimize" variant="subtle" sizeOverride="standard" onClick={onClose}>
            <X className="w-4 h-4" />
            <span>{lang === 'hi' ? 'छुपाएँ' : 'Minimize'}</span>
          </GazeButton>
        )}
      </div>

      {/* Offline / Failure Honest Warning Banner */}
      {(alert.isOfflineQueued || !isOnline || hasRemoteFailure || triggerError) && (
        <div
          role="alert"
          className="p-4 rounded-xl border-2 border-red-600 bg-red-50 dark:bg-red-950/60 text-red-950 dark:text-red-100 space-y-2"
        >
          <div className="flex items-start gap-2.5">
            {alert.isOfflineQueued || !isOnline ? (
              <WifiOff className="w-5 h-5 text-red-700 dark:text-red-300 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-700 dark:text-red-300 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-sm">
              <p className="font-bold">
                {alert.isOfflineQueued || !isOnline
                  ? lang === 'hi'
                    ? 'ऑफ़लाइन फ़ॉलबैक: दूरस्थ WhatsApp/SMS सूचना की पुष्टि नहीं हो सकी।'
                    : 'Offline / Unreachable: Remote WhatsApp/SMS notification could NOT be confirmed.'
                  : lang === 'hi'
                    ? 'ऑटोमेटेड सूचना पूरी तरह नहीं भेजी जा सकी — कृपया नीचे से सीधे कॉल करें।'
                    : 'Automated notification delivery failed or is incomplete — please call your caregiver directly below.'}
              </p>
              {triggerError && <p className="text-xs">{triggerError}</p>}
              {alert.isOfflineQueued && (
                <p className="text-xs">
                  {lang === 'hi'
                    ? 'इंटरनेट कनेक्शन लौटने पर यदि अलर्ट अनसुलझा है तो सर्वर सिंक पुनः प्रयास किया जाएगा।'
                    : 'This SOS event is saved locally and will sync when internet connectivity returns if still unresolved.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Caregiver Acknowledgment Banner */}
      {alert.acknowledgedBy && (
        <div className="p-3.5 rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">
              {lang === 'hi'
                ? `${alert.acknowledgedBy} ने अलर्ट स्वीकार किया है`
                : `Caregiver Acknowledged: ${alert.acknowledgedBy}`}
            </p>
            {alert.acknowledgedAt && (
              <p className="text-xs font-mono tabular-nums opacity-85">
                {new Date(alert.acknowledgedAt).toLocaleString()}
                {alert.currentStatus === 'assistance_in_progress'
                  ? ' · Assistance In Progress'
                  : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Alert Details & Location Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            {lang === 'hi' ? 'अलर्ट संदेश' : 'Emergency Message'}
          </span>
          <p className="font-semibold text-slate-900 dark:text-white">{alert.messageText}</p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'लोकेशन स्थिति' : 'Location Status'}</span>
          </span>
          {alert.locationShared && safeMapLink ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                {alert.latitude?.toFixed(5)}, {alert.longitude?.toFixed(5)}
              </span>
              <a
                href={safeMapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                <span>Open Map</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Location unavailable ({alert.locationStatus})
            </p>
          )}
        </div>
      </div>

      {/* Prominent Call My Caregiver & Contact Another Caregiver Actions */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              {lang === 'hi' ? 'चयनित आपातकालीन संपर्क' : 'Active Emergency Contact'}
            </span>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {activeContact
                ? `${activeContact.name}${activeContact.relationship ? ` (${activeContact.relationship})` : ''} · ${activeContact.phone}`
                : lang === 'hi'
                  ? 'कोई संपर्क सहेजा नहीं गया'
                  : 'No saved emergency contacts'}
            </p>
          </div>
          {contacts.length > 1 && (
            <GazeButton
              gazeId="sos_status_other_contact_toggle"
              variant="default"
              sizeOverride="standard"
              onClick={() => setShowOtherContacts((p) => !p)}
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {lang === 'hi' ? 'अन्य संपर्क चुनें' : 'Contact Another Emergency Contact'}
              </span>
            </GazeButton>
          )}
        </div>

        {showOtherContacts && contacts.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {contacts.map((c) => (
              <GazeButton
                key={c.id}
                gazeId={`sos_status_pick_${c.id}`}
                variant={activeContact?.id === c.id ? 'selected' : 'default'}
                sizeOverride="standard"
                onClick={() => {
                  setSelectedContactId(c.id);
                  setConfirmCall(false);
                }}
              >
                <span>
                  {c.name} ({c.phone})
                </span>
              </GazeButton>
            ))}
          </div>
        )}

        {activeContact && (
          <>
            {!confirmCall ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <GazeButton
                  gazeId="sos_status_call_caregiver"
                  variant="danger"
                  sizeOverride="large"
                  disabled={!telUri}
                  onClick={() => setConfirmCall(true)}
                >
                  <Phone className="w-5 h-5" />
                  <span>{lang === 'hi' ? 'मेरे देखभालकर्ता को कॉल करें' : 'Call My Caregiver'}</span>
                </GazeButton>

                {smsHandoffUri ? (
                  <a
                    href={smsHandoffUri}
                    data-gaze-target="sos_status_sms_handoff"
                    className="min-h-[56px] px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-slate-800"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{lang === 'hi' ? 'डिवाइस से SMS भेजें' : 'Send via Device SMS'}</span>
                  </a>
                ) : (
                  <GazeButton gazeId="sos_status_sms_disabled" variant="subtle" sizeOverride="large" disabled>
                    <span>SMS Unavailable</span>
                  </GazeButton>
                )}

                {waHandoffUrl ? (
                  <a
                    href={waHandoffUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-gaze-target="sos_status_wa_handoff"
                    className="min-h-[56px] px-4 py-3 rounded-xl bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{lang === 'hi' ? 'WhatsApp ऐप खोलें' : 'Open WhatsApp App'}</span>
                  </a>
                ) : (
                  <GazeButton
                    gazeId="sos_status_copy_phone"
                    variant="default"
                    sizeOverride="large"
                    onClick={() => handleCopyPhone(activeContact.phone)}
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy {activeContact.phone}</span>
                  </GazeButton>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border-2 border-red-600 bg-red-50 dark:bg-red-950/50 space-y-2.5">
                <p className="text-sm font-bold text-red-900 dark:text-red-100">
                  {lang === 'hi'
                    ? `${activeContact.name} (${activeContact.phone}) को कॉल करने के लिए पुष्टि करें:`
                    : `Confirm calling ${activeContact.name} (${activeContact.phone})?`}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {telUri && (
                    <a
                      href={telUri}
                      data-gaze-target="sos_status_call_confirm"
                      onClick={handleDialClick}
                      className="inline-flex items-center gap-2 min-h-[52px] px-5 py-2.5 rounded-xl bg-red-700 text-white font-bold"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm Call ({activeContact.phone})</span>
                    </a>
                  )}
                  <GazeButton
                    gazeId="sos_status_call_cancel"
                    variant="subtle"
                    sizeOverride="standard"
                    onClick={() => setConfirmCall(false)}
                  >
                    <span>Cancel</span>
                  </GazeButton>
                </div>
              </div>
            )}
          </>
        )}

        {feedback && (
          <p className="text-xs font-medium text-teal-800 dark:text-teal-300">{feedback}</p>
        )}
      </div>

      {/* Per-Recipient WhatsApp & SMS Notification Logs */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {lang === 'hi'
            ? `सूचना वितरण स्थिति (${alert.notificationLogs.length})`
            : `Recipient Notification Status (${alert.notificationLogs.length})`}
        </h3>

        {alert.notificationLogs.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            {lang === 'hi'
              ? 'कोई स्वचालित WhatsApp/SMS प्रदाता संदेश सबमिट नहीं किया गया। ऊपर दिए गए कॉल/SMS विकल्पों का उपयोग करें।'
              : 'No automated WhatsApp or SMS messages were submitted. Ensure contacts are active, consented, verified, and use direct calling above.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alert.notificationLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-wrap items-start justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-white">
                    {log.recipientName} ·{' '}
                    <span className="uppercase">{log.channel}</span> ({log.destination})
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Provider: {log.provider}
                    {log.providerMessageId ? ` · ID: ${log.providerMessageId}` : ''}
                  </p>
                  {log.failureReason && (
                    <p className="text-red-700 dark:text-red-400 font-medium">
                      {log.failureReason}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200'
                      : log.deliveryStatus === 'failed'
                        ? 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-200'
                        : log.deliveryStatus === 'simulated'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'
                          : 'bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-200'
                  }`}
                >
                  {deliveryLabel(log.deliveryStatus, lang)}
                </span>
              </div>
            ))}
          </div>
        )}

        {skippedContactsNotice.length > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
            <p className="font-semibold">Skipped contacts (consent/verification/channel checks):</p>
            {skippedContactsNotice.map((s) => (
              <p key={s.contactId}>
                {s.name}: {s.reason}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Footer Lifecycle Controls (Retry / Resolve) */}
      {alert.currentStatus !== 'resolved' && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            {!alert.isOfflineQueued && hasRemoteFailure && (
              <GazeButton
                gazeId="sos_status_retry"
                variant="primary"
                sizeOverride="standard"
                disabled={retrying}
                onClick={handleRetry}
              >
                <RefreshCw className="w-4 h-4" />
                <span>{retrying ? 'Retrying...' : 'Retry Automated Dispatch'}</span>
              </GazeButton>
            )}
          </div>

          {!confirmResolve ? (
            <GazeButton
              gazeId="sos_status_mark_resolved"
              variant="subtle"
              sizeOverride="standard"
              onClick={() => setConfirmResolve(true)}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === 'hi' ? 'अलर्ट समाप्त करें (Resolved)' : 'Mark Emergency Resolved'}</span>
            </GazeButton>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <GazeButton
                gazeId="sos_status_confirm_resolve"
                variant="primary"
                sizeOverride="standard"
                disabled={resolving}
                onClick={handleResolve}
              >
                <Check className="w-4 h-4" />
                <span>{resolving ? 'Resolving...' : 'Confirm Resolve Alert'}</span>
              </GazeButton>
              <GazeButton
                gazeId="sos_status_cancel_resolve"
                variant="subtle"
                sizeOverride="standard"
                onClick={() => setConfirmResolve(false)}
              >
                <span>Cancel</span>
              </GazeButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
