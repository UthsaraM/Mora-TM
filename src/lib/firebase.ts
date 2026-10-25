import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocFromServer,
  Unsubscribe,
  initializeFirestore,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Student, TransactionRecord, StudentStatus, VerifiedAdmin } from '../types';

export { firebaseConfig };

// Suppress internal gRPC idle stream warnings and info messages
try {
  setLogLevel('silent');
} catch {}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics safely
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    // Analytics is optional and might be blocked in sandboxes
  }
}
export { analytics };

// Initialize Firestore with specific database ID & force long polling to completely eliminate GrpcConnection idle stream timeouts
let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreDb;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never | void {
  const msg = error instanceof Error ? error.message : String(error);
  // Gracefully ignore normal gRPC / WebChannel idle stream cancellations
  if (
    msg.includes('CANCELLED') ||
    msg.includes('Disconnecting idle stream') ||
    msg.includes('Timed out waiting for new targets') ||
    (error as any)?.code === 'cancelled' ||
    (error as any)?.code === 1
  ) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: msg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot
export async function testFirestoreConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, message: 'Connected to Firebase Firestore (entry-sys-mora).' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently operating offline.');
      return { connected: false, message: 'Firestore client is currently offline.' };
    }
    // Permissions or non-existent test document still confirm live network connectivity
    return { connected: true, message: 'Firestore initialized with entry-sys-mora.' };
  }
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Google Sign-in error:', err);
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out error:', err);
    throw err;
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// Live Students Subscription
export function subscribeToStudents(
  onData: (students: Student[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'students');
  return onSnapshot(
    colRef,
    snapshot => {
      const list: Student[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Student;
        list.push(data);
      });
      list.sort((a, b) =>
        a.indexNumber.localeCompare(b.indexNumber, undefined, { numeric: true })
      );
      onData(list);
    },
    error => {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes('CANCELLED') ||
        msg.includes('idle stream') ||
        msg.includes('Timed out waiting for new targets')
      ) {
        return;
      }
      try {
        handleFirestoreError(error, OperationType.LIST, 'students');
      } catch (err) {
        if (onError) onError(err as Error);
      }
    }
  );
}

// Live Occupancy Subscription
export function subscribeToOccupancy(
  onData: (occupancyMap: Record<string, StudentStatus>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'occupancy');
  return onSnapshot(
    colRef,
    snapshot => {
      const map: Record<string, StudentStatus> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.indexNumber && data.status) {
          map[data.indexNumber] = data.status as StudentStatus;
        }
      });
      onData(map);
    },
    error => {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes('CANCELLED') ||
        msg.includes('idle stream') ||
        msg.includes('Timed out waiting for new targets')
      ) {
        return;
      }
      try {
        handleFirestoreError(error, OperationType.LIST, 'occupancy');
      } catch (err) {
        if (onError) onError(err as Error);
      }
    }
  );
}

// Live Recent Transactions Subscription
export function subscribeToRecentTransactions(
  limitCount: number = 20,
  onData: (transactions: TransactionRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'transactions');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
  return onSnapshot(
    q,
    snapshot => {
      const txs: TransactionRecord[] = [];
      snapshot.forEach(docSnap => {
        txs.push(docSnap.data() as TransactionRecord);
      });
      onData(txs);
    },
    error => {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes('CANCELLED') ||
        msg.includes('idle stream') ||
        msg.includes('Timed out waiting for new targets')
      ) {
        return;
      }
      try {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      } catch (err) {
        if (onError) onError(err as Error);
      }
    }
  );
}

// Full Synchronize from Firestore to Backend
export async function syncAllWithServerFromFirestore(): Promise<{
  success: boolean;
  message: string;
  stats?: { totalStudents: number; totalTransactions: number; studentsCurrentlyInside: number };
}> {
  try {
    const res = await fetch('/api/database/sync-all-from-firestore', { method: 'POST' });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to sync with server.',
    };
  }
}

