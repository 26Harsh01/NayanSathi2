import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Mail,
  MapPin,
  Phone,
  Send,
  Settings,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import type { AppRoute } from '../layout/AppShell';
import { useAppState } from '../../context/AppStateContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { useEmergencySos } from '../../context/EmergencySosContext';
import { EMERGENCY_PHRASES } from '../../features/communication/phrase-library';
import { speakText } from '../../features/communication/text-to-speech';
import { buildMailtoUri, buildTelUri } from '../../features/contacts/contact-utils';
import { GazeButton } from '../gaze/GazeButton';
import { EmergencyStatusScreen } from './EmergencyStatusScreen';

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
  const { activeAlert, sosSettings, isTriggering, triggerSos, triggerError } =
    useEmergencySos();
  const lang = settings.communication.language;

  const [selectedMessage, setSelectedMessage] = useState<string>(
    lang === 'hi'
      ? sosSettings.customMessageHi || EMERGENCY_PHRASES[0].textHi
      : sosSettings.customMessageEn || EMERGENCY_PHRASES[0].textEn
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    () => primaryContact?.id ?? null
  );
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

  const authorizedContactsCount = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.isActive !== false &&
          c.consentStatus === 'granted' &&
          c.verificationStatus === 'verified' &&
          c.preferredChannel !== 'call_only'
      ).length,
    [contacts]
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
    setCallConfirmationStage(false);
    setFeedback(null);
    speakText(text, {
      language: lang,
      rate: settings.communication.speechRate,
    });
    recordCommunication(text, true);
  };

  const handleConfirmSendSos = async () => {
    setFeedback(null);
    const res = await triggerSos({
      alertType: 'sos',
      customMessage: selectedMessage,
    });
    if (!res.ok && res.error && !res.alert) {
      setFeedback(res.error);
    }
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
      aria-label="Emergency SOS Communication Panel"
    >
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border-2 border-red-600 rounded-2xl p-6 sm:p-8 space-y-6 my-auto">
        {activeAlert ? (
          <>
            <EmergencyStatusScreen alert={activeAlert} onClose={onClose} />

            {/* Still allow speaking an urgent phrase aloud while SOS is active */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                {lang === 'hi'
                  ? 'तुरंत बोलने के लिए आपातकालीन वाक्य:'
                  : 'Speak an Urgent Phrase Aloud:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EMERGENCY_PHRASES.slice(0, 4).map((item) => {
                  const label = lang === 'hi' ? item.textHi : item.textEn;
                  return (
                    <GazeButton
                      key={item.id}
                      gazeId={`em_active_speak_${item.id}`}
                      variant="default"
                      sizeOverride="standard"
                      onClick={() => handleSelectEmergencyPhrase(label)}
                      className="justify-start text-left border-red-200 dark:border-red-900/60"
                    >
                      <Volume2 className="w-4 h-4 shrink-0 text-red-700 dark:text-red-400" />
                      <span>{label}</span>
                    </GazeButton>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {lang === 'hi'
                      ? 'आपातकालीन SOS पुष्टि'
                      : 'Confirm Emergency SOS Alert'}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {lang === 'hi'
                      ? 'आकस्मिक अलर्ट रोकने के लिए पुष्टि करें या CANCEL चुनें।'
                      : 'Send automated WhatsApp & SMS SOS to your authorized caregivers, or select CANCEL.'}
                  </p>
                </div>
              </div>
              <GazeButton
                gazeId="em_close_cancel"
                variant="subtle"
                sizeOverride="large"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
                <span>{lang === 'hi' ? 'रद्द करें (CANCEL)' : 'CANCEL'}</span>
              </GazeButton>
            </div>

            {/* Primary Accidental-Activation-Protected SOS Confirmation Box */}
            <div className="rounded-2xl border-2 border-red-600 bg-red-50/90 dark:bg-red-950/50 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-red-950 dark:text-red-100">
                <span>
                  {authorizedContactsCount > 0
                    ? lang === 'hi'
                      ? `${authorizedContactsCount} सत्यापित एवं सहमत संपर्क स्वचालित अलर्ट के लिए तैयार हैं`
                      : `${authorizedContactsCount} active, consented & verified contact(s) ready for automated WhatsApp/SMS dispatch`
                    : lang === 'hi'
                      ? 'कोई सत्यापित/सहमत स्वचालित संपर्क नहीं मिला — देखभालकर्ता पोर्टल में सहमति और सत्यापन सक्रिय करें।'
                      : 'No active, consented & verified contacts configured for automated WhatsApp/SMS. Direct call remains available below.'}
                </span>
                <span className="inline-flex items-center gap-1 text-red-800 dark:text-red-200">
                  <MapPin className="w-3.5 h-3.5" />
                  {sosSettings.locationSharingEnabled
                    ? lang === 'hi'
                      ? 'SOS पर लोकेशन साझा होगी'
                      : 'Location shared once on SOS'
                    : lang === 'hi'
                      ? 'लोकेशन साझाकरण बंद है'
                      : 'Location sharing disabled'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GazeButton
                  gazeId="em_confirm_send_sos"
                  gazeLabel="Confirm and Send Emergency SOS"
                  variant="danger"
                  sizeOverride="xlarge"
                  disabled={isTriggering}
                  onClick={handleConfirmSendSos}
                >
                  <Send className="w-6 h-6" />
                  <span>
                    {isTriggering
                      ? lang === 'hi'
                        ? 'SOS भेजा जा रहा है...'
                        : 'Sending Emergency SOS...'
                      : lang === 'hi'
                        ? 'पुष्टि करें और SOS भेजें'
                        : 'CONFIRM & SEND EMERGENCY SOS'}
                  </span>
                </GazeButton>

                <GazeButton
                  gazeId="em_cancel_sos_big"
                  gazeLabel="Cancel Emergency SOS"
                  variant="subtle"
                  sizeOverride="xlarge"
                  onClick={onClose}
                >
                  <X className="w-6 h-6" />
                  <span>{lang === 'hi' ? 'रद्द करें (CANCEL)' : 'CANCEL — Go Back'}</span>
                </GazeButton>
              </div>
            </div>

            {/* High-contrast emergency phrases (also updates SOS custom note + speaks aloud) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                {lang === 'hi'
                  ? 'आपातकालीन संदेश चुनें (तुरंत बोलने और SOS में शामिल करने के लिए):'
                  : 'Optional: Select an emergency message to speak aloud & attach to SOS:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EMERGENCY_PHRASES.map((item) => {
                  const label = lang === 'hi' ? item.textHi : item.textEn;
                  const isSelected = selectedMessage === label;
                  return (
                    <GazeButton
                      key={item.id}
                      gazeId={`em_btn_${item.id}`}
                      variant={isSelected ? 'selected' : 'default'}
                      sizeOverride="large"
                      onClick={() => handleSelectEmergencyPhrase(label)}
                      className="justify-start text-left border-red-300 dark:border-red-800"
                    >
                      <Volume2 className="w-5 h-5 shrink-0" />
                      <span>{label}</span>
                    </GazeButton>
                  );
                })}
              </div>
            </div>

            {/* Direct Call / Email / Manual Copy Fallback */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'सीधा कॉल / मैनुअल फ़ॉलबैक' : 'Direct Call & Manual Fallback'}
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

              {(!activeContact || authorizedContactsCount === 0) && onNavigate && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-700 dark:text-slate-200">
                    {!activeContact
                      ? lang === 'hi'
                        ? 'देखभालकर्ता पोर्टल में संपर्क जोड़ें।'
                        : 'Configure an emergency contact in the Caregiver Portal.'
                      : lang === 'hi'
                        ? 'स्वचालित WhatsApp/SMS के लिए देखभालकर्ता पोर्टल में संपर्क सहमति व सत्यापन सक्षम करें।'
                        : 'Enable Contact Consent & Verification in the Caregiver Portal for automated WhatsApp/SMS.'}
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
                      className="inline-flex items-center gap-2 min-h-[52px] px-5 py-2.5 rounded-xl bg-red-700 text-white font-bold"
                    >
                      <Check className="w-5 h-5" />
                      <span>Confirm Call ({activeContact.phone})</span>
                    </a>
                    <GazeButton
                      gazeId="em_modal_call_cancel"
                      variant="subtle"
                      sizeOverride="standard"
                      onClick={() => setCallConfirmationStage(false)}
                    >
                      <span>Cancel Call</span>
                    </GazeButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <GazeButton
                    gazeId="em_copy"
                    variant="subtle"
                    sizeOverride="standard"
                    onClick={handleCopyMessage}
                  >
                    <Copy className="w-4 h-4" />
                    <span>{lang === 'hi' ? 'संदेश कॉपी करें' : 'Copy Message'}</span>
                  </GazeButton>

                  {activeContact && (
                    <GazeButton
                      gazeId="em_modal_call_btn"
                      variant="primary"
                      sizeOverride="standard"
                      disabled={!telUri}
                      onClick={() => setCallConfirmationStage(true)}
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call {activeContact.name}</span>
                    </GazeButton>
                  )}

                  {activeContact && mailtoUri && (
                    <a
                      href={mailtoUri}
                      data-gaze-target="em_modal_email_link"
                      className="inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Email</span>
                    </a>
                  )}
                </div>
              )}

              {(feedback || triggerError) && (
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
                  {feedback || triggerError}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
