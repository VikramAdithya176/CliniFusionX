import { useNavigate } from 'react-router-dom';
import { FileSearch, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#080d1a] dark:to-[#0b1222] p-6 font-sans">
      <div className="text-center max-w-md">
        {/* Animated 404 number */}
        <div className="relative mb-8 inline-block">
          <div className="text-[10rem] font-extrabold leading-none select-none bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 text-transparent bg-clip-text">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xl">
              <FileSearch size={36} className="text-[#0277b6] dark:text-sky-400" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. 
          Head back to the dashboard to continue your clinical workflow.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0277b6] hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-blue-900/20"
          >
            <Home size={16} />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
