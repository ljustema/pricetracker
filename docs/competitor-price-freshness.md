# Competitor price freshness: 72 hours

Automatic repricing uses only prices acquired within the preceding 72 hours,
for every competitor. Exactly 72 hours is accepted; older timestamps, missing
timestamps and future timestamps are excluded. Existing discounts retain their
normal end dates; this change prevents creation and renewal from stale inputs.

`competitor_price_observations` stores the latest successfully processed price
and its original `temp_competitors_scraped_data.scraped_at` per user/product/
competitor. All three competitor batch processors update the observation inside
their row transaction, including unchanged prices. A failed row rolls it back.
An older arrival cannot replace a newer observation. Scraper run completion,
import time and `price_changes_competitors.changed_at` are not freshness evidence.

The migration patches the installed processor definitions at one checked,
unique price-change condition. An unexpected definition aborts the entire
migration. It preserves installed matching/conflict logic rather than restoring
an old function snapshot.

The fresh export reads observations directly, independently of the materialized
view. It excludes stale competitors before selecting the minimum and count.
Existing priority/coverage RPC signatures delegate to the fresh query. The CSV
API uses `get_fresh_price_matching_export` for both modes and appends
`Competitor Price Verified At` with an explicit timezone. No fresh rows returns
a successful header-only CSV. Missing migration returns 501 without fallback.

Ljustema persists this source timestamp as UTC in
`art_pricematcher_candidates.competitor_verified_at`. Its importer rejects
unverified/stale/future rows and replaces the previous product snapshot, including
a previously cheaper price retained by candidate retention. Candidate selection
and the actual insert/extension methods enforce the age again. Legacy candidates
with NULL verification time cannot create or renew discounts. An old CSV import
cannot reset freshness to the import time.

## Deployment order

1. Back up current RPC/processor definitions and the affected Ljustema module
   files. Check production definitions before applying the migration.
2. Add the nullable Ljustema column using `sql/upgrade-freshness.php`, then install
   `price_freshness.php`, the import class and the creation class. This fails
   closed until the new CSV export is available; ensure the sync worker is idle
   while replacing files. `sql/install.php` covers new installations.
3. Apply `20261112150000_require_fresh_competitor_prices.sql` in Supabase.
4. Deploy the Next.js CSV endpoint through the normal GitHub/Railway flow.
5. Verify a bounded competitor fetch, unchanged-price observation, CSV timestamp
   and Ljustema import before resuming the ordinary schedules.

There is deliberately no historical backfill: old data must not become fresh
merely because this feature is installed. Competitors become eligible as each
product is fetched successfully again. Blocked competitors remain excluded.
The initial export can therefore be empty until new observations arrive.

## Local regression tests

No production database is used by these tests.

```powershell
node --test tests/price-matching-freshness-api.test.cjs
docker run -d --name pricetracker-freshness-tests -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17
docker cp tests/sql/competitor-price-freshness.fixture.sql pricetracker-freshness-tests:/tmp/fixture.sql
docker cp supabase/migrations/20261112150000_require_fresh_competitor_prices.sql pricetracker-freshness-tests:/tmp/migration.sql
docker cp tests/sql/competitor-price-freshness.test.sql pricetracker-freshness-tests:/tmp/tests.sql
docker exec pricetracker-freshness-tests psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/fixture.sql -f /tmp/migration.sql -f /tmp/tests.sql
docker rm -f -v pricetracker-freshness-tests
```

Wait for PostgreSQL readiness before the psql command. The SQL fixture uses
existing processor bodies and narrow matching helper stubs. Assertions exercise
all three processors, unchanged prices, rollback, delayed arrivals, invalid
observations, the exact age boundary, competitor fallback/count, tenant filters,
priority/coverage modes and inactive products.

Ljustema's `tests/freshness-native.php` requires an explicitly supplied isolated
local bootstrap via `ART_PRICEMATCHER_TEST_BOOTSTRAP`, checks the local Docker DB
host and shadows all mutable tables with connection-local temporary tables.
It exercises native import, native price calculation and actual discount writes.

## Verification on 2026-11-12

- PostgreSQL 17 fixture/migration/business assertions passed, including changed
  prices and delayed acquisitions; incompatible-processor migration aborted
  with complete rollback as intended.
- 5 CSV API tests and the targeted API TypeScript check passed.
- 39 native PrestaShop/PHP/MariaDB checks and PHP syntax checks passed.
- The five module/schema files are installed and hash-verified in local Docker;
  the nullable verification column is installed locally. No discount run was
  executed against permanent local catalog tables.
- The full Next.js production build passes after fixing Bright123's invalid
  storage-client object and two unknown-error handlers. TypeScript target is
  ES2018 to match the existing dotAll expressions in the Node scraper sources.
- Bright123's memory-storage regression uses the actual Crawlee client and
  verifies queue write/read without disk persistence.
- Production rollout includes an optimistic-concurrency/read-back-verified
  update of Bright123's database-backed script; Git deployment alone does not
  publish scraper source. Live verification is recorded in the workspace report.
