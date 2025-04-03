# PriceTracker Planning Document

**Purpose:** High-level vision, architecture, constraints, tech stack, tools, etc. To be referenced by AI assistants using the prompt: “Use the structure and decisions outlined in PLANNING.md.”

## 1. Project Overview

PriceTracker is a SaaS application designed to help businesses monitor competitor prices, track product price changes across various sources, and gain insights into market trends through automated web scraping and data analysis.

## 2. Core Features

-   **Authentication**: Secure sign-in using Google OAuth or traditional email/password via NextAuth.js and Supabase Auth.
-   **Dashboard**: Centralized overview of tracked products, competitors, and recent price fluctuations.
-   **Competitors**: Manage and organize information about competitors.
-   **Products**: Track your own products, link them to competitor equivalents, and compare prices.
-   **CSV Management**: Download CSV templates for bulk product uploads and upload product data via CSV files.
-   **Scrapers**:
    -   AI-powered generation of web scrapers.
    -   Support for custom Python scrapers.
    -   Automated execution and scheduling of scrapers.
    -   Detailed run history, logs, and performance tracking (Products/sec).
    -   Testing and validation capabilities for scrapers.
    -   Activation and approval workflows for scrapers.
-   **Product Linking**: Associate your products with specific scrapers and competitor entries.
-   **Price History**: View historical price data for tracked products.
-   **Insights**: Analyze price trends and derive actionable market insights (future capability).
-   **Settings**: Configure account settings and potential third-party integrations.
-   **Admin**: User management and system-level configuration.

## 3. Tech Stack

