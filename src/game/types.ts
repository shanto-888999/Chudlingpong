export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type GameMode = 'arcade' | 'classic';

export type FireMode = 'hand' | 'thirdLeg';

export type AvatarStyle = 'sleepy' | 'emoji' | 'cool' | 'uncle' | 'custom';

export type SleeperMood = 'idle' | 'aiming' | 'happy' | 'bitten';

export interface Mosquito {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  wingPhase: number;
  wobblePhase: number;
  wobbleSpeed: number;
  kind: 'normal' | 'golden' | 'boss';
  hp: number;
  maxHp: number;
  hitFlash: number;
  state: 'roaming' | 'telegraph' | 'diving';
  stateTimer: number;
  diveTargetX: number;
  diveTargetY: number;
  facing: 1 | -1;
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  kind: 'triple';
}

export interface BeamEffect {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hit: boolean;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  outline?: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
}

export interface PoopSplat {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface ZzzBubble {
  x: number;
  y: number;
  vy: number;
  driftPhase: number;
  life: number;
  maxLife: number;
  size: number;
}
