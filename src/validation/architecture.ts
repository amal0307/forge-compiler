import type { ArchitectureIR } from "@/ir";
import { snake } from "@/compiler/db";
import { v, type Violation } from "./violations";

/** Read-only semantic validation of the ArchitectureIR. Structural validity is
 *  already guaranteed by Zod; here we catch logical / cross-reference problems. */
export function validateArchitecture(arch: ArchitectureIR): Violation[] {
    const out: Violation[] = [];
    const entityNames = new Set(arch.entities.map((e) => snake(e.name)));
    const roleNames = new Set(arch.roles.map((r) => snake(r.name)));

    const seen = new Set<string>();
    for (const e of arch.entities) {
        const k = snake(e.name);
        if (seen.has(k)) out.push(v("ENTITY_DUPLICATE", "error", `entities.${e.name}`, `Duplicate entity "${e.name}".`, true));
        seen.add(k);
    }

    for (const e of arch.entities) {
        for (const f of e.fields) {
            if (f.type === "reference") {
                if (!f.relation) {
                    out.push(v("REF_NO_RELATION", "error", `entities.${e.name}.${f.name}`, `Reference field "${f.name}" has no target.`, true));
                } else if (!entityNames.has(snake(f.relation.to))) {
                    out.push(v("REF_MISSING_ENTITY", "error", `entities.${e.name}.${f.name}`, `Field "${f.name}" references unknown entity "${f.relation.to}".`, true));
                }
            }
            if (f.type === "enum" && !(f.enumValues && f.enumValues.length)) {
                out.push(v("ENUM_NO_VALUES", "warning", `entities.${e.name}.${f.name}`, `Enum field "${f.name}" has no values.`, true));
            }
        }
    }

    arch.permissions.forEach((p, i) => {
        if (!roleNames.has(snake(p.role))) out.push(v("PERM_UNKNOWN_ROLE", "error", `permissions[${i}]`, `Permission cites unknown role "${p.role}".`, true));
        if (!entityNames.has(snake(p.entity))) out.push(v("PERM_UNKNOWN_ENTITY", "error", `permissions[${i}]`, `Permission cites unknown entity "${p.entity}".`, true));
    });

    arch.pages.forEach((pg, i) => {
        if (pg.entity && !entityNames.has(snake(pg.entity))) out.push(v("PAGE_UNKNOWN_ENTITY", "warning", `pages[${i}]`, `Page "${pg.name}" cites unknown entity "${pg.entity}".`, true));
        pg.rolesAllowed.forEach((r) => {
            if (!roleNames.has(snake(r))) out.push(v("PAGE_UNKNOWN_ROLE", "warning", `pages[${i}]`, `Page "${pg.name}" allows unknown role "${r}".`, true));
        });
    });

    const hasPremium = arch.plans.some((p) => p.isPremium);
    for (const rule of arch.businessRules) {
        if (rule.type === "gating" && !hasPremium) {
            out.push(v("GATING_NO_PLAN", "error", `businessRules.${rule.id}`, `Gating rule "${rule.id}" but no premium plan exists.`, true));
        }
    }

    if (arch.roles.length && !arch.roles.some((r) => r.isDefault)) {
        out.push(v("NO_DEFAULT_ROLE", "warning", "roles", "No default role.", true));
    }
    if (hasPremium && !arch.plans.some((p) => !p.isPremium)) {
        out.push(v("NO_FREE_PLAN", "warning", "plans", "Premium plan but no free plan.", true));
    }

    return out;
}

/** Deterministically repair the auto-fixable violations. Returns a new IR plus a
 *  human-readable log of what changed (these become documented assumptions). */
export function autoFixArchitecture(arch: ArchitectureIR): { arch: ArchitectureIR; applied: string[] } {
    const applied: string[] = [];
    const a: ArchitectureIR = structuredClone(arch);
    const entityNames = new Set(a.entities.map((e) => snake(e.name)));

    const seen = new Set<string>();
    a.entities = a.entities.filter((e) => {
        const k = snake(e.name);
        if (seen.has(k)) { applied.push(`Removed duplicate entity "${e.name}".`); return false; }
        seen.add(k); return true;
    });

    for (const e of a.entities) {
        for (const f of e.fields) {
            if (f.type === "reference" && (!f.relation || !entityNames.has(snake(f.relation.to)))) {
                f.type = "string"; delete f.relation;
                applied.push(`Converted invalid reference "${e.name}.${f.name}" to a string field.`);
            }
            if (f.type === "enum" && !(f.enumValues && f.enumValues.length)) {
                f.type = "string";
                applied.push(`Converted valueless enum "${e.name}.${f.name}" to a string field.`);
            }
        }
    }

    const roleSet = new Set(a.roles.map((r) => snake(r.name)));
    for (const p of a.permissions) {
        if (!roleSet.has(snake(p.role)) && entityNames.has(snake(p.entity))) {
            a.roles.push({ name: p.role, description: "Auto-added (referenced by a permission).", isDefault: false });
            roleSet.add(snake(p.role));
            applied.push(`Added missing role "${p.role}" referenced by a permission.`);
        }
    }
    const beforePerms = a.permissions.length;
    a.permissions = a.permissions.filter((p) => entityNames.has(snake(p.entity)) && roleSet.has(snake(p.role)));
    if (a.permissions.length < beforePerms) applied.push(`Dropped ${beforePerms - a.permissions.length} permission(s) on unknown entities.`);

    for (const pg of a.pages) {
        if (pg.entity && !entityNames.has(snake(pg.entity))) {
            applied.push(`Cleared unknown entity "${pg.entity}" on page "${pg.name}".`);
            pg.entity = undefined;
        }
        const before = pg.rolesAllowed.length;
        pg.rolesAllowed = pg.rolesAllowed.filter((r) => roleSet.has(snake(r)));
        if (pg.rolesAllowed.length < before) applied.push(`Removed unknown role(s) from page "${pg.name}".`);
    }

    if (a.businessRules.some((r) => r.type === "gating") && !a.plans.some((p) => p.isPremium)) {
        if (!a.plans.some((p) => !p.isPremium)) a.plans.push({ name: "Free", isPremium: false, price: 0, features: [] });
        a.plans.push({ name: "Premium", isPremium: true, price: 9.99, features: ["All premium features"] });
        applied.push("Synthesized Free/Premium plans for gating rules.");
    }
    if (a.plans.some((p) => p.isPremium) && !a.plans.some((p) => !p.isPremium)) {
        a.plans.unshift({ name: "Free", isPremium: false, price: 0, features: [] });
        applied.push("Added a Free plan.");
    }
    if (a.roles.length && !a.roles.some((r) => r.isDefault)) {
        a.roles[0].isDefault = true;
        applied.push(`Marked "${a.roles[0].name}" as the default role.`);
    }

    return { arch: a, applied };
}