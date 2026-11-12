# Lampan nightly collection and product matching

The collector reads public product/brand pages with a named PriceTracker client,
sequential requests and at least 3,000 ms between request starts. HTTP 403 or a
challenge page stops the run. HTTP 429 allows two bounded retries, honoring
Retry-After; a requested wait over three minutes stops instead of retrying early.
The official gzip sitemap remains supported, with byte-based decompression.

## Priority and discovery

Each job loads `get_competitor_catalog_context(scraper_id)` afresh. The scalar
JSON result contains the complete active own catalog, owned active brands and
explicit aliases, previous competitor URLs, and previous URL checks. At initial
rollout this was 32,957 own products, 52 brands and 2,321 known own Lampan URLs.

The collector refreshes up to 2,000 oldest known own URLs first, then discovers
up to 100 additional product pages through relevant brand listings. At the
initial catalog size this rotates the known set over at most two successful
nightly runs. New own products and new own brands enter the next plan without
changing a hardcoded list. The existing daily schedule is retained.

Only owned brands are requested from the brand index. Product listings provide
SKU/brand/URL candidates; their prices never become verified prices. Public
load-more pagination currently includes all earlier pages; completeness is
checked and ordinary pagination is supported as a fallback. Actual product
pages are fetched before prices are emitted.

Two thirds of discovery slots prioritize own SKU/brand candidates. The rest
reserve exploration for EAN matches with differing supplier SKU spellings.
Remaining slots are filled from either pool. Never-checked URLs precede recently
checked URLs. Unavailable or removed pages are recorded in `competitor_url_checks`
so they do not monopolize discovery forever. Previously known URLs are not
repeated as discovery within the same run.

The limit leaves headroom under the worker's two-hour timeout at the tested
request rate. It does not promise a complete competitor-catalog scan each night.
If the known own set grows, oldest-first rotation preserves priority and the
72-hour export guard still excludes any price that actually becomes too old.

## Identity safety

The three competitor processors and both own-integration entry points use
`resolve_competitor_product`. A unique valid EAN wins. SKU fallback respects the
user setting and requires a resolved brand plus a nonempty normalized SKU.
Conflicting EANs or ambiguous variants are not resolved with `LIMIT 1`.
Competitor ambiguities enter `scraper_run_rejections`; own-import conflicts are
retained as error rows without aborting the entire input batch. Canonical brand
names, explicit aliases and unambiguous normalized spellings are supported.

A newly imported own product can reuse an existing competitor entity by EAN;
its earlier URL then automatically appears in the next priority plan. Tests use
the actual own-store BEFORE INSERT trigger to verify this flow and ensure a
conflicting variant cannot overwrite another product's own price.

The collector also rejects clearly contradictory own SKU/EAN inputs before
emission. Identity conflict counts/sample URLs appear in the final job report.
Review these against the source catalog; do not automatically change the shop's
EAN to agree with a competitor.

The audit found no duplicate valid EANs in the current user catalog (only six
invalid `-` placeholders), and eight normalized SKU/brand collision groups.
One group has distinct EANs. A real additional conflict was seen for PR Home
Sarah Ø27, SKU `4127-BT02`: our `7330976079988`, Lampan `7330976085057`. It is
excluded pending data review; no shop identifiers were changed.

## Freshness remains 72 hours

The existing export/observation function definitions are unchanged by this
migration. `record_competitor_price_observation_v2` adds the actual product URL
to the original successful observation, including unchanged prices and URL
changes. URL checks/listings never refresh a price's verification time. Old,
missing and future verification times remain unusable for discount creation or
renewal in both PriceTracker and Ljustema.

## Worker reliability

Other enabled own-product filters now read all rows with ordered pagination,
restrict own rows to products with an own retail price, and stop on query error.
Large contexts use a private file in the disposable job directory, rather than
an OS command-line argument. The existing scraper CLI and main-module behavior
are preserved. UTF-8 stream decoding, asynchronous output handling and periodic/
final log flushes are ordered and drained before a job is finalized. Discovery
events cannot count as prices, and page progress cannot overwrite price counts.

## Validation and rollout

- Larger predeployment test: 200 product pages, 196 valid price rows, zero ERROR
  entries, 626.9 seconds. This includes priority refresh and four-brand discovery.
  The exact source configuration was checked for 3,000 ms pacing before queuing.
- Earlier faster tests are not pacing evidence: one hit HTTP 429, and a test
  builder was found not to replace an old 100 ms configuration line. The builder
  was corrected and both configuration and request-start spacing are tested.
- Script/parser/API regressions, worker build/tests, full application build,
  and PostgreSQL matching/catalog/own-import tests must pass before publication.
- Database migration `20261112170000_lampan_catalog_and_safe_matching.sql`
  preserves unknown function changes by aborting if checked anchors differ.
  Back up and compare all affected live definitions before application.
- Deploy the worker, verify its GitHub/Railway status, test the real dynamic
  context/URL-check flow, then publish the database-backed `scrapers/lampan.ts`
  with metadata `catalog_plan: lampan_v1`, concurrency guard and exact readback.
  Preserve the existing schedule/activation. Enable brand filtering, retain
  `scrape_only_own_products=false` so discovery can find future matches.

Run `node --test tests/lampan-catalog.test.cjs tests/lampan-jsonld.test.cjs
tests/scraper-identifiers.test.cjs tests/price-matching-freshness-api.test.cjs`
from the root and `npm test` in `src/workers/ts-worker`.

For a disposable PostgreSQL 17 database, apply the existing freshness fixture,
the 72-hour migration, `tests/sql/competitor-catalog.fixture.sql`, the new
migration, then `competitor-catalog.test.sql` and `own-import-matching.test.sql`.
These fixtures contain no credentials or production catalog rows.
