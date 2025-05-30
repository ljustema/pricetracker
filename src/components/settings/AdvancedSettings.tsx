"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Select components are not used in this file
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Download, Trash2 } from "lucide-react";

// Define the form schemas with Zod
const matchingRulesSchema = z.object({
  ean_priority: z.boolean(),
  sku_brand_fallback: z.boolean(),
  fuzzy_name_matching: z.boolean().optional(),
  min_similarity_score: z.number().min(0).max(100).optional(),
});

const priceThresholdsSchema = z.object({
  significant_increase: z.number().min(0).max(100),
  significant_decrease: z.number().min(0).max(100),
});

const dataCleanupSchema = z.object({
  older_than_days: z.number().min(1).max(365),
  include_products: z.boolean(),
  include_price_changes: z.boolean(),
  include_temp_competitors_scraped_data: z.boolean(),
});

type MatchingRulesValues = z.infer<typeof matchingRulesSchema>;
type PriceThresholdsValues = z.infer<typeof priceThresholdsSchema>;
type DataCleanupValues = z.infer<typeof dataCleanupSchema>;

interface AdvancedSettingsProps {
  userId?: string;
}

export default function AdvancedSettings({ userId }: AdvancedSettingsProps) {
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingThresholds, setIsLoadingThresholds] = useState(false);
  const [isLoadingCleanup, setIsLoadingCleanup] = useState(false);
  const [isLoadingExport, setIsLoadingExport] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  // Initialize the forms with default values
  const matchingRulesForm = useForm<MatchingRulesValues>({
    resolver: zodResolver(matchingRulesSchema),
    defaultValues: {
      ean_priority: true,
      sku_brand_fallback: true,
      fuzzy_name_matching: false,
      min_similarity_score: 70,
    },
  });

  const priceThresholdsForm = useForm<PriceThresholdsValues>({
    resolver: zodResolver(priceThresholdsSchema),
    defaultValues: {
      significant_increase: 10,
      significant_decrease: 5,
    },
  });

  const dataCleanupForm = useForm<DataCleanupValues>({
    resolver: zodResolver(dataCleanupSchema),
    defaultValues: {
      older_than_days: 30,
      include_products: false,
      include_price_changes: true,
      include_temp_competitors_scraped_data: true,
    },
  });

  // Fetch company data with matching rules and price thresholds
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!userId) return;

      try {
        setIsFetching(true);
        const response = await fetch("/api/settings/company");

        if (response.ok) {
          const data = await response.json();

          // Update matching rules form values with fetched data
          if (data.matching_rules) {
            matchingRulesForm.reset({
              ean_priority: data.matching_rules.ean_priority ?? true,
              sku_brand_fallback: data.matching_rules.sku_brand_fallback ?? true,
              fuzzy_name_matching: data.matching_rules.fuzzy_name_matching ?? false,
              min_similarity_score: data.matching_rules.min_similarity_score ?? 70,
            });
          }

          // Update price thresholds form values with fetched data
          if (data.price_thresholds) {
            priceThresholdsForm.reset({
              significant_increase: data.price_thresholds.significant_increase ?? 10,
              significant_decrease: data.price_thresholds.significant_decrease ?? 5,
            });
          }
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
  }, [userId, matchingRulesForm, priceThresholdsForm, toast]);

  const onSubmitMatchingRules = async (data: MatchingRulesValues) => {
    setIsLoadingRules(true);
    try {
      const response = await fetch("/api/settings/matching-rules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update matching rules");
      }

      toast({
        title: "Matching rules updated",
        description: "Your product matching rules have been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating matching rules:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update matching rules",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRules(false);
    }
  };

  const onSubmitPriceThresholds = async (data: PriceThresholdsValues) => {
    setIsLoadingThresholds(true);
    try {
      const response = await fetch("/api/settings/price-thresholds", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update price thresholds");
      }

      toast({
        title: "Price thresholds updated",
        description: "Your price change thresholds have been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating price thresholds:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update price thresholds",
        variant: "destructive",
      });
    } finally {
      setIsLoadingThresholds(false);
    }
  };

  const onSubmitDataCleanup = async (data: DataCleanupValues) => {
    setIsLoadingCleanup(true);
    try {
      const response = await fetch("/api/settings/data-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to perform data cleanup");
      }

      const result = await response.json();

      toast({
        title: "Data cleanup completed",
        description: `Successfully cleaned up ${result.deleted_count} records.`,
      });
    } catch (error) {
      console.error("Error performing data cleanup:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to perform data cleanup",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCleanup(false);
    }
  };

  const handleDataExport = async () => {
    setIsLoadingExport(true);
    try {
      const response = await fetch("/api/settings/data-export", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export data");
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pricetracker-export-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Data export completed",
        description: "Your data has been exported successfully.",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExport(false);
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
          <CardTitle>Product Matching Rules</CardTitle>
          <CardDescription>
            Configure how products are matched across different sources
          </CardDescription>
        </CardHeader>
        <form onSubmit={matchingRulesForm.handleSubmit(onSubmitMatchingRules)}>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ean_priority">EAN Priority</Label>
                <p className="text-sm text-gray-500">
                  Prioritize EAN codes for product matching
                </p>
              </div>
              <Switch
                id="ean_priority"
                checked={matchingRulesForm.watch("ean_priority")}
                onCheckedChange={(checked) =>
                  matchingRulesForm.setValue("ean_priority", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sku_brand_fallback">SKU + Brand Fallback</Label>
                <p className="text-sm text-gray-500">
                  Use SKU and brand name as fallback when EAN is not available
                </p>
              </div>
              <Switch
                id="sku_brand_fallback"
                checked={matchingRulesForm.watch("sku_brand_fallback")}
                onCheckedChange={(checked) =>
                  matchingRulesForm.setValue("sku_brand_fallback", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="fuzzy_name_matching">Fuzzy Name Matching</Label>
                <p className="text-sm text-gray-500">
                  Use fuzzy matching for product names when other identifiers are not available
                </p>
              </div>
              <Switch
                id="fuzzy_name_matching"
                checked={matchingRulesForm.watch("fuzzy_name_matching")}
                onCheckedChange={(checked) =>
                  matchingRulesForm.setValue("fuzzy_name_matching", checked)
                }
              />
            </div>
            {matchingRulesForm.watch("fuzzy_name_matching") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="min_similarity_score">Minimum Similarity Score</Label>
                  <span className="text-sm font-medium">
                    {matchingRulesForm.watch("min_similarity_score")}%
                  </span>
                </div>
                <Slider
                  id="min_similarity_score"
                  min={50}
                  max={100}
                  step={1}
                  value={[matchingRulesForm.watch("min_similarity_score") || 70]}
                  onValueChange={(value) =>
                    matchingRulesForm.setValue("min_similarity_score", value[0])
                  }
                />
                <p className="text-xs text-gray-500">
                  Higher values require closer matches but may miss some products
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoadingRules}>
              {isLoadingRules && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Matching Rules
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price Change Thresholds</CardTitle>
          <CardDescription>
            Define what constitutes a significant price change
          </CardDescription>
        </CardHeader>
        <form onSubmit={priceThresholdsForm.handleSubmit(onSubmitPriceThresholds)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="significant_increase">Significant Price Increase</Label>
                <span className="text-sm font-medium">
                  {priceThresholdsForm.watch("significant_increase")}%
                </span>
              </div>
              <Slider
                id="significant_increase"
                min={1}
                max={50}
                step={1}
                value={[priceThresholdsForm.watch("significant_increase")]}
                onValueChange={(value) =>
                  priceThresholdsForm.setValue("significant_increase", value[0])
                }
              />
              <p className="text-xs text-gray-500">
                Price increases above this percentage will be highlighted
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="significant_decrease">Significant Price Decrease</Label>
                <span className="text-sm font-medium">
                  {priceThresholdsForm.watch("significant_decrease")}%
                </span>
              </div>
              <Slider
                id="significant_decrease"
                min={1}
                max={50}
                step={1}
                value={[priceThresholdsForm.watch("significant_decrease")]}
                onValueChange={(value) =>
                  priceThresholdsForm.setValue("significant_decrease", value[0])
                }
              />
              <p className="text-xs text-gray-500">
                Price decreases above this percentage will be highlighted
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoadingThresholds}>
              {isLoadingThresholds && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Price Thresholds
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Cleanup</CardTitle>
          <CardDescription>
            Remove old data to free up space and improve performance
          </CardDescription>
        </CardHeader>
        <form onSubmit={dataCleanupForm.handleSubmit(onSubmitDataCleanup)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="older_than_days">Remove Data Older Than</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="older_than_days"
                  type="number"
                  min={1}
                  max={365}
                  {...dataCleanupForm.register("older_than_days", { valueAsNumber: true })}
                />
                <span className="text-sm font-medium">days</span>
              </div>
              {dataCleanupForm.formState.errors.older_than_days && (
                <p className="text-sm text-red-500">
                  {dataCleanupForm.formState.errors.older_than_days.message}
                </p>
              )}
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include_products">Include Products</Label>
                  <p className="text-sm text-red-500">
                    Warning: This will permanently delete products
                  </p>
                </div>
                <Switch
                  id="include_products"
                  checked={dataCleanupForm.watch("include_products")}
                  onCheckedChange={(checked) =>
                    dataCleanupForm.setValue("include_products", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include_price_changes">Include Price Changes</Label>
                  <p className="text-sm text-gray-500">
                    Remove historical price change records
                  </p>
                </div>
                <Switch
                  id="include_price_changes"
                  checked={dataCleanupForm.watch("include_price_changes")}
                  onCheckedChange={(checked) =>
                    dataCleanupForm.setValue("include_price_changes", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include_temp_competitors_scraped_data">Include Temp Competitors Scraped Data</Label>
                  <p className="text-sm text-gray-500">
                    Remove historical competitor scraped data
                  </p>
                </div>
                <Switch
                  id="include_temp_competitors_scraped_data"
                  checked={dataCleanupForm.watch("include_temp_competitors_scraped_data")}
                  onCheckedChange={(checked) =>
                    dataCleanupForm.setValue("include_temp_competitors_scraped_data", checked)
                  }
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clean Up Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete data
                    older than {dataCleanupForm.watch("older_than_days")} days
                    {dataCleanupForm.watch("include_products") && ", including products"}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => dataCleanupForm.handleSubmit(onSubmitDataCleanup)()}
                    disabled={isLoadingCleanup}
                  >
                    {isLoadingCleanup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, Clean Up Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>
            Export your data for backup or analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            This will export all your data in a GDPR-compliant format, including products,
            competitors, price changes, and settings.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleDataExport}
            disabled={isLoadingExport}
          >
            {isLoadingExport ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export Data
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
