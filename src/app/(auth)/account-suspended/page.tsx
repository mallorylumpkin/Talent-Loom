import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Account unavailable" };

export default function AccountSuspendedPage() {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-strong">
        <ShieldAlert className="size-7" aria-hidden />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-ink">Your account is unavailable</h1>
      <p className="mt-3 text-muted">
        This account has been suspended or closed. If you think this is a mistake, email{" "}
        <a className="font-medium text-primary hover:underline" href={`mailto:${brand.supportEmail}`}>
          {brand.supportEmail}
        </a>{" "}
        and a different reviewer will look into it.
      </p>
      <form action="/auth/signout" method="post" className="mt-8">
        <button className="text-sm font-medium text-primary hover:underline" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
