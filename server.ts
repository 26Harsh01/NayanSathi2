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
