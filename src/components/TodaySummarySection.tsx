import React from 'react';
import { Users, LogIn, LogOut, Clock, Calendar } from 'lucide-react';
import { TodayAttendanceSummary } from '../types';

interface TodaySummarySectionProps {
  summary: TodayAttendanceSummary | null;
  isLoading?: boolean;
}

export const TodaySummarySection: React.FC<TodaySummarySectionProps> = ({
  summary,
  isLoading,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight font-mono uppercase">
            TODAY'S ATTENDANCE SUMMARY
          </h2>
          <p className="text-xs text-slate-500">
            Real-time session metrics for Classroom 1 · Asia/Colombo Date: {summary?.date || 'Today'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>{summary?.date || '--'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: UNIQUE STUDENTS ENTERED TODAY */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Unique Students Entered</span>
            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
              {summary ? summary.uniqueStudentsEntered : '--'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Distinct students with &ge;1 entry today
            </div>
          </div>
        </div>

        {/* CARD 2: TOTAL ENTRIES TODAY */}
        <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
            <span>Total Entries</span>
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">
              {summary ? summary.totalEntries : '--'}
            </div>
            <div className="text-[11px] text-emerald-800/80 mt-1">
              Total entry transactions recorded
            </div>
          </div>
        </div>

        {/* CARD 3: TOTAL EXITS TODAY */}
        <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
            <span>Total Exits</span>
            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-blue-700">
              {summary ? summary.totalExits : '--'}
            </div>
            <div className="text-[11px] text-blue-800/80 mt-1">
              Total exit transactions recorded
            </div>
          </div>
        </div>

        {/* CARD 4: CURRENT OCCUPANCY */}
        <div className="bg-purple-50/40 border border-purple-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
            <span>Current Occupancy</span>
            <div className="p-1.5 bg-purple-100 rounded-lg text-purple-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-purple-700">
              {summary ? summary.currentOccupancy : '--'}
            </div>
            <div className="text-[11px] text-purple-800/80 mt-1">
              Students currently inside Classroom 1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
