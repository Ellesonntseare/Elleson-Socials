# Elleson Socials

Web and Android social-content workspace. Version 0.2 adds authenticated cloud planning to the original device planner. Social account connections, actual publishing, scheduled dispatch, analytics and inbox operations remain in development.

## Web architecture

The existing planner lives in `public/planner/`. Vinext hosts the authenticated entrypoint and `/api/` routes, with Cloudflare D1 for posts and workspace ownership and R2 for private files. Sites owns hosted sign-in. A user receives one personal cloud workspace, keyed by the platform-provided stable user ID. Every data query is scoped to that workspace.

The browser uses same-origin, cookie-authenticated API calls. Mutations require the correct Origin. Post writes and deletes require an expected revision, so stale edits receive a conflict instead of overwriting another device. Deleted records retain a tombstone to prevent old clients from recreating them. Media responses require authentication and ownership; storage keys are never public.

## Run locally

Requires Node.js 24 (tests use built-in SQLite).

```powershell
npm ci
npm run db:generate
npm run build
```

Apply each pending SQL file under `drizzle/` once to the local database. For the first migration:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_next_annihilus.sql
npm run dev
```

Use the generated filename shown in `drizzle/`. Open the printed local URL and follow Sign in with ChatGPT. The portable development profile simulates a local-only identity; this mock does not ship in production. Hosted authentication remains managed by Sites. The root redirects to `/planner/index.html` after sign-in. On this PC, workerd currently crashes with a Windows access violation; the build still succeeds, and GitHub runs the full Worker integration check on Linux.

For the device-only planner, run `node server.mjs` and open http://127.0.0.1:4173. For the device storage on the hosted origin, use `/planner/index.html?device=1`.

## Storage and synchronization

- Cloud mode lists posts and files from the server and refreshes every 30 seconds while the editor is closed and the page is visible.
- Editing pauses refresh. Conflicts keep the editor open with the unsaved text and an explanation.
- Device mode retains the original IndexedDB database. No local content is uploaded automatically.
- Cloud & storage offers an explicit copy of device drafts to the cloud, preserving originals. Origin-specific browser storage cannot be read from other origins or native apps: export a workspace there, then import it here.
- Backups include posts and media. Import merges new IDs and keeps existing records. Large exports can consume considerable browser memory. Uploads are incremental; if one fails, already copied files remain and a retry skips existing IDs.
- Cloud uploads are limited to 25 MB per file. Supported file signatures include JPEG, PNG, GIF, WebP, MP4/MOV, PDF and the supported Office containers. Signature checks do not replace codec validation, document scanning or platform-specific publishability checks.
- Deleted files are no longer accessible through the API. A retention and permanent-purge feature is not implemented yet.

## Android

`android/` is a Capacitor project bundling `public/planner/`. The native preview keeps a device-local planner and exposes the signed-in cloud workspace in the browser through Cloud & storage. It does not yet embed a native account session or automatically synchronize its IndexedDB records with the server. Export/import transfers native device drafts to cloud mode.

```powershell
npm run android:sync
npm run android:open
```

With JDK 21 and Android SDK 36 installed, `android/gradlew.bat assembleDebug` builds the APK. GitHub Actions also validates the web code and builds a debug APK. Release signing, physical-device QA, notifications, native sharing/export and a supported native authentication flow remain unfinished. Do not ship service credentials or social account tokens in Android assets.

## Checks and deployment

`npm test` includes API tests against the actual generated SQLite migration, covering authentication, workspace isolation, stale revisions, deletion, media access, cross-origin writes and server validation. The platform validation tests cover the composer baseline.

`npm run build` creates the Sites Worker artifact. The tracked `.openai/hosting.json` preserves the existing Site identity and declares DB/BUCKET. Sites applies the generated schema migrations when publishing. Local and hosted data are separate.

The private hosted preview is https://elleson-socials.poeticbeech16.chatgpt.site and the private source repository is https://github.com/Ellesonntseare/Elleson-Socials. See `docs/STATUS.md` for checked behavior and `docs/PRODUCT.md` for the remaining product scope.
