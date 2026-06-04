import { z } from "zod";

/** Flags the model raises about prompt quality — drives the clarify/assume gate. */
export const AmbiguitySchema = z.object({
    isVague: z.boolean(),
    isConflicting: z.boolean(),
    isUnderspecified: z.boolean(),
    issues: z.array(z.string()).default([]),      // specific problems found
    assumptions: z.array(z.string()).default([]), // assumptions to proceed anyway
});
export type Ambiguity = z.infer<typeof AmbiguitySchema>;

/** Stage 1 output: structured intent parsed from the raw prompt. */
export const IntentIRSchema = z.object({
    appName: z.string().min(1),
    appType: z.string().min(1),                    // "CRM", "marketplace", ...
    domain: z.string().default("general"),
    summary: z.string().min(1),
    entities: z.array(z.string()).min(1),          // rough nouns: ["Contact","Deal"]
    roles: z.array(z.string()).min(1),             // ["admin","member"]
    features: z.array(z.string()).default([]),     // ["dashboard","analytics"]
    integrations: z.array(z.string()).default([]), // ["payments","email"]
    ambiguity: AmbiguitySchema,
    confidence: z.number().min(0).max(1).default(0.5),
});
export type IntentIR = z.infer<typeof IntentIRSchema>;