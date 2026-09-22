import type { FlowDoc, ToolInfo } from "./types";
import type { DebugState } from "./debugTypes";
import { CLOUD_MODE, authFetch } from "./cloud";

/** Local backend: plain fetch. Cloud mode: bearer + cookie-refresh. */
function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return CLOUD_MODE ? authFetch(path, init) : fetch(path, init);
}

async function json(res: Response): Promise<any> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body && typeof body.detail === "string" ? body.detail : res.statusText;
    throw new Error(detail);
  }
  return body;
}

function cloudBlock(feature: string): never {
  throw new Error(`${feature} is not available in cloud mode`);
}

export async function fetchTools(): Promise<ToolInfo[]> {
  // Same path on both backends: the cloud serves the engine registry.
  const data = await json(await apiFetch("/api/tools"));
  return data.tools as ToolInfo[];
}

export interface FlowFile {
  path: string;
  name: string;
  is_main: boolean;
  /** Cloud drafts only: server id behind the name. */
  id?: string;
}

// -- cloud drafts: the UI addresses flows by name, the API by id ----------
// Names are immutable (no rename endpoint), so a name→id cache populated
// by fetchFlows with refresh-on-miss is safe.

const draftIds = new Map<string, string>();

function normalizeDraftName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? name;
  return base.endsWith(".json") ? base.slice(0, -".json".length) : base;
}

async function refreshDrafts(): Promise<FlowFile[]> {
  const data = (await json(await apiFetch("/api/drafts"))) as {
    id: string;
    name: string;
  }[];
  const list: FlowFile[] = data.map((d, i) => ({
    path: d.name,
    name: d.name,
    is_main: i === 0,
    id: d.id,
  }));
  draftIds.clear();
  for (const f of list) draftIds.set(normalizeDraftName(f.path), f.id ?? "");
  return list;
}

async function draftIdFor(name: string): Promise<string> {
  const key = normalizeDraftName(name);
  const hit = draftIds.get(key);
  if (hit) return hit;
  await refreshDrafts();
  const id = draftIds.get(key);
  if (!id) throw new Error(`draft not found: ${name}`);
  return id;
}

export async function fetchFlows(): Promise<FlowFile[]> {
  if (CLOUD_MODE) return refreshDrafts();
  const data = await json(await apiFetch("/api/flows"));
  return data.flows as FlowFile[];
}

