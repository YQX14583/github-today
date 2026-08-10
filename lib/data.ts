import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TodayData } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "today.json");

export async function readToday(): Promise<TodayData> {
  const source = await readFile(DATA_PATH, "utf8");
  return JSON.parse(source) as TodayData;
}
