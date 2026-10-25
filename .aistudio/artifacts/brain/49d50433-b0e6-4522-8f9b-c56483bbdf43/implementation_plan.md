# Revised Implementation Plan: 'Exit All from Classroom 1' & Midnight Auto-Exit Sweep

## 1. User Requirement
1. **Manual "Exit All" Button**: Located in the **Live Occupancy** tab of the Admin Dashboard.
2. **Simplified Confirmation**: Click "Exit All from Classroom 1" -> Shows a clean confirmation dialog ("Are you sure you want to exit all X students?") -> One-click "Confirm Exit All" (no text/notes input required).
3. **12:00 AM Midnight Sweep**: At 12:00 AM midnight (Asia/Colombo timezone), the server automatically checks out all students still inside Classroom 1 and logs individual `EXIT` records to both the server and Cloud Firestore.

---

## 2. Architecture & Implementation Steps

### A. Backend (`server.ts`)
1. **Protected Endpoint**: `POST /api/admin/occupancy/exit-all`
   - Requires admin authentication (`requireAdmin`).
   - Retrieves all students currently marked `status === 'INSIDE'`.
   - If no students are inside, returns `{ success: true, count: 0, message: 'Classroom 1 is already empty.' }`.
   - For each student:
     - Generates an official `EXIT` `TransactionRecord` timestamped with current Asia/Colombo time.
     - Appends to `db.transactions`.
     - Updates `db.currentStatuses[indexNumber] = 'OUTSIDE'`.
     - Synchronizes to Cloud Firestore (`transactions` and `occupancy` collections) via `pushTransactionToFirestore`.
   - Saves database and returns `{ success: true, count: number }`.

2. **Server-Side Midnight Auto-Exit Sweep (`server.ts`)**:
   - A background interval checking every 30 seconds against the `Asia/Colombo` clock.
   - When the time strikes `00:00` (12:00 AM midnight Asia/Colombo):
     - Automatically executes the exit routine for all students inside Classroom 1.
     - Individual `EXIT` transactions are recorded and pushed to Cloud Firestore.
     - Idempotent: Tracks `lastMidnightSweepDate` to prevent repeated runs on the same night.
     - Logs: `[Classroom 1 Midnight Sweep] Automatically recorded exit for X students at 12:00 AM Asia/Colombo.`

### B. Admin Dashboard UI (`src/components/AdminDashboard.tsx`)
1. **"Exit All from Classroom 1" Button**:
   - Added directly to the **Live Occupancy** tab header next to the search bar and student count badge.
   - Distinct red/amber styling with a door exit icon: `Exit All (X Inside)`.
   - Disabled when occupancy count is 0.
2. **One-Click Confirmation Modal**:
   - Clean, focused prompt:
     - "Confirm Exit All Students?"
     - "This will record an EXIT transaction for all {count} students currently inside Classroom 1 and update live occupancy to 0."
     - Buttons: `Cancel` and `Confirm Exit All` (with loading spinner while executing).
     - No notes or text fields required.
3. **Instant Refresh**:
   - Automatically refreshes occupancy list, recent transactions, and today's summary.

---

## 3. Verification & Validation
1. Verify `POST /api/admin/occupancy/exit-all` via API call.
2. Verify that clicking "Confirm Exit All" clears the occupancy list and records individual EXIT entries.
3. Verify that Cloud Firestore reflects the status changes and EXIT records.
4. Verify the midnight scheduler detects 00:00 in Asia/Colombo.
5. Verify clean compilation via `compile_applet`.
