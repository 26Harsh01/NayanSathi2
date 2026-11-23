import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Mail,
  Phone,
  Settings,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import type { AppRoute } from '../layout/AppShell';
import { useAppState } from '../../context/AppStateContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { EMERGENCY_PHRASES } from '../../features/communication/phrase-library';
import { speakText } from '../../features/communication/text-to-speech';
import { buildMailtoUri, buildTelUri } from '../../features/contacts/contact-utils';
import { GazeButton } from '../gaze/GazeButton';

interface EmergencyModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (route: AppRoute) => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const { settings, profile, recordCommunication } = useAppState();
  const { contacts, primaryContact } = useEmergencyContacts();
  const lang = settings.communication.language;

  const [selectedMessage, setSelectedMessage] = useState<string>(
    lang === 'hi' ? EMERGENCY_PHRASES[0].textHi : EMERGENCY_PHRASES[0].textEn
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    () => primaryContact?.id ?? null
  );
  const [confirmationStage, setConfirmationStage] = useState(false);
  const [callConfirmationStage, setCallConfirmationStage] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialCheckTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (contacts.length === 0) {
      setSelectedContactId(null);
      setCallConfirmationStage(false);
      return;
    }
    if (!selectedContactId || !contacts.some((c) => c.id === selectedContactId)) {
      setSelectedContactId(primaryContact?.id ?? contacts[0].id);
      setCallConfirmationStage(false);
    }
  }, [contacts, primaryContact, selectedContactId]);

  useEffect(() => {
    return () => {
      if (dialCheckTimerRef.current !== null) {
        window.clearTimeout(dialCheckTimerRef.current);
      }
    };
  }, []);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? primaryContact ?? null,
    [contacts, primaryContact, selectedContactId]
  );

  if (!open) return null;

  const telUri = activeContact ? buildTelUri(activeContact.phone) : null;
  const preparedText = [
    `[NayanSathi Urgent Alert]`,
    `From: ${profile.name || 'Patient'}`,
    `Message: ${selectedMessage}`,
    `Time: ${new Date().toLocaleTimeString()}`,
  ].join('\n');

  const mailtoUri = activeContact
    ? buildMailtoUri(activeContact.email, {
        subject: 'Message from NayanSathi',
        body: preparedText,
      })
    : null;

  const handleSelectEmergencyPhrase = (text: string) => {
    setSelectedMessage(text);
    setConfirmationStage(false);
    setCallConfirmationStage(false);
    setFeedback(null);
    speakText(text, {
      language: lang,
      rate: settings.communication.speechRate,
    });
    recordCommunication(text, true);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(preparedText);
      setFeedback(
        lang === 'hi'
          ? 'संदेश क्लिपबोर्ड पर कॉपी किया गया। किसी मैसेजिंग ऐप में पेस्ट करें।'
          : 'Emergency message copied to clipboard. Paste into your preferred messaging app to send.'
      );
    } catch {
      setFeedback('Copy failed — please select and copy the text manually.');
    }
  };

  const handleActivateDialer = () => {
    if (!activeContact || !telUri) return;
    if (dialCheckTimerRef.current !== null) {
      window.clearTimeout(dialCheckTimerRef.current);
    }
    setCallConfirmationStage(false);
    setFeedback(
      lang === 'hi'
        ? `${activeContact.name} (${activeContact.phone}) के लिए डिवाइस डायलर खोलने का अनुरोध किया गया।`
        : `Requested your device calling app for ${activeContact.name} (${activeContact.phone}). A browser cannot verify whether the call connected.`
    );

    dialCheckTimerRef.current = window.setTimeout(() => {
      if (typeof document !== 'undefined' && !document.hidden && document.hasFocus()) {
        setFeedback(
          lang === 'hi'
            ? `इस डिवाइस पर कोई समर्थित कॉलिंग ऐप नहीं खुला। कृपया अपने फ़ोन से सीधे ${activeContact.phone} डायल करें।`
            : `No calling application responded on this device. Desktop browsers need a configured tel: handler. Please dial ${activeContact.phone} directly from your phone.`
        );
      }
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency Communication Panel"
    >
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border-2 border-red-600 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'आपातकालीन संवाद पैनल' : 'Emergency Communication'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {lang === 'hi'
                  ? 'तुरंत बोलने या देखभालकर्ता के लिए संदेश तैयार करने हेतु एक विकल्प चुनें।'
                  : 'Select an urgent message to speak aloud immediately or contact your caregiver.'}
              </p>
            </div>
          </div>
          <GazeButton gazeId="em_close" variant="subtle" sizeOverride="standard" onClick={onClose}>
            <X className="w-5 h-5" />
            <span>{lang === 'hi' ? 'बंद करें' : 'Close'}</span>
          </GazeButton>
        </div>

        {/* High-contrast emergency phrases */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EMERGENCY_PHRASES.map((item) => {
            const label = lang === 'hi' ? item.textHi : item.textEn;
            const isSelected = selectedMessage === label;
            return (
              <GazeButton
                key={item.id}
                gazeId={`em_btn_${item.id}`}
                variant={isSelected ? 'danger' : 'default'}
                sizeOverride="xlarge"
                onClick={() => handleSelectEmergencyPhrase(label)}
                className="justify-start text-left border-red-300 dark:border-red-800"
              >
                <Volume2 className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </GazeButton>
            );
          })}
        </div>

        {/* Saved Emergency Contact Selector & Actions */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">
              {lang === 'hi' ? 'तैयार आपातकालीन संदेश' : 'Prepared Emergency Message'}
            </span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">
              {activeContact
                ? `${activeContact.name}${activeContact.relationship ? ` (${activeContact.relationship})` : ''} · ${activeContact.phone}`
                : lang === 'hi'
                  ? 'कोई आपातकालीन संपर्क कॉन्फ़िगर नहीं किया गया है।'
                  : 'No emergency contact configured.'}
            </span>
          </div>

          {contacts.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {contacts.map((c) => (
                <GazeButton
                  key={c.id}
                  gazeId={`em_modal_contact_${c.id}`}
                  variant={activeContact?.id === c.id ? 'selected' : 'default'}
                  sizeOverride="standard"
                  onClick={() => {
                    setSelectedContactId(c.id);
                    setCallConfirmationStage(false);
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{c.name}</span>
                </GazeButton>
              ))}
            </div>
          )}

          <pre className="whitespace-pre-wrap text-sm font-mono bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            {preparedText}
          </pre>

          {!activeContact && onNavigate && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {lang === 'hi'
                  ? 'कॉल या ईमेल करने के लिए देखभालकर्ता पोर्टल में संपर्क जोड़ें।'
                  : 'Configure an emergency contact in the Caregiver Portal to enable calling and email.'}
              </span>
              <GazeButton
                gazeId="em_modal_goto_caregiver"
                variant="primary"
                sizeOverride="standard"
                onClick={() => {
                  onClose();
                  onNavigate('caregiver');
                }}
              >
                <Settings className="w-4 h-4" />
                <span>{lang === 'hi' ? 'देखभालकर्ता पोर्टल' : 'Open Caregiver Portal'}</span>
              </GazeButton>
            </div>
          )}

          {!confirmationStage ? (
            <div className="flex flex-wrap items-center gap-3">
              <GazeButton
                gazeId="em_prepare_confirm"
                variant="primary"
                sizeOverride="large"
                onClick={() => setConfirmationStage(true)}
              >
                <Check className="w-5 h-5" />
                <span>{lang === 'hi' ? 'कार्रवाई की पुष्टि करें' : 'Confirm Emergency Action'}</span>
              </GazeButton>
              <GazeButton
                gazeId="em_copy"
                variant="subtle"
                sizeOverride="large"
                onClick={handleCopyMessage}
              >
                <Copy className="w-5 h-5" />
                <span>{lang === 'hi' ? 'संदेश कॉपी करें' : 'Copy Message'}</span>
              </GazeButton>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {lang === 'hi'
                  ? 'पुष्टि की गई। ब्राउज़र ऐप सीधे SMS नहीं भेजते—नीचे दिए गए डिवाइस एक्शन चुनें या संदेश कॉपी करें:'
                  : 'Confirmed. Browser apps cannot silently send SMS—choose a supported device action below or copy the alert:'}
              </p>

              {callConfirmationStage && activeContact && telUri ? (
                <div className="p-4 rounded-xl border-2 border-red-600 bg-red-50 dark:bg-red-950/60 space-y-3">
                  <p className="text-sm font-bold text-red-900 dark:text-red-100">
                    Confirm opening dialer for {activeContact.name} ({activeContact.phone})?
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={telUri}
                      data-gaze-target="em_modal_call_confirm"
                      onClick={handleActivateDialer}
                      className="inline-flex items-center gap-2 min-h-[56px] px-5 py-3 rounded-xl bg-red-700 text-white font-bold"
                    >
                      <Check className="w-5 h-5" />
                      <span>Confirm Call ({activeContact.phone})</span>
                    </a>
                    <GazeButton
                      gazeId="em_modal_call_cancel"
                      variant="subtle"
                      sizeOverride="large"
                      onClick={() => setCallConfirmationStage(false)}
                    >
                      <span>Cancel Call</span>
                    </GazeButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <GazeButton
                    gazeId="em_copy_confirmed"
                    variant="primary"
                    sizeOverride="large"
                    onClick={handleCopyMessage}
                  >
                    <Copy className="w-5 h-5" />
                    <span>Copy Emergency Alert</span>
                  </GazeButton>

                  {activeContact && (
                    <GazeButton
                      gazeId="em_modal_call_btn"
                      variant="danger"
                      sizeOverride="large"
                      disabled={!telUri}
                      onClick={() => setCallConfirmationStage(true)}
                    >
                      <Phone className="w-5 h-5" />
                      <span>Call {activeContact.name}</span>
                    </GazeButton>
                  )}

                  {activeContact &&
                    (mailtoUri ? (
                      <a
                        href={mailtoUri}
                        data-gaze-target="em_modal_email_link"
                        className="inline-flex items-center gap-2 min-h-[56px] px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold"
                      >
                        <Mail className="w-5 h-5" />
                        <span>Send Email</span>
                      </a>
                    ) : (
                      <GazeButton
                        gazeId="em_modal_email_disabled"
                        variant="subtle"
                        sizeOverride="large"
                        disabled
                        title="No valid email configured for this contact"
                      >
                        <Mail className="w-5 h-5" />
                        <span>Email Unavailable</span>
                      </GazeButton>
                    ))}

                  <GazeButton
                    gazeId="em_cancel_confirm"
                    variant="subtle"
                    sizeOverride="standard"
                    onClick={() => {
                      setConfirmationStage(false);
                      setCallConfirmationStage(false);
                    }}
                  >
                    <span>Cancel</span>
                  </GazeButton>
                </div>
              )}

              {activeContact && !mailtoUri && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Email is disabled because no valid email address is configured for {activeContact.name}.
                </p>
              )}
            </div>
          )}

          {feedback && (
            <p className="text-sm font-medium text-teal-700 dark:text-teal-400">{feedback}</p>
          )}
        </div>
      </div>
    </div>
  );
};
