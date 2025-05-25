import { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import SchedulingDashboard from "@/components/admin/SchedulingDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Scheduling Dashboard - Admin Panel",
  description: "Monitor and manage automated scheduling system",
};

export default async function AdminSchedulingPage() {
  // Require admin access
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Calendar className="h-6 w-6 mr-2" />
          Scheduling Dashboard
        </h1>
        <p className="text-gray-600">
          Monitor automated tasks, job queues, and system performance in real-time.
        </p>
      </div>

      {/* Scheduling Dashboard Component */}
      <Card>
        <CardHeader>
          <CardTitle>Automated Scheduling System</CardTitle>
          <CardDescription>
            Real-time monitoring and control of scrapers, integrations, and utility jobs.
            Data refreshes automatically every 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchedulingDashboard />
        </CardContent>
      </Card>
    </div>
  );
}
