import { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mail, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Communication - Admin Panel",
  description: "Manage admin communications and message history",
};

export default async function AdminCommunicationPage() {
  // Require admin access
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <MessageSquare className="h-6 w-6 mr-2" />
          Communication Center
        </h1>
        <p className="text-gray-600">
          Send messages to users and view communication history.
        </p>
      </div>

      {/* Coming Soon Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Communication Features
            <Badge variant="secondary">Phase 3</Badge>
          </CardTitle>
          <CardDescription>
            Advanced communication features are planned for Phase 3 of the admin panel implementation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Email Communication */}
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Email Communication</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Send emails to individual users or groups via Resend API integration.
                </p>
                <Badge variant="outline">Coming Soon</Badge>
              </CardContent>
            </Card>

            {/* In-App Messages */}
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">In-App Messages</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Send notifications that appear in users' dashboards.
                </p>
                <Badge variant="outline">Coming Soon</Badge>
              </CardContent>
            </Card>

            {/* Communication Logs */}
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Message History</h3>
                <p className="text-sm text-gray-600 mb-4">
                  View and search through all admin communications.
                </p>
                <Badge variant="outline">Coming Soon</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Planned Features */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Planned Features</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Individual user email composition and sending</li>
              <li>• Bulk email campaigns with user filtering</li>
              <li>• Email templates for common scenarios</li>
              <li>• In-app notification system</li>
              <li>• Communication audit logs and analytics</li>
              <li>• Email delivery status tracking</li>
              <li>• User communication preferences</li>
            </ul>
          </div>

          {/* Current Workaround */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Current Workaround</h4>
            <p className="text-sm text-gray-600">
              For now, you can view individual user communication history on their detail pages 
              in the <strong>User Management</strong> section. Direct email communication can be 
              handled through your existing email client using the user email addresses from the user list.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
