import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
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
  VerifiedAdmin,
  SystemSettings,
  StudentAttendanceHistory,
} from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Production Domain & Authentication Constants for Mora TM Entry System
const PRODUCTION_APP_URL = 'https://mora-tm-entrysys.vercel.app';
const PRODUCTION_DOMAIN = 'mora-tm-entrysys.vercel.app';

// CORS Middleware with support for https://mora-tm-entrysys.vercel.app
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin as string | undefined;
  const allowedOrigins = [
    'https://mora-tm-entrysys.vercel.app',
    'https://mora-tm-entrysys.vercel.app/',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.run.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Ensure persistent data directory exists
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp' : path.resolve(__dirname, 'data');
const DB_FILE = isVercel ? path.resolve('/tmp', 'classroom_db.json') : path.resolve(DATA_DIR, 'classroom_db.json');
const BUNDLED_DB_FILE = path.resolve(__dirname, 'data', 'classroom_db.json');

if (!isVercel && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
  verifiedAdmins?: VerifiedAdmin[];
  settings?: SystemSettings;
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

function createDefaultVerifiedAdmins(): VerifiedAdmin[] {
  return [
    {
      id: 'adm_uthzaaawim',
      name: 'Uthsara Manul',
      email: 'uthzaaawim@gmail.com',
      staffId: 'ADM-001',
      role: 'Super Administrator',
      isVerified: true,
      status: 'ACTIVE',
      addedAt: new Date().toISOString(),
    },
    {
      id: 'adm_perera',
      name: 'Dr. A. Perera',
      email: 'perera.tm@mora.ac.lk',
      staffId: 'FAC-101',
      role: 'Department Coordinator',
      isVerified: true,
      status: 'ACTIVE',
      addedAt: new Date().toISOString(),
    },
    {
      id: 'adm_proctor',
      name: 'Classroom 1 Proctor',
      email: 'proctor.cr1@mora.ac.lk',
      staffId: 'PRC-201',
      role: 'Academic Proctor',
      isVerified: true,
      status: 'ACTIVE',
      addedAt: new Date().toISOString(),
    },
  ];
}

// Helper to hash password
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function createDefaultAdminAuth(): AdminAuthData {
  const salt = crypto.randomBytes(16).toString('hex');
  // Default password: admin123
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
      console.error('Failed to copy bundled seed database to /tmp on Vercel:', e);
    }
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.students) data.students = {};
      if (!Array.isArray(data.transactions)) data.transactions = [];
      if (!data.currentStatuses) data.currentStatuses = {};
      if (!Array.isArray(data.corrections)) data.corrections = [];
      if (!data.admin) {
        data.admin = createDefaultAdminAuth();
      }
      if (!Array.isArray(data.verifiedAdmins) || data.verifiedAdmins.length === 0) {
        data.verifiedAdmins = createDefaultVerifiedAdmins();
      }
      if (!data.settings) {
        data.settings = {
          allowUserAttendanceLookup: true,
          hidePublicScanStreamOnKiosk: true,
        };
      }
      if (!data.meta) {
        data.meta = {
          initializedAt: new Date().toISOString(),
          isPreloadedSample: false,
          lastUpdated: new Date().toISOString(),
        };
      }
      return data;
    } catch (err) {
      console.error('Failed to parse database file, reinitializing fallback:', err);
    }
  }

  // If local DB_FILE does not exist, check if BUNDLED_DB_FILE exists
  if (fs.existsSync(BUNDLED_DB_FILE)) {
    try {
      const raw = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.verifiedAdmins) || data.verifiedAdmins.length === 0) {
        data.verifiedAdmins = createDefaultVerifiedAdmins();
      }
      if (!data.settings) {
        data.settings = {
          allowUserAttendanceLookup: true,
          hidePublicScanStreamOnKiosk: true,
        };
      }
      return data;
    } catch (err) {
      console.error('Failed to read bundled database:', err);
    }
  }

  // Initialize with realistic sample students
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
    verifiedAdmins: createDefaultVerifiedAdmins(),
    settings: {
      allowUserAttendanceLookup: true,
      hidePublicScanStreamOnKiosk: true,
    },
    meta: {
      initializedAt: new Date().toISOString(),
      isPreloadedSample: true,
      lastUpdated: new Date().toISOString(),
    },
  };

  saveDatabase(initialDb);
  return initialDb;
}

