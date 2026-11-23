import type { CameraErrorCode } from '../../types';

export interface CameraStartResult {
  ok: boolean;
  stream?: MediaStream;
  errorCode?: CameraErrorCode;
  errorMessage?: string;
}

export function classifyCameraError(err: unknown): {
  code: CameraErrorCode;
  message: string;
} {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      code: 'unsupported',
      message: 'This browser does not support webcam access (getUserMedia).',
    };
  }

  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'permission-denied',
      message:
        'Camera permission was denied. Please allow camera access in your browser site settings and try again.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'not-found',
      message: 'No webcam device was detected. Please connect a camera and retry.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'in-use',
      message:
        'Your webcam is currently in use by another application or browser tab. Close other video apps and retry.',
    };
  }
  return {
    code: 'unknown',
    message:
      err instanceof Error
        ? err.message
        : 'Unable to access webcam. Check permissions and camera hardware.',
  };
}

export async function startWebcamStream(
  preferredWidth = 640,
  preferredHeight = 480
): Promise<CameraStartResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const classified = classifyCameraError(null);
    return {
      ok: false,
      errorCode: classified.code,
      errorMessage: classified.message,
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: preferredWidth },
        height: { ideal: preferredHeight },
        frameRate: { ideal: 30, min: 15 },
      },
      audio: false,
    });
    return { ok: true, stream };
  } catch (err) {
    const classified = classifyCameraError(err);
    return {
      ok: false,
      errorCode: classified.code,
      errorMessage: classified.message,
    };
  }
}

export function stopWebcamStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Ignore already stopped tracks
    }
  }
}

export async function queryCameraPermissionState(): Promise<
  'granted' | 'denied' | 'prompt' | 'unknown'
> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return 'unknown';
    }
    const status = await navigator.permissions.query({
      name: 'camera' as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
