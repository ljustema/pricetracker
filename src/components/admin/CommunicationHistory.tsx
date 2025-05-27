"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, Mail, Eye, Filter, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CommunicationLog {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  communication_type: string;
  subject: string;
  message_content: string;
  sent_at: string;
  status: string;
  error_message?: string;
  admin_name?: string;
  target_user_name?: string;
  target_user_email?: string;
}

export function CommunicationHistory() {
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedCommunication, setSelectedCommunication] = useState<CommunicationLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCommunications = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search: searchTerm,
        status: statusFilter === "all" ? "" : statusFilter,
        type: typeFilter === "all" ? "" : typeFilter,
      });

      const response = await fetch(`/api/admin/communication/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCommunications(data.communications);
        setTotalPages(data.pagination.totalPages);
        setCurrentPage(data.pagination.currentPage);
      } else {
        toast.error("Failed to fetch communication history");
      }
    } catch (error) {
      console.error("Error fetching communications:", error);
      toast.error("Failed to fetch communication history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunications(1);
  }, [searchTerm, statusFilter, typeFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-green-100 text-green-800">Sent</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Email</Badge>;
      case "in_app":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">In-App</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter and search through communication history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by recipient or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="in_app">In-App Message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Communication History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Communication History
          </CardTitle>
          <CardDescription>
            View all communications sent to users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading communications...</span>
            </div>
          ) : communications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No communications found.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {communications.map((comm) => (
                    <TableRow key={comm.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {format(new Date(comm.sent_at), "MMM dd, yyyy HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{comm.target_user_name || "Unknown User"}</p>
                          <p className="text-sm text-gray-600">{comm.target_user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium truncate max-w-xs" title={comm.subject}>
                          {comm.subject}
                        </p>
                      </TableCell>
                      <TableCell>{getTypeBadge(comm.communication_type)}</TableCell>
                      <TableCell>{getStatusBadge(comm.status)}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCommunication(comm)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Communication Details</DialogTitle>
                              <DialogDescription>
                                View the full details of this communication.
                              </DialogDescription>
                            </DialogHeader>
                            {selectedCommunication && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-gray-600">Sent At</label>
                                    <p>{format(new Date(selectedCommunication.sent_at), "PPpp")}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-600">Status</label>
                                    <div className="mt-1">{getStatusBadge(selectedCommunication.status)}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-600">Recipient</label>
                                    <p>{selectedCommunication.target_user_name} ({selectedCommunication.target_user_email})</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-600">Type</label>
                                    <div className="mt-1">{getTypeBadge(selectedCommunication.communication_type)}</div>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-600">Subject</label>
                                  <p className="mt-1">{selectedCommunication.subject}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-600">Message Content</label>
                                  <div className="mt-1 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                                    {selectedCommunication.message_content}
                                  </div>
                                </div>
                                {selectedCommunication.error_message && (
                                  <div>
                                    <label className="text-sm font-medium text-red-600">Error Message</label>
                                    <p className="mt-1 text-red-600">{selectedCommunication.error_message}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchCommunications(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchCommunications(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
