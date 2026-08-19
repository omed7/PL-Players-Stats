# Phase 0 Browser Verification

**Date:** 2026-08-19
**Environment:** Local static server at `http://localhost:4173` using the committed legacy preseason snapshot.

The application loaded successfully after `fixture_utils.js` was added before `script.js`. The legacy `players.json` snapshot, which contains an empty `players` array and no stable ID fields, remained readable and did not cause a JavaScript load error. The current generic preseason/no-results presentation remains unchanged by this increment and is scheduled for the public-launch experience phase.

A browser-console check of `window.FPLFixtureUtils.classifyFixtureSlot([])` returned:

```json
{"status":"unknown","fixtures":[]}
```

This confirms that absent fixture data now classifies as unknown rather than as a confirmed blank gameweek. The dedicated unit suite also covers known single, known double, and source-observed gameweek behaviour.


## Public-launch browser cache note

During local release verification, the browser initially served the pre-release application shell from its prior service-worker registration. The old registration was explicitly removed and its cache storage cleared before reloading the local page. This confirms the service-worker versioning check is necessary when evaluating new static releases.


## Public-launch release check

After the cache reset, the local release page loaded with the updated title, **“FPL Omed — Fantasy Premier League Player Intelligence.”** The valid empty `players` snapshot for an upcoming GW1 now renders: “The season has not started yet. Player statistics will appear after the opening matches.” The page did not show a load-error alert.

The document head exposes the expected canonical URL, descriptive metadata, `summary_large_image` Twitter card, Open Graph title, and the absolute `1200×630` FPL Omed social-image URL.


## Data-load failure check

A local browser test replaced the `players.json` request with a simulated network failure. The page exposed an assertive error alert reading, “Player data is temporarily unavailable. Please try again shortly.” It also displayed a keyboard-accessible **Try again** control and a matching non-misleading table state. This test confirms that a source failure is distinct from the valid preseason empty-data state.


## Live deployment observation

Immediately after the successful GitHub Actions check, the live Vercel browser session still displayed the prior title and generic empty-table message. This is not accepted as release verification. The next verification step is to clear the live service-worker cache and independently inspect the server response to distinguish cached assets from deployment propagation.


## Deployment blocker

The production URL did not yet expose the latest metadata or social asset after the main-branch release commit and successful GitHub Actions test. Direct asset verification returned `404`. GitHub deployment-status APIs are unavailable to the current token, and the Vercel dashboard requires an authenticated session. Production publication therefore remains an explicit blocker, not a completed release check.


## Vercel deployment diagnosis

Vercel now exposes the correct `pl-players-stats` project and recorded the public-launch commit `08a6cb7` as a Git production deployment. Its state is **BLOCKED**, not a build failure. The deployment metadata names `Manus AI <manus-ai@users.noreply.github.com>` as the commit author. Vercel’s Hobby-team collaboration guidance states that a private-repository deployment must be authored by the Hobby team owner whose Vercel account is linked to the Git provider. The next trigger commit must therefore be authored as the connected GitHub/Vercel owner, `omed7`, using the owner-associated noreply email.


## Protected production verification

The owner-authored Git trigger produced deployment `dpl_EmfGNXm4DKE9KPNyDA3HndfkBfPp` in **READY** state. Its protected production URL loaded successfully through a temporary Vercel inspection link. The page rendered the intentional preseason state, and the deployed document exposed the expected canonical URL, description, Open Graph title/image, and `summary_large_image` Twitter card.

The deployment is currently protected by Vercel authentication; the inspection link used for verification expires after 23 hours. The old `fpl-omed.vercel.app` site is a separate legacy deployment and should not be used as the launch URL unless it is explicitly moved or redirected to this Vercel project.


## Final metadata verification

The subsequent owner-authored deployment `dpl_vCJMSfB2taGG2Qy7kEZ9hWiwexfC` is **READY**. Its deployed canonical URL, Open Graph URL/image, Twitter image, and visitor-counter path now all use `https://pl-players-stats-omed7s-projects.vercel.app/`. The social image resolves from the same production domain.


## Anonymous public-launch verification

After disabling Vercel Authentication with user approval, the production URL loaded without a Vercel login or temporary access token. It rendered the expected preseason state. The deployed Open Graph image returned HTTP `200` with `image/png` content from the canonical production domain. Password protection and trusted-IP protection remain disabled as previously configured.
