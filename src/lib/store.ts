import { promises as fs } from "node:fs";
import path from "node:path";
import { Guide } from "./schema";

/**
 * Two kinds of guides:
 *  - curated: JSON files in data/guides (researched, quote-verified, human-checked)
 *  - agent:   generated live; saved to Vercel Blob when configured, else to a local cache dir
 */

const CURATED_DIR = path.join(process.cwd(), "data/guides");
const LOCAL_DIR = process.env.VERCEL ? "/tmp/oauth-runway" : path.join(process.cwd(), ".cache/guides");
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

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

export async function listGenerated(): Promise<Guide[]> {
  if (blobEnabled()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: "guides/" });
      const guides = await Promise.all(
        blobs.map(async (b) => Guide.safeParse(await (await fetch(b.url, { cache: "no-store" })).json())),
      );
      return guides.filter((r) => r.success).map((r) => r.data!);
    } catch {
      return [];
    }
  }
  return readDir(LOCAL_DIR);
}

export async function getGuide(slug: string): Promise<Guide | null> {
  const curated = (await listCurated()).find((g) => g.slug === slug);
  if (curated) return curated;
  return (await listGenerated()).find((g) => g.slug === slug) ?? null;
}

export async function saveGenerated(guide: Guide): Promise<void> {
  const body = JSON.stringify(guide, null, 2);
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(`guides/${guide.slug}.json`, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${guide.slug}.json`), body);
}
