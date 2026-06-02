'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Merge, Loader2 } from 'lucide-react';
import { Integration } from '@/lib/services/integration-service';

interface MergePriceChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrations: Integration[];
  onMergeComplete?: () => void;
}

export function MergePriceChangesDialog({
  open,
  onOpenChange,
  integrations,
  onMergeComplete,
}: MergePriceChangesDialogProps) {
  const [sourceIntegration, setSourceIntegration] = useState<string>('');
  const [targetIntegration, setTargetIntegration] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (!sourceIntegration || !targetIntegration) {
      toast({
        title: 'Validation Error',
        description: 'Please select both source and target integrations.',
        variant: 'destructive',
      });
      return;
    }

    if (sourceIntegration === targetIntegration) {
      toast({
        title: 'Validation Error',
        description: 'Source and target integrations must be different.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/integrations/merge-price-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceIntegrationName: sourceIntegration,
          targetIntegrationName: targetIntegration,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to merge price changes');
      }

      const result = await response.json();

      toast({
        title: 'Merge Successful',
        description: `Merged ${result.result.merged_competitor_price_changes} competitor price changes and ${result.result.merged_supplier_price_changes} supplier price changes. Updated ${result.result.updated_products} products.`,
      });

      // Reset form
      setSourceIntegration('');
      setTargetIntegration('');
      onOpenChange(false);

      // Call completion callback
      if (onMergeComplete) {
        onMergeComplete();
      }
    } catch (error) {
      toast({
        title: 'Merge Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Price Changes
          </DialogTitle>
          <DialogDescription>
            Merge price changes from one integration into another. This is useful when you have
            multiple integrations for the same data source and want to consolidate the price history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Source Integration</label>
            <Select value={sourceIntegration} onValueChange={setSourceIntegration}>
              <SelectTrigger>
                <SelectValue placeholder="Select source integration" />
              </SelectTrigger>
              <SelectContent>
                {integrations.map((integration) => (
                  <SelectItem key={integration.id} value={integration.name}>
                    {integration.name} ({integration.platform})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Price changes will be moved FROM this integration
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Target Integration</label>
            <Select value={targetIntegration} onValueChange={setTargetIntegration}>
              <SelectTrigger>
                <SelectValue placeholder="Select target integration" />
              </SelectTrigger>
              <SelectContent>
                {integrations.map((integration) => (
                  <SelectItem key={integration.id} value={integration.name}>
                    {integration.name} ({integration.platform})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Price changes will be moved TO this integration
            </p>
          </div>

          <div className="rounded-md border p-3 bg-yellow-50">
            <h4 className="font-medium text-yellow-900 text-sm mb-1">Warning</h4>
            <p className="text-xs text-yellow-700">
              This operation will permanently move all price change records from the source
              integration to the target integration. This action cannot be undone.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="h-4 w-4 mr-2" />
                Merge Price Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
