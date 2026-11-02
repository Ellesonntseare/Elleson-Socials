# Elleson Socials

A shared web and Android social-content workspace. Version 0.1 is a working **local planning preview**. It does not yet connect accounts, publish posts, schedule server jobs, synchronize devices, retrieve analytics or deliver notifications.

## Run the web app

Requires Node.js 22 or later.

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:4173. The hosted preview is private to the owner through Sites. IndexedDB data belongs to each origin and device: localhost, the hosted site and the Android app have separate storage. Export/import is the current transfer mechanism. Browser data clearing or app uninstall can remove local drafts and media; keep a workspace export.

## Android

`android/` is a generated Capacitor native project with bundled web assets. It is not a released Android application. After web changes:

```powershell
npm run android:sync
npm run android:open
```

Build using Android Studio, JDK 21 and the Android SDK required by `android/variables.gradle`. For a debug APK from an environment with the toolchain configured:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK is generated under `android/app/build/outputs/apk/debug/`. Release signing, native file export/share, Android back handling, notifications, share-target integration and physical-device QA remain to be implemented. Do not market the native build as feature-complete.

## Available

- Month and list calendar; drafts; create, edit, duplicate and delete posts.
- Ten publishing-network definitions and per-network captions and format choices.
- Media uploads stored in IndexedDB, with dimensions and video duration where the browser can inspect the asset.
- Basic caption/media compatibility validation. This is not a full publishability validator: account capabilities, weighted X text, codecs, duration, dimensions, sizes, rights and quotas require server/provider validation.
- Workspace JSON export/import including media. Import merges new IDs and preserves existing records. Large backups can require substantial browser memory.
- Clear connection state and an in-app roadmap, with no fabricated account data or performance statistics.

## Verification

`npm test` exercises cross-platform caption overrides, empty content, media compatibility, video cardinality, document routing, image carousels and unknown formats. Browser checks are recorded in `docs/STATUS.md`.

## Product and integration plan

See `docs/PRODUCT.md`. Format definitions are a dated planning baseline; revalidate against the owning provider APIs and authorized account before enabling an integration. No secrets belong in web assets, browser storage or Android resources.
