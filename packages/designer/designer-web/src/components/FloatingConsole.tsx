import { useEffect, useRef, useState } from "react";
import { Braces, ChevronDown, ChevronUp, ChevronsUp, TerminalSquare } from "lucide-react";
import type { DebugState } from "../debugTypes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DebugPanel from "./DebugPanel";
import LogsPanel, { type LogEntry } from "./LogsPanel";
import VariableRows, { type VarRow } from "./VariableRows";

const PREVIEW_ROWS = 4;

export default function FloatingConsole({
  debug,
  logs,
  onEval,
  varRows,
  onVarsChange,
  collapsed,
  onToggle,
}: {
  debug: DebugState | null;
  logs: LogEntry[];
  onEval: (expression: string) => void;
  varRows: VarRow[];
  onVarsChange: (rows: VarRow[]) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [tab, setTab] = useState<"logs" | "console">("logs");
  const [varsOpen, setVarsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!varsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVarsOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setVarsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [varsOpen]);

  const named = varRows.filter((r) => r.name.trim() !== "");
  const preview = named.slice(-PREVIEW_ROWS);

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        type="button"
        className="pointer-events-auto shadow-lg"
        onClick={onToggle}
        title="Show logs, console and variables"
      >
        <TerminalSquare className="h-4 w-4" />
        Console
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="pointer-events-auto flex h-72 w-[34rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border"
    >
      {/* console side */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            onClick={onToggle}
            title="Collapse panel"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {(["logs", "console"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                tab === t
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "logs" ? "Logs" : "Console"}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          {tab === "console" ? (
            <DebugPanel state={debug} onEval={onEval} compact />
          ) : (
            <LogsPanel logs={logs} />
          )}
        </div>
      </div>

      {/* variables side */}
      <div className="relative flex w-44 shrink-0 flex-col border-l border-border">
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
          <Braces className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Vars
          </span>
          <span className="ml-auto" />
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            onClick={() => setVarsOpen((v) => !v)}
            title={varsOpen ? "Hide full list" : "Show full list (opens upward)"}
          >
            {varsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronsUp className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="panel-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 font-mono text-[11px]">
          {preview.length === 0 && <div className="text-muted-foreground">—</div>}
          {preview.map((r) => (
            <div key={r.name} className="truncate" title={`$${r.name} = ${r.value}`}>
              <span className="text-primary">${r.name}</span>
              <span className="text-muted-foreground"> = </span>
              <span className="text-foreground">{r.value || "…"}</span>
            </div>
          ))}
          {named.length > preview.length && (
            <div className="text-muted-foreground">+{named.length - preview.length} more…</div>
          )}
        </div>
        <div className="shrink-0 border-t border-border p-1.5">
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="h-6 w-full text-[11px]"
            onClick={() => setVarsOpen((v) => !v)}
          >
            {varsOpen ? (
              <>
                <ChevronDown className="h-3 w-3" /> hide
              </>
            ) : (
              <>
                <ChevronUp className="h-3 w-3" /> all ({named.length})
              </>
            )}
          </Button>
        </div>

        {varsOpen && (
          <div className="absolute bottom-full right-0 mb-2 max-h-80 w-80 overflow-y-auto rounded-xl bg-card p-3 shadow-xl ring-1 ring-border">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Flow variables
            </div>
            <VariableRows rows={varRows} onChange={onVarsChange} withTypes />
          </div>
        )}
      </div>
    </div>
  );
}
