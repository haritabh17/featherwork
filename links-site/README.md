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

`assetlinks.json` includes the **debug** keystore SHA256 for local/emulator builds.

For Play Store builds, add your **release/upload** certificate SHA256:

```bash
keytool -list -v -keystore YOUR_RELEASE_KEYSTORE -alias YOUR_ALIAS
```

Or Play Console → **Setup → App signing → SHA-256 certificate fingerprint**.

Append the fingerprint to the `sha256_cert_fingerprints` array in `.well-known/assetlinks.json`.

## Share URL format

```
https://badmlabs.github.io/i.html?d=<base64url>
```

Also supported for backward compatibility: `/court/import.html?d=...`, `/court/import?d=...`
and `/court/import/?d=...`.

## Future apps

Add another path (e.g. `shuttlrs/import/index.html`) and another entry in `assetlinks.json` for each Android app package.
