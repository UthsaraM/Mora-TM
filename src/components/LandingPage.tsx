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
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { getColomboFullDateTimeString } from '../utils/time';
import { ServerStatus, VerifiedAdmin, Student } from '../types';
import { signInWithGoogle, linkStudentIndexToGoogleInFirestore } from '../lib/firebase';

interface LandingPageProps {
  serverStatus: ServerStatus | null;
  onContinueAsUser: () => void;
  onAdminLoginSuccess: (token: string, adminName: string, adminEmail?: string) => void;
  onStudentLoginSuccess?: (student: Student) => void;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  serverStatus,
  onContinueAsUser,
  onAdminLoginSuccess,
  onStudentLoginSuccess,
}) => {
  const [timeState, setTimeState] = useState<{ dateStr: string; timeStr: string }>({
    dateStr: '',
    timeStr: '',
  });

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [verifiedAdmins, setVerifiedAdmins] = useState<VerifiedAdmin[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [customIdentifier, setCustomIdentifier] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Google Authentication & Student Index Binding states
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [showIndexLinkModal, setShowIndexLinkModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    email: string;
    uid: string;
    displayName: string;
  } | null>(null);
  const [linkIndexInput, setLinkIndexInput] = useState('');
  const [linkIndexError, setLinkIndexError] = useState<string | null>(null);
  const [isLinkingIndex, setIsLinkingIndex] = useState(false);

  // Fetch list of verified administrators
  const fetchVerifiedAdmins = async () => {
    try {
      const res = await fetch('/api/admin/verified-people');
      if (res.ok) {
        const data = await res.json();
        const admins: VerifiedAdmin[] = data.admins || [];
        setVerifiedAdmins(admins);
        if (admins.length > 0 && !selectedAdminId) {
          setSelectedAdminId(admins[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load verified administrators:', err);
    }
  };

  useEffect(() => {
    fetchVerifiedAdmins();
  }, []);

  useEffect(() => {
    setTimeState(getColomboFullDateTimeString());
    const timer = setInterval(() => {
      setTimeState(getColomboFullDateTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Primary Unified Google Authentication Action
  const handleGoogleAuth = async () => {
    setIsGoogleSigningIn(true);
    setGoogleAuthError(null);

    try {
      const user = await signInWithGoogle();
      const email = user.email || '';
      const uid = user.uid;
      const displayName = user.displayName || 'University Member';

      // 1. Check if user is a verified administrator (or Super Admin uthzaaawim@gmail.com)
      try {
        const adminRes = await fetch('/api/admin/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, displayName, uid }),
        });

        if (adminRes.ok) {
          const adminData = await adminRes.json();
          onAdminLoginSuccess(adminData.token, adminData.adminName, adminData.adminEmail);
          return;
        }
      } catch (adminErr) {
        // Not an administrator; proceed to student verification flow
      }

      // 2. Query server to check if this Google account is already linked to a student
      const studentRes = await fetch('/api/student/google-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, uid }),
      });

      const studentData = await studentRes.json();
      if (studentData.isLinked && studentData.student) {
        if (onStudentLoginSuccess) {
          onStudentLoginSuccess(studentData.student);
        }
        onContinueAsUser();
      } else {
        // First-time student login: Prompt to bind university index number
        setPendingGoogleUser({ email, uid, displayName });
        setLinkIndexInput('');
        setLinkIndexError(null);
        setShowIndexLinkModal(true);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      if (!err.message?.includes('popup-closed-by-user')) {
        setGoogleAuthError(err.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // Submit First-Time Index Number Binding
  const handleLinkStudentIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser || !linkIndexInput.trim()) {
      setLinkIndexError('Please enter your University Index Number.');
      return;
    }

    setIsLinkingIndex(true);
    setLinkIndexError(null);

    try {
      const res = await fetch('/api/students/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexNumber: linkIndexInput.trim(),
          googleEmail: pendingGoogleUser.email,
          googleUid: pendingGoogleUser.uid,
          studentName: pendingGoogleUser.displayName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link Index Number.');
      }

      // Also sync link directly to cloud Firestore
      linkStudentIndexToGoogleInFirestore(
        data.student.indexNumber,
        pendingGoogleUser.email,
        pendingGoogleUser.uid,
        data.student.studentName
      ).catch(e => console.warn('Firestore link notice:', e));

      setShowIndexLinkModal(false);
      if (onStudentLoginSuccess) {
        onStudentLoginSuccess(data.student);
      }
      onContinueAsUser();
    } catch (err: any) {
      setLinkIndexError(err.message || 'Linking failed. Please verify your index number.');
    } finally {
      setIsLinkingIndex(false);
    }
  };

  // Password-based Admin Login Fallback
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setLoginError('Please enter the administrator password.');
      return;
    }

    if (!selectedAdminId) {
      setLoginError('Please select or specify a verified administrator.');
      return;
    }

    if (selectedAdminId === 'OTHER' && !customIdentifier.trim()) {
      setLoginError('Please enter your verified university email or staff ID.');
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const payload: { password: string; adminId?: string; email?: string; adminName?: string } = {
        password: adminPassword,
      };

      if (selectedAdminId === 'OTHER') {
        payload.email = customIdentifier.trim();
      } else {
        payload.adminId = selectedAdminId;
        const matched = verifiedAdmins.find(a => a.id === selectedAdminId);
        if (matched) {
          payload.adminName = matched.name;
        }
      }

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Incorrect administrator password or unverified account.');
      }

      onAdminLoginSuccess(data.token, data.adminName, data.adminEmail);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please verify credentials.');
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
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-14 w-full flex-1 flex flex-col justify-center">
        {/* Hero Title */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-full text-xs font-semibold tracking-wide">
            <GraduationCap className="w-4 h-4 text-blue-700" />
            <span>Academic Attendance & Access Management</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight font-mono">
            CLASSROOM 1
          </h1>
          <p className="text-sm sm:text-base font-medium text-slate-600 max-w-xl mx-auto">
            Mandatory Google Verified Attendance & Access Control System
          </p>
        </div>

        {/* Global Error Banner if any */}
        {googleAuthError && (
          <div className="max-w-3xl mx-auto w-full mb-6 bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{googleAuthError}</span>
          </div>
        )}

        {/* PRIMARY ACTION CARD: Single Unified Google Sign-In */}
        <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl border-2 border-blue-600 shadow-xl p-6 sm:p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900">
                <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                <span>Primary Unified Authentication</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Sign in with Google Account
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed">
                One-tap entry for students and authorized faculty. Records your verified Google email on every swipe and binds your University Index Number.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isGoogleSigningIn}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm sm:text-base py-3.5 px-6 rounded-xl border border-slate-300 shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <GoogleIcon />
              <span>{isGoogleSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Secondary Navigation Options: Kiosk User Mode & Admin Portal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
          {/* Option 1: Continue as Kiosk User */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Student & Operator Mode
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Open the Classroom 1 swiper interface. Perform Entry & Exit swipes and inspect live occupancy.
                </p>
              </div>

              <div className="pt-2 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>1-tap Entry & Exit for connected students</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Live room occupancy count</span>
                </div>
              </div>
            </div>

            <div className="pt-5">
              <button
                type="button"
                onClick={onContinueAsUser}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-900 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                <span>Enter User Mode</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Option 2: Admin Portal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Administrative Portal
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Governed by Super Administrator <code className="font-mono text-blue-700">uthzaaawim@gmail.com</code>. Manage rosters, reports & logs.
                </p>
              </div>

              <div className="pt-2 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Verified administrator whitelist & roles</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Excel CSV reports with Google account proof</span>
                </div>
              </div>
            </div>

            <div className="pt-5">
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(true);
                  setLoginError(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-slate-300" />
                <span>Admin Login</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Venue: Classroom 1 · University Entry & Exit Access System</span>
          </div>
          <span className="font-mono text-slate-400">
            Storage Engine: {serverStatus?.storageType || 'Cloud & Server Synced'}
          </span>
        </div>
      </footer>

      {/* ==================================================== */}
      {/* MODAL 1: FIRST-TIME STUDENT INDEX BINDING            */}
      {/* ==================================================== */}
      {showIndexLinkModal && pendingGoogleUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Link University Index Number</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexLinkModal(false)}
                className="text-blue-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLinkStudentIndex} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <div className="text-xs text-blue-900 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Google Account Verified</span>
                </div>
                <div className="text-xs font-mono text-slate-700 truncate">
                  {pendingGoogleUser.email}
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                First-time Google Sign-In detected. Please enter your official University Index Number once. This binds your Google identity to your student record for all subsequent check-ins.
              </div>

              {linkIndexError && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{linkIndexError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  University Index Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  disabled={isLinkingIndex}
                  value={linkIndexInput}
                  onChange={(e) => setLinkIndexInput(e.target.value)}
                  placeholder="e.g. 22001 or it22001"
                  className="w-full text-center font-mono text-xl font-bold py-3 px-4 border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 bg-slate-50 uppercase"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Must match an active student registered in the Classroom 1 roster.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIndexLinkModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLinkingIndex || !linkIndexInput.trim()}
                  className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  <span>{isLinkingIndex ? 'Linking...' : 'Confirm & Proceed'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: ADMINISTRATOR LOGIN                         */}
      {/* ==================================================== */}
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

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Super Administrator Whitelist: Managed by <strong className="font-mono">uthzaaawim@gmail.com</strong>.</span>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Instant Google Admin Login Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isGoogleSigningIn}
                  className="w-full inline-flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs py-3 px-4 border border-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <GoogleIcon />
                  <span>{isGoogleSigningIn ? 'Authenticating...' : 'Sign In as Admin with Google'}</span>
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-semibold">Or with password</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                {/* Verified Administrator Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Verified Administrator Profile <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {verifiedAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name} ({admin.role} · {admin.staffId})
                      </option>
                    ))}
                    <option value="OTHER">Enter other verified university email / staff ID...</option>
                  </select>
                </div>

                {/* If OTHER selected, allow manual email / staffId input */}
                {selectedAdminId === 'OTHER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verified Staff Email or Staff ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customIdentifier}
                      onChange={(e) => setCustomIdentifier(e.target.value)}
                      placeholder="e.g. uthzaaawim@gmail.com or ADM-001"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Administrator Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Administrator Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter administrator password..."
                    className="w-full text-sm font-mono p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Verifying...' : 'Authenticate'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
