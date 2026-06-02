"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, History, Users, Send, Wrench, TrendingUp, HeadphonesIcon } from "lucide-react";
import { EmailComposer } from "./EmailComposer";
import { CommunicationHistory } from "./CommunicationHistory";
import { BulkEmailSender } from "./BulkEmailSender";
import ProfessionalScraperRequests from "./ProfessionalScraperRequests";
import { MarketingDashboard } from "./MarketingDashboard";
import { AdminSupportManager } from "./AdminSupportManager";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  adminRole: string;
}

interface CommunicationDashboardProps {
  adminUser: AdminUser;
}

export function CommunicationDashboard({ adminUser }: CommunicationDashboardProps) {
  const [activeTab, setActiveTab] = useState("support");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <MessageSquare className="h-6 w-6 mr-2" />
          Communication Center
        </h1>
        <p className="text-gray-600">
          Send emails to users and manage communication history.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Emails Sent Today</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recipients This Week</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Send className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">100%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <History className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Communications</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Communication Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Tools</CardTitle>
          <CardDescription>
            Send emails to individual users or groups, and view communication history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="support">
                <HeadphonesIcon className="h-4 w-4 mr-2" />
                Support Tickets
              </TabsTrigger>
              <TabsTrigger value="compose">
                <Mail className="h-4 w-4 mr-2" />
                Compose Email
              </TabsTrigger>
              <TabsTrigger value="bulk">
                <Users className="h-4 w-4 mr-2" />
                Bulk Email
              </TabsTrigger>
              <TabsTrigger value="scrapers">
                <Wrench className="h-4 w-4 mr-2" />
                Scraper Requests
              </TabsTrigger>
              <TabsTrigger value="marketing">
                <TrendingUp className="h-4 w-4 mr-2" />
                Marketing
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="support" className="mt-6">
              <AdminSupportManager adminUser={adminUser} />
            </TabsContent>

            <TabsContent value="compose" className="mt-6">
              <EmailComposer adminUser={adminUser} />
            </TabsContent>

            <TabsContent value="bulk" className="mt-6">
              <BulkEmailSender adminUser={adminUser} />
            </TabsContent>

            <TabsContent value="scrapers" className="mt-6">
              <ProfessionalScraperRequests adminUser={adminUser} />
            </TabsContent>

            <TabsContent value="marketing" className="mt-6">
              <MarketingDashboard adminUser={adminUser} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <CommunicationHistory />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
