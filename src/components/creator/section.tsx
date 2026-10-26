import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

/** A titled card section used across creator settings pages. */
export function Section({
  id, title, description, action, children,
}: {
  id?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={title} description={description} action={action} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}
