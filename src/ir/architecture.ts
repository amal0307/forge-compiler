import { z } from "zod";

export const FieldTypeSchema = z.enum([
    "string", "text", "number", "boolean", "date", "datetime",
    "email", "enum", "reference", "currency", "json",
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const RelationSchema = z.object({
    to: z.string(),                       // target entity name
    kind: z.enum(["one", "many"]),
});

export const FieldSchema = z.object({
    name: z.string().min(1),
    type: FieldTypeSchema,
    required: z.boolean().default(false),
    unique: z.boolean().default(false),
    enumValues: z.array(z.string()).optional(),  // when type === "enum"
    relation: RelationSchema.optional(),         // when type === "reference"
    description: z.string().optional(),
});
export type Field = z.infer<typeof FieldSchema>;

export const EntitySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    fields: z.array(FieldSchema).min(1),
});
export type Entity = z.infer<typeof EntitySchema>;

export const RoleSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isDefault: z.boolean().default(false),
});
export type Role = z.infer<typeof RoleSchema>;

export const ActionSchema = z.enum(["create", "read", "update", "delete"]);
export type Action = z.infer<typeof ActionSchema>;

export const PermissionSchema = z.object({
    role: z.string(),
    entity: z.string(),
    actions: z.array(ActionSchema).min(1),
    scope: z.enum(["all", "own"]).default("all"),  // "own" = row-level ownership
});
export type Permission = z.infer<typeof PermissionSchema>;

export const PlanSchema = z.object({
    name: z.string(),
    isPremium: z.boolean().default(false),
    price: z.number().default(0),
    features: z.array(z.string()).default([]),
});
export type Plan = z.infer<typeof PlanSchema>;

export const BusinessRuleSchema = z.object({
    id: z.string(),
    description: z.string(),
    type: z.enum(["gating", "access", "validation", "computed"]),
    condition: z.string(),   // human-readable trigger, e.g. "user.plan != 'premium'"
    effect: z.string(),      // e.g. "block access to /analytics"
});
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;

export const PageKindSchema = z.enum([
    "list", "detail", "form", "dashboard", "auth", "settings",
]);

export const PageDraftSchema = z.object({
    name: z.string(),
    path: z.string(),
    kind: PageKindSchema,
    entity: z.string().optional(),
    rolesAllowed: z.array(z.string()).default([]),
});
export type PageDraft = z.infer<typeof PageDraftSchema>;

/** Stage 2 output: the app architecture (entities, roles, flows, rules). */
export const ArchitectureIRSchema = z.object({
    entities: z.array(EntitySchema).min(1),
    roles: z.array(RoleSchema).min(1),
    permissions: z.array(PermissionSchema).default([]),
    pages: z.array(PageDraftSchema).min(1),
    plans: z.array(PlanSchema).default([]),
    businessRules: z.array(BusinessRuleSchema).default([]),
});
export type ArchitectureIR = z.infer<typeof ArchitectureIRSchema>;