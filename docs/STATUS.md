# Version 0.2 — cloud planning milestone

Prepared on 2 November 2026. Check the delivery message and current GitHub run for final build and deployment outcomes.

## Checks completed during implementation

- 33 automated tests passed, including 17 API checks using the generated database migration, 4 cloud client checks and 12 platform checks.
- The first production Worker build passed. The starter's Next and Sharp versions were then updated after audit findings; the patched build is checked separately before publication.
- Local Workers preview and local D1 migration execution crashed with a Windows workerd access violation. This is a runtime limitation on this PC; database behavior is covered by the SQLite API tests, and a built-Worker D1/R2 integration check is configured on the Linux CI runner.

## Implemented

- Existing planner, ten-platform catalog, drafts, calendar, media library and backups retained.
- Sites-managed web sign-in and one private cloud workspace per authenticated user.
- D1 post records with optimistic revisions and deletion tombstones.
- Private R2 media storage and owner-authorized media delivery.
- Cross-origin write rejection, request-size limits, safe post schemas and media signature checks.
- Cloud & storage view, explicit local-to-cloud copy, backup transfer and a manual refresh action.
- Background cloud refresh every 30 seconds while the editor is closed.
- Android 0.2 preview source with local planning and browser-based access to the authenticated cloud workspace.
- Simplified navigation: Planner, Create, Media, Channels and More. Drafts and manually posted history are grouped inside Planner; backups and reports are reachable from More.
- Per-channel previews and richer planning fields: thread segments, X/LinkedIn polls, YouTube titles/audience/visibility, Pinterest boards/links, business offers/events, covers and optional first comments/disclosures.
- Browser image crop presets, video-frame cover capture, attachment reordering and per-image descriptions. Originals remain in the library.
- Manual posting assistant with caption copy, file downloads, platform handoff and explicit user-reported completion. Reusing a completed post creates a draft and clears its completion flags.
- Workspace activity counts and CSV planning reports. These do not claim social performance or automatic publication receipts.

## Limits

- Social account authorization and posting are not implemented. Planned dates do not create publishing jobs or notifications.
- Native Android records remain local; native account sessions and automatic native synchronization remain unfinished. Cloud content is shared between authenticated browser sessions.
- Cloud uploads are limited to 25 MB per file. Full codecs, video processing and platform-specific media validation are future work.
- Only one personal workspace per user is implemented. Multiple brands, teams and invitations are future work.
- Browser-driven tests and local SQLite tests cannot establish physical Android behavior. Device QA remains required.
- Dedicated video transcoding/trimming, live social analytics, native Android authentication/sync and notifications remain unfinished.
- The previous turn's screenshot capture failed in both browser surfaces; visual verification must be attempted again for this version.

Version 0.1 already passed twelve platform tests, a successful Android debug build, and a browser draft persistence/calendar flow. Those prior results do not establish the new cloud behavior.


## Admin and province content update — 2026-11-02

- Added `/login` with the supported ChatGPT sign-in flow. No separate password database is created.
- `ADMIN_BOOTSTRAP_EMAIL` binds the verified owner once; administrator authorization thereafter uses the stable Site user ID.
- First owner session imports 65 unique South Africa by Province Facebook image drafts from the supplied four ZIPs. Posts 25, 45 and 55 are deduplicated by matching image/caption hashes. Reopening never overwrites edits or resurrects deletions.
- Images ship with this owner-private publication; post/media records are saved in the owner cloud workspace when the owner opens it. Direct media access remains protected by the private Site audience.
- SQLite triggers record post versions atomically, including edits and deletions. Admin & recovery restores copies as new drafts, with retained media, without overwriting current work. The interface lists 150 recent versions; database history is retained without automatic pruning in this release.
- Existing full workspace export includes active posts and media; it excludes cloud version history. Original ZIPs remain unchanged. Supplied statistical claims have not been independently checked.
- 53 automated tests include owner binding, retry-safe 65-post imports, media isolation and revision recovery. Hosted owner sign-in remains a user step; no social network publishing is performed.


