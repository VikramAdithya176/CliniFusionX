import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { isAuthenticated } from './services/authService';

import { ToastProvider } from './components/Toast';
import { ExplainabilityProvider } from './services/explainabilityContext';

// ── Route-level code splitting (lazy loading) ─────────────────────────────────
// Each route is loaded only when first visited, reducing initial bundle size.
const Dashboard      = lazy(() => import('./routes/index'));
const NewAnalysis    = lazy(() => import('./routes/new-analysis'));
const Results        = lazy(() => import('./routes/results'));
const ClinicalReport = lazy(() => import('./routes/report'));
const PatientHistory = lazy(() => import('./routes/history'));
const Explainability = lazy(() => import('./routes/explainability'));
const Settings       = lazy(() => import('./routes/settings'));
const Profile        = lazy(() => import('./routes/profile'));
const Patients       = lazy(() => import('./routes/patients'));
const Login          = lazy(() => import('./routes/login'));
const NotFound       = lazy(() => import('./routes/not-found'));

// ── Loading fallback shown while a lazy chunk is downloading ──────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#0277b6]/30 border-t-[#0277b6] animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Loading…</p>
      </div>
    </div>
  );
}

// ── Protected layout — redirects to /login if not authenticated ───────────────
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell>{children}</AppShell>;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <GlobalErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <ExplainabilityProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Protected */}
                <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
                <Route path="/new-analysis" element={<ProtectedLayout><NewAnalysis /></ProtectedLayout>} />
                <Route path="/results" element={<ProtectedLayout><Results /></ProtectedLayout>} />
                <Route path="/report" element={<ProtectedLayout><ClinicalReport /></ProtectedLayout>} />
                <Route path="/history" element={<ProtectedLayout><PatientHistory /></ProtectedLayout>} />
                <Route path="/explainability" element={<ProtectedLayout><Explainability /></ProtectedLayout>} />
                <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
                <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
                <Route path="/patients" element={<ProtectedLayout><Patients /></ProtectedLayout>} />

                {/* 404 — must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ExplainabilityProvider>
        </BrowserRouter>
      </ToastProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
