import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { FireMode } from './game/types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

export interface LeaderboardRecord {
  uid: string;
  playerName: string;
  score: number;
  fireMode: FireMode;
  zappedCount: number;
  bestCombo: number;
  updatedAt?: Timestamp;
}

const PLAYER_NAME_KEY = 'chudling_pong_player_name_v1';

// Matches firebase-blueprint.json: ^[a-zA-Z0-9 _\-\.]{1,24}$
export function sanitizePlayerName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9 _\-.]/g, '').trim().slice(0, 24);
  return cleaned.length > 0 ? cleaned : 'Player';
}

export function loadSavedPlayerName(fallbackUser?: User | null): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(PLAYER_NAME_KEY);
    if (stored && stored.trim().length > 0) {
      return sanitizePlayerName(stored);
    }
  }
  if (fallbackUser?.displayName) {
    return sanitizePlayerName(fallbackUser.displayName);
  }
  return 'Player';
}

export function saveLocalPlayerName(name: string): string {
  const sanitized = sanitizePlayerName(name);
  if (typeof window !== 'undefined') {
    localStorage.setItem(PLAYER_NAME_KEY, sanitized);
  }
  return sanitized;
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeLeaderboard(
  onData: (entries: LeaderboardRecord[]) => void,
  onError?: (err: unknown) => void,
  maxEntries: number = 20
): () => void {
  const boundedLimit = Math.max(1, Math.min(50, Math.floor(maxEntries)));
  const path = 'leaderboard';
  const q = query(
    collection(db, path),
    where('score', '>=', 0),
    orderBy('score', 'desc'),
    limit(boundedLimit)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: LeaderboardRecord[] = snapshot.docs.map((d) => d.data() as LeaderboardRecord);
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function submitLeaderboardScore(params: {
  playerName: string;
  score: number;
  fireMode: FireMode;
  zappedCount: number;
  bestCombo: number;
}): Promise<{ saved: boolean; bestScore: number; reason?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { saved: false, bestScore: params.score, reason: 'auth_required' };
  }

  const entryPath = `leaderboard/${user.uid}`;
  const docRef = doc(db, 'leaderboard', user.uid);

  const clampedScore = Math.max(0, Math.min(100000, Math.floor(params.score)));
  const clampedZapped = Math.max(0, Math.min(100000, Math.floor(params.zappedCount)));
  const clampedCombo = Math.max(0, Math.min(10000, Math.floor(params.bestCombo)));
  const safeName = sanitizePlayerName(params.playerName);
  const safeMode: FireMode = params.fireMode === 'hand' ? 'hand' : 'thirdLeg';

  let existingScore = -1;
  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as Partial<LeaderboardRecord>;
      if (typeof existingData.score === 'number') {
        existingScore = existingData.score;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, entryPath);
  }

  if (existingScore >= 0 && clampedScore < existingScore) {
    return { saved: false, bestScore: existingScore, reason: 'below_existing_best' };
  }

  const payload = {
    uid: user.uid,
    playerName: safeName,
    score: clampedScore,
    fireMode: safeMode,
    zappedCount: clampedZapped,
    bestCombo: clampedCombo,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
    return { saved: true, bestScore: clampedScore };
  } catch (error) {
    handleFirestoreError(error, existingScore >= 0 ? OperationType.UPDATE : OperationType.CREATE, entryPath);
  }
}
