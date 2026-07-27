import type { RouteCandidate, RunPreferences } from "./types";
import { explainRoute, recommendationLine } from "./scoring";
import type { RouteAttributes } from "./scoring";

/** If ANTHROPIC_API_KEY is set, generate real LLM explanations for all
 * candidates in a single Claude API call. On any failure (no key, timeout,
 * malformed response) the caller keeps the template-based explanations, so
 * the demo never breaks. */
export async function tryLlmExplanations(
  candidates: RouteCandidate[],
  preferences: RunPreferences
): Promise<{ explanations: string[]; recommendation: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const summary = candidates.map((c, i) => ({
    index: i,
    name: c.name,
    distanceKm: c.distanceKm,
    elevationGainM: c.terrain.elevationGainM,
    difficulty: c.terrain.difficulty,
    scores: c.scores,
    hydrationPointCount: c.hydrationPoints.length,
    toiletPointCount: c.toiletPoints.length,
    shelterPointCount: c.shelterPoints.length,
    weather: c.weatherSummary,
  }));

  const prompt = `You are the explanation engine of a running route planner. The user's preferences: ${JSON.stringify(
    preferences
  )}. Ranked route candidates (best first) with 0-100 scores: ${JSON.stringify(summary)}.

Reply with ONLY valid JSON, no markdown fences, in this shape:
{"explanations": ["...", "...", "..."], "recommendation": "..."}

Rules: one explanation per candidate (same order), each 1-2 sentences, concrete, referencing its actual scores/facilities/weather versus the user's stated preferences. "recommendation" is one sentence telling the user why the first (top-ranked) route is the best pick for them. Never invent street or place names.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const jsonText = text.trim().replace(/^```json?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed.explanations) || parsed.explanations.length !== candidates.length || typeof parsed.recommendation !== "string") {
      throw new Error("bad shape");
    }
    return { explanations: parsed.explanations, recommendation: parsed.recommendation };
  } catch {
    return null;
  }
}

/** Apply either LLM or template explanations to sorted candidates in place. */
export async function applyExplanations(
  sorted: RouteCandidate[],
  preferences: RunPreferences,
  attributesByCandidateId: Map<string, RouteAttributes>
): Promise<"llm" | "template"> {
  const llm = await tryLlmExplanations(sorted, preferences);
  if (llm) {
    sorted.forEach((c, i) => (c.explanation = llm.explanations[i]));
    if (sorted[0]) sorted[0].recommendation = llm.recommendation;
    return "llm";
  }
  sorted.forEach((c) => {
    const attrs = attributesByCandidateId.get(c.id);
    if (attrs) c.explanation = explainRoute(c.scores, preferences, attrs);
  });
  if (sorted[0]) sorted[0].recommendation = recommendationLine(sorted[0].name, sorted[0].scores);
  return "template";
}
