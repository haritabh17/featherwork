# badmlabs.github.io — App Links hosting

Deploy **contents of this folder** (not the `links-site` folder itself) to the root of the
[`badmlabs.github.io`](https://github.com/badmlabs/badmlabs.github.io) repo.

## Setup

1. Enable GitHub Pages: repo **Settings → Pages →** branch `main`, folder `/ (root)`.
2. Jekyll excludes dot-directories by default — `_config.yml` includes `.well-known` so
   `assetlinks.json` is published. `.nojekyll` is also present as a fallback.
3. Verify:
   ```bash
   curl https://badmlabs.github.io/.well-known/assetlinks.json
   curl -I "https://badmlabs.github.io/court/import?d=test"
   ```

## Release fingerprint

`assetlinks.json` includes only the **Play App Signing** certificate SHA256
(Play Console → **Setup → App signing → App signing key certificate**).
The debug keystore fingerprint is deliberately excluded — the debug keystore is
committed to a public repo, so listing it would let anyone's rebuild pass App
Links verification for this domain.

Local/emulator builds therefore don't auto-verify links. To test link import
locally, either tap through the app-chooser dialog or force verification:

```bash
adb shell pm set-app-links --package com.haritabhgupta.badmintoncourtsimulator 2 all
```

## Share URL format

```
https://badmlabs.github.io/i.html?d=<base64url>
```

Also supported for backward compatibility: `/court/import.html?d=...`, `/court/import?d=...`
and `/court/import/?d=...`.

## Future apps

Add another path (e.g. `shuttlrs/import/index.html`) and another entry in `assetlinks.json` for each Android app package.
