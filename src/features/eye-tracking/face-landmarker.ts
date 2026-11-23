import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let sharedLandmarkerPromise: Promise<FaceLandmarker> | null = null;
let sharedLandmarkerInstance: FaceLandmarker | null = null;
let mediaPipeLogFilterInstalled = false;

const WASM_BASE_PATH = '/mediapipe/wasm';
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * MediaPipe's Emscripten WASM runtime writes C++ LOG(INFO) diagnostics such as
 * "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." to Module.printErr -> console.error.
 * Suppress only those benign TFLite INFO messages so real errors still surface normally.
 */
function installMediaPipeInfoLogFilter(): void {
  if (mediaPipeLogFilterInstalled || typeof console === 'undefined') {
    return;
  }
  mediaPipeLogFilterInstalled = true;
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string') {
      const trimmed = first.trimStart();
      if (
        trimmed.startsWith('INFO: Created TensorFlow Lite XNNPACK delegate') ||
        trimmed.startsWith('INFO: Applying')
      ) {
        return;
      }
    }
    originalConsoleError(...args);
  };
}

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (sharedLandmarkerInstance) {
    return sharedLandmarkerInstance;
  }
  if (sharedLandmarkerPromise) {
    return sharedLandmarkerPromise;
  }

  installMediaPipeInfoLogFilter();

  sharedLandmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
    try {
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 3,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      sharedLandmarkerInstance = landmarker;
      return landmarker;
    } catch {
      // Fallback to CPU delegate if WebGL/GPU delegate is unavailable on device
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 3,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      sharedLandmarkerInstance = landmarker;
      return landmarker;
    }
  })().catch((err) => {
    sharedLandmarkerPromise = null;
    throw err;
  });

  return sharedLandmarkerPromise;
}

export function disposeFaceLandmarker(): void {
  if (sharedLandmarkerInstance) {
    try {
      sharedLandmarkerInstance.close();
    } catch {
      // ignore
    }
    sharedLandmarkerInstance = null;
    sharedLandmarkerPromise = null;
  }
}
