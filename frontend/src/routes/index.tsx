import { useState, useEffect } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ScanLine, Layers, TrendingUp, Box, User } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { 
  getHistory, 
  getTotalAnalysesCount, 
  getActivityTrend, 
  setCurrentPatient, 
  type AnalysisRecord,
  type ActivityPoint 
} from '../services/historyService';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 min-w-[140px]">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p: any) => (
            <div key={p.name} className="flex justify-between items-center text-sm font-semibold">
              <span className="capitalize text-slate-600 dark:text-slate-300">{p.name}:</span>
              <span className="num font-bold" style={{ color: p.color }}>{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const DISEASE_COLORS: Record<string, string> = {
  'Effusion': '#8b5cf6', 'Cardiomegaly': '#ea580c', 'Atelectasis': '#0d9488',
  'Infiltration': '#2563eb', 'Pleural_Thickening': '#e11d48', 'Nodule': '#0284c7',
  'Consolidation': '#10b981', 'Edema': '#a855f7', 'Mass': '#d97706',
  'No Finding': '#3b82f6', 'Pneumonia': '#dc2626', 'Pneumothorax': '#eab308',
  'Emphysema': '#059669', 'Fibrosis': '#6366f1', 'Hernia': '#ec4899',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const records = await getHistory();
      setHistory(records);
      setTotalCount(await getTotalAnalysesCount());
      setActivity(await getActivityTrend());
    };
    fetchData();
  }, []);

  const recentAnalyses = history.slice(0, 3);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Your clinical workspace for chest radiograph analysis.</p>
      </div>

      {/* Hero Banner */}
      <div className="bg-[#0b5c92] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-display font-bold mb-3">Multimodal Clinical Intelligence</h2>
          <p className="text-blue-50 max-w-xl mb-8 opacity-90">
            Upload a chest radiograph and receive AI-powered findings combined with clinical context.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/new-analysis')}
              className="bg-white text-[#0b5c92] hover:bg-slate-50 px-6 py-2.5 rounded-full font-bold text-sm transition-colors shadow-sm flex items-center gap-2 cursor-pointer">
              <ScanLine size={16} /> New Analysis
            </button>
            <button 
              onClick={() => navigate('/history')}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-colors backdrop-blur-sm cursor-pointer">
              View History
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-surface">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Analyses</h3>
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Layers size={16} /></div>
          </div>
          <div className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100 mb-1 num">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp size={12} className="text-emerald-500" /> Total recorded analyses
          </div>
        </div>

        <div className="card-surface flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quick Actions</h3>
            <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center"><Activity size={16} /></div>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => navigate('/new-analysis')}
              className="flex-1 py-2 text-sm font-semibold bg-[#0b5c92] hover:bg-blue-800 text-white rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <ScanLine size={14} /> New Analysis
            </button>
            <button
              onClick={() => navigate('/history')}
              className="flex-1 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Box size={14} /> History
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="card-surface p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-deep-navy dark:text-slate-100 text-lg">Weekly Analysis Activity</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Breakdown of radiograph submissions and generated reports by day.</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-[#3b82f6]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span> Analyses
            </div>
            <div className="flex items-center gap-1.5 text-[#14b8a6]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]"></span> Reports Generated
            </div>
          </div>
        </div>
        <div className="h-72 w-full p-6 pt-8 bg-slate-50/50 dark:bg-slate-900/40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAnalyses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="analyses" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAnalyses)" name="analyses" />
              <Area type="monotone" dataKey="reports" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" name="reports" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latest Analyses */}
      <div className="card-surface">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-display font-bold text-deep-navy dark:text-slate-100 text-lg">Latest Analyses</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Most recent radiograph submissions and their leading finding.</p>
          </div>
          <button 
            onClick={() => navigate('/history')}
            className="text-sm font-semibold text-primary hover:text-blue-700 transition-colors cursor-pointer"
          >
            All history ↗
          </button>
        </div>

        {recentAnalyses.length === 0 ? (
          <div className="text-center py-16">
            <ScanLine size={36} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">No analyses yet</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Run a New Analysis to get started.</p>
            <button
              onClick={() => navigate('/new-analysis')}
              className="mt-5 px-6 py-2.5 bg-[#0b5c92] hover:bg-blue-800 text-white text-sm font-bold rounded-full transition-colors cursor-pointer shadow-sm"
            >
              Start Your First Analysis
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentAnalyses.map((item) => {
              const topDisease = item.topFinding?.disease || (item as any).top_finding?.disease || 'No Finding';
              const topProb = item.topFinding?.probability ?? (item as any).top_finding?.probability ?? 0;
              const diseaseColor = item.topFinding?.color || DISEASE_COLORS[topDisease] || '#8b5cf6';
              return (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setCurrentPatient(item.id);
                    navigate('/results', { 
                      state: { 
                        results: { findings: item.findings, report: item.report }, 
                        clinicalText: item.clinicalText, 
                        imagePreview: item.imagePreview,
                        recordId: item.id,
                        date: item.date,
                        patientName: item.patientName || (item as any).patient_name || ''
                      } 
                    });
                  }}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-primary/40 transition-colors shadow-sm bg-white dark:bg-slate-900/50 cursor-pointer group"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {item.imagePreview ? (
                        <img src={item.imagePreview} alt={item.id} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">
                          <Activity size={18} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <h4 className="font-bold text-deep-navy dark:text-slate-100 truncate">{item.id}</h4>
                          {(item.patientName || (item as any).patient_name) && (
                            <p className="text-xs font-semibold text-[#0b5c92] dark:text-blue-300 truncate flex items-center gap-1 mt-0.5">
                              <User size={11} className="shrink-0" />
                              <span className="truncate">{item.patientName || (item as any).patient_name}</span>
                            </p>
                          )}
                        </div>
                        <span className={clsx(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0",
                          item.status === 'Completed' ? "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" : "bg-emerald-100 text-emerald-700"
                        )}>{item.status}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.date}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm font-semibold mb-1.5">
                      <span className="text-deep-navy dark:text-slate-200 truncate">{topDisease}</span>
                      <span className="text-slate-500 dark:text-slate-400 num ml-2">{topProb}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ width: `${Math.max(topProb, 2)}%`, backgroundColor: diseaseColor }}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPatient(item.id);
                      sessionStorage.setItem('recentResults', JSON.stringify({ findings: item.findings, report: item.report }));
                      if (item.clinicalText) sessionStorage.setItem('recentClinicalText', item.clinicalText);
                      if (item.imagePreview) sessionStorage.setItem('recentImagePreview', item.imagePreview);
                      navigate('/report', { state: { reportText: item.report, recordId: item.id, date: item.date } });
                    }}
                    className="w-full py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ScanLine size={14} /> View Report
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
