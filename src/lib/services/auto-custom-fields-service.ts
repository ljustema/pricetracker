import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Service for automatically creating custom fields from scraped data
 */
export class AutoCustomFieldsService {
  
  /**
   * Standard product fields that should not be treated as custom fields
   */
  private static readonly STANDARD_FIELDS = new Set([
    'id', 'user_id', 'name', 'sku', 'ean', 'brand', 'brand_id', 'category', 
    'description', 'image_url', 'url', 'price', 'our_price', 'wholesale_price',
    'currency_code', 'currency', 'is_active', 'created_at', 'updated_at',
    'scraped_at', 'competitor_id', 'integration_id', 'scraper_id', 'status',
    'error_message', 'processed_at', 'product_id', 'prestashop_product_id',
    'raw_data', 'integration_run_id'
  ]);

  /**
   * Detect field type from value
   */
  private static detectFieldType(value: any): 'text' | 'number' | 'boolean' | 'url' | 'date' {
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    
    if (typeof value === 'number') {
      return 'number';
    }
    
    if (typeof value === 'string') {
      // Check if it's a URL
      try {
        new URL(value);
        return 'url';
      } catch {}
      
      // Check if it's a date
      const dateValue = new Date(value);
      if (!isNaN(dateValue.getTime()) && value.match(/^\d{4}-\d{2}-\d{2}/) || value.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        return 'date';
      }
      
      // Check if it's a number string
      if (!isNaN(Number(value)) && value.trim() !== '') {
        return 'number';
      }
    }
    
    return 'text';
  }

  /**
   * Create custom fields automatically from scraped data
   */
  static async createCustomFieldsFromScrapedData(
    userId: string, 
    scrapedData: Record<string, any>
  ): Promise<{ customFieldIds: Record<string, string>; errors: string[] }> {
    const supabase = createSupabaseAdminClient();
    const customFieldIds: Record<string, string> = {};
    const errors: string[] = [];

    // Get existing custom fields for this user
    const { data: existingFields, error: fetchError } = await supabase
      .from('user_custom_fields')
      .select('id, field_name')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Error fetching existing custom fields:', fetchError);
      errors.push(`Failed to fetch existing custom fields: ${fetchError.message}`);
      return { customFieldIds, errors };
    }

    const existingFieldNames = new Set(existingFields?.map(f => f.field_name) || []);
    const existingFieldMap = new Map(existingFields?.map(f => [f.field_name, f.id]) || []);

    // Identify custom fields (fields not in standard fields)
    const customFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(scrapedData)) {
      if (!this.STANDARD_FIELDS.has(key) && value !== null && value !== undefined && value !== '') {
        customFields[key] = value;
      }
    }

    // Process each custom field
    for (const [fieldName, fieldValue] of Object.entries(customFields)) {
      try {
        // Validate field name format
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldName)) {
          console.warn(`Skipping invalid field name: ${fieldName}`);
          continue;
        }

        // If field already exists, use existing ID
        if (existingFieldNames.has(fieldName)) {
          customFieldIds[fieldName] = existingFieldMap.get(fieldName)!;
          continue;
        }

        // Detect field type
        const fieldType = this.detectFieldType(fieldValue);

        // Create new custom field
        const { data: newField, error: createError } = await supabase
          .from('user_custom_fields')
          .insert({
            user_id: userId,
            field_name: fieldName,
            field_type: fieldType,
            is_required: false,
            default_value: null,
            validation_rules: null,
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Error creating custom field ${fieldName}:`, createError);
          errors.push(`Failed to create custom field ${fieldName}: ${createError.message}`);
          continue;
        }

        customFieldIds[fieldName] = newField.id;
        console.log(`Auto-created custom field: ${fieldName} (${fieldType}) with ID: ${newField.id}`);

      } catch (error) {
        console.error(`Error processing custom field ${fieldName}:`, error);
        errors.push(`Error processing custom field ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { customFieldIds, errors };
  }

  /**
   * Store custom field values for a product
   */
  static async storeCustomFieldValues(
    productId: string,
    customFieldIds: Record<string, string>,
    scrapedData: Record<string, any>
  ): Promise<{ success: boolean; errors: string[] }> {
    const supabase = createSupabaseAdminClient();
    const errors: string[] = [];

    // Prepare custom field values to insert
    const customFieldValues = [];
    for (const [fieldName, fieldId] of Object.entries(customFieldIds)) {
      const value = scrapedData[fieldName];
      if (value !== null && value !== undefined && value !== '') {
        customFieldValues.push({
          product_id: productId,
          custom_field_id: fieldId,
          value: String(value),
        });
      }
    }

    if (customFieldValues.length === 0) {
      return { success: true, errors };
    }

    // Delete existing custom field values for this product (to avoid duplicates)
    const fieldIds = Object.values(customFieldIds);
    if (fieldIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('product_custom_field_values')
        .delete()
        .eq('product_id', productId)
        .in('custom_field_id', fieldIds);

      if (deleteError) {
        console.error('Error deleting existing custom field values:', deleteError);
        errors.push(`Failed to delete existing custom field values: ${deleteError.message}`);
      }
    }

    // Insert new custom field values
    const { error: insertError } = await supabase
      .from('product_custom_field_values')
      .insert(customFieldValues);

    if (insertError) {
      console.error('Error inserting custom field values:', insertError);
      errors.push(`Failed to insert custom field values: ${insertError.message}`);
      return { success: false, errors };
    }

    console.log(`Stored ${customFieldValues.length} custom field values for product ${productId}`);
    return { success: true, errors };
  }

  /**
   * Process scraped product data and handle custom fields automatically
   */
  static async processScrapedProductWithCustomFields(
    userId: string,
    productId: string,
    scrapedData: Record<string, any>
  ): Promise<{ success: boolean; customFieldsCreated: number; errors: string[] }> {
    try {
      // Create custom fields from scraped data
      const { customFieldIds, errors: createErrors } = await this.createCustomFieldsFromScrapedData(userId, scrapedData);
      
      // Store custom field values
      const { success, errors: storeErrors } = await this.storeCustomFieldValues(productId, customFieldIds, scrapedData);
      
      const allErrors = [...createErrors, ...storeErrors];
      
      return {
        success: success && createErrors.length === 0,
        customFieldsCreated: Object.keys(customFieldIds).length,
        errors: allErrors
      };
    } catch (error) {
      console.error('Error processing scraped product with custom fields:', error);
      return {
        success: false,
        customFieldsCreated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Extract custom fields from raw scraped data (for temp tables)
   */
  static extractCustomFieldsFromRawData(rawData: any): Record<string, any> {
    if (!rawData || typeof rawData !== 'object') {
      return {};
    }

    const customFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (!this.STANDARD_FIELDS.has(key) && value !== null && value !== undefined && value !== '') {
        customFields[key] = value;
      }
    }

    return customFields;
  }
}
