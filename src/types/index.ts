export type Language = 'en' | 'hi';

export type ButtonSize = 'standard' | 'large' | 'xlarge';

export type ThemeMode = 'light' | 'dark';

export type InteractionMode = 'gaze' | 'mouse' | 'keyboard' | 'switch';

export type CommunicationContextId =
  | 'home'
  | 'hospital'
  | 'school'
  | 'family'
  | 'outside'
  | 'custom';

export interface DetectedFaceSummary {
  index: number; // Raw MediaPipe index
  displayNumber: number; // 1-based left-to-right viewer index
  centerX: number; // Raw video normalized 0..1
  centerY: number; // Raw video normalized 0..1
  scale: number; // Inter-ocular distance
  label: string;
}

export type TrackingStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'tracking'
  | 'no-face'
  | 'multiple-faces'
  | 'low-confidence'
  | 'blink-paused'
  | 'camera-error';

export type CameraErrorCode =
  | 'permission-denied'
  | 'not-found'
  | 'in-use'
  | 'unsupported'
  | 'unknown';

export type BlinkPhase = 'OPEN' | 'CLOSING' | 'CLOSED' | 'REOPENING';

export interface BlinkEvent {
  type: 'natural' | 'intentional';
  durationMs: number;
  timestamp: number;
}

export interface BlinkDiagnosticState {
  state: BlinkPhase;
  earLeft: number;
  earRight: number;
  smoothedEar: number;
  isBlinking: boolean;
  blinkDurationMs: number;
  blinkCount: number;
  longBlinkTriggered: boolean;
  lastBlinkEvent: BlinkEvent | null;
  openBaselineEar: number;
  closedBaselineEar: number;
  closeThreshold: number;
  openThreshold: number;
}

export interface EyeLandmarks2D {
  irisCenter: { x: number; y: number };
  innerCorner: { x: number; y: number };
  outerCorner: { x: number; y: number };
  upperLid: { x: number; y: number };
  lowerLid: { x: number; y: number };
  ear: number; // Eye Aspect Ratio (6-point contour)
  normalizedIrisX: number; // 0..1 along eye axis (viewer-left to viewer-right)
  normalizedIrisY: number; // 0..1 vertical ratio
  width: number;
  lidHeight: number;
  reliable: boolean;
}

export interface HeadPose {
  yaw: number; // normalized -1..1
  pitch: number; // normalized -1..1
  roll: number; // radians
  faceCenterX: number; // 0..1 normalized video frame
  faceCenterY: number; // 0..1 normalized video frame
  faceScale: number; // inter-ocular distance normalized to frame width
  excessiveMovement?: boolean;
}

export interface GazeFeatures {
  timestamp: number;
  leftEye: EyeLandmarks2D | null;
  rightEye: EyeLandmarks2D | null;
  irisX: number;
  irisY: number;
  irisDiffX: number;
  irisDiffY: number;
  relDispX: number;
  relDispY: number;
  earLeft: number;
  earRight: number;
  earAvg: number;
  baselineEar: number;
  isBlinking: boolean;
  headPose: HeadPose;
  confidence: number; // 0..1
  faceCount: number;
}

export interface GazePoint {
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  confidence: number;
  timestamp: number;
}

export interface CalibrationPointTarget {
  id: string;
  labelEn: string;
  labelHi: string;
  normX: number; // 0.08 .. 0.92
  normY: number; // 0.10 .. 0.90
  region:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'center'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
}

export interface CalibrationSample {
  targetId: string;
  targetX: number;
  targetY: number;
  featureVector: number[];
  confidence: number;
  timestamp: number;
}

export type CalibrationQualityTier = 'strong' | 'moderate' | 'needs-recalibration' | 'uncalibrated';

export interface PointValidationResult {
  targetId: string;
  region: CalibrationPointTarget['region'];
  sampleCount: number;
  meanResidualNorm: number; // held-out Euclidean normalized error 0..1
  meanErrorXNorm: number; // held-out horizontal normalized error
  meanErrorYNorm: number; // held-out vertical normalized error
  needsRecalibration: boolean;
}

