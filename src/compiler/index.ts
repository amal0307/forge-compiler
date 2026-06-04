import type { ArchitectureIR } from "@/ir";
import { buildDB } from "./db";
import { buildAPI } from "./api";
import { buildAuth } from "./auth";
import { buildUI } from "./ui";

export interface LoweredSchemas {
    db: ReturnType<typeof buildDB>;
    api: ReturnType<typeof buildAPI>;
    auth: ReturnType<typeof buildAuth>;
    ui: ReturnType<typeof buildUI>;
}

/** Deterministically lower a validated ArchitectureIR into the four output schemas.
 *  No LLM calls. Same architecture in → byte-identical schemas out. */
export function lowerArchitecture(arch: ArchitectureIR): LoweredSchemas {
    const db = buildDB(arch);
    const api = buildAPI(arch);   // references db columns by the same naming rules
    const auth = buildAuth(arch);
    const ui = buildUI(arch, api); // binds to api endpoint ids
    return { db, api, auth, ui };
}