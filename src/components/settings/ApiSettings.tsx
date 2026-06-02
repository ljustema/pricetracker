'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Eye, EyeOff, Plus, Trash2, Key, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

interface ApiSettingsProps {
  userId?: string;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ userId }) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchApiKeys();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/settings/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API keys');
      
      const data = await response.json();
      setApiKeys(data);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: newKeyName.trim() })
      });

      if (!response.ok) throw new Error('Failed to create API key');
      
      const newKey = await response.json();
      setApiKeys([...apiKeys, newKey]);
      setNewKeyName('');
      
      toast({
        title: "Success",
        description: "API key created successfully",
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete API key');
      
      setApiKeys(apiKeys.filter(key => key.id !== keyId));
      
      toast({
        title: "Success",
        description: "API key deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const maskApiKey = (key: string) => {
    return key.substring(0, 8) + '...' + key.substring(key.length - 8);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Settings</CardTitle>
          <CardDescription>Loading API settings...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            API Endpoints
          </CardTitle>
          <CardDescription>
            Use these endpoints to integrate PriceTracker with external systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="font-medium mb-2">Price Matching CSV Export</h4>
            <p className="text-sm text-gray-600 mb-3">
              Download a CSV file with all products that need price matching
            </p>
            <div className="bg-white rounded border p-3 font-mono text-sm">
              <div className="text-green-600">GET</div>
              <div className="mt-1">{window.location.origin}/api/external/price-matching-csv</div>
            </div>
            <div className="mt-3 text-sm">
              <strong>Headers:</strong>
              <div className="bg-white rounded border p-2 mt-1 font-mono text-xs">
                Authorization: Bearer YOUR_API_KEY
              </div>
            </div>
            <div className="mt-3 text-sm">
              <strong>Optional Query Parameters:</strong>
              <ul className="list-disc list-inside mt-1 text-xs text-gray-600">
                <li><code>competitor_id</code> - Filter by specific competitor</li>
                <li><code>brand_filter</code> - Filter by brand name</li>
                <li><code>limit</code> - Maximum number of products (default: 10000)</li>
                <li><code>offset</code> - Skip number of products (default: 0)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Create and manage API keys for external access to your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new API key */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="keyName">API Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Prestashop Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createApiKey()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={createApiKey} 
                disabled={creating || !newKeyName.trim()}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {creating ? 'Creating...' : 'Create Key'}
              </Button>
            </div>
          </div>

          {/* API Keys List */}
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No API keys created yet. Create your first API key to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{key.key_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {showKeys[key.id] ? key.api_key : maskApiKey(key.api_key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleKeyVisibility(key.id)}
                        >
                          {showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(key.api_key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Created {formatDistanceToNow(new Date(key.created_at))} ago
                        {key.last_used_at && (
                          <span> • Last used {formatDistanceToNow(new Date(key.last_used_at))} ago</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteApiKey(key.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiSettings;
