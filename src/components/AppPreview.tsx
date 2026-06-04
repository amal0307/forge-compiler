"use client";

import { useState } from "react";
import type { CompileResult } from "@/pipeline/compile";

type Schemas = NonNullable<CompileResult["schemas"]>;
type Comp = Schemas["ui"]["pages"][number]["components"][number];
type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;
type Allowed = { ok: boolean; reason?: "role" | "plan"; requiresPlan?: string };
type AllowedFn = (entity: string, action: string) => Allowed;

const snake = (s: string) =>
    s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

const fmt = (v: unknown) =>
    v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

function seedValue(col: Schemas["db"]["tables"][number]["columns"][number], table: string, i: number): unknown {
    if (col.primaryKey) return i;
    if (col.foreignKey) return ((i - 1) % 3) + 1;
    const n = col.name.toLowerCase();
    switch (col.type) {
        case "INTEGER": return i * 10;
        case "REAL": return Number((10 + i * 13.5).toFixed(2));
        case "BOOLEAN": return i % 2 === 0;
        case "DATE":
        case "DATETIME": return new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        case "JSON": return { sample: true };
        default:
            if (n.includes("email")) return `user${i}@example.com`;
            if (n.includes("name")) return ["Alice Smith", "Bob Lee", "Carol Diaz"][i - 1] ?? `Name ${i}`;
            if (n.includes("user")) return ["alice", "bob", "carol"][i - 1] ?? `user${i}`;
            if (n.includes("role")) return ["admin", "user", "user"][i - 1] ?? "user";
            if (n.includes("pass")) return "••••••••";
            if (n.includes("status")) return ["open", "active", "closed"][i - 1] ?? "open";
            return `${table} ${i}`;
    }
}

function seedStore(schemas: Schemas): Store {
    const store: Store = {};
    for (const t of schemas.db.tables) {
        store[t.name] = Array.from({ length: 3 }, (_, k) => {
            const row: Row = {};
            for (const c of t.columns) row[c.name] = seedValue(c, t.name, k + 1);
            return row;
        });
    }
    return store;
}

