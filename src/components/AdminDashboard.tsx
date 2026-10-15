import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  Calendar,
  Search,
  Upload,
  Download,
  Plus,
  Edit2,
  UserX,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  LogOut,
  RefreshCw,
  ExternalLink,
  Edit3,
  History,
  KeyRound,
  Filter,
} from 'lucide-react';
import {
  Student,
  OccupancyStudent,
  TodayAttendanceSummary,
  DailyReportData,
  TransactionRecord,
  TransactionCorrection,
} from '../types';
import { getColomboDateString, getColomboFullDateTimeString } from '../utils/time';

interface AdminDashboardProps {
  adminToken: string;
  adminName: string;
  onLogout: () => void;
  onSwitchToUserMode: () => void;
  onRefreshAllData: () => Promise<void>;
  occupancyList: OccupancyStudent[];
  todaySummary: TodayAttendanceSummary | null;
  students: Student[];
  recentTransactions: TransactionRecord[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  adminName,
  onLogout,
  onSwitchToUserMode,
  onRefreshAllData,
  occupancyList,
  todaySummary,
  students,
  recentTransactions,
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'occupancy' | 'attendance' | 'reports' | 'corrections' | 'settings'>('students');

  // Time state
  const [timeState, setTimeState] = useState(getColomboFullDateTimeString());
  useEffect(() => {
    const timer = setInterval(() => setTimeState(getColomboFullDateTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Student management states
  const [studentSearch, setStudentSearch] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newIndexNumber, setNewIndexNumber] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [studentModalError, setStudentModalError] = useState<string | null>(null);

  // Edit student modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');

  // CSV upload state
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ indexNumber: string; studentName: string }[]>([]);
  const [rawCsvText, setRawCsvText] = useState('');
  const [csvUploadStatus, setCsvUploadStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attendance filter states
  const [attendanceDate, setAttendanceDate] = useState(getColomboDateString());
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [allTransactions, setAllTransactions] = useState<TransactionRecord[]>(recentTransactions);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);

  // Report state
  const [reportDate, setReportDate] = useState(getColomboDateString());
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Corrections state
  const [correctionsList, setCorrectionsList] = useState<TransactionCorrection[]>([]);
  const [selectedTxToCorrect, setSelectedTxToCorrect] = useState<TransactionRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionTargetType, setCorrectionTargetType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [correctionStatus, setCorrectionStatus] = useState<string | null>(null);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Load report data
  const fetchReport = async (dateStr: string) => {
    setIsLoadingReport(true);
    try {
      const res = await fetch(`/api/reports/daily?date=${encodeURIComponent(dateStr)}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Load corrections list
  const fetchCorrections = async () => {
    try {
      const res = await fetch('/api/admin/corrections', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCorrectionsList(data.corrections || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReport(reportDate);
    } else if (activeTab === 'corrections') {
      fetchCorrections();
    }
  }, [activeTab, reportDate]);

  // Handle Add Single Student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndexNumber.trim() || !newStudentName.trim()) {
      setStudentModalError('Both index number and student name are required.');
      return;
    }

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          indexNumber: newIndexNumber.trim(),
          studentName: newStudentName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student.');

      await onRefreshAllData();
      setShowAddStudentModal(false);
      setNewIndexNumber('');
      setNewStudentName('');
      setStudentModalError(null);
    } catch (err: any) {
      setStudentModalError(err.message);
    }
  };

  // Handle Edit/Deactivate Student
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(editingStudent.indexNumber)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentName: editName.trim(),
          isActive: editingStudent.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update student.');
      }

      await onRefreshAllData();
      setEditingStudent(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle student active/inactive
  const handleToggleStudentStatus = async (student: Student) => {
    const newActiveState = student.isActive === false ? true : false;
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(student.indexNumber)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          isActive: newActiveState,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status.');
      }

      await onRefreshAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Parse CSV for Preview
  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setRawCsvText(text);
        parsePreview(text);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const parsePreview = (text: string) => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let start = 0;
    if (lines.length > 0 && (lines[0].toLowerCase().includes('index') || lines[0].toLowerCase().includes('student'))) {
      start = 1;
    }

    const previewList: { indexNumber: string; studentName: string }[] = [];
    for (let i = start; i < Math.min(lines.length, start + 8); i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        previewList.push({ indexNumber: parts[0], studentName: parts.slice(1).join(',') });
      }
    }
    setCsvPreview(previewList);
  };

  // Submit CSV Upload
  const handleUploadCsv = async () => {
    if (!rawCsvText.trim()) return;
    setIsUploading(true);
    setCsvUploadStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/students/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ csvText: rawCsvText, replaceExisting: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setCsvUploadStatus({ type: 'success', message: data.message });
      await onRefreshAllData();
      setTimeout(() => {
        setShowCsvUploadModal(false);
        setRawCsvText('');
        setCsvPreview([]);
        setCsvUploadStatus({ type: null, message: '' });
      }, 1500);
    } catch (err: any) {
      setCsvUploadStatus({ type: 'error', message: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Transaction Correction
  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxToCorrect || !correctionReason.trim()) return;

    try {
      const res = await fetch('/api/admin/transactions/correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          transactionId: selectedTxToCorrect.id,
          correctedType: correctionTargetType,
          reason: correctionReason.trim(),
          adminIdentity: adminName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Correction failed.');

      setCorrectionStatus(`Success: ${data.message}`);
      await onRefreshAllData();
      await fetchCorrections();
      setTimeout(() => {
        setSelectedTxToCorrect(null);
        setCorrectionReason('');
        setCorrectionStatus(null);
      }, 1500);
    } catch (err: any) {
      setCorrectionStatus(`Error: ${err.message}`);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');

      setPwStatus({ type: 'success', message: 'Password changed successfully.' });
      setCurrentPw('');
      setNewPw('');
    } catch (err: any) {
      setPwStatus({ type: 'error', message: err.message });
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.indexNumber.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentName.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Admin Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider uppercase bg-blue-600 text-white">
              ADMIN MODE
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight font-mono">
                CLASSROOM 1 — ADMIN CONTROL PANEL
              </h1>
              <div className="text-xs text-slate-400">
                Logged in as <span className="text-blue-300 font-semibold">{adminName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{timeState.timeStr}</span>
              <span className="text-[10px] text-slate-400 uppercase">Asia/Colombo</span>
            </div>

            <button
              onClick={onSwitchToUserMode}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>User Screen</span>
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-2 border-t border-slate-800/80 pt-2 text-xs font-semibold">
          {[
            { id: 'students', label: 'Student Management', icon: Users, count: students.length },
            { id: 'occupancy', label: 'Current Occupancy', icon: Clock, count: occupancyList.length },
            { id: 'attendance', label: 'Attendance & Logs', icon: History, count: recentTransactions.length },
            { id: 'reports', label: 'Daily Reports', icon: FileSpreadsheet },
            { id: 'corrections', label: 'Transaction Corrections', icon: Edit3, count: correctionsList.length },
            { id: 'settings', label: 'Admin Settings', icon: KeyRound },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* ==================================================== */}
        {/* TAB A: STUDENT MANAGEMENT                            */}
        {/* ==================================================== */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black font-mono text-slate-900">STUDENT ROSTER MANAGEMENT</h2>
                  <p className="text-xs text-slate-500">
                    Upload CSV lists, add individual students, search, edit names, or deactivate student accounts.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setRawCsvText('');
                      setCsvPreview([]);
                      setCsvUploadStatus({ type: null, message: '' });
                      setShowCsvUploadModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload CSV Roster</span>
                  </button>

                  <button
                    onClick={() => window.location.href = '/api/students/template'}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Template</span>
                  </button>

                  <button
                    onClick={() => {
                      setNewIndexNumber('');
                      setNewStudentName('');
                      setStudentModalError(null);
                      setShowAddStudentModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Student</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search registered students by index number or student name..."
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Students Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Index Number</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 text-center">Account Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No students matched your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st, idx) => {
                        const isActive = st.isActive !== false;
                        return (
                          <tr key={st.indexNumber} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                              {st.indexNumber}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">
                              {st.studentName}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-900">
                                  <UserCheck className="w-3 h-3 text-emerald-700" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red-100 text-red-900">
                                  <UserX className="w-3 h-3 text-red-700" />
                                  Deactivated
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingStudent(st);
                                  setEditName(st.studentName);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-700 rounded hover:bg-slate-100 cursor-pointer"
                                title="Edit Student Name"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStudentStatus(st)}
                                className={`p-1 rounded cursor-pointer ${
                                  isActive
                                    ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                }`}
                                title={isActive ? 'Deactivate student (without deleting attendance)' : 'Reactivate student'}
                              >
                                {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-slate-500 flex justify-between items-center">
                <span>Total Registered Students: {students.length}</span>
                <span className="text-[11px] text-slate-400">
                  Deactivated students cannot scan in or out, but all historical records are preserved.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB B: CURRENT OCCUPANCY                            */}
        {/* ==================================================== */}
        {activeTab === 'occupancy' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h2 className="text-lg font-black font-mono text-slate-900">
                      CURRENT OCCUPANCY — {occupancyList.length} STUDENTS INSIDE
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Live list of students currently verified inside Classroom 1.
                  </p>
                </div>
                <button
                  onClick={onRefreshAllData}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Index Number</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Entry Time</th>
                      <th className="py-2.5 px-4">Entry Date</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {occupancyList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No students are currently inside Classroom 1.
                        </td>
                      </tr>
                    ) : (
                      occupancyList.map((st, idx) => (
                        <tr key={st.indexNumber} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                            {st.indexNumber}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {st.studentName}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-800 font-semibold">
                            {st.entryTime}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">
                            {st.entryDate}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-900">
                              INSIDE
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB C: ATTENDANCE MANAGEMENT & LOGS                 */}
        {/* ==================================================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Today's Summary Header Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Unique Students Today</div>
                <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                  {todaySummary?.uniqueStudentsEntered ?? '--'}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="text-xs text-emerald-800 font-medium">Total Entries Today</div>
                <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
                  {todaySummary?.totalEntries ?? '--'}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="text-xs text-blue-800 font-medium">Total Exits Today</div>
                <div className="text-2xl font-black font-mono text-blue-700 mt-1">
                  {todaySummary?.totalExits ?? '--'}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="text-xs text-purple-800 font-medium">Currently Inside</div>
                <div className="text-2xl font-black font-mono text-purple-700 mt-1">
                  {todaySummary?.currentOccupancy ?? '--'}
                </div>
              </div>
            </div>

            {/* Complete Transaction Logs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold font-mono text-slate-900">
                    COMPLETE TRANSACTION AUDIT LOGS
                  </h3>
                  <p className="text-xs text-slate-500">
                    Immutable records of all student scan events in Classroom 1.
                  </p>
                </div>
                <button
                  onClick={onRefreshAllData}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Transaction ID</th>
                      <th className="py-2.5 px-4">Index</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 text-center">Type</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Time (Asia/Colombo)</th>
                      <th className="py-2.5 px-4 text-center">Status After</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                            {tx.id}
                            {tx.isCorrected && (
                              <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded font-sans">
                                Corrected
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                            {tx.studentIndexNumber}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {tx.studentName}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                tx.type === 'ENTRY'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-blue-100 text-blue-900'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{tx.date}</td>
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                            {tx.formattedTime}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                            {tx.statusAfter}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedTxToCorrect(tx);
                                setCorrectionTargetType(tx.type === 'ENTRY' ? 'EXIT' : 'ENTRY');
                                setCorrectionReason('');
                                setCorrectionStatus(null);
                              }}
                              className="text-blue-700 hover:text-blue-900 underline text-xs font-medium cursor-pointer"
                            >
                              Correct
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB D: REPORTS                                       */}
        {/* ==================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold font-mono text-slate-900">
                    DAILY ATTENDANCE REPORT GENERATION
                  </h3>
                  <p className="text-xs text-slate-500">
                    Generate official session attendance reports and export Microsoft Excel CSV files.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="text-xs font-mono p-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                  <button
                    onClick={() => {
                      window.location.href = `/api/reports/daily/download?date=${encodeURIComponent(reportDate)}`;
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel CSV</span>
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Unique Students</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {reportData ? reportData.totalUniqueStudents : '--'}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Entries</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                    {reportData ? reportData.totalEntries : '--'}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Exits</div>
                  <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                    {reportData ? reportData.totalExits : '--'}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Currently Inside</div>
                  <div className="text-xl font-bold font-mono text-purple-700 mt-1">
                    {reportData ? reportData.currentlyInside : '--'}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Entered Not Exited</div>
                  <div className="text-xl font-bold font-mono text-amber-700 mt-1">
                    {reportData ? reportData.enteredNotExited : '--'}
                  </div>
                </div>
              </div>

              {/* Sessions Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Index Number</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Entry Time</th>
                      <th className="py-2.5 px-4">Exit Time</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {!reportData || reportData.sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No student sessions recorded for {reportDate}.
                        </td>
                      </tr>
                    ) : (
                      reportData.sessions.map((ses, idx) => (
                        <tr key={ses.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                            {ses.indexNumber}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {ses.studentName}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-800">{ses.entryTime}</td>
                          <td className="py-2.5 px-4 font-mono text-blue-800">{ses.exitTime}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                ses.status === 'INSIDE'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ses.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB E: TRANSACTION CORRECTIONS                      */}
        {/* ==================================================== */}
        {activeTab === 'corrections' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold font-mono text-slate-900">
                    TRANSACTION CORRECTIONS AUDIT LOG
                  </h3>
                  <p className="text-xs text-slate-500">
                    Administrative corrections preserve the original transaction while recording the correction reason, timestamp, and administrator identity.
                  </p>
                </div>
                <button
                  onClick={fetchCorrections}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Corrections</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Correction ID</th>
                      <th className="py-2.5 px-4">Transaction Ref</th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4 text-center">Change</th>
                      <th className="py-2.5 px-4">Reason</th>
                      <th className="py-2.5 px-4">Administrator</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {correctionsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No transaction corrections have been recorded. To correct a transaction, go to the "Attendance & Logs" tab and click "Correct".
                        </td>
                      </tr>
                    ) : (
                      correctionsList.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-mono text-blue-900 font-semibold">{c.id}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{c.transactionId}</td>
                          <td className="py-2.5 px-4 font-medium">
                            {c.studentName} ({c.studentIndexNumber})
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="font-mono text-slate-500 line-through mr-1">{c.originalType}</span>
                            →
                            <span className="font-mono font-bold text-emerald-800 ml-1">{c.correctedType}</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 italic">{c.reason}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-900">{c.adminIdentity}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{c.formattedTime}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB F: ADMIN SETTINGS                                */}
        {/* ==================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            {/* Change Password Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold font-mono text-slate-900">
                  CHANGE ADMINISTRATOR PASSWORD
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Update the password required to access administrative controls and student roster management.
              </p>

              {pwStatus.type === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pwStatus.message}</span>
                </div>
              )}
              {pwStatus.type === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{pwStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password (min 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>

            {/* Clear Transactions Reset Tool */}
            <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold font-mono">
                  RESET ATTENDANCE TRANSACTIONS
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                Clears all entry/exit records and resets occupancy to zero while preserving the student roster. Use with caution before starting a new term.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Are you sure you want to reset all attendance transactions? This action cannot be undone.')) {
                    try {
                      const res = await fetch('/api/database/reset-transactions', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${adminToken}` },
                      });
                      if (res.ok) {
                        alert('All transactions have been reset.');
                        await onRefreshAllData();
                      }
                    } catch (err) {
                      alert('Failed to reset.');
                    }
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Clear All Transaction Logs
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* MODALS: CSV UPLOAD, ADD STUDENT, EDIT STUDENT, CORRECTION */}
      {/* ==================================================== */}

      {/* CSV Upload Modal with Preview */}
      {showCsvUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Upload Student CSV with Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvUploadModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 text-xs">
                Format: <span className="font-mono font-bold">index_number,student_name</span>. Leading zeros are preserved as strings.
              </div>

              {csvUploadStatus.type === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{csvUploadStatus.message}</span>
                </div>
              )}
              {csvUploadStatus.type === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{csvUploadStatus.message}</span>
                </div>
              )}

