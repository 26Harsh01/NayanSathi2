export interface DwellState {
  activeTargetId: string | null;
  progress: number; // 0..1
  triggeredTargetId: string | null;
}

export interface DwellConfig {
  dwellDurationMs: number;
  dwellTolerancePx: number;
  targetHysteresisPx: number;
  selectionCooldownMs: number;
  hysteresisGraceMs: number;
}

export interface TargetRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class DwellManager {
  private activeTargetId: string | null = null;
  private pendingTargetId: string | null = null;
  private pendingFrames = 0;
  private dwellStartMs: number | null = null;
  private lastInsideMs: number | null = null;
  private lastTriggeredTargetId: string | null = null;
  private cooldownUntilMs = 0;
  private config: DwellConfig;

  constructor(config?: Partial<DwellConfig>) {
    this.config = {
      dwellDurationMs: config?.dwellDurationMs ?? 1000,
      dwellTolerancePx: config?.dwellTolerancePx ?? 14,
      targetHysteresisPx: config?.targetHysteresisPx ?? 14,
      selectionCooldownMs: config?.selectionCooldownMs ?? 900,
      hysteresisGraceMs: config?.hysteresisGraceMs ?? 180,
    };
  }

  updateConfig(config: Partial<DwellConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private containsPoint(rect: TargetRect, x: number, y: number, margin: number): boolean {
    return (
      x >= rect.left - margin &&
      x <= rect.right + margin &&
      y >= rect.top - margin &&
      y <= rect.bottom + margin
    );
  }

  private centerDistance(rect: TargetRect, x: number, y: number): number {
    const cx = (rect.left + rect.right) * 0.5;
    const cy = (rect.top + rect.bottom) * 0.5;
    return Math.hypot(x - cx, y - cy);
  }

  /**
   * Finds the best target using separate entry margin and exit hysteresis:
   * - Active target retains focus within `targetHysteresisPx` unless the gaze
   *   clearly enters a different target's interior and is closer to that target.
   * - Entering a new target uses exact `getBoundingClientRect()` bounds (no overlap bleed
   *   between neighboring keyboard keys).
   */
  findHitTarget(x: number, y: number, targets: TargetRect[]): TargetRect | null {
    const strictInside = targets.find((t) => this.containsPoint(t, x, y, 0)) ?? null;

    if (this.activeTargetId) {
      const current = targets.find((t) => t.id === this.activeTargetId) ?? null;
      if (current) {
        if (this.containsPoint(current, x, y, 0)) {
          return current;
        }
        // Check if user has decisively moved well inside a different target
        if (strictInside && strictInside.id !== current.id) {
          const insetInsideOther = this.containsPoint(strictInside, x, y, -4);
          const distOther = this.centerDistance(strictInside, x, y);
          const distCurr = this.centerDistance(current, x, y);
          if (insetInsideOther && distOther + 6 < distCurr) {
            return strictInside;
          }
        }
        // Keep current target within exit hysteresis margin
        const exitMargin = Math.max(this.config.targetHysteresisPx, this.config.dwellTolerancePx);
        if (this.containsPoint(current, x, y, exitMargin)) {
          return current;
        }
      }
    }

    return strictInside;
  }

  update(
    x: number,
    y: number,
    targets: TargetRect[],
    timestampMs: number,
    options: { isBlinking: boolean; confident: boolean }
  ): DwellState {
    if (!options.confident) {
      this.reset();
      return { activeTargetId: null, progress: 0, triggeredTargetId: null };
    }

    // Suspend dwell advancement during natural blink without resetting active target
    if (options.isBlinking) {
      if (this.dwellStartMs !== null && this.lastInsideMs !== null) {
        const blinkDelta = Math.max(0, timestampMs - this.lastInsideMs);
        this.dwellStartMs += blinkDelta;
        this.lastInsideMs = timestampMs;
      }
      const progress =
        this.activeTargetId && this.dwellStartMs !== null
          ? Math.min(1, (timestampMs - this.dwellStartMs) / Math.max(200, this.config.dwellDurationMs))
          : 0;
      return {
        activeTargetId: this.activeTargetId,
        progress,
        triggeredTargetId: null,
      };
    }

    if (timestampMs < this.cooldownUntilMs) {
      return { activeTargetId: null, progress: 0, triggeredTargetId: null };
    }

    const hit = this.findHitTarget(x, y, targets);

    if (!hit) {
      this.pendingTargetId = null;
      this.pendingFrames = 0;

      if (
        this.activeTargetId &&
        this.lastInsideMs !== null &&
        timestampMs - this.lastInsideMs <= this.config.hysteresisGraceMs
      ) {
        const progress =
          this.dwellStartMs !== null
            ? Math.min(1, (timestampMs - this.dwellStartMs) / Math.max(200, this.config.dwellDurationMs))
            : 0;
        return {
          activeTargetId: this.activeTargetId,
          progress,
          triggeredTargetId: null,
        };
      }
      this.reset();
      return { activeTargetId: null, progress: 0, triggeredTargetId: null };
    }

    if (hit.id !== this.activeTargetId) {
      if (hit.id === this.lastTriggeredTargetId && timestampMs < this.cooldownUntilMs + 450) {
        return { activeTargetId: null, progress: 0, triggeredTargetId: null };
      }

      // Require 2 consecutive frames on a new target before switching focus to prevent single-frame theft
      if (this.pendingTargetId !== hit.id) {
        this.pendingTargetId = hit.id;
        this.pendingFrames = 1;
        if (this.activeTargetId) {
          const progress =
            this.dwellStartMs !== null
              ? Math.min(1, (timestampMs - this.dwellStartMs) / Math.max(200, this.config.dwellDurationMs))
              : 0;
          return {
            activeTargetId: this.activeTargetId,
            progress,
            triggeredTargetId: null,
          };
        }
        return { activeTargetId: null, progress: 0, triggeredTargetId: null };
      }

      this.pendingFrames += 1;
      if (this.pendingFrames < 2) {
        return { activeTargetId: this.activeTargetId, progress: 0, triggeredTargetId: null };
      }

      this.pendingTargetId = null;
      this.pendingFrames = 0;
      this.activeTargetId = hit.id;
      this.dwellStartMs = timestampMs;
      this.lastInsideMs = timestampMs;
      return { activeTargetId: hit.id, progress: 0, triggeredTargetId: null };
    }

    this.pendingTargetId = null;
    this.pendingFrames = 0;
    this.lastInsideMs = timestampMs;
    const elapsed = timestampMs - (this.dwellStartMs ?? timestampMs);
    const progress = Math.max(0, Math.min(1, elapsed / Math.max(200, this.config.dwellDurationMs)));

    if (progress >= 1) {
      const triggeredId = hit.id;
      this.lastTriggeredTargetId = triggeredId;
      this.cooldownUntilMs = timestampMs + this.config.selectionCooldownMs;
      this.activeTargetId = null;
      this.dwellStartMs = null;
      this.lastInsideMs = null;
      return {
        activeTargetId: null,
        progress: 0,
        triggeredTargetId: triggeredId,
      };
    }

    return {
      activeTargetId: hit.id,
      progress,
      triggeredTargetId: null,
    };
  }

  getActiveTargetId(): string | null {
    return this.activeTargetId;
  }

  reset(): void {
    this.activeTargetId = null;
    this.pendingTargetId = null;
    this.pendingFrames = 0;
    this.dwellStartMs = null;
    this.lastInsideMs = null;
  }
}
