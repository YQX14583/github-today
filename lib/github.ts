import * as cheerio from "cheerio";
import type { RequestInit } from "undici";
import { outboundFetch } from "./http";
import type { TrendingRepository } from "./types";

const USER_AGENT = "github-today-personal-reader";

async function githubFetch(url: string, init: RequestInit = {}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await outboundFetch(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
          ...init.headers
        }
      });
      if (response.status >= 500 && attempt < 3) continue;
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GitHub 请求失败");
}

function parseCount(value: string): number {
  const compact = value.replace(/,/g, "").trim().toLowerCase();
  const match = compact.match(/[\d.]+/);
  if (!match) return 0;
  const number = Number(match[0]);
  if (compact.includes("k")) return Math.round(number * 1000);
  if (compact.includes("m")) return Math.round(number * 1_000_000);
  return Math.round(number);
}

export async function fetchTrending(): Promise<TrendingRepository[]> {
  const response = await githubFetch("https://github.com/trending?since=daily", {
    headers: {
      Accept: "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub Trending 请求失败：${response.status}`);
  }

  const $ = cheerio.load(await response.text());
  const repositories: TrendingRepository[] = [];

  $("article.Box-row").each((_, article) => {
    const link = $(article).find("h2 a").first();
    const href = link.attr("href")?.trim();
    if (!href) return;

    const parts = href.split("/").filter(Boolean);
    if (parts.length < 2) return;

    const [owner, name] = parts;
    const description = $(article).find("p").first().text().replace(/\s+/g, " ").trim() || null;
    const language = $(article).find('[itemprop="programmingLanguage"]').first().text().trim() || null;
    const starsText = $(article).find(`a[href="/${owner}/${name}/stargazers"]`).first().text();
    const todayText = $(article).find("span.d-inline-block.float-sm-right").first().text();

    repositories.push({
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
      description,
      language,
      stars: parseCount(starsText),
      starsToday: parseCount(todayText)
    });
  });

  if (!repositories.length) {
    throw new Error("没有从 GitHub Trending 页面解析出仓库，页面结构可能已经变化");
  }

  return repositories;
}

export async function fetchReadme(owner: string, name: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const response = await githubFetch(`https://api.github.com/repos/${owner}/${name}/readme`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`README 请求失败：${response.status}`);
  }

  return response.text();
}

export function cleanReadme(markdown: string): string {
  const withoutHtml = markdown
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<picture[^]*?<\/picture>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<div\b[^>]*>|<\/div>|<p\b[^>]*>|<\/p>|<center>|<\/center>/gi, "")
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  const lines = withoutHtml.split("\n");
  const output: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/)?.[1]?.trim().toLowerCase();
    if (heading) {
      skipping = /^(table of contents|contents|contributors?|sponsors?|acknowledg(e)?ments?|license)$/.test(heading);
    }
    if (!skipping) output.push(line);
  }

  return output.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

const ARTICLE_README_LIMIT = 24_000;
const IMPORTANT_SECTION = /(overview|introduction|about|features?|capabilit|architecture|design|install|setup|getting started|quick ?start|usage|configuration|requirements?|compatib|limitations?|caveats?|security|简介|介绍|功能|特性|能力|架构|设计|安装|部署|快速开始|使用|配置|要求|兼容|限制|注意|安全)/i;

function compactSection(section: string, budget: number) {
  if (section.length <= budget) return section;
  const marker = "\n\n[…本节省略部分细节…]\n\n";
  if (budget <= marker.length) return section.slice(0, Math.max(0, budget));
  const available = Math.max(0, budget - marker.length);
  const headLength = Math.ceil(available * 0.7);
  return `${section.slice(0, headLength).trimEnd()}${marker}${section.slice(-(available - headLength)).trimStart()}`;
}

/**
 * Short READMEs stay intact. For unusually long files, preserve every section's
 * heading plus its beginning and end, while assigning extra space to the parts
 * most useful for a Chinese project introduction.
 */
export function prepareReadmeForArticle(readme: string) {
  if (readme.length <= ARTICLE_README_LIMIT) return readme;

  const heading = /^#{1,3}\s+.+$/gm;
  const starts: number[] = [];
  for (const match of readme.matchAll(heading)) starts.push(match.index);
  if (!starts.length) return compactSection(readme, ARTICLE_README_LIMIT);

  const sections: string[] = [];
  if (starts[0] > 0) sections.push(readme.slice(0, starts[0]));
  for (let index = 0; index < starts.length; index += 1) {
    sections.push(readme.slice(starts[index], starts[index + 1] ?? readme.length));
  }

  const weights = sections.map((section, index) => index === 0 || IMPORTANT_SECTION.test(section.split("\n", 1)[0]) ? 2 : 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const separatorCost = Math.max(0, sections.length - 1) * 2;
  const available = ARTICLE_README_LIMIT - separatorCost;
  const compacted = sections.map((section, index) => {
    const budget = Math.max(240, Math.floor(available * weights[index] / totalWeight));
    return compactSection(section.trim(), budget);
  });
  return compacted.join("\n\n").slice(0, ARTICLE_README_LIMIT);
}

const SUMMARY_README_LIMIT = 6_000;

export function prepareReadmeForSummary(readme: string) {
  if (readme.length <= SUMMARY_README_LIMIT) return readme;

  const sections = readme.split(/(?=^#{1,3}\s+)/gm).filter(Boolean);
  const selected: string[] = [];
  let remaining = SUMMARY_README_LIMIT;

  for (const [index, section] of sections.entries()) {
    const title = section.split("\n", 1)[0];
    const important = index === 0 || IMPORTANT_SECTION.test(title);
    const budget = important ? 900 : 260;
    const excerpt = compactSection(section.trim(), Math.min(budget, remaining));
    if (!excerpt || remaining < 80) break;
    selected.push(excerpt);
    remaining -= excerpt.length + 2;
  }

  return selected.join("\n\n").slice(0, SUMMARY_README_LIMIT);
}
