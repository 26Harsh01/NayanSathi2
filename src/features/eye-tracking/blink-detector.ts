import type { BlinkDiagnosticState, BlinkEvent, BlinkPhase } from '../../types';

export interface BlinkDetectorConfig {
  openBaselineEar: number;
  closedBaselineEar: number;
  longBlinkDurationMs: number;
  blinkSelectionEnabled: boolean;
  allowSingleEyeFallback: boolean;
  smoothingAlpha: number;
  minClosedConfirmFrames: number;
  minReopenConfirmFrames: number;
}

export interface BlinkProcessInput {
  earLeft: number;
  earRight: number;
  leftReliable: boolean;
  rightReliable: boolean;
  faceValid: boolean;
  timestampMs: number;
  suppressForCalibration?: boolean;
}

export function computePersonalizedBlinkThresholds(
  openEar: number,
  closedEar: number
): { closeThreshold: number; openThreshold: number } {
  const safeOpen = Math.max(0.18, Math.min(0.5, openEar));
  const safeClosed = Math.max(0.04, Math.min(safeOpen - 0.05, closedEar));
  const span = safeOpen - safeClosed;

  // Hysteresis gap prevents chatter near threshold: close at ~40% of span, reopen at ~62% of span
  const closeThreshold = safeClosed + span * 0.4;
  const openThreshold = safeClosed + span * 0.62;
  return { closeThreshold, openThreshold };
}

/**
 * Explicit 4-state blink state machine:
 *   OPEN -> CLOSING -> CLOSED -> REOPENING -> OPEN
 *
 * - Smooths independent Left/Right EAR measurements with EMA.
 * - Requires bilateral closure (with optional single-eye fallback when one eye is occluded/glaring).
 * - Distinguishes natural brief blinks (pauses dwell without selection) from intentional
 *   long blinks (fires exactly once per closure after longBlinkDurationMs, rearmed on OPEN).
 */
export class BlinkDetector {
  private config: BlinkDetectorConfig;
  private phase: BlinkPhase = 'OPEN';
  private smoothedLeftEar: number | null = null;
  private smoothedRightEar: number | null = null;
  private smoothedEar: number | null = null;

  private closingFrames = 0;
  private reopenFrames = 0;
  private closedFrames = 0;
  private closingStartMs: number | null = null;
  private blinkStartMs: number | null = null;
  private longBlinkFiredForClosure = false;
  private blinkCount = 0;
  private lastBlinkEvent: BlinkEvent | null = null;

  constructor(config?: Partial<BlinkDetectorConfig>) {
    this.config = {
      openBaselineEar: config?.openBaselineEar ?? 0.29,
      closedBaselineEar: config?.closedBaselineEar ?? 0.11,
      longBlinkDurationMs: config?.longBlinkDurationMs ?? 700,
      blinkSelectionEnabled: config?.blinkSelectionEnabled ?? false,
      allowSingleEyeFallback: config?.allowSingleEyeFallback ?? true,
      smoothingAlpha: config?.smoothingAlpha ?? 0.55,
      minClosedConfirmFrames: config?.minClosedConfirmFrames ?? 2,
      minReopenConfirmFrames: config?.minReopenConfirmFrames ?? 2,
    };
  }

