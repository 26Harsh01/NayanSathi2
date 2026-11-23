import type {
  ButtonSize,
  InteractionMode,
  Language,
  ThemeMode,
} from './index';

export type AccountRole = 'patient' | 'caregiver';

export type ProfileVisibility = 'private' | 'caregiver_only' | 'limited_overview';

export type SentenceLengthPreference = 'short' | 'medium' | 'detailed';

export type FavouriteCategoryKey =
  | 'food'
  | 'music'
  | 'movie'
  | 'sport'
  | 'game'
  | 'colour'
  | 'people'
  | 'activities';

export type ProfileSectionKey =
  | 'overview'
  | 'personal'
  | 'interests'
  | 'favourites'
  | 'communication'
  | 'accessibility'
  | 'health'
  | 'privacy';

export interface PhotoCropConfig {
  zoom: number; // 1.0 .. 2.5
  offsetX: number; // -100 .. 100 normalized pan percentage
  offsetY: number; // -100 .. 100 normalized pan percentage
}

export interface UserProfilePhotoMeta {
  id: string;
  userId: string;
  slotKey: string; // 'avatar' | `fav_${id}`
  storageKind: 'indexeddb' | 'supabase';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  crop: PhotoCropConfig;
  remotePath?: string;
  updatedAt: string;
}

export interface UserProfileCore {
  userId: string;
  role: AccountRole;
  email?: string;
  fullName: string;
  preferredName: string;
  dateOfBirth: string; // Strictly YYYY-MM-DD or ''
  showAgePublicly: boolean;
  occupation: string;
  educationStatus: string;
  city: string;
  state: string;
  country: string;
  shortBio: string;
  onboardingCompleted: boolean;
  avatarPhotoId: string | null;
  caregiverName: string; // Backwards-compatible caregiver note field
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInterest {
  id: string;
  key: string; // catalog key or custom slug
  label: string;
  isCustom: boolean;
  addedAt: string;
}

export interface UserFavouriteItem {
  id: string;
  category: FavouriteCategoryKey;
  title: string;
  description: string;
  photoId: string | null;
  updatedAt: string;
}

export interface HowToCommunicateConfig {
  selectedPresets: string[];
  customInstructions: string;
}

export interface UserCommunicationPreferences {
  preferredLanguage: Language;
  secondaryLanguage: Language | 'none';
  preferredVoiceEn: string;
  preferredVoiceHi: string;
  speechRate: number;
  preferredSentenceLength: SentenceLengthPreference;
  preferredButtonSize: ButtonSize;
  preferredCategories: string[];
  favouritePhrases: string[];
  yesResponseEn: string;
  yesResponseHi: string;
  noResponseEn: string;
  noResponseHi: string;
  howToCommunicateWithMe: HowToCommunicateConfig;
  updatedAt: string;
}

export interface UserAccessibilitySettings {
  dwellDurationMs: number;
  cursorSize: number;
  minCutoff: number;
  beta: number;
  dCutoff: number;
  confidenceThreshold: number;
  blinkSelectionEnabled: boolean;
  longBlinkDurationMs: number;
  blinkOpenEar: number;
  blinkClosedEar: number;
  allowSingleEyeBlinkFallback: boolean;
  targetHysteresisPx: number;
  interactionMode: InteractionMode;
  buttonSize: ButtonSize;
  buttonSpacing: 'compact' | 'comfortable' | 'wide';
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  theme: ThemeMode;
  showDebugOverlay: boolean;
  outlierThreshold: number;
  trackingLossTimeoutMs: number;
  selectionCooldownMs: number;
  updatedAt: string;
}

export interface UserMedicalInformation {
  allergies: string;
  existingConditions: string;
  medications: string;
  preferredDoctor: string;
  doctorContact: string;
  preferredHospital: string;
  careInstructions: string;
  updatedAt: string;
}

export interface CaregiverAccessPermissions {
  enabled: boolean;
  authorizedCaregiverId: string;
  authorizedCaregiverEmail: string;
  canViewProfile: boolean;
  canEditProfile: boolean;
  canEditCommunication: boolean;
  canEditAccessibility: boolean;
  canViewMedical: boolean;
  canEditMedical: boolean;
}

export interface UserPrivacyControls {
  profileVisibility: ProfileVisibility;
  sharePersonalInfoWithCaregiver: boolean;
  shareHealthInfoWithCaregiver: boolean;
  historyConsentEnabled: boolean;
  allowInterestPersonalization: boolean;
  caregiverAccess: CaregiverAccessPermissions;
  updatedAt: string;
}

export interface FullUserProfileRecord {
  profile: UserProfileCore;
  interests: UserInterest[];
  favourites: UserFavouriteItem[];
  communication: UserCommunicationPreferences;
  accessibility: UserAccessibilitySettings;
  medical: UserMedicalInformation;
  privacy: UserPrivacyControls;
  photos: Record<string, UserProfilePhotoMeta>; // keyed by slotKey ('avatar', `fav_${id}`)
}

export interface LocalAccountDescriptor {
  userId: string;
  role: AccountRole;
  displayName: string;
  email?: string;
  linkedPatientId?: string; // for caregiver accounts managing a consented patient
  createdAt: string;
}

export interface ActiveUserSession {
  currentUserId: string;
  role: AccountRole;
  activePatientId: string; // Patient whose AAC workspace is currently loaded
  authProvider: 'local' | 'supabase';
  email?: string;
}
