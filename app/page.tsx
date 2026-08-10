import Link from "next/link";
import { readToday } from "../lib/data";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  const today = await readToday();

  return (
    <>
      <nav className="site-nav">
        <div className="nav-inner">
          <Link className="brand" href="/" aria-label="GitHub Today 首页">
            <svg width="30" height="30" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.64 5.47 7.71.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.51-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.91-3.64-4.02 0-.89.31-1.62.82-2.19-.08-.2-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.53 7.53 0 0 1 8 3.91c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.96.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.02.29.25.54.74.54 1.51 0 1.09-.01 1.97-.01 2.24 0 .22.15.47.55.39A8.12 8.12 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" /></svg>
            <span>GitHub Today</span>
          </Link>
          <span className="nav-badge">Trending 中文版</span>
        </div>
      </nav>

      <main className="feed">
        <header className="feed-header">
          <div>
            <h1>今日趋势仓库</h1>
            <p>发现 GitHub 社区今天最受关注的项目。</p>
          </div>
          <div className="date-block">
            <strong>{formatDate(today.date)}</strong>
          </div>
        </header>

        <section className="repository-panel" aria-label="今日趋势仓库">
          <div className="panel-title">Trending repositories</div>
          {today.repositories.map((repository, index) => (
            <article className="repository-preview" key={repository.slug}>
              <div className="repo-rank">{index + 1}</div>
              <div className="repo-main">
                <h2>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2H4.5c-.55 0-1 .45-1 1s.45 1 1 1H7a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 11.5Zm1.5 6.71c.31-.13.65-.21 1-.21h8V1.5h-8a1 1 0 0 0-1 1Z" /></svg>
                  <Link href={`/repo/${repository.slug}`}><span>{repository.owner}</span> / {repository.name}</Link>
                </h2>
                <p>{repository.summary}</p>
                <div className="repo-meta">
                  <span><i className="language-dot" />{repository.language || "其他"}</span>
                  <span className="star-meta">☆ {formatStars(repository.stars)}</span>
                  {repository.starsToday > 0 && <span>★ {formatStars(repository.starsToday)} stars today</span>}
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
