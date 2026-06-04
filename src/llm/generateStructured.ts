import { z } from "zod";
import { llmCall } from "./client";

export interface GenStructuredOptions<T extends z.ZodType> {
    schema: T;
    schemaName: string;
    system: string;
    prompt: string;
    model: string;
    escalateModel?: string; // stronger model used once repairs begin
    maxRepairs?: number;
    maxOutputTokens?: number;    // default 2
    temperature?: number;
    seed?: number;
}

export interface GenTelemetry {
    attempts: number;
    repairs: number;
    modelsUsed: string[];
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    errorsSeen: string[];
}

export interface GenStructuredResult<T> {
    ok: boolean;
    data?: T;
    telemetry: GenTelemetry;
    finalError?: string;
}

/* ---------- helpers ---------- */

function safeJsonSchema(schema: z.ZodType): unknown {
    try {
        return z.toJSONSchema(schema);
    } catch {
        return { note: "Infer the structure from the field names and the example." };
    }
}

function stripFences(text: string): string {
    return text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
}

function extractFirstJson(text: string): string | null {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    return text.slice(first, last + 1);
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
    const cleaned = stripFences(text);
    try {
        return { ok: true, value: JSON.parse(cleaned) };
    } catch (e) {
        const extracted = extractFirstJson(cleaned);
        if (extracted) {
            try {
                return { ok: true, value: JSON.parse(extracted) };
            } catch {
                /* fall through */
            }
        }
        return { ok: false, error: (e as Error).message };
    }
}

function formatZodErrors(err: z.ZodError): string {
    return err.issues
        .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

/* ---------- the wrapper ---------- */

export async function generateStructured<T extends z.ZodType>(
    opts: GenStructuredOptions<T>
): Promise<GenStructuredResult<z.infer<T>>> {
    const maxRepairs = opts.maxRepairs ?? 2;
    const tel: GenTelemetry = {
        attempts: 0, repairs: 0, modelsUsed: [],
        inputTokens: 0, outputTokens: 0, latencyMs: 0, errorsSeen: [],
    };

    const contract =
        `You MUST return ONE JSON object conforming EXACTLY to this JSON Schema ` +
        `for "${opts.schemaName}":\n${JSON.stringify(safeJsonSchema(opts.schema))}\n` +
        `Return ONLY the JSON object.`;

    let userPrompt = `${opts.prompt}\n\n${contract}`;
    let lastErrors = "";

    for (let round = 0; round <= maxRepairs; round++) {
        // Round 0 = base model. Repairs escalate to the stronger model.
        const useModel = round === 0 ? opts.model : opts.escalateModel ?? opts.model;
        tel.attempts++;
        if (!tel.modelsUsed.includes(useModel)) tel.modelsUsed.push(useModel);

        const res = await llmCall({
            model: useModel,
            system: opts.system,
            prompt: userPrompt,
            temperature: opts.temperature ?? 0,
            maxOutputTokens: opts.maxOutputTokens,
            seed: opts.seed,
            json: true,
        });
        tel.inputTokens += res.usage.inputTokens;
        tel.outputTokens += res.usage.outputTokens;
        tel.latencyMs += res.latencyMs;

        const parsed = parseJson(res.text);
        if (!parsed.ok) {
            lastErrors = `Output was not valid JSON: ${parsed.error}`;
        } else {
            const check = opts.schema.safeParse(parsed.value);
            if (check.success) {
                return { ok: true, data: check.data, telemetry: tel };
            }
            lastErrors = formatZodErrors(check.error);
        }
        tel.errorsSeen.push(lastErrors);

        if (round === maxRepairs) break;

        // Targeted repair: original task + the broken output + the EXACT errors.
        tel.repairs++;
        userPrompt =
            `${opts.prompt}\n\n${contract}\n\n` +
            `Your previous response was INVALID. You returned:\n` +
            "```json\n" + truncate(res.text, 4000) + "\n```\n\n" +
            `It failed validation with these SPECIFIC errors:\n${lastErrors}\n\n` +
            `Return a corrected JSON object that fixes exactly these errors and ` +
            `conforms to the schema. Keep everything that was already valid.`;
    }

    return { ok: false, telemetry: tel, finalError: lastErrors };
}