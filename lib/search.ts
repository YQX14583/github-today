import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateSearchQueries, rankSearchCandidates } from "./ai";
import { cleanReadme, fetchReadme } from "./github";
import { outboundFetch } from "./http";

export type SearchCandidate = {
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  pushedAt: string;
  readmeExcerpt: string;
  localScore: number;
};

export type SearchResult = Omit<SearchCandidate, "readmeExcerpt" | "localScore"> & {
  score: number;
  reason: string;
  caution: string;
  category: string;
};

export type SearchResponse = {
  query: string;
  generatedQueries: string[];
  results: SearchResult[];
  cached: boolean;
};

type GitHubSearchItem = {
  full_name: string;
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  pushed_at: string;
  archived: boolean;
  fork: boolean;
};

type CacheEntry = Omit<SearchResponse, "cached"> & { createdAt: string };
type SearchCache = Record<string, CacheEntry>;

const cachePath = path.join(process.cwd(), "data", "search-cache.json");
const temporaryCachePath = path.join(process.cwd(), "data", "search-cache.tmp.json");
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function normalizeQuery(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

async function readCache(): Promise<SearchCache> {
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as SearchCache;
  } catch {
    return {};
  }
}

async function getCached(query: string): Promise<SearchResponse | null> {
  const item = (await readCache())[normalizeQuery(query)];
  if (!item || Date.now() - new Date(item.createdAt).getTime() > CACHE_TTL) return null;
  return { query: item.query, generatedQueries: item.generatedQueries, results: item.results, cached: true };
}

async function setCached(response: Omit<SearchResponse, "cached">) {
  const cache = await readCache();
  const now = Date.now();
  for (const [key, item] of Object.entries(cache)) {
    if (now - new Date(item.createdAt).getTime() > CACHE_TTL) delete cache[key];
  }
  cache[normalizeQuery(response.query)] = { ...response, createdAt: new Date().toISOString() };
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(temporaryCachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await rename(temporaryCachePath, cachePath);
}

function freshnessScore(pushedAt: string) {
  const days = (Date.now() - new Date(pushedAt).getTime()) / 86_400_000;
  if (days <= 30) return 30;
  if (days <= 180) return 22;
  if (days <= 365) return 14;
  if (days <= 730) return 5;
  return -12;
}

async function searchGitHub(query: string): Promise<GitHubSearchItem[]> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `${query} in:name,description,readme archived:false fork:false`);
  url.searchParams.set("per_page", "10");
  const response = await outboundFetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "github-today-ai-search",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!response.ok) throw new Error(`GitHub 搜索失败：${response.status}`);
  const body = (await response.json()) as { items?: GitHubSearchItem[] };
  return body.items || [];
}

async function collectCandidates(queries: string[]): Promise<SearchCandidate[]> {
  const batches = await Promise.all(queries.map(searchGitHub));
  const candidates = new Map<string, SearchCandidate>();

  batches.forEach((items) => items.forEach((item, rank) => {
    if (item.archived || item.fork) return;
    const previous = candidates.get(item.full_name);
    const rankScore = Math.max(1, 10 - rank) * 4;
    const baseScore = Math.log10(item.stargazers_count + 1) * 9 +
      Math.log10(item.forks_count + 1) * 3 + freshnessScore(item.pushed_at) + rankScore;
    if (previous) {
      previous.localScore += rankScore + 10;
      return;
    }
    candidates.set(item.full_name, {
      fullName: item.full_name,
      name: item.name,
      owner: item.owner.login,
      url: item.html_url,
      description: item.description || "暂无项目描述",
      language: item.language,
      stars: item.stargazers_count,
      forks: item.forks_count,
      topics: item.topics || [],
      pushedAt: item.pushed_at,
      readmeExcerpt: "",
      localScore: baseScore
    });
  }));

  const shortlisted = [...candidates.values()].sort((a, b) => b.localScore - a.localScore).slice(0, 12);
  return Promise.all(shortlisted.map(async (candidate) => {
    try {
      const readme = cleanReadme(await fetchReadme(candidate.owner, candidate.name));
      return { ...candidate, readmeExcerpt: readme.slice(0, 1200) };
    } catch {
      return candidate;
    }
  }));
}

export async function searchRepositories(query: string): Promise<SearchResponse> {
  const cached = await getCached(query);
  if (cached) return cached;

  const generatedQueries = await generateSearchQueries(query);
  const candidates = await collectCandidates(generatedQueries);
  if (!candidates.length) throw new Error("没有找到合适的 GitHub 仓库");
  const results = await rankSearchCandidates(query, candidates);
  if (!results.length) throw new Error("AI 没有返回有效的搜索结果");

  const response = { query, generatedQueries, results };
  await setCached(response);
  return { ...response, cached: false };
}

export async function readCachedSearch(query: string) {
  return getCached(query);
}
