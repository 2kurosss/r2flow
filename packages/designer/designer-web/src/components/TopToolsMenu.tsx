import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Plus, Wrench } from "lucide-react";
import type { NodeKind, ToolInfo } from "../types";
import { Input } from "@/components/ui/input";

const LOGIC_NODES: { kind: NodeKind; label: string }[] = [
  { kind: "start", label: "start" },
  { kind: "end", label: "end" },
  { kind: "if", label: "if / branch" },
  { kind: "loop", label: "loop" },
  { kind: "set", label: "set variable" },
  { kind: "flow", label: "subflow" },
  { kind: "fail", label: "fail" },
];

const GROUPS: { label: string; tools: string[] }[] = [
  { label: "Mouse", tools: ["windows.click", "windows.drag", "windows.hover", "windows.scroll"] },
  {
    label: "Keyboard & text",
    tools: ["windows.keyboard", "windows.input_text", "windows.set_text", "windows.clipboard"],
  },
  {
    label: "Elements",
    tools: [
      "windows.get_element",
      "windows.list_elements",
      "windows.get_text",
      "windows.exists",
      "windows.highlight",
      "windows.select",
    ],
  },
  {
    label: "Window & process",
    tools: ["windows.window", "windows.process", "windows.screenshot"],
  },
  { label: "Timing", tools: ["windows.delay", "windows.wait"] },
  { label: "Excel", tools: ["excel.read", "excel.write", "excel.append"] },
  { label: "Files", tools: ["file"] },
];

function shortName(name: string): string {
  return name.replace(/^windows\./, "");
}

function dragPayload(payload: { kind: NodeKind; tool?: string }) {
  return (e: DragEvent) => {
    e.dataTransfer.setData("application/r2flow", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };
}

export default function TopToolsMenu({
  tools,
  onAdd,
  onGrab,
}: {
  tools: ToolInfo[];
  onAdd: (kind: NodeKind, tool?: string) => void;
  onGrab: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const byName = new Map(tools.map((t) => [t.name, t]));
    const out: { label: string; items: { kind: NodeKind; tool?: string; name: string; hint: string }[] }[] = [];
    const logic = LOGIC_NODES.filter((n) => !query || n.label.includes(query)).map((n) => ({
      kind: n.kind,
      tool: undefined,
      name: n.label,
      hint: "logic",
    }));
    if (logic.length > 0) out.push({ label: "Logic", items: logic });
    for (const g of GROUPS) {
      const items: { kind: NodeKind; tool?: string; name: string; hint: string }[] = [];
      for (const toolName of g.tools) {
        const info = byName.get(toolName);
        if (!info) continue;
        if (query && !toolName.toLowerCase().includes(query) && !(info.description ?? "").toLowerCase().includes(query)) continue;
        items.push({ kind: "tool", tool: toolName, name: shortName(toolName), hint: info.description ?? "" });
      }
      // tools not covered by the static groups (custom / future)
      if (g.label === "Files") {
        for (const info of tools) {
          const known = GROUPS.some((gg) => gg.tools.includes(info.name));
          if (known) continue;
          if (query && !info.name.toLowerCase().includes(query)) continue;
          items.push({ kind: "tool", tool: info.name, name: shortName(info.name), hint: info.description ?? "" });
        }
      }
      if (items.length > 0) out.push({ label: g.label, items });
    }
    return out;
  }, [tools, query]);

  return (
    <div className="flex max-h-[60vh] w-[22rem] flex-col overflow-hidden">
      <div className="shrink-0 p-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter tools…  (drag onto canvas or click +)"
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div className="panel-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-2 pt-0">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {g.label}
            </div>
            <div className="space-y-1">
              {g.items.map((item) => (
                <div
                  key={`${item.kind}:${item.tool ?? item.name}`}
                  title={item.hint}
                  draggable
                  onDragStart={(e) => {
                    dragPayload({ kind: item.kind, tool: item.tool })(e);
                    onGrab();
                  }}
                  onClick={() => onAdd(item.kind, item.tool)}
                  className="group flex cursor-grab items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 transition-all hover:border-primary/40 hover:bg-secondary active:cursor-grabbing"
                >
                  <Wrench className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">
                    {item.name}
                  </span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">nothing found</div>
        )}
      </div>
      <div className="shrink-0 border-t border-border px-2 py-1.5 text-[10px] text-muted-foreground">
        drag onto the canvas or click + to add at the center
      </div>
    </div>
  );
}
