/**
 * Gemini AI helper.
 * Uses the real Gemini REST API when GEMINI_API_KEY is configured,
 * otherwise falls back to simulated dev-mode responses.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Static safety net, newest first. The live list from ListModels (below)
// takes priority; override everything with GEMINI_CHAT_MODEL to pin.
const STATIC_CHAT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash"];
// gemini-embedding-001 truncated to 768 dims to match the vector(768) column
// (text-embedding-004 was retired by Google)
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ─── Real Gemini calls ──────────────────────────────────────────────────────

/** Retries transient Gemini failures (503 overloaded / 429 rate limit / hung
 *  connections) with a short backoff and a hard 12s per-attempt timeout.
 *  Budget stays under ~30s total because Next serializes server actions per
 *  client — a slow AI call would otherwise queue every other page's data. */
async function fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
      if (res.ok || (res.status !== 503 && res.status !== 429)) return res;
      lastError = new Error(`Gemini transient ${res.status}`);
    } catch (e) {
      lastError = e; // timeout / network error — retry
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

async function generateWithModel(model: string, prompt: string, apiKey: string): Promise<string> {
  const res = await fetchWithRetry(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// ── Dynamic model discovery ─────────────────────────────────────────────────
// Asks Google which models THIS key can use right now and prefers the newest
// flash generation, so we automatically ride model upgrades instead of
// hardcoding one. Cached for an hour per server instance.

let modelCache: { models: string[]; at: number } | null = null;
const MODEL_CACHE_TTL = 60 * 60 * 1000;

/** Newest-first generation rank parsed from names like gemini-2.5-flash. */
function generationOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : name.includes("latest") ? 999 : 0;
}

async function discoverChatModels(apiKey: string): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_TTL) return modelCache.models;
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=100`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) throw new Error(`ListModels ${res.status}`);
    const data = await res.json();
    const models: string[] = (data?.models ?? [])
      .filter((m: { name?: string; supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        /flash/i.test(m.name ?? "") &&
        !/(image|audio|tts|live|thinking|exp\b)/i.test(m.name ?? "")
      )
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      // newest generation first; within a generation, non-lite before lite
      .sort((a: string, b: string) =>
        generationOf(b) - generationOf(a) || Number(/lite/.test(a)) - Number(/lite/.test(b))
      );
    if (models.length > 0) {
      modelCache = { models: models.slice(0, 4), at: Date.now() };
      return modelCache.models;
    }
  } catch {
    /* discovery is best-effort — fall through to the static list */
  }
  return STATIC_CHAT_MODELS;
}

export async function generateText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  // Explicit pin wins; otherwise use the live list with the static safety net.
  const pinned = process.env.GEMINI_CHAT_MODEL;
  const candidates = pinned
    ? [pinned, ...STATIC_CHAT_MODELS.filter((m) => m !== pinned)]
    : [...new Set([...(await discoverChatModels(apiKey)), ...STATIC_CHAT_MODELS])];

  let lastError: unknown = null;
  for (const model of candidates) {
    try {
      return await generateWithModel(model, prompt, apiKey);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All Gemini models unavailable");
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const res = await fetchWithRetry(`${GEMINI_BASE}/models/${EMBEDDING_MODEL}:embedContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini embedding error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const values: number[] | undefined = data?.embedding?.values;
  if (!values?.length) throw new Error("Gemini returned an empty embedding");

  // Truncated-dimension embeddings are not unit-normalized; normalize for
  // consistent cosine-distance behavior in pgvector
  const norm = Math.sqrt(values.reduce((acc, v) => acc + v * v, 0));
  return norm > 0 ? values.map((v) => v / norm) : values;
}

// ─── Mock fallback (no API key) ─────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, string> = {
  default:
    "🤖 [AI Assistant — Dev Mode]\n\nThis is a simulated AI response. In production, I will be powered by Google Gemini 2.0 Flash and will answer questions using the university's knowledge base (policies, handbooks, circulars, and student data).\n\nConnect your GEMINI_API_KEY to enable real AI responses.",
  attendance:
    "🤖 [AI Assistant — Dev Mode]\n\n**Attendance Policy (Simulated):**\nMinimum 75% attendance is required in each subject to be eligible for final exams. If attendance falls below 65%, the student may be detained.\n\n_Source: University Handbook 2024-25, Section 4.2_",
  sgpa: "🤖 [AI Assistant — Dev Mode]\n\n**SGPA Calculation (Simulated):**\nSGPA = Σ(Ci × Pi) / Σ(Ci)\nWhere Ci = credits of ith course, Pi = grade point earned.\nSGPA is calculated to 3 decimal places.\n\n_Source: Student Handbook 2024-25, Page 35_",
  cgpa: "🤖 [AI Assistant — Dev Mode]\n\n**CGPA Calculation (Simulated):**\nCGPA = Σ(Cj × Pj) / Σ(Cj)\nCGPA considers all semesters from first registration. Calculated to 2 decimal places.\nFor UG: grade points < 4 not considered. For PG: grade points < 6 not considered.\n\n_Source: Student Handbook 2024-25_",
};

function mockResponse(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes("attendance")) return MOCK_RESPONSES.attendance;
  if (lowerPrompt.includes("sgpa")) return MOCK_RESPONSES.sgpa;
  if (lowerPrompt.includes("cgpa")) return MOCK_RESPONSES.cgpa;
  return MOCK_RESPONSES.default;
}

/** Ask the AI a question. Uses real Gemini if configured, mock otherwise. */
export async function askAI(prompt: string): Promise<string> {
  if (isAiConfigured()) {
    return generateText(prompt);
  }

  await new Promise((r) => setTimeout(r, 800)); // Simulate latency
  return mockResponse(prompt);
}
