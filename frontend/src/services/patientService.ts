import { getAuthToken } from './authService';

export interface Patient {
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age?: string;
  sex: string;
  createdAt?: number;
}

const LOCAL_PATIENTS_KEY = 'clini_registered_patients';

function getApiBase(): string {
  return (localStorage.getItem('apiBaseUrl') || 'http://localhost:8000').replace(/\/+$/, '');
}

/**
 * Retrieve registered patients from local storage cache.
 */
export function getLocalPatients(): Patient[] {
  try {
    const raw = localStorage.getItem(LOCAL_PATIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse local patients:', err);
  }
  return [];
}

/**
 * Save patients array to local storage cache.
 */
export function setLocalPatients(patients: Patient[]): void {
  try {
    localStorage.setItem(LOCAL_PATIENTS_KEY, JSON.stringify(patients));
  } catch (err) {
    console.warn('Failed to save local patients cache:', err);
  }
}

/**
 * Fetch all patients, combining backend database records with local storage cache.
 */
export async function getPatients(): Promise<Patient[]> {
  const localList = getLocalPatients();
  let serverList: Patient[] = [];

  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${getApiBase()}/api/v1/patients`, { headers });
    if (response.ok) {
      serverList = await response.json();
    }
  } catch (err) {
    console.warn('Backend /api/v1/patients unavailable, falling back to local cache', err);
  }

  // Merge server and local patients by MRN (server records take precedence, preserving createdAt)
  const map = new Map<string, Patient>();

  for (const p of localList) {
    if (p && p.mrn) {
      map.set(p.mrn.toUpperCase(), p);
    }
  }

  for (const p of serverList as Array<Patient & { created_at?: number | null }>) {
    if (p && p.mrn) {
      const key = p.mrn.toUpperCase();
      const localMatch = map.get(key);
      map.set(key, {
        ...p,
        mrn: key,
        createdAt: p.created_at ?? p.createdAt ?? localMatch?.createdAt,
      });
    }
  }

  const merged = Array.from(map.values());
  // Cache merged list locally
  setLocalPatients(merged);

  return merged;
}

export interface RegisterPatientInput {
  name: string;
  mrn?: string;
  age?: string | number;
  sex?: string;
  date_of_birth?: string;
  rejectDuplicateMrn?: boolean;
}

function randomInt(min: number, maxExclusive: number): number {
  const range = maxExclusive - min;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return min + (arr[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}

/**
 * Generate a random MRN guaranteed not to collide with any known patient MRN.
 */
export function generateUniqueMrn(existingPatients: Patient[] = getLocalPatients()): string {
  const existing = new Set(existingPatients.map(p => (p.mrn || '').trim().toUpperCase()).filter(Boolean));
  for (let i = 0; i < 100; i++) {
    const candidate = `MRN-${randomInt(100000, 1000000)}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  while (true) {
    const candidate = `MRN-${randomInt(10000000, 100000000)}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
}

/**
 * Parse full name string into first_name and last_name.
 */
export function parseFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { first_name: 'Unknown', last_name: '' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  }
  const first_name = parts[0];
  const last_name = parts.slice(1).join(' ');
  return { first_name, last_name };
}

/**
 * Register a patient in the directory.
 * Saves to both the backend API and local storage cache.
 */
export async function registerPatient(input: RegisterPatientInput): Promise<Patient> {
  const { first_name, last_name } = parseFullName(input.name);
  const knownPatients = await getPatients().catch(() => getLocalPatients());

  // Use provided MRN (with optional duplicate rejection) or generate a guaranteed-unique MRN
  let mrn = input.mrn?.trim().toUpperCase();
  if (mrn) {
    if (input.rejectDuplicateMrn) {
      const duplicate = knownPatients.some(p => (p.mrn || '').trim().toUpperCase() === mrn);
      if (duplicate) {
        throw new Error(`A patient with MRN "${mrn}" already exists. Please use a unique MRN.`);
      }
    }
  } else {
    mrn = generateUniqueMrn(knownPatients);
  }

  // Derive DOB from age if DOB not explicitly specified
  let dob = input.date_of_birth?.trim() || '';
  if (!dob && input.age) {
    const parsedAge = parseInt(String(input.age), 10);
    if (!isNaN(parsedAge) && parsedAge > 0 && parsedAge < 130) {
      const birthYear = new Date().getFullYear() - parsedAge;
      dob = `${birthYear}-01-01`;
    }
  }
  if (!dob) {
    dob = 'N/A';
  }

  const sex = input.sex?.trim() || 'Unknown';

  const newPatient: Patient = {
    mrn,
    first_name,
    last_name,
    date_of_birth: dob,
    age: input.age ? String(input.age) : undefined,
    sex,
    createdAt: Date.now(),
  };

  // 1. Persist to backend database first when rejecting duplicates
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${getApiBase()}/api/v1/patients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mrn: newPatient.mrn,
        first_name: newPatient.first_name,
        last_name: newPatient.last_name,
        date_of_birth: newPatient.date_of_birth,
        sex: newPatient.sex,
        created_at: newPatient.createdAt,
        allow_update: !input.rejectDuplicateMrn,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      if (response.status === 409) {
        throw new Error(errBody?.detail || `A patient with MRN "${newPatient.mrn}" already exists.`);
      }
      console.warn('Backend patient save returned non-200:', errBody);
    } else {
      const resData = await response.json().catch(() => null);
      if (resData?.mrn) {
        newPatient.mrn = String(resData.mrn).toUpperCase();
      }
      if (resData?.created_at) {
        newPatient.createdAt = resData.created_at;
      }
    }
  } catch (err: any) {
    if (err instanceof Error && err.message.includes('already exists')) {
      throw err;
    }
    console.warn('Could not persist patient to backend, saved locally:', err);
  }

  // 2. Cache locally
  const currentLocal = getLocalPatients();
  const existingIdx = currentLocal.findIndex(p => p.mrn.toUpperCase() === newPatient.mrn.toUpperCase());
  if (existingIdx >= 0) {
    currentLocal[existingIdx] = { ...currentLocal[existingIdx], ...newPatient };
  } else {
    currentLocal.unshift(newPatient);
  }
  setLocalPatients(currentLocal);

  return newPatient;
}

export async function deletePatient(mrn: string): Promise<void> {
  // 1. Remove from local cache
  const localList = getLocalPatients().filter(p => p.mrn.toUpperCase() !== mrn.toUpperCase());
  setLocalPatients(localList);

  // 2. Delete from backend database
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    await fetch(`${getApiBase()}/api/v1/patients/${encodeURIComponent(mrn)}`, {
      method: 'DELETE',
      headers,
    });
  } catch (err) {
    console.warn('Could not delete patient from backend:', err);
  }
}
