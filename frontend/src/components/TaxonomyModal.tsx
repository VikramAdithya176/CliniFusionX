import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  flow: <path d="M3 7h11l-3-3M3 12h14M3 17h11l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  hex: <path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>,
  layers: <><path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><path d="M4 12l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><path d="M4 16.5L12 21l8-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/></>,
  pulse: <path d="M3 12h4l2-6 4 12 2-9 2 3h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  cube: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><path d="M4 7.5L12 12l8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/></>,
  warn: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></>,
  diamond: <path d="M12 3l5 9-5 9-5-9 5-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
};

const OUTLOOK_COLORS: Record<string, string> = {
  good: '#2FAE72',
  ok: '#E0A02E',
  watch: '#4C8DFF',
  bad: '#E15C6D',
  neutral: '#8891A8'
};

export const TAXONOMY_DATA = [
  {
    id: 'effusion', name: 'Effusion', icon: 'flow', color: '#7C6FF0', bg: '#F1EEFE',
    tagline: 'Fluid accumulation in the pleural cavity',
    definition: 'Pleural effusion is the build-up of excess fluid in the thin space between the lung�s outer lining and the chest wall (the pleural cavity). On imaging it shows as blunting of the lower lung border, often on one side.',
    symptoms: ['Shortness of breath, worse when lying flat', 'Sharp chest pain that worsens with breathing', 'Dry, persistent cough', 'A feeling of heaviness or fullness in the chest'],
    riskFactors: ['Heart failure', 'Pneumonia or lung infection', 'Cancer (lung or metastatic)', 'Liver or kidney disease', 'Recent chest surgery'],
    outlook: 'ok', outlookLabel: 'Treatable � depends on cause',
    outlookText: 'Fluid can be drained (thoracentesis) for quick relief; long-term outlook tracks the underlying condition causing it.',
    zones: ['pleuraL','pleuraR','lowerL','lowerR'], regionNote: 'Typically pools at the base of one or both lungs, along the pleural lining, due to gravity.'
  },
  {
    id: 'pneumonia', name: 'Pneumonia', icon: 'hex', color: '#E39323', bg: '#FDF1DF',
    tagline: 'Infective consolidation and exudation',
    definition: 'Pneumonia is an infection � bacterial, viral, or fungal � that inflames the air sacs (alveoli) in one or both lungs, filling them with fluid or pus.',
    symptoms: ['Fever, chills and sweating', 'Cough producing thick or discolored phlegm', 'Chest pain that sharpens with breathing or coughing', 'Fatigue and shortness of breath'],
    riskFactors: ['Age under 2 or over 65', 'Smoking', 'Chronic illness (diabetes, heart or lung disease)', 'Weakened immune system', 'Recent viral respiratory infection'],
    outlook: 'good', outlookLabel: 'Usually curable',
    outlookText: 'Most cases clear within 1�3 weeks with appropriate antibiotics or antivirals. Older adults and immunocompromised patients need closer monitoring.',
    zones: ['lowerR','midR'], regionNote: 'Can affect any lobe, but often localizes to one lower or middle lung zone first.'
  },
  {
    id: 'atelectasis', name: 'Atelectasis', icon: 'layers', color: '#2FB6A6', bg: '#E3F7F3',
    tagline: 'Subsegmental volume-loss & alveolar collapse',
    definition: 'Atelectasis is the partial or complete collapse of part of a lung, usually because a small airway is blocked by mucus or compressed from outside, so the air sacs deflate.',
    symptoms: ['Often no symptoms if the collapsed area is small', 'Shortness of breath', 'Shallow, rapid breathing', 'Mild cough or chest discomfort'],
    riskFactors: ['Recent abdominal or chest surgery', 'Prolonged bed rest or shallow breathing', 'Mucus plugging (common in asthma, COPD)', 'Tumor or foreign object blocking an airway'],
    outlook: 'good', outlookLabel: 'Usually reversible',
    outlookText: 'Once the blockage or compression is treated � often with breathing exercises, physiotherapy, or clearing mucus � the lung typically re-expands.',
    zones: ['lowerL','lowerR'], regionNote: 'Most common in the lower lobes, especially after surgery when breathing is shallow.'
  },
  {
    id: 'infiltration', name: 'Infiltration', icon: 'flow', color: '#4C8DFF', bg: '#EAF1FF',
    tagline: 'Diffuse parenchymal opacities & fluid',
    definition: 'Infiltration describes any substance � fluid, cells, or inflammatory material � accumulating diffusely within lung tissue, seen as hazy or patchy opacities rather than a single defined mass.',
    symptoms: ['Persistent cough', 'Progressive breathlessness', 'Fatigue', 'Symptoms that vary widely depending on the underlying cause'],
    riskFactors: ['Respiratory infections', 'Inflammatory or autoimmune lung disease', 'Environmental or occupational dust exposure', 'Allergic reactions in the lung'],
    outlook: 'watch', outlookLabel: 'Depends on cause',
    outlookText: 'Infective causes usually resolve with treatment; inflammatory or fibrotic causes need longer-term, specialist management.',
    zones: ['upperL','upperR','midL','midR','lowerL','lowerR'], regionNote: 'Usually bilateral and diffuse rather than confined to one zone.'
  },
  {
    id: 'cardiomegaly', name: 'Cardiomegaly', icon: 'pulse', color: '#E15C6D', bg: '#FDEBEE',
    tagline: 'Enlarged cardiac silhouette (CTR > 0.50)',
    definition: 'Cardiomegaly means the heart appears enlarged on a chest X-ray, measured as a cardiothoracic ratio greater than 0.50 (the heart�s width exceeds half the chest�s width).',
    symptoms: ['Shortness of breath, especially on exertion or lying down', 'Fatigue', 'Swelling in the legs, ankles or abdomen', 'Irregular or rapid heartbeat'],
    riskFactors: ['Long-standing high blood pressure', 'Heart valve disease', 'Cardiomyopathy', 'Coronary artery disease', 'Obesity'],
    outlook: 'ok', outlookLabel: 'Chronic � manageable',
    outlookText: 'Rarely reverses completely, but medication, lifestyle changes, and treating the underlying cause can stabilize heart size and symptoms.',
    zones: ['heart'], regionNote: 'Confined to the cardiac silhouette in the center of the chest.'
  },
  {
    id: 'consolidation', name: 'Consolidation', icon: 'cube', color: '#5B6EF5', bg: '#ECEEFF',
    tagline: 'Dense alveolar filling with air replaced',
    definition: 'Consolidation occurs when air in the alveoli is replaced by fluid, pus, blood or cells, producing a dense, well-defined white area on imaging. It is a hallmark of pneumonia but can have other causes.',
    symptoms: ['Fever and chills', 'Productive cough', 'Pleuritic chest pain', 'Rapid, shallow breathing'],
    riskFactors: ['Bacterial or viral pneumonia', 'Aspiration of food, liquid or vomit', 'Pulmonary hemorrhage', 'Weakened immune defenses'],
    outlook: 'good', outlookLabel: 'Usually curable',
    outlookText: 'When infection is the cause, consolidation typically resolves fully within a few weeks of appropriate treatment.',
    zones: ['midR','lowerR'], regionNote: 'Usually localized to one lobe or segment rather than spread throughout the lung.'
  },
  {
    id: 'edema', name: 'Edema', icon: 'flow', color: '#29B6C9', bg: '#E3F6FA',
    tagline: 'Hydrostatic pulmonary interstitial fluid',
    definition: 'Pulmonary edema is fluid leaking into the lung�s interstitial tissue and air sacs, most often because the heart cannot pump efficiently and pressure backs up into the lungs.',
    symptoms: ['Severe, sudden breathlessness', 'Wheezing or gasping for air', 'Coughing up pink, frothy sputum', 'Rapid heartbeat and anxiety'],
    riskFactors: ['Congestive heart failure', 'Kidney disease', 'Heart attack or severe hypertension', 'High altitude exposure'],
    outlook: 'ok', outlookLabel: 'Treatable � can recur',
    outlookText: 'Often responds quickly to diuretics and oxygen, but it can be a medical emergency and tends to recur if the underlying heart or kidney condition isn�t controlled.',
    zones: ['lowerL','lowerR','midL','midR'], regionNote: 'Typically bilateral and gravity-dependent, most prominent at the lung bases.'
  },
  {
    id: 'nodule', name: 'Nodule', icon: 'diamond', color: '#A66BF0', bg: '#F5EDFE',
    tagline: 'Focal parenchymal lesion = 3 cm',
    definition: 'A pulmonary nodule is a small, round spot of tissue no larger than 3 cm, usually found incidentally on a chest X-ray or CT scan.',
    symptoms: ['Almost always none � nodules are usually found by chance on imaging done for another reason'],
    riskFactors: ['Smoking history', 'Prior lung infections (tuberculosis, fungal disease)', 'Family history of lung cancer', 'Occupational exposure to dust or chemicals'],
    outlook: 'watch', outlookLabel: 'Often benign � monitor',
    outlookText: 'The majority turn out to be scar tissue or old infection. Doctors typically track size and shape with follow-up imaging, and biopsy if it grows or looks suspicious.',
    zones: ['midR'], marker: {x: 208, y: 148}, regionNote: 'Can appear anywhere in the lung; shown here as a single focal spot rather than a diffuse zone.'
  },
  {
    id: 'mass', name: 'Mass', icon: 'hex', color: '#D9782F', bg: '#FBEADC',
    tagline: 'Solitary or multiple focal lesion > 3 cm',
    definition: 'A lung mass is a focal lesion larger than 3 cm. Because of its size, it carries a higher chance of being significant and is investigated more urgently than a small nodule.',
    symptoms: ['Persistent cough, sometimes with blood (hemoptysis)', 'Unexplained weight loss', 'Chest pain', 'Fatigue and reduced appetite'],
    riskFactors: ['Smoking (the strongest risk factor)', 'Occupational exposure, e.g. asbestos', 'Family history of lung cancer', 'Older age'],
    outlook: 'bad', outlookLabel: 'Needs prompt work-up',
    outlookText: 'Requires biopsy and staging to determine the cause. Benign masses can be fully treated; malignant ones need therapy tailored to stage � earlier detection meaningfully improves outcomes.',
    zones: ['upperL'], marker: {x: 90, y: 100}, regionNote: 'Can occur centrally or peripherally in any lobe; shown here as a single focal lesion.'
  },
  {
    id: 'pleural_thickening', name: 'Pleural Thickening', icon: 'layers', color: '#7C8695', bg: '#EEF0F3',
    tagline: 'Chronic fibrocalcific pleural reaction',
    definition: 'Pleural thickening is scarring and calcification of the pleural lining, usually left behind by a past infection, effusion, or exposure, rather than an active disease process.',
    symptoms: ['Often none at all', 'Mild breathlessness if the thickening is extensive', 'A sense of chest tightness'],
    riskFactors: ['Asbestos exposure', 'Prior tuberculosis or empyema', 'Previous pleural effusion', 'Chest trauma or prior surgery'],
    outlook: 'ok', outlookLabel: 'Stable � chronic',
    outlookText: 'The scarring itself is permanent, but it�s usually monitored rather than treated, and rarely causes serious breathing impairment unless extensive.',
    zones: ['pleuraL','pleuraR','lowerL','lowerR'], regionNote: 'Follows the pleural lining, often more noticeable at the lower lung margins.'
  },
  {
    id: 'emphysema', name: 'Emphysema', icon: 'flow', color: '#35B37E', bg: '#E7F8EF',
    tagline: 'Bilateral hyperinflation & flattened diaphragm',
    definition: 'Emphysema is a form of COPD where the walls of the alveoli are destroyed, merging small air sacs into fewer, larger ones. This traps air and causes both lungs to overinflate.',
    symptoms: ['Breathlessness that worsens gradually over years', 'Chronic cough, sometimes with mucus', 'Wheezing', 'A barrel-shaped chest over time'],
    riskFactors: ['Smoking (by far the leading cause)', 'Long-term air pollution or fume exposure', 'Alpha-1 antitrypsin deficiency (genetic)', 'Occupational dust exposure'],
    outlook: 'bad', outlookLabel: 'Progressive � not reversible',
    outlookText: 'Lung damage already done cannot be undone, but quitting smoking, medication, and pulmonary rehab can substantially slow further decline.',
    zones: ['upperL','upperR'], regionNote: 'Smoking-related emphysema tends to affect the upper lung zones first, with flattening of the diaphragm.'
  },
  {
    id: 'fibrosis', name: 'Fibrosis', icon: 'pulse', color: '#D6588C', bg: '#FCEAF2',
    tagline: 'Chronic reticular scarring & distortion',
    definition: 'Pulmonary fibrosis is progressive scarring of lung tissue that stiffens the lungs, making it harder for oxygen to pass into the bloodstream.',
    symptoms: ['Dry cough that persists for months', 'Breathlessness on exertion, worsening over time', 'Fatigue', 'Clubbing (widening) of the fingertips in later stages'],
    riskFactors: ['Idiopathic (no identifiable cause) in many cases', 'Occupational dust or chemical exposure', 'Autoimmune disease (e.g. rheumatoid arthritis)', 'Prior chest radiation therapy'],
    outlook: 'bad', outlookLabel: 'Progressive � not reversible',
    outlookText: 'Existing scarring is permanent and tends to progress. Antifibrotic medications can slow the rate of decline, and lung transplant is considered in advanced cases.',
    zones: ['lowerL','lowerR'], regionNote: 'Classically starts at the lung periphery and bases before spreading further.'
  },
  {
    id: 'pneumothorax', name: 'Pneumothorax', icon: 'warn', color: '#E2A63A', bg: '#FDF3E1',
    tagline: 'Visceral pleural line, absent lung markings',
    definition: 'A pneumothorax is a collapsed lung caused by air leaking into the pleural space, which pushes the lung inward, away from the chest wall.',
    symptoms: ['Sudden, sharp chest pain, often one-sided', 'Sudden shortness of breath', 'Rapid heart rate', 'Tightness in the chest'],
    riskFactors: ['Being tall and thin, and young (primary spontaneous type)', 'Underlying COPD or emphysema', 'Chest trauma or injury', 'Previous history of pneumothorax'],
    outlook: 'ok', outlookLabel: 'Treatable � can recur',
    outlookText: 'Small ones may resolve with observation; larger ones need a chest tube. Recovery is usually good, though recurrence is possible, especially in the first year.',
    zones: ['upperR','pleuraR'], regionNote: 'Air rises to the top, so it typically collects near the lung apex first.'
  },
  {
    id: 'hernia', name: 'Hernia', icon: 'cube', color: '#4C8DFF', bg: '#EAF1FF',
    tagline: 'Diaphragmatic displacement of contents',
    definition: 'A diaphragmatic (often hiatal) hernia occurs when part of the stomach or other abdominal organs pushes up through the diaphragm into the chest cavity.',
    symptoms: ['Heartburn or acid reflux', 'Regurgitation of food or liquid', 'Chest discomfort, especially after eating', 'Difficulty swallowing'],
    riskFactors: ['Obesity', 'Increasing age (weakened diaphragm muscle)', 'Prior abdominal trauma or surgery', 'Congenital diaphragm defects'],
    outlook: 'good', outlookLabel: 'Manageable � surgery if needed',
    outlookText: 'Small hernias are often managed with diet changes and reflux medication. Larger or symptomatic ones can be surgically repaired with generally good results.',
    zones: ['diaphragm','lowerL'], regionNote: 'Occurs at the diaphragm, most often where the esophagus passes through on the left side.'
  },
  {
    id: 'no_finding', name: 'No Finding', icon: 'pulse', color: '#35B37E', bg: '#E9FBF1',
    tagline: 'Normal aerated parenchyma without focus',
    definition: 'No Finding means the chest X-ray shows normally aerated lung tissue with no focal abnormality detected at the time of imaging � a healthy baseline reading.',
    symptoms: ['None � this reflects a normal scan, not a diagnosis of a symptom-free patient'],
    riskFactors: ['Not applicable'],
    outlook: 'good', outlookLabel: 'Normal',
    outlookText: 'No abnormality was detected in this image. A normal chest X-ray doesn�t rule out every condition, especially ones that don�t show up on imaging.',
    zones: [], regionNote: 'Both lungs appear clear and symmetrically aerated, with no zone standing out.'
  }
];

