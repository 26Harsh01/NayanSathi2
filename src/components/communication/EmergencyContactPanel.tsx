import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
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

interface EmergencyContactPanelProps {
  onNavigate?: (route: AppRoute) => void;
  onOpenEmergencyModal?: () => void;
  currentSentence?: string;
  defaultExpanded?: boolean;
}

export const EmergencyContactPanel: React.FC<EmergencyContactPanelProps> = ({
  onNavigate,
  onOpenEmergencyModal,
  currentSentence,
  defaultExpanded = false,
}) => {
  const { settings, recordCommunication } = useAppState();
  const { contacts, primaryContact, storageError } = useEmergencyContacts();
  const lang = settings.communication.language;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    () => primaryContact?.id ?? null
  );
  const [confirmingCall, setConfirmingCall] = useState(false);
  const [callNotice, setCallNotice] = useState<{
    kind: 'info' | 'warning';
    text: string;
  } | null>(null);
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const dialCheckTimerRef = useRef<number | null>(null);

  // Sync active contact when contacts list changes (edits, deletions, primary switch, cross-tab)
  useEffect(() => {
    if (contacts.length === 0) {
      setSelectedContactId(null);
      setConfirmingCall(false);
      setCallNotice(null);
      return;
    }

    if (!selectedContactId || !contacts.some((c) => c.id === selectedContactId)) {
      setSelectedContactId(primaryContact?.id ?? contacts[0].id);
      setConfirmingCall(false);
      setCallNotice(null);
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

  const telUri = activeContact ? buildTelUri(activeContact.phone) : null;
  const emailBody = currentSentence?.trim()
    ? `Message from NayanSathi:\n${currentSentence.trim()}`
    : undefined;
  const mailtoUri = activeContact
    ? buildMailtoUri(activeContact.email, {
        subject: 'Message from NayanSathi',
        body: emailBody,
      })
    : null;

  const handleShortcutSpeak = (phraseText: string) => {
    const res = speakText(phraseText, {
      language: lang,
      rate: settings.communication.speechRate,
    });
    if (res.started) {
      recordCommunication(phraseText, true);
    }
    setShortcutFeedback(
      lang === 'hi' ? `बोला गया: "${phraseText}"` : `Spoken aloud: "${phraseText}"`
    );
    window.setTimeout(() => setShortcutFeedback(null), 3000);
  };

  const handleActivateDialer = () => {
    if (!activeContact || !telUri) return;

    if (dialCheckTimerRef.current !== null) {
      window.clearTimeout(dialCheckTimerRef.current);
    }

    setConfirmingCall(false);
    setCallNotice({
      kind: 'info',
      text:
        lang === 'hi'
          ? `${activeContact.name} (${activeContact.phone}) के लिए डिवाइस कॉलिंग ऐप खोलने का अनुरोध किया गया। ब्राउज़र कॉल जुड़ने की पुष्टि नहीं कर सकता।`
          : `Requested your device calling app for ${activeContact.name} (${activeContact.phone}). A browser cannot verify whether the call connected.`,
    });

    dialCheckTimerRef.current = window.setTimeout(() => {
      if (typeof document !== 'undefined' && !document.hidden && document.hasFocus()) {
        setCallNotice({
          kind: 'warning',
          text:
            lang === 'hi'
              ? `इस डिवाइस पर कोई कॉलिंग ऐप नहीं खुला। डेस्कटॉप ब्राउज़र में tel: हैंडलर सेट होना आवश्यक है। सीधे ${activeContact.phone} डायल करें।`
              : `No calling application responded on this device. Desktop browsers require a configured tel: handler (Phone Link, FaceTime, or a paired phone). Dial ${activeContact.phone} directly.`,
        });
      }
    }, 900);
  };

  const handleCopyPhone = async () => {
    if (!activeContact?.phone) return;
    try {
      await navigator.clipboard.writeText(activeContact.phone);
      setCallNotice({
        kind: 'info',
        text:
          lang === 'hi'
            ? `फ़ोन नंबर ${activeContact.phone} क्लिपबोर्ड पर कॉपी किया गया।`
            : `Phone number ${activeContact.phone} copied to clipboard.`,
      });
    } catch {
      setCallNotice({
        kind: 'warning',
        text:
          lang === 'hi'
            ? `कृपया नंबर मैन्युअल रूप से डायल करें: ${activeContact.phone}`
            : `Clipboard unavailable. Please dial manually: ${activeContact.phone}`,
      });
    }
  };

  return (
    <section
      aria-label={lang === 'hi' ? 'आपातकालीन संपर्क' : 'Emergency Contact'}
      className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      {/* Compact Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {lang === 'hi' ? 'आपातकालीन संपर्क' : 'Emergency Contact'}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenEmergencyModal && (
            <GazeButton
              gazeId="em_panel_urgent_modal"
              gazeLabel="Emergency Alert"
              variant="danger"
              sizeOverride="standard"
              onClick={onOpenEmergencyModal}
              className="min-h-[40px] px-3 py-1.5 text-xs whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'आपात अलर्ट' : 'Alert'}</span>
            </GazeButton>
          )}
          <GazeButton
            gazeId="em_panel_toggle_expand"
            gazeLabel={expanded ? 'Collapse Emergency Contact' : 'Expand Emergency Contact'}
            variant="subtle"
            sizeOverride="standard"
            onClick={() => setExpanded((prev) => !prev)}
            className="min-h-[40px] px-3 py-1.5 text-xs whitespace-nowrap"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{expanded ? (lang === 'hi' ? 'कम' : 'Less') : lang === 'hi' ? 'विवरण' : 'More'}</span>
          </GazeButton>
        </div>
      </div>

      {storageError && (
        <div
          role="alert"
          className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs font-medium text-amber-900 dark:text-amber-200"
        >
          {storageError}
        </div>
      )}

      {/* Empty State vs Active Saved Contact */}
      {!activeContact ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {lang === 'hi'
              ? 'कोई आपातकालीन संपर्क कॉन्फ़िगर नहीं किया गया है।'
              : 'No emergency contact configured.'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {lang === 'hi'
              ? 'कॉल और ईमेल सक्षम करने के लिए देखभालकर्ता पोर्टल में संपर्क जोड़ें।'
              : 'Add a caregiver contact in the Caregiver Portal to enable Call Now and Send Email.'}
          </p>
          {onNavigate && (
            <GazeButton
              gazeId="em_goto_caregiver"
              gazeLabel="Caregiver Portal"
              variant="primary"
              sizeOverride="standard"
              onClick={() => onNavigate('caregiver')}
              className="w-full"
            >
              <Settings className="w-4 h-4" />
              <span>{lang === 'hi' ? 'देखभालकर्ता पोर्टल खोलें' : 'Configure in Caregiver Portal'}</span>
            </GazeButton>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Contact Summary (Compact always-visible view) */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>
                  {activeContact.isPrimary
                    ? lang === 'hi'
                      ? 'मुख्य देखभालकर्ता'
                      : 'Primary Caregiver'
                    : lang === 'hi'
                      ? 'आपातकालीन संपर्क'
                      : 'Emergency Contact'}
                </span>
                {activeContact.relationship && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{activeContact.relationship}</span>
                  </>
                )}
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                {activeContact.name}
              </p>
              <p className="text-xs font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                <span>{activeContact.phone}</span>
              </p>
            </div>
          </div>

          {/* Primary Shortcut Actions (Call Now always one look away; Email right beside or in expanded) */}
          <div className="grid grid-cols-2 gap-2.5">
            <GazeButton
              gazeId="em_quick_call_now"
              gazeLabel={`Call ${activeContact.name}`}
              variant="primary"
              sizeOverride="standard"
              disabled={!telUri}
              onClick={() => {
                setConfirmingCall(true);
                setCallNotice(null);
              }}
              className="whitespace-nowrap"
            >
              <Phone className="w-4 h-4" />
              <span>{lang === 'hi' ? 'अभी कॉल करें' : 'Call Now'}</span>
            </GazeButton>

            {mailtoUri ? (
              <a
                href={mailtoUri}
                data-gaze-target="em_quick_send_email"
                data-gaze-label={`Email ${activeContact.name}`}
                className="relative rounded-xl font-medium select-none cursor-pointer flex items-center justify-center gap-2 min-h-[48px] px-3 py-2.5 text-sm bg-slate-900 text-white border border-slate-900 dark:bg-slate-800 dark:border-slate-700 whitespace-nowrap"
              >
                <Mail className="w-4 h-4" />
                <span>{lang === 'hi' ? 'ईमेल भेजें' : 'Send Email'}</span>
              </a>
            ) : (
              <GazeButton
                gazeId="em_quick_send_email_disabled"
                gazeLabel="Email Unavailable"
                variant="subtle"
                sizeOverride="standard"
                disabled
                title="No valid email address configured for this contact"
                className="whitespace-nowrap"
              >
                <Mail className="w-4 h-4" />
                <span>{lang === 'hi' ? 'ईमेल नहीं' : 'No Email'}</span>
              </GazeButton>
            )}
          </div>

          {/* Two-step Gaze Call Confirmation */}
          {confirmingCall && telUri && (
            <div
              role="alertdialog"
              aria-label="Confirm Emergency Call"
              className="rounded-xl border-2 border-red-600 bg-red-50 dark:bg-red-950/50 p-3.5 space-y-2.5"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-red-900 dark:text-red-100">
                  {lang === 'hi'
                    ? `${activeContact.name} को कॉल करें?`
                    : `Call ${activeContact.name}?`}
                </p>
                <p className="text-xs font-mono font-semibold text-red-800 dark:text-red-200 tabular-nums">
                  {activeContact.phone}
                  {activeContact.relationship ? ` · ${activeContact.relationship}` : ''}
                </p>
                <p className="text-[11px] text-red-800/90 dark:text-red-200/90">
                  {lang === 'hi'
                    ? 'पुष्टि करने पर आपके डिवाइस का कॉलिंग ऐप खुलेगा।'
                    : 'Confirm to open your device calling handler.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={telUri}
                  data-gaze-target="em_quick_call_confirm"
                  data-gaze-label={`Confirm Call ${activeContact.phone}`}
                  onClick={handleActivateDialer}
                  className="relative rounded-xl font-bold select-none cursor-pointer flex items-center justify-center gap-2 min-h-[52px] px-4 py-2.5 text-sm bg-red-700 text-white border border-red-900"
                >
                  <Check className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'पुष्टि करें' : 'Confirm Call'}</span>
                </a>

                <GazeButton
                  gazeId="em_quick_call_cancel"
                  gazeLabel="Cancel Call"
                  variant="subtle"
                  sizeOverride="standard"
                  onClick={() => setConfirmingCall(false)}
                >
                  <X className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</span>
                </GazeButton>
              </div>
            </div>
          )}

          {/* Post-activation dialer feedback / desktop handler guidance */}
          {callNotice && (
            <div
              role="status"
              className={`rounded-xl p-3 border space-y-2 text-xs ${
                callNotice.kind === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                  : 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-100'
              }`}
            >
              <p className="font-medium leading-relaxed">{callNotice.text}</p>
              <GazeButton
                gazeId="em_quick_copy_phone"
                gazeLabel="Copy Number"
                variant="default"
                sizeOverride="standard"
                onClick={handleCopyPhone}
                className="w-full min-h-[42px]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'नंबर कॉपी करें' : 'Copy Phone Number'}</span>
              </GazeButton>
            </div>
          )}

          {/* Expanded Section: Multi-Contact Selector, Full Details, Portal Link & Emergency Shortcuts */}
          {expanded && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {contacts.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                    {lang === 'hi' ? 'संपर्क चुनें:' : 'Switch Caregiver Contact:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {contacts.map((contact) => {
                      const isSelected = activeContact.id === contact.id;
                      return (
                        <GazeButton
                          key={contact.id}
                          gazeId={`em_select_${contact.id}`}
                          gazeLabel={contact.name}
                          variant={isSelected ? 'selected' : 'default'}
                          sizeOverride="standard"
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setConfirmingCall(false);
                            setCallNotice(null);
                          }}
                          className="min-h-[42px] px-3 py-1.5 text-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{contact.name}</span>
                        </GazeButton>
                      );
                    })}
                  </div>
                </div>
              )}

              <dl className="grid grid-cols-1 gap-1.5 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                  <dd className="font-medium text-slate-900 dark:text-white truncate">
                    {activeContact.email || (lang === 'hi' ? 'सेट नहीं है' : 'Not configured')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Relationship</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {activeContact.relationship || 'Not specified'}
                  </dd>
                </div>
              </dl>

              {!mailtoUri && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'hi'
                    ? 'ईमेल भेजने के लिए देखभालकर्ता पोर्टल में वैध ईमेल जोड़ें।'
                    : 'Send Email is disabled because no valid email is saved for this contact.'}
                </p>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {lang === 'hi' ? 'त्वरित आपात वाक्य' : 'Urgent Spoken Shortcuts'}
                  </span>
                  {shortcutFeedback && (
                    <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                      {shortcutFeedback}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {EMERGENCY_PHRASES.slice(0, 3).map((item) => {
                    const label = lang === 'hi' ? item.textHi : item.textEn;
                    return (
                      <GazeButton
                        key={item.id}
                        gazeId={`em_shortcut_${item.id}`}
                        gazeLabel={label}
                        variant="default"
                        sizeOverride="standard"
                        onClick={() => handleShortcutSpeak(label)}
                        className="justify-start text-left min-h-[44px] py-2 text-xs border-red-200 dark:border-red-900/60"
                      >
                        <Volume2 className="w-3.5 h-3.5 shrink-0 text-red-700 dark:text-red-400" />
                        <span>{label}</span>
                      </GazeButton>
                    );
                  })}
                </div>
              </div>

              {onNavigate && (
                <GazeButton
                  gazeId="em_panel_caregiver_nav"
                  gazeLabel="Manage Contacts"
                  variant="subtle"
                  sizeOverride="standard"
                  onClick={() => onNavigate('caregiver')}
                  className="w-full min-h-[42px] text-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'संपर्क प्रबंधित करें' : 'Edit Contacts in Caregiver Portal'}</span>
                </GazeButton>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
