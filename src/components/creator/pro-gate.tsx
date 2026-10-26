import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";

export function ProUpsell({ what }: { what: string }) {
  return (
    <Alert tone="info" title="Creator Pro" className="mb-6">
      <span className="flex flex-wrap items-center gap-3">
        <span>{what} is part of Creator Pro. Anything you saved before stays visible.</span>
        <ButtonLink href="/creator/billing" size="sm"><Sparkles className="size-4" aria-hidden /> See Creator Pro</ButtonLink>
      </span>
    </Alert>
  );
}

export async function hasCreatorFeature(supabase: { rpc: (fn: string) => PromiseLike<{ data: unknown }> }, key: string) {
  const { data } = await supabase.rpc("my_entitlements");
  return !!(data as { feature_key: string; enabled: boolean }[] | null)?.find((e) => e.feature_key === key && e.enabled);
}
