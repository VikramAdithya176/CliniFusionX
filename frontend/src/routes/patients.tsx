import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Users, Activity, Loader2, Calendar, FileText, ChevronRight, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { type Patient, getPatients, registerPatient, deletePatient } from '../services/patientService';
import { getHistory, type AnalysisRecord, setCurrentPatient } from '../services/historyService';

function calculateAge(dob?: string): string {
  if (!dob || dob === 'N/A') return '—';
  const yr = parseInt(dob.split('-')[0], 10);
  if (isNaN(yr) || yr < 1900) return '—';
  const age = new Date().getFullYear() - yr;
  return `${age} yrs`;
}

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allRecords, setAllRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Slide-over drawer state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ mrn: '', first_name: '', last_name: '', date_of_birth: '', sex: '' });
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
        mrn: newPatient.mrn,
        date_of_birth: newPatient.date_of_birth,
        sex: newPatient.sex,
      });
      
      setShowModal(false);
      setNewPatient({ mrn: '', first_name: '', last_name: '', date_of_birth: '', sex: '' });
      await fetchPatients();
      success('Patient registered successfully!');
    } catch (err: any) {
      showError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = patients.filter((p: Patient) => 
    (p.mrn || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.last_name || '').toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 mb-6">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by MRN or Name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-4 text-[#0b5c92]" />
            <p>Loading patient directory...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No patients found</h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">Register a new patient to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider pl-4">MRN</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Name</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">DOB</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Age</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sex</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Scans</th>
                  <th className="pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredPatients.map((p: Patient) => {
                  const patientScans = allRecords.filter((r: AnalysisRecord) => 
                    (r.patient_id && r.patient_id.toLowerCase() === p.mrn.toLowerCase()) ||
                    ((r.patientName || (r as any).patient_name || '').toLowerCase() === `${p.first_name} ${p.last_name || ''}`.trim().toLowerCase())
                  );

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
                          {p.last_name ? (p.first_name ? `${p.last_name}, ${p.first_name}` : p.last_name) : (p.first_name || 'Unnamed Patient')}
                        </div>
                      </td>
                      <td className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.date_of_birth}
                      </td>
                      <td className="py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {calculateAge(p.date_of_birth)}
                      </td>
                      <td className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.sex}
                      </td>
                      <td className="py-4">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {patientScans.length} {patientScans.length === 1 ? 'scan' : 'scans'}
                        </span>
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
                    {selectedPatient.sex} • {calculateAge(selectedPatient.date_of_birth)}
                  </span>
                </div>
                <h2 className="text-2xl font-display font-bold text-deep-navy dark:text-slate-100">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">DOB: {selectedPatient.date_of_birth}</p>
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
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">MRN</label>
                  <input required type="text" value={newPatient.mrn} onChange={e => setNewPatient({...newPatient, mrn: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Medical Record Number" />
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
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Date of Birth</label>
                    <input required type="date" value={newPatient.date_of_birth} onChange={e => setNewPatient({...newPatient, date_of_birth: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
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