const ZONE_RECTS = {
  upperL: {x:150, y:48, w:74, h:76},
  upperR: {x:56, y:48, w:74, h:76},
  midL: {x:150, y:124, w:74, h:70},
  midR: {x:56, y:124, w:74, h:70},
  lowerL: {x:150, y:194, w:74, h:78},
  lowerR: {x:56, y:194, w:74, h:78}
};

const LungSVG = ({ cond }: { cond: typeof TAXONOMY_DATA[0] }) => {
  const zones = cond.zones || [];
  // const neutral = '#E4E8F2'; // Fallback for light mode, handled dynamically via tailwind is harder in SVG. Let's use currentColor for outline and dynamic fill
  
  const bandFill = (id: string) => zones.includes(id) ? cond.color : 'currentColor';
  const bandOpacity = (id: string) => zones.includes(id) ? 0.9 : 0.05;
  const pleuraLOn = zones.includes('pleuraL');
  const pleuraROn = zones.includes('pleuraR');
  const heartOn = zones.includes('heart');
  const diaphragmOn = zones.includes('diaphragm');

  return (
    <svg viewBox="0 0 280 300" width="112" height="120" className="text-slate-200 dark:text-slate-800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="clipL"><path d="M185 52 Q228 58 236 128 Q244 200 220 252 Q204 278 178 266 Q163 258 166 218 L149 190 Q164 158 163 118 Q162 80 160 64 Q170 56 185 52 Z"/></clipPath>
        <clipPath id="clipR"><path d="M95 52 Q52 58 44 128 Q36 200 60 252 Q76 278 102 266 Q117 258 114 200 Q111 140 117 88 Q120 64 95 52 Z"/></clipPath>
      </defs>
      
      {Object.entries(ZONE_RECTS).map(([id, r]) => (
        <rect key={id} x={r.x} y={r.y} width={r.w} height={r.h} fill={bandFill(id)} opacity={bandOpacity(id)} clipPath={`url(#${id.endsWith('L') ? 'clipL' : 'clipR'})`}/>
      ))}

      <path d="M185 52 Q228 58 236 128 Q244 200 220 252 Q204 278 178 266 Q163 258 166 218 L149 190 Q164 158 163 118 Q162 80 160 64 Q170 56 185 52 Z"
        fill="none" stroke={pleuraLOn ? cond.color : 'currentColor'} strokeWidth={pleuraLOn ? 3 : 1.6} className={!pleuraLOn ? "text-slate-300 dark:text-slate-700" : ""}/>
      <path d="M95 52 Q52 58 44 128 Q36 200 60 252 Q76 278 102 266 Q117 258 114 200 Q111 140 117 88 Q120 64 95 52 Z"
        fill="none" stroke={pleuraROn ? cond.color : 'currentColor'} strokeWidth={pleuraROn ? 3 : 1.6} className={!pleuraROn ? "text-slate-300 dark:text-slate-700" : ""}/>
      <path d="M140 24 L140 60 M140 60 L112 74 M140 60 L168 74" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300 dark:text-slate-700"/>
      <path d="M150 195 C140 180 115 185 112 210 C110 232 130 247 150 262 C170 247 190 232 188 210 C185 185 160 180 150 195 Z"
        fill={heartOn ? cond.color : 'currentColor'} stroke={heartOn ? cond.color : 'currentColor'} strokeWidth="1.6" opacity={heartOn ? 0.95 : (document.documentElement.classList.contains('dark') ? 0.2 : 0.05)} className={!heartOn ? "text-slate-300 dark:text-slate-700" : ""}/>
      <path d="M44 258 Q94 288 149 260" fill="none" stroke={diaphragmOn ? cond.color : 'currentColor'} strokeWidth={diaphragmOn ? 3 : 1.6} strokeLinecap="round" className={!diaphragmOn ? "text-slate-300 dark:text-slate-700" : ""}/>
      <path d="M151 260 Q206 288 236 258" fill="none" stroke={diaphragmOn ? cond.color : 'currentColor'} strokeWidth={diaphragmOn ? 3 : 1.6} strokeLinecap="round" className={!diaphragmOn ? "text-slate-300 dark:text-slate-700" : ""}/>
      
      {cond.marker && (
        <>
          <circle cx={cond.marker.x} cy={cond.marker.y} r="7" fill={cond.color} stroke="white" strokeWidth="2"/>
          <circle cx={cond.marker.x} cy={cond.marker.y} r="12" fill="none" stroke={cond.color} strokeWidth="1.5" opacity="0.5"/>
        </>
      )}
    </svg>
  );
};

