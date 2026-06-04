import { compile, type CompileResult } from "@/pipeline/compile";

/** Canonical structural signature — captures the app's *shape* (entities,
 *  tables+columns, endpoints, roles, permissions) while ignoring prose,
 *  descriptions, and ordering. Two runs with the same fingerprint are the
 *  "same app" for all practical purposes. */
function fingerprint(r: CompileResult): string {
    if (!r.ok || !r.architecture || !r.schemas) return "FAILED";
    const sort = (xs: string[]) => [...xs].sort();
    const s = r.schemas;
    const parts = {
        entities: sort(r.architecture.entities.map((e) => e.name.toLowerCase())),
        tables: sort(s.db.tables.map((t) => `${t.name}(${sort(t.columns.map((c) => c.name)).join(",")})`)),
        endpoints: sort(s.api.endpoints.map((e) => e.id)),
        roles: sort(s.auth.roles.map((x) => x.name.toLowerCase())),
        permissions: sort(s.auth.permissions.map((p) => `${p.role}:${p.entity}:${sort([...p.actions]).join("|")}`)),
    };
    return JSON.stringify(parts);
}

export async function runDeterminism(prompt: string, runs: number) {
    const fps: string[] = [];
    const perRun: { run: number; ok: boolean; entities: number; tables: number; endpoints: number }[] = [];

    for (let i = 0; i < runs; i++) {
        const r = await compile(prompt);
        fps.push(fingerprint(r));
        perRun.push({
            run: i + 1,
            ok: r.ok,
            entities: r.architecture?.entities.length ?? 0,
            tables: r.schemas?.db.tables.length ?? 0,
            endpoints: r.schemas?.api.endpoints.length ?? 0,
        });
    }

    // modal agreement: how many runs share the single most common structure
    const counts = new Map<string, number>();
    for (const f of fps) counts.set(f, (counts.get(f) ?? 0) + 1);
    const identicalRuns = Math.max(...counts.values());
    const distinctShapes = counts.size;
    const determinismScore = runs ? identicalRuns / runs : 0;

    return {
        prompt,
        runs,
        determinismScore,                    // 0..1
        identicalRuns,
        distinctShapes,
        perRun,
        summary:
            `${identicalRuns}/${runs} runs produced an identical app structure ` +
            `(${Math.round(determinismScore * 100)}% structural determinism); ` +
            `${distinctShapes} distinct shape(s) observed. ` +
            `Note: the codegen backend is fully deterministic (same IR -> byte-identical schemas); ` +
            `any variance originates only in the two LLM stages.`,
    };
}