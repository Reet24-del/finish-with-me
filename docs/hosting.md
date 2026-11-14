# Render hosting

Live URL: https://finish-with-me.onrender.com/

Verified on 9 November 2026: homepage, features page, workspace API, task creation, direct task URL refresh, guide page and mobile layout. Public health reports hostedDemo=true and irisVerified=false. Native AI Hub remains available on the local Docker setup; no local IRIS credentials or database ports were exposed.


Use [Deploy to Render](https://render.com/deploy?repo=https://github.com/Reet24-del/finish-with-me), sign in, select a workspace and deploy the free web service. The blueprint builds the React frontend and runs its Node backend.

The app uses Render’s automatically supplied RENDER_EXTERNAL_URL for HTTPS request validation. No manual URL configuration is needed. For a custom domain, set PUBLIC_ORIGIN to its exact HTTPS origin without a trailing slash.

The free deployment has a separate cookie-based workspace for each visitor. Without a hosted IRIS endpoint, only the built-in deterministic examples work; new project/study tasks can store context but cannot generate work. Tasks are ephemeral and reset when Render restarts or redeploys the service; it is not a durable production account. Render free services also sleep when idle. No private local tasks, .env file, provider keys, IRIS password or EAP image are uploaded.

Live IRIS AI Hub requires a separately hosted, licensed IRIS AI Hub service reachable over authenticated HTTPS. Add IRIS_BASE_URL, IRIS_USERNAME and IRIS_PASSWORD as server-only Render environment variables only when that endpoint is ready. Do not point Render at localhost or publish the local database ports. Groq configuration remains inside IRIS. Without those variables the hosted page explicitly identifies itself as a local guided demo. The demo video shows the earlier receipt-total and algebra examples; it predates the combined decision process. Use the local Docker setup to see Visual Trace and the Workflow Engine.

For durable production use, add real authentication, a durable database and operational limits before expanding this public demo. A paid persistent disk alone is not user authentication.

Demo video: https://www.youtube.com/watch?v=aBBQBlfhaA8

## Pages and deep links

The app now has distinct pages at `/`, `/features`, `/workspace`, `/workspace/<task-id>`, `/new`, and `/guide`. Browser history and direct task URLs are supported. The Node server serves the application shell for these paths, so refreshing a nested page works on Render without static rewrite rules. Task URLs remain scoped to the visitor’s cookie-based workspace.

The build command explicitly includes development dependencies because Vite is needed during the build even when NODE_ENV is production: `npm ci --include=dev && npm run build`. Runtime still uses `npm start` with the compiled frontend.

## Durable task storage (prepared, not yet enabled on the public service)

Set the server-only `DATABASE_URL` to a dedicated PostgreSQL database. A free
external Postgres service, such as Neon, can be used while Render remains on its
free plan. Render's own free Postgres expires after 30 days and is unsuitable for
indefinite task storage. Stay within the database provider's free quotas; durable
storage does not promise permanent service availability or replace backups.

The app creates `finish_workspaces` automatically. Each visitor's random recovery
key is hashed for the database identifier. Workspaces and task evidence are saved
transactionally. Concurrent changes lock and reload the workspace before checking
the task revision, and failed mutations roll back. Server startup fails if a
configured database is unavailable rather than silently switching to temporary
storage. `/api/health` reports `storage: "postgres"` and `storageVerified: true`
only with a configured, responding database.

The workspace page has **Keep access to your work**. Save the private recovery key
somewhere safe to restore the same workspace in another browser. The key grants
full access to that workspace: never publish it or include it in a URL. This is
bearer-key access, not a personal account/login system. Cookies are HttpOnly,
SameSite=Lax, Secure on HTTPS, and renewed for one year. Keys do not expire in the
database, and restarting the app does not discard ownership.

Existing temporary workspaces are not automatically migrated from a previous
Render deployment. Redeploying the old service can erase its temporary files.
No database credentials, keys, or local private tasks are committed to GitHub.

### Free database setup

1. Sign in at https://console.neon.tech/ and create a **Free** project named
   `finish-with-me`. Do not upgrade the plan or add a payment method for this setup.
2. Click **Connect** and copy the Postgres connection string. Keep its SSL
   parameters. Add it to the ignored `.env` as `DATABASE_URL=...`; do not post it in chat.
3. Add `RENDER_API_KEY` privately to `.env` if automated Render configuration is
   needed. The previous device CLI session is not authenticated.
4. Set `DATABASE_URL` on the existing Render web service, keeping
   `HOSTED_DEMO=true` (this controls visitor isolation, including with live AI).
5. Deploy and verify task creation, server restart, cookie restoration, and
   recovery in a different browser against the public URL. A local test alone is
   not evidence that public storage is connected.

Native InterSystems AI Hub remains a separate deployment requirement. The local
image is ARM64; Render requires linux/amd64. Render does not offer free private
services or disks. A free public Groq integration, if chosen, must be explicitly
labeled Groq and must never claim to be a hosted native IRIS agent.

Validation on 10 November 2026: all 15 backend tests passed against a temporary
local Postgres instance, including independent clients, rollback, concurrent
writes and workspace recovery across simulated process restarts.

## Optional hosted Groq mode

The user selected the free hosted option on 10 November 2026. Set `AI_BACKEND=groq`
and `GROQ_API_KEY` on Render, optionally `GROQ_MODEL=openai/gpt-oss-120b`.
This explicitly routes general project work, source-grounded study lessons and
answer assessment directly to Groq's structured function calling API. The public
UI and saved proposal identify the provider as **Groq (hosted)**. No request is
claimed to use InterSystems native agents in this mode. With `AI_BACKEND` unset,
the original native IRIS route is unchanged. Do not upload local IRIS credentials.

The hosted provider is limited to three simultaneous calls and 30 successful AI
operations per workspace per hour; Groq's organization-wide free rate limits also
apply. Provider errors and malformed results do not unlock task completion. No
generated project code is executed by the app. Study rubrics remain private,
and AI-assessed feedback remains explicitly labeled and can be wrong.


Once the private settings are present, `node scripts/configure-render.mjs` verifies
the hosted database, checks the existing service repository and free plan, and
merges the server-only provider/database settings into Render without displaying
credentials. Add `--deploy` only after the code is pushed and ready to deploy.
It does not create paid services or copy the local IRIS password.
