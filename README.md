# NayanSathi — GazeConnect

**Tagline:** *Your Eyes. Your Voice. Your Freedom.*

NayanSathi is a browser-based, AI-assisted Augmentative and Alternative Communication (AAC) platform powered by real-time webcam gaze tracking. It enables people who cannot speak or use conventional input devices to navigate large communication tiles, compose sentences, access smart completions, and speak aloud in **English** and **हिंदी (Hindi)**—using only their eyes, or via keyboard, mouse, or switch access.

---

## Key Capabilities

- **Local Webcam Eye Tracking (`@mediapipe/tasks-vision`)**: Extracts 478 facial & iris landmarks, computes Eye Aspect Ratio (EAR), normalizes iris geometry per eye, estimates head pose (`yaw`, `pitch`, `roll`, `faceScale`), and falls back gracefully if one eye is temporarily occluded.
- **9-Point Calibration & Polynomial Ridge Regression**: Collects ~22 valid non-blink samples per screen target, rejects MAD outliers, evaluates holdout validation residuals across 9 screen regions, and trains independent degree-2 regularized X/Y regression models.
- **1-Euro Adaptive Smoothing**: Suppresses cursor micro-jitter while fixating and responds rapidly during eye saccades, with configurable `minCutoff`, `beta`, and `dCutoff`.
- **Dwell & Blink Interaction**: Configurable dwell selection (`500–3000 ms`), tolerance radius, target hysteresis, cooldown protection, automatic natural-blink pause, and optional intentional long-blink selection.
- **Bilingual AAC & Virtual Keyboard**: Curated phrases across Basic Needs, Emotions, Medical, Social, and Daily Activities in English and हिंदी, plus QWERTY & Devanagari virtual keyboards and Web Speech API text-to-speech.
- **Gemini AI + Offline Fallback**: Server-side `/api/gemini/suggest` route expands selected keywords into polite, concise sentences without altering intent—with deterministic offline suggestions whenever offline or unconfigured.
- **Emergency Panel & Caregiver Portal**: High-contrast emergency phrases with explicit confirmation before preparing copyable/device alerts, plus custom phrase CRUD and strictly **opt-in** communication history (OFF by default).

---

## Project Architecture

```text
├── server.ts                          # Express + Vite server & secure /api/gemini/suggest route
├── backend/                           # Independent Python FastAPI backend
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── api/routes.py
│       ├── core/config.py
│       ├── schemas/suggest.py
│       └── services/gemini_service.py
├── supabase/
│   └── schema.sql                     # PostgreSQL tables & Row Level Security (RLS) policies
├── public/mediapipe/wasm/             # Local MediaPipe Tasks Vision WASM runtime
└── src/
    ├── context/AppStateContext.tsx
    ├── hooks/useEyeTracking.ts
    ├── features/
    │   ├── eye-tracking/              # Camera, FaceLandmarker, Iris, HeadPose, Regression, 1-Euro, Dwell, Blink
    │   ├── communication/             # Bilingual phrase library, sentence builder, keyboard, TTS
    │   ├── ai/                        # Server bridge & deterministic offline fallback
    │   ├── storage/                   # LocalStorage persistence & consent-gated history
    │   └── __tests__/                 # Vitest unit tests
    ├── components/
    │   ├── layout/AppShell.tsx
    │   ├── gaze/                      # GazeCursor, GazeButton, WebcamLandmarkPreview
    │   └── communication/             # EmergencyModal
    └── pages/                         # Landing, Onboarding, Communicate, Calibration, Patient Hub, Caregiver, Settings
```

---

## Running Locally

### 1. Install dependencies & run the full-stack Vite + Express app

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### 2. Run automated unit tests

```bash
npm test
```

### 3. Production build & start

```bash
npm run build
npm start
```

---

## Using Webcam Eye Tracking & Calibration

1. **Enable the Webcam**: Go to **Onboarding**, **Calibrate**, or **Patient Hub**, and click **Start Tracking** (grant browser **Camera** permission when prompted). All video frames are processed locally inside the browser and are never recorded or uploaded.
2. **Complete 9-Point Calibration**:
   - Sit 45–65 cm from the screen with even front lighting (avoid bright windows directly behind you).
   - Keep your head steady and move your eyes smoothly to each illuminated target across all 9 points.
   - After completion, review the **3×3 Screen Region Check** and click any highlighted zone to recalibrate that point individually if needed.
3. **Test Gaze Tracking**: Use the **Live Gaze Dwell Test Pad** on the Calibration results screen or inspect raw vs. 1-Euro filtered coordinates, EAR, confidence, and FPS in **Patient Hub**.

> **Note on Precision**: Webcam-based eye tracking is assistive and non-clinical. Tracking stability varies with lighting, webcam resolution, seating distance, glasses glare, head stability, and calibration quality.

---

## Configuring Gemini AI (Server-Side Only)

Gemini requests run through `/api/gemini/suggest` on the server so API keys never enter client JavaScript.

1. Set `GEMINI_API_KEY` in your environment or AI Studio **Settings > Secrets**.
2. If `GEMINI_API_KEY` is not set, NayanSathi automatically uses its built-in bilingual offline suggestion engine without interruption.

---

## Configuring Supabase (Optional)

Without Supabase credentials, NayanSathi operates fully in **Local Demo Mode** using browser storage.

To enable cloud persistence and caregiver consent links:
1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your environment.

---

## Deploying

- **Full-Stack Node/Express (Cloud Run / Render / Railway)**: Run `npm run build` followed by `npm start` on port `3000` (with `GEMINI_API_KEY` set).
- **Separate Frontend (Vercel) + Python FastAPI Backend**:
  - Deploy the frontend with `VITE_BACKEND_API_URL` pointing to your FastAPI service.
  - Deploy `backend/` using:
    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn app.main:app --host 0.0.0.0 --port 8000
    ```
    Set `GEMINI_API_KEY` and `ALLOWED_ORIGINS` in the FastAPI environment.
