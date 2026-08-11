import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { generateArticle } from "../lib/ai";
import { getCachedArticle, hashReadme, readArticleCache, setCachedArticle, writeArticleCache } from "../lib/article-cache";
import { cleanReadme, fetchReadme, fetchTrending } from "../lib/github";
import type { RepositoryArticle, TodayData } from "../lib/types";

const dataDirectory = path.join(process.cwd(), "data");
config({ path: path.join(process.cwd(), ".env.local") });
const targetPath = path.join(dataDirectory, "today.json");
const temporaryPath = path.join(dataDirectory, "today.tmp.json");
const ARTICLE_PROMPT_VERSION = "2026-08-11-v1";

async function main() {
  const limit = Math.max(1, Number(process.env.TRENDING_LIMIT || 10));
  console.log("正在获取 GitHub Trending Today…");
  const trending = (await fetchTrending()).slice(0, limit);
  const repositories: RepositoryArticle[] = [];
  const articleCache = await readArticleCache();
  const model = process.env.AI_MODEL?.trim() || "";
  let reused = 0;

  for (const [index, repository] of trending.entries()) {
    const label = `${repository.owner}/${repository.name}`;
    console.log(`[${index + 1}/${trending.length}] 正在整理 ${label}`);

    try {
      const readme = cleanReadme(await fetchReadme(repository.owner, repository.name));
      const sourceHash = hashReadme(readme);
      const cached = getCachedArticle(articleCache, label, sourceHash, model, ARTICLE_PROMPT_VERSION);
      const generated = cached || await generateArticle(repository, readme);
      if (cached) {
        reused += 1;
        console.log(`  已复用缓存：${label}`);
      } else {
        setCachedArticle(articleCache, label, sourceHash, model, ARTICLE_PROMPT_VERSION, generated);
      }
      repositories.push({
        ...repository,
        slug: `${repository.owner}--${repository.name}`,
        ...generated
      });
    } catch (error) {
      console.error(`跳过 ${label}：`, error instanceof Error ? error.message : error);
    }
  }

  if (!repositories.length) {
    throw new Error("没有成功生成任何文章，保留原有 today.json");
  }

  const now = new Date();
  const data: TodayData = {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now),
    updatedAt: now.toISOString(),
    repositories
  };

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temporaryPath, targetPath);
  await writeArticleCache(articleCache);
  console.log(`更新完成：${repositories.length} 个仓库，其中 ${reused} 个复用文章缓存`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
