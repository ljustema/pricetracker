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
- [x] **Products page** - Need to fix better DB integration. Now we make one req and get them all loaded. (caped at 10 000 in supabase)
- [ ] **Brands Management** - Implementation needed.
- [x] **Scrapers** (Manual build from python template) - Implementation complete with:
  - Scraper listing page
  - Scraper creation page
  - Scraper editing page
  - Scraper running page
  - API routes for all scraper operations
- [ ] **Insights** - Implementation needed.
- [ ] **Settings** - Implementation needed.
- [ ] **Admin Section** - Implementation needed.
- [ ] **Billing/Payments** (Stripe) - Implementation needed.
- [ ] **Marketing Pages** - Structure exists (`src/app/(marketing)`), implementation status unknown. (Think this is frontpage before login)
- [ ] **Ecommerce Integration** - New page for integration with different e-commerce platforms.

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
  - [x] Create a Python scraper template with clear documentation on required inputs/outputs
  - [ ] Develop a guide explaining the database schema and how scraped data is processed
  - [x] Add functionality to upload custom Python scraper scripts
  - [x] Implement a secure execution environment for running Python scrapers
  - [x] Add validation to ensure uploaded scripts meet security requirements

- [x] **Scraper UI Improvements**:
  - [x] Add an upload button for Python scraper scripts in the competitor management UI
  - [x] Create a testing interface for uploaded scrapers
  - [-] Add a scraper log viewer to help debug issues (I think we only have a error row in run_jobs, maybe need further dev)

### Testing and Validation

- [x] Test the scraping process to ensure products are correctly matched or created
- [x] Verify price changes are properly recorded
- [x] Test the UI to ensure it correctly displays competitor prices
- [x] Test Python scraper uploads and execution

### Architecture / Scalability Improvements

- [ ] **Migrate Scraper Execution to Vercel Queues**: Implement the plan outlined in `docs/future/vercel-queues-migration.md` to improve scalability and reliability of the scraping process by decoupling it from synchronous API route execution.

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

## Python Scraper Guide

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