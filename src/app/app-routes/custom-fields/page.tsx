"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Edit, Trash2, Type, Hash, ToggleLeft, Link, Calendar, Database, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CustomFieldForm from "@/components/custom-fields/CustomFieldForm";

interface ValidationRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
}

interface CustomField {
  id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'url' | 'date';
  is_required: boolean;
  default_value: string | null;
  validation_rules: ValidationRules | null;
  created_at: string;
}

interface CustomFieldValue {
  id: string;
  value: string;
  custom_field_id: string;
  product_id: string;
  source_type?: string;
  source_id?: string;
  last_updated_by?: string;
  confidence_score?: number;
  created_by_source?: string;
  created_at: string;
  updated_at: string;
  product_custom_fields: CustomField;
  products: {
    id: string;
    name: string;
    sku: string;
    brand: string;
  };
}

export default function CustomFieldsPage() {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deletingField, setDeletingField] = useState<string | null>(null);
  const [viewingFieldValues, setViewingFieldValues] = useState<CustomField | null>(null);
  const [fieldValues, setFieldValues] = useState<CustomFieldValue[]>([]);
  const [fieldValuesLoading, setFieldValuesLoading] = useState(false);
  const [editingValue, setEditingValue] = useState<CustomFieldValue | null>(null);
  const [editingValueText, setEditingValueText] = useState('');
  const [deletingValue, setDeletingValue] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [valuesSearchTerm, setValuesSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomFields();
  }, []);

  // Filtered and sorted custom fields
  const filteredAndSortedFields = useMemo(() => {
    let filtered = customFields;

    if (searchTerm.trim()) {
      filtered = customFields.filter(field =>
        field.field_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => a.field_name.localeCompare(b.field_name));
  }, [customFields, searchTerm]);

  // Filtered and sorted field values
  const filteredAndSortedValues = useMemo(() => {
    let filtered = fieldValues;

    if (valuesSearchTerm.trim()) {
      filtered = fieldValues.filter(value =>
        value.products.name.toLowerCase().includes(valuesSearchTerm.toLowerCase()) ||
        value.value.toLowerCase().includes(valuesSearchTerm.toLowerCase()) ||
        (value.products.sku && value.products.sku.toLowerCase().includes(valuesSearchTerm.toLowerCase())) ||
        (value.products.brand && value.products.brand.toLowerCase().includes(valuesSearchTerm.toLowerCase()))
      );
    }

    return filtered.sort((a, b) => a.products.name.localeCompare(b.products.name));
  }, [fieldValues, valuesSearchTerm]);

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

  const fetchFieldValues = async (fieldId: string) => {
    try {
      setFieldValuesLoading(true);
      const response = await fetch(`/api/custom-fields/values?field_id=${fieldId}`);
      if (response.ok) {
        const data = await response.json();
        setFieldValues(data.customFieldValues || []);
      } else {
        console.error('Failed to fetch custom field values');
      }
    } catch (error) {
      console.error('Error fetching custom field values:', error);
    } finally {
      setFieldValuesLoading(false);
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

  const handleViewFieldValues = (field: CustomField) => {
    setViewingFieldValues(field);
    fetchFieldValues(field.id);
  };

  const handleBackToFields = () => {
    setViewingFieldValues(null);
    setFieldValues([]);
    setEditingValue(null);
    setEditingValueText('');
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

  const handleEditValue = (value: CustomFieldValue) => {
    setEditingValue(value);
    setEditingValueText(value.value);
  };

  const handleSaveValue = async () => {
    if (!editingValue) return;

    try {
      const response = await fetch(`/api/custom-fields/values/${editingValue.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: editingValueText }),
      });

      if (response.ok) {
        setEditingValue(null);
        setEditingValueText('');
        if (viewingFieldValues) {
          fetchFieldValues(viewingFieldValues.id);
        }
      } else {
        const error = await response.json();
        alert(`Failed to update custom field value: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating custom field value:', error);
      alert('Failed to update custom field value');
    }
  };

  const handleCancelEditValue = () => {
    setEditingValue(null);
    setEditingValueText('');
  };

  const handleDeleteValue = async (valueId: string) => {
    if (!confirm('Are you sure you want to delete this custom field value?')) {
      return;
    }

    setDeletingValue(valueId);
    try {
      const response = await fetch(`/api/custom-fields/values/${valueId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFieldValues(values => values.filter(v => v.id !== valueId));
      } else {
        const error = await response.json();
        alert(`Failed to delete custom field value: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting custom field value:', error);
      alert('Failed to delete custom field value');
    } finally {
      setDeletingValue(null);
    }
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

  if (viewingFieldValues) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Button
              variant="outline"
              onClick={handleBackToFields}
              className="mb-3 flex items-center gap-2 h-8 px-3 text-sm"
            >
              ← Back to Custom Fields
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              Values for "{viewingFieldValues.field_name}"
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Manage all values for this custom field across your products.
            </p>
          </div>
        </div>

        {/* Search Field for Values */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by product name, value, SKU, or brand..."
              value={valuesSearchTerm}
              onChange={(e) => setValuesSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {valuesSearchTerm && (
            <p className="text-sm text-gray-600 mt-2">
              Showing {filteredAndSortedValues.length} of {fieldValues.length} values
            </p>
          )}
        </div>

        {renderFieldValuesView()}
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
            Configure auto-creation and update settings in <a href="/app-routes/settings" className="text-indigo-600 hover:text-indigo-800 underline">Advanced Settings</a>.
          </p>
        </div>
        <Button onClick={handleCreateField} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Custom Field
        </Button>
      </div>

      {showForm && (
        <div className="mb-6">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-3">
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

      {/* Search Field */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search custom fields by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchTerm && (
          <p className="text-sm text-gray-600 mt-2">
            Showing {filteredAndSortedFields.length} of {customFields.length} fields
          </p>
        )}
      </div>

      {renderFieldsTab()}
    </div>
  );

  function renderFieldsTab() {
    if (loading) {
      return (
        <Card className="p-8 text-center">
          <div className="text-gray-500">Loading custom fields...</div>
        </Card>
      );
    }

    if (customFields.length === 0) {
      return (
        <Card className="p-6 text-center">
          <div className="text-gray-500">
            <Type className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <h3 className="text-base font-medium mb-2">No custom fields yet</h3>
            <p className="mb-3 text-sm">
              Create custom fields to capture additional product information like specifications,
              descriptions, or any other data specific to your business needs.
            </p>
            <Button onClick={handleCreateField} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Create Your First Custom Field
            </Button>
          </div>
        </Card>
      );
    }

    if (filteredAndSortedFields.length === 0) {
      return (
        <Card className="p-6 text-center">
          <div className="text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <h3 className="text-base font-medium mb-2">No fields found</h3>
            <p className="text-sm">No custom fields match your search term "{searchTerm}".</p>
          </div>
        </Card>
      );
    }

    return (
      <div className="grid gap-3">
        {filteredAndSortedFields.map((field) => (
          <Card key={field.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded ${getFieldTypeColor(field.field_type)}`}>
                  {getFieldTypeIcon(field.field_type)}
                </div>
                <div>
                  <h3 className="text-base font-medium">{field.field_name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                      {field.field_type}
                    </Badge>
                    {field.is_required && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                        Required
                      </Badge>
                    )}
                    {field.default_value && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        Default: {field.default_value}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewFieldValues(field)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 h-8 px-2 text-xs"
                >
                  <Database className="h-3 w-3" />
                  Values
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditField(field)}
                  className="flex items-center gap-1 h-8 px-2 text-xs"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteField(field.id)}
                  disabled={deletingField === field.id}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 h-8 px-2 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  {deletingField === field.id ? 'Del...' : 'Delete'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  function renderFieldValuesView() {
    if (fieldValuesLoading) {
      return (
        <Card className="p-8 text-center">
          <div className="text-gray-500">Loading custom field values...</div>
        </Card>
      );
    }

    if (fieldValues.length === 0) {
      return (
        <Card className="p-6 text-center">
          <div className="text-gray-500">
            <Database className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <h3 className="text-base font-medium mb-2">No values found</h3>
            <p className="mb-3 text-sm">
              This custom field doesn't have any values assigned to products yet.
            </p>
          </div>
        </Card>
      );
    }

    if (filteredAndSortedValues.length === 0) {
      return (
        <Card className="p-6 text-center">
          <div className="text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <h3 className="text-base font-medium mb-2">No values found</h3>
            <p className="text-sm">No values match your search term "{valuesSearchTerm}".</p>
          </div>
        </Card>
      );
    }

    return (
      <div className="grid gap-3">
        {filteredAndSortedValues.map((value) => (
          <Card key={value.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-1.5 rounded ${getFieldTypeColor(value.product_custom_fields.field_type)}`}>
                  {getFieldTypeIcon(value.product_custom_fields.field_type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-base font-medium">{value.product_custom_fields.field_name}</h3>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                      {value.product_custom_fields.field_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1.5">
                    <Package className="h-3 w-3" />
                    <span className="font-medium">{value.products.name}</span>
                    {value.products.sku && (
                      <span className="text-gray-500">({value.products.sku})</span>
                    )}
                    {value.products.brand && (
                      <span className="text-gray-500">- {value.products.brand}</span>
                    )}
                  </div>
                  {editingValue?.id === value.id ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-value-${value.id}`} className="text-xs">Value</Label>
                      <Input
                        id={`edit-value-${value.id}`}
                        value={editingValueText}
                        onChange={(e) => setEditingValueText(e.target.value)}
                        placeholder="Enter value"
                        className="h-8 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      <strong>Value:</strong> {value.value}
                    </div>
                  )}
                  {value.source_type && (
                    <div className="text-xs text-gray-500 mt-1">
                      Source: {value.source_type} • Updated: {new Date(value.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {editingValue?.id === value.id ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveValue}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 h-8 px-2 text-xs"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEditValue}
                      className="flex items-center gap-1 h-8 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditValue(value)}
                      className="flex items-center gap-1 h-8 px-2 text-xs"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteValue(value.id)}
                      disabled={deletingValue === value.id}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 h-8 px-2 text-xs"
                    >
                      <Trash2 className="h-3 w-3" />
                      {deletingValue === value.id ? 'Del...' : 'Delete'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }
}
