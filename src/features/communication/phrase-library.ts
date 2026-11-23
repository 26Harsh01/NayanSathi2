import type { PhraseCategory, PhraseItem } from '../../types';

export const DEFAULT_CATEGORIES: PhraseCategory[] = [
  { id: 'basic', nameEn: 'Basic Needs', nameHi: 'बुनियादी ज़रूरतें' },
  { id: 'emotions', nameEn: 'Emotions', nameHi: 'भावनाएँ' },
  { id: 'medical', nameEn: 'Medical', nameHi: 'चिकित्सा' },
  { id: 'social', nameEn: 'Social', nameHi: 'सामाजिक' },
  { id: 'daily', nameEn: 'Daily Activities', nameHi: 'दैनिक कार्य' },
];

export const DEFAULT_PHRASES: PhraseItem[] = [
  // Basic needs
  { id: 'b1', categoryId: 'basic', textEn: 'I need help.', textHi: 'मुझे मदद चाहिए।' },
  { id: 'b2', categoryId: 'basic', textEn: 'I am hungry.', textHi: 'मुझे भूख लगी है।' },
  { id: 'b3', categoryId: 'basic', textEn: 'I am thirsty.', textHi: 'मुझे प्यास लगी है।' },
  { id: 'b4', categoryId: 'basic', textEn: 'I need water.', textHi: 'मुझे पानी चाहिए।' },
  { id: 'b5', categoryId: 'basic', textEn: 'I am tired.', textHi: 'मैं थक गया हूँ।' },
  { id: 'b6', categoryId: 'basic', textEn: 'I need rest.', textHi: 'मुझे आराम चाहिए।' },

  // Emotions
  { id: 'e1', categoryId: 'emotions', textEn: 'I am happy.', textHi: 'मैं खुश हूँ।' },
  { id: 'e2', categoryId: 'emotions', textEn: 'I am sad.', textHi: 'मैं उदास हूँ।' },
  { id: 'e3', categoryId: 'emotions', textEn: 'I am uncomfortable.', textHi: 'मैं असहज महसूस कर रहा हूँ।' },
  { id: 'e4', categoryId: 'emotions', textEn: 'I am scared.', textHi: 'मुझे डर लग रहा है।' },
  { id: 'e5', categoryId: 'emotions', textEn: 'I am in pain.', textHi: 'मुझे दर्द हो रहा है।' },

  // Medical
  { id: 'm1', categoryId: 'medical', textEn: 'I need a doctor.', textHi: 'मुझे डॉक्टर की ज़रूरत है।' },
  { id: 'm2', categoryId: 'medical', textEn: 'I need medicine.', textHi: 'मुझे दवाई चाहिए।' },
  { id: 'm3', categoryId: 'medical', textEn: 'I am not feeling well.', textHi: 'मेरी तबीयत ठीक नहीं है।' },
  { id: 'm4', categoryId: 'medical', textEn: 'Please call my caregiver.', textHi: 'कृपया मेरे देखभालकर्ता को बुलाएँ।' },

  // Social
  { id: 's1', categoryId: 'social', textEn: 'Hello.', textHi: 'नमस्ते।' },
  { id: 's2', categoryId: 'social', textEn: 'Thank you.', textHi: 'धन्यवाद।' },
  { id: 's3', categoryId: 'social', textEn: 'Please.', textHi: 'कृपया।' },
  { id: 's4', categoryId: 'social', textEn: 'I love you.', textHi: 'मैं आपसे प्यार करता हूँ।' },
  { id: 's5', categoryId: 'social', textEn: 'I want to talk.', textHi: 'मैं बात करना चाहता हूँ।' },

  // Daily activities
  { id: 'd1', categoryId: 'daily', textEn: 'I want to go outside.', textHi: 'मैं बाहर जाना चाहता हूँ।' },
  { id: 'd2', categoryId: 'daily', textEn: 'I want to watch television.', textHi: 'मैं टीवी देखना चाहता हूँ।' },
  { id: 'd3', categoryId: 'daily', textEn: 'I want to sleep.', textHi: 'मैं सोना चाहता हूँ।' },
  { id: 'd4', categoryId: 'daily', textEn: 'I want to eat.', textHi: 'मैं खाना खाना चाहता हूँ।' },
];

export const QUICK_WORDS_EN = [
  'water',
  'help',
  'please',
  'thank you',
  'yes',
  'no',
  'pain',
  'rest',
  'food',
  'medicine',
  'doctor',
  'family',
];

export const QUICK_WORDS_HI = [
  'पानी',
  'मदद',
  'कृपया',
  'धन्यवाद',
  'हाँ',
  'नहीं',
  'दर्द',
  'आराम',
  'खाना',
  'दवाई',
  'डॉक्टर',
  'परिवार',
];

export const EMERGENCY_PHRASES = [
  { id: 'em1', textEn: 'I NEED HELP.', textHi: 'मुझे तुरंत मदद चाहिए।' },
  { id: 'em2', textEn: 'CALL MY CAREGIVER.', textHi: 'मेरे देखभालकर्ता को कॉल करें।' },
  { id: 'em3', textEn: 'I AM IN PAIN.', textHi: 'मुझे बहुत दर्द हो रहा है।' },
  { id: 'em4', textEn: 'I NEED MEDICAL HELP.', textHi: 'मुझे चिकित्सा सहायता चाहिए।' },
  { id: 'em5', textEn: 'PLEASE CALL EMERGENCY SERVICES.', textHi: 'कृपया आपातकालीन सेवाओं को कॉल करें।' },
];
