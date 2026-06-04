import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { runEval } from "@/eval/runner";
import { DATASET } from "@/eval/dataset";
import { aggregate, toMarkdown, type RunRecord } from "@/eval/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RESULTS = () => path.join(process.cwd(), "eval-results.json");
const REPORT = () => path.join(process.cwd(), "EVAL_REPORT.md");

function loadExisting(): RunRecord[] {
    try {
        if (existsSync(RESULTS())) return JSON.parse(readFileSync(RESULTS(), "utf8")) as RunRecord[];
    } catch { /* ignore */ }
    return [];
}

export async function GET(req: NextRequest) {
    const fresh = req.nextUrl.searchParams.get("fresh") === "1"; // start over
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "0");

    const existing = fresh ? [] : loadExisting();
    const okIds = new Set(existing.filter((r) => r.ok).map((r) => r.id));

    let pending = DATASET.filter((c) => !okIds.has(c.id)); // only run not-yet-passed prompts
    if (limit > 0) pending = pending.slice(0, limit);

    const run = await runEval(pending);

    const byId = new Map<string, RunRecord>();
    for (const r of existing) byId.set(r.id, r);
    for (const r of run.records) byId.set(r.id, r); // overlay new results
    const merged = DATASET.map((c) => byId.get(c.id)).filter(Boolean) as RunRecord[];

    const agg = aggregate(merged);
    try {
        writeFileSync(RESULTS(), JSON.stringify(merged, null, 2));
        writeFileSync(REPORT(), toMarkdown(merged, agg));
    } catch { /* read-only fs */ }

    return NextResponse.json({
        ranThisCall: run.records.map((r) => r.id),
        completed: merged.filter((r) => r.ok).length,
        remaining: DATASET.filter((c) => !merged.some((r) => r.id === c.id && r.ok)).map((c) => c.id),
        aggregate: agg,
        records: merged,
    });
}