import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Heart,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  type LeaderboardRecord,
  loadSavedPlayerName,
  saveLocalPlayerName,
  submitLeaderboardScore,
  subscribeAuth,
  subscribeLeaderboard,
} from './firebase';
import { getBedOrigin, getSleeperTarget, renderGame } from './game/renderer';
import {
  AvatarStyle,
  BeamEffect,
  FireMode,
  FloatingText,
  GameMode,
  GameState,
  Mosquito,
  Particle,
  PoopSplat,
  PowerUp,
  SleeperMood,
  ZzzBubble,
} from './game/types';

const BEST_SCORE_KEY = 'sleepy_zapper_best_v1';
const AVATAR_STYLE_KEY = 'sleepy_zapper_avatar_v1';
const FIRE_MODE_KEY = 'sleepy_zapper_fire_mode_v1';

const AVATAR_OPTIONS: { id: AvatarStyle; emoji: string; label: string }[] = [
  { id: 'sleepy', emoji: '😴', label: 'Sleepy' },
  { id: 'emoji', emoji: '😊', label: 'Emoji' },
  { id: 'cool', emoji: '😎', label: 'Shades' },
  { id: 'uncle', emoji: '🧔', label: 'Uncle' },
];

function loadBestScore(): number {
  if (typeof window === 'undefined') return 0;
  const parsed = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function loadAvatarStyle(): AvatarStyle {
  if (typeof window === 'undefined') return 'sleepy';
  const saved = localStorage.getItem(AVATAR_STYLE_KEY) as AvatarStyle | null;
  if (saved === 'sleepy' || saved === 'emoji' || saved === 'cool' || saved === 'uncle') {
    return saved;
  }
  return 'sleepy';
}

function loadFireMode(): FireMode {
  if (typeof window === 'undefined') return 'thirdLeg';
  const saved = localStorage.getItem(FIRE_MODE_KEY);
  if (saved === 'hand' || saved === 'thirdLeg') {
    return saved;
  }
  return 'thirdLeg';
}

function rayCircleIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number
): number | null {
  const fx = cx - ox;
  const fy = cy - oy;
  const proj = fx * dx + fy * dy;
  if (proj <= 0) return null;
  const closestX = ox + dx * proj;
  const closestY = oy + dy * proj;
  const distSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
  if (distSq <= r * r) {
    return proj;
  }
  return null;
}

