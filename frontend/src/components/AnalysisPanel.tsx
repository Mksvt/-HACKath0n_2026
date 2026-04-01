"use client";

import { useFlightStore } from "@/store/useFlightStore";

export function AnalysisPanel() {
  const { analysis, aiSummary } = useFlightStore();

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Insights</p>
          <h3 className="text-lg font-semibold">Anomaly scan & AI summary</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm text-slate-300">Heuristic anomaly flags</p>
          <ul className="space-y-2">
            {(analysis?.notes || ["No analysis yet."]).map((note) => (
              <li key={note} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200">
                {note}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm text-slate-300">AI summary</p>
          <div className="mt-2 rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-200 whitespace-pre-wrap">
            {aiSummary || "Upload a flight to generate a summary."}
          </div>
        </div>
      </div>
    </div>
  );
}
