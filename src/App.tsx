import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { MainScreen } from './components/MainScreen';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import {
  ServerStatus,
  Student,
  TransactionRecord,
  OccupancyStudent,
  TodayAttendanceSummary,
  AppMode,
} from './types';
import {
  testFirestoreConnection,
  syncTransactionToFirestore,
  subscribeToAuthChanges,
  signOutUser,
} from './lib/firebase';

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('LANDING');
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('classroom1_admin_token');
  });
  const [adminName, setAdminName] = useState<string>(() => {
    return sessionStorage.getItem('classroom1_admin_name') || 'Classroom 1 Admin';
  });
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return sessionStorage.getItem('classroom1_admin_email') || 'uthzaaawim@gmail.com';
  });

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [occupancyList, setOccupancyList] = useState<OccupancyStudent[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodayAttendanceSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);

  // Validate Firestore Connection on boot
  useEffect(() => {
    testFirestoreConnection()
      .then(res => {
        console.log('[Firebase Firestore Status]:', res.message);
      })
      .catch(err => {
        console.warn('[Firebase Firestore Notice]:', err);
      });
  }, []);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setGoogleUser(user);
      if (user && user.email) {
        // Query server to find if this Google user has a linked student profile
        try {
          const res = await fetch('/api/student/google-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, uid: user.uid }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.isLinked && data.student) {
              setCurrentStudent(data.student);
              // Crucial: Student Google login must never have admin access
              setAdminToken(null);
              sessionStorage.removeItem('classroom1_admin_token');
              sessionStorage.removeItem('classroom1_admin_name');
              sessionStorage.removeItem('classroom1_admin_email');
            } else {
              setCurrentStudent(null);
            }
          }
        } catch (e) {
          console.warn('Student google account verification notice:', e);
        }
      } else {
        setCurrentStudent(null);
      }
    });

    return () => unsubscribe();
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

    // Background sync every 4 seconds to keep all views synchronized
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
  const handleAdminLoginSuccess = (token: string, name: string, email?: string) => {
    setAdminToken(token);
    setAdminName(name);
    const finalEmail = email || 'uthzaaawim@gmail.com';
    setAdminEmail(finalEmail);
    sessionStorage.setItem('classroom1_admin_token', token);
    sessionStorage.setItem('classroom1_admin_name', name);
    sessionStorage.setItem('classroom1_admin_email', finalEmail);
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
    sessionStorage.removeItem('classroom1_admin_email');
    setAppMode('LANDING');
  };

  // Handle Student Login from Landing
  const handleStudentLoginSuccess = (student: Student) => {
    // Clear any administrative credentials; students are never administrators
    setAdminToken(null);
    sessionStorage.removeItem('classroom1_admin_token');
    sessionStorage.removeItem('classroom1_admin_name');
    sessionStorage.removeItem('classroom1_admin_email');
    setCurrentStudent(student);
    setAppMode('USER');
  };

  return (
    <>
      {/* A. Landing Page View */}
      {appMode === 'LANDING' && (
        <LandingPage
          serverStatus={serverStatus}
          onContinueAsUser={() => setAppMode('USER')}
          onAdminLoginSuccess={handleAdminLoginSuccess}
          onStudentLoginSuccess={handleStudentLoginSuccess}
        />
      )}

      {/* B. Admin Dashboard View - Strictly restricted to verified admin tokens */}
      {appMode === 'ADMIN' && adminToken && (
        <AdminDashboard
          adminToken={adminToken}
          adminName={adminName}
          adminEmail={adminEmail}
          onLogout={handleAdminLogout}
          onSwitchToUserMode={() => setAppMode('USER')}
          onRefreshAllData={refreshAll}
          occupancyList={occupancyList}
          todaySummary={todaySummary}
          students={students}
          recentTransactions={recentTransactions}
        />
      )}

      {/* C. Main User Mode Interface */}
      {appMode === 'USER' && (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
          {/* Header with User Mode indicator and Landing Page return */}
          <Header
            serverStatus={serverStatus}
            googleUser={googleUser}
            currentStudent={currentStudent}
            onExitToLanding={() => setAppMode('LANDING')}
            onSwitchToAdmin={() => {
              if (adminToken && !currentStudent) {
                setAppMode('ADMIN');
              } else {
                setAppMode('LANDING');
              }
            }}
            isAdminAuthenticated={!!adminToken && !currentStudent}
            onSignOutGoogle={async () => {
              await signOutUser();
              setCurrentStudent(null);
            }}
          />

          {/* Main Classroom Screen Content */}
          <main className="flex-1">
            <MainScreen
              serverStatus={serverStatus}
              googleUser={googleUser}
              currentStudent={currentStudent}
              onStudentLinked={(student) => setCurrentStudent(student)}
              onTransactionSuccess={handleTransactionSuccess}
              recentTransactions={recentTransactions}
              occupancyList={occupancyList}
              students={students}
              onRefreshOccupancy={fetchOccupancy}
              onSwitchToAdmin={() => setAppMode('LANDING')}
            />
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 hidden md:block">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="font-mono">
                Classroom 1 Entry & Exit System · University Academic Access Control
              </div>
              <div className="flex items-center gap-4">
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
    </>
  );
}