// Atomic file write with safe fallback
function saveDatabase(data: DatabaseSchema): void {
  data.meta.lastUpdated = new Date().toISOString();
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    // Direct write fallback
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write database file:', e);
    }
  }
}

// In-memory cache + file sync
let db: DatabaseSchema = loadDatabase();

// In-memory active admin sessions
const activeAdminSessions = new Map<string, {
  adminName: string;
  adminEmail?: string;
  adminStaffId?: string;
  adminRole?: string;
  expiresAt: number;
}>();

// In-memory active user / operator sessions for https://mora-tm-entrysys.vercel.app
const activeUserSessions = new Map<string, { userName: string; role: 'OPERATOR' | 'STUDENT_USER'; domain: string; expiresAt: number }>();


// Time helpers for Asia/Colombo
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

// Simple mutex lock to prevent concurrent race conditions on transactions
let isTransactionLocked = false;

// ==========================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ==========================================
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

  // Extend session on activity (sliding window: 4 hours)
  session.expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  (req as any).adminUser = session.adminName;
  (req as any).adminEmail = session.adminEmail;
  (req as any).adminStaffId = session.adminStaffId;
  (req as any).adminRole = session.adminRole;
  next();
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Health & Server Status (includes Mora TM Vercel auth domain metadata)
app.get('/api/status', (_req: Request, res: Response) => {
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
    storageType: 'Server Persistent Storage (data/classroom_db.json)',
    authorizedDomain: PRODUCTION_DOMAIN,
    appUrl: PRODUCTION_APP_URL,
    authEnabled: true,
  });
});

