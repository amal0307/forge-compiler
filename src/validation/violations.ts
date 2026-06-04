export type Severity = "error" | "warning";

export interface Violation {
    code: string;
    severity: Severity;
    path: string;
    message: string;
    autoFixable: boolean;
}

export const v = (
    code: string, severity: Severity, path: string, message: string, autoFixable = false
): Violation => ({ code, severity, path, message, autoFixable });

export function summarize(violations: Violation[]) {
    return {
        total: violations.length,
        errors: violations.filter((x) => x.severity === "error").length,
        warnings: violations.filter((x) => x.severity === "warning").length,
        codes: violations.reduce<Record<string, number>>((acc, x) => {
            acc[x.code] = (acc[x.code] ?? 0) + 1;
            return acc;
        }, {}),
    };
}