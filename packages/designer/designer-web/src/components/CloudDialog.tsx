import { useState } from "react";
import type { FormEvent } from "react";
import { Cloud, CloudOff, PlugZap } from "lucide-react";
import { connectCloud, disconnectCloud, type CloudStatus } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";

export default function CloudDialog({
  initial,
  onClose,
  onChanged,
}: {
  initial: CloudStatus;
  onClose: () => void;
  onChanged: (status: CloudStatus) => void;
}) {
  const [status, setStatus] = useState<CloudStatus>(initial);
  const [url, setUrl] = useState(initial.url ?? "https://cloud.r2flow.ru");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = (next: CloudStatus) => {
    setStatus(next);
    onChanged(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      apply(await connectCloud(url.trim(), token.trim()));
      setToken("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      apply(await disconnectCloud());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Orchestrator connection" onClose={onClose}>
      {status.connected ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-tag-green-tx" />
            Connected to <span className="font-mono text-xs">{status.url}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Publishing defaults to this orchestrator — no need to paste the URL and token every time.
          </p>
          {error && <p className="text-xs text-tag-red-tx">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Close
            </Button>
            <Button variant="destructive" size="sm" type="button" disabled={busy} onClick={() => void disconnect()}>
              <CloudOff className="h-4 w-4" />
              {busy ? "…" : "Disconnect"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Orchestrator URL</span>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cloud.r2flow.ru"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">API token (r2f_…)</span>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="r2f_…"
              required
            />
          </label>
          <p className="text-xs text-muted-foreground">
            The token is verified against the orchestrator and stored locally next to the designer —
            it never leaves your machine except for API calls.
          </p>
          {error && <p className="text-xs text-tag-red-tx">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={busy}>
              <PlugZap className="h-4 w-4" />
              {busy ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </form>
      )}
      {!status.connected && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Cloud className="h-3.5 w-3.5" />
          Not connected — publishing will ask for URL and token each time.
        </p>
      )}
    </Modal>
  );
}
