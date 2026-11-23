import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildMailtoUri,
  buildTelUri,
  normalizePhoneNumber,
  validateContactInput,
  validateEmailAddress,
  validatePhoneNumber,
} from '../contacts/contact-utils';
import {
  addEmergencyContactService,
  deleteEmergencyContactService,
  EMERGENCY_CONTACTS_STORAGE_KEY,
  LEGACY_CONTACTS_STORAGE_KEY,
  loadEmergencyContactsService,
  setPrimaryEmergencyContactService,
  updateEmergencyContactService,
} from '../contacts/emergency-contact-service';
import { clearAllLocalData } from '../storage/local-storage';

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

describe('Emergency Contact Validation, Persistence & URI Generation', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installMockWindowStorage();
  });

  it('normalizes phone numbers while preserving international + country codes and rejects invalid inputs', () => {
    expect(normalizePhoneNumber(' +91 (987) 654-3210 ')).toBe('+919876543210');
    expect(normalizePhoneNumber('98765 43210')).toBe('9876543210');

    expect(validatePhoneNumber('').valid).toBe(false);
    expect(validatePhoneNumber('12345').valid).toBe(false);
    expect(validatePhoneNumber('9876abc123').valid).toBe(false);
    expect(validatePhoneNumber('+0912345678').valid).toBe(false);
    expect(validatePhoneNumber('+91 98765-43210')).toEqual({
      valid: true,
      normalized: '+919876543210',
    });

    expect(validateEmailAddress('').valid).toBe(true);
    expect(validateEmailAddress('', true).valid).toBe(false);
    expect(validateEmailAddress('not-an-email').valid).toBe(false);
    expect(validateEmailAddress('caregiver@example.com')).toEqual({
      valid: true,
      normalized: 'caregiver@example.com',
    });
  });

  it('builds sanitized tel: and mailto: URIs strictly from validated contact data', () => {
    expect(buildTelUri('+91 (987) 654-3210')).toBe('tel:+919876543210');
    expect(buildTelUri('invalid')).toBeNull();

    const mailto = buildMailtoUri('priya@example.com', { subject: 'Message from NayanSathi' });
    expect(mailto).toBe('mailto:priya@example.com?subject=Message+from+NayanSathi');
    expect(buildMailtoUri('')).toBeNull();
    expect(buildMailtoUri('bad-email')).toBeNull();
  });

  it('validates all four contact fields accurately', () => {
    const missingName = validateContactInput({
      name: '  ',
      relationship: 'Daughter',
      phone: '+919876543210',
      email: 'a@b.com',
    });
    expect(missingName.valid).toBe(false);
    expect(missingName.fieldErrors.name).toBeTruthy();

    const badEmail = validateContactInput({
      name: 'Priya',
      relationship: 'Daughter',
      phone: '+919876543210',
      email: 'bad@',
    });
    expect(badEmail.valid).toBe(false);
    expect(badEmail.fieldErrors.email).toBeTruthy();
  });

  it('persists, updates, promotes primary, prevents duplicates, and deletes contacts under nayanSathi.emergencyContacts', async () => {
    const initial = await loadEmergencyContactsService();
    expect(initial.contacts).toEqual([]);

    // Add first contact -> automatically marked primary and normalized
    const add1 = await addEmergencyContactService({
      name: 'Priya Sharma',
      relationship: 'Daughter',
      phone: '+91 98765-43210',
      email: 'priya@example.com',
    });
    expect(add1.ok).toBe(true);
    expect(add1.contacts.length).toBe(1);
    expect(add1.contacts[0].phone).toBe('+919876543210');
    expect(add1.contacts[0].isPrimary).toBe(true);
    expect(store.has(EMERGENCY_CONTACTS_STORAGE_KEY)).toBe(true);

    // Reload simulates browser refresh
    const reloaded = await loadEmergencyContactsService();
    expect(reloaded.contacts.length).toBe(1);
    expect(reloaded.contacts[0].name).toBe('Priya Sharma');
    expect(reloaded.contacts[0].relationship).toBe('Daughter');

    // Duplicate phone rejected
    const dup = await addEmergencyContactService({
      name: 'Duplicate',
      relationship: 'Sister',
      phone: '+919876543210',
      email: '',
    });
    expect(dup.ok).toBe(false);
    expect(dup.error).toContain('phone number already exists');

    // Add secondary contact
    const add2 = await addEmergencyContactService({
      name: 'Dr. Verma',
      relationship: 'Doctor',
      phone: '+91 91234 56789',
      email: '',
      isPrimary: false,
    });
    expect(add2.ok).toBe(true);
    expect(add2.contacts.length).toBe(2);
    expect(add2.contacts.filter((c) => c.isPrimary).length).toBe(1);

    // Edit phone number
    const updated = await updateEmergencyContactService(add1.contacts[0].id, {
      name: 'Priya Sharma',
      relationship: 'Daughter',
      phone: '+91 99999-88888',
      email: 'priya@example.com',
      isPrimary: true,
    });
    expect(updated.ok).toBe(true);
    expect(updated.contacts[0].phone).toBe('+919999988888');

    // Promote second contact to primary -> ensures single primary invariant
    const secondId = add2.contacts.find((c) => c.name === 'Dr. Verma')!.id;
    const promoted = await setPrimaryEmergencyContactService(secondId);
    expect(promoted.ok).toBe(true);
    expect(promoted.contacts.filter((c) => c.isPrimary).length).toBe(1);
    expect(promoted.contacts[0].id).toBe(secondId);

    // Delete contacts -> removes cleanly and leaves empty state
    await deleteEmergencyContactService(secondId);
    const remaining = await loadEmergencyContactsService();
    expect(remaining.contacts.length).toBe(1);
    expect(remaining.contacts[0].isPrimary).toBe(true);

    await deleteEmergencyContactService(remaining.contacts[0].id);
    const empty = await loadEmergencyContactsService();
    expect(empty.contacts).toEqual([]);
  });

  it('safely discards legacy fake placeholder and handles corrupted JSON without crashing', async () => {
    store.set(
      LEGACY_CONTACTS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'contact_primary',
          name: 'Primary Caregiver',
          relation: 'Family / Caregiver',
          phone: '',
          email: '',
          isPrimary: true,
        },
      ])
    );

    const migrated = await loadEmergencyContactsService();
    expect(migrated.contacts).toEqual([]);
    expect(migrated.corrupted).toBe(false);

    store.set(EMERGENCY_CONTACTS_STORAGE_KEY, '{not-valid-json');
    const corrupted = await loadEmergencyContactsService();
    expect(corrupted.corrupted).toBe(true);
    expect(corrupted.contacts).toEqual([]);
    expect(corrupted.error).toBeTruthy();

    clearAllLocalData();
    expect(store.has(EMERGENCY_CONTACTS_STORAGE_KEY)).toBe(false);
  });
});
