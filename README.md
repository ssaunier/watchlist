# Watchlist

What came out in cinemas, what we want to watch, what we watched. A household
watchlist served at a single URL: new releases land in **New** every week, the
ones worth a movie night go to the **Watchlist**, and once seen they move to
**Watched** with a date and a rating out of 10. Films passed on sit in an
**Archive** that can always be undone.

The idea: a film that reaches French cinemas is rentable about four months
later and on Canal+ after six. By then, the deciding has already been done.

## How it works

- **Data** comes from [TMDB](https://www.themoviedb.org/): an hourly job asks
  its discover feed what reached cinemas in the monitored countries over the
  last four weeks (and the week ahead), fetches the details of the newcomers
  (French title and synopsis, genres, runtime, poster, the original-version
  trailer) and stores them. Re-releases are ignored. This product uses the
  TMDB API but is not endorsed or certified by TMDB.
- **Storage** is [Cloudflare D1](https://developers.cloudflare.com/d1/), a
  hosted SQLite. Films, their release date per country, and the household's
  entries (status, added/watched dates, rating, note).
- **The app** is a Vue 3 single page served by the same
  [Cloudflare Worker](https://developers.cloudflare.com/workers/) that owns the
  database and runs the sync. The browser talks to `/api/*`; the TMDB token
  never leaves the Worker. English and French UI, installable as a PWA. On a
  phone, New is a deck: swipe right to keep a film, left to pass, with the
  synopsis and the trailer a tap away. On a wide screen it is a grid with the
  same two buttons on every film.
- **Access** is one shared password, the `APP_PASSWORD` secret. The app asks
  for it once per browser and keeps a cookie; the API takes the same password
  as a bearer token, so a script can read the lists too:

  ```bash
  curl -H "Authorization: Bearer $APP_PASSWORD" https://<your-worker>/api/movies?status=watchlist
  ```

  Changing the password signs every browser out.

Everything runs on Cloudflare's free plan.

## Running it

```bash
nvm use            # Node 22, see .nvmrc
npm install
cp .dev.vars.example .dev.vars   # then paste your TMDB read access token and pick a password
npm run db:migrate:local
npm run dev
```

`npm run dev` serves the app and the Worker on http://localhost:5173 with a
local database (kept in `.wrangler/state`). The database starts empty; run a
sync to fill it:

```bash
curl -X POST http://localhost:5173/api/sync
```

Each sync run fetches at most `DETAILS_PER_RUN` new films (see
`wrangler.jsonc`), so run it a few times to backfill the last four weeks. In
production the cron does this every hour.

| Command | What it does |
| --- | --- |
| `npm run dev` | App + Worker, local database |
| `npm test` | Both suites: the Worker's (inside workerd, real local D1) and the app's (jsdom) |
| `npm run build:production` | Production build into `dist/` |
| `npm run preview` | The production build, locally |
| `npm run deploy` | Build for production and `wrangler deploy` |
| `npm run db:migrate:local` | Apply `migrations/` to the local database |
| `npm run db:migrate:production` | Apply `migrations/` to the production database |

## Configuration

`wrangler.jsonc` holds it all. The top level is the development environment;
`env.production` is what gets deployed.

- `RELEASE_COUNTRIES`: whose cinema releases to watch, ISO 3166-1 codes,
  comma-separated (`"FR"`, later `"FR,KR"`). Each country gets its own
  release-date row per film.
- `MAX_AGE_YEARS`: a film first released more than this many years before it
  reached the country's cinemas is a re-release and is skipped.
- `DETAILS_PER_RUN`: how many new films one sync run fetches. Kept small
  because the free plan allows 50 subrequests and 10 ms of CPU per invocation.
- `triggers.crons`: how often the sync runs.

Secrets: `TMDB_TOKEN` (the "API Read Access Token" from
https://www.themoviedb.org/settings/api) and `APP_PASSWORD`. Locally they live
in `.dev.vars`; in production they are uploaded by the deploy workflow.

## Deploying

GitHub Actions deploys every push to `main` that passes the tests
(`.github/workflows/deploy.yml`): database migrations, then the Worker and the
app's files, then the secrets. It needs four repository secrets:

| Secret | Where it comes from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens, "Edit Cloudflare Workers" template plus **Account > D1 > Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | `npx wrangler whoami` |
| `TMDB_TOKEN` | the same token as in `.dev.vars` |
| `APP_PASSWORD` | the household's password |

Before the first deploy the production database has to exist:
`npx wrangler login`, then `npx wrangler d1 create watchlist-production` and
paste its id into `env.production` in `wrangler.jsonc`. The Worker is then
served at `watchlist.<your-subdomain>.workers.dev`.

For a custom domain, the domain's DNS must be hosted by Cloudflare (free
plan; the registrar can stay where it is). Then add to `env.production`:

```jsonc
"routes": [{ "pattern": "watchlist.example.com", "custom_domain": true }]
```

and the next deploy creates the DNS record and the certificate.

## Layout

```
migrations/          D1 schema, applied with wrangler
src/worker/          the Worker: index.ts (Hono routes, cron), sync.ts, tmdb.ts, db.ts
src/app/             the Vue app: views/, components/, composables/, services/, i18n/
test/worker/         Vitest inside workerd against a real local D1
test/app/            Vitest in jsdom
```

## API

| Route | |
| --- | --- |
| `GET /api/movies?status=new\|watchlist\|watched\|archived` | Films in a list, with their releases and entry |
| `GET /api/movies/:tmdbId` | One film |
| `PATCH /api/movies/:tmdbId` | `{ status?, rating?, note? }`; moves follow `TRANSITIONS` in `src/worker/index.ts` |
| `GET /api/counts` | Films per list |
| `GET /api/status` | Last sync run and counts |
| `POST /api/sync` | Run the sync now |