export interface BaselineHeadPose {
  yaw: number;
  pitch: number;
  roll: number;
  faceCenterX: number;
  faceCenterY: number;
  faceScale: number;
}

export interface RidgeModelWeights {
  weightsX: number[];
  weightsY: number[];
  featureMeans: number[];
  featureScales: number[];
  baselinePose: BaselineHeadPose;
  degree: number;
  lambdaGaze: number;
  lambdaPose: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio?: number;
}

export interface CalibrationProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  model: RidgeModelWeights;
  qualityTier: CalibrationQualityTier;
  trainingErrorNorm: number;
  meanValidationNormError: number;
  validationHorizErrorNorm: number;
  validationVertErrorNorm: number;
  featureVariance: {
    irisX: number;
    irisY: number;
  };
  pointResults: PointValidationResult[];
  totalSamplesCollected: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export interface PhraseCategory {
  id: string;
  nameEn: string;
  nameHi: string;
  isCustom?: boolean;
}

export interface PhraseItem {
  id: string;
  categoryId: string;
  textEn: string;
  textHi: string;
  isCustom?: boolean;
  isFavorite?: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
  email: string;
  preferredChannel?: 'whatsapp' | 'sms' | 'whatsapp_then_sms' | 'sms_then_whatsapp' | 'call_only';
  role?: 'primary_caregiver' | 'secondary_caregiver' | 'family_member' | 'emergency_support';
  isPrimary: boolean;
  isActive?: boolean;
  consentStatus?: 'granted' | 'pending' | 'revoked';
  verificationStatus?: 'verified' | 'unverified' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationHistoryEntry {
  id: string;
  text: string;
  language: Language;
  timestamp: string;
  spoken: boolean;
}

export interface AISuggestion {
  id: string;
  text: string;
  source: 'gemini' | 'offline';
}

export interface EyeTrackingSettings {
  enabled: boolean;
  dwellDurationMs: number; // 500..3000 (default 1000)
  cursorSize: number; // 22..36
  cursorVisible: boolean;
  minCutoff: number; // 1-Euro minCutoff (Hz)
  beta: number; // 1-Euro beta (normalized viewport speed scale)
  dCutoff: number; // 1-Euro derivative cutoff (Hz)
  confidenceThreshold: number; // 0.3..0.85
  blinkSelectionEnabled: boolean;
  longBlinkDurationMs: number; // 400..1500 (default 700)
  blinkOpenEar: number; // personalized open-eye EAR baseline
  blinkClosedEar: number; // personalized closed-eye EAR baseline
  allowSingleEyeBlinkFallback: boolean;
  showDebugOverlay: boolean;
  dwellTolerancePx: number;
  targetHysteresisPx: number; // exit margin beyond target bounds
  outlierThreshold: number; // Hampel MAD sigma multiplier (2.0..5.0)
  trackingLossTimeoutMs: number; // hold last position before hiding cursor (200..1500)
  selectionCooldownMs: number;
}

export interface InterfaceSettings {
  buttonSize: ButtonSize;
  buttonSpacing: 'compact' | 'comfortable' | 'wide';
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  theme: ThemeMode;
  interactionMode: InteractionMode;
}

export interface CommunicationSettings {
  language: Language;
  secondaryLanguage: Language;
  speechRate: number; // 0.6..1.5
  preferredVoiceEn: string;
  preferredVoiceHi: string;
  activeContext: CommunicationContextId;
  preferredSentenceLength: 'concise' | 'balanced' | 'detailed';
  communicationInstructions: string;
}

export interface PrivacySettings {
  historyConsentEnabled: boolean;
  medicalEmergencyCardConsent: boolean;
  shareWellbeingWithCaregivers: boolean;
  shareHandoverWithCaregivers: boolean;
  hidePrivateIdentityFields: boolean;
}

export interface PatientProfile {
  name: string;
  preferredName: string;
  caregiverName: string;
  notes: string;
  onboardingCompleted: boolean;
  dateOfBirth?: string; // ISO YYYY-MM-DD (private by default)
  occupation?: string;
  education?: string;
  city?: string;
  state?: string;
  country?: string;
  personalIntroduction?: string;
  photoAssetId?: string;
}

export interface PatientAccountSummary {
  id: string;
  displayName: string;
  createdAt: string;
}

export interface AppSettings {
  eyeTracking: EyeTrackingSettings;
  interface: InterfaceSettings;
  communication: CommunicationSettings;
  privacy: PrivacySettings;
}

// --- Personal Independence & Life Hub Platform Types ---

export type ChoiceCategoryId =
  | 'eat'
  | 'drink'
  | 'wear'
  | 'watch'
  | 'activity'
  | 'where'
  | 'person';

export interface PersonalChoiceOption {
  id: string;
  category: ChoiceCategoryId;
  labelEn: string;
  labelHi: string;
  iconKey: string;
  photoAssetId?: string;
  isCustom?: boolean;
}

export interface ConfirmedChoiceRecord {
  id: string;
  category: ChoiceCategoryId;
  optionId: string;
  label: string;
  confirmedAt: string;
  requestId?: string;
}

export interface BelongingItem {
  id: string;
  labelEn: string;
  labelHi: string;
  iconKey: string;
  photoAssetId?: string;
  isCustom?: boolean;
}

export type HelpRequestCategory =
  | 'choice'
  | 'comfort'
  | 'belonging'
  | 'room'
  | 'medicine'
  | 'appointment'
  | 'routine'
  | 'general';

export type HelpRequestStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'resolved';

export interface HelpRequest {
  id: string;
  patientId: string;
  category: HelpRequestCategory;
  title: string;
  details?: string;
  status: HelpRequestStatus;
  createdAt: string;
  updatedAt: string;
  acknowledgedBy?: string;
  caregiverNote?: string;
  caregiverConnected: boolean;
}

export type MedicineFrequency = 'daily' | 'twice_daily' | 'weekly' | 'as_needed';

export interface MedicineReminder {
  id: string;
  name: string;
  description: string;
  reminderTime: string; // HH:mm
  frequency: MedicineFrequency;
  instructions?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  active: boolean;
  snoozedUntilIso?: string;
  lastAcknowledgedDate?: string;
  createdAt: string;
}

export type MedicineAckAction = 'taken' | 'snoozed' | 'help' | 'call_caregiver';

export interface MedicineAcknowledgment {
  id: string;
  reminderId: string;
  medicineName: string;
  action: MedicineAckAction;
  timestamp: string;
  note?: string;
}

export interface BodyDiscomfortEntry {
  id: string;
  bodyArea: string;
  discomfortType: string;
  severity: 'mild' | 'moderate' | 'severe';
  startedWhen: string;
  details: string;
  createdAt: string;
}

export interface MedicalInformation {
  allergies: string;
  existingConditions: string;
  medications: string;
  careInstructions: string;
  preferredDoctor: string;
  doctorContact: string;
  preferredHospital: string;
  emergencyCaregiverInfo: string;
  updatedAt?: string;
}

export interface WellbeingEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: string;
  sleepQuality: string;
  appetite: string;
  discomfort: string;
  comfortLevel: string;
  generalWellbeing: string;
  notes: string;
  sharedWithCaregiver: boolean;
  createdAt: string;
}

