# Generect for Twenty

Enrich People and Companies in Twenty with Generect B2B data: LinkedIn profile, job title, location, industry, headcount and headquarters. The app fills empty fields only. It never overwrites what your team has typed.

## What you get

- **Enrich with Generect** in the command menu (Ctrl+K or the "⋮" menu) on People and Companies. Select one record or up to 50 and run it. The result shows in a snackbar. Each record keeps its own line in the "Generect Result" field.
- **Workflow steps** "Enrich people with Generect" and "Enrich companies with Generect". Use them to enrich records automatically, for example every person a teammate creates (see "Automate it" below).
- **Your own Generect key.** Each workspace connects its own Generect account, so you pay Generect directly and only for what is found.

## How a record is looked up

| Record | Identifier, in this order | Generect endpoint |
|---|---|---|
| Person | LinkedIn URL (`/in/...`), then primary email | `POST /api/v1/enrich/database/lead/` |
| Company | LinkedIn URL (`/company/...`), then domain (not a free-mail domain) | `POST /api/v1/enrich/database/company/` |

- Names alone are never sent: a lookup needs a LinkedIn URL, an email or a domain.
- Live lookups ($0.04) are used only for LinkedIn URLs and only when you turn on "Live LinkedIn lookups".

## What it writes

Every field is filled **only when it is empty**. Fields your workspace does not have are skipped.

| Person | From Generect |
|---|---|
| First / last name (only the empty half) | `first_name` / `last_name` |
| Job title (only for a current position) | `job_title` |
| LinkedIn (when found by email) | `linkedin_url` |
| Headline, Location, Current company, Industry, Lead ID (app fields) | profile |

| Company | From Generect |
|---|---|
| Name, Domain, LinkedIn | company profile |
| Address (country with city or state) | headquarters |
| Employees (exact number only) | `headcount_exact` |
| Industry, Headcount range, Headcount, Founded, Type, Description, HQ, Company ID, Domain (app fields) | profile |

The app also keeps a few fields of its own on each record: Generect Status, Enriched At, Last Attempt, Input Hash, Generect Result and the raw payload.

### Statuses

| Status | Meaning | Cost |
|---|---|---|
| MATCHED | Found; empty fields were filled | one match |
| COMPLETE | Everything was already filled, no lookup made | $0 |
| NO_MATCH | Generect found nothing | $0 |
| MISMATCH | (Company) Generect returned another domain; nothing written | one match |
| NO_IDENTIFIER | No LinkedIn URL, email or domain | $0 |
| INSUFFICIENT_CREDITS | Your Generect balance is empty; the run stops | $0 |
| WRITE_FAILED | The lookup succeeded but saving to Twenty failed | one match |
| ERROR | Generect was unavailable after retries | $0 |

## Pricing

You pay Generect, with your own key, per match:

| What | Price |
|---|---|
| Match from Generect's database | $0.02 |
| Nothing found | $0 |
| Live LinkedIn lookup (only when turned on) | $0.04 |

The amount actually charged is read from Generect's response, so custom account pricing is respected. Every run reports what it spent.

Keys that start with `test_` return sample data for $0. Use one to try the app before connecting a live key.

On Twenty Cloud each run of the app's functions also uses a little of your workspace's Twenty credits, like every app: $0.0001 per run plus $0.0001 per second. The app runs only when someone clicks, a workflow calls it or its settings page checks for a key.

## Set it up

1. Install **Generect** from Settings → Applications → Marketplace (turn off "Vetted only" in the filter to see it).
2. Get an API key at [app.generect.com](https://app.generect.com/settings/api) → Settings → API. New accounts can start with a `test_` key.
3. In Settings → Applications → Generect → Settings paste the key into **Generect API key**. The key is stored encrypted in your workspace and reaches only the app's server-side functions, never the browser.
4. Optional settings:

| Setting | Default | What it does |
|---|---|---|
| Live LinkedIn lookups | Off | LinkedIn lookups fetch live data ($0.04 instead of $0.02) |
| Spend cap per run, USD | 5 | One click or one workflow run stops before spending more |

**Self-hosted Twenty** (2.42 or later) must allow logic functions: set `LOGIC_FUNCTION_TYPE=LOCAL` (or `LAMBDA`) for the server and the worker. Otherwise the app installs but its command fails with "Logic function execution is disabled".

## Automate it

There is no hidden background trigger: nothing runs and nothing is spent until you ask. To enrich records automatically, build a workflow:

1. Workflows → New workflow → trigger **Record is created** on People (or Companies).
2. Add the step **Enrich people with Generect** (or **Enrich companies with Generect**) and pass the trigger's record to it.
3. Activate the workflow.

A workflow run follows stricter rules than a click. A record whose lookup was paid but could not be saved is never looked up again automatically. A failed lookup waits 7 days before the next try.

## Protection against wasted spend

- **An unchanged record is not looked up twice.** The app remembers what it looked up and with which identifier. The same input is looked up again only after a pause: 90 days after a match, 30 days after nothing was found. Clear "Generect Input Hash" on a record to force a new lookup.
- **An empty balance (402) stops the whole run.**
- **Rate limits and server errors** are retried after 1 s and 3 s, honouring `Retry-After`. A timeout is not retried, because the lookup may already have been charged.
- **A spend cap per run**, $5 by default.
- **"Select all" hides the command**, because it could mean thousands of paid lookups. Select the records instead (up to 50 per run).

## Permissions

- Anyone in the workspace who can see People or Companies can run the command. Each run spends Generect credits. Installing the app, changing its settings and seeing the key need the Applications permission.
- The app's functions run as the clicking person, limited by the app's role: read and update People and Companies, nothing else.

## Support

- Email: support@generect.com
- Issues: https://github.com/generect/twenty-app/issues
- Generect: https://generect.com

## License

MIT
