import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  Student,
  TransactionRecord,
  StudentStatus,
  AttendanceSession,
  DailyReportData,
  OccupancyStudent,
  TodayAttendanceSummary,
  TransactionCorrection,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Full CORS support for Vercel, localhost, and external domains
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Determine storage path
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp' : path.resolve(__dirname, '..', 'data');
const DB_FILE = isVercel ? path.resolve('/tmp', 'classroom_db.json') : path.resolve(DATA_DIR, 'classroom_db.json');
const BUNDLED_DB_FILE = path.resolve(__dirname, '..', 'data', 'classroom_db.json');

if (!isVercel && !fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create data dir:', e);
  }
}

interface AdminAuthData {
  passwordHash: string;
  salt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  students: Record<string, Student>;
  transactions: TransactionRecord[];
  currentStatuses: Record<string, StudentStatus>;
  corrections?: TransactionCorrection[];
  admin?: AdminAuthData;
  meta: {
    initializedAt: string;
    isPreloadedSample: boolean;
    lastUpdated: string;
  };
}

const INITIAL_SAMPLE_STUDENTS: Student[] = [
  { indexNumber: '22001', studentName: 'Uthsara Manul', importedAt: 'Sample Data', isActive: true },
  { indexNumber: '22002', studentName: 'Kasun Perera', importedAt: 'Sample Data', isActive: true },
  { indexNumber: '22003', studentName: 'Nimali Fernando', importedAt: 'Sample Data', isActive: true },
  { indexNumber: '22004', studentName: 'Dinithi Jayasinghe', importedAt: 'Sample Data', isActive: true },
  { indexNumber: '22005', studentName: 'Sandun Wickramasinghe', importedAt: 'Sample Data', isActive: true },
];

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function createDefaultAdminAuth(): AdminAuthData {
  const salt = 'a55df674ca3bb6307a3da9c2f4779347';
  const passwordHash = hashPassword('admin123', salt);
  return {
    passwordHash,
    salt,
    updatedAt: new Date().toISOString(),
  };
}

function loadDatabase(): DatabaseSchema {
  // If in Vercel serverless environment, copy seed database into /tmp if not already present
  if (isVercel && !fs.existsSync(DB_FILE) && fs.existsSync(BUNDLED_DB_FILE)) {
    try {
      const bundledRaw = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
      fs.writeFileSync(DB_FILE, bundledRaw, 'utf-8');
    } catch (e) {
      console.warn('Failed to copy seed database to /tmp:', e);
    }
  }

  // Try reading local DB_FILE
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.students) data.students = {};
      if (!Array.isArray(data.transactions)) data.transactions = [];
      if (!data.currentStatuses) data.currentStatuses = {};
      if (!Array.isArray(data.corrections)) data.corrections = [];
      if (!data.admin) data.admin = createDefaultAdminAuth();
      if (!data.meta) {
        data.meta = {
          initializedAt: new Date().toISOString(),
          isPreloadedSample: false,
          lastUpdated: new Date().toISOString(),
        };
      }
      return data;
    } catch (err) {
      console.warn('Could not read DB_FILE, trying bundled file:', err);
    }
  }

  // Fallback to bundled DB file
  if (fs.existsSync(BUNDLED_DB_FILE)) {
    try {
      const raw = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return data;
    } catch (err) {
      console.warn('Could not read BUNDLED_DB_FILE:', err);
    }
  }

  // Fallback to sample students
  const studentMap: Record<string, Student> = {};
  for (const s of INITIAL_SAMPLE_STUDENTS) {
    studentMap[s.indexNumber] = s;
  }

  const initialDb: DatabaseSchema = {
    students: studentMap,
    transactions: [],
    currentStatuses: {},
    corrections: [],
    admin: createDefaultAdminAuth(),
    meta: {
      initializedAt: new Date().toISOString(),
      isPreloadedSample: true,
      lastUpdated: new Date().toISOString(),
    },
  };

  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(data: DatabaseSchema): void {
  data.meta.lastUpdated = new Date().toISOString();
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not write database:', e);
    }
  }
}

