import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '64kb' }));

function hasValidGeminiKey(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

function getGeminiClient(): GoogleGenAI | null {
  if (!hasValidGeminiKey()) return null;
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  const geminiConfigured = hasValidGeminiKey();
  res.json({
    status: 'ok',
    service: 'nayansathi-gazeconnect',
    geminiConfigured,
    timestamp: new Date().toISOString(),
  });
});

interface SuggestRequestBody {
  words?: unknown;
  currentSentence?: unknown;
  language?: unknown;
  contextCategory?: unknown;
}

app.post('/api/gemini/suggest', async (req, res) => {
  try {
    const body = (req.body || {}) as SuggestRequestBody;
    const rawWords = Array.isArray(body.words) ? body.words : [];
    const words = rawWords
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 15);

    const currentSentence =
      typeof body.currentSentence === 'string'
        ? body.currentSentence.trim().slice(0, 300)
        : '';

    const language = body.language === 'hi' ? 'hi' : 'en';
    const contextCategory =
      typeof body.contextCategory === 'string'
        ? body.contextCategory.trim().slice(0, 60)
        : 'general';

    if (words.length === 0 && !currentSentence) {
      return res.status(400).json({
        error: 'Provide selected words or a partial sentence.',
        suggestions: [],
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_NOT_CONFIGURED',
        message: 'Gemini API key is not configured on the server. Using offline suggestions.',
        suggestions: [],
      });
    }

    const languageName = language === 'hi' ? 'Hindi (Devanagari script)' : 'English';
    const systemInstruction = [
      'You are an Augmentative and Alternative Communication (AAC) sentence assistant for NayanSathi.',
      `Generate exactly 3 short, natural, polite, everyday sentences in ${languageName}.`,
      'STRICT RULES:',
      '1. Preserve the exact intended meaning of the user words or partial phrase.',
      '2. Never invent medical symptoms, diagnoses, emergencies, or intentions that the user did not express.',
      '3. Keep each suggestion concise (max 14 words), crystal clear, and easy to read aloud via text-to-speech.',
      '4. Do not include numbering, bullet characters, or commentary.',
    ].join('\n');

    const prompt = [
      `Language: ${languageName}`,
      `Active category: ${contextCategory}`,
      `Selected keywords/phrases: ${words.length > 0 ? words.join(', ') : '(none)'}`,
      `Current partial sentence: ${currentSentence || '(empty)'}`,
      'Return 3 distinct, natural completions or phrasings.',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                description: 'A short, clear AAC communication sentence preserving the user intent.',
              },
            },
          },
          required: ['suggestions'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    let parsed: { suggestions?: unknown } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {};
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 3)
      : [];

    return res.json({
      source: 'gemini',
      language,
      suggestions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upstream Gemini error';
    console.error('Gemini suggestion error:', message);
    return res.status(502).json({
      error: 'GEMINI_UPSTREAM_ERROR',
      message: 'Could not reach Gemini service. Using offline suggestions.',
      suggestions: [],
    });
  }
});

function isSafeExternalSmartHomeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Block cloud metadata and private/loopback literals when user supplies an arbitrary URL
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

app.get('/api/smart-home/status', (_req, res) => {
  const envUrl = process.env.HOME_ASSISTANT_URL?.trim() || '';
  const hasToken = Boolean(process.env.HOME_ASSISTANT_TOKEN?.trim());
  res.json({
    serverBridgeConfigured: Boolean(envUrl && hasToken),
    endpointConfigured: Boolean(envUrl),
  });
});

interface SmartHomeCommandBody {
  endpointUrl?: unknown;
  deviceType?: unknown;
  entityId?: unknown;
  command?: unknown;
}

