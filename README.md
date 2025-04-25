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
    -   Testing and validation capabilities for scrapers, including Python script syntax checking and linting using `flake8`.
    -   Activation and approval workflows for scrapers.
-   **Integrations** Integrate you own ecommerce to get your products and prices.
-   **Insights**: Analyze price trends and derive actionable market insights (future capability).
-   **Settings**: Configure account settings and potential third-party integrations.
-   **Admin**: User management and system-level configuration.

## Python Script Validation

PriceTracker supports validation of custom Python scraper scripts before approval and execution. This validation includes:

- **Syntax checking** to ensure scripts are free of syntax errors.
- **Linting** using [`flake8`](https://flake8.pycqa.org/) to enforce Python style and catch common issues.

### Requirements

- Python 3.x installed on the system.
- `flake8` installed and accessible in the environment (`pip install flake8`).

### How to Use

- When adding or editing a Python scraper via the UI, the system automatically performs validation before saving.
- Alternatively, validation can be triggered via the `/api/scrapers/validate-script` API endpoint.

### Testing Validation

Automated tests have been added to verify the Python validation functionality. To run all tests, use your standard test command, for example:

\`\`\`bash
npm test
\`\`\`

This will execute the test suite, including tests for script validation.

## Worker Architecture

PriceTracker uses a decoupled architecture with separate worker services for executing scrapers:

- **Web Service**: The Next.js application that handles the user interface and API requests
- **Python Worker**: A dedicated service for executing Python scrapers
- **TypeScript Worker**: A dedicated service for executing TypeScript scrapers

This architecture improves reliability, scalability, and maintainability by separating the web application from the resource-intensive scraping tasks. For deployment, the plan is to use Railway with three separate services.

See the detailed architecture documentation in `docs/architecture/worker-architecture.md` and the high-level overview in `PLANNING.md`.

## License

This project is licensed under the MIT License. (Assuming MIT - add a LICENSE file if one doesn't exist).
