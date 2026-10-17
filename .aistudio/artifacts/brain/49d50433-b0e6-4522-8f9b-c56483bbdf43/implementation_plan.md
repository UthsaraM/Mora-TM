# Unified Google Authentication, Student Index Binding & Admin Verification Plan

Comprehensive architecture and execution plan to enforce mandatory Google Sign-In across the Classroom 1 system for both students and administrators. Students link their University Index Number to their Google account on first login, every entry/exit transaction permanently records the verified Google email, and administrators are governed through Firestore by the Super Administrator (`uthzaaawim@gmail.com`).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during the interactive clarification interviews:

- **Confirmed Decision 1 (Mandatory Google Authentication)**: Google Sign-In is strictly mandatory for all entry and exit transactions. Anonymous or unauthenticated swipes are disabled.
- **Confirmed Decision 2 (Student Account Binding)**: On first Google login, the student enters their University Index Number. The system validates the index against the roster and permanently links the Google account (`email`, `uid`) to that index in Firestore. Subsequent logins automatically recognize the student.
- **Confirmed Decision 3 (Transaction Audit Trail)**: Every entry and exit transaction permanently stamps and saves the verified Google email (`googleEmail`), Google UID (`googleUid`), student name, timestamp, and resulting occupancy status.
- **Confirmed Decision 4 (Administrator Governance)**: Administrators authenticate via Google Sign-In against the Firestore `admins` whitelist, governed exclusively by Super Administrator `uthzaaawim@gmail.com`.
- **Confirmed Decision 5 (Firestore-Backed Whitelist & Profiles)**: All verified administrator privileges and linked student profiles persist directly in cloud Firestore collections (`admins` and `students`).

---

## 1. Overview & Core Concept

- **What It Does**:
  - **For Students**: A friction-free mobile/desktop experience where students sign in with their Google account once, link their student index number, and perform 1-tap entry and exit swipes. Every swipe creates an unalterable log containing their verified Google email.
  - **For Administrators**: Secure Google authentication verified against cloud Firestore. The Super Administrator (`uthzaaawim@gmail.com`) can invite, approve, suspend, or remove proctors.
  - **For Auditing**: Proctors and coordinators can view and export attendance logs with the exact Google email associated with every check-in.
- **Target Audience / Persona**:
  - **Classroom 1 Students**: University attendees who check in and out securely from their smartphones or tablets.
  - **Super Administrator (`uthzaaawim@gmail.com`)**: Oversees authorized personnel, assigns roles, and monitors campus-wide access control.
  - **Proctors & Coordinators**: View live classroom capacity, inspect verified student sessions, and download official CSV reports with Google account proof.
- **Key Value**: Guarantees non-repudiation (no students proxy-swiping for absent peers with arbitrary numbers), ensures tamper-proof audit trails, and delivers a sleek, modern single sign-on experience.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Student / Faculty Arrives]
            │
            ▼
┌──────────────────────────────────────────────┐
│  Landing Page or Scanner Modal               │
│  "Sign in with Google to Enter / Exit"       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼ Google Popup
┌──────────────────────────────────────────────┐
│  Google Auth Success (Email & UID verified)  │
└──────────────────────┬───────────────────────┘
                       │
         Is Email in `admins` whitelist?
         ├──────────── YES ────────────► [Admin Portal Granted]
         │                                (Super Admin controls if uthzaaawim)
         ▼ NO
┌──────────────────────────────────────────────┐
│  Query Firestore `students` for Google UID   │
└──────────────────────┬───────────────────────┘
                       │
         Has linked Index Number?
         ├──────────── NO ─────────────► [First-Time Index Binding Modal]
         │                                - Enter University Index (e.g. 22001)
         │                                - Validates index exists in roster
         │                                - Binds Google email & UID to profile
         ▼ YES                            - Proceeds directly to Swiper
