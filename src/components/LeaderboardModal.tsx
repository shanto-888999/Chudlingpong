import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { Crown, LogIn, LogOut, Send, Trophy, X } from 'lucide-react';
import {
  type LeaderboardRecord,
  sanitizePlayerName,
  saveLocalPlayerName,
  signInWithGoogle,
  signOutUser,
  submitLeaderboardScore,
} from '../firebase';
import type { FireMode } from '../game/types';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  entries: LeaderboardRecord[];
  loading: boolean;
  errorText: string | null;
  user: User | null;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  bestScore: number;
  bestMode: FireMode;
  bestZapped: number;
  bestCombo: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  onClose,
  entries,
  loading,
  errorText,
  user,
  playerName,
  onPlayerNameChange,
  bestScore,
  bestMode,
  bestZapped,
  bestCombo,
}) => {
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSignIn = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const signedUser = await signInWithGoogle();
      if (!playerName || playerName === 'Player') {
        const nextName = saveLocalPlayerName(signedUser.displayName || 'Player');
        onPlayerNameChange(nextName);
      }
      setStatusMsg('Signed in with Google.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await signOutUser();
      setStatusMsg('Signed out.');
    } catch {
      setStatusMsg('Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitBest = async () => {
    if (!user) return;
    setBusy(true);
    setStatusMsg(null);
    const cleanName = saveLocalPlayerName(playerName);
    onPlayerNameChange(cleanName);
    try {
      const res = await submitLeaderboardScore({
        playerName: cleanName,
        score: bestScore,
        fireMode: bestMode,
        zappedCount: bestZapped,
        bestCombo,
      });
      if (res.saved) {
        setStatusMsg(`Saved ${res.bestScore} pts to Global Leaderboard!`);
      } else if (res.reason === 'below_existing_best') {
        setStatusMsg(`Your cloud record (${res.bestScore} pts) is already higher.`);
      }
    } catch (err) {
      setStatusMsg(
        err instanceof Error && err.message.includes('Quota exceeded')
          ? 'Daily Firestore quota exceeded. Try again tomorrow.'
          : 'Failed to submit score. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-[360px] max-h-[86dvh] rounded-2xl bg-[#121218] border border-white/15 shadow-2xl flex flex-col overflow-hidden text-white">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-extrabold tracking-tight">
              Chudling Pong Top 20
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth & Score Sync Bar */}
        <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex flex-col gap-2">
          {!user ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-300">
                Sign in with Google to save your {bestScore} pts
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleSignIn}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-[#050507] hover:bg-zinc-200 font-bold text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={24}
                  value={playerName}
                  onChange={(e) => onPlayerNameChange(e.target.value)}
                  onBlur={() => onPlayerNameChange(sanitizePlayerName(playerName))}
                  placeholder="Player nickname"
                  className="flex-1 min-w-0 rounded-lg bg-[#09090D] border border-white/15 px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSubmitBest}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  Save ({bestScore})
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="shrink-0 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {statusMsg && (
            <p className="text-[11px] text-amber-300 font-medium">{statusMsg}</p>
          )}
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
          {loading ? (
            <p className="py-8 text-center text-xs text-zinc-400">Loading leaderboard...</p>
          ) : errorText ? (
            <p className="py-8 text-center text-xs text-red-400 px-3">{errorText}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400">
              No scores yet. Be the first on the board!
            </p>
          ) : (
            entries.map((entry, index) => {
              const isSelf = user?.uid === entry.uid;
              return (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                    isSelf
                      ? 'bg-red-500/15 border-red-400/40'
                      : 'bg-white/5 border-white/8'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-center text-xs font-extrabold tabular-nums text-zinc-300">
                      {index === 0 ? (
                        <Crown className="w-4 h-4 text-amber-400 mx-auto" />
                      ) : (
                        `#${index + 1}`
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {entry.playerName}
                        {isSelf ? ' (You)' : ''}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {entry.fireMode === 'hand' ? 'Normal' : '3rd Leg'} · {entry.zappedCount} zapped
                      </p>
                    </div>
                  </div>
                  <span className="font-display text-base font-extrabold tabular-nums text-white pl-2">
                    {entry.score}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
