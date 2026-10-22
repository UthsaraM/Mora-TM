import { DailyReportData, AttendanceSession, TransactionRecord } from '../types';

/**
 * Computes a standard DailyReportData structure from any list of transactions.
 * Used for instant client-side rendering when loading historical records from Cloud Firestore.
 */
export function buildDailyReportFromTransactions(dateStr: string, transactions: TransactionRecord[]): DailyReportData {
  const dayTransactions = transactions.filter(t => t.date === dateStr);

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
    const studentName = txs[0]?.studentName || indexNum;
    const boundGoogleEmail = txs.find(t => t.googleEmail)?.googleEmail || '';

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

  return {
    date: dateStr,
    totalUniqueStudents: uniqueStudentsEntered.size,
    totalEntries,
    totalExits,
    currentlyInside: enteredNotExitedCount,
    enteredNotExited: enteredNotExitedCount,
    sessions,
  };
}