function getDifficultyLevel(playTime: number, score: number): number {
  return Math.max(playTime / 12, (playTime * 0.55 + score * 0.8) / 10);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [gameMode] = useState<GameMode>('arcade');
  const [fireMode, setFireMode] = useState<FireMode>(() => loadFireMode());
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => loadBestScore());
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [lives, setLives] = useState<number>(3);
  const [maxLives, setMaxLives] = useState<number>(3);
  const [zappedCount, setZappedCount] = useState<number>(0);
  const [bestCombo, setBestCombo] = useState<number>(0);
  const [tripleShotSeconds, setTripleShotSeconds] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(() => loadAvatarStyle());
  const [hasCustomImage, setHasCustomImage] = useState<boolean>(false);

  // Firebase Auth & Leaderboard state
  const [user, setUser] = useState<User | null>(null);
  const [playerName, setPlayerName] = useState<string>(() => loadSavedPlayerName(null));
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardRecord[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<string>('Share');

  // Mutable simulation state inside ref for smooth 60fps loop
  const simRef = useRef({
    width: 420,
    height: 760,
    time: 0,
    playTime: 0,
    score: 0,
    bestScore: loadBestScore(),
    lives: 3,
    combo: 0,
    bestCombo: 0,
    zappedCount: 0,
    aimAngle: 0,
    isAiming: false,
    pointerId: null as number | null,
    dragStartX: 0,
    dragStartY: 0,
    dragStartAngle: 0,
    pointerMovedDist: 0,
    shotCooldown: 0,
    spawnTimer: 0.4,
    powerUpTimer: 12,
    nextBossScore: 10,
    tripleShotTimer: 0,
    lastTripleDisplaySec: 0,
    zzzTimer: 0.5,
    nextId: 1,
    mosquitoes: [] as Mosquito[],
    powerUps: [] as PowerUp[],
    beams: [] as BeamEffect[],
    splats: [] as PoopSplat[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    zzzBubbles: [] as ZzzBubble[],
    sleeperMood: 'idle' as SleeperMood,
    moodTimer: 0,
    shakeTime: 0,
    shakeIntensity: 0,
    biteFlashAlpha: 0,
    rubPhase: 0,
    fireMomentum: 0,
    lastShotTime: -10,
    keysPressed: { left: false, right: false },
  });

  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const avatarStyleRef = useRef<AvatarStyle>(avatarStyle);
  avatarStyleRef.current = avatarStyle;

  const fireModeRef = useRef<FireMode>(fireMode);
  fireModeRef.current = fireMode;

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const playerNameRef = useRef<string>(playerName);
  playerNameRef.current = playerName;

  const customAvatarImgRef = useRef<HTMLImageElement | null>(null);
  const customAvatarUrlRef = useRef<string | null>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Auth & Top-20 Leaderboard subscriptions
  useEffect(() => {
    const unsubAuth = subscribeAuth((nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        setPlayerName((prev) =>
          prev && prev !== 'Player' ? prev : loadSavedPlayerName(nextUser)
        );
      }
    });

    const unsubBoard = subscribeLeaderboard(
      (rows) => {
        setLeaderboardEntries(rows);
        setLeaderboardLoading(false);
        setLeaderboardError(null);
      },
      (err) => {
        setLeaderboardLoading(false);
        setLeaderboardError(
          err instanceof Error && err.message.includes('Quota exceeded')
            ? 'Daily Firestore quota exceeded. Try again tomorrow.'
            : 'Could not load global leaderboard right now.'
        );
      },
      20
    );

    return () => {
      unsubAuth();
      unsubBoard();
    };
  }, []);

  const syncRunToCloud = useCallback(
    async (finalScore: number, mode: FireMode, zapped: number, combo: number) => {
      if (!userRef.current || finalScore <= 0) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const cleanName = saveLocalPlayerName(playerNameRef.current);
        const res = await submitLeaderboardScore({
          playerName: cleanName,
          score: finalScore,
          fireMode: mode,
          zappedCount: zapped,
          bestCombo: combo,
        });
        if (res.saved) {
          setCloudStatus(`Saved ${res.bestScore} pts to Global Leaderboard!`);
        }
      } catch {
        // Handled cleanly in structured logger; avoid disrupting Game Over
      }
    },
    []
  );

  const spawnMosquito = useCallback(
    (currentScore: number, playTime: number, forceBoss: boolean = false) => {
      const sim = simRef.current;
      const { width, height } = sim;
      const d = getDifficultyLevel(playTime, currentScore);
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? -22 : width + 22;
      const startY = height * (0.14 + Math.random() * 0.28);

      const speedBoost = 1 + Math.min(d * 0.24, 2.0);
      const kind: Mosquito['kind'] = forceBoss
        ? 'boss'
        : currentScore >= 3 && Math.random() < 0.18
          ? 'golden'
          : 'normal';
      const baseSpeed =
        kind === 'boss'
          ? 105 * (1 + Math.min(d * 0.14, 1.1))
          : (kind === 'golden' ? 168 : 122) * speedBoost;

      const targetX = width * (0.25 + Math.random() * 0.5);
      const angleToCenter = Math.atan2(height * 0.26 - startY, targetX - startX);
      const maxHp = kind === 'boss' ? 3 : 1;

      sim.mosquitoes.push({
        id: sim.nextId++,
        x: startX,
        y: startY,
        vx: Math.cos(angleToCenter) * baseSpeed,
        vy: Math.sin(angleToCenter) * baseSpeed,
        radius: kind === 'boss' ? 25 : kind === 'golden' ? 15 : 17,
        wingPhase: Math.random() * Math.PI * 2,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 4.8 + Math.min(d * 0.6, 4.0) + Math.random() * 3,
        kind,
        hp: maxHp,
        maxHp,
        hitFlash: 0,
        state: 'roaming',
        stateTimer:
          kind === 'boss'
            ? Math.max(2.2, 4.6 - d * 0.25)
            : Math.max(0.85, 3.6 - d * 0.45) + Math.random() * Math.max(0.6, 1.8 - d * 0.2),
        diveTargetX: 0,
        diveTargetY: 0,
        facing: fromLeft ? -1 : 1,
      });

      if (kind === 'boss') {
        soundEngine.playDiveAlert();
        sim.floatingTexts.push({
          x: width * 0.5,
          y: Math.max(106, startY),
          vy: -24,
          text: 'BOSS INCOMING!',
          color: '#F43F5E',
          life: 1.15,
          maxLife: 1.15,
          scale: 1.08,
        });
      }
    },
    []
  );

  const spawnPowerUp = useCallback(() => {
    const sim = simRef.current;
    const { width, height } = sim;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -20 : width + 20;
    const startY = height * (0.16 + Math.random() * 0.2);
    sim.powerUps.push({
      id: sim.nextId++,
      x: startX,
      y: startY,
      vx: fromLeft ? 95 : -95,
      vy: 0,
      radius: 17,
      phase: Math.random() * Math.PI * 2,
      kind: 'triple',
    });
  }, []);

  const resetSimulation = useCallback(
    (mode: GameMode, startPlaying: boolean) => {
      const sim = simRef.current;
      const initialLives = mode === 'classic' ? 1 : 3;
      sim.playTime = 0;
      sim.score = 0;
      sim.lives = initialLives;
      sim.combo = 0;
      sim.bestCombo = 0;
      sim.zappedCount = 0;
      sim.aimAngle = 0;
      sim.isAiming = false;
      sim.pointerId = null;
      sim.shotCooldown = 0;
      sim.spawnTimer = 0.25;
      sim.powerUpTimer = 12;
      sim.nextBossScore = 10;
      sim.tripleShotTimer = 0;
      sim.lastTripleDisplaySec = 0;
      sim.mosquitoes = [];
      sim.powerUps = [];
      sim.beams = [];
      sim.splats = [];
      sim.particles = [];
      sim.floatingTexts = [];
      sim.sleeperMood = 'idle';
      sim.moodTimer = 0;
      sim.shakeTime = 0;
      sim.biteFlashAlpha = 0;
      sim.fireMomentum = 0;
      sim.lastShotTime = -10;

      setScore(0);
      setIsNewBest(false);
      setLives(initialLives);
      setMaxLives(initialLives);
      setZappedCount(0);
      setBestCombo(0);
      setTripleShotSeconds(0);
      setCloudStatus(null);
      setShareLabel('Share');

      soundEngine.stopThirdLegEffect();
      if (startPlaying) {
        spawnMosquito(0, 0, false);
        setGameState('PLAYING');
      } else {
        setGameState('TITLE_MENU');
      }
    },
    [spawnMosquito]
  );

  const startGame = useCallback(() => {
    resetSimulation(gameMode, true);
    soundEngine.preloadDeathAudio();
    if (fireModeRef.current === 'thirdLeg') {
      soundEngine.preloadThirdLegAudio();
    } else {
      soundEngine.stopThirdLegEffect();
    }
  }, [gameMode, resetSimulation]);

  const fireBeam = useCallback(() => {
    const sim = simRef.current;
    if (gameStateRef.current !== 'PLAYING' || sim.shotCooldown > 0) return;

    const origin = getBedOrigin(sim.width, sim.height, fireModeRef.current);
    const tripleActive = sim.tripleShotTimer > 0;
    const angles = tripleActive ? [sim.aimAngle - 0.22, sim.aimAngle, sim.aimAngle + 0.22] : [sim.aimAngle];

    const d = getDifficultyLevel(sim.playTime, sim.score);
    const hitForgiveness = Math.max(5, 11 - d * 0.8);
    const maxLen = Math.hypot(sim.width, sim.height);

    let anyHit = false;
    let mosquitoDefeated = false;
    let mosquitoDamaged = false;
    let hitGolden = false;
    let hitBossKill = false;
    let activatedPowerUp = false;

    for (const angle of angles) {
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);

      let closestDist = Infinity;
      let hitMosquitoIdx = -1;
      let hitPowerUpIdx = -1;

      sim.powerUps.forEach((pu, idx) => {
        const hitDist = rayCircleIntersect(
          origin.x,
          origin.y,
          dx,
          dy,
          pu.x,
          pu.y,
          pu.radius + 10
        );
        if (hitDist !== null && hitDist < closestDist) {
          closestDist = hitDist;
          hitPowerUpIdx = idx;
          hitMosquitoIdx = -1;
        }
      });

      sim.mosquitoes.forEach((m, idx) => {
        const hitDist = rayCircleIntersect(
          origin.x,
          origin.y,
          dx,
          dy,
          m.x,
          m.y,
          m.radius + hitForgiveness
        );
        if (hitDist !== null && hitDist < closestDist) {
          closestDist = hitDist;
          hitMosquitoIdx = idx;
          hitPowerUpIdx = -1;
        }
      });

      const beamLen = hitMosquitoIdx !== -1 || hitPowerUpIdx !== -1 ? closestDist : maxLen;
      const endX = origin.x + dx * beamLen;
      const endY = origin.y + dy * beamLen;

      sim.beams.push({
        id: sim.nextId++,
        x1: origin.x,
        y1: origin.y,
        x2: endX,
        y2: endY,
        hit: hitMosquitoIdx !== -1 || hitPowerUpIdx !== -1,
        life: 0.21,
        maxLife: 0.21,
      });

      if (hitPowerUpIdx !== -1) {
        const pu = sim.powerUps[hitPowerUpIdx];
        sim.powerUps.splice(hitPowerUpIdx, 1);
        sim.tripleShotTimer = 6.5;
        sim.lastTripleDisplaySec = 7;
        setTripleShotSeconds(7);
        anyHit = true;
        activatedPowerUp = true;

        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 75 + Math.random() * 170;
          sim.particles.push({
            x: pu.x,
            y: pu.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 20,
            size: 4 + Math.random() * 4,
            color: i % 2 === 0 ? '#38BDF8' : '#FFFFFF',
            alpha: 1,
            life: 0.45 + Math.random() * 0.2,
            maxLife: 0.65,
            rotation: Math.random() * Math.PI,
            vRot: (Math.random() - 0.5) * 12,
          });
        }

        sim.floatingTexts.push({
          x: pu.x,
          y: pu.y - 16,
          vy: -48,
          text: '3X SHOT!',
          color: '#38BDF8',
          life: 1.0,
          maxLife: 1.0,
          scale: 1.15,
        });
      } else if (hitMosquitoIdx !== -1) {
        const target = sim.mosquitoes[hitMosquitoIdx];
        anyHit = true;
        target.hp -= 1;
        target.hitFlash = 0.14;

        const isBoss = target.kind === 'boss';
        const isGolden = target.kind === 'golden';

        // Sticky splash at impact point
        sim.splats.push({
          id: sim.nextId++,
          x: target.x,
          y: target.y,
          scale: isBoss ? 1.35 : isGolden ? 1.18 : 0.95 + Math.random() * 0.25,
          rotation: (Math.random() - 0.5) * 1.4,
          life: 1.45,
          maxLife: 1.45,
        });

        const stickyPalette = ['#FFFFFF', '#F8FAFC', '#F1F5F9', 'rgba(255, 255, 255, 0.9)'];
        for (let i = 0; i < (isBoss && target.hp <= 0 ? 26 : 16); i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 65 + Math.random() * 190;
          sim.particles.push({
            x: target.x,
            y: target.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 35,
            size: 4.4 + Math.random() * 5.2,
            color: stickyPalette[i % stickyPalette.length],
            alpha: 1,
            life: 0.48 + Math.random() * 0.28,
            maxLife: 0.76,
            rotation: Math.random() * Math.PI,
            vRot: (Math.random() - 0.5) * 14,
          });
        }

        if (target.hp > 0) {
          // Boss survives hit: knock slightly upward & keep fighting (no heart restoration)
          mosquitoDamaged = true;
          target.y = Math.max(88, target.y - 18);
          if (target.state === 'diving') {
            target.state = 'roaming';
            target.stateTimer = 1.4;
          }
          sim.floatingTexts.push({
            x: target.x,
            y: target.y - 22,
            vy: -44,
            text: `HIT! (${target.hp})`,
            color: '#F472B6',
            life: 0.65,
            maxLife: 0.65,
            scale: 1,
          });
        } else {
          sim.mosquitoes.splice(hitMosquitoIdx, 1);
          mosquitoDefeated = true;
          if (isGolden) hitGolden = true;
          if (isBoss) hitBossKill = true;

          // Boss awards +5 bonus points (NEVER restores hearts)
          const points = isBoss ? 5 : isGolden ? 2 : 1;
          sim.combo += 1;
          if (sim.combo > sim.bestCombo) {
            sim.bestCombo = sim.combo;
            setBestCombo(sim.bestCombo);
          }
          sim.zappedCount += 1;
          setZappedCount(sim.zappedCount);

          sim.score += points;
          setScore(sim.score);

          if (sim.score > sim.bestScore) {
            const crossedOldBest = sim.bestScore > 0 && sim.score - points <= sim.bestScore;
            sim.bestScore = sim.score;
            setBestScore(sim.bestScore);
            setIsNewBest(true);
            localStorage.setItem(BEST_SCORE_KEY, String(sim.bestScore));
            if (crossedOldBest) {
              soundEngine.playNewBest();
            }
          }

          const label = isBoss
            ? 'BOSS! +5'
            : isGolden
              ? '+2'
              : target.state === 'diving'
                ? 'SAVE! +1'
                : '+1';

          sim.floatingTexts.push({
            x: target.x,
            y: target.y - 18,
            vy: -54,
            text: label,
            color: isBoss ? '#F472B6' : isGolden ? '#FACC15' : '#FFFFFF',
            life: isBoss ? 1.05 : 0.75,
            maxLife: isBoss ? 1.05 : 0.75,
            scale: isBoss ? 1.28 : isGolden ? 1.15 : 1,
          });
        }
      }
    }

    sim.shotCooldown = 0.14;
    const dtSinceLastShot = Math.max(0.14, sim.time - sim.lastShotTime);
    sim.lastShotTime = sim.time;
    const shotRateBoost = dtSinceLastShot < 1.5 ? Math.min(1.6, 0.36 / dtSinceLastShot) : 0.35;
    sim.fireMomentum = Math.min(2.0, Math.max(sim.fireMomentum * 0.65, 0) + shotRateBoost);

    // Muzzle pure-white sticky liquid droplets at nozzle
    const muzzlePalette = ['#FFFFFF', '#F8FAFC', 'rgba(255, 255, 255, 0.88)'];
    for (let i = 0; i < 6; i++) {
      const spread = sim.aimAngle + (Math.random() - 0.5) * 0.55;
      const spd = 90 + Math.random() * 140;
      sim.particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.sin(spread) * spd,
        vy: -Math.cos(spread) * spd,
        size: 3.6 + Math.random() * 2.8,
        color: muzzlePalette[i % muzzlePalette.length],
        alpha: 1,
        life: 0.24 + Math.random() * 0.12,
        maxLife: 0.36,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 12,
      });
    }

    if (anyHit) {
      if (activatedPowerUp) {
        soundEngine.playPowerUp();
      }
      if (mosquitoDefeated || mosquitoDamaged) {
        soundEngine.playZap(true);
        soundEngine.playHit(sim.combo, hitGolden || hitBossKill);
        soundEngine.playFireHit();
        if (fireModeRef.current === 'thirdLeg' && mosquitoDefeated) {
          soundEngine.playThirdLegHit();
        }
        sim.sleeperMood = 'happy';
        sim.moodTimer = 0.45;
        if (!prefersReducedMotion) {
          sim.shakeTime = hitBossKill ? 0.2 : 0.11;
          sim.shakeIntensity = hitBossKill ? 6 : 3.5;
        }
      }
      if (sim.mosquitoes.length === 0) {
        sim.spawnTimer = Math.min(sim.spawnTimer, 0.25);
      }
    } else {
      const missDx = Math.sin(sim.aimAngle);
      const missDy = -Math.cos(sim.aimAngle);
      sim.combo = 0;
      if (sim.score > 0) {
        sim.score = Math.max(0, sim.score - 1);
        setScore(sim.score);
        sim.floatingTexts.push({
          x: origin.x + missDx * 120,
          y: origin.y + missDy * 120,
          vy: -42,
          text: '-1',
          color: '#EF4444',
          life: 0.65,
          maxLife: 0.65,
          scale: 1,
        });
      }
      soundEngine.playZap(false);
      if (fireModeRef.current === 'thirdLeg') {
        soundEngine.playThirdLegMiss();
      }
    }
  }, [prefersReducedMotion]);

  // Resize canvas crisply for HiDPI displays
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      simRef.current.width = rect.width;
      simRef.current.height = rect.height;
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Main 60fps requestAnimationFrame loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const sim = simRef.current;
      const state = gameStateRef.current;
      sim.time += dt;

      // Keyboard continuous aiming
      if (state === 'PLAYING') {
        if (sim.keysPressed.left) {
          sim.aimAngle = Math.max(-1.12, sim.aimAngle - 2.1 * dt);
          sim.isAiming = true;
        }
        if (sim.keysPressed.right) {
          sim.aimAngle = Math.min(1.12, sim.aimAngle + 2.1 * dt);
          sim.isAiming = true;
        }
      }

      if (sim.shotCooldown > 0) {
        sim.shotCooldown = Math.max(0, sim.shotCooldown - dt);
      }

      if (state === 'PLAYING' && sim.tripleShotTimer > 0) {
        sim.tripleShotTimer = Math.max(0, sim.tripleShotTimer - dt);
        const ceilSec = Math.ceil(sim.tripleShotTimer);
        if (ceilSec !== sim.lastTripleDisplaySec) {
          sim.lastTripleDisplaySec = ceilSec;
          setTripleShotSeconds(ceilSec);
        }
      }

      if (state !== 'PAUSED') {
        sim.fireMomentum = Math.max(0, sim.fireMomentum - dt * 0.85);
        const aimBoost = state === 'PLAYING' && sim.isAiming ? 5 : 0;
        const scoreBoost = state === 'PLAYING' ? Math.min(14, sim.score * 0.45) : 0;
        const rubSpeed = 15 + aimBoost + sim.fireMomentum * 22 + scoreBoost;
        sim.rubPhase += dt * rubSpeed;
      }

      if (sim.moodTimer > 0) {
        sim.moodTimer -= dt;
        if (sim.moodTimer <= 0) {
          sim.sleeperMood = sim.isAiming ? 'aiming' : 'idle';
        }
      } else if (state === 'PLAYING') {
        sim.sleeperMood = sim.isAiming ? 'aiming' : 'idle';
      }

      if (sim.shakeTime > 0) {
        sim.shakeTime = Math.max(0, sim.shakeTime - dt);
      }
      if (sim.biteFlashAlpha > 0) {
        sim.biteFlashAlpha = Math.max(0, sim.biteFlashAlpha - dt * 2.4);
      }

      // Ambient Zzz bubbles on title or idle playing
      if (state === 'TITLE_MENU' || (state === 'PLAYING' && !sim.isAiming && sim.sleeperMood === 'idle')) {
        sim.zzzTimer -= dt;
        if (sim.zzzTimer <= 0) {
          sim.zzzTimer = state === 'TITLE_MENU' ? 0.9 : 1.5;
          const sleeper = getSleeperTarget(sim.width, sim.height);
          sim.zzzBubbles.push({
            x: sleeper.x - 16 + (Math.random() - 0.5) * 12,
            y: sleeper.y - 34,
            vy: -26 - Math.random() * 10,
            driftPhase: Math.random() * Math.PI * 2,
            life: 1.8,
            maxLife: 1.8,
            size: 15 + Math.random() * 7,
          });
        }
      }

      for (let i = sim.zzzBubbles.length - 1; i >= 0; i--) {
        const z = sim.zzzBubbles[i];
        z.y += z.vy * dt;
        z.driftPhase += dt * 3;
        z.life -= dt;
        if (z.life <= 0) sim.zzzBubbles.splice(i, 1);
      }

      // Update active gameplay (difficulty ramps continuously with elapsed playTime & score)
      if (state === 'PLAYING') {
        sim.playTime += dt;
        const d = getDifficultyLevel(sim.playTime, sim.score);
        const maxActive =
          d >= 6.8 ? 7 : d >= 5.0 ? 6 : d >= 3.6 ? 5 : d >= 2.4 ? 4 : d >= 1.4 ? 3 : d >= 0.65 ? 2 : 1;

        // Spawn Boss Mosquito periodically when score reaches milestone
        const hasBossActive = sim.mosquitoes.some((m) => m.kind === 'boss');
        if (sim.score >= sim.nextBossScore && !hasBossActive) {
          spawnMosquito(sim.score, sim.playTime, true);
          sim.nextBossScore = sim.score + 12;
        }

        sim.spawnTimer -= dt;
        if (sim.spawnTimer <= 0 && sim.mosquitoes.length < maxActive) {
          spawnMosquito(sim.score, sim.playTime, false);
          sim.spawnTimer = Math.max(0.38, 1.65 - d * 0.22);
        }

        // Spawn Triple Shot power-up periodically
        if (sim.powerUps.length === 0 && sim.tripleShotTimer <= 0) {
          sim.powerUpTimer -= dt;
          if (sim.powerUpTimer <= 0) {
            spawnPowerUp();
            sim.powerUpTimer = 18 + Math.random() * 7;
          }
        }

        for (let i = sim.powerUps.length - 1; i >= 0; i--) {
          const pu = sim.powerUps[i];
          pu.phase += dt * 4.2;
          pu.x += pu.vx * dt;
          pu.y += Math.sin(pu.phase) * 32 * dt;
          if (pu.x < -36 || pu.x > sim.width + 36) {
            sim.powerUps.splice(i, 1);
          }
        }

        const sleeper = getSleeperTarget(sim.width, sim.height);
        const topBound = Math.max(92, sim.height * 0.13);
        const bottomRoamBound = sim.height * 0.53;
        const leftBound = 32;
        const rightBound = sim.width - 32;
        const wobbleAmp = 36 + Math.min(d * 8, 44);
        const shiftRate = 1.5 + Math.min(d * 0.45, 2.8);

        for (let i = sim.mosquitoes.length - 1; i >= 0; i--) {
          const m = sim.mosquitoes[i];
          if (m.hitFlash > 0) {
            m.hitFlash = Math.max(0, m.hitFlash - dt);
          }
          m.wingPhase += dt * (m.state === 'diving' ? 58 : 42);
          m.wobblePhase += dt * m.wobbleSpeed;

          if (m.state === 'roaming') {
            m.x += m.vx * dt;
            m.y += (m.vy + Math.sin(m.wobblePhase) * wobbleAmp) * dt;

            // Erratic mosquito dodging shifts increase over time
            if (Math.random() < dt * shiftRate) {
              const spd = Math.hypot(m.vx, m.vy);
              const shift = (Math.random() - 0.5) * 1.25;
              const ang = Math.atan2(m.vy, m.vx) + shift;
              m.vx = Math.cos(ang) * spd;
              m.vy = Math.sin(ang) * spd;
            }

            // Keep inside upper play zone
            if (m.x < leftBound) {
              m.x = leftBound;
              m.vx = Math.abs(m.vx);
            } else if (m.x > rightBound) {
              m.x = rightBound;
              m.vx = -Math.abs(m.vx);
            }
            if (m.y < topBound) {
              m.y = topBound;
              m.vy = Math.abs(m.vy);
            } else if (m.y > bottomRoamBound) {
              m.y = bottomRoamBound;
              m.vy = -Math.abs(m.vy);
            }

            m.facing = m.vx >= 0 ? -1 : 1;
            m.stateTimer -= dt;

            if (m.stateTimer <= 0) {
              m.state = 'telegraph';
              m.stateTimer = Math.max(0.32, 0.62 - d * 0.045);
              m.diveTargetX = sleeper.x + (Math.random() - 0.5) * 28;
              m.diveTargetY = sleeper.y;
              soundEngine.playDiveAlert();
            }
          } else if (m.state === 'telegraph') {
            // Hover and jitter before diving
            m.x += Math.sin(sim.time * 45) * 1.1;
            m.y += Math.cos(sim.time * 40) * 0.9;
            m.facing = m.diveTargetX >= m.x ? -1 : 1;
            m.stateTimer -= dt;
            if (m.stateTimer <= 0) {
              m.state = 'diving';
              const dx = m.diveTargetX - m.x;
              const dy = m.diveTargetY - m.y;
              const dist = Math.hypot(dx, dy) || 1;
              const diveSpeed =
                m.kind === 'boss'
                  ? 195 + Math.min(d * 24, 180)
                  : 240 + Math.min(d * 42, 320);
              m.vx = (dx / dist) * diveSpeed;
              m.vy = (dy / dist) * diveSpeed;
            }
          } else if (m.state === 'diving') {
            m.x += m.vx * dt;
            m.y += m.vy * dt;

            const distToSleeper = Math.hypot(m.x - m.diveTargetX, m.y - m.diveTargetY);
            if (distToSleeper < 24 || m.y >= sleeper.y + 8) {
              // Mosquito bit the sleeper!
              sim.mosquitoes.splice(i, 1);
              sim.lives -= 1;
              sim.combo = 0;
              setLives(sim.lives);

              soundEngine.playBite();
              if (sim.lives <= 0) {
                soundEngine.playDeathSound();
              } else if (fireModeRef.current === 'thirdLeg') {
                soundEngine.playThirdLegBite();
              }
              sim.sleeperMood = 'bitten';
              sim.moodTimer = 0.75;
              sim.biteFlashAlpha = 1;
              if (!prefersReducedMotion) {
                sim.shakeTime = 0.25;
                sim.shakeIntensity = 7;
              }

              sim.floatingTexts.push({
                x: sleeper.x,
                y: sleeper.y - 36,
                vy: -40,
                text: 'OUCH!',
                color: '#DC2626',
                life: 0.85,
                maxLife: 0.85,
                scale: 1.1,
              });

              if (sim.lives <= 0) {
                sim.isAiming = false;
                sim.pointerId = null;
                setGameState('GAME_OVER');
                syncRunToCloud(sim.score, fireModeRef.current, sim.zappedCount, sim.bestCombo);
              } else {
                sim.spawnTimer = Math.min(sim.spawnTimer, 0.45);
              }
            }
          }
        }
      }

      // Beams, splats, particles & floating text keep animating cleanly even on Game Over
      if (state !== 'PAUSED') {
        for (let i = sim.beams.length - 1; i >= 0; i--) {
          sim.beams[i].life -= dt;
          if (sim.beams[i].life <= 0) sim.beams.splice(i, 1);
        }

        for (let i = sim.splats.length - 1; i >= 0; i--) {
          sim.splats[i].life -= dt;
          if (sim.splats[i].life <= 0) sim.splats.splice(i, 1);
        }

        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 320 * dt; // gravity
          p.rotation += p.vRot * dt;
          p.life -= dt;
          p.alpha = Math.max(0, p.life / p.maxLife);
          if (p.life <= 0) sim.particles.splice(i, 1);
        }

        for (let i = sim.floatingTexts.length - 1; i >= 0; i--) {
          const ft = sim.floatingTexts[i];
          ft.y += ft.vy * dt;
          ft.life -= dt;
          if (ft.life <= 0) sim.floatingTexts.splice(i, 1);
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const origin = getBedOrigin(sim.width, sim.height, fireModeRef.current);
        const shakeMag =
          sim.shakeTime > 0 && !prefersReducedMotion ? sim.shakeIntensity * (sim.shakeTime / 0.2) : 0;
        const shakeX = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag * 2 : 0;
        const shakeY = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag * 2 : 0;

        renderGame({
          ctx,
          width: sim.width,
          height: sim.height,
          time: sim.time,
          originX: origin.x,
          originY: origin.y,
          aimAngle: sim.aimAngle,
          isAiming: state === 'PLAYING' && sim.isAiming,
          mosquitoes: sim.mosquitoes,
          powerUps: sim.powerUps,
          beams: sim.beams,
          splats: sim.splats,
          particles: sim.particles,
          floatingTexts: sim.floatingTexts,
          zzzBubbles: sim.zzzBubbles,
          avatarStyle: avatarStyleRef.current,
          fireMode: fireModeRef.current,
          sleeperMood: sim.sleeperMood,
          customAvatarImg: customAvatarImgRef.current,
          rubPhase: sim.rubPhase,
          fireIntensity: sim.fireMomentum,
          tripleShotTimer: sim.tripleShotTimer,
          shakeX,
          shakeY,
          biteFlashAlpha: sim.biteFlashAlpha,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [prefersReducedMotion, spawnMosquito, spawnPowerUp, syncRunToCloud]);

  // Keyboard support (Left/Right or A/D to aim, Space/Enter to fire, Escape/P to pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (leaderboardOpen) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        simRef.current.keysPressed.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        simRef.current.keysPressed.right = true;
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (gameStateRef.current === 'PLAYING') {
          e.preventDefault();
          fireBeam();
        }
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (gameStateRef.current === 'PLAYING') {
          soundEngine.stopThirdLegEffect();
          setGameState('PAUSED');
        } else if (gameStateRef.current === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        simRef.current.keysPressed.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        simRef.current.keysPressed.right = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fireBeam, leaderboardOpen]);

  // Cleanup custom object URL on unmount
  useEffect(() => {
    return () => {
      if (customAvatarUrlRef.current) {
        URL.revokeObjectURL(customAvatarUrlRef.current);
      }
    };
  }, []);

  const updateAimFromPointer = (clientX: number, clientY: number, isInitialPress: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const sim = simRef.current;
    const origin = getBedOrigin(sim.width, sim.height, fireModeRef.current);

    if (py < origin.y - 36) {
      const dx = px - origin.x;
      const dy = origin.y - py;
      const angle = Math.atan2(dx, Math.max(24, dy));
      sim.aimAngle = Math.max(-1.12, Math.min(1.12, angle));
      sim.dragStartX = px;
      sim.dragStartAngle = sim.aimAngle;
    } else if (isInitialPress) {
      sim.dragStartX = px;
      sim.dragStartAngle = sim.aimAngle;
    } else {
      const deltaX = px - sim.dragStartX;
      const angle = sim.dragStartAngle + deltaX * 0.008;
      sim.aimAngle = Math.max(-1.12, Math.min(1.12, angle));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const sim = simRef.current;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const px = rect ? e.clientX - rect.left : e.clientX;
    const py = rect ? e.clientY - rect.top : e.clientY;

    sim.pointerId = e.pointerId;
    sim.isAiming = true;
    sim.dragStartY = py;
    sim.pointerMovedDist = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAimFromPointer(e.clientX, e.clientY, true);
    if (rect) {
      sim.dragStartX = px;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const sim = simRef.current;
    if (!sim.isAiming || sim.pointerId !== e.pointerId) return;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (rect) {
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      sim.pointerMovedDist = Math.max(
        sim.pointerMovedDist,
        Math.hypot(px - sim.dragStartX, py - sim.dragStartY)
      );
    }
    updateAimFromPointer(e.clientX, e.clientY, false);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const sim = simRef.current;
    if (!sim.isAiming || sim.pointerId !== e.pointerId) return;
    updateAimFromPointer(e.clientX, e.clientY, false);
    sim.isAiming = false;
    sim.pointerId = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    fireBeam();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (sim.pointerId === e.pointerId) {
      sim.isAiming = false;
      sim.pointerId = null;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const selectAvatar = (style: AvatarStyle) => {
    setAvatarStyle(style);
    if (style !== 'custom') {
      localStorage.setItem(AVATAR_STYLE_KEY, style);
    }
  };

  const selectFireMode = (mode: FireMode) => {
    setFireMode(mode);
    localStorage.setItem(FIRE_MODE_KEY, mode);
    if (mode !== 'thirdLeg') {
      soundEngine.stopThirdLegEffect();
    }
  };

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customAvatarUrlRef.current) {
      URL.revokeObjectURL(customAvatarUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    customAvatarUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      customAvatarImgRef.current = img;
      setHasCustomImage(true);
      setAvatarStyle('custom');
    };
    img.src = url;
    e.target.value = '';
  };

  const handleShareScore = async () => {
    const modeLabel = fireMode === 'hand' ? 'Normal' : '3rd Leg';
    const text = `I scored ${score} pts (${zappedCount} mosquitoes zapped, ${bestCombo}x streak) in Chudling Pong (${modeLabel} mode)!`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Chudling Pong',
          text,
          url: window.location.origin,
        });
        setShareLabel('Shared!');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        setShareLabel('Copied!');
      }
    } catch {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
          setShareLabel('Copied!');
        }
      } catch {
        // Ignore user cancel
      }
    }
    setTimeout(() => setShareLabel('Share'), 2000);
  };

  return (
    <main className="h-dvh w-full overflow-hidden flex items-center justify-center bg-[#020203] md:p-4 select-none">
      {/* Vertical Arcade Playfield Stage */}
      <div
        ref={containerRef}
        className="relative w-full h-full md:h-[min(94dvh,860px)] md:max-w-[480px] md:rounded-[28px] md:shadow-[0_24px_60px_rgba(0,0,0,0.65)] md:border md:border-white/10 overflow-hidden bg-[#050507]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="block w-full h-full touch-none cursor-crosshair"
        />

        {/* Top HUD */}
        <header className="pointer-events-none absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-4 z-10">
          {/* Top-Left Close / Back to Menu button */}
          <button
            type="button"
            onClick={() => {
              if (gameState === 'TITLE_MENU') return;
              resetSimulation(gameMode, false);
            }}
            aria-label="Return to main menu"
            className={`pointer-events-auto w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/15 active:scale-95 text-white flex items-center justify-center shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              gameState === 'TITLE_MENU' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <X className="w-5 h-5" strokeWidth={2.75} />
          </button>

          {/* Top-Center Score + BEST + Sleep Hearts + Triple Shot indicator */}
          <div className="flex flex-col items-center text-center pt-1">
            <span className="font-display text-4xl font-extrabold leading-none tracking-tight text-white tabular-nums">
              {score}
            </span>
            <span className="mt-1 text-[11px] font-bold tracking-wider uppercase text-zinc-400 tabular-nums">
              BEST {bestScore}
            </span>
            {gameState !== 'TITLE_MENU' && (
              <div
                className="mt-2 flex items-center gap-1.5"
                aria-label={`Lives remaining: ${lives} of ${maxLives}`}
              >
                {Array.from({ length: maxLives }).map((_, idx) => {
                  const alive = idx < lives;
                  return (
                    <Heart
                      key={idx}
                      className={`w-4 h-4 transition-transform duration-200 ${
                        alive
                          ? 'text-[#EF4444] fill-[#EF4444] scale-100'
                          : 'text-white/25 fill-transparent scale-90'
                      }`}
                    />
                  );
                })}
              </div>
            )}
            {gameState === 'PLAYING' && tripleShotSeconds > 0 && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-sky-500/25 border border-sky-400/50 px-2 py-0.5 text-[11px] font-extrabold text-sky-200 tabular-nums">
                <Zap className="w-3 h-3 fill-sky-300 text-sky-300" />
                3X SHOT {tripleShotSeconds}s
              </div>
            )}
          </div>

          {/* Top-Right Sound & Pause buttons */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="w-11 h-11 rounded-xl bg-white/12 hover:bg-white/22 border border-white/15 text-white flex items-center justify-center shadow-sm transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {gameState !== 'TITLE_MENU' && gameState !== 'GAME_OVER' && (
              <button
                type="button"
                onClick={() => {
                  if (gameState === 'PAUSED') {
                    setGameState('PLAYING');
                  } else {
                    soundEngine.stopThirdLegEffect();
                    setGameState('PAUSED');
                  }
                }}
                aria-label={gameState === 'PAUSED' ? 'Resume game' : 'Pause game'}
                className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 active:scale-95 text-white flex items-center justify-center shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {gameState === 'PAUSED' ? (
                  <Play className="w-5 h-5 fill-current" />
                ) : (
                  <Pause className="w-5 h-5 fill-current" />
                )}
              </button>
            )}
          </div>
        </header>

        {/* Clean Two-Mode Title Menu Overlay */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-x-0 top-16 bottom-0 flex flex-col items-center justify-start px-5 pt-5 pb-6 z-20 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-[324px] bg-white/94 backdrop-blur-sm border border-black/10 rounded-2xl p-4 shadow-[0_14px_34px_rgba(0,0,0,0.35)] flex flex-col gap-3">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-center text-[#1E1C21]">
                Chudling Pong
              </h1>

              {/* 2 Playable Modes: Normal vs 3rd Leg */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectFireMode('hand')}
                  className={`flex items-center justify-center py-3 px-2.5 rounded-xl border text-center transition-all ${
                    fireMode === 'hand'
                      ? 'bg-[#1E1C21] text-white border-[#1E1C21] shadow-sm'
                      : 'bg-[#F4F1F0] text-[#232024] border-black/8 hover:bg-[#EAE6E4]'
                  }`}
                >
                  <span className="text-sm font-bold leading-tight">Normal</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectFireMode('thirdLeg')}
                  className={`flex items-center justify-center py-3 px-2.5 rounded-xl border text-center transition-all ${
                    fireMode === 'thirdLeg'
                      ? 'bg-[#1E1C21] text-white border-[#1E1C21] shadow-sm'
                      : 'bg-[#F4F1F0] text-[#232024] border-black/8 hover:bg-[#EAE6E4]'
                  }`}
                >
                  <span className="text-sm font-bold leading-tight">3rd Leg</span>
                </button>
              </div>

              {/* Minimal single-row face selector */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomPhotoUpload}
                className="hidden"
              />
              <div className="grid grid-cols-5 gap-1.5 bg-[#EFECEB] p-1 rounded-xl">
                {AVATAR_OPTIONS.map((opt) => {
                  const active = avatarStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectAvatar(opt.id)}
                      aria-label={opt.label}
                      title={opt.label}
                      className={`py-1.5 text-base rounded-lg transition-all flex items-center justify-center ${
                        active ? 'bg-white shadow-sm scale-[1.02]' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {opt.emoji}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload custom face photo"
                  title="Custom Photo"
                  className={`py-1.5 rounded-lg transition-all flex items-center justify-center ${
                    avatarStyle === 'custom' && hasCustomImage
                      ? 'bg-white text-[#1E1C21] shadow-sm'
                      : 'text-[#5E5A63] hover:text-[#1E1C21]'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 px-6 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] active:scale-[0.98] text-white font-bold text-base shadow-[0_6px_18px_rgba(239,68,68,0.28)] transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E1C21]"
              >
                Start Game
              </button>

              <button
                type="button"
                onClick={() => setLeaderboardOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EFECEB] hover:bg-[#E4E0DE] text-[#1E1C21] font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                Global Leaderboard
              </button>

              <div className="bg-[#18181F] rounded-xl">
                <PWAInstallButton />
              </div>
            </div>
          </div>
        )}

        {/* Pause Modal */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center px-6 z-30">
            <div className="w-full max-w-[310px] bg-white rounded-2xl p-6 border border-black/10 shadow-xl flex flex-col gap-3 text-center">
              <h2 className="font-display text-2xl font-extrabold text-[#1E1C21]">Paused</h2>
              <p className="text-sm text-[#5A5660] tabular-nums">
                Score {score} · Best {bestScore}
              </p>
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="mt-2 w-full py-3 px-5 rounded-xl bg-[#232024] hover:bg-[#18161A] text-white font-bold text-sm transition-colors whitespace-nowrap shrink-0"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 px-5 rounded-xl bg-[#EFECEB] hover:bg-[#E4E0DE] text-[#1E1C21] font-bold text-sm transition-colors whitespace-nowrap shrink-0"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => resetSimulation(gameMode, false)}
                className="w-full py-2.5 px-5 rounded-xl text-[#5E5A63] hover:text-[#1E1C21] font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-6 z-30">
            <div className="w-full max-w-[324px] bg-white rounded-2xl p-6 border border-black/10 shadow-xl flex flex-col items-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                Mosquito Bit You
              </span>
              <h2 className="mt-1 font-display text-3xl font-extrabold text-[#1E1C21]">
                Woke Up!
              </h2>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-extrabold text-[#1E1C21] tabular-nums">
                  {score}
                </span>
                <span className="text-sm font-bold text-[#5E5A63]">pts</span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#5E5A63] tabular-nums">
                <span>{isNewBest ? 'New Best Score' : `Best ${bestScore}`}</span>
                <span aria-hidden="true">·</span>
                <span>{zappedCount} Zapped</span>
                <span aria-hidden="true">·</span>
                <span>{bestCombo}x Streak</span>
              </div>

              {cloudStatus && (
                <p className="mt-2 text-[11px] font-bold text-emerald-600">{cloudStatus}</p>
              )}

              <button
                type="button"
                onClick={startGame}
                className="mt-5 w-full py-3.5 px-6 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] active:scale-[0.98] text-white font-bold text-base shadow-[0_6px_18px_rgba(239,68,68,0.28)] inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>

              <div className="mt-2.5 w-full grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShareScore}
                  className="py-2.5 px-3 rounded-xl bg-[#EFECEB] hover:bg-[#E4E0DE] text-[#1E1C21] font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {shareLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen(true)}
                  className="py-2.5 px-3 rounded-xl bg-[#EFECEB] hover:bg-[#E4E0DE] text-[#1E1C21] font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  Leaderboard
                </button>
              </div>

              <button
                type="button"
                onClick={() => resetSimulation(gameMode, false)}
                className="mt-2 w-full py-2 px-4 rounded-xl text-[#5E5A63] hover:text-[#1E1C21] font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}
      </div>

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        entries={leaderboardEntries}
        loading={leaderboardLoading}
        errorText={leaderboardError}
        user={user}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        bestScore={Math.max(score, bestScore)}
        bestMode={fireMode}
        bestZapped={zappedCount}
        bestCombo={bestCombo}
      />

      <OfflineIndicator />
    </main>
  );
}
