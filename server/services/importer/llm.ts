import { config } from "../../config.js";
import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import { ApiError } from "../../lib/errors.js";
import { emptyDraft, confidenceOf } from "./parse.js";
import { parseQuantity } from "../scaling.js";

/** Accepts numbers or strings like "1 1/2"; anything unparseable becomes null. */
function parseQuantitySafe(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  return parseQuantity(value);
}

const SYSTEM_PROMPT = `You turn cooking content into a strict JSON recipe object for a kids' cooking app.

Rules:
- Only use facts present in the supplied text. Never invent ingredients, quantities, temperatures or steps.
- If a quantity is unknown, use null and set "scalable" to false.
- If a range is given (e.g. 2-3 cups), use the lower number.
- Keep instruction text close to the source, in clear short sentences.
- Split steps where the source has numbered/paragraph steps. One action per step is ideal.
- Images: only include a URL if the source explicitly provides one for that step.
- Output JSON only, no markdown.

JSON shape:
{
  "title": string,
  "cuisine": string|null,
  "description": string|null,
  "difficulty": "Super Easy"|"Easy"|"A Little Tricky"|null,
  "baseServings": number,
  "totalMinutes": number|null,
  "heroImageUrl": string|null,
  "ingredients": [{"quantity": number|null, "unit": string|null, "item": string, "prepNote": string|null, "groupName": string|null, "scalable": boolean}],
  "steps": [{"instruction": string, "durationSeconds": number|null, "temperatureC": number|null, "imageUrl": string|null, "tip": string|null}]
}`;

export function llmConfigured(): boolean {
  return Boolean(config.llm.apiKey);
}

type LlmRequest = {
  text: string;
  title?: string | null;
  sourceUrl?: string | null;
  sourceType?: RecipeDraft["sourceType"];
  allowGeneration?: boolean;
  fetchImpl?: typeof fetch;
};

function coerceIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, position): Ingredient | null => {
      if (typeof entry === "string") {
        const item = entry.trim();
        return item
          ? {
              position, quantity: null, unit: null, item, prepNote: null,
              groupName: null, scalable: false, rawText: entry,
            }
          : null;
      }
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const item = typeof record.item === "string" ? record.item.trim() : "";
      if (!item) return null;
      const quantity = parseQuantitySafe(record.quantity);
      const unit = typeof record.unit === "string" ? record.unit.trim() || null : null;
      return {
        position,
        quantity,
        unit,
        item,
        prepNote: typeof record.prepNote === "string" ? record.prepNote : null,
        groupName: typeof record.groupName === "string" ? record.groupName : null,
        scalable: quantity !== null && record.scalable !== false,
        rawText: null,
      };
    })
    .filter((value): value is Ingredient => Boolean(value));
}

function coerceSteps(value: unknown): Step[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, position): Step | null => {
      if (typeof entry === "string") {
        const instruction = entry.trim();
        return instruction
          ? { position, instruction, durationSeconds: null, temperatureC: null, imageUrl: null, tip: null }
          : null;
      }
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const instruction = typeof record.instruction === "string" ? record.instruction.trim() : "";
      if (!instruction) return null;
      return {
        position,
        instruction,
        durationSeconds:
          typeof record.durationSeconds === "number" && Number.isFinite(record.durationSeconds)
            ? Math.max(0, Math.round(record.durationSeconds))
            : null,
        temperatureC:
          typeof record.temperatureC === "number" && Number.isFinite(record.temperatureC)
            ? Math.round(record.temperatureC)
            : null,
        imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
        tip: typeof record.tip === "string" ? record.tip : null,
      };
    })
    .filter((value): value is Step => Boolean(value));
}

/** Calls any OpenAI-compatible chat completions endpoint and validates the JSON. */
export async function structureWithLlm(request: LlmRequest): Promise<RecipeDraft | null> {
  if (!llmConfigured()) return null;
  const doFetch = request.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  const userPayload = {
    task: request.allowGeneration ? "draft_recipe" : "extract_recipe",
    title: request.title ?? null,
    sourceUrl: request.sourceUrl ?? null,
    sourceText: request.text.slice(0, 12_000),
  };

  try {
    const response = await doFetch(`${config.llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!response.ok) {
      throw ApiError.upstream(`The AI helper is unavailable right now (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const draft = emptyDraft({
      title: typeof parsed.title === "string" ? parsed.title.trim() : request.title ?? "Imported recipe",
      cuisine: typeof parsed.cuisine === "string" ? parsed.cuisine : null,
      description: typeof parsed.description === "string" ? parsed.description : null,
      difficulty: typeof parsed.difficulty === "string" ? parsed.difficulty : null,
      baseServings:
        typeof parsed.baseServings === "number" && parsed.baseServings > 0
          ? Math.round(parsed.baseServings)
          : 4,
      totalMinutes:
        typeof parsed.totalMinutes === "number" && parsed.totalMinutes > 0
          ? Math.round(parsed.totalMinutes)
          : null,
      heroImageUrl: typeof parsed.heroImageUrl === "string" ? parsed.heroImageUrl : null,
      sourceType: request.sourceType ?? "web",
      sourceUrl: request.sourceUrl ?? null,
      ingredients: coerceIngredients(parsed.ingredients),
      steps: coerceSteps(parsed.steps),
    });

    if (draft.ingredients.length === 0 && draft.steps.length === 0) return null;
    return draft;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function llmConfidence(draft: RecipeDraft): number {
  return confidenceOf(draft);
}
