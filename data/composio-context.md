# Composio OAuth context (researched 2026-10-19)

Source method: every docs.composio.dev page has a Markdown version at `<url>.md`, which returns the full page body to a plain `curl`/fetch. The `llms.txt`, `llms-index.txt`, `llms-full.txt` and glossary (`/llms.mdx/reference/glossary`) endpoints also return plain text. The HTML pages are partly JS-rendered. For example, the raw HTML of `/toolkits/managed-auth` has the headings but not the toolkit table rows: "Airtable" and "Shopify" do not appear in it. **For scraping, use the `.md` URLs.** composio.dev/auth/* (the marketing site, built with Framer) returned real content through plain fetch.

Quotes below are copied verbatim from the `.md` responses.

---

## 1. Composio-managed OAuth and the managed OAuth app directory

**Directory URL:** https://docs.composio.dev/toolkits/managed-auth (Markdown: https://docs.composio.dev/toolkits/managed-auth.md)
Fetch: the `.md` is full content. In the HTML the table is JS-rendered. Confidence: **high**.

> Composio can provide the OAuth app that your users authorize when they connect a toolkit. You do not need to register an OAuth app or supply its client ID and client secret.

> This list covers only toolkits that support OAuth. It does not include toolkits that use only API keys, bearer tokens, Basic auth, or no authentication.

> If `composio_managed_auth_schemes` contains the toolkit's OAuth method, Composio provides the OAuth app. If the field does not contain that method, register your own OAuth app and supply its client ID and client secret.

> Some toolkits support more than one authentication method. A toolkit appears under **Composio-managed OAuth available** when Composio manages at least one OAuth method. Open the toolkit page to check each method.

The page has two sections: **"Composio-managed OAuth available (123)"** and **"Bring your own OAuth app (211)"**.

The programmatic check from the same page:
```bash
curl 'https://backend.composio.dev/api/v3.1/toolkits/gmail' -H 'x-api-key: YOUR_API_KEY'
# read `composio_managed_auth_schemes`
```

The `llms-full.txt` copy of this page (likely an older version) adds:
> For a toolkit with managed OAuth, Composio maintains the OAuth app registration, client credentials, and redirect URI. Your users sign in to the provider and approve the requested permissions.

The glossary (https://docs.composio.dev/llms.mdx/reference/glossary) says:
> **Composio Managed Auth**: The default mode in which Composio supplies its own OAuth app credentials for each toolkit. It requires no setup.

The Managed vs custom auth page (https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app) says:
> **[Composio managed apps](/toolkits/managed-auth)**: Composio registers and maintains OAuth apps for popular toolkits such as GitHub, Gmail, and Slack. You do not need to register your own OAuth app.

---

## 2. Concepts: toolkit, auth config, connected account

Glossary: https://docs.composio.dev/llms.mdx/reference/glossary (plain text). Confidence: **high**.

> **Toolkit**: A collection of related tools for a single external service. Users connect to a toolkit through authentication, and all of its tools execute with the user's credentials.

> **Auth Config**: A blueprint that defines how authentication works for a toolkit: the auth method (`OAUTH2`, `API_KEY`, `BEARER_TOKEN`, or `BASIC`), scopes, and credentials. A [session](/docs/how-composio-works) creates one automatically when it needs one. To use your own OAuth credentials or non-default scopes, [create a custom one](/docs/auth-configuration/custom-auth-configs).

> **Connected Account**: A stored set of credentials (OAuth tokens or API keys) linked to a userID, created when a user authenticates with a toolkit. Composio refreshes OAuth tokens automatically, and a user can have [multiple connected accounts](/docs/authentication/managing-multiple-connected-accounts) for the same toolkit. IDs are prefixed `ca_`.

Toolkits page: https://docs.composio.dev/docs/toolkits.md
> A **connected account** stores a specific user's authenticated connection to a toolkit. For example, `gmail` is the toolkit, while your user's work Gmail account is a connected account.

Authentication page: https://docs.composio.dev/docs/authentication.md
> When a tool needs an account, it reads the toolkit's **auth config** (how that toolkit authenticates: method, scopes, credentials), creates a connection, and returns a secure [Connect Link]. This works for all Composio managed connections, so you don't have to set up any OAuth credentials yourself.

> You only need a [custom auth config](/docs/authentication/custom-app-vs-managed-app) to bring your own OAuth app, request specific scopes, or use a toolkit without managed auth.

### How your own OAuth app relates to users' connected accounts

The model is a chain: one developer OAuth app (client ID and secret) feeds one custom auth config (`ac_...`) for one toolkit. Each end user then authorizes through that config, which creates a connected account (`ca_...`) under their userID.

https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app.md
> Creating the auth config isn't enough on its own. A session uses your config only when you pass its ID to `authConfigs`, keyed by toolkit. Toolkits you leave out keep using Composio managed auth.

> You don't have to pick one approach for all toolkits. Use your own credentials for toolkits where users see consent screens (GitHub, Google, Slack) and Composio managed auth for the rest. Each toolkit gets its own auth config independently.

https://docs.composio.dev/docs/authentication/white-labeling-authentication.md
> Existing connected accounts are tied to the auth config they were created with. Switching to a custom auth config affects new connections for that toolkit; existing users keep using their current connected accounts until they re-authenticate or you import/migrate their credentials.

Old-to-new terminology (from llms.txt "Notes for AI Code Generators"): integration became **auth config**, connection became **connected account**, apps became **toolkits**, and entity ID became **user ID**.

---

## 3. When to use your own OAuth app instead of the managed one

https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app.md. Plain `.md` fetch. Confidence: **high**.

> * **Your users see OAuth consent screens.** In production, users should see your app name, not "Composio." This is the most common reason to switch.
> * **You need custom scopes.** Composio's default scopes may not include everything you need (e.g., write access to a specific Google API).
> * **You're hitting rate limits.** Managed apps share quota across all Composio users. Your own app gets a dedicated quota.
> * **You need faster polling triggers.** Managed auth enforces a 15-minute minimum polling interval; your own app can use shorter polling intervals where supported.
> * **You're connecting to a custom instance.** Self-hosted or regional variants (e.g., a private Salesforce subdomain) need their own OAuth app.
> * **Enterprise customers require your branding end-to-end.**

The same page lists when to stay on managed apps:
> **Branding on consent screens doesn't matter yet.** Users will see "Composio wants to access your account" during OAuth. Fine for internal tools, prototypes, and development.

Toolkit-specific signals from the toolkit pages (`.md` fetch):
- HubSpot (https://docs.composio.dev/toolkits/hubspot.md):
  > You cannot add new scopes to the managed app, and you cannot remove scopes that are non-optional for that managed auth config. If you need a different scope set, create a custom HubSpot OAuth app and configure those scopes there.
- HubSpot again:
  > HubSpot shows this warning because the default Composio-managed HubSpot OAuth app is still awaiting HubSpot approval.
- Slack (https://docs.composio.dev/toolkits/slack.md):
  > Composio is working on Marketplace review for the managed Slack app. Until that review is complete, use the workspace's own Slack OAuth app or ask a workspace admin to approve the app if the warning blocks users.
- Gmail (https://docs.composio.dev/toolkits/gmail.md):
  > If a user on Composio-managed Gmail auth hits Google's "app is blocked" / unverified-app screen after adding `gmail.settings.basic`, use your own Google OAuth app verified for `https://www.googleapis.com/auth/gmail.settings.basic`, then reconnect.

---

## 4. Redirect / callback URI to register in the provider console

**Value:** `https://backend.composio.dev/api/v3/toolkits/auth/callback`. Confidence: **high**. Caveat: the dashboard's per-auth-config value is authoritative, and some toolkits still default to the legacy URL (see below).

Programmatic auth configs: https://docs.composio.dev/docs/authentication/programmatic-auth-configs.md
> Bring your own OAuth app to show your branding on consent screens, request custom scopes, or get a dedicated rate-limit quota. Register the app in the provider's developer portal, set its authorized redirect URI to Composio's callback, then pass the client ID and secret.
> ```
> https://backend.composio.dev/api/v3/toolkits/auth/callback
> ```

> Set `oauth_redirect_uri` to the exact URL registered in your provider's OAuth app. Some toolkit defaults still use the supported legacy endpoint `https://backend.composio.dev/api/v1/auth-apps/add`. If you omit `oauth_redirect_uri`, register the toolkit's default URL with your provider. When you [route the callback through your own domain](/docs/authentication/white-labeling-authentication#routing-the-callback-through-your-domain), set your custom URL in both places.

SDK migration guide (https://docs.composio.dev/docs/migration-guide/new-sdk, found in llms-full.txt):
> The callback URL for creating custom OAuth configs is now `https://backend.composio.dev/api/v3/toolkits/auth/callback`. The previous URL was `https://backend.composio.dev/api/v1/auth-apps/add`.

Managed vs custom auth:
> For OAuth toolkits, the dashboard shows the redirect URI to add in the provider's developer portal.

composio.dev GitHub guide (https://composio.dev/auth/github, plain fetch worked):
> The screenshot shows the older Composio callback URL https://backend.composio.dev/api/v1/auth-apps/add . Current Composio documentation now points to https://backend.composio.dev/api/v3/toolkits/auth/callback . Always use the redirect URI that your current Composio Auth Config shows, then paste that same value into GitHub.

Note: the REST API is now v3.1 (`/api/v3.1`), but every source still gives the callback as `/api/v3/...`. None mentions a v3.1 callback path. Confidence: high that `/api/v3/` is correct as of today.

### White-label option: your own domain
https://docs.composio.dev/docs/authentication/white-labeling-authentication.md. Confidence: **high**.
> During OAuth, the browser briefly redirects through `backend.composio.dev` so Composio can capture the auth token. Some toolkits also display this URL on the consent screen.

> In your OAuth app's settings, set the authorized redirect URI to your own endpoint:
> ```
> https://yourdomain.com/api/composio-redirect
> ```

> This endpoint receives the OAuth callback and immediately 302-redirects it to Composio

The page's code examples forward to `https://backend.composio.dev/api/v3/toolkits/auth/callback?{query}`.

> Your endpoint must return a **302 redirect**. Do not follow the redirect server-side or make a fetch call to Composio.

> In the Composio dashboard, update your auth config to use your custom redirect URI.

Two other details worth knowing:
- `callback_url` / `callbackUrl` is a different setting. It is the post-auth return URL in *your* app, not the URI you register with the provider. The Google OAuth KB (https://docs.composio.dev/kb/guide/platform-google-oauth) says:
  > The OAuth app's authorized redirect URI must still match the callback URI shown by Composio.
- Webhook triggers with your own OAuth app need an extra ingress URL. See https://docs.composio.dev/docs/setting-up-triggers/custom-oauth-webhooks. From llms-full.txt:
  > A single OAuth app can serve at most one Composio project: providers accept only one callback URL per OAuth app, and each ingress URL routes to a single project.

---

## 5. Managed-app status per toolkit

Sources: the directory (`/toolkits/managed-auth.md`) and each toolkit page, which carries the line `**Composio-managed OAuth available?** Yes/No`.

| Toolkit | Slug | Managed OAuth? | Source / notes | Confidence |
|---|---|---|---|---|
| GitHub | `github` | **Yes** | Directory and https://docs.composio.dev/toolkits/github.md ("Auth: OAUTH2"). | high |
| Slack | `slack` | **Yes** | Directory and toolkits/slack.md. The managed app is pending Slack Marketplace review, so users may see a warning. | high |
| Gmail | `gmail` | **Yes** | Directory and toolkits/gmail.md. Restricted scopes may need your own verified Google app. | high |
| LinkedIn | `linkedin` | **Yes** | Directory and toolkits/linkedin.md. Note that **LinkedIn Ads** (`linkedin_ads`) is BYO. | high |
| HubSpot | `hubspot` | **Yes** | Directory and toolkits/hubspot.md ("Auth: OAUTH2, API_KEY"). The managed app is awaiting HubSpot approval, and scopes are fixed. | high |

### Other notable OAuth toolkits (for the library index)

All from https://docs.composio.dev/toolkits/managed-auth.md. Confidence: **high** as of 2026-10-19; the list changes over time.

**Managed (Composio provides the app):** Notion, Google Calendar, Google Drive, Google Sheets, Google Docs, Outlook, Microsoft Teams, Jira, Confluence, Linear, Asana, Salesforce (a custom instance still needs your own app), Zoom, Dropbox, Figma, Discord, Airtable, Trello, Zendesk, Stripe, Intercom, Calendly, Box, GitLab, Bitbucket, ClickUp, Monday, Reddit, YouTube, Canva.

**Bring your own OAuth app (no managed app):** Twitter/X (`twitter`), Shopify, Spotify, DocuSign, Pipedrive, Xero, PayPal, Webflow, Vercel, Snowflake, TikTok (`tiktok`), Meta Ads (`metaads`), LinkedIn Ads, Google Chat, Google Forms (`googleforms`), Google Contacts (`googlecontacts`), Google Admin, Microsoft To Do, Microsoft OneNote, Microsoft Power BI, Klaviyo, Gusto, Workday, NetSuite, ServiceNow, Snapchat, Vimeo, Wix. Most `*_mcp` toolkits are also BYO.

Good BYO-guide candidates, since users have no managed fallback: Twitter/X, Shopify, Spotify, DocuSign, Pipedrive, Xero, TikTok, Meta Ads, LinkedIn Ads, Google Chat/Forms/Contacts.

Step-by-step guides already published by Composio: https://composio.dev/auth (index), plus /auth/googleapps, /auth/github, /auth/slack and /auth/hubspot, which are linked from the Managed vs custom auth page.

---

## 6. White-labeling the OAuth consent screen

https://docs.composio.dev/docs/authentication/white-labeling-authentication.md. Plain `.md` fetch. Confidence: **high**.

The page lists four branding surfaces:

| Where | What users see | How to fix |
|---|---|---|
| Connect Link page | Composio logo, name, and styling on the hosted auth page | Set your logo, app title, and theme in the dashboard |
| OAuth consent screen | "Composio wants to access your account" on Google, GitHub, etc. | Use your own OAuth app |
| Browser address bar | `backend.composio.dev` flashes during OAuth redirect-back | Proxy the redirect through your domain |
| Post-auth success page | Composio-branded success page after OAuth completes | Pass a `callbackUrl` when initiating the connection |

> OAuth toolkits like Google and GitHub show a consent screen that says which app is requesting access. By default this reads "Composio wants to connect to your account." To show your app name instead, create a custom auth config with your own OAuth credentials and pass that auth config when creating a session.

> This only changes the Composio-hosted page. For OAuth toolkits like Gmail, Google Sheets, GitHub, and Slack, users still see a consent screen saying "Composio wants to access your account." To change that, and to remove the "Secured by Composio" badge, set up your own OAuth app as described [below](#using-your-own-oauth-apps).

> No. Connect Link branding changes the Composio-hosted connection page. Google, GitHub, Slack, and other OAuth providers get their consent-screen identity from the OAuth app.

> Each Composio project has one app title, logo, and theme. If separate products or customers need independent branding, use separate projects and account for the additional provisioning and credential management.

Connect Link branding lives in the dashboard at "**Project Settings** → **White Labeling**" (https://dashboard.composio.dev/~/project/settings/auth-screen).

---

## Not confirmed or caveats
- **Dashboard-displayed redirect URI:** not verified, because the dashboard requires login. The docs say to use the value the dashboard shows. Some toolkit defaults may still show the legacy `https://backend.composio.dev/api/v1/auth-apps/add`.
- **No v3.1 callback path** is documented. `/api/v3/toolkits/auth/callback` is the current documented value.
- **The directory changes over time.** The counts (123 managed, 211 BYO) are a snapshot from 2026-10-19. For live checks, use the `composio_managed_auth_schemes` API field.
- **The `llms-full.txt` copy of managed-auth differs slightly from the live `.md`**, which suggests it may be cached. The quotes in section 1 come from the live `.md` unless noted otherwise.
- The glossary links `/docs/auth-configuration/custom-auth-configs`, which looks like a legacy route. The current page is `/docs/authentication/custom-app-vs-managed-app`.
