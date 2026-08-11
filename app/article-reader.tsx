"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { saveFavoriteArticle } from "../lib/favorites";

export default function ArticleReader({ slug, initialArticle }: { slug: string; initialArticle?: string }) {
  const [article, setArticle] = useState(initialArticle || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initialArticle);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/article/${encodeURIComponent(slug)}`, { method: "POST" });
      const body = await response.json() as { article?: string; error?: string };
      if (!response.ok || !body.article) throw new Error(body.error || "文章整理失败");
      setArticle(body.article);
      saveFavoriteArticle(slug, body.article);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "文章整理失败");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!initialArticle) void load();
  }, [initialArticle, load]);

  if (loading) return <div className="article-state"><span className="article-spinner" /><strong>正在整理 README…</strong><p>首次打开需要生成中文文章，完成后会自动缓存。</p></div>;
  if (error) return <div className="article-state article-state-error"><strong>{error}</strong><button type="button" onClick={() => void load()}>重新尝试</button></div>;
  return <article className="article-content"><ReactMarkdown skipHtml>{article}</ReactMarkdown></article>;
}
