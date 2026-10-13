import { useState, useEffect } from 'react';
import { 
  Search, Filter, Trash2, Calendar, FileText, ScanLine, 
  AlertCircle, Plus, CheckCircle2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getHistory, deleteAnalysis, clearHistory, setCurrentPatient, type AnalysisRecord } from '../services/historyService';

const DISEASE_COLORS: Record<string, string> = {
  'Effusion': '#8b5cf6',
  'Cardiomegaly': '#ea580c',
  'Atelectasis': '#0d9488',
  'Infiltration': '#2563eb',
  'Pleural_Thickening': '#e11d48',
  'Nodule': '#0284c7',
  'Consolidation': '#10b981',
  'Edema': '#a855f7',
  'Mass': '#d97706',
  'No Finding': '#3b82f6',
  'Pneumonia': '#dc2626',
  'Pneumothorax': '#eab308',
  'Emphysema': '#059669',
  'Fibrosis': '#6366f1',
  'Hernia': '#ec4899',
};

export default function PatientHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  useEffect(() => {
    getHistory().then(setRecords);
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete analysis record ${id}?`)) {
      const updated = await deleteAnalysis(id);
      setRecords(updated);
      showToast(`Record ${id} deleted.`);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all analysis history?')) {
      await clearHistory();
      setRecords([]);
      showToast('All history cleared.');
    }
  };

  const handleRestoreDefaults = async () => {
    // Only needed for Guest or legacy localStorage, 
    // but we can just reload history for now.
    const updated = await getHistory();
    setRecords(updated);
    showToast('Sample records restored.');
  };

  const handleOpenResults = (item: AnalysisRecord) => {
    setCurrentPatient(item.id);
    sessionStorage.setItem('recentResults', JSON.stringify({ findings: item.findings, report: item.report }));
    if (item.clinicalText) sessionStorage.setItem('recentClinicalText', item.clinicalText);
    if (item.imagePreview) sessionStorage.setItem('recentImagePreview', item.imagePreview);
    navigate('/results', { 
      state: { 
        results: { findings: item.findings, report: item.report }, 
        clinicalText: item.clinicalText, 
        imagePreview: item.imagePreview,
        recordId: item.id,
        date: item.date
      } 
    });
  };

  const handleOpenReport = (item: AnalysisRecord) => {
    setCurrentPatient(item.id);
    sessionStorage.setItem('recentResults', JSON.stringify({ findings: item.findings, report: item.report }));
    if (item.clinicalText) sessionStorage.setItem('recentClinicalText', item.clinicalText);
    if (item.imagePreview) sessionStorage.setItem('recentImagePreview', item.imagePreview);
    navigate('/report', { 
      state: { 
        reportText: item.report,
        recordId: item.id,
        date: item.date
      } 
    });
  };

  // Levenshtein distance for fuzzy typo matching
  const levenshteinDistance = (a: string, b: string): number => {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = [];
    for (let i = 0; i <= m; i++) dp[i] = [i];
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  const fuzzyMatch = (query: string, text: string): boolean => {
    if (!query) return true;
    if (!text) return false;
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();

    // 1. Direct substring match
    if (t.includes(q)) return true;

    // 2. Tokenized match (all words present)
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every(tok => t.includes(tok))) {
      return true;
    }

    // 3. Subsequence match (fzf style)
    let qIdx = 0;
    for (let i = 0; i < t.length && qIdx < q.length; i++) {
      if (t[i] === q[qIdx]) qIdx++;
    }
    if (qIdx === q.length) return true;

    // 4. Word-level typo matching with Levenshtein
    if (q.length >= 3) {
      const words = t.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 3);
      const maxAllowed = q.length <= 4 ? 1 : 2;
      for (const w of words) {
        if (Math.abs(w.length - q.length) <= 2) {
          if (levenshteinDistance(q, w) <= maxAllowed) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Filter records with enhanced Fuzzy Search
  const filteredRecords = records.filter((r) => {
    const topDisease = r.topFinding?.disease || (r as any).top_finding?.disease || 'No Finding';
    const recordSearchCorpus = [
      r.id,
      topDisease,
      r.clinicalText || (r as any).clinical_text || '',
      r.status,
      r.date,
      ...(r.findings?.map(f => f.disease) || []),
      typeof r.report === 'string' ? r.report : Object.values(r.report || {}).join(' ')
    ].join(' ');

    const matchesSearch = !searchTerm.trim() || fuzzyMatch(searchTerm, recordSearchCorpus);
    const matchesDisease = selectedDisease === 'All' || 
      topDisease === selectedDisease ||
      r.findings?.some(f => f.disease === selectedDisease && (f.probability >= 0.2 || f.detected));

    return matchesSearch && matchesDisease;
  });

  const allDiseases = Array.from(new Set(records.map(r => r.topFinding?.disease || (r as any).top_finding?.disease || 'No Finding'))).filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto pb-16 animate-in fade-in duration-500">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500 text-sm font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Patient Analysis History</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review past chest radiograph interpretations, AI findings, and clinical records.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/new-analysis')}
            className="bg-[#0b5c92] hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Plus size={16} /> New Analysis
          </button>
          {records.length > 0 && (
            <button
              onClick={handleClearAll}
              className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              title="Clear all records"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-surface p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by record ID, disease, or symptoms..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-deep-navy dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-slate-400 shrink-0" />
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer w-full sm:w-auto"
          >
            <option value="All">All Pathologies ({records.length})</option>
            {allDiseases.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* History Records List */}
      {filteredRecords.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={26} />
          </div>
          <h3 className="text-lg font-bold text-deep-navy dark:text-slate-100 mb-1">No analysis records found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {searchTerm || selectedDisease !== 'All' 
              ? 'Try changing your search keywords or disease filter.' 
              : "You haven't completed any radiograph analyses yet. Submit your first chest X-ray to build patient history."}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/new-analysis')}
              className="bg-[#0b5c92] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
            >
              <Plus size={16} /> Run First Analysis
            </button>
            {records.length === 0 && (
              <button
                onClick={handleRestoreDefaults}
                className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Load Sample Records
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((item, idx) => {
            const topDisease = item.topFinding?.disease || (item as any).top_finding?.disease || 'No Finding';
            const topProb = item.topFinding?.probability ?? (item as any).top_finding?.probability ?? 0;
            const diseaseColor = item.topFinding?.color || DISEASE_COLORS[topDisease] || '#8b5cf6';
            return (
              <div 
                key={`${item.id}-${item.timestamp || idx}`}
                onClick={() => handleOpenResults(item)}
                className="card-surface p-6 hover:border-primary/40 transition-all border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-18 h-18 sm:w-20 sm:h-20 bg-slate-900 rounded-2xl overflow-hidden shrink-0 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      {item.imagePreview ? (
                        <img src={item.imagePreview} alt={item.id} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">
                          <ScanLine size={24} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">{item.id}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          {item.status}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
                          <Calendar size={13} /> {item.date}
                        </span>
                      </div>

                      {/* Primary Finding Bar */}
                      <div className="flex items-center gap-3 my-2 max-w-md">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: diseaseColor }}
                          />
                          <span className="font-bold text-sm text-deep-navy dark:text-slate-200">
                            {topDisease}
                          </span>
                        </div>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(topProb, 2)}%`, backgroundColor: diseaseColor }}
                          />
                        </div>
                        <span className="text-sm font-bold text-deep-navy dark:text-slate-100 num shrink-0">
                          {topProb}%
                        </span>
                      </div>

                      {/* Clinical Text Preview */}
                      {item.clinicalText && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {item.clinicalText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenResults(item);
                      }}
                      className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ScanLine size={14} /> Results
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReport(item);
                      }}
                      className="px-4 py-2 bg-[#0b5c92] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <FileText size={14} /> View Report
                    </button>

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer ml-1"
                      title="Delete record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
