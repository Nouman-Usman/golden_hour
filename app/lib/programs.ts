import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { programs } from "../content";
import { getVisibleProgramTitles } from "./enquiries";

// Admin portal: call updateTag("programs") after saving a program.
export async function getJoinPrograms(): Promise<string[]> {
  "use cache";
  cacheTag("programs");
  cacheLife("hours");

  return db ? getVisibleProgramTitles(db) : programs.map((p) => p.title);
}
