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
