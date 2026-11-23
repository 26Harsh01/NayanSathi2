import type {
  AccountRole,
  FavouriteCategoryKey,
  FullUserProfileRecord,
  UserAccessibilitySettings,
  UserCommunicationPreferences,
} from '../../types';
import { DEFAULT_SETTINGS } from '../storage/local-storage';

export interface InterestCatalogOption {
  key: string;
  labelEn: string;
  labelHi: string;
}

export const STANDARD_INTERESTS: InterestCatalogOption[] = [
  { key: 'music', labelEn: 'Music', labelHi: 'संगीत' },
  { key: 'movies', labelEn: 'Movies', labelHi: 'फ़िल्में' },
  { key: 'cricket', labelEn: 'Cricket', labelHi: 'क्रिकेट' },
  { key: 'football', labelEn: 'Football', labelHi: 'फ़ुटबॉल' },
  { key: 'chess', labelEn: 'Chess', labelHi: 'शतरंज' },
  { key: 'reading', labelEn: 'Reading', labelHi: 'पढ़ना' },
  { key: 'drawing', labelEn: 'Drawing', labelHi: 'चित्रकारी' },
  { key: 'photography', labelEn: 'Photography', labelHi: 'फ़ोटोग्राफ़ी' },
  { key: 'gaming', labelEn: 'Gaming', labelHi: 'गेमिंग' },
  { key: 'travelling', labelEn: 'Travelling', labelHi: 'यात्रा' },
  { key: 'cooking', labelEn: 'Cooking', labelHi: 'खाना बनाना' },
  { key: 'gardening', labelEn: 'Gardening', labelHi: 'बागवानी' },
  { key: 'family_activities', labelEn: 'Family Activities', labelHi: 'पारिवारिक गतिविधियाँ' },
];

export interface FavouriteCategoryMeta {
  key: FavouriteCategoryKey;
  labelEn: string;
  labelHi: string;
  placeholderEn: string;
  placeholderHi: string;
}

export const FAVOURITE_CATEGORIES: FavouriteCategoryMeta[] = [
  {
    key: 'food',
    labelEn: 'Favourite Food',
    labelHi: 'पसंदीदा भोजन',
    placeholderEn: 'e.g. Masala Dosa, Mango Lassi, Homemade Khichdi',
    placeholderHi: 'जैसे मसाला डोसा, आम लस्सी, खिचड़ी',
  },
  {
    key: 'music',
    labelEn: 'Favourite Music',
    labelHi: 'पसंदीदा संगीत',
    placeholderEn: 'e.g. Classical Flute, Old Hindi Melodies, Lo-Fi',
    placeholderHi: 'जैसे शास्त्रीय बांसुरी, पुराने हिंदी गीत',
  },
  {
    key: 'movie',
    labelEn: 'Favourite Movie',
    labelHi: 'पसंदीदा फ़िल्म',
    placeholderEn: 'e.g. Taare Zameen Par, Chhichhore, Planet Earth',
    placeholderHi: 'जैसे तारे ज़मीन पर, छिछोरे',
  },
  {
    key: 'sport',
    labelEn: 'Favourite Sport',
    labelHi: 'पसंदीदा खेल',
    placeholderEn: 'e.g. Cricket, Badminton, Football',
    placeholderHi: 'जैसे क्रिकेट, बैडमिंटन, फ़ुटबॉल',
  },
  {
    key: 'game',
    labelEn: 'Favourite Game',
    labelHi: 'पसंदीदा गेम',
    placeholderEn: 'e.g. Chess, Word Puzzles, Memory Cards, Ludo',
    placeholderHi: 'जैसे शतरंज, शब्द पहेली, मेमोरी कार्ड',
  },
  {
    key: 'colour',
    labelEn: 'Favourite Colour',
    labelHi: 'पसंदीदा रंग',
    placeholderEn: 'e.g. Teal Blue, Warm Yellow, Emerald Green',
    placeholderHi: 'जैसे नीला, पीला, हरा',
  },
  {
    key: 'people',
    labelEn: 'Favourite People',
    labelHi: 'पसंदीदा लोग',
    placeholderEn: 'e.g. Mom (Sunita), Best Friend Aarav, Grandpa',
    placeholderHi: 'जैसे माँ (सुनीता), दोस्त आरव, दादाजी',
  },
  {
    key: 'activities',
    labelEn: 'Favourite Activities',
    labelHi: 'पसंदीदा गतिविधियाँ',
    placeholderEn: 'e.g. Morning tea on the balcony, evening cricket highlights',
    placeholderHi: 'जैसे सुबह की चाय, शाम को संगीत सुनना',
  },
];

export interface CommunicateInstructionPreset {
  id: string;
  labelEn: string;
  labelHi: string;
}

export const HOW_TO_COMMUNICATE_PRESETS: CommunicateInstructionPreset[] = [
  {
    id: 'extra_time',
    labelEn: 'Please give me extra time to respond.',
    labelHi: 'कृपया मुझे उत्तर देने के लिए थोड़ा अतिरिक्त समय दें।',
  },
  {
    id: 'speak_directly',
    labelEn: 'Please speak directly to me.',
    labelHi: 'कृपया सीधे मुझसे बात करें।',
  },
  {
    id: 'one_question',
    labelEn: 'Please ask one question at a time.',
    labelHi: 'कृपया एक समय में एक ही प्रश्न पूछें।',
  },
  {
    id: 'visual_choices',
    labelEn: 'Please show me visual choices.',
    labelHi: 'कृपया मुझे दृश्य विकल्प दिखाएँ।',
  },
  {
    id: 'wait_finish',
    labelEn: 'Please wait until I finish communicating.',
    labelHi: 'कृपया मेरी बात पूरी होने तक प्रतीक्षा करें।',
  },
  {
    id: 'no_assumptions',
    labelEn: 'Please do not assume what I want.',
    labelHi: 'कृपया पहले से यह मान न लें कि मैं क्या चाहता हूँ।',
  },
];

