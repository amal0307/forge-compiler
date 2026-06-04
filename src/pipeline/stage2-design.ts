import { ArchitectureIRSchema, type ArchitectureIR, type IntentIR } from "@/ir";
import { generateStructured, type GenStructuredResult } from "@/llm/generateStructured";
import { MODELS } from "@/config/models";
import { DESIGN_SYSTEM } from "@/config/prompts";

export function runDesign(intent: IntentIR): Promise<GenStructuredResult<ArchitectureIR>> {
    return generateStructured({
        schema: ArchitectureIRSchema,
        schemaName: "ArchitectureIR",
        system: DESIGN_SYSTEM,
        prompt:
            `Structured intent (JSON):\n${JSON.stringify(intent, null, 2)}\n\n` +
            `Design the full application architecture: entities with typed fields and ` +
            `relations, roles, permissions, pages, plans (if premium/payments are implied), ` +
            `and explicit business rules. Build on the intent's entities and roles, but make ` +
            `them concrete and complete.`,
        model: MODELS.base,
        escalateModel: MODELS.pro,
        maxRepairs: 2,
        maxOutputTokens: 6000,
        seed: 7,
    });
}