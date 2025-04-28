"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UserSettings from "@/components/settings/UserSettings";
import CompanySettings from "@/components/settings/CompanySettings";
import SubscriptionBilling from "@/components/settings/SubscriptionBilling";
import AdvancedSettings from "@/components/settings/AdvancedSettings";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("user");

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Loading your settings...</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>You must be logged in to view settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500">Please sign in to access your settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500">Manage your account and application settings</p>
      </div>

      <Tabs defaultValue="user" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-8 grid w-full grid-cols-4">
          <TabsTrigger value="user">User Settings</TabsTrigger>
          <TabsTrigger value="company">Company Settings</TabsTrigger>
          <TabsTrigger value="subscription">Subscription & Billing</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="user">
          <UserSettings user={session?.user} />
        </TabsContent>
        
        <TabsContent value="company">
          <CompanySettings userId={session?.user?.id} />
        </TabsContent>
        
        <TabsContent value="subscription">
          <SubscriptionBilling userId={session?.user?.id} />
        </TabsContent>
        
        <TabsContent value="advanced">
          <AdvancedSettings userId={session?.user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
