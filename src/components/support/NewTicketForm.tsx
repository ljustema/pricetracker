"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface Conversation {
  id: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  unread_count: number;
  latest_message?: {
    id: string;
    message_content: string;
    sender_type: string;
    created_at: string;
  };
}

interface NewTicketFormProps {
  user: User;
  onTicketCreated: (conversation: Conversation) => void;
}

export function NewTicketForm({ user, onTicketCreated }: NewTicketFormProps) {
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    category: "general",
    priority: "medium"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate form
      if (!formData.subject.trim() || !formData.message.trim()) {
        setError("Subject and message are required");
        return;
      }

      if (formData.subject.length < 5 || formData.subject.length > 200) {
        setError("Subject must be between 5 and 200 characters");
        return;
      }

      if (formData.message.length < 10 || formData.message.length > 2000) {
        setError("Message must be between 10 and 2000 characters");
        return;
      }

      const response = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      // Reset form
      setFormData({
        subject: "",
        message: "",
        category: "general",
        priority: "medium"
      });

      toast.success("Support ticket created successfully!");
      onTicketCreated(data.conversation);

    } catch (err) {
      console.error("Error creating ticket:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { value: "general", label: "General Support", description: "General questions and help" },
    { value: "technical", label: "Technical Issue", description: "Bugs, errors, or technical problems" },
    { value: "billing", label: "Billing & Account", description: "Payment, subscription, or account issues" },
    { value: "feature_request", label: "Feature Request", description: "Suggest new features or improvements" },
    { value: "scraper_request", label: "Custom Scraper", description: "Request a custom scraper development" }
  ];

  const priorities = [
    { value: "low", label: "Low", description: "General inquiry, no urgency" },
    { value: "medium", label: "Medium", description: "Standard support request" },
    { value: "high", label: "High", description: "Important issue affecting your work" },
    { value: "urgent", label: "Urgent", description: "Critical issue requiring immediate attention" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Support Ticket</CardTitle>
        <CardDescription>
          Describe your issue or question and we'll get back to you as soon as possible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Subject */}
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              placeholder="Brief description of your issue..."
              maxLength={200}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.subject.length}/200 characters
            </p>
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div>
                        <div className="font-medium">{category.label}</div>
                        <div className="text-sm text-gray-500">{category.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      <div>
                        <div className="font-medium">{priority.label}</div>
                        <div className="text-sm text-gray-500">{priority.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleChange("message", e.target.value)}
              placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce the problem, or specific questions you have..."
              rows={6}
              maxLength={2000}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.message.length}/2000 characters
            </p>
          </div>

          {/* Contact Info Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
            <p className="text-sm text-gray-600">
              <strong>Name:</strong> {user.name || 'Not provided'}<br />
              <strong>Email:</strong> {user.email || 'Not provided'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              We'll use this information to respond to your ticket.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.subject.trim() || !formData.message.trim()}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Ticket
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
