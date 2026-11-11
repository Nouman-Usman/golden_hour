import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { programs } from "../content";
import { getVisibleProgramTitles } from "./enquiries";

// Admin portal: call updateTag("programs") after saving a program.
export async function getJoinPrograms(): Promise<string[]> {
  "use cache";
  cacheTag("programs");
  cacheLife("hours");

  const fallback = programs.map((p) => p.title);
  if (!db) return fallback;
  try {
    return await getVisibleProgramTitles(db);
  } catch (e) {
    console.error("getJoinPrograms failed, using fallback", e); // DB down or migrations not applied yet
    return fallback;
  }
}
