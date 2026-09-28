# ShiftSense

Hospital nurse staffing forecasting and demand-driven schedule management prototype for inpatient medical-surgical units.

This app was originally exported from Google AI Studio's Build mode. It runs as a single Node/Express process (`server.ts`) that hosts both the API and the Vite-built React frontend on one port — there is no separate frontend/backend server to run.

## Run Locally

**Prerequisites:** Node.js (LTS)

1. Install dependencies:
   ```
   npm install
   ```
2. (Optional) Copy `.env.example` to `.env.local` if you need to set `GEMINI_API_KEY` for future Gemini-powered features, or override `PORT`. Neither is required to run the app today — nothing in the current codebase calls the Gemini API yet.
3. Run the app:
   ```
   npm run dev
   ```
4. Open http://localhost:3000

The demo login screen lists three seeded staff accounts; any of their passwords work, or use `hospital123` for all of them.

## Production build

```
npm run build
npm start
```

`npm run build` builds the Vite frontend into `dist/` and bundles `server.ts` into `dist/server.cjs`. `npm start` runs that bundle, but it only serves the built frontend when `NODE_ENV=production` is set (PowerShell: `$env:NODE_ENV="production"; npm start`); otherwise it starts Vite's dev middleware.

`npm run dev` always runs in development mode, even if `NODE_ENV=production` is set in your shell.

If `http://localhost:3000` shows a "not found" page instead of ShiftSense, another program is probably answering on port 3000. The server now prints a clear message when the port is taken; run it on another port with `$env:PORT=3001; npm run dev`.

## Data persistence

Runtime data (users, sessions, schedules, audit logs) is persisted to a local JSON file at `data/shiftsense_db.json`, created automatically on first run. This directory is gitignored since it's local runtime state, not source code.

## Deployment

Deployed on Google Cloud Run (project `shiftsense-deploy`, service `shiftsense-app`, region `us-central1`). Traffic is set to always follow the latest ready revision, so a new `gcloud run deploy --source .` from this folder goes live immediately with no separate traffic-switch step.
