# Render hosting

Use [Deploy to Render](https://render.com/deploy?repo=https://github.com/Reet24-del/finish-with-me), sign in, select a workspace and deploy the free web service. The blueprint builds the React frontend and runs its Node backend.

The app uses Render’s automatically supplied RENDER_EXTERNAL_URL for HTTPS request validation. No manual URL configuration is needed. For a custom domain, set PUBLIC_ORIGIN to its exact HTTPS origin without a trailing slash.

The free deployment is a guided demo, with a separate cookie-based workspace for each visitor. Tasks are ephemeral and reset when Render restarts or redeploys the service; it is not a durable production account. Render free services also sleep when idle. No private local tasks, .env file, provider keys, IRIS password or EAP image are uploaded.

Live IRIS AI Hub requires a separately hosted, licensed IRIS AI Hub service reachable over authenticated HTTPS. Add IRIS_BASE_URL, IRIS_USERNAME and IRIS_PASSWORD as server-only Render environment variables only when that endpoint is ready. Do not point Render at localhost or publish the local database ports. Groq configuration remains inside IRIS. Without those variables the hosted page explicitly identifies itself as a local guided demo. Use the video for the verified native IRIS run.

For durable production use, add real authentication, a durable database and operational limits before expanding this public demo. A paid persistent disk alone is not user authentication.

Demo video: https://www.youtube.com/watch?v=aBBQBlfhaA8
