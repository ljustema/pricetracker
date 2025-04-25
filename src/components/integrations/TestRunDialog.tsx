'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Integration } from '@/lib/services/integration-service';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';

interface TestRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: Integration | null;
  onStartFullSync?: (integration: Integration) => void;
}

interface TestProduct {
  id: string;
  name: string;
  price: number;
  wholesale_price?: number;
  reference: string;
  ean13: string;
  manufacturer_name: string;
  image_url: string;
  link_rewrite?: string;
  description?: string;
  quantity?: number;
  active?: boolean;
}

interface TestRunResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  products: TestProduct[];
  error?: string;
}

export function TestRunDialog({ open, onOpenChange, integration, onStartFullSync }: TestRunDialogProps) {
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [testRunResult, setTestRunResult] = useState<TestRunResult | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [dataApproved, setDataApproved] = useState<boolean>(false);
  const { toast } = useToast();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTestRunId(null);
      setTestRunResult(null);
      setLoading(false);
      setPolling(false);
      setDataApproved(false);
    }
  }, [open]);

  // Start polling for test run results when testRunId is set
  useEffect(() => {
    if (!testRunId) return;

    const pollInterval = setInterval(async () => {
      try {
        setPolling(true);
        const response = await fetch(`/api/integrations/test-run/${testRunId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch test run status');
        }

        const data = await response.json();

        if (data.status === 'completed' || data.status === 'failed') {
          setTestRunResult({
            id: data.id,
            status: data.status,
            products: data.products || [],
            error: data.error_message,
          });
          clearInterval(pollInterval);
          setPolling(false);
        }
      } catch (error) {
        console.error('Error polling test run status:', error);
        // Don't clear the interval on error, keep trying
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [testRunId]);

  // Start a test run
  const startTestRun = async (activeOnly: boolean) => {
    if (!integration) return;

    try {
      setLoading(true);
      setTestRunResult(null);

      const response = await fetch(`/api/integrations/${integration.id}/test-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activeOnly
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start test run');
      }

      const result = await response.json();
      setTestRunId(result.run.id);

      toast({
        title: 'Test run started',
        description: 'Fetching sample products from your store...',
      });
    } catch (error) {
      toast({
        title: 'Test run failed',
        description: error instanceof Error ? error.message : 'Failed to start test run',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Start a full sync
  const handleStartFullSync = async () => {
    if (!integration || !onStartFullSync) return;

    try {
      // Update the integration status to 'active' after successful test run and approval
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'active',
          last_sync_status: 'test_approved'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update integration status');
      }

      // Start the full sync
      onStartFullSync(integration);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update integration status',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Integration</DialogTitle>
          <DialogDescription>
            Test your integration by fetching a sample of products from your store.
          </DialogDescription>
        </DialogHeader>

        {!testRunResult ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium mb-2">Why run a test?</h3>
              <p className="text-sm text-gray-600 mb-2">
                A test run will fetch 10 random active products from your store to verify that:
              </p>
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                <li>Your API credentials are working correctly</li>
                <li>Product data is being retrieved properly</li>
                <li>Fields like name, price, and SKU are mapped correctly</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active-only"
                  checked={activeOnly}
                  onCheckedChange={(checked: boolean) => setActiveOnly(checked)}
                />
                <label
                  htmlFor="active-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Only import active products
                </label>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => startTestRun(activeOnly)}
                  disabled={loading || polling}
                  className="w-full max-w-xs"
                >
                  {loading || polling ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {loading ? 'Starting Test Run...' : 'Fetching Products...'}
                    </>
                  ) : (
                    'Start Test Run'
                  )}
                </Button>
              </div>
            </div>

            {(loading || polling) && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {testRunResult.status === 'failed' ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800">Test Run Failed</h3>
                  <p className="text-sm text-red-700 mt-1">{testRunResult.error || 'An unknown error occurred'}</p>
                </div>
              </div>
            ) : testRunResult.products.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">No Products Found</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    The test run completed successfully, but no products were found in your store.
                    {activeOnly ? (
                      <>
                        <br />
                        <strong>You have selected to only import active products.</strong> Try unchecking this option if you want to import all products.
                        <br />
                      </>
                    ) : null}
                    Please check that your store has {activeOnly ? 'active ' : ''}products and that they are accessible via the API.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-green-800">Test Run Successful</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Successfully fetched {testRunResult.products.length} random {activeOnly ? 'active ' : ''}products from your store.
                      Please review the data below to ensure it looks correct before proceeding with a full sync.
                    </p>
                  </div>
                </div>

                <div className="w-full">
                  <div className="flex justify-end mb-4">
                    <div className="inline-flex rounded-md border">
                      <Button
                        variant="outline"
                        size="sm"
                        className={viewMode === 'table' ? 'bg-muted' : ''}
                        onClick={() => setViewMode('table')}
                      >
                        Table View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={viewMode === 'cards' ? 'bg-muted' : ''}
                        onClick={() => setViewMode('cards')}
                      >
                        Card View
                      </Button>
                    </div>
                  </div>

                  {viewMode === 'table' ? (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Image</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Wholesale</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>EAN</TableHead>
                            <TableHead>Brand</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testRunResult.products.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell>
                                {product.image_url && (
                                  <>
                                    <div className="relative w-12 h-12">
                                      <Image
                                        src={`/api/proxy-image?url=${encodeURIComponent(product.image_url)}`}
                                        alt={product.name}
                                        fill
                                        className="object-contain"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                          console.error(`Failed to load image: ${product.image_url}`);
                                          // Hide the entire image container
                                          const container = e.currentTarget.closest('.relative');
                                          if (container) {
                                            (container as HTMLElement).style.display = 'none';
                                          }
                                        }}
                                        unoptimized // Skip Next.js image optimization for external images
                                      />
                                    </div>

                                  </>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{product.price ? product.price.toFixed(2) : '-'}</TableCell>
                              <TableCell>{product.wholesale_price ? product.wholesale_price.toFixed(2) : '-'}</TableCell>
                              <TableCell>{product.reference || '-'}</TableCell>
                              <TableCell>{product.ean13 || '-'}</TableCell>
                              <TableCell>{product.manufacturer_name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {testRunResult.products.map((product) => (
                        <div key={product.id} className="border rounded-md p-4 flex">
                          {product.image_url && (
                            <div className="flex flex-col items-center mr-4">
                              <div className="relative w-16 h-16">
                                <Image
                                  src={`/api/proxy-image?url=${encodeURIComponent(product.image_url)}`}
                                  alt={product.name}
                                  fill
                                  className="object-contain"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    console.error(`Failed to load image: ${product.image_url}`);
                                    // Hide the entire image container
                                    const container = e.currentTarget.closest('.relative');
                                    if (container) {
                                      (container as HTMLElement).style.display = 'none';
                                    }
                                  }}
                                  unoptimized // Skip Next.js image optimization for external images
                                />
                              </div>

                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">{product.name}</h3>
                            <p className="text-sm text-gray-500">Price: ${product.price ? product.price.toFixed(2) : '0.00'}</p>
                            <p className="text-sm text-gray-500">Wholesale: ${product.wholesale_price ? product.wholesale_price.toFixed(2) : '-'}</p>
                            <p className="text-sm text-gray-500">
                              {product.reference ? `SKU: ${product.reference}` : ''}
                              {product.reference && product.ean13 ? ' | ' : ''}
                              {product.ean13 ? `EAN: ${product.ean13}` : ''}
                            </p>
                            {product.manufacturer_name && (
                              <p className="text-sm text-gray-500">Brand: {product.manufacturer_name}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTestRunResult(null);
                  setTestRunId(null);
                }}
              >
                Run Another Test
              </Button>

              {testRunResult.status === 'completed' && testRunResult.products.length > 0 && (
                <div className="flex flex-col space-y-2 items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="approve-data"
                      checked={dataApproved}
                      onCheckedChange={(checked: boolean) => setDataApproved(checked)}
                    />
                    <label
                      htmlFor="approve-data"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I approve this data for import
                    </label>
                  </div>
                  <Button
                    type="button"
                    onClick={handleStartFullSync}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!dataApproved}
                  >
                    {!dataApproved ? "Approve data to continue" : "Proceed with Full Sync"}
                  </Button>
                </div>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
