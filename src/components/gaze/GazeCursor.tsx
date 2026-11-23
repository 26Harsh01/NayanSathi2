import React, { useEffect, useRef } from 'react';
import { useEyeTracking } from '../../hooks/useEyeTracking';
import { useAppState } from '../../context/AppStateContext';

const VIEWBOX_WIDTH = 24;
const VIEWBOX_HEIGHT = 28;
// Arrow apex vertex is at (2, 2); strokeWidth=1.6 places visible pointed tip at (~1.4, ~1.4)
const HOTSPOT_VIEWBOX_X = 1.4;
const HOTSPOT_VIEWBOX_Y = 1.4;

/**
 * Renders a standard diagonal desktop mouse pointer SVG whose pointed tip sits
 * directly at the predicted viewport gaze coordinates (x, y) via requestAnimationFrame.
 */
export const GazeCursor: React.FC = () => {
  const { cursorStateRef, isRunning, isPaused } = useEyeTracking();
  const { settings, calibration } = useAppState();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const debugBadgeRef = useRef<HTMLDivElement | null>(null);

  const pointerHeight = Math.max(24, Math.min(36, settings.eyeTracking.cursorSize || 28));
  const pointerWidth = Math.round(pointerHeight * (VIEWBOX_WIDTH / VIEWBOX_HEIGHT));
  const hotspotOffsetX = (HOTSPOT_VIEWBOX_X / VIEWBOX_WIDTH) * pointerWidth;
  const hotspotOffsetY = (HOTSPOT_VIEWBOX_Y / VIEWBOX_HEIGHT) * pointerHeight;

  useEffect(() => {
    let rafId = 0;
    let lastMouseMoveMs = 0;
    let lastMouseX = -1;
    let lastMouseY = -1;

    const handleMouseMove = (e: MouseEvent) => {
      if (lastMouseX < 0 || Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY) >= 2) {
        lastMouseMoveMs = performance.now();
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const updateVisual = () => {
      const state = cursorStateRef.current;
      const el = containerRef.current;
      const badge = debugBadgeRef.current;

      const shouldShow =
        isRunning &&
        !isPaused &&
        Boolean(calibration) &&
        settings.eyeTracking.cursorVisible &&
        state.visible;

      if (el) {
        el.style.opacity = shouldShow ? '1' : '0';
        el.style.transform = `translate3d(${state.x - hotspotOffsetX}px, ${state.y - hotspotOffsetY}px, 0)`;
      }

      const osMouseIdle = lastMouseMoveMs === 0 || performance.now() - lastMouseMoveMs > 1800;
      document.documentElement.classList.toggle('gaze-pointer-active', shouldShow && osMouseIdle);

      if (badge && settings.eyeTracking.showDebugOverlay) {
        const tgt = state.activeTargetId ? ` · ${state.activeTargetId}` : '';
        badge.textContent = `${Math.round(state.x)}, ${Math.round(state.y)}${tgt}`;
      }

      rafId = requestAnimationFrame(updateVisual);
    };

    rafId = requestAnimationFrame(updateVisual);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.classList.remove('gaze-pointer-active');
    };
  }, [
    calibration,
    cursorStateRef,
    hotspotOffsetX,
    hotspotOffsetY,
    isPaused,
    isRunning,
    settings.eyeTracking.cursorVisible,
    settings.eyeTracking.showDebugOverlay,
  ]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{
        width: pointerWidth,
        height: pointerHeight,
        opacity: 0,
        willChange: 'transform, opacity',
      }}
    >
      <svg
        width={pointerWidth}
        height={pointerHeight}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        overflow="visible"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(15, 23, 42, 0.35))' }}
      >
        <polygon
          points="2,2 2,21.5 6.6,17.2 10.2,25 12.8,23.8 9.3,16 15.6,15.6"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {settings.eyeTracking.showDebugOverlay && (
        <div
          ref={debugBadgeRef}
          className="absolute left-full top-1 ml-1 px-2 py-0.5 rounded bg-slate-950/85 text-white text-[10px] font-mono whitespace-nowrap border border-slate-700"
        />
      )}
    </div>
  );
};
