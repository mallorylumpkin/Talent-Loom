import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/messaging/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Updates about inquiries, messages and your account." />
      <div className="max-w-3xl"><NotificationList /></div>
    </>
  );
}
