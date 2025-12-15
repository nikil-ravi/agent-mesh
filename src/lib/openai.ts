import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export async function embedProfile(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const input = text.trim();
  if (!input) return null;
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input
  });
  return res.data[0]?.embedding ?? null;
}

type TranscriptTurn = { speaker: "agent_a" | "agent_b"; message: string };

export type PairEval = {
  should_connect: boolean;
  score: number;
  rationale: string;
  transcript: TranscriptTurn[];
  intro_to_a: string;
  intro_to_b: string;
  question_for_a: string;
  question_for_b: string;
};

const PairEvalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    should_connect: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 1 },
    rationale: { type: "string" },
    transcript: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          speaker: { type: "string", enum: ["agent_a", "agent_b"] },
          message: { type: "string" }
        },
        required: ["speaker", "message"]
      }
    },
    intro_to_a: { type: "string" },
    intro_to_b: { type: "string" },
    question_for_a: { type: "string" },
    question_for_b: { type: "string" }
  },
  required: [
    "should_connect",
    "score",
    "rationale",
    "transcript",
    "intro_to_a",
    "intro_to_b",
    "question_for_a",
    "question_for_b"
  ]
} as const;

export async function evaluatePair(args: {
  nameA: string;
  nameB: string;
  profileA: string;
  profileB: string;
}): Promise<PairEval | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const input = [
    {
      role: "system" as const,
      content: [
        "You are a cautious agent-to-agent matchmaking engine.",
        "You simulate two assistant agents representing two humans (A and B).",
        "Hard rules:",
        "- Do NOT invent facts not present in the provided profiles.",
        "- Do NOT claim you've messaged anyone externally.",
        "- Prefer asking a short clarifying question if info is missing.",
        "- Keep transcript short (4–8 turns).",
        "- Output must match the provided JSON Schema."
      ].join("\n")
    },
    {
      role: "user" as const,
      content: [
        `Human A (name): ${args.nameA}`,
        `Profile A:\n${args.profileA}`,
        "",
        `Human B (name): ${args.nameB}`,
        `Profile B:\n${args.profileB}`,
        "",
        "Task: Decide if a human-to-human intro is worth escalating now.",
        "If yes, draft intros + one consent/info question per side."
      ].join("\n")
    }
  ];

  const res = await openai.responses.create({
    model: MODEL,
    input,
    store: false,
    max_output_tokens: 700,
    text: {
      format: {
        type: "json_schema",
        name: "pair_eval",
        strict: true,
        schema: PairEvalSchema
      }
    }
  });

  const raw = res.output_text?.trim();
  if (!raw) return null;
  return JSON.parse(raw) as PairEval;
}


