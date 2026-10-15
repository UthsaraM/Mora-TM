import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Calendar,
  Users,
  LogIn,
  LogOut,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { DailyReportData } from '../types';
import { getColomboDateString } from '../utils/time';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ isOpen, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getColomboDateString());
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (dateStr: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/daily?date=${encodeURIComponent(dateStr)}`);
      if (!res.ok) {
        throw new Error('Failed to load daily report.');
      }
      const data: DailyReportData = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const today = getColomboDateString();
      setSelectedDate(today);
      fetchReport(today);
    }
  }, [isOpen]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchReport(newDate);
  };

  const handleDownloadCsv = () => {
    window.location.href = `/api/reports/daily/download?date=${encodeURIComponent(selectedDate)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-900 text-white text-[11px] font-bold rounded uppercase tracking-wider">
                Official Report
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 font-mono">
                CLASSROOM 1 — DAILY ATTENDANCE REPORT
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance sessions and transactions recorded in Asia/Colombo timezone.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD DAILY REPORT</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date Selector & Controls */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Reporting Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <button
              type="button"
              onClick={() => handleDateChange(getColomboDateString())}
              className="text-xs text-blue-700 hover:text-blue-900 underline font-medium cursor-pointer"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchReport(selectedDate)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Unique Students</span>
                <Users className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1">
                {report ? report.totalUniqueStudents : '--'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Entered on {selectedDate}</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Entries</span>
                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 mt-1">
                {report ? report.totalEntries : '--'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Entry scans</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Exits</span>
                <LogOut className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-blue-700 mt-1">
                {report ? report.totalExits : '--'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Exit scans</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Currently Inside</span>
                <Clock className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-purple-700 mt-1">
                {report ? report.currentlyInside : '--'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">In Classroom 1 now</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Entered, Not Exited</span>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700 mt-1">
                {report ? report.enteredNotExited : '--'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Unclosed sessions</div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Attendance Sessions for {selectedDate}
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {report ? `${report.sessions.length} session record(s)` : ''}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">No.</th>
                    <th className="py-2.5 px-4">Index Number</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Entry Time</th>
                    <th className="py-2.5 px-4">Exit Time</th>
                    <th className="py-2.5 px-4 text-center">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {!report || report.sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No student entry or exit sessions recorded for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    report.sessions.map((session, index) => (
                      <tr
                        key={session.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          session.status === 'INSIDE' ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400 font-medium">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                          {session.indexNumber}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {session.studentName}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-emerald-800 font-medium">
                          {session.entryTime}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium">
                          {session.exitTime === 'Not recorded' ? (
                            <span className="text-amber-700 italic">Not recorded</span>
                          ) : (
                            <span className="text-blue-800">{session.exitTime}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {session.status === 'INSIDE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                              INSIDE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              OUTSIDE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Generated from permanent database transaction logs.</span>
            <span>·</span>
            <span>Venue: Classroom 1</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadCsv}
              className="text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
            >
              Export CSV for Excel
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