export type RoomDeviceType = 'lights' | 'fan' | 'tv' | 'curtains' | 'temperature' | 'other';

export interface SmartHomeIntegrationConfig {
  enabled: boolean;
  endpointUrl: string; // e.g. Home Assistant URL; empty in unconfigured mode
  entityMap: Partial<Record<RoomDeviceType, string>>;
}

export interface RoomControlLogEntry {
  id: string;
  deviceType: RoomDeviceType;
  deviceLabel: string;
  command: string;
  mode: 'smart_device' | 'caregiver';
  status: 'confirmed' | 'failed' | 'pending_caregiver' | 'accepted' | 'in_progress' | 'completed';
  message: string;
  helpRequestId?: string;
  timestamp: string;
}

export type RoutineSection =
  | 'morning'
  | 'hygiene'
  | 'meals'
  | 'appointments'
  | 'medication'
  | 'rest'
  | 'evening';

export type RoutineStepStatus = 'pending' | 'done' | 'skipped' | 'help' | 'later';

export interface DailyRoutineItem {
  id: string;
  section: RoutineSection;
  titleEn: string;
  titleHi: string;
  instructionsEn: string;
  instructionsHi: string;
  scheduledTime?: string;
  status: RoutineStepStatus;
  updatedAt?: string;
}

