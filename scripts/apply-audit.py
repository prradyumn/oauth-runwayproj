# One-off: apply the adversarial audit corrections (data/claim-audit.md) to curated guides.
import json
D = "data/guides/"
def load(s): return json.load(open(D + s + ".json"))
def save(s, g):
    json.dump(g, open(D + s + ".json", "w"), indent=2, ensure_ascii=False); open(D + s + ".json", "a").write("\n")
def src(g, url, title, kind="official"):
    for s in g["sources"]:
        if s["url"].split("?")[0].rstrip("/") == url.split("?")[0].rstrip("/"): return s["id"]
    n = 1 + max(int(s["id"][1:]) for s in g["sources"] if s["id"].startswith("s"))
    g["sources"].append({"id": f"s{n}", "url": url, "title": title, "kind": kind, "accessed": "2026-10-19"})
    return f"s{n}"
def doc(sid, quote, note=None):
    e = {"status": "documented", "sourceIds": [sid], "quote": quote}
    if note: e["note"] = note
    return e
def sc(g, sid): return next(s for s in g["scenarios"] if s["id"] == sid)
def step(s, sid): return next(x for x in s["steps"] if x["id"] == sid)
AUDIT = "Corrected after adversarial audit (2026-10-19)."

# ---------- GitHub ----------
g = load("github")
sc(g, "personal")["factors"]["customerAdminApproval"] = {"value": False, "evidence": {"status": "unverified", "sourceIds": [], "note": "Only if you need private repos of an org that restricts OAuth apps; then that org's owner must approve. " + AUDIT}}
ip = src(g, "https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/managing-allowed-ip-addresses-for-your-organization", "GitHub Docs — Managing allowed IP addresses for your organization")
sc(g, "public")["blockers"].append({"title": "Org IP allow list blocks Composio's servers", "symptom": "403 errors on an org's resources even after the org owner approved the app.", "whatToDo": "Enterprise orgs with an IP allow list also apply it to OAuth app tokens, and the 'allow GitHub Apps' exemption doesn't cover OAuth apps. The org admin must add Composio's egress IPs to the allow list (ask Composio support for them).", "evidence": doc(ip, "The IP allow list applies to users with any role or access.", "Composio's egress IP list is not public in the docs we read. " + AUDIT)})
save("github", g)

# ---------- Slack ----------
g = load("slack")
own, dist, mp = sc(g, "own-workspace"), sc(g, "distributed"), sc(g, "marketplace")
s3 = src(g, "https://docs.slack.dev/app-management/distribution", "Slack docs — Distributing your app")
own["factors"]["customerAdminApproval"] = {"value": False, "evidence": doc(s3, "Some workspaces will restrict app installation so that only workspace administrators can provide authorization.", "Conditional, and in this scenario the admin is your own: only applies if your workspace has 'Require app approval' on (see blocker). " + AUDIT)}
dist["label"] = "Public distribution, unlisted (pilots only: history reads 1/min)"
rts = src(g, "https://docs.slack.dev/apis/web-api/real-time-search-api", "Slack docs — Real-time Search API")
dist["blockers"].insert(1, {"title": "Real-time Search API unavailable to unlisted apps", "symptom": "assistant.search.context calls fail; the agent can't search workspace context.", "whatToDo": "Slack's sanctioned way for agents to read context (RTS API, GA Feb 2026) works only for Marketplace-listed and internal apps. Plan to list in the Marketplace, or keep the agent internal.", "evidence": doc(rts, "The RTS API is available for directory-published apps and internal apps only.", AUDIT)})
step(dist, "di-ratelimit-check")["detail"] += " The Real-time Search API (assistant.search.context) is also unavailable to unlisted apps."
s7 = src(g, "https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide", "Slack docs — Marketplace review guide")
mp["factors"]["demoVideoRequired"] = {"value": True, "evidence": doc(s7, "For a new submission, it should include a video showing the full installation and OAuth flow.", AUDIT)}
mp["scopes"] = [x for x in mp["scopes"] if x["name"] != "search:read"] + [{"name": "search:read.public", "purpose": "Search via the Real-time Search API (assistant.search.context); Marketplace and internal apps only.", "sensitivity": "sensitive"}]
st = step(mp, "mp-installs")
st["detail"] = "Before submitting, the app needs at least 10 active workspaces (used in the last 28 days, not sandboxes) and at least 10 weekly active users. Slack has required this since July 2026. Recruit design partners through unlisted distribution first."
save("slack", g)

