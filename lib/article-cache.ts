import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArticleResult } from "./types";

type ArticleCacheEntry = ArticleResult & {
  sourceHash: string;
  model: string;
  promptVersion: string;
  lastUsedAt: string;
};

export type ArticleCache = {
  version: 1;
  entries: Record<string, ArticleCacheEntry>;
};

const cachePath = path.join(process.cwd(), "data", "article-cache.json");
const temporaryPath = path.join(process.cwd(), "data", "article-cache.tmp.json");
const MAX_ENTRIES = 500;

export function hashReadme(readme: string) {
  return createHash("sha256").update(readme).digest("hex");
}

export async function readArticleCache(): Promise<ArticleCache> {
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf8")) as ArticleCache;
    return cache.version === 1 && cache.entries ? cache : { version: 1, entries: {} };
  } catch {
    return { version: 1, entries: {} };
  }
}

export function getCachedArticle(
  cache: ArticleCache,
  fullName: string,
  sourceHash: string,
  model: string,
  promptVersion: string
): ArticleResult | null {
  const entry = cache.entries[fullName.toLowerCase()];
  if (!entry || entry.sourceHash !== sourceHash || entry.model !== model || entry.promptVersion !== promptVersion) {
    return null;
  }
  entry.lastUsedAt = new Date().toISOString();
  return { summary: entry.summary, article: entry.article };
}

export function setCachedArticle(
  cache: ArticleCache,
  fullName: string,
  sourceHash: string,
  model: string,
  promptVersion: string,
  result: ArticleResult
) {
  cache.entries[fullName.toLowerCase()] = {
    ...result,
    sourceHash,
    model,
    promptVersion,
    lastUsedAt: new Date().toISOString()
  };
}

export async function writeArticleCache(cache: ArticleCache) {
  const sorted = Object.entries(cache.entries).sort(
    ([, a], [, b]) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
  );
  cache.entries = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
  await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await rename(temporaryPath, cachePath);
}
