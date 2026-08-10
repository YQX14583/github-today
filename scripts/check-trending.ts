import path from "node:path";
import { config } from "dotenv";
import { fetchTrending } from "../lib/github";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const repositories = await fetchTrending();
  console.log(JSON.stringify(repositories.slice(0, 3), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
