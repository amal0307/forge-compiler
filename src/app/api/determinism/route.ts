import { NextRequest, NextResponse } from "next/server";
import { runDeterminism } from "@/eval/determinism";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT =
    "Build a CRM with login, contacts, dashboard, role-based access, and a premium plan with payments. Admins can see analytics.";

export async function GET(req: NextRequest) {
    const prompt = req.nextUrl.searchParams.get("prompt") ?? DEFAULT;
    const runs = Math.min(5, Math.max(2, Number(req.nextUrl.searchParams.get("runs") ?? "3")));
    return NextResponse.json(await runDeterminism(prompt, runs));
}