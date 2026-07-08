export const DEMO_USER_ID = "demo-user";

function topKey(counts: Record<string, number> | undefined | null): string | null {
  if (!counts) return null;
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

/** Turns raw preference tally counters into the "you usually prefer..."
 * bullet list shown in post-run analysis (spec's AI personalisation loop). */
export function summarizePreferences(profile: any): string[] {
  if (!profile) return [];
  const lines: string[] = [];
  const terrain = topKey(profile.terrainCounts);
  const shade = topKey(profile.shadeCounts);
  const env = topKey(profile.environmentCounts);
  const toilet = topKey(profile.toiletCounts);
  if (terrain) lines.push(`${terrain.replace(/_/g, " ")} routes`);
  if (shade === "prioritise" || shade === "some") lines.push("shaded paths");
  if (env) lines.push(`${env.replace(/_/g, " ")} areas`);
  if (toilet && toilet !== "not_required") lines.push("routes with toilet access");
  return lines;
}