// In-memory cache
let db: DatabaseSchema = loadDatabase();

const activeAdminSessions = new Map<string, { adminName: string; expiresAt: number }>();
const activeUserSessions = new Map<string, { indexNumber: string; studentName: string; expiresAt: number }>();

const COLOMBO_TIMEZONE = 'Asia/Colombo';

function getColomboDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getColomboTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: COLOMBO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function getGreetingForColombo(date: Date = new Date()): 'Good Morning' | 'Good Afternoon' | 'Good Evening' {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: COLOMBO_TIMEZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date);
  
  const hour = parseInt(hourStr, 10);
  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  } else {
    return 'Good Evening';
  }
}

let isTransactionLocked = false;

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Administrator authentication required.' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const session = activeAdminSessions.get(token);

  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired administrator session.' });
    return;
  }

  if (Date.now() > session.expiresAt) {
    activeAdminSessions.delete(token);
    res.status(401).json({ error: 'Unauthorized: Administrator session has expired. Please log in again.' });
    return;
  }

  session.expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  (req as any).adminUser = session.adminName;
  next();
}

// Router containing all routes
const router = express.Router();

// 1. Health & Server Status
router.get('/status', (_req: Request, res: Response) => {
  const insideCount = Object.values(db.currentStatuses).filter(s => s === 'INSIDE').length;
  res.json({
    online: true,
    venue: 'Classroom 1',
    totalStudents: Object.keys(db.students).length,
    totalTransactions: db.transactions.length,
    studentsCurrentlyInside: insideCount,
    isPreloadedSample: db.meta.isPreloadedSample,
    currentTimeColombo: getColomboTimeString(),
    currentDateColombo: getColomboDateString(),
    storageType: isVercel
      ? 'Vercel Serverless Storage (/tmp/classroom_db.json)'
      : 'Server Persistent Storage (data/classroom_db.json)',
  });
});

