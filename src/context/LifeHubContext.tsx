import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAppState } from './AppStateContext';
import { useEmergencyContacts } from './EmergencyContactContext';
import {
  buildPersonalIntroductionText,
  isPermissionAllowedForCaregiver,
} from '../features/communication/personal-autonomy';
import {
  loadAllImagesForPatient,
  processImageFileToDataUrl,
  savePatientImage,
} from '../features/storage/indexeddb-media';
import {
  loadLifeHubState,
  saveLifeHubState,
} from '../features/storage/life-hub-storage';
import { getActivePatientId } from '../features/storage/patient-accounts';
import type {
  AppointmentItem,
  AppointmentResponseStatus,
  BelongingItem,
  BodyDiscomfortEntry,
  CaregiverHandoverNote,
  CaregiverPermissionKey,
  CaregiverRelationship,
  ChoiceCategoryId,
  CommunicationPassport,
  DailyRoutineItem,
  FavouriteItem,
  HelpRequest,
  HelpRequestCategory,
  HelpRequestStatus,
  ImportantPerson,
  LifeHubState,
  MedicalInformation,
  MedicineAckAction,
  MedicineReminder,
  PersonalChoiceOption,
  RoomControlLogEntry,
  RoomDeviceType,
  RoutineStepStatus,
  ShoppingCatalogItem,
  SmartHomeIntegrationConfig,
  WellbeingEntry,
} from '../types';

export interface ActiveCaregiverActor {
  type: 'patient' | 'caregiver';
  caregiverId?: string;
}

interface LifeHubContextValue {
  state: LifeHubState;
  photosMap: Record<string, string>;
  hasConnectedCaregiver: boolean;
  dueMedicines: MedicineReminder[];
  activeActor: ActiveCaregiverActor;
  activeCaregiverRecord: CaregiverRelationship | null;
  setActiveActor: (actor: ActiveCaregiverActor) => void;
  hasPermission: (perm: CaregiverPermissionKey) => boolean;
  uploadPhotoAsset: (assetPrefix: string, file: File) => Promise<string>;
  refreshPhotos: () => Promise<void>;
  // Daily Assistance: Choices, Comfort, Belongings, Help Tracker
  addChoiceOption: (
    category: ChoiceCategoryId,
    labelEn: string,
    labelHi: string,
    photoAssetId?: string
  ) => void;
  deleteChoiceOption: (id: string) => void;
  confirmChoiceSelection: (option: PersonalChoiceOption, createRequest: boolean) => HelpRequest | null;
  sendComfortRequest: (phraseText: string, addAsCustom?: boolean) => HelpRequest;
  addBelongingItem: (labelEn: string, labelHi: string, photoAssetId?: string) => void;
  requestBelonging: (item: BelongingItem) => HelpRequest;
  createHelpRequest: (category: HelpRequestCategory, title: string, details?: string) => HelpRequest;
  updateHelpRequestStatus: (
    requestId: string,
    status: HelpRequestStatus,
    caregiverNote?: string
  ) => { ok: boolean; error?: string };
  // Health & Care
  addMedicineReminder: (
    input: Omit<MedicineReminder, 'id' | 'createdAt' | 'active'>
  ) => { ok: boolean; error?: string };
  toggleMedicineReminderActive: (id: string) => void;
  deleteMedicineReminder: (id: string) => void;
  acknowledgeMedicine: (
    reminderId: string,
    action: MedicineAckAction,
    note?: string
  ) => void;
  addDiscomfortEntry: (entry: Omit<BodyDiscomfortEntry, 'id' | 'createdAt'>) => void;
  deleteDiscomfortEntry: (id: string) => void;
  updateMedicalInfo: (
    nextInfo: MedicalInformation
  ) => { ok: boolean; error?: string };
  addWellbeingEntry: (entry: Omit<WellbeingEntry, 'id' | 'createdAt'>) => void;
  deleteWellbeingEntry: (id: string) => void;
  // Environment: Control My Room
  updateSmartHomeConfig: (config: SmartHomeIntegrationConfig) => void;
  triggerRoomControl: (params: {
    deviceType: RoomDeviceType;
    deviceLabel: string;
    command: string;
    mode: 'smart_device' | 'caregiver';
  }) => Promise<{ ok: boolean; message: string }>;
  // Activities: Routines, Shopping, Restaurant, Appointments
  updateRoutineStatus: (id: string, status: RoutineStepStatus) => void;
  addRoutineItem: (item: Omit<DailyRoutineItem, 'id' | 'status'>) => { ok: boolean; error?: string };
  deleteRoutineItem: (id: string) => void;
  addShoppingCatalogItem: (
    nameEn: string,
    nameHi: string,
    category: string,
    photoAssetId?: string
  ) => void;
  adjustShoppingListQuantity: (item: ShoppingCatalogItem, delta: number, note?: string) => void;
  clearShoppingList: () => void;
  toggleRestaurantDish: (dishId: string) => void;
  toggleRestaurantPreference: (pref: string) => void;
  clearRestaurantSelections: () => void;
  addAppointment: (
    input: Omit<AppointmentItem, 'id' | 'patientStatus' | 'updatedAt'>
  ) => { ok: boolean; error?: string };
  respondToAppointment: (id: string, status: AppointmentResponseStatus) => void;
  deleteAppointment: (id: string) => void;
  // Personal Support & Caregiver Ecosystem
  updatePassport: (next: CommunicationPassport) => void;
  addImportantPerson: (person: Omit<ImportantPerson, 'id' | 'createdAt'>) => void;
  deleteImportantPerson: (id: string) => void;
  toggleInterest: (interest: string) => void;
  addFavouriteItem: (item: Omit<FavouriteItem, 'id'>) => void;
  deleteFavouriteItem: (id: string) => void;
  addCaregiverRelationship: (
    cg: Omit<CaregiverRelationship, 'id' | 'grantedAt'>
  ) => void;
  updateCaregiverRelationship: (
    id: string,
    updater: (prev: CaregiverRelationship) => CaregiverRelationship
  ) => void;
  removeCaregiverRelationship: (id: string) => void;
  addHandoverNote: (
    note: Omit<CaregiverHandoverNote, 'id' | 'authorId' | 'authorName' | 'authorRole' | 'createdAt'>
  ) => { ok: boolean; error?: string };
  exportPatientDataJson: () => string;
  getPersonalIntroText: () => string;
}

