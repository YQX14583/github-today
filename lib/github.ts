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

  return output.join("\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, 40_000);
}
