import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Stethoscope, ArrowRight, ShieldCheck, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';
import { loginUser, registerUser, loginAsGuest, loginWithGoogleFirebase } from '../services/authService';
import { useToast } from '../components/Toast';

const GoogleIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('app_theme') === 'light' ? 'light' : 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('app_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('themeChange'));
  };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Lead Thoracic Radiologist');
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!username.trim()) { setError('Please enter a username'); return; }
    if (!password.trim()) { setError('Please enter a password'); return; }

    setLoading(true);
    try {
      if (isSignUp) {
        await registerUser(username, password, fullName, role);
        success(`Account created! Welcome, ${fullName || username}.`);
      } else {
        await loginUser(username, password);
        success('Welcome back! Signed in successfully.');
      }
      navigate('/');
    } catch (err: any) {
      const msg = err.message || (isSignUp ? 'Registration failed.' : 'Login failed. Please try again.');
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginAsGuest();
      success('Signed in as Guest.');
      navigate('/');
    } catch (err: any) {
      showError(err.message || 'Guest login failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirebaseGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginWithGoogleFirebase();
      success(`Welcome, ${user.name}!`);
      navigate('/');
    } catch (err: any) {
      const msg = err.message || 'Google sign-in failed.';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputRow = "relative flex items-center rounded-xl bg-[#e8edf3] dark:bg-[#0d1424] shadow-[inset_2px_2px_5px_#c5cfdb,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_#060a12,inset_-2px_-2px_5px_#1a2640] px-3 border border-transparent transition-all";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#e8edf3] dark:bg-[#0a0f1d] text-slate-800 dark:text-slate-100 selection:bg-sky-500 selection:text-white relative overflow-hidden font-sans">
      {/* Ambient glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-200/35 dark:bg-blue-900/12 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-sky-200/35 dark:bg-sky-950/12 blur-[100px] pointer-events-none" />

      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 p-2.5 rounded-full bg-[#e8edf3] dark:bg-[#0d1424] text-slate-600 dark:text-slate-300 shadow-[4px_4px_8px_#c3ccd8,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#05080f,-4px_-4px_8px_#141f36] border border-white/60 dark:border-slate-800/60 hover:text-[#0b5c92] dark:hover:text-sky-400 transition-colors cursor-pointer"
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* ── Circular Disc ── */}
      <div className={clsx(
        "relative rounded-full aspect-square bg-[#e8edf3] dark:bg-[#0d1424] transition-all duration-500",
        "shadow-[20px_20px_40px_#c3ccd8,-20px_-20px_40px_#ffffff] dark:shadow-[18px_18px_40px_#04070d,-18px_-18px_40px_#141f36]",
        "border border-white/60 dark:border-slate-800/60",
        "flex items-center justify-center",
        isSignUp
          ? "w-[min(94vw,620px)] h-[min(94vw,620px)]"
          : "w-[min(90vw,520px)] h-[min(90vw,520px)]"
      )}>
        {/* Inner concentric ring */}
        <div className="absolute inset-3 rounded-full pointer-events-none border border-white/45 dark:border-slate-700/20" />

        {/* Content */}
        <div className={clsx(
          "relative z-10 flex flex-col items-center w-full px-10",
          isSignUp ? "max-w-[390px] gap-2" : "max-w-[350px] gap-2.5"
        )}>

          {/* ── Header ── */}
          <div className="text-center">
            <h1 className={clsx(
              "font-display font-extrabold tracking-tight text-[#2d3748] dark:text-slate-100",
              isSignUp ? "text-2xl" : "text-3xl"
            )}>
              {isSignUp ? 'Sign Up' : 'Login'}
            </h1>
            <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {isSignUp ? 'Create your clinical workstation profile' : 'Sign in to your account'}
            </p>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="w-full p-2 rounded-xl text-[10.5px] font-semibold bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400 text-center">
              {error}
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSignIn} className="w-full flex flex-col gap-2">

            {/* Sign-Up extra fields */}
            {isSignUp && (
              <>
                <div className={clsx(inputRow, "py-2 focus-within:border-sky-400/70")}>
                  <ShieldCheck size={14} className="text-[#0284c7] dark:text-sky-400 shrink-0 mr-2" />
                  <input type="text" placeholder="Full Name (Dr. Sarah Mitchell)" value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none font-medium py-2" />
                </div>
                <div className={clsx(inputRow, "py-2 focus-within:border-sky-400/70")}>
                  <Stethoscope size={14} className="text-slate-400 shrink-0 mr-2" />
                  <input type="text" placeholder="Clinical Role (e.g. Radiologist)" value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none font-medium py-2" />
                </div>
              </>
            )}

            {/* Username */}
            <div className={clsx(inputRow, "py-2 border-sky-400/80 dark:border-sky-500/60 focus-within:border-blue-500 ring-[1.5px] ring-sky-400/20")}>
              <User size={14} className="text-[#0284c7] dark:text-sky-400 shrink-0 mr-2" />
              <input
                id="username"
                type="text"
                placeholder="Username (e.g. admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none font-medium py-2"
              />
            </div>

            {/* Password — now functional with show/hide toggle */}
            <div className={clsx(inputRow, "py-2 focus-within:border-slate-300 dark:focus-within:border-slate-600")}>
              <Lock size={14} className="text-slate-400 dark:text-slate-500 shrink-0 mr-2" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none font-medium py-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            {/* Hint for demo */}
            <p className="text-[9.5px] text-slate-400 text-center -mt-1">
              Demo: username <span className="font-bold text-slate-500">admin</span> / password <span className="font-bold text-slate-500">admin123</span> &nbsp;|&nbsp; guest / guest
            </p>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between text-[10.5px] px-0.5">
              <label onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-1.5 cursor-pointer select-none text-slate-500 dark:text-slate-400 font-medium">
                <div className="w-7 h-3.5 rounded-full p-0.5 flex items-center bg-[#e0e7ee] dark:bg-slate-800 shadow-[inset_1.5px_1.5px_3px_#c5cfdb,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#05080f,inset_-1.5px_-1.5px_3px_#182338]">
                  <div className={clsx(
                    "w-2.5 h-2.5 rounded-full transition-transform duration-200 shadow-sm",
                    rememberMe ? "translate-x-3.5 bg-[#0284c7]" : "translate-x-0 bg-[#e8edf3] dark:bg-slate-300"
                  )} />
                </div>
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setError('Please contact your hospital IT administrator or radiology department head to reset your password.')}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-medium"
              >
                Forgot password?
              </button>
            </div>

            {/* Main CTA Button */}
            <button type="submit" disabled={loading}
              className={clsx(
                "w-full rounded-xl text-[10.5px] font-extrabold tracking-widest uppercase transition-all duration-200 cursor-pointer select-none",
                "py-2.5 bg-[#e8edf3] dark:bg-[#0d1424] text-slate-700 dark:text-slate-200",
                "shadow-[5px_5px_12px_#c3ccd8,-5px_-5px_12px_#ffffff] dark:shadow-[5px_5px_12px_#05080f,-5px_-5px_12px_#15203a]",
                "hover:shadow-[3px_3px_6px_#c3ccd8,-3px_-3px_6px_#ffffff] hover:text-slate-900 dark:hover:text-white",
                "active:shadow-[inset_2px_2px_5px_#c3ccd8,inset_-2px_-2px_5px_#ffffff] active:scale-[0.99]",
                loading && "opacity-60 cursor-not-allowed"
              )}>
              {loading ? 'SIGNING IN…' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
            </button>

            {/* Google Sign-In — opens real Firebase Google popup */}
            <button type="button" onClick={handleFirebaseGoogleSignIn} disabled={loading}
              className={clsx(
                "w-full py-2 rounded-xl text-[10.5px] font-bold flex items-center justify-center gap-2 cursor-pointer",
                "bg-[#e8edf3] dark:bg-[#0d1424] text-slate-700 dark:text-slate-200",
                "border border-slate-300/35 dark:border-slate-700/35",
                "shadow-[3px_3px_8px_#c5cfdb,-3px_-3px_8px_#ffffff] dark:shadow-[3px_3px_8px_#060a12,-3px_-3px_8px_#18243c]",
                "hover:shadow-[2px_2px_4px_#c5cfdb,-2px_-2px_4px_#ffffff] hover:text-slate-900 dark:hover:text-white transition-all",
                loading && "opacity-60 cursor-not-allowed"
              )}>
              <GoogleIcon />
              <span>Sign in with Google</span>
            </button>

            {/* Continue as Guest */}
            <button type="button" onClick={handleGuestLogin} disabled={loading}
              className="w-full py-1 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50">
              <Stethoscope size={12} className="text-[#0284c7] dark:text-sky-400" />
              <span>Continue as Guest</span>
              <ArrowRight size={10} />
            </button>

            {/* Switch mode */}
            <div className="text-center text-[10.5px] text-slate-500 dark:text-slate-400">
              {isSignUp ? (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => { setIsSignUp(false); setError(null); }}
                    className="text-[#0284c7] dark:text-sky-400 font-bold hover:underline cursor-pointer">Sign in</button>
                </>
              ) : (
                <>Don't have an account?{' '}
                  <button type="button" onClick={() => { setIsSignUp(true); setError(null); }}
                    className="text-[#0284c7] dark:text-sky-400 font-bold hover:underline cursor-pointer">Sign up</button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
