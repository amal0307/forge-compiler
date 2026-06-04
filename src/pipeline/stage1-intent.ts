import { IntentIRSchema, type IntentIR } from "@/ir";
import { generateStructured, type GenStructuredResult } from "@/llm/generateStructured";
import { MODELS } from "@/config/models";
import { INTENT_SYSTEM } from "@/config/prompts";

export function runIntent(userPrompt: string): Promise<GenStructuredResult<IntentIR>> {
    return generateStructured({
        schema: IntentIRSchema,
        schemaName: "IntentIR",
        system: INTENT_SYSTEM,
        prompt:
            `User request:\n"""${userPrompt}"""\n\n` +
            `Extract the structured intent. If the request is vague, conflicting, or ` +
            `missing key details, set the ambiguity flags, list the specific issues, and ` +
            `propose reasonable assumptions so the build can proceed.`,
        model: MODELS.fast,        // cheap model is plenty for extraction
        escalateModel: MODELS.base,
        maxRepairs: 2,
        maxOutputTokens: 1536,
        seed: 7,
    });
}