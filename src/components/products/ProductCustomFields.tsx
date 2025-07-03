"use client";

import { useState, useEffect, useCallback } from "react";
import { Edit, Save, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CustomField, CustomFieldsClientService } from "@/lib/services/custom-fields-client-service";
import { SourceBadge } from "@/components/ui/source-badge";

interface ProductCustomFieldValue {
  id: string;
  value: string;
  custom_field_id: string;
  source_type?: string;
  source_id?: string;
  last_updated_by?: string;
  confidence_score?: number;
  created_by_source?: string;
  created_at?: string;
  updated_at?: string;
  product_custom_fields: CustomField;
}

interface ProductCustomFieldsProps {
  productId: string;
  isEditable?: boolean;
  alwaysEditable?: boolean; // New prop for always-on editing mode
  onValuesChange?: (values: Record<string, string>) => void; // Callback for value changes
  showOnlyWithValues?: boolean; // Only show fields that have values
}

export default function ProductCustomFields({
  productId,
  isEditable = false,
  alwaysEditable = false,
  onValuesChange,
  showOnlyWithValues = false,
}: ProductCustomFieldsProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<ProductCustomFieldValue[]>([]);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmptyFields, setShowEmptyFields] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch custom fields and values in parallel
      const [fieldsResponse, valuesResponse] = await Promise.all([
        CustomFieldsClientService.getCustomFields(),
        fetch(`/api/products/${productId}/custom-fields`)
      ]);

      setCustomFields(fieldsResponse);

      if (valuesResponse.ok) {
        const valuesData = await valuesResponse.json();
        setCustomFieldValues(valuesData.customFieldValues || []);
      }
    } catch (error) {
      console.error('Error fetching custom fields data:', error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [productId, fetchData]);

  const getFieldValue = useCallback((fieldId: string): string => {
    const fieldValue = customFieldValues.find(cfv => cfv.custom_field_id === fieldId);
    return fieldValue?.value || '';
  }, [customFieldValues]);



  // Helper function to format field names with initial capitalization and replace underscores
  const formatFieldName = useCallback((fieldName: string): string => {
    return fieldName
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/^./, (char) => char.toUpperCase()); // Only capitalize the very first character
  }, []);

  // Separate fields with values from empty fields
  const fieldsWithValues = customFields.filter(field => {
    const value = getFieldValue(field.id);
    return value && value.trim() !== '';
  });

  const emptyFields = customFields.filter(field => {
    const value = getFieldValue(field.id);
    return !value || value.trim() === '';
  });

  // For backward compatibility with showOnlyWithValues prop
  const fieldsToShow = showOnlyWithValues ? fieldsWithValues : customFields;

  // Helper function to group fields by source type
  const getFieldsBySourceType = useCallback(() => {
    const fieldsBySource: Record<string, Array<{ field: CustomField; value: string; sourceType: string }>> = {};

    fieldsToShow.forEach(field => {
      const fieldValue = customFieldValues.find(cfv => cfv.custom_field_id === field.id);
      const value = fieldValue?.value || '';
      const sourceType = fieldValue?.source_type || 'manual';

      if (!fieldsBySource[sourceType]) {
        fieldsBySource[sourceType] = [];
      }

      fieldsBySource[sourceType].push({
        field,
        value,
        sourceType
      });
    });

    return fieldsBySource;
  }, [fieldsToShow, customFieldValues]);

  const handleEdit = () => {
    // Initialize editing values with current values
    const initialValues: Record<string, string> = {};
    customFields.forEach(field => {
      initialValues[field.id] = getFieldValue(field.id);
    });
    setEditingValues(initialValues);
    setIsEditing(true);
  };

  // Initialize editing values for always editable mode
  useEffect(() => {
    if (alwaysEditable && customFields.length > 0) {
      const initialValues: Record<string, string> = {};
      customFields.forEach(field => {
        initialValues[field.id] = getFieldValue(field.id);
      });
      setEditingValues(initialValues);
      setIsEditing(true);
    }
  }, [customFields, alwaysEditable, getFieldValue]);

  const handleCancel = () => {
    setEditingValues({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Prepare custom field values for API
      const customFieldValuesToSave = Object.entries(editingValues).map(([fieldId, value]) => ({
        custom_field_id: fieldId,
        value: value.trim(),
      }));

      const response = await fetch(`/api/products/${productId}/custom-fields`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customFieldValues: customFieldValuesToSave }),
      });

      if (response.ok) {
        await fetchData(); // Refresh data
        setIsEditing(false);
        setEditingValues({});
      } else {
        const error = await response.json();
        alert(`Failed to save custom fields: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving custom fields:', error);
      alert('Failed to save custom fields');
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (fieldId: string, value: string) => {
    const newValues = {
      ...editingValues,
      [fieldId]: value,
    };
    setEditingValues(newValues);

    // Call the callback if provided (for always editable mode)
    if (onValuesChange) {
      onValuesChange(newValues);
    }
  };

  const renderFieldInput = (field: CustomField) => {
    const value = editingValues[field.id] || '';

    switch (field.field_type) {
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
          />
        );

      case 'number':
        // Use text input for number fields since they often contain units (e.g., "160cm", "5.6kg")
        // HTML number inputs can't handle values with units
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            placeholder={field.default_value || 'Enter number (units allowed)'}
          />
        );

      default:
        return (
          <Input
            type={field.field_type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            placeholder={field.default_value || ''}
          />
        );
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">Loading custom fields...</div>
      </Card>
    );
  }

  if (customFields.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          <Plus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p>No custom fields defined yet.</p>
          <p className="text-sm">
            <a href="/app-routes/custom-fields" className="text-indigo-600 hover:text-indigo-800">
              Create custom fields
            </a> to capture additional product information.
          </p>
        </div>
      </Card>
    );
  }

  if (showOnlyWithValues && fieldsToShow.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          <p>No custom field values available for this product.</p>
        </div>
      </Card>
    );
  }

  // Helper function to render a field
  const renderField = (field: CustomField, value?: string) => {
    const fieldValue = value !== undefined ? value : getFieldValue(field.id);

    return (
      <div key={field.id}>
        <Label htmlFor={`field-${field.id}`} className="flex items-center gap-1 mb-2">
          {formatFieldName(field.field_name)}
          {field.is_required && <span className="text-red-500">*</span>}
        </Label>
        {(isEditing || alwaysEditable) ? (
          <div className="mt-2">
            {renderFieldInput(field)}
          </div>
        ) : (
          <div className="mt-2 p-2 bg-gray-50 rounded-md text-sm">
            {CustomFieldsClientService.formatFieldValue(field, fieldValue)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Custom Fields</h3>
        {!alwaysEditable && isEditable && !isEditing && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="flex items-center gap-1">
            <Edit className="h-3 w-3" />
            Edit
          </Button>
        )}
        {!alwaysEditable && isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {/* For backward compatibility - show all fields if showOnlyWithValues is true */}
      {showOnlyWithValues ? (
        <div className="space-y-6">
          {Object.entries(getFieldsBySourceType()).length > 0 ? (
            Object.entries(getFieldsBySourceType()).map(([sourceType, fields]) => (
              <div key={sourceType} className="space-y-4">
                {/* Source type badge */}
                <div className="flex items-center gap-2">
                  <SourceBadge
                    sourceType={sourceType}
                    showIcon={true}
                    showScore={false}
                  />
                  <span className="text-sm text-gray-500">
                    ({fields.length} field{fields.length !== 1 ? 's' : ''})
                  </span>
                </div>

                {/* Fields for this source type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-gray-100">
                  {fields.map(({ field, value }) => renderField(field, value))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500">
              <p>No custom field values available for this product.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fields with values */}
          {fieldsWithValues.length > 0 && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldsWithValues.map(field => renderField(field))}
              </div>
            </div>
          )}

          {/* Empty fields - collapsible section */}
          {emptyFields.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmptyFields(!showEmptyFields)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 p-0 h-auto font-normal"
              >
                {showEmptyFields ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showEmptyFields ? 'Hide' : 'Show'} empty fields ({emptyFields.length})
              </Button>

              {showEmptyFields && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {emptyFields.map(field => renderField(field))}
                </div>
              )}
            </div>
          )}

          {/* Show message if no fields at all */}
          {fieldsWithValues.length === 0 && emptyFields.length === 0 && (
            <div className="text-center text-gray-500">
              <p>No custom field values available for this product.</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
