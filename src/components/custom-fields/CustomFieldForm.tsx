"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
}

interface CustomFieldFormProps {
  initialData?: CustomField | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CustomFieldForm({
  initialData,
  onSuccess,
  onCancel,
}: CustomFieldFormProps) {
  const [formData, setFormData] = useState({
    field_name: initialData?.field_name || '',
    field_type: initialData?.field_type || 'text' as const,
    is_required: initialData?.is_required || false,
    default_value: initialData?.default_value || '',
    validation_rules: initialData?.validation_rules ? JSON.stringify(initialData.validation_rules, null, 2) : '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.field_name.trim()) {
      newErrors.field_name = 'Field name is required';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.field_name)) {
      newErrors.field_name = 'Field name must start with a letter and contain only letters, numbers, and underscores';
    }

    if (formData.validation_rules.trim()) {
      try {
        JSON.parse(formData.validation_rules);
      } catch {
        newErrors.validation_rules = 'Validation rules must be valid JSON';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        field_name: formData.field_name.trim(),
        field_type: formData.field_type,
        is_required: formData.is_required,
        default_value: formData.default_value.trim() || null,
        validation_rules: formData.validation_rules.trim() ? JSON.parse(formData.validation_rules) : null,
      };

      const url = initialData ? `/api/custom-fields/${initialData.id}` : '/api/custom-fields';
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Failed to ${initialData ? 'update' : 'create'} custom field: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(`Failed to ${initialData ? 'update' : 'create'} custom field`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="field_name">Field Name *</Label>
          <Input
            id="field_name"
            value={formData.field_name}
            onChange={(e) => handleChange('field_name', e.target.value)}
            placeholder="e.g., product_weight, description, specifications"
            className={errors.field_name ? 'border-red-500' : ''}
          />
          {errors.field_name && (
            <p className="text-sm text-red-600 mt-1">{errors.field_name}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Must start with a letter and contain only letters, numbers, and underscores
          </p>
        </div>

        <div>
          <Label htmlFor="field_type">Field Type *</Label>
          <select
            id="field_type"
            value={formData.field_type}
            onChange={(e) => handleChange('field_type', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean (True/False)</option>
            <option value="url">URL</option>
            <option value="date">Date</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Choose the data type for this field
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="default_value">Default Value</Label>
          <Input
            id="default_value"
            value={formData.default_value}
            onChange={(e) => handleChange('default_value', e.target.value)}
            placeholder="Optional default value"
          />
          <p className="text-sm text-gray-500 mt-1">
            Default value to use when creating new products
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_required"
            checked={formData.is_required}
            onChange={(e) => handleChange('is_required', e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <Label htmlFor="is_required">Required Field</Label>
          <p className="text-sm text-gray-500">
            Make this field mandatory when creating/editing products
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="validation_rules">Validation Rules (JSON)</Label>
        <Textarea
          id="validation_rules"
          value={formData.validation_rules}
          onChange={(e) => handleChange('validation_rules', e.target.value)}
          placeholder='{"min_length": 5, "max_length": 100}'
          rows={4}
          className={errors.validation_rules ? 'border-red-500' : ''}
        />
        {errors.validation_rules && (
          <p className="text-sm text-red-600 mt-1">{errors.validation_rules}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Optional JSON object with validation rules (e.g., min_length, max_length, pattern)
        </p>
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Field' : 'Create Field'}
        </Button>
      </div>
    </form>
  );
}
