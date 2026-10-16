import { initializeApp } from 'firebase/app';
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
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Student, TransactionRecord, StudentStatus, OccupancyStudent } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass databaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
    return { connected: true, message: 'Connected to Firebase Firestore successfully.' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { connected: false, message: 'Firestore client is currently offline.' };
    }
    // Permissions or non-existent doc errors still confirm active network connection
    return { connected: true, message: 'Firestore initialized and connected to cloud cluster.' };
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
    handleFirestoreError(error, OperationType.WRITE, txPath);
  }
}

// Sync bulk student roster to Firestore
export async function syncStudentRosterToFirestore(students: Student[]): Promise<number> {
  let count = 0;
  for (const s of students) {
    const sPath = `students/${s.indexNumber}`;
    try {
      await setDoc(doc(db, 'students', s.indexNumber), s, { merge: true });
      count++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, sPath);
    }
  }
  return count;
}
