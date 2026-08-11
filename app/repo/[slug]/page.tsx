import Link from "next/link";
import { notFound } from "next/navigation";
import { readToday } from "../../../lib/data";
import ArticleReader from "../../article-reader";

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
            <img className="brand-icon" src="/icon-192.png" alt="" width="30" height="30" />
            <span>GitHub Today</span>
          </Link>
          <Link className="nav-favorites" href="/favorites" aria-label="查看我的收藏">
            <img src="/favorites-folder.png" alt="" width="22" height="22" />
          </Link>
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

      <ArticleReader slug={repository.slug} initialArticle={repository.article} />
      </main>
    </>
  );
}
