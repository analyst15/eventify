# Security Specification: Summit Registrations

This document specifies the safety invariants, potential attack vectors (the "Dirty Dozen" anomalous payloads), and target behaviors for our Africa Emerging Markets Summit 2026 attendee capture system on Cloud Firestore.

## 1. Safety & Data Invariants
1. **Unprivileged Creation**: Any public user can create a registration document. However, they can ONLY set `paymentStatus` to `'pending'`, and `createdAt` & `updatedAt` must match the server request time.
2. **PII and Scraper Protection**: Blanket reading (`list`) of all registrants is strictly blocked to prevent scraper attacks or PII leakage of names, phones, and emails.
3. **Single-Record Cryptic Access**: Retrieve (`get`) is only allowed if the user possesses the cryptographically secure auto-generated registration ID.
4. **Strict Update Boundary (Identity Locking)**: During updates (such as choosing a ticket or paying), crucial fields like `firstName`, `lastName`, `email`, `phone`, and `createdAt` are IMMUTABLE. Users can only modify transition fields (`paymentStatus`, `selectedTicketId`, `paymentMethod`, `amountPaid`, `receiptNumber`, `updatedAt`).
5. **No Deletes**: Deletions are forbidden.

---

## 2. The "Dirty Dozen" Anomalous Payloads

We design these payloads to test and fail rules validation if implemented insecurely:

### Payload 1: Instant Confirmation (Self-Approved State)
An attacker attempts to self-approve a registration without paying.
```json
{
  "participationType": "Delegate",
  "firstName": "John",
  "lastName": "Doe",
  "country": "KE",
  "email": "john@example.com",
  "phone": "+254712345678",
  "city": "Nairobi",
  "address": "123 Lane",
  "paymentStatus": "success", 
  "createdAt": "request.time",
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (paymentStatus must be 'pending' on create)*

### Payload 2: Massive Payload Injection (Wallet Exhaustion / Resource Poisoning)
An attacker tries to store a huge text string that spikes database storage and billing costs.
```json
{
  "participationType": "Delegate",
  "firstName": "VeryLongFirstName... (10,000 characters) ...",
  "lastName": "Doe",
  "country": "KE",
  "email": "john@example.com",
  "phone": "+254712345678",
  "city": "Nairobi",
  "address": "123 Lane",
  "paymentStatus": "pending",
  "createdAt": "request.time",
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (firstName size <= 100)*

### Payload 3: Email Spoofing & Profiling (Email Alteration during Update)
An attacker tries to change the registrant's email to another user's email during checkout update to hijack their ticket.
```json
// Existing: john@example.com
// Incoming Update:
{
  "participationType": "Delegate",
  "firstName": "John",
  "lastName": "Doe",
  "country": "KE",
  "email": "malicious@example.com", 
  "phone": "+254712345678",
  "city": "Nairobi",
  "address": "123 Lane",
  "paymentStatus": "success",
  "createdAt": "existing.createdAt",
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (email must match existing().email)*

### Payload 4: Invalid ISO Country Code (Transaction Security Bypass)
An attacker inputting random non-standard characters as the ISO two-letter country code.
```json
{
  "participationType": "Delegate",
  "firstName": "John",
  "lastName": "Doe",
  "country": "KE-POISONED", 
  "email": "john@example.com",
  "phone": "+254712345678",
  "city": "Nairobi",
  "address": "123 Lane",
  "paymentStatus": "pending",
  "createdAt": "request.time",
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (country code size must be exactly 2)*

### Payload 5: Spoofed Timestamps (Client Created Time)
An attacker sends a backdated `createdAt` timestamp to claim early-bird prices.
```json
{
  "participationType": "Delegate",
  "firstName": "John",
  "lastName": "Doe",
  "country": "KE",
  "email": "john@example.com",
  "phone": "+254712345678",
  "city": "Nairobi",
  "address": "123 Lane",
  "paymentStatus": "pending",
  "createdAt": "2020-01-01T00:00:00Z", 
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (createdAt must match request.time)*

### Payload 6: Mutating Immutable Name
An attacker tries to edit their registered name to transfer their badge to someone else during update.
```json
// Existing name: "John Doe"
// Update payload:
{
  "firstName": "Malicious", 
  "lastName": "Hacker",
  "paymentStatus": "success",
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (only designated transition fields can be updated)*

### Payload 7: Shadow Field Injection
An attacker inserts a generic field such as `isAdmin: true` during profile setup to gain extra credentials.
```json
{
  "participationType": "Delegate",
  "firstName": "John",
  "lastName": "Doe",
  "country": "KE",
  "email": "john@example.com",
  "phone": "+254712345678",
  "city": "Nairobi",
  "address": "123 Lane",
  "paymentStatus": "pending",
  "isAdmin": true, 
  "createdAt": "request.time",
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (no shadow keys allowed; validation strictly matches blueprint properties)*

### Payload 8: Illegal Document Path Poisoning
An attacker attempts to write directly into an illegal subcollection or use long malicious path names.
Path: `/registrations/some-super-long-garbage-id-designed-to-poison-indexes`
*Expected: REJECTED (isValidId(registrationId) limits characters and length)*

### Payload 9: Blanket Directory Listing (Scraping Attack)
An unauthorized bot tries to fetch all records in `/registrations` to collect attendee personal data.
*Expected: REJECTED (list operation strictly denied)*

### Payload 10: Unauthorized Profile Deletion
A user or malicious attacker attempts to delete general registrations.
*Expected: REJECTED (delete operations strictly denied)*

### Payload 11: Transaction Parameter Tampering (Self-Assigned Discount)
An attacker sets `amountPaid` to `0` or a negative number for a Premium Ticket during update.
```json
{
  "paymentStatus": "success",
  "selectedTicketId": "vip_pass",
  "amountPaid": -500, 
  "updatedAt": "request.time"
}
```
*Expected: REJECTED (amountPaid type and positive integrity validations)*

### Payload 12: Updating Terminal Completed Records
An attacker tries to change the `paymentStatus` of an already approved and validated registration back to pending or mutate its details.
*Expected: REJECTED (the document status is Locked once state reaches terminal `'success'`)*
