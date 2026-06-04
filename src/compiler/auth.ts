import { AuthSchemaSchema, type AuthSchema, type ArchitectureIR, type BusinessRule } from "@/ir";
import { snake } from "./db";

type Gate = AuthSchema["gates"][number];

/** Heuristically bind a gating rule to the endpoint(s) it governs so the runtime
 *  can ENFORCE it (e.g. "premium companies can post jobs" → jobs.create). */
function bindEndpoints(rule: BusinessRule, arch: ArchitectureIR): string[] {
    const text = `${rule.description} ${rule.effect} ${rule.condition}`.toLowerCase();
    const actions: { kws: string[]; action: string }[] = [
        { kws: ["delete", "remove"], action: "delete" },
        { kws: ["edit", "update", "modify", "change", "moderate"], action: "update" },
        { kws: ["create", "add", "new", "post", "publish", "submit", "apply", "upload"], action: "create" },
        { kws: ["view", "read", "see", "access", "list"], action: "read" },
    ];
    const action = actions.find((a) => a.kws.some((k) => text.includes(k)))?.action;
    const entity = arch.entities.find((e) => {
        const n = e.name.toLowerCase();
        return text.includes(n) || text.includes(n.replace(/s$/, ""));
    });
    return action && entity ? [`${snake(entity.name)}.${action}`] : [];
}

export function buildAuth(arch: ArchitectureIR): AuthSchema {
    const roles = arch.roles.map((r) => ({ name: r.name, description: r.description, isDefault: !!r.isDefault }));
    if (roles.length && !roles.some((r) => r.isDefault)) roles[roles.length - 1].isDefault = true;

    const permissions = arch.permissions.map((p) => ({
        role: p.role, entity: p.entity, actions: p.actions, scope: p.scope ?? "all",
    }));

    const premiumPlan = arch.plans.find((pl) => pl.isPremium);
    const gates: Gate[] = [];
    let n = 0;
    for (const rule of arch.businessRules) {
        if (rule.type === "gating" && premiumPlan) {
            gates.push({
                id: `gate_${++n}_${snake(rule.id || rule.description).slice(0, 30)}`,
                name: rule.description.slice(0, 80),
                requiresRole: [],
                requiresPlan: premiumPlan.name,
                appliesToPages: [],
                appliesToEndpoints: bindEndpoints(rule, arch),
            });
        }
    }

    return AuthSchemaSchema.parse({ roles, permissions, gates });
}