"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Mail,
  Download,
  Search,
  Calendar,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  XCircle
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  adminRole: string;
}

interface MarketingContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  contact_type: string;
  status: string;
  created_at: string;
}

interface NewsletterSubscription {
  id: string;
  email: string;
  name: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  is_active: boolean;
}

interface MarketingStats {
  totalContacts: number;
  newContacts: number;
  totalSubscribers: number;
  activeSubscribers: number;
  contactsThisWeek: number;
  subscribersThisWeek: number;
}

interface MarketingDashboardProps {
  adminUser: AdminUser;
}

export function MarketingDashboard({ adminUser: _adminUser }: MarketingDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscription[]>([]);
  const [stats, setStats] = useState<MarketingStats>({
    totalContacts: 0,
    newContacts: 0,
    totalSubscribers: 0,
    activeSubscribers: 0,
    contactsThisWeek: 0,
    subscribersThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contactTypeFilter, setContactTypeFilter] = useState("all");
  const { toast } = useToast();

  const loadMarketingData = useCallback(async () => {
    setLoading(true);
    try {
      // Load contacts and subscribers data
      const [contactsResponse, subscribersResponse] = await Promise.all([
        fetch("/api/admin/marketing/contacts"),
        fetch("/api/admin/marketing/newsletter")
      ]);

      let loadedContacts: MarketingContact[] = [];
      let loadedSubscribers: NewsletterSubscription[] = [];

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        loadedContacts = contactsData.contacts || [];
        setContacts(loadedContacts);
      }

      if (subscribersResponse.ok) {
        const subscribersData = await subscribersResponse.json();
        loadedSubscribers = subscribersData.subscribers || [];
        setSubscribers(loadedSubscribers);
      }

      // Calculate stats with the loaded data
      calculateStatsWithData(loadedContacts, loadedSubscribers);
    } catch (error) {
      console.error("Error loading marketing data:", error);
      toast({
        title: "Error",
        description: "Failed to load marketing data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMarketingData();
  }, [loadMarketingData]);

  const calculateStatsWithData = (contactsData: MarketingContact[], subscribersData: NewsletterSubscription[]) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const newContacts = contactsData.filter(c => c.status === 'new').length;
    const contactsThisWeek = contactsData.filter(c =>
      new Date(c.created_at) >= weekAgo
    ).length;

    const activeSubscribers = subscribersData.filter(s => s.is_active).length;
    const subscribersThisWeek = subscribersData.filter(s =>
      new Date(s.subscribed_at) >= weekAgo && s.is_active
    ).length;

    setStats({
      totalContacts: contactsData.length,
      newContacts,
      totalSubscribers: subscribersData.length,
      activeSubscribers,
      contactsThisWeek,
      subscribersThisWeek,
    });
  };

  const updateContactStatus = async (contactId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/marketing/contacts/${contactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setContacts(prev =>
          prev.map(contact =>
            contact.id === contactId
              ? { ...contact, status: newStatus }
              : contact
          )
        );
        toast({
          title: "Status updated",
          description: `Contact status changed to ${newStatus}`,
        });
      } else {
        throw new Error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating contact status:", error);
      toast({
        title: "Error",
        description: "Failed to update contact status",
        variant: "destructive",
      });
    }
  };

  const exportData = async (type: 'contacts' | 'subscribers') => {
    try {
      const response = await fetch(`/api/admin/marketing/export?type=${type}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

        toast({
          title: "Export successful",
          description: `${type} data exported successfully`,
        });
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContactTypeColor = (type: string) => {
    switch (type) {
      case 'sales': return 'bg-purple-100 text-purple-800';
      case 'support': return 'bg-orange-100 text-orange-800';
      case 'partnership': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;
    const matchesType = contactTypeFilter === 'all' || contact.contact_type === contactTypeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredSubscribers = subscribers.filter(subscriber => {
    return subscriber.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (subscriber.name && subscriber.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2" />
            Marketing Dashboard
          </h1>
          <p className="text-gray-600">
            Manage marketing contacts and newsletter subscribers.
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.newContacts} new contacts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Newsletter Subscribers</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscribers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalSubscribers} total subscribers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contactsThisWeek + stats.subscribersThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              {stats.contactsThisWeek} contacts, {stats.subscribersThisWeek} subscribers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Marketing Management</CardTitle>
          <CardDescription>
            View and manage marketing contacts and newsletter subscribers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">
                Contacts ({stats.totalContacts})
              </TabsTrigger>
              <TabsTrigger value="subscribers">
                Subscribers ({stats.activeSubscribers})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Marketing Overview</h3>
                <p className="text-gray-600 mb-4">
                  Use the tabs above to manage contacts and newsletter subscribers.
                </p>
                <div className="flex justify-center gap-4">
                  <Button onClick={() => setActiveTab("contacts")}>
                    View Contacts
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("subscribers")}>
                    View Subscribers
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              {/* Contact management will be implemented here */}
              <div className="space-y-4">
                {/* Filters and search */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={contactTypeFilter} onValueChange={setContactTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => exportData('contacts')}
                    className="flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>

                {/* Contacts list */}
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">Loading contacts...</div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No contacts found matching your criteria.
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <Card key={contact.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{contact.name}</h3>
                              <Badge className={getStatusColor(contact.status)}>
                                {contact.status}
                              </Badge>
                              <Badge className={getContactTypeColor(contact.contact_type)}>
                                {contact.contact_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{contact.email}</p>
                            {contact.company && (
                              <p className="text-sm text-gray-600 mb-2">{contact.company}</p>
                            )}
                            <p className="text-sm text-gray-800 mb-2">{contact.message}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(contact.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            {contact.status === 'new' && (
                              <Button
                                size="sm"
                                onClick={() => updateContactStatus(contact.id, 'contacted')}
                              >
                                Mark Contacted
                              </Button>
                            )}
                            {contact.status === 'contacted' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateContactStatus(contact.id, 'resolved')}
                              >
                                Mark Resolved
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subscribers" className="mt-6">
              {/* Newsletter subscriber management will be implemented here */}
              <div className="space-y-4">
                {/* Search and export */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search subscribers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportData('subscribers')}
                    className="flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>

                {/* Subscribers list */}
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">Loading subscribers...</div>
                  ) : filteredSubscribers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No subscribers found matching your search.
                    </div>
                  ) : (
                    filteredSubscribers.map((subscriber) => (
                      <Card key={subscriber.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">
                                {subscriber.name || subscriber.email}
                              </h3>
                              {subscriber.is_active ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Unsubscribed
                                </Badge>
                              )}
                            </div>
                            {subscriber.name && (
                              <p className="text-sm text-gray-600 mb-1">{subscriber.email}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              Subscribed: {new Date(subscriber.subscribed_at).toLocaleString()}
                            </p>
                            {subscriber.unsubscribed_at && (
                              <p className="text-xs text-gray-500">
                                Unsubscribed: {new Date(subscriber.unsubscribed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
