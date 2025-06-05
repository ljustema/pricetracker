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
  configuration: z.object({
    activeOnly: z.boolean().optional(),
  }).optional(),
}).refine((data) => {
  // For non-manual platforms, require API credentials
  if (data.platform !== 'manual') {
    return data.api_url && data.api_key;
  }
  return true;
}, {
  message: "API URL and API Key are required for automated integrations",
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

  // Watch the platform field to conditionally show/hide API fields
  const selectedPlatform = form.watch('platform');

  // Initialize the form with default values or existing integration values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: integration?.platform || 'prestashop',
      name: integration?.name || '',
      api_url: integration?.api_url || '',
      api_key: integration?.api_key || '',
      sync_frequency: integration?.sync_frequency || 'daily',
      configuration: {
        activeOnly: integration?.configuration?.activeOnly !== false, // Default to true
      },
    },
  });

  // Update form values when integration changes
  useEffect(() => {
    if (integration) {
      form.reset({
        platform: integration.platform,
        name: integration.name,
        api_url: integration.api_url,
        api_key: integration.api_key,
        sync_frequency: integration.sync_frequency,
        configuration: {
          activeOnly: integration.configuration?.activeOnly !== false, // Default to true
        },
      });
    }
  }, [integration, form]);

  // Reset test result when API URL or key changes
  useEffect(() => {
    setTestResult(null);
  }, [form.watch('api_url'), form.watch('api_key')]);

  // Test API credentials
  const testCredentials = async () => {
    const platform = form.getValues('platform');
    const api_url = form.getValues('api_url');
    const api_key = form.getValues('api_key');

    // Validate fields before testing
    if (!platform || !api_url || !api_key) {
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
      <DialogContent className="sm:max-w-[500px]">
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

            {/* Only show API fields for non-manual platforms */}
            {selectedPlatform !== 'manual' && (
              <>
                <FormField
                  control={form.control}
                  name="api_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://mystore.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        The base URL of your store (e.g., https://mystore.com).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </>
            )}

            <DialogFooter>
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
