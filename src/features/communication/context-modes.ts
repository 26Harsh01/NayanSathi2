import type { CommunicationContextId, PhraseItem } from '../../types';

export interface ContextShortcutPhrase {
  id: string;
  textEn: string;
  textHi: string;
}

export interface CommunicationContextDef {
  id: CommunicationContextId;
  labelEn: string;
  labelHi: string;
  descriptionEn: string;
  descriptionHi: string;
  shortcuts: ContextShortcutPhrase[];
}

export const COMMUNICATION_CONTEXTS: CommunicationContextDef[] = [
  {
    id: 'home',
    labelEn: 'Home',
    labelHi: 'घर',
    descriptionEn: 'Everyday comfort, room adjustments, and household requests',
    descriptionHi: 'घर की सुविधा, कमरे की व्यवस्था और दैनिक अनुरोध',
    shortcuts: [
      { id: 'ctx_h1', textEn: 'Please turn on the light.', textHi: 'कृपया लाइट जला दें।' },
      { id: 'ctx_h2', textEn: 'Please adjust my pillow.', textHi: 'कृपया मेरा तकिया ठीक कर दें।' },
      { id: 'ctx_h3', textEn: 'Please open the window.', textHi: 'कृपया खिड़की खोल दें।' },
      { id: 'ctx_h4', textEn: 'I want to watch television.', textHi: 'मैं टीवी देखना चाहता हूँ।' },
      { id: 'ctx_h5', textEn: 'I need water.', textHi: 'मुझे पानी चाहिए।' },
      { id: 'ctx_h6', textEn: 'Please lower the fan speed.', textHi: 'कृपया पंखे की गति कम कर दें।' },
    ],
  },
  {
    id: 'hospital',
    labelEn: 'Hospital',
    labelHi: 'अस्पताल',
    descriptionEn: 'Care team, comfort, pain reporting, and medical assistance',
    descriptionHi: 'डॉक्टर, नर्स, दर्द और चिकित्सा सहायता से जुड़े वाक्य',
    shortcuts: [
      { id: 'ctx_ho1', textEn: 'Please call the nurse.', textHi: 'कृपया नर्स को बुलाएँ।' },
      { id: 'ctx_ho2', textEn: 'I am in pain.', textHi: 'मुझे दर्द हो रहा है।' },
      { id: 'ctx_ho3', textEn: 'I need my medicine.', textHi: 'मुझे अपनी दवाई चाहिए।' },
      { id: 'ctx_ho4', textEn: 'I feel dizzy.', textHi: 'मुझे चक्कर आ रहे हैं।' },
      { id: 'ctx_ho5', textEn: 'Please check my IV or tubing.', textHi: 'कृपया मेरी ड्रिप या ट्यूबिंग जांचें।' },
      { id: 'ctx_ho6', textEn: 'Can the doctor explain this?', textHi: 'क्या डॉक्टर इसे समझा सकते हैं?' },
    ],
  },
  {
    id: 'school',
    labelEn: 'School',
    labelHi: 'स्कूल',
    descriptionEn: 'Classroom participation, questions, pacing, and study breaks',
    descriptionHi: 'कक्षा में प्रश्न, समझने और विश्राम के लिए वाक्य',
    shortcuts: [
      { id: 'ctx_s1', textEn: 'I have a question.', textHi: 'मेरा एक प्रश्न है।' },
      { id: 'ctx_s2', textEn: 'Please repeat that.', textHi: 'कृपया उसे दोहराएँ।' },
      { id: 'ctx_s3', textEn: 'I need a little more time.', textHi: 'मुझे थोड़ा और समय चाहिए।' },
      { id: 'ctx_s4', textEn: 'Yes, I understand.', textHi: 'हाँ, मैं समझ गया हूँ।' },
      { id: 'ctx_s5', textEn: 'May I take a short break?', textHi: 'क्या मैं थोड़ा विश्राम कर सकता हूँ?' },
      { id: 'ctx_s6', textEn: 'Thank you for explaining.', textHi: 'समझाने के लिए धन्यवाद।' },
    ],
  },
  {
    id: 'family',
    labelEn: 'Family',
    labelHi: 'परिवार',
    descriptionEn: 'Warm personal conversation and spending time together',
    descriptionHi: 'परिवार से बातचीत और स्नेहपूर्ण संवाद',
    shortcuts: [
      { id: 'ctx_f1', textEn: 'I love you.', textHi: 'मैं आपसे प्यार करता हूँ।' },
      { id: 'ctx_f2', textEn: 'How was your day?', textHi: 'आपका दिन कैसा रहा?' },
      { id: 'ctx_f3', textEn: 'Please sit with me.', textHi: 'कृपया मेरे पास बैठें।' },
      { id: 'ctx_f4', textEn: 'Let us look at family photos.', textHi: 'आइए परिवार की तस्वीरें देखें।' },
      { id: 'ctx_f5', textEn: 'Thank you for helping me.', textHi: 'मेरी मदद करने के लिए धन्यवाद।' },
      { id: 'ctx_f6', textEn: 'I am happy to see you.', textHi: 'आपको देखकर मुझे खुशी हुई।' },
    ],
  },
  {
    id: 'outside',
    labelEn: 'Outside',
    labelHi: 'बाहर',
    descriptionEn: 'Mobility pacing, weather comfort, and returning indoors',
    descriptionHi: 'बाहर घूमने, मौसम और गति नियंत्रण से जुड़े वाक्य',
    shortcuts: [
      { id: 'ctx_o1', textEn: 'Please slow down.', textHi: 'कृपया धीरे चलें।' },
      { id: 'ctx_o2', textEn: 'Please stop here for a moment.', textHi: 'कृपया यहाँ एक पल रुकें।' },
      { id: 'ctx_o3', textEn: 'It is too bright here.', textHi: 'यहाँ बहुत तेज़ रोशनी है।' },
      { id: 'ctx_o4', textEn: 'I feel cold.', textHi: 'मुझे ठंड लग रही है।' },
      { id: 'ctx_o5', textEn: 'Let us go back inside.', textHi: 'चलिए वापस अंदर चलते हैं।' },
      { id: 'ctx_o6', textEn: 'I am enjoying the fresh air.', textHi: 'मुझे ताज़ी हवा अच्छी लग रही है।' },
    ],
  },
  {
    id: 'custom',
    labelEn: 'Custom',
    labelHi: 'कस्टम',
    descriptionEn: 'Personalized phrases saved from the board or Caregiver Portal',
    descriptionHi: 'बोर्ड या देखभालकर्ता पोर्टल से सहेजे गए आपके व्यक्तिगत वाक्यांश',
    shortcuts: [],
  },
];

