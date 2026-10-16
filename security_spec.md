# Security Specification: Classroom 1 Entry & Exit System

## 1. Data Invariants
1. **Student Invariant**: A student record must have a valid indexNumber (<=64 chars, alphanumeric/dash) and a non-empty studentName (<=128 chars).
2. **Transaction Immutability**: Historical entry/exit transactions cannot be modified by unauthenticated users or deleted. Only verified administrators may apply audit-logged corrections with valid reason and identity tracking.
3. **Occupancy Sync**: An occupancy record tracks whether a student is currently 'INSIDE' or 'OUTSIDE'. State values are strictly constrained to 'INSIDE' or 'OUTSIDE'.
4. **Admin Protection**: Admin documents can only be read by signed-in users and updated or created by authorized administrators (`uthzaaawim@gmail.com` bootstrapped or documented admins).

## 2. The Dirty Dozen Payloads
1. **Payload 1: Unauthenticated Transaction Deletion**: Attempting DELETE on `/transactions/{id}` without credentials -> REJECTED.
2. **Payload 2: Arbitrary Privilege Escalation**: Creating `/admins/{uid}` claiming role: "superadmin" with forged email -> REJECTED.
3. **Payload 3: Oversized Payload Injection (Denial of Wallet)**: Submitting student name with 100,000 characters to consume storage -> REJECTED.
4. **Payload 4: Invalid Transaction Status**: Submitting transaction with `type: "INVALID_EVENT"` instead of ENTRY/EXIT -> REJECTED.
5. **Payload 5: Malicious Index Injection**: Injecting script tags or characters exceeding 64 chars into indexNumber -> REJECTED.
6. **Payload 6: Unauthorized Student Modification**: Unauthenticated user trying to deactivate an existing student -> REJECTED.
7. **Payload 7: Unverified Email Admin Bypass**: Attempting admin write with `email_verified == false` -> REJECTED.
8. **Payload 8: Shadow Field Injection in Student Record**: Adding forbidden fields (`isAdmin: true`, `backdoor: "allowed"`) to student record -> REJECTED.
9. **Payload 9: Path Traversal Document ID**: Supplying invalid characters in document ID -> REJECTED by `isValidId`.
10. **Payload 10: Terminal State Violation**: Attempting to alter past immutable timestamp fields -> REJECTED.
11. **Payload 11: Blanket Unauthenticated Student Deletion**: Attempting to wipe `/students/{id}` collection -> REJECTED.
12. **Payload 12: Admin Impersonation without auth**: Calling transaction correction with empty auth header -> REJECTED.
