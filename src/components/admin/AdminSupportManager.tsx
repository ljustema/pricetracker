"use client";

import { useState } from "react";
import { AdminSupportDashboard } from "./AdminSupportDashboard";
import { AdminConversationView } from "./AdminConversationView";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  adminRole: string;
}

interface AdminSupportManagerProps {
  adminUser: AdminUser;
}

export function AdminSupportManager({ adminUser }: AdminSupportManagerProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleConversationSelect = (conversationId: string | null) => {
    setSelectedConversation(conversationId);
  };

  const handleUpdate = () => {
    // Trigger refresh of the dashboard when conversation is updated
    setRefreshTrigger(prev => prev + 1);
  };

  if (selectedConversation) {
    return (
      <AdminConversationView
        conversationId={selectedConversation}
        adminUser={adminUser}
        onBack={() => setSelectedConversation(null)}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <AdminSupportDashboard
      adminUser={adminUser}
      onConversationSelect={handleConversationSelect}
      selectedConversation={selectedConversation}
      key={refreshTrigger} // Force re-render when conversation is updated
    />
  );
}
