import React, { useState, useRef, useEffect } from 'react';
import {
  LogIn,
  LogOut,
  CornerDownLeft,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
  Users,
  BarChart3,
  ScanLine,
} from 'lucide-react';
import {
  TransactionRecord,
  TransactionResponse,
  ServerStatus,
  OccupancyStudent,
  TodayAttendanceSummary,
} from '../types';
import { OccupancySection } from './OccupancySection';
import { TodaySummarySection } from './TodaySummarySection';

interface MainScreenProps {
  serverStatus: ServerStatus | null;
  onTransactionSuccess: (tx: TransactionRecord) => void;
  recentTransactions: TransactionRecord[];
  occupancyList: OccupancyStudent[];
  todaySummary: TodayAttendanceSummary | null;
  onOpenReport: () => void;
  onRefreshOccupancy: () => void;
  onSwitchToAdmin: () => void;
}

export const MainScreen: React.FC<MainScreenProps> = ({
  serverStatus,
  onTransactionSuccess,
  recentTransactions,
  occupancyList,
  todaySummary,
  onOpenReport,
  onRefreshOccupancy,
  onSwitchToAdmin,
}) => {
  const [indexNumber, setIndexNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<TransactionResponse | null>(null);
  const [countdownPercent, setCountdownPercent] = useState(100);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input automatically on mount and whenever confirmation closes
  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    focusInput();
  }, []);

  // Handle auto-dismissal of confirmation after ~2.2 seconds
  const closeConfirmation = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setConfirmation(null);
    setIndexNumber('');
    focusInput();
  };

  const startConfirmationTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setCountdownPercent(100);
    const startTime = Date.now();
    const duration = 2200; // ~2.2 seconds

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmed = indexNumber.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a student index number.');
      focusInput();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

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

      // Successful transaction
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

  // Keyboard shortcut to dismiss confirmation immediately if Enter or Space is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmation && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        e.preventDefault();
        closeConfirmation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmation]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
      {/* Quick Jump Navigation Bar between Sections */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1">
          <a
            href="#scanner-section"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 flex items-center gap-1.5"
          >
            <ScanLine className="w-3.5 h-3.5 text-blue-700" />
            <span>1. Entry & Exit</span>
          </a>
          <a
            href="#occupancy-section"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>2. Current Occupancy ({occupancyList.length})</span>
          </a>
          <a
            href="#summary-section"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>3. Today's Summary</span>
          </a>
        </div>

        <button
          type="button"
          onClick={onOpenReport}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 flex items-center gap-1.5 cursor-pointer ml-auto"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>4. View Daily Report</span>
        </button>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden transition-all">
          {/* Confirmation Screen */}
          {confirmation ? (
            <div
              className={`p-6 sm:p-10 text-center relative transition-all ${
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
            /* Main Input Form */
            <div className="p-6 sm:p-10 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label
                  htmlFor="index-input"
                  className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wide text-center"
                >
                  Enter Student Index Number
                </label>

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
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. 22001"
                    className="w-full text-center font-mono text-2xl sm:text-4xl font-extrabold tracking-wider py-4 sm:py-5 px-6 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 placeholder:text-slate-300 bg-slate-50/50 text-slate-900 transition-all shadow-inner"
                  />
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm font-semibold rounded-xl p-3.5 flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting || !indexNumber.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-base sm:text-lg py-3.5 sm:py-4 px-8 rounded-xl shadow-md transition-all focus:outline-none focus:ring-4 focus:ring-blue-200 cursor-pointer"
                  >
                    <span>{isSubmitting ? 'PROCESSING...' : 'SUBMIT'}</span>
                    <CornerDownLeft className="w-5 h-5 text-blue-200" />
                  </button>
                </div>

                <div className="text-center text-xs text-slate-400">
                  Type index number and press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] text-slate-600">Enter</kbd> or click Submit. Barcode scanners are supported.
                </div>
              </form>

              {/* Quick Sample Numbers */}
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
      {/* SECTION 3: TODAY'S ATTENDANCE SUMMARY                */}
      {/* ==================================================== */}
      <section id="summary-section">
        <TodaySummarySection summary={todaySummary} />
      </section>

      {/* ==================================================== */}
      {/* SECTION 4: RECENT ACTIVITY & DAILY REPORT ACCESS     */}
      {/* ==================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
              Live Activity Stream (Classroom 1)
            </h3>
          </div>
          <button
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Open Full Daily Report & Export CSV →</span>
          </button>
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
      </section>
    </div>
  );
};
