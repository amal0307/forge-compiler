import { runIntent } from "./stage1-intent";
import { runDesign } from "./stage2-design";
import { refineArchitecture } from "./stage4-refine";
import { lowerArchitecture, type LoweredSchemas } from "@/compiler";
import { validateSchemas } from "@/validation/crosslayer";
import { estimateCost, MODELS } from "@/config/models";
import type { IntentIR, ArchitectureIR } from "@/ir";
import type { Violation } from "@/validation/violations";
import type { GenTelemetry } from "@/llm/generateStructured";

export interface StageMeta {
    name: string;
    ok: boolean;
    attempts: number;
    repairs: number;
    modelsUsed: string[];
    latencyMs: number;
}

export interface CompileResult {
    ok: boolean;
    prompt: string;
    failedStage?: string;
    error?: string;
    intent?: IntentIR;
    architecture?: ArchitectureIR;
    schemas?: LoweredSchemas;
    assumptions: string[];
    autoFixes: string[];
    violations: {
        architectureBefore: Violation[];
        architectureAfter: Violation[];
        crossLayer: Violation[];
    };
    stages: StageMeta[];
    metrics: {
        totalLatencyMs: number;
        llmCalls: number;
        repairs: number;
        inputTokens: number;
        outputTokens: number;
        estCostUsd: number;
    };
}

function stageMeta(name: string, ok: boolean, t: GenTelemetry): StageMeta {
    return { name, ok, attempts: t.attempts, repairs: t.repairs, modelsUsed: t.modelsUsed, latencyMs: t.latencyMs };
}

function metrics(intentT: GenTelemetry, designT: GenTelemetry | null) {
    return {
        totalLatencyMs: intentT.latencyMs + (designT?.latencyMs ?? 0),
        llmCalls: intentT.attempts + (designT?.attempts ?? 0),
        repairs: intentT.repairs + (designT?.repairs ?? 0),
        inputTokens: intentT.inputTokens + (designT?.inputTokens ?? 0),
        outputTokens: intentT.outputTokens + (designT?.outputTokens ?? 0),
        estCostUsd:
            estimateCost(MODELS.fast, intentT.inputTokens, intentT.outputTokens) +
            (designT ? estimateCost(MODELS.base, designT.inputTokens, designT.outputTokens) : 0),
    };
}

const NO_VIOLATIONS = { architectureBefore: [], architectureAfter: [], crossLayer: [] };

/** The full compiler pipeline: NL → validated, lowered app schemas. */
export async function compile(prompt: string): Promise<CompileResult> {
    const stages: StageMeta[] = [];

    // Stage 1 — Intent
    const intent = await runIntent(prompt);
    stages.push(stageMeta("Intent Extraction", intent.ok, intent.telemetry));
    if (!intent.ok) {
        return {
            ok: false, prompt, failedStage: "Intent Extraction", error: intent.finalError,
            assumptions: [], autoFixes: [], violations: NO_VIOLATIONS, stages,
            metrics: metrics(intent.telemetry, null),
        };
    }

    // Stage 2 — System Design
    const design = await runDesign(intent.data!);
    stages.push(stageMeta("System Design", design.ok, design.telemetry));
    if (!design.ok) {
        return {
            ok: false, prompt, failedStage: "System Design", error: design.finalError,
            intent: intent.data, assumptions: intent.data!.ambiguity.assumptions ?? [],
            autoFixes: [], violations: NO_VIOLATIONS, stages,
            metrics: metrics(intent.telemetry, design.telemetry),
        };
    }

    // Stage 4 — Validation & deterministic repair
    const refined = refineArchitecture(design.data!);
    stages.push({
        name: "Validation & Repair", ok: refined.summary.after.errors === 0,
        attempts: 0, repairs: refined.autoFixes.length, modelsUsed: [], latencyMs: 0,
    });

    // Stage 3/5 — Lower to schemas + cross-layer safety net
    const schemas = lowerArchitecture(refined.architecture);
    const crossLayer = validateSchemas(schemas, refined.architecture);
    stages.push({
        name: "Schema Generation & Link",
        ok: crossLayer.filter((x) => x.severity === "error").length === 0,
        attempts: 0, repairs: 0, modelsUsed: [], latencyMs: 0,
    });

    return {
        ok: true, prompt,
        intent: intent.data,
        architecture: refined.architecture,
        schemas,
        assumptions: [...(intent.data!.ambiguity.assumptions ?? []), ...refined.autoFixes],
        autoFixes: refined.autoFixes,
        violations: { architectureBefore: refined.before, architectureAfter: refined.after, crossLayer },
        stages,
        metrics: metrics(intent.telemetry, design.telemetry),
    };
}