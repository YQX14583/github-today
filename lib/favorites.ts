import type { RepositoryArticle } from "./types";

export const FAVORITES_KEY = "github-today:favorites:v2";
const LEGACY_KEY = "github-today:favorites:v1";

function isRepository(value: unknown): value is RepositoryArticle {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RepositoryArticle>;
  return typeof item.slug === "string" && typeof item.owner === "string" &&
    typeof item.name === "string" && typeof item.summary === "string" &&
    typeof item.article === "string" && typeof item.url === "string";
}

export function readFavorites(currentRepositories: RepositoryArticle[] = []): RepositoryArticle[] {
  try {
    const currentValue = localStorage.getItem(FAVORITES_KEY);
    if (currentValue !== null) {
      const saved = JSON.parse(currentValue);
      return Array.isArray(saved) && saved.every(isRepository) ? saved : [];
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    if (!Array.isArray(legacy)) return [];
    const migrated = currentRepositories.filter((repository) => legacy.includes(repository.slug));
    writeFavorites(migrated);
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return [];
  }
}

export function writeFavorites(repositories: RepositoryArticle[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(repositories));
}