// Push a single student to Firestore
export async function syncStudentToFirestore(student: Student): Promise<void> {
  try {
    const payload: Partial<Student> = {
      indexNumber: student.indexNumber,
      studentName: student.studentName,
      importedAt: student.importedAt || new Date().toISOString(),
      isActive: student.isActive !== false,
    };
    if (student.googleEmail) payload.googleEmail = student.googleEmail;
    if (student.googleUid) payload.googleUid = student.googleUid;
    if (student.linkedAt) payload.linkedAt = student.linkedAt;

    await setDoc(doc(db, 'students', student.indexNumber), payload, { merge: true });
  } catch (err) {
    console.warn(`Firestore student sync warning for ${student.indexNumber}:`, err);
  }
}

// Link a student's Google account in Firestore
export async function linkStudentIndexToGoogleInFirestore(
  indexNumber: string,
  googleEmail: string,
  googleUid: string,
  studentName?: string
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'students', indexNumber),
      {
        indexNumber,
        ...(studentName ? { studentName } : {}),
        googleEmail,
        googleUid,
        linkedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn(`Firestore student link warning for ${indexNumber}:`, err);
  }
}

// Delete student from Firestore
export async function deleteStudentFromFirestore(indexNumber: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', indexNumber));
  } catch (err) {
    console.warn(`Firestore student delete warning for ${indexNumber}:`, err);
  }
}

// Sync bulk student roster to Firestore
export async function syncStudentRosterToFirestore(students: Student[]): Promise<number> {
  let count = 0;
  // Process in chunks of 50 to maintain fast execution
  const chunkSize = 50;
  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(s => {
      const ref = doc(db, 'students', s.indexNumber);
      const payload: Partial<Student> = {
        indexNumber: s.indexNumber,
        studentName: s.studentName,
        importedAt: s.importedAt || new Date().toISOString(),
        isActive: s.isActive !== false,
      };
      if (s.googleEmail) payload.googleEmail = s.googleEmail;
      if (s.googleUid) payload.googleUid = s.googleUid;
      if (s.linkedAt) payload.linkedAt = s.linkedAt;

      batch.set(ref, payload, { merge: true });
    });
    try {
      await batch.commit();
      count += chunk.length;
    } catch (err) {
      console.warn('Batch student commit notice:', err);
    }
  }
  return count;
}

// Fetch all verified admins from Firestore
export async function fetchAdminsFromFirestore(): Promise<VerifiedAdmin[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    const list: VerifiedAdmin[] = [];
    snap.forEach(d => {
      list.push(d.data() as VerifiedAdmin);
    });
    return list;
  } catch (err) {
    console.warn('Notice reading admins from Firestore:', err);
    return [];
  }
}

// Sync Verified Administrator to Firestore
export async function syncAdminUserToFirestore(admin: VerifiedAdmin): Promise<void> {
  try {
    await setDoc(doc(db, 'admins', admin.id), admin, { merge: true });
  } catch (err) {
    console.warn(`Firestore admin sync notice for ${admin.id}:`, err);
  }
}

// Delete Verified Administrator from Firestore
export async function deleteAdminUserFromFirestore(adminId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', adminId));
  } catch (err) {
    console.warn(`Firestore admin delete notice for ${adminId}:`, err);
  }
}

