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

## Navigation, composition and manual posting

Phone navigation groups the app into Planner, Create, Media, Channels and More. Planner contains Calendar, Drafts and Posted history. More contains storage, backup transfer, activity reports and the roadmap.

The composer adapts to each chosen channel and post type. It supports separate thread segments, poll questions/choices/duration, YouTube audience and visibility, Pinterest board/link fields, business offer/event dates, cover selection and optional settings. Channel previews are layout approximations; they are not screenshots from connected social accounts.

Images can be cropped to common ratios without replacing the original. Video covers can be captured from a selected frame. Images can be reordered and given alt text. Browser format support still determines which source assets can be opened for these tools.

Post with help prepares captions and downloads and opens the chosen platform for the user to finish posting. The user may explicitly mark each channel complete or undo that mark. Completed history is labelled Posted manually. No external posting action or platform confirmation is inferred from opening a link. Reusing a completed item starts a fresh draft.

Activity reports count saved content and manual confirmations. CSV export escapes text and neutralizes spreadsheet formula prefixes. Reach, engagement, followers, inbox operations and best-time recommendations require real account integrations and are not implemented.

Poll format research: https://help.metricool.com/how-to-schedule-polls-and-carousels-on-linkedin-uvkp3 and https://help.x.com/en/using-x/x-polls. Account and API capabilities still require validation when live connectors are added.

## Android

`android/` is a Capacitor shell that opens the configured Connect server in a browser-managed Custom Tab. Connect sign-in and provider authorization share that browser session. The legacy local planner remains available for exporting older device posts; new work is saved in the authenticated server workspace.

```powershell
npm run android:sync
npm run android:open
```

With JDK 21 and Android SDK 36 installed, `android/gradlew.bat assembleDebug` builds the APK. GitHub Actions also validates the web code and builds a debug APK. The preview build uses the configured persistent signing key. Physical-device QA, store release packaging and native sharing remain outstanding. Background alerts use the browser Web Push permission and secure workspace; they are not native Firebase notifications. Do not ship service credentials or social account tokens in Android assets.

## Checks and deployment

`npm test` includes API tests against the actual generated SQLite migration, covering authentication, workspace isolation, stale revisions, deletion, media access, cross-origin writes and server validation. The platform validation tests cover the composer baseline.

`npm run build` creates the Sites Worker artifact. The tracked `.openai/hosting.json` preserves the existing Site identity and declares DB/BUCKET. Sites applies the generated schema migrations when publishing. Local and hosted data are separate.

The private hosted preview is https://elleson-socials.poeticbeech16.chatgpt.site and the private source repository is https://github.com/Ellesonntseare/Elleson-Socials. See `docs/STATUS.md` for checked behavior and `docs/PRODUCT.md` for the remaining product scope.


### Shared Node host

`server/node-host.mjs` exports `createSocialsHost({dataDir, mount: '/socials'})`. An authenticated host calls its `handle(req, res, {principal, origin})`; the principal contains a stable server-verified `id`, display/contact `email`, and owner-only `admin` flag. Never derive the principal from browser identity headers. Use Node 22.13+ (Node 24 recommended). Keep `dataDir` outside deployed source; it contains SQLite history, private media, and the encryption key. Back it up before moving hosts. The module runs pending append-only migrations and preserves saved data on code updates. The original hosted Site and GitHub repository remain independent.

Social developer app credentials can be configured by an administrator under Accounts → Connection settings. Keep `SOCIAL_TOKEN_KEY` stable. Do not commit app secrets, tokens, signing keys, or host data. Use a stable HTTPS origin for provider return URLs.


### Posting and phone notifications (0.5.0)

The main Schedule action reviews the chosen Facebook Page, post content and dates before a separate confirmation creates server publishing jobs. Calendar-only dates are a separate explicit option. The Schedule screen shows the next active job, preview, countdown, pause and change-time controls. Each post has account-scoped delivery details; only a successful Facebook reference is labelled Published. Uncertain delivery blocks blind retries.

For a standalone Node deployment, copy `server/runtime-package.json` to the deployed module's `package.json` and run `npm install --omit=dev --ignore-scripts` there. Keep runtime dependencies installed on future updates. The Node host generates an encrypted persistent Web Push signing key in the private data directory; preserve it with the existing encryption key. Push failures are isolated from publishing, expired subscriptions are removed, and transient notification failures have bounded retries. A push-service acceptance is not proof the phone displayed it.

On Android, open the HTTPS workspace in a compatible browser and choose Notifications → Enable phone notifications, then Send test notification. The APK opens the same browser-managed workspace. No Firebase project or social password is embedded in the APK. Plain HTTP LAN addresses cannot register background browser notifications. Physical phone permission, closed-app delivery and notification tapping require device verification. Original hosted Sites deployment is separate from the installed Connect host.
