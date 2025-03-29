# PriceTracker Project TODO

## Project Status

### Core Features Status

- [x] **Authentication** (Google, Email/Password) - Basic implementation complete with Google OAuth.
- [x] **Dashboard** - Basic implementation complete with stats overview and quick actions.
- [x] **Competitors Management** - Implementation complete with listing, adding, editing, and deleting competitors.
- [x] **Products Management** - Basic implementation complete with:
  - Product listing page
  - Product detail page with competitor price comparison
  - Price history visualization
  - API routes for product operations
- [ ] **Brands Management** - Implementation needed.
- [x] **Scrapers** (AI-Powered) - Implementation complete with:
  - Scraper listing page
  - Scraper creation page
  - Scraper editing page
  - Scraper running page
  - API routes for all scraper operations
- [ ] **Insights** - Implementation needed.
- [ ] **Settings** - Implementation needed.
- [ ] **Admin Section** - Implementation needed.
- [ ] **Billing/Payments** (Stripe) - Implementation needed.
- [ ] **Marketing Pages** - Structure exists (`src/app/(marketing)`), implementation status unknown.

### Development Processes

- [x] Modular architecture established with feature-based organization.
- [x] Process for adding new features defined.
- [x] Process for database migrations defined.

### Deployment

- [ ] Set up production Supabase instance.
- [ ] Configure Vercel deployment (or other provider).
- [ ] Add production environment variables.

## Completed Tasks

### Project Structure Reorganization

- [x] Moved service files from `/src/slices/*/lib/` to `/src/lib/services/`:
  - `/src/slices/products/lib/product-service.ts` → `/src/lib/services/product-service.ts`
  - `/src/slices/products/lib/product-client-service.ts` → `/src/lib/services/product-client-service.ts`
  - `/src/slices/scraper/lib/scraper-service.ts` → `/src/lib/services/scraper-service.ts`
  - `/src/slices/scraper/lib/scraper-client-service.ts` → `/src/lib/services/scraper-client-service.ts`
- [x] Moved components from `/src/slices/*/components/` to `/src/components/`:
  - `/src/slices/products/components/product-card.tsx` → `/src/components/products/product-card.tsx`
  - `/src/slices/scraper/components/scraper-form.tsx` → `/src/components/scrapers/scraper-form.tsx`
  - `/src/slices/scraper/components/test-results-modal.tsx` → `/src/components/scrapers/test-results-modal.tsx`
- [x] Updated imports in all files to reflect the new structure
- [x] Deleted the `/src/slices/` directory after confirming all files were moved

### Database Updates

- [x] Modified the `scraped_products` table to make `scraper_id` nullable
- [x] Enhanced the `record_price_change()` trigger function
  - Improved product matching logic using EAN or Brand+SKU
  - Added automatic product creation when no match is found
  - Maintained the optimization to only create entries in `price_changes` when the price has actually changed
- [x] Added indexes to improve performance:
  - Added index on `products(ean)` for faster lookups by EAN
  - Added index on `products(brand, sku)` for faster lookups by brand and SKU combination

### API Routes

- [x] Removed `/api/products/[productId]/link-scrapers/route.ts`
- [x] Removed `/api/products/[productId]/link-competitors/route.ts`
- [x] Created new `/api/products/[productId]/prices/route.ts` for fetching price history
- [x] Updated the scraper run route to implement the new product matching logic

### Code Changes

#### Scraper Service

- [x] Updated the ScrapedProduct interface:
  - Made `scraper_id` optional
  - Added `ean` field for product matching
  - Added `product_id` field for linking to existing products
- [x] Enhanced the runScraper method:
  - Added product matching logic using EAN or Brand+SKU
  - Implemented automatic linking to existing products
  - Prepared data for the database trigger to handle product creation when no match is found

#### Product Service

- [x] Removed `linkScrapersToProduct` and `linkCompetitorsToProduct` methods
- [x] Added new data structures and functions:
  - Created `ProductWithPrices` interface to include competitor prices with products
  - Implemented `getProductsWithPrices()` function to fetch products with their latest competitor prices
  - Added proper type definitions for price data
- [x] Added methods to track price history and changes

#### UI Components

- [x] Updated the ProductCard component:
  - Added display of competitor prices
  - Implemented visual indicators for price comparisons (red for lower competitor prices, green for higher)
  - Limited display to 3 competitors with a count of additional competitors
