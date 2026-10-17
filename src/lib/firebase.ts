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
  orderBy,
  limit,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import { Student, TransactionRecord, StudentStatus, VerifiedAdmin } from '../types';

// Web app's Firebase configuration for entry-sys-mora
export const firebaseConfig = {
  apiKey: "AIzaSyDj0KIgx-bTtAr2inv2hXi83z-Wrwa2XoM",
  authDomain: "entry-sys-mora.firebaseapp.com",
  projectId: "entry-sys-mora",
  storageBucket: "entry-sys-mora.firebasestorage.app",
  messagingSenderId: "245602959606",
  appId: "1:245602959606:web:4530291036c43cdc012cd7",
  measurementId: "G-454GLKJGHV",
};

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

// Initialize Firestore & Auth
export const db = getFirestore(app);
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
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
      try {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      } catch (err) {
        if (onError) onError(err as Error);
      }
    }
  );
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
  const txPath = `transactions/${tx.id}`;
  try {
    await setDoc(doc(db, 'transactions', tx.id), tx);
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
