import { generateArticle } from "./ai";
import { getCachedArticle, hashReadme, readArticleCache, setCachedArticle, writeArticleCache } from "./article-cache";
import { ARTICLE_PROMPT_VERSION } from "./content-versions";
import { readToday } from "./data";
import { cleanReadme, fetchReadme, prepareReadmeForArticle } from "./github";
import { getCachedReadme, readReadmeCache, setCachedReadme, writeReadmeCache } from "./readme-cache";
import { findCachedSearchRepository } from "./search";
import type { RepositoryArticle } from "./types";

const inFlight = new Map<string, Promise<string>>();
let writeQueue = Promise.resolve();
let readmeWriteQueue = Promise.resolve();

async function persistArticle(fullName: string, sourceHash: string, model: string, summary: string, article: string) {
  const write = writeQueue.then(async () => {
    const latest = await readArticleCache();
    setCachedArticle(latest, fullName, sourceHash, model, ARTICLE_PROMPT_VERSION, { summary, article });
    await writeArticleCache(latest);
  });
  writeQueue = write.catch(() => undefined);
  await write;
}

async function persistReadme(fullName: string, sourceHash: string, content: string) {
  const write = readmeWriteQueue.then(async () => {
    const latest = await readReadmeCache();
    setCachedReadme(latest, fullName, sourceHash, content);
    await writeReadmeCache(latest);
  });
  readmeWriteQueue = write.catch(() => undefined);
  await write;
}

export async function getOrGenerateArticle(slug: string) {
  const today = await readToday();
  const todayRepository = today.repositories.find((item) => item.slug === slug);
  const searchRepository = todayRepository ? null : await findCachedSearchRepository(slug);
  const repository: RepositoryArticle | null = todayRepository || (searchRepository ? {
    slug,
    owner: searchRepository.owner,
    name: searchRepository.name,
    url: searchRepository.url,
    description: searchRepository.description,
    language: searchRepository.language,
    stars: searchRepository.stars,
    starsToday: 0,
    summary: searchRepository.reason
  } : null);
  if (!repository) throw new Error("UNKNOWN_REPOSITORY");

  const fullName = `${repository.owner}/${repository.name}`;
  const model = process.env.AI_MODEL?.trim() || "";
  const knownHash = repository.sourceHash;
  const cachedArticle = getCachedArticle(await readArticleCache(), fullName, model, ARTICLE_PROMPT_VERSION);
  if (cachedArticle) return cachedArticle.article;

  const taskKey = `${fullName.toLowerCase()}:${knownHash || "unknown"}`;
  const existing = inFlight.get(taskKey);
  if (existing) return existing;

  const task = (async () => {
    const cachedReadme = knownHash ? getCachedReadme(await readReadmeCache(), fullName, knownHash) : null;
    let sourceHash = knownHash;
    let articleReadme = cachedReadme;

    if (!articleReadme) {
      const readme = cleanReadme(await fetchReadme(repository.owner, repository.name));
      sourceHash = hashReadme(readme);
      articleReadme = prepareReadmeForArticle(readme);
      await persistReadme(fullName, sourceHash, articleReadme);
    }

    if (!sourceHash || !articleReadme) throw new Error("README_CACHE_FAILED");

    const cached = getCachedArticle(await readArticleCache(), fullName, model, ARTICLE_PROMPT_VERSION);
    if (cached) return cached.article;

    const generated = await generateArticle(repository, articleReadme);
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
