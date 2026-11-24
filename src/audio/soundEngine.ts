class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private muted: boolean = false;
  private thirdLegBuffer: AudioBuffer | null = null;
  private thirdLegRawBytes: ArrayBuffer | null = null;
  private thirdLegLoading: boolean = false;
  private thirdLegHitBuffer: AudioBuffer | null = null;
  private thirdLegHitRawBytes: ArrayBuffer | null = null;
  private thirdLegHitLoading: boolean = false;
  private thirdLegExtraHitBuffer: AudioBuffer | null = null;
  private thirdLegExtraHitRawBytes: ArrayBuffer | null = null;
  private thirdLegExtraHitLoading: boolean = false;
  private thirdLegHitIndex: number = 0;
  private deathSoundBuffer: AudioBuffer | null = null;
  private deathSoundRawBytes: ArrayBuffer | null = null;
  private deathSoundLoading: boolean = false;
  private deathClipIndex: number = 0;
  private fireHitBuffer: AudioBuffer | null = null;
  private fireHitRawBytes: ArrayBuffer | null = null;
  private fireHitLoading: boolean = false;
  private activeFireSource: AudioBufferSourceNode | null = null;
  private activeVoiceSource: AudioBufferSourceNode | null = null;
  private activeVoiceKind: 'hit' | 'miss' | 'bite' | 'death' | null = null;
  private lastMissTs: number = 0;
  private missToggle: boolean = false;

  private static readonly THIRD_LEG_HIT_CLIPS: ReadonlyArray<{
    source: 'main' | 'extra';
    offset: number;
    duration: number;
    volume: number;
  }> = [
    { source: 'main', offset: 1.82, duration: 2.18, volume: 1.75 },
    { source: 'extra', offset: 3.77, duration: 0.96, volume: 1.8 },
    { source: 'extra', offset: 4.88, duration: 1.09, volume: 1.8 },
    { source: 'extra', offset: 6.71, duration: 0.56, volume: 1.8 },
  ];

  private static readonly DEATH_CLIPS: ReadonlyArray<{ offset: number; duration: number }> = [
    { offset: 0.08, duration: 1.87 },
    { offset: 2.02, duration: 1.24 },
    { offset: 3.28, duration: 0.91 },
    { offset: 4.2, duration: 2.57 },
    { offset: 6.79, duration: 1.62 },
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('sleepy_zapper_muted') === 'true';
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.masterGain) {
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
      compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.25, this.ctx.currentTime);
      master.connect(compressor);
      compressor.connect(this.ctx.destination);

      this.masterGain = master;
      this.masterCompressor = compressor;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx) {
      if (!this.thirdLegBuffer && !this.thirdLegLoading) {
        this.loadThirdLegBuffer(this.ctx).catch(() => {});
      }
      if (!this.thirdLegHitBuffer && !this.thirdLegHitLoading) {
        this.loadThirdLegHitBuffer(this.ctx).catch(() => {});
      }
      if (!this.thirdLegExtraHitBuffer && !this.thirdLegExtraHitLoading) {
        this.loadThirdLegExtraHitBuffer(this.ctx).catch(() => {});
      }
      if (!this.deathSoundBuffer && !this.deathSoundLoading) {
        this.loadDeathSoundBuffer(this.ctx).catch(() => {});
      }
      if (!this.fireHitBuffer && !this.fireHitLoading) {
        this.loadFireHitBuffer(this.ctx).catch(() => {});
      }
    }
    return this.ctx;
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.masterGain ?? ctx.destination;
  }

  private async loadThirdLegBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.thirdLegBuffer) return this.thirdLegBuffer;
    if (this.thirdLegLoading) return null;
    this.thirdLegLoading = true;
    try {
      if (!this.thirdLegRawBytes) {
        const res = await fetch('/assets/aistudio/videoplayback__1__aa66cf3b.mp3');
        if (!res.ok) return null;
        this.thirdLegRawBytes = await res.arrayBuffer();
      }
      const decoded = await ctx.decodeAudioData(this.thirdLegRawBytes.slice(0));
      this.thirdLegBuffer = decoded;
      return decoded;
    } catch {
      return null;
    } finally {
      this.thirdLegLoading = false;
    }
  }

  private async loadThirdLegHitBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.thirdLegHitBuffer) return this.thirdLegHitBuffer;
    if (this.thirdLegHitLoading) return null;
    this.thirdLegHitLoading = true;
    try {
      if (!this.thirdLegHitRawBytes) {
        const res = await fetch('/assets/aistudio/Le_madarchod_meme_-_Kadwa_Memes__128k__21fc8853.wav');
        if (!res.ok) return null;
        this.thirdLegHitRawBytes = await res.arrayBuffer();
      }
      const decoded = await ctx.decodeAudioData(this.thirdLegHitRawBytes.slice(0));
      this.thirdLegHitBuffer = decoded;
      return decoded;
    } catch {
      return null;
    } finally {
      this.thirdLegHitLoading = false;
    }
  }

  private async loadThirdLegExtraHitBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.thirdLegExtraHitBuffer) return this.thirdLegExtraHitBuffer;
    if (this.thirdLegExtraHitLoading) return null;
    this.thirdLegExtraHitLoading = true;
    try {
      if (!this.thirdLegExtraHitRawBytes) {
        const res = await fetch(
          '/assets/aistudio/Teri_Maa_ka_bho_______sooryavansham__mames__trending__funny__video__dubbing__shortvideo__instareels_-_Chhapprimemes__128k__1f332ca0.wav'
        );
        if (!res.ok) return null;
        this.thirdLegExtraHitRawBytes = await res.arrayBuffer();
      }
      const decoded = await ctx.decodeAudioData(this.thirdLegExtraHitRawBytes.slice(0));
      this.thirdLegExtraHitBuffer = decoded;
      return decoded;
    } catch {
      return null;
    } finally {
      this.thirdLegExtraHitLoading = false;
    }
  }

  private async loadDeathSoundBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.deathSoundBuffer) return this.deathSoundBuffer;
    if (this.deathSoundLoading) return null;
    this.deathSoundLoading = true;
    try {
      if (!this.deathSoundRawBytes) {
        const res = await fetch('/assets/aistudio/Top_5_Meme_Sound_Effect_l_2026_-_Supplier_XD__128k__10d7e8ec.wav');
        if (!res.ok) return null;
        this.deathSoundRawBytes = await res.arrayBuffer();
      }
      const decoded = await ctx.decodeAudioData(this.deathSoundRawBytes.slice(0));
      this.deathSoundBuffer = decoded;
      return decoded;
    } catch {
      return null;
    } finally {
      this.deathSoundLoading = false;
    }
  }

  private async loadFireHitBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.fireHitBuffer) return this.fireHitBuffer;
    if (this.fireHitLoading) return null;
    this.fireHitLoading = true;
    try {
      if (!this.fireHitRawBytes) {
        const res = await fetch(
          '/assets/aistudio/vidssave.com_M1887_Gun_sound_effects_in_free_fire____gun_sound_template_freefire___please_like_and_subscribe_128KBPS_c724a226.mp4'
        );
        if (!res.ok) return null;
        this.fireHitRawBytes = await res.arrayBuffer();
      }
      const decoded = await ctx.decodeAudioData(this.fireHitRawBytes.slice(0));
      this.fireHitBuffer = decoded;
      return decoded;
    } catch {
      return null;
    } finally {
      this.fireHitLoading = false;
    }
  }

  public preloadDeathAudio(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.deathSoundBuffer && !this.deathSoundLoading) {
      this.loadDeathSoundBuffer(ctx).catch(() => {});
    }
    if (!this.fireHitBuffer && !this.fireHitLoading) {
      this.loadFireHitBuffer(ctx).catch(() => {});
    }
  }

  public preloadThirdLegAudio(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.thirdLegBuffer && !this.thirdLegLoading) {
      this.loadThirdLegBuffer(ctx).catch(() => {});
    }
    if (!this.thirdLegHitBuffer && !this.thirdLegHitLoading) {
      this.loadThirdLegHitBuffer(ctx).catch(() => {});
    }
    if (!this.thirdLegExtraHitBuffer && !this.thirdLegExtraHitLoading) {
      this.loadThirdLegExtraHitBuffer(ctx).catch(() => {});
    }
    if (!this.deathSoundBuffer && !this.deathSoundLoading) {
      this.loadDeathSoundBuffer(ctx).catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopThirdLegEffect();
      this.stopFireHitEffect();
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('sleepy_zapper_muted', String(muted));
    }
  }

  private playBufferSegment(
    buffer: AudioBuffer | null,
    loader: (ctx: AudioContext) => Promise<AudioBuffer | null>,
    offsetSec: number,
    durationSec: number,
    volume: number,
    kind: 'hit' | 'miss' | 'bite' | 'death',
    delaySec: number = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const trigger = (buf: AudioBuffer) => {
      if (this.muted) return;
      this.stopThirdLegEffect();

      const safeOffset = Math.max(0, Math.min(offsetSec, Math.max(0, buf.duration - 0.05)));
      const safeDuration = Math.max(0.05, Math.min(durationSec, buf.duration - safeOffset));

      const source = ctx.createBufferSource();
      source.buffer = buf;

      const gain = ctx.createGain();
      const startAt = ctx.currentTime + Math.max(0, delaySec);
      gain.gain.setValueAtTime(0.01, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + 0.015);
      gain.gain.setValueAtTime(volume, startAt + Math.max(0.02, safeDuration - 0.03));
      gain.gain.linearRampToValueAtTime(0.001, startAt + safeDuration);

      source.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      source.onended = () => {
        if (this.activeVoiceSource === source) {
          this.activeVoiceSource = null;
          this.activeVoiceKind = null;
        }
      };

      this.activeVoiceSource = source;
      this.activeVoiceKind = kind;
      source.start(startAt, safeOffset, safeDuration);
    };

    if (buffer) {
      trigger(buffer);
    } else {
      loader(ctx).then((buf) => {
        if (buf) trigger(buf);
      });
    }
  }

  public playThirdLegHit(): void {
    if (this.muted || typeof window === 'undefined') return;
    const clip = SoundEngine.THIRD_LEG_HIT_CLIPS[this.thirdLegHitIndex];
    this.thirdLegHitIndex = (this.thirdLegHitIndex + 1) % SoundEngine.THIRD_LEG_HIT_CLIPS.length;

    if (clip.source === 'main') {
      this.playBufferSegment(
        this.thirdLegHitBuffer,
        (ctx) => this.loadThirdLegHitBuffer(ctx),
        clip.offset,
        clip.duration,
        clip.volume,
        'hit',
        0.14
      );
    } else {
      this.playBufferSegment(
        this.thirdLegExtraHitBuffer,
        (ctx) => this.loadThirdLegExtraHitBuffer(ctx),
        clip.offset,
        clip.duration,
        clip.volume,
        'hit',
        0.14
      );
    }
  }

  public playThirdLegMiss(): void {
    if (this.muted || typeof window === 'undefined') return;
    const now = Date.now();
    if (now - this.lastMissTs < 600) return;
    this.lastMissTs = now;

    // Alternate between "Hain?" (0.12s..0.84s) and "Kya?" (1.56s..2.10s)
    this.missToggle = !this.missToggle;
    const loader = (ctx: AudioContext) => this.loadThirdLegBuffer(ctx);
    if (this.missToggle) {
      this.playBufferSegment(this.thirdLegBuffer, loader, 0.12, 0.72, 1.65, 'miss');
    } else {
      this.playBufferSegment(this.thirdLegBuffer, loader, 1.56, 0.54, 1.65, 'miss');
    }
  }

  public playThirdLegBite(): void {
    if (this.muted || typeof window === 'undefined') return;
    // Play the ending reaction clip (3.05s..end) when bitten by a mosquito
    this.playBufferSegment(
      this.thirdLegBuffer,
      (ctx) => this.loadThirdLegBuffer(ctx),
      3.05,
      1.35,
      1.85,
      'bite'
    );
  }

  public playDeathSound(): void {
    if (this.muted || typeof window === 'undefined') return;
    const clip = SoundEngine.DEATH_CLIPS[this.deathClipIndex];
    this.deathClipIndex = (this.deathClipIndex + 1) % SoundEngine.DEATH_CLIPS.length;
    this.playBufferSegment(
      this.deathSoundBuffer,
      (ctx) => this.loadDeathSoundBuffer(ctx),
      clip.offset,
      clip.duration,
      1.85,
      'death'
    );
  }

  public stopThirdLegEffect(): void {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
      } catch {
        // Ignore if already stopped
      }
      this.activeVoiceSource = null;
    }
    this.activeVoiceKind = null;
  }

  private stopFireHitEffect(): void {
    if (this.activeFireSource) {
      try {
        this.activeFireSource.stop();
      } catch {
        // Ignore if already stopped
      }
      this.activeFireSource = null;
    }
  }

  public playFireHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const trigger = (buf: AudioBuffer) => {
      if (this.muted) return;
      this.stopFireHitEffect();

      // Trimmed purely to the M1887 gunshot blast (1.61s - 2.55s), skipping silence/any speech
      const safeOffset = Math.max(0, Math.min(1.61, Math.max(0, buf.duration - 0.1)));
      const safeDuration = Math.max(0.05, Math.min(0.94, buf.duration - safeOffset));

      const source = ctx.createBufferSource();
      source.buffer = buf;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const targetVol = 1.35;
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(targetVol, now + 0.008);
      gain.gain.setValueAtTime(targetVol, now + Math.max(0.02, safeDuration - 0.12));
      gain.gain.linearRampToValueAtTime(0.001, now + safeDuration);

      source.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      source.onended = () => {
        if (this.activeFireSource === source) {
          this.activeFireSource = null;
        }
      };

      this.activeFireSource = source;
      source.start(now, safeOffset, safeDuration);
    };

    if (this.fireHitBuffer) {
      trigger(this.fireHitBuffer);
    } else {
      this.loadFireHitBuffer(ctx).then((buf) => {
        if (buf) trigger(buf);
      });
    }
  }

  public playZap(hit: boolean): void {
    // Hit uses the real M1887 fire sound; only play a soft non-tonal air whoosh on miss
    if (hit) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.09;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + duration);
    filter.Q.setValueAtTime(1.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    noise.start(now);
    noise.stop(now + duration);
  }

  public playHit(_combo: number, _isGolden: boolean): void {
    // Tonal pop removed so M1887 fire hit and meme voice effects stay crystal clear
  }

  public playDiveAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(340, now + 0.12);
    osc.frequency.linearRampToValueAtTime(270, now + 0.22);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playBite(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.24);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playNewBest(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playPowerUp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [440, 659.25, 880, 1174.66];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(t);
      osc.stop(t + 0.21);
    });
  }
}

export const soundEngine = new SoundEngine();
