import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';

export interface ExplainabilityContextType {
  activeClassIdx: number | null;
  activeLabel: string;
  heatmaps: Record<number, string>;
  inFlight: number[];
  inFlightLabels: Record<number, string>;
  isGenerating: boolean;
  activeGeneratingLabel: string | null;
  error: string | null;
  opacity: number;
  showOriginal: boolean;
  fullscreen: boolean;
  cachedCount: number;
  setOpacity: (val: number) => void;
  setShowOriginal: (val: boolean) => void;
  setFullscreen: (val: boolean) => void;
  selectClass: (classIdx: number, label: string) => void;
  generateHeatmap: (classIdx: number, label: string, forceRefresh?: boolean) => Promise<void>;
  clearCache: () => void;
  hasCached: (classIdx: number) => boolean;
  isClassInFlight: (classIdx: number) => boolean;
}

const ExplainabilityContext = createContext<ExplainabilityContextType | undefined>(undefined);

function getImageKey(img: string | null): string {
  if (!img) return 'none';
  // Fast signature using length and sample characters to distinguish radiographs
  return `${img.length}_${img.slice(0, 30)}_${img.slice(-30)}`.replace(/[^a-zA-Z0-9]/g, '');
}

export function ExplainabilityProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const toast = useToast();

  const [activeClassIdx, setActiveClassIdx] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('cfx_explain_activeClass');
    return saved !== null && saved !== '' ? Number(saved) : null;
  });

  const [activeLabel, setActiveLabel] = useState<string>(() => {
    return sessionStorage.getItem('cfx_explain_activeLabel') || '';
  });

  const [heatmaps, setHeatmaps] = useState<Record<number, string>>({});
  const [inFlight, setInFlight] = useState<number[]>([]);
  const [inFlightLabels, setInFlightLabels] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [opacity, setOpacity] = useState<number>(0.6);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  // Store active image signature to detect when a new radiograph is loaded
  const currentImgKeyRef = useRef<string>('');

  // Keep a ref to location.pathname so background completion callback knows the active route
  const currentPathRef = useRef<string>(location.pathname);
  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  // Synchronize and restore cached heatmaps for current image from sessionStorage
  const syncImageAndCache = useCallback(() => {
    const imagePreview = sessionStorage.getItem('recentImagePreview');
    const newKey = getImageKey(imagePreview);

    if (newKey !== currentImgKeyRef.current) {
      currentImgKeyRef.current = newKey;
      
      // Load all saved heatmaps for this specific image from sessionStorage
      const restored: Record<number, string> = {};
      try {
        const prefix = `cfx_hm_${newKey}_`;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const classIdxStr = key.replace(prefix, '');
            const classIdx = Number(classIdxStr);
            const dataUrl = sessionStorage.getItem(key);
            if (!isNaN(classIdx) && dataUrl) {
              restored[classIdx] = dataUrl;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to restore heatmaps from sessionStorage:', e);
      }

      setHeatmaps(restored);
    }
  }, []);

  // Sync on mount and check periodically or upon location changes
  useEffect(() => {
    syncImageAndCache();
  }, [location.pathname, syncImageAndCache]);

  const hasCached = useCallback((classIdx: number) => {
    return Boolean(heatmaps[classIdx]);
  }, [heatmaps]);

  const isClassInFlight = useCallback((classIdx: number) => {
    return inFlight.includes(classIdx);
  }, [inFlight]);

  // ── Asynchronous Background Heatmap Generator ──────────────────────────────
  const generateHeatmap = useCallback(async (classIdx: number, label: string, forceRefresh = false) => {
    const imagePreview = sessionStorage.getItem('recentImagePreview');
    if (!imagePreview) {
      setError('No radiograph found. Please run or select an analysis first.');
      return;
    }

    const imgKey = getImageKey(imagePreview);
    currentImgKeyRef.current = imgKey;

    // Cache hit and not forcing refresh -> switch immediately
    if (!forceRefresh && heatmaps[classIdx]) {
      setActiveClassIdx(classIdx);
      setActiveLabel(label);
      sessionStorage.setItem('cfx_explain_activeClass', String(classIdx));
      sessionStorage.setItem('cfx_explain_activeLabel', label);
      setError(null);
      return;
    }

    // Already generating in background -> switch active focus to it
    if (inFlight.includes(classIdx)) {
      setActiveClassIdx(classIdx);
      setActiveLabel(label);
      sessionStorage.setItem('cfx_explain_activeClass', String(classIdx));
      sessionStorage.setItem('cfx_explain_activeLabel', label);
      return;
    }

    // If forceRefresh, clear existing cached entry from state and storage
    if (forceRefresh) {
      setHeatmaps((prev) => {
        const next = { ...prev };
        delete next[classIdx];
        return next;
      });
      try {
        sessionStorage.removeItem(`cfx_hm_${imgKey}_${classIdx}`);
      } catch (e) {
        // ignore
      }
    }

    // Mark as in-flight
    setActiveClassIdx(classIdx);
    setActiveLabel(label);
    sessionStorage.setItem('cfx_explain_activeClass', String(classIdx));
    sessionStorage.setItem('cfx_explain_activeLabel', label);
    setError(null);

    setInFlight((prev) => (prev.includes(classIdx) ? prev : [...prev, classIdx]));
    setInFlightLabels((prev) => ({ ...prev, [classIdx]: label }));

    try {
      // Fetch image blob
      const res = await fetch(imagePreview);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append('image', blob, 'xray.jpg');
      formData.append('class_idx', String(classIdx));
      formData.append('cam_method', 'scorecam');
      if (forceRefresh) {
        formData.append('force_refresh', 'true');
      }

      const apiBase = (localStorage.getItem('apiBaseUrl') || 'http://localhost:8000').replace(/\/+$/, '');
      const response = await fetch(`${apiBase}/api/explain`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Server error ${response.status}: ${detail}`);
      }

      const data = await response.json();
      const src = `data:image/jpeg;base64,${data.heatmap_base64}`;

      // Persist in Context state
      setHeatmaps((prev) => ({ ...prev, [classIdx]: src }));

      // Persist in sessionStorage for this specific radiograph
      try {
        sessionStorage.setItem(`cfx_hm_${imgKey}_${classIdx}`, src);
      } catch (storageErr) {
        console.warn('SessionStorage quota warning for heatmap persistence:', storageErr);
      }

      // Notify clinician if they navigated elsewhere while ScoreCAM computed
      if (currentPathRef.current !== '/explainability') {
        toast.success(`ScoreCAM generated for ${label.replace('_', ' ')}! Return to Explainability to view.`);
      }
    } catch (err: any) {
      const errMsg = err?.message || `Failed to generate ScoreCAM for ${label}`;
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      // Remove from in-flight tracker
      setInFlight((prev) => prev.filter((id) => id !== classIdx));
      setInFlightLabels((prev) => {
        const next = { ...prev };
        delete next[classIdx];
        return next;
      });
    }
  }, [heatmaps, inFlight, toast]);

  const selectClass = useCallback((classIdx: number, label: string) => {
    setActiveClassIdx(classIdx);
    setActiveLabel(label);
    sessionStorage.setItem('cfx_explain_activeClass', String(classIdx));
    sessionStorage.setItem('cfx_explain_activeLabel', label);

    if (heatmaps[classIdx]) {
      setError(null);
      return;
    }

    if (!inFlight.includes(classIdx)) {
      generateHeatmap(classIdx, label);
    }
  }, [heatmaps, inFlight, generateHeatmap]);

  const clearCache = useCallback(() => {
    const imgKey = currentImgKeyRef.current;
    if (imgKey) {
      const prefix = `cfx_hm_${imgKey}_`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }
    sessionStorage.removeItem('cfx_explain_activeClass');
    sessionStorage.removeItem('cfx_explain_activeLabel');
    setHeatmaps({});
    setActiveClassIdx(null);
    setActiveLabel('');
    setError(null);

    // Also clear backend in-memory heatmap cache
    try {
      const apiBase = (localStorage.getItem('apiBaseUrl') || 'http://localhost:8000').replace(/\/+$/, '');
      fetch(`${apiBase}/api/v1/explain/clear-cache`, { method: 'POST' }).catch(() => {});
    } catch (e) {
      // ignore
    }
  }, []);

  const isGenerating = inFlight.length > 0;
  const activeGeneratingLabel = inFlight.length > 0 ? inFlightLabels[inFlight[0]] || null : null;
  const cachedCount = Object.keys(heatmaps).length;

  return (
    <ExplainabilityContext.Provider
      value={{
        activeClassIdx,
        activeLabel,
        heatmaps,
        inFlight,
        inFlightLabels,
        isGenerating,
        activeGeneratingLabel,
        error,
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
      }}
    >
      {children}
    </ExplainabilityContext.Provider>
  );
}

export function useExplainability() {
  const context = useContext(ExplainabilityContext);
  if (!context) {
    throw new Error('useExplainability must be used within an ExplainabilityProvider');
  }
  return context;
}