// 1.1 Auth Configuration & Origin Verification Endpoint
app.get('/api/auth/config', (_req: Request, res: Response) => {
  res.json({
    appUrl: PRODUCTION_APP_URL,
    authorizedDomain: PRODUCTION_DOMAIN,
    allowedOrigins: [
      PRODUCTION_APP_URL,
      `${PRODUCTION_APP_URL}/`,
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    systemName: 'Classroom 1 – Student Entry & Exit System (Mora TM)',
    corsEnabled: true,
    authMethods: {
      userMode: 'convenience_and_verified',
      adminMode: 'password_protected',
    },
  });
});

// 1.2 User / Operator Authentication Endpoints (Mora TM Portal)
app.post('/api/user/login', (req: Request, res: Response) => {
  const { userName, role } = req.body || {};
  const name = (typeof userName === 'string' && userName.trim()) || 'Classroom Operator';
  const userRole = role === 'STUDENT_USER' ? 'STUDENT_USER' : 'OPERATOR';
  const token = `usr_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hours valid

  activeUserSessions.set(token, {
    userName: name,
    role: userRole,
    domain: PRODUCTION_DOMAIN,
    expiresAt,
  });

  res.json({
    success: true,
    token,
    userName: name,
    role: userRole,
    domain: PRODUCTION_DOMAIN,
    appUrl: PRODUCTION_APP_URL,
    expiresAt,
    message: `User session authenticated for ${PRODUCTION_DOMAIN}`,
  });
});

app.get('/api/user/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.json({ authenticated: false });
    return;
  }
  const token = authHeader.substring(7).trim();
  const session = activeUserSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) activeUserSessions.delete(token);
    res.json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    userName: session.userName,
    role: session.role,
    domain: session.domain,
    appUrl: PRODUCTION_APP_URL,
  });
});

app.post('/api/user/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    activeUserSessions.delete(token);
  }
  res.json({ success: true, message: 'User session logged out successfully.' });
});


// 2. Admin Authentication Endpoints
// 2. Admin Authentication Endpoints
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password, adminId, email, adminName } = req.body;
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

  if (!Array.isArray(db.verifiedAdmins) || db.verifiedAdmins.length === 0) {
    db.verifiedAdmins = createDefaultVerifiedAdmins();
    saveDatabase(db);
  }

  // Find matching verified administrator
  let matchedAdmin: VerifiedAdmin | undefined;

  if (adminId && typeof adminId === 'string' && adminId.trim()) {
    matchedAdmin = db.verifiedAdmins.find(a => a.id === adminId.trim());
  } else if (email && typeof email === 'string' && email.trim()) {
    const q = email.trim().toLowerCase();
    matchedAdmin = db.verifiedAdmins.find(
      a => a.email.toLowerCase() === q || a.staffId.toLowerCase() === q
    );
  } else if (adminName && typeof adminName === 'string' && adminName.trim()) {
    const q = adminName.trim().toLowerCase();
    matchedAdmin = db.verifiedAdmins.find(
      a =>
        a.name.toLowerCase() === q ||
        a.email.toLowerCase() === q ||
        a.staffId.toLowerCase() === q
    );
  }

  // If no match found or not provided, reject access
  if (!matchedAdmin) {
    res.status(403).json({
      error: 'Access denied: You must be a registered, verified administrator for Classroom 1.',
    });
    return;
  }

  if (!matchedAdmin.isVerified || matchedAdmin.status !== 'ACTIVE') {
    res.status(403).json({
      error: `Access denied: Account for ${matchedAdmin.name} (${matchedAdmin.staffId}) is not verified or currently suspended.`,
    });
    return;
  }

  // Update last login
  matchedAdmin.lastLoginAt = new Date().toISOString();
  saveDatabase(db);

  // Generate session token valid for 4 hours
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  activeAdminSessions.set(token, {
    adminName: matchedAdmin.name,
    adminEmail: matchedAdmin.email,
    adminStaffId: matchedAdmin.staffId,
    adminRole: matchedAdmin.role,
    expiresAt,
  });

  res.json({
    success: true,
    token,
    adminName: matchedAdmin.name,
    adminEmail: matchedAdmin.email,
    adminRole: matchedAdmin.role,
    adminStaffId: matchedAdmin.staffId,
    expiresAt,
    message: `Administrator authentication successful for verified personnel: ${matchedAdmin.name}.`,
  });
});

// 2.05 Google Sign-In Authentication for Administrators
app.post('/api/admin/google-login', (req: Request, res: Response) => {
  const { email, displayName, uid } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Google email is required for administrator login.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!Array.isArray(db.verifiedAdmins) || db.verifiedAdmins.length === 0) {
    db.verifiedAdmins = createDefaultVerifiedAdmins();
    saveDatabase(db);
  }

  // Check if it's the root Super Administrator uthzaaawim@gmail.com
  let admin = db.verifiedAdmins.find(a => a.email.toLowerCase() === cleanEmail);

  if (!admin && cleanEmail === 'uthzaaawim@gmail.com') {
    admin = {
      id: 'adm_uthzaaawim',
      name: displayName || 'Uthsara Manul',
      email: 'uthzaaawim@gmail.com',
      staffId: 'ADM-001',
      role: 'Super Administrator',
      isVerified: true,
      status: 'ACTIVE',
      addedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    db.verifiedAdmins.unshift(admin);
    saveDatabase(db);
  }

  if (!admin) {
    res.status(403).json({
      error: `Access denied: Google account (${cleanEmail}) is not on the verified administrator whitelist. Only administrators approved by Super Administrator (uthzaaawim@gmail.com) can access Admin Mode.`,
    });
    return;
  }

  if (!admin.isVerified || admin.status !== 'ACTIVE') {
    res.status(403).json({
      error: `Access denied: Account for ${admin.name} is not verified or currently suspended.`,
    });
    return;
  }

  admin.lastLoginAt = new Date().toISOString();
  saveDatabase(db);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  activeAdminSessions.set(token, {
    adminName: admin.name,
    adminEmail: admin.email,
    adminStaffId: admin.staffId,
    adminRole: admin.role,
    expiresAt,
  });

  res.json({
    success: true,
    token,
    adminName: admin.name,
    adminEmail: admin.email,
    adminRole: admin.role,
    adminStaffId: admin.staffId,
    isSuperAdmin: cleanEmail === 'uthzaaawim@gmail.com',
    expiresAt,
    message: `Administrator authentication successful for verified personnel: ${admin.name}.`,
  });
});

// 2.1 Get Verified Administrators list
app.get('/api/admin/verified-people', (req: Request, res: Response) => {
  if (!Array.isArray(db.verifiedAdmins) || db.verifiedAdmins.length === 0) {
    db.verifiedAdmins = createDefaultVerifiedAdmins();
    saveDatabase(db);
  }

  const authHeader = req.headers.authorization;
  const isAuthorized = authHeader && authHeader.startsWith('Bearer ') && activeAdminSessions.has(authHeader.substring(7).trim());

  if (isAuthorized) {
    res.json({
      count: db.verifiedAdmins.length,
      admins: db.verifiedAdmins,
    });
  } else {
    // Public/safe list for administrator login modal selector
    const safeList = db.verifiedAdmins
      .filter(a => a.status === 'ACTIVE' && a.isVerified)
      .map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        staffId: a.staffId,
        role: a.role,
        isVerified: a.isVerified,
      }));
    res.json({
      count: safeList.length,
      admins: safeList,
    });
  }
});

// 2.2 Add a new Verified Administrator (Super Admin ONLY: uthzaaawim@gmail.com)
app.post('/api/admin/verified-people', requireAdmin, (req: Request, res: Response) => {
  const requesterEmail = ((req as any).adminEmail || '').toLowerCase();
  if (requesterEmail !== 'uthzaaawim@gmail.com') {
    res.status(403).json({
      error: 'Access denied: Only Super Administrator (uthzaaawim@gmail.com) has authority to approve and verify new administrators.',
    });
    return;
  }

  const { name, email, staffId, role } = req.body;
  if (!name || !email || !staffId) {
    res.status(400).json({ error: 'Name, university email, and staff ID are required.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanStaffId = String(staffId).trim().toUpperCase();
  const cleanName = String(name).trim();
  const cleanRole = (role && String(role).trim()) || 'Administrator';

  if (!Array.isArray(db.verifiedAdmins)) {
    db.verifiedAdmins = createDefaultVerifiedAdmins();
  }

  const existing = db.verifiedAdmins.find(
    a => a.email.toLowerCase() === cleanEmail || a.staffId.toUpperCase() === cleanStaffId
  );

  if (existing) {
    res.status(409).json({ error: `An administrator with email ${cleanEmail} or Staff ID ${cleanStaffId} already exists.` });
    return;
  }

  const newAdmin: VerifiedAdmin = {
    id: `adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    staffId: cleanStaffId,
    role: cleanRole,
    isVerified: true,
    status: 'ACTIVE',
    addedAt: new Date().toISOString(),
  };

  db.verifiedAdmins.push(newAdmin);
  saveDatabase(db);

  res.json({
    success: true,
    message: `Verified administrator ${newAdmin.name} added successfully.`,
    admin: newAdmin,
  });
});

