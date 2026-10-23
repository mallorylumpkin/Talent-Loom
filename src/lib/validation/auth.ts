import { z } from "zod";

export const MIN_AGE = 18;

/** Whole years between a date of birth and today (UTC). */
export function ageOn(dob: Date, today = new Date()): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[a-z]/i, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password: passwordSchema,
  // Used only to confirm 18+ at sign-up. NOT stored.
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1900;
    }, "Enter a valid date")
    .refine((v) => ageOn(new Date(`${v}T00:00:00Z`)) >= MIN_AGE, "You must be 18 or older to join TalentLoom"),
  confirm18: z.literal("on", { errorMap: () => ({ message: "Please confirm you are 18 or older" }) }),
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "Please accept the Terms and Privacy Policy" }) }),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/** Turn a ZodError into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