// 2. User Authentication (Login by Student/Operator Index Number)
router.post('/user/login', (req: Request, res: Response) => {
  const { indexNumber } = req.body;
  if (!indexNumber || typeof indexNumber !== 'string') {
    res.status(400).json({ error: 'Student index number is required for user authentication.' });
    return;
  }

  const query = indexNumber.trim().toLowerCase();
  const student = Object.values(db.students).find(
    s => s.indexNumber.trim().toLowerCase() === query
  );

  if (!student) {
    res.status(404).json({
      error: 'Student not found. Please check your index number.',
      notFoundIndex: indexNumber,
    });
    return;
  }

  if (student.isActive === false) {
    res.status(403).json({
      error: 'Student account is deactivated. Please contact the administrator.',
    });
    return;
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  activeUserSessions.set(token, {
    indexNumber: student.indexNumber,
    studentName: student.studentName,
    expiresAt,
  });

  const currentStatus = db.currentStatuses[student.indexNumber] || 'OUTSIDE';

  res.json({
    success: true,
    token,
    student,
    currentStatus,
    expiresAt,
    message: `Authenticated as ${student.studentName} (${student.indexNumber}).`,
  });
});

// 3. Admin Authentication Endpoints
router.post('/admin/login', (req: Request, res: Response) => {
  const { password, adminName } = req.body;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Administrator password is required.' });
    return;
  }

  if (!db.admin) {
    db.admin = createDefaultAdminAuth();
    saveDatabase(db);
  }

  const calculatedHash = hashPassword(password, db.admin.salt);
  if (calculatedHash !== db.admin.passwordHash) {
    res.status(401).json({ error: 'Incorrect administrator password.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const name = (adminName && typeof adminName === 'string' && adminName.trim()) || 'Classroom 1 Admin';
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  activeAdminSessions.set(token, { adminName: name, expiresAt });

  res.json({
    success: true,
    token,
    adminName: name,
    expiresAt,
    message: 'Administrator authentication successful.',
  });
});

router.get('/admin/verify', requireAdmin, (req: Request, res: Response) => {
  res.json({
    valid: true,
    adminName: (req as any).adminUser,
  });
});

router.post('/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    activeAdminSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

router.post('/admin/change-password', requireAdmin, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required.' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  const currentHash = hashPassword(currentPassword, db.admin!.salt);
  if (currentHash !== db.admin!.passwordHash) {
    res.status(401).json({ error: 'Current password does not match.' });
    return;
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashPassword(newPassword, newSalt);

  db.admin = {
    passwordHash: newHash,
    salt: newSalt,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(db);

  res.json({ success: true, message: 'Administrator password changed successfully.' });
});

// 4. Current Occupancy Endpoint
router.get('/occupancy', (_req: Request, res: Response) => {
  const insideIndices = Object.keys(db.currentStatuses).filter(
    idx => db.currentStatuses[idx] === 'INSIDE'
  );

  const studentsInside: OccupancyStudent[] = [];

  for (const idx of insideIndices) {
    const student = db.students[idx];
    if (!student) continue;

    const studentEntries = db.transactions
      .filter(t => t.studentIndexNumber === idx && t.type === 'ENTRY')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const lastEntry = studentEntries[0];
    studentsInside.push({
      indexNumber: student.indexNumber,
      studentName: student.studentName,
      entryTime: lastEntry ? lastEntry.formattedTime : 'Active',
      entryDate: lastEntry ? lastEntry.date : getColomboDateString(),
      transactionId: lastEntry ? lastEntry.id : '',
    });
  }

  studentsInside.sort((a, b) =>
    a.indexNumber.localeCompare(b.indexNumber, undefined, { numeric: true })
  );

  res.json({
    count: studentsInside.length,
    students: studentsInside,
  });
});

// 5. Today's Attendance Summary Endpoint
router.get('/summary/today', (_req: Request, res: Response) => {
  const today = getColomboDateString();
  const dayTransactions = db.transactions.filter(t => t.date === today);

  const uniqueEnteredStudents = new Set<string>();
  let totalEntries = 0;
  let totalExits = 0;

  for (const t of dayTransactions) {
    if (t.type === 'ENTRY') {
      totalEntries++;
      uniqueEnteredStudents.add(t.studentIndexNumber);
    } else if (t.type === 'EXIT') {
      totalExits++;
    }
  }

  const currentOccupancy = Object.values(db.currentStatuses).filter(s => s === 'INSIDE').length;

  const summary: TodayAttendanceSummary = {
    date: today,
    uniqueStudentsEntered: uniqueEnteredStudents.size,
    totalEntries,
    totalExits,
    currentOccupancy,
  };

  res.json(summary);
});

// 6. Registered students list
router.get('/students', (_req: Request, res: Response) => {
  const students = Object.values(db.students).sort((a, b) =>
    a.indexNumber.localeCompare(b.indexNumber, undefined, { numeric: true })
  );
  res.json({
    count: students.length,
    isPreloadedSample: db.meta.isPreloadedSample,
    students,
  });
});

// 7. Quick Search Students
router.get('/students/search', (req: Request, res: Response) => {
  const query = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
  if (!query) {
    res.json({ count: 0, results: [] });
    return;
  }

  const all = Object.values(db.students);
  const matched = all.filter(s =>
    s.indexNumber.toLowerCase().includes(query) ||
    s.studentName.toLowerCase().includes(query)
  );

  const results = matched.slice(0, 15).map(s => ({
    indexNumber: s.indexNumber,
    studentName: s.studentName,
    isActive: s.isActive !== false,
    currentStatus: db.currentStatuses[s.indexNumber] || 'OUTSIDE',
  }));

  res.json({
    count: matched.length,
    results,
  });
});

// 8. Download CSV template
router.get('/students/template', (_req: Request, res: Response) => {
  const csvContent = '\uFEFFindex_number,student_name\r\n211002E,Safak\r\n211003H,Nipun\r\n211004L,Chamikara\r\n22001,Uthsara Manul\r\n22002,Kasun Perera\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Classroom1_Student_Template.csv"');
  res.send(csvContent);
});

// 9. Upload/Import Student CSV (Admin ONLY)
router.post('/students/upload', requireAdmin, (req: Request, res: Response) => {
  try {
    const { csvText, replaceExisting = true } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'Please provide CSV content in the request body.' });
      return;
    }

    const lines = csvText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      res.status(400).json({ error: 'The provided CSV file is empty.' });
      return;
    }

    let startIndex = 0;
    const headerLine = lines[0].toLowerCase();
    if (headerLine.includes('index') || headerLine.includes('student')) {
      startIndex = 1;
    }

    const newStudents: Record<string, Student> = replaceExisting ? {} : { ...db.students };
    let duplicatesFound = 0;
    let validRecords = 0;
    const importedAt = new Date().toISOString();

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

      if (parts.length < 2) continue;

      const rawIndex = parts[0];
      const rawName = parts.slice(1).join(',').trim();

      if (!rawIndex || !rawName) continue;

      const indexNumber = String(rawIndex).trim();
      const studentName = String(rawName).trim();

      if (newStudents[indexNumber]) {
        duplicatesFound++;
      }

      newStudents[indexNumber] = {
        indexNumber,
        studentName,
        importedAt,
        isActive: true,
      };
      validRecords++;
    }

    if (validRecords === 0) {
      res.status(400).json({
        error: 'No valid student records found. Expected format: index_number,student_name',
      });
      return;
    }

    db.students = newStudents;
    db.meta.isPreloadedSample = false;
    saveDatabase(db);

    res.json({
      success: true,
      count: Object.keys(db.students).length,
      importedCount: validRecords,
      duplicatesFound,
      isPreloadedSample: false,
      message: `Successfully imported ${validRecords} students (${duplicatesFound} duplicate index numbers resolved).`,
    });
  } catch (err: any) {
    console.error('Error during student upload:', err);
    res.status(500).json({ error: 'Failed to process student CSV: ' + err.message });
  }
});

