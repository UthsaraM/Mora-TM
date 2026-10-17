import React, { useState } from 'react';
import { Users, Search, Clock, Calendar, RefreshCw } from 'lucide-react';
import { OccupancyStudent } from '../types';

interface OccupancySectionProps {
  occupancyList: OccupancyStudent[];
  occupancyCount: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const OccupancySection: React.FC<OccupancySectionProps> = ({
  occupancyList,
  occupancyCount,
  isLoading,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = occupancyList.filter(
    (s) =>
      s.indexNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header with Prominent Count */}
      <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-xs font-bold tracking-wider uppercase text-blue-200 font-mono">
              Live Venue Status
            </h2>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight font-mono text-white mt-1">
            CURRENT OCCUPANCY
          </div>
          <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
            {occupancyCount} {occupancyCount === 1 ? 'STUDENT' : 'STUDENTS'} INSIDE CLASSROOM 1
          </div>
        </div>

        {/* Search input + refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search inside students..."
              className="w-full bg-white/10 text-white placeholder:text-slate-400 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh Occupancy"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Compact Cards (sm:hidden) */}
      <div className="sm:hidden p-3 space-y-2 bg-slate-50/50">
        {occupancyList.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No students currently inside</p>
            <p className="text-[11px] text-slate-400">Swiped students appear here in real-time</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No inside students match "{searchTerm}".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {filteredStudents.map((student, idx) => (
              <div
                key={student.indexNumber}
                className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                      {student.indexNumber}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 truncate mt-1">
                    {student.studentName}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>In: {student.entryTime}</span>
                    <span>·</span>
                    <span>{student.entryDate}</span>
                  </div>
                </div>

                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  INSIDE
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table Area (hidden sm:block) */}
      <div className="hidden sm:block p-0 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 sm:px-6 w-12 text-center">#</th>
              <th className="py-3 px-4 sm:px-6">Student Index Number</th>
              <th className="py-3 px-4 sm:px-6">Student Name</th>
              <th className="py-3 px-4 sm:px-6">Entry Time</th>
              <th className="py-3 px-4 sm:px-6">Entry Date</th>
              <th className="py-3 px-4 sm:px-6 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {occupancyList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-slate-300" />
                    <span className="text-sm font-medium text-slate-600">
                      No students are currently inside Classroom 1.
                    </span>
                    <span className="text-xs text-slate-400">
                      When a student scans their index number, they will appear here automatically.
                    </span>
                  </div>
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No currently inside student matches "{searchTerm}".
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => (
                <tr
                  key={student.indexNumber}
                  className="hover:bg-blue-50/40 transition-colors"
                >
                  <td className="py-2.5 px-4 sm:px-6 text-center font-mono text-slate-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-4 sm:px-6 font-mono font-bold text-blue-900">
                    {student.indexNumber}
                  </td>
                  <td className="py-2.5 px-4 sm:px-6 font-semibold text-slate-900">
                    {student.studentName}
                  </td>
                  <td className="py-2.5 px-4 sm:px-6 font-mono text-emerald-700 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{student.entryTime}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-4 sm:px-6 font-mono text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{student.entryDate}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-4 sm:px-6 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-900 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      INSIDE
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
        <span>
          Showing {filteredStudents.length} of {occupancyCount} student(s) currently inside Classroom 1.
        </span>
        <span className="text-[11px] text-slate-400">Calculated from actual database statuses</span>
      </div>
    </div>
  );
};
