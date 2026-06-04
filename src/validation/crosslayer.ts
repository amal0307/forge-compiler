import type { LoweredSchemas } from "@/compiler";
import type { ArchitectureIR } from "@/ir";
import { v, type Violation } from "./violations";

/** Validate the deterministically-lowered schemas against each other. By
 *  construction this should return ~nothing — which is the point: it proves
 *  cross-layer consistency rather than asserting it. */
export function validateSchemas(s: LoweredSchemas, arch: ArchitectureIR): Violation[] {
    const out: Violation[] = [];
    const tableNames = new Set(s.db.tables.map((t) => t.name));
    const endpointById = new Map(s.api.endpoints.map((e) => [e.id, e] as const));

    for (const t of s.db.tables) {
        for (const c of t.columns) {
            if (c.foreignKey && !tableNames.has(c.foreignKey.table)) {
                out.push(v("FK_MISSING_TABLE", "error", `db.${t.name}.${c.name}`, `FK target "${c.foreignKey.table}" not found.`));
            }
        }
    }

    for (const page of s.ui.pages) {
        for (const comp of page.components) {
            for (const b of comp.bindings) {
                const ep = endpointById.get(b.endpointId);
                if (!ep) {
                    out.push(v("UI_BINDING_NO_ENDPOINT", "error", `ui.${page.id}.${comp.id}`, `Binding cites unknown endpoint "${b.endpointId}".`));
                    continue;
                }
                const fields = new Set([...ep.response.fields, ...ep.request.body].map((f) => f.name));
                if (!fields.has(b.sourceField)) {
                    out.push(v("UI_BINDING_NO_FIELD", "warning", `ui.${page.id}.${comp.id}`, `sourceField "${b.sourceField}" not on "${b.endpointId}".`));
                }
            }
        }
    }

    const planNames = new Set(arch.plans.map((p) => p.name));
    for (const g of s.auth.gates) {
        if (g.requiresPlan && !planNames.has(g.requiresPlan)) {
            out.push(v("GATE_MISSING_PLAN", "warning", `auth.gate.${g.id}`, `Gate cites unknown plan "${g.requiresPlan}".`));
        }
    }

    return out;
}