import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type UIMessage,
} from "ai";

interface RateWindow {
  count: number;
  windowStart: number;
}

declare global {
  var __openradChatRateLimit: Map<string, RateWindow> | undefined;
}

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_MESSAGES = 30;
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
  const now = Date.now();

  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }

  const existing = rateLimitStore.get(clientIp);
  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientIp, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  existing.count += 1;
  return true;
}

function getLatestUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.role === "user") {
      return message;
    }
  }

  return null;
}

function isValidViewerRequest(message: UIMessage): boolean {
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

  const latestUserMessage = getLatestUserMessage(messages);
  if (!latestUserMessage || !isValidViewerRequest(latestUserMessage)) {
    return jsonResponse(400, {
      error:
        "Message must include viewer context and at least one JPEG viewport screenshot",
    });
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelMessages = await convertToModelMessages(
    messages.map((message) => ({
      role: message.role,
      parts: message.parts,
      metadata: message.metadata,
    })),
  );

  const result = streamText({
    model: openrouter("anthropic/claude-sonnet-4.5"),
    system:
      "You are an AI imaging assistant for OpenRad, a local DICOM viewer. Focus on the provided viewer screenshots and context. Do not provide definitive diagnoses. Include a short reminder that findings are assistive only and require review by a licensed clinician.",
    messages: modelMessages,
    maxOutputTokens: 4096,
  });

  return result.toUIMessageStreamResponse();
}
