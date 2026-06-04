import {
    APISchemaSchema, type APISchema, type ArchitectureIR, type Entity, type FieldType,
} from "@/ir";
import { snake, tableNameFor, columnNameFor } from "./db";

type Endpoint = APISchema["endpoints"][number];
type FieldRef = Endpoint["request"]["body"][number];
type Action = Endpoint["action"];

const API_FIELD_TYPE: Record<FieldType, string> = {
    string: "string", text: "string", email: "email", enum: "string",
    number: "number", currency: "number", boolean: "boolean",
    date: "string", datetime: "string", reference: "number", json: "object",
};

// Fields that may be written but must NEVER be returned in a response.
const SENSITIVE = /pass(word)?|secret|token|hash|salt|api_?key/i;

const isManyRef = (f: Entity["fields"][number]) =>
    f.type === "reference" && f.relation?.kind === "many"; // its FK lives on the child table

/** Body fields for create/update — includes secrets like password, skips one-to-many refs. */
function writeFields(entity: Entity): FieldRef[] {
    const refs: FieldRef[] = [];
    for (const f of entity.fields) {
        if (snake(f.name) === "id" || isManyRef(f)) continue;
        refs.push({ name: columnNameFor(f), type: API_FIELD_TYPE[f.type] ?? "string", required: !!f.required });
    }
    return refs;
}

/** Response fields — always include id, never include secrets or one-to-many refs. */
function responseFields(entity: Entity): FieldRef[] {
    const refs: FieldRef[] = [{ name: "id", type: "number", required: true }];
    for (const f of entity.fields) {
        if (isManyRef(f)) continue;
        const name = columnNameFor(f);
        if (name === "id" || SENSITIVE.test(name)) continue;
        refs.push({ name, type: API_FIELD_TYPE[f.type] ?? "string", required: !!f.required });
    }
    return refs;
}

function rolesFor(arch: ArchitectureIR, entity: string, action: Action): string[] {
    const roles = arch.permissions
        .filter((p) => p.entity.toLowerCase() === entity.toLowerCase() && p.actions.includes(action))
        .map((p) => p.role);
    return roles.length ? Array.from(new Set(roles)) : arch.roles.map((r) => r.name);
}

function validationFor(entity: Entity): Endpoint["validation"] {
    const rules: Endpoint["validation"] = [];
    for (const f of entity.fields) {
        if (snake(f.name) === "id" || isManyRef(f)) continue;
        const field = columnNameFor(f);
        if (f.required) rules.push({ field, rule: "required" });
        if (f.type === "email") rules.push({ field, rule: "email" });
        if (f.unique) rules.push({ field, rule: "unique" });
        if (f.type === "enum" && f.enumValues?.length) rules.push({ field, rule: "enum" });
    }
    return rules;
}

export function buildAPI(arch: ArchitectureIR): APISchema {
    const endpoints: Endpoint[] = [];

    for (const entity of arch.entities) {
        const base = `/${tableNameFor(entity.name)}`;
        const e = entity.name;
        const id = snake(e);
        const body = writeFields(entity);
        const full = responseFields(entity);
        const idParam: FieldRef = { name: "id", type: "number", required: true };

        const ep = (
            epId: string, method: Endpoint["method"], path: string, action: Action,
            req: Endpoint["request"], res: FieldRef[], validation: Endpoint["validation"] = []
        ): Endpoint => ({
            id: epId, path, method, entity: e, action,
            request: req, response: { fields: res },
            auth: { required: true, rolesAllowed: rolesFor(arch, e, action) },
            validation,
        });

        const noReq: Endpoint["request"] = { params: [], query: [], body: [] };
        endpoints.push(ep(`${id}.list`, "GET", base, "read", noReq, full));
        endpoints.push(ep(`${id}.read`, "GET", `${base}/:id`, "read", { params: [idParam], query: [], body: [] }, full));
        endpoints.push(ep(`${id}.create`, "POST", base, "create", { params: [], query: [], body }, full, validationFor(entity)));
        endpoints.push(ep(`${id}.update`, "PUT", `${base}/:id`, "update", { params: [idParam], query: [], body }, full, validationFor(entity)));
        endpoints.push(ep(`${id}.delete`, "DELETE", `${base}/:id`, "delete", { params: [idParam], query: [], body: [] }, [idParam]));
    }

    return APISchemaSchema.parse({ endpoints });
}