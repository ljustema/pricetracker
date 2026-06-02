"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Mail, Send, CheckCircle, AlertCircle } from "lucide-react";

interface ContactFormData {
  name: string;
  email: string;
  company: string;
  contactType: string;
  message: string;
  // Honeypot field - hidden from users
  website: string;
}

interface ContactFormProps {
  className?: string;
  showTitle?: boolean;
  compact?: boolean;
}

export function ContactForm({ className = "", showTitle = true, compact = false }: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    company: "",
    contactType: "general",
    message: "",
    website: "", // Honeypot field
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const contactTypes = [
    { value: "general", label: "General Inquiry" },
    { value: "sales", label: "Sales" },
    { value: "support", label: "Support" },
    { value: "partnership", label: "Partnership" },
  ];

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "Name is required";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.message.trim()) return "Message is required";
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return "Please enter a valid email address";
    
    // Length validations
    if (formData.name.length < 2) return "Name must be at least 2 characters";
    if (formData.name.length > 100) return "Name must be less than 100 characters";
    if (formData.message.length < 10) return "Message must be at least 10 characters";
    if (formData.message.length > 2000) return "Message must be less than 2000 characters";
    if (formData.company.length > 100) return "Company name must be less than 100 characters";
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check honeypot field
    if (formData.website) {
      // This is likely a bot submission
      toast({
        title: "Error",
        description: "Please try again later.",
        variant: "destructive",
      });
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          company: formData.company.trim(),
          contactType: formData.contactType,
          message: formData.message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setIsSubmitted(true);
      toast({
        title: "Message sent!",
        description: "Thank you for contacting us. We&apos;ll get back to you within 24 hours.",
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        company: "",
        contactType: "general",
        message: "",
        website: "",
      });

    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted && !compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Message Sent!</h3>
            <p className="text-gray-600 mb-4">
              Thank you for contacting us. We&apos;ll get back to you within 24 hours.
            </p>
            <Button 
              onClick={() => setIsSubmitted(false)}
              variant="outline"
            >
              Send Another Message
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Contact Us
          </CardTitle>
          <CardDescription>
            Get in touch with our team. We&apos;d love to hear from you.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "" : "pt-6"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot field - hidden from users */}
          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={(e) => handleInputChange("website", e.target.value)}
            style={{ display: "none" }}
            tabIndex={-1}
            autoComplete="off"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Your full name"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="your@email.com"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                type="text"
                value={formData.company}
                onChange={(e) => handleInputChange("company", e.target.value)}
                placeholder="Your company name"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactType">Inquiry Type</Label>
              <Select
                value={formData.contactType}
                onValueChange={(value) => handleInputChange("contactType", value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select inquiry type" />
                </SelectTrigger>
                <SelectContent>
                  {contactTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              placeholder="Tell us how we can help you..."
              rows={compact ? 3 : 5}
              required
              disabled={isSubmitting}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>

          {compact && isSubmitted && (
            <div className="text-center py-2">
              <p className="text-sm text-green-600 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Message sent! We&apos;ll get back to you soon.
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
