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
  openIssues: number;
  license: string | null;
  homepage: string | null;
  topics: string[];
  pushedAt: string;
  readmeExcerpt: string;
  localScore: number;
  retrievalScore: number;
};

export type SearchIntent = {
  queries: string[];
  mustHave: string[];
  preferences: string[];
  avoid: string[];
};

export type SearchAssessment = {
  fullName: string;
  relevance: number;
  hardRequirementsMet: boolean;
  reason: string;
  caution: string;
  category: string;
};

export type SearchResult = Omit<SearchCandidate, "readmeExcerpt" | "localScore" | "retrievalScore"> & {
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
  open_issues_count: number;
  license?: { spdx_id?: string | null } | null;
  homepage?: string | null;
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

export function normalizeSearchQuery(value: string) {
  let normalized = value
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, " ")
    .replace(/^[，。！？、,.!?\s]+|[，。！？、,.!?\s]+$/g, "");

  // 仅移除不携带项目需求的礼貌用语和检索动作，保留“有趣、易实现、离线”等全部限定词。
  normalized = normalized
    .replace(/^(?:请|麻烦)?(?:你)?(?:帮我|给我|我想(?:要)?|我希望)?(?:找找|找一个|找个|找一下|找|搜一下|搜索一下|搜索|推荐一个|推荐个|推荐一下|推荐)\s*/u, "")
    .replace(/^(?:一个|一款)\s*/u, "")
    .replace(/(?:可以吗|行吗|好吗|谢谢|谢谢你)$/u, "")
    .trim()
    .replace(/^[，。！？、,.!?\s]+|[，。！？、,.!?\s]+$/g, "");

  return normalized || value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

function normalizeQuery(value: string) {
  return `v7:${normalizeSearchQuery(value)}`;
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
  // 扩大廉价的 GitHub 候选池，后面仍只将少量本地优选结果交给 AI。
  url.searchParams.set("per_page", "30");
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

async function collectCandidates(queries: string[], limit: number): Promise<SearchCandidate[]> {
  const batches = await Promise.all(queries.map(searchGitHub));
  const candidates = new Map<string, SearchCandidate>();

  batches.forEach((items) => items.forEach((item, rank) => {
    if (item.archived || item.fork) return;
    const previous = candidates.get(item.full_name);
    const rankScore = Math.max(1, 25 - rank) * 1.6;
    const baseScore = Math.log10(item.stargazers_count + 1) * 9 +
      Math.log10(item.forks_count + 1) * 3 + freshnessScore(item.pushed_at) + rankScore;
    if (previous) {
      previous.localScore += rankScore + 10;
      previous.retrievalScore = Math.min(100, previous.retrievalScore + 24 + Math.max(0, 9 - rank) * 2);
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
      openIssues: item.open_issues_count || 0,
      license: item.license?.spdx_id && item.license.spdx_id !== "NOASSERTION" ? item.license.spdx_id : null,
      homepage: item.homepage?.trim() || null,
      topics: item.topics || [],
      pushedAt: item.pushed_at,
      readmeExcerpt: "",
      localScore: baseScore,
      retrievalScore: Math.min(100, 28 + Math.max(0, 9 - rank) * 3)
    });
  }));

  const shortlisted = [...candidates.values()].sort((a, b) => b.localScore - a.localScore).slice(0, limit);
  return Promise.all(shortlisted.map(async (candidate) => {
    try {
      const readme = cleanReadme(await fetchReadme(candidate.owner, candidate.name));
      return { ...candidate, readmeExcerpt: readme.slice(0, 800) };
    } catch {
      return candidate;
    }
  }));
}

function qualityScore(candidate: SearchCandidate) {
  const stars = Math.min(1, Math.log10(candidate.stars + 1) / 5);
  const forks = Math.min(1, Math.log10(candidate.forks + 1) / 4);
  return (stars * 0.75 + forks * 0.25) * 100;
}

function projectFreshnessScore(pushedAt: string) {
  const days = Math.max(0, (Date.now() - new Date(pushedAt).getTime()) / 86_400_000);
  return Math.exp(-days / 220) * 100;
}

function maintenanceScore(candidate: SearchCandidate) {
  const issueRatio = candidate.stars > 0 ? candidate.openIssues / candidate.stars : 0;
  const issuePenalty = Math.min(15, issueRatio * 15);
  return Math.max(0, projectFreshnessScore(candidate.pushedAt) - issuePenalty);
}

function documentationScore(candidate: SearchCandidate) {
  const readme = Math.min(1, candidate.readmeExcerpt.length / 800) * 45;
  const topics = Math.min(1, candidate.topics.length / 5) * 15;
  const description = candidate.description === "暂无项目描述" ? 0 : 15;
  const license = candidate.license ? 15 : 0;
  const homepage = candidate.homepage ? 10 : 0;
  return readme + topics + description + license + homepage;
}

function selectDiverseResults(results: SearchResult[]) {
  const remaining = [...results];
  const selected: SearchResult[] = [];
  while (remaining.length && selected.length < 7) {
    remaining.sort((a, b) => {
      const aPenalty = selected.filter((item) => item.category === a.category).length * 7;
      const bPenalty = selected.filter((item) => item.category === b.category).length * 7;
      return (b.score - bPenalty) - (a.score - aPenalty);
    });
    selected.push(remaining.shift()!);
  }
  return selected;
}

export async function searchRepositories(query: string): Promise<SearchResponse> {
  const cached = await getCached(query);
  if (cached) return cached;

  const intent = await generateSearchQueries(query);
  const generatedQueries = intent.queries;
  const candidates = await collectCandidates(generatedQueries, intent.mustHave.length > 0 ? 8 : 10);
  if (!candidates.length) throw new Error("没有找到合适的 GitHub 仓库");
  const assessments = await rankSearchCandidates(query, intent, candidates);
  const byName = new Map(candidates.map((candidate) => [candidate.fullName, candidate]));
  // 宽泛需求应提供探索空间；只有用户提出明确硬性条件时才提高准入标准。
  // 综合分包含热度、活跃度等排序信号，不适合作为相关性的绝对门槛。
  const minimumRelevance = intent.mustHave.length > 0 ? 68 : 58;
  const scored = assessments.flatMap((assessment) => {
    const candidate = byName.get(assessment.fullName);
    if (!candidate || !assessment.hardRequirementsMet || assessment.relevance < minimumRelevance) return [];
    const score = Math.round(
      assessment.relevance * 0.6 +
      candidate.retrievalScore * 0.1 +
      maintenanceScore(candidate) * 0.15 +
      qualityScore(candidate) * 0.1 +
      documentationScore(candidate) * 0.05
    );
    const { readmeExcerpt: _, localScore: __, retrievalScore: ___, ...repository } = candidate;
    return [{ ...repository, score, reason: assessment.reason, caution: assessment.caution, category: assessment.category }];
  });
  const results = selectDiverseResults(scored);

  const response = { query, generatedQueries, results };
  await setCached(response);
  return { ...response, cached: false };
}

export async function readCachedSearch(query: string) {
  return getCached(query);
}