- [x] Updated the Products List Page:
  - Added filtering by brand and category
  - Added sorting options (name, price, newest)
  - Added option to show/hide inactive products
  - Implemented ProductsFilter component for filter controls
- [x] Removed "Link to Competitors" button from product detail page
- [x] Removed link pages
- [x] Added price history visualization with a simple bar chart
- [x] Updated the product detail page to show competitor prices from `price_changes`

### Implementation Challenges and Solutions

- [x] **Row Level Security (RLS) Issues**: When using client-side Supabase clients in server components or API routes, RLS policies blocked operations.
  - **Solution**: Created API routes that use the Supabase service role key to bypass RLS while still maintaining security checks in the code.

- [x] **Database Schema Compatibility**: Some fields referenced in the code didn't match the actual database schema.
  - **Solution**: Updated code to use the correct field names (e.g., 'notes' instead of 'description', removed 'active_scrapers').

- [x] **Client vs. Server Components**: Mixing server and client operations caused issues.
  - **Solution**: Properly separated client and server concerns, using API routes for database operations.

- [x] **NextAuth.js and Supabase Auth Integration**: NextAuth.js stores users in the "next_auth.users" table, but the database schema has foreign key constraints to "auth.users".
  - **Solution**: Created a SQL function `create_user_for_nextauth` that creates a user in the "auth.users" table for NextAuth.js users, and updated the API routes to check and create users as needed.

- [x] **User ID Format Mismatch**: When adding competitors through the API, the NextAuth user ID was converted to a UUID, but when fetching competitors, the raw session.user.id was used without conversion.
  - **Solution**: Added the same UUID conversion function to the competitors page and used the Supabase admin client to bypass RLS, ensuring consistent user ID handling across the application.

- [x] **Project Structure Reorganization**: The initial vertical slice architecture led to code duplication and made it difficult to share functionality between features.
  - **Solution**: Restructured the project to use a more modular approach, moving service files to `/src/lib/services/` and components to feature-based directories in `/src/components/`. This improved code organization and reusability.

- [x] **Manual Product Linking**: The initial implementation required manual linking of products to competitors and scrapers, which was cumbersome and error-prone.
  - **Solution**: Redesigned the system to automatically match products during scraping and track prices directly in the `price_changes` table, eliminating the need for manual linking.

## Remaining Tasks / Next Steps

### Competitor Scraping Improvements (Priority)

- [ ] **Python Scraper Support**:
  - [ ] Create a Python scraper template with clear documentation on required inputs/outputs
  - [ ] Develop a guide explaining the database schema and how scraped data is processed
  - [ ] Add functionality to upload custom Python scraper scripts
  - [ ] Implement a secure execution environment for running Python scrapers
  - [ ] Add validation to ensure uploaded scripts meet security requirements

- [ ] **Scraper UI Improvements**:
  - [ ] Add an upload button for Python scraper scripts in the competitor management UI
  - [ ] Create a testing interface for uploaded scrapers
  - [ ] Add a scraper log viewer to help debug issues

### Testing and Validation

- [ ] Test the scraping process to ensure products are correctly matched or created
- [ ] Verify price changes are properly recorded
- [ ] Test the UI to ensure it correctly displays competitor prices
- [ ] Test Python scraper uploads and execution

### E-commerce Integration

- [ ] Implement API imports from e-commerce platforms (Prestashop)
- [ ] This will automatically update our products and prices in the `products` table
- [ ] The integration will match existing products by EAN or Brand+SKU to avoid duplicates

### Core Features Implementation

- [ ] Implement Brands Management feature
- [ ] Implement Insights feature
- [ ] Implement Settings feature
- [ ] Implement Admin Section
- [ ] Implement Billing/Payments with Stripe
- [ ] Write comprehensive tests (unit, integration, end-to-end)
- [ ] Refine and execute the deployment process
- [ ] Update documentation with more specific details as features are implemented

## Benefits of Current Implementation

1. **Simplified User Experience**: No need for manual linking of products to competitors or scrapers
2. **Automatic Product Management**: Products are automatically matched or created during scraping
3. **Direct Competitor Price Tracking**: Prices are directly associated with competitors
4. **Historical Data**: Only actual price changes are tracked in the `price_changes` table, avoiding duplicate data
5. **Improved Performance**: Reduced database complexity, better indexing, and optimized storage

