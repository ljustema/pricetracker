# PriceTracker SaaS Application

PriceTracker is a SaaS application designed to help businesses monitor competitor prices, track product price changes across various sources, and gain insights into market trends through automated web scraping and data analysis.

## Features

- **Authentication**: Secure sign-in using Google OAuth or traditional email/password via NextAuth.js and Supabase Auth.
- **Dashboard**: Centralized overview of tracked products, competitors, and recent price fluctuations.
- **Competitors**: Manage and organize information about competitors.
- **Products**: Track your own products, link them to competitor equivalents, and compare prices.
- **CSV Management**: Download CSV templates for bulk product uploads and upload product data via CSV files.
- **Scrapers**:
    - AI-powered generation of web scrapers.
    - Support for custom Python scrapers.
    - Automated execution and scheduling of scrapers.
    - Detailed run history, logs, and performance tracking (Products/sec).
    - Testing and validation capabilities for scrapers.
    - Activation and approval workflows for scrapers.
- **Product Linking**: Associate your products with specific scrapers and competitor entries.
- **Price History**: View historical price data for tracked products.
- **Insights**: Analyze price trends and derive actionable market insights (future capability).
- **Settings**: Configure account settings and potential third-party integrations.
- **Admin**: User management and system-level configuration.

## Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui (via `components.json`), Tailwind Merge, clsx, Tailwind CSS Animate
- **UI Components**: Radix UI Primitives, Lucide Icons
- **Backend**: Next.js API Routes
- **Authentication**: NextAuth.js (v4) with Supabase Adapter, Google Provider
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (Integration via `stripe-js` and backend library)
- **State Management**: React Context API (via Providers)
- **Linting/Formatting**: ESLint 9
- **Architecture**: Feature-based organization (similar to Vertical Slices)

## System Architecture

```mermaid
graph TD
    A[User Browser] --> B[Next.js Frontend (React 19, Tailwind)]
    B --> C[Next.js API Routes]
    C --> D[Supabase (Auth, DB - PostgreSQL)]
    C --> E[Stripe API]
    C --> F[Python Scraper Execution]
    D -- Data/Auth --> C
    E -- Payment Status --> C
    F -- Scraped Data --> C
```

### Scalability Considerations

The current implementation executes Python scrapers as child processes within the Vercel serverless function environment triggered by API routes. While functional, this approach may face limitations under heavy load.

A future enhancement is planned to migrate scraper execution to **Vercel Queues** for improved scalability, reliability, and resource management. See the detailed migration plan in `docs/future/vercel-queues-migration.md`.

## Getting Started

### Prerequisites

- Node.js 20+ and npm (as indicated by `@types/node: ^20`)
- Supabase account and project setup
- Google OAuth credentials configured in Supabase Auth
- Stripe account and API keys

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # For backend operations

# NextAuth
NEXTAUTH_SECRET=generate_a_strong_secret # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000 # Or your deployment URL

# NextAuth Google Provider (configured via Supabase dashboard usually)
# Ensure Google Provider is enabled in Supabase Auth settings

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret # For handling Stripe events
```

### Database Setup

1.  Navigate to the `scripts/` directory.
2.  Review the `database-README.md` for detailed instructions.
3.  Execute the SQL commands in `database-setup.sql` against your Supabase project's SQL Editor. This script creates the necessary tables, functions, and triggers.
4.  Apply any subsequent migration scripts found in the `scripts/` directory (e.g., `migration-001-scraper-runs-enhancements.sql`) in order.

### Installation

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

## Project Structure

```
pricetracker/
├── .env.local              # Local environment variables (ignored by git)
├── .gitignore              # Specifies intentionally untracked files
├── components.json         # shadcn/ui configuration
├── next.config.ts          # Next.js configuration
├── package.json            # Project dependencies and scripts
├── README.md               # This file
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

## Development

### Adding a New Feature

1.  **Components**: Create feature-specific components under `src/components/[feature-name]/`. Use shared UI components from `src/components/ui/`.
2.  **Services**: Implement business logic within new or existing services in `src/lib/services/`. Define necessary types (e.g., in `scraper-types.ts` or a new `[feature]-types.ts`).
3.  **API Routes**: If backend interaction is needed, add API routes under `src/app/api/[feature-name]/`. Use services to handle logic.
4.  **Pages**: Create new pages/routes within the appropriate group in `src/app/` (e.g., `(app)`, `(auth)`). Fetch data using Server Components or client-side calls to API routes.
5.  **Database**: If schema changes are required, update `scripts/database-setup.sql` or create a new migration script (`scripts/migration-XXX.sql`) and update `database-README.md`.

### Version Control

The `.gitignore` file is configured to exclude common files like `node_modules`, `.next`, local environment files (`.env*.local`), and build artifacts. Review it before committing to ensure no sensitive data or unnecessary files are included.

### Database Changes

Follow the process outlined in `scripts/database-README.md`. Generally:
1.  Backup existing data if necessary.
2.  Modify `database-setup.sql` for initial setup changes or create a new `migration-XXX.sql` script for incremental changes.
3.  Apply the SQL script(s) to your Supabase instance via the SQL Editor.
4.  Test thoroughly.

## Deployment

### Vercel (Recommended)

1.  Push your code to a Git provider (GitHub, GitLab, Bitbucket).
2.  Create a new project on Vercel and connect your repository.
3.  Configure the Environment Variables in the Vercel project settings (matching your `.env.local` but with production values).
4.  Set the Build Command (usually `npm run build`) and Output Directory (`.next`).
5.  Deploy. Vercel will automatically build and deploy upon pushes to the connected branch.

### Supabase Setup for Production

1.  Create a dedicated Supabase project for your production environment.
2.  Run the database setup and migration scripts (`scripts/*.sql`) against the production Supabase project.
3.  Ensure Row Level Security (RLS) is enabled and properly configured for all tables containing sensitive data.
4.  Use the production Supabase URL and keys in your Vercel environment variables.

## License

This project is licensed under the MIT License. (Assuming MIT - add a LICENSE file if one doesn't exist).
