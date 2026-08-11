import { generateArticle } from "./ai";
import { getCachedArticle, hashReadme, readArticleCache, setCachedArticle, writeArticleCache } from "./article-cache";
import { ARTICLE_PROMPT_VERSION } from "./content-versions";
import { readToday } from "./data";
import { cleanReadme, fetchReadme, prepareReadmeForArticle } from "./github";

const inFlight = new Map<string, Promise<string>>();
let writeQueue = Promise.resolve();

async function persistArticle(fullName: string, sourceHash: string, model: string, summary: string, article: string) {
  const write = writeQueue.then(async () => {
    const latest = await readArticleCache();
    setCachedArticle(latest, fullName, sourceHash, model, ARTICLE_PROMPT_VERSION, { summary, article });
    await writeArticleCache(latest);
  });
  writeQueue = write.catch(() => undefined);
  await write;
}

export async function getOrGenerateArticle(slug: string) {
  const today = await readToday();
  const repository = today.repositories.find((item) => item.slug === slug);
  if (!repository) throw new Error("NOT_TODAY_REPOSITORY");

  const fullName = `${repository.owner}/${repository.name}`;
  const model = process.env.AI_MODEL?.trim() || "";
  const knownHash = repository.sourceHash;
  if (knownHash) {
    const cached = getCachedArticle(await readArticleCache(), fullName, knownHash, model, ARTICLE_PROMPT_VERSION);
    if (cached) return cached.article;
  }

  const taskKey = `${fullName.toLowerCase()}:${knownHash || "unknown"}`;
  const existing = inFlight.get(taskKey);
  if (existing) return existing;

  const task = (async () => {
    const readme = cleanReadme(await fetchReadme(repository.owner, repository.name));
    const sourceHash = hashReadme(readme);
    const cached = getCachedArticle(await readArticleCache(), fullName, sourceHash, model, ARTICLE_PROMPT_VERSION);
    if (cached) return cached.article;

    const generated = await generateArticle(repository, prepareReadmeForArticle(readme));
    await persistArticle(fullName, sourceHash, model, repository.summary, generated.article);
    return generated.article;
  })();

  inFlight.set(taskKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(taskKey);
  }
}
