"use client";

import { useState } from 'react';
import { StockBadgeDetailed } from '@/components/ui/stock-badge';
import { calculateSalesVelocity } from '@/lib/utils/stock-utils';

interface StockAnalysisTabProps {
  competitors: Array<{
    id: string;
    name: string;
    website?: string;
  }>;
  recentStockChanges: Array<{
    id: string;
    product_id: string;
    competitor_id: string;
    new_stock_quantity: number | null;
    new_stock_status: string | null;
    new_availability_date: string | null;
    stock_change_quantity: number | null;
    changed_at: string;
    url?: string;
    products?: {
      name: string;
      brand?: string;
      sku?: string;
    };
    competitors?: {
      name: string;
    };
  }>;
  stockStats: {
    totalProducts: number;
    totalStockChanges: number;
    productsWithStock: number;
    outOfStockProducts: number;
  } | null;
}

export default function StockAnalysisTab({
  competitors,
  recentStockChanges,
  stockStats: _stockStats
}: StockAnalysisTabProps) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');

  // Filter stock changes by selected competitor
  const filteredStockChanges = selectedCompetitor === 'all' 
    ? recentStockChanges 
    : recentStockChanges.filter(change => change.competitor_id === selectedCompetitor);

  // Calculate summary statistics
  const totalProducts = new Set(recentStockChanges.map(change => change.product_id)).size;
  const _totalStockChanges = recentStockChanges.length;
  const productsWithStock = recentStockChanges.filter(change => 
    change.new_stock_quantity !== null && change.new_stock_quantity > 0
  ).length;
  const outOfStockProducts = recentStockChanges.filter(change => 
    change.new_stock_quantity === 0
  ).length;

  // Calculate sales velocity for recent changes
  const salesData = recentStockChanges
    .filter(change => change.stock_change_quantity !== null && change.stock_change_quantity < 0)
    .map(change => ({
      stock_change_quantity: change.stock_change_quantity,
      changed_at: change.changed_at
    }));
  
  const salesVelocity = calculateSalesVelocity(salesData);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📦</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Tracked Products
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalProducts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">✅</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    In Stock
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {productsWithStock}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">❌</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Out of Stock
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {outOfStockProducts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📈</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Daily Sales Avg
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {salesVelocity.dailyAverage.toFixed(1)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="competitor-select" className="block text-sm font-medium text-gray-700 mb-2">
              Competitor
            </label>
            <select
              id="competitor-select"
              value={selectedCompetitor}
              onChange={(e) => setSelectedCompetitor(e.target.value)}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Competitors</option>
              {competitors.map((competitor) => (
                <option key={competitor.id} value={competitor.id}>
                  {competitor.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Recent Stock Changes */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Stock Changes
            <span className="ml-2 text-sm text-gray-500">
              ({filteredStockChanges.length} changes)
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Competitor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStockChanges.slice(0, 20).map((change) => (
                <tr key={change.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {change.products?.name || 'Unknown Product'}
                      </div>
                      {change.products?.brand && (
                        <div className="text-sm text-gray-500">
                          {change.products.brand}
                        </div>
                      )}
                      {change.products?.sku && (
                        <div className="text-xs text-gray-400">
                          SKU: {change.products.sku}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {change.competitors?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StockBadgeDetailed
                      stockQuantity={change.new_stock_quantity}
                      stockStatus={change.new_stock_status}
                      availabilityDate={change.new_availability_date}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {change.stock_change_quantity !== null ? (
                      <span className={`text-sm font-medium ${
                        change.stock_change_quantity > 0 
                          ? 'text-green-600' 
                          : change.stock_change_quantity < 0 
                            ? 'text-red-600' 
                            : 'text-gray-600'
                      }`}>
                        {change.stock_change_quantity > 0 ? '+' : ''}{change.stock_change_quantity}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(change.changed_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredStockChanges.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <p className="text-lg font-medium">No stock changes found</p>
              <p className="mt-1">Stock changes will appear here once your scrapers collect data.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