┌──────────────────────────────────────────────┐
│  Authenticated Student Scanner Mode          │
│  - Displays: "Welcome, [Name] ([Index])"     │
│  - Single-Tap Action: [ENTRY] or [EXIT]      │
│  - Stamps Google Email into Transaction      │
│  - Broadcasts live occupancy update          │
└──────────────────────────────────────────────┘
```

### Visual Identity & Theme
- **Theme**: Clean university access interface with Slate (`#0F172A`), University Blue (`#1D4ED8`), Emerald (`#059669` for entry), and Amber (`#D97706` for account linking).
- **Typography**: `Plus Jakarta Sans` for clean titles and instructions; `JetBrains Mono` with `tabular-nums` for index numbers, timestamps, and staff identifiers.
- **Component Styling**:
  - Prominent Google button with standard Google mark.
  - Student identity banner showing connected Google avatar/email and linked index number.
  - One-tap large swipe toggle (`Entry / Exit`) with instant tactile feedback.
  - Responsive compact cards for mobile navigation (`Scan`, `Occupancy`, `Search`, `Account`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Mandatory Google Sign-In for Transactions**
  - *Chosen Approach*: Disable unauthenticated anonymous index typing. Require Google authentication before recording a transaction.
  - *Why*: User explicitly requested that transactions save the verified Google account. This prevents students from faking swipes by simply typing someone else's index number.
- **Decision 2: One-Time Index Number Binding**
  - *Chosen Approach*: On first Google login, prompt student to link their University Index Number once. Store `googleUid`, `googleEmail`, and `linkedAt` on the student record in Firestore (`students/{indexNumber}`).
  - *Why*: Eliminates the need for students to type their index number on every single scan while ensuring each Google account binds to one valid university student.
- **Decision 3: Dual-Role Authentication Gate**
  - *Chosen Approach*: A single, seamless "Sign in with Google" button. The system automatically routes the user: if their email is in `admins`, they get admin access; otherwise, they proceed as an authenticated student.
  - *Why*: Streamlines the login flow so neither students nor faculty need to figure out which separate login screen to use.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATION                            │
│                                                                        │
│   ┌──────────────────────┐          ┌───────────────────────────────┐  │
│   │   Auth State Hook    │          │     Transaction Dispatcher    │  │
│   │ (onAuthStateChanged) │          │  (Auto-attaches googleEmail)  │  │
│   └──────────┬───────────┘          └───────────────┬───────────────┘  │
│              │                                      │                  │
└──────────────┼──────────────────────────────────────┼──────────────────┘
               │                                      │
               ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FIREBASE CLOUD INFRASTRUCTURE                        │
│                                                                        │
│   ┌──────────────────────┐          ┌───────────────────────────────┐  │
│   │    Firebase Auth     │          │        Cloud Firestore        │  │
│   │   (Google Provider)  │          │                               │  │
│   │  Returns email & UID │          │ ┌───────────────────────────┐ │  │
│   └──────────┬───────────┘          │ │ `admins/{email}`          │ │  │
│              │                      │ │ Staff whitelist & roles   │ │  │
│              ▼                      │ ├───────────────────────────┤ │  │
│   ┌──────────────────────┐          │ │ `students/{indexNumber}`  │ │  │
│   │   Token Verification │          │ │ Linked googleUid & email  │ │  │
│   │  & Identity Binding  │─────────►│ ├───────────────────────────┤ │  │
│   └──────────────────────┘          │ │ `transactions/{id}`       │ │  │
│                                     │ │ Stores googleEmail & uid  │ │  │
│                                     │ └───────────────────────────┘ │  │
│                                     └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Schema Updates

#### 1. `TransactionRecord` Entity
```typescript
interface TransactionRecord {
  id: string;
  studentIndexNumber: string;
  studentName: string;
  venue: string;                      // "Classroom 1"
  type: 'ENTRY' | 'EXIT';
  date: string;                       // "2026-10-18"
  timestamp: string;                  // ISO string
  formattedTime: string;              // "01:05:22 AM"
  statusAfter: 'INSIDE' | 'OUTSIDE';
  greeting: string;
  googleEmail: string;                // Verified Google email (e.g. "student@gmail.com")
  googleUid: string;                  // Google user UID
  isCorrected?: boolean;
}
```

#### 2. `Student` Entity Binding
```typescript
interface Student {
  indexNumber: string;                // "22001"
  studentName: string;                // "Uthsara Manul"
  importedAt?: string;
  isActive?: boolean;
  googleEmail?: string;               // Bound Google account email
  googleUid?: string;                 // Bound Google account UID
  linkedAt?: string;                  // ISO timestamp of first link
}
```

#### 3. `VerifiedAdmin` Entity
```typescript
interface VerifiedAdmin {
  id: string;                         // "adm_uthzaaawim"
  email: string;                      // "uthzaaawim@gmail.com"
  name: string;                       // "Uthsara Manul"
  staffId: string;                    // "ADM-001"
  role: 'Super Administrator' | 'Department Coordinator' | 'Academic Proctor';
  isVerified: boolean;                // true
  status: 'ACTIVE' | 'SUSPENDED';
  addedAt: string;
}
```

---

## 5. Step-by-Step Implementation Strategy

1. **Firestore Security Rules (`firestore.rules`)**:
   - Secure `students` collection: allow authenticated users to link their own Google UID and email to their student profile.
   - Secure `transactions` collection: enforce `incoming().googleEmail == request.auth.token.email` and `incoming().googleUid == request.auth.uid`.
   - Secure `admins` collection: restricted read for authenticated staff; writes restricted to `uthzaaawim@gmail.com`.
2. **Firebase Auth & Firestore Services (`src/lib/firebase.ts`)**:
   - Add `linkStudentIndexToGoogle(googleUser, indexNumber)` helper.
   - Add `findStudentByGoogleUid(uid)` and `findStudentByGoogleEmail(email)`.
   - Update `syncTransactionToFirestore` to enforce and record `googleEmail` and `googleUid`.
   - Add admin verification methods: `verifyAdminAccount(email)` and Super Admin management helpers.
3. **Backend Server Integration (`server.ts`)**:
   - Update `/api/transactions/process` to require and store `googleEmail` and `googleUid`.
   - Update Daily CSV export (`/api/reports/daily/csv`) to include the `Google Account Email` column.
4. **Student UI Experience (`src/components/MainScreen.tsx`)**:
   - Integrate authenticated student state: display connected Google email and verified index badge.
   - Provide a prominent **"Link Your Student Index"** dialog for first-time Google sign-ins.
   - One-tap Entry / Exit button that immediately signs the transaction with the verified Google identity.
5. **Admin Dashboard Experience (`src/components/AdminDashboard.tsx`)**:
   - Show Google email in Live Attendance logs, daily report session tables, and CSV exports.
   - Restrict administrative invite/delete actions strictly to Super Administrator `uthzaaawim@gmail.com`.
6. **Verification & Testing**:
   - Run `lint_applet` to verify TypeScript types and syntax.
   - Run `compile_applet` to confirm a clean, error-free production build.
