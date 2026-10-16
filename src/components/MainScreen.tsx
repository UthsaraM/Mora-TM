import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  UserCheck,
  Sparkles,
  Command,
  History,
  ShieldCheck,
  Lock,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Student,
  TransactionRecord,
  TransactionResponse,
  ServerStatus,
  OccupancyStudent,
  StudentAttendanceHistory,
  SystemSettings,
} from '../types';
import { OccupancySection } from './OccupancySection';

interface MainScreenProps {
  serverStatus: ServerStatus | null;
  onTransactionSuccess: (tx: TransactionRecord) => void;
  recentTransactions: TransactionRecord[];
  occupancyList: OccupancyStudent[];
  students: Student[];
  onRefreshOccupancy: () => void;
  onSwitchToAdmin: () => void;
}

export const MainScreen: React.FC<MainScreenProps> = ({
  serverStatus,
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

  // Quick Search Dropdown & Modal states
  const [showQuickSearchModal, setShowQuickSearchModal] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showInlineSuggestions, setShowInlineSuggestions] = useState(false);

  // Student Attendance History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [lookupIndexNumber, setLookupIndexNumber] = useState('');
  const [studentHistoryData, setStudentHistoryData] = useState<StudentAttendanceHistory | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isStreamRevealed, setIsStreamRevealed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const quickSearchInputRef = useRef<HTMLInputElement>(null);
  const historyInputRef = useRef<HTMLInputElement>(null);
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

  // Map of currently inside students for 0ms lookup
  const insideSet = useMemo(() => {
    return new Set(occupancyList.map((s) => s.indexNumber.trim().toLowerCase()));
  }, [occupancyList]);

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
        currentStatus: insideSet.has(s.indexNumber.toLowerCase()) ? 'INSIDE' : 'OUTSIDE',
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
        currentStatus: insideSet.has(s.indexNumber.toLowerCase()) ? 'INSIDE' : 'OUTSIDE',
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

  // Auto-dismiss confirmation after ~2.2 seconds
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
    const duration = 2200;

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

  // Submit transaction for index (case-insensitive on backend)
  const processIndex = async (indexToProcess: string) => {
    const trimmed = indexToProcess.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a student index number.');
      focusInput();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setShowInlineSuggestions(false);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexNumber: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'Student not found. Please check the index number.';
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

  const handleLookupStudentAttendance = async (idxToQuery: string) => {
    const trimmed = idxToQuery.trim();
    if (!trimmed) {
      setHistoryError('Please enter a student index number.');
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);
    setStudentHistoryData(null);

    try {
      const res = await fetch(`/api/attendance/student/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Student not found or attendance access restricted.');
      }
      setStudentHistoryData(data.history);
    } catch (err: any) {
      setHistoryError(err.message || 'Unable to retrieve attendance history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // If an inline suggestion was highlighted with arrow keys, use that
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

  // Keyboard navigation for suggestions & dismiss confirmation
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
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
          <button
            type="button"
            onClick={() => {
              setLookupIndexNumber('');
              setHistoryError(null);
              setStudentHistoryData(null);
              setShowHistoryModal(true);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>3. Attendance History</span>
          </button>
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
            Student Entry & Exit System
          </p>
        </div>

        {/* Main Scanner Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-visible transition-all">
          {/* Confirmation Screen */}
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
              <div className="text-sm sm:text-base font-medium text-white/90 mb-5">
                {confirmation.message}
              </div>

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
                  <span>Next Student</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                    Enter ↵
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Main Input Form with Live Quick Suggestions */
            <div className="p-6 sm:p-10 space-y-5 relative">
              <form onSubmit={handleSubmit} className="space-y-4 relative">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="index-input"
                    className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wide"
                  >
                    Enter Student Index Number
                  </label>
                  <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Case-Insensitive Active (e.g. 22001, it22001)
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="index-input"
                    ref={inputRef}
                    type="text"
                    autoComplete="off"
                    disabled={isSubmitting}
                    value={indexNumber}
                    onChange={(e) => {
                      setIndexNumber(e.target.value);
                      setShowInlineSuggestions(true);
                      setActiveSuggestionIndex(-1);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => {
                      if (indexNumber.trim().length > 0) setShowInlineSuggestions(true);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="e.g. 22001 or type student name"
                    className="w-full text-center font-mono text-2xl sm:text-4xl font-extrabold tracking-wider py-4 sm:py-5 px-6 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 placeholder:text-slate-300 bg-slate-50/50 text-slate-900 transition-all shadow-inner"
                  />

                  {/* Inline Quick Search Autocomplete Suggestions */}
                  {showInlineSuggestions && inlineSuggestions.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in-50 duration-150"
                    >
                      <div className="bg-slate-50 px-4 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Search className="w-3 h-3 text-blue-600" />
                          Quick Match Suggestions
                        </span>
                        <span>Use ↑↓ arrows and Enter</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {inlineSuggestions.map((s, idx) => (
                          <div
                            key={s.indexNumber}
                            onClick={() => processIndex(s.indexNumber)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                              idx === activeSuggestionIndex
                                ? 'bg-blue-100 text-blue-950 font-semibold'
                                : 'hover:bg-blue-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-blue-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {s.indexNumber}
                              </span>
                              <span className="font-medium text-slate-900">
                                {s.studentName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {s.currentStatus === 'INSIDE' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-900">
                                  Currently Inside
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                                  Outside
                                </span>
                              )}
                              <span className="text-[11px] text-blue-700 font-bold underline">
                                {s.currentStatus === 'INSIDE' ? 'Scan Exit →' : 'Scan Entry →'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm font-semibold rounded-xl p-3.5 flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit & Quick Search Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting || !indexNumber.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-base sm:text-lg py-3.5 sm:py-4 px-8 rounded-xl shadow-md transition-all focus:outline-none focus:ring-4 focus:ring-blue-200 cursor-pointer"
                  >
                    <span>{isSubmitting ? 'PROCESSING...' : 'SUBMIT SCAN'}</span>
                    <CornerDownLeft className="w-5 h-5 text-blue-200" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickSearchQuery('');
                      setShowQuickSearchModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm px-5 py-3.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-blue-600" />
                    <span>Search by Name</span>
                  </button>
                </div>

                <div className="text-center text-xs text-slate-400">
                  Case-insensitive: Type in uppercase, lowercase, or scan barcode. Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] text-slate-600">Enter</kbd> to submit.
                </div>
              </form>

              {/* Quick Sample Demonstration Numbers */}
              {serverStatus?.isPreloadedSample && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-600">Quick Test (Sample Demonstration Index Numbers):</span>
                    <button
                      onClick={onSwitchToAdmin}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      Admin Mode to upload custom CSV
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['22001', '22002', '22003', '22004', '22005'].map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIndexNumber(idx);
                          inputRef.current?.focus();
                        }}
                        className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        {idx}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setIndexNumber('99999');
                        inputRef.current?.focus();
                      }}
                      className="px-2.5 py-1 text-xs font-mono font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 transition-colors cursor-pointer"
                      title="Test invalid index error response"
                    >
                      99999 (Test Invalid)
                    </button>
                  </div>
                </div>
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
                  For privacy protection, individual student scans are not broadcast publicly on the classroom screen. Students can check their own attendance history below.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLookupIndexNumber('');
                  setHistoryError(null);
                  setStudentHistoryData(null);
                  setShowHistoryModal(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>Check My Attendance History</span>
              </button>
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
                <button
                  type="button"
                  onClick={() => {
                    setLookupIndexNumber('');
                    setHistoryError(null);
                    setStudentHistoryData(null);
                    setShowHistoryModal(true);
                  }}
                  className="text-xs text-blue-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Student Attendance Lookup</span>
                </button>
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
                  No transactions recorded yet today. Scan an index number above to begin.
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
                        <div className="text-[11px] text-slate-500">
                          {tx.type === 'ENTRY' ? 'Entered Classroom 1' : 'Left Classroom 1'} · Status:{' '}
                          <span className="font-semibold text-slate-700">{tx.statusAfter}</span>
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
      {/* STUDENT ATTENDANCE HISTORY MODAL                     */}
      {/* ==================================================== */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Student Attendance History</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false);
                  setStudentHistoryData(null);
                  setHistoryError(null);
                  setLookupIndexNumber('');
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 space-y-5">
              {/* If administrator has disabled student attendance history lookup */}
              {systemSettings && systemSettings.allowUserAttendanceLookup === false ? (
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Attendance History Restricted</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Student attendance logs are currently restricted to authorized administrators. Regular users cannot view historical attendance sessions. Please contact your classroom administrator if you require an official attendance report.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowHistoryModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Search / Lookup Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleLookupStudentAttendance(lookupIndexNumber);
                    }}
                    className="space-y-3"
                  >
                    <label className="block text-xs font-semibold text-slate-700">
                      Enter Student Index Number to View Attendance Record
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          ref={historyInputRef}
                          type="text"
                          autoFocus
                          value={lookupIndexNumber}
                          onChange={(e) => setLookupIndexNumber(e.target.value)}
                          placeholder="e.g. 22001, 22002, 22003..."
                          className="w-full text-xs sm:text-sm pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoadingHistory || !lookupIndexNumber.trim()}
                        className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        {isLoadingHistory ? 'Searching...' : 'View History'}
                      </button>
                    </div>

                    {/* Quick index selector chips */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
                      <span className="text-[11px]">Quick Samples:</span>
                      {students.slice(0, 5).map((s) => (
                        <button
                          key={s.indexNumber}
                          type="button"
                          onClick={() => {
                            setLookupIndexNumber(s.indexNumber);
                            handleLookupStudentAttendance(s.indexNumber);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 font-mono text-[11px] cursor-pointer"
                        >
                          {s.indexNumber}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* Error Notification */}
                  {historyError && (
                    <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{historyError}</span>
                    </div>
                  )}

                  {/* Loaded History Details */}
                  {studentHistoryData && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      {/* Student Card */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-xs">
                              {studentHistoryData.student.indexNumber}
                            </span>
                            <h4 className="font-bold text-sm sm:text-base text-slate-900">
                              {studentHistoryData.student.studentName}
                            </h4>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span>Status:</span>
                            <span className={`font-bold uppercase text-[11px] px-2 py-0.5 rounded font-mono ${
                              studentHistoryData.currentStatus === 'INSIDE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {studentHistoryData.currentStatus === 'INSIDE' ? 'Currently Inside Classroom 1' : 'Outside'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-center">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Sessions</div>
                            <div className="font-mono font-bold text-slate-900 text-sm">
                              {studentHistoryData.totalSessions}
                            </div>
                          </div>
                          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-center">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Time Inside</div>
                            <div className="font-mono font-bold text-slate-900 text-sm">
                              {Math.floor(studentHistoryData.totalMinutesInClass / 60)}h {studentHistoryData.totalMinutesInClass % 60}m
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sessions List */}
                      <div>
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center justify-between">
                          <span>Recorded Attendance Sessions</span>
                          <span className="text-slate-400 font-normal font-mono text-[11px]">
                            Showing {studentHistoryData.sessions.length} sessions
                          </span>
                        </div>

                        {studentHistoryData.sessions.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                            No attendance entry/exit swipes recorded yet for this student.
                          </div>
                        ) : (
                          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {studentHistoryData.sessions.map((ses, idx) => (
                              <div
                                key={ses.id || idx}
                                className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-slate-400 text-[11px] w-6">
                                    #{studentHistoryData.sessions.length - idx}
                                  </span>
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {ses.date}
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                                      <span className="text-emerald-700 font-medium">In: {ses.entryTime}</span>
                                      <span>·</span>
                                      <span className="text-blue-700 font-medium">Out: {ses.exitTime}</span>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                                    ses.status === 'INSIDE'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {ses.status === 'INSIDE' ? 'Active Inside' : 'Completed'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span className="font-mono text-[11px]">Classroom 1 University Access Control</span>
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false);
                  setStudentHistoryData(null);
                  setHistoryError(null);
                  setLookupIndexNumber('');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
