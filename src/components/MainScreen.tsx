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
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import {
  Student,
  TransactionRecord,
  TransactionResponse,
  ServerStatus,
  OccupancyStudent,
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8 space-y-8">
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
      {/* MOBILE FIXED BOTTOM NAVIGATION BAR                   */}
      {/* ==================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-3 py-1.5 flex items-center justify-around md:hidden safe-area-pb"
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

        {/* 4. Admin Portal */}
        <button
          type="button"
          onClick={onSwitchToAdmin}
          className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-700 active:scale-95 transition-all p-1 cursor-pointer"
        >
          <div className="p-1.5 rounded-full bg-slate-100 text-slate-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Admin</span>
        </button>
      </nav>
    </div>
  );
};
