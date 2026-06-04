import Groq from "groq-sdk";
import { acquireSlot } from "./rateLimiter";

let _client: Groq | null = null;
function getClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY is not set in .env.local. Get a free key at https://console.groq.com/keys");
    }
    if (!_client) _client = new Groq({ apiKey });
    return _client;
}

export interface LLMCallOptions {
    model: string;
    system?: string;
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    json?: boolean;
    seed?: number;
}

export interface LLMResult {
    text: string;
    model: string;
    usage: { inputTokens: number; outputTokens: number };
    latencyMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function is429(err: unknown): boolean {
    const e = err as { status?: number; message?: string };
    return e?.status === 429 || /429|rate.?limit|too many requests/i.test(String(e?.message ?? err));
}
function isTransient(err: unknown): boolean {
    const e = err as { status?: number; message?: string };
    if (typeof e?.status === "number" && e.status >= 500) return true;
    return /ECONNRESET|ETIMEDOUT|ENOTFOUND|timeout|overloaded|unavailable/i.test(String(e?.message ?? err));
}
/** Pull the server-suggested wait out of a 429 message (Groq says "try again in 1.5s"). */
function retryDelayMs(err: unknown): number {
    const msg = String((err as { message?: string })?.message ?? err);
    const m = msg.match(/try again in (\d+(?:\.\d+)?)s/i);
    return m ? Math.ceil(parseFloat(m[1]) * 1000) + 300 : 4000;
}

export async function llmCall(opts: LLMCallOptions): Promise<LLMResult> {
    const groq = getClient();
    const maxAttempts = 5;
    let lastErr: unknown;

    const messages = [
        ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
        { role: "user" as const, content: opts.prompt },
    ];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await acquireSlot(); // stay under the RPM budget
        const start = Date.now();
        try {
            const res = await groq.chat.completions.create({
                model: opts.model,
                messages,
                temperature: opts.temperature ?? 0,
                max_tokens: opts.maxOutputTokens ?? 4096,
                ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
                ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
            });
            return {
                text: res.choices[0]?.message?.content ?? "",
                model: opts.model,
                usage: {
                    inputTokens: res.usage?.prompt_tokens ?? 0,
                    outputTokens: res.usage?.completion_tokens ?? 0,
                },
                latencyMs: Date.now() - start,
            };
        } catch (err) {
            lastErr = err;
            const rl = is429(err);
            if (!rl && !isTransient(err)) break;
            if (attempt === maxAttempts - 1) break;
            await sleep(rl ? retryDelayMs(err) : 400 * 2 ** attempt);
        }
    }
    throw lastErr;
}