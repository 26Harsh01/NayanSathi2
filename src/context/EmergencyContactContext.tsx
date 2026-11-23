import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import type { EmergencyContact } from '../types';
import type { ContactInput } from '../features/contacts/contact-utils';
import {
  addEmergencyContactService,
  CONTACTS_CHANGED_EVENT,
  deleteEmergencyContactService,
  EMERGENCY_CONTACTS_STORAGE_KEY,
  LEGACY_CONTACTS_STORAGE_KEY,
  loadEmergencyContactsService,
  readContactsFromLocalStorage,
  setPrimaryEmergencyContactService,
  updateEmergencyContactService,
  type ContactMutationResult,
  type ContactStorageMode,
} from '../features/contacts/emergency-contact-service';

export interface EmergencyContactContextValue {
  contacts: EmergencyContact[];
  primaryContact: EmergencyContact | null;
  loading: boolean;
  storageError: string | null;
  storageMode: ContactStorageMode;
  addContact: (input: ContactInput) => Promise<ContactMutationResult>;
  updateContact: (id: string, input: ContactInput) => Promise<ContactMutationResult>;
  deleteContact: (id: string) => Promise<ContactMutationResult>;
  refreshContacts: () => Promise<void>;
  setPrimaryContact: (id: string) => Promise<ContactMutationResult>;
}

const EmergencyContactContext = createContext<EmergencyContactContextValue | null>(null);

export const EmergencyContactProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initialLocal = useMemo(() => readContactsFromLocalStorage(), []);
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialLocal.contacts);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [storageError, setStorageError] = useState<string | null>(initialLocal.error ?? null);
  const [storageMode, setStorageMode] = useState<ContactStorageMode>(initialLocal.mode);

  const refreshContacts = useCallback(async () => {
    const res = await loadEmergencyContactsService();
    setContacts(res.contacts);
    setStorageMode(res.mode);
    setStorageError(res.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshContacts();
  }, [refreshContacts]);

  // Cross-tab localStorage synchronization & same-tab storage reset sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === null ||
        e.key === EMERGENCY_CONTACTS_STORAGE_KEY ||
        e.key === LEGACY_CONTACTS_STORAGE_KEY
      ) {
        void refreshContacts();
      }
    };

    const handleLocalResetOrChange = () => {
      void refreshContacts();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CONTACTS_CHANGED_EVENT, handleLocalResetOrChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CONTACTS_CHANGED_EVENT, handleLocalResetOrChange);
    };
  }, [refreshContacts]);

  // Re-sync when Supabase auth state changes (if configured)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabaseClient();
    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      void refreshContacts();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshContacts]);

  const addContact = useCallback(async (input: ContactInput): Promise<ContactMutationResult> => {
    const res = await addEmergencyContactService(input);
    if (res.ok) {
      setContacts(res.contacts);
      setStorageMode(res.mode);
      setStorageError(null);
    } else if (res.error) {
      setStorageError(res.error);
    }
    return res;
  }, []);

  const updateContact = useCallback(
    async (id: string, input: ContactInput): Promise<ContactMutationResult> => {
      const res = await updateEmergencyContactService(id, input);
      if (res.ok) {
        setContacts(res.contacts);
        setStorageMode(res.mode);
        setStorageError(null);
      } else if (res.error) {
        setStorageError(res.error);
      }
      return res;
    },
    []
  );

  const deleteContact = useCallback(async (id: string): Promise<ContactMutationResult> => {
    const res = await deleteEmergencyContactService(id);
    if (res.ok) {
      setContacts(res.contacts);
      setStorageMode(res.mode);
      setStorageError(null);
    } else if (res.error) {
      setStorageError(res.error);
    }
    return res;
  }, []);

  const setPrimaryContact = useCallback(async (id: string): Promise<ContactMutationResult> => {
    const res = await setPrimaryEmergencyContactService(id);
    if (res.ok) {
      setContacts(res.contacts);
      setStorageMode(res.mode);
      setStorageError(null);
    } else if (res.error) {
      setStorageError(res.error);
    }
    return res;
  }, []);

  const primaryContact = useMemo(
    () => contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null,
    [contacts]
  );

  return (
    <EmergencyContactContext.Provider
      value={{
        contacts,
        primaryContact,
        loading,
        storageError,
        storageMode,
        addContact,
        updateContact,
        deleteContact,
        refreshContacts,
        setPrimaryContact,
      }}
    >
      {children}
    </EmergencyContactContext.Provider>
  );
};

export function useEmergencyContacts(): EmergencyContactContextValue {
  const ctx = useContext(EmergencyContactContext);
  if (!ctx) {
    throw new Error('useEmergencyContacts must be used within EmergencyContactProvider');
  }
  return ctx;
}
