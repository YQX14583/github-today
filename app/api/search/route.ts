import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readCachedSearch, searchRepositories } from "../../../lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  query: z.string().trim().min(3, "请至少输入 3 个字符").max(200, "搜索内容不能超过 200 个字符")
});

const limits = new Map<string, { count: number; startedAt: number; lastRequestAt: number }>();
const DAY = 24 * 60 * 60 * 1000;

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const current = limits.get(ip);
  if (!current || now - current.startedAt >= DAY) {
    limits.set(ip, { count: 1, startedAt: now, lastRequestAt: now });
    return null;
  }
  if (now - current.lastRequestAt < 3_000) return "请稍等几秒后再搜索";
  if (current.count >= 20) return "今日搜索次数已用完，请明天再试";
  current.count += 1;
  current.lastRequestAt = now;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "搜索内容无效" }, { status: 400 });
    }

    const cached = await readCachedSearch(parsed.data.query);
    if (cached) return NextResponse.json(cached);

    const rateLimitError = checkRateLimit(getClientIp(request));
    if (rateLimitError) return NextResponse.json({ error: rateLimitError }, { status: 429 });

    return NextResponse.json(await searchRepositories(parsed.data.query));
  } catch (error) {
    console.error("AI 搜索失败：", error);
    return NextResponse.json({ error: "搜索暂时失败，请稍后重试" }, { status: 500 });
  }
}
