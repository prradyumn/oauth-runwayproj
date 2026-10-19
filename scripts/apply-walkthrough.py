# One-off: apply console walkthrough results (walkthroughs/consoles/log.jsonl, screenshots in public/evidence).
import json, copy
D = "data/guides/"; DAY = "2026-10-20"; LIVE = "https://oauth-runwayproj.vercel.app"
def load(s): return json.load(open(D + s + ".json"))
def save(s, g): json.dump(g, open(D + s + ".json", "w"), indent=2, ensure_ascii=False); open(D + s + ".json", "a").write("\n")
def tsrc(g, sid, shot, title):
    g["sources"] = [s for s in g["sources"] if s["id"] != sid]
    g["sources"].append({"id": sid, "url": f"{LIVE}{shot}", "title": title, "kind": "test-log", "accessed": DAY})
def tested(ev, sid, note):
    e = copy.deepcopy(ev); e["status"] = "tested"; e["sourceIds"] = [sid] + [x for x in e.get("sourceIds", []) if x != sid]; e["note"] = note; e.pop("check", None); return e
def T(sid, note): return {"status": "tested", "sourceIds": [sid], "note": note}
sc = lambda g, i: next(s for s in g["scenarios"] if s["id"] == i)
st = lambda s, i: next(x for x in s["steps"] if x["id"] == i)

# ---------------- GitHub ----------------
g = load("github")
tsrc(g, "t1", "/evidence/github/1-register-form.png", "Console walkthrough: Register a new OAuth app form (2026-10-20)")
tsrc(g, "t2", "/evidence/github/3-app-created.png", "Console walkthrough: app created, client ID + secret controls")
tsrc(g, "t3", "/evidence/github/5-delete-confirm.png", "Console walkthrough: delete confirmation")
g["testLog"] = [
  {"date": DAY, "by": "agent (Playwright, user's signed-in browser)", "what": "Opened Register a new OAuth app", "observed": "Fields: Application name, Homepage URL, Application description, Redirect URI, Allow wildcard matching, Enable Device Flow, Expire user access tokens. Defaults: Expire user access tokens ON, Allow wildcard matching OFF.", "screenshot": "/evidence/github/1-register-form.png"},
  {"date": DAY, "by": "agent", "what": "Registered the app with Composio's redirect URI", "observed": "App created instantly with no review step, 0 users, Client ID shown. The client secret only exists after clicking 'Generate a new client secret'. Marketplace listing is offered but optional.", "minutes": 1, "screenshot": "/evidence/github/3-app-created.png"},
  {"date": DAY, "by": "agent", "what": "Deleted the test app", "observed": "Confirmation warns that deleting the OAuth application invalidates any access tokens authorized by users. Deleted; 0 test apps remain.", "screenshot": "/evidence/github/5-delete-confirm.png"},
]
for sid in ("personal", "public"):
    s = sc(g, sid)
    s["factors"]["selfServeCreate"]["evidence"] = tested(s["factors"]["selfServeCreate"]["evidence"], "t2", "Created in the console in about a minute with a free account; no approval step.")
    for x in s["steps"]:
        for v in x.get("values", []):
            if v["label"] == "Authorization callback URL": v["label"] = "Redirect URI (docs call it 'Authorization callback URL')"
        if x["id"].endswith("-create"):
            x["evidence"] = tested(x["evidence"], "t1", "Console (Oct 2026) labels the field 'Redirect URI'; GitHub's docs still say 'Authorization callback URL'.")
        if "expiry" in x["id"]:
            x["evidence"] = tested(x["evidence"], "t1", "Confirmed in the console: 'Expire user access tokens' is checked by default on new apps.")
        if x["id"] in ("p-secret", "u-expiry-secret"):
            x["evidence"] = tested(x["evidence"], "t2", "Confirmed: the app page shows 'Generate a new client secret'; no secret exists until you click it.")
        if x["id"] == "u-wildcard":
            x["evidence"] = tested(x["evidence"], "t1", "Confirmed: 'Allow wildcard matching' is unchecked by default.")
    for b in s["blockers"]:
        b["whatToDo"] = b["whatToDo"].replace("Authorization callback URL", "Redirect URI (labelled 'Authorization callback URL' in older docs)")
