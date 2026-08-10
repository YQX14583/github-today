import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { generateArticle } from "../lib/ai";
import { cleanReadme, fetchReadme, fetchTrending } from "../lib/github";
import type { RepositoryArticle, TodayData } from "../lib/types";

const dataDirectory = path.join(process.cwd(), "data");
config({ path: path.join(process.cwd(), ".env.local") });
const targetPath = path.join(dataDirectory, "today.json");
const temporaryPath = path.join(dataDirectory, "today.tmp.json");

async function main() {
  const limit = Math.max(1, Number(process.env.TRENDING_LIMIT || 10));
  console.log("正在获取 GitHub Trending Today…");
  const trending = (await fetchTrending()).slice(0, limit);
  const repositories: RepositoryArticle[] = [];

  for (const [index, repository] of trending.entries()) {
    const label = `${repository.owner}/${repository.name}`;
    console.log(`[${index + 1}/${trending.length}] 正在整理 ${label}`);

    try {
      const readme = cleanReadme(await fetchReadme(repository.owner, repository.name));
      const generated = await generateArticle(repository, readme);
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
  console.log(`更新完成：${repositories.length} 个仓库`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
