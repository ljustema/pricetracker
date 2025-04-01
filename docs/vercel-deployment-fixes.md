# Vercel Deployment Fixes för PriceTracker

Detta dokument beskriver de ändringar som behöver göras för att kunna deploya PriceTracker-applikationen till Vercel utan fel.

## Identifierade problem

1. **TypeScript-kompatibilitetsproblem med Next.js 15.2.4**
   - Typen för `params` i sidkomponenter har ändrats i Next.js 15.2.4
   - Detta orsakar byggfel i filer som använder dynamiska rutter

2. **Problem med mappar som innehåller parenteser**
   - Vercel har problem med att hantera mappar som `(app)`, `(auth)` och `(marketing)`
   - Detta orsakar fel som: `Error: ENOENT: no such file or directory, lstat '/vercel/path0/.next/server/app/(marketing)/page_client-reference-manifest.js'`

## Lösningar

### 1. Fixa TypeScript-kompatibilitetsproblem

#### Temporär lösning (redan implementerad)
Lägg till `typescript.ignoreBuildErrors: true` i `next.config.ts` för att ignorera TypeScript-fel under bygget:

```typescript
// next.config.ts
const nextConfig = {
  // Övrig konfiguration...
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
```

#### Permanent lösning
Uppdatera alla sidkomponenter som använder `params` för att matcha Next.js 15.2.4 typkrav:

1. Identifiera alla filer under `src/app` som använder dynamiska rutter (t.ex. `[productId]`, `[competitorId]`, etc.)
2. Uppdatera interface-definitioner för props i dessa komponenter
3. Exempel på en fix för `src/app/(app)/products/[productId]/link-competitors/page.tsx`:

```typescript
// Före
interface LinkCompetitorsPageProps {
  params: {
    productId: string;
  };
}

// Efter
import { PageProps } from 'next';

interface LinkCompetitorsPageProps extends PageProps {
  params: {
    productId: string;
  };
}
```

### 2. Fixa problem med mappar som innehåller parenteser

#### Alternativ 1: Omstrukturera mappstrukturen
Ändra mappstrukturen för att undvika parenteser:

1. Skapa nya mappar utan parenteser:
   - `src/app/app-routes` istället för `src/app/(app)`
   - `src/app/auth-routes` istället för `src/app/(auth)`
   - `src/app/marketing-routes` istället för `src/app/(marketing)`

2. Flytta alla filer från de gamla mapparna till de nya
3. Uppdatera imports i alla filer som refererar till dessa mappar
4. Uppdatera Next.js-konfigurationen för att hantera de nya rutterna

#### Alternativ 2: Använd en anpassad byggscript
Skapa en script som kopierar filer från mappar med parenteser till mappar utan parenteser före bygget:

1. Skapa en `scripts/prepare-build.js`-fil som kopierar filerna
2. Lägg till ett `prebuild`-script i `package.json`
3. Uppdatera imports och referenser i koden

#### Alternativ 3: Använd Vercel CLI för lokal byggnad
Bygg applikationen lokalt med Vercel CLI och ladda upp den färdiga bygget:

1. Installera Vercel CLI: `npm i -g vercel`
2. Bygg lokalt: `vercel build`
3. Ladda upp bygget: `vercel deploy --prebuilt`

## Miljövariabler

För att applikationen ska fungera korrekt på Vercel behöver du konfigurera följande miljövariabler:

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=<din_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<din_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<din_supabase_service_role_key>
```

### NextAuth
```
NEXTAUTH_SECRET=<din_nextauth_secret>
NEXTAUTH_URL=<din_vercel_domän> # t.ex. https://pricetracker.vercel.app
NEXTAUTH_APP_NAME=PriceTracker
```

### Google OAuth
```
GOOGLE_CLIENT_ID=<din_google_client_id>
GOOGLE_CLIENT_SECRET=<din_google_client_secret>
```

### Stripe
```
STRIPE_SECRET_KEY=<din_stripe_secret_key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<din_stripe_publishable_key>
STRIPE_WEBHOOK_SECRET=<din_stripe_webhook_secret>
```

## Rekommenderad approach

1. Börja med att fixa TypeScript-kompatibilitetsproblemen permanent
2. Om det inte löser Vercel-byggproblemen, implementera Alternativ 1 (omstrukturera mappstrukturen)
3. Konfigurera miljövariabler i Vercel-projektet
4. Deploya igen

## Framtida underhåll

För att undvika liknande problem i framtiden:

1. Håll Next.js och TypeScript uppdaterade
2. Undvik parenteser i mappnamn
3. Använd en CI/CD-pipeline som testar bygget före deployment
4. Överväg att använda Vercel CLI för lokala tester av byggprocessen