sc(g, "personal")["factors"]["reviewRequired"]["evidence"] = T("t2", "Tested: the app was usable immediately after registering; GitHub shows no review step (Marketplace listing is optional).")
g["lastVerified"] = DAY
save("github", g)

# ---------------- Slack ----------------
g = load("slack")
tsrc(g, "t1", "/evidence/slack/1-create-dialog.png", "Console walkthrough: Create an App dialog (2026-10-20)")
tsrc(g, "t2", "/evidence/slack/4-wizard-review.png", "Console walkthrough: 4-step create wizard")
tsrc(g, "t3", "/evidence/slack/8-manage-distribution.png", "Console walkthrough: Manage Distribution checklist")
tsrc(g, "t4", "/evidence/slack/7-redirect-saved.png", "Console walkthrough: redirect URL saved")
CHECK = "Enable Features & Functionality · Add OAuth Redirect URLs · Remove Hard Coded Information · Use HTTPS For Your Features · Activate Public Distribution"
g["testLog"] = [
  {"date": DAY, "by": "agent (Playwright, user's signed-in browser)", "what": "Clicked Create an App", "observed": "The dialog now offers AI agent / Starter app / From a manifest / Blank app ('From scratch' is gone). Blank app runs a 4-step wizard: name + workspace → scopes → … → Review, with 'Create Anyway' if no scopes are chosen.", "screenshot": "/evidence/slack/1-create-dialog.png"},
  {"date": DAY, "by": "agent", "what": "Opened the new app's settings", "observed": "App settings now live at app.slack.com/app-settings/<team>/<app>/… The sidebar includes Agents, MCP Servers (New) and a 5-step 'Submit to Slack Marketplace' flow (listing, review scopes, security & compliance, testing info, automated checks). OAuth & Permissions offers PKCE opt-in and Enterprise-Managed Authorization (org-ready apps only).", "screenshot": "/evidence/slack/5-oauth-page.png"},
  {"date": DAY, "by": "agent", "what": "Added Composio's redirect URL and saved", "observed": "Saved. Whether an http:// URL is rejected was not conclusively observed.", "screenshot": "/evidence/slack/7-redirect-saved.png"},
  {"date": DAY, "by": "agent", "what": "Opened Manage Distribution", "observed": f"Checklist before public distribution: {CHECK}. No privacy-policy or review step at this stage (that comes with a Marketplace listing).", "screenshot": "/evidence/slack/8-manage-distribution.png"},
  {"date": DAY, "by": "agent", "what": "Deleted the test app", "observed": "Confirmation: 'All existing tokens will become invalid.' Deleted; 0 test apps remain."},
]
for s in g["scenarios"]:
    s["factors"]["selfServeCreate"]["evidence"] = tested(s["factors"]["selfServeCreate"]["evidence"], "t2", "Created in the console with a free workspace; no approval needed.")
    for x in s["steps"]:
        x["detail"] = x["detail"].replace("click **Create New App**, choose **From a manifest**", "click **Create an App**, choose **From a manifest** (other options: AI agent, Starter app, Blank app)").replace("**Create New App > From a manifest**", "**Create an App > From a manifest**")
        for l in x.get("links", []): l["label"] = l["label"].replace("Create New App", "Create an App")
d = sc(g, "distributed")
d["factors"]["privacyPolicyRequired"] = {"value": False, "evidence": T("t3", f"Tested: the Manage Distribution checklist is {CHECK}. No privacy policy required for unlisted distribution.")}
d["factors"]["reviewRequired"]["evidence"] = tested(d["factors"]["reviewRequired"]["evidence"], "t3", "Tested: activating public distribution has no review step; the checklist is self-serve.")
g["openQuestions"] = [q for q in g["openQuestions"] if "Manage Distribution checklist" not in q] + ["Does Slack reject http:// redirect URLs at entry time or only at authorization? The walkthrough didn't capture a clear rejection."]
g["artifacts"] = [dict(a, content=a["content"].replace("Create New App > From a manifest", "Create an App > From a manifest")) for a in g["artifacts"]]
g["lastVerified"] = DAY
save("slack", g)

