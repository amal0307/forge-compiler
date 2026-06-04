import type { CompileResult } from "@/pipeline/compile";
import type { EvalCase } from "./dataset";

export interface RunRecord {
    id: string;
    category: EvalCase["category"];
    subtype?: EvalCase["subtype"];
    prompt: string;
    ok: boolean;
    failedStage?: string;
    errorType?: string;
    repairs: number;
    llmCalls: number;
    latencyMs: number;
    tokens: number;
    costUsd: number;
    violationsFound: number;
    autoFixed: number;
    flaggedVague: boolean;
    entities: number;
    tables: number;
    endpoints: number;
}

export function toRecord(
    c: EvalCase, r: CompileResult | null,
    err?: { message: string; type: string }, latencyMs?: number,
): RunRecord {
    if (!r) {
        return {
            id: c.id, category: c.category, subtype: c.subtype, prompt: c.prompt,
            ok: false, errorType: err?.type ?? "exception",
            repairs: 0, llmCalls: 0, latencyMs: latencyMs ?? 0, tokens: 0, costUsd: 0,
            violationsFound: 0, autoFixed: 0, flaggedVague: false, entities: 0, tables: 0, endpoints: 0,
        };
    }
    return {
        id: c.id, category: c.category, subtype: c.subtype, prompt: c.prompt,
        ok: r.ok, failedStage: r.failedStage, errorType: r.ok ? undefined : "pipeline",
        repairs: r.metrics.repairs, llmCalls: r.metrics.llmCalls,
        latencyMs: r.metrics.totalLatencyMs,
        tokens: r.metrics.inputTokens + r.metrics.outputTokens,
        costUsd: r.metrics.estCostUsd,
        violationsFound: r.violations.architectureBefore.length,
        autoFixed: r.autoFixes.length,
        flaggedVague: r.intent?.ambiguity.isVague ?? false,
        entities: r.architecture?.entities.length ?? 0,
        tables: r.schemas?.db.tables.length ?? 0,
        endpoints: r.schemas?.api.endpoints.length ?? 0,
    };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function percentile(values: number[], p: number): number {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export function aggregate(records: RunRecord[]) {
    const n = records.length;
    const ok = records.filter((r) => r.ok);
    const real = records.filter((r) => r.category === "real");
    const edge = records.filter((r) => r.category === "edge");
    const lat = records.map((r) => r.latencyMs).filter((x) => x > 0);

    const failureTypes: Record<string, number> = {};
    for (const r of records.filter((x) => !x.ok)) {
        const key = r.errorType === "rate_limit" ? "rate_limit"
            : r.failedStage ? `failed:${r.failedStage}` : (r.errorType ?? "unknown");
        failureTypes[key] = (failureTypes[key] ?? 0) + 1;
    }

    return {
        total: n,
        successRate: n ? ok.length / n : 0,
        successRateReal: real.length ? real.filter((r) => r.ok).length / real.length : 0,
        successRateEdge: edge.length ? edge.filter((r) => r.ok).length / edge.length : 0,
        edgeGraceful: edge.length ? edge.filter((r) => r.ok || r.flaggedVague).length / edge.length : 0,
        avgRepairs: n ? sum(records.map((r) => r.repairs)) / n : 0,
        maxRepairs: Math.max(0, ...records.map((r) => r.repairs)),
        totalAutoFixed: sum(records.map((r) => r.autoFixed)),
        failureTypes,
        latencyP50: percentile(lat, 50),
        latencyP95: percentile(lat, 95),
        latencyAvg: lat.length ? sum(lat) / lat.length : 0,
        totalTokens: sum(records.map((r) => r.tokens)),
        totalCostUsd: sum(records.map((r) => r.costUsd)),
        avgCostUsd: n ? sum(records.map((r) => r.costUsd)) / n : 0,
    };
}

export function toMarkdown(records: RunRecord[], agg: ReturnType<typeof aggregate>): string {
    const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
    const ms = (x: number) => `${(x / 1000).toFixed(1)}s`;

    const rows = records.map((r) =>
        `| ${r.id} | ${r.category}${r.subtype ? `/${r.subtype}` : ""} | ${r.ok ? "✅" : "❌"} | ${r.repairs} | ${r.autoFixed} | ${r.entities} | ${ms(r.latencyMs)} | $${r.costUsd.toFixed(5)} | ${r.failedStage ?? r.errorType ?? "—"} |`,
    ).join("\n");

    const ft = Object.entries(agg.failureTypes).map(([k, v]) => `- \`${k}\`: ${v}`).join("\n") || "- none 🎉";

    return `# Forge — Evaluation Report

_Generated ${new Date().toISOString()}_

## Summary
| Metric | Value |
|---|---|
| Prompts | ${agg.total} |
| **Success rate** | **${pct(agg.successRate)}** |
| Success — real prompts | ${pct(agg.successRateReal)} |
| Success — edge cases | ${pct(agg.successRateEdge)} |
| Edge graceful-handling | ${pct(agg.edgeGraceful)} |
| Avg repairs / request | ${agg.avgRepairs.toFixed(2)} |
| Max repairs | ${agg.maxRepairs} |
| Deterministic auto-fixes (total) | ${agg.totalAutoFixed} |
| Latency p50 / p95 | ${ms(agg.latencyP50)} / ${ms(agg.latencyP95)} |
| Avg latency | ${ms(agg.latencyAvg)} |
| Total tokens | ${agg.totalTokens.toLocaleString()} |
| Total cost (at paid rates) | $${agg.totalCostUsd.toFixed(4)} |
| Avg cost / request | $${agg.avgCostUsd.toFixed(5)} |

## Failure types
${ft}

## Per-prompt results
| ID | Category | OK | Repairs | Auto-fixed | Entities | Latency | Cost | Failed stage |
|---|---|---|---|---|---|---|---|---|
${rows}
`;
}