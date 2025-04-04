# PriceTracker SaaS Application

PriceTracker is a SaaS application designed to help businesses monitor competitor prices, track product price changes across various sources, and gain insights into market trends through automated web scraping and data analysis.

**For detailed project planning, architecture, tech stack, setup, and development guidelines, please refer to [PLANNING.md](./PLANNING.md).**

**For the current list of active tasks, backlog, and completed work, please refer to [TASK.md](./TASK.md).**

## Features

-   **Authentication**: Secure sign-in using Google OAuth or traditional email/password via NextAuth.js and Supabase Auth.
-   **Dashboard**: Centralized overview of tracked products, competitors, and recent price fluctuations.
-   **Competitors**: Manage and organize information about competitors.
-   **Products**: See all your own and your competitors products and historical prices.
-   **CSV Management**: Download CSV templates for bulk product uploads and upload product data via CSV files.
-   **Scrapers**:
    -   AI-powered generation of web scrapers.
    -   Support for custom Python scrapers.
    -   Automated execution and scheduling of scrapers.
    -   Detailed run history, logs, and performance tracking (Products/sec).
    -   Testing and validation capabilities for scrapers.
    -   Activation and approval workflows for scrapers.
-   **Integrations** Integrate you own ecommerce to get your products and prices.
-   **Insights**: Analyze price trends and derive actionable market insights (future capability).
-   **Settings**: Configure account settings and potential third-party integrations.
-   **Admin**: User management and system-level configuration.

## Scalability Considerations

The current implementation executes Python scrapers as child processes within the Vercel serverless function environment triggered by API routes. While functional, this approach may face limitations under heavy load.

A future enhancement is planned to migrate scraper execution to **Vercel Queues** for improved scalability, reliability, and resource management. See the detailed migration plan in `docs/future/vercel-queues-migration.md` and the high-level overview in `PLANNING.md`.

## License

This project is licensed under the MIT License. (Assuming MIT - add a LICENSE file if one doesn't exist).
