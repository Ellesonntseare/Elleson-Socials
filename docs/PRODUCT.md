# Product scope and architecture

User decision: build a web app plus an Android app. Working name: Elleson Socials. Reference product: Metricool. Research checked 2 November 2026.

## Coverage

Publishing scope includes Facebook Pages, Instagram professional accounts, Threads, X, Bluesky, LinkedIn profiles/organizations, Pinterest, TikTok, YouTube and Google Business Profile. Twitch belongs to analytics. Meta Ads, Google Ads, TikTok Ads, websites/blogs and link-in-bio belong to dedicated modules. Scope does not imply approved or implemented API access.

The composer catalog is in `dist/platforms.js`. Images, galleries, mixed carousels, video, Reels, Stories, Shorts, Pins, documents, threads and business posts need distinct schemas and previews. Thread segment editors, business offer/event details, Ghost post availability, trial Reels, native-app polls and platform-specific music/stickers/collaborators need additional provider investigation before claiming complete format parity. A single caption box with a format label does not implement those richer workflows.

Additional metadata includes alt text, media order, cover/thumbnail, destination link, board, first comment, location, mentions/tags, collaborators, product tags, reply permissions, language, video visibility, made-for-kids designation, AI disclosure and commercial-content settings. Expose only fields that apply to the selected account and format. Preserve a common post plus per-channel overrides.

## Technical media requirements

Maintain a versioned rule catalog per platform, post type and account capability. Distinguish recommended dimensions from hard restrictions. Validate MIME/container, actual codec, file bytes, count, duration, aspect ratio, frame rate, bitrate and required metadata. Detect media on the server rather than trusting the filename. Offer explicit crop/transcode derivatives; retain originals and show each target's result before publishing. Never silently turn a carousel into a single image or cut a video to fit a limit.

Primary interchange targets: JPEG/PNG/WebP images as supported, MP4/H.264 with AAC for broadly compatible video, and supported LinkedIn documents. GIF treatment differs per network. Vertical 9:16, portrait 4:5, square 1:1, landscape 16:9 and Pinterest 2:3 are useful editing presets; they are not universally valid for every format.

Current client checks are preliminary. X needs weighted-text parsing. Thread limits apply to individual segments. Account-specific video limits and TikTok creator settings must be fetched dynamically. Provider responses remain authoritative.

## Server design

Use a durable API shared by web and Android. Implement identity and brand membership before storing real user tokens or content. Suggested deployment: HTTP API, relational database, private object storage, a durable job queue, a clock-triggered dispatcher and media-processing workers. Cloudflare Workers/D1/R2 are compatible with the Sites web hosting path, while CPU-heavy video processing needs an external worker service. No network credentials or social account passwords belong in the browser or APK.

Records: users, brands, memberships, social_accounts, encrypted_token_refs, media_originals, media_derivatives, posts, post_targets, thread_segments, schedules, publish_attempts, publication_receipts, comments, metric_snapshots and audit_events. Each record is scoped to brand ownership; storage operations enforce authorization independently of UI navigation.

Store UTC instants alongside IANA timezones and display them in the chosen brand timezone. Define daylight-saving behavior for future recurring queues. Planned content and dispatch jobs are separate states. Suggested target lifecycle: draft → needs_approval → ready → scheduled → uploading → publishing → published / failed / needs_manual_action. Only a provider receipt or confirmed status creates `published`.

Claim due jobs atomically with leases. Use idempotency per target, separate retryable errors from user-action failures, refresh expiring tokens safely, enforce rate limits, and retain attempt history. Reconcile ambiguous timeouts before retrying any create/publish request. Recheck capability rules and permissions immediately before dispatch. Web and Android closing must have no effect on server jobs.

## Integration delivery

Implement a provider adapter interface with capability lookup, authorization start/callback, token refresh/revoke, media preparation, validation, publish, status reconciliation and analytics. Each adapter remains unavailable until it has real configuration and end-to-end verification. Show reconnect, approval-required, unavailable-format and quota states in plain English.

Register developer apps and complete required provider reviews. TikTok Direct Post explicitly requires scopes, creator authorization and an audit to lift private-viewing restrictions. Reviews and account limitations are outside our control; do not promise approval. OAuth verification, quotas and permissions must be checked separately for each provider.

Provide a manual completion workflow for formats unavailable through official APIs. It should prepare the caption and correct media, send a real reminder, hand off to the native platform, and let the user record completion. A reminder is not direct publishing. Do not use password collection or hidden browser automation as a substitute for supported account authorization.

## Delivery order

1. Planning preview and shared Android shell (current milestone).
2. Identity, brands, database, object storage, synchronization and server API.
3. One fully verified publishing adapter and durable dispatcher, then the remaining adapters behind capability flags.
4. Full format-specific composers, previews, media transformations and manual handoff.
5. Analytics, reports, supported inbox operations and approvals.
6. Twitch, ads, website analytics, RSS/evergreen content and link-in-bio.
7. Android signing, distribution, native sharing/export, notification delivery and device testing.

## Sources

- Metricool platform coverage: https://metricool.com/metricool-mega-tutorial/
- Scheduling and posting: https://help.metricool.com/scheduling-and-posting-options-by-social-network-cwmb3
- Media requirements: https://help.metricool.com/publishing-requirements-for-images-and-videos-from-metricool-vfc8n
- Twitch analytics: https://help.metricool.com/how-to-connect-twitch-to-metricool-fudap
- TikTok Direct Post: https://developers.tiktok.com/doc/content-posting-api-get-started

Metricool's general marketing article and publishing guide disagree about some account types/counts. Prefer the detailed help guide for this baseline; validate current official API behavior before implementing live publishing.
