import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MainScreen } from './components/MainScreen';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { DatabaseInfoModal } from './components/DatabaseInfoModal';
import {
  ServerStatus,
  Student,
  TransactionRecord,
  OccupancyStudent,
  TodayAttendanceSummary,
  AppMode,
} from './types';
import { testFirestoreConnection, syncTransactionToFirestore } from './lib/firebase';

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('LANDING');
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('classroom1_admin_token');
  });
  const [adminName, setAdminName] = useState<string>(() => {
    return sessionStorage.getItem('classroom1_admin_name') || 'Classroom 1 Admin';
  });

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [occupancyList, setOccupancyList] = useState<OccupancyStudent[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodayAttendanceSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  // Validate Firestore Connection on initial application boot
  useEffect(() => {
    testFirestoreConnection()
      .then(res => {
        console.log('[Firebase Firestore Status]:', res.message);
      })
      .catch(err => {
        console.warn('[Firebase Firestore Notice]:', err);
      });
  }, []);

  // 1. Fetch Server Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: ServerStatus = await res.json();
        setServerStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch server status:', err);
    }
  }, []);

  // 2. Fetch Students
  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }
  }, []);

  // 3. Fetch Current Occupancy
  const fetchOccupancy = useCallback(async () => {
    try {
      const res = await fetch('/api/occupancy');
      if (res.ok) {
        const data = await res.json();
        setOccupancyList(data.students || []);
      }
    } catch (err) {
      console.error('Failed to fetch occupancy:', err);
    }
  }, []);

  // 4. Fetch Today's Attendance Summary
  const fetchTodaySummary = useCallback(async () => {
    try {
      const res = await fetch('/api/summary/today');
      if (res.ok) {
        const data = await res.json();
        setTodaySummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch today summary:', err);
    }
  }, []);

  // 5. Fetch Recent Transactions
  const fetchRecentTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions/recent');
      if (res.ok) {
        const data = await res.json();
        setRecentTransactions(data.recent || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent transactions:', err);
    }
  }, []);

  // Master refresh
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchStatus(),
      fetchStudents(),
      fetchOccupancy(),
      fetchTodaySummary(),
      fetchRecentTransactions(),
    ]);
  }, [fetchStatus, fetchStudents, fetchOccupancy, fetchTodaySummary, fetchRecentTransactions]);

  useEffect(() => {
    refreshAll();

    // Background sync every 4 seconds to keep multi-device instances synchronized
    const interval = setInterval(() => {
      fetchStatus();
      fetchOccupancy();
      fetchTodaySummary();
      fetchRecentTransactions();
    }, 4000);

    return () => clearInterval(interval);
  }, [refreshAll, fetchStatus, fetchOccupancy, fetchTodaySummary, fetchRecentTransactions]);

  // Handle transaction recorded on client
  const handleTransactionSuccess = async (newTx: TransactionRecord) => {
    setRecentTransactions(prev => [newTx, ...prev.slice(0, 19)]);

    // Seamlessly push to cloud Firestore in background
    syncTransactionToFirestore(newTx).catch(err => {
      console.warn('Background Firestore sync notice:', err);
    });

    await Promise.all([fetchStatus(), fetchOccupancy(), fetchTodaySummary()]);
  };

  // Handle Admin Login Success
  const handleAdminLoginSuccess = (token: string, name: string) => {
    setAdminToken(token);
    setAdminName(name);
    sessionStorage.setItem('classroom1_admin_token', token);
    sessionStorage.setItem('classroom1_admin_name', name);
    setAppMode('ADMIN');
  };

  // Handle Admin Logout
  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (err) {
        console.error(err);
      }
    }
    setAdminToken(null);
    sessionStorage.removeItem('classroom1_admin_token');
    sessionStorage.removeItem('classroom1_admin_name');
    setAppMode('LANDING');
  };

  // ==========================================
  // VIEW ROUTING
  // ==========================================

  return (
    <>
      {/* A. Landing Page View */}
      {appMode === 'LANDING' && (
        <LandingPage
          serverStatus={serverStatus}
          onContinueAsUser={() => setAppMode('USER')}
          onAdminLoginSuccess={handleAdminLoginSuccess}
          onOpenDatabaseInfo={() => setIsDatabaseModalOpen(true)}
        />
      )}

      {/* B. Admin Dashboard View */}
      {appMode === 'ADMIN' && adminToken && (
        <AdminDashboard
          adminToken={adminToken}
          adminName={adminName}
          onLogout={handleAdminLogout}
          onSwitchToUserMode={() => setAppMode('USER')}
          onRefreshAllData={refreshAll}
          occupancyList={occupancyList}
          todaySummary={todaySummary}
          students={students}
          recentTransactions={recentTransactions}
          onOpenDatabaseInfo={() => setIsDatabaseModalOpen(true)}
        />
      )}

      {/* C. Main User Mode Interface */}
      {appMode === 'USER' && (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
          {/* Header with User Mode indicator and Landing Page return */}
          <Header
            serverStatus={serverStatus}
            onExitToLanding={() => setAppMode('LANDING')}
            onSwitchToAdmin={() => {
              if (adminToken) {
                setAppMode('ADMIN');
              } else {
                setAppMode('LANDING');
              }
            }}
            isAdminAuthenticated={!!adminToken}
            onOpenDatabaseInfo={() => setIsDatabaseModalOpen(true)}
          />

          {/* Main Classroom Screen Content */}
          <main className="flex-1">
            <MainScreen
              serverStatus={serverStatus}
              onTransactionSuccess={handleTransactionSuccess}
              recentTransactions={recentTransactions}
              occupancyList={occupancyList}
              students={students}
              onRefreshOccupancy={fetchOccupancy}
              onSwitchToAdmin={() => setAppMode('LANDING')}
            />
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="font-mono">
                Classroom 1 Entry & Exit System · University Academic Access Control
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsDatabaseModalOpen(true)}
                  className="hover:text-emerald-700 font-medium underline cursor-pointer text-emerald-800"
                >
                  Firebase Firestore Details
                </button>
                <button
                  onClick={() => setAppMode('LANDING')}
                  className="hover:text-blue-700 underline cursor-pointer"
                >
                  Change Access Mode
                </button>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Database & Firebase Cloud Info Guide Modal */}
      <DatabaseInfoModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        serverStatus={serverStatus}
      />
    </>
  );
}