              {/* Upload Drop Zone */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv,text/plain"
                onChange={handleCsvFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="w-6 h-6 text-slate-500" />
                <div className="text-xs font-semibold text-slate-800">
                  Click to select CSV file from your computer
                </div>
              </div>

              {/* Or paste CSV text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or paste CSV rows:
                </label>
                <textarea
                  rows={3}
                  value={rawCsvText}
                  onChange={(e) => {
                    setRawCsvText(e.target.value);
                    parsePreview(e.target.value);
                  }}
                  placeholder="index_number,student_name&#10;22001,Uthsara Manul&#10;22002,Kasun Perera"
                  className="w-full font-mono text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Preview Table */}
              {csvPreview.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Parsed Preview (First {csvPreview.length} records):</span>
                    <span className="text-emerald-700">Validated</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold">
                        <tr>
                          <th className="py-1.5 px-3">Index Number</th>
                          <th className="py-1.5 px-3">Student Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvPreview.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1 px-3 font-mono text-blue-900 font-bold">{p.indexNumber}</td>
                            <td className="py-1 px-3">{p.studentName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvUploadModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUploading || !rawCsvText.trim()}
                  onClick={handleUploadCsv}
                  className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {isUploading ? 'Importing...' : 'Confirm & Import Roster'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Add New Student</h3>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              {studentModalError && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{studentModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Index Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newIndexNumber}
                  onChange={(e) => setNewIndexNumber(e.target.value)}
                  placeholder="e.g. 22006 (leading zeros preserved)"
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Ruwanthi Jayawardena"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Student Details</h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Index Number (Permanent)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingStudent.indexNumber}
                  className="w-full text-xs font-mono p-2.5 border border-slate-200 bg-slate-100 rounded-lg text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Correction Modal */}
      {selectedTxToCorrect && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Transaction Correction</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxToCorrect(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyCorrection} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5 font-mono">
                <div>Transaction ID: <span className="font-bold text-slate-900">{selectedTxToCorrect.id}</span></div>
                <div>Student: <span className="font-bold text-blue-900">{selectedTxToCorrect.studentName} ({selectedTxToCorrect.studentIndexNumber})</span></div>
                <div>Recorded Time: <span className="text-slate-700">{selectedTxToCorrect.date} {selectedTxToCorrect.formattedTime}</span></div>
                <div>Original Type: <span className="font-bold text-slate-900">{selectedTxToCorrect.type}</span></div>
              </div>

              {correctionStatus && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  correctionStatus.startsWith('Success')
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border border-red-200 text-red-900'
                }`}>
                  {correctionStatus}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corrected Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCorrectionTargetType('ENTRY')}
                    className={`py-2 px-4 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                      correctionTargetType === 'ENTRY'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    ENTRY (Student entered)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrectionTargetType('EXIT')}
                    className={`py-2 px-4 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                      correctionTargetType === 'EXIT'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    EXIT (Student exited)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Correction <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Operator accidentally double scanned entry, or student forgot to scan exit..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-[11px] text-slate-500">
                Correction will be logged with administrator signature ({adminName}), and Classroom 1 occupancy and reports will be recalculated automatically.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTxToCorrect(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!correctionReason.trim()}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Apply Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
