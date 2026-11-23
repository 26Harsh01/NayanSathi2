import type { Language } from '../../types';

export interface VoiceSummary {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

export type SpeechStatus = 'idle' | 'speaking' | 'paused' | 'unsupported';

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getAvailableVoices(language?: Language): VoiceSummary[] {
  if (!isSpeechSynthesisSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  const mapped = voices.map((v) => ({
    name: v.name,
    lang: v.lang,
    voiceURI: v.voiceURI,
    localService: v.localService,
  }));

  if (!language) return mapped;
  const prefix = language === 'hi' ? 'hi' : 'en';
  return mapped.filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

export function pickBestVoice(
  language: Language,
  preferredVoiceURI?: string
): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  if (preferredVoiceURI) {
    const exact = voices.find((v) => v.voiceURI === preferredVoiceURI);
    if (exact) return exact;
  }

  const targetLang = language === 'hi' ? 'hi' : 'en';
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(targetLang));
  if (matching.length === 0) return null;

  if (language === 'en') {
    const enIn = matching.find((v) => v.lang.toLowerCase() === 'en-in');
    if (enIn) return enIn;
    const enUs = matching.find((v) => v.lang.toLowerCase() === 'en-us');
    if (enUs) return enUs;
  }

  return matching[0];
}

export function speakText(
  text: string,
  options: {
    language: Language;
    rate?: number;
    preferredVoiceURI?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (reason: string) => void;
  }
): { started: boolean; voiceMissingForLanguage: boolean; reason?: string } {
  const clean = text.trim();
  if (!clean) {
    return { started: false, voiceMissingForLanguage: false, reason: 'Nothing to speak.' };
  }
  if (!isSpeechSynthesisSupported()) {
    options.onError?.('Web Speech synthesis is not supported in this browser.');
    return {
      started: false,
      voiceMissingForLanguage: true,
      reason: 'Speech synthesis unsupported in this browser.',
    };
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = options.language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = Math.max(0.5, Math.min(2.0, options.rate ?? 1.0));

    const voice = pickBestVoice(options.language, options.preferredVoiceURI);
    const voiceMissingForLanguage = voice === null;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = (ev) => {
      options.onError?.(ev.error || 'Speech playback failed');
      options.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
    return { started: true, voiceMissingForLanguage };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to start speech synthesis';
    options.onError?.(msg);
    return { started: false, voiceMissingForLanguage: false, reason: msg };
  }
}

export function pauseSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.resume();
  }
}

export function stopSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
