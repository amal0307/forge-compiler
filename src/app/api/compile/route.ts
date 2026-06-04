import { NextRequest, NextResponse } from "next/server";
import { compile } from "@/pipeline/compile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    let prompt = "";
    try {
        const body = await req.json();
        prompt = String(body?.prompt ?? "").trim();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }
    if (!prompt) return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });

    try {
        return NextResponse.json(await compile(prompt));
    } catch (err) {
        const raw = err instanceof Error ? err.message : "Compilation failed";
        const rateLimited = /429|rate.?limit|quota|tokens per (day|minute)|resource exhausted/i.test(raw);
        return NextResponse.json(
            {
                ok: false,
                error: rateLimited
                    ? "⏳ The free LLM tier is temporarily rate-limited — please wait a minute and try again."
                    : `Compilation failed: ${raw}`,
            },
            { status: rateLimited ? 429 : 500 },
        );
    }
}