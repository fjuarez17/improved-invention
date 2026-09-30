/**
 * CalchAI Proof of Reasoning evaluation — the seller's actual product.
 *
 * A buyer sends a problem plus the reasoning trace they produced; the agent
 * returns a deterministic score (0-100), metacognitive feedback and the CID
 * that anchors the trace. Scoring and the CID are FIXED code (same heuristic
 * as the Monad oracle in `oracle/app/main.py` of fjuarez17/improved-invention)
 * so two evaluations of the same trace are byte-identical and auditable; the
 * LLM only writes the prose feedback and can never change the score.
 */

import { createHash } from "node:crypto";

export interface ReasoningEvaluation {
  status: "evaluated";
  score: number;
  breakdown: { depth: number; structure: number; conclusion: number };
  metacognitiveDelta: string;
  reasoningCid: string;
  rewardEligible: boolean;
  timestamp: string;
}

/** Minimum score the Monad oracle requires before minting $COGN. */
export const REWARD_THRESHOLD = 40;

/**
 * Pull the reasoning trace out of whatever envelope the rail delivered
 * (JSON job spec, x402 body or plain prompt text).
 */
export function extractTrace(prompt: string): {
  problemContext: string;
  reasoningTrace: string;
} {
  const jsonStart = prompt.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(prompt.slice(jsonStart)) as unknown;
      const found = findTrace(parsed);
      if (found !== null) return found;
      // A structured envelope with no trace is an invalid job, not free text:
      // scoring the wrapper would invent a score for something nobody reasoned.
      return { problemContext: "", reasoningTrace: "" };
    } catch {
      // not JSON — fall through to the raw prompt
    }
  }
  return { problemContext: "", reasoningTrace: prompt };
}

function findTrace(
  value: unknown,
): { problemContext: string; reasoningTrace: string } | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text.startsWith("{") && !text.startsWith("[")) return null;
    try {
      return findTrace(JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }
  if (value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTrace(item);
      if (found !== null) return found;
    }
    return null;
  }
  const obj = value as Record<string, unknown>;
  const trace = obj.reasoningTrace ?? obj.reasoning_trace ?? obj.reasoning;
  if (typeof trace === "string" && trace.trim() !== "") {
    const ctx = obj.problemContext ?? obj.problem_context ?? obj.problem ?? "";
    return {
      problemContext: typeof ctx === "string" ? ctx : "",
      reasoningTrace: trace,
    };
  }
  for (const item of Object.values(obj)) {
    const found = findTrace(item);
    if (found !== null) return found;
  }
  return null;
}

/** Python's `round()` (ties-to-even), so the two scorers agree on .5 totals. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const rest = value - floor;
  if (rest > 0.5) return floor + 1;
  if (rest < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Collapses the score of padded or copy-pasted text: repeated words and
 * repeated lines are what generated filler looks like. Mirrors `originality`
 * in the Monad oracle.
 */
export function originality(text: string): number {
  const words = text
    .split(/\s+/)
    .filter((w) => w !== "")
    .map((w) => w.replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase())
    .filter((w) => w !== "");
  if (words.length === 0) return 0;
  const uniqueWords = new Set(words).size / words.length;
  const lines = text
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l !== "");
  const uniqueLines =
    lines.length === 0 ? 1 : new Set(lines).size / lines.length;
  return Math.min(uniqueWords / 0.5, 1) * Math.min(uniqueLines / 0.8, 1);
}

/**
 * Deterministic 0-100 score: depth (words), structure (explicit steps) and
 * whether the trace closes with a conclusion, scaled by originality.
 */
export function scoreReasoning(text: string): {
  score: number;
  breakdown: { depth: number; structure: number; conclusion: number };
} {
  const words = text.split(/\s+/).filter((w) => w !== "").length;
  const steps = (text.match(/\n\s*(\d+\.|-|\*)/g) ?? []).length;
  const hasConclusion = /(por lo tanto|therefore|conclusi[oó]n|luego)/i.test(
    text,
  );
  const factor = originality(text);
  const depth = Math.min(words / 120, 1) * 0.5 * factor;
  const structure = Math.min(steps / 5, 1) * 0.3 * factor;
  const conclusion = (hasConclusion ? 0.2 : 0) * factor;
  return {
    score: roundHalfEven((depth + structure + conclusion) * 100),
    breakdown: {
      depth: roundHalfEven(depth * 100),
      structure: roundHalfEven(structure * 100),
      conclusion: roundHalfEven(conclusion * 100),
    },
  };
}

