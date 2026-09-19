import { FileJson, FolderOpen, Plus } from "lucide-react";
import type { FlowFile } from "../api";
import { cn } from "@/lib/utils";

export default function TopProjectMenu({
  flows,
  activePath,
  onOpen,
  onCreate,
}: {
  flows: FlowFile[];
  activePath: string;
  onOpen: (path: string) => void;
  onCreate: () => void;
}) {
  const main = flows.find((f) => f.is_main);
  const subflows = flows.filter((f) => !f.is_main);

  const item = (flow: FlowFile, nested: boolean) => (
    <button
      key={flow.path}
      type="button"
      onClick={() => onOpen(flow.path)}
      title={flow.path}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition-colors",
        nested ? "pl-6" : "pl-2",
        flow.path === activePath
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <FileJson className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-mono">{flow.name}</span>
    </button>
  );

  return (
    <div className="max-h-[50vh] w-64 overflow-y-auto p-1.5">
      <div className="flex items-center justify-between px-1.5 py-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Project
        </span>
        <button
          type="button"
          onClick={onCreate}
          title="New subflow (saved under flows/)"
          className="flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          new
        </button>
      </div>
      {main && item(main, false)}
      {subflows.length > 0 && (
        <>
          <div className="mt-0.5 flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
            <FolderOpen className="h-3.5 w-3.5" />
            flows
          </div>
          {subflows.map((flow) => item(flow, true))}
        </>
      )}
      {flows.length === 0 && (
        <div className="px-2 py-3 text-center text-xs text-muted-foreground">no flows yet</div>
      )}
    </div>
  );
}
