import { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { CommunicationDashboard } from "@/components/admin/CommunicationDashboard";

export const metadata: Metadata = {
  title: "Communication - Admin Panel",
  description: "Manage admin communications and message history",
};

export default async function AdminCommunicationPage() {
  // Require admin access
  const adminUser = await requireAdmin();

  return <CommunicationDashboard adminUser={adminUser} />;
}
