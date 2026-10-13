import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * GlobalErrorBoundary
 * Catches any uncaught React render/lifecycle error and shows a recovery UI
 * instead of crashing the entire app.
 *
 * Wrap around <App /> in main.tsx for full coverage.
 */
export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In production, forward to an error tracking service (Sentry, etc.)
    console.error('[CliniFusionX] Uncaught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-6 font-sans">
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Red accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />

          <div className="p-8">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center mb-6">
              <AlertTriangle size={28} className="text-rose-600 dark:text-rose-400" />
            </div>

            {/* Heading */}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              An unexpected error occurred in the interface. Your analysis data is safe — 
              try refreshing the page or returning to the dashboard.
            </p>

            {/* Error message (collapsed) */}
            {this.state.error && (
              <details className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                <summary className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Error details (for developer)
                </summary>
                <pre className="px-4 py-3 text-xs text-rose-700 dark:text-rose-400 overflow-x-auto whitespace-pre-wrap break-all border-t border-slate-200 dark:border-slate-700">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw size={15} />
                Try Again
              </button>
              <a
                href="/"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0277b6] hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                <Home size={15} />
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default GlobalErrorBoundary;
