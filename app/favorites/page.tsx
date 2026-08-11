"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readFavorites, writeFavorites } from "../../lib/favorites";
import type { RepositoryArticle } from "../../lib/types";

function formatStars(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<RepositoryArticle[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
    setReady(true);
  }, []);

  function removeFavorite(slug: string) {
    setFavorites((current) => {
      const next = current.filter((repository) => repository.slug !== slug);
      writeFavorites(next);
      return next;
    });
  }

  return (
    <>
      <nav className="site-nav">
        <div className="nav-inner">
          <Link className="brand" href="/" aria-label="GitHub Today 首页">
            <img className="brand-icon" src="/icon-192.png" alt="" width="30" height="30" />
            <span>GitHub Today</span>
          </Link>
          <Link className="nav-favorites active" href="/" aria-label="返回今日趋势">
            <img src="/favorites-folder.png" alt="" width="22" height="22" />
          </Link>
        </div>
      </nav>

      <main className="feed favorites-page">
        <Link className="back-link" href="/">← 返回今日趋势</Link>
        <header className="feed-header">
          <div><h1>我的收藏</h1><p>收藏内容保存在当前设备，不会被每日更新覆盖。</p></div>
        </header>

        <section className="repository-panel" aria-label="我的收藏">
          <div className="panel-title">Saved repositories</div>
          {ready && favorites.length === 0 ? <p className="favorites-empty">还没有收藏仓库。</p> : favorites.map((repository, index) => (
            <article className="repository-preview" key={repository.slug}>
              <div className="repo-rank">{index + 1}</div>
              <div className="repo-main">
                <h2>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2H4.5c-.55 0-1 .45-1 1s.45 1 1 1H7a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 11.5Zm1.5 6.71c.31-.13.65-.21 1-.21h8V1.5h-8a1 1 0 0 0-1 1Z" /></svg>
                  <Link href={`/favorites/${repository.slug}`}><span>{repository.owner}</span> / {repository.name}</Link>
                </h2>
                <p>{repository.summary}</p>
                <div className="repo-footer">
                  <div className="repo-meta">
                    <span><i className="language-dot" />{repository.language || "其他"}</span>
                    <span className="star-meta">☆ {formatStars(repository.stars)}</span>
                    {repository.starsToday > 0 && <span>★ {formatStars(repository.starsToday)} stars today</span>}
                  </div>
                  <button className="favorite-button active" type="button" aria-label={`取消收藏 ${repository.name}`} onClick={() => removeFavorite(repository.slug)}>
                    <img src="/favorite-bookmark.png" alt="" width="20" height="20" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
