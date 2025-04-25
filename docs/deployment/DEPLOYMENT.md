# Deploying PriceTracker to Railway

This document provides detailed instructions for deploying the PriceTracker application to Railway.

## Overview

PriceTracker uses a decoupled architecture with four separate services:

1. **Main Web Service**: The Next.js application that handles the user interface and API requests
2. **Python Worker**: A dedicated service for executing Python scrapers
3. **TypeScript Worker**: A dedicated service for executing TypeScript scrapers
4. **TypeScript Utility Worker**: A dedicated service for handling integrations and other utility tasks

Each service is deployed as a separate Railway service, allowing for independent scaling and resource allocation.

## Prerequisites

- A Railway account
- A GitHub repository containing the PriceTracker codebase
- Supabase project with the required tables and functions
- Environment variables for connecting to Supabase and other services

## Environment Variables

All services require the following environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

The Main Web Service additionally requires:

- `GOOGLE_CLIENT_ID`: Google OAuth client ID (for authentication)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret (for authentication)
- `NEXTAUTH_SECRET`: A secret for NextAuth.js session encryption
- `NEXTAUTH_URL`: The URL of your deployed application

The Python Worker additionally requires:

- `DATABASE_URL`: PostgreSQL connection string for the Supabase database
- `WORKER_POLL_INTERVAL`: (Optional) Interval in seconds for polling for new jobs (default: 5)

## Deployment Steps

### 1. Main Web Service

1. Create a new Railway project or use an existing one
2. Add a new service from GitHub
3. Select the GitHub repository containing the PriceTracker codebase
4. Configure the service:
   - Root Directory: `/` (root of the repository)
   - Build Command: `yarn install && yarn build`
   - Start Command: `yarn start`
5. Add the required environment variables
6. Deploy the service

### 2. Python Worker

1. In the same Railway project, add a new service from GitHub
2. Select the same GitHub repository
3. Configure the service:
   - Root Directory: `src/workers/py-worker`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python main.py`
4. Add the required environment variables
5. Deploy the service

### 3. TypeScript Worker

1. In the same Railway project, add a new service from GitHub
2. Select the same GitHub repository
3. Configure the service:
   - Root Directory: `src/workers/ts-worker`
   - Build Command: `yarn install && yarn build`
   - Start Command: `yarn start`
4. Add the required environment variables
5. Deploy the service

### 4. TypeScript Utility Worker

1. In the same Railway project, add a new service from GitHub
2. Select the same GitHub repository
3. Configure the service:
   - Root Directory: `src/workers/ts-util-worker`
   - Build Command: `yarn install && yarn build`
   - Start Command: `yarn start`
4. Add the required environment variables
5. Deploy the service

## Troubleshooting

### UTF-8 Encoding Issues

If you encounter UTF-8 encoding issues during deployment, particularly with the `database.types.ts` file, you can use a `.nixpacks.toml` file to handle this:

```toml
[phases.setup]
nixPkgs = ["nodejs", "yarn"]

[phases.install]
cmds = ["yarn install"]

[phases.build]
cmds = [
  "rm -f src/lib/supabase/database.types.ts",
  "echo 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]; export type Database = any;' > src/lib/supabase/database.types.ts",
  "yarn build"
]

[start]
cmd = "yarn start"
```

This configuration:
1. Removes the problematic file during the build phase
2. Creates a simplified version with just the basic types needed
3. Proceeds with the build

### Worker-Specific .nixpacks.toml Files

Each worker directory contains its own `.nixpacks.toml` file to customize the build process:

#### Python Worker (.nixpacks.toml)

```toml
[phases.setup]
nixPkgs = ["python310", "python310Packages.pip", "python310Packages.setuptools", "python310Packages.wheel"]

[phases.install]
cmds = ["pip install -r requirements.txt"]

[start]
cmd = "python main.py"
```

#### TypeScript Worker (.nixpacks.toml)

```toml
[phases.setup]
nixPkgs = ["nodejs", "yarn"]

[phases.install]
cmds = ["yarn install"]

[phases.build]
cmds = ["yarn build"]

[start]
cmd = "yarn start"
```

#### TypeScript Utility Worker (.nixpacks.toml)

```toml
[phases.setup]
nixPkgs = ["nodejs", "yarn"]

[phases.install]
cmds = ["yarn install"]

[phases.build]
cmds = ["yarn build"]

[start]
cmd = "yarn start"
```

## Monitoring and Scaling

After deployment, you can monitor the performance of each service in the Railway dashboard. If needed, you can scale individual services by adjusting their resources in the Railway dashboard.

## Updating the Deployment

To update the deployment after making changes to the codebase:

1. Push the changes to the GitHub repository
2. Railway will automatically detect the changes and rebuild the services

## Railway CLI Deployment (Alternative)

You can also deploy using the Railway CLI:

1. Install the Railway CLI: `npm install -g @railway/cli`
2. Log in to Railway: `railway login`
3. Link to your project: `railway link -p <project-id>`
4. Deploy the service: `railway up`

For worker-specific deployments, navigate to the worker directory first:

```bash
cd pricetracker/src/workers/py-worker
railway up
```

## Conclusion

By following these steps, you should have a fully deployed PriceTracker application on Railway with four separate services working together to provide a complete price tracking solution.