  updateConfig(config: Partial<BlinkDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private ema(prev: number | null, next: number): number {
    if (prev === null || !Number.isFinite(prev)) return next;
    const a = this.config.smoothingAlpha;
    return a * next + (1 - a) * prev;
  }

  process(input: BlinkProcessInput): BlinkDiagnosticState {
    const { closeThreshold, openThreshold } = computePersonalizedBlinkThresholds(
      this.config.openBaselineEar,
      this.config.closedBaselineEar
    );

    if (!input.faceValid || input.suppressForCalibration) {
      this.resetTransientState();
      return this.buildSnapshot(0, 0, closeThreshold, openThreshold, false, 0);
    }

    const leftValid = input.earLeft > 0;
    const rightValid = input.earRight > 0;

    if (!leftValid && !rightValid) {
      this.resetTransientState();
      return this.buildSnapshot(0, 0, closeThreshold, openThreshold, false, 0);
    }

    const sLeft = leftValid ? this.ema(this.smoothedLeftEar, input.earLeft) : 0;
    const sRight = rightValid ? this.ema(this.smoothedRightEar, input.earRight) : 0;
    this.smoothedLeftEar = leftValid ? sLeft : null;
    this.smoothedRightEar = rightValid ? sRight : null;

    // Effective combined EAR respecting eye reliability
    let combinedRawEar = 0;
    if (leftValid && rightValid) {
      if (input.leftReliable && !input.rightReliable && this.config.allowSingleEyeFallback) {
        combinedRawEar = sLeft;
      } else if (input.rightReliable && !input.leftReliable && this.config.allowSingleEyeFallback) {
        combinedRawEar = sRight;
      } else {
        combinedRawEar = (sLeft + sRight) * 0.5;
      }
    } else {
      combinedRawEar = leftValid ? sLeft : sRight;
    }

    this.smoothedEar = combinedRawEar;

    // Bilateral closure check (both eyes closed unless single-eye fallback applies)
    const leftClosed = leftValid && sLeft < closeThreshold;
    const rightClosed = rightValid && sRight < closeThreshold;
    const leftOpen = leftValid && sLeft >= openThreshold;
    const rightOpen = rightValid && sRight >= openThreshold;

    let bothClosed: boolean;
    let eyesOpen: boolean;

    if (leftValid && rightValid) {
      if (this.config.allowSingleEyeFallback && (!input.leftReliable || !input.rightReliable)) {
        const relClosed = input.leftReliable ? leftClosed : rightClosed;
        const relOpen = input.leftReliable ? leftOpen : rightOpen;
        bothClosed = relClosed;
        eyesOpen = relOpen;
      } else {
        // Bilateral closure: both eyes dip below closeThreshold (or average clearly closed & both below midpoint)
        bothClosed =
          (leftClosed && rightClosed) ||
          (combinedRawEar < closeThreshold && leftClosed !== rightClosed && Math.max(sLeft, sRight) < openThreshold);
        eyesOpen = leftOpen && rightOpen;
      }
    } else if (this.config.allowSingleEyeFallback) {
      bothClosed = leftValid ? leftClosed : rightClosed;
      eyesOpen = leftValid ? leftOpen : rightOpen;
    } else {
      bothClosed = false;
      eyesOpen = true;
    }

    let longBlinkTriggered = false;
    let blinkDurationMs = 0;

    switch (this.phase) {
      case 'OPEN': {
        this.longBlinkFiredForClosure = false;
        if (bothClosed) {
          this.phase = 'CLOSING';
          this.closingFrames = 1;
          this.closingStartMs = input.timestampMs;
          this.closedFrames = 0;
          this.reopenFrames = 0;
        }
        break;
      }

      case 'CLOSING': {
        if (bothClosed) {
          this.closingFrames += 1;
          const closingElapsed =
            this.closingStartMs !== null ? input.timestampMs - this.closingStartMs : 0;
          if (this.closingFrames >= this.config.minClosedConfirmFrames || closingElapsed >= 25) {
            this.phase = 'CLOSED';
            this.blinkStartMs = this.closingStartMs ?? input.timestampMs;
            this.closedFrames = 1;
            blinkDurationMs = Math.max(0, input.timestampMs - this.blinkStartMs);
          }
        } else if (eyesOpen) {
          // Single-frame glitch aborted cleanly before entering CLOSED
          this.phase = 'OPEN';
          this.closingFrames = 0;
          this.closingStartMs = null;
        }
        break;
      }

      case 'CLOSED': {
        blinkDurationMs =
          this.blinkStartMs !== null ? Math.max(0, input.timestampMs - this.blinkStartMs) : 0;

        if (bothClosed) {
          this.closedFrames += 1;
          this.reopenFrames = 0;
          if (
            this.config.blinkSelectionEnabled &&
            !this.longBlinkFiredForClosure &&
            this.closedFrames >= 3 &&
            blinkDurationMs >= this.config.longBlinkDurationMs
          ) {
            this.longBlinkFiredForClosure = true;
            longBlinkTriggered = true;
          }
        } else {
          this.phase = 'REOPENING';
          this.reopenFrames = eyesOpen ? 1 : 0;
        }
        break;
      }

      case 'REOPENING': {
        blinkDurationMs =
          this.blinkStartMs !== null ? Math.max(0, input.timestampMs - this.blinkStartMs) : 0;

        if (bothClosed) {
          // Dropped back below closeThreshold before full reopen
          this.phase = 'CLOSED';
          this.reopenFrames = 0;
        } else if (eyesOpen) {
          this.reopenFrames += 1;
          if (this.reopenFrames >= this.config.minReopenConfirmFrames) {
            const finalDuration = blinkDurationMs;
            const eventType: BlinkEvent['type'] = this.longBlinkFiredForClosure
              ? 'intentional'
              : 'natural';
            this.blinkCount += 1;
            this.lastBlinkEvent = {
              type: eventType,
              durationMs: Math.round(finalDuration),
              timestamp: input.timestampMs,
            };
            this.phase = 'OPEN';
            this.closingFrames = 0;
            this.closedFrames = 0;
            this.reopenFrames = 0;
            this.closingStartMs = null;
            this.blinkStartMs = null;
            this.longBlinkFiredForClosure = false;
            blinkDurationMs = 0;
          }
        }
        break;
      }
    }

    return this.buildSnapshot(
      sLeft,
      sRight,
      closeThreshold,
      openThreshold,
      longBlinkTriggered,
      blinkDurationMs
    );
  }

  private buildSnapshot(
    earLeft: number,
    earRight: number,
    closeThreshold: number,
    openThreshold: number,
    longBlinkTriggered: boolean,
    blinkDurationMs: number
  ): BlinkDiagnosticState {
    const isBlinking = this.phase === 'CLOSING' || this.phase === 'CLOSED' || this.phase === 'REOPENING';
    return {
      state: this.phase,
      earLeft,
      earRight,
      smoothedEar: this.smoothedEar ?? 0,
      isBlinking,
      blinkDurationMs,
      blinkCount: this.blinkCount,
      longBlinkTriggered,
      lastBlinkEvent: this.lastBlinkEvent,
      openBaselineEar: this.config.openBaselineEar,
      closedBaselineEar: this.config.closedBaselineEar,
      closeThreshold,
      openThreshold,
    };
  }

  private resetTransientState(): void {
    this.phase = 'OPEN';
    this.closingFrames = 0;
    this.closedFrames = 0;
    this.reopenFrames = 0;
    this.closingStartMs = null;
    this.blinkStartMs = null;
    this.longBlinkFiredForClosure = false;
  }

  reset(): void {
    this.resetTransientState();
    this.smoothedLeftEar = null;
    this.smoothedRightEar = null;
    this.smoothedEar = null;
  }

  resetAllStats(): void {
    this.reset();
    this.blinkCount = 0;
    this.lastBlinkEvent = null;
  }
}