app.post('/api/smart-home/command', async (req, res) => {
  const body = (req.body || {}) as SmartHomeCommandBody;
  const deviceType = typeof body.deviceType === 'string' ? body.deviceType.trim().slice(0, 40) : '';
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim().slice(0, 100) : '';
  const command = typeof body.command === 'string' ? body.command.trim().slice(0, 80) : '';
  const userEndpoint = typeof body.endpointUrl === 'string' ? body.endpointUrl.trim().slice(0, 300) : '';

  if (!deviceType || !command) {
    return res.status(400).json({
      confirmed: false,
      error: 'Device type and command are required.',
    });
  }

  const serverHaUrl = process.env.HOME_ASSISTANT_URL?.trim() || '';
  const serverHaToken = process.env.HOME_ASSISTANT_TOKEN?.trim() || '';

  if (serverHaUrl && serverHaToken) {
    if (!entityId) {
      return res.status(400).json({
        confirmed: false,
        message: `Smart device bridge connected, but no Home Assistant entity_id is mapped for "${deviceType}". Map an entity ID in Room settings or switch to Caregiver Assistance mode.`,
      });
    }

    const domain = entityId.includes('.') ? entityId.split('.')[0] : 'homeassistant';
    const lowerCmd = command.toLowerCase();
    const service =
      lowerCmd.includes('off') || lowerCmd.includes('close')
        ? domain === 'cover'
          ? 'close_cover'
          : 'turn_off'
        : lowerCmd.includes('on') || lowerCmd.includes('open')
          ? domain === 'cover'
            ? 'open_cover'
            : 'turn_on'
          : 'toggle';

    try {
      const targetUrl = `${serverHaUrl.replace(/\/+$/, '')}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`;
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serverHaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity_id: entityId }),
        signal: AbortSignal.timeout(5000),
      });

      if (!upstream.ok) {
        return res.status(502).json({
          confirmed: false,
          message: `Smart device bridge returned HTTP ${upstream.status}. Physical change was NOT confirmed.`,
        });
      }

      return res.json({
        confirmed: true,
        message: `Confirmed by Home Assistant (${entityId} -> ${service}).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return res.status(502).json({
        confirmed: false,
        message: `Could not reach Home Assistant bridge (${msg}). Use Caregiver Assistance mode instead.`,
      });
    }
  }

  if (userEndpoint) {
    if (!isSafeExternalSmartHomeUrl(userEndpoint)) {
      return res.status(400).json({
        confirmed: false,
        message:
          'Custom smart-home URL must use HTTPS and a public host. For local Home Assistant servers, configure HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN on the server.',
      });
    }
    return res.status(503).json({
      confirmed: false,
      message:
        'Smart home token (HOME_ASSISTANT_TOKEN) is not configured on the server. Device command was not sent — use Caregiver Assistance mode.',
    });
  }

  return res.status(503).json({
    confirmed: false,
    message:
      'No authenticated smart home bridge is connected. Configure HOME_ASSISTANT_URL / HOME_ASSISTANT_TOKEN or use Caregiver Assistance mode.',
  });
});

app.get('/api/chess/status', (_req, res) => {
  const stockfishUrl = process.env.STOCKFISH_ENDPOINT_URL?.trim() || '';
  res.json({
    stockfishConfigured: Boolean(stockfishUrl),
  });
});

app.post('/api/chess/best-move', async (req, res) => {
  const body = (req.body || {}) as { fen?: unknown; depth?: unknown };
  const fen = typeof body.fen === 'string' ? body.fen.trim().slice(0, 120) : '';
  const depth = typeof body.depth === 'number' ? Math.max(1, Math.min(18, Math.round(body.depth))) : 8;

  if (!fen) {
    return res.status(400).json({ error: 'FEN string is required.' });
  }

  const stockfishUrl = process.env.STOCKFISH_ENDPOINT_URL?.trim() || '';
  if (!stockfishUrl) {
    return res.status(503).json({
      source: 'unconfigured',
      message: 'Stockfish engine URL is not configured on the server; using built-in JS move search.',
    });
  }

  try {
    const upstream = await fetch(stockfishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth }),
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `Stockfish upstream HTTP ${upstream.status}` });
    }
    const data = (await upstream.json()) as { bestmove?: string; move?: string };
    return res.json({
      source: 'stockfish',
      bestmove: data.bestmove || data.move || '',
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Stockfish engine unavailable.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname);
    const clientDir = fsExists(path.join(distPath, 'index.html'))
      ? distPath
      : path.resolve(process.cwd(), 'dist');
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NayanSathi GazeConnect server running on http://0.0.0.0:${PORT}`);
  });
}

function fsExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

startServer();