# ---------------- Gmail ----------------
g = load("gmail")
tsrc(g, "t1", "/evidence/gmail/4-audience-testing.png", "Console walkthrough: Audience page in Testing (2026-10-20)")
tsrc(g, "t2", "/evidence/gmail/6-data-access-classified.png", "Console walkthrough: Data access, scopes classified")
tsrc(g, "t3", "/evidence/gmail/5-scope-gmail-readonly.png", "Console walkthrough: scope picker lists only enabled APIs")
CAP = "While publishing status is set to 'Testing,' only test users are able to access the app. Allowed user cap prior to app verification is 100, and is counted over the entire lifetime of the app."
g["testLog"] = [
  {"date": DAY, "by": "agent + user (Playwright, user's signed-in browser)", "what": "Created a project and ran Google Auth Platform 'Get started' (External)", "observed": "4-step wizard: App information → Audience → Contact information → Finish. Gotcha: the project ID Google assigned (protean-trilogy-…) differed from the project name typed, and the console uses the ID in URLs.", "minutes": 4},
  {"date": DAY, "by": "agent", "what": "Opened Audience", "observed": CAP, "screenshot": "/evidence/gmail/4-audience-testing.png"},
  {"date": DAY, "by": "agent", "what": "Opened Data access → Add or remove scopes", "observed": "Gmail scopes were missing: 'Only scopes for enabled APIs are listed below.' The Gmail API had not been enabled. Scopes can also be pasted under 'Manually add scopes'.", "screenshot": "/evidence/gmail/5-scope-gmail-readonly.png"},
  {"date": DAY, "by": "agent", "what": "Manually added gmail.readonly and gmail.send", "observed": "Google filed .../auth/gmail.send under 'Your sensitive scopes' and .../auth/gmail.readonly under 'Your restricted scopes'. Changes were not saved.", "screenshot": "/evidence/gmail/6-data-access-classified.png"},
]
t = sc(g, "testing")
t["factors"]["userCapBeforeReview"]["evidence"] = T("t1", "Tested, console text: " + CAP)
pub = sc(g, "public-restricted")
life = next(b for b in pub["blockers"] if b["title"].startswith("100-user cap is lifetime"))
if not any(b["title"].startswith("100-user cap is lifetime") for b in t["blockers"]):
    nb = copy.deepcopy(life); nb["evidence"] = T("t1", "Tested: the Testing-status Audience page states the cap is counted over the entire lifetime of the app. This restores the blocker the review agent had removed from Testing (correction A15).")
    t["blockers"].insert(1, nb)
for sid in ("internal-workspace", "testing", "public-restricted", "public-send-only"):
    s = sc(g, sid)
    if not any(b["title"].startswith("Gmail scopes missing") for b in s["blockers"]):
        s["blockers"].append({"title": "Gmail scopes missing from the scope picker", "symptom": "Add or remove scopes shows no Gmail scopes.", "whatToDo": "Enable the Gmail API first (APIs & Services → Library → Gmail API → Enable), then refresh. Or paste the full scope URLs into 'Manually add scopes'.", "evidence": T("t3", "Tested: the picker says 'Only scopes for enabled APIs are listed below.'")})
    for x in s["steps"]:
        if x["id"].endswith("data-access") and sid in ("public-restricted", "public-send-only", "testing"):
            x["evidence"] = tested(x["evidence"], "t2", "Tested: Google classifies gmail.send as sensitive and gmail.readonly as restricted on the Data access page.")
g["lastVerified"] = DAY
save("gmail", g)
print("applied")
