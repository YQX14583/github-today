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

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatStars(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default async function HomePage() {
  const today = await readToday();

  return (
    <main className="feed">
      <header className="feed-header">
        <h1>GitHub Today</h1>
        <p>{formatDate(today.date)}</p>
        <small>更新于 {formatUpdatedAt(today.updatedAt)}</small>
      </header>

      <div className="repository-list">
        {today.repositories.map((repository) => (
          <Link className="repository-preview" href={`/repo/${repository.slug}`} key={repository.slug}>
            <h2>
              <span>{repository.owner}</span> / {repository.name}
            </h2>
            <p>{repository.summary}</p>
            <small>
              {repository.language || "其他"}
              <i>·</i>
              {formatStars(repository.stars)} Stars
              {repository.starsToday > 0 && (
                <>
                  <i>·</i>今日 +{formatStars(repository.starsToday)}
                </>
              )}
            </small>
          </Link>
        ))}
      </div>
    </main>
  );
}
