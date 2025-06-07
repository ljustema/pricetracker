"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomField, CustomFieldsClientService } from "@/lib/services/custom-fields-client-service";

interface FieldMapping {
  [csvColumn: string]: {
    productField: string;
    isCustomField: boolean;
    dataType: string;
  };
}

interface FieldMappingFormProps {
  csvHeaders: string[];
  productType: 'own' | 'competitor';
  onMappingChange: (mapping: FieldMapping) => void;
  initialMapping?: FieldMapping;
}

const STANDARD_FIELDS = {
  own: [
    { key: 'name', label: 'Product Name', type: 'text', required: true },
    { key: 'our_retail_price', label: 'Our Retail Price', type: 'number', required: false },
    { key: 'our_wholesale_price', label: 'Our Wholesale Price', type: 'number', required: false },
    { key: 'currency_code', label: 'Currency Code', type: 'text', required: false },
    { key: 'sku', label: 'SKU', type: 'text', required: false },
    { key: 'brand', label: 'Brand', type: 'text', required: false },
    { key: 'ean', label: 'EAN', type: 'text', required: false },
    { key: 'category', label: 'Category', type: 'text', required: false },
    { key: 'description', label: 'Description', type: 'text', required: false },
    { key: 'image_url', label: 'Image URL', type: 'url', required: false },
    { key: 'url', label: 'Product URL', type: 'url', required: false },
  ],
  competitor: [
    { key: 'name', label: 'Product Name', type: 'text', required: true },
    { key: 'price', label: 'Price', type: 'number', required: true },
    { key: 'currency_code', label: 'Currency Code', type: 'text', required: false },
    { key: 'sku', label: 'SKU', type: 'text', required: false },
    { key: 'brand', label: 'Brand', type: 'text', required: false },
    { key: 'ean', label: 'EAN', type: 'text', required: false },
    { key: 'image_url', label: 'Image URL', type: 'url', required: false },
    { key: 'url', label: 'Product URL', type: 'url', required: false },
  ],
};

export default function FieldMappingForm({
  csvHeaders,
  productType,
  onMappingChange,
  initialMapping = {},
}: FieldMappingFormProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>(initialMapping);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomFields();
  }, []);

  useEffect(() => {
    onMappingChange(mapping);
  }, [mapping, onMappingChange]);

  const fetchCustomFields = async () => {
    try {
      const fields = await CustomFieldsClientService.getCustomFields();
      setCustomFields(fields);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (csvColumn: string, productField: string) => {
    const newMapping = { ...mapping };

    if (productField === '') {
      // Remove mapping if empty selection
      delete newMapping[csvColumn];
    } else {
      // Check if it's a custom field
      const isCustomField = customFields.some(cf => cf.field_name === productField);
      const customField = customFields.find(cf => cf.field_name === productField);
      const standardField = STANDARD_FIELDS[productType].find(sf => sf.key === productField);
      
      newMapping[csvColumn] = {
        productField,
        isCustomField,
        dataType: isCustomField ? customField?.field_type || 'text' : standardField?.type || 'text',
      };
    }

    setMapping(newMapping);
  };

  const getAvailableFields = () => {
    const standardFields = STANDARD_FIELDS[productType];
    const allFields = [
      ...standardFields.map(field => ({
        ...field,
        isCustomField: false,
      })),
      ...customFields.map(field => ({
        key: field.field_name,
        label: field.field_name,
        type: field.field_type,
        required: field.is_required,
        isCustomField: true,
      })),
    ];

    return allFields;
  };

  const getMappedField = (csvColumn: string) => {
    return mapping[csvColumn]?.productField || '';
  };

  const isFieldMapped = (fieldKey: string) => {
    return Object.values(mapping).some(m => m.productField === fieldKey);
  };

  const getRequiredFieldsStatus = () => {
    const requiredFields = STANDARD_FIELDS[productType].filter(f => f.required);
    const mappedRequiredFields = requiredFields.filter(field => 
      Object.values(mapping).some(m => m.productField === field.key)
    );
    
    return {
      total: requiredFields.length,
      mapped: mappedRequiredFields.length,
      missing: requiredFields.filter(field => 
        !Object.values(mapping).some(m => m.productField === field.key)
      ),
    };
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">Loading field mapping...</div>
      </Card>
    );
  }

  const availableFields = getAvailableFields();
  const requiredStatus = getRequiredFieldsStatus();

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Field Mapping</h3>
        <p className="text-sm text-gray-600 mb-4">
          Map your CSV columns to product fields. Required fields must be mapped for successful import.
        </p>
        
        {/* Required fields status */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={requiredStatus.mapped === requiredStatus.total ? "default" : "destructive"}>
              Required Fields: {requiredStatus.mapped}/{requiredStatus.total}
            </Badge>
            {customFields.length > 0 && (
              <Badge variant="outline">
                {customFields.length} Custom Fields Available
              </Badge>
            )}
          </div>
          
          {requiredStatus.missing.length > 0 && (
            <div className="text-sm text-red-600">
              Missing required fields: {requiredStatus.missing.map(f => f.label).join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {csvHeaders.map((header) => (
          <div key={header} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <Label className="font-medium">{header}</Label>
              <div className="text-xs text-gray-500">CSV Column</div>
            </div>
            
            <div>
              <select
                value={getMappedField(header)}
                onChange={(e) => handleMappingChange(header, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                <option value="">Select field...</option>
                
                {/* Standard fields */}
                <optgroup label="Standard Fields">
                  {availableFields
                    .filter(field => !field.isCustomField)
                    .map((field) => (
                      <option
                        key={field.key}
                        value={field.key}
                        disabled={isFieldMapped(field.key) && getMappedField(header) !== field.key}
                      >
                        {field.label} {field.required ? '*' : ''} ({field.type})
                        {isFieldMapped(field.key) && getMappedField(header) !== field.key ? ' (mapped)' : ''}
                      </option>
                    ))}
                </optgroup>
                
                {/* Custom fields */}
                {customFields.length > 0 && (
                  <optgroup label="Custom Fields">
                    {availableFields
                      .filter(field => field.isCustomField)
                      .map((field) => (
                        <option
                          key={field.key}
                          value={field.key}
                          disabled={isFieldMapped(field.key) && getMappedField(header) !== field.key}
                        >
                          {field.label} {field.required ? '*' : ''} ({field.type})
                          {isFieldMapped(field.key) && getMappedField(header) !== field.key ? ' (mapped)' : ''}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              
              {mapping[header] && (
                <div className="mt-1 text-xs text-gray-500">
                  Mapped to: {mapping[header].isCustomField ? 'Custom' : 'Standard'} field ({mapping[header].dataType})
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {csvHeaders.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          Upload a CSV file to see field mapping options
        </div>
      )}
    </Card>
  );
}
