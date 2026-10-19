# One-off: fill the Composio block of curated guides from data/composio-context.md findings.
import json, re, copy
URI = "https://backend.composio.dev/api/v3/toolkits/auth/callback"
C1 = {"id":"c1","url":"https://docs.composio.dev/docs/authentication/programmatic-auth-configs.md","title":"Composio docs — Programmatic auth configs (redirect URI)","kind":"composio","accessed":"2026-10-19"}
WL = {"id":"c3","url":"https://docs.composio.dev/docs/authentication/white-labeling-authentication.md","title":"Composio docs — White-labeling authentication","kind":"composio","accessed":"2026-10-19"}
CAVEAT = {
  "slack": ("Composio is working on Marketplace review for the managed Slack app.", " Note: Composio's own managed Slack app is still in Marketplace review, so users of the managed app may see a warning — another reason to bring your own."),
  "hubspot": ("HubSpot shows this warning because the default Composio-managed HubSpot OAuth app is still awaiting HubSpot approval.", " Note: Composio's managed HubSpot app is itself awaiting HubSpot approval, so users see a \"Connecting an unverified app\" warning."),
  "gmail": ("use your own Google OAuth app verified for", " Note: Composio's managed Google app only covers its verified default scopes; extra scopes need your own verified app."),
}
ADMIN = {  # scenario id -> regex to find the blocker whose evidence supports customer-admin approval
  ("github","public"): r"org|organization",
  ("slack","own-workspace"): r"approv|admin",
  ("slack","distributed"): r"approv|admin|marketplace",
  ("gmail","internal-workspace"): r"trust|admin",
}
for slug in ["github","slack","gmail","linkedin","hubspot"]:
    p = f"data/guides/{slug}.json"; g = json.load(open(p))
    g["sources"] = [s for s in g["sources"] if s["id"] not in ("c1","c2","c3")]
    c2 = {"id":"c2","url":f"https://docs.composio.dev/toolkits/{slug}.md","title":f"Composio docs — {g['app']['name']} toolkit","kind":"composio","accessed":"2026-10-19"}
    g["sources"] += [C1, c2]
    comp = g["composio"]
    comp["managedAppAvailable"] = {"value": True, "evidence": {"status":"documented","sourceIds":["c2"],"quote":"Composio-managed OAuth available? Yes"}}
    if slug in CAVEAT and CAVEAT[slug][1] not in comp["whenYouNeedYourOwn"]:
        comp["whenYouNeedYourOwn"] += CAVEAT[slug][1]
    comp["redirectUri"] = {"value": URI, "evidence": {"status":"documented","sourceIds":["c1"],"quote":"set its authorized redirect URI to Composio's callback, then pass the client ID and secret.","note":"Copy the exact URI your auth config shows in the Composio dashboard; some toolkits still default to the legacy https://backend.composio.dev/api/v1/auth-apps/add."}}
    for sc in g["scenarios"]:
        for st in sc["steps"]:
            for v in st.get("values", []):
                if "<Composio callback URL" in v["value"]:
                    v["value"] = re.sub(r"<Composio callback URL[^>]*>", URI, v["value"])
        key = (slug, sc["id"])
        if key in ADMIN:
            b = next((b for b in sc["blockers"] if re.search(ADMIN[key], b["title"]+b["symptom"], re.I) and b["evidence"]["status"]=="documented"), None)
            ev = copy.deepcopy(b["evidence"]) if b else {"status":"unverified","sourceIds":[],"note":"Depends on the customer's org settings."}
            sc["factors"]["customerAdminApproval"] = {"value": True, "evidence": ev}
            print(slug, sc["id"], "customerAdminApproval <-", b["title"] if b else "unverified")
    if slug == "gmail":
        g["sources"].append(WL)
        for sc in g["scenarios"]:
            if sc["audience"] != "public" or any(s["id"].endswith("-own-callback") for s in sc["steps"]): continue
            i = next(i for i, s in enumerate(sc["steps"]) if "oauth-client" in s["id"])
            pre = sc["steps"][i]["id"].split("-")[0]
            sc["steps"].insert(i+1, {
              "id": f"{pre}-own-callback", "phase": "configure",
              "title": "Route the OAuth callback through your own domain",
              "detail": "Google verification requires you to own every domain in the client configuration, and Composio's default callback lives on `backend.composio.dev`. Composio supports proxying the callback: register `https://yourdomain.com/api/composio-redirect` as the redirect URI, have that endpoint 302-redirect (query string intact) to Composio's callback, and set the same custom URI in your Composio auth config.",
              "actor": "both",
              "agentCan": "Write and deploy the one-route redirect endpoint and update the auth config's redirect URI via the Composio API.",
              "humanMust": "Own and verify the domain in Google Search Console.",
              "links": [{"label":"Composio: routing the callback through your domain","url":"https://docs.composio.dev/docs/authentication/white-labeling-authentication#routing-the-callback-through-your-domain"}],
              "values": [{"label":"Redirect URI (your domain)","value":"https://yourdomain.com/api/composio-redirect"}],
              "estMinutes": 30,
              "evidence": {"status":"documented","sourceIds":["c3"],"quote":"During OAuth, the browser briefly redirects through backend.composio.dev so Composio can capture the auth token.","note":"Composio documents the proxy option. That Google verification *needs* it is our inference from Google's authorized-domain rule — not confirmed with Google."}})
    json.dump(g, open(p,"w"), indent=2, ensure_ascii=False); open(p,"a").write("\n")
print("patched")