// 10. Add Single Student (Admin ONLY)
router.post('/admin/students', requireAdmin, (req: Request, res: Response) => {
  const { indexNumber, studentName } = req.body;
  if (!indexNumber || !studentName) {
    res.status(400).json({ error: 'Index number and student name are required.' });
    return;
  }

  const trimmedIndex = String(indexNumber).trim();
  const trimmedName = String(studentName).trim();

  const duplicate = Object.values(db.students).find(
    s => s.indexNumber.trim().toLowerCase() === trimmedIndex.toLowerCase()
  );

  if (duplicate) {
    res.status(409).json({ error: `Student with index number ${trimmedIndex} already exists.` });
    return;
  }

  const newStudent: Student = {
    indexNumber: trimmedIndex,
    studentName: trimmedName,
    importedAt: new Date().toISOString(),
    isActive: true,
  };

  db.students[trimmedIndex] = newStudent;
  db.meta.isPreloadedSample = false;
  saveDatabase(db);

  res.json({ success: true, student: newStudent, message: 'Student registered successfully.' });
});

// 11. Edit or Deactivate a Student (Admin ONLY)
router.put('/admin/students/:indexNumber', requireAdmin, (req: Request, res: Response) => {
  const query = String(req.params.indexNumber).trim().toLowerCase();
  const student = Object.values(db.students).find(
    s => s.indexNumber.trim().toLowerCase() === query
  );

  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const { studentName, isActive } = req.body;
  if (typeof studentName === 'string' && studentName.trim()) {
    student.studentName = studentName.trim();
  }
  if (typeof isActive === 'boolean') {
    student.isActive = isActive;
  }

  saveDatabase(db);
  res.json({ success: true, student, message: 'Student updated successfully.' });
});

