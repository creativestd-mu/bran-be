# Node.js Backend with Meltwater Social APIs

Backend service with versioned + language-compatible APIs (`/:lang/v1`) that fetch, normalize,
store, and aggregate Instagram + LinkedIn + YouTube + Facebook performance data from Meltwater into PostgreSQL.

## Features

- Node.js + Express + TypeScript
- API versioning + language prefix (`/en/v1/...`)
- Meltwater integration for Instagram, LinkedIn, YouTube, and Facebook ingestion
- Meltwater earned-media daily series: mention volume, reach, and sentiment
- Sentiment module APIs for the frontend (`/sentiment`) plus Slack queries for onboarded users
- PostgreSQL persistence with Prisma ORM
- Metric aggregation for:
  - Mentions
  - Estimated Views (impressions)
  - Estimated Reach
  - Engagement Count
  - Engagement Rate (average)
  - Sentiment (positive/neutral/negative/unknown)
- Centralized error handling
- ESLint + Prettier + Jest setup

## API Endpoints

Base pattern:

`/{language}/v1/{resource}`

Instagram APIs:

- `POST /en/v1/instagram/sync`
  - Fetches from Meltwater, normalizes, and upserts into PostgreSQL
  - Optional body:
    ```json
    {
      "from": "2026-01-01T00:00:00.000Z",
      "to": "2026-01-31T23:59:59.999Z",
      "keyword": "your brand"
    }
    ```
- `GET /en/v1/instagram/aggregate?from=...&to=...`
  - Returns aggregated metrics and sentiment split
- `GET /en/v1/instagram/records?from=...&to=...`
  - Returns paginated normalized records (`page`, `pageSize`)

LinkedIn APIs:

- `POST /en/v1/linkedin/sync`
  - Fetches from Meltwater, normalizes, and upserts into PostgreSQL
- `GET /en/v1/linkedin/aggregate?from=...&to=...`
  - Returns aggregated metrics and sentiment split
- `GET /en/v1/linkedin/records?from=...&to=...`
  - Returns paginated normalized records (`page`, `pageSize`)

YouTube APIs:

- `POST /en/v1/youtube/sync`
  - Fetches from Meltwater, normalizes, and upserts into PostgreSQL
- `GET /en/v1/youtube/aggregate?from=...&to=...`
  - Returns aggregated metrics and sentiment split
- `GET /en/v1/youtube/records?from=...&to=...`
  - Returns paginated normalized records (`page`, `pageSize`)

Facebook APIs:

- `POST /en/v1/facebook/sync`
  - Fetches from Meltwater, normalizes, and upserts into PostgreSQL
- `GET /en/v1/facebook/aggregate?from=...&to=...`
  - Returns aggregated metrics and sentiment split
- `GET /en/v1/facebook/records?from=...&to=...`
  - Returns paginated normalized records (`page`, `pageSize`)

Meltwater earned mentions (JWT):

- `GET /en/v1/meltwater/earned/searches`
  - Lists saved Explore/Listening searches (use IDs in `MELTWATER_SEARCH_IDS`)
- `POST /en/v1/meltwater/earned/sync`
  - Pulls daily mention volume + reach + sentiment and upserts into PostgreSQL
  - Optional body:
    ```json
    {
      "from": "2026-08-01",
      "to": "2026-08-14",
      "searchIds": ["2382415"]
    }
    ```
- `GET /en/v1/meltwater/earned/daily?from=...&to=...&searchId=...`
  - Daily series plus period totals
- `GET /en/v1/meltwater/earned/aggregate?from=...&to=...&searchId=...`
  - Period totals only
- `GET /api/cron/meltwater-earned` (Bearer `CRON_SECRET`)
  - Re-syncs the last `MELTWATER_EARNED_LOOKBACK_DAYS` days

Sentiment module (JWT, all onboarded roles — frontend `/sentiment`):

- `GET /en/v1/sentiment` and `GET /api/sentiment`
  - Dashboard: daily series + totals (volume, reach, sentiment mix, net score)
  - Query: `from`, `to`, `searchId`, `preset=7d|14d|30d|this_week|this_month`
- `GET /en/v1/sentiment/aggregate` — period totals only
- `GET /en/v1/sentiment/searches` — saved Meltwater searches
- `POST /en/v1/sentiment/sync` — refresh from Meltwater
- Slack: DM Bran or `@Bran sentiment this week` / `brand mentions last month` (Slack email must match an active Bran user)

Pods (JWT — owned IPs + inspirations; Projects require a Pod):

> **Migration warning:** `20260816120000_pods_and_social_ingestion` **deletes all existing Content and Project rows** (dummy data reset), then introduces Pods and makes `Project.podId` required.

