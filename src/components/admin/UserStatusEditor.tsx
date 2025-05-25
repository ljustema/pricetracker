'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { UserX, UserCheck, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  admin_role: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

interface UserStatusEditorProps {
  user: User;
  onUpdate: () => void;
}

export function UserStatusEditor({ user, onUpdate }: UserStatusEditorProps) {
  const [isSuspended, setIsSuspended] = useState(user.is_suspended);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateStatus = async () => {
    if (isSuspended === user.is_suspended) {
      toast({
        title: "No changes",
        description: "The user status is already set to this value.",
        variant: "default"
      });
      return;
    }

    setIsUpdating(true);
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_suspended: isSuspended
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user status');
      }

      toast({
        title: "User status updated",
        description: `User has been ${isSuspended ? 'suspended' : 'reactivated'}.`,
        variant: "default"
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update user status",
        variant: "destructive"
      });
      
      // Reset switch on error
      setIsSuspended(user.is_suspended);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserCheck className="h-5 w-5 mr-2" />
          Account Status
        </CardTitle>
        <CardDescription>
          Suspend or reactivate the user account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div>
          <label className="text-sm font-medium text-gray-600">Current Status</label>
          <div className="mt-1">
            {user.is_suspended ? (
              <Badge variant="destructive" className="flex items-center w-fit">
                <UserX className="h-3 w-3 mr-1" />
                Suspended
              </Badge>
            ) : (
              <Badge className="bg-green-500 flex items-center w-fit">
                <UserCheck className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            {isSuspended ? (
              <UserX className="h-5 w-5 text-red-500" />
            ) : (
              <UserCheck className="h-5 w-5 text-green-500" />
            )}
            <div>
              <p className="font-medium">
                {isSuspended ? 'Suspend Account' : 'Active Account'}
              </p>
              <p className="text-sm text-gray-500">
                {isSuspended 
                  ? 'User will be unable to access their account'
                  : 'User has full access to their account'
                }
              </p>
            </div>
          </div>
          <Switch
            checked={isSuspended}
            onCheckedChange={setIsSuspended}
            disabled={isUpdating}
          />
        </div>

        {/* Preview of changes */}
        {isSuspended !== user.is_suspended && (
          <div className={`p-3 rounded-lg border ${
            isSuspended 
              ? 'bg-red-50 border-red-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <p className={`text-sm ${
              isSuspended ? 'text-red-800' : 'text-green-800'
            }`}>
              <strong>Preview:</strong> User account will be{' '}
              {isSuspended ? 'suspended' : 'reactivated'}.
              {isSuspended && ' They will be logged out and unable to sign in.'}
            </p>
          </div>
        )}

        {/* Warning for admin users */}
        {user.admin_role && isSuspended && (
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">
                  Warning: Admin Account
                </p>
                <p className="text-sm text-yellow-700">
                  This user has admin privileges ({user.admin_role}). 
                  Suspending this account will remove their admin access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={handleUpdateStatus}
            disabled={isUpdating || isSuspended === user.is_suspended}
            variant={isSuspended && isSuspended !== user.is_suspended ? "destructive" : "default"}
            className="flex-1"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                {isSuspended && isSuspended !== user.is_suspended ? (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Suspend User
                  </>
                ) : !isSuspended && isSuspended !== user.is_suspended ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Reactivate User
                  </>
                ) : (
                  'Update Status'
                )}
              </>
            )}
          </Button>
          
          {isSuspended !== user.is_suspended && (
            <Button
              variant="outline"
              onClick={() => setIsSuspended(user.is_suspended)}
              disabled={isUpdating}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Additional Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Suspended users cannot sign in or access any features</p>
          <p>• Reactivated users regain full access to their account</p>
          <p>• All user data is preserved during suspension</p>
        </div>
      </CardContent>
    </Card>
  );
}
