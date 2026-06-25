"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  id: string;
  level: string;
  message: string;
  state_code: string | null;
  created_at: string;
}

interface StateRun {
  state_code: string;
  status: string;
  result_count: number;
}

const LEVEL_STYLES: Record<string, string> = {
  info: "text-foreground",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-muted-foreground",
};

const STATUS_COLORS: Record<string, string> = {
  succeeded: "bg-green-500/20 text-green-400",
  running: "bg-blue-500/20 text-blue-400 animate-pulse",
  pending: "bg-secondary text-muted-foreground",
  failed: "bg-red-500/20 text-red-400",
  skipped: "bg-secondary text-muted-foreground opacity-50",
};

export default function SearchLogsPage() {
  const { id } = useParams<{ id: string }>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState("loading");
  const [progress, setProgress] = useState({ completed: 0, total: 0, current_state: null as string | null });
  const [states, setStates] = useState<StateRun[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastTimestamp = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const params = lastTimestamp.current ? `?since=${encodeURIComponent(lastTimestamp.current)}` : "";
      try {
        const res = await fetch(`/api/searches/${id}/logs${params}`);
        if (!res.ok) return;
        const data = await res.json();

        if (!active) return;

        if (data.logs.length > 0) {
          setLogs((prev) => {
            const newLogs = [...prev, ...data.logs];
            lastTimestamp.current = data.logs[data.logs.length - 1].created_at;
            return newLogs;
          });
        } else if (!lastTimestamp.current && data.logs.length === 0) {
          // First poll, no logs yet
        }

        setStatus(data.search.status);
        setProgress(data.progress);
        setStates(data.states);
      } catch { /* retry */ }

      if (active && !["succeeded", "failed", "aborted"].includes(status)) {
        setTimeout(poll, 3000);
      }
    };

    poll();
    return () => { active = false; };
  }, [id, status]);

  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  const totalResults = states.reduce((s, r) => s + r.result_count, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/searches" className="text-sm text-muted-foreground hover:underline">← Back to Searches</Link>
          <h1 className="text-xl font-semibold mt-1">Search Logs</h1>
        </div>
        <Badge variant={status === "running" ? "secondary" : status === "succeeded" ? "default" : "destructive"}>
          {status}
        </Badge>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4 text-sm">
            <span>{progress.completed}/{progress.total} states</span>
            <span>·</span>
            <span>{totalResults} results</span>
            {progress.current_state && (
              <>
                <span>·</span>
                <span className="text-blue-400">⏳ {progress.current_state}</span>
              </>
            )}
            {status === "running" && (
              <div className="ml-auto">
                <div className="h-2 w-48 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm">Activity Log</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="h-3 w-3" />
            Auto-scroll
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                {status === "loading" ? "Loading..." : "No logs yet. Waiting for activity..."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 px-4 py-1.5 hover:bg-secondary/30">
                    <span className="shrink-0 text-muted-foreground w-16">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                    {log.state_code && (
                      <span className="shrink-0 w-8 text-muted-foreground">{log.state_code}</span>
                    )}
                    <span className={LEVEL_STYLES[log.level] ?? ""}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* State grid */}
      {states.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {states.map((s) => (
                <span
                  key={s.state_code}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono ${STATUS_COLORS[s.status] ?? ""}`}
                >
                  {s.state_code}
                  {s.status === "succeeded" && <span className="text-[10px]">({s.result_count})</span>}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