// 2.3 Update Verified Administrator (Admin ONLY)
app.put('/api/admin/verified-people/:id', requireAdmin, (req: Request, res: Response) => {
  const adminId = String(req.params.id).trim();
  if (!Array.isArray(db.verifiedAdmins)) {
    db.verifiedAdmins = createDefaultVerifiedAdmins();
  }

  const admin = db.verifiedAdmins.find(a => a.id === adminId);
  if (!admin) {
    res.status(404).json({ error: 'Verified administrator not found.' });
    return;
  }

  const { name, email, staffId, role, status, isVerified } = req.body;

  if (typeof name === 'string' && name.trim()) admin.name = name.trim();
  if (typeof email === 'string' && email.trim()) admin.email = email.trim().toLowerCase();
  if (typeof staffId === 'string' && staffId.trim()) admin.staffId = staffId.trim().toUpperCase();
  if (typeof role === 'string' && role.trim()) admin.role = role.trim();
  if (status === 'ACTIVE' || status === 'SUSPENDED') admin.status = status;
  if (typeof isVerified === 'boolean') admin.isVerified = isVerified;

  saveDatabase(db);

  res.json({
    success: true,
    message: `Administrator ${admin.name} updated successfully.`,
    admin,
  });
});

// 2.4 Delete Verified Administrator (Super Admin ONLY: uthzaaawim@gmail.com)
app.delete('/api/admin/verified-people/:id', requireAdmin, (req: Request, res: Response) => {
  const requesterEmail = ((req as any).adminEmail || '').toLowerCase();
  if (requesterEmail !== 'uthzaaawim@gmail.com') {
    res.status(403).json({
      error: 'Access denied: Only Super Administrator (uthzaaawim@gmail.com) has authority to remove administrator accounts.',
    });
    return;
  }

  const adminId = String(req.params.id).trim();
  if (!Array.isArray(db.verifiedAdmins)) {
    db.verifiedAdmins = createDefaultVerifiedAdmins();
  }

  const activeAdmins = db.verifiedAdmins.filter(a => a.status === 'ACTIVE' && a.isVerified);
  if (activeAdmins.length <= 1 && activeAdmins[0].id === adminId) {
    res.status(400).json({ error: 'Cannot remove the only remaining active administrator.' });
    return;
  }

  const index = db.verifiedAdmins.findIndex(a => a.id === adminId);
  if (index === -1) {
    res.status(404).json({ error: 'Verified administrator not found.' });
    return;
  }

  const removed = db.verifiedAdmins.splice(index, 1)[0];
  saveDatabase(db);

  res.json({
    success: true,
    message: `Administrator ${removed.name} removed from verified people.`,
  });
});

