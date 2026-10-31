import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  ShieldCheck, 
  Lock, 
  Edit, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save, 
  X, 
  Building2, 
  KeyRound,
  LogOut
} from 'lucide-react';
import { getAuthUser, logoutUser, updateUserProfile, changePassword, type AuthUser } from '../services/authService';
import { getHistory } from '../services/historyService';

function getInitials(name?: string): string {
  if (!name) return 'DR';
  const clean = name.replace(/^dr\.\s*/i, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'DR';
}

export default function Profile() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [analysesCount, setAnalysesCount] = useState<number>(0);
  
  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const user = getAuthUser();
    if (user) {
      setCurrentUser(user);
      setName(user.name || '');
      setRole(user.role || '');
      setDepartment(user.department || '');
    }

    // Load actual logged analyses count
    getHistory()
      .then((records) => setAnalysesCount(records.length))
      .catch(() => setAnalysesCount(0));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);

    try {
      const updated = await updateUserProfile({
        name: name.trim(),
        role: role.trim(),
        department: department.trim(),
      });
      setCurrentUser(updated);
      setIsEditing(false);
      setProfileMsg({ type: 'success', text: 'Workstation profile updated successfully.' });
      setTimeout(() => setProfileMsg(null), 4000);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const successMessage = await changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: successMessage || 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const displayName = currentUser?.name || 'Dr. Clinician';
  const displayRole = currentUser?.role || 'Thoracic Radiologist';
  const displayDept = currentUser?.department || 'Thoracic Radiology & AI Clinical Intelligence';
  const displayUsername = currentUser?.id || 'guest';
  const isGoogleUser = !!currentUser?.email && !currentUser?.id.startsWith('guest') && !currentUser?.id.startsWith('admin');

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-deep-navy dark:text-slate-100">Doctor Profile</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Workstation credentials, clinical affiliation, and security preferences.</p>
      </div>

      {profileMsg && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${
          profileMsg.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        }`}>
          {profileMsg.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
          <span>{profileMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary */}
        <div className="card-surface p-8 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg mb-4 ring-4 ring-rose-50 dark:ring-rose-900/30">
            {getInitials(displayName)}
          </div>
          <h2 className="text-xl font-display font-bold text-deep-navy dark:text-slate-100">{displayName}</h2>
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 mb-2">{displayRole}</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 mb-8 border border-slate-200 dark:border-slate-700">
            <User size={14} /> @{displayUsername}
          </div>

          <div className="w-full flex items-center justify-around border-t border-slate-100 dark:border-slate-800 pt-6 mb-6">
            <div>
              <div className="font-bold text-deep-navy dark:text-slate-200">Active</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Status</div>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
            <div>
              <div className="font-bold text-deep-navy dark:text-slate-200">{analysesCount} {analysesCount === 1 ? 'record' : 'records'}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analyses Logged</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        {/* Right Column: Account Details & Password Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workstation Profile Card */}
          <div className="card-surface p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100">Workstation Details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Information stamped on generated structured radiological reports</p>
              </div>
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-[#0b5c92] hover:bg-blue-800 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Edit size={16} /> Edit Profile
                </button>
              ) : (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X size={15} /> Cancel
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Clinician Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Edit size={14} />
                      </div>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#0b5c92]/30 focus:border-[#0b5c92] outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Clinical Role / Title</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <ShieldCheck size={14} />
                      </div>
                      <input 
                        type="text" 
                        value={role} 
                        onChange={(e) => setRole(e.target.value)} 
                        required
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#0b5c92]/30 focus:border-[#0b5c92] outline-none" 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Department / Hospital Center</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 size={14} />
                    </div>
                    <input 
                      type="text" 
                      value={department} 
                      onChange={(e) => setDepartment(e.target.value)} 
                      required
                      className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#0b5c92]/30 focus:border-[#0b5c92] outline-none" 
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={profileSaving}
                    className="px-5 py-2 bg-[#0b5c92] hover:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User size={14} />
                    </div>
                    <input type="text" readOnly value={displayName} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role / Title</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <ShieldCheck size={14} />
                    </div>
                    <input type="text" readOnly value={displayRole} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Workstation ID / Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User size={14} />
                    </div>
                    <input type="text" readOnly value={displayUsername} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Department</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 size={14} />
                    </div>
                    <input type="text" readOnly value={displayDept} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Security & Password Management Card */}
          <div className="card-surface p-8">
            <div className="mb-6">
              <h3 className="text-lg font-display font-bold text-deep-navy dark:text-slate-100 flex items-center gap-2">
                <KeyRound size={20} className="text-[#0b5c92] dark:text-sky-400" /> Security & Password
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage your workstation password and credential security</p>
            </div>

            {isGoogleUser ? (
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-sm flex items-center gap-3">
                <ShieldCheck size={20} className="shrink-0 text-sky-600 dark:text-sky-400" />
                <div>
                  <p className="font-semibold">Signed in with Google Authentication</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">Password management and 2FA are securely managed through your Google Account ({currentUser?.email}).</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordMsg && (
                  <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold border ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}>
                    {passwordMsg.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Current Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock size={14} />
                    </div>
                    <input 
                      type="password" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••" 
                      className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b5c92]/20 focus:border-[#0b5c92]" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock size={14} />
                      </div>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        placeholder="•••••••• (min 6 chars)" 
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b5c92]/20 focus:border-[#0b5c92]" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock size={14} />
                      </div>
                      <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••" 
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b5c92]/20 focus:border-[#0b5c92]" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="px-5 py-2.5 bg-[#0b5c92] hover:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                    Update Workstation Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
