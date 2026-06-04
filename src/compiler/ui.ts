import { UISchemaSchema, type UISchema, type ArchitectureIR, type APISchema } from "@/ir";
import { snake } from "./db";

type UIPage = UISchema["pages"][number];
type Component = UIPage["components"][number];

const listEndpoint = (api: APISchema, e: string) => api.endpoints.find((x) => x.id === `${snake(e)}.list`);
const createEndpoint = (api: APISchema, e: string) => api.endpoints.find((x) => x.id === `${snake(e)}.create`);
const readEndpoint = (api: APISchema, e: string) => api.endpoints.find((x) => x.id === `${snake(e)}.read`);

function statCards(arch: ArchitectureIR, api: APISchema): Component[] {
    return arch.entities.map((e) => {
        const ep = listEndpoint(api, e.name);
        return {
            id: `stat_${snake(e.name)}`, type: "stat", title: `${e.name} count`, entity: e.name,
            props: { metric: "count" },
            bindings: ep ? [{ field: "count", endpointId: ep.id, sourceField: "id" }] : [],
        };
    });
}

export function buildUI(arch: ArchitectureIR, api: APISchema): UISchema {
    const pages: UIPage[] = [];

    for (const p of arch.pages) {
        const entity = p.entity;
        const components: Component[] = [];

        if (p.kind === "list" && entity) {
            const ep = listEndpoint(api, entity);
            if (ep) components.push({
                id: `${snake(entity)}_table`, type: "table", title: `${entity}`, entity, props: {},
                bindings: ep.response.fields.map((f) => ({ field: f.name, endpointId: ep.id, sourceField: f.name })),
            });
        } else if (p.kind === "form" && entity) {
            const ep = createEndpoint(api, entity);
            if (ep) components.push({
                id: `${snake(entity)}_form`, type: "form", title: `New ${entity}`, entity,
                props: { submitEndpoint: ep.id },
                bindings: ep.request.body.map((f) => ({ field: f.name, endpointId: ep.id, sourceField: f.name })),
            });
        } else if (p.kind === "detail" && entity) {
            const ep = readEndpoint(api, entity);
            if (ep) components.push({
                id: `${snake(entity)}_detail`, type: "detail", title: `${entity} detail`, entity,
                props: { endpoint: ep.id },
                bindings: ep.response.fields.map((f) => ({ field: f.name, endpointId: ep.id, sourceField: f.name })),
            });
        } else if (p.kind === "dashboard") {
            components.push(...statCards(arch, api));
        }

        pages.push({
            id: snake(p.name || p.path || p.kind),
            name: p.name, path: p.path, kind: p.kind, layout: "sidebar",
            rolesAllowed: p.rolesAllowed, components,
        });
    }

    if (!pages.some((p) => /dashboard/i.test(p.name) || p.id === "dashboard")) {
        pages.unshift({
            id: "dashboard", name: "Dashboard", path: "/dashboard", kind: "dashboard", layout: "sidebar",
            rolesAllowed: [], components: statCards(arch, api),
        });
    }

    const nav = pages.map((p) => ({ label: p.name, path: p.path, rolesAllowed: p.rolesAllowed }));
    return UISchemaSchema.parse({ pages, nav });
}