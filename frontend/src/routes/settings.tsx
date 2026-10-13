import { useState, useEffect } from 'react';
import { Sun, Moon, ShieldCheck, Info, CheckCircle2, RotateCcw, Sliders } from 'lucide-react';
import clsx from 'clsx';

export default function Settings() {
  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('app_theme') === 'light' ? 'light' : 'dark';
  });

  // Analysis Preferences
  const [showAllPredictions, setShowAllPredictions] = useState<boolean>(() => {
    return localStorage.getItem('pref_showAllPredictions') !== 'false';
  });
  const [highlightHighRisk, setHighlightHighRisk] = useState<boolean>(() => {
    return localStorage.getItem('pref_highlightHighRisk') !== 'false';
  });
  const [requireClinicalContext, setRequireClinicalContext] = useState<boolean>(() => {
    return localStorage.getItem('pref_requireClinicalContext') === 'true';
  });

  // Privacy
  const [storeHistory, setStoreHistory] = useState<boolean>(() => {
    return localStorage.getItem('pref_storeHistory') !== 'false';
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 2800);
  };

  useEffect(() => {
    const handleThemeEvent = () => {
      const current = localStorage.getItem('app_theme');
      setTheme(current === 'light' ? 'light' : 'dark');
    };
    window.addEventListener('storage', handleThemeEvent);
    window.addEventListener('themeChange', handleThemeEvent);
    return () => {
      window.removeEventListener('storage', handleThemeEvent);
      window.removeEventListener('themeChange', handleThemeEvent);
    };
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('themeChange'));
    showToast(`Theme updated to ${newTheme === 'dark' ? 'Dark' : 'Light'}`);
  };

  const handleToggle = (key: string, currentVal: boolean, setter: (val: boolean) => void, label: string) => {
    const newVal = !currentVal;
    setter(newVal);
    localStorage.setItem(key, String(newVal));
    showToast(`${label}: ${newVal ? 'Enabled' : 'Disabled'}`);
  };

  const handleResetDefaults = () => {
    handleThemeChange('light');
    setShowAllPredictions(true); localStorage.setItem('pref_showAllPredictions', 'true');
    setHighlightHighRisk(true); localStorage.setItem('pref_highlightHighRisk', 'true');
    setRequireClinicalContext(false); localStorage.setItem('pref_requireClinicalContext', 'false');
    setStoreHistory(true); localStorage.setItem('pref_storeHistory', 'true');
    showToast('Settings reset to defaults');
  };

  return (
    <div className="max-w-3xl mx-auto pb-16 animate-in fade-in duration-500">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-deep-navy text-white dark:bg-slate-800 dark:text-slate-100 px-4 py-3 rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Personalise application preferences and privacy configuration.</p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RotateCcw size={14} /> Reset Defaults
        </button>
      </div>

      <div className="space-y-6">

        {/* Appearance */}
        <div className="card-surface p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">Appearance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose your preferred colour theme.</p>
            </div>
            <div className="text-primary dark:text-blue-400"><Sun size={20} /></div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => handleThemeChange('light')}
              className={clsx(
                'flex-1 p-4 rounded-2xl text-left border-2 transition-all cursor-pointer',
                theme === 'light'
                  ? 'border-primary bg-primary text-white shadow-md shadow-blue-900/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              )}
            >
              <Sun size={20} className="mb-2" />
              <div className="font-bold text-sm">Light</div>
              <div className={clsx('text-[10px] font-semibold mt-1', theme === 'light' ? 'text-blue-100' : 'text-slate-400')}>Bright clinical default</div>
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={clsx(
                'flex-1 p-4 rounded-2xl text-left border-2 transition-all cursor-pointer',
                theme === 'dark'
                  ? 'border-primary bg-slate-900 text-white shadow-md shadow-slate-900/40'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              )}
            >
              <Moon size={20} className="mb-2" />
              <div className="font-bold text-sm">Dark</div>
              <div className={clsx('text-[10px] font-semibold mt-1', theme === 'dark' ? 'text-slate-300' : 'text-slate-400')}>High contrast reading</div>
            </button>
          </div>
        </div>

        {/* Analysis Preferences */}
        <div className="card-surface p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">Analysis Preferences</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Defaults applied to new inference sessions.</p>
            </div>
            <div className="text-violet-500"><Sliders size={20} /></div>
          </div>
          <div className="space-y-4">
            {[
              { key: 'pref_showAllPredictions', val: showAllPredictions, setter: setShowAllPredictions, label: 'Show all 15 predictions', desc: 'Display the full label set on the results page.' },
              { key: 'pref_highlightHighRisk', val: highlightHighRisk, setter: setHighlightHighRisk, label: 'Highlight high-probability labels', desc: 'Emphasise findings above 50% with visual accents.' },
              { key: 'pref_requireClinicalContext', val: requireClinicalContext, setter: setRequireClinicalContext, label: 'Require clinical context', desc: 'Prompt when patient symptoms or vitals are empty.' },
            ].map(({ key, val, setter, label, desc }) => (
              <div
                key={key}
                role="switch"
                aria-checked={val}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggle(key, val, setter, label); } }}
                onClick={() => handleToggle(key, val, setter, label)}
                className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900"
              >
                <div className="pr-4">
                  <div className="font-bold text-sm text-deep-navy dark:text-slate-100">{label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
                </div>
                <div className={clsx('w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 shadow-inner', val ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700')}>
                  <div className={clsx('w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200', val ? 'translate-x-6' : 'translate-x-0')} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div className="card-surface p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">Privacy</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Control how data is stored in this browser.</p>
            </div>
            <div className="text-slate-400"><ShieldCheck size={20} /></div>
          </div>
          <div
            role="switch"
            aria-checked={storeHistory}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggle('pref_storeHistory', storeHistory, setStoreHistory, 'Store analysis history'); } }}
            onClick={() => handleToggle('pref_storeHistory', storeHistory, setStoreHistory, 'Store analysis history')}
            className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900"
          >
            <div className="pr-4">
              <div className="font-bold text-sm text-deep-navy dark:text-slate-100">Store analysis history</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cache recent inference results in browser storage for the History view.</div>
            </div>
            <div className={clsx('w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 shadow-inner', storeHistory ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700')}>
              <div className={clsx('w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200', storeHistory ? 'translate-x-6' : 'translate-x-0')} />
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card-surface p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">About CliniFusionX</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Multimodal AI Clinical Decision Support Platform.</p>
            </div>
            <div className="text-slate-400"><Info size={20} /></div>
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            CliniFusionX is an advanced multimodal AI clinical decision support platform designed to assist healthcare professionals by synthesizing chest radiograph image findings with patient clinical context for diagnostic evaluation and streamlined reporting.
          </p>

          <p className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
            Research Prototype • Decision Support Only • Not for Unsupervised Clinical Diagnosis
          </p>
        </div>

      </div>
    </div>
  );
}
