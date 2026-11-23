export interface OutlierFilterConfig {
  windowSize: number;
  sigmaThreshold: number; // Hampel MAD multiplier
  minScaleNorm: number; // minimum MAD floor in normalized viewport units (0..1)
  maxSingleFrameJumpNorm: number; // hard guard for isolated impossible 1-frame spikes
}

/**
 * Saccade-aware Hampel / rolling-median outlier rejection filter operating in
 * normalized viewport coordinates [0, 1] x [0, 1].
 *
 * - Rejects isolated 1-frame landmark spikes without corrupting the smoothing filter.
 * - Confirms intentional gaze shifts (saccades) when 2 consecutive frames move consistently
 *   into a new fixation region so real eye movements never feel frozen.
 */
export class GazeOutlierFilter {
  private historyX: number[] = [];
  private historyY: number[] = [];
  private pendingSaccade: { x: number; y: number } | null = null;
  private lastAccepted: { x: number; y: number } | null = null;
  private config: OutlierFilterConfig;

  constructor(config?: Partial<OutlierFilterConfig>) {
    this.config = {
      windowSize: config?.windowSize ?? 6,
      sigmaThreshold: config?.sigmaThreshold ?? 3.0,
      minScaleNorm: config?.minScaleNorm ?? 0.012,
      maxSingleFrameJumpNorm: config?.maxSingleFrameJumpNorm ?? 0.22,
    };
  }

  updateConfig(config: Partial<OutlierFilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) * 0.5
      : sorted[mid];
  }

  private pushSample(x: number, y: number): void {
    this.historyX.push(x);
    this.historyY.push(y);
    if (this.historyX.length > this.config.windowSize) {
      this.historyX.shift();
      this.historyY.shift();
    }
    this.lastAccepted = { x, y };
  }

  filter(
    rawNormX: number,
    rawNormY: number
  ): { normX: number; normY: number; wasOutlier: boolean } {
    const x = Math.max(-0.05, Math.min(1.05, rawNormX));
    const y = Math.max(-0.05, Math.min(1.05, rawNormY));

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        normX: this.lastAccepted?.x ?? 0.5,
        normY: this.lastAccepted?.y ?? 0.5,
        wasOutlier: true,
      };
    }

    if (this.historyX.length < 3) {
      this.pushSample(x, y);
      this.pendingSaccade = null;
      return { normX: x, normY: y, wasOutlier: false };
    }

    const medX = this.median(this.historyX);
    const medY = this.median(this.historyY);

    const madX = Math.max(
      this.config.minScaleNorm,
      1.4826 * this.median(this.historyX.map((v) => Math.abs(v - medX)))
    );
    const madY = Math.max(
      this.config.minScaleNorm,
      1.4826 * this.median(this.historyY.map((v) => Math.abs(v - medY)))
    );

    const dx = Math.abs(x - medX);
    const dy = Math.abs(y - medY);
    const zDist = Math.hypot(dx / madX, dy / madY);
    const euclidDist = Math.hypot(dx, dy);

    const isSpike =
      zDist > this.config.sigmaThreshold * 1.35 ||
      euclidDist > this.config.maxSingleFrameJumpNorm;

    if (isSpike) {
      // Check if previous frame also jumped to the same new location -> real saccade!
      if (this.pendingSaccade) {
        const pendingDist = Math.hypot(
          x - this.pendingSaccade.x,
          y - this.pendingSaccade.y
        );
        if (pendingDist < 0.085) {
          // Confirmed intentional eye saccade: re-anchor rolling window smoothly
          this.historyX = [this.pendingSaccade.x, x];
          this.historyY = [this.pendingSaccade.y, y];
          this.pendingSaccade = null;
          this.lastAccepted = { x, y };
          return { normX: x, normY: y, wasOutlier: false };
        }
      }

      // Isolated single-frame spike: hold pending and output robust median
      this.pendingSaccade = { x, y };
      return {
        normX: medX,
        normY: medY,
        wasOutlier: true,
      };
    }

    // Normal in-distribution sample
    this.pendingSaccade = null;
    this.pushSample(x, y);
    return { normX: x, normY: y, wasOutlier: false };
  }

  reset(): void {
    this.historyX = [];
    this.historyY = [];
    this.pendingSaccade = null;
    this.lastAccepted = null;
  }
}
