import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { readToday } from "../../../lib/data";

export const dynamic = "force-dynamic";

function formatStars(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default async function RepositoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const today = await readToday();
  const repository = today.repositories.find((item) => item.slug === slug);
  if (!repository) notFound();

  return (
    <>
      <nav className="site-nav">
        <div className="nav-inner">
          <Link className="brand" href="/">
            <svg width="30" height="30" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.64 5.47 7.71.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.51-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.91-3.64-4.02 0-.89.31-1.62.82-2.19-.08-.2-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.53 7.53 0 0 1 8 3.91c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.96.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.02.29.25.54.74.54 1.51 0 1.09-.01 1.97-.01 2.24 0 .22.15.47.55.39A8.12 8.12 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" /></svg>
            <span>GitHub Today</span>
          </Link>
          <span className="nav-more" role="img" aria-label="更多功能">
            <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.75 8a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm6 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm6 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" /></svg>
          </span>
        </div>
      </nav>
      <main className="article-page">
      <Link className="back-link" href="/">← 返回趋势列表</Link>

      <header className="article-header">
        <h1><span>{repository.owner}</span> / {repository.name}</h1>
        <div>
          <span><i className="language-dot" />{repository.language || "其他"}</span>
          <span>☆ {formatStars(repository.stars)}</span>
          <a className="github-button" href={repository.url} target="_blank" rel="noreferrer">在 GitHub 查看 ↗</a>
        </div>
      </header>

      <article className="article-content">
        <ReactMarkdown skipHtml>{repository.article}</ReactMarkdown>
      </article>
      </main>
    </>
  );
}
