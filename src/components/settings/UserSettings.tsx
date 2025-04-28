"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

// Define the form schema with Zod
const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional(),
  image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  language: z.string().optional(),
  timezone: z.string().optional(),
  primary_currency: z.string().length(3, "Currency code must be 3 characters").optional(),
  secondary_currencies: z.array(z.string().length(3)).optional(),
  currency_format: z.string().optional(),
  notification_preferences: z.object({
    email_summary: z.enum(["never", "daily", "weekly", "monthly"]).optional(),
    web_price_change: z.boolean().optional(),
    email_price_change: z.boolean().optional(),
  }).optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface UserSettingsProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    language?: string;
    timezone?: string;
    primary_currency?: string;
    secondary_currencies?: string[];
    currency_format?: string;
    notification_preferences?: {
      email_summary?: "never" | "daily" | "weekly" | "monthly";
      web_price_change?: boolean;
      email_price_change?: boolean;
    };
  };
}

export default function UserSettings({ user }: UserSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Initialize the form with user data
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      image: user?.image || "",
      language: user?.language || "en",
      timezone: user?.timezone || "Europe/Stockholm",
      primary_currency: user?.primary_currency || "SEK",
      secondary_currencies: user?.secondary_currencies || [],
      currency_format: user?.currency_format || "#,##0.00",
      notification_preferences: {
        email_summary: "weekly",
        web_price_change: true,
        email_price_change: false,
      },
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          // Ensure currency settings are included
          primary_currency: data.primary_currency,
          secondary_currencies: data.secondary_currencies,
          currency_format: data.currency_format,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and how others see you on the platform
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Your email"
                  disabled
                  {...form.register("email")}
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Profile Picture URL</Label>
              <Input
                id="image"
                placeholder="https://example.com/your-image.jpg"
                {...form.register("image")}
              />
              {form.formState.errors.image && (
                <p className="text-sm text-red-500">{form.formState.errors.image.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Security</CardTitle>
          <CardDescription>
            Manage your password and two-factor authentication settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex items-center gap-2">
              <Input
                id="password"
                type="password"
                value="••••••••••••"
                disabled
              />
              <Button variant="outline">Change Password</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="2fa">Two-Factor Authentication</Label>
            <div className="flex items-center gap-2">
              <Switch id="2fa" disabled />
              <span className="text-sm text-gray-500">Coming soon</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language, Region & Currency</CardTitle>
          <CardDescription>
            Set your preferred language, timezone, and currency settings
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  onValueChange={(value) => form.setValue("language", value)}
                  defaultValue={form.getValues("language")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="sv">Swedish</SelectItem>
                    <SelectItem value="no">Norwegian</SelectItem>
                    <SelectItem value="da">Danish</SelectItem>
                    <SelectItem value="fi">Finnish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  onValueChange={(value) => form.setValue("timezone", value)}
                  defaultValue={form.getValues("timezone")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Stockholm">Stockholm (GMT+1)</SelectItem>
                    <SelectItem value="Europe/Oslo">Oslo (GMT+1)</SelectItem>
                    <SelectItem value="Europe/Copenhagen">Copenhagen (GMT+1)</SelectItem>
                    <SelectItem value="Europe/Helsinki">Helsinki (GMT+2)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium mb-3">Currency Settings</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primary_currency">Primary Currency</Label>
                  <Select
                    onValueChange={(value) => form.setValue("primary_currency", value)}
                    defaultValue={form.getValues("primary_currency")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEK">Swedish Krona (SEK)</SelectItem>
                      <SelectItem value="NOK">Norwegian Krone (NOK)</SelectItem>
                      <SelectItem value="DKK">Danish Krone (DKK)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency_format">Currency Format</Label>
                  <Select
                    onValueChange={(value) => form.setValue("currency_format", value)}
                    defaultValue={form.getValues("currency_format")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#,##0.00">1,234.56</SelectItem>
                      <SelectItem value="#.##0,00">1.234,56</SelectItem>
                      <SelectItem value="# ##0.00">1 234.56</SelectItem>
                      <SelectItem value="# ##0,00">1 234,56</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Preferences
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Control how and when you receive notifications
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email_summary">Email Summary</Label>
              <Select
                onValueChange={(value: "never" | "daily" | "weekly" | "monthly") =>
                  form.setValue("notification_preferences.email_summary", value)
                }
                defaultValue={form.getValues("notification_preferences.email_summary") || "weekly"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="web_price_change">Web Price Change Alerts</Label>
              <Switch
                id="web_price_change"
                checked={form.getValues("notification_preferences.web_price_change")}
                onCheckedChange={(checked) =>
                  form.setValue("notification_preferences.web_price_change", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email_price_change">Email Price Change Alerts</Label>
              <Switch
                id="email_price_change"
                checked={form.getValues("notification_preferences.email_price_change")}
                onCheckedChange={(checked) =>
                  form.setValue("notification_preferences.email_price_change", checked)
                }
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Notifications
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