/**
 * Content address of the trace. Deterministic stand-in for a real IPFS pin
 * (identical shape to the Monad oracle's CID) — switch `[storage].kind` to
 * `ipfs` and pin the trace to get a canonical CIDv1 instead.
 */
export function reasoningCid(text: string): string {
  return `bafy${createHash("sha256").update(text, "utf8").digest("hex").slice(0, 46)}`;
}

/** Drop a reasoning model's chain-of-thought preamble from the feedback. */
export function sanitizeFeedback(text: string): string {
  const closed = text.lastIndexOf("</think>");
  const body = closed === -1 ? text : text.slice(closed + "</think>".length);
  return body.replace(/<\/?think>/g, "").trim();
}

function fallbackFeedback(
  score: number,
  b: { depth: number; structure: number; conclusion: number },
): string {
  const gaps: string[] = [];
  if (b.depth < 40) gaps.push("desarrolla más el razonamiento intermedio");
  if (b.structure < 20) gaps.push("numera los pasos para hacerlos auditables");
  if (b.conclusion === 0) gaps.push("cierra con una conclusión explícita");
  return gaps.length === 0
    ? `Traza sólida (${score}/100): pasos explícitos y conclusión cerrada.`
    : `Puntuación ${score}/100. Para subirla: ${gaps.join("; ")}.`;
}

/** The prompt handed to the LLM for the qualitative half of the review. */
export function feedbackPrompt(
  problemContext: string,
  trace: string,
  score: number,
): string {
  return (
    "Eres un evaluador metacognitivo de CalchAI. La puntuación ya está " +
    `fijada en ${score}/100 por el evaluador determinista: NO la cambies ni ` +
    "la discutas. Devuelve 2-3 frases en español señalando el salto lógico " +
    "más débil de la traza y la corrección concreta que subiría la nota.\n\n" +
    `PROBLEMA:\n${problemContext || "(no aportado)"}\n\nTRAZA:\n${trace}`
  );
}

/**
 * Evaluate a reasoning trace. `writeFeedback` is the LLM hook; if it fails or
 * returns nothing, deterministic feedback is used so delivery never breaks.
 */
export async function evaluateReasoning(
  prompt: string,
  writeFeedback: (p: string) => Promise<string>,
): Promise<ReasoningEvaluation> {
  const { problemContext, reasoningTrace } = extractTrace(prompt);
  if (reasoningTrace.trim() === "") {
    return {
      status: "evaluated",
      score: 0,
      breakdown: { depth: 0, structure: 0, conclusion: 0 },
      metacognitiveDelta:
        "La solicitud no incluye una traza de razonamiento: envía `reasoningTrace` con los pasos seguidos.",
      reasoningCid: "",
      rewardEligible: false,
      timestamp: new Date().toISOString(),
    };
  }
  const { score, breakdown } = scoreReasoning(reasoningTrace);
  let feedback = "";
  try {
    feedback = sanitizeFeedback(
      await writeFeedback(feedbackPrompt(problemContext, reasoningTrace, score)),
    );
  } catch (err) {
    // A cancelled delivery must stay cancelled: only model failures fall back.
    if (err instanceof Error && /Abort|Timeout/.test(err.name)) throw err;
    feedback = "";
  }
  return {
    status: "evaluated",
    score,
    breakdown,
    metacognitiveDelta:
      feedback !== "" ? feedback : fallbackFeedback(score, breakdown),
    reasoningCid: reasoningCid(reasoningTrace),
    rewardEligible: score >= REWARD_THRESHOLD,
    timestamp: new Date().toISOString(),
  };
}
