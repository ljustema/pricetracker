"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, ExternalLink, User, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface ProfessionalScraperRequest {
  id: string;
  name: string;
  email: string;
  website: string;
  requirements: string;
  additional_info?: string;
  status: string;
  quoted_price?: number;
  estimated_delivery_days?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    id: string;
    name: string;
    email: string;
  };
  competitors?: {
    id: string;
    name: string;
    website: string;
  };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

interface ProfessionalScraperRequestsProps {
  adminUser: AdminUser;
}

export default function ProfessionalScraperRequests({ adminUser }: ProfessionalScraperRequestsProps) {
  const [requests, setRequests] = useState<ProfessionalScraperRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<ProfessionalScraperRequest | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: "",
    quotedPrice: "",
    estimatedDeliveryDays: "",
    adminNotes: ""
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchRequests = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search: searchTerm,
        status: statusFilter === "all" ? "" : statusFilter,
      });

      const response = await fetch(`/api/admin/professional-scraper-requests?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
        setTotalPages(data.pagination.totalPages);
        setCurrentPage(data.pagination.currentPage);
      } else {
        toast.error("Failed to fetch professional scraper requests");
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to fetch professional scraper requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, searchTerm]);

  const handleUpdateRequest = async () => {
    if (!selectedRequest) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/professional-scraper-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: updateData.status,
          quotedPrice: updateData.quotedPrice ? parseFloat(updateData.quotedPrice) : undefined,
          estimatedDeliveryDays: updateData.estimatedDeliveryDays ? parseInt(updateData.estimatedDeliveryDays) : undefined,
          adminNotes: updateData.adminNotes || undefined
        }),
      });

      if (response.ok) {
        toast.success("Request updated successfully");
        setIsUpdateDialogOpen(false);
        setSelectedRequest(null);
        setUpdateData({ status: "", quotedPrice: "", estimatedDeliveryDays: "", adminNotes: "" });
        fetchRequests(currentPage);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update request");
      }
    } catch (error) {
      console.error("Error updating request:", error);
      toast.error("Failed to update request");
    } finally {
      setIsUpdating(false);
    }
  };

  const openUpdateDialog = (request: ProfessionalScraperRequest) => {
    setSelectedRequest(request);
    setUpdateData({
      status: request.status,
      quotedPrice: request.quoted_price?.toString() || "",
      estimatedDeliveryDays: request.estimated_delivery_days?.toString() || "",
      adminNotes: request.admin_notes || ""
    });
    setIsUpdateDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'reviewing': return 'bg-yellow-100 text-yellow-800';
      case 'quoted': return 'bg-purple-100 text-purple-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading professional scraper requests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Professional Scraper Requests</h2>
        <p className="text-gray-600">Manage custom scraper development requests from users</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or website..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Requests ({requests.length})</CardTitle>
          <CardDescription>
            Professional scraper development requests from users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No professional scraper requests found.
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{request.competitors?.name || 'Unknown Competitor'}</h3>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status.replace('_', ' ')}
                        </Badge>
                        {request.quoted_price && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            €{request.quoted_price}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{request.name} ({request.email})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          <a 
                            href={request.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {request.website}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Created: {formatDate(request.created_at)}</span>
                        </div>
                        {request.estimated_delivery_days && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Est. Delivery: {request.estimated_delivery_days} days</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-sm text-gray-700">
                          <strong>Requirements:</strong> {request.requirements.substring(0, 200)}
                          {request.requirements.length > 200 && '...'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <Button
                        onClick={() => openUpdateDialog(request)}
                        variant="outline"
                        size="sm"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Professional Scraper Request</DialogTitle>
            <DialogDescription>
              Update the status and details for {selectedRequest?.competitors?.name || 'this request'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="update-status">Status</Label>
              <Select value={updateData.status} onValueChange={(value) => setUpdateData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quoted-price">Quoted Price (€)</Label>
                <Input
                  id="quoted-price"
                  type="number"
                  step="0.01"
                  value={updateData.quotedPrice}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, quotedPrice: e.target.value }))}
                  placeholder="200.00"
                />
              </div>
              <div>
                <Label htmlFor="delivery-days">Estimated Delivery (days)</Label>
                <Input
                  id="delivery-days"
                  type="number"
                  value={updateData.estimatedDeliveryDays}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, estimatedDeliveryDays: e.target.value }))}
                  placeholder="7"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="admin-notes">Admin Notes</Label>
              <Textarea
                id="admin-notes"
                value={updateData.adminNotes}
                onChange={(e) => setUpdateData(prev => ({ ...prev, adminNotes: e.target.value }))}
                placeholder="Internal notes or message to customer..."
                rows={4}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsUpdateDialogOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRequest}
                disabled={isUpdating || !updateData.status}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Request'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
