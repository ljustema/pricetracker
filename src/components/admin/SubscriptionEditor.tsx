'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Crown, Shield, Loader2 } from 'lucide-react';
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

interface SubscriptionEditorProps {
  user: User;
  onUpdate: () => void;
}

export function SubscriptionEditor({ user, onUpdate }: SubscriptionEditorProps) {
  const [selectedTier, setSelectedTier] = useState(user.subscription_tier);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const subscriptionTiers = [
    { value: 'free', label: 'Free', icon: null, description: 'Basic features' },
    { value: 'premium', label: 'Premium', icon: Crown, description: 'Advanced features' },
    { value: 'enterprise', label: 'Enterprise', icon: Shield, description: 'Full access' }
  ];

  const handleUpdateSubscription = async () => {
    if (selectedTier === user.subscription_tier) {
      toast({
        title: "No changes",
        description: "The subscription tier is already set to this value.",
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
          subscription_tier: selectedTier
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription');
      }

      toast({
        title: "Subscription updated",
        description: `User subscription changed to ${selectedTier}.`,
        variant: "default"
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update subscription",
        variant: "destructive"
      });
      
      // Reset selection on error
      setSelectedTier(user.subscription_tier);
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentTierInfo = () => {
    return subscriptionTiers.find(tier => tier.value === user.subscription_tier);
  };

  const getSelectedTierInfo = () => {
    return subscriptionTiers.find(tier => tier.value === selectedTier);
  };

  const currentTier = getCurrentTierInfo();
  const selectedTierInfo = getSelectedTierInfo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Crown className="h-5 w-5 mr-2" />
          Subscription Management
        </CardTitle>
        <CardDescription>
          Change the user's subscription tier and access level
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Subscription */}
        <div>
          <label className="text-sm font-medium text-gray-600">Current Subscription</label>
          <div className="mt-1 flex items-center space-x-2">
            {currentTier?.icon && <currentTier.icon className="h-4 w-4" />}
            <Badge variant={user.subscription_tier === 'free' ? 'secondary' : 'default'}>
              {currentTier?.label}
            </Badge>
            <span className="text-sm text-gray-500">- {currentTier?.description}</span>
          </div>
        </div>

        {/* New Subscription Selection */}
        <div>
          <label className="text-sm font-medium text-gray-600">Change To</label>
          <Select value={selectedTier} onValueChange={setSelectedTier}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subscriptionTiers.map((tier) => {
                const Icon = tier.icon;
                return (
                  <SelectItem key={tier.value} value={tier.value}>
                    <div className="flex items-center space-x-2">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{tier.label}</span>
                      <span className="text-gray-500">- {tier.description}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Preview of changes */}
        {selectedTier !== user.subscription_tier && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Preview:</strong> User will be changed from{' '}
              <Badge variant="outline" className="mx-1">{currentTier?.label}</Badge>
              to{' '}
              <Badge variant="outline" className="mx-1">{selectedTierInfo?.label}</Badge>
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={handleUpdateSubscription}
            disabled={isUpdating || selectedTier === user.subscription_tier}
            className="flex-1"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Subscription'
            )}
          </Button>
          
          {selectedTier !== user.subscription_tier && (
            <Button
              variant="outline"
              onClick={() => setSelectedTier(user.subscription_tier)}
              disabled={isUpdating}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Warning for downgrades */}
        {selectedTier === 'free' && user.subscription_tier !== 'free' && (
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Downgrading to free may limit the user's access to premium features.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
