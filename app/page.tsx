import { readToday } from "../lib/data";
import HomeFeed from "./home-feed";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ favorites?: string }>;
}) {
  const [today, query] = await Promise.all([readToday(), searchParams]);
  return <HomeFeed today={today} initialFavoritesOnly={query.favorites === "1"} />;
}
