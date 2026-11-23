import type {
  CommunicationPassport,
  LifeHubState,
  MedicalInformation,
} from '../../types';
import {
  DEFAULT_BELONGINGS,
  DEFAULT_DAILY_ROUTINES,
  DEFAULT_PERSONAL_CHOICES,
  DEFAULT_SHOPPING_CATALOG,
} from '../communication/personal-autonomy';
import { getActivePatientId, getPatientScopedStorageKey } from './patient-accounts';

const LIFE_HUB_KEY = 'nayanSathi.lifeHub.v1';

export const DEFAULT_MEDICAL_INFO: MedicalInformation = {
  allergies: '',
  existingConditions: '',
  medications: '',
  careInstructions: '',
  preferredDoctor: '',
  doctorContact: '',
  preferredHospital: '',
  emergencyCaregiverInfo: '',
};

export const DEFAULT_COMMUNICATION_PASSPORT: CommunicationPassport = {
  howICommunicate: 'I communicate using eye movements (gaze dwell) and assistive technology.',
  preferredLanguage: 'English',
  howISayYesNo: 'I select Yes / No buttons with my eyes or confirm using steady gaze.',
  responseTimeNeeded: 'Please allow 5–10 seconds for me to compose or select a response.',
  communicationPreferences: 'Speak directly to me in calm, clear sentences. Ask one question at a time.',
  whatMakesMeComfortable: 'Good front lighting, reduced glare, and comfortable seating posture.',
  whatHelpsMeCommunicate: 'Keeping my device screen steady and waiting patiently while I look at options.',
  caregiverInstructions: 'Do not move my communication screen without asking first.',
  updatedAt: new Date(0).toISOString(),
};

export function createDefaultLifeHubState(): LifeHubState {
  return {
    choices: DEFAULT_PERSONAL_CHOICES,
    confirmedChoices: [],
    customComfortRequests: [],
    belongings: DEFAULT_BELONGINGS,
    helpRequests: [],
    medicineReminders: [],
    medicineAcks: [],
    medicalInfo: { ...DEFAULT_MEDICAL_INFO },
    discomfortEntries: [],
    wellbeingJournal: [],
    smartHomeConfig: {
      enabled: false,
      endpointUrl: '',
      entityMap: {},
    },
    roomControlLogs: [],
    routines: DEFAULT_DAILY_ROUTINES,
    shoppingCatalog: DEFAULT_SHOPPING_CATALOG,
    shoppingList: [],
    restaurantSelectedDishes: [],
    restaurantPreferences: [],
    appointments: [],
    passport: { ...DEFAULT_COMMUNICATION_PASSPORT },
    importantPeople: [],
    interests: [],
    favourites: [],
    caregivers: [],
    handoverNotes: [],
  };
}

export function loadLifeHubState(patientId = getActivePatientId()): LifeHubState {
  const defaults = createDefaultLifeHubState();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(getPatientScopedStorageKey(LIFE_HUB_KEY, patientId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<LifeHubState>;
    if (!parsed || typeof parsed !== 'object') return defaults;

    return {
      choices: Array.isArray(parsed.choices) && parsed.choices.length > 0 ? parsed.choices : defaults.choices,
      confirmedChoices: Array.isArray(parsed.confirmedChoices) ? parsed.confirmedChoices : [],
      customComfortRequests: Array.isArray(parsed.customComfortRequests) ? parsed.customComfortRequests : [],
      belongings: Array.isArray(parsed.belongings) && parsed.belongings.length > 0 ? parsed.belongings : defaults.belongings,
      helpRequests: Array.isArray(parsed.helpRequests) ? parsed.helpRequests : [],
      medicineReminders: Array.isArray(parsed.medicineReminders) ? parsed.medicineReminders : [],
      medicineAcks: Array.isArray(parsed.medicineAcks) ? parsed.medicineAcks : [],
      medicalInfo: { ...defaults.medicalInfo, ...(parsed.medicalInfo || {}) },
      discomfortEntries: Array.isArray(parsed.discomfortEntries) ? parsed.discomfortEntries : [],
      wellbeingJournal: Array.isArray(parsed.wellbeingJournal) ? parsed.wellbeingJournal : [],
      smartHomeConfig: {
        ...defaults.smartHomeConfig,
        ...(parsed.smartHomeConfig || {}),
        entityMap: {
          ...(defaults.smartHomeConfig.entityMap || {}),
          ...(parsed.smartHomeConfig?.entityMap || {}),
        },
      },
      roomControlLogs: Array.isArray(parsed.roomControlLogs) ? parsed.roomControlLogs : [],
      routines: Array.isArray(parsed.routines) && parsed.routines.length > 0 ? parsed.routines : defaults.routines,
      shoppingCatalog:
        Array.isArray(parsed.shoppingCatalog) && parsed.shoppingCatalog.length > 0
          ? parsed.shoppingCatalog
          : defaults.shoppingCatalog,
      shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [],
      restaurantSelectedDishes: Array.isArray(parsed.restaurantSelectedDishes)
        ? parsed.restaurantSelectedDishes
        : [],
      restaurantPreferences: Array.isArray(parsed.restaurantPreferences)
        ? parsed.restaurantPreferences
        : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      passport: { ...defaults.passport, ...(parsed.passport || {}) },
      importantPeople: Array.isArray(parsed.importantPeople) ? parsed.importantPeople : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites : [],
      caregivers: Array.isArray(parsed.caregivers) ? parsed.caregivers : [],
      handoverNotes: Array.isArray(parsed.handoverNotes) ? parsed.handoverNotes : [],
    };
  } catch {
    return defaults;
  }
}

export function saveLifeHubState(
  state: LifeHubState,
  patientId = getActivePatientId()
): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(
      getPatientScopedStorageKey(LIFE_HUB_KEY, patientId),
      JSON.stringify(state)
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to save Life Hub data to browser storage.',
    };
  }
}

export function eraseLifeHubState(patientId = getActivePatientId()): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getPatientScopedStorageKey(LIFE_HUB_KEY, patientId));
}
