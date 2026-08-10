import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { readToday } from "../../../lib/data";

export const dynamic = "force-dynamic";

export default async function RepositoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const today = await readToday();
  const repository = today.repositories.find((item) => item.slug === slug);
  if (!repository) notFound();

  return (
    <main className="article-page">
      <Link className="back-link" href="/">← GitHub Today</Link>

      <header className="article-header">
        <h1>{repository.owner} / {repository.name}</h1>
        <p>{repository.summary}</p>
        <div>
          <span>{repository.language || "其他"}</span>
          <span>·</span>
          <a href={repository.url} target="_blank" rel="noreferrer">GitHub 仓库 ↗</a>
        </div>
      </header>

      <article className="article-content">
        <ReactMarkdown skipHtml>{repository.article}</ReactMarkdown>
      </article>
    </main>
  );
}
