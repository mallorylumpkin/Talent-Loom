import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