# ---------- Gmail ----------
g = load("gmail")
adm = src(g, "https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data", "Google Workspace Admin Help — Control which apps access Google Workspace data")
sc(g, "internal-workspace")["factors"]["customerAdminApproval"] = {"value": False, "evidence": doc(adm, "Only internal and third-party apps configured with a Trusted or Specific Google data access setting can access data.", "That applies only when your admin has Restricted the service; by default users can access any app. Only if your admin has restricted Gmail/high-risk scopes (see blocker). " + AUDIT)}
t = sc(g, "testing")
t["blockers"] = [b for b in t["blockers"] if not b["title"].startswith("100-user cap is lifetime")]
so = sc(g, "public-send-only")
so["timeline"]["production"]["waitDays"] = [14, 42]
so["timeline"]["production"]["note"] = "Hands-on: homepage, privacy policy, domain verification, justification, demo video. Wait: brand verification (Google: 2-3 business days) must finish before the sensitive-scope review (Google: 10 business days) starts, so about 3 weeks minimum; reviewer back-and-forth commonly extends this. " + AUDIT
for sid in ("public-restricted", "public-send-only"):
    s = sc(g, sid)
    for b in s["blockers"]:
        b["whatToDo"] = b["whatToDo"].replace("(e.g. why gmail.metadata or gmail.send is not enough)", "(e.g. why gmail.send or gmail.labels is not enough; note gmail.metadata is also restricted and still needs CASA)")
        if b["title"].startswith("Composio's callback domain"):
            b["whatToDo"] = "Register `https://<yourdomain>/api/composio-redirect` as the Google redirect URI. It must 302-redirect (keeping the query string) to `https://backend.composio.dev/api/v3/toolkits/auth/callback`. Set the same custom redirect URI on your Composio auth config, then verify `<yourdomain>` in Search Console. See the 'Route the OAuth callback through your own domain' step."
            b["evidence"] = doc("c3", "This endpoint receives the OAuth callback and immediately 302-redirects it to Composio", "Composio documents the proxy; that Google verification needs it follows from Google's rule that you must verify all authorized domains. " + AUDIT)
    own_cb = next(x for x in s["steps"] if x["id"].endswith("-own-callback"))
    own_cb["phase"] = "prepare"
save("gmail", g)

# ---------- LinkedIn ----------
g = load("linkedin")
g["summary"] = g["summary"].replace("In both cases access tokens last 60 days and programmatic refresh tokens are only for approved partners, so self-serve users must re-authorize roughly every two months.", "Self-serve apps get 60-day access tokens with no refresh token, so users must re-authorize roughly every two months. Community Management-approved apps are partners and are expected to use refresh tokens. Self-serve scopes are also write-only: the agent can post but can't read the member's posts.")
cm = src(g, "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview", "LinkedIn — Community Management overview")
sc(g, "member-share")["blockers"].append({"title": "Agent can't read posts, comments or feed", "symptom": "There is no scope to read the member's own posts or comments; w_member_social is write-only.", "whatToDo": "Self-serve scopes only let the agent post. Reading member posts needs the Community Management API, and r_member_social is closed to new requests. Design the agent around posting, or go the company-pages route.", "evidence": doc(cm, "We're not accepting access requests at this time", "The closed permission is r_member_social. " + AUDIT)})
cp = sc(g, "company-pages")
tso = src(g, "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/integration-requirements-community-management", "LinkedIn — Community Management integration requirements")
cp["blockers"].append({"title": "Technical Sign Off expects a full community-management product", "symptom": "Standard-tier review asks you to demonstrate capabilities your posting agent doesn't have (webhooks, PULL recovery, follower and share statistics).", "whatToDo": "Read the integration requirements before you build. A posting-only agent may be asked to build more or be refused, so scope the product to what LinkedIn certifies.", "evidence": doc(tso, "When you're nearing completion, you must initiate a Technical Sign Off request", AUDIT)})
cp["timeline"]["production"]["handsOnHours"] = [16, 80]
g["openQuestions"].append("Which LinkedIn-Version header does Composio send for organization posting, and is it newer than 202511 (Marketing version sunset November 16, 2026)?")
save("linkedin", g)

# ---------- HubSpot ----------
g = load("hubspot")
m = sc(g, "marketplace")
m["scopes"] = [x for x in m["scopes"] if ".sensitive." not in x["name"]]
lr = src(g, "https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements", "HubSpot — App Marketplace listing requirements")
sa = step(m, "mk-scope-audit")
sa["detail"] += " Listed apps may not request any sensitive or highly sensitive data scopes (for example `crm.objects.contacts.sensitive.read`)."
sa["evidence"] = doc(lr, "Your app must not access, request, or use sensitive data scopes", AUDIT)
ul = src(g, "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/user-level-apps", "HubSpot — User-level apps")
step(m, "mk-decide-access")["detail"] += " User-level apps don't support webhooks, app cards, serverless functions or custom workflow actions."
g["openQuestions"].append("Do any Composio HubSpot triggers rely on HubSpot webhooks? User-level apps don't support webhooks, so those triggers wouldn't fire.")
save("hubspot", g)
print("applied")
