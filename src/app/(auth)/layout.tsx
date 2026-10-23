import { BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <Logo href="/" showDescriptor={false} />
        <div className="mt-auto max-w-md">
          <p className="font-display text-4xl leading-tight font-bold">
            Your next chapter starts with the right{" "}
            <span className="font-serif font-normal italic text-accent">team</span>.
          </p>
          <ul className="mt-8 space-y-4 text-[15px] text-white/80">
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden />
              Every management company is reviewed by TalentLoom before it can contact you.
            </li>
            <li className="flex gap-3">
              <Sparkles className="size-5 shrink-0 text-accent" aria-hidden />
              You decide, field by field, what companies can see.
            </li>
            <li className="flex gap-3">
              <BadgeCheck className="size-5 shrink-0 text-accent" aria-hidden />
              Free forever to receive and respond to inquiries.
            </li>
          </ul>
        </div>
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-primary/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-10 -left-20 size-64 rounded-full bg-accent/25 blur-3xl" />
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo href="/" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
