import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { CreateCreatorForm } from "@/components/admin/user-forms";
import { getAdminContext } from "@/lib/admin/context";

export const metadata: Metadata = { title: "New creator" };

export default async function NewUserPage() {
  await getAdminContext();
  return (
    <>
      <PageHeader title="New creator account"
        description="For creators you're onboarding personally. Company accounts are created from Management companies. To add another admin, open an existing user and make them a super admin." />
      <Card className="max-w-xl"><CardBody><CreateCreatorForm /></CardBody></Card>
    </>
  );
}
