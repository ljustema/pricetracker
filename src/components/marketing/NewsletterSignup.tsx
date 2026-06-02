"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Send, CheckCircle, AlertCircle, MailOpen } from "lucide-react";

interface NewsletterFormData {
  email: string;
  name: string;
  // Honeypot field - hidden from users
  website: string;
}

interface NewsletterSignupProps {
  className?: string;
  showTitle?: boolean;
  compact?: boolean;
  inline?: boolean;
}

export function NewsletterSignup({
  className = "",
  showTitle = true,
  compact = false,
  inline = false
}: NewsletterSignupProps) {
  const [formData, setFormData] = useState<NewsletterFormData>({
    email: "",
    name: "",
    website: "", // Honeypot field
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof NewsletterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.email.trim()) return "Email is required";

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return "Please enter a valid email address";

    // Length validations
    if (formData.name.length > 100) return "Name must be less than 100 characters";

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
      const response = await fetch("/api/marketing/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          name: formData.name.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      setIsSubmitted(true);
      toast({
        title: "Subscribed!",
        description: "Thank you for subscribing to our newsletter. Check your email for confirmation.",
      });

      // Reset form
      setFormData({
        email: "",
        name: "",
        website: "",
      });

    } catch (error) {
      console.error("Error subscribing to newsletter:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline version for footer
  if (inline) {
    return (
      <div className={className}>
        {showTitle && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <MailOpen className="h-4 w-4 mr-2" />
              Newsletter
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Get the latest updates and pricing insights.
            </p>
          </div>
        )}

        {isSubmitted ? (
          <div className="text-center py-2">
            <p className="text-sm text-green-600 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              Subscribed! Check your email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
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

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isSubmitting}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="whitespace-nowrap"
              >
                {isSubmitting ? (
                  <AlertCircle className="h-4 w-4 animate-spin" />
                ) : (
                  "Subscribe"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // Card version for landing page sections
  if (isSubmitted && !compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscribed!</h3>
            <p className="text-gray-600 mb-4">
              Thank you for subscribing to our newsletter. Check your email for confirmation.
            </p>
            <Button
              onClick={() => setIsSubmitted(false)}
              variant="outline"
            >
              Subscribe Another Email
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
            <MailOpen className="h-5 w-5 mr-2" />
            Newsletter
          </CardTitle>
          <CardDescription>
            Stay updated with the latest pricing insights and product updates.
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

          <div className="space-y-2">
            <Label htmlFor="newsletter-email">Email Address *</Label>
            <Input
              id="newsletter-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isSubmitting}
            />
          </div>

          {!compact && (
            <div className="space-y-2">
              <Label htmlFor="newsletter-name">Name (Optional)</Label>
              <Input
                id="newsletter-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Your name"
                disabled={isSubmitting}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                Subscribing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Subscribe to Newsletter
              </>
            )}
          </Button>

          {compact && isSubmitted && (
            <div className="text-center py-2">
              <p className="text-sm text-green-600 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Subscribed! Check your email for confirmation.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
