import { NextResponse } from "next/server";
import { getOrGenerateArticle } from "../../../../lib/on-demand-article";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!slug || slug.length > 200) return NextResponse.json({ error: "仓库无效" }, { status: 400 });
    return NextResponse.json({ article: await getOrGenerateArticle(slug) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_TODAY_REPOSITORY") {
      return NextResponse.json({ error: "该仓库不在今日趋势中" }, { status: 404 });
    }
    console.error("按需生成文章失败：", error);
    return NextResponse.json({ error: "文章整理失败，请稍后重试" }, { status: 500 });
  }
}
