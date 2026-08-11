"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readFavorites, writeFavorites } from "../lib/favorites";
import type { RepositoryArticle } from "../lib/types";
import type { TodayData } from "../lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function formatStars(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function HomeFeed({
  today
}: {
  today: TodayData;
}) {
  const [favorites, setFavorites] = useState<RepositoryArticle[]>([]);

  useEffect(() => {
    try {
      setFavorites(readFavorites(today.repositories));
    } catch {}
  }, [today.repositories]);

  function toggleFavorite(repository: RepositoryArticle) {
    setFavorites((current) => {
      const exists = current.some((item) => item.slug === repository.slug);
      const next = exists
        ? current.filter((item) => item.slug !== repository.slug)
        : [repository, ...current];
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
          <Link className="nav-favorites" href="/favorites" aria-label="查看我的收藏">
            <img src="/favorites-folder.png" alt="" width="22" height="22" />
          </Link>
        </div>
      </nav>

      <main className="feed">
        <header className="feed-header">
          <div>
            <h1>今日趋势仓库</h1>
            <p>发现 GitHub 社区今天最受关注的项目。</p>
          </div>
          <div className="date-block"><strong>{formatDate(today.date)}</strong></div>
        </header>

        <section className="repository-panel" aria-label="今日趋势仓库">
          <div className="panel-title">Trending repositories</div>
          {today.repositories.map((repository, index) => {
            const favorite = favorites.some((item) => item.slug === repository.slug);
            return (
              <article className="repository-preview" key={repository.slug}>
                <div className="repo-rank">{index + 1}</div>
                <div className="repo-main">
                  <h2>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2H4.5c-.55 0-1 .45-1 1s.45 1 1 1H7a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 11.5Zm1.5 6.71c.31-.13.65-.21 1-.21h8V1.5h-8a1 1 0 0 0-1 1Z" /></svg>
                    <Link href={`/repo/${repository.slug}`}><span>{repository.owner}</span> / {repository.name}</Link>
                  </h2>
                  <p>{repository.summary}</p>
                  <div className="repo-footer">
                    <div className="repo-meta">
                      <span><i className="language-dot" />{repository.language || "其他"}</span>
                      <span className="star-meta">☆ {formatStars(repository.stars)}</span>
                      {repository.starsToday > 0 && <span>★ {formatStars(repository.starsToday)} stars today</span>}
                    </div>
                    <button
                      className={`favorite-button${favorite ? " active" : ""}`}
                      type="button"
                      aria-label={favorite ? `取消收藏 ${repository.name}` : `收藏 ${repository.name}`}
                      aria-pressed={favorite}
                      onClick={() => toggleFavorite(repository)}
                    >
                      <img src="/favorite-bookmark.png" alt="" width="20" height="20" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </>
  );
}
