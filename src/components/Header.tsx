import React, { useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { getColomboFullDateTimeString } from '../utils/time';
import { Calendar, Clock, LogOut, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ServerStatus, Student } from '../types';

interface HeaderProps {
  serverStatus: ServerStatus | null;
  googleUser?: FirebaseUser | null;
  currentStudent?: Student | null;
  onExitToLanding: () => void;
  onSwitchToAdmin: () => void;
  isAdminAuthenticated: boolean;
  onSignOutGoogle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serverStatus,
  googleUser,
  currentStudent,
  onExitToLanding,
  onSwitchToAdmin,
  isAdminAuthenticated,
  onSignOutGoogle,
}) => {
  const [timeState, setTimeState] = useState<{ dateStr: string; timeStr: string }>({
    dateStr: '',
    timeStr: '',
  });

  useEffect(() => {
    setTimeState(getColomboFullDateTimeString());
    const timer = setInterval(() => {
      setTimeState(getColomboFullDateTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white shadow-2xs sticky top-0 z-30">
      {/* Sample Data Alert if active */}
      {serverStatus?.isPreloadedSample && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold px-1.5 py-0.5 bg-amber-200 text-amber-950 rounded text-[11px] uppercase tracking-wide">
              Sample Data Active
            </span>
            <span>
              Preloaded with demonstration students (22001 - 22005). Real rosters can be uploaded in Admin Mode.
            </span>
          </div>
          {isAdminAuthenticated && !currentStudent && onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className="font-medium underline hover:text-amber-950 text-xs cursor-pointer ml-3 shrink-0"
            >
              Admin Roster Upload →
            </button>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Title Area */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase bg-blue-900 text-white font-mono">
                Classroom 1
              </span>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 font-mono">
                STUDENT ENTRY & EXIT SYSTEM
              </h1>

              {/* Connected Google / Student Identity Pill */}
              {googleUser && (
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-mono text-[11px]">{googleUser.email}</span>
                  {currentStudent && (
                    <span className="bg-emerald-200 text-emerald-950 px-1.5 rounded font-mono text-[10px]">
                      Index: {currentStudent.indexNumber}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-medium tracking-wide text-slate-500 uppercase mt-0.5">
              Live University Attendance Access Point · Mandatory Google Verified Swipes
            </p>
          </div>

          {/* Time & Live Timezone Area (Asia/Colombo) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-left hidden sm:block">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{timeState.dateStr || 'Loading...'}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                <span className="text-sm sm:text-base font-bold font-mono text-slate-900 tracking-tight">
                  {timeState.timeStr || '--:--:--'}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-200/70 px-1 py-0.2 rounded">
                  Asia/Colombo
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              {googleUser && onSignOutGoogle && (
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 font-semibold text-xs px-2.5 py-2 rounded-lg transition-all cursor-pointer"
                  title="Sign out of Google Account"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}

              {/* Only show Admin Mode button if administrator is authenticated AND NOT a student */}
              {isAdminAuthenticated && !currentStudent && (
                <button
                  type="button"
                  onClick={onSwitchToAdmin}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs px-3 py-2 rounded-lg transition-all cursor-pointer"
                  title="Switch to Administrator Mode"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline">Admin Mode</span>
                </button>
              )}

              <button
                type="button"
                onClick={onExitToLanding}
                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-2.5 py-2 rounded-lg transition-all cursor-pointer"
                title="Return to Welcome Landing Page"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
