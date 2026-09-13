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

`npm run build` builds the Vite frontend into `dist/` and bundles `server.ts` into `dist/server.cjs`; `npm start` runs that bundle in production mode (serving the built static frontend instead of using Vite's dev middleware).

## Data persistence

Runtime data (users, sessions, schedules, audit logs) is persisted to a local JSON file at `data/shiftsense_db.json`, created automatically on first run. This directory is gitignored since it's local runtime state, not source code.
