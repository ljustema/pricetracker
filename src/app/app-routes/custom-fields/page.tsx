"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Type, Hash, ToggleLeft, Link, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CustomFieldForm from "@/components/custom-fields/CustomFieldForm";

interface CustomField {
  id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'url' | 'date';
  is_required: boolean;
  default_value: string | null;
  validation_rules: any;
  created_at: string;
}

export default function CustomFieldsPage() {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deletingField, setDeletingField] = useState<string | null>(null);
  const [autoCreateEnabled, setAutoCreateEnabled] = useState<boolean>(true);
  const [autoCreateLoading, setAutoCreateLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchCustomFields();
    fetchAutoCreateSetting();
  }, []);

  const fetchCustomFields = async () => {
    try {
      const response = await fetch('/api/custom-fields');
      if (response.ok) {
        const data = await response.json();
        setCustomFields(data.customFields || []);
      } else {
        console.error('Failed to fetch custom fields');
      }
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoCreateSetting = async () => {
    try {
      const response = await fetch('/api/custom-fields/auto-create');
      if (response.ok) {
        const data = await response.json();
        setAutoCreateEnabled(data.autoCreateEnabled);
      }
    } catch (error) {
      console.error('Error fetching auto-create setting:', error);
    }
  };

  const handleAutoCreateToggle = async (enabled: boolean) => {
    setAutoCreateLoading(true);
    try {
      const response = await fetch('/api/custom-fields/auto-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setAutoCreateEnabled(enabled);
      } else {
        const error = await response.json();
        alert(`Failed to update setting: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating auto-create setting:', error);
      alert('Failed to update setting');
    } finally {
      setAutoCreateLoading(false);
    }
  };

  const handleCreateField = () => {
    setEditingField(null);
    setShowForm(true);
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
    setShowForm(true);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this custom field? This will also delete all values for this field across all products.')) {
      return;
    }

    setDeletingField(fieldId);
    try {
      const response = await fetch(`/api/custom-fields/${fieldId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCustomFields(fields => fields.filter(f => f.id !== fieldId));
      } else {
        const error = await response.json();
        alert(`Failed to delete custom field: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting custom field:', error);
      alert('Failed to delete custom field');
    } finally {
      setDeletingField(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingField(null);
    fetchCustomFields();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingField(null);
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'boolean': return <ToggleLeft className="h-4 w-4" />;
      case 'url': return <Link className="h-4 w-4" />;
      case 'date': return <Calendar className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const getFieldTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'number': return 'bg-green-100 text-green-800';
      case 'boolean': return 'bg-purple-100 text-purple-800';
      case 'url': return 'bg-orange-100 text-orange-800';
      case 'date': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading custom fields...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-gray-600 mt-2">
            Define custom fields to capture additional product information beyond the standard fields.
          </p>
          <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              id="auto-create"
              checked={autoCreateEnabled}
              onChange={(e) => handleAutoCreateToggle(e.target.checked)}
              disabled={autoCreateLoading}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="auto-create" className="text-sm font-medium text-gray-700">
              Auto-create custom fields from scraped data
            </label>
            <span className="text-xs text-gray-500">
              When enabled, scrapers can automatically create new custom fields for unknown data
            </span>
          </div>
        </div>
        <Button onClick={handleCreateField} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Custom Field
        </Button>
      </div>

      {showForm && (
        <div className="mb-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
            </h2>
            <CustomFieldForm
              initialData={editingField}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </Card>
        </div>
      )}

      {customFields.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-gray-500">
            <Type className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No custom fields yet</h3>
            <p className="mb-4">
              Create custom fields to capture additional product information like specifications, 
              descriptions, or any other data specific to your business needs.
            </p>
            <Button onClick={handleCreateField} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Create Your First Custom Field
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {customFields.map((field) => (
            <Card key={field.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${getFieldTypeColor(field.field_type)}`}>
                    {getFieldTypeIcon(field.field_type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{field.field_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {field.field_type}
                      </Badge>
                      {field.is_required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {field.default_value && (
                        <Badge variant="secondary" className="text-xs">
                          Default: {field.default_value}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditField(field)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteField(field.id)}
                    disabled={deletingField === field.id}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deletingField === field.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