const LifeHubContext = createContext<LifeHubContextValue | null>(null);

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isReminderCurrentlyDue(reminder: MedicineReminder, now = new Date()): boolean {
  if (!reminder.active || reminder.frequency === 'as_needed') return false;
  const today = todayIsoDate();
  if (reminder.startDate && today < reminder.startDate) return false;
  if (reminder.endDate && today > reminder.endDate) return false;
  if (reminder.lastAcknowledgedDate === today) return false;

  if (reminder.snoozedUntilIso) {
    const snoozeMs = Date.parse(reminder.snoozedUntilIso);
    if (!Number.isNaN(snoozeMs) && now.getTime() < snoozeMs) {
      return false;
    }
  }

  const [hh, mm] = (reminder.reminderTime || '').split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = hh * 60 + mm;

  if (reminder.frequency === 'weekly') {
    const startDay = reminder.startDate ? new Date(`${reminder.startDate}T00:00:00`).getDay() : now.getDay();
    if (now.getDay() !== startDay) return false;
  }

  return currentMinutes >= targetMinutes;
}

export const LifeHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activePatientId,
    settings,
    profile,
    calibration,
    categories,
    phrases,
    history,
  } = useAppState();
  const { contacts } = useEmergencyContacts();

  const [state, setState] = useState<LifeHubState>(() => loadLifeHubState(activePatientId));
  const [photosMap, setPhotosMap] = useState<Record<string, string>>({});
  const [activeActor, setActiveActor] = useState<ActiveCaregiverActor>({ type: 'patient' });
  const [clockTick, setClockTick] = useState<number>(() => Date.now());

  // Reload LifeHub state & IndexedDB images whenever active patient switches
  useEffect(() => {
    const pid = activePatientId || getActivePatientId();
    setState(loadLifeHubState(pid));
    setActiveActor({ type: 'patient' });
    let cancelled = false;
    loadAllImagesForPatient(pid).then((imgs) => {
      if (!cancelled) setPhotosMap(imgs);
    });
    return () => {
      cancelled = true;
    };
  }, [activePatientId]);

  // Minute-level check for medicine reminders due status
  useEffect(() => {
    const id = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const updateAndPersist = useCallback(
    (updater: (prev: LifeHubState) => LifeHubState) => {
      setState((prev) => {
        const next = updater(prev);
        saveLifeHubState(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const activeCaregiverRecord = useMemo(() => {
    if (activeActor.type !== 'caregiver' || !activeActor.caregiverId) return null;
    return state.caregivers.find((c) => c.id === activeActor.caregiverId) ?? null;
  }, [activeActor, state.caregivers]);

  const hasConnectedCaregiver = useMemo(() => {
    const activeLinked = state.caregivers.some((c) => c.consentGranted);
    return activeLinked || contacts.length > 0 || Boolean(profile.caregiverName.trim());
  }, [contacts.length, profile.caregiverName, state.caregivers]);

  const hasPermission = useCallback(
    (perm: CaregiverPermissionKey): boolean => {
      return isPermissionAllowedForCaregiver(
        activeCaregiverRecord,
        activeActor.type === 'patient',
        perm
      );
    },
    [activeActor.type, activeCaregiverRecord]
  );

  const dueMedicines = useMemo(() => {
    const now = new Date(clockTick);
    return state.medicineReminders.filter((m) => isReminderCurrentlyDue(m, now));
  }, [clockTick, state.medicineReminders]);

  const uploadPhotoAsset = useCallback(
    async (assetPrefix: string, file: File): Promise<string> => {
      const dataUrl = await processImageFileToDataUrl(file);
      const assetId = `${assetPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await savePatientImage(activePatientId, assetId, dataUrl);
      setPhotosMap((prev) => ({ ...prev, [assetId]: dataUrl }));
      return assetId;
    },
    [activePatientId]
  );

  const refreshPhotos = useCallback(async () => {
    const pid = activePatientId || getActivePatientId();
    const imgs = await loadAllImagesForPatient(pid);
    setPhotosMap(imgs);
  }, [activePatientId]);

  const createHelpRequest = useCallback(
    (category: HelpRequestCategory, title: string, details?: string): HelpRequest => {
      const nowIso = new Date().toISOString();
      const req: HelpRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        patientId: activePatientId,
        category,
        title: title.trim(),
        details: details?.trim() || undefined,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        caregiverConnected: hasConnectedCaregiver,
      };
      updateAndPersist((prev) => ({
        ...prev,
        helpRequests: [req, ...prev.helpRequests].slice(0, 150),
      }));
      return req;
    },
    [activePatientId, hasConnectedCaregiver, updateAndPersist]
  );

  const updateHelpRequestStatus = useCallback(
    (
      requestId: string,
      status: HelpRequestStatus,
      caregiverNote?: string
    ): { ok: boolean; error?: string } => {
      const isPatientResolveOrCancel = status === 'cancelled' || status === 'resolved';
      if (!isPatientResolveOrCancel && !hasPermission('canManageRequests')) {
        return {
          ok: false,
          error: 'Current caregiver account does not have permission to update help requests.',
        };
      }
      const actorName =
        activeActor.type === 'patient'
          ? profile.preferredName || profile.name || 'User'
          : activeCaregiverRecord?.name || 'Caregiver';

      updateAndPersist((prev) => ({
        ...prev,
        helpRequests: prev.helpRequests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status,
                updatedAt: new Date().toISOString(),
                acknowledgedBy:
                  status === 'accepted' || status === 'in_progress' || status === 'completed'
                    ? actorName
                    : r.acknowledgedBy,
                caregiverNote: caregiverNote !== undefined ? caregiverNote : r.caregiverNote,
              }
            : r
        ),
        roomControlLogs: prev.roomControlLogs.map((log) =>
          log.helpRequestId === requestId &&
          (status === 'accepted' || status === 'in_progress' || status === 'completed')
            ? { ...log, status }
            : log
        ),
      }));
      return { ok: true };
    },
    [activeActor.type, activeCaregiverRecord?.name, hasPermission, profile.name, profile.preferredName, updateAndPersist]
  );

  const addChoiceOption = useCallback(
    (
      category: ChoiceCategoryId,
      labelEn: string,
      labelHi: string,
      photoAssetId?: string
    ) => {
      if (!labelEn.trim()) return;
      const opt: PersonalChoiceOption = {
        id: `ch_${category}_${Date.now()}`,
        category,
        labelEn: labelEn.trim(),
        labelHi: labelHi.trim() || labelEn.trim(),
        iconKey: 'sparkles',
        photoAssetId,
        isCustom: true,
      };
      updateAndPersist((prev) => ({ ...prev, choices: [opt, ...prev.choices] }));
    },
    [updateAndPersist]
  );

  const deleteChoiceOption = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        choices: prev.choices.filter((c) => c.id !== id || !c.isCustom),
      }));
    },
    [updateAndPersist]
  );

  const confirmChoiceSelection = useCallback(
    (option: PersonalChoiceOption, createReq: boolean): HelpRequest | null => {
      const label = settings.communication.language === 'hi' ? option.labelHi : option.labelEn;
      let createdReq: HelpRequest | null = null;
      if (createReq) {
        createdReq = createHelpRequest('choice', `Choice: ${label}`, `Category: ${option.category}`);
      }
      updateAndPersist((prev) => ({
        ...prev,
        confirmedChoices: [
          {
            id: `conf_${Date.now()}`,
            category: option.category,
            optionId: option.id,
            label,
            confirmedAt: new Date().toISOString(),
            requestId: createdReq?.id,
          },
          ...prev.confirmedChoices,
        ].slice(0, 60),
      }));
      return createdReq;
    },
    [createHelpRequest, settings.communication.language, updateAndPersist]
  );

  const sendComfortRequest = useCallback(
    (phraseText: string, addAsCustom = false): HelpRequest => {
      const clean = phraseText.trim();
      if (addAsCustom && clean) {
        updateAndPersist((prev) => ({
          ...prev,
          customComfortRequests: prev.customComfortRequests.includes(clean)
            ? prev.customComfortRequests
            : [clean, ...prev.customComfortRequests],
        }));
      }
      return createHelpRequest('comfort', clean);
    },
    [createHelpRequest, updateAndPersist]
  );

  const addBelongingItem = useCallback(
    (labelEn: string, labelHi: string, photoAssetId?: string) => {
      if (!labelEn.trim()) return;
      const item: BelongingItem = {
        id: `bel_${Date.now()}`,
        labelEn: labelEn.trim(),
        labelHi: labelHi.trim() || labelEn.trim(),
        iconKey: 'package',
        photoAssetId,
        isCustom: true,
      };
      updateAndPersist((prev) => ({ ...prev, belongings: [item, ...prev.belongings] }));
    },
    [updateAndPersist]
  );

  const requestBelonging = useCallback(
    (item: BelongingItem): HelpRequest => {
      const label = settings.communication.language === 'hi' ? item.labelHi : item.labelEn;
      return createHelpRequest('belonging', `Please bring: ${label}`);
    },
    [createHelpRequest, settings.communication.language]
  );

  const addMedicineReminder = useCallback(
    (input: Omit<MedicineReminder, 'id' | 'createdAt' | 'active'>) => {
      if (!hasPermission('canManageRoutines')) {
        return { ok: false, error: 'Current caregiver lacks routine/care schedule permission.' };
      }
      if (!input.name.trim()) {
        return { ok: false, error: 'Medicine name is required.' };
      }
      const reminder: MedicineReminder = {
        ...input,
        name: input.name.trim(),
        description: input.description.trim(),
        id: `med_${Date.now()}`,
        active: true,
        createdAt: new Date().toISOString(),
      };
      updateAndPersist((prev) => ({
        ...prev,
        medicineReminders: [reminder, ...prev.medicineReminders],
      }));
      return { ok: true };
    },
    [hasPermission, updateAndPersist]
  );

  const toggleMedicineReminderActive = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        medicineReminders: prev.medicineReminders.map((m) =>
          m.id === id ? { ...m, active: !m.active } : m
        ),
      }));
    },
    [updateAndPersist]
  );

  const deleteMedicineReminder = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        medicineReminders: prev.medicineReminders.filter((m) => m.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const acknowledgeMedicine = useCallback(
    (reminderId: string, action: MedicineAckAction, note?: string) => {
      const target = state.medicineReminders.find((m) => m.id === reminderId);
      if (!target) return;

      const today = todayIsoDate();
      const snoozeIso =
        action === 'snoozed' ? new Date(Date.now() + 15 * 60_000).toISOString() : undefined;

      if (action === 'help' || action === 'call_caregiver') {
        createHelpRequest(
          'medicine',
          action === 'call_caregiver'
            ? `Caregiver requested for medicine: ${target.name}`
            : `Need help taking medicine: ${target.name}`,
          target.instructions || target.description
        );
      }

      updateAndPersist((prev) => ({
        ...prev,
        medicineReminders: prev.medicineReminders.map((m) => {
          if (m.id !== reminderId) return m;
          if (action === 'taken') {
            return { ...m, lastAcknowledgedDate: today, snoozedUntilIso: undefined };
          }
          if (action === 'snoozed') {
            return { ...m, snoozedUntilIso: snoozeIso };
          }
          return m;
        }),
        medicineAcks: [
          {
            id: `mack_${Date.now()}`,
            reminderId,
            medicineName: target.name,
            action,
            timestamp: new Date().toISOString(),
            note,
          },
          ...prev.medicineAcks,
        ].slice(0, 150),
      }));
    },
    [createHelpRequest, state.medicineReminders, updateAndPersist]
  );

  const addDiscomfortEntry = useCallback(
    (entry: Omit<BodyDiscomfortEntry, 'id' | 'createdAt'>) => {
      updateAndPersist((prev) => ({
        ...prev,
        discomfortEntries: [
          {
            ...entry,
            id: `disc_${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.discomfortEntries,
        ].slice(0, 80),
      }));
    },
    [updateAndPersist]
  );

  const deleteDiscomfortEntry = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        discomfortEntries: prev.discomfortEntries.filter((e) => e.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const updateMedicalInfo = useCallback(
    (nextInfo: MedicalInformation) => {
      if (!hasPermission('canEditMedical')) {
        return {
          ok: false,
          error: 'Current caregiver account does not have medical edit permission.',
        };
      }
      updateAndPersist((prev) => ({
        ...prev,
        medicalInfo: {
          ...nextInfo,
          updatedAt: new Date().toISOString(),
        },
      }));
      return { ok: true };
    },
    [hasPermission, updateAndPersist]
  );

  const addWellbeingEntry = useCallback(
    (entry: Omit<WellbeingEntry, 'id' | 'createdAt'>) => {
      updateAndPersist((prev) => ({
        ...prev,
        wellbeingJournal: [
          {
            ...entry,
            id: `wb_${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.wellbeingJournal,
        ].slice(0, 180),
      }));
    },
    [updateAndPersist]
  );

  const deleteWellbeingEntry = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        wellbeingJournal: prev.wellbeingJournal.filter((w) => w.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const updateSmartHomeConfig = useCallback(
    (config: SmartHomeIntegrationConfig) => {
      updateAndPersist((prev) => ({ ...prev, smartHomeConfig: config }));
    },
    [updateAndPersist]
  );

  const triggerRoomControl = useCallback(
    async (params: {
      deviceType: RoomDeviceType;
      deviceLabel: string;
      command: string;
      mode: 'smart_device' | 'caregiver';
    }): Promise<{ ok: boolean; message: string }> => {
      const nowIso = new Date().toISOString();

      if (params.mode === 'caregiver') {
        const req = createHelpRequest(
          'room',
          `Room Control: ${params.deviceLabel} — ${params.command}`,
          'Requested via Control My Room (Caregiver Assistance mode).'
        );
        const msg = hasConnectedCaregiver
          ? `Sent room request "${params.deviceLabel}: ${params.command}" to Caregiver Tracker (Pending acknowledgment).`
          : `Saved local request "${params.deviceLabel}: ${params.command}". No caregiver connected yet — call or alert caregiver directly.`;

        const entry: RoomControlLogEntry = {
          id: `room_${Date.now()}`,
          deviceType: params.deviceType,
          deviceLabel: params.deviceLabel,
          command: params.command,
          mode: 'caregiver',
          status: 'pending_caregiver',
          message: msg,
          helpRequestId: req.id,
          timestamp: nowIso,
        };
        updateAndPersist((prev) => ({
          ...prev,
          roomControlLogs: [entry, ...prev.roomControlLogs].slice(0, 60),
        }));
        return { ok: true, message: msg };
      }

      // Mode A: Real Smart Device API Confirmation via Express /api/smart-home/command
      const entityId = state.smartHomeConfig.entityMap?.[params.deviceType] || '';
      try {
        const res = await fetch('/api/smart-home/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointUrl: state.smartHomeConfig.endpointUrl,
            deviceType: params.deviceType,
            entityId,
            command: params.command,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          confirmed?: boolean;
          message?: string;
          error?: string;
        };

        const confirmed = res.ok && Boolean(data.confirmed);
        const message =
          data.message ||
          data.error ||
          (confirmed
            ? `${params.deviceLabel} ${params.command} confirmed by smart home bridge.`
            : 'Smart home device endpoint unreachable or not configured.');

        const entry: RoomControlLogEntry = {
          id: `room_${Date.now()}`,
          deviceType: params.deviceType,
          deviceLabel: params.deviceLabel,
          command: params.command,
          mode: 'smart_device',
          status: confirmed ? 'confirmed' : 'failed',
          message,
          timestamp: nowIso,
        };
        updateAndPersist((prev) => ({
          ...prev,
          roomControlLogs: [entry, ...prev.roomControlLogs].slice(0, 60),
        }));
        return { ok: confirmed, message };
      } catch (err) {
        const message =
          err instanceof Error
            ? `Smart home request failed: ${err.message}`
            : 'Smart home request failed.';
        const entry: RoomControlLogEntry = {
          id: `room_${Date.now()}`,
          deviceType: params.deviceType,
          deviceLabel: params.deviceLabel,
          command: params.command,
          mode: 'smart_device',
          status: 'failed',
          message,
          timestamp: nowIso,
        };
        updateAndPersist((prev) => ({
          ...prev,
          roomControlLogs: [entry, ...prev.roomControlLogs].slice(0, 60),
        }));
        return { ok: false, message };
      }
    },
    [createHelpRequest, hasConnectedCaregiver, state.smartHomeConfig, updateAndPersist]
  );

  const updateRoutineStatus = useCallback(
    (id: string, status: RoutineStepStatus) => {
      const item = state.routines.find((r) => r.id === id);
      if (item && status === 'help') {
        createHelpRequest('routine', `Routine assistance needed: ${item.titleEn}`);
      }
      updateAndPersist((prev) => ({
        ...prev,
        routines: prev.routines.map((r) =>
          r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
        ),
      }));
    },
    [createHelpRequest, state.routines, updateAndPersist]
  );

  const addRoutineItem = useCallback(
    (item: Omit<DailyRoutineItem, 'id' | 'status'>) => {
      if (!hasPermission('canManageRoutines')) {
        return { ok: false, error: 'Current caregiver lacks routine management permission.' };
      }
      if (!item.titleEn.trim()) {
        return { ok: false, error: 'Routine title is required.' };
      }
      updateAndPersist((prev) => ({
        ...prev,
        routines: [
          ...prev.routines,
          {
            ...item,
            id: `rt_${Date.now()}`,
            status: 'pending',
          },
        ],
      }));
      return { ok: true };
    },
    [hasPermission, updateAndPersist]
  );

  const deleteRoutineItem = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        routines: prev.routines.filter((r) => r.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const addShoppingCatalogItem = useCallback(
    (nameEn: string, nameHi: string, category: string, photoAssetId?: string) => {
      if (!nameEn.trim()) return;
      const item: ShoppingCatalogItem = {
        id: `shop_${Date.now()}`,
        nameEn: nameEn.trim(),
        nameHi: nameHi.trim() || nameEn.trim(),
        category: category.trim() || 'Custom',
        photoAssetId,
        isCustom: true,
      };
      updateAndPersist((prev) => ({
        ...prev,
        shoppingCatalog: [item, ...prev.shoppingCatalog],
      }));
    },
    [updateAndPersist]
  );

  const adjustShoppingListQuantity = useCallback(
    (item: ShoppingCatalogItem, delta: number, note?: string) => {
      const displayName = settings.communication.language === 'hi' ? item.nameHi : item.nameEn;
      updateAndPersist((prev) => {
        const existing = prev.shoppingList.find((e) => e.itemId === item.id);
        if (!existing) {
          if (delta <= 0) return prev;
          return {
            ...prev,
            shoppingList: [
              ...prev.shoppingList,
              { id: `slist_${Date.now()}`, itemId: item.id, name: displayName, quantity: delta, note },
            ],
          };
        }
        const nextQty = existing.quantity + delta;
        if (nextQty <= 0) {
          return {
            ...prev,
            shoppingList: prev.shoppingList.filter((e) => e.itemId !== item.id),
          };
        }
        return {
          ...prev,
          shoppingList: prev.shoppingList.map((e) =>
            e.itemId === item.id ? { ...e, quantity: nextQty, note: note ?? e.note } : e
          ),
        };
      });
    },
    [settings.communication.language, updateAndPersist]
  );

  const clearShoppingList = useCallback(() => {
    updateAndPersist((prev) => ({ ...prev, shoppingList: [] }));
  }, [updateAndPersist]);

  const toggleRestaurantDish = useCallback(
    (dishId: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        restaurantSelectedDishes: prev.restaurantSelectedDishes.includes(dishId)
          ? prev.restaurantSelectedDishes.filter((d) => d !== dishId)
          : [...prev.restaurantSelectedDishes, dishId],
      }));
    },
    [updateAndPersist]
  );

  const toggleRestaurantPreference = useCallback(
    (pref: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        restaurantPreferences: prev.restaurantPreferences.includes(pref)
          ? prev.restaurantPreferences.filter((p) => p !== pref)
          : [...prev.restaurantPreferences, pref],
      }));
    },
    [updateAndPersist]
  );

  const clearRestaurantSelections = useCallback(() => {
    updateAndPersist((prev) => ({
      ...prev,
      restaurantSelectedDishes: [],
      restaurantPreferences: [],
    }));
  }, [updateAndPersist]);

  const addAppointment = useCallback(
    (input: Omit<AppointmentItem, 'id' | 'patientStatus' | 'updatedAt'>) => {
      if (!hasPermission('canManageRoutines')) {
        return { ok: false, error: 'Current caregiver lacks appointment scheduling permission.' };
      }
      if (!input.title.trim() || !input.date) {
        return { ok: false, error: 'Appointment title and date are required.' };
      }
      const item: AppointmentItem = {
        ...input,
        id: `appt_${Date.now()}`,
        patientStatus: 'scheduled',
        updatedAt: new Date().toISOString(),
      };
      updateAndPersist((prev) => ({
        ...prev,
        appointments: [item, ...prev.appointments],
      }));
      return { ok: true };
    },
    [hasPermission, updateAndPersist]
  );

  const respondToAppointment = useCallback(
    (id: string, status: AppointmentResponseStatus) => {
      const target = state.appointments.find((a) => a.id === id);
      if (target && status !== 'scheduled') {
        const summaryMap: Record<AppointmentResponseStatus, string> = {
          scheduled: 'Scheduled',
          ready: `Appointment "${target.title}": I am ready`,
          need_more_time: `Appointment "${target.title}": I need more time`,
          need_help_ready: `Appointment "${target.title}": Need help getting ready`,
          contact_caregiver: `Appointment "${target.title}": Contact my caregiver`,
          reschedule_requested: `Appointment "${target.title}": Reschedule requested`,
        };
        createHelpRequest('appointment', summaryMap[status]);
      }
      updateAndPersist((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) =>
          a.id === id ? { ...a, patientStatus: status, updatedAt: new Date().toISOString() } : a
        ),
      }));
    },
    [createHelpRequest, state.appointments, updateAndPersist]
  );

  const deleteAppointment = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        appointments: prev.appointments.filter((a) => a.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const updatePassport = useCallback(
    (next: CommunicationPassport) => {
      updateAndPersist((prev) => ({
        ...prev,
        passport: { ...next, updatedAt: new Date().toISOString() },
      }));
    },
    [updateAndPersist]
  );

  const addImportantPerson = useCallback(
    (person: Omit<ImportantPerson, 'id' | 'createdAt'>) => {
      if (!person.name.trim()) return;
      updateAndPersist((prev) => ({
        ...prev,
        importantPeople: [
          ...prev.importantPeople,
          { ...person, id: `person_${Date.now()}`, createdAt: new Date().toISOString() },
        ],
      }));
    },
    [updateAndPersist]
  );

  const deleteImportantPerson = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        importantPeople: prev.importantPeople.filter((p) => p.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const toggleInterest = useCallback(
    (interest: string) => {
      const clean = interest.trim();
      if (!clean) return;
      updateAndPersist((prev) => ({
        ...prev,
        interests: prev.interests.includes(clean)
          ? prev.interests.filter((i) => i !== clean)
          : [...prev.interests, clean],
      }));
    },
    [updateAndPersist]
  );

  const addFavouriteItem = useCallback(
    (item: Omit<FavouriteItem, 'id'>) => {
      if (!item.label.trim()) return;
      updateAndPersist((prev) => ({
        ...prev,
        favourites: [...prev.favourites, { ...item, id: `fav_${Date.now()}` }],
      }));
    },
    [updateAndPersist]
  );

  const deleteFavouriteItem = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        favourites: prev.favourites.filter((f) => f.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const addCaregiverRelationship = useCallback(
    (cg: Omit<CaregiverRelationship, 'id' | 'grantedAt'>) => {
      if (!cg.name.trim()) return;
      updateAndPersist((prev) => ({
        ...prev,
        caregivers: [
          ...prev.caregivers,
          {
            ...cg,
            id: `cg_${Date.now()}`,
            grantedAt: cg.consentGranted ? new Date().toISOString() : undefined,
          },
        ],
      }));
    },
    [updateAndPersist]
  );

  const updateCaregiverRelationship = useCallback(
    (id: string, updater: (prev: CaregiverRelationship) => CaregiverRelationship) => {
      updateAndPersist((prev) => ({
        ...prev,
        caregivers: prev.caregivers.map((c) => (c.id === id ? updater(c) : c)),
      }));
    },
    [updateAndPersist]
  );

  const removeCaregiverRelationship = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        caregivers: prev.caregivers.filter((c) => c.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const addHandoverNote = useCallback(
    (
      note: Omit<
        CaregiverHandoverNote,
        'id' | 'authorId' | 'authorName' | 'authorRole' | 'createdAt'
      >
    ) => {
      if (!hasPermission('canWriteHandover')) {
        return {
          ok: false,
          error: 'Current caregiver account does not have permission to write handover notes.',
        };
      }
      const entry: CaregiverHandoverNote = {
        ...note,
        id: `ho_${Date.now()}`,
        authorId: activeActor.type === 'patient' ? activePatientId : activeCaregiverRecord?.id || 'cg',
        authorName:
          activeActor.type === 'patient'
            ? profile.preferredName || profile.name || 'User'
            : activeCaregiverRecord?.name || profile.caregiverName || 'Caregiver',
        authorRole:
          activeActor.type === 'patient' ? 'primary' : activeCaregiverRecord?.role || 'primary',
        createdAt: new Date().toISOString(),
      };
      updateAndPersist((prev) => ({
        ...prev,
        handoverNotes: [entry, ...prev.handoverNotes].slice(0, 120),
      }));
      return { ok: true };
    },
    [
      activeActor.type,
      activeCaregiverRecord?.id,
      activeCaregiverRecord?.name,
      activeCaregiverRecord?.role,
      activePatientId,
      hasPermission,
      profile.caregiverName,
      profile.name,
      profile.preferredName,
      updateAndPersist,
    ]
  );

  const getPersonalIntroText = useCallback(() => {
    return buildPersonalIntroductionText(
      profile.preferredName || profile.name,
      profile.personalIntroduction
    );
  }, [profile.name, profile.personalIntroduction, profile.preferredName]);

  const exportPatientDataJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      patientId: activePatientId,
      profile,
      settings,
      calibrationSummary: calibration
        ? {
            qualityTier: calibration.qualityTier,
            totalSamplesCollected: calibration.totalSamplesCollected,
            updatedAt: calibration.updatedAt,
          }
        : null,
      categories,
      customPhrases: phrases.filter((p) => p.isCustom),
      emergencyContacts: contacts,
      history: settings.privacy.historyConsentEnabled ? history : [],
      lifeHub: state,
    };
    return JSON.stringify(payload, null, 2);
  }, [
    activePatientId,
    calibration,
    categories,
    contacts,
    history,
    phrases,
    profile,
    settings,
    state,
  ]);

  return (
    <LifeHubContext.Provider
      value={{
        state,
        photosMap,
        hasConnectedCaregiver,
        dueMedicines,
        activeActor,
        activeCaregiverRecord,
        setActiveActor,
        hasPermission,
        uploadPhotoAsset,
        refreshPhotos,
        addChoiceOption,
        deleteChoiceOption,
        confirmChoiceSelection,
        sendComfortRequest,
        addBelongingItem,
        requestBelonging,
        createHelpRequest,
        updateHelpRequestStatus,
        addMedicineReminder,
        toggleMedicineReminderActive,
        deleteMedicineReminder,
        acknowledgeMedicine,
        addDiscomfortEntry,
        deleteDiscomfortEntry,
        updateMedicalInfo,
        addWellbeingEntry,
        deleteWellbeingEntry,
        updateSmartHomeConfig,
        triggerRoomControl,
        updateRoutineStatus,
        addRoutineItem,
        deleteRoutineItem,
        addShoppingCatalogItem,
        adjustShoppingListQuantity,
        clearShoppingList,
        toggleRestaurantDish,
        toggleRestaurantPreference,
        clearRestaurantSelections,
        addAppointment,
        respondToAppointment,
        deleteAppointment,
        updatePassport,
        addImportantPerson,
        deleteImportantPerson,
        toggleInterest,
        addFavouriteItem,
        deleteFavouriteItem,
        addCaregiverRelationship,
        updateCaregiverRelationship,
        removeCaregiverRelationship,
        addHandoverNote,
        exportPatientDataJson,
        getPersonalIntroText,
      }}
    >
      {children}
    </LifeHubContext.Provider>
  );
};

export function useLifeHub(): LifeHubContextValue {
  const ctx = useContext(LifeHubContext);
  if (!ctx) {
    throw new Error('useLifeHub must be used within LifeHubProvider');
  }
  return ctx;
}
