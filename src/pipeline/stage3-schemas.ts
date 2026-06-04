import {
    DBSchemaSchema, type DBSchema,
    APISchemaSchema, type APISchema,
    UISchemaSchema, type UISchema,
    AuthSchemaSchema, type AuthSchema,
    type ArchitectureIR,
} from "@/ir";
import { generateStructured, type GenStructuredResult } from "@/llm/generateStructured";
import { MODELS } from "@/config/models";
import { DB_SYSTEM, API_SYSTEM, UI_SYSTEM, AUTH_SYSTEM } from "@/config/prompts";

export interface SchemaGenResult {
    db: GenStructuredResult<DBSchema>;
    auth: GenStructuredResult<AuthSchema>;
    api: GenStructuredResult<APISchema>;
    ui: GenStructuredResult<UISchema>;
}

export async function runSchemas(arch: ArchitectureIR): Promise<SchemaGenResult> {
    const archJson = JSON.stringify(arch, null, 2);

    // Step A — DB and Auth are independent of each other → run in parallel.
    const [db, auth] = await Promise.all([
        generateStructured({
            schema: DBSchemaSchema, schemaName: "DBSchema", system: DB_SYSTEM,
            prompt: `Architecture:\n${archJson}\n\nGenerate the relational DB schema.`,
            model: MODELS.base, escalateModel: MODELS.pro, seed: 7,
        }),
        generateStructured({
            schema: AuthSchemaSchema, schemaName: "AuthSchema", system: AUTH_SYSTEM,
            prompt: `Architecture:\n${archJson}\n\nGenerate the auth schema (roles, permissions, gates).`,
            model: MODELS.base, escalateModel: MODELS.pro, seed: 7,
        }),
    ]);

    // Step B — API references DB columns, so it needs the DB schema.
    const dbJson = db.ok ? JSON.stringify(db.data, null, 2) : "{}";
    const api = await generateStructured({
        schema: APISchemaSchema, schemaName: "APISchema", system: API_SYSTEM,
        prompt:
            `Architecture:\n${archJson}\n\nDB schema:\n${dbJson}\n\n` +
            `Generate REST endpoints whose fields match the DB columns of each entity.`,
        model: MODELS.base, escalateModel: MODELS.pro, seed: 7,
    });

    // Step C — UI binds to API endpoints, so it needs the API schema.
    const apiJson = api.ok ? JSON.stringify(api.data, null, 2) : "{}";
    const ui = await generateStructured({
        schema: UISchemaSchema, schemaName: "UISchema", system: UI_SYSTEM,
        prompt:
            `Architecture:\n${archJson}\n\nAPI schema:\n${apiJson}\n\n` +
            `Generate the UI. Bind tables/forms to real endpoint ids; every sourceField ` +
            `must exist on its endpoint.`,
        model: MODELS.base, escalateModel: MODELS.pro, seed: 7,
    });

    return { db, auth, api, ui };
}