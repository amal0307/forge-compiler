/** Three tiers — cheap→strong. Repair escalates base→pro automatically. */
export const MODELS = {
    fast: process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant",
    base: process.env.GROQ_MODEL_BASE || "llama-3.3-70b-versatile",
    pro: process.env.GROQ_MODEL_PRO || "openai/gpt-oss-120b",
} as const;

/** Groq pay-as-you-go rates (free tier = $0). USD per 1M tokens — used so the
 *  cost/quality analysis is grounded in real numbers even though we pay nothing. */
export const PRICING: Record<string, { in: number; out: number }> = {
    "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
    "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
    "openai/gpt-oss-120b": { in: 0.15, out: 0.75 },
};

export function estimateCost(model: string, inTok: number, outTok: number): number {
    const p = PRICING[model] ?? { in: 0, out: 0 };
    return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}