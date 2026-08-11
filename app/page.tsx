import { readToday } from "../lib/data";
import HomeFeed from "./home-feed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <HomeFeed today={await readToday()} />;
}