## Price Storage Strategy

- **Our Current Prices**: Store in the `products` table using the existing `our_price` and `cost_price` fields
- **Competitor Prices**: Store in the `price_changes` table, with entries only created when prices actually change
- **Our Price History**: For future implementation, we could either:
  - Add our own price changes to the `price_changes` table with a special competitor_id
  - Create a separate table if we need different tracking logic for our prices

## Python Scraper Template and Guide

### Python Scraper Template Structure

```python
# pricetracker_scraper_template.py

"""
PriceTracker Python Scraper Template

This template provides the structure for creating custom Python scrapers
for the PriceTracker application. Implement the required functions below
to create a working scraper that can be uploaded to the application.
"""

import json
from typing import Dict, List, Optional, Any

# Configuration (will be populated by the system)
COMPETITOR_ID = "{{competitor_id}}"
USER_ID = "{{user_id}}"

def get_metadata() -> Dict[str, Any]:
    """
    Return metadata about this scraper.
    
    This function is required and will be called when the scraper is uploaded.
    """
    return {
        "name": "My Custom Scraper",  # Change this to your scraper name
        "description": "Scrapes product data from example.com",  # Brief description
        "version": "1.0.0",
        "author": "Your Name",
        "target_url": "https://example.com/products",  # The main URL this scraper targets
        "required_libraries": [  # List any third-party libraries your scraper needs
            "requests",
            "beautifulsoup4"
        ]
    }

def scrape() -> List[Dict[str, Any]]:
    """
    Main scraping function. Implement your scraping logic here.
    
    Returns:
        A list of dictionaries, each representing a scraped product with the following fields:
        - name (required): Product name
        - price (required): Product price as a float
        - currency (optional): Currency code (default: USD)
        - url (optional): URL to the product page
        - image_url (optional): URL to the product image
        - sku (optional): Product SKU/code from the competitor
        - brand (optional): Product brand
        - ean (optional): Product EAN/barcode
    """
    # Implement your scraping logic here
    # Example:
    scraped_products = [
        {
            "name": "Example Product 1",
            "price": 19.99,
            "currency": "USD",
            "url": "https://example.com/product1",
            "image_url": "https://example.com/images/product1.jpg",
            "sku": "PROD001",
            "brand": "Example Brand",
            "ean": "1234567890123"
        },
        # Add more products as needed
    ]
    
    return scraped_products

def test(url: str) -> List[Dict[str, Any]]:
    """
    Test function that will be called when testing the scraper.
    
    Args:
        url: A specific URL to test the scraper on
        
    Returns:
        Same format as the scrape() function
    """
    # Implement test logic here, usually a simplified version of scrape()
    # that works on a single page
    
    # Example:
    return [
        {
            "name": "Test Product",
            "price": 29.99,
            "currency": "USD",
            "url": url,
            "image_url": "https://example.com/images/test.jpg",
            "sku": "TEST001",
            "brand": "Test Brand",
            "ean": "1234567890123"
        }
    ]

# Don't modify this section - it's used by the application to run the scraper
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "metadata":
            print(json.dumps(get_metadata()))
        elif command == "test" and len(sys.argv) > 2:
            test_url = sys.argv[2]
            print(json.dumps(test(test_url)))
        elif command == "scrape":
            print(json.dumps(scrape()))
        else:
            print(json.dumps({"error": "Invalid command"}))
    else:
        print(json.dumps({"error": "No command provided"}))
```

### Scraper Guide Documentation

The guide will include:

1. **Database Schema Overview**:
   - Explanation of the `scrapers`, `scraped_products`, and `price_changes` tables
   - How product matching works using EAN or Brand+SKU
   - How price changes are tracked

2. **Scraper Development Guidelines**:
   - Best practices for web scraping (respecting robots.txt, rate limiting, etc.)
   - Error handling and logging recommendations
   - Performance considerations

3. **Testing and Debugging**:
   - How to use the test function to validate scraper functionality
   - Common issues and troubleshooting steps
   - How to interpret scraper logs

4. **Security Requirements**:
   - Prohibited operations and functions
   - Data handling requirements
   - Authentication and credential management

5. **Deployment Process**:
   - How to upload a scraper to the application
   - How to schedule scraper runs
   - How to monitor scraper performance