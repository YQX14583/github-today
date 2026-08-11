import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SUMMARY_PROMPT_VERSION } from "./content-versions";

type SummaryCacheEntry = {
  summary: string;
  sourceHash: string;
  model: string;
  promptVersion: string;
  lastUsedAt: string;
};

export type SummaryCache = {
  version: 1;
  entries: Record<string, SummaryCacheEntry>;
};

const cachePath = path.join(process.cwd(), "data", "summary-cache.json");
const temporaryPath = path.join(process.cwd(), "data", "summary-cache.tmp.json");
const MAX_ENTRIES = 100;

export async function readSummaryCache(): Promise<SummaryCache> {
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf8")) as SummaryCache;
    return cache.version === 1 && cache.entries ? cache : { version: 1, entries: {} };
  } catch {
    try {
      const legacy = JSON.parse(await readFile(path.join(process.cwd(), "data", "article-cache.json"), "utf8")) as {
        entries?: Record<string, { summary?: string; sourceHash?: string; model?: string; lastUsedAt?: string }>;
      };
      const entries = Object.fromEntries(Object.entries(legacy.entries || {}).flatMap(([key, entry]) => {
        if (!entry.summary || !entry.sourceHash || !entry.model) return [];
        return [[key, {
          summary: entry.summary,
          sourceHash: entry.sourceHash,
          model: entry.model,
          promptVersion: SUMMARY_PROMPT_VERSION,
          lastUsedAt: entry.lastUsedAt || new Date().toISOString()
        }]];
      }));
      return { version: 1, entries };
    } catch {
      return { version: 1, entries: {} };
    }
  }
}

export function getCachedSummary(cache: SummaryCache, fullName: string, sourceHash: string, model: string, promptVersion: string) {
  const entry = cache.entries[fullName.toLowerCase()];
  if (!entry || entry.sourceHash !== sourceHash || entry.model !== model || entry.promptVersion !== promptVersion) return null;
  entry.lastUsedAt = new Date().toISOString();
  return entry.summary;
}

export function setCachedSummary(cache: SummaryCache, fullName: string, sourceHash: string, model: string, promptVersion: string, summary: string) {
  cache.entries[fullName.toLowerCase()] = { summary, sourceHash, model, promptVersion, lastUsedAt: new Date().toISOString() };
}

export async function writeSummaryCache(cache: SummaryCache) {
  const sorted = Object.entries(cache.entries).sort(([, a], [, b]) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  cache.entries = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
  await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await rename(temporaryPath, cachePath);
}