export interface QuickAccessNeedItem {
  id: string;
  labelEn: string;
  labelHi: string;
  speakEn: string;
  speakHi: string;
  tone: 'amber' | 'sky' | 'violet' | 'rose' | 'emerald' | 'slate';
}

export const QUICK_ACCESS_NEEDS: QuickAccessNeedItem[] = [
  {
    id: 'qa_hungry',
    labelEn: "I'm Hungry",
    labelHi: 'भूख लगी है',
    speakEn: 'I am hungry.',
    speakHi: 'मुझे भूख लगी है।',
    tone: 'amber',
  },
  {
    id: 'qa_thirsty',
    labelEn: "I'm Thirsty",
    labelHi: 'प्यास लगी है',
    speakEn: 'I am thirsty. Please bring water.',
    speakHi: 'मुझे प्यास लगी है। कृपया पानी दें।',
    tone: 'sky',
  },
  {
    id: 'qa_washroom',
    labelEn: 'Washroom',
    labelHi: 'वॉशरूम',
    speakEn: 'I need to use the washroom.',
    speakHi: 'मुझे वॉशरूम जाना है।',
    tone: 'violet',
  },
  {
    id: 'qa_medicine',
    labelEn: 'My Medicine',
    labelHi: 'मेरी दवाई',
    speakEn: 'I need my medicine.',
    speakHi: 'मुझे अपनी दवाई चाहिए।',
    tone: 'rose',
  },
  {
    id: 'qa_rest',
    labelEn: 'Need Rest',
    labelHi: 'आराम चाहिए',
    speakEn: 'I need to rest.',
    speakHi: 'मुझे आराम चाहिए।',
    tone: 'emerald',
  },
  {
    id: 'qa_help',
    labelEn: 'Call Helper',
    labelHi: 'मदद बुलाएँ',
    speakEn: 'Please come help me.',
    speakHi: 'कृपया आकर मेरी मदद करें।',
    tone: 'slate',
  },
];

export function deduplicatePhrases(items: PhraseItem[]): PhraseItem[] {
  const seen = new Set<string>();
  const result: PhraseItem[] = [];
  for (const item of items) {
    const keyEn = item.textEn.trim().toLowerCase();
    const keyHi = item.textHi.trim().toLowerCase();
    const composite = `${keyEn}::${keyHi}`;
    if (!keyEn && !keyHi) continue;
    if (seen.has(composite)) continue;
    seen.add(composite);
    result.push(item);
  }
  return result;
}

export function paginateItems<T>(
  items: T[],
  pageIndex: number,
  pageSize: number
): {
  items: T[];
  page: number;
  totalPages: number;
} {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.max(0, Math.min(totalPages - 1, pageIndex));
  const start = safePage * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    totalPages,
  };
}
