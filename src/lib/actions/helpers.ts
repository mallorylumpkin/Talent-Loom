import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/session";
import type { FormState } from "./types";

/** First string value of every field, for refilling forms after an error. */
export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && !(key in out)) out[key] = value;
  }
  return out;
}

/** Revalidate pages, then follow a `next` hidden field (onboarding) or report success. */
export function finish(fd: FormData | null, paths: string[], message = "Saved"): FormState {
  for (const p of paths) revalidatePath(p);
  const next = fd?.get("next");
  if (typeof next === "string" && next.startsWith("/")) redirect(safeNext(next));
  return { ok: true, message };
}

interface DbError {
  code?: string;
  message?: string;
}

/** Human message for a database error. Plan-limit and rule messages from the database are written for people. */
export function dbErrorMessage(error: DbError | null | undefined, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501") return "You don't have permission to do that.";
  console.error("[db]", error);
  return fallback;
}

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

export const optionalInt = (label: string, max = 10_000_000_000) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(/[,\s]/g, ""));
      if (!Number.isInteger(n) || n < 0 || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${label} as a whole number` });
        return z.NEVER;
      }
      return n;
    });

export const optionalDecimal = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(/[%\s]/g, ""));
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${label} between ${min} and ${max}` });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    });

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => /^https:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v), "Enter a valid https:// link");

export const uuid = z.string().uuid();

export function uuids(fd: FormData, name: string): string[] {
  return fd.getAll(name).filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);
}