export interface ShoppingCatalogItem {
  id: string;
  nameEn: string;
  nameHi: string;
  category: string;
  photoAssetId?: string;
  isCustom?: boolean;
}

export interface ShoppingListEntry {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  note?: string;
}

export interface RestaurantMenuItem {
  id: string;
  nameEn: string;
  nameHi: string;
  category: 'meals' | 'snacks' | 'drinks' | 'dessert';
  photoAssetId?: string;
}

export type AppointmentResponseStatus =
  | 'scheduled'
  | 'ready'
  | 'need_more_time'
  | 'need_help_ready'
  | 'contact_caregiver'
  | 'reschedule_requested';

export interface AppointmentItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  contactInfo: string;
  notes: string;
  patientStatus: AppointmentResponseStatus;
  updatedAt: string;
}

export interface CommunicationPassport {
  howICommunicate: string;
  preferredLanguage: string;
  howISayYesNo: string;
  responseTimeNeeded: string;
  communicationPreferences: string;
  whatMakesMeComfortable: string;
  whatHelpsMeCommunicate: string;
  caregiverInstructions: string;
  updatedAt: string;
}

export interface ImportantPerson {
  id: string;
  name: string;
  relationship: string;
  category: 'family' | 'friend' | 'caregiver' | 'doctor' | 'other';
  phone?: string;
  email?: string;
  photoAssetId?: string;
  favoritePhrases: string[];
  createdAt: string;
}

export type CaregiverRole = 'primary' | 'secondary' | 'family' | 'support_worker';

export interface CaregiverRelationship {
  id: string;
  name: string;
  role: CaregiverRole;
  relationshipLabel: string;
  phone: string;
  email: string;
  consentGranted: boolean;
  canEditPhrases: boolean;
  canViewHistory: boolean;
  canViewMedical: boolean;
  canEditMedical: boolean;
  canManageRoutines: boolean;
  canManageRequests: boolean;
  canViewHandover: boolean;
  canWriteHandover: boolean;
  grantedAt?: string;
}

export type CaregiverPermissionKey =
  | 'canEditPhrases'
  | 'canViewHistory'
  | 'canViewMedical'
  | 'canEditMedical'
  | 'canManageRoutines'
  | 'canManageRequests'
  | 'canViewHandover'
  | 'canWriteHandover';

export interface CaregiverHandoverNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: CaregiverRole;
  importantRequests: string;
  activitiesCompleted: string;
  personalPreferences: string;
  pendingAssistance: string;
  patientSelectedInfo: string;
  consentShared: boolean;
  createdAt: string;
}

export interface FavouriteItem {
  id: string;
  category: 'food' | 'music' | 'movie' | 'sport' | 'colour' | 'activity' | 'other';
  label: string;
  photoAssetId?: string;
  notes?: string;
}

export interface LifeHubState {
  choices: PersonalChoiceOption[];
  confirmedChoices: ConfirmedChoiceRecord[];
  customComfortRequests: string[];
  belongings: BelongingItem[];
  helpRequests: HelpRequest[];
  medicineReminders: MedicineReminder[];
  medicineAcks: MedicineAcknowledgment[];
  medicalInfo: MedicalInformation;
  discomfortEntries: BodyDiscomfortEntry[];
  wellbeingJournal: WellbeingEntry[];
  smartHomeConfig: SmartHomeIntegrationConfig;
  roomControlLogs: RoomControlLogEntry[];
  routines: DailyRoutineItem[];
  shoppingCatalog: ShoppingCatalogItem[];
  shoppingList: ShoppingListEntry[];
  restaurantSelectedDishes: string[];
  restaurantPreferences: string[];
  appointments: AppointmentItem[];
  passport: CommunicationPassport;
  importantPeople: ImportantPerson[];
  interests: string[];
  favourites: FavouriteItem[];
  caregivers: CaregiverRelationship[];
  handoverNotes: CaregiverHandoverNote[];
}

