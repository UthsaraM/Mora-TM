import React, { useState } from 'react';
import {
  X,
  Database,
  Server,
  Cloud,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  Terminal,
  Zap,
} from 'lucide-react';
import { ServerStatus } from '../types';
import { testFirestoreConnection, syncStudentRosterToFirestore } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

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
  const [testResult, setTestResult] = useState<{ loading: boolean; success: boolean | null; message: string }>({
    loading: false,
    success: null,
    message: '',
  });
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message: string }>({
    loading: false,
    message: '',
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestResult({ loading: true, success: null, message: 'Pinging Firestore cluster...' });
    try {
      const res = await testFirestoreConnection();
      setTestResult({
        loading: false,
        success: res.connected,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        loading: false,
        success: false,
        message: err.message || 'Connection test failed',
      });
    }
  };

  const handleSyncToFirestore = async () => {
    setSyncStatus({ loading: true, message: 'Fetching student roster from server and syncing...' });
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error('Could not fetch students from server');
      const data = await res.json();
      const count = await syncStudentRosterToFirestore(data.students || []);
      setSyncStatus({
        loading: false,
        message: `Successfully synced ${count} students to Cloud Firestore collection 'students'!`,
      });
    } catch (err: any) {
      setSyncStatus({
        loading: false,
        message: `Sync failed: ${err.message || 'Unknown error'}`,
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Firebase Firestore & Database Guide
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">
                  Connected
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cloud database configuration, live connection diagnostics & Vercel deployment guide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          {/* Live Provisioned Firebase Status Card */}
          <div className="border border-emerald-200 bg-emerald-50/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Google Firebase Firestore: Connected & Provisioned</span>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={testResult.loading}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testResult.loading ? 'animate-spin' : ''}`} />
                <span>{testResult.loading ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {testResult.message && (
              <div
                className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 font-mono ${
                  testResult.success
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-emerald-900 pt-1">
              <div className="bg-white/80 border border-emerald-200/80 p-2 rounded-lg flex items-center justify-between">
                <span>
                  Project ID: <strong className="text-slate-900">{firebaseConfig.projectId}</strong>
                </span>
                <button
                  onClick={() => copyToClipboard(firebaseConfig.projectId, 'projectId')}
                  className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="bg-white/80 border border-emerald-200/80 p-2 rounded-lg flex items-center justify-between">
                <span>
                  Auth Domain: <strong className="text-slate-900">{firebaseConfig.authDomain}</strong>
                </span>
                <button
                  onClick={() => copyToClipboard(firebaseConfig.authDomain, 'authDomain')}
                  className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {copiedKey && (
              <div className="text-[10px] text-emerald-700 font-semibold italic text-right">
                ✓ Copied {copiedKey} to clipboard
              </div>
            )}
          </div>

          {/* Quick Sync Action */}
          <div className="border border-blue-200 bg-blue-50/60 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
                <Zap className="w-4 h-4 text-blue-600" />
                <span>One-Click Cloud Roster Synchronization</span>
              </div>
              <button
                onClick={handleSyncToFirestore}
                disabled={syncStatus.loading}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.loading ? 'animate-spin' : ''}`} />
                <span>{syncStatus.loading ? 'Syncing...' : 'Sync Students to Firestore'}</span>
              </button>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Uploads all currently registered classroom students to Cloud Firestore (<code className="font-mono text-blue-900 font-bold">students/</code> collection) with security rule validation.
            </p>
            {syncStatus.message && (
              <div className="p-2.5 bg-white border border-blue-200 rounded-lg text-[11px] font-medium text-blue-900">
                {syncStatus.message}
              </div>
            )}
          </div>

          {/* Step-by-Step Guide for Firebase & Vercel */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
              <Terminal className="w-4 h-4 text-slate-700" />
              <span>Complete Setup & Deployment Guide</span>
            </div>

            <div className="space-y-3 text-slate-600 leading-relaxed text-[11px]">
              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>How Firestore Collections Are Structured</span>
                </div>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 font-mono text-[10.5px]">
                  <li><strong className="text-slate-800">students/{'{indexNumber}'}</strong>: Student index, name, active flag.</li>
                  <li><strong className="text-slate-800">transactions/{'{txId}'}</strong>: Immutable timestamped entry/exit transactions.</li>
                  <li><strong className="text-slate-800">occupancy/{'{indexNumber}'}</strong>: Real-time INSIDE / OUTSIDE status.</li>
                  <li><strong className="text-slate-800">admins/{'{adminUid}'}</strong>: Authorized system administrators.</li>
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Security Rules Deployed</span>
                </div>
                <p>
                  Zero-trust security rules (<code className="font-mono text-slate-800">firestore.rules</code>) are active. Roster viewing and entry/exit recording are secured against oversized payload injections and unauthorized deletions.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Deploying to Vercel</span>
                </div>
                <p>
                  When deploying to Vercel, the <code className="font-mono text-slate-800">firebase-applet-config.json</code> in the repository root is automatically bundled into the build. The client SDK connects directly to Firestore from the browser, while the serverless Express endpoints handle persistent file fallbacks in <code className="font-mono text-slate-800">/tmp</code>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Firebase Project: {firebaseConfig.projectId}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 font-medium text-white text-xs cursor-pointer transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
