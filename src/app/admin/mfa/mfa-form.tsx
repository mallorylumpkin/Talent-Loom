"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/browser";

type Mode = { kind: "loading" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string };

export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError("We couldn't load your security settings. Refresh to try again.");
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) {
        setMode({ kind: "verify", factorId: verified.id });
        return;
      }
      // Clean up abandoned enrolments, then start a fresh one.
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TalentLoom admin",
      });
      if (enrollError || !enrolled) {
        setError("We couldn't start two-factor setup. Make sure MFA (TOTP) is enabled in Supabase → Authentication.");
        return;
      }
      setMode({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode.kind === "loading") return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't work. Codes refresh every 30 seconds — try the newest one.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  if (mode.kind === "loading") {
    return error ? (
      <Alert tone="danger">{error}</Alert>
    ) : (
      <div className="flex items-center gap-2 text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
      </div>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        {mode.kind === "enroll" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">1. Scan this QR code with your authenticator app</p>
            {/* Supabase returns the QR code as an SVG data URL */}
            <img src={mode.qr} alt="QR code for your authenticator app" className="mx-auto size-48 rounded-lg border border-line bg-white p-2" />
            <p className="text-xs text-muted">
              Can't scan? Enter this key manually: <code className="rounded bg-canvas px-1.5 py-0.5 break-all">{mode.secret}</code>
            </p>
            <p className="pt-2 text-sm font-medium text-ink">2. Enter the 6-digit code it shows</p>
          </div>
        )}
        {mode.kind === "verify" && <p className="text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>}

        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Authentication code" name="code">
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
        </Field>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {mode.kind === "enroll" ? "Turn on two-factor" : "Verify"}
        </Button>
      </form>
    </Card>
  );
}
