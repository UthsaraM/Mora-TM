import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  LogIn,
  LogOut,
  CornerDownLeft,
  Clock,
  ShieldAlert,
  Users,
  ScanLine,
  Search,
  X,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import {
  Student,
  TransactionRecord,
  TransactionResponse,
  ServerStatus,
  OccupancyStudent,
  SystemSettings,
  StudentStatus,
} from '../types';
import { OccupancySection } from './OccupancySection';
import { signInWithGoogle, linkStudentIndexToGoogleInFirestore } from '../lib/firebase';

interface MainScreenProps {
  serverStatus: ServerStatus | null;
  googleUser?: FirebaseUser | null;
  currentStudent?: Student | null;
  onStudentLinked?: (student: Student) => void;
  onTransactionSuccess: (tx: TransactionRecord) => void;
  recentTransactions: TransactionRecord[];
  occupancyList: OccupancyStudent[];
  students: Student[];
  onRefreshOccupancy: () => void;
  onSwitchToAdmin?: () => void;
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

export const MainScreen: React.FC<MainScreenProps> = ({
  serverStatus,
  googleUser,
  currentStudent,
  onStudentLinked,
  onTransactionSuccess,
  recentTransactions,
  occupancyList,
  students,
  onRefreshOccupancy,
  onSwitchToAdmin,
}) => {
  const [indexNumber, setIndexNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<TransactionResponse | null>(null);
  const [countdownPercent, setCountdownPercent] = useState(100);

  // First-time linking modal state
  const [showLinkingModal, setShowLinkingModal] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // Quick Search Dropdown & Modal states
  const [showQuickSearchModal, setShowQuickSearchModal] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showInlineSuggestions, setShowInlineSuggestions] = useState(false);
  const [operatorScanMode, setOperatorScanMode] = useState(false);

  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isStreamRevealed, setIsStreamRevealed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const quickSearchInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSystemSettings(data))
      .catch(err => console.error('Failed to load settings in MainScreen:', err));
  }, []);

  // Set of currently inside students for 0ms lookup
  const insideSet = useMemo(() => {
    return new Set(occupancyList.map((s) => s.indexNumber.trim().toLowerCase()));
  }, [occupancyList]);

  // Is the current student inside?
  const isCurrentStudentInside = useMemo(() => {
    if (!currentStudent) return false;
    return insideSet.has(currentStudent.indexNumber.trim().toLowerCase());
  }, [currentStudent, insideSet]);

  // Case-insensitive inline suggestions based on typed input
  const inlineSuggestions = useMemo(() => {
    const trimmed = indexNumber.trim().toLowerCase();
    if (trimmed.length === 0) return [];

    return students
      .filter(
        (s) =>
          s.indexNumber.toLowerCase().includes(trimmed) ||
          s.studentName.toLowerCase().includes(trimmed)
      )
      .slice(0, 6)
      .map((s) => ({
        ...s,
        currentStatus: (insideSet.has(s.indexNumber.toLowerCase()) ? 'INSIDE' : 'OUTSIDE') as StudentStatus,
      }));
  }, [indexNumber, students, insideSet]);

  // Modal search results
  const modalSearchResults = useMemo(() => {
    const q = quickSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter(
        (s) =>
          s.indexNumber.toLowerCase().includes(q) ||
          s.studentName.toLowerCase().includes(q)
      )
      .slice(0, 20)
      .map((s) => ({
        ...s,
        currentStatus: (insideSet.has(s.indexNumber.toLowerCase()) ? 'INSIDE' : 'OUTSIDE') as StudentStatus,
      }));
  }, [quickSearchQuery, students, insideSet]);

  // Focus input automatically on mount and whenever confirmation closes
  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    focusInput();
  }, []);

  // Keyboard shortcut listener for Ctrl+K or Cmd+K to open Quick Search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (showQuickSearchModal) {
      setTimeout(() => quickSearchInputRef.current?.focus(), 50);
    } else {
      focusInput();
    }
  }, [showQuickSearchModal]);

  // Auto-dismiss confirmation after ~2.4 seconds
  const closeConfirmation = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setConfirmation(null);
    setIndexNumber('');
    setShowInlineSuggestions(false);
    setActiveSuggestionIndex(-1);
    focusInput();
  };

  const startConfirmationTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setCountdownPercent(100);
    const startTime = Date.now();
    const duration = 2400;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setCountdownPercent(remaining);
      if (remaining <= 0 && progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }, 40);

    timerRef.current = setTimeout(() => {
      closeConfirmation();
    }, duration);
  };

  // Submit transaction for index (requires Google Account)
  const processIndex = async (indexToProcess: string, forceType?: 'ENTRY' | 'EXIT') => {
    const trimmed = indexToProcess.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a student index number.');
      focusInput();
      return;
    }

    if (!googleUser || !googleUser.email) {
      setErrorMessage('Google Sign-In is required to record transactions. Please sign in with Google first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setShowInlineSuggestions(false);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexNumber: trimmed,
          googleEmail: googleUser.email,
          googleUid: googleUser.uid,
          ...(forceType ? { type: forceType } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'Student not found in roster. Please check index number.';
        setErrorMessage(msg);
        setConfirmation(null);
        focusInput();
        return;
      }

      setConfirmation(data);
      onTransactionSuccess(data.transaction);
      startConfirmationTimer();
    } catch (err: any) {
      setErrorMessage('Database connection failed. Please check your network and retry.');
      setConfirmation(null);
      focusInput();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Tap Entry / Exit for current student
  const handleStudentOneTapSwipe = (forcedType?: 'ENTRY' | 'EXIT') => {
    if (!currentStudent) return;
    const typeToUse = forcedType || (isCurrentStudentInside ? 'EXIT' : 'ENTRY');
    processIndex(currentStudent.indexNumber, typeToUse);
  };

  // Handle first-time student index binding
  const handleLinkStudentIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser || !linkInput.trim()) {
      setLinkError('Please enter your University Index Number.');
      return;
    }

    setIsLinking(true);
    setLinkError(null);

    try {
      const res = await fetch('/api/students/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexNumber: linkInput.trim(),
          googleEmail: googleUser.email,
          googleUid: googleUser.uid,
          studentName: googleUser.displayName || 'Student',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link Index Number.');
      }

      // Sync to Firestore
      linkStudentIndexToGoogleInFirestore(
        data.student.indexNumber,
        googleUser.email || '',
        googleUser.uid,
        data.student.studentName
      ).catch(err => console.warn('Firestore link notice:', err));

      if (onStudentLinked) {
        onStudentLinked(data.student);
      }
      setShowLinkingModal(false);
    } catch (err: any) {
      setLinkError(err.message || 'Linking failed. Please check your index number.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (
      showInlineSuggestions &&
      activeSuggestionIndex >= 0 &&
      inlineSuggestions[activeSuggestionIndex]
    ) {
      processIndex(inlineSuggestions[activeSuggestionIndex].indexNumber);
      return;
    }

    processIndex(indexNumber);
  };

  // Keyboard navigation for suggestions
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (confirmation) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        closeConfirmation();
      }
      return;
    }

    if (!showInlineSuggestions || inlineSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < inlineSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : inlineSuggestions.length - 1
      );
    } else if (e.key === 'Escape') {
      setShowInlineSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowInlineSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-8 space-y-8">
      {/* Navigation Shortcut Bar with Quick Search Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1">
          <a
            href="#scanner-section"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 flex items-center gap-1.5"
          >
            <ScanLine className="w-3.5 h-3.5 text-blue-700" />
            <span>1. Student Entry & Exit</span>
          </a>
          <a
            href="#occupancy-section"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>2. Current Occupancy ({occupancyList.length})</span>
          </a>
        </div>

        {/* Quick Search Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQuickSearchQuery('');
              setShowQuickSearchModal(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 transition-colors cursor-pointer"
            title="Search student by Name or Index (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>Quick Search</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-500">
              Ctrl+K
            </kbd>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION 1: STUDENT ENTRY / EXIT SCANNER              */}
      {/* ==================================================== */}
      <section id="scanner-section" className="space-y-4">
        {/* Venue Title & Mode Banner */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-blue-700" />
            <span>Live Attendance Access Point · Venue: Classroom 1</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
            CLASSROOM 1
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Verified Student Entry & Exit System
          </p>
        </div>

        {/* Main Scanner Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-visible transition-all">
          {/* A. Transaction Confirmation Screen */}
          {confirmation ? (
            <div
              className={`p-6 sm:p-10 text-center relative rounded-2xl overflow-hidden transition-all ${
                confirmation.transaction.type === 'ENTRY'
                  ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white'
                  : 'bg-gradient-to-b from-blue-600 to-blue-700 text-white'
              }`}
            >
              {/* Countdown bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/20">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{ width: `${countdownPercent}%` }}
                />
              </div>

              {/* Indicator Icon */}
              <div className="inline-flex p-3 sm:p-4 rounded-full bg-white/20 backdrop-blur-xs mb-3 shadow-inner">
                {confirmation.transaction.type === 'ENTRY' ? (
                  <LogIn className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                ) : (
                  <LogOut className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                )}
              </div>

              {/* Greeting */}
              <div className="text-lg sm:text-xl font-bold tracking-tight text-white/95 mb-0.5 font-mono">
                {confirmation.greeting}
              </div>

              {/* Student Name */}
              <div className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2">
                {confirmation.student.studentName}
              </div>

              {/* Action Message */}
              <div className="text-sm sm:text-base font-medium text-white/90 mb-4">
                {confirmation.message}
              </div>

              {/* Verified Google Account Stamp */}
              {confirmation.transaction.googleEmail && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-xs text-xs font-mono text-white/90 mb-5 border border-white/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Verified Google Account: {confirmation.transaction.googleEmail}</span>
                </div>
              )}

              {/* Details Box */}
              <div className="inline-grid grid-cols-2 gap-4 bg-black/20 backdrop-blur-md rounded-xl px-6 py-3 border border-white/20 text-left font-mono text-xs sm:text-sm">
                <div>
                  <span className="text-white/70 block text-[11px] uppercase tracking-wider">
                    {confirmation.transaction.type === 'ENTRY' ? 'Entry Time' : 'Exit Time'}
                  </span>
                  <span className="font-bold text-white text-base">
                    {confirmation.transaction.formattedTime}
                  </span>
                </div>
                <div>
                  <span className="text-white/70 block text-[11px] uppercase tracking-wider">Status</span>
                  <span className="font-bold text-white text-base">
                    {confirmation.status}
                  </span>
                </div>
              </div>

              {/* Next Button */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={closeConfirmation}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
                >
                  <span>Done</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                    Enter ↵
                  </span>
                </button>
              </div>
            </div>
          ) : !googleUser ? (
            /* B. MANDATORY GOOGLE SIGN-IN REQUIRED CARD */
            <div className="p-6 sm:p-10 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-700 shadow-sm">
                <GoogleIcon />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Google Authentication Mandatory</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Sign in with Google to Check In / Out
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  To prevent unauthorized proxy check-ins and maintain tamper-proof academic audit records, every entry and exit transaction must be signed with a verified Google account.
                </p>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm font-semibold rounded-xl p-3 max-w-md mx-auto flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                    } catch (err: any) {
                      console.error('Sign-in error:', err);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm sm:text-base py-3.5 px-8 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <GoogleIcon />
                  <span>Sign In with Google to Enter / Exit</span>
                </button>
              </div>
            </div>
          ) : googleUser && !currentStudent ? (
            /* C. GOOGLE SIGNED IN, BUT NEEDS TO LINK UNIVERSITY INDEX */
            <div className="p-6 sm:p-10 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700 shadow-sm">
                <GraduationCap className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google Account: {googleUser.email}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Link University Index Number
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Your Google identity is verified. Please bind your student index number once to connect your account with the Classroom 1 roster.
                </p>
              </div>

              <form onSubmit={handleLinkStudentIndex} className="max-w-xs mx-auto space-y-3">
                {linkError && (
                  <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{linkError}</span>
                  </div>
                )}

                <input
                  type="text"
                  autoFocus
                  required
                  disabled={isLinking}
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="e.g. 22001 or it22001"
                  className="w-full text-center font-mono text-2xl font-bold py-3.5 px-4 border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 bg-slate-50 uppercase"
                />

                <button
                  type="submit"
                  disabled={isLinking || !linkInput.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <span>{isLinking ? 'Verifying...' : 'Link Index & Continue'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            /* D. AUTHENTICATED STUDENT SWIPE INTERFACE (1-TAP ENTRY & EXIT) */
            <div className="p-6 sm:p-10 space-y-6">
              {/* Connected Student Profile Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-700 text-white flex items-center justify-center font-bold text-xl shadow-sm shrink-0 font-mono">
                    {currentStudent?.studentName.charAt(0) || 'S'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-blue-900 text-sm bg-white px-2 py-0.5 rounded border border-blue-200">
                        Index: {currentStudent?.indexNumber}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Google Verified</span>
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                      {currentStudent?.studentName}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Account: {googleUser.email}
                    </div>
                  </div>
                </div>

                {/* Current Room Status Badge */}
                <div className="text-left sm:text-right shrink-0">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Classroom 1 Status
                  </div>
                  {isCurrentStudentInside ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 font-bold text-xs uppercase tracking-wide border border-emerald-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span>Inside Classroom 1</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wide border border-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      <span>Outside Classroom</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm font-semibold rounded-xl p-3.5 flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* PRIMARY 1-TAP SWIPE ACTION BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Entry Action */}
                <button
                  type="button"
                  onClick={() => handleStudentOneTapSwipe('ENTRY')}
                  disabled={isSubmitting}
                  className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-md hover:shadow-lg ${
                    !isCurrentStudentInside
                      ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white ring-4 ring-emerald-100'
                      : 'bg-white hover:bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${!isCurrentStudentInside ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                      <LogIn className="w-7 h-7" />
                    </div>
                    <div className="text-left">
                      <div className="text-base sm:text-lg font-black uppercase tracking-wide">
                        Record Entry
                      </div>
                      <div className={`text-xs ${!isCurrentStudentInside ? 'text-white/80' : 'text-slate-500'}`}>
                        Check in to Classroom 1
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 shrink-0 opacity-70" />
                </button>

                {/* Exit Action */}
                <button
                  type="button"
                  onClick={() => handleStudentOneTapSwipe('EXIT')}
                  disabled={isSubmitting}
                  className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-md hover:shadow-lg ${
                    isCurrentStudentInside
                      ? 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white ring-4 ring-blue-100'
                      : 'bg-white hover:bg-blue-50 border-blue-300 text-blue-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${isCurrentStudentInside ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                      <LogOut className="w-7 h-7" />
                    </div>
                    <div className="text-left">
                      <div className="text-base sm:text-lg font-black uppercase tracking-wide">
                        Record Exit
                      </div>
                      <div className={`text-xs ${isCurrentStudentInside ? 'text-white/80' : 'text-slate-500'}`}>
                        Check out of Classroom 1
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 shrink-0 opacity-70" />
                </button>
              </div>

              {/* Operator Barcode / Other Student Scan Option Toggle */}
              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOperatorScanMode(!operatorScanMode)}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                >
                  {operatorScanMode ? 'Hide Manual Index Scanner' : 'Proctor / Operator Mode: Scan Another Student Index Number'}
                </button>
              </div>

              {/* Optional Manual Scan Input Form for operators */}
              {operatorScanMode && (
                <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                  <div className="text-xs font-bold text-slate-700 uppercase">
                    Operator Station: Enter Or Scan Any Student Index Number
                  </div>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      disabled={isSubmitting}
                      value={indexNumber}
                      onChange={(e) => {
                        setIndexNumber(e.target.value);
                        setShowInlineSuggestions(true);
                      }}
                      onKeyDown={handleInputKeyDown}
                      placeholder="e.g. 22002 or scan barcode..."
                      className="w-full text-center font-mono text-xl font-bold py-3 px-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />

                    {/* Inline suggestions */}
                    {showInlineSuggestions && inlineSuggestions.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 text-xs"
                      >
                        {inlineSuggestions.map((s, idx) => (
                          <div
                            key={s.indexNumber}
                            onClick={() => processIndex(s.indexNumber)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer ${
                              idx === activeSuggestionIndex ? 'bg-blue-100 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-mono font-bold text-blue-900">{s.indexNumber}</span>
                            <span className="text-slate-800">{s.studentName}</span>
                            <span className="text-blue-700 underline font-semibold">
                              {s.currentStatus === 'INSIDE' ? 'Scan Exit →' : 'Scan Entry →'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !indexNumber.trim()}
                      className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {isSubmitting ? 'Recording...' : 'Submit Operator Scan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperatorScanMode(false)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ==================================================== */}
      {/* SECTION 2: CURRENT OCCUPANCY                         */}
      {/* ==================================================== */}
      <section id="occupancy-section">
        <OccupancySection
          occupancyList={occupancyList}
          occupancyCount={occupancyList.length}
          onRefresh={onRefreshOccupancy}
        />
      </section>

      {/* ==================================================== */}
      {/* SECTION 3: ATTENDANCE HISTORY & PRIVACY              */}
      {/* ==================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {systemSettings?.hidePublicScanStreamOnKiosk && !isStreamRevealed ? (
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold text-[11px] uppercase">
                    Privacy Guard Active
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Public Scan History Protected
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Classroom 1 Attendance History & Logs
                </h3>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  For privacy protection, individual student scans are secured. Authorized proctors can reveal the live feed below.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsStreamRevealed(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Show recent scans for proctor station"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Show Activity Stream</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                  Live Activity Stream (Classroom 1)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {systemSettings?.hidePublicScanStreamOnKiosk && (
                  <button
                    type="button"
                    onClick={() => setIsStreamRevealed(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                    title="Hide scan stream again"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide</span>
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {recentTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No transactions recorded yet today. Sign in and swipe above to record check-in.
                </div>
              ) : (
                recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-white font-bold text-[11px] ${
                          tx.type === 'ENTRY' ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                      >
                        {tx.type === 'ENTRY' ? (
                          <LogIn className="w-3.5 h-3.5" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{tx.studentName}</span>
                          <span className="font-mono text-blue-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                            {tx.studentIndexNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{tx.type === 'ENTRY' ? 'Entered Classroom 1' : 'Left Classroom 1'}</span>
                          {tx.googleEmail && (
                            <span className="font-mono text-[10px] text-slate-400">
                              · {tx.googleEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-800">{tx.formattedTime}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.date}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {/* ==================================================== */}
      {/* QUICK SEARCH MODAL (SEARCH BY NAME OR INDEX)         */}
      {/* ==================================================== */}
      {showQuickSearchModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Quick Student Search</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSearchModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  ref={quickSearchInputRef}
                  type="text"
                  value={quickSearchQuery}
                  onChange={(e) => setQuickSearchQuery(e.target.value)}
                  placeholder="Type student name or index number (case-insensitive)..."
                  className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {quickSearchQuery && (
                  <button
                    onClick={() => setQuickSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                <span>Case-insensitive matching across all {students.length} students</span>
                <span>Press ESC to close</span>
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2">
              {!quickSearchQuery.trim() ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Start typing an index number or student name above to see matches...
                </div>
              ) : modalSearchResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No students found matching "{quickSearchQuery}".
                </div>
              ) : (
                modalSearchResults.map((s) => (
                  <div
                    key={s.indexNumber}
                    className="p-3 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-xs">
                          {s.indexNumber}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {s.studentName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Current Status:</span>
                        {s.currentStatus === 'INSIDE' ? (
                          <span className="font-bold text-amber-700">INSIDE Classroom 1</span>
                        ) : (
                          <span className="font-bold text-slate-600">OUTSIDE</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickSearchModal(false);
                        processIndex(s.indexNumber);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer ${
                        s.currentStatus === 'INSIDE'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {s.currentStatus === 'INSIDE' ? 'Process Exit →' : 'Process Entry →'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span>Clicking an action button records the transaction immediately.</span>
              <button
                type="button"
                onClick={() => setShowQuickSearchModal(false)}
                className="px-3 py-1 rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MOBILE FIXED BOTTOM NAVIGATION BAR                   */}
      {/* ==================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl px-3 py-1.5 flex items-center justify-around md:hidden"
      >
        {/* 1. Entry & Exit Scanner */}
        <a
          href="#scanner-section"
          className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-700 active:scale-95 transition-all p-1"
        >
          <div className="p-1.5 rounded-full bg-blue-50 text-blue-700">
            <ScanLine className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Entry / Scan</span>
        </a>

        {/* 2. Live Occupancy */}
        <a
          href="#occupancy-section"
          className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-purple-700 active:scale-95 transition-all p-1 relative"
        >
          <div className="p-1.5 rounded-full bg-purple-50 text-purple-700 relative">
            <Users className="w-5 h-5" />
            {occupancyList.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-mono text-[9px] font-bold ring-2 ring-white">
                {occupancyList.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-tight">Occupancy</span>
        </a>

        {/* 3. Quick Search */}
        <button
          type="button"
          onClick={() => {
            setQuickSearchQuery('');
            setShowQuickSearchModal(true);
          }}
          className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-700 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <div className="p-1.5 rounded-full bg-slate-100 text-slate-700">
            <Search className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Search</span>
        </button>
      </nav>
    </div>
  );
};
