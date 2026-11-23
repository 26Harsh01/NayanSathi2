/**
 * Web Audio procedural soundscape generator for the Relaxation Corner.
 * Produces real gentle rain, ocean waves, birdsong, forest breeze, and soft chimes
 * directly in the browser without requiring external copyright audio links.
 */

export type AmbientSoundId =
  | 'rain'
  | 'ocean'
  | 'birds'
  | 'forest'
  | 'instrumental';

export interface AmbientSoundInfo {
  id: AmbientSoundId;
  titleEn: string;
  titleHi: string;
  description: string;
}

export const AMBIENT_SOUNDSCAPES: AmbientSoundInfo[] = [
  {
    id: 'rain',
    titleEn: 'Rain Sounds',
    titleHi: 'बारिश की आवाज़',
    description: 'Soft steady rainfall for calm focus and rest.',
  },
  {
    id: 'ocean',
    titleEn: 'Ocean Waves',
    titleHi: 'समुद्र की लहरें',
    description: 'Slow rolling tidal surf rhythm.',
  },
  {
    id: 'birds',
    titleEn: 'Birds Chirping',
    titleHi: 'पक्षियों की चहचहाहट',
    description: 'Gentle morning garden chirps over quiet air.',
  },
  {
    id: 'forest',
    titleEn: 'Forest Ambience',
    titleHi: 'जंगल का शांत वातावरण',
    description: 'Warm breeze rustling through leafy trees.',
  },
  {
    id: 'instrumental',
    titleEn: 'Gentle Instrumental',
    titleHi: 'मधुर शांत स्वर',
    description: 'Soft ambient pentatonic bell notes and warm drone.',
  },
];

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private cleanupFns: (() => void)[] = [];
  private activeId: AmbientSoundId | null = null;
  private currentVolume = 0.55;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  start(id: AmbientSoundId, volume = this.currentVolume): { ok: boolean; error?: string } {
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return { ok: false, error: 'Web Audio playback is unavailable in this browser.' };
    }

    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setValueAtTime(this.currentVolume, ctx.currentTime);
    this.activeId = id;

    if (id === 'rain') {
      const src = ctx.createBufferSource();
      src.buffer = this.createPinkNoiseBuffer(ctx, 4);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.65;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();
      this.cleanupFns.push(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      });
    } else if (id === 'ocean') {
      const src = ctx.createBufferSource();
      src.buffer = this.createPinkNoiseBuffer(ctx, 5);
      src.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 520;

      const waveGain = ctx.createGain();
      waveGain.gain.value = 0.45;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.13; // ~7.7 second slow ocean wave swell
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.35;
      lfo.connect(lfoDepth);
      lfoDepth.connect(waveGain.gain);

      src.connect(lowpass);
      lowpass.connect(waveGain);
      waveGain.connect(this.masterGain);
      src.start();
      lfo.start();
      this.cleanupFns.push(() => {
        try {
          src.stop();
          lfo.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      });
    } else if (id === 'forest') {
      const src = ctx.createBufferSource();
      src.buffer = this.createPinkNoiseBuffer(ctx, 5);
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 640;
      filter.Q.value = 0.9;

      const breezeGain = ctx.createGain();
      breezeGain.gain.value = 0.35;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      src.connect(filter);
      filter.connect(breezeGain);
      breezeGain.connect(this.masterGain);
      src.start();
      lfo.start();
      this.cleanupFns.push(() => {
        try {
          src.stop();
          lfo.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      });
    } else if (id === 'birds') {
      // Soft ambient air floor
      const src = ctx.createBufferSource();
      src.buffer = this.createPinkNoiseBuffer(ctx, 4);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350;
      const airGain = ctx.createGain();
      airGain.gain.value = 0.16;
      src.connect(filter);
      filter.connect(airGain);
      airGain.connect(this.masterGain);
      src.start();

      const triggerChirp = () => {
        if (!this.ctx || !this.masterGain || this.activeId !== 'birds') return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const baseFreq = 1900 + Math.random() * 1400;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.16);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.09, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.24);
      };

      triggerChirp();
      const timer = window.setInterval(() => {
        triggerChirp();
        if (Math.random() < 0.55) {
          window.setTimeout(triggerChirp, 260);
        }
      }, 2100);

      this.cleanupFns.push(() => {
        window.clearInterval(timer);
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      });
    } else if (id === 'instrumental') {
      // Warm soothing drone (C3 + G3) + soft pentatonic bell notes
      const drone1 = ctx.createOscillator();
      const drone2 = ctx.createOscillator();
      drone1.type = 'sine';
      drone2.type = 'sine';
      drone1.frequency.value = 130.81; // C3
      drone2.frequency.value = 196.0; // G3
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.07;
      drone1.connect(droneGain);
      drone2.connect(droneGain);
      droneGain.connect(this.masterGain);
      drone1.start();
      drone2.start();

      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      const playNote = () => {
        if (!this.ctx || !this.masterGain || this.activeId !== 'instrumental') return;
        const now = this.ctx.currentTime;
        const freq = scale[Math.floor(Math.random() * scale.length)];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.11, now + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3.0);
      };

      playNote();
      const timer = window.setInterval(playNote, 2600);
      this.cleanupFns.push(() => {
        window.clearInterval(timer);
        try {
          drone1.stop();
          drone2.stop();
        } catch {
          // ignore
        }
      });
    }

    return { ok: true };
  }

  setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
    }
  }

  stop(): void {
    this.activeId = null;
    for (const fn of this.cleanupFns) {
      fn();
    }
    this.cleanupFns = [];
  }
}

export const ambientSoundEngine = new AmbientSoundEngine();