## 0.3.0 — account and shared-host update

- Plain-English navigation: Schedule, Drafts, Files, Accounts, Settings. Removed the roadmap and marketing text from user flows.
- Serialized autosave, collection search and filtering, bulk collection changes and date assignment. Dates remain saved plans; automatic social publishing is not implemented.
- Server-owned activity rows record post/file/connection changes in the same SQLite/D1 transaction, scoped to the account workspace. Hosted routes never fall back to device data.
- OAuth connection handlers for Facebook, Instagram, Google/YouTube, Google Business Profile, LinkedIn, TikTok, X, Pinterest and Threads; Bluesky uses an app password. Provider apps still require real credentials, correct return URLs, products/permissions and applicable platform approval. No live account authorization has been verified.
- AES-GCM encryption binds tokens to their workspace/account; browser responses do not include tokens or app secrets. App settings are administrator-only.
- A Node host module in `server/node-host.mjs` mounts the standalone app at `/socials`, using a trusted host principal, persistent SQLite, private files and a server-held encryption key. Cloud and self-hosted account data are separate; transfer uses explicit backups.
- Android 0.3.0 offers server-backed sign-in through the browser and recovery/export of older device data. It does not claim native ChatGPT session synchronization. Stable APK signing is configured in GitHub Actions; older preview APKs used ephemeral signing keys and may require backup/migration before replacement.
- 66 automated tests cover concurrency, account isolation, authenticated Node mounting, durable activity, private media, recovery, encrypted tokens, OAuth state and replay protection. Actual provider approval flows and physical Android interaction remain unverified.

- 2026-11-02: hosted publication is blocked because the active Sites connector now lists only the ellesontrading@gmail.com account and returns project_not_found for the retained Socials Site. Keep its ID and audience; do not create a replacement. APK 0.3.0 and GitHub CI passed.


## Installed shared-server verification — 2026-11-02

- Mounted Socials on the installed Connect server at `/socials/`, using the existing Connect account scope and owner Google sign-in. Existing config, password, sessions and account storage were preserved; changed host files and config were backed up before restart.
- Verified on the installed server: 65 drafts, 65 PNG images, no planned dates, 100 recent server-generated activity records, and first/last media downloads. The owner Google account uses the same owner workspace as password-paired access.
- Production data is outside deployed source at `%LOCALAPPDATA%/Elleson/Socials`; app updates retain SQLite, private files, history and the encryption key. Daily local database snapshots do not protect against loss of the PC; retain an external workspace backup too.
- The original ChatGPT-hosted Site remains a separate database on its previous version until its Sites connection is restored. Imported drafts are currently on the Connect server, not that original Site.
- Connect passed 445 tests; targeted Projects UI and installed-module integration tests also passed. Browser control is currently disabled in Work settings, so installed UI screenshot verification was unavailable.


## 0.3.1 — visual posts, calendar visibility and connection setup

- Redesigned the app around a deep green navigation rail, larger typography, a quieter background and image-first draft cards using real saved post media.
- Added full post preview with channel switching and carousel navigation; previews never modify drafts.
- Schedule all reviews every selected date, supports one shared time or spaced calendar dates, validates all content before writing and reports partial-save failures. Dates are plans, not publishing jobs.
- Calendar days show No posts or a post count, thumbnail previews, occupied-day backgrounds and a day detail dialog.
- Added a protected three-step Facebook developer app setup with copyable return URL, requested permissions and usual Facebook authorization. Other platforms retain their connection settings and OAuth flows.
- Corrected the Facebook Page listing request to avoid requesting Instagram-only fields without Instagram permissions.
- Shared-host OAuth now returns to a minimal public document, then exchanges the approval code through an authenticated same-origin fetch. This supports Connect's Strict session cookies without weakening them. State remains account-bound, one-time and expiring.
- Verified 70 Socials tests and 14 focused Connect/server/Projects checks. Real Meta/X authorization requires configured developer app credentials; no live social publication is claimed. Browser visual inspection remained unavailable because browser control is disabled in Work settings.
