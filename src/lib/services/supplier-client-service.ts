import { Supplier, SupplierPriceChange } from './supplier-service';

/**
 * Client-side service for supplier operations
 */
export class SupplierClientService {
  /**
   * Fetch all suppliers for the current user
   */
  static async getSuppliers(): Promise<Supplier[]> {
    const response = await fetch('/api/suppliers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch suppliers');
    }

    return response.json();
  }

  /**
   * Fetch a specific supplier by ID
   */
  static async getSupplier(supplierId: string): Promise<Supplier> {
    const response = await fetch(`/api/suppliers/${supplierId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch supplier');
    }

    return response.json();
  }

  /**
   * Create a new supplier
   */
  static async createSupplier(supplierData: Omit<Supplier, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supplierData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create supplier');
    }

    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  /**
   * Update an existing supplier
   */
  static async updateSupplier(
    supplierId: string,
    supplierData: Partial<Omit<Supplier, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Supplier> {
    const response = await fetch(`/api/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supplierData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update supplier');
    }

    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  /**
   * Delete a supplier
   */
  static async deleteSupplier(supplierId: string): Promise<void> {
    const response = await fetch(`/api/suppliers/${supplierId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete supplier');
    }
  }

  /**
   * Fetch supplier price changes
   */
  static async getSupplierPrices(supplierId: string, productId?: string): Promise<SupplierPriceChange[]> {
    const url = new URL(`/api/suppliers/${supplierId}/prices`, window.location.origin);
    if (productId) {
      url.searchParams.set('productId', productId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch supplier prices');
    }

    return response.json();
  }

  /**
   * Create a new supplier price change
   */
  static async createSupplierPrice(
    supplierId: string,
    priceData: Omit<SupplierPriceChange, 'id' | 'user_id' | 'supplier_id' | 'changed_at'>
  ): Promise<SupplierPriceChange> {
    const response = await fetch(`/api/suppliers/${supplierId}/prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(priceData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create supplier price');
    }

    return response.json();
  }
}

/**
 * Upload a CSV file with supplier products
 */
export async function uploadSupplierProductsCSV(
  supplierId: string,
  file: File
): Promise<{ success: boolean; productsAdded: number; pricesUpdated: number }> {
  const formData = new FormData();
  formData.append('supplierId', supplierId);
  formData.append('file', file);

  const response = await fetch('/api/products/csv-upload-suppliers', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload supplier CSV file');
  }

  return response.json();
}
