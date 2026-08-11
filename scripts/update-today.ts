import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { generateSummary } from "../lib/ai";
import { hashReadme } from "../lib/article-cache";
import { SUMMARY_PROMPT_VERSION } from "../lib/content-versions";
import { cleanReadme, fetchReadme, fetchTrending, prepareReadmeForArticle, prepareReadmeForSummary } from "../lib/github";
import { readReadmeCache, setCachedReadme, writeReadmeCache } from "../lib/readme-cache";
import { getCachedSummary, readSummaryCache, setCachedSummary, writeSummaryCache } from "../lib/summary-cache";
import type { RepositoryArticle, TodayData } from "../lib/types";

const dataDirectory = path.join(process.cwd(), "data");
config({ path: path.join(process.cwd(), ".env.local") });
const targetPath = path.join(dataDirectory, "today.json");
const temporaryPath = path.join(dataDirectory, "today.tmp.json");

async function main() {
  console.log("正在获取 GitHub Trending Today…");
  const trending = await fetchTrending();
  const repositories: RepositoryArticle[] = [];
  const summaryCache = await readSummaryCache();
  const readmeCache = await readReadmeCache();
  const model = process.env.AI_MODEL?.trim() || "";
  let reused = 0;

  for (const [index, repository] of trending.entries()) {
    const label = `${repository.owner}/${repository.name}`;
    console.log(`[${index + 1}/${trending.length}] 正在整理 ${label}`);

    try {
      const readme = cleanReadme(await fetchReadme(repository.owner, repository.name));
      const sourceHash = hashReadme(readme);
      setCachedReadme(readmeCache, label, sourceHash, prepareReadmeForArticle(readme));
      const cached = getCachedSummary(summaryCache, label, sourceHash, model, SUMMARY_PROMPT_VERSION);
      const generated = cached ? { summary: cached } : await generateSummary(repository, prepareReadmeForSummary(readme));
      if (cached) {
        reused += 1;
        console.log(`  已复用缓存：${label}`);
      } else {
        setCachedSummary(summaryCache, label, sourceHash, model, SUMMARY_PROMPT_VERSION, generated.summary);
      }
      repositories.push({
        ...repository,
        slug: `${repository.owner}--${repository.name}`,
        sourceHash,
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
  await writeSummaryCache(summaryCache);
  await writeReadmeCache(readmeCache);
  console.log(`更新完成：${repositories.length} 个仓库，其中 ${reused} 个复用摘要缓存`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
