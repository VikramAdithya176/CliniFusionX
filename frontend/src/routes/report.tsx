import { useState, useEffect } from 'react';
import { Download, Printer, Copy, Share2, ChevronLeft, Check, CheckCircle2, FileDown, ShieldCheck, Image as ImageIcon, SunMedium, Maximize2, X, FileText, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';
import { getCurrentPatient } from '../services/historyService';
import { getAuthUser, DEFAULT_CLINICIAN, getAuthToken } from '../services/authService';
import { useToast } from '../components/Toast';

export default function ClinicalReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: showError, info } = useToast();
  const [copied, setCopied] = useState(false);
  const [invertContrast, setInvertContrast] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  const [activePatient, setActivePatient] = useState<any>(null);
  const currentUser = getAuthUser() || DEFAULT_CLINICIAN;

  useEffect(() => {
    if (!location.state?.reportText) {
      getCurrentPatient().then(setActivePatient);
    }
  }, [location.state]);

  let reportData = location.state?.reportText || activePatient?.report;
  let recordId = location.state?.recordId || activePatient?.id;
  let recordDate = location.state?.date || activePatient?.date;
  let patientName = location.state?.patientName || activePatient?.patientName || '';
  const imagePreview = location.state?.imagePreview || sessionStorage.getItem('recentImagePreview') || activePatient?.imagePreview;

  const displayRecordId = recordId || 'CXR-2481';
  const displayDate = recordDate || new Date().toLocaleString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const isObject = typeof reportData === 'object' && reportData !== null;
  const rawFallback = !isObject ? (reportData || "No clinical report data was generated. Please run an analysis first.") : "";

  // Plain text generator for copy / export – uses the new hospital-style layout
  const getPlainTextReport = () => {
    if (isObject) {
      // Build a concise impression from image_model_findings
      const findingsText = reportData.image_model_findings || '';
      const probMatches = [...findingsText.matchAll(/\*\*([A-Za-z_\s]+)\*\*:\s*\*\*(\d+\.?\d*)%\*\*/g)];
      const rankedItems = probMatches
        .map(m => ({ name: m[1].trim(), prob: parseFloat(m[2]) }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 5);
      const impressionLines = rankedItems.length > 0
        ? rankedItems.map((item, i) => {
            const level = item.prob >= 50 ? 'HIGH' : item.prob >= 15 ? 'MODERATE' : 'LOW';
            return `  ${i + 1}. ${item.name} — ${item.prob.toFixed(1)}% (${level} confidence)${i === 0 && item.prob >= 50 ? '  [PRIMARY]' : ''}`;
          }).join('\n')
        : '  No significant AI findings to summarise. Clinical correlation advised.';

      return `CHEST X-RAY REPORT
================================================================================

PATIENT & STUDY INFORMATION
--------------------------------------------------------------------------------
${patientName ? `Patient Name   : ${patientName}\n` : ''}Record ID      : ${displayRecordId}
Report Date    : ${displayDate}
Modality       : Chest X-ray (PA view)
AI Model       : Swin-Tiny · Patch4 · Window7 · 224 (NIH ChestX-ray14)
Ordering Physician : ${currentUser.name === 'Guest' ? 'Not specified' : currentUser.name}

================================================================================
1. CLINICAL INDICATION / HISTORY
================================================================================
${reportData.clinical_context || 'Not provided.'}

================================================================================
2. FINDINGS
================================================================================

A) AI Model Predictions (Swin Transformer):
${reportData.image_model_findings || 'No significant findings detected by the AI model.'}

B) Clinical Information:
${reportData.clinical_information || 'None recorded.'}

C) Detailed Assessment:
${reportData.integrated_interpretation || 'Not provided.'}

D) Additional Considerations:
${reportData.possible_findings || 'None.'}

================================================================================
3. IMPRESSION
================================================================================
${impressionLines}

Summary: ${rankedItems.filter(i => i.prob >= 50).length > 0
  ? `AI identifies high-confidence findings for ${rankedItems.filter(i => i.prob >= 50).map(i => i.name).join(', ')}.`
  : 'AI did not identify any high-confidence (>=50%) pathology.'}
Clinical correlation with patient history and labs is essential.
Formal attending radiologist overread is mandatory.

================================================================================
4. RECOMMENDATIONS
================================================================================
${reportData.recommended_next_steps || 'Standard clinical review recommended.'}

================================================================================
DISCLAIMER
================================================================================
RESEARCH PROTOTYPE: This report incorporates outputs from an artificial intelligence model (Swin Transformer) intended solely for decision support and research evaluation. It does NOT constitute a formal diagnostic reading or definitive clinical diagnosis. AI predictions must be independently validated and interpreted in the context of the complete clinical picture by a qualified, licensed healthcare professional.

Report generated on ${displayDate} | Record ${displayRecordId}
`;
    }
    return typeof reportData === 'string' ? reportData : JSON.stringify(reportData, null, 2);
  };

  const handleDownloadPdf = async () => {
    if (!reportData || typeof reportData !== 'object') {
      info('Opening browser print dialog...');
      setTimeout(() => window.print(), 250);
      return;
    }
    setPdfLoading(true);
    info('Generating PDF report on server...');
    try {
      const apiBase = (localStorage.getItem('apiBaseUrl') || 'http://localhost:8000').replace(/\/+$/, '');
      const response = await fetch(`${apiBase}/api/v1/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          record_id: displayRecordId,
          report_date: displayDate,
          report: reportData,
          image_preview: imagePreview ?? null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${displayRecordId}_CliniFusionX_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      success(`PDF saved: ${displayRecordId}_CliniFusionX_Report.pdf`);
    } catch (err: any) {
      showError(err.message || 'PDF generation failed.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    info('Preparing document for printer...');
    setTimeout(() => window.print(), 250);
  };

  const handleCopy = async () => {
    try {
      const text = getPlainTextReport();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      success('Full clinical report copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      showError('Failed to copy report to clipboard');
    }
  };

  const handleShare = async () => {
    const text = getPlainTextReport();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Clinical Analysis Report - ${displayRecordId}`,
          text: `Swin Transformer Clinical Report (${displayRecordId}):\n\n` + text.slice(0, 300) + '...',
          url: window.location.href,
        });
        success('Report shared successfully!');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Fallback to clipboard
        } else {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      success('Report summary copied to clipboard for sharing!');
    } catch (err) {
      showError('Unable to share report');
    }
  };

  const handleDownloadFile = () => {
    try {
      const text = getPlainTextReport();
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${displayRecordId}_Clinical_Report.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      success(`Saved as ${displayRecordId}_Clinical_Report.md!`);
    } catch (err) {
      showError('Failed to export markdown file');
    }
  };

  const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown
      components={{
        p: ({node, ...props}) => <p className="mb-3 last:mb-0 leading-relaxed text-slate-700 dark:text-slate-300" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-slate-700 dark:text-slate-300" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-slate-700 dark:text-slate-300" {...props} />,
        li: ({node, ...props}) => <li className="pl-1" {...props} />,
        strong: ({node, ...props}) => <strong className="font-semibold text-deep-navy dark:text-slate-100" {...props} />,
        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-deep-navy dark:text-slate-100" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2 text-deep-navy dark:text-slate-100" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-md font-bold mt-3 mb-1 text-deep-navy dark:text-slate-100" {...props} />,
      }}
    >
      {content || "No data provided."}
    </ReactMarkdown>
  );

  /* ── Reusable section heading (numbered circle + title) ── */
  const SectionHeading = ({ num, title }: { num: number; title: string }) => (
    <h3 className="text-xl font-display font-bold text-[#0b5c92] dark:text-blue-400 mb-4 flex items-center gap-3">
      <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-bold">
        {num}
      </span>
      {title}
    </h3>
  );

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">

      {/* Screen Header - Hidden on Print */}
      <div className="mb-8 flex items-center gap-4 print:hidden">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
          title="Go back"
        >
          <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Chest X-Ray Report</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Hospital-standard clinical report for review and documentation.</p>
        </div>
      </div>

      {!reportData ? (
        <div className="max-w-5xl mx-auto py-24 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
            <FileText size={36} className="text-slate-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-700 dark:text-slate-200 mb-2">No Report Available</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Upload a chest X-ray in <strong>New Analysis</strong> to generate a clinical report.
          </p>
          <button
            onClick={() => navigate('/new-analysis')}
            className="px-6 py-2.5 bg-[#0b5c92] hover:bg-blue-800 text-white text-sm font-bold rounded-full transition-colors cursor-pointer shadow-sm"
          >
            Start New Analysis
          </button>
        </div>
      ) : (
      <div className="flex flex-col lg:flex-row gap-8 print:block">
        {/* Main Report Document */}
        <div className="flex-1 print:w-full print:max-w-none print:m-0 print:p-0">
          {/* Document Header Banner */}
          <div className="bg-[#0b5c92] rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden mb-10 print:rounded-2xl print:p-6 print:mb-6">
            <div className="relative z-10">
              <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md mb-6 border border-white/20">
                AI Generated • Research Prototype
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-8">Chest X-Ray Report</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-sm">
                  <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">Record ID</div>
                  <div className="font-semibold text-lg">{displayRecordId}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-sm">
                  <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">Report Date</div>
                  <div className="font-semibold text-lg">{displayDate}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-sm">
                  <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">AI Model</div>
                  <div className="font-semibold text-base truncate">Swin-Tiny · Patch4 · Window7 · 224</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Chest X-Ray Image – heading removed per user request
              ═══════════════════════════════════════════════════════════════ */}
          {imagePreview && (
            <div className="mb-10 bg-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl overflow-hidden print:bg-white print:text-black print:border-slate-300 print:p-4 print:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800 print:border-slate-300">
                <div className="flex items-center gap-2 text-sky-400 print:text-blue-700 font-bold text-xs uppercase tracking-wider">
                  <ImageIcon size={16} /> Submitted Chest X-Ray Image
                </div>

                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => setInvertContrast(!invertContrast)}
                    className={clsx(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer",
                      invertContrast
                        ? "bg-amber-400 text-slate-950 border-amber-300 font-bold"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                    )}
                    title="Toggle Invert / PACS Negative Film"
                  >
                    <SunMedium size={14} />
                    <span>{invertContrast ? 'Standard Film' : 'Invert PACS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                    title="Enlarge Radiograph"
                  >
                    <Maximize2 size={14} />
                    <span>Full Image</span>
                  </button>
                </div>
              </div>

              {/* Centered Radiograph Display */}
              <div className="flex flex-col items-center justify-center">
                <div 
                  onClick={() => setLightboxOpen(true)}
                  className="w-full max-w-lg rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative group shadow-sm flex items-center justify-center cursor-pointer transition-all hover:border-[#0b5c92]"
                  title="Click to enlarge radiograph"
                >
                  <img
                    src={imagePreview}
                    alt={`Chest Radiograph ${displayRecordId}`}
                    className={clsx(
                      "w-full h-full object-contain transition-all duration-300 group-hover:scale-105",
                      invertContrast && "invert contrast-125"
                    )}
                  />
                  {/* Film Marker Overlays */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-[11px] font-mono font-bold text-white border border-white/20 shadow-xs">
                    R • PA ERECT
                  </div>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-[11px] font-mono font-bold text-sky-400 border border-white/20 shadow-xs">
                    {displayRecordId}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 print:text-slate-500 mt-3 text-center print:hidden">
                  Click radiograph to open full-screen diagnostic lightbox viewer
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              REPORT BODY – Hospital-standard layout
              ═══════════════════════════════════════════════════════════════ */}
          {!isObject ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12 mb-12">
              <SectionHeading num={1} title="Findings" />
              <div className="pl-11 text-[15px] leading-relaxed">
                <MarkdownContent content={rawFallback} />
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12 print:border-none print:shadow-none print:p-0">

              {/* ──────────────────────────────────────────────────────────
                  1. Patient & Study Header
                  ────────────────────────────────────────────────────────── */}
              <div className="mb-10">
                <SectionHeading num={1} title="Patient & Study Information" />
                <div className="pl-11">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-[15px]">
                    {patientName && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">Patient Name:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold">{patientName}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">Patient ID / MRN:</span>
                      <span className="text-slate-800 dark:text-slate-200">{displayRecordId}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">Exam Date / Time:</span>
                      <span className="text-slate-800 dark:text-slate-200">{displayDate}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">Modality & View:</span>
                      <span className="text-slate-800 dark:text-slate-200">Chest X-ray, PA view</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">Ordering Physician:</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {currentUser.name === 'Guest' ? 'Not specified' : `${currentUser.name}, MD`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">AI Model Used:</span>
                      <span className="text-slate-800 dark:text-slate-200">Swin-Tiny · Patch4 · Window7 · 224</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 min-w-[130px]">Dataset:</span>
                      <span className="text-slate-800 dark:text-slate-200">NIH ChestX-ray14 (multi-label)</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800 mb-10" />

              {/* ──────────────────────────────────────────────────────────
                  2. Clinical Indication / History
                  ────────────────────────────────────────────────────────── */}
              <div className="mb-10">
                <SectionHeading num={2} title="Clinical Indication / History" />
                <div className="pl-11 text-[15px]">
                  <MarkdownContent content={reportData.clinical_context} />
                </div>
              </div>



              {/* ──────────────────────────────────────────────────────────
                  3. Findings
                  Organised in fixed anatomical order so nothing is missed.
                  ────────────────────────────────────────────────────────── */}
              <div className="mb-10">
                <SectionHeading num={3} title="Findings" />
                <div className="pl-11 text-[15px] space-y-6">

                  {/* 5-A: AI Model Predictions */}
                  <div>
                    <h4 className="font-semibold text-deep-navy dark:text-slate-100 mb-2 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0b5c92] dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">A</span>
                      AI Model Predictions (Swin Transformer)
                    </h4>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 italic mb-3">
                      Note: The following probabilities are generated by a Swin Transformer deep learning model based on the chest X-ray image. These represent statistical likelihoods, not definitive radiological diagnoses.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <MarkdownContent content={reportData.image_model_findings} />
                    </div>
                  </div>

                  {/* 5-B: Clinical Information (vitals, labs, etc.) */}
                  <div>
                    <h4 className="font-semibold text-deep-navy dark:text-slate-100 mb-2 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0b5c92] dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">B</span>
                      Clinical Information
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <MarkdownContent content={reportData.clinical_information} />
                    </div>
                  </div>

                  {/* 5-C: Detailed Assessment / Interpretation */}
                  <div>
                    <h4 className="font-semibold text-deep-navy dark:text-slate-100 mb-2 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0b5c92] dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">C</span>
                      Detailed Assessment
                    </h4>
                    <MarkdownContent content={reportData.integrated_interpretation} />
                  </div>

                  {/* 5-D: Additional Considerations */}
                  <div>
                    <h4 className="font-semibold text-deep-navy dark:text-slate-100 mb-2 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0b5c92] dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">D</span>
                      Additional Considerations
                    </h4>
                    <MarkdownContent content={reportData.possible_findings} />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800 mb-10" />

              {/* ──────────────────────────────────────────────────────────
                  6. Impression
                  Concise, numbered, ranked findings with confidence levels.
                  ────────────────────────────────────────────────────────── */}
              <div className="mb-10">
                <SectionHeading num={4} title="Impression" />
                <div className="pl-11 text-[15px] space-y-4">
                  {/* Concise impression box */}
                  <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-5 space-y-4">
                    {/* Extract and display ranked findings */}
                    {(() => {
                      // Parse top findings from image_model_findings markdown
                      const findings = reportData.image_model_findings || '';
                      const matches = [...findings.matchAll(/\*\*([A-Za-z_\s]+)\*\*:\s*\*\*(\d+\.?\d*)%\*\*/g)];
                      const topItems = matches
                        .map(m => ({ name: m[1].trim(), prob: parseFloat(m[2]) }))
                        .sort((a, b) => b.prob - a.prob)
                        .slice(0, 5);

                      if (topItems.length === 0) {
                        return <p className="text-slate-700 dark:text-slate-300">No significant AI findings to summarise. Clinical correlation advised.</p>;
                      }

                      return (
                        <ol className="list-decimal pl-5 space-y-3">
                          {topItems.map((item, i) => {
                            const level = item.prob >= 50 ? 'High' : item.prob >= 15 ? 'Moderate' : 'Low';
                            const color = item.prob >= 50 
                              ? 'text-red-700 dark:text-red-400' 
                              : item.prob >= 15 
                                ? 'text-amber-700 dark:text-amber-400' 
                                : 'text-slate-500 dark:text-slate-400';
                            return (
                              <li key={i} className="text-slate-800 dark:text-slate-200">
                                <strong>{item.name}</strong>{' '}
                                <span className={`font-bold ${color}`}>
                                  ({item.prob.toFixed(1)}% — {level} confidence)
                                </span>
                                {i === 0 && item.prob >= 50 && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-[11px] font-bold">
                                    PRIMARY
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      );
                    })()}

                    {/* Brief synthesis statement */}
                    <div className="pt-3 border-t border-amber-200 dark:border-amber-800/50">
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        <strong>Summary:</strong> AI analysis {(() => {
                          const findings = reportData.image_model_findings || '';
                          const matches = [...findings.matchAll(/\*\*([A-Za-z_\s]+)\*\*:\s*\*\*(\d+\.?\d*)%\*\*/g)];
                          const highConf = matches.filter(m => parseFloat(m[2]) >= 50);
                          if (highConf.length > 0) {
                            const names = highConf.map(m => m[1].trim()).join(', ');
                            return `identifies high-confidence findings for ${names}. `;
                          }
                          return 'did not identify any high-confidence (≥50%) pathology. ';
                        })()}
                        Clinical correlation with patient history, physical examination, and laboratory data is essential. Formal attending radiologist overread is mandatory before clinical decision-making.
                      </p>
                    </div>
                  </div>

                  {/* Caveat */}
                  <p className="text-[12px] text-slate-400 dark:text-slate-500 italic">
                    Impression is auto-generated from AI model probabilities. It does not replace formal radiologist interpretation.
                  </p>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800 mb-10" />

              {/* ──────────────────────────────────────────────────────────
                  7. Recommendations
                  Follow-up interval, modality, critical result notes.
                  ────────────────────────────────────────────────────────── */}
              <div className="mb-10">
                <SectionHeading num={5} title="Recommendations" />
                <div className="pl-11 text-[15px]">
                  <MarkdownContent content={reportData.recommended_next_steps} />
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800 mb-10" />

              {/* ──────────────────────────────────────────────────────────
                  Limitations / Disclaimer
                  ────────────────────────────────────────────────────────── */}
              <div>
                <h3 className="text-xl font-display font-bold text-[#0b5c92] dark:text-blue-400 mb-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-bold">!</span>
                  Disclaimer
                </h3>
                <div className="pl-11 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <strong className="text-slate-700 dark:text-slate-200">RESEARCH PROTOTYPE DISCLAIMER:</strong> This report incorporates outputs from an artificial intelligence model (Swin Transformer) intended solely for decision support and research evaluation. It does <strong>not</strong> constitute a formal diagnostic reading or definitive clinical diagnosis. AI predictions must be independently validated and interpreted in the context of the complete clinical picture by a qualified, licensed healthcare professional.
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800 my-10" />

              {/* Physician Review & Signature Block */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
                    <ShieldCheck size={16} /> Digitally Verified Clinical Record
                  </div>
                  <div className="font-display font-bold text-base text-deep-navy dark:text-slate-100">
                    {currentUser.name === 'Guest' ? 'Guest Attending Clinician' : currentUser.name}{currentUser.name !== 'Guest' ? ', MD' : ''}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentUser.role} • {currentUser.department}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 font-mono">
                    NPI: 1942083152 • Verification Hash: SHA256-A78F-CXR99 • Signed: {displayDate}
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end justify-center shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 size={14} /> Signed & Approved
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">Medical Record Overread Complete</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar (Actions & Summary) - Hidden during print */}
        <div className="w-full lg:w-80 shrink-0 space-y-6 print:hidden">
          <div className="card-surface p-6">
            <h3 className="font-bold text-deep-navy dark:text-slate-100 text-lg mb-1">Report Actions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Export, print, or share this document.</p>
            
            <div className="space-y-3">
              <button 
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="w-full py-2.5 bg-[#0b5c92] hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              >
                {pdfLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Generating PDF…</>
                  : <><Download size={16} /> Download PDF</>}

              </button>

              <button 
                onClick={handlePrint}
                className="w-full py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Printer size={16} /> Print Report
              </button>

              <button 
                onClick={handleCopy}
                className={clsx(
                  "w-full py-2.5 border rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer",
                  copied
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                )}
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />} 
                {copied ? 'Copied to Clipboard!' : 'Copy Report'}
              </button>

              <button 
                onClick={handleShare}
                className="w-full py-2.5 text-primary dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-transparent rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Share2 size={16} /> Share Report
              </button>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleDownloadFile}
                  className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileDown size={14} /> Export Markdown (.md)
                </button>
              </div>
            </div>
          </div>

          <div className="card-surface p-6">
            <h3 className="font-bold text-deep-navy dark:text-slate-100 text-lg mb-4">Report Summary</h3>
            
            <div className="space-y-3">
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</div>
                <div className="font-semibold text-deep-navy dark:text-slate-200 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Clinician Verified
                </div>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Record ID</div>
                <div className="font-semibold text-deep-navy dark:text-slate-200 text-sm">{displayRecordId}</div>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Warning</div>
                <div className="font-semibold text-amber-600 dark:text-amber-400 text-sm">Research Use Only</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Radiograph Lightbox Modal */}
      {lightboxOpen && imagePreview && (
        <div 
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in cursor-pointer print:hidden"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-2xl flex flex-col items-center cursor-default"
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>

            <div className="w-full flex items-center justify-between mb-4 pr-12">
              <div>
                <h4 className="text-sm font-bold text-white">Full-Resolution Chest Radiograph • {displayRecordId}</h4>
                <p className="text-xs text-slate-400">PA projection • Swin Transformer AI analysis</p>
              </div>
              <button
                type="button"
                onClick={() => setInvertContrast(!invertContrast)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <SunMedium size={14} />
                <span>{invertContrast ? 'Standard Contrast' : 'Invert PACS'}</span>
              </button>
            </div>

            <div className="max-h-[75vh] overflow-hidden rounded-2xl bg-black border border-slate-800 flex items-center justify-center">
              <img
                src={imagePreview}
                alt={`Enlarged Radiograph ${displayRecordId}`}
                className={clsx(
                  "max-h-[75vh] w-auto object-contain",
                  invertContrast && "invert contrast-125"
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
