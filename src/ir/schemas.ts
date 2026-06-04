import { z } from "zod";
import { ActionSchema } from "./architecture";

/* ----------------------------- DB ----------------------------- */
export const SqlTypeSchema = z.enum([
    "TEXT", "INTEGER", "REAL", "BOOLEAN", "DATE", "DATETIME", "JSON",
]);

export const ForeignKeySchema = z.object({   // ← referential check target
    table: z.string(),
    column: z.string(),
});

export const ColumnSchema = z.object({
    name: z.string(),
    type: SqlTypeSchema,
    nullable: z.boolean().default(true),
    unique: z.boolean().default(false),
    primaryKey: z.boolean().default(false),
    foreignKey: ForeignKeySchema.optional(),
    enumValues: z.array(z.string()).optional(),
});

export const TableSchema = z.object({
    name: z.string(),
    columns: z.array(ColumnSchema).min(1),
});

export const DBSchemaSchema = z.object({
    tables: z.array(TableSchema).min(1),
});
export type DBSchema = z.infer<typeof DBSchemaSchema>;

/* ----------------------------- API ---------------------------- */
export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const FieldRefSchema = z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
});

export const ValidationRuleSchema = z.object({
    field: z.string(),
    rule: z.enum(["required", "email", "min", "max", "unique", "enum", "regex"]),
    value: z.union([z.string(), z.number()]).optional(),
});

export const EndpointSchema = z.object({
    id: z.string(),                          // referenced by UI bindings
    path: z.string(),

    method: HttpMethodSchema,
    entity: z.string(),                      // must map to a DB table
    action: ActionSchema,
    request: z.object({
        params: z.array(FieldRefSchema).default([]),
        query: z.array(FieldRefSchema).default([]),
        body: z.array(FieldRefSchema).default([]),
    }),
    response: z.object({
        fields: z.array(FieldRefSchema).default([]),
    }),
    auth: z.object({
        required: z.boolean().default(true),
        rolesAllowed: z.array(z.string()).default([]),
    }),
    validation: z.array(ValidationRuleSchema).default([]),
});

export const APISchemaSchema = z.object({
    endpoints: z.array(EndpointSchema).min(1),
});
export type APISchema = z.infer<typeof APISchemaSchema>;

/* ----------------------------- UI ----------------------------- */
export const ComponentTypeSchema = z.enum([
    "table", "form", "card", "stat", "chart", "button", "nav", "text", "list", "detail",
]);

export const BindingSchema = z.object({   // ← UI field maps to an API field
    field: z.string(),         // UI field name
    endpointId: z.string(),    // which endpoint feeds it (must exist in API schema)
    sourceField: z.string(),   // field on that endpoint
});

export const ComponentSchema = z.object({
    id: z.string(),
    type: ComponentTypeSchema,
    title: z.string().optional(),
    entity: z.string().optional(),
    props: z.record(z.string(), z.any()).default({}),
    bindings: z.array(BindingSchema).default([]),
});

export const UIPageSchema = z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    kind: z.enum(["list", "detail", "form", "dashboard", "auth", "settings"]).optional(),
    layout: z.enum(["sidebar", "topnav", "blank"]).default("sidebar"),
    rolesAllowed: z.array(z.string()).default([]),
    requiresPlan: z.string().optional(),   // premium gating at the page level
    components: z.array(ComponentSchema).default([]),
});

export const NavItemSchema = z.object({
    label: z.string(),
    path: z.string(),
    rolesAllowed: z.array(z.string()).default([]),
});

export const UISchemaSchema = z.object({
    pages: z.array(UIPageSchema).min(1),
    nav: z.array(NavItemSchema).default([]),
});
export type UISchema = z.infer<typeof UISchemaSchema>;

/* ---------------------------- Auth ---------------------------- */
export const GateSchema = z.object({
    id: z.string(),
    name: z.string(),
    requiresRole: z.array(z.string()).default([]),
    requiresPlan: z.string().optional(),
    appliesToPages: z.array(z.string()).default([]),
    appliesToEndpoints: z.array(z.string()).default([]),
});

export const AuthSchemaSchema = z.object({
    roles: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        isDefault: z.boolean().default(false),
    })).min(1),
    permissions: z.array(z.object({
        role: z.string(),
        entity: z.string(),
        actions: z.array(ActionSchema).min(1),
        scope: z.enum(["all", "own"]).default("all"),
    })).default([]),
    gates: z.array(GateSchema).default([]),
});
export type AuthSchema = z.infer<typeof AuthSchemaSchema>;