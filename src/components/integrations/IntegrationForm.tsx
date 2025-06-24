'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Integration } from '@/lib/services/integration-service';
import { useToast } from '@/components/ui/use-toast';

// Define the form schema with Zod - conditional validation based on platform
const formSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  name: z.string().min(1, 'Name is required'),
  api_url: z.string().optional(),
  api_key: z.string().optional(),
  sync_frequency: z.string().optional(),
  is_active: z.boolean().optional(),
  configuration: z.object({
    activeOnly: z.boolean().optional(),
    selectiveImport: z.object({
      enabled: z.boolean().optional(),
      fields: z.object({
        name: z.boolean().optional(),
        sku: z.boolean().optional(),
        ean: z.boolean().optional(),
        brand: z.boolean().optional(),
        image_url: z.boolean().optional(),
        currency_code: z.boolean().optional(),
        url: z.boolean().optional(),
        our_retail_price: z.boolean().optional(),
        our_wholesale_price: z.boolean().optional(),
        stock_status: z.boolean().optional(),
        availability_date: z.boolean().optional(),
        raw_data: z.boolean().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
}).refine((data) => {
  // For non-manual platforms, require API credentials
  if (data.platform !== 'manual') {
    // Google Feed XML only requires URL, not API key
    if (data.platform === 'google-feed') {
      return data.api_url;
    }
    // Other platforms require both URL and API key
    return data.api_url && data.api_key;
  }
  return true;
}, {
  message: "API URL is required for automated integrations",
  path: ["api_url"],
});

type FormValues = z.infer<typeof formSchema>;

interface IntegrationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration?: Integration;
  onSubmit: (values: FormValues) => Promise<void>;
}

export function IntegrationForm({ open, onOpenChange, integration, onSubmit }: IntegrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();
  const isEditing = !!integration;

  // Initialize the form with default values or existing integration values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: integration?.platform || 'prestashop',
      name: integration?.name || '',
      api_url: integration?.api_url || '',
      api_key: integration?.api_key || '',
      sync_frequency: integration?.sync_frequency || 'daily',
      is_active: integration?.is_active !== false, // Default to true
      configuration: {
        activeOnly: integration?.configuration?.activeOnly !== false, // Default to true
        selectiveImport: {
          enabled: integration?.configuration?.selectiveImport?.enabled || false,
          fields: {
            name: integration?.configuration?.selectiveImport?.fields?.name !== false,
            sku: integration?.configuration?.selectiveImport?.fields?.sku !== false,
            ean: integration?.configuration?.selectiveImport?.fields?.ean !== false,
            brand: integration?.configuration?.selectiveImport?.fields?.brand !== false,
            image_url: integration?.configuration?.selectiveImport?.fields?.image_url !== false,
            currency_code: integration?.configuration?.selectiveImport?.fields?.currency_code !== false,
            url: integration?.configuration?.selectiveImport?.fields?.url !== false,
            our_retail_price: integration?.configuration?.selectiveImport?.fields?.our_retail_price !== false,
            our_wholesale_price: integration?.configuration?.selectiveImport?.fields?.our_wholesale_price !== false,
            stock_status: integration?.configuration?.selectiveImport?.fields?.stock_status !== false,
            availability_date: integration?.configuration?.selectiveImport?.fields?.availability_date !== false,
            raw_data: integration?.configuration?.selectiveImport?.fields?.raw_data !== false,
          },
        },
      },
    },
  });

  // Watch the platform field to conditionally show/hide API fields
  const selectedPlatform = form.watch('platform');
  const apiUrl = form.watch('api_url');
  const apiKey = form.watch('api_key');

  // Update form values when integration changes
  useEffect(() => {
    if (integration) {
      form.reset({
        platform: integration.platform,
        name: integration.name,
        api_url: integration.api_url,
        api_key: integration.api_key,
        sync_frequency: integration.sync_frequency,
        is_active: integration.is_active !== false, // Default to true
        configuration: {
          activeOnly: integration.configuration?.activeOnly !== false, // Default to true
          selectiveImport: {
            enabled: integration.configuration?.selectiveImport?.enabled || false,
            fields: {
              name: integration.configuration?.selectiveImport?.fields?.name !== false,
              sku: integration.configuration?.selectiveImport?.fields?.sku !== false,
              ean: integration.configuration?.selectiveImport?.fields?.ean !== false,
              brand: integration.configuration?.selectiveImport?.fields?.brand !== false,
              image_url: integration.configuration?.selectiveImport?.fields?.image_url !== false,
              currency_code: integration.configuration?.selectiveImport?.fields?.currency_code !== false,
              url: integration.configuration?.selectiveImport?.fields?.url !== false,
              our_retail_price: integration.configuration?.selectiveImport?.fields?.our_retail_price !== false,
              our_wholesale_price: integration.configuration?.selectiveImport?.fields?.our_wholesale_price !== false,
              stock_status: integration.configuration?.selectiveImport?.fields?.stock_status !== false,
              availability_date: integration.configuration?.selectiveImport?.fields?.availability_date !== false,
              raw_data: integration.configuration?.selectiveImport?.fields?.raw_data !== false,
            },
          },
        },
      });
    }
  }, [integration, form]);

  // Reset test result when API URL or key changes
  useEffect(() => {
    setTestResult(null);
  }, [apiUrl, apiKey]);

  // Test API credentials
  const testCredentials = async () => {
    const platform = form.getValues('platform');
    const api_url = form.getValues('api_url');
    const api_key = form.getValues('api_key');

    // Validate fields before testing
    if (!platform || !api_url) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in the URL field before testing.',
        variant: 'destructive',
      });
      return;
    }

    // For non-Google Feed platforms, also require API key
    if (platform !== 'google-feed' && !api_key) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields before testing.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/integrations/test-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform, api_url, api_key }),
      });

      if (!response.ok) {
        throw new Error('Failed to test credentials');
      }

      const result = await response.json();
      setTestResult(result);

      toast({
        title: result.success ? 'Connection Successful' : 'Connection Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'An error occurred while testing the connection',
        variant: 'destructive',
      });
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
      toast({
        title: isEditing ? 'Integration updated' : 'Integration created',
        description: isEditing
          ? `${values.name} has been updated successfully.`
          : `${values.name} has been added successfully.`,
      });
    } catch (error) {
      toast({
        title: isEditing ? 'Failed to update integration' : 'Failed to create integration',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Integration' : 'Add Integration'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your e-commerce platform integration settings.'
              : 'Connect your e-commerce platform to automatically sync product data.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select
                    disabled={isEditing} // Can't change platform when editing
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="prestashop">PrestaShop</SelectItem>
                      <SelectItem value="google-feed">Google Feed XML</SelectItem>
                      <SelectItem value="manual">Manual (CSV Upload)</SelectItem>
                      {/* Add more platforms as they are supported */}
                      {/* <SelectItem value="shopify">Shopify</SelectItem> */}
                      {/* <SelectItem value="woocommerce">WooCommerce</SelectItem> */}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The e-commerce platform you want to integrate with.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Store" {...field} />
                  </FormControl>
                  <FormDescription>
                    A friendly name to identify this integration.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value !== false} // Default to true if undefined
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Active
                    </FormLabel>
                    <FormDescription>
                      When checked, this integration will run automatically according to the sync frequency. Uncheck to keep the integration configured but prevent it from running.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Only show API fields for non-manual platforms */}
            {selectedPlatform !== 'manual' && (
              <>
                <FormField
                  control={form.control}
                  name="api_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {selectedPlatform === 'google-feed' ? 'Feed URL' : 'API URL'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            selectedPlatform === 'google-feed'
                              ? "https://example.com/feed.xml"
                              : "https://mystore.com"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {selectedPlatform === 'google-feed'
                          ? 'The URL to your Google Shopping Feed XML file.'
                          : 'The base URL of your store (e.g., https://mystore.com).'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Only show API key for platforms that need authentication */}
                {selectedPlatform !== 'google-feed' && (
                  <FormField
                    control={form.control}
                    name="api_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <div className="flex space-x-2">
                          <FormControl className="flex-1">
                            <Input type="password" placeholder="••••••••••••••••" {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={testCredentials}
                            disabled={isTesting}
                            className="whitespace-nowrap"
                          >
                            {isTesting ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              'Test Connection'
                            )}
                          </Button>
                        </div>
                        {testResult && (
                          <div className={`mt-2 text-sm flex items-center ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.success ? (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            ) : (
                              <AlertCircle className="h-4 w-4 mr-1" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                        <FormDescription>
                          Your API key or access token for authentication.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Show test feed button for Google Feed XML */}
                {selectedPlatform === 'google-feed' && (
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testCredentials}
                      disabled={isTesting || !form.watch('api_url')}
                      className="whitespace-nowrap"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Feed'
                      )}
                    </Button>
                    {testResult && (
                      <div className={`mt-2 text-sm flex items-center ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        ) : (
                          <AlertCircle className="h-4 w-4 mr-1" />
                        )}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Show description for manual integrations */}
            {selectedPlatform === 'manual' && (
              <div className="rounded-md border p-4 bg-blue-50">
                <h4 className="font-medium text-blue-900 mb-2">Manual Integration</h4>
                <p className="text-sm text-blue-700">
                  This integration allows you to upload your own products via CSV files.
                  No API credentials are required. You can upload product data and track
                  price changes manually through the CSV upload feature.
                </p>
              </div>
            )}

            {/* Show description for Google Feed XML integrations */}
            {selectedPlatform === 'google-feed' && (
              <div className="rounded-md border p-4 bg-green-50">
                <h4 className="font-medium text-green-900 mb-2">Google Feed XML Integration</h4>
                <p className="text-sm text-green-700">
                  This integration automatically fetches product data from your Google Shopping Feed XML.
                  It's faster than API-based integrations and perfect for stores with Google Merchant Center feeds.
                  The system will parse product information including prices, brands, SKUs, and images from your XML feed.
                </p>
              </div>
            )}

            {/* Only show sync frequency for non-manual platforms */}
            {selectedPlatform !== 'manual' && (
              <>
                <FormField
                  control={form.control}
                  name="sync_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sync Frequency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How often to automatically sync data (manual sync is always available).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="configuration.activeOnly"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value !== false} // Default to true if undefined
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Only import active products
                        </FormLabel>
                        <FormDescription>
                          When checked, only products marked as active in your store will be imported.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />



                {/* Selective Import Configuration */}
                <FormField
                  control={form.control}
                  name="configuration.selectiveImport.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Enable selective field import
                        </FormLabel>
                        <FormDescription>
                          When enabled, you can choose which specific fields to import from this integration. This is useful when combining data from multiple integrations.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Show field selection checkboxes when selective import is enabled */}
                {form.watch('configuration.selectiveImport.enabled') && (
                  <div className="rounded-md border p-3 space-y-2">
                    <h4 className="font-medium text-sm">Select fields to import:</h4>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {[
                        { name: 'name', label: 'Product Name', description: 'Product title/name' },
                        { name: 'sku', label: 'SKU', description: 'Stock Keeping Unit' },
                        { name: 'ean', label: 'EAN', description: 'European Article Number' },
                        { name: 'brand', label: 'Brand', description: 'Product brand/manufacturer' },
                        { name: 'image_url', label: 'Image URL', description: 'Product image URL' },
                        { name: 'currency_code', label: 'Currency', description: 'Currency code (SEK, EUR, etc.)' },
                        { name: 'url', label: 'Product URL', description: 'Link to product page' },
                        { name: 'our_retail_price', label: 'Retail Price', description: 'Our retail selling price' },
                        { name: 'our_wholesale_price', label: 'Wholesale Price', description: 'Our wholesale/cost price' },
                        { name: 'stock_status', label: 'Stock Status', description: 'Stock availability status' },
                        { name: 'availability_date', label: 'Availability Date', description: 'When product becomes available' },
                        { name: 'raw_data', label: 'Raw Data', description: 'All custom fields and specifications' },
                      ].map((fieldConfig) => (
                        <FormField
                          key={fieldConfig.name}
                          control={form.control}
                          name={`configuration.selectiveImport.fields.${fieldConfig.name}` as keyof FormValues}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-2 space-y-0 py-1">
                              <FormControl>
                                <Checkbox
                                  checked={Boolean(field.value)}
                                  onCheckedChange={field.onChange}
                                  className="mt-0.5"
                                />
                              </FormControl>
                              <div className="space-y-0 leading-tight">
                                <FormLabel className="text-xs font-medium cursor-pointer">
                                  {fieldConfig.label}
                                </FormLabel>
                                <FormDescription className="text-xs text-muted-foreground">
                                  {fieldConfig.description}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <DialogFooter className="sticky bottom-0 bg-white border-t pt-4 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditing ? 'Updating...' : 'Creating...'
                  : isEditing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
