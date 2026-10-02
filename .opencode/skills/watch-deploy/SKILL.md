---
name: watch-deploy
description: >-
  Watch the "Deploy to Firebase Hosting" GitHub Actions workflow and notify the
  user when the deployment finishes so they can try the live site. Use RIGHT
  AFTER pushing or merging changes that land on the `main` branch of
  cquidet-pro/the-bureau-of-provisions (a push to `main` is what triggers
  .github/workflows/firebase-deploy.yml). Also use when the user asks to "watch
  the deploy", "tell me when it's deployed/live", or "ping me when the
  deployment is done".
---

# Watch deploy & notify

This repo deploys to **Firebase Hosting** automatically:
`.github/workflows/firebase-deploy.yml` runs on every push to `main` (and on manual
`workflow_dispatch`), builds, and publishes to the live site (Firebase also serves
`https://<project>.web.app/`). The repo may be private; Firebase serves
independently of repo visibility.

The convention: whenever a change lands on `main`, follow the deployment run to
completion and send the user a **proactive notification** with the result and the
live URL, so they can immediately try it out — including from a mobile session.

## When this applies

- Only a push to **`main`** triggers a deploy. Pushing to a feature branch does
  **not** deploy — so if you only pushed a feature branch, there is nothing to watch
  yet. Tell the user the deploy will run once the branch is merged into `main`.
- **Skill/docs-only merges don't deploy at all** — if `firebase-deploy.yml`
  `paths-ignore`s `.opencode/**`, `**.md` and `docs/**`, a merge touching only
  those has NO run to watch. Skip this skill and skip the deploy notification
  entirely.
- After merging a PR into `main`, or after a direct push to `main`, run this skill.

## Steps (use the `gh` CLI — it works in this environment)

1. **Identify the deploy run** for the commit you just merged/pushed:

   ```bash
   gh run list --branch main --limit 5 \
     --json databaseId,status,conclusion,workflowName,headSha,event \
     -q '.[] | "\(.databaseId) \(.workflowName) \(.status) \(.conclusion) \(.headSha[0:8])"'
   ```
   Pick the "Deploy to Firebase Hosting" run whose `headSha` matches your merge commit.

2. **Wait for completion** — block on the run (finishes in ~1–2 min):

   ```bash
   gh run watch <run-id> --exit-status --interval 20
   gh run view <run-id> --json status,conclusion -q '"\(.status) \(.conclusion)"'
   ```
   If it's still running after ~5 minutes, report the current status + run URL rather
   than waiting silently.

3. **Notify the user — proactively**, with the result + live link. A plain chat reply
   may be enough here; use whatever proactive delivery channel the current tooling
   exposes (in Claude Code this is `SendUserFile` with `status: "proactive"`; in
   opencode, just reply and make sure the summary is clear).

   - On success: "✅ Deployed & live: <what changed> — <live-url>", and mention that a
     hard refresh (or closing all tabs, to update the service worker) may be needed.
   - On `failure`/`cancelled`/`timed_out`: say it failed, then investigate with
     `gh run view <run-id> --log-failed` and offer a fix.

## Post-deploy verification

After a successful deploy, verify the live site picked up the changes:

```bash
node .opencode/skills/force-site-update/force-update.mjs --verify
```

This checks that the live JS bundle contains the expected changes.

## Notes

- `gh` CLI **is** available — use it (`gh run list/watch/view`).
- A green Firebase run sometimes logs a benign "already active" retry warning — that's
  normal, not a failure.
- Keep notifications to one per deploy: the start ("watching the deploy…") is optional;
  the completion notification is the important one.
