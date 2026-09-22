import { useState } from "react";
import type { FormEvent } from "react";
import { Cloud } from "lucide-react";
import { login, register } from "../cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginDialog({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Blocking overlay (no dismiss): without a session the canvas cannot load.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-4 shadow-xl ring-1 ring-border">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">
            {mode === "login" ? "Log in to R2Flow Cloud" : "Create a cloud account"}
          </span>
        </div>
      <form onSubmit={submit} className="space-y-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cloud className="h-4 w-4" />
          The cloud designer saves drafts to your account — log in once per browser.
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Password (min 12 chars)
          </span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            minLength={mode === "register" ? 12 : 1}
          />
        </label>
        {error && <p className="text-xs text-tag-red-tx">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "No account yet? Create one" : "Have an account? Log in"}
          </button>
          <Button size="sm" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