// 2.5 System Settings & Access Control Configuration
app.get('/api/settings', (_req: Request, res: Response) => {
  if (!db.settings) {
    db.settings = {
      allowUserAttendanceLookup: true,
      hidePublicScanStreamOnKiosk: true,
    };
    saveDatabase(db);
  }
  res.json(db.settings);
});

app.put('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
  if (!db.settings) {
    db.settings = {
      allowUserAttendanceLookup: true,
      hidePublicScanStreamOnKiosk: true,
    };
  }

  const { allowUserAttendanceLookup, hidePublicScanStreamOnKiosk } = req.body;
  if (typeof allowUserAttendanceLookup === 'boolean') {
    db.settings.allowUserAttendanceLookup = allowUserAttendanceLookup;
  }
  if (typeof hidePublicScanStreamOnKiosk === 'boolean') {
    db.settings.hidePublicScanStreamOnKiosk = hidePublicScanStreamOnKiosk;
  }

  saveDatabase(db);
  res.json({
    success: true,
    message: 'System settings updated successfully.',
    settings: db.settings,
  });
});

app.get('/api/admin/verify', requireAdmin, (req: Request, res: Response) => {
  res.json({
    valid: true,
    adminName: (req as any).adminUser,
  });
});

app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    activeAdminSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.post('/api/admin/change-password', requireAdmin, (req: Request, res: Response) => {
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

// 3. Current Occupancy Endpoint (Public for both User and Admin)
app.get('/api/occupancy', (_req: Request, res: Response) => {
  const insideIndices = Object.keys(db.currentStatuses).filter(
    idx => db.currentStatuses[idx] === 'INSIDE'
  );

  const studentsInside: OccupancyStudent[] = [];

  for (const idx of insideIndices) {
    const student = db.students[idx];
    if (!student) continue;

    // Find the latest ENTRY transaction for this student
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

  // Sort by index number numeric
  studentsInside.sort((a, b) =>
    a.indexNumber.localeCompare(b.indexNumber, undefined, { numeric: true })
  );

  res.json({
    count: studentsInside.length,
    students: studentsInside,
  });
});

// 4. Today's Attendance Summary Endpoint (Public for both User and Admin)
app.get('/api/summary/today', (_req: Request, res: Response) => {
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

// 5. Get registered students (Public read-only)
app.get('/api/students', (_req: Request, res: Response) => {
  const students = Object.values(db.students).sort((a, b) =>
    a.indexNumber.localeCompare(b.indexNumber, undefined, { numeric: true })
  );
  res.json({
    count: students.length,
    isPreloadedSample: db.meta.isPreloadedSample,
    students,
  });
});

// 6. Download CSV template (Public)
app.get('/api/students/template', (_req: Request, res: Response) => {
  const csvContent = '\uFEFFindex_number,student_name\r\n22001,Uthsara Manul\r\n22002,Kasun Perera\r\n22003,Nimali Fernando\r\n22004,Dinithi Jayasinghe\r\n22005,Sandun Wickramasinghe\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Classroom1_Student_Template.csv"');
  res.send(csvContent);
});

// 7. Protected: Upload/Import Student CSV (Admin ONLY)
app.post('/api/students/upload', requireAdmin, (req: Request, res: Response) => {
  try {
    const { csvText, replaceExisting = true } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'Please provide CSV content in the request body.' });
      return;
    }

    const lines = csvText
      .replace(/^\uFEFF/, '') // remove BOM if present
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      res.status(400).json({ error: 'The provided CSV file is empty.' });
      return;
    }

    // Check header
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

// 8. Protected: Add a Single Student (Admin ONLY)
app.post('/api/admin/students', requireAdmin, (req: Request, res: Response) => {
  const { indexNumber, studentName } = req.body;
  if (!indexNumber || !studentName) {
    res.status(400).json({ error: 'Index number and student name are required.' });
    return;
  }

  const trimmedIndex = String(indexNumber).trim();
  const trimmedName = String(studentName).trim();

  if (db.students[trimmedIndex]) {
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

// 9. Protected: Edit or Deactivate a Student (Admin ONLY)
app.put('/api/admin/students/:indexNumber', requireAdmin, (req: Request, res: Response) => {
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

// 9b. Quick Search Students (Case-insensitive by Index Number or Student Name)
app.get('/api/students/search', (req: Request, res: Response) => {
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

  // Limit to top 15 results for fast UI
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

// 10. Lookup student by index number (Case-insensitive, Public)
app.get('/api/students/:indexNumber', (req: Request, res: Response) => {
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

// 10b. Check if Google account is linked to a student
app.post('/api/student/google-check', (req: Request, res: Response) => {
  const { email, uid } = req.body;
  if (!email && !uid) {
    res.status(400).json({ error: 'Email or UID is required.' });
    return;
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanUid = uid ? String(uid).trim() : '';

  const student = Object.values(db.students).find(
    s => (cleanEmail && s.googleEmail?.toLowerCase() === cleanEmail) ||
         (cleanUid && s.googleUid === cleanUid)
  );

  if (student) {
    const currentStatus = db.currentStatuses[student.indexNumber] || 'OUTSIDE';
    res.json({
      isLinked: true,
      student,
      currentStatus,
    });
  } else {
    res.json({
      isLinked: false,
      message: 'Google account not yet linked to an index number.',
    });
  }
});

// 10c. Link student index number to Google account on first login
app.post('/api/students/link-google', (req: Request, res: Response) => {
  const { indexNumber, googleEmail, googleUid } = req.body;
  if (!indexNumber || !googleEmail || !googleUid) {
    res.status(400).json({ error: 'Index number, Google email, and Google UID are required.' });
    return;
  }

  const query = String(indexNumber).trim();
  const student = Object.values(db.students).find(
    s => s.indexNumber.trim().toLowerCase() === query.toLowerCase()
  );

  if (!student) {
    res.status(404).json({
      error: `Student with index number "${query}" not found in University roster.`,
    });
    return;
  }

  if (student.isActive === false) {
    res.status(403).json({
      error: 'Student account is deactivated. Please contact the administrator.',
    });
    return;
  }

  const cleanEmail = String(googleEmail).trim().toLowerCase();
  const cleanUid = String(googleUid).trim();

  // Check if this Google account is already linked to a DIFFERENT student
  const otherStudent = Object.values(db.students).find(
    s => ((s.googleEmail?.toLowerCase() === cleanEmail) || (s.googleUid === cleanUid)) &&
         s.indexNumber.toLowerCase() !== student.indexNumber.toLowerCase()
  );

  if (otherStudent) {
    res.status(409).json({
      error: `This Google account is already linked to student ${otherStudent.studentName} (${otherStudent.indexNumber}).`,
    });
    return;
  }

  student.googleEmail = cleanEmail;
  student.googleUid = cleanUid;
  student.linkedAt = new Date().toISOString();
  saveDatabase(db);

  const currentStatus = db.currentStatuses[student.indexNumber] || 'OUTSIDE';
  res.json({
    success: true,
    student,
    currentStatus,
    message: `Index ${student.indexNumber} successfully linked to Google account (${cleanEmail}).`,
  });
});

// 11. Record Entry or Exit Transaction (Case-insensitive index lookup, User & Admin)
app.post('/api/transactions', (req: Request, res: Response) => {
  if (isTransactionLocked) {
    res.status(429).json({ error: 'Processing another transaction. Please try again in a moment.' });
    return;
  }

  isTransactionLocked = true;
  try {
    const rawIndex = req.body.indexNumber;
    const googleEmail = req.body.googleEmail ? String(req.body.googleEmail).trim() : '';
    const googleUid = req.body.googleUid ? String(req.body.googleUid).trim() : '';

    if (!rawIndex) {
      res.status(400).json({ error: 'Student index number is required.' });
      return;
    }

    if (!googleEmail) {
      res.status(401).json({
        error: 'Google Sign-In is required to record entry and exit transactions. Please sign in with your Google account.',
      });
      return;
    }

    const query = String(rawIndex).trim();
    // Case-insensitive student lookup
    const student = Object.values(db.students).find(
      s => s.indexNumber.trim().toLowerCase() === query.toLowerCase()
    );

    if (!student) {
      res.status(404).json({
        error: 'Student not found in roster. Please check the index number.',
        notFoundIndex: query,
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

    // Bind Google account to student if not yet bound
    if (!student.googleEmail && googleEmail) {
      student.googleEmail = googleEmail.toLowerCase();
      student.googleUid = googleUid;
      student.linkedAt = new Date().toISOString();
    }

    // Always use canonical registered indexNumber
    const indexNumber = student.indexNumber;
    const currentStatus = db.currentStatuses[indexNumber] || 'OUTSIDE';
    const now = new Date();
    const colomboDate = getColomboDateString(now);
    const colomboTime = getColomboTimeString(now);
    const greeting = getGreetingForColombo(now);

    let type: 'ENTRY' | 'EXIT';
    let newStatus: StudentStatus;

    if (req.body.type === 'ENTRY' || req.body.type === 'EXIT') {
      type = req.body.type;
      newStatus = type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE';
    } else if (currentStatus === 'INSIDE') {
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
      googleEmail,
      googleUid,
    };

    // Save to historical transactions (never overwritten)
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

// 12. Recent Transactions (live feed)
app.get('/api/transactions/recent', (_req: Request, res: Response) => {
  const recent = [...db.transactions].reverse().slice(0, 20);
  res.json({
    total: db.transactions.length,
    recent,
  });
});

// 13. Protected: Transaction Corrections (Admin ONLY)
app.post('/api/admin/transactions/correct', requireAdmin, (req: Request, res: Response) => {
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

  // Update original transaction with correction audit fields
  tx.type = correctedType;
  tx.isCorrected = true;
  tx.correctionId = correction.id;
  tx.correctionReason = correction.reason;
  tx.correctedBy = adminName;
  tx.correctionTimestamp = correction.timestamp;

  if (!db.corrections) db.corrections = [];
  db.corrections.push(correction);

  // Recalculate student's current status based on full chronological transactions
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

// 14. Protected: View Transaction Corrections Log (Admin ONLY)
app.get('/api/admin/corrections', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    count: db.corrections ? db.corrections.length : 0,
    corrections: db.corrections || [],
  });
});

// Helper to compute daily report sessions & summaries
function computeDailyReport(dateStr: string): DailyReportData {
  const dayTransactions = db.transactions.filter(t => t.date === dateStr);

  // Group by student index
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

  // Process sessions for each student who had transactions today
  for (const [indexNum, txs] of Object.entries(studentTxMap)) {
    txs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let sessionCounter = 1;
    let currentOpenEntry: TransactionRecord | null = null;
    const studentName = txs[0].studentName;

    const studentObj = Object.values(db.students).find(s => s.indexNumber.trim().toLowerCase() === indexNum.trim().toLowerCase());
    const boundGoogleEmail = studentObj?.googleEmail || '';

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
            googleEmail: currentOpenEntry.googleEmail || boundGoogleEmail,
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
            googleEmail: currentOpenEntry.googleEmail || tx.googleEmail || boundGoogleEmail,
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
            googleEmail: tx.googleEmail || boundGoogleEmail,
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
        googleEmail: currentOpenEntry.googleEmail || boundGoogleEmail,
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

// Helper to compute personal attendance history for a single student
function computeStudentAttendance(indexNumber: string): StudentAttendanceHistory | null {
  const query = String(indexNumber).trim().toLowerCase();
  const student = Object.values(db.students).find(
    s => s.indexNumber.trim().toLowerCase() === query
  );
  if (!student) return null;

  const studentTxs = db.transactions
    .filter(t => t.studentIndexNumber.trim().toLowerCase() === query)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const sessions: AttendanceSession[] = [];
  let currentOpenEntry: TransactionRecord | null = null;
  let sessionCounter = 1;
  let totalMinutes = 0;

  for (const tx of studentTxs) {
    if (tx.type === 'ENTRY') {
      if (currentOpenEntry) {
        sessions.push({
          id: `SES-${student.indexNumber}-${sessionCounter++}`,
          sessionNumber: sessionCounter - 1,
          indexNumber: student.indexNumber,
          studentName: student.studentName,
          entryTime: currentOpenEntry.formattedTime,
          exitTime: 'Not recorded',
          status: 'INSIDE',
          date: currentOpenEntry.date,
        });
      }
      currentOpenEntry = tx;
    } else if (tx.type === 'EXIT') {
      if (currentOpenEntry) {
        const entryMs = new Date(currentOpenEntry.timestamp).getTime();
        const exitMs = new Date(tx.timestamp).getTime();
        const diffMins = Math.max(0, Math.round((exitMs - entryMs) / 60000));
        totalMinutes += diffMins;

        sessions.push({
          id: `SES-${student.indexNumber}-${sessionCounter++}`,
          sessionNumber: sessionCounter - 1,
          indexNumber: student.indexNumber,
          studentName: student.studentName,
          entryTime: currentOpenEntry.formattedTime,
          exitTime: tx.formattedTime,
          status: 'OUTSIDE',
          date: currentOpenEntry.date,
        });
        currentOpenEntry = null;
      } else {
        sessions.push({
          id: `SES-${student.indexNumber}-${sessionCounter++}`,
          sessionNumber: sessionCounter - 1,
          indexNumber: student.indexNumber,
          studentName: student.studentName,
          entryTime: 'Prior Session',
          exitTime: tx.formattedTime,
          status: 'OUTSIDE',
          date: tx.date,
        });
      }
    }
  }

  if (currentOpenEntry) {
    sessions.push({
      id: `SES-${student.indexNumber}-${sessionCounter++}`,
      sessionNumber: sessionCounter - 1,
      indexNumber: student.indexNumber,
      studentName: student.studentName,
      entryTime: currentOpenEntry.formattedTime,
      exitTime: 'Not recorded (Currently Inside)',
      status: 'INSIDE',
      date: currentOpenEntry.date,
    });
  }

  sessions.reverse();

  return {
    student,
    currentStatus: db.currentStatuses[student.indexNumber] || 'OUTSIDE',
    totalSessions: sessions.length,
    totalMinutesInClass: totalMinutes,
    sessions,
  };
}

// 14b. Student Attendance History Lookup
app.get('/api/attendance/student/:indexNumber', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const isAdmin = Boolean(
    authHeader &&
    authHeader.startsWith('Bearer ') &&
    activeAdminSessions.has(authHeader.substring(7).trim())
  );

  // Check access policy if not admin
  if (!isAdmin && db.settings && db.settings.allowUserAttendanceLookup === false) {
    res.status(403).json({
      error: 'Student attendance history lookup is restricted by the administrator.',
      isRestricted: true,
    });
    return;
  }

  const rawIndex = req.params.indexNumber;
  if (!rawIndex) {
    res.status(400).json({ error: 'Student index number is required.' });
    return;
  }

  const history = computeStudentAttendance(rawIndex);
  if (!history) {
    res.status(404).json({ error: 'Student not found. Please verify the index number.' });
    return;
  }

  res.json({
    success: true,
    history,
  });
});

// 15. Daily Report JSON (Public)
app.get('/api/reports/daily', (req: Request, res: Response) => {
  const queryDate = req.query.date ? String(req.query.date).trim() : getColomboDateString();
  const report = computeDailyReport(queryDate);
  res.json(report);
});

// 16. Download Daily Report CSV (Public & Admin)
app.get('/api/reports/daily/download', (req: Request, res: Response) => {
  const queryDate = req.query.date ? String(req.query.date).trim() : getColomboDateString();
  const report = computeDailyReport(queryDate);

  let csv = '\uFEFF'; // Excel UTF-8 BOM
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
  csv += `"No.","Date","Index Number","Student Name","Google Account Email","Entry Time","Exit Time","Attendance Status"\r\n`;

  if (report.sessions.length === 0) {
    csv += `"--","${report.date}","No transactions recorded for this date","--","--","--","--","--"\r\n`;
  } else {
    report.sessions.forEach((s, idx) => {
      const safeIndex = `="${s.indexNumber}"`;
      const safeName = `"${s.studentName.replace(/"/g, '""')}"`;
      const safeEmail = `"${(s.googleEmail || '').replace(/"/g, '""')}"`;
      csv += `"${idx + 1}","${s.date}",${safeIndex},${safeName},${safeEmail},"${s.entryTime}","${s.exitTime}","${s.status}"\r\n`;
    });
  }

  const filename = `Classroom1_Daily_Report_${report.date}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// 17. Protected: Clear/Reset Transactions (Admin ONLY)
app.post('/api/database/reset-transactions', requireAdmin, (_req: Request, res: Response) => {
  db.transactions = [];
  db.currentStatuses = {};
  db.corrections = [];
  saveDatabase(db);
  res.json({ success: true, message: 'All transaction records have been reset.' });
});

// Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Classroom 1 server running on http://0.0.0.0:${PORT} [Timezone: ${COLOMBO_TIMEZONE}]`);
  });
}

export default app;

if (!isVercel) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
