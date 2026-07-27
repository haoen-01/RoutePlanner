export const DEMO_USER_ID = "demo-user";

function topKey(counts: Record<string, number> | undefined | null): string | null {
  if (!counts) return null;
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

const CHOICE_LABEL: Record<string, [string, string]> = {
  // key -> [label when avg delta positive, label when negative]
  shade: ["the shadier option", "the less shaded option"],
  scenery: ["the more scenic option", "the more direct option"],
  safety: ["the safer-scoring option", "the more adventurous option"],
  traffic: ["the quieter option", "the busier option"],
  convenience: ["the option with more facilities", "the option with fewer facilities"],
  elevationGain: ["the hillier option", "the flatter option"],
};

/** Behavioural insights from accumulated chosen-vs-skipped score deltas
 * (see /api/runs/select). Requires at least 2 choices and a meaningful
 * average delta before claiming a tendency. */
export function summarizeChoiceSignals(signals: Record<string, { sum: number; n: number }> | undefined | null): string[] {
  if (!signals) return [];
  const lines: string[] = [];
  for (const [key, [posLabel, negLabel]] of Object.entries(CHOICE_LABEL)) {
    const s = signals[key];
    if (!s || s.n < 2) continue;
    const avg = s.sum / s.n;
    const threshold = key === "elevationGain" ? 15 : 8; // score points / metres
    if (avg >= threshold) lines.push(`when offered a choice, you tend to pick ${posLabel}`);
    else if (avg <= -threshold) lines.push(`when offered a choice, you tend to pick ${negLabel}`);
  }
  return lines.slice(0, 3);
}

/** Turns preference tallies + behavioural choice signals into the
 * "you usually prefer..." bullet list shown in post-run analysis. */
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
  lines.push(...summarizeChoiceSignals(profile.choiceSignals));
  return lines;
}