export function createDefaultAccessibilitySettings(nowIso = new Date().toISOString()): UserAccessibilitySettings {
  return {
    dwellDurationMs: DEFAULT_SETTINGS.eyeTracking.dwellDurationMs,
    cursorSize: DEFAULT_SETTINGS.eyeTracking.cursorSize,
    minCutoff: DEFAULT_SETTINGS.eyeTracking.minCutoff,
    beta: DEFAULT_SETTINGS.eyeTracking.beta,
    dCutoff: DEFAULT_SETTINGS.eyeTracking.dCutoff,
    confidenceThreshold: DEFAULT_SETTINGS.eyeTracking.confidenceThreshold,
    blinkSelectionEnabled: DEFAULT_SETTINGS.eyeTracking.blinkSelectionEnabled,
    longBlinkDurationMs: DEFAULT_SETTINGS.eyeTracking.longBlinkDurationMs,
    blinkOpenEar: DEFAULT_SETTINGS.eyeTracking.blinkOpenEar,
    blinkClosedEar: DEFAULT_SETTINGS.eyeTracking.blinkClosedEar,
    allowSingleEyeBlinkFallback: DEFAULT_SETTINGS.eyeTracking.allowSingleEyeBlinkFallback,
    targetHysteresisPx: DEFAULT_SETTINGS.eyeTracking.targetHysteresisPx,
    interactionMode: DEFAULT_SETTINGS.interface.interactionMode,
    buttonSize: DEFAULT_SETTINGS.interface.buttonSize,
    buttonSpacing: DEFAULT_SETTINGS.interface.buttonSpacing,
    fontSize: DEFAULT_SETTINGS.interface.fontSize,
    highContrast: DEFAULT_SETTINGS.interface.highContrast,
    theme: DEFAULT_SETTINGS.interface.theme,
    showDebugOverlay: DEFAULT_SETTINGS.eyeTracking.showDebugOverlay,
    outlierThreshold: DEFAULT_SETTINGS.eyeTracking.outlierThreshold,
    trackingLossTimeoutMs: DEFAULT_SETTINGS.eyeTracking.trackingLossTimeoutMs,
    selectionCooldownMs: DEFAULT_SETTINGS.eyeTracking.selectionCooldownMs,
    updatedAt: nowIso,
  };
}

export function createDefaultCommunicationPreferences(
  nowIso = new Date().toISOString()
): UserCommunicationPreferences {
  return {
    preferredLanguage: DEFAULT_SETTINGS.communication.language,
    secondaryLanguage: 'none',
    preferredVoiceEn: DEFAULT_SETTINGS.communication.preferredVoiceEn,
    preferredVoiceHi: DEFAULT_SETTINGS.communication.preferredVoiceHi,
    speechRate: DEFAULT_SETTINGS.communication.speechRate,
    preferredSentenceLength: 'short',
    preferredButtonSize: DEFAULT_SETTINGS.interface.buttonSize,
    preferredCategories: ['basic', 'medical', 'emotions'],
    favouritePhrases: [],
    yesResponseEn: 'Yes',
    yesResponseHi: 'हाँ',
    noResponseEn: 'No',
    noResponseHi: 'नहीं',
    howToCommunicateWithMe: {
      selectedPresets: ['extra_time', 'speak_directly', 'wait_finish'],
      customInstructions: '',
    },
    updatedAt: nowIso,
  };
}

export function createEmptyFullProfileRecord(
  userId: string,
  role: AccountRole = 'patient',
  overrides?: {
    fullName?: string;
    preferredName?: string;
    email?: string;
    onboardingCompleted?: boolean;
    caregiverName?: string;
    notes?: string;
  }
): FullUserProfileRecord {
  const nowIso = new Date().toISOString();
  const fullName = overrides?.fullName?.trim() || (role === 'caregiver' ? 'Caregiver' : 'Guest User');
  const preferredName =
    overrides?.preferredName?.trim() || (fullName === 'Guest User' ? 'Friend' : fullName.split(' ')[0]);

  return {
    profile: {
      userId,
      role,
      email: overrides?.email || '',
      fullName,
      preferredName,
      dateOfBirth: '',
      showAgePublicly: false,
      occupation: '',
      educationStatus: '',
      city: '',
      state: '',
      country: '',
      shortBio: '',
      onboardingCompleted: overrides?.onboardingCompleted ?? false,
      avatarPhotoId: null,
      caregiverName: overrides?.caregiverName ?? '',
      notes: overrides?.notes ?? '',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    interests: [],
    favourites: [],
    communication: createDefaultCommunicationPreferences(nowIso),
    accessibility: createDefaultAccessibilitySettings(nowIso),
    medical: {
      allergies: '',
      existingConditions: '',
      medications: '',
      preferredDoctor: '',
      doctorContact: '',
      preferredHospital: '',
      careInstructions: '',
      updatedAt: nowIso,
    },
    privacy: {
      profileVisibility: 'private',
      sharePersonalInfoWithCaregiver: true,
      shareHealthInfoWithCaregiver: false,
      historyConsentEnabled: false,
      allowInterestPersonalization: true,
      caregiverAccess: {
        enabled: true,
        authorizedCaregiverId: '',
        authorizedCaregiverEmail: '',
        canViewProfile: true,
        canEditProfile: false,
        canEditCommunication: true,
        canEditAccessibility: true,
        canViewMedical: false,
        canEditMedical: false,
      },
      updatedAt: nowIso,
    },
    photos: {},
  };
}
