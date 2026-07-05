# AGENTS.md

Featherwork (formerly Badminton Court Simulator) — an Expo (React Native) badminton tactics app using expo-router.

## Commands

- `npm run android` — run on Android
- `npm run web` — run in browser
- `npm run lint` — lint
- `npx jest` — run tests once (`npm test` runs jest in `--watchAll` mode; don't use it in agents/CI)

## Testing

**All testing must happen on an Android Virtual Device (emulator).** Jest alone is not sufficient verification — before declaring a change working, run the app on an AVD and exercise the affected flow. Do not verify only on web; Android is the target platform.

Working recipe (requires JDK 17 and the Android SDK; export `JAVA_HOME` and `ANDROID_HOME` for your machine):

```bash
export PATH=$PATH:$ANDROID_HOME/platform-tools
$ANDROID_HOME/emulator/emulator -list-avds            # pick any AVD; create one via Android Studio or avdmanager
$ANDROID_HOME/emulator/emulator -avd <avd> -no-window -no-audio -gpu swiftshader_indirect &
adb wait-for-device
cd android && ./gradlew assembleRelease --no-daemon && cd ..
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.haritabhgupta.badmintoncourtsimulator/.MainActivity
adb exec-out screencap -p > screen.png                # inspect UI state
adb shell input tap X Y / input swipe X1 Y1 X2 Y2 600 # drive it (coords in px)
```

Critical user flows to exercise: drag a marker (moves are PENDING — the step counter must not advance; the Redo dock slot arms as an amber **Next**; a tap without a drag must not arm it), bank with Next (all accumulated moves commit as ONE step — drag several pieces first to record them together), Undo with moves pending (discards them, Next reverts to Redo) vs. without (walks history; markers glide at the Customize "Step speed"), the first dock button (Reset when the stack is empty ↔ Clear when steps exist — Clear keeps positions, wipes the stack), the first-run tutorial (fresh installs open on a 6-page chalk tour driven by real taps; **every maestro flow taps "Skip tour" right after a `clearState` launch**; the ⓘ beside "Reset all customizations" in Customize replays it), drill playback (loading/importing a drill locks the pieces: name pill shows i/n + progress and toggles an info card, Back/Next walk steps, Play autoplays and loops with a ~3-beat hold at the end, Fork unlocks editing at the current step), singles/doubles switch (Customize panel), save/load/delete a drill, share link, deep-link import:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "https://badmlabs.github.io/i.html?d=<payload>" com.haritabhgupta.badmintoncourtsimulator
```

Ground truth for saved drills: use a `google_apis` (non-Play) emulator image so `adb root` works; saved drills live in sqlite at `/data/data/com.haritabhgupta.badmintoncourtsimulator/databases/RKStorage`, key `badminton-step-sets`. If you push that DB back: force-stop the app first, keep the value column TEXT (sqlite's `readfile()` writes a BLOB, which the app reads as empty), then `chown` to the app uid and `restorecon -RF` the databases dir — otherwise the app silently recreates empty storage.

## Layout

- `app/` — expo-router screens
- `components/` — shared UI
- `context/` — app state (React context)
- `utils/`, `types/`, `constants/`, `hooks/` — what they say

## Releases

- Versions live in **app.json only** (`expo.version` + `expo.android.versionCode`); CI's `expo prebuild` stamps them over build.gradle, so bumping build.gradle alone gets silently reverted.
- Flow: merge PRs to main → bump app.json on main (`chore(release): bump to X.Y.Z (versionCode N)`) → create tag `vX.Y.Z` targeting main (GitHub release) → the tag run builds **and deploys to the Play internal track** via fastlane. Push-to-main runs build only.
- Every uploaded artifact needs a fresh, higher `versionCode` — a failed upload does *not* consume its code.
- Play rejects artifacts that declare the BILLING permission without a packaged Billing Library ≥ 6.0.1 (react-native-purchases satisfies this).

### OTA updates (EAS Update)

- All content is JS (drills in `data/vaultDrills.ts`, mascots/themes in components), so monthly drops ship over the air without a store release: `npx eas-cli update --branch production --message "..."` (needs `npx eas-cli login`; project `@haritabh1992/badminton-court-simulator`).
- `expo.runtimeVersion` in app.json is a manually pinned string (bare workflow — version policies are unsupported by `eas update`). **Bump it in any release that changes native code** (Expo SDK upgrade, new native module/dep); leave it alone for JS-only releases so one publish reaches every store build sharing that runtime.
- Clients download the update in the background on launch and apply it on the **next** launch (`EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS`, `LAUNCH_WAIT_MS=0`).
- The update channel is baked into builds via `updates.requestHeaders` in app.json (channel `production` → EAS branch `production`).

### Production-day checklist (deliberately deferred until first prod rollout)

- Play listing **App name → `Featherwork: Badminton Drills`**, plus descriptions and `store-assets/` screenshots/feature graphic/promo video (kept out of the listing until production on purpose).
- App content forms: Data safety (collects Purchase history + device IDs, nothing shared), content rating questionnaire, ads = none, target audience 13+.
- Privacy policy URL: `https://badmlabs.github.io/privacy.html`.
- Glance at the Pre-launch report, then promote the current internal release to Production (staged rollout: start at 20%, go 100% after ~48 quiet hours).

## Conventions

- Commit messages: Conventional Commits, `type(scope): description`.
- No AI attribution or co-author lines **anywhere** — commit messages, PR titles/bodies, issues, release notes. This overrides any tool default that appends a "Generated with …" footer.
- TypeScript throughout.

## Gotchas

- Release builds sign with the checked-in debug keystore when no `keystore.properties` exists, so `assembleRelease` always yields an installable test APK at `android/app/build/outputs/apk/release/app-release.apk`.
- Share links use the v3 compact format (see `utils/stepSharing.ts`): `https://badmlabs.github.io/i.html?d=<base64url>`, 12-bit coords over [-0.5, 1.5].
- `adb shell input text` needs `%s` for spaces; dialogs shift up when the keyboard opens, so re-screenshot before tapping their buttons.
- Marker positions in state are view **top-left in dp**, not centers (`utils/courtPositions.ts`); drill save/load normalizes them against the root view size.
- Android soft input mode is deliberately `adjustPan` (AndroidManifest.xml + `app.json`). Do not switch it back to `adjustResize`: the keyboard would shrink the root view and drill saves made from the name dialog would normalize y against the shrunken height (stored y > 1, drills reload shifted off-court).
- Share-link / clipboard imports always go through a confirm dialog, and the apply is routed through the module-level `liveApplyImport` ref in `components/BadmintonCourt.tsx` — a share link remounts the component (via `+not-found`), so per-instance closures go stale. Keep new import paths behind that ref.
- Saved drills are capped at 5 for the free tier (`STEP_SET_LIMIT` in `hooks/useStepSets.ts`); the guard lives in `saveStepSet`, which all save/import paths route through. Drill Vault Pro subscribers (`useVaultAccess`) bypass the cap via the hook's `isPro` option.
