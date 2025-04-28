"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

// Define the form schema with Zod
const companyFormSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").optional(),
  address: z.string().optional(),
  org_number: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

interface CompanySettingsProps {
  userId?: string;
}

export default function CompanySettings({ userId }: CompanySettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  // Initialize the form with default values
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      address: "",
      org_number: "",
    },
  });

  // Fetch company data
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!userId) return;

      try {
        setIsFetching(true);
        const response = await fetch("/api/settings/company");

        if (response.ok) {
          const data = await response.json();

          // Update form values with fetched data
          form.reset({
            name: data.name || "",
            address: data.address || "",
            org_number: data.org_number || "",
          });
        } else if (response.status !== 404) {
          // Only show error if it's not a "not found" error
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch company data");
        }
      } catch (error) {
        console.error("Error fetching company data:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch company data",
          variant: "destructive",
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchCompanyData();
  }, [userId, form, toast]);

  const onSubmit = async (data: CompanyFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update company settings");
      }

      toast({
        title: "Company settings updated",
        description: "Your company settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating company settings:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update company settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Update your company details for invoices and reports
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                placeholder="Your company name"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Company address"
                {...form.register("address")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_number">Organization Number</Label>
              <Input
                id="org_number"
                placeholder="Organization/VAT number"
                {...form.register("org_number")}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Company Info
            </Button>
          </CardFooter>
        </form>
      </Card>


    </div>
  );
}
