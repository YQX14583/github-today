export type ArticleResult = {
  summary: string;
  article: string;
};

export type SummaryResult = {
  summary: string;
};

export type RepositoryArticle = {
  slug: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  starsToday: number;
  summary: string;
  article?: string;
  sourceHash?: string;
};

export type TodayData = {
  date: string;
  updatedAt: string;
  repositories: RepositoryArticle[];
};

export type TrendingRepository = Omit<RepositoryArticle, "slug" | "summary" | "article" | "sourceHash">;
