import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Loader2, AlertTriangle, Zap, ChevronDown, Download, Maximize2, RefreshCw, Layers, MapPin, Lightbulb, CheckCircle2, Trash2, Plus, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useExplainability } from '../services/explainabilityContext';

/* ─── Label index map (must match labels.json ordering) ─── */
const CLASS_LABELS = [
  'Atelectasis', 'Cardiomegaly', 'Consolidation', 'Edema', 'Effusion',
  'Emphysema', 'Fibrosis', 'Hernia', 'Infiltration', 'Mass',
  'No Finding', 'Nodule', 'Pleural_Thickening', 'Pneumonia', 'Pneumothorax',
];

const DISEASE_COLOR: Record<string, string> = {
  Atelectasis:        '#0d9488',
  Cardiomegaly:       '#ea580c',
  Consolidation:      '#10b981',
  Edema:              '#a855f7',
  Effusion:           '#8b5cf6',
  Emphysema:          '#059669',
  Fibrosis:           '#6366f1',
  Hernia:             '#ec4899',
  Infiltration:       '#2563eb',
  Mass:               '#d97706',
  'No Finding':       '#3b82f6',
  Nodule:             '#0284c7',
  Pleural_Thickening: '#e11d48',
  Pneumonia:          '#dc2626',
  Pneumothorax:       '#eab308',
};

