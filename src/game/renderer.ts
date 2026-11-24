import {
  AvatarStyle,
  BeamEffect,
  FireMode,
  FloatingText,
  Mosquito,
  Particle,
  PoopSplat,
  PowerUp,
  SleeperMood,
  ZzzBubble,
} from './types';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  originX: number;
  originY: number;
  aimAngle: number; // radians, 0 = straight up
  isAiming: boolean;
  mosquitoes: Mosquito[];
  powerUps: PowerUp[];
  beams: BeamEffect[];
  splats: PoopSplat[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  zzzBubbles: ZzzBubble[];
  avatarStyle: AvatarStyle;
  fireMode: FireMode;
  sleeperMood: SleeperMood;
  customAvatarImg: HTMLImageElement | null;
  rubPhase: number;
  fireIntensity: number;
  tripleShotTimer: number;
  shakeX: number;
  shakeY: number;
  biteFlashAlpha: number;
}

function getBedLayout(width: number, height: number): { cx: number; cy: number; scale: number } {
  return {
    cx: width * 0.5,
    cy: height * 0.77,
    scale: Math.min(width / 390, height / 760) * 1.24,
  };
}

export function getBedOrigin(
  width: number,
  height: number,
  fireMode: FireMode = 'thirdLeg'
): { x: number; y: number } {
  const { cx, cy, scale } = getBedLayout(width, height);
  if (fireMode === 'hand') {
    return {
      x: cx - 12 * scale,
      y: cy - 39 * scale,
    };
  }
  return {
    x: cx + 14 * scale,
    y: cy - 11 * scale,
  };
}

export function getSleeperTarget(width: number, height: number): { x: number; y: number } {
  return {
    x: width * 0.44,
    y: height * 0.76,
  };
}

