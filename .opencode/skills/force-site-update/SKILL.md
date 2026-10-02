---
name: force-site-update
description: >-
  Deployment checklist for shipping every change to the live site reliably.
  Use AFTER any push to main that should change the live site (the Bureau of
  Provisions static site on Firebase Hosting). Covers the CI/build-cache and
  service-worker failure modes that silently block changes, plus post-deploy
  verification.
---

# Skill: force-site-update (Deploy Checklist)

## Purpose
Ensure EVERY change lands on the live site, reliably. This document explains the
pipeline quirks that can silently block your changes AND the steps that guarantee
they ship.

**Use this skill after ANY push to `main` that should change the live site.**

---

## The pipeline — and what goes wrong

```
local build ✅ → git push → CI build → Firebase deploy → browser
                                                 ↕
                                          service worker cache
```

Every step has a failure mode we hit in production:

| Step | What fails | Symptom |
|------|-----------|---------|
| CI build | `tsc -b` reuses stale `.tsbuildinfo` → old output shipped | You see the fix locally but not live |
| Firebase deploy | Firebase skips files whose content hash didn't change | Old JS bundle stays live forever |
| Browser | Service worker caches `index.html` + JS bundles aggressively | Even incognito shows stale content |
| Everything | Nobody verifies the live site after deploy | Bugs are discovered by the user |

---

## Step-by-step deployment checklist

### 1. BEFORE push — local prerequisites

```bash
# 1a. Clear TypeScript incremental build cache (critical!)
rm -f tsconfig.tsbuildinfo

# 1b. Full build — must pass clean
npm run build
# Expected: zero errors, zero warnings
# ✅ tsc -b
# ✅ vite build
```

### 2. Push & wait for CI

```bash
git push origin main
```

```bash
# Find the deploy run
gh run list --branch main --limit 1 --json databaseId,status -q '.[0] | "\(.databaseId) \(.status)"'

# Watch it
gh run watch <run-id> --exit-status --interval 20
```

### 3. Verify the deploy LANDED (critical — never skip)

After the CI run turns green:

```bash
# 3a. Find the deployed JS bundle name
LIVE_JS=$(curl -s "https://<live-url>/" | grep -o 'assets/index-[^"]*\.js' | head -1)
echo "Live bundle: $LIVE_JS"

# 3b. Verify a SPECIFIC change made it (replace with your expected string)
curl -s "https://<live-url>/$LIVE_JS" | grep -c "EXPECTED_STRING"
# Must return > 0. If it returns 0, the deploy didn't pick up your changes.
```

**If the verification fails:**
1. Check if the CI actually built from your commit (`gh run view <run-id> --log | grep "headSha"`)
2. Check if the TypeScript build cache poisoned the CI build
3. Force a clean build by pushing a whitespace change to the affected file

### 4. Clear caches

```bash
# 4a. Bump service worker version (forces all users to refresh)
node .opencode/skills/force-site-update/force-update.mjs --clear-cache

# The script commits and pushes the bump itself.
```

---

## CI workflow quirks (for reference)

### TypeScript incremental build poisoning

The CI uses `tsc -b` (incremental build) with `cache: npm`. If a previous CI run
produced a `.tsbuildinfo` file that matches the current source's timestamps,
TypeScript **reuses the old compiled output** — even if the source changed.

**Fix**: The step "Clear TypeScript incremental build cache" above prevents this.
Always run `rm -f tsconfig.tsbuildinfo` locally before pushing.

### Firebase content-hash deduplication

Firebase only uploads files whose **content hash** differs from the last deploy.
If your change produces the same bundle hash (e.g., because of stale `tsc -b`
output), **Firebase silently skips the file** and the old content stays live.

**Symptom**: Local `npm run build` succeeds, CI succeeds, but the live site
shows old content. This is the #1 cause of "I fixed it but it's not live."

**Fix**: The TypeScript cache cleanup + post-deploy verification catches this.

### Firebase root-path cache (default `max-age=3600`)

A `Cache-Control: no-cache` header rule scoped to `*.html` does **not** match the
root request `/`. Firebase serves `/` as `index.html`, but it matches header
`source` against the URL path — so `/` falls back to Firebase's default
`max-age=3600` and the homepage is cached for an hour.

**Symptom**: You deploy, the CI is green, but the user still sees the old
homepage even though `/index.html` is fresh.

**Fix**: add an explicit `no-cache` header rule for `/` alongside `*.html` in
`firebase.json`:

```json
{ "source": "/", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
```

Verify with: `curl -sI https://<live-url>/ | grep -i cache-control` → must print
`no-cache`, not `max-age=3600`.

### Service worker cache

Even after Firebase deploys new files, the service worker in users' browsers
continues to serve cached content. The cache key is `<site>-<content-hash>`.

**Fix**: Bumping the service worker version (step 4 above) creates a new cache
key, forcing all users to download fresh content on next visit.

### Concurrency cancels in-progress deploys

The workflow has `cancel-in-progress: true`. If you push twice in quick
succession, the second push **cancels the first deploy**. This is normally fine,
but can cause confusion if you expected the first push to deploy.

**Fix**: Wait for CI to complete before pushing again.

---

## Quick reference — was my deploy successful?

Run this after every deploy:

```bash
# 1. Check CI status
gh run list --branch main --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"'

# 2. Check live bundle matches local build
LOCAL_JS=$(ls dist/assets/index-*.js | head -1 | xargs basename)
LIVE_JS=$(curl -s "https://<live-url>/" | grep -o 'assets/index-[^"]*\.js' | head -1)
echo "Local: $LOCAL_JS"
echo "Live:  $LIVE_JS"
# The base names (without the hash) won't match — that's normal.
# What matters is that your expected change exists in the live bundle.
```

---

## Rules

- **Never skip step 3 (verification).** Every "I fixed it but it's not live"
  bug was caught by a verification step that wasn't run.
- **Always clear tsconfig.tsbuildinfo before pushing.**
  TypeScript incremental builds will silently ship old output.
- **Don't push to main faster than CI can deploy.**
  Concurrency cancels the earlier run.
