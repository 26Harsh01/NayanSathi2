import type { HeadPose } from '../../types';
import type { NormalizedLandmark } from './iris-extractor';

/**
 * Estimates consistent head pose (yaw, pitch, roll, face center, inter-ocular scale)
 * directly from MediaPipe facial geometry so sign polarity is guaranteed identical
 * regardless of transformation-matrix availability or camera preview mirroring.
 *
 * Sign conventions in unmirrored camera frame (+X right, +Y down):
 *   - yaw > 0 when nose tip shifts toward +X (camera-right / user's left)
 *   - pitch > 0 when nose tip shifts toward +Y (tilting chin down)
 *   - roll > 0 when camera-right eye drops lower than camera-left eye
 */
export function estimateHeadPose(
  landmarks: NormalizedLandmark[],
  _transformationMatrix?: number[] | Float32Array | null
): HeadPose {
  const noseTip = landmarks[1];
  const noseBridge = landmarks[168];
  const viewerRightEyeOuter = landmarks[263]; // subject's left outer corner (+X in unmirrored image)
  const viewerLeftEyeOuter = landmarks[33]; // subject's right outer corner (-X in unmirrored image)
  const forehead = landmarks[10];
  const chin = landmarks[152];

  if (!noseTip || !viewerRightEyeOuter || !viewerLeftEyeOuter || !forehead || !chin) {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
      faceCenterX: 0.5,
      faceCenterY: 0.5,
      faceScale: 0.15,
      excessiveMovement: false,
    };
  }

  const eyeMidX = (viewerRightEyeOuter.x + viewerLeftEyeOuter.x) * 0.5;
  const eyeMidY = (viewerRightEyeOuter.y + viewerLeftEyeOuter.y) * 0.5;
  const faceHeight = Math.max(0.05, Math.hypot(chin.x - forehead.x, chin.y - forehead.y));
  const interOcular = Math.max(
    0.03,
    Math.hypot(
      viewerRightEyeOuter.x - viewerLeftEyeOuter.x,
      viewerRightEyeOuter.y - viewerLeftEyeOuter.y
    )
  );

  // Roll from outer eye corners in image coordinates
  const roll = Math.atan2(
    viewerRightEyeOuter.y - viewerLeftEyeOuter.y,
    viewerRightEyeOuter.x - viewerLeftEyeOuter.x
  );

  // Rotate nose offset by -roll into head-upright basis so head tilt doesn't corrupt yaw/pitch
  const cosR = Math.cos(-roll);
  const sinR = Math.sin(-roll);
  const dxNose = noseTip.x - eyeMidX;
  const dyNose = noseTip.y - eyeMidY;
  const uprightNoseDx = dxNose * cosR - dyNose * sinR;

  const bridgeRefY = noseBridge ? (eyeMidY + noseBridge.y) * 0.5 : eyeMidY;
  const faceVertMidY = (forehead.y + chin.y) * 0.5;
  const pitchRefY = bridgeRefY * 0.35 + faceVertMidY * 0.65;

  // Yaw from horizontal nose displacement relative to inter-ocular line (+ if nose shifts +X)
  let rawYaw = (uprightNoseDx / interOcular) * 1.85;
  // Blend with z-depth differential between eye corners if MediaPipe z is populated
  const lz = viewerLeftEyeOuter.z ?? 0;
  const rz = viewerRightEyeOuter.z ?? 0;
  if (Math.abs(lz - rz) > 1e-4) {
    const zYaw = ((lz - rz) / interOcular) * 0.9;
    rawYaw = rawYaw * 0.75 + zYaw * 0.25;
  }

  // Pitch from vertical nose displacement (+ when chin/nose tilt downward +Y)
  const rawPitch = ((noseTip.y - pitchRefY) / faceHeight - 0.035) * 2.5;

  const yaw = Math.max(-1, Math.min(1, rawYaw));
  const pitch = Math.max(-1, Math.min(1, rawPitch));
  const excessiveMovement =
    Math.abs(yaw) > 0.52 ||
    Math.abs(pitch) > 0.52 ||
    Math.abs(roll) > 0.42 ||
    interOcular < 0.055 ||
    interOcular > 0.45;

  return {
    yaw,
    pitch,
    roll,
    faceCenterX: eyeMidX,
    faceCenterY: eyeMidY,
    faceScale: interOcular,
    excessiveMovement,
  };
}
