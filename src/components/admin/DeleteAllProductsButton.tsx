'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteAllProductsButtonProps {
  userId: string;
  userName: string;
}

export function DeleteAllProductsButton({ userId, userName }: DeleteAllProductsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmationText !== 'DELETE ALL PRODUCTS') {
      toast.error('Please type "DELETE ALL PRODUCTS" to confirm');
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/admin/delete-all-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          confirmed: true,
          confirmationText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete products');
      }

      toast.success('All products and related data have been successfully deleted');
      setIsOpen(false);
      setConfirmationText('');
      
      // Refresh the page to update any displayed data
      window.location.reload();
    } catch (error) {
      console.error('Error deleting products:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete products');
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmationValid = confirmationText === 'DELETE ALL PRODUCTS';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="flex items-center">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete All Products
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Delete All Products
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete ALL products and related data for user: <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Warning: This action cannot be undone!</AlertTitle>
          <AlertDescription className="text-red-700">
            This will delete:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>All products</li>
              <li>All price change history</li>
              <li>All stock change history</li>
              <li>All custom field values</li>
              <li>All unused brands</li>
              <li>All temp scraped data</li>
            </ul>
            <br />
            <strong>This will NOT delete:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>User settings</li>
              <li>Competitors</li>
              <li>Suppliers</li>
              <li>Integrations</li>
              <li>Scrapers</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="confirmation" className="text-sm font-medium">
              Type <code className="bg-gray-100 px-1 py-0.5 rounded text-red-600 font-mono">DELETE ALL PRODUCTS</code> to confirm:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE ALL PRODUCTS"
              className="mt-1"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsOpen(false);
              setConfirmationText('');
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmationValid || isDeleting}
            className="flex items-center"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Products
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
