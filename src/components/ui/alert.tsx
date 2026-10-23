import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-primary-soft text-primary-strong", Icon: Info },
  success: { box: "bg-success-soft text-success-strong", Icon: CheckCircle2 },
  warning: { box: "bg-warning-soft text-warning-strong", Icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger-strong", Icon: AlertCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="leading-6">{children}</div>}
      </div>
    </div>
  );
}