export default function TaxonomyModal({ conditionId, onClose }: { conditionId: string | null, onClose: () => void }) {
  useEffect(() => {
    if (conditionId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [conditionId]);

  if (!conditionId) return null;
  
  const cond = TAXONOMY_DATA.find(c => c.id === conditionId.toLowerCase().replace(' ', '_'));
  if (!cond) return null;

  const oc = OUTLOOK_COLORS[cond.outlook] || OUTLOOK_COLORS.neutral;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden mt-10 sm:mt-0 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex gap-4 items-start">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cond.bg, color: cond.color }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">{ICONS[cond.icon]}</svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-2xl text-deep-navy dark:text-slate-100 mb-1">{cond.name}</h2>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: cond.bg, color: cond.color }}>
              {cond.tagline}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
            {cond.definition}
          </p>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl mb-6">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: oc }} />
            <div>
              <div className="text-sm font-bold" style={{ color: oc }}>{cond.outlookLabel}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cond.outlookText}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Common symptoms</h4>
              <ul className="space-y-2">
                {cond.symptoms.map((s, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 relative pl-4">
                    <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cond.color }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Risk factors</h4>
              <ul className="space-y-2">
                {cond.riskFactors.map((s, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 relative pl-4">
                    <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cond.color }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0">
              <LungSVG cond={cond} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Region typically affected</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {cond.regionNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

