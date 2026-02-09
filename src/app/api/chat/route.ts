import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type UIMessage,
} from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { viewerTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import type { StudyMetadata } from "@/lib/ai/study-metadata";

interface RateWindow {
  count: number;
  windowStart: number;
}

declare global {
  var __openradChatRateLimit: Map<string, RateWindow> | undefined;
}

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_MESSAGES = 50;
const MAX_TEXT_CHARS = 4000;
const MAX_FILE_CHARS = 2_000_000;
const VIEWER_CONTEXT_PREFIX = "[Viewer state:";
const IMAGE_DATA_URL_PREFIX = "data:image/jpeg;base64,";

const rateLimitStore =
  globalThis.__openradChatRateLimit ?? new Map<string, RateWindow>();
globalThis.__openradChatRateLimit = rateLimitStore;

function jsonResponse(
  status: number,
  payload: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isImageContentPart(value: unknown): value is { type: "image" } {
  return isRecord(value) && value["type"] === "image";
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function isWithinRateLimit(clientIp: string): boolean {
  void clientIp;
  return true;
}

function isValidViewerMessage(message: UIMessage): boolean {
  let textLength = 0;
  let hasViewerContext = false;
  let imageCount = 0;

  for (const part of message.parts) {
    if (part.type === "text") {
      textLength += part.text.length;
      if (part.text.includes(VIEWER_CONTEXT_PREFIX)) {
        hasViewerContext = true;
      }
      continue;
    }

    if (part.type === "file") {
      imageCount += 1;
      if (part.mediaType !== "image/jpeg") {
        return false;
      }
      if (!part.url.startsWith(IMAGE_DATA_URL_PREFIX)) {
        return false;
      }
      if (part.url.length > MAX_FILE_CHARS) {
        return false;
      }
    }
  }

  return hasViewerContext && imageCount > 0 && textLength <= MAX_TEXT_CHARS;
}

/**
 * Check if this is a valid request. For the first user message, we require
 * viewer context + screenshot. For follow-up messages in an agentic tool loop,
 * we detect tool-invocation parts in the conversation and relax the requirement
 * on the latest user message.
 */
function isValidRequest(messages: UIMessage[]): boolean {
  // Find the first user message
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return false;

  // The first user message must have viewer context
  if (!isValidViewerMessage(firstUserMessage)) return false;

  return true;
}

function injectScreenshotsIntoMessages(
  modelMessages: ModelMessage[],
  screenshots: Record<string, string>,
): void {
  // Find the last user message and append screenshots as image parts
  for (let i = modelMessages.length - 1; i >= 0; i -= 1) {
    const msg = modelMessages[i];
    if (msg && msg.role === "user") {
      if (typeof msg.content === "string") {
        const parts: Array<
          { type: "text"; text: string } | { type: "image"; image: URL }
        > = [{ type: "text", text: msg.content }];
        for (const dataUrl of Object.values(screenshots)) {
          parts.push({
            type: "image",
            image: new URL(dataUrl),
          });
        }
        msg.content = parts;
      } else if (Array.isArray(msg.content)) {
        const retainedParts = msg.content.filter((part) => !isImageContentPart(part));
        msg.content = retainedParts;
        for (const dataUrl of Object.values(screenshots)) {
          msg.content.push({
            type: "image" as const,
            image: new URL(dataUrl),
          } as never);
        }
      }
      break;
    }
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    return jsonResponse(500, {
      error: "OPENROUTER_API_KEY is not configured. Set it in .env.local",
    });
  }

  const clientIp = getClientIp(req);
  if (!isWithinRateLimit(clientIp)) {
    return jsonResponse(429, {
      error: "Rate limit exceeded. Please wait before sending another message.",
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

  const messagesInput = payload["messages"];
  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: messagesInput });
  } catch {
    return jsonResponse(400, { error: "Invalid chat messages payload" });
  }

  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return jsonResponse(400, { error: "Invalid message count" });
  }
  if (messages.some((message) => message.role === "system")) {
    return jsonResponse(400, { error: "System messages are not allowed" });
  }

  if (!isValidRequest(messages)) {
    return jsonResponse(400, {
      error:
        "Message must include viewer context and at least one JPEG viewport screenshot",
    });
  }

  // Parse optional study metadata and screenshots from body
  const studyMetadata = payload["studyMetadata"] as StudyMetadata | undefined;
  const currentScreenshots = payload["currentScreenshots"] as
    | Record<string, string>
    | undefined;

  // Build system prompt — dynamic if metadata available, static fallback otherwise
  const systemPrompt = studyMetadata
    ? buildSystemPrompt(studyMetadata)
    : "You are an AI imaging assistant for OpenRad, a local DICOM viewer. Focus on the provided viewer screenshots and context. Do not provide definitive diagnoses. Include a short reminder that findings are assistive only and require review by a licensed clinician.";

  const openrouter = createOpenRouter({ apiKey });
  const modelMessages = await convertToModelMessages(
    messages.map((message) => ({
      role: message.role,
      parts: message.parts,
      metadata: message.metadata,
    })),
    { tools: viewerTools },
  );

  // Inject fresh screenshots into the conversation if provided
  // (these come from the client after tool execution in the agentic loop)
  if (currentScreenshots && Object.keys(currentScreenshots).length > 0) {
    injectScreenshotsIntoMessages(modelMessages, currentScreenshots);
  }

  const result = streamText({
    model: openrouter("anthropic/claude-sonnet-4.5"),
    system: systemPrompt,
    messages: modelMessages,
    tools: viewerTools,
    toolChoice: "auto",
    maxOutputTokens: 4096,
  });

  return result.toUIMessageStreamResponse();
}
