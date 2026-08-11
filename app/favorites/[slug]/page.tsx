"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { readFavorites } from "../../../lib/favorites";
import type { RepositoryArticle } from "../../../lib/types";

function formatStars(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function FavoriteRepositoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [repository, setRepository] = useState<RepositoryArticle | null>();

  useEffect(() => {
    setRepository(readFavorites().find((item) => item.slug === slug) || null);
  }, [slug]);

  return (
    <>
      <nav className="site-nav">
        <div className="nav-inner">
          <Link className="brand" href="/"><img className="brand-icon" src="/icon-192.png" alt="" width="30" height="30" /><span>GitHub Today</span></Link>
          <Link className="nav-favorites active" href="/favorites" aria-label="返回我的收藏"><img src="/favorites-folder.png" alt="" width="22" height="22" /></Link>
        </div>
      </nav>
      <main className="article-page">
        <Link className="back-link" href="/favorites">← 返回我的收藏</Link>
        {repository === undefined ? null : repository === null ? (
          <div className="favorite-missing"><h1>收藏不存在</h1><p>它可能已经被取消收藏。</p></div>
        ) : (
          <>
            <header className="article-header">
              <h1><span>{repository.owner}</span> / {repository.name}</h1>
              <div><span><i className="language-dot" />{repository.language || "其他"}</span><span>☆ {formatStars(repository.stars)}</span><a className="github-button" href={repository.url} target="_blank" rel="noreferrer">在 GitHub 查看 ↗</a></div>
            </header>
            <article className="article-content"><ReactMarkdown skipHtml>{repository.article}</ReactMarkdown></article>
          </>
        )}
      </main>
    </>
  );
}
