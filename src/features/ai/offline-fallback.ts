import type { AISuggestion, Language } from '../../types';

interface RulePattern {
  keywords: string[];
  en: string[];
  hi: string[];
}

const OFFLINE_PATTERNS: RulePattern[] = [
  {
    keywords: ['water', 'thirsty', 'drink', 'पानी', 'प्यास'],
    en: [
      'I am feeling thirsty. Please give me some water.',
      'Could you please bring me a glass of water?',
      'I need water, please.',
    ],
    hi: [
      'मुझे प्यास लगी है। कृपया मुझे थोड़ा पानी दीजिए।',
      'क्या आप मुझे एक गिलास पानी दे सकते हैं?',
      'मुझे पानी चाहिए, कृपया।',
    ],
  },
  {
    keywords: ['hungry', 'food', 'eat', 'भूख', 'खाना'],
    en: [
      'I am feeling hungry. Could I have something to eat?',
      'Please bring me some food when you can.',
      'I would like to eat now, please.',
    ],
    hi: [
      'मुझे भूख लगी है। कृपया मुझे कुछ खाने को दीजिए।',
      'जब संभव हो तो कृपया खाना ले आइए।',
      'मैं अब खाना चाहता हूँ।',
    ],
  },
  {
    keywords: ['pain', 'hurt', 'ache', 'uncomfortable', 'दर्द', 'असहज'],
    en: [
      'I am in pain. Please come help me.',
      'I am feeling uncomfortable and need assistance.',
      'Please check on me, I am experiencing pain.',
    ],
    hi: [
      'मुझे दर्द हो रहा है। कृपया मेरी मदद करें।',
      'मैं असहज महसूस कर रहा हूँ, कृपया पास आइए।',
      'कृपया मेरी जाँच करें, मुझे दर्द है।',
    ],
  },
  {
    keywords: ['doctor', 'medicine', 'sick', 'well', 'डॉक्टर', 'दवाई', 'तबीयत'],
    en: [
      'I am not feeling well. Please call the doctor.',
      'I need my medicine, please.',
      'Please contact my caregiver or doctor.',
    ],
    hi: [
      'मेरी तबीयत ठीक नहीं है। कृपया डॉक्टर को बुलाएँ।',
      'कृपया मुझे मेरी दवाई दीजिए।',
      'कृपया मेरे देखभालकर्ता या डॉक्टर से संपर्क करें।',
    ],
  },
  {
    keywords: ['tired', 'sleep', 'rest', 'थक', 'नींद', 'आराम', 'सोना'],
    en: [
      'I am tired and would like to rest now.',
      'Please help me get comfortable so I can sleep.',
      'I need some quiet rest, please.',
    ],
    hi: [
      'मैं थक गया हूँ और अब आराम करना चाहता हूँ।',
      'कृपया मुझे सोने के लिए आरामदायक स्थिति में मदद करें।',
      'मुझे थोड़ा आराम चाहिए।',
    ],
  },
  {
    keywords: ['help', 'caregiver', 'call', 'मदद', 'बुला', 'सहायता'],
    en: [
      'Please come here, I need help.',
      'Could you please call my caregiver?',
      'I need assistance right now, please.',
    ],
    hi: [
      'कृपया यहाँ आइए, मुझे मदद चाहिए।',
      'क्या आप कृपया मेरे देखभालकर्ता को बुला सकते हैं?',
      'मुझे अभी सहायता की ज़रूरत है।',
    ],
  },
  {
    keywords: ['thank', 'please', 'hello', 'love', 'talk', 'धन्यवाद', 'नमस्ते', 'बात', 'प्यार'],
    en: [
      'Thank you so much for your help.',
      'Hello, I would like to talk with you.',
      'I appreciate everything you do for me.',
    ],
    hi: [
      'आपकी मदद के लिए बहुत-बहुत धन्यवाद।',
      'नमस्ते, मैं आपसे बात करना चाहता हूँ।',
      'आपका बहुत धन्यवाद, मैं आभारी हूँ।',
    ],
  },
];

export function generateOfflineSuggestions(
  words: string[],
  currentSentence: string,
  language: Language
): AISuggestion[] {
  const combined = `${words.join(' ')} ${currentSentence}`.toLowerCase().trim();
  if (!combined) {
    return language === 'hi'
      ? [
          { id: 'off_1', text: 'मुझे थोड़ा पानी चाहिए, कृपया।', source: 'offline' },
          { id: 'off_2', text: 'कृपया मेरे देखभालकर्ता को बुलाएँ।', source: 'offline' },
          { id: 'off_3', text: 'मैं अभी आराम करना चाहता हूँ।', source: 'offline' },
        ]
      : [
          { id: 'off_1', text: 'I need some water, please.', source: 'offline' },
          { id: 'off_2', text: 'Please call my caregiver.', source: 'offline' },
          { id: 'off_3', text: 'I would like to rest now.', source: 'offline' },
        ];
  }

  const matchedSentences: string[] = [];
  for (const rule of OFFLINE_PATTERNS) {
    const hits = rule.keywords.some((kw) => combined.includes(kw));
    if (hits) {
      const pool = language === 'hi' ? rule.hi : rule.en;
      for (const s of pool) {
        if (!matchedSentences.includes(s)) {
          matchedSentences.push(s);
        }
      }
    }
  }

  if (matchedSentences.length > 0) {
    return matchedSentences.slice(0, 3).map((text, idx) => ({
      id: `off_${idx}_${Date.now()}`,
      text,
      source: 'offline',
    }));
  }

  // Deterministic clean completion from selected tokens without inventing symptoms/intent
  const cleanedPhrase = (currentSentence || words.join(' ')).trim();
  const capitalized =
    cleanedPhrase.length > 0
      ? cleanedPhrase.charAt(0).toUpperCase() + cleanedPhrase.slice(1)
      : cleanedPhrase;

  const fallbacks =
    language === 'hi'
      ? [
          `${cleanedPhrase}।`,
          `कृपया ${cleanedPhrase} के लिए मदद करें।`,
          `मुझे ${cleanedPhrase} चाहिए।`,
        ]
      : [
          `${capitalized.replace(/[.!?]+$/, '')}.`,
          `Please help me with ${cleanedPhrase.toLowerCase()}.`,
          `I would like ${cleanedPhrase.toLowerCase()}, please.`,
        ];

  return fallbacks.slice(0, 3).map((text, idx) => ({
    id: `off_gen_${idx}_${Date.now()}`,
    text,
    source: 'offline',
  }));
}
