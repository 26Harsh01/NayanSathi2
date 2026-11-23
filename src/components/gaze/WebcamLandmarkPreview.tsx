import React, { useEffect, useRef } from 'react';
import { useEyeTracking } from '../../hooks/useEyeTracking';
import { useAppState } from '../../context/AppStateContext';
import { EYE_LANDMARK_INDICES } from '../../features/eye-tracking/iris-extractor';

interface WebcamLandmarkPreviewProps {
  showLandmarks?: boolean;
  compact?: boolean;
  className?: string;
}

export const WebcamLandmarkPreview: React.FC<WebcamLandmarkPreviewProps> = ({
  showLandmarks = true,
  compact = false,
  className = '',
}) => {
  const { attachPreviewVideo, diagnostics, isRunning, errorMessage } = useEyeTracking();
  const { settings, calibration } = useAppState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    attachPreviewVideo(videoRef.current);
    return () => {
      attachPreviewVideo(null);
    };
  }, [attachPreviewVideo, isRunning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!showLandmarks) {
      return;
    }

    // Match object-cover geometry of the mirrored preview video (-scale-x-100)
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const coverScale = Math.max(w / vw, h / vh);
    const drawnW = vw * coverScale;
    const drawnH = vh * coverScale;
    const offsetX = (w - drawnW) * 0.5;
    const offsetY = (h - drawnH) * 0.5;

    const mapPoint = (pt: { x: number; y: number }) => ({
      x: offsetX + (1 - pt.x) * drawnW,
      y: offsetY + pt.y * drawnH,
    });

    // When multiple faces are detected, outline and label each subject so caregivers can pick cleanly
    if (diagnostics.detectedFaces.length > 1 && diagnostics.allFaceLandmarks.length > 1) {
      for (const faceSummary of diagnostics.detectedFaces) {
        const faceLms = diagnostics.allFaceLandmarks[faceSummary.index];
        if (!faceLms || faceLms.length < 478) continue;

        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        for (const idx of [10, 152, 234, 454]) {
          const pt = faceLms[idx];
          if (!pt) continue;
          const mapped = mapPoint(pt);
          minX = Math.min(minX, mapped.x);
          maxX = Math.max(maxX, mapped.x);
          minY = Math.min(minY, mapped.y);
          maxY = Math.max(maxY, mapped.y);
        }

        const boxX = Math.max(4, minX - 14);
        const boxY = Math.max(4, minY - 14);
        const boxW = Math.max(30, maxX - minX + 28);
        const boxH = Math.max(40, maxY - minY + 28);

        const isSelected =
          diagnostics.selectedSubjectLabel !== null &&
          diagnostics.landmarks === faceLms;

        ctx.strokeStyle = isSelected ? '#14b8a6' : '#f59e0b';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = isSelected ? 'rgba(13, 148, 136, 0.92)' : 'rgba(180, 83, 9, 0.92)';
        ctx.fillRect(boxX, Math.max(4, boxY - 22), 92, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12px sans-serif';
        ctx.fillText(`Subject ${faceSummary.displayNumber}`, boxX + 6, Math.max(18, boxY - 7));
      }
    }

    if (!diagnostics.landmarks || diagnostics.landmarks.length < 478) {
      return;
    }

    const lms = diagnostics.landmarks;

    const drawPoint = (idx: number, color: string, radius: number) => {
      const pt = lms[idx];
      if (!pt) return;
      const { x, y } = mapPoint(pt);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const drawEarContour = (contour: readonly number[], color: string) => {
      ctx.beginPath();
      contour.forEach((idx, i) => {
        const pt = lms[idx];
        if (!pt) return;
        const { x, y } = mapPoint(pt);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };

    const drawEye = (eye: typeof EYE_LANDMARK_INDICES.left | typeof EYE_LANDMARK_INDICES.right) => {
      drawEarContour(eye.earContour, 'rgba(56, 189, 248, 0.75)');
      drawPoint(eye.outerCorner, '#38bdf8', 2.5);
      drawPoint(eye.innerCorner, '#38bdf8', 2.5);
      drawPoint(eye.upperCenter, '#38bdf8', 2);
      drawPoint(eye.lowerCenter, '#38bdf8', 2);
      drawPoint(eye.irisCenter, '#14b8a6', 4);
      for (const ringIdx of eye.irisRing) {
        drawPoint(ringIdx, '#2dd4bf', 2);
      }
    };

    drawEye(EYE_LANDMARK_INDICES.left);
    drawEye(EYE_LANDMARK_INDICES.right);
    drawPoint(1, '#f59e0b', 3); // Nose tip reference
  }, [
    diagnostics.allFaceLandmarks,
    diagnostics.detectedFaces,
    diagnostics.landmarks,
    diagnostics.selectedSubjectLabel,
    showLandmarks,
  ]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 aspect-[4/3] ${className}`}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="w-full h-full object-cover -scale-x-100"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {isRunning && !compact && settings.eyeTracking.showDebugOverlay && (
        <div className="absolute top-2.5 left-2.5 px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-700 text-[11px] font-mono text-slate-100 pointer-events-none space-y-0.5">
          <div>
            Viewport: {calibration ? `${Math.round(diagnostics.filteredX)}, ${Math.round(diagnostics.filteredY)} px` : 'Uncalibrated'}
          </div>
          <div>
            EAR L/R: {diagnostics.blink.earLeft.toFixed(2)} / {diagnostics.blink.earRight.toFixed(2)} · {diagnostics.blink.state}
          </div>
        </div>
      )}

      {isRunning && diagnostics.headMovementWarning && (
        <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-500/70 text-[11px] font-medium text-amber-200 text-center pointer-events-none">
          {compact ? 'Re-center head position' : 'Head moved outside calibrated angle — re-center face for best accuracy'}
        </div>
      )}

      {!isRunning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900/90 text-slate-200">
          <p className={compact ? 'text-xs font-medium' : 'text-sm font-medium'}>
            {errorMessage
              ? errorMessage
              : compact
                ? 'Camera off · Start tracking above'
                : 'Webcam is currently stopped. Click Start Tracking to preview local landmark detection.'}
          </p>
        </div>
      )}
    </div>
  );
};
