import { promises as fs } from "node:fs";
import path from "node:path";
import { Guide } from "./schema";

/**
 * Two kinds of guides:
 *  - curated: JSON files in data/guides (researched, quote-verified, human-checked)
 *  - agent:   generated live; saved to Vercel Blob when configured, else to a local cache dir
 *
 * Blob auth differs by how the store was connected: a read-write token (BLOB_READ_WRITE_TOKEN,
 * or a custom-prefixed *_READ_WRITE_TOKEN), or OIDC (BLOB_STORE_ID). Stores can be public or private.
 */

const CURATED_DIR = path.join(process.cwd(), "data/guides");
const LOCAL_DIR = process.env.VERCEL ? "/tmp/oauth-runway" : path.join(process.cwd(), ".cache/guides");

export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const k = Object.keys(process.env).find((n) => n.endsWith("_READ_WRITE_TOKEN") && process.env[n]?.startsWith("vercel_blob_rw_"));
  return k ? process.env[k] : undefined;
}
export const blobEnabled = () => !!(blobToken() || process.env.BLOB_STORE_ID);
export const blobEnvNames = () => Object.keys(process.env).filter((n) => /BLOB|_READ_WRITE_TOKEN$/.test(n) && !!process.env[n]);

type Access = "public" | "private";
let access: Access | null = null; // learned on first successful write/read

export const slugify = (s: string) =>
  s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.(com|io|dev|ai|co|app|org|net)(\/.*)?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

async function readDir(dir: string): Promise<Guide[]> {
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    const guides = await Promise.all(
      files.map(async (f) => Guide.safeParse(JSON.parse(await fs.readFile(path.join(dir, f), "utf8")))),
    );
    return guides.filter((r) => r.success).map((r) => r.data!);
  } catch {
    return [];
  }
}

export const listCurated = () => readDir(CURATED_DIR);

async function blobRead(pathname: string): Promise<unknown | null> {
  const { get } = await import("@vercel/blob");
  for (const a of access ? [access] : (["public", "private"] as Access[])) {
    try {
      const r = await get(pathname, { access: a, token: blobToken(), useCache: false });
      if (!r) return null;
      access = a;
      return JSON.parse(await new Response(r.stream).text());
    } catch {}
  }
  return null;
}

export async function listGenerated(): Promise<Guide[]> {
  if (blobEnabled()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: "guides/", token: blobToken() });
      const guides = await Promise.all(blobs.map(async (b) => Guide.safeParse(await blobRead(b.pathname))));
      return guides.filter((r) => r.success).map((r) => r.data!);
    } catch (err) {
      console.error("Blob list failed:", err);
      return [];
    }
  }
  return readDir(LOCAL_DIR);
}

export async function getGuide(slug: string): Promise<Guide | null> {
  const curated = (await listCurated()).find((g) => g.slug === slug);
  if (curated) return curated;
  if (blobEnabled()) {
    const r = Guide.safeParse(await blobRead(`guides/${slug}.json`));
    return r.success ? r.data : null;
  }
  return (await readDir(LOCAL_DIR)).find((g) => g.slug === slug) ?? null;
}

export async function blobWrite(pathname: string, body: string): Promise<Access> {
  const { put } = await import("@vercel/blob");
  let lastErr: unknown;
  for (const a of access ? [access] : (["public", "private"] as Access[])) {
    try {
      await put(pathname, body, { access: a, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, token: blobToken() });
      access = a;
      return a;
    } catch (err) {
      lastErr = err; // e.g. a private store rejects public writes: try the other mode
    }
  }
  throw lastErr;
}

export async function saveGenerated(guide: Guide): Promise<void> {
  const body = JSON.stringify(guide, null, 2);
  if (blobEnabled()) {
    await blobWrite(`guides/${guide.slug}.json`, body);
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${guide.slug}.json`), body);
}

export const storageMode = () => (blobEnabled() ? "blob" : process.env.VERCEL ? "ephemeral (/tmp — share links break)" : "local (.cache/guides)");
export const blobAccess = () => access;
