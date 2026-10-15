import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileText, Search, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Student } from '../types';

interface StudentDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  isPreloadedSample: boolean;
  onRefreshStudents: () => Promise<void>;
}

export const StudentDatabaseModal: React.FC<StudentDatabaseModalProps> = ({
  isOpen,
  onClose,
  students,
  isPreloadedSample,
  onRefreshStudents,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [csvTextInput, setCsvTextInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [activeTab, setActiveTab] = useState<'upload' | 'view'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    window.location.href = '/api/students/template';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvTextInput(text);
        await submitCsv(text);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const submitCsv = async (rawCsv: string) => {
    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/students/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: rawCsv, replaceExisting: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload student CSV.');
      }

      setUploadStatus({
        type: 'success',
        message: data.message || `Successfully imported ${data.count} students!`,
      });
      await onRefreshStudents();
      setActiveTab('view');
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: err.message || 'An error occurred during upload.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.indexNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Student Database & CSV Import</h2>
            <p className="text-xs text-slate-500">
              Upload university student rosters or view the registered student directory for Classroom 1.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 px-6 pt-3 gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Upload Student CSV
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`pb-3 border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
              activeTab === 'view'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Registered Students</span>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-mono">
              {students.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'upload' ? (
            <div className="space-y-6">
              {/* Instructions and Template download */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-blue-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-700" />
                    Expected CSV File Format:
                  </div>
                  <div className="text-xs text-blue-800 font-mono bg-blue-100/70 px-2.5 py-1 rounded inline-block">
                    index_number,student_name
                  </div>
                  <div className="text-xs text-blue-900/80">
                    Example: <span className="font-mono">22001,Uthsara Manul</span>. Leading zeros in index numbers are preserved.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-medium text-xs px-3.5 py-2 rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template CSV</span>
                </button>
              </div>

              {/* Status Message */}
              {uploadStatus.type === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl p-3.5 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadStatus.message}</span>
                </div>
              )}
              {uploadStatus.type === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-3.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{uploadStatus.message}</span>
                </div>
              )}

              {/* Drag & Drop File Upload Box */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="p-3 bg-white group-hover:bg-blue-100 rounded-full border border-slate-200 transition-colors shadow-2xs">
                    <Upload className="w-6 h-6 text-slate-600 group-hover:text-blue-700" />
                  </div>
                  <div className="font-semibold text-slate-800 text-sm">
                    Click to browse and upload your Student CSV file
                  </div>
                  <div className="text-xs text-slate-500">
                    Supports .csv files formatted with index_number,student_name
                  </div>
                </div>
              </div>

              {/* Or Paste CSV text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or paste CSV text directly:
                </label>
                <textarea
                  rows={4}
                  value={csvTextInput}
                  onChange={(e) => setCsvTextInput(e.target.value)}
                  placeholder="index_number,student_name&#10;22001,Uthsara Manul&#10;22002,Kasun Perera&#10;22003,Nimali Fernando"
                  className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isUploading || !csvTextInput.trim()}
                    onClick={() => submitCsv(csvTextInput)}
                    className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <span>Import Student Roster</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* View Registered Students */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search index or student name..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
                  {isPreloadedSample && (
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-medium">
                      Demonstration Sample
                    </span>
                  )}
                  <span>Showing {filteredStudents.length} of {students.length} students</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Index Number</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400">
                          No students matched your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st) => (
                        <tr key={st.indexNumber} className="hover:bg-slate-50/70">
                          <td className="py-2 px-4 font-mono font-bold text-blue-900">
                            {st.indexNumber}
                          </td>
                          <td className="py-2 px-4 font-medium text-slate-900">
                            {st.studentName}
                          </td>
                          <td className="py-2 px-4 text-right text-slate-400 font-mono text-[11px]">
                            {st.importedAt === 'Sample Data' ? 'Sample' : 'Uploaded'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Student list is saved persistently on the server database.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
