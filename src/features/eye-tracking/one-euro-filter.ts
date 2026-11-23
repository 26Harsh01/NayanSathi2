class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;
  private alpha = 1;

  constructor(alpha: number, initVal?: number) {
    if (initVal !== undefined) {
      this.y = initVal;
      this.s = initVal;
    }
    this.setAlpha(alpha);
  }

  setAlpha(alpha: number): void {
    if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
      this.alpha = Math.min(1, Math.max(1e-5, Number.isFinite(alpha) ? alpha : 1));
    } else {
      this.alpha = alpha;
    }
  }

  filter(value: number): number {
    if (this.s === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    const result = this.alpha * value + (1.0 - this.alpha) * this.s;
    this.y = value;
    this.s = result;
    return result;
  }

  filterWithAlpha(value: number, alpha: number): number {
    this.setAlpha(alpha);
    return this.filter(value);
  }

  lastRawValue(): number {
    return this.y ?? 0;
  }

  lastFilteredValue(): number {
    return this.s ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export interface OneEuroConfig {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

/**
 * Casiez et al. (2012) 1-Euro Filter with safe variable-FPS timestamp handling
 * and automatic reset after long tracking gaps (>450 ms).
 */
export class OneEuroFilter {
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTimeMs: number | null = null;
  private initialized = false;
  private config: OneEuroConfig;

  constructor(config: OneEuroConfig = { minCutoff: 1.15, beta: 0.9, dCutoff: 1.0 }) {
    this.config = { ...config };
    this.xFilter = new LowPassFilter(1.0);
    this.dxFilter = new LowPassFilter(1.0);
  }

  updateConfig(config: Partial<OneEuroConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private alpha(cutoff: number, dtSeconds: number): number {
    const tau = 1.0 / (2.0 * Math.PI * Math.max(1e-4, cutoff));
    return 1.0 / (1.0 + tau / Math.max(1e-4, dtSeconds));
  }

  filter(value: number, timestampMs: number): number {
    if (!Number.isFinite(value)) {
      return this.xFilter.lastFilteredValue();
    }

    if (!this.initialized || this.lastTimeMs === null) {
      this.initialized = true;
      this.lastTimeMs = timestampMs;
      this.xFilter = new LowPassFilter(1.0, value);
      this.dxFilter = new LowPassFilter(1.0, 0);
      return value;
    }

    const rawDtMs = timestampMs - this.lastTimeMs;
    if (rawDtMs <= 0) {
      return this.xFilter.lastFilteredValue();
    }

    // Re-anchor smoothly after long tracking gap instead of producing huge derivative spikes
    if (rawDtMs > 450) {
      this.lastTimeMs = timestampMs;
      this.xFilter = new LowPassFilter(1.0, value);
      this.dxFilter = new LowPassFilter(1.0, 0);
      return value;
    }

    const dtSec = Math.max(0.004, Math.min(0.25, rawDtMs / 1000));
    this.lastTimeMs = timestampMs;

    const prevRaw = this.xFilter.lastRawValue();
    const dValue = (value - prevRaw) / dtSec;
    const edValue = this.dxFilter.filterWithAlpha(
      dValue,
      this.alpha(this.config.dCutoff, dtSec)
    );

    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edValue);
    return this.xFilter.filterWithAlpha(value, this.alpha(cutoff, dtSec));
  }

  reset(): void {
    this.initialized = false;
    this.lastTimeMs = null;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
}

export class OneEuroFilter2D {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(config: OneEuroConfig = { minCutoff: 1.15, beta: 0.9, dCutoff: 1.0 }) {
    this.filterX = new OneEuroFilter(config);
    this.filterY = new OneEuroFilter(config);
  }

  updateConfig(config: Partial<OneEuroConfig>): void {
    this.filterX.updateConfig(config);
    this.filterY.updateConfig(config);
  }

  filter(x: number, y: number, timestampMs: number): { x: number; y: number } {
    return {
      x: this.filterX.filter(x, timestampMs),
      y: this.filterY.filter(y, timestampMs),
    };
  }

  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
