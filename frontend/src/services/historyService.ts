import { getAuthUser } from './authService';
import { apiGet, apiPost, apiFetch } from './apiClient';
export interface AnalysisFinding {
  disease: string;
  probability: number;
  threshold?: number;
  detected?: boolean;
}

export interface StructuredReport {
  clinical_context: string;
  image_model_findings: string;
  clinical_information: string;
  integrated_interpretation: string;
  possible_findings: string;
  recommended_next_steps: string;
}

export interface AnalysisRecord {
  id: string;
  patient_id?: string;
  patientName?: string;
  age?: string;
  sex?: string;
  timestamp: number;
  date: string;
  status: 'Completed' | 'Processing';
  imagePreview: string;
  findings: AnalysisFinding[];
  topFinding: {
    disease: string;
    probability: number;
    color?: string;
  };
  clinicalText: string;
  report: StructuredReport | string;
}

export interface ActivityPoint {
  day: string;
  analyses: number;
  reports: number;
}


export function getUserStorageKeys(): { storageKey: string; activeKey: string; isGuest: boolean; userId: string } {
  const user = getAuthUser();
  const userId = user?.id || 'guest';
  const isGuest = userId === 'guest';
  return {
    storageKey: `analysis_history_${userId}`,
    activeKey: `active_patient_id_${userId}`,
    isGuest,
    userId
  };
}

import { SAMPLE_CXR_1, DEFAULT_RECORDS } from "./mockData";

export async function getHistory(): Promise<AnalysisRecord[]> {
  const { storageKey } = getUserStorageKeys();
  let serverRecords: AnalysisRecord[] = [];

  try {
    const res = await apiGet('/api/v1/history');
    if (res.ok) {
      serverRecords = await res.json();
    }
  } catch (e) {
    console.warn('Failed to load history from backend, falling back to local cache', e);
  }

  // Load local cache for this user
  let localRecords: AnalysisRecord[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      localRecords = JSON.parse(raw);
    }
  } catch {
    // ignore parse error
  }

  // Merge server records and local records (server records take precedence by ID)
  const map = new Map<string, AnalysisRecord>();
  if (Array.isArray(localRecords)) {
    for (const r of localRecords) {
      if (r && r.id) map.set(r.id, r);
    }
  }
  if (Array.isArray(serverRecords)) {
    for (const r of serverRecords) {
      if (r && r.id) map.set(r.id, r);
    }
  }

  const combined = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Keep local storage updated with the merged records
  if (combined.length > 0) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(combined));
    } catch {
      // ignore storage quota issues
    }
  }

  return combined;
}

export async function getCurrentPatient(): Promise<AnalysisRecord | null> {
  const history = await getHistory();
  const { activeKey } = getUserStorageKeys();
  const activeId = localStorage.getItem(activeKey);
  if (activeId) {
    const match = history.find(r => r.id === activeId);
    if (match) return match;
  }
  if (history.length > 0) {
    localStorage.setItem(activeKey, history[0].id);
    return history[0];
  }
  return null;
}

export function setCurrentPatient(id: string): void {
  const { activeKey } = getUserStorageKeys();
  localStorage.setItem(activeKey, id);
}

export async function saveAnalysis(record: Omit<AnalysisRecord, 'id' | 'timestamp' | 'date'>): Promise<AnalysisRecord> {
  const current = await getHistory();
  const nextNum = 2401 + current.length;
  const now = new Date();
  const { storageKey } = getUserStorageKeys();
  
  const newRecord: AnalysisRecord = {
    ...record,
    id: `CXR-${nextNum}`,
    timestamp: Date.now(),
    date: now.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    imagePreview: record.imagePreview || SAMPLE_CXR_1,
  };

  // Respect user privacy preference: if pref_storeHistory is disabled, do not persist to storage or database
  const shouldStore = localStorage.getItem('pref_storeHistory') !== 'false';
  if (!shouldStore) {
    setCurrentPatient(newRecord.id);
    return newRecord;
  }

  // 1. Immediately cache in localStorage for instant client durability
  try {
    const updated = [newRecord, ...current.filter(r => r.id !== newRecord.id)];
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }

  // 2. Persist to backend SQLite DB
  try {
    const payload = {
      ...newRecord,
      patient_id: newRecord.patient_id || '',
      patientName: newRecord.patientName || '',
      top_finding: newRecord.topFinding,
      topFinding: newRecord.topFinding,
      clinical_text: newRecord.clinicalText || '',
      clinicalText: newRecord.clinicalText || '',
      image_preview: newRecord.imagePreview,
      imagePreview: newRecord.imagePreview,
      age: newRecord.age || '',
      sex: newRecord.sex || '',
    };
    await apiPost('/api/v1/history', payload);
  } catch (backendErr) {
    console.error('Failed to save to backend history endpoint:', backendErr);
  }
  
  // Set as the current active patient for this doctor
  setCurrentPatient(newRecord.id);

  return newRecord;
}

export async function deleteAnalysis(id: string): Promise<AnalysisRecord[]> {
  const { storageKey, activeKey } = getUserStorageKeys();
  
  try {
    await apiFetch(`/api/v1/history/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Failed to delete from backend:', err);
  }

  // Also remove from local cache
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const list: AnalysisRecord[] = JSON.parse(raw);
      const filtered = list.filter(r => r.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }

  const current = await getHistory();
  
  const activeId = localStorage.getItem(activeKey);
  if (activeId === id) {
    if (current.length > 0) {
      setCurrentPatient(current[0].id);
    } else {
      localStorage.removeItem(activeKey);
    }
  }
  
  return current;
}

export async function clearHistory(): Promise<void> {
  const { storageKey, activeKey } = getUserStorageKeys();
  try {
    await apiFetch('/api/v1/history', { method: 'DELETE' });
  } catch (err) {
    console.warn('Failed to clear backend history:', err);
  }
  localStorage.removeItem(storageKey);
  localStorage.removeItem(activeKey);
}

// Helper allowing any doctor to optionally load reference demonstration cases into their account
export async function loadSampleCasesForCurrentDoctor(): Promise<AnalysisRecord[]> {
  const { activeKey } = getUserStorageKeys();
  for (const rec of DEFAULT_RECORDS) {
    await apiPost('/api/v1/history', rec);
  }
  if (DEFAULT_RECORDS.length > 0) {
    localStorage.setItem(activeKey, DEFAULT_RECORDS[0].id);
  }
  return getHistory();
}

export async function getTotalAnalysesCount(): Promise<number> {
  return (await getHistory()).length;
}

export async function getActivityTrend(): Promise<ActivityPoint[]> {
  const history = await getHistory();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const displayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const map: Record<string, { analyses: number; reports: number }> = {
    'Mon': { analyses: 0, reports: 0 },
    'Tue': { analyses: 0, reports: 0 },
    'Wed': { analyses: 0, reports: 0 },
    'Thu': { analyses: 0, reports: 0 },
    'Fri': { analyses: 0, reports: 0 },
    'Sat': { analyses: 0, reports: 0 },
    'Sun': { analyses: 0, reports: 0 },
  };

  history.forEach((rec) => {
    const d = new Date(rec.timestamp);
    const day = dayNames[d.getDay()];
    if (map[day]) {
      map[day].analyses += 1;
      if (rec.report) {
        map[day].reports += 1;
      }
    }
  });

  return displayOrder.map((day) => ({
    day,
    analyses: map[day].analyses,
    reports: map[day].reports,
  }));
}