// Push a new transaction to Firestore
export async function syncTransactionToFirestore(tx: TransactionRecord): Promise<void> {
  try {
    const cleanTx: Record<string, any> = {};
    for (const [k, v] of Object.entries(tx)) {
      if (v !== undefined) {
        cleanTx[k] = v;
      }
    }
    await setDoc(doc(db, 'transactions', tx.id), cleanTx);
    // Also update student's current occupancy state
    await setDoc(
      doc(db, 'occupancy', tx.studentIndexNumber),
      {
        indexNumber: tx.studentIndexNumber,
        status: tx.statusAfter,
        updatedAt: tx.timestamp,
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Firestore transaction sync notice:', error);
  }
}

// Clear all transactions and reset occupancy in Firestore
export async function clearTransactionsFromFirestore(): Promise<void> {
  try {
    // 1. Fetch all transactions
    const txSnap = await getDocs(collection(db, 'transactions'));
    const batch1 = writeBatch(db);
    txSnap.forEach(d => {
      batch1.delete(d.ref);
    });
    await batch1.commit();

    // 2. Fetch and clear occupancy records
    const occSnap = await getDocs(collection(db, 'occupancy'));
    const batch2 = writeBatch(db);
    occSnap.forEach(d => {
      batch2.delete(d.ref);
    });
    await batch2.commit();
  } catch (err) {
    console.warn('Firestore transaction wipe notice:', err);
  }
}

// Check and auto-sync student roster and verified admins if Firestore is empty
export async function checkAndSyncInitialRoster(
  students: Student[],
  admins?: VerifiedAdmin[]
): Promise<void> {
  if (!students || students.length === 0) return;
  try {
    const snap = await getDocs(query(collection(db, 'students'), limit(1)));
    if (snap.empty) {
      console.log(`[Firebase Firestore] Roster empty in Cloud Firestore. Auto-syncing ${students.length} students...`);
      await syncStudentRosterToFirestore(students);
      console.log('[Firebase Firestore] Student roster synced to Cloud Firestore.');
    }
    if (admins && admins.length > 0) {
      const adminSnap = await getDocs(query(collection(db, 'admins'), limit(1)));
      if (adminSnap.empty) {
        for (const a of admins) {
          await syncAdminUserToFirestore(a);
        }
        console.log('[Firebase Firestore] Verified admins synced to Cloud Firestore.');
      }
    }
  } catch (err) {
    console.warn('[Firebase Firestore] Auto-sync check notice:', err);
  }
}

// Fetch all historical transactions from Cloud Firestore with optional date or student filter
export async function fetchHistoricalTransactionsFromFirestore(
  dateFilter?: string,
  studentIndexFilter?: string
): Promise<TransactionRecord[]> {
  try {
    const colRef = collection(db, 'transactions');
    let q;
    if (dateFilter && studentIndexFilter) {
      q = query(
        colRef,
        where('date', '==', dateFilter),
        where('studentIndexNumber', '==', studentIndexFilter)
      );
    } else if (dateFilter) {
      q = query(colRef, where('date', '==', dateFilter));
    } else if (studentIndexFilter) {
      q = query(colRef, where('studentIndexNumber', '==', studentIndexFilter));
    } else {
      q = query(colRef, orderBy('timestamp', 'desc'), limit(1000));
    }

    const snap = await getDocs(q);
    const txs: TransactionRecord[] = [];
    snap.forEach(docSnap => {
      txs.push(docSnap.data() as TransactionRecord);
    });

    // Ensure sorted descending by timestamp
    txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return txs;
  } catch (err) {
    console.warn('Notice querying historical transactions from Cloud Firestore:', err);
    return [];
  }
}

// Restore transactions from Cloud Firestore directly into backend database
export async function restoreTransactionsFromFirestore(
  adminToken: string
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const txs = await fetchHistoricalTransactionsFromFirestore();
    if (txs.length === 0) {
      return { success: true, count: 0, message: 'No transactions found in Cloud Firestore to restore.' };
    }

    const res = await fetch('/api/database/restore-transactions-from-firestore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ transactions: txs }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to restore transactions to server.');
    }

    return {
      success: true,
      count: data.restoredCount ?? txs.length,
      message: `Successfully restored ${data.restoredCount ?? txs.length} past records from Cloud Firestore.`,
    };
  } catch (err: any) {
    console.error('Failed to restore transactions from Cloud Firestore:', err);
    return {
      success: false,
      count: 0,
      message: err.message || 'Error communicating with server during restore.',
    };
  }
}

// Get Firestore total transaction count
export async function getFirestoreTransactionCount(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'transactions'));
    return snap.size;
  } catch (err) {
    return 0;
  }
}

