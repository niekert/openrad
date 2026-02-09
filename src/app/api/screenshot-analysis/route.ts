import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    return jsonResponse(500, {
      error: "OPENROUTER_API_KEY is not configured. Set it in .env.local",
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  if (!isRecord(payload)) {
    return jsonResponse(400, { error: "Request body must be an object" });
  }

  const screenshotsRaw = payload["screenshots"];
  if (!isRecord(screenshotsRaw)) {
    return jsonResponse(400, { error: "screenshots must be an object" });
  }

  const screenshotUrls: string[] = [];
  for (const value of Object.values(screenshotsRaw)) {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      screenshotUrls.push(value);
    }
  }

  if (screenshotUrls.length === 0) {
    return jsonResponse(400, { error: "No screenshots provided" });
  }

  const userPrompt =
    typeof payload["userPrompt"] === "string" ? payload["userPrompt"] : "";
  const recentActions = Array.isArray(payload["recentActions"])
    ? payload["recentActions"].filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  const openrouter = createOpenRouter({ apiKey });

  const contextLines: string[] = [];
  if (userPrompt.trim().length > 0) {
    contextLines.push(`User request: ${userPrompt.trim()}`);
  }
  if (recentActions.length > 0) {
    contextLines.push(`Recent actions: ${recentActions.join(" | ")}`);
  }

  const analysisRequest =
    "Analyze the provided CT screenshot(s). " +
    "Return 1 short sentence describing the current anatomical region and the most prominent visual findings. " +
    "If region certainty is low, say so explicitly.";

  const userText =
    contextLines.length > 0
      ? `${contextLines.join("\n")}\n\n${analysisRequest}`
      : analysisRequest;

  const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
    { type: "text", text: userText },
  ];
  for (const dataUrl of screenshotUrls) {
    content.push({
      type: "image",
      image: new URL(dataUrl),
    });
  }

  try {
    const result = await generateText({
      model: openrouter("anthropic/claude-sonnet-4.5"),
      temperature: 0,
      maxOutputTokens: 220,
      system:
        "You are a radiology image-grounding verifier. " +
        "Do not diagnose. Only describe visible region and key imaging appearance from the current screenshot(s). " +
        "Be concise and uncertainty-aware.",
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

    return jsonResponse(200, {
      summary: result.text.trim(),
    });
  } catch {
    return jsonResponse(500, {
      error: "Failed to analyze screenshot",
    });
  }
}