export function renderGame(rc: RenderContext): void {
  const { ctx, width, height, shakeX, shakeY } = rc;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Deep black night-room backdrop + subtle moon & twinkling stars
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#050507');
  bgGrad.addColorStop(0.75, '#0B0B10');
  bgGrad.addColorStop(1, '#050507');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  drawNightAmbience(ctx, width, height, rc.time);

  ctx.translate(shakeX, shakeY);

  // Subtle floor shadow under bed
  drawBedAndSleeper(rc);

  // Dashed aim line when aiming
  if (rc.isAiming) {
    drawAimLine(ctx, rc.originX, rc.originY, rc.aimAngle, width, height, rc.time, rc.tripleShotTimer > 0);
  }

  // Zzz sleep bubbles
  for (const z of rc.zzzBubbles) {
    const progress = 1 - z.life / z.maxLife;
    const alpha = Math.sin(progress * Math.PI) * 0.65;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#E2E8F0';
    ctx.font = `800 ${Math.round(z.size)}px "Bricolage Grotesque", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Z', z.x + Math.sin(z.driftPhase) * 6, z.y);
    ctx.restore();
  }

  // Lingering pure-white sticky splat stains where mosquitoes were hit
  for (const s of rc.splats) {
    drawPoopSplat(ctx, s);
  }

  // Triple-shot power-up orbs
  for (const pu of rc.powerUps) {
    drawPowerUp(ctx, pu, rc.time);
  }

  // Mosquitoes
  for (const m of rc.mosquitoes) {
    drawMosquito(ctx, m, rc.time);
  }

  // Sticky white zap streams
  for (const b of rc.beams) {
    drawBeam(ctx, b);
  }

  // Gooey crow-poop splat droplets
  for (const p of rc.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.65, p.size * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.outline) {
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Floating +1 / +2 text
  for (const ft of rc.floatingTexts) {
    const t = 1 - ft.life / ft.maxLife;
    const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(ft.x, ft.y);
    ctx.scale(ft.scale, ft.scale);
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#070709';
    ctx.strokeText(ft.text, 0, 0);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    ctx.restore();
  }

  ctx.restore();

  // Subtle red bite flash on screen edges when bitten
  if (rc.biteFlashAlpha > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(220, 38, 38, ${rc.biteFlashAlpha * 0.24})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

const NIGHT_STARS: ReadonlyArray<{ x: number; y: number; r: number; speed: number; phase: number }> = [
  { x: 0.12, y: 0.09, r: 1.4, speed: 1.8, phase: 0.2 },
  { x: 0.28, y: 0.14, r: 1.1, speed: 2.3, phase: 1.5 },
  { x: 0.43, y: 0.07, r: 1.3, speed: 1.5, phase: 2.8 },
  { x: 0.61, y: 0.12, r: 1.5, speed: 2.1, phase: 0.9 },
  { x: 0.77, y: 0.08, r: 1.2, speed: 1.9, phase: 3.4 },
  { x: 0.89, y: 0.17, r: 1.4, speed: 2.6, phase: 2.1 },
  { x: 0.19, y: 0.25, r: 1.0, speed: 1.7, phase: 4.1 },
  { x: 0.69, y: 0.24, r: 1.2, speed: 2.4, phase: 5.0 },
  { x: 0.34, y: 0.31, r: 1.1, speed: 1.6, phase: 1.1 },
  { x: 0.84, y: 0.33, r: 1.3, speed: 2.2, phase: 3.9 },
];

function drawNightAmbience(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void {
  ctx.save();

  // Soft crescent moon glow in upper-right sky
  const moonX = width * 0.84;
  const moonY = Math.max(76, height * 0.13);
  const halo = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 54);
  halo.addColorStop(0, 'rgba(254, 240, 138, 0.16)');
  halo.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(254, 249, 195, 0.42)';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#07070B';
  ctx.beginPath();
  ctx.arc(moonX + 6, moonY - 4, 14, 0, Math.PI * 2);
  ctx.fill();

  // Gentle twinkling stars
  for (const s of NIGHT_STARS) {
    const alpha = 0.18 + 0.28 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
    ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(width * s.x, height * s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, time: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 7 + pu.phase);
  ctx.save();
  ctx.translate(pu.x, pu.y);

  // Outer cyan-white aura
  const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, pu.radius + 14 + pulse * 4);
  aura.addColorStop(0, 'rgba(56, 189, 248, 0.48)');
  aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, pu.radius + 14 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();

  // Glossy orb
  ctx.fillStyle = '#0EA5E9';
  ctx.strokeStyle = '#E0F2FE';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, pu.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Crisp 3X label
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 12px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('3X', 0, 1);

  ctx.restore();
}

function drawAimLine(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  angle: number,
  width: number,
  height: number,
  time: number,
  tripleActive: boolean
): void {
  const angles = tripleActive ? [angle - 0.22, angle, angle + 0.22] : [angle];
  const maxDist = Math.hypot(width, height);

  ctx.save();
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i];
    const isSide = tripleActive && i !== 1;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const endX = ox + dx * maxDist;
    const endY = oy + dy * maxDist;

    ctx.strokeStyle = tripleActive
      ? isSide
        ? 'rgba(56, 189, 248, 0.58)'
        : 'rgba(224, 242, 254, 0.9)'
      : 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = isSide ? 2.1 : 2.8;
    ctx.lineCap = 'round';
    ctx.setLineDash([9, 9]);
    ctx.lineDashOffset = -(time * 55) % 18;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Origin ring on nozzle
  ctx.setLineDash([]);
  ctx.fillStyle = tripleActive ? 'rgba(56, 189, 248, 0.28)' : 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.arc(ox, oy, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = tripleActive ? '#E0F2FE' : '#FFFFFF';
  ctx.beginPath();
  ctx.arc(ox, oy, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStickyWhiteSplat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
  stretchDrip: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Stretchy vertical sticky strands hanging downward (athalo effect)
  if (stretchDrip > 0.5) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.24, radius * 0.25);
    ctx.quadraticCurveTo(-radius * 0.06, radius * 0.75 + stretchDrip * 0.55, -radius * 0.14, radius * 0.95 + stretchDrip);
    ctx.arc(-radius * 0.05, radius * 0.95 + stretchDrip, radius * 0.14, Math.PI, 0, true);
    ctx.quadraticCurveTo(radius * 0.08, radius * 0.7 + stretchDrip * 0.5, radius * 0.18, radius * 0.25);
    ctx.closePath();
    ctx.fill();

    // Second thinner sticky strand
    ctx.beginPath();
    ctx.moveTo(radius * 0.26, radius * 0.18);
    ctx.quadraticCurveTo(radius * 0.36, radius * 0.55 + stretchDrip * 0.4, radius * 0.34, radius * 0.72 + stretchDrip * 0.72);
    ctx.arc(radius * 0.28, radius * 0.72 + stretchDrip * 0.72, radius * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.rotate(rotation);

  // Soft translucent white halo for viscous wet volume
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
  ctx.fill();

  // Pure white thick gooey splat body with smooth rounded lobes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const lobes = 7;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < lobes * 2; i++) {
    const ang = (i / (lobes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? radius * (0.94 + (i % 3) * 0.13) : radius * 0.68;
    pts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
  }
  const len = pts.length;
  ctx.moveTo((pts[len - 1].x + pts[0].x) / 2, (pts[len - 1].y + pts[0].y) / 2);
  for (let i = 0; i < len; i++) {
    const next = pts[(i + 1) % len];
    const midX = (pts[i].x + next.x) / 2;
    const midY = (pts[i].y + next.y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  ctx.closePath();
  ctx.fill();

  // Subtle pearly sheen on lower curve for 3D thick-liquid feel
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, radius * 0.08, radius * 0.56, 0.2 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();

  // Bright glossy wet highlight crescent
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(-radius * 0.22, -radius * 0.22, radius * 0.28, Math.PI, Math.PI * 1.65);
  ctx.stroke();

  ctx.restore();
}

function drawPoopSplat(ctx: CanvasRenderingContext2D, splat: PoopSplat): void {
  const progress = splat.life / splat.maxLife;
  const alpha = Math.min(1, progress * 1.55);
  const stretchDrip = (1 - progress) * 24;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha * 0.94);
  drawStickyWhiteSplat(
    ctx,
    splat.x,
    splat.y + (1 - progress) * 6,
    17 * splat.scale,
    splat.rotation,
    stretchDrip
  );
  ctx.restore();
}

function drawBeam(ctx: CanvasRenderingContext2D, beam: BeamEffect): void {
  const progress = beam.life / beam.maxLife; // 1 -> 0
  const alpha = Math.min(1, progress * 1.5);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';

  // Soft milky-white outer viscous sheen
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.lineWidth = 14 * progress + 5;
  ctx.beginPath();
  ctx.moveTo(beam.x1, beam.y1);
  ctx.lineTo(beam.x2, beam.y2);
  ctx.stroke();

  // Thick pure-white sticky liquid jet
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 7.8 * progress + 2.4;
  ctx.beginPath();
  ctx.moveTo(beam.x1, beam.y1);
  ctx.lineTo(beam.x2, beam.y2);
  ctx.stroke();

  // Viscous globules beaded along the stream so it looks thick & gooey
  const dx = beam.x2 - beam.x1;
  const dy = beam.y2 - beam.y1;
  const dist = Math.hypot(dx, dy) || 1;
  const steps = Math.max(2, Math.min(9, Math.floor(dist / 42)));
  ctx.fillStyle = '#FFFFFF';
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = beam.x1 + dx * t;
    const gy = beam.y1 + dy * t;
    const r = (4.2 + (i % 2) * 2.1) * progress + 1.4;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pure-white sticky splash puff at nozzle
  drawStickyWhiteSplat(ctx, beam.x1, beam.y1, 9.5 * (1.15 - progress * 0.2), 0.3, 4);

  // Juicy pure-white sticky splash on the mosquito's body when hit
  if (beam.hit) {
    const splatRadius = 20 + (1 - progress) * 10;
    drawStickyWhiteSplat(ctx, beam.x2, beam.y2, splatRadius, beam.id * 0.7, (1 - progress) * 14);
  }

  ctx.restore();
}

function drawMosquito(ctx: CanvasRenderingContext2D, m: Mosquito, time: number): void {
  ctx.save();
  ctx.translate(m.x, m.y);

  // Boss HP bar above mosquito
  if (m.kind === 'boss') {
    const barW = 40;
    const barH = 5;
    const barY = -m.radius - 14;
    ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
    ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
    const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
    ctx.fillStyle = ratio > 0.5 ? '#EC4899' : '#EF4444';
    ctx.fillRect(-barW / 2, barY, barW * ratio, barH);
  }

  // Subtle dive telegraph warning ring
  if (m.state === 'telegraph') {
    const pulse = 0.5 + 0.5 * Math.sin(time * 26);
    ctx.strokeStyle = `rgba(220, 38, 38, ${0.35 + pulse * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius + 7 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (m.state === 'diving') {
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -14);
    ctx.lineTo(-4, -26);
    ctx.moveTo(8, -14);
    ctx.lineTo(4, -26);
    ctx.stroke();
  }

  const tilt = Math.sin(m.wobblePhase) * 0.16;
  ctx.rotate(tilt);
  ctx.scale(m.facing, 1);

  const wingFlap = Math.sin(m.wingPhase);
  const scale = m.kind === 'boss' ? 1.52 : m.kind === 'golden' ? 1.08 : 1;
  ctx.scale(scale, scale);

  // Back wing
  ctx.save();
  ctx.translate(-1, -4);
  ctx.rotate(-0.45 + wingFlap * 0.55);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.ellipse(-4, -10, 4.5, 11, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Legs (6 natural brownish-tan mosquito legs, clearly visible on black)
  ctx.strokeStyle = m.kind === 'boss' ? '#C084FC' : '#A88E78';
  ctx.lineWidth = 1.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Front leg
  ctx.moveTo(-4, 2);
  ctx.lineTo(-9, 8);
  ctx.lineTo(-13, 12);
  // Mid leg
  ctx.moveTo(0, 3);
  ctx.lineTo(-2, 10);
  ctx.lineTo(-5, 15);
  // Back leg
  ctx.moveTo(5, 2);
  ctx.lineTo(10, 9);
  ctx.lineTo(15, 13);
  ctx.stroke();

  // Red / Golden / Boss abdomen without white shield border
  ctx.save();
  ctx.translate(8, 2);
  ctx.rotate(0.28);
  const abdGrad = ctx.createLinearGradient(-6, 0, 8, 0);
  if (m.hitFlash > 0) {
    abdGrad.addColorStop(0, '#FFFFFF');
    abdGrad.addColorStop(1, '#E2E8F0');
  } else if (m.kind === 'boss') {
    abdGrad.addColorStop(0, '#581C87');
    abdGrad.addColorStop(0.55, '#BE185D');
    abdGrad.addColorStop(1, '#F43F5E');
  } else if (m.kind === 'golden') {
    abdGrad.addColorStop(0, '#D97706');
    abdGrad.addColorStop(0.6, '#FACC15');
    abdGrad.addColorStop(1, '#FEF08A');
  } else {
    abdGrad.addColorStop(0, '#991B1B');
    abdGrad.addColorStop(0.55, '#EF4444');
    abdGrad.addColorStop(1, '#F87171');
  }
  ctx.fillStyle = abdGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Abdomen stripes
  ctx.strokeStyle = 'rgba(20, 10, 10, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -3.5);
  ctx.lineTo(-2, 3.5);
  ctx.moveTo(2, -3.5);
  ctx.lineTo(2, 3.5);
  ctx.stroke();
  ctx.restore();

  // Thorax
  ctx.fillStyle = m.hitFlash > 0 ? '#F8FAFC' : m.kind === 'boss' ? '#4C1D95' : '#785C47';
  ctx.beginPath();
  ctx.ellipse(-1, -0.5, 5, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tiny golden crown for Boss Mosquito
  if (m.kind === 'boss') {
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-2.5, -6);
    ctx.lineTo(0, -10);
    ctx.lineTo(2.5, -6);
    ctx.lineTo(5, -9);
    ctx.lineTo(4, -4);
    ctx.closePath();
    ctx.fill();
  }

  // Head
  ctx.fillStyle = m.kind === 'boss' ? '#3B0764' : '#5E4534';
  ctx.beginPath();
  ctx.arc(-7, -1, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Tiny sharp proboscis (needle nose)
  ctx.strokeStyle = '#D6C7B8';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-9.5, -0.5);
  ctx.lineTo(-16.5, 2);
  ctx.stroke();

  // Tiny eye
  ctx.fillStyle = m.kind === 'boss' ? '#F43F5E' : m.state === 'diving' ? '#EF4444' : '#FDE68A';
  ctx.beginPath();
  ctx.arc(-7.8, -1.6, 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Front wing
  ctx.save();
  ctx.translate(1, -3);
  ctx.rotate(0.2 - wingFlap * 0.55);
  ctx.fillStyle = 'rgba(203, 213, 225, 0.28)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.ellipse(3, -10, 4.5, 11.5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawBedAndSleeper(rc: RenderContext): void {
  const { ctx, width, height, avatarStyle, sleeperMood, customAvatarImg, time } = rc;

  // Roomy bed centered in the lower third so the sleeper stands out clearly
  const { cx, cy, scale: bedScale } = getBedLayout(width, height);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(bedScale, bedScale);

  // Soft floor ambient glow under bed on black backdrop
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.ellipse(2, 62, 152, 25, -0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Back bed legs
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(-126, 14, 10, 28); // back-left
  ctx.fillRect(74, 24, 10, 26);   // back-right

  // Headboard (soft warm beige-taupe with muted outline so character pops)
  ctx.fillStyle = '#DFD8D0';
  ctx.strokeStyle = '#7D756D';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-130, 12);
  ctx.lineTo(-135, -46);
  ctx.lineTo(-40, -76);
  ctx.lineTo(-38, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner headboard panel detail
  ctx.strokeStyle = '#B8AFA6';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-120, -37);
  ctx.lineTo(-49, -60);
  ctx.stroke();

  // Mattress / clean light sky-tinted sheet so black character lines read effortlessly
  ctx.fillStyle = '#E6ECF5';
  ctx.strokeStyle = '#7C8599';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-126, 12);
  ctx.lineTo(-40, -22);
  ctx.lineTo(134, 4);
  ctx.lineTo(56, 46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Side skirt of mattress / soft blue-slate drape
  ctx.fillStyle = '#C7D2E3';
  ctx.beginPath();
  ctx.moveTo(-126, 12);
  ctx.lineTo(56, 46);
  ctx.lineTo(134, 4);
  ctx.lineTo(134, 24);
  ctx.quadraticCurveTo(116, 30, 102, 28);
  ctx.quadraticCurveTo(82, 40, 56, 58);
  ctx.quadraticCurveTo(12, 49, -24, 47);
  ctx.quadraticCurveTo(-78, 38, -126, 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Front bed legs
  ctx.fillStyle = '#6B6572';
  ctx.fillRect(-122, 25, 11, 28); // front-left
  ctx.fillRect(50, 48, 11, 24);   // front-right
  ctx.fillRect(120, 18, 10, 24);  // far-right

  // Crisp light pillow centered near the head of the mattress
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#8B93A6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-72, -10, 27, 16, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Stick-figure body centered right in the middle of the bed
  const breathe = Math.sin(time * 2.4) * 1.1;
  const shoulderX = -36;
  const shoulderY = -1 + breathe * 0.35;
  const hipX = 10;
  const hipY = 7 + breathe * 0.2;

  if (rc.fireMode === 'hand') {
    // Hand Fire mode: normal 2 legs (no 3rd leg), arms hold the fire-blaster upright
    ctx.strokeStyle = '#18161A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Neck & spine
    ctx.moveTo(-48, -5 + breathe * 0.45);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.lineTo(hipX, hipY);
    // Left/upper main leg
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(52, 8);
    ctx.lineTo(90, 12);
    ctx.lineTo(95, 7);
    // Right/lower main leg
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(48, 17);
    ctx.lineTo(82, 24);
    ctx.lineTo(87, 19);
    // Both arms reaching up to hold the handheld fire-blaster
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(-22, -10);
    ctx.lineTo(-15, -16);
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(-20, 5);
    ctx.lineTo(-10, -14);
    ctx.stroke();

    // Handheld mini fire-blaster / lighter-torch tilting with aimAngle
    ctx.save();
    ctx.translate(-12, -18);
    ctx.rotate(rc.aimAngle * 0.85);
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#18161A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-5, -10, 10, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#52525B';
    ctx.beginPath();
    ctx.roundRect(-3, -16, 6, 7, 1.5);
    ctx.fill();
    ctx.stroke();
    const flicker = Math.sin(time * 24) * 1.0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(0, -21, 7.5 + flicker * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, -21 - flicker * 0.25, 3.8, 5.4 + flicker * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // 3rd Leg mode: rubs the cut 3rd leg at speed matching fire rate and blasts pure-white sticky liquid
    const rubWave = Math.sin(rc.rubPhase);
    const rubT = 0.24 + 0.62 * (0.5 + 0.5 * rubWave);
    const legTipX = 14 + rubWave * 0.6;
    const legTipY = -11;
    const handX = hipX + (legTipX - hipX) * rubT + Math.cos(rc.rubPhase) * 0.8;
    const handY = hipY + (legTipY - hipY) * rubT;
    const elbowX = -15 + rubT * 2.2;
    const elbowY = 13.5 - rubT * 3;

    ctx.strokeStyle = '#18161A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Neck & spine centered down the middle of the mattress
    ctx.moveTo(-48, -5 + breathe * 0.45);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.lineTo(hipX, hipY);
    // Left/upper main leg along the middle-upper mattress
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(52, 8);
    ctx.lineTo(90, 12);
    ctx.lineTo(95, 7);
    // Right/lower main leg along the middle-lower mattress
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(48, 17);
    ctx.lineTo(82, 24);
    ctx.lineTo(87, 19);
    // Small middle third residual/cut leg (shorter stump)
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(legTipX, legTipY);
    // Left arm resting spread out onto the upper side of the bed
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(-24, -15);
    ctx.lineTo(-10, -11);
    // Right arm holding and rubbing up and down along the cut middle leg
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Small hand grip sliding up and down the cut leg
    ctx.fillStyle = '#18161A';
    ctx.beginPath();
    ctx.arc(handX, handY, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Glossy pure-white sticky droplet readiness at the cut third leg tip
    if (rc.isAiming || rc.beams.length > 0 || rc.fireIntensity > 0.2) {
      const heatBoost = 1 + Math.min(0.55, rc.fireIntensity * 0.3);
      const flicker = Math.sin(time * 24) * 1.0;
      ctx.save();
      ctx.translate(legTipX, legTipY);
      ctx.rotate(rc.aimAngle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(0, -3, (7.5 + flicker * 0.4) * heatBoost, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, -5 - flicker * 0.25, 3.8 * heatBoost, (5.5 + flicker * 0.4) * heatBoost, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Head / Avatar Face resting cleanly on the centered pillow
  const headX = -64;
  const headY = -10 + breathe * 0.5;
  const headR = 23;

  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(-0.08);
  drawAvatarHead(ctx, 0, 0, headR, avatarStyle, sleeperMood, customAvatarImg, time);
  ctx.restore();

  ctx.restore();
}

function drawAvatarHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  style: AvatarStyle,
  mood: SleeperMood,
  customImg: HTMLImageElement | null,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  if (mood === 'bitten') {
    ctx.rotate(Math.sin(time * 40) * 0.09);
  } else if (mood === 'happy') {
    ctx.scale(1.06, 1.06);
  }

  if (style === 'custom' && customImg && customImg.complete && customImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    const imgSize = r * 2;
    const aspect = customImg.naturalWidth / customImg.naturalHeight;
    let dw = imgSize;
    let dh = imgSize;
    if (aspect > 1) {
      dw = imgSize * aspect;
    } else {
      dh = imgSize / aspect;
    }
    ctx.drawImage(customImg, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'emoji') {
    // Classic warm smiling emoji tribute to the user's video screenshot!
    const grad = ctx.createRadialGradient(-6, -8, 4, 0, 0, r);
    grad.addColorStop(0, '#FDE047');
    grad.addColorStop(0.75, '#FACC15');
    grad.addColorStop(1, '#EAB308');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rosy cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.arc(-13, 4, 5, 0, Math.PI * 2);
    ctx.arc(13, 4, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5C3A10';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    if (mood === 'bitten') {
      // X_X eyes & shocked mouth
      ctx.beginPath();
      ctx.moveTo(-12, -8); ctx.lineTo(-6, -2);
      ctx.moveTo(-6, -8); ctx.lineTo(-12, -2);
      ctx.moveTo(6, -8); ctx.lineTo(12, -2);
      ctx.moveTo(12, -8); ctx.lineTo(6, -2);
      ctx.stroke();
      ctx.fillStyle = '#5C3A10';
      ctx.beginPath();
      ctx.ellipse(0, 10, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Happy curved eyes 😊
      ctx.beginPath();
      ctx.arc(-9, -3, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(9, -3, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      // Smile
      ctx.beginPath();
      ctx.arc(0, 4, 9, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Hand-drawn comic cartoon face ('sleepy', 'cool', 'uncle')
  ctx.fillStyle = style === 'uncle' ? '#F3C9A6' : '#FDE2C8';
  ctx.strokeStyle = '#1E1C21';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair / Nightcap
  if (style === 'uncle') {
    // Balding side tufts + mustache
    ctx.fillStyle = '#4B5563';
    ctx.beginPath();
    ctx.arc(-21, -4, 6, 0, Math.PI * 2);
    ctx.arc(21, -4, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Messy cartoon hair
    ctx.fillStyle = '#27242B';
    ctx.beginPath();
    ctx.moveTo(-23, -6);
    ctx.quadraticCurveTo(-18, -28, -4, -26);
    ctx.lineTo(0, -31);
    ctx.lineTo(6, -25);
    ctx.quadraticCurveTo(22, -24, 24, -6);
    ctx.quadraticCurveTo(10, -15, 0, -12);
    ctx.quadraticCurveTo(-12, -15, -23, -6);
    ctx.closePath();
    ctx.fill();
  }

  // Eyes
  if (style === 'cool') {
    // Stylish dark sunglasses
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-19, -8, 16, 10, 3);
    ctx.roundRect(3, -8, 16, 10, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.stroke();
    // Glint
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-15, -5);
    ctx.lineTo(-10, -1);
    ctx.moveTo(7, -5);
    ctx.lineTo(12, -1);
    ctx.stroke();
  } else if (mood === 'bitten') {
    // Wide shocked eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-9, -4, 5.5, 0, Math.PI * 2);
    ctx.arc(9, -4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1E1C21';
    ctx.beginPath();
    ctx.arc(-9, -4, 2, 0, Math.PI * 2);
    ctx.arc(9, -4, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'aiming') {
    // Focused squinting eyes looking up
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-9, -4, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(9, -4, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1E1C21';
    ctx.beginPath();
    ctx.arc(-9, -5.5, 2, 0, Math.PI * 2);
    ctx.arc(9, -5.5, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'happy') {
    // Happy curved closed eyes
    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-9, -3, 4.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9, -3, 4.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else {
    // Sleepy closed eyes
    ctx.strokeStyle = '#1E1C21';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-9, -4, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9, -4, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Mustache for uncle
  if (style === 'uncle') {
    ctx.fillStyle = '#4B5563';
    ctx.beginPath();
    ctx.ellipse(-5, 5, 6, 3, -0.2, 0, Math.PI * 2);
    ctx.ellipse(5, 5, 6, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth
  ctx.strokeStyle = '#1E1C21';
  ctx.lineWidth = 2.2;
  if (mood === 'bitten') {
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.ellipse(0, 12, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Red mosquito bite bump on cheek
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(15, 6, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'happy') {
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.arc(0, 8, 7, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (mood === 'aiming') {
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(5, 10);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 11, 3.2, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
