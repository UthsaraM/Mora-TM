export type StudentStatus = 'INSIDE' | 'OUTSIDE';
export type TransactionType = 'ENTRY' | 'EXIT';

export interface Student {
  indexNumber: string;
  studentName: string;
  importedAt?: string;
  isActive?: boolean; // false if deactivated by admin
}

export interface TransactionRecord {
  id: string;
  studentIndexNumber: string;
  studentName: string;
  venue: 'Classroom 1';
  type: TransactionType;
  date: string; // YYYY-MM-DD in Asia/Colombo
  timestamp: string; // ISO 8601 string
  formattedTime: string; // e.g., "08:15 AM"
  greeting: string; // "Good Morning" | "Good Afternoon" | "Good Evening"
  statusAfter: StudentStatus;
  isCorrected?: boolean;
  correctionId?: string;
  correctionReason?: string;
  correctedBy?: string;
  correctionTimestamp?: string;
}

export interface TransactionCorrection {
  id: string;
  transactionId: string;
  studentIndexNumber: string;
  studentName: string;
  originalType: TransactionType;
  correctedType: TransactionType;
  reason: string;
  adminIdentity: string;
  timestamp: string;
  formattedTime: string;
  date: string;
}

export interface AttendanceSession {
  id: string;
  sessionNumber: number;
  indexNumber: string;
  studentName: string;
  entryTime: string;
  exitTime: string; // "Not recorded" if not yet exited
  status: StudentStatus;
  date: string;
}

export interface DailyReportData {
  date: string; // YYYY-MM-DD
  totalUniqueStudents: number;
  totalEntries: number;
  totalExits: number;
  currentlyInside: number;
  enteredNotExited: number;
  sessions: AttendanceSession[];
}

export interface OccupancyStudent {
  indexNumber: string;
  studentName: string;
  entryTime: string;
  entryDate: string;
  transactionId: string;
}

export interface TodayAttendanceSummary {
  date: string;
  uniqueStudentsEntered: number;
  totalEntries: number;
  totalExits: number;
  currentOccupancy: number;
}

export interface TransactionResponse {
  success: boolean;
  transaction: TransactionRecord;
  greeting: string;
  message: string;
  student: Student;
  status: StudentStatus;
}

export interface ServerStatus {
  online: boolean;
  venue: string;
  totalStudents: number;
  totalTransactions: number;
  studentsCurrentlyInside: number;
  isPreloadedSample: boolean;
  currentTimeColombo: string;
  currentDateColombo: string;
  storageType: string;
}

export type AppMode = 'LANDING' | 'USER' | 'ADMIN';
