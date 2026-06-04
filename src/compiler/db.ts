import { DBSchemaSchema, type ArchitectureIR, type DBSchema, type FieldType, type Field } from "@/ir";

type Column = DBSchema["tables"][number]["columns"][number];

/** camelCase / "Foo Bar" → snake_case, stripped of anything non-identifier. */
export function snake(s: string): string {
    return s
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .toLowerCase();
}

const SQL_TYPE: Record<FieldType, Column["type"]> = {
    string: "TEXT", text: "TEXT", email: "TEXT", enum: "TEXT",
    number: "REAL", currency: "REAL",
    boolean: "BOOLEAN",
    date: "DATE", datetime: "DATETIME",
    reference: "INTEGER",
    json: "JSON",
};

export const tableNameFor = (entityName: string) => snake(entityName);

/** A reference field becomes "<target>_id"; everything else is its own snake name. */
export function columnNameFor(field: Field): string {
    if (field.type === "reference" && field.relation) return `${snake(field.relation.to)}_id`;
    return snake(field.name);
}

export function buildDB(arch: ArchitectureIR): DBSchema {
    const entityNames = new Set(arch.entities.map((e) => snake(e.name)));

    const tables = arch.entities.map((entity) => {
        const columns: Column[] = [
            { name: "id", type: "INTEGER", nullable: false, unique: true, primaryKey: true },
        ];

        for (const f of entity.fields) {
            if (snake(f.name) === "id") continue; // never duplicate the PK
            if (f.type === "reference" && f.relation?.kind === "many") continue; // FK belongs on the child table
            const col: Column = {
                name: columnNameFor(f),
                type: SQL_TYPE[f.type] ?? "TEXT",
                nullable: !f.required,
                unique: !!f.unique,
                primaryKey: false,
            };
            if (f.type === "reference" && f.relation && entityNames.has(snake(f.relation.to))) {
                col.foreignKey = { table: tableNameFor(f.relation.to), column: "id" };
            }
            if (f.type === "enum" && f.enumValues?.length) col.enumValues = f.enumValues;
            columns.push(col);
        }

        columns.push({ name: "created_at", type: "DATETIME", nullable: false, unique: false, primaryKey: false });
        return { name: tableNameFor(entity.name), columns };
    });

    return DBSchemaSchema.parse({ tables }); // self-validate the codegen output
}