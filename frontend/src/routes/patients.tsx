import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Search,
  Users,
  Activity,
  Loader2,
  Calendar,
  FileText,
  ChevronRight,
  X,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { type Patient, getPatients, registerPatient, deletePatient, generateUniqueMrn } from '../services/patientService';
import { getHistory, type AnalysisRecord, setCurrentPatient } from '../services/historyService';

type SortField = 'date' | 'name' | 'mrn' | 'age' | 'scans';
type SortOrder = 'asc' | 'desc';

function getNumericAge(p: { age?: string; date_of_birth?: string }): number | null {
  if (p.age) {
    const parsed = parseInt(p.age, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  if (!p.date_of_birth || p.date_of_birth === 'N/A') return null;
  const yr = parseInt(p.date_of_birth.split('-')[0], 10);
  if (isNaN(yr) || yr < 1900) return null;
  return new Date().getFullYear() - yr;
}

function getDisplayAge(p: { age?: string; date_of_birth?: string }): string {
  const age = getNumericAge(p);
  return age !== null ? `${age} yrs` : '—';
}

function getPatientDisplayName(p: Patient): string {
  if (p.last_name) {
    return p.first_name ? `${p.last_name}, ${p.first_name}` : p.last_name;
  }
  return p.first_name || 'Unnamed Patient';
}

function getRecordTimestamp(r: AnalysisRecord): number {
  if (typeof r.timestamp === 'number' && !isNaN(r.timestamp) && r.timestamp > 0) {
    return r.timestamp < 1e12 ? r.timestamp * 1000 : r.timestamp;
  }
  if (r.date) {
    const parsed = Date.parse(r.date);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

function formatDateBadge(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allRecords, setAllRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState<string>('All');
  const [scanFilter, setScanFilter] = useState<'all' | 'with_scans' | 'no_scans'>('all');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Slide-over drawer state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ mrn: '', first_name: '', last_name: '', age: '', sex: '' });
  const [saving, setSaving] = useState(false);

  const { success, error: showError } = useToast();

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const [data, historyData] = await Promise.all([
        getPatients(),
        getHistory().catch(() => [])
      ]);
      setPatients(data);
      setAllRecords(historyData);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const fullName = `${newPatient.first_name} ${newPatient.last_name}`.trim();
      await registerPatient({
        name: fullName || newPatient.mrn,
        mrn: newPatient.mrn.trim() || undefined,
        age: newPatient.age || undefined,
        sex: newPatient.sex,
        rejectDuplicateMrn: true,
      });
      
      setShowModal(false);
      setNewPatient({ mrn: '', first_name: '', last_name: '', age: '', sex: '' });
      await fetchPatients();
      success('Patient registered successfully!');
    } catch (err: any) {
      showError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleSortHeader = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'date' || field === 'scans' ? 'desc' : 'asc');
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSexFilter('All');
    setScanFilter('all');
  };

  const enrichedPatients = useMemo(() => {
    return patients.map((p: Patient) => {
      const patientScans = allRecords.filter((r: AnalysisRecord) =>
        (r.patient_id && r.patient_id.toLowerCase() === p.mrn.toLowerCase()) ||
        ((r.patientName || (r as any).patient_name || '').toLowerCase() === `${p.first_name} ${p.last_name || ''}`.trim().toLowerCase())
      );

      let latestScanMs = 0;
      for (const scan of patientScans) {
        const ts = getRecordTimestamp(scan);
        if (ts > latestScanMs) latestScanMs = ts;
      }

      const createdMs = typeof p.createdAt === 'number' && !isNaN(p.createdAt) ? p.createdAt : 0;
      const effectiveDateMs = Math.max(latestScanMs, createdMs);

      return {
        patient: p,
        scans: patientScans,
        scanCount: patientScans.length,
        displayName: getPatientDisplayName(p),
        numericAge: getNumericAge(p),
        effectiveDateMs,
      };
    });
  }, [patients, allRecords]);

  const filteredAndSortedPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = enrichedPatients.filter(({ patient: p, scanCount }) => {
      const matchesSearch =
        !query ||
        (p.mrn || '').toLowerCase().includes(query) ||
        (p.first_name || '').toLowerCase().includes(query) ||
        (p.last_name || '').toLowerCase().includes(query) ||
        `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase().includes(query);

      const matchesSex =
        sexFilter === 'All' ||
        (p.sex || '').toLowerCase() === sexFilter.toLowerCase();

      const matchesScans =
        scanFilter === 'all' ||
        (scanFilter === 'with_scans' && scanCount > 0) ||
        (scanFilter === 'no_scans' && scanCount === 0);

      return matchesSearch && matchesSex && matchesScans;
    });

    const dir = sortOrder === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return dir * a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
        case 'mrn':
          return dir * (a.patient.mrn || '').localeCompare(b.patient.mrn || '', undefined, { numeric: true, sensitivity: 'base' });
        case 'age': {
          if (a.numericAge === null && b.numericAge === null) return 0;
          if (a.numericAge === null) return 1;
          if (b.numericAge === null) return -1;
          return dir * (a.numericAge - b.numericAge);
        }
        case 'scans':
          return dir * (a.scanCount - b.scanCount);
        case 'date':
        default: {
          if (a.effectiveDateMs === b.effectiveDateMs) {
            return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
          }
          return dir * (a.effectiveDateMs - b.effectiveDateMs);
        }
      }
    });
  }, [enrichedPatients, search, sexFilter, scanFilter, sortBy, sortOrder]);

  const hasActiveFilters = search.trim() !== '' || sexFilter !== 'All' || scanFilter !== 'all';

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown size={12} className="opacity-40 group-hover/th:opacity-80 transition-opacity" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="text-[#0b5c92] dark:text-sky-400" /> : <ArrowDown size={12} className="text-[#0b5c92] dark:text-sky-400" />;
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100 flex items-center gap-3">
            <Users className="text-[#0b5c92]" size={32} />
            Patient Directory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage patient records and clinical history.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#0b5c92] hover:bg-blue-800 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-900/20 flex items-center gap-2 cursor-pointer"
        >
          <UserPlus size={18} />
          Register Patient
        </button>
      </div>

      <div className="card-surface p-6 mb-8">
        {/* Search, Filter & Sort Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input 
              type="text" 
              placeholder="Search by MRN or Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sex Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Filter size={13} className="text-slate-400 shrink-0" />
              <select
                value={sexFilter}
                onChange={(e) => setSexFilter(e.target.value)}
                aria-label="Filter by sex"
                className="bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="All">All</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Scans Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Activity size={13} className="text-slate-400 shrink-0" />
              <select
                value={scanFilter}
                onChange={(e) => setScanFilter(e.target.value as 'all' | 'with_scans' | 'no_scans')}
                aria-label="Filter by scan status"
                className="bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="all">All Patients</option>
                <option value="with_scans">With Scans</option>
                <option value="no_scans">No Scans Yet</option>
              </select>
            </div>

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <ArrowUpDown size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-400 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  const field = e.target.value as SortField;
                  setSortBy(field);
                  setSortOrder(field === 'date' || field === 'scans' ? 'desc' : 'asc');
                }}
                aria-label="Sort patients by"
                className="bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="mrn">MRN</option>
                <option value="age">Age</option>
                <option value="scans">Scans</option>
              </select>
            </div>

            {/* Asc / Desc Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title={`Currently sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`}
            >
              {sortOrder === 'asc' ? <ArrowUp size={14} className="text-[#0b5c92] dark:text-sky-400" /> : <ArrowDown size={14} className="text-[#0b5c92] dark:text-sky-400" />}
              <span>
                {sortBy === 'date'
                  ? (sortOrder === 'desc' ? 'Newest' : 'Oldest')
                  : sortBy === 'name' || sortBy === 'mrn'
                    ? (sortOrder === 'asc' ? 'A–Z' : 'Z–A')
                    : (sortOrder === 'asc' ? 'Low–High' : 'High–Low')}
              </span>
            </button>
          </div>
        </div>

        {/* Result Count & Active Filter Reset */}
        {!loading && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4 px-1">
            <span>
              Showing <strong className="text-slate-700 dark:text-slate-200">{filteredAndSortedPatients.length}</strong> of{' '}
              <strong className="text-slate-700 dark:text-slate-200">{patients.length}</strong> patients
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[#0b5c92] dark:text-sky-400 font-semibold hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-4 text-[#0b5c92]" />
            <p>Loading patient directory...</p>
          </div>
        ) : filteredAndSortedPatients.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No patients found</h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              {hasActiveFilters ? 'Try adjusting your search or filter criteria.' : 'Register a new patient to get started.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider pl-4">
                    <button type="button" onClick={() => handleSortHeader('mrn')} className="group/th inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                      <span>MRN</span>
                      {renderSortIcon('mrn')}
                    </button>
                  </th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSortHeader('name')} className="group/th inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                      <span>Patient Name</span>
                      {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSortHeader('age')} className="group/th inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                      <span>Age</span>
                      {renderSortIcon('age')}
                    </button>
                  </th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sex</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSortHeader('scans')} className="group/th inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                      <span>Scans</span>
                      {renderSortIcon('scans')}
                    </button>
                  </th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSortHeader('date')} className="group/th inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                      <span>Date</span>
                      {renderSortIcon('date')}
                    </button>
                  </th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredAndSortedPatients.map(({ patient: p, scanCount, displayName, effectiveDateMs }) => {
                  return (
                    <tr 
                      key={p.mrn} 
                      onClick={() => setSelectedPatient(p)}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    >
                      <td className="py-4 pl-4">
                        <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {p.mrn}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-deep-navy dark:text-slate-100 group-hover:text-[#0b5c92] dark:group-hover:text-blue-400 transition-colors">
                          {displayName}
                        </div>
                      </td>
                      <td className="py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {getDisplayAge(p)}
                      </td>
                      <td className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.sex}
                      </td>
                      <td className="py-4">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {scanCount} {scanCount === 1 ? 'scan' : 'scans'}
                        </span>
                      </td>
                      <td className="py-4 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateBadge(effectiveDateMs)}
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => navigate('/new-analysis', { state: { patient: p } })}
                            className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-[#0b5c92] dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Start New Analysis"
                          >
                            <Activity size={13} />
                            <span>Scan</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await deletePatient(p.mrn);
                                setPatients((prev: Patient[]) => prev.filter((x: Patient) => x.mrn !== p.mrn));
                                if (selectedPatient?.mrn === p.mrn) setSelectedPatient(null);
                                success('Patient removed from directory');
                              } catch {
                                showError('Could not delete patient');
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Delete Patient"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slide-over Drawer for Patient History ── */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-[#0b5c92] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {selectedPatient.mrn}
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedPatient.sex} • {getDisplayAge(selectedPatient)}
                  </span>
                </div>
                <h2 className="text-2xl font-display font-bold text-deep-navy dark:text-slate-100">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedPatient(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scans List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-deep-navy dark:text-slate-200 uppercase tracking-wider">
                  Analysis Records
                </h3>
                <button
                  onClick={() => navigate('/new-analysis', { state: { patient: selectedPatient } })}
                  className="text-xs font-bold text-[#0b5c92] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Activity size={13} /> Run New Scan
                </button>
              </div>

              {(() => {
                const patientScans = allRecords.filter((r: AnalysisRecord) => 
                  (r.patient_id && r.patient_id.toLowerCase() === selectedPatient.mrn.toLowerCase()) ||
                  ((r.patientName || (r as any).patient_name || '').toLowerCase() === `${selectedPatient.first_name} ${selectedPatient.last_name || ''}`.trim().toLowerCase())
                );

                if (patientScans.length === 0) {
                  return (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                      <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No scans recorded yet</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Start an AI-assisted analysis for this patient.</p>
                      <button
                        onClick={() => navigate('/new-analysis', { state: { patient: selectedPatient } })}
                        className="bg-[#0b5c92] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        Start First Analysis
                      </button>
                    </div>
                  );
                }

                return patientScans.map((scan: AnalysisRecord) => (
                  <div
                    key={scan.id}
                    onClick={() => {
                      setCurrentPatient(scan.id);
                      navigate('/results', {
                        state: {
                          results: { findings: scan.findings, report: scan.report },
                          clinicalText: scan.clinicalText,
                          imagePreview: scan.imagePreview,
                          recordId: scan.id,
                          date: scan.date,
                          patientName: scan.patientName || `${selectedPatient.first_name} ${selectedPatient.last_name}`
                        }
                      });
                    }}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-primary/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-sm text-deep-navy dark:text-slate-100 group-hover:text-[#0b5c92] transition-colors">
                        {scan.id}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar size={12} /> {scan.date}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {scan.topFinding?.disease || 'No Finding'}
                        </span>
                        <span className="text-slate-400 ml-1.5 font-mono">
                          {scan.topFinding?.probability}%
                        </span>
                      </div>
                      <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        View <ChevronRight size={14} />
                      </span>
                    </div>

                    {scan.clinicalText && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-2">
                        {scan.clinicalText}
                      </p>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-display font-bold text-deep-navy dark:text-slate-100">Register New Patient</h2>
              <p className="text-xs text-slate-500 mt-1">Enter patient demographics.</p>
            </div>
            
            <form onSubmit={handleSavePatient} className="p-6 flex-1 overflow-y-auto">
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
                    MRN <span className="font-normal text-slate-400 lowercase">(optional — auto-generated if blank)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPatient.mrn}
                      onChange={e => setNewPatient({...newPatient, mrn: e.target.value})}
                      className="flex-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Auto-generated unique MRN"
                    />
                    <button
                      type="button"
                      onClick={() => setNewPatient(prev => ({ ...prev, mrn: generateUniqueMrn(patients) }))}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      title="Generate unique MRN"
                    >
                      <RefreshCw size={13} />
                      <span>Generate</span>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">First Name</label>
                    <input required type="text" value={newPatient.first_name} onChange={e => setNewPatient({...newPatient, first_name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Last Name</label>
                    <input required type="text" value={newPatient.last_name} onChange={e => setNewPatient({...newPatient, last_name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Age</label>
                    <input type="number" min="0" max="130" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. 58" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sex</label>
                    <select required value={newPatient.sex} onChange={e => setNewPatient({...newPatient, sex: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-xl text-white font-bold bg-[#0b5c92] hover:bg-blue-800 transition-colors shadow-md shadow-blue-900/20 disabled:opacity-50 cursor-pointer">
                  {saving ? 'Saving...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
