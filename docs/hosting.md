# Render hosting

Live URL: https://finish-with-me.onrender.com/

Verified on 9 November 2026: homepage, features page, workspace API, task creation, direct task URL refresh, guide page and mobile layout. Public health reports hostedDemo=true and irisVerified=false. Native AI Hub remains available on the local Docker setup; no local IRIS credentials or database ports were exposed.


Use [Deploy to Render](https://render.com/deploy?repo=https://github.com/Reet24-del/finish-with-me), sign in, select a workspace and deploy the free web service. The blueprint builds the React frontend and runs its Node backend.

The app uses Render’s automatically supplied RENDER_EXTERNAL_URL for HTTPS request validation. No manual URL configuration is needed. For a custom domain, set PUBLIC_ORIGIN to its exact HTTPS origin without a trailing slash.

The free deployment has a separate cookie-based workspace for each visitor. Without a hosted IRIS endpoint, only the built-in deterministic examples work; new project/study tasks can store context but cannot generate work. Tasks are ephemeral and reset when Render restarts or redeploys the service; it is not a durable production account. Render free services also sleep when idle. No private local tasks, .env file, provider keys, IRIS password or EAP image are uploaded.

Live IRIS AI Hub requires a separately hosted, licensed IRIS AI Hub service reachable over authenticated HTTPS. Add IRIS_BASE_URL, IRIS_USERNAME and IRIS_PASSWORD as server-only Render environment variables only when that endpoint is ready. Do not point Render at localhost or publish the local database ports. Groq configuration remains inside IRIS. Without those variables the hosted page explicitly identifies itself as a local guided demo. Use the video for the verified native IRIS run.

For durable production use, add real authentication, a durable database and operational limits before expanding this public demo. A paid persistent disk alone is not user authentication.

Demo video: https://www.youtube.com/watch?v=aBBQBlfhaA8

## Pages and deep links

The app now has distinct pages at `/`, `/features`, `/workspace`, `/workspace/<task-id>`, `/new`, and `/guide`. Browser history and direct task URLs are supported. The Node server serves the application shell for these paths, so refreshing a nested page works on Render without static rewrite rules. Task URLs remain scoped to the visitor’s cookie-based workspace.

The build command explicitly includes development dependencies because Vite is needed during the build even when NODE_ENV is production: `npm ci --include=dev && npm run build`. Runtime still uses `npm start` with the compiled frontend.