export async function createFlow(name: string): Promise<FlowFile> {
  const raw = name.trim().replace(/\.json$/, "");
  if (CLOUD_MODE) {
    const data = (await json(
      await apiFetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: raw }),
      }),
    )) as { id: string; name: string };
    draftIds.set(normalizeDraftName(data.name), data.id);
    return { path: data.name, name: data.name, is_main: false, id: data.id };
  }
  return json(
    await apiFetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function fetchFlow(path?: string): Promise<{
  exists: boolean;
  flow: unknown;
  path: string;
}> {
  if (CLOUD_MODE) {
    let name = path ? normalizeDraftName(path) : "";
    if (!name) {
      const list = await refreshDrafts();
      if (list.length === 0) return { exists: false, flow: null, path: "" };
      name = list[0].path;
    }
    const data = (await json(await apiFetch(`/api/drafts/${await draftIdFor(name)}`))) as {
      name: string;
      flow: unknown;
    };
    return { exists: true, flow: data.flow, path: data.name };
  }
  const qs = path ? `?path=${encodeURIComponent(path)}` : "";
  return json(await apiFetch(`/api/flow${qs}`));
}

export async function saveFlow(doc: FlowDoc, path?: string): Promise<void> {
  if (CLOUD_MODE) {
    await json(
      await apiFetch(`/api/drafts/${await draftIdFor(path ?? "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: doc }),
      }),
    );
    return;
  }
  const qs = path ? `?path=${encodeURIComponent(path)}` : "";
  await json(
    await apiFetch(`/api/flow${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    }),
  );
}

export interface PublishResult {
  name: string;
  version: string;
  orchestrator: string;
  process_id?: string;
  process_url?: string;
}

export async function publishFlow(payload: {
  url: string;
  token: string;
  name: string;
  version: string;
  allow_insecure?: boolean;
}): Promise<PublishResult> {
  return json(
    await apiFetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

/** Cloud publish: snapshot a draft into a pack version (same-origin session). */
export async function publishDraft(
  draftName: string,
  packName: string,
  version: string,
): Promise<PublishResult> {
  const data = (await json(
    await apiFetch(`/api/drafts/${await draftIdFor(draftName)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_name: packName, version }),
    }),
  )) as {
    process_id?: string;
    process_url?: string;
  };
  return {
    name: packName,
    version,
    orchestrator: window.location.origin,
    process_id: data.process_id,
    process_url: data.process_url,
  };
}

export interface RecordState {
  active: boolean;
  steps: number;
  error: string | null;
}

export async function recordStart(): Promise<RecordState> {
  if (CLOUD_MODE) cloudBlock("Recorder");
  return json(await apiFetch("/api/record/start", { method: "POST" }));
}

export async function recordStop(): Promise<{ flow: FlowDoc }> {
  if (CLOUD_MODE) cloudBlock("Recorder");
  return json(await apiFetch("/api/record/stop", { method: "POST" }));
}

export async function recordDiscard(): Promise<void> {
  if (CLOUD_MODE) cloudBlock("Recorder");
  await json(await apiFetch("/api/record/discard", { method: "POST" }));
}

export async function recordState(): Promise<RecordState> {
  if (CLOUD_MODE) cloudBlock("Recorder");
  return json(await apiFetch("/api/record/state"));
}

export interface ProjectSettings {
  variable_scope: "shared" | "isolated";
}

export interface CloudStatus {
  connected: boolean;
  url: string | null;
  email?: string | null;
}

export async function fetchCloud(): Promise<CloudStatus> {
  // Cloud mode IS the orchestrator connection (same origin, session auth).
  if (CLOUD_MODE) return { connected: true, url: window.location.origin };
  return json(await apiFetch("/api/cloud"));
}

export async function connectCloud(url: string, token: string): Promise<CloudStatus> {
  if (CLOUD_MODE) return { connected: true, url: window.location.origin };
  return json(
    await apiFetch("/api/cloud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, token }),
    }),
  );
}

export async function disconnectCloud(): Promise<CloudStatus> {
  if (CLOUD_MODE) return { connected: true, url: window.location.origin };
  return json(await apiFetch("/api/cloud", { method: "DELETE" }));
}

export async function fetchProject(): Promise<ProjectSettings> {
  return json(await apiFetch("/api/project"));
}

export async function updateProject(
  variable_scope: "shared" | "isolated",
): Promise<ProjectSettings> {
  return json(
    await apiFetch("/api/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variable_scope }),
    }),
  );
}

export async function debugStart(doc: FlowDoc, devCapture = false): Promise<DebugState> {
  if (CLOUD_MODE) cloudBlock("Debug");
  const qs = devCapture ? "?dev_capture=true" : "";
  return json(
    await apiFetch(`/api/debug/start${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    }),
  );
}

export interface CapturedSelector {
  selector: Record<string, unknown>;
  full_path: unknown[];
  confidence: string | null;
  warnings: string[];
}

export async function captureSelector(): Promise<CapturedSelector> {
  if (CLOUD_MODE) cloudBlock("Selector capture");
  return json(await apiFetch("/api/capture/selector", { method: "POST" }));
}

export type DebugAction = "step" | "resume" | "pause" | "stop";

export async function debugAction(action: DebugAction): Promise<DebugState> {
  if (CLOUD_MODE) cloudBlock("Debug");
  return json(await apiFetch(`/api/debug/${action}`, { method: "POST" }));
}

export async function debugBreakpoint(
  nodeId: string,
  enabled: boolean,
): Promise<DebugState> {
  if (CLOUD_MODE) cloudBlock("Debug");
  return json(
    await apiFetch("/api/debug/breakpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, enabled }),
    }),
  );
}

export async function debugState(): Promise<DebugState> {
  if (CLOUD_MODE) cloudBlock("Debug");
  return json(await apiFetch("/api/debug/state"));
}

export async function debugEval(
  expression: string,
): Promise<{ result: string; error: string | null }> {
  if (CLOUD_MODE) cloudBlock("Evaluate");
  return json(
    await apiFetch("/api/debug/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression }),
    }),
  );
}
