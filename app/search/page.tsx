"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { SearchResponse } from "../../lib/search";

function formatStars(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 3 || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value })
      });
      const body = await result.json() as SearchResponse & { error?: string };
      if (!result.ok) throw new Error(body.error || "搜索失败");
      setResponse(body);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="site-nav">
        <div className="nav-inner">
          <Link className="brand" href="/"><img className="brand-icon" src="/icon-192.png" alt="" width="30" height="30" /><span>GitHub Today</span></Link>
          <Link className="nav-favorites" href="/favorites" aria-label="查看我的收藏"><img src="/favorites-folder.png" alt="" width="22" height="22" /></Link>
        </div>
      </nav>

      <main className="feed search-page">
        <Link className="back-link" href="/">← 返回今日趋势</Link>
        <header className="feed-header">
          <div><h1>AI 项目搜索</h1><p>用中文描述需求，AI 会检索并筛选合适的 GitHub 项目。</p></div>
        </header>

        <form className="search-form" onSubmit={submit}>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={200}
            rows={3}
            placeholder="例如：我想找一个有意思、近期仍活跃的树莓派实体项目"
            aria-label="描述你想找的项目"
          />
          <div>
            <span>{query.length}/200</span>
            <button type="submit" disabled={loading || query.trim().length < 3}>{loading ? "正在检索…" : "搜索 GitHub"}</button>
          </div>
        </form>

        {error && <p className="search-error">{error}</p>}
        {loading && <div className="search-loading"><span /><p>正在理解需求、检索 GitHub 并比较候选项目…</p></div>}

        {response && !loading && (
          <section className="search-results" aria-label="AI 搜索结果">
            <div className="search-results-heading">
              <div><h2>推荐结果</h2><p>{response.results.length ? `找到 ${response.results.length} 个达到推荐标准的项目` : "没有项目达到推荐阈值"}</p></div>
              {response.cached && <span>7 天缓存</span>}
            </div>
            {response.results.length === 0 && <div className="search-no-results"><strong>没有找到足够匹配的项目</strong><p>可以补充使用场景、必须功能、编程语言或部署环境后再试。</p></div>}
            {response.results.map((repository, index) => (
              <article className="search-result" key={repository.fullName}>
                <div className="search-result-top">
                  <div className="repo-rank">{index + 1}</div>
                  <div>
                    <h3><a href={repository.url} target="_blank" rel="noreferrer"><span>{repository.owner}</span> / {repository.name}</a></h3>
                    <p>{repository.description}</p>
                  </div>
                  <strong>{repository.score}<small>匹配</small></strong>
                </div>
                <div className="search-ai-note"><b>{repository.category}</b><p>{repository.reason}</p>{repository.caution && <small>注意：{repository.caution}</small>}</div>
                <div className="repo-meta search-result-meta">
                  <span><i className="language-dot" />{repository.language || "其他"}</span>
                  <span>☆ {formatStars(repository.stars)}</span>
                  <span>更新于 {formatDate(repository.pushedAt)}</span>
                  <a href={repository.url} target="_blank" rel="noreferrer">在 GitHub 查看 ↗</a>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
