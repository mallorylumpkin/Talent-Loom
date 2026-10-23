import { Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo />
      <Compass className="mt-12 size-10 text-accent" aria-hidden />
      <h1 className="mt-4 text-3xl font-bold text-ink">We couldn't find that page</h1>
      <p className="mt-2 max-w-md text-muted">It may have moved, or the link might be mistyped.</p>
      <ButtonLink href="/" className="mt-8">Back to home</ButtonLink>
    </div>
  );
}
