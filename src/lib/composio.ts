/**
 * Composio facts shared by every guide. Researched 2026-10-19 — see data/composio-context.md
 * for the verbatim quotes. Composio's .md doc URLs return full text to a plain fetch,
 * so the verifier can check them.
 */
export const COMPOSIO = {
  redirectUri: "https://backend.composio.dev/api/v3/toolkits/auth/callback" as string | null,
  legacyRedirectUri: "https://backend.composio.dev/api/v1/auth-apps/add",
  redirectSource: {
    url: "https://docs.composio.dev/docs/authentication/programmatic-auth-configs.md",
    title: "Composio docs — Programmatic auth configs",
    quote: "set its authorized redirect URI to Composio's callback, then pass the client ID and secret.",
  },
  managedDirectory: {
    url: "https://docs.composio.dev/toolkits/managed-auth.md",
    title: "Composio docs — Managed OAuth directory",
  },
  customVsManagedUrl: "https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app",
  whiteLabelUrl: "https://docs.composio.dev/docs/authentication/white-labeling-authentication",
};

/**
 * Library index: OAuth toolkits on Composio and whether Composio provides a managed app
 * (from the managed-auth directory, 2026-10-19). Apps without a curated guide can be
 * generated live. BYO apps matter most: there is no managed fallback.
 */
export const LIBRARY_INDEX: { name: string; category: string; managed: boolean }[] = [
  // managed
  ...[
    ["GitHub", "Developer tools"], ["Slack", "Communication"], ["Gmail", "Email"], ["LinkedIn", "Social"], ["HubSpot", "CRM"],
    ["Notion", "Productivity"], ["Google Calendar", "Calendar"], ["Google Drive", "Storage"], ["Google Sheets", "Productivity"],
    ["Google Docs", "Productivity"], ["Outlook", "Email"], ["Microsoft Teams", "Communication"], ["Jira", "Project management"],
    ["Confluence", "Knowledge base"], ["Linear", "Project management"], ["Asana", "Project management"], ["Salesforce", "CRM"],
    ["Zoom", "Meetings"], ["Dropbox", "Storage"], ["Figma", "Design"], ["Discord", "Communication"], ["Airtable", "Database"],
    ["Trello", "Project management"], ["Zendesk", "Support"], ["Stripe", "Payments"], ["Intercom", "Support"],
    ["Calendly", "Scheduling"], ["Box", "Storage"], ["GitLab", "Developer tools"], ["Bitbucket", "Developer tools"],
    ["ClickUp", "Project management"], ["Monday", "Project management"], ["Reddit", "Social"], ["YouTube", "Video"], ["Canva", "Design"],
  ].map(([name, category]) => ({ name, category, managed: true })),
  // bring your own
  ...[
    ["Twitter / X", "Social"], ["Shopify", "E-commerce"], ["Spotify", "Media"], ["DocuSign", "E-signature"], ["Pipedrive", "CRM"],
    ["Xero", "Accounting"], ["PayPal", "Payments"], ["Webflow", "Website"], ["Vercel", "Developer tools"], ["Snowflake", "Data"],
    ["TikTok", "Social"], ["Meta Ads", "Advertising"], ["LinkedIn Ads", "Advertising"], ["Google Chat", "Communication"],
    ["Google Forms", "Productivity"], ["Google Contacts", "Productivity"], ["Google Admin", "Admin"], ["Microsoft To Do", "Productivity"],
    ["Microsoft OneNote", "Productivity"], ["Power BI", "Analytics"], ["Klaviyo", "Marketing"], ["Gusto", "HR"], ["Workday", "HR"],
    ["NetSuite", "ERP"], ["ServiceNow", "IT service"], ["Snapchat", "Social"], ["Vimeo", "Video"], ["Wix", "Website"],
  ].map(([name, category]) => ({ name, category, managed: false })),
];
