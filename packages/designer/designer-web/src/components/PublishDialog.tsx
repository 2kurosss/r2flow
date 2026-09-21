import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Upload } from "lucide-react";
import { fetchCloud, publishFlow, type PublishResult } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";

const SETTINGS_KEY = "r2flow.publish";

interface PublishSettings {
  url: string;
  token: string;
  name: string;
  version: string;
  allowInsecure: boolean;
}

function defaults(): PublishSettings {
  return {
    url: "http://127.0.0.1:8000",
    token: "",
    name: "my-flow",
    version: "",
    allowInsecure: false,
  };
}

function loadSettings(): PublishSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...defaults(), ...(JSON.parse(raw) as Partial<PublishSettings>) };
    }
  } catch {
    /* ignore */
  }
  return defaults();
}

export default function PublishDialog({
  defaultName,
  onClose,
}: {
  defaultName: string;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<PublishSettings>(() => {
    const loaded = loadSettings();
    return loaded.name === defaults().name && defaultName
      ? { ...loaded, name: defaultName }
      : loaded;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  // "Connect once" UX: when the designer holds a cloud connection and the
  // user never typed a URL, default to it; an empty token then falls back
  // to the saved one server-side.
  useEffect(() => {
    let cancelled = false;
    fetchCloud()
      .then((s) => {
        if (cancelled || !s.connected || !s.url) return;
        setSavedUrl(s.url);
        setSettings((prev) =>
          prev.url === defaults().url ? { ...prev, url: s.url as string } : prev,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (p: Partial<PublishSettings>) => setSettings((s) => ({ ...s, ...p }));

  // Publishing to the saved connection: the token lives server-side, so no
  // token field at all — a stale remembered token can neither shadow it nor
  // fail the publish. A different URL still needs its own token.
  const usingSaved =
    savedUrl !== null &&
    settings.url.trim().replace(/\/+$/, "") === savedUrl;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const version = settings.version.trim() || `1.0.${Math.floor(Date.now() / 1000)}`;
      const res = await publishFlow({
        url: settings.url.trim(),
        token: usingSaved ? "" : settings.token.trim(),
        name: settings.name.trim(),
        version,
        allow_insecure: settings.allowInsecure,
      });
      try {
        // Never persist the token in the browser: the designer backend
        // holds the saved connection; a localStorage copy only shadows it.
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({ ...settings, token: "", version: "" }),
        );
      } catch {
        /* ignore */
      }
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Publish to orchestrator" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              Published <span className="font-medium">{result.name}</span>{" "}
              <span className="font-mono text-xs">{result.version}</span> to{" "}
              <span className="font-mono text-xs">{result.orchestrator}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              The process is now on the Orchestrator tab — deploy it to an agent and run it there.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={onClose}>
                Close
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={!result.process_url}
                onClick={() => {
                  if (result.process_url) window.open(result.process_url, "_blank", "noopener");
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Open in Orchestrator
              </Button>
            </div>
          </div>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Orchestrator URL</span>
              <Input
                value={settings.url}
                onChange={(e) => patch({ url: e.target.value })}
                placeholder="http://127.0.0.1:8000"
                required
              />
            </label>
            {usingSaved ? (
              <p className="-mt-1 text-[11px] text-muted-foreground">
                Publishing to the saved connection: {savedUrl} — change the
                URL above to publish elsewhere (that needs its own token).
              </p>
            ) : (
              <>
                {savedUrl && (
                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    Saved connection: {savedUrl} — publishing elsewhere.
                  </p>
                )}
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">API token (r2f_…)</span>
                  <Input
                    type="password"
                    value={settings.token}
                    onChange={(e) => patch({ token: e.target.value })}
                    placeholder="r2f_…"
                    required
                  />
                </label>
              </>
            )}
            <div className="flex gap-3">
              <label className="block flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Pack name</span>
                <Input
                  value={settings.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  required
                />
              </label>
              <label className="block flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Version</span>
                <Input
                  value={settings.version}
                  onChange={(e) => patch({ version: e.target.value })}
                  placeholder="1.0.0 (auto)"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={settings.allowInsecure}
                onChange={(e) => patch({ allowInsecure: e.target.checked })}
              />
              Allow plain http to a non-loopback orchestrator (token in cleartext)
            </label>

            {error && <p className="text-xs text-tag-red-tx">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={busy}>
                <Upload className="h-4 w-4" />
                {busy ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
