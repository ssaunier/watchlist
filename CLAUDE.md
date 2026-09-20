## Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Project
- Cloudflare Worker (Hono + D1, `src/worker/`) serving a Vue 3 SPA (`src/app/`). See README.md.
- Node comes from nvm: `.nvmrc` says 22. Run `npm test` before claiming anything works; the Worker suite runs against a real local D1.
- `npm run dev` runs both halves; `npm run preview` runs the production build locally.
- Production is `env.production` in `wrangler.jsonc`, selected with `CLOUDFLARE_ENV=production` at build time (`npm run build:production`), never with `wrangler deploy --env`.
