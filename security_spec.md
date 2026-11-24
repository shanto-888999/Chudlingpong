# Chudling Pong — Firestore Security Specification

## 1. Data Invariants
1. **Global Safety Net**: All unspecified paths are denied by default (`allow read, write: if false`).
2. **Ownership & Path Binding**: Every document in `/leaderboard/{entryId}` is strictly owned by `entryId == request.auth.uid` and `data.uid == request.auth.uid`. Users can only create, update, or delete their own entry.
3. **Verified Identity**: All writes require a signed-in user with `request.auth.token.email_verified == true`.
4. **PII Isolation**: `/leaderboard/{entryId}` contains zero PII (no `email`, `phone`, or personal metadata). Only public game nickname (`playerName`), `uid`, `score`, `fireMode`, `zappedCount`, `bestCombo`, and `updatedAt` are permitted.
5. **Strict Schema & Bounds**: Unknown/ghost fields are rejected via `keys().hasAll(...) && keys().hasOnly(...)` on create and `diff().affectedKeys().hasOnly(...)` on update. Strings enforce length and regex bounds; numeric stats enforce realistic non-negative integer bounds (`0 <= score <= 100000`, `0 <= zappedCount <= 100000`, `0 <= bestCombo <= 10000`).
6. **Temporal Integrity**: `updatedAt` must equal `request.time` on every create and update.
7. **Monotonic High Score & Immutable Owner**: `uid` is immutable after creation (`incoming().uid == existing().uid`), and updates cannot downgrade or forge invalid modes (`fireMode in ['hand', 'thirdLeg']`, `incoming().score >= existing().score`).
8. **Bounded List Queries**: `list` queries on `/leaderboard` enforce bounded query limits (`request.query.limit <= 50`) and valid document shape (`resource.data.score is int && resource.data.score >= 0`).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/leaderboard/user123` with `auth: null`.
2. **Identity Spoofing (Path)**: Signed-in user `alice` writing to `/leaderboard/bob` (`entryId !== auth.uid`).
3. **Identity Spoofing (Field)**: Signed-in user `alice` writing `/leaderboard/alice` with `{ uid: "bob", ... }`.
4. **Unverified Email Write**: Signed-in user with `email_verified: false` attempting to create a score.
5. **Shadow / Ghost Field Injection**: Creating `/leaderboard/alice` with an extra field `{ isAdmin: true }` or `{ email: "a@b.com" }`.
6. **Type Poisoning (Score String)**: Updating `score` to `"99999"` (string) instead of integer.
7. **Negative / Overflow Score**: Creating `/leaderboard/alice` with `score: -5` or `score: 999999999`.
8. **Invalid Fire Mode**: Creating `/leaderboard/alice` with `fireMode: "godmode"`.
9. **Client-Forged Timestamp**: Writing `updatedAt: new Date("2020-01-01T00:00:00Z")` instead of `request.time`.
10. **Oversized / XSS Player Name**: Writing `playerName: "<script>alert(1)</script>..."` (> 24 chars or disallowed characters).
11. **Immutable UID Mutation on Update**: Updating `uid` in an existing `/leaderboard/alice` doc.
12. **Unbounded Collection Scrape**: Listing `/leaderboard` without a bounded `limit <= 50` (or requesting `limit(1000)`).
