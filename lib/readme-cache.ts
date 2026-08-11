import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type ReadmeCacheEntry = {
  sourceHash: string;
  content: string;
  lastUsedAt: string;
};

export type ReadmeCache = {
  version: 1;
  entries: Record<string, ReadmeCacheEntry>;
};

const cachePath = path.join(process.cwd(), "data", "readme-cache.json");
const temporaryPath = path.join(process.cwd(), "data", "readme-cache.tmp.json");
const MAX_ENTRIES = 100;

export async function readReadmeCache(): Promise<ReadmeCache> {
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf8")) as ReadmeCache;
    return cache.version === 1 && cache.entries ? cache : { version: 1, entries: {} };
  } catch {
    return { version: 1, entries: {} };
  }
}

export function getCachedReadme(cache: ReadmeCache, fullName: string, sourceHash: string) {
  const entry = cache.entries[fullName.toLowerCase()];
  if (!entry || entry.sourceHash !== sourceHash) return null;
  entry.lastUsedAt = new Date().toISOString();
  return entry.content;
}

export function setCachedReadme(cache: ReadmeCache, fullName: string, sourceHash: string, content: string) {
  cache.entries[fullName.toLowerCase()] = { sourceHash, content, lastUsedAt: new Date().toISOString() };
}

export async function writeReadmeCache(cache: ReadmeCache) {
  const sorted = Object.entries(cache.entries).sort(([, a], [, b]) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  cache.entries = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
  await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await rename(temporaryPath, cachePath);
}