// --- Games Module Types ---

export type GameId =
  | 'tic-tac-toe'
  | 'chess'
  | 'memory-match'
  | 'picture-puzzle'
  | 'word-guess'
  | 'connect-four'
  | 'pattern-sequence';

export type GameCategoryId = 'board' | 'memory' | 'puzzle' | 'word' | 'logic';

export type GameDifficulty = 'easy' | 'medium' | 'hard';

export interface GameScoreSummary {
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  bestMoves?: number;
  puzzlesSolved: number;
  lastPlayedAt?: string;
}

export interface GameHistoryEntry {
  id: string;
  gameId: GameId;
  summary: string;
  outcome: 'win' | 'loss' | 'draw' | 'completed';
  difficulty: GameDifficulty;
  moves: number;
  timestamp: string;
}

export interface CustomMemoryPictureCard {
  id: string;
  label: string;
  assetId: string;
}

export interface GamesPatientState {
  saveActivityEnabled: boolean;
  preferredDifficulty: GameDifficulty;
  audioInstructionsEnabled: boolean;
  customPuzzlePhotoIds: string[];
  customMemoryCards: CustomMemoryPictureCard[];
  scores: Record<GameId, GameScoreSummary>;
  history: GameHistoryEntry[];
}

// --- Music Module Types ---

export type MusicCategoryId =
  | 'hindi_songs'
  | 'english_songs'
  | 'devotional'
  | 'instrumental'
  | 'classical'
  | 'relaxing'
  | 'nature_sounds'
  | 'personal_recordings'
  | 'custom_music';

export type MusicRepeatMode = 'off' | 'all' | 'one';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  category: MusicCategoryId;
  audioAssetId: string;
  coverAssetId?: string;
  durationSec: number;
  mimeType: string;
  fileSizeBytes: number;
  authorizedConfirmed: boolean;
  sourceType: 'uploaded_local' | 'supabase_private';
  createdAt: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MusicPreferences {
  favouriteGenres: MusicCategoryId[];
  favouriteArtists: string[];
  preferredPlaylistIds: string[];
  favouriteNatureSounds: string[];
  trackRecentlyPlayed: boolean;
  defaultVolume: number;
  repeatMode: MusicRepeatMode;
  shuffleEnabled: boolean;
}

export interface RecentlyPlayedEntry {
  trackId: string;
  playedAt: string;
}

export interface MusicPatientState {
  tracks: MusicTrack[];
  favouriteTrackIds: string[];
  playlists: MusicPlaylist[];
  recentlyPlayed: RecentlyPlayedEntry[];
  preferences: MusicPreferences;
}

// --- News, Entertainment & Hub Personalization Types ---

export type NewsCategoryId =
  | 'top'
  | 'india'
  | 'world'
  | 'technology'
  | 'science'
  | 'sports'
  | 'health'
  | 'education';

export type SportCategoryId = 'cricket' | 'football' | 'badminton' | 'tennis' | 'other';

export type EntertainmentSectionId =
  | 'facts'
  | 'jokes'
  | 'stories'
  | 'quiz'
  | 'movies'
  | 'sports'
  | 'festivals';

export interface PersonalBirthdayReminder {
  id: string;
  personName: string;
  relationship: string;
  monthDay: string; // MM-DD
  note?: string;
}

export interface HubPersonalizationPreferences {
  favoriteGameCategories: GameCategoryId[];
  disabledGameIds: GameId[];
  disabledMusicCategories: (MusicCategoryId | 'favourites' | 'relaxation')[];
  favoriteNewsCategories: NewsCategoryId[];
  disabledNewsCategories: NewsCategoryId[];
  favoriteSports: SportCategoryId[];
  favoriteEntertainmentSections: EntertainmentSectionId[];
  disabledEntertainmentSections: EntertainmentSectionId[];
  birthdays: PersonalBirthdayReminder[];
}

export * from './profile';
export * from './emergency';

