import type { ArchitectureIR } from "@/ir";
import { validateArchitecture, autoFixArchitecture } from "@/validation/architecture";
import { summarize, type Violation } from "@/validation/violations";

export interface RefineResult {
    architecture: ArchitectureIR;
    before: Violation[];
    after: Violation[];
    autoFixes: string[];
    summary: { before: ReturnType<typeof summarize>; after: ReturnType<typeof summarize> };
}

/** Stage 4: detect inconsistencies in the LLM-produced architecture and repair
 *  them deterministically before lowering. */
export function refineArchitecture(arch: ArchitectureIR): RefineResult {
    const before = validateArchitecture(arch);
    const { arch: fixed, applied } = autoFixArchitecture(arch);
    const after = validateArchitecture(fixed);
    return {
        architecture: fixed,
        before, after, autoFixes: applied,
        summary: { before: summarize(before), after: summarize(after) },
    };
}