// 12. Lookup student by index number (Case-insensitive)
router.get('/students/:indexNumber', (req: Request, res: Response) => {
  const query = String(req.params.indexNumber).trim().toLowerCase();
  const student = Object.values(db.students).find(
    s => s.indexNumber.trim().toLowerCase() === query
  );

  if (!student) {
    res.status(404).json({ error: 'Student not found. Please check the index number.' });
    return;
  }

  const currentStatus = db.currentStatuses[student.indexNumber] || 'OUTSIDE';
  res.json({
    student,
    currentStatus,
  });
});

// 13. Record Entry or Exit Transaction (Case-insensitive index lookup)
router.post('/transactions', (req: Request, res: Response) => {
  if (isTransactionLocked) {
    res.status(429).json({ error: 'Processing another transaction. Please try again in a moment.' });
    return;
  }

  isTransactionLocked = true;
  try {
    const rawIndex = req.body.indexNumber;
    if (!rawIndex) {
      res.status(400).json({ error: 'Student index number is required.' });
      return;
    }

    const query = String(rawIndex).trim().toLowerCase();
    const student = Object.values(db.students).find(
      s => s.indexNumber.trim().toLowerCase() === query
    );

    if (!student) {
      res.status(404).json({
        error: 'Student not found. Please check the index number.',
        notFoundIndex: String(rawIndex).trim(),
      });
      return;
    }

    if (student.isActive === false) {
      res.status(403).json({
        error: 'Student account is deactivated. Please contact the administrator.',
        notFoundIndex: student.indexNumber,
      });
      return;
    }

    const indexNumber = student.indexNumber;
    const currentStatus = db.currentStatuses[indexNumber] || 'OUTSIDE';
    const now = new Date();
    const colomboDate = getColomboDateString(now);
    const colomboTime = getColomboTimeString(now);
    const greeting = getGreetingForColombo(now);

    let type: 'ENTRY' | 'EXIT';
    let newStatus: StudentStatus;

    if (currentStatus === 'INSIDE') {
      type = 'EXIT';
      newStatus = 'OUTSIDE';
    } else {
      type = 'ENTRY';
      newStatus = 'INSIDE';
    }

    const transaction: TransactionRecord = {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      studentIndexNumber: student.indexNumber,
      studentName: student.studentName,
      venue: 'Classroom 1',
      type,
      date: colomboDate,
      timestamp: now.toISOString(),
      formattedTime: colomboTime,
      greeting,
      statusAfter: newStatus,
    };

    db.transactions.push(transaction);
    db.currentStatuses[indexNumber] = newStatus;
    saveDatabase(db);

    const confirmationMessage =
      type === 'ENTRY' ? 'You have entered Classroom 1.' : 'You are leaving Classroom 1.';

    res.json({
      success: true,
      transaction,
      greeting: `Hi, ${greeting}!`,
      message: confirmationMessage,
      student,
      status: newStatus,
    });
  } catch (err: any) {
    console.error('Transaction failure:', err);
    res.status(500).json({ error: 'Database transaction failed. Please retry.' });
  } finally {
    isTransactionLocked = false;
  }
});

// 14. Recent Transactions
router.get('/transactions/recent', (_req: Request, res: Response) => {
  const recent = [...db.transactions].reverse().slice(0, 20);
  res.json({
    total: db.transactions.length,
    recent,
  });
});

