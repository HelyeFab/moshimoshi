"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PrecomputeStatus = {
  success?: boolean;
  found?: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

const DEFAULT_CONTENT_TYPE = "youtube";

export default function PrecomputeDebugPage() {
  const [contentId, setContentId] = useState("");
  const [contentType, setContentType] = useState(DEFAULT_CONTENT_TYPE);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<PrecomputeStatus | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const canPoll = useMemo(() => contentId.trim().length > 0, [contentId]);

  const fetchStatus = useCallback(async () => {
    if (!canPoll) return;
    const params = new URLSearchParams({
      contentId: contentId.trim(),
      contentType,
    });
    try {
      const response = await fetch(`/api/word/precompute/fetch?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as PrecomputeStatus;
      setStatus(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      setStatus({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch",
      });
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [canPoll, contentId, contentType]);

  useEffect(() => {
    if (!polling) return;
    fetchStatus();
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
  }, [polling, fetchStatus]);

  const data = status?.data as Record<string, unknown> | undefined;
  const chunkTotal = data?.precomputeChunkTotal as number | undefined;
  const chunkCompleted = data?.precomputeChunkCompleted as number | undefined;
  const chunkIndex = data?.precomputeChunkIndex as number | undefined;
  const lastCompleted = data?.precomputeChunkLastCompletedIndex as number | undefined;
  const wordCount = data?.wordCount as number | undefined;
  const precomputeStatus = data?.precomputeStatus as string | undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Precompute Debug</h1>

        <div className="space-y-3">
          <label className="block text-sm text-slate-300">Content ID</label>
          <input
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100"
            value={contentId}
            onChange={(e) => setContentId(e.target.value)}
            placeholder="YouTube videoId (e.g. -AV6HFvq5JM)"
          />

          <label className="block text-sm text-slate-300">Content Type</label>
          <select
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            <option value="youtube">youtube</option>
            <option value="article">article</option>
            <option value="book">book</option>
            <option value="story">story</option>
            <option value="video">video</option>
          </select>

          <div className="flex gap-3">
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => {
                setPolling(true);
              }}
              disabled={!canPoll}
            >
              Start Polling
            </button>
            <button
              className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium"
              onClick={() => setPolling(false)}
            >
              Stop Polling
            </button>
            <button
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium"
              onClick={fetchStatus}
              disabled={!canPoll}
            >
              Refresh Now
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-2">
          <div className="text-sm text-slate-400">
            Last update: {lastUpdated ?? "—"}
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Precompute status:</span>{" "}
            <span className="font-medium">{precomputeStatus ?? "—"}</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Chunk progress:</span>{" "}
            <span className="font-medium">
              {typeof chunkCompleted === "number" && typeof chunkTotal === "number"
                ? `${chunkCompleted}/${chunkTotal}`
                : "—"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Current chunk index:</span>{" "}
            <span className="font-medium">{typeof chunkIndex === "number" ? chunkIndex : "—"}</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Last completed chunk:</span>{" "}
            <span className="font-medium">{typeof lastCompleted === "number" ? lastCompleted : "—"}</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Word count:</span>{" "}
            <span className="font-medium">{typeof wordCount === "number" ? wordCount : "—"}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400 mb-2">Raw response</div>
          <pre className="text-xs whitespace-pre-wrap text-slate-200">
            {status ? JSON.stringify(status, null, 2) : "No data yet."}
          </pre>
        </div>
      </div>
    </div>
  );
}
