import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  HelpCircle,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { GazeButton } from '../gaze/GazeButton';
import { speakText } from '../../features/communication/text-to-speech';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface ConversationTurn {
  id: string;
  speaker: 'partner' | 'patient';
  text: string;
  timestamp: string;
}

export const TwoWayConversationPanel: React.FC = () => {
  const { settings, recordCommunication } = useAppState();
  const lang = settings.communication.language;

  const [speechLang, setSpeechLang] = useState<'en-US' | 'hi-IN'>(
    lang === 'hi' ? 'hi-IN' : 'en-US'
  );
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [partnerText, setPartnerText] = useState('');
  const [manualPartnerInput, setManualPartnerInput] = useState('');
  const [patientReplyDraft, setPatientReplyDraft] = useState('');
  const [textScale, setTextScale] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [micError, setMicError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup stop errors
      }
    };
  }, []);

  const startListening = () => {
    setMicError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicError(
        'Live speech recognition (Web Speech API) is not supported in this browser. Your conversation partner can type what they said in the manual text box below.'
      );
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = speechLang;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (ev) => {
        let finalSeg = '';
        let interimSeg = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalSeg += `${text} `;
          } else {
            interimSeg += text;
          }
        }
        if (finalSeg.trim()) {
          const clean = finalSeg.trim();
          setPartnerText(clean);
          setTurns((prev) => [
            ...prev,
            {
              id: `turn_${Date.now()}`,
              speaker: 'partner',
              text: clean,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
        setInterimText(interimSeg);
      };

      rec.onerror = (ev) => {
        setIsListening(false);
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setMicError(
            'Microphone permission was denied. Grant microphone access in browser settings or use manual partner input below.'
          );
        } else {
          setMicError(`Microphone recognition error (${ev.error}). You can retry or use manual input.`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      setMicError(err instanceof Error ? err.message : 'Unable to start microphone listening.');
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop error
    }
    setIsListening(false);
    setInterimText('');
  };

  const sendPatientResponse = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    speakText(clean, {
      language: lang,
      rate: settings.communication.speechRate,
      preferredVoiceURI:
        lang === 'hi'
          ? settings.communication.preferredVoiceHi
          : settings.communication.preferredVoiceEn,
    });
    recordCommunication(clean, true);
    setTurns((prev) => [
      ...prev,
      {
        id: `turn_${Date.now()}`,
        speaker: 'patient',
        text: clean,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const displaySizeClass =
    textScale === 'xlarge'
      ? 'text-2xl sm:text-3xl'
      : textScale === 'large'
        ? 'text-xl sm:text-2xl'
        : 'text-base sm:text-lg';

  const quickReplies =
    lang === 'hi'
      ? [
          { id: 'yes', label: 'हाँ (YES)', speak: 'हाँ', icon: <Check className="w-5 h-5" /> },
          { id: 'no', label: 'नहीं (NO)', speak: 'नहीं', icon: <X className="w-5 h-5" /> },
          { id: 'maybe', label: 'शायद (MAYBE)', speak: 'शायद', icon: <HelpCircle className="w-5 h-5" /> },
          { id: 'repeat', label: 'कृपया दोहराएँ', speak: 'कृपया अपनी बात दोहराएँ।', icon: <RotateCcw className="w-4 h-4" /> },
        ]
      : [
          { id: 'yes', label: 'YES', speak: 'Yes.', icon: <Check className="w-5 h-5" /> },
          { id: 'no', label: 'NO', speak: 'No.', icon: <X className="w-5 h-5" /> },
          { id: 'maybe', label: 'MAYBE', speak: 'Maybe.', icon: <HelpCircle className="w-5 h-5" /> },
          { id: 'repeat', label: 'Please Repeat', speak: 'Please repeat that.', icon: <RotateCcw className="w-4 h-4" /> },
        ];

  return (
    <div className="space-y-6">
      {/* Privacy & explicit microphone controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Two-Way Conversation — Partner Speech to Patient Eye Response
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Microphone listens ONLY when explicitly started below. No silent or background audio recording ever occurs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={speechLang}
              onChange={(e) => setSpeechLang(e.target.value as 'en-US' | 'hi-IN')}
              aria-label="Partner spoken language"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            >
              <option value="en-US">Partner: English</option>
              <option value="hi-IN">Partner: हिंदी (Hindi)</option>
            </select>

            <select
              value={textScale}
              onChange={(e) => setTextScale(e.target.value as 'normal' | 'large' | 'xlarge')}
              aria-label="Transcript text size"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            >
              <option value="normal">Standard Text</option>
              <option value="large">Large Text</option>
              <option value="xlarge">Extra-Large Text</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isListening ? (
            <GazeButton
              gazeId="tw_start_listen"
              variant="primary"
              sizeOverride="large"
              disabled={!speechSupported}
              onClick={startListening}
            >
              <Mic className="w-5 h-5" />
              <span>Start Listening to Partner</span>
            </GazeButton>
          ) : (
            <GazeButton
              gazeId="tw_stop_listen"
              variant="danger"
              sizeOverride="large"
              onClick={stopListening}
            >
              <MicOff className="w-5 h-5" />
              <span>Stop Listening</span>
            </GazeButton>
          )}

          {isListening && (
            <span
              role="status"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs font-bold text-red-800 dark:text-red-200"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              Listening to microphone...
            </span>
          )}
        </div>

        {micError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>{micError}</span>
          </div>
        )}

        {/* Partner Transcription Display */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 min-h-[110px]">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            What Your Conversation Partner Said:
          </span>
          <p className={`font-semibold text-slate-900 dark:text-white leading-snug ${displaySizeClass}`}>
            {interimText || partnerText || 'Press "Start Listening to Partner" or type a message below.'}
          </p>
          {partnerText && (
            <button
              type="button"
              onClick={() => {
                setPartnerText('');
                setInterimText('');
              }}
              className="text-xs text-slate-500 hover:underline cursor-pointer"
            >
              Clear displayed prompt
            </button>
          )}
        </div>

        {/* Manual Partner Fallback / Correction */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Partner manual input / correction (works offline & in any browser)..."
            value={manualPartnerInput}
            onChange={(e) => setManualPartnerInput(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const clean = manualPartnerInput.trim();
              if (!clean) return;
              setPartnerText(clean);
              setTurns((prev) => [
                ...prev,
                {
                  id: `turn_${Date.now()}`,
                  speaker: 'partner',
                  text: clean,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
              setManualPartnerInput('');
            }}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Show to Patient</span>
          </button>
        </div>
      </div>

      {/* Patient Gaze-Selectable Responses */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Your Gaze-Selectable Response
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickReplies.map((r) => (
            <GazeButton
              key={r.id}
              gazeId={`tw_reply_${r.id}`}
              variant={r.id === 'yes' ? 'primary' : r.id === 'no' ? 'danger' : 'default'}
              sizeOverride="xlarge"
              onClick={() => sendPatientResponse(r.speak)}
            >
              {r.icon}
              <span>{r.label}</span>
            </GazeButton>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <input
            type="text"
            placeholder="Type or edit a custom response to speak aloud..."
            value={patientReplyDraft}
            onChange={(e) => setPatientReplyDraft(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <GazeButton
            gazeId="tw_speak_custom"
            variant="primary"
            sizeOverride="standard"
            disabled={!patientReplyDraft.trim()}
            onClick={() => {
              sendPatientResponse(patientReplyDraft);
              setPatientReplyDraft('');
            }}
          >
            <Volume2 className="w-4 h-4" />
            <span>Speak Reply</span>
          </GazeButton>
        </div>
      </div>

      {/* Live Turn Thread with Replay */}
      {turns.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Session Conversation Log ({turns.length})
            </h3>
            <button
              type="button"
              onClick={() => setTurns([])}
              className="text-xs text-slate-500 hover:underline cursor-pointer"
            >
              Clear Session
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {turns.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-xl text-sm flex items-center justify-between gap-3 ${
                  t.speaker === 'patient'
                    ? 'bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800'
                    : 'bg-slate-50 dark:bg-slate-800/60'
                }`}
              >
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500 mr-2">
                    {t.speaker === 'patient' ? 'You' : 'Partner'} · {t.timestamp}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{t.text}</span>
                </div>
                {t.speaker === 'patient' && (
                  <button
                    type="button"
                    onClick={() => sendPatientResponse(t.text)}
                    aria-label="Replay reply"
                    className="p-1.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
