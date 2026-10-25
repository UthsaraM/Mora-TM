import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  setLogLevel,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSchema, Student, TransactionRecord, StudentStatus, VerifiedAdmin } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read config safely
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[Server Firebase] Config load notice:', e);
}

try {
  setLogLevel('silent');
} catch {}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const serverDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function hydrateServerFromFirestore(localDb: DatabaseSchema): Promise<{
  studentsCount: number;
  transactionsCount: number;
  occupancyCount: number;
}> {
  console.log('[Server Firebase] Starting hydration from Cloud Firestore:', firebaseConfig.firestoreDatabaseId);
  let studentsCount = 0;
  let transactionsCount = 0;
  let occupancyCount = 0;

  try {
    // 1. Hydrate Students
    const studentsSnap = await getDocs(collection(serverDb, 'students'));
    if (!studentsSnap.empty) {
      if (!localDb.students) localDb.students = {};
      studentsSnap.forEach(docSnap => {
        const data = docSnap.data() as Student;
        if (data.indexNumber) {
          const existing = localDb.students[data.indexNumber];
          localDb.students[data.indexNumber] = {
            ...existing,
            ...data,
          };
          studentsCount++;
        }
      });
      console.log(`[Server Firebase] Hydrated ${studentsCount} students from Firestore.`);
    }

    // 2. Hydrate Transactions
    const txSnap = await getDocs(collection(serverDb, 'transactions'));
    if (!txSnap.empty) {
      const txMap = new Map<string, TransactionRecord>();
      if (Array.isArray(localDb.transactions)) {
        localDb.transactions.forEach((t: TransactionRecord) => txMap.set(t.id, t));
      }
      txSnap.forEach(docSnap => {
        const data = docSnap.data() as TransactionRecord;
        if (data.id && data.studentIndexNumber && data.timestamp) {
          txMap.set(data.id, data);
          transactionsCount++;
        }
      });

      // Sort chronologically ascending to recalculate currentStatuses accurately
      const mergedTxs = Array.from(txMap.values());
      mergedTxs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      localDb.transactions = mergedTxs;

      // Recalculate occupancy status from chronological transactions
      if (!localDb.currentStatuses) localDb.currentStatuses = {};
      mergedTxs.forEach(tx => {
        localDb.currentStatuses[tx.studentIndexNumber] = tx.statusAfter;
      });
      console.log(`[Server Firebase] Hydrated ${transactionsCount} transactions from Firestore.`);
    }

    // 3. Hydrate Occupancy
    const occSnap = await getDocs(collection(serverDb, 'occupancy'));
    if (!occSnap.empty) {
      if (!localDb.currentStatuses) localDb.currentStatuses = {};
      occSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.indexNumber && data.status) {
          localDb.currentStatuses[data.indexNumber] = data.status as StudentStatus;
          occupancyCount++;
        }
      });
      console.log(`[Server Firebase] Hydrated ${occupancyCount} occupancy records from Firestore.`);
    }

    // 4. Hydrate Admins
    try {
      const adminSnap = await getDocs(collection(serverDb, 'admins'));
      if (!adminSnap.empty) {
        if (!Array.isArray(localDb.verifiedAdmins)) localDb.verifiedAdmins = [];
        const adminMap = new Map<string, VerifiedAdmin>(
          localDb.verifiedAdmins.map((a: VerifiedAdmin) => [a.id, a])
        );
        adminSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data && docSnap.id) {
            const adminObj: VerifiedAdmin = {
              id: docSnap.id,
              name: data.name || 'Verified Admin',
              email: data.email || '',
              staffId: data.staffId || 'ADMIN',
              role: data.role || 'Administrator',
              status: (data.status || 'ACTIVE') as any,
              addedAt: data.createdAt || new Date().toISOString(),
              isVerified: true,
            };
            adminMap.set(docSnap.id, adminObj);
          }
        });
        localDb.verifiedAdmins = Array.from(adminMap.values());
      }
    } catch {
      // Non-critical if admins collection requires auth
    }

  } catch (err) {
    console.warn('[Server Firebase] Hydration warning:', err);
  }

  return { studentsCount, transactionsCount, occupancyCount };
}

// Push a transaction directly to Firestore from server
export async function pushTransactionToFirestore(tx: TransactionRecord): Promise<void> {
  try {
    const cleanPayload: Record<string, any> = {
      id: tx.id,
      studentIndexNumber: tx.studentIndexNumber,
      studentName: tx.studentName,
      venue: tx.venue || 'Classroom 1',
      type: tx.type,
      timestamp: tx.timestamp,
      date: tx.date,
      formattedTime: tx.formattedTime,
      statusAfter: tx.statusAfter,
    };
    if (tx.googleEmail) cleanPayload.googleEmail = tx.googleEmail;
    if (tx.googleUid) cleanPayload.googleUid = tx.googleUid;
    if (tx.greeting) cleanPayload.greeting = tx.greeting;
    if (tx.isCorrected !== undefined) cleanPayload.isCorrected = tx.isCorrected;
    if (tx.correctionId) cleanPayload.correctionId = tx.correctionId;
    if (tx.correctionReason) cleanPayload.correctionReason = tx.correctionReason;
    if (tx.correctedBy) cleanPayload.correctedBy = tx.correctedBy;

    await setDoc(doc(serverDb, 'transactions', tx.id), cleanPayload);

    // Update occupancy collection
    await setDoc(doc(serverDb, 'occupancy', tx.studentIndexNumber), {
      indexNumber: tx.studentIndexNumber,
      status: tx.statusAfter,
      studentName: tx.studentName,
      updatedAt: tx.timestamp,
      lastFormattedTime: tx.formattedTime,
    });
  } catch (err) {
    console.warn('[Server Firebase] pushTransactionToFirestore notice:', err);
  }
}

// Push student linking to Firestore from server
export async function pushStudentLinkToFirestore(
  indexNumber: string,
  googleEmail: string,
  googleUid?: string
): Promise<void> {
  try {
    const payload: Record<string, any> = {
      googleEmail,
      linkedAt: new Date().toISOString(),
    };
    if (googleUid) payload.googleUid = googleUid;
    await setDoc(doc(serverDb, 'students', indexNumber), payload, { merge: true });
  } catch (err) {
    console.warn('[Server Firebase] pushStudentLinkToFirestore notice:', err);
  }
}
