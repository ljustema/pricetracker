export interface CustomField {
  id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'url' | 'date';
  is_required: boolean;
  default_value: string | null;
  validation_rules: any;
  created_at: string;
}

export interface CreateCustomFieldRequest {
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'url' | 'date';
  is_required?: boolean;
  default_value?: string;
  validation_rules?: any;
}

export interface UpdateCustomFieldRequest {
  field_name: string;
  field_type: 'text' | 'number' | 'boolean' | 'url' | 'date';
  is_required?: boolean;
  default_value?: string;
  validation_rules?: any;
}

/**
 * Client service for managing custom fields
 */
export class CustomFieldsClientService {
  /**
   * Get all custom fields for the current user
   */
  static async getCustomFields(): Promise<CustomField[]> {
    const response = await fetch('/api/custom-fields');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch custom fields');
    }
    
    const data = await response.json();
    return data.customFields || [];
  }

  /**
   * Get a specific custom field by ID
   */
  static async getCustomField(id: string): Promise<CustomField> {
    const response = await fetch(`/api/custom-fields/${id}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch custom field');
    }
    
    const data = await response.json();
    return data.customField;
  }

  /**
   * Create a new custom field
   */
  static async createCustomField(fieldData: CreateCustomFieldRequest): Promise<CustomField> {
    const response = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fieldData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create custom field');
    }
    
    const data = await response.json();
    return data.customField;
  }

  /**
   * Update an existing custom field
   */
  static async updateCustomField(id: string, fieldData: UpdateCustomFieldRequest): Promise<CustomField> {
    const response = await fetch(`/api/custom-fields/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fieldData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update custom field');
    }
    
    const data = await response.json();
    return data.customField;
  }

  /**
   * Delete a custom field
   */
  static async deleteCustomField(id: string): Promise<void> {
    const response = await fetch(`/api/custom-fields/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete custom field');
    }
  }

  /**
   * Validate a custom field value based on its type and validation rules
   */
  static validateFieldValue(field: CustomField, value: any): { isValid: boolean; error?: string } {
    // Check if required field is empty
    if (field.is_required && (value === null || value === undefined || value === '')) {
      return { isValid: false, error: `${field.field_name} is required` };
    }

    // If value is empty and not required, it's valid
    if (value === null || value === undefined || value === '') {
      return { isValid: true };
    }

    // Type-specific validation
    switch (field.field_type) {
      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return { isValid: false, error: `${field.field_name} must be a valid number` };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return { isValid: false, error: `${field.field_name} must be true or false` };
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          return { isValid: false, error: `${field.field_name} must be a valid URL` };
        }
        break;

      case 'date':
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          return { isValid: false, error: `${field.field_name} must be a valid date` };
        }
        break;

      case 'text':
        // Text validation will be handled by validation rules if any
        break;
    }

    // Apply validation rules if they exist
    if (field.validation_rules) {
      const rules = field.validation_rules;
      
      if (rules.min_length && value.length < rules.min_length) {
        return { isValid: false, error: `${field.field_name} must be at least ${rules.min_length} characters long` };
      }
      
      if (rules.max_length && value.length > rules.max_length) {
        return { isValid: false, error: `${field.field_name} must be no more than ${rules.max_length} characters long` };
      }
      
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        return { isValid: false, error: `${field.field_name} format is invalid` };
      }
    }

    return { isValid: true };
  }

  /**
   * Format a field value for display based on its type
   */
  static formatFieldValue(field: CustomField, value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    switch (field.field_type) {
      case 'boolean':
        return value === true || value === 'true' ? 'Yes' : 'No';
      
      case 'date':
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      
      case 'url':
        return value;
      
      default:
        return String(value);
    }
  }
}
