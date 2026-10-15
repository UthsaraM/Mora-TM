import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Clock,
  Calendar,
  Lock,
  ArrowRight,
  LogIn,
  AlertCircle,
  GraduationCap,
  KeyRound,
} from 'lucide-react';
import { getColomboFullDateTimeString } from '../utils/time';
import { ServerStatus } from '../types';

interface LandingPageProps {
  serverStatus: ServerStatus | null;
  onContinueAsUser: () => void;
  onAdminLoginSuccess: (token: string, adminName: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  serverStatus,
  onContinueAsUser,
  onAdminLoginSuccess,
}) => {
  const [timeState, setTimeState] = useState<{ dateStr: string; timeStr: string }>({
    dateStr: '',
    timeStr: '',
  });
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setTimeState(getColomboFullDateTimeString());
    const timer = setInterval(() => {
      setTimeState(getColomboFullDateTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setLoginError('Please enter the administrator password.');
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          adminName: adminName.trim() || 'Classroom 1 Administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Incorrect administrator password.');
      }

      onAdminLoginSuccess(data.token, data.adminName);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please verify the password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col justify-between">
      {/* Top Bar with Venue & Live Clock */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-900 text-white rounded font-mono font-bold tracking-wider text-[11px] uppercase">
              Classroom 1
            </span>
            <span className="text-slate-600 font-medium">
              University Academic Access Portal
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-slate-700">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{timeState.dateStr || '...'}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span className="font-bold text-slate-900">{timeState.timeStr || '--:--:--'}</span>
              <span className="text-[10px] text-slate-500 uppercase bg-slate-100 px-1 py-0.5 rounded">
                Asia/Colombo
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Landing Area */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-16 w-full flex-1 flex flex-col justify-center">
        {/* Hero Title */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-full text-xs font-semibold tracking-wide">
            <GraduationCap className="w-4 h-4 text-blue-700" />
            <span>Academic Attendance & Access Management</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight font-mono">
            CLASSROOM 1
          </h1>
          <p className="text-base sm:text-lg font-medium text-slate-600 max-w-xl mx-auto">
            Student Entry & Exit Management System
          </p>
        </div>

        {/* Two Access Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
          {/* Option 1: Continue as User */}
          <div className="bg-white rounded-2xl border-2 border-blue-600 shadow-md hover:shadow-xl transition-all p-6 sm:p-8 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <User className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Quick Access · No Login Required
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                  User Mode
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Fast student check-in and check-out for classroom operators and proctors.
                </p>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Record student entry and exit scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>View live current classroom occupancy</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={onContinueAsUser}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-sm transition-all cursor-pointer group-hover:bg-blue-800"
              >
                <span>Continue as User</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Option 2: Admin Login */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md hover:shadow-xl transition-all p-6 sm:p-8 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restricted · Password Required
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                  Admin Login
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Full administrative control for department chairs, instructors, and system administrators.
                </p>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Upload & manage university student rosters</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Add, edit, or deactivate student accounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Transaction corrections with audit trail</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Download official Excel-compatible CSV reports</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(true);
                  setLoginError(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4 text-slate-300" />
                <span>Admin Login</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Venue: Classroom 1 · Persistent Server Database</span>
          <span className="font-mono text-slate-400">
            Current Server Storage: {serverStatus?.storageType || 'Active'}
          </span>
        </div>
      </footer>

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Administrator Login</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div className="text-xs text-slate-600">
                Please enter the administrator password to access student rosters, transaction corrections, and administrative controls.
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Name (Optional)
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Dr. Perera / Proctor A"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  className="w-full text-sm font-mono p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Default password: <code className="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-blue-900">admin123</code> (can be changed in Admin Settings).
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !adminPassword.trim()}
                  className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Verifying...' : 'Authenticate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
