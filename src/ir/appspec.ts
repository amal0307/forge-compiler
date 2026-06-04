import { z } from "zod";
import { DBSchemaSchema, APISchemaSchema, UISchemaSchema, AuthSchemaSchema } from "./schemas";
import { BusinessRuleSchema, PlanSchema } from "./architecture";

/** The linked, fully-validated app specification. Input to the runtime. */
export const AppSpecSchema = z.object({
    meta: z.object({
        name: z.string(),
        type: z.string(),
        description: z.string().default(""),
        version: z.string().default("1.0.0"),
        generatedAt: z.string(),
    }),
    db: DBSchemaSchema,
    api: APISchemaSchema,
    ui: UISchemaSchema,
    auth: AuthSchemaSchema,
    plans: z.array(PlanSchema).default([]),
    businessRules: z.array(BusinessRuleSchema).default([]),
    assumptions: z.array(z.string()).default([]),         // surfaced to the user
    seed: z.record(z.string(), z.array(z.record(z.string(), z.any()))).default({}), // tableName -> rows // tableName -> rows
});
export type AppSpec = z.infer<typeof AppSpecSchema>;