export function AppPreview({ result }: { result: CompileResult }) {
    const schemas = result.schemas!;
    const arch = result.architecture!;
    const auth = schemas.auth;

    const plans = arch.plans.length ? arch.plans : [{ name: "Free", isPremium: false, price: 0, features: [] }];
    const [role, setRole] = useState(auth.roles.find((r) => r.isDefault)?.name ?? auth.roles[0]?.name ?? "user");
    const [plan, setPlan] = useState(plans[0].name);
    const [store, setStore] = useState<Store>(() => seedStore(schemas));

    const visiblePages = schemas.ui.pages.filter((p) => p.rolesAllowed.length === 0 || p.rolesAllowed.includes(role));
    const [path, setPath] = useState(schemas.ui.pages[0]?.path ?? "/");
    const activePage = visiblePages.find((p) => p.path === path) ?? visiblePages[0] ?? schemas.ui.pages[0];

    const allowed: AllowedFn = (entity, action) => {
        const perm = auth.permissions.find(
            (p) => p.role === role && p.entity.toLowerCase() === entity.toLowerCase() &&
                (p.actions as readonly string[]).includes(action)
        );
        if (!perm) return { ok: false, reason: "role" };
        // Admin-like roles (full "all" scope) aren't subject to plan/billing gates.
        if (perm.scope !== "all") {
            const gate = auth.gates.find((g) => g.appliesToEndpoints.includes(`${snake(entity)}.${action}`));
            if (gate?.requiresPlan && gate.requiresPlan !== plan) {
                return { ok: false, reason: "plan", requiresPlan: gate.requiresPlan };
            }
        }
        return { ok: true };
    };
    const addRow = (entity: string, values: Row) => {
        const table = snake(entity);
        setStore((prev) => {
            const rows = prev[table] ?? [];
            const id = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
            return { ...prev, [table]: [...rows, { id, ...values, created_at: new Date().toISOString().slice(0, 10) }] };
        });
    };
    const deleteRow = (entity: string, id: unknown) => {
        const table = snake(entity);
        setStore((prev) => ({ ...prev, [table]: (prev[table] ?? []).filter((r) => r.id !== id) }));
    };

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2">
                <div className="text-sm font-semibold text-slate-200">
                    {result.intent?.appName ?? "App"} <span className="text-slate-500 font-normal">· live preview</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <Switcher label="Role" options={auth.roles.map((r) => r.name)} value={role} onChange={setRole} />
                    <Switcher label="Plan" options={plans.map((p) => p.name)} value={plan} onChange={setPlan} />
                </div>
            </div>

            <div className="flex min-h-[420px]">
                <aside className="w-44 shrink-0 border-r border-slate-800 bg-slate-900/40 p-2">
                    {visiblePages.map((p) => (
                        <button key={p.id} onClick={() => setPath(p.path)}
                            className={`block w-full text-left text-sm rounded-md px-3 py-1.5 mb-0.5 ${activePage?.path === p.path ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}>
                            {p.name}
                        </button>
                    ))}
                </aside>

                <div className="flex-1 p-5 overflow-auto">
                    {activePage
                        ? <PageView page={activePage} store={store} allowed={allowed} addRow={addRow} deleteRow={deleteRow} />
                        : <div className="text-slate-500 text-sm">No page available for this role.</div>}
                </div>
            </div>
        </div>
    );
}

function PageView({ page, store, allowed, addRow, deleteRow }: {
    page: Schemas["ui"]["pages"][number]; store: Store; allowed: AllowedFn;
    addRow: (entity: string, values: Row) => void; deleteRow: (entity: string, id: unknown) => void;
}) {
    if (page.kind === "auth") return <LoginScreen />;
    if (page.components.length === 0) {
        return (
            <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">{page.name}</h3>
                <p className="text-slate-500 text-sm">No components generated for this page.</p>
            </div>
        );
    }
    const by = (t: Comp["type"]) => page.components.filter((c) => c.type === t);
    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">{page.name}</h3>
            {by("stat").length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {by("stat").map((c) => (
                        <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                            <div className="text-xs text-slate-500">{c.title}</div>
                            <div className="text-2xl font-bold text-slate-100">{(store[snake(c.entity ?? "")] ?? []).length}</div>
                        </div>
                    ))}
                </div>
            )}
            {by("table").map((c) => <TableView key={c.id} comp={c} store={store} allowed={allowed} deleteRow={deleteRow} />)}
            {by("form").map((c) => <FormView key={c.id} comp={c} allowed={allowed} addRow={addRow} />)}
            {by("detail").map((c) => <DetailView key={c.id} comp={c} store={store} />)}
        </div>
    );
}

function TableView({ comp, store, allowed, deleteRow }: {
    comp: Comp; store: Store; allowed: AllowedFn; deleteRow: (entity: string, id: unknown) => void;
}) {
    const entity = comp.entity ?? "";
    const rows = store[snake(entity)] ?? [];
    const cols = comp.bindings.map((b) => b.sourceField);
    const del = allowed(entity, "delete");
    return (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900 px-3 py-2">
                <span className="text-sm font-medium text-slate-200">{comp.title || entity}</span>
                <span className="text-xs text-slate-500">{rows.length} rows</span>
            </div>
            <div className="overflow-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-800">
                            {cols.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={String(r.id)} className="border-b border-slate-900 hover:bg-slate-900/50">
                                {cols.map((c) => <td key={c} className="px-3 py-2 text-slate-300">{fmt(r[c])}</td>)}
                                <td className="px-3 py-2 text-right">
                                    {del.ok
                                        ? <button onClick={() => deleteRow(entity, r.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                                        : del.reason === "plan"
                                            ? <span className="text-xs text-amber-500" title={`Requires ${del.requiresPlan} plan`}>🔒 {del.requiresPlan}</span>
                                            : null}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-3 py-6 text-center text-slate-600">No rows</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FormView({ comp, allowed, addRow }: {
    comp: Comp; allowed: AllowedFn; addRow: (entity: string, values: Row) => void;
}) {
    const entity = comp.entity ?? "";
    const fields = comp.bindings.map((b) => b.field);
    const create = allowed(entity, "create");
    const [values, setValues] = useState<Row>({});
    if (!create.ok) {
        return (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
                {comp.title || `New ${entity}`} — {create.reason === "plan" ? `🔒 requires ${create.requiresPlan} plan` : "not permitted for this role"}
            </div>
        );
    }
    return (
        <form onSubmit={(e) => { e.preventDefault(); addRow(entity, values); setValues({}); }}
            className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3 max-w-md">
            <div className="text-sm font-medium text-slate-200">{comp.title || `New ${entity}`}</div>
            {fields.map((f) => (
                <div key={f}>
                    <label className="block text-xs text-slate-500 mb-1">{f}</label>
                    <input value={String(values[f] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                        className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                        placeholder={f} />
                </div>
            ))}
            <button type="submit" className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm hover:bg-indigo-500">Add</button>
        </form>
    );
}

function DetailView({ comp, store }: { comp: Comp; store: Store }) {
    const entity = comp.entity ?? "";
    const row = (store[snake(entity)] ?? [])[0];
    const fields = comp.bindings.map((b) => b.sourceField);
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 max-w-md">
            <div className="text-sm font-medium text-slate-200 mb-3">{comp.title || `${entity} detail`}</div>
            {row ? (
                <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                    {fields.map((f) => (
                        <div key={f} className="contents">
                            <dt className="text-slate-500">{f}</dt>
                            <dd className="text-slate-300">{fmt(row[f])}</dd>
                        </div>
                    ))}
                </dl>
            ) : <div className="text-slate-600 text-sm">No record.</div>}
        </div>
    );
}

function LoginScreen() {
    return (
        <div className="max-w-xs mx-auto mt-6 rounded-lg border border-slate-800 bg-slate-900 p-6 space-y-3">
            <div className="text-center text-lg font-semibold text-slate-100">Sign in</div>
            <input className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm" placeholder="Username" />
            <input type="password" className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm" placeholder="Password" />
            <button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500">Log in</button>
            <p className="text-center text-[11px] text-slate-600">Demo screen — use the Role switcher above to change access.</p>
        </div>
    );
}

function Switcher({ label, options, value, onChange }: {
    label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-slate-500">{label}:</span>
            <div className="flex rounded-md border border-slate-700 overflow-hidden">
                {options.map((o) => (
                    <button key={o} onClick={() => onChange(o)}
                        className={`px-2.5 py-1 ${value === o ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}>
                        {o}
                    </button>
                ))}
            </div>
        </div>
    );
}