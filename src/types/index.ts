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
  email: string;
  isPrimary: boolean;
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
  cursorSize: number; // 24..64
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
  speechRate: number; // 0.6..1.5
  preferredVoiceEn: string;
  preferredVoiceHi: string;
  activeContext: CommunicationContextId;
}

export interface PrivacySettings {
  historyConsentEnabled: boolean;
}

export interface PatientProfile {
  name: string;
  preferredName: string;
  caregiverName: string;
  notes: string;
  onboardingCompleted: boolean;
}

export interface AppSettings {
  eyeTracking: EyeTrackingSettings;
  interface: InterfaceSettings;
  communication: CommunicationSettings;
  privacy: PrivacySettings;
}
