// Global sliding-window limiter shared by every LLM call in this process.
// Gemini's free tier allows only a few requests/minute, so we queue politely
// instead of bursting and eating 429s.

const WINDOW_MS = 60_000;
let starts: number[] = [];
let gate: Promise<void> = Promise.resolve();

function maxRpm(): number {
    const n = parseInt(process.env.LLM_MAX_RPM || "20", 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
}

/** Resolves when it's safe to start another request without exceeding the RPM cap. */
export function acquireSlot(): Promise<void> {
    const next = gate.then(async () => {
        for (; ;) {
            const now = Date.now();
            starts = starts.filter((t) => now - t < WINDOW_MS);
            if (starts.length < maxRpm()) {
                starts.push(now);
                return;
            }
            const waitMs = WINDOW_MS - (now - starts[0]) + 100;
            await new Promise((r) => setTimeout(r, waitMs));
        }
    });
    gate = next.catch(() => { }); // keep the chain alive even if a waiter rejects
    return next;
}