"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCreatorContext, grantConsent, hasConsent } from "@/lib/creator/context";
import { dbErrorMessage, finish } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { VISIBILITY_GROUPS } from "@/lib/creator/privacy";

const PATHS = ["/creator", "/creator/privacy", "/creator/profile"];
const level = z.enum(["public", "approved_companies", "private"]);

export async function saveVisibilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const update: Record<string, string> = {};
  for (const group of VISIBILITY_GROUPS) {
    const parsed = level.safeParse(fd.get(group));
    if (!parsed.success) return { message: "Choose a visibility for every item." };
    update[group] = parsed.data;
  }
  const { error } = await supabase.from("creator_privacy_settings").update(update).eq("creator_id", creator.id);
  if (error) return { message: dbErrorMessage(error) };
  return finish(fd, PATHS, "Privacy settings saved");
}

/** Shared by the privacy page and the last onboarding step. Returns an error state, or null when applied. */
async function applyDiscoverability(fd: FormData): Promise<FormState | null> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const turnOn = fd.get("discoverable") === "on";

  if (turnOn && !creator.is_discoverable) {
    if (!creator.handle) {
      return { errors: { discoverable: "Choose a profile handle first (Edit profile)." } };
    }
    const already = await hasConsent(supabase, viewer.id, "discoverability");
    if (!already) {
      if (fd.get("discoverabilityConsent") !== "on") {
        return { errors: { discoverabilityConsent: "Please confirm to make your profile discoverable" } };
      }
      const err = await grantConsent(supabase, viewer.id, "discoverability");
      if (err) return { message: dbErrorMessage(err) };
    }
  }

  if (turnOn !== creator.is_discoverable) {
    const { error } = await supabase.from("creator_profiles").update({ is_discoverable: turnOn }).eq("id", creator.id);
    if (error) return { message: dbErrorMessage(error) };
  }
  return null;
}

export async function setDiscoverabilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const err = await applyDiscoverability(fd);
  if (err) return err;
  const on = fd.get("discoverable") === "on";
  return finish(fd, [...PATHS, "/creators"], on ? "Your profile is discoverable" : "Your profile is hidden");
}

export async function finishOnboardingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const err = await applyDiscoverability(fd);
  if (err) return err;
  const { viewer, supabase } = await getCreatorContext();
  await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", viewer.id);
  finish(null, ["/creator", "/creators"]);
  redirect("/creator?welcome=1");
}

export async function skipOnboardingAction(): Promise<void> {
  const { viewer, supabase } = await getCreatorContext();
  await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", viewer.id);
  redirect("/creator");
}

export async function revokeConsentAction(consentId: string): Promise<FormState> {
  const { viewer, supabase } = await getCreatorContext();
  const { error } = await supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", consentId)
    .eq("user_id", viewer.id)
    .is("revoked_at", null);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, [...PATHS, "/creators"], "Consent withdrawn");
}
