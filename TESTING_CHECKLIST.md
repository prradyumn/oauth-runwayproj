# Console walkthroughs — your manual part (~90 min)

These walkthroughs turn guide claims into **✅ Tested** evidence. Go as far as you can **without paying, submitting anything for review, or keeping real secrets**.

**For every app:**
1. Start a timer.
2. Take screenshots at each numbered checkpoint below. Save them as `public/evidence/<app>/<n>-<short-name>.png` (crop out emails and secrets).
3. Fill in the notes block at the bottom of each section.
4. Delete or rotate any client secret you created. **Never paste a secret into the repo or chat.**

When you're done, send me the notes blocks. I'll turn them into `testLog` entries, upgrade the matching claims to ✅ Tested, and log anything that contradicts the guide in VERIFICATION.md. Contradictions are valuable: they're the "what I corrected" evidence.

Redirect URI to paste everywhere: `https://backend.composio.dev/api/v3/toolkits/auth/callback`

---

## 1. GitHub (~10 min, should finish completely)
Go to https://github.com/settings/applications/new
1. Screenshot the empty "Register a new OAuth app" form. Note the exact field names.
2. Fill in name / homepage / callback URL and register. Screenshot the app page (client ID visible, **no secret**).
3. Check: is there a wildcard callback or "expire user authorization tokens" option, and what's the default?
4. Optional: if you own a GitHub org, go to org Settings → Third-party access → OAuth app policy and screenshot the restriction setting.
5. Delete the app afterwards.

```
GitHub notes:
- minutes taken:
- field names as shown:
- anything different from the guide:
```

## 2. Slack (~15 min)
Go to https://api.slack.com/apps → Create New App → From scratch (or From manifest, using the manifest in the Slack guide's Drafts section).
1. Screenshot the create dialog.
2. OAuth & Permissions: add the redirect URL. Screenshot it, and confirm whether it rejects `http://` (HTTPS only).
3. Add bot scopes `channels:history`, `chat:write`. Screenshot.
4. **Manage Distribution**: screenshot the checklist. *(This is the guide's biggest open question: what's on it, and does it ask for a privacy policy?)*
5. Install to your own workspace. Note whether an admin approval prompt appears.

```
Slack notes:
- minutes taken:
- Manage Distribution checklist items:
- anything different from the guide:
```

## 3. Gmail / Google Cloud (~25 min)
Go to https://console.cloud.google.com → New project → APIs & Services.
1. Enable the Gmail API. Screenshot.
2. Google Auth Platform → Branding / Audience. Screenshot the **User type** choice (Internal shows up only with a Workspace account).
3. Audience: screenshot the **Testing** status and the test-users limit text.
4. Data access → Add scopes → add `gmail.readonly`. **Screenshot the restricted-scope warning.** Then add `gmail.send` and screenshot how it's labelled (sensitive?).
5. Clients → Create OAuth client → Web application → add the redirect URI. Screenshot. *(Check for an "AI-powered agent" option mentioned in the guide's open questions.)*
6. Don't click "Publish app" or submit for verification. Delete the client secret.

```
Gmail notes:
- minutes taken:
- restricted/sensitive labels exactly as shown:
- test-user limit text:
- anything different from the guide:
```

## 4. LinkedIn (~15 min)
Go to https://www.linkedin.com/developers/apps/new
1. Screenshot the form, including the required **Company Page** field. Note whether you can continue without a page.
2. After creating it: open the **Products** tab and screenshot the list. *(Check: is "Community Management API" greyed out on an app that already has other products? That's the guide's big gotcha.)*
3. Request "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn". Note whether they're approved instantly.
4. Auth tab: add the redirect URL and screenshot. Note the token TTL if shown.

```
LinkedIn notes:
- minutes taken:
- products approved instantly? which:
- Community Management API state:
- anything different from the guide:
```

## 5. HubSpot (~20 min)
Create a free developer account at https://developers.hubspot.com.
1. Screenshot the developer home. Is there a web "Create app" button, or only the CLI (`hs project create`)?
2. If the CLI is needed: `npm i -g @hubspot/cli`, then `hs init` and `hs project create`. Screenshot the terminal (hide the token).
3. Look for the distribution settings and the **25-install** "unverified app" limit text. Screenshot.
4. Look at Marketplace listing requirements in the portal (3 installs). Screenshot.

```
HubSpot notes:
- minutes taken:
- web form or CLI only?:
- install cap text:
- anything different from the guide:
```

---

## After the walkthroughs: test live generation (~15 min)
Once the keys are in `.env.local`, run `npm run dev` and generate 2–3 apps you've never looked at, for example **Zoom**, **Calendly** and **Xero** (Xero has no Composio-managed app). Note:
- how long each took
- anything obviously wrong in the result

Record a 3-minute Loom: the problem → the Gmail guide (switch scenarios) → a live generation → the evidence badges and VERIFICATION.md.
