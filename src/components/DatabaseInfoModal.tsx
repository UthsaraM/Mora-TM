import React from 'react';
import { X, Database, Server, Cloud, ShieldCheck, HardDrive, AlertCircle } from 'lucide-react';
import { ServerStatus } from '../types';

interface DatabaseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverStatus: ServerStatus | null;
}

export const DatabaseInfoModal: React.FC<DatabaseInfoModalProps> = ({
  isOpen,
  onClose,
  serverStatus,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Database & Persistence Architecture</h2>
              <p className="text-xs text-slate-500">Storage status and cloud database synchronization details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Active Backend Storage Status */}
          <div className="border border-emerald-200 bg-emerald-50/70 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <Server className="w-4 h-4 text-emerald-700" />
              <span>Current Status: Active Persistent Server Database</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              Every student record and entry/exit transaction is written to the persistent disk storage on the backend server (<code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-950">data/classroom_db.json</code>).
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-emerald-900">
              <div>• Survives browser refresh: <span className="font-bold">YES</span></div>
              <div>• Survives browser close/reopen: <span className="font-bold">YES</span></div>
              <div>• Shared across devices via server: <span className="font-bold">YES</span></div>
              <div>• In-memory only: <span className="font-bold">NO (Written to disk)</span></div>
            </div>
          </div>

          {/* Database Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Students</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {serverStatus ? serverStatus.totalStudents : '--'}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Transactions Logged</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {serverStatus ? serverStatus.totalTransactions : '--'}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center">
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Classroom Venue</div>
              <div className="text-lg font-bold font-mono text-blue-900 mt-0.5">
                Classroom 1
              </div>
            </div>
          </div>

          {/* Firebase Firestore Requirements & Setup */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>Firebase Firestore Cloud Configuration Guide</span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              If your institution requires Google Cloud Firebase Firestore as the primary multi-campus cloud database instead of the Node server disk storage:
            </p>

            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="font-semibold text-slate-800">Prerequisites for Firebase Firestore:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 ml-1">
                <li>
                  <strong className="text-slate-700">Firebase Project:</strong> Create a project at{' '}
                  <span className="font-mono text-blue-700">console.firebase.google.com</span>.
                </li>
                <li>
                  <strong className="text-slate-700">Firestore Database:</strong> Enable Cloud Firestore in production mode in region (e.g. <span className="font-mono">asia-southeast1</span>).
                </li>
                <li>
                  <strong className="text-slate-700">Configuration File:</strong> Place your <span className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">firebase-applet-config.json</span> in the project root containing <span className="font-mono">apiKey</span>, <span className="font-mono">projectId</span>, and <span className="font-mono">appId</span>.
                </li>
                <li>
                  <strong className="text-slate-700">Firestore Collections:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1 text-slate-500 space-y-0.5">
                    <li><code className="font-mono text-slate-700">students/{'{indexNumber}'}</code>: student profile & current status.</li>
                    <li><code className="font-mono text-slate-700">transactions/{'{txId}'}</code>: immutable entry and exit transaction logs.</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="flex items-start gap-2 bg-blue-50/80 border border-blue-200 text-blue-900 p-2.5 rounded-lg text-[11px]">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Reliability Notice:</strong> The current active server storage is completely persistent and ready for actual university operations. Records are never kept in temporary browser memory or transient state.
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