-   **Framework**: Next.js 15.2.4 (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS 4, shadcn/ui (via `components.json`), Tailwind Merge, clsx, Tailwind CSS Animate
-   **UI Components**: Radix UI Primitives, Lucide Icons
-   **Backend**: Next.js API Routes
-   **Authentication**: NextAuth.js (v4) with Supabase Adapter, Google Provider
-   **Database**: Supabase (PostgreSQL)
-   **Payments**: Stripe (Integration via `stripe-js` and backend library)
-   **State Management**: React Context API (via Providers)
-   **Linting/Formatting**: ESLint 9
-   **Architecture**: Feature-based organization (similar to Vertical Slices)

## 4. System Architecture

### 4.1. Overall System Diagram

```mermaid
graph TD
    A["User Browser"] --> B["Next.js Frontend (React 19, Tailwind)"]
    B --> C["Next.js API Routes"]
    C --> D["Supabase (Auth, DB - PostgreSQL)"]
    C --> E["Stripe API"]
    C --> F["Python Scraper Execution"]
    D -- "Data/Auth" --> C
    E -- "Payment Status" --> C
    F -- "Scraped Data" --> C
```

### 4.2. Scraping Process Flow

```mermaid
flowchart TD
    A[Start Scraping] --> B[Scraper runs and collects product data]
    B --> C[Store data in scraped_products table]
    C --> D{Match with existing product?}
    D -->|Yes, by EAN| E[Link to existing product]
    D -->|Yes, by Brand+SKU| E
    D -->|No match found| F{Has EAN or Brand+SKU?}
    F -->|Yes| G[Create new product]
    F -->|No| H[Ignore product - insufficient data]
    E --> I[Check for price changes]
    G --> I
    H --> J[End process]
    I -->|Price changed| K[Record in price_changes table]
    I -->|No price change| J
    K --> J
```

### 4.3. Data Storage Strategy

```mermaid
flowchart LR
    subgraph "Temporary Storage"
        A[scraped_products]
    end

    subgraph "Permanent Storage"
        B[products]
        C[price_changes]
    end

    A -->|Match & Link| B
    A -->|Record Price Changes| C

    subgraph "Our Prices"
        D[products.our_price]
        E[products.cost_price]
    end

    subgraph "Competitor Prices"
        F[price_changes table]
    end
```

### 4.4. Database Relationships

```mermaid
erDiagram
    USERS ||--o{ COMPETITORS : owns
    USERS ||--o{ PRODUCTS : owns
    COMPETITORS ||--o{ SCRAPERS : has
    COMPETITORS ||--o{ SCRAPED_PRODUCTS : provides
    SCRAPERS ||--o{ SCRAPED_PRODUCTS : generates
    PRODUCTS ||--o{ PRICE_CHANGES : tracks
    COMPETITORS ||--o{ PRICE_CHANGES : provides
    SCRAPED_PRODUCTS }|--o| PRODUCTS : matches
```

## 5. Scalability Considerations

The current implementation executes Python scrapers as child processes within the Vercel serverless function environment. This may face limitations under heavy load.

A future enhancement is planned to migrate scraper execution to **Vercel Queues**. See details in:
-   `README.md` (Scalability Considerations section)
-   `docs/future/vercel-queues-migration.md`

## 6. Project Structure

```
pricetracker/
├── .env.local              # Local environment variables (ignored by git)
├── .gitignore              # Specifies intentionally untracked files
├── components.json         # shadcn/ui configuration
├── next.config.ts          # Next.js configuration
├── package.json            # Project dependencies and scripts
├── README.md               # Main project readme
├── PLANNING.md             # This file
├── TASK.md                 # Task tracking file
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── public/                 # Static assets
│   └── ...
├── scripts/                # Database setup and migration scripts
│   ├── database-README.md
│   ├── database-setup.sql
│   └── migration-*.sql
├── src/
│   ├── app/                # Next.js App Router pages and layouts
│   │   ├── (app)/          # Authenticated application routes (e.g., dashboard)
│   │   ├── (auth)/         # Authentication routes (e.g., login, signup)
│   │   ├── (marketing)/    # Public/marketing pages (e.g., landing page)
│   │   ├── admin/          # Admin-specific routes
│   │   ├── api/            # API route handlers organized by feature
│   │   │   ├── auth/
│   │   │   ├── competitors/
│   │   │   ├── products/
│   │   │   ├── scrapers/
│   │   │   └── webhooks/
│   │   ├── favicon.ico
│   │   ├── globals.css     # Global styles
│   │   └── layout.tsx      # Root application layout
│   ├── components/         # React components organized by feature/UI
│   │   ├── layout/         # Page layout components (header, sidebar, etc.)
│   │   ├── products/       # Components related to product features
│   │   ├── providers/      # React Context providers (e.g., AuthProvider)
│   │   ├── scrapers/       # Components related to scraper features
│   │   └── ui/             # Generic UI components (Button, Dialog, Table - often from shadcn/ui)
│   └── lib/                # Shared libraries, utilities, and services
│       ├── auth/           # Authentication configuration and utilities (NextAuth options, adapter)
│       ├── db/             # Database related utilities (if any beyond Supabase client)
│       ├── services/       # Business logic services, organized by feature
│       │   ├── product-client-service.ts
│       │   ├── product-service.ts
│       │   ├── scraper-ai-service.ts
│       │   ├── scraper-client-service.ts
│       │   ├── scraper-creation-service.ts
│       │   ├── scraper-crud-service.ts
│       │   ├── scraper-execution-service.ts
│       │   ├── scraper-management-service.ts
│       │   ├── scraper-service.ts
│       │   └── scraper-types.ts
│       ├── stripe/         # Stripe client and server utilities
│       ├── supabase/       # Supabase client and server initializers
│       └── utils/          # General utility functions (e.g., cn, date formatting)
└── ...                     # Other config files (ESLint, PostCSS, etc.)
```

## 7. Development Process

### 7.1. Adding a New Feature

1.  **Components**: Create feature-specific components under `src/components/[feature-name]/`. Use shared UI components from `src/components/ui/`.
2.  **Services**: Implement business logic within new or existing services in `src/lib/services/`. Define necessary types (e.g., in `scraper-types.ts` or a new `[feature]-types.ts`).
3.  **API Routes**: If backend interaction is needed, add API routes under `src/app/api/[feature-name]/`. Use services to handle logic.
4.  **Pages**: Create new pages/routes within the appropriate group in `src/app/` (e.g., `(app)`, `(auth)`). Fetch data using Server Components or client-side calls to API routes.
5.  **Database**: If schema changes are required, update `scripts/database-setup.sql` or create a new migration script (`scripts/migration-XXX.sql`) and update `database-README.md`.

### 7.2. Database Changes

Follow the process outlined in `scripts/database-README.md`. Generally:
1.  Backup existing data if necessary.
2.  Modify `database-setup.sql` for initial setup changes or create a new `migration-XXX.sql` script for incremental changes.
3.  Apply the SQL script(s) to your Supabase instance via the SQL Editor.
4.  Test thoroughly.

## 8. Setup & Installation

### 8.1. Prerequisites

-   Node.js 20+ and npm (as indicated by `@types/node: ^20`)
-   Supabase account and project setup
-   Google OAuth credentials configured in Supabase Auth
-   Stripe account and API keys

### 8.2. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # For backend operations

# NextAuth
NEXTAUTH_SECRET=generate_a_strong_secret # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000 # Or your deployment URL

# Google OAuth (for NextAuth)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret_url

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret # For handling Stripe events
```

### 8.3. Database Setup

1.  Navigate to the `scripts/` directory.
2.  Review the `database-README.md` for detailed instructions.
3.  Execute the SQL commands in `database-setup.sql` against your Supabase project's SQL Editor. This script creates the necessary tables, functions, and triggers.
4.  Apply any subsequent migration scripts found in the `scripts/` directory (e.g., `migration-001-scraper-runs-enhancements.sql`) in order.

### 8.4. Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Or run with Turbopack (experimental)
npm run dev:turbo

# Build for production
npm run build

# Start production server
npm run start

# Lint the code
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 9. Deployment

### 9.1. Vercel (Recommended)

1.  Push your code to a Git provider (GitHub, GitLab, Bitbucket).
2.  Create a new project on Vercel and connect your repository.
3.  Configure the Environment Variables in the Vercel project settings (matching your `.env.local` but with production values).
4.  Set the Build Command (usually `npm run build`) and Output Directory (`.next`).
5.  Deploy. Vercel will automatically build and deploy upon pushes to the connected branch.

### 9.2. Supabase Setup for Production

1.  Create a dedicated Supabase project for your production environment.
2.  Run the database setup and migration scripts (`scripts/*.sql`) against the production Supabase project.
3.  Ensure Row Level Security (RLS) is enabled and properly configured for all tables containing sensitive data.
4.  Use the production Supabase URL and keys in your Vercel environment variables.

### 9.3. Known Deployment Issues & Fixes

Refer to `docs/vercel-deployment-fixes.md` for details on past issues related to TypeScript compatibility and folder naming conventions with Vercel.

## 10. Core Concepts

### 10.1. Product Matching Logic

```mermaid
flowchart TD
    A[New scraped product] --> B{Has EAN?}
    B -->|Yes| C[Search for product with matching EAN]
    B -->|No| F{Has Brand and SKU?}

    C --> D{Match found?}
    D -->|Yes| E[Link to existing product]
    D -->|No| F

    F -->|Yes| G[Search for product with matching Brand+SKU]
    F -->|No| N[Ignore product - insufficient data]

    G --> H{Match found?}
    H -->|Yes| I[Link to existing product]
    H -->|No| J[Create new product]

    E --> K[Check for price changes]
    I --> K
    J --> K
    N --> M[End process]

    K -->|Price changed| L[Record in price_changes table]
    K -->|No change| M
    L --> M
```

### 10.2. Price Storage Strategy

-   **Our Current Prices**: Store in the `products` table using the existing `our_price` and `cost_price` fields.
-   **Competitor Prices**: Store in the `price_changes` table, with entries only created when prices actually change.
-   **Our Price History**: For future implementation, we could either:
    -   Add our own price changes to the `price_changes` table with a special competitor_id.
    -   Create a separate table if we need different tracking logic for our prices.

### 10.3. Python Scraper Guidelines

The guide (to be created in `TASK.md`) will include:
1.  Database Schema Overview
2.  Scraper Development Guidelines
3.  Testing and Debugging
4.  Security Requirements
5.  Deployment Process