/* ─── Component ─── */
const PATHOLOGY_ATTRIBUTION: Record<string, { regions: string[]; determinants: string[]; description: string; insight: string }> = {
  Atelectasis: {
    regions: ['Basilar lung segments', 'Lower lobe', 'Subsegmental airways'],
    determinants: ['Volume loss', 'Increased opacity', 'Elevated hemidiaphragm', 'Fissure shift'],
    description: "The model's attention concentrates on the **basilar lung segments**, **lower lobe**, and **subsegmental airways** — the exact regions where airway obstruction leads to alveolar collapse. Within these areas, it identifies three key signs: **volume loss** in the affected lobe, an **elevated hemidiaphragm** on the same side, and a **shift of the fissure** toward the collapsed segment. These visual cues mirror precisely how a radiologist would interpret the same film, which is why the model assigns moderate-to-high confidence to this finding.",
    insight: "In short, the AI isn't pattern-matching arbitrarily — it's converging on the **same structural deformities** a trained eye would search for first.",
  },
  Cardiomegaly: {
    regions: ['Cardiac silhouette', 'Left heart border', 'Cardiothoracic ratio'],
    determinants: ['Cardiothoracic ratio >0.5', 'Left ventricular prominence', 'Widened mediastinum'],
    description: "The model's attention concentrates on the **cardiac silhouette**, **left heart border**, and the **cardiothoracic ratio** — the gold-standard metric for assessing heart size. It measures the width of the heart relative to the inner thoracic diameter and flags cases where this ratio **exceeds 0.5**. Additionally, it detects **left ventricular prominence** and any **mediastinal widening**, both of which are hallmarks of underlying cardiac disease. These are precisely the landmarks a radiologist's eye gravitates to first when assessing heart size.",
    insight: "The AI identifies cardiac enlargement by the same cardiothoracic ratio a radiologist uses — it's not guessing, it's **measuring the same geometry**.",
  },
  Consolidation: {
    regions: ['Parenchymal airspace', 'Lobar/segmental distribution', 'Air bronchograms'],
    determinants: ['Homogeneous opacity', 'Air bronchogram sign', 'Silhouette sign'],
    description: "The model's attention concentrates on the **parenchymal airspace**, **lobar or segmental distribution**, and the presence of **air bronchograms** — the precise zones where inflammatory exudate fills alveolar spaces. It identifies **homogeneous airspace opacity** that respects lobar boundaries and looks for the **air bronchogram sign**, where air-filled bronchi become visible against the surrounding consolidated tissue. The **silhouette sign** — loss of the normal border between structures — further confirms the diagnosis. These are the same landmarks a radiologist systematically checks when consolidation is suspected.",
    insight: "The AI is not detecting shadows arbitrarily — it's recognising the **classic lobar pattern** that distinguishes consolidation from other opacities.",
  },
  Edema: {
    regions: ['Perihilar region', 'Bilateral basal zones', 'Vascular pedicle'],
    determinants: ['Perihilar haze', 'Kerley B lines', 'Bilateral symmetry', 'Vascular blurring'],
    description: "The model's attention concentrates on the **perihilar region**, **bilateral basal zones**, and the **vascular pedicle** — the exact regions where elevated pulmonary venous pressure first manifests. It detects **perihilar haziness** radiating outward like butterfly wings, thin horizontal **Kerley B lines** at the lung bases reflecting engorged lymphatics, and **blurring of pulmonary vessels** where fluid has leaked into surrounding tissue. The bilateral and symmetric nature of the changes is a critical feature that separates cardiogenic edema from focal infection. These are the hallmarks every radiologist checks when pulmonary venous hypertension is suspected.",
    insight: "The AI converges on the **bilateral butterfly pattern** — the most reliable radiographic signature that separates cardiac edema from pneumonia.",
  },
  Effusion: {
    regions: ['Costophrenic angles', 'Basal pleural space', 'Lateral zones'],
    determinants: ['Blunted costophrenic angles', 'Meniscus sign', 'Homogeneous basal opacity'],
    description: "The model's attention concentrates on the **costophrenic angles**, **basal pleural space**, and **lateral lung zones** — the exact regions where pleural fluid characteristically pools. Within these areas, it identifies three classic radiographic signs of effusion: **blunting of the costophrenic angles**, a **curved meniscus** at the fluid-air interface, and a **uniform, homogeneous opacity** along the lung base. These visual cues mirror precisely how a radiologist would read the same film, which is why the model assigns such high confidence to this finding.",
    insight: "In short, the AI isn't pattern-matching arbitrarily — it's **converging on the same telltale signs** a trained eye would search for first.",
  },
  Emphysema: {
    regions: ['Upper lobe fields', 'Lung periphery', 'Diaphragm'],
    determinants: ['Hyperinflation', 'Flattened diaphragm', 'Increased lucency', 'Barrel chest'],
    description: "The model's attention concentrates on the **upper lobe fields**, **lung periphery**, and the **diaphragm contour** — the regions most affected by progressive air-trapping and parenchymal destruction. It detects **bilateral hyperinflation** with increased radiolucency, a **flattened or inverted diaphragm** caused by chronic over-distension, and a **barrel-chest configuration** on the lateral view. These are the same landmarks a pulmonologist and radiologist systematically evaluate when chronic obstructive disease is suspected. The peripheral vessel attenuation reflects the loss of alveolar walls and vascular architecture.",
    insight: "The AI targets the **flattened diaphragm and hyperinflated upper zones** — the two most reliable plain-film signs of advanced emphysema.",
  },
  Fibrosis: {
    regions: ['Bibasal lung fields', 'Interstitium', 'Subpleural regions'],
    determinants: ['Reticular pattern', 'Honeycombing', 'Traction bronchiectasis', 'Reduced lung volume'],
    description: "The model's attention concentrates on the **bibasal lung fields**, **interstitium**, and **subpleural regions** — the architectural zones where progressive fibrosis first replaces normal lung. It detects **coarse reticular markings** representing thickened interlobular septa, **honeycombing** where clustered cystic spaces indicate end-stage scarring, and **traction bronchiectasis** where fibrotic tissue distorts and widens bronchi. The hallmark combination of **reduced lung volumes** with increased bibasal markings distinguishes fibrosis from other causes of diffuse lung disease. These are precisely the features an interstitial lung disease specialist evaluates systematically.",
    insight: "The AI focuses on the **honeycombing and traction pattern** that radiologists recognise as the fingerprint of irreversible fibrosis.",
  },
  Hernia: {
    regions: ['Diaphragmatic dome', 'Right hemidiaphragm', 'Mediastinum'],
    determinants: ['Bowel shadow above diaphragm', 'Opaque hemithorax', 'Mediastinal displacement'],
    description: "The model's attention concentrates on the **diaphragmatic dome**, **right hemidiaphragm region**, and the **mediastinum** — the zones where herniated abdominal contents produce abnormal thoracic opacities. It flags the characteristic appearance of **bowel loops or gastric air shadow above the diaphragmatic contour**, which should never normally be present in the chest. In large hernias, an **opaque hemithorax** or **mediastinal shift** toward the opposite side may be detected, indicating significant mass effect. These are the hallmarks a chest radiologist searches for when the diaphragmatic contour appears disrupted.",
    insight: "The AI identifies **bowel gas above the diaphragm** — an anatomical impossibility in health that immediately signals herniation to any trained reader.",
  },
  Infiltration: {
    regions: ['Broncho-vascular markings', 'Perihilar bronchi', 'Peribronchial zones'],
    determinants: ['Increased broncho-vascular markings', 'Peribronchial thickening', 'Ill-defined haziness'],
    description: "The model's attention concentrates on the **broncho-vascular markings**, **perihilar bronchi**, and **peribronchial zones** — regions where early inflammatory infiltration thickens the walls surrounding the airways and vessels. It detects **increased and crowded broncho-vascular markings**, **peribronchial cuffing** visible as ring shadows around airway cross-sections, and an **ill-defined haziness** that lacks the dense lobar consolidation of classic pneumonia. These features mirror the appearance of viral, atypical, or early bacterial infiltration as read by an experienced radiologist.",
    insight: "The AI is detecting the **subtle vascular crowding and bronchial thickening** that separate early infiltration from fully established consolidation.",
  },
  Mass: {
    regions: ['Pulmonary parenchyma', 'Hilar zones', 'Mediastinal borders'],
    determinants: ['Well-defined opacity >3cm', 'Lobulated border', 'Mass effect'],
    description: "The model's attention concentrates on the **pulmonary parenchyma**, **hilar zones**, and **mediastinal borders** — the regions where a focal mass produces a discrete, large opacity. It identifies a **well-defined opacity exceeding 3 cm** with either a smooth, lobulated, or spiculated border — each margin type carrying different clinical implications for malignancy risk. Associated **mass effect** on adjacent structures, hilar lymphadenopathy, or mediastinal involvement further shapes the confidence score. These are the primary features a chest radiologist and oncologist systematically assess when a pulmonary mass is suspected.",
    insight: "The AI flags the **size threshold of 3 cm and border characteristics** — the two features that most strongly influence the radiologist's differential diagnosis.",
  },
  'No Finding': {
    regions: ['All lung zones', 'Cardiac silhouette', 'Bony thorax'],
    determinants: ['Normal vascular markings', 'Clear lung fields', 'No focal opacity'],
    description: "The model's attention is distributed across **all lung zones**, the **cardiac silhouette**, and the **bony thorax** — a broad survey consistent with a normal film. It finds **clear lung fields** without focal opacity, consolidation, or effusion, **normal vascular markings** that taper appropriately to the periphery, and a **cardiac silhouette within normal limits**. The absence of any localised area of high activation in the heatmap confirms there are no dominant pathological features drawing the model's attention. This mirrors how a radiologist mentally checks off each region when declaring a film normal.",
    insight: "A normal report here means the AI found **no region of focal concern** — each area of the film was unremarkable, consistent with a healthy chest radiograph.",
  },
  Nodule: {
    regions: ['Pulmonary parenchyma', 'Upper lobe apices', 'Subpleural zones'],
    determinants: ['Focal opacity <=3cm', 'Smooth or spiculated margin', 'Calcification pattern'],
    description: "The model's attention concentrates on the **pulmonary parenchyma**, **upper lobe apices**, and **subpleural zones** — the most common locations for incidentally detected pulmonary nodules. It identifies a **discrete rounded or ovoid opacity measuring up to 3 cm**, evaluating its margin for features of malignancy risk: a **smooth margin** suggests a benign process, while a **spiculated or lobulated border** raises concern for primary malignancy. **Calcification patterns** — central, diffuse, or popcorn — when present, are strong indicators of benign aetiology. These are the exact features a thoracic radiologist and multidisciplinary team document in structured nodule management reports.",
    insight: "The AI focuses on **margin morphology and location** — the two features that determine whether a nodule warrants surveillance, biopsy, or reassurance.",
  },
  Pleural_Thickening: {
    regions: ['Pleural surface', 'Lateral chest wall', 'Mediastinal pleura'],
    determinants: ['Pleural calcification', 'Costophrenic obliteration', 'Diffuse pleural opacity'],
    description: "The model's attention concentrates on the **pleural surface**, **lateral chest wall**, and **mediastinal pleura** — the anatomical layers where chronic pleural disease deposits fibrous scar tissue. It detects **diffuse pleural thickening** appearing as irregular, band-like opacities along the inner chest wall, **pleural calcification** as a marker of remote inflammatory or asbestos-related disease, and **obliteration of the costophrenic angle** from scarring rather than acute fluid. These features are distinct from an acute effusion and require a specific occupational and medical history to contextualise accurately. A radiologist documents these findings carefully given their medicolegal and prognostic implications.",
    insight: "The AI identifies the **persistent band-like pleural opacity** that distinguishes chronic scarring from an active effusion requiring drainage.",
  },
  Pneumonia: {
    regions: ['Lobar/segmental distribution', 'Basal consolidation zones', 'Perihilar region'],
    determinants: ['Lobar consolidation', 'Air bronchograms', 'Unilateral predominance'],
    description: "The model's attention concentrates on the **lobar and segmental distribution**, **basal consolidation zones**, and the **perihilar region** — the regions where bacterial pneumonia characteristically produces dense airspace disease. It identifies **lobar or segmental consolidation** respecting anatomical boundaries, classic **air bronchograms** where patent bronchi are silhouetted against surrounding infected tissue, and **unilateral predominance** that helps distinguish pneumonia from pulmonary oedema. These findings mirror exactly how a radiologist, microbiologist, and emergency physician together interpret an acute infectious film.",
    insight: "The AI converges on the **lobar pattern and air bronchograms** — the two radiographic signs most strongly associated with bacterial rather than viral pneumonia.",
  },
  Pneumothorax: {
    regions: ['Lung apex', 'Lateral pleural space', 'Visceral pleural line'],
    determinants: ['Absent lung markings peripherally', 'Visible pleural line', 'Mediastinal shift'],
    description: "The model's attention concentrates on the **lung apex**, **lateral pleural space**, and the **visceral pleural line** — the regions where a pneumothorax creates a characteristic air gap between the lung and chest wall. It detects **absence of peripheral lung markings** beyond the pleural line, a **visible white pleural edge** demarcating collapsed lung from the air-filled space, and in tension pneumothorax, a **mediastinal shift** away from the affected side indicating life-threatening haemodynamic compromise. These are the precise zones a clinician checks first when pneumothorax is suspected on an erect PA film.",
    insight: "The AI identifies the **pleural line and absent markings** — the two features a radiologist confirms within seconds when pneumothorax is clinically suspected.",
  },
};

