"use client";

import { useState } from "react";
import type { CompileResult } from "@/pipeline/compile";
import { AppPreview } from "@/components/AppPreview";

const EXAMPLES = [
  "Build a CRM with login, contacts, dashboard, role-based access, and a premium plan with payments. Admins can see analytics.",
  "Project management tool with teams, projects, tasks with due dates, and comments. Managers assign tasks; members update status.",
  "A job board where companies post jobs and candidates apply. Admins moderate listings and see hiring analytics.",
];

type Tab = "preview" | "architecture" | "db" | "api" | "ui" | "auth";

export default function Home() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");

  async function run() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data?.stages) setResult(data as CompileResult);
      else setError(data?.error ?? `Request failed (${res.status})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const tabData: Record<string, unknown> = {
    architecture: result?.architecture,
    db: result?.schemas?.db,
    api: result?.schemas?.api,
    ui: result?.schemas?.ui,
    auth: result?.schemas?.auth,
  };

  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "appspec.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">🔨 Forge</h1>
          <p className="text-slate-400 mt-1">
            A compiler for software generation — natural language → structured, validated, executable app spec.
          </p>
        </header>

        {/* Prompt input */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm outline-none focus:border-indigo-500"
            placeholder="Describe the app you want to build…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                className="text-xs rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-indigo-500 hover:text-white"
              >
                Example {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={run}
              disabled={loading || !prompt.trim()}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Compiling…" : "Compile →"}
            </button>
            {loading && (
              <span className="text-sm text-slate-400 animate-pulse">
                intent → design → validate → lower
              </span>
            )}
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-xl border border-red-900 bg-red-950/50 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <>
            {/* Metrics */}
            <section className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Metric label="Latency" value={`${(result.metrics.totalLatencyMs / 1000).toFixed(1)}s`} />
              <Metric label="LLM calls" value={result.metrics.llmCalls} />
              <Metric label="Repairs" value={result.metrics.repairs} accent={result.metrics.repairs > 0} />
              <Metric label="Tokens" value={result.metrics.inputTokens + result.metrics.outputTokens} />
              <Metric label="Est. cost" value={`$${result.metrics.estCostUsd.toFixed(5)}`} sub="free tier: $0" />
            </section>

            {/* Pipeline */}
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Pipeline</h2>
              <ol className="space-y-2">
                {result.stages.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className={s.ok ? "text-emerald-400" : "text-red-400"}>
                      {s.ok ? "✓" : "✗"} <span className="text-slate-200">{s.name}</span>
                    </span>
                    <span className="text-slate-500 text-xs">
                      {s.attempts > 0 && `${s.attempts} call${s.attempts > 1 ? "s" : ""}`}
                      {s.repairs > 0 && ` · ${s.repairs} repair${s.repairs > 1 ? "s" : ""}`}
                      {s.latencyMs > 0 && ` · ${s.latencyMs}ms`}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Validation + assumptions */}
            <section className="mt-4 grid md:grid-cols-2 gap-4">
              <Card title="Validation & Repair">
                <Row label="Issues found" value={result.violations.architectureBefore.length} />
                <Row label="Auto-fixed" value={result.autoFixes.length} accent={result.autoFixes.length > 0} />
                <Row label="Remaining errors" value={result.violations.architectureAfter.filter((v) => v.severity === "error").length} />
                <Row label="Cross-layer issues" value={result.violations.crossLayer.length} />
                {result.autoFixes.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400 list-disc list-inside">
                    {result.autoFixes.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </Card>

              <Card title="Intent & Assumptions">
                {result.intent && (
                  <>
                    <Row label="App" value={result.intent.appName} />
                    <Row label="Vague?" value={result.intent.ambiguity.isVague ? "yes" : "no"} />
                    <Row label="Confidence" value={result.intent.confidence} />
                  </>
                )}
                {result.assumptions.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400 list-disc list-inside">
                    {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
              </Card>
            </section>

            {/* Schema viewer + live app preview */}
            {result.ok && (
              <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-wrap gap-1">
                    {(["preview", "architecture", "db", "api", "ui", "auth"] as Tab[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`text-xs rounded-lg px-3 py-1.5 ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                          }`}
                      >
                        {t === "preview" ? "▶ App" : t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button onClick={download} className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-indigo-500">
                    ↓ Download JSON
                  </button>
                </div>
                {tab === "preview" ? (
                  <AppPreview result={result} />
                ) : (
                  <pre className="text-xs leading-relaxed overflow-auto max-h-[60vh] rounded-lg bg-slate-950 border border-slate-800 p-4 text-slate-300">
                    {JSON.stringify(tabData[tab], null, 2)}
                  </pre>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${accent ? "text-amber-400" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className={accent ? "text-amber-400 font-medium" : "text-slate-200"}>{value}</span>
    </div>
  );
}