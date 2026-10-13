import { User, ShieldCheck, Lock, Edit } from 'lucide-react';
import { logoutUser } from '../services/authService';

export default function Profile() {
  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Doctor Profile</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">The clinical workstation details you provided when you signed up.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary */}
        <div className="card-surface p-8 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg mb-4 ring-4 ring-rose-50 dark:ring-rose-900/30">
            SM
          </div>
          <h2 className="text-xl font-display font-bold text-deep-navy dark:text-slate-100">Dr. Sarah Mitchell</h2>
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 mb-2">Lead Thoracic Radiologist</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 mb-8 border border-slate-200 dark:border-slate-700">
            <User size={14} /> dr.mitchell
          </div>

          <div className="w-full flex items-center justify-around border-t border-slate-100 dark:border-slate-800 pt-6 mb-6">
            <div>
              <div className="font-bold text-deep-navy dark:text-slate-200">18 Sept 2026</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member Since</div>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
            <div>
              <div className="font-bold text-deep-navy dark:text-slate-200">2 records</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analyses Logged</div>
            </div>
          </div>

          <button
            onClick={() => logoutUser()}
            className="w-full py-2.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {/* Right Column: Account Details */}
        <div className="lg:col-span-2 card-surface p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">Account Details</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Same information captured on your Sign Up screen</p>
            </div>
            <button className="px-4 py-2 bg-[#0b5c92] hover:bg-blue-800 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer">
              <Edit size={16} /> Edit Profile
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Edit size={14} />
                </div>
                <input type="text" readOnly value="Dr. Sarah Mitchell" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role / Title</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <ShieldCheck size={14} />
                </div>
                <input type="text" readOnly value="Lead Thoracic Radiologist" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input type="text" readOnly value="dr.mitchell" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Sign-In Method</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={14} />
                </div>
                <input type="text" readOnly value="Username & Password" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
              </div>
            </div>
          </div>

          <div className="relative flex py-5 items-center mb-4">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 tracking-widest uppercase">Change Password</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Current Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={14} />
                </div>
                <input type="password" placeholder="********" className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b5c92]/20 focus:border-[#0b5c92]" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={14} />
                  </div>
                  <input type="password" placeholder="********" className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b5c92]/20 focus:border-[#0b5c92]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={14} />
                  </div>
                  <input type="password" placeholder="********" className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b5c92]/20 focus:border-[#0b5c92]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