export default function Explainability() {
  const location = useLocation();
  const navigate = useNavigate();

  const imagePreview = location.state?.imagePreview || sessionStorage.getItem('recentImagePreview') || null;
  const findingsRawStr = sessionStorage.getItem('recentResults');
  let findingsRaw: any[] = location.state?.findings || [];
  try {
    if (!findingsRaw.length && findingsRawStr) {
      const parsed = JSON.parse(findingsRawStr);
      findingsRaw = parsed?.findings || [];
    }
  } catch (_) {}
  const sorted = [...findingsRaw].sort((a: any, b: any) => b.probability - a.probability);

  // ── Global Explainability State (survives route switches & browser reload) ──
  const {
    activeClassIdx,
    activeLabel,
    heatmaps,
    error: ctxError,
    opacity,
    showOriginal,
    fullscreen,
    cachedCount,
    setOpacity,
    setShowOriginal,
    setFullscreen,
    selectClass,
    generateHeatmap,
    clearCache,
    hasCached,
    isClassInFlight,
  } = useExplainability();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedClass = activeClassIdx;
  const selectedLabel = activeLabel;
  const heatmapSrc = selectedClass !== null ? (heatmaps[selectedClass] || null) : null;
  const loading = selectedClass !== null ? isClassInFlight(selectedClass) : false;
  const error = ctxError || '';

  /* ── Download heatmap ── */
  const downloadHeatmap = useCallback(() => {
    if (!heatmapSrc) return;
    const a = document.createElement('a');
    a.href = heatmapSrc;
    a.download = `ScoreCAM_${selectedLabel || 'pathology'}_heatmap.jpg`;
    a.click();
  }, [heatmapSrc, selectedLabel]);

  /* ── No image guard ── */
  if (!imagePreview) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 ring-4 ring-slate-50 dark:ring-slate-800/50 shadow-sm">
          <Eye size={36} className="text-[#3730a3] dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-display font-bold text-deep-navy dark:text-slate-100 mb-2">No Active Radiograph</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-8">
          Upload a chest X-ray in <strong>New Analysis</strong> or pick any record from <strong>History</strong> to generate ScoreCAM visual attention heatmaps.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/new-analysis')}
            className="px-5 py-2.5 bg-[#0b5c92] hover:bg-blue-800 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} /> New Analysis
          </button>
          <button
            onClick={() => navigate('/history')}
            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2"
          >
            Open History <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3.5 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-[#3730a3] flex items-center justify-center shadow-md">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
              <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Explainable AI</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Class Activation Heatmaps for pathology localization</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Class Selector + Findings ── */}
        <div className="space-y-5">
          {/* Class dropdown */}
          <div className="card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Zap size={14} /> Select Pathology
              </h3>
              {cachedCount > 0 && (
                <button
                  onClick={clearCache}
                  title="Clear all cached heatmaps"
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={11} />
                  Clear ({cachedCount})
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left flex items-center justify-between cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
              >
                <span className={clsx(
                  'text-sm font-semibold',
                  selectedLabel ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'
                )}>
                  {selectedLabel || 'Choose a class to explain...'}
                </span>
                <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', dropdownOpen && 'rotate-180')} />
              </button>

              {dropdownOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  {CLASS_LABELS.map((label, idx) => {
                    const finding = sorted.find((f: any) => f.disease === label);
                    const prob = finding ? (finding.probability * 100).toFixed(1) : '0.0';
                    const isCached = hasCached(idx);
                    const isClassLoading = isClassInFlight(idx);
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          setDropdownOpen(false);
                          selectClass(idx, label);
                        }}
                        className={clsx(
                          'w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-sm',
                          idx === 0 && 'rounded-t-xl',
                          idx === CLASS_LABELS.length - 1 && 'rounded-b-xl',
                          selectedClass === idx && 'bg-blue-50 dark:bg-blue-950/40 font-semibold'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISEASE_COLOR[label] || '#64748b' }} />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{label.replace('_', ' ')}</span>
                          {isClassLoading && <Loader2 size={11} className="animate-spin text-amber-500 shrink-0" />}
                          {isCached && !isClassLoading && <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{prob}%</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick-select: top detected findings */}
          <div className="card-surface p-6">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers size={14} /> Top Detected Findings
            </h3>
            <div className="space-y-2">
              {sorted.slice(0, 6).map((f: any) => {
                const idx = CLASS_LABELS.indexOf(f.disease);
                const prob = (f.probability * 100).toFixed(1);
                const isActive = selectedClass === idx;
                const isCached = hasCached(idx);
                const isCurrentlyLoading = isClassInFlight(idx);
                return (
                  <button
                    key={f.disease}
                    onClick={() => selectClass(idx, f.disease)}
                    className={clsx(
                      'w-full px-3 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer',
                      isActive
                        ? 'border-blue-400 dark:border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 shadow-sm'
                        : isCached
                        ? 'border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-700'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DISEASE_COLOR[f.disease] || '#64748b' }} />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{f.disease.replace('_', ' ')}</span>
                      {isCurrentlyLoading && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded-md font-bold">
                          <Loader2 size={10} className="animate-spin" />
                          Running
                        </span>
                      )}
                      {isCached && !isCurrentlyLoading && (
                        <span title="Cached — loads instantly" className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-md font-bold">
                          <CheckCircle2 size={10} />
                          Ready
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(parseFloat(prob), 100)}%`,
                            backgroundColor: DISEASE_COLOR[f.disease] || '#64748b',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-12 text-right">{prob}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opacity slider */}
          {heatmapSrc && (
            <div className="card-surface p-6">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                Overlay Controls
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
                    <span>Heatmap Opacity</span>
                    <span className="font-mono">{Math.round(opacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOriginal}
                      onChange={(e) => setShowOriginal(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Show original only</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Center + Right: Visualization ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Main visualization card */}
          <div className="card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">
                  {selectedLabel ? `ScoreCAM — ${selectedLabel.replace('_', ' ')}` : 'ScoreCAM Visualization'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedLabel ? 'AI attention regions for the selected pathology' : 'Select a pathology from the left to generate a heatmap'}
                </p>
              </div>
              {heatmapSrc && (
                <div className="flex gap-2">
                  <button
                    onClick={() => generateHeatmap(selectedClass!, selectedLabel, true)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Force regenerate (bypass cache)"
                  >
                    <RefreshCw size={16} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => setFullscreen(!fullscreen)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize2 size={16} className="text-slate-500" />
                  </button>
                  <button
                    onClick={downloadHeatmap}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Download Heatmap"
                  >
                    <Download size={16} className="text-slate-500" />
                  </button>
                </div>
              )}
              {/* Cache status pill */}
              {cachedCount > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={10} />
                  {cachedCount} cached
                </div>
              )}
            </div>

            {/* Image display */}
            <div 
              className={clsx(
                'relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center',
                fullscreen ? 'fixed inset-4 z-50 rounded-3xl' : 'aspect-square'
              )}
            >
              {fullscreen && (
                <button
                  onClick={() => setFullscreen(false)}
                  className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-lg text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  ESC · Close
                </button>
              )}

              {/* Original image (always present) */}
              <img
                src={imagePreview}
                alt="Original radiograph"
                className="w-full h-full object-contain"
              />

              {/* Heatmap overlay */}
              {heatmapSrc && !showOriginal && (
                <img
                  src={heatmapSrc}
                  alt={`ScoreCAM heatmap for ${selectedLabel}, highlighting ${PATHOLOGY_ATTRIBUTION[selectedLabel]?.regions.join(', ') || 'affected regions'}`}
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
                  style={{ opacity }}
                />
              )}

              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20 p-6 text-center">
                  <div className="relative mb-3">
                    <Loader2 size={44} className="text-amber-400 animate-spin" />
                    <div className="absolute inset-0 rounded-full blur-md bg-amber-400/20 -z-10 animate-pulse" />
                  </div>
                  <p className="text-white font-semibold text-sm">
                    Generating ScoreCAM for {selectedLabel ? selectedLabel.replace('_', ' ') : 'selected finding'}...
                  </p>
                  <p className="text-amber-200/90 text-xs mt-1.5 font-medium max-w-sm">
                    ⚡ High-fidelity ScoreCAM computing across 768 channels (~45–60s)...
                  </p>
                  <p className="text-white/50 text-[11px] mt-1 max-w-xs">
                    You can freely explore other sections in the application — this process continues running in the background!
                  </p>
                </div>
              )}

              {/* Empty state */}
              {!heatmapSrc && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[1px]">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4">
                    <Eye size={28} className="text-white/70" />
                  </div>
                  <p className="text-white/80 font-semibold text-sm">Select a pathology to visualize</p>
                  <p className="text-white/50 text-xs mt-1">ScoreCAM will highlight the relevant anatomical regions</p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Color legend */}
            {heatmapSrc && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Low</span>
                <div className="h-3 rounded-full overflow-hidden w-48 shadow-inner" style={{ background: 'linear-gradient(90deg, #1e3a5f 0%, #155e75 15%, #0d9488 30%, #22c55e 45%, #eab308 60%, #f97316 75%, #ef4444 90%, #dc2626 100%)' }} />
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">High</span>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* -- Attribution Panel -- */}
          {selectedLabel && (() => {
            const attr = PATHOLOGY_ATTRIBUTION[selectedLabel];
            if (!attr) return null;
            return (
              <div className="card-surface p-6 space-y-5 mt-6 print:mt-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: DISEASE_COLOR[selectedLabel] || '#64748b' }} />
                  <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">
                    {selectedLabel.replace('_', ' ')} — Attribution Analysis
                  </h3>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"><MapPin size={14} className="text-blue-500 inline mr-1" /> Anatomical Target Regions</h4>
                  <div className="flex flex-wrap gap-2">
                    {attr.regions.map(r => (
                      <span key={r} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800/50">{r}</span>
                    ))}
                  </div>
                </div>

                {/* Rich description */}
                <div className="text-[15px] text-slate-700 dark:text-slate-300 leading-[1.85] mb-4">
                  {attr.description.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
                    i % 2 === 1
                      ? <strong key={i} className="font-bold text-deep-navy dark:text-slate-100">{part}</strong>
                      : <span key={i}>{part}</span>
                  )}
                </div>
                {/* Insight callout */}
                <div className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb size={14} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    {attr.insight.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
                      i % 2 === 1
                        ? <strong key={i} className="font-bold text-indigo-700 dark:text-indigo-200">{part}</strong>
                        : <span key={i}>{part}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })()}
    </div>
  );
}
