import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Crosshair,
  Edit2,
  Mail,
  Phone,
  Plus,
  Shield,
  Star,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { useEmergencyContacts } from '../context/EmergencyContactContext';
import { validateContactInput, type ContactInput } from '../features/contacts/contact-utils';
import type { ButtonSize, Language } from '../types';

interface CaregiverDashboardPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const CaregiverDashboardPage: React.FC<CaregiverDashboardPageProps> = ({
  onNavigate,
}) => {
  const {
    profile,
    updateProfile,
    settings,
    updateSettings,
    setLanguage,
    categories,
    addCategory,
    deleteCategory,
    phrases,
    addCustomPhrase,
    updatePhrase,
    deletePhrase,
    history,
    deleteHistoryEntry,
    clearHistory,
  } = useAppState();

  const {
    contacts,
    primaryContact,
    storageError,
    storageMode,
    addContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
  } = useEmergencyContacts();

  const [newCatEn, setNewCatEn] = useState('');
  const [newCatHi, setNewCatHi] = useState('');

  const [phraseCategoryId, setPhraseCategoryId] = useState('basic');
  const [newPhraseEn, setNewPhraseEn] = useState('');
  const [newPhraseHi, setNewPhraseHi] = useState('');

  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState('');
  const [editHi, setEditHi] = useState('');

  const [editingContactId, setEditingContactId] = useState<string | null>(
    () => primaryContact?.id ?? null
  );
  const [isAddingNewContact, setIsAddingNewContact] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactInput>(() =>
    primaryContact
      ? {
          name: primaryContact.name,
          relationship: primaryContact.relationship,
          phone: primaryContact.phone,
          email: primaryContact.email,
          isPrimary: primaryContact.isPrimary,
        }
      : { name: '', relationship: '', phone: '', email: '', isPrimary: true }
  );
  const [contactFieldErrors, setContactFieldErrors] = useState<
    Partial<Record<'name' | 'relationship' | 'phone' | 'email', string>>
  >({});
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Keep form synchronized with shared contact state on load, cross-tab updates, edits, or deletions
  useEffect(() => {
    if (isAddingNewContact) return;

    const target =
      (editingContactId ? contacts.find((c) => c.id === editingContactId) : null) ??
      primaryContact ??
      null;

    if (target) {
      setEditingContactId(target.id);
      setContactDraft({
        name: target.name,
        relationship: target.relationship,
        phone: target.phone,
        email: target.email,
        isPrimary: target.isPrimary,
      });
    } else {
      setEditingContactId(null);
      setContactDraft({
        name: '',
        relationship: '',
        phone: '',
        email: '',
        isPrimary: true,
      });
    }
  }, [contacts, primaryContact, editingContactId, isAddingNewContact]);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    window.setTimeout(() => setSavedToast(null), 2500);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatEn.trim()) return;
    addCategory(newCatEn, newCatHi);
    setNewCatEn('');
    setNewCatHi('');
    showToast('Custom category added.');
  };

  const handleCreatePhrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhraseEn.trim()) return;
    addCustomPhrase(phraseCategoryId, newPhraseEn, newPhraseHi);
    setNewPhraseEn('');
    setNewPhraseHi('');
    showToast('Custom phrase added.');
  };

  const handleStartNewContact = () => {
    setIsAddingNewContact(true);
    setEditingContactId(null);
    setContactDraft({
      name: '',
      relationship: '',
      phone: '',
      email: '',
      isPrimary: contacts.length === 0,
    });
    setContactFieldErrors({});
    setContactError(null);
    setContactSuccess(null);
  };

  const handleEditExistingContact = (contactId: string) => {
    const found = contacts.find((c) => c.id === contactId);
    if (!found) return;
    setIsAddingNewContact(false);
    setEditingContactId(found.id);
    setContactDraft({
      name: found.name,
      relationship: found.relationship,
      phone: found.phone,
      email: found.email,
      isPrimary: found.isPrimary,
    });
    setContactFieldErrors({});
    setContactError(null);
    setContactSuccess(null);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);

    const validation = validateContactInput(contactDraft);
    if (!validation.valid) {
      setContactFieldErrors(validation.fieldErrors);
      setContactError(validation.error || 'Please correct the highlighted contact fields.');
      return;
    }

    setContactFieldErrors({});
    setSavingContact(true);

    const payload: ContactInput = {
      name: validation.normalized.name,
      relationship: validation.normalized.relationship,
      phone: validation.normalized.phone,
      email: validation.normalized.email,
      isPrimary: contacts.length === 0 ? true : Boolean(contactDraft.isPrimary),
    };

    const result =
      editingContactId && !isAddingNewContact
        ? await updateContact(editingContactId, payload)
        : await addContact(payload);

    setSavingContact(false);

    if (!result.ok) {
      setContactFieldErrors(result.fieldErrors || {});
      setContactError(result.error || 'Failed to save emergency contact.');
      return;
    }

    const savedRecord = result.contact ?? result.contacts[0] ?? null;
    setIsAddingNewContact(false);
    if (savedRecord) {
      setEditingContactId(savedRecord.id);
      setContactDraft({
        name: savedRecord.name,
        relationship: savedRecord.relationship,
        phone: savedRecord.phone,
        email: savedRecord.email,
        isPrimary: savedRecord.isPrimary,
      });
    }

    const msg =
      editingContactId && !isAddingNewContact
        ? 'Emergency contact updated and saved.'
        : 'Emergency contact saved.';
    setContactSuccess(msg);
    showToast(msg);
  };

  const handleDeleteContact = async (contactId: string) => {
    setContactError(null);
    setContactSuccess(null);
    const result = await deleteContact(contactId);
    if (!result.ok) {
      setContactError(result.error || 'Could not delete emergency contact.');
      return;
    }
    if (editingContactId === contactId) {
      setIsAddingNewContact(false);
      setEditingContactId(result.contacts[0]?.id ?? null);
    }
    setContactSuccess('Emergency contact removed.');
    showToast('Emergency contact removed.');
  };

  const handleMakePrimary = async (contactId: string) => {
    setContactError(null);
    setContactSuccess(null);
    const result = await setPrimaryContact(contactId);
    if (!result.ok) {
      setContactError(result.error || 'Could not update primary contact.');
      return;
    }
    setContactSuccess('Primary emergency contact updated.');
    showToast('Primary emergency contact updated.');
  };

  const customPhrases = phrases.filter((p) => p.isCustom);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Caregiver Portal
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Personalize phrases, emergency contacts, gaze timing, and calibration assistance for the communicator.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('calibration')}
          className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
          <span>Assist with Calibration</span>
        </button>
      </div>

      {savedToast && (
        <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-sm font-medium text-teal-800 dark:text-teal-300">
          {savedToast}
        </div>
      )}

      {/* Row 1: Patient Profile + Accessibility Quick Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Patient Profile
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Patient Name</span>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  updateProfile((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Caregiver Name</span>
              <input
                type="text"
                value={profile.caregiverName}
                onChange={(e) =>
                  updateProfile((prev) => ({ ...prev, caregiverName: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Caregiver Notes</span>
            <textarea
              rows={2}
              value={profile.notes}
              onChange={(e) =>
                updateProfile((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Lighting preferences, seating posture notes, or communication reminders..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Dwell, Button Size & Language Controls
          </h2>

          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Dwell Selection Time
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  {settings.eyeTracking.dwellDurationMs} ms
                </span>
              </div>
              <input
                type="range"
                min={500}
                max={3000}
                step={100}
                value={settings.eyeTracking.dwellDurationMs}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    eyeTracking: {
                      ...prev.eyeTracking,
                      dwellDurationMs: Number(e.target.value),
                    },
                  }))
                }
                className="w-full accent-teal-600"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Button Size
                </span>
                <select
                  value={settings.interface.buttonSize}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      interface: {
                        ...prev.interface,
                        buttonSize: e.target.value as ButtonSize,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra-Large</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Active Language
                </span>
                <select
                  value={settings.communication.language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Custom Phrase & Category Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Custom Categories
          </h2>
          <form onSubmit={handleCreateCategory} className="space-y-3">
            <input
              type="text"
              placeholder="Category name (English)"
              value={newCatEn}
              onChange={(e) => setNewCatEn(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              placeholder="श्रेणी नाम (हिंदी - optional)"
              value={newCatHi}
              onChange={(e) => setNewCatHi(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </form>

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between text-sm py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60"
              >
                <span>
                  {cat.nameEn} / {cat.nameHi}
                </span>
                {cat.isCustom && (
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    aria-label={`Delete ${cat.nameEn}`}
                    className="text-red-600 hover:text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Custom Phrases
          </h2>
          <form onSubmit={handleCreatePhrase} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={phraseCategoryId}
              onChange={(e) => setPhraseCategoryId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Phrase in English"
              value={newPhraseEn}
              onChange={(e) => setNewPhraseEn(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              placeholder="हिंदी वाक्यांश (optional)"
              value={newPhraseHi}
              onChange={(e) => setNewPhraseHi(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Phrase</span>
              </button>
            </div>
          </form>

          <div className="space-y-2 max-h-60 overflow-y-auto pt-2 border-t border-slate-200 dark:border-slate-800">
            {customPhrases.length === 0 ? (
              <p className="text-sm text-slate-500">
                No custom phrases added yet. Add phrases above to personalize the Communicate board.
              </p>
            ) : (
              customPhrases.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3"
                >
                  {editingPhraseId === p.id ? (
                    <div className="flex-1 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={editEn}
                        onChange={(e) => setEditEn(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                      <input
                        type="text"
                        value={editHi}
                        onChange={(e) => setEditHi(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          updatePhrase(p.id, editEn, editHi);
                          setEditingPhraseId(null);
                          showToast('Phrase updated.');
                        }}
                        className="px-3 py-1.5 rounded bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {p.textEn}
                        </span>
                        <span className="text-slate-500 mx-2">·</span>
                        <span className="text-slate-600 dark:text-slate-300">{p.textHi}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPhraseId(p.id);
                            setEditEn(p.textEn);
                            setEditHi(p.textHi);
                          }}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          aria-label="Edit phrase"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePhrase(p.id)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
                          aria-label="Delete phrase"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Row 3: Emergency Contact + Opt-In Communication History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Emergency Contact Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {storageMode === 'supabase'
                  ? 'Synced to your authorized account database.'
                  : 'Stored persistently in browser storage for immediate emergency access.'}
              </p>
            </div>
            {contacts.length > 0 && (
              <button
                type="button"
                onClick={handleStartNewContact}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Contact</span>
              </button>
            )}
          </div>

          {(contactError || storageError) && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs font-medium text-red-800 dark:text-red-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{contactError || storageError}</span>
            </div>
          )}

          {contactSuccess && !contactError && (
            <div
              role="status"
              className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-xs font-medium text-teal-800 dark:text-teal-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{contactSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveContact} noValidate className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Primary Caregiver Name *
                </span>
                <input
                  type="text"
                  placeholder="Contact Name"
                  value={contactDraft.name}
                  onChange={(e) => {
                    setContactDraft((prev) => ({ ...prev, name: e.target.value }));
                    setContactFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  aria-invalid={Boolean(contactFieldErrors.name)}
                  className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-950 text-sm ${
                    contactFieldErrors.name
                      ? 'border-red-500'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {contactFieldErrors.name && (
                  <span className="text-red-600 dark:text-red-400 block">
                    {contactFieldErrors.name}
                  </span>
                )}
              </label>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Family / Caregiver Relationship
                </span>
                <input
                  type="text"
                  placeholder="Relationship (e.g. Daughter)"
                  value={contactDraft.relationship}
                  onChange={(e) => {
                    setContactDraft((prev) => ({ ...prev, relationship: e.target.value }));
                    setContactFieldErrors((prev) => ({ ...prev, relationship: undefined }));
                  }}
                  aria-invalid={Boolean(contactFieldErrors.relationship)}
                  className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-950 text-sm ${
                    contactFieldErrors.relationship
                      ? 'border-red-500'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {contactFieldErrors.relationship && (
                  <span className="text-red-600 dark:text-red-400 block">
                    {contactFieldErrors.relationship}
                  </span>
                )}
              </label>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Phone Number * (include + country code if international)
                </span>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={contactDraft.phone}
                  onChange={(e) => {
                    setContactDraft((prev) => ({ ...prev, phone: e.target.value }));
                    setContactFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  aria-invalid={Boolean(contactFieldErrors.phone)}
                  className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-950 text-sm ${
                    contactFieldErrors.phone
                      ? 'border-red-500'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {contactFieldErrors.phone && (
                  <span className="text-red-600 dark:text-red-400 block">
                    {contactFieldErrors.phone}
                  </span>
                )}
              </label>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Email Address
                </span>
                <input
                  type="email"
                  placeholder="caregiver@example.com"
                  value={contactDraft.email}
                  onChange={(e) => {
                    setContactDraft((prev) => ({ ...prev, email: e.target.value }));
                    setContactFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  aria-invalid={Boolean(contactFieldErrors.email)}
                  className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-950 text-sm ${
                    contactFieldErrors.email
                      ? 'border-red-500'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {contactFieldErrors.email && (
                  <span className="text-red-600 dark:text-red-400 block">
                    {contactFieldErrors.email}
                  </span>
                )}
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contacts.length === 0 ? true : Boolean(contactDraft.isPrimary)}
                  disabled={contacts.length === 0}
                  onChange={(e) =>
                    setContactDraft((prev) => ({ ...prev, isPrimary: e.target.checked }))
                  }
                  className="w-4 h-4 accent-teal-600"
                />
                <span>Set as Primary Emergency Contact</span>
              </label>

              <div className="flex items-center gap-2">
                {isAddingNewContact && contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewContact(false);
                      setEditingContactId(primaryContact?.id ?? null);
                      setContactFieldErrors({});
                      setContactError(null);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {savingContact
                    ? 'Saving...'
                    : editingContactId && !isAddingNewContact
                      ? 'Save Emergency Contact'
                      : 'Save Emergency Contact'}
                </button>
              </div>
            </div>
          </form>

          {/* Saved Emergency Contacts List */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
              Saved Emergency Contacts ({contacts.length})
            </span>

            {contacts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No emergency contact configured yet. Fill in the details above and click Save Emergency Contact.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-sm ${
                      editingContactId === contact.id && !isAddingNewContact
                        ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {contact.name}
                        </span>
                        {contact.relationship && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            · {contact.relationship}
                          </span>
                        )}
                        {contact.isPrimary && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                        {contact.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!contact.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleMakePrimary(contact.id)}
                          title="Set as Primary Contact"
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Star className="w-3 h-3" />
                          <span>Set Primary</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditExistingContact(contact.id)}
                        aria-label={`Edit ${contact.name}`}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact.id)}
                        aria-label={`Delete ${contact.name}`}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Consent-Based Communication History
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                History logging is OFF by default. Spoken phrases are only stored locally when explicit consent is enabled below.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.privacy.historyConsentEnabled}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    privacy: { ...prev.privacy, historyConsentEnabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-600"
              />
              <span>{settings.privacy.historyConsentEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 tabular-nums">
              {history.length} saved entries
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer"
              >
                Delete All History
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">
                {settings.privacy.historyConsentEnabled
                  ? 'No spoken phrases logged yet.'
                  : 'Communication history is disabled.'}
              </p>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{entry.text}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {new Date(entry.timestamp).toLocaleString()} · {entry.language.toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteHistoryEntry(entry.id)}
                    aria-label="Delete history entry"
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
