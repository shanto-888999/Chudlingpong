/**
 * Phase 0 Security Rules Verification Specification for Chudling Pong.
 * Documents the 12 adversarial "Dirty Dozen" payloads and verifies each is rejected
 * by firestore.rules. Designed for @firebase/rules-unit-testing when running emulator tests.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'delete' | 'list';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  queryLimit?: number;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Create',
    operation: 'create',
    path: 'leaderboard/user_1',
    auth: null,
    payload: {
      uid: 'user_1',
      playerName: 'Anon',
      score: 10,
      fireMode: 'thirdLeg',
      zappedCount: 10,
      bestCombo: 4,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Document Path',
    operation: 'create',
    path: 'leaderboard/bob_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: 50,
      fireMode: 'hand',
      zappedCount: 40,
      bestCombo: 12,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Payload UID',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'bob_uid',
      playerName: 'Alice',
      score: 50,
      fireMode: 'hand',
      zappedCount: 40,
      bestCombo: 12,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Write Blocked',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: false },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: 20,
      fireMode: 'thirdLeg',
      zappedCount: 15,
      bestCombo: 5,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow / Ghost Field Injection (PII / Admin)',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: 20,
      fireMode: 'thirdLeg',
      zappedCount: 15,
      bestCombo: 5,
      updatedAt: 'SERVER_TIMESTAMP',
      isAdmin: true,
      email: 'alice@example.com',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Type Poisoning (String Score)',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: '99999',
      fireMode: 'thirdLeg',
      zappedCount: 15,
      bestCombo: 5,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Out-of-Bounds Overflow Score',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: 9999999,
      fireMode: 'thirdLeg',
      zappedCount: 15,
      bestCombo: 5,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Fire Mode Enum',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: 25,
      fireMode: 'laser_hack',
      zappedCount: 20,
      bestCombo: 8,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Forged Client Timestamp',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: 'Alice',
      score: 25,
      fireMode: 'hand',
      zappedCount: 20,
      bestCombo: 8,
      updatedAt: '2020-01-01T00:00:00.000Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized / Malicious Player Name',
    operation: 'create',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      playerName: '<script>alert(1)</script>TooLongNameHere',
      score: 25,
      fireMode: 'hand',
      zappedCount: 20,
      bestCombo: 8,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immutable UID Tampering on Update',
    operation: 'update',
    path: 'leaderboard/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'other_uid',
      score: 99,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unbounded Leaderboard List Query',
    operation: 'list',
    path: 'leaderboard',
    auth: null,
    queryLimit: 1000,
    expected: 'PERMISSION_DENIED',
  },
];
