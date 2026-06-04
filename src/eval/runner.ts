import { compile, type CompileResult } from "@/pipeline/compile";
import { DATASET, type EvalCase } from "./dataset";
import { toRecord, aggregate, toMarkdown, type RunRecord } from "./metrics";

function classifyError(err: unknown): { message: string; type: string } {
    const msg = String((err as { message?: string })?.message ?? err);
    const type = /429|rate.?limit|quota|tokens per (day|minute)|resource exhausted/i.test(msg)
        ? "rate_limit" : "exception";
    return { message: msg.slice(0, 300), type };
}

export interface EvalReport {
    records: RunRecord[];
    aggregate: ReturnType<typeof aggregate>;
    markdown: string;
}

/** Run the whole dataset sequentially (gentle on rate limits). */
export async function runEval(cases: EvalCase[] = DATASET): Promise<EvalReport> {
    const records: RunRecord[] = [];
    for (const c of cases) {
        const start = Date.now();
        try {
            const result: CompileResult = await compile(c.prompt);
            records.push(toRecord(c, result));
        } catch (err) {
            records.push(toRecord(c, null, classifyError(err), Date.now() - start));
        }
    }
    const agg = aggregate(records);
    return { records, aggregate: agg, markdown: toMarkdown(records, agg) };
}