import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildPersonalIntroductionText,
  calculateAgeFromDob,
  isPermissionAllowedForCaregiver,
} from '../communication/personal-autonomy';
import {
  addEmergencyContactService,
  loadEmergencyContactsService,
} from '../contacts/emergency-contact-service';
import {
  createDefaultLifeHubState,
  eraseLifeHubState,
  loadLifeHubState,
  saveLifeHubState,
} from '../storage/life-hub-storage';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  loadPatientProfile,
  savePatientProfile,
} from '../storage/local-storage';
import {
  createPatientAccount,
  DEFAULT_LOCAL_PATIENT_ID,
  getActivePatientId,
  listPatientAccounts,
  removePatientAccountFromDirectory,
  setActivePatientId,
} from '../storage/patient-accounts';
import type { CaregiverRelationship } from '../../types';

function installMockWindowStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      dispatchEvent: () => true,
    },
    configurable: true,
  });
  return store;
}

describe('Life Hub, Profile Identity, RBAC & Multi-User Isolation', () => {
  beforeEach(() => {
    installMockWindowStorage();
  });

  it('defaults to non-personal neutral profile and privacy-first consent flags', () => {
    expect(DEFAULT_PROFILE.name).toBe('Guest User');
    expect(DEFAULT_PROFILE.preferredName).toBe('Friend');
    expect(DEFAULT_SETTINGS.privacy.historyConsentEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.privacy.medicalEmergencyCardConsent).toBe(false);
    expect(DEFAULT_SETTINGS.privacy.shareWellbeingWithCaregivers).toBe(false);
    expect(DEFAULT_SETTINGS.privacy.shareHandoverWithCaregivers).toBe(false);
    expect(DEFAULT_SETTINGS.privacy.hidePrivateIdentityFields).toBe(true);
  });

  it('calculates age accurately from ISO date of birth and handles invalid dates', () => {
    expect(calculateAgeFromDob('')).toBeNull();
    expect(calculateAgeFromDob('invalid')).toBeNull();
    const currentYear = new Date().getFullYear();
    const dob = `${currentYear - 30}-01-01`;
    expect(calculateAgeFromDob(dob)).toBe(30);
  });

  it('builds dynamic personal introduction without hardcoded personal names', () => {
    const intro = buildPersonalIntroductionText('Aarav');
    expect(intro).toContain('Aarav');
    expect(intro).toContain('eye movements');

    const fallbackIntro = buildPersonalIntroductionText('');
    expect(fallbackIntro).toContain('Friend');

    const custom = buildPersonalIntroductionText('Aarav', 'Hi, nice to meet you.');
    expect(custom).toBe('Hi, nice to meet you.');
  });

  it('enforces caregiver RBAC consent and granular role permissions', () => {
    const consentedSupport: CaregiverRelationship = {
      id: 'cg_1',
      name: 'Care Support',
      relationshipLabel: 'Support Worker',
      role: 'support_worker',
      phone: '+919876543211',
      email: 'support@example.com',
      consentGranted: true,
      canEditPhrases: false,
      canViewHistory: false,
      canViewMedical: true,
      canEditMedical: false,
      canManageRoutines: true,
      canManageRequests: true,
      canViewHandover: true,
      canWriteHandover: false,
      grantedAt: new Date().toISOString(),
    };

    // Patient owner always authorized
    expect(isPermissionAllowedForCaregiver(consentedSupport, true, 'canEditMedical')).toBe(true);
    expect(isPermissionAllowedForCaregiver(null, true, 'canEditPhrases')).toBe(true);

    // Consented caregiver gets only explicitly granted flags
    expect(isPermissionAllowedForCaregiver(consentedSupport, false, 'canViewMedical')).toBe(true);
    expect(isPermissionAllowedForCaregiver(consentedSupport, false, 'canEditMedical')).toBe(false);
    expect(isPermissionAllowedForCaregiver(consentedSupport, false, 'canEditPhrases')).toBe(false);

    // Revoked consent denies all caregiver actions
    const revoked: CaregiverRelationship = { ...consentedSupport, consentGranted: false };
    expect(isPermissionAllowedForCaregiver(revoked, false, 'canViewMedical')).toBe(false);
    expect(isPermissionAllowedForCaregiver(null, false, 'canViewMedical')).toBe(false);
  });

  it('isolates profiles, Life Hub records, and emergency contacts per patient account', async () => {
    // User A (default local account)
    expect(getActivePatientId()).toBe(DEFAULT_LOCAL_PATIENT_ID);
    savePatientProfile({ ...DEFAULT_PROFILE, name: 'User Alpha', preferredName: 'Alpha' });
    await addEmergencyContactService({
      name: 'Caregiver Alpha',
      relationship: 'Family',
      phone: '+919876543210',
      email: 'alpha@example.com',
    });

    const alphaHub = createDefaultLifeHubState();
    const nowIso = new Date().toISOString();
    alphaHub.helpRequests.push({
      id: 'hr_alpha',
      patientId: DEFAULT_LOCAL_PATIENT_ID,
      category: 'choice',
      title: 'Please bring water',
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
      caregiverConnected: false,
    });
    saveLifeHubState(alphaHub);

    // Create & switch to User B
    const betaAccount = createPatientAccount('User Beta');
    expect(getActivePatientId()).toBe(betaAccount.id);
    expect(listPatientAccounts().length).toBe(2);

    // User B must start completely clean and isolated from User A
    expect(loadPatientProfile().name).toBe('Guest User');
    expect(loadLifeHubState().helpRequests).toEqual([]);
    const betaContacts = await loadEmergencyContactsService();
    expect(betaContacts.contacts).toEqual([]);

    // Save User B data
    savePatientProfile({ ...DEFAULT_PROFILE, name: 'User Beta', preferredName: 'Beta' });
    const betaHub = createDefaultLifeHubState();
    betaHub.medicineReminders.push({
      id: 'med_beta',
      name: 'Vitamin D',
      description: '1000 IU',
      reminderTime: '09:00',
      frequency: 'daily',
      instructions: 'After breakfast',
      startDate: '2026-01-01',
      active: true,
      createdAt: nowIso,
    });
    saveLifeHubState(betaHub);

    // Switch back to User A and confirm isolation preserved
    setActivePatientId(DEFAULT_LOCAL_PATIENT_ID);
    expect(loadPatientProfile().name).toBe('User Alpha');
    expect(loadLifeHubState().helpRequests.map((h) => h.id)).toEqual(['hr_alpha']);
    expect(loadLifeHubState().medicineReminders).toEqual([]);
    const alphaContacts = await loadEmergencyContactsService();
    expect(alphaContacts.contacts.map((c) => c.name)).toEqual(['Caregiver Alpha']);

    // Delete Beta account cleanly
    eraseLifeHubState(betaAccount.id);
    const nextActive = removePatientAccountFromDirectory(betaAccount.id);
    expect(nextActive).toBe(DEFAULT_LOCAL_PATIENT_ID);
  });
});