- `POST /en/v1/pods` — create pod (`name`, `verticalId`, `headUserId`) — requires `manage_pods`
- `GET /en/v1/pods` — list pods (optional `verticalId`, `isActive`)
- `GET /en/v1/pods/:id` — pod detail with accounts + projects
- `PUT /en/v1/pods/:id` / `DELETE /en/v1/pods/:id` — update / deactivate
- `POST /en/v1/pods/:id/accounts` — add owned IP or inspiration (`kind`, `platform`, `handle`, optional `url`)
  - `kind`: `OWNED_IP` | `INSPIRATION`
  - `platform`: `YOUTUBE` | `X` | `INSTAGRAM` | `LINKEDIN`
- `GET /en/v1/pods/:id/accounts` / `GET /en/v1/pods/:id/posts`
- `PUT|DELETE /en/v1/pods/accounts/:accountId`
- `POST /en/v1/pods/accounts/:accountId/sync` — Apify scrape for that account
- `POST /en/v1/projects` now requires `podId` (not `verticalId`; vertical is derived via the pod)
- `GET /api/cron/pods-social` (Bearer `CRON_SECRET`) — sync all active pod accounts
- Slack: DM Bran or `@Bran pod "Growth" top IP posts this week` / `what is inspiring pod Fiction on Instagram`

Slack task create + unsupported asks:
- DM Bran or `@Bran add task: …` / `@Bran assign <@U…>: …` creates work units
- In a channel: `@Bran add a task for everyone here: …` assigns one unit per mapped channel member (cap 40)
- Thread replies include parent thread text (e.g. “read the quoted article”)
- Directed asks Bran cannot handle get a clear Slack reply and are stored for review:
  - `GET /api/unsupported-slack-queries` / `GET /:lang/v1/unsupported-slack-queries` (admin / CoS)
  - `PATCH …/:id/status` with `{ "status": "REVIEWED" | "DISMISSED" | "NEW" }`

Slack calendar booking (requires Calendar connected with write/freebusy scopes — reconnect Calendar after deploy):
- `@Bran book a call with Dhananjay` / `schedule a meeting with @Name about X`
  - Offers a few free weekday slots 12:00–19:00 IST; click a button to book
  - Always creates a Google Meet link and invites the other person
  - Title defaults to `Your Name <> Their Name`, or uses topic context when present
- `@Bran what's on my calendar today` / `my meetings today` — agenda from Google Calendar

Transcription keywords (admin / CoS — improves Sarvam voice spelling):
- Every STT call now prompts Sarvam with active people, vertical, pod, and project names, plus admin keywords
- `GET /api/transcription-keywords` / `GET /:lang/v1/transcription-keywords` — list (`?isActive=true|false`)
- `POST /api/transcription-keywords` — `{ "phrase": "Masters' Union", "notes": "optional" }`
- `PATCH /api/transcription-keywords/:id` — update phrase/notes/`isActive`
- `DELETE /api/transcription-keywords/:id` — hard delete

## Environment Variables

Copy and configure:

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `MELTWATER_BASE_URL` - Meltwater API host URL
- `MELTWATER_API_KEY` - Meltwater API token (sent as `apikey` header)
- `MELTWATER_OWNED_POSTS_ENDPOINT` - Meltwater owned posts endpoint
- `MELTWATER_ACCOUNT_IDS_INSTAGRAM` - owned Instagram account IDs (comma-separated)
- `MELTWATER_ACCOUNT_IDS_LINKEDIN` - owned LinkedIn account IDs (comma-separated)
- `MELTWATER_ACCOUNT_IDS_YOUTUBE` - owned YouTube account IDs (comma-separated)
- `MELTWATER_ACCOUNT_IDS_FACEBOOK` - owned Facebook account IDs (comma-separated)
- `MELTWATER_SEARCH_IDS` - saved Explore/Listening search IDs for earned analytics
- `MELTWATER_EARNED_TIMEZONE` - timezone for daily buckets (default `Asia/Kolkata`)

Pod social ingestion (Apify):

- `APIFY_TOKEN` - Apify API token
- `APIFY_POD_INSTAGRAM_ACTOR_ID` / `APIFY_POD_YOUTUBE_ACTOR_ID` / `APIFY_POD_X_ACTOR_ID` / `APIFY_POD_LINKEDIN_ACTOR_ID`
- `APIFY_POD_RESULTS_LIMIT` - posts per account sync (default `25`)
- `PODS_SOCIAL_CRON_ENABLED` - in-process daily 08:00 IST sync (default `true`)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npm run prisma:generate
```

3. Create DB schema with migrations:

```bash
npm run prisma:migrate
```

4. Run dev server:

```bash
npm run dev
```

## Scripts

- `npm run dev` - Start dev server with auto-reload
- `npm run build` - Compile TypeScript
- `npm run start` - Run compiled app
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix lint issues
- `npm run format` - Run Prettier
- `npm test` - Run tests
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Create/apply Prisma migration

## Notes

- JWT auth + RBAC permissions gate most write APIs.
- Language validation is enforced via `SUPPORTED_LANGUAGES`.
