import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, TerminalSquare } from "lucide-react";
import type { DebugState } from "../debugTypes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DebugPanel from "./DebugPanel";
import LogsPanel, { type LogEntry } from "./LogsPanel";

export default function FloatingConsole({
  debug,
  logs,
  onEval,
  collapsed,
  onToggle,
  revealSignal,
  evalEnabled = true,
}: {
  debug: DebugState | null;
  logs: LogEntry[];
  onEval: (expression: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  revealSignal: number;
  /** Cloud mode: no debug session exists, so the Evaluate tab is hidden. */
  evalEnabled?: boolean;
}) {
  const [tab, setTab] = useState<"logs" | "evaluate">("logs");
  const [seen, setSeen] = useState(0);

  // App bumps revealSignal on run/debug/record: jump to Logs.
  const firstReveal = useRef(true);
  useEffect(() => {
    if (firstReveal.current) {
      firstReveal.current = false;
      return;
    }
    setTab("logs");
  }, [revealSignal]);

  // unread counter for the collapsed button
  useEffect(() => {
    if (!collapsed) setSeen(logs.length);
  }, [collapsed, logs.length]);
  const unread = Math.max(0, logs.length - seen);

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        type="button"
        className="pointer-events-auto shadow-lg"
        onClick={onToggle}
        title={evalEnabled ? "Show logs and evaluation" : "Show logs"}
      >
        <TerminalSquare className="h-4 w-4" />
        {evalEnabled ? "Logs|Evaluate" : "Logs"}
        {unread > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-px font-mono text-[10px] leading-4 text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="pointer-events-auto flex h-64 w-[38rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border">
      {/* panel side */}
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
          {(evalEnabled ? (["logs", "evaluate"] as const) : (["logs"] as const)).map((t) => (
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
              {t === "logs" ? "Logs" : "Evaluate"}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          {tab === "evaluate" ? (
            <DebugPanel state={debug} onEval={onEval} compact />
          ) : (
            <LogsPanel logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}
