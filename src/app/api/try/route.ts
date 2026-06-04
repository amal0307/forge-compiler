import { NextRequest, NextResponse } from "next/server";
import { runIntent } from "@/pipeline/stage1-intent";
import { runDesign } from "@/pipeline/stage2-design";
import { lowerArchitecture } from "@/compiler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_PROMPT =
    "Build a CRM with login, contacts, dashboard, role-based access, and a premium plan with payments. Admins can see analytics.";

export async function GET(req: NextRequest) {
    const prompt = req.nextUrl.searchParams.get("prompt") ?? DEFAULT_PROMPT;

    const intent = await runIntent(prompt);          // LLM call #1
    if (!intent.ok) return NextResponse.json({ stage: "intent", prompt, intent });

    const design = await runDesign(intent.data!);    // LLM call #2
    if (!design.ok) return NextResponse.json({ stage: "design", prompt, intent, design });

    const schemas = lowerArchitecture(design.data!); // deterministic — 0 LLM calls
    return NextResponse.json({
        prompt,
        intent: intent.data,
        architecture: design.data,
        schemas,
        telemetry: { intent: intent.telemetry, design: design.telemetry },
    });
}