// 15. Transaction Corrections (Admin ONLY)
router.post('/admin/transactions/correct', requireAdmin, (req: Request, res: Response) => {
  const { transactionId, correctedType, reason, adminIdentity } = req.body;
  if (!transactionId || !correctedType || !reason) {
    res.status(400).json({ error: 'transactionId, correctedType, and reason are required.' });
    return;
  }

  const tx = db.transactions.find(t => t.id === transactionId);
  if (!tx) {
    res.status(404).json({ error: 'Transaction record not found.' });
    return;
  }

  const adminName = (req as any).adminUser || adminIdentity || 'Administrator';
  const originalType = tx.type;

  const correction: TransactionCorrection = {
    id: `CORR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    transactionId: tx.id,
    studentIndexNumber: tx.studentIndexNumber,
    studentName: tx.studentName,
    originalType,
    correctedType,
    reason: String(reason).trim(),
    adminIdentity: adminName,
    timestamp: new Date().toISOString(),
    formattedTime: getColomboTimeString(),
    date: getColomboDateString(),
  };

  tx.type = correctedType;
  tx.isCorrected = true;
  tx.correctionId = correction.id;
  tx.correctionReason = correction.reason;
  tx.correctedBy = adminName;
  tx.correctionTimestamp = correction.timestamp;

  if (!db.corrections) db.corrections = [];
  db.corrections.push(correction);

  const studentTxs = db.transactions
    .filter(t => t.studentIndexNumber === tx.studentIndexNumber)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let recalculatedStatus: StudentStatus = 'OUTSIDE';
  for (const stTx of studentTxs) {
    if (stTx.type === 'ENTRY') {
      recalculatedStatus = 'INSIDE';
    } else if (stTx.type === 'EXIT') {
      recalculatedStatus = 'OUTSIDE';
    }
    stTx.statusAfter = recalculatedStatus;
  }

  db.currentStatuses[tx.studentIndexNumber] = recalculatedStatus;
  saveDatabase(db);

  res.json({
    success: true,
    message: `Transaction ${tx.id} corrected from ${originalType} to ${correctedType}.`,
    transaction: tx,
    correction,
    newStatus: recalculatedStatus,
  });
});

router.get('/admin/corrections', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    count: db.corrections ? db.corrections.length : 0,
    corrections: db.corrections || [],
  });
});

function computeDailyReport(dateStr: string): DailyReportData {
  const dayTransactions = db.transactions.filter(t => t.date === dateStr);

  const studentTxMap: Record<string, TransactionRecord[]> = {};
  for (const tx of dayTransactions) {
    if (!studentTxMap[tx.studentIndexNumber]) {
      studentTxMap[tx.studentIndexNumber] = [];
    }
    studentTxMap[tx.studentIndexNumber].push(tx);
  }

  const sessions: AttendanceSession[] = [];
  let totalEntries = 0;
  let totalExits = 0;
  let enteredNotExitedCount = 0;
  const uniqueStudentsEntered = new Set<string>();

  for (const [indexNum, txs] of Object.entries(studentTxMap)) {
    txs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let sessionCounter = 1;
    let currentOpenEntry: TransactionRecord | null = null;
    const studentName = txs[0].studentName;

    for (const tx of txs) {
      if (tx.type === 'ENTRY') {
        totalEntries++;
        uniqueStudentsEntered.add(indexNum);

        if (currentOpenEntry) {
          sessions.push({
            id: `SES-${indexNum}-${sessionCounter++}`,
            sessionNumber: sessionCounter - 1,
            indexNumber: indexNum,
            studentName,
            entryTime: currentOpenEntry.formattedTime,
            exitTime: 'Not recorded',
            status: 'INSIDE',
            date: dateStr,
          });
        }
        currentOpenEntry = tx;
      } else if (tx.type === 'EXIT') {
        totalExits++;
        if (currentOpenEntry) {
          sessions.push({
            id: `SES-${indexNum}-${sessionCounter++}`,
            sessionNumber: sessionCounter - 1,
            indexNumber: indexNum,
            studentName,
            entryTime: currentOpenEntry.formattedTime,
            exitTime: tx.formattedTime,
            status: 'OUTSIDE',
            date: dateStr,
          });
          currentOpenEntry = null;
        } else {
          sessions.push({
            id: `SES-${indexNum}-${sessionCounter++}`,
            sessionNumber: sessionCounter - 1,
            indexNumber: indexNum,
            studentName,
            entryTime: 'Prior Session',
            exitTime: tx.formattedTime,
            status: 'OUTSIDE',
            date: dateStr,
          });
        }
      }
    }

    if (currentOpenEntry) {
      enteredNotExitedCount++;
      sessions.push({
        id: `SES-${indexNum}-${sessionCounter++}`,
        sessionNumber: sessionCounter - 1,
        indexNumber: indexNum,
        studentName,
        entryTime: currentOpenEntry.formattedTime,
        exitTime: 'Not recorded',
        status: 'INSIDE',
        date: dateStr,
      });
    }
  }

  sessions.sort((a, b) => {
    const cmp = a.indexNumber.localeCompare(b.indexNumber, undefined, { numeric: true });
    if (cmp !== 0) return cmp;
    return a.sessionNumber - b.sessionNumber;
  });

  const currentlyInside = Object.values(db.currentStatuses).filter(s => s === 'INSIDE').length;

  return {
    date: dateStr,
    totalUniqueStudents: uniqueStudentsEntered.size,
    totalEntries,
    totalExits,
    currentlyInside,
    enteredNotExited: enteredNotExitedCount,
    sessions,
  };
}

// 16. Daily Report JSON
router.get('/reports/daily', (req: Request, res: Response) => {
  const queryDate = req.query.date ? String(req.query.date).trim() : getColomboDateString();
  const report = computeDailyReport(queryDate);
  res.json(report);
});

// 17. Download Daily Report CSV
router.get('/reports/daily/download', (req: Request, res: Response) => {
  const queryDate = req.query.date ? String(req.query.date).trim() : getColomboDateString();
  const report = computeDailyReport(queryDate);

  let csv = '\uFEFF';
  csv += `"CLASSROOM 1 — DAILY ATTENDANCE REPORT"\r\n`;
  csv += `"Venue:","Classroom 1"\r\n`;
  csv += `"Reporting Date:","${report.date}"\r\n`;
  csv += `"Timezone:","Asia/Colombo (Sri Lanka)"\r\n`;
  csv += `"Report Generated At:","${getColomboDateString()} ${getColomboTimeString()}"\r\n`;
  csv += `\r\n`;
  csv += `"DAILY SUMMARY"\r\n`;
  csv += `"Total Unique Students Entered:","${report.totalUniqueStudents}"\r\n`;
  csv += `"Total Entry Transactions:","${report.totalEntries}"\r\n`;
  csv += `"Total Exit Transactions:","${report.totalExits}"\r\n`;
  csv += `"Students Currently Inside Classroom 1:","${report.currentlyInside}"\r\n`;
  csv += `"Students Entered But Not Yet Exited (on ${report.date}):","${report.enteredNotExited}"\r\n`;
  csv += `\r\n`;
  csv += `"DETAILED ATTENDANCE SESSIONS"\r\n`;
  csv += `"No.","Date","Index Number","Student Name","Entry Time","Exit Time","Attendance Status"\r\n`;

  if (report.sessions.length === 0) {
    csv += `"--","${report.date}","No transactions recorded for this date","--","--","--","--"\r\n`;
  } else {
    report.sessions.forEach((s, idx) => {
      const safeIndex = `="${s.indexNumber}"`;
      const safeName = `"${s.studentName.replace(/"/g, '""')}"`;
      csv += `"${idx + 1}","${s.date}",${safeIndex},${safeName},"${s.entryTime}","${s.exitTime}","${s.status}"\r\n`;
    });
  }

  const filename = `Classroom1_Daily_Report_${report.date}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// 18. Reset Transactions
router.post('/database/reset-transactions', requireAdmin, (_req: Request, res: Response) => {
  db.transactions = [];
  db.currentStatuses = {};
  db.corrections = [];
  saveDatabase(db);
  res.json({ success: true, message: 'All transaction records have been reset.' });
});

// Mount router on BOTH '/api' AND '/' so requests work whether Vercel passes /api/status or /status
app.use('/api', router);
app.use('/', router);

export default app;
