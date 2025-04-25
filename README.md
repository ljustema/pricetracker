# PriceTracker SaaS Application

PriceTracker is a SaaS application designed to help businesses monitor competitor prices, track product price changes across various sources, and gain insights into market trends through automated web scraping and data analysis.

## Features

-   **Authentication**: Secure sign-in using Google OAuth or traditional email/password via NextAuth.js and Supabase Auth.
-   **Dashboard**: Centralized overview of tracked products, competitors, and recent price fluctuations.
-   **Competitors**: Manage and organize information about competitors.
-   **Products**: See all your own and your competitors products and historical prices.
-   **Brands**: Manage and organize information about brands.
-   **Insights**: Analyze price trends and derive actionable market insights.
-   **Scrapers**: AI-powered generation of web scrapers. Support for custom Python scrapers and TypeScript scrapers.
-   **Integrations** Integrate you own ecommerce to get your products and prices.
-   **Settings**: Configure account settings and potential third-party integrations.
-   **Admin**: User management and system-level configuration.

## Worker Architecture

PriceTracker uses a decoupled architecture with separate worker services for executing scrapers:

- **Web Service**: The Next.js application that handles the user interface and API requests
- **Python Worker**: A dedicated service for executing Python scrapers
- **TypeScript Worker**: A dedicated service for executing TypeScript scrapers
- **TypeScript Utility Worker**: A dedicated service for handling integrations and other utility tasks

This architecture improves reliability, scalability, and maintainability by separating the web application from the resource-intensive scraping tasks.
For more details, see [worker-architecture.md](./docs/architecture/worker-architecture.md).

## Deployment

PriceTracker is designed to be deployed on Railway with four separate services:

1. **Main Web Service**: The Next.js application
2. **Python Worker**: For executing Python scrapers
3. **TypeScript Worker**: For executing TypeScript scrapers
4. **TypeScript Utility Worker**: For handling integrations and other utility tasks

For detailed deployment instructions, see [DEPLOYMENT.md](./docs/deployment/DEPLOYMENT.md).

## License

This project is licensed under the MIT License. (Assuming MIT - add a LICENSE file if one doesn't exist).
