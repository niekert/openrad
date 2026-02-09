"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  getToolName,
  lastAssistantMessageIsCompleteWithToolCalls,
  type FileUIPart,
  type UIMessage,
} from "ai";
import type { ViewerSessionController } from "@/lib/viewer/runtime/viewer-session-controller";
import type {
  ViewerState,
  ViewerStateSnapshot,
} from "@/lib/viewer/state/types";
import { MessageResponse } from "@/components/ai-elements/message";
import { buildStudyMetadata } from "@/lib/ai/study-metadata";
import { executeViewerToolCall } from "@/lib/ai/tool-executor";
import { CT_PRESETS } from "@/lib/cornerstone/presets";
import ResizeHandle from "./ResizeHandle";

interface AIChatPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  session: ViewerSessionController;
  viewerState: ViewerState;
  primarySliceIndex: number;
  primaryTotal: number;
  windowWidth: number;
  windowCenter: number;
  compareOpen: boolean;
}

interface MessageSnapshot {
  messageId: string;
  snapshot: ViewerStateSnapshot;
}

const MAX_STORED_SNAPSHOTS = 30;
const AI_CHAT_NOTICE_DISMISSED_KEY = "openrad.aiChatNoticeDismissed";
const MAX_MEDICAL_CONTEXT_CHARS = 4000;

function formatSliceInfo(snapshot: ViewerStateSnapshot): string {
  const parts: string[] = [];
  parts.push(`Slice ${snapshot.primarySliceIndex + 1}`);
  parts.push(
    `WW:${Math.round(snapshot.windowWidth)} WC:${Math.round(snapshot.windowCenter)}`,
  );
  return parts.join(" · ");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function rewriteOpenRadLinksForDisplay(text: string): string {
  return text.replace(
    /\[([^\]]+)\]\((openrad:\/\/[^\s)]+)\)/g,
    (_match, label: string, openradHref: string) => {
      const proxiedHref = `/openrad-action?u=${encodeURIComponent(openradHref)}`;
      return `[${label}](${proxiedHref})`;
    },
  );
}

function getStringField(
  value: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!value) return null;
  const field = value[key];
  if (typeof field !== "string") return null;
  const trimmed = field.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getMessageText(message: UIMessage): string {
  const parts: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text" && part.text.trim().length > 0) {
      parts.push(part.text.trim());
    }
  }
  return parts.join("\n");
}

function getLatestUserPrompt(messages: UIMessage[]): string {
  const latestUser = [...messages].reverse().find((msg) => msg.role === "user");
  if (!latestUser) {
    return "";
  }
  return getMessageText(latestUser).replace(/^\[Viewer state:.*?\]\n\n/, "").trim();
}

function getRecentAssistantActions(messages: UIMessage[]): string[] {
  const latestAssistant = [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant");
  if (!latestAssistant) {
    return [];
  }

  const actions: string[] = [];
  for (const part of latestAssistant.parts) {
    if (!isToolUIPart(part)) continue;
    const toolName = getToolName(part);
    if (part.state === "output-available" && part.output && typeof part.output === "object") {
      const description = "description" in part.output ? part.output.description : null;
      if (typeof description === "string" && description.trim().length > 0) {
        actions.push(`${toolName}: ${description.trim()}`);
      } else {
        actions.push(toolName);
      }
    } else {
      actions.push(toolName);
    }
  }
  return actions.slice(-8);
}

export default function AIChatPanel({
  width,
  onWidthChange,
  session,
  viewerState,
  primarySliceIndex,
  primaryTotal,
  windowWidth,
  windowCenter,
  compareOpen,
}: AIChatPanelProps) {
  const [snapshots, setSnapshots] = useState<MessageSnapshot[]>([]);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem(AI_CHAT_NOTICE_DISMISSED_KEY) !== "true";
  });
  const [medicalContextInput, setMedicalContextInput] = useState("");
  const [medicalContextStatus, setMedicalContextStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [medicalContextError, setMedicalContextError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<UIMessage[]>([]);

  // Stable mutable box for latest prop values. The transport and onToolCall callbacks
  // close over this box (created once) and read `.viewerState` / `.session` inside
  // async handlers — never during render.
  const propsBox = useRef({ viewerState, session });
  useEffect(() => {
    propsBox.current = { viewerState, session };
  }, [viewerState, session]);

  // Custom transport that injects study metadata and screenshots into each request.
  // The ref is only read inside the async prepareSendMessagesRequest callback, not during render.
  /* eslint-disable react-hooks/refs */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages: chatMessages, body }) => {
          const { viewerState: vs, session: sess } = propsBox.current;
          const metadata = buildStudyMetadata(vs);
          const screenshots = sess.captureAllScreenshots();

          return {
            body: {
              ...body,
              messages: chatMessages,
              studyMetadata: metadata,
              currentScreenshots: screenshots,
            },
          };
        },
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const { messages, sendMessage, addToolOutput, status, error } = useChat({
    id: "ai-chat",
    transport,
    onToolCall: async ({ toolCall }) => {
      try {
        const result = await executeViewerToolCall(propsBox.current.session, {
          toolName: toolCall.toolName as Parameters<
            typeof executeViewerToolCall
          >[1]["toolName"],
          args: toolCall.input as never,
        }, {
          userPrompt: getLatestUserPrompt(chatMessagesRef.current),
          recentActions: getRecentAssistantActions(chatMessagesRef.current),
        });
        void addToolOutput({
          toolCallId: toolCall.toolCallId,
          tool: toolCall.toolName,
          output: result,
        });
      } catch (error) {
        console.error(error);
        void addToolOutput({
          toolCallId: toolCall.toolCallId,
          tool: toolCall.toolName,
          state: "output-error",
          errorText:
            error instanceof Error ? error.message : "Tool execution failed",
        });
      }
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const activeRecent = viewerState.fs.recentDirectories.find(
    (entry) => entry.id === viewerState.fs.activeRecentId,
  ) ?? null;
  const persistedMedicalContext = activeRecent?.medicalContext ?? "";
  const persistedMedicalContextTrimmed = persistedMedicalContext.trim();
  const canPersistMedicalContext = !!viewerState.fs.activeRecentId;
  const trimmedMedicalContextInput = medicalContextInput.trim();
  const hasMedicalContextChanges =
    trimmedMedicalContextInput !== persistedMedicalContextTrimmed;
  const overMedicalContextLimit =
    medicalContextInput.length > MAX_MEDICAL_CONTEXT_CHARS;

  useEffect(() => {
    chatMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMedicalContextInput(persistedMedicalContext);
    setMedicalContextStatus("idle");
    setMedicalContextError(null);
  }, [viewerState.fs.activeRecentId, persistedMedicalContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dismissPrivacyNotice = useCallback(() => {
    window.localStorage.setItem(AI_CHAT_NOTICE_DISMISSED_KEY, "true");
    setShowPrivacyNotice(false);
  }, []);

  const handleSaveMedicalContext = useCallback(async () => {
    if (!canPersistMedicalContext) {
      setMedicalContextStatus("error");
      setMedicalContextError("Open a folder root to persist patient context.");
      return;
    }

    if (overMedicalContextLimit) {
      setMedicalContextStatus("error");
      setMedicalContextError(`Context must be ${MAX_MEDICAL_CONTEXT_CHARS} characters or less.`);
      return;
    }

    setMedicalContextStatus("saving");
    setMedicalContextError(null);
    try {
      const saved = await session.saveActiveRecentMedicalContext(medicalContextInput);
      if (!saved) {
        setMedicalContextStatus("error");
        setMedicalContextError("No active study root is available for persistence.");
        return;
      }
      setMedicalContextStatus("saved");
    } catch (error: unknown) {
      setMedicalContextStatus("error");
      setMedicalContextError(
        error instanceof Error ? error.message : "Failed to save patient context.",
      );
    }
  }, [canPersistMedicalContext, overMedicalContextLimit, session, medicalContextInput]);

  const handleClearMedicalContext = useCallback(async () => {
    setMedicalContextInput("");
    if (!canPersistMedicalContext) {
      setMedicalContextStatus("idle");
      setMedicalContextError(null);
      return;
    }

    setMedicalContextStatus("saving");
    setMedicalContextError(null);
    try {
      const cleared = await session.clearActiveRecentMedicalContext();
      if (!cleared) {
        setMedicalContextStatus("error");
        setMedicalContextError("No active study root is available for persistence.");
        return;
      }
      setMedicalContextStatus("saved");
    } catch (error: unknown) {
      setMedicalContextStatus("error");
      setMedicalContextError(
        error instanceof Error ? error.message : "Failed to clear patient context.",
      );
    }
  }, [canPersistMedicalContext, session]);

  const pendingSnapshotRef = useRef<ViewerStateSnapshot | null>(null);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      const snapshot = session.captureViewerSnapshot();
      pendingSnapshotRef.current = snapshot;

      const files: FileUIPart[] = Object.entries(snapshot.screenshots).map(
        ([viewportId, dataUrl]) => ({
          type: "file",
          mediaType: "image/jpeg",
          url: dataUrl,
          filename: `${viewportId}-viewport.jpg`,
        }),
      );

      const contextLine = `[Viewer state: Slice ${snapshot.primarySliceIndex + 1}${primaryTotal > 0 ? `/${primaryTotal}` : ""}, WW:${Math.round(snapshot.windowWidth)} WC:${Math.round(snapshot.windowCenter)}${snapshot.compareSeriesUID ? ", comparing with prior study" : ""}]`;

      void sendMessage({
        text: `${contextLine}\n\n${text}`,
        files,
      });
    },
    [session, sendMessage, isStreaming, primaryTotal],
  );

  // Associate snapshot with the user message once it appears
  useEffect(() => {
    if (!pendingSnapshotRef.current) return;
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMessage) return;
    const alreadyStored = snapshots.some(
      (s) => s.messageId === lastUserMessage.id,
    );
    if (alreadyStored) return;

    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    setSnapshots((prev) => {
      const next = [...prev, { messageId: lastUserMessage.id, snapshot }];
      if (next.length <= MAX_STORED_SNAPSHOTS) {
        return next;
      }
      return next.slice(next.length - MAX_STORED_SNAPSHOTS);
    });
  }, [messages, snapshots]);

  const handleRestore = useCallback(
    (messageId: string) => {
      const entry = snapshots.find((s) => s.messageId === messageId);
      if (entry) {
        void session.restoreViewerSnapshot(entry.snapshot);
      }
    },
    [session, snapshots],
  );

  const getSnapshot = useCallback(
    (messageId: string): ViewerStateSnapshot | null => {
      return snapshots.find((s) => s.messageId === messageId)?.snapshot ?? null;
    },
    [snapshots],
  );

  // Handle openrad:// action link clicks
  const handleActionLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;

      let href = hrefAttr;
      if (href.startsWith("/openrad-action")) {
        e.preventDefault();
        const proxied = new URL(href, window.location.origin);
        const decoded = proxied.searchParams.get("u");
        if (!decoded || !decoded.startsWith("openrad://")) return;
        href = decoded;
      } else if (!href.startsWith("openrad://")) {
        return;
      } else {
        e.preventDefault();
      }

      try {
        const url = new URL(href);
        const action = url.hostname;

        switch (action) {
          case "navigate": {
            const slice = parseInt(url.searchParams.get("slice") ?? "", 10);
            if (!isNaN(slice)) {
              void session.jumpToSlice("primary", slice);
            }
            break;
          }
          case "preset": {
            const name = url.searchParams.get("name");
            const preset = CT_PRESETS.find((p) => p.name === name);
            if (preset) {
              session.applyPreset(preset);
            }
            break;
          }
          case "compare": {
            const seriesUid = url.searchParams.get("series");
            if (seriesUid) {
              const snap = session.captureViewerSnapshot();
              if (!snap.panelsOpen.includes("compare")) {
                session.togglePanel("compare");
              }
              session.selectCompareSeries(seriesUid);
            }
            break;
          }
          case "series": {
            const uid = url.searchParams.get("uid");
            if (uid) {
              session.selectActiveSeries(uid);
            }
            break;
          }
        }
      } catch {
        // Invalid URL, ignore
      }
    },
    [session],
  );

  return (
    <div className="flex h-full flex-shrink-0" style={{ width }}>
      <ResizeHandle
        onResize={(newWidth) => onWidthChange(newWidth)}
        startWidth={width}
        side="left"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-8 items-center border-b border-border px-3 text-[11px] text-muted">
          <span className="uppercase tracking-widest">AI Chat</span>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
            onClick={handleActionLinkClick}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="text-muted text-xs leading-relaxed">
                  <p className="mb-2">Ask questions about your scans.</p>
                  <p>
                    The AI can navigate slices, change presets, and compare
                    studies.
                  </p>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                snapshot={getSnapshot(message.id)}
                onRestore={() => handleRestore(message.id)}
                session={session}
              />
            ))}
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error.message}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showPrivacyNotice && (
            <div className="mx-2 mb-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-100">
              <div className="flex items-start justify-between gap-2">
                <p className="leading-relaxed">
                  AI chat uploads viewport images to model providers for
                  analysis. OpenRad does not store these images on its own
                  servers.
                </p>
                <button
                  onClick={dismissPrivacyNotice}
                  className="shrink-0 rounded border border-amber-300/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-amber-100/90 transition-colors hover:bg-amber-200/10"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            medicalContext={medicalContextInput}
            onMedicalContextChange={setMedicalContextInput}
            onSaveMedicalContext={handleSaveMedicalContext}
            onClearMedicalContext={handleClearMedicalContext}
            canPersistMedicalContext={canPersistMedicalContext}
            medicalContextStatus={medicalContextStatus}
            medicalContextError={medicalContextError}
            medicalContextUpdatedAt={activeRecent?.medicalContextUpdatedAt ?? null}
            overMedicalContextLimit={overMedicalContextLimit}
            hasMedicalContextChanges={hasMedicalContextChanges}
            maxMedicalContextChars={MAX_MEDICAL_CONTEXT_CHARS}
            viewportInfo={`Slice ${primarySliceIndex + 1}${primaryTotal > 0 ? `/${primaryTotal}` : ""} · WW:${Math.round(windowWidth)} WC:${Math.round(windowCenter)}${compareOpen ? " · Compare" : ""}`}
          />
        </div>
      </div>
    </div>
  );
}

// --- Tool Call Card Component ---

const TOOL_ICONS: Record<string, string> = {
  navigate_to_slice: "\u2316", // ⌖ crosshair
  apply_window_preset: "\u25d0", // ◐ contrast
  switch_series: "\u21c4", // ⇄ switch
  compare_with_prior: "\u2261", // ≡ split
  close_comparison: "\u2715", // ✕ close
  capture_current_view: "\u25a3", // ▣ capture
};

function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface ToolCallCardProps {
  toolName: string;
  state: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  session: ViewerSessionController;
}

function ToolCallCard({
  toolName,
  state,
  input,
  output,
  session,
}: ToolCallCardProps) {
  const icon = TOOL_ICONS[toolName] ?? "\u2699";
  const isLoading = state === "input-available" || state === "input-streaming";
  const isCaptureTool = toolName === "capture_current_view";
  const analysisSummary = getStringField(output, "analysisSummary");
  const hasDetails = Object.keys(input).length > 0 || !!output;

  const description = useMemo(() => {
    if (output && typeof output === "object" && "description" in output) {
      return output.description as string;
    }
    // Fallback descriptions based on tool name + input
    switch (toolName) {
      case "navigate_to_slice":
        return `Navigating to slice ${(input.sliceIndex as number) + 1}...`;
      case "apply_window_preset":
        return `Applying ${input.preset as string} preset...`;
      case "switch_series":
        return "Switching series...";
      case "compare_with_prior":
        return "Opening comparison...";
      case "close_comparison":
        return "Closing comparison...";
      case "capture_current_view":
        return "Capturing viewport...";
      default:
        return `Executing ${toolName}...`;
    }
  }, [toolName, input, output]);

  const handleAction = useCallback(() => {
    if (isCaptureTool) {
      const screenshots = session.captureAllScreenshots();
      const requestedViewport =
        typeof input.viewport === "string" ? input.viewport : "primary";

      const selectedEntries: Array<[string, string]> =
        requestedViewport === "all"
          ? Object.entries(screenshots)
          : (() => {
              const screenshot = screenshots[requestedViewport];
              return screenshot ? [[requestedViewport, screenshot]] : [];
            })();

      const now = new Date().toISOString().replace(/[:.]/g, "-");
      selectedEntries.forEach(([viewportId, dataUrl]) => {
        downloadDataUrl(`openrad-${viewportId}-${now}.jpg`, dataUrl);
      });
      return;
    }

    void executeViewerToolCall(session, {
      toolName: toolName as Parameters<
        typeof executeViewerToolCall
      >[1]["toolName"],
      args: input as never,
    });
  }, [session, toolName, input, isCaptureTool]);

  return (
    <div className="my-1 rounded-md border border-border bg-surface/50 px-2.5 py-1.5 text-[11px]">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-muted text-sm">{icon}</span>
        <span className="min-w-0 flex-1 text-muted leading-relaxed">
          {isLoading ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted border-t-transparent" />
              <span className="block truncate" title={description}>
                {description}
              </span>
            </span>
          ) : (
            <span className="block truncate" title={description}>
              {description}
            </span>
          )}
        </span>
        {!isLoading && (
          <button
            onClick={handleAction}
            className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            {isCaptureTool ? "Download" : "View"}
          </button>
        )}
      </div>
      {!isLoading && hasDetails && (
        <details className="mt-1 overflow-hidden rounded border border-border/60">
          <summary className="cursor-pointer select-none px-2 py-1 text-[10px] text-muted hover:bg-surface">
            Details
          </summary>
          <div className="space-y-1 border-t border-border/60 px-2 py-1.5 text-[10px] text-muted">
            {analysisSummary && (
              <p className="leading-relaxed">
                AI summary: {analysisSummary}
              </p>
            )}
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-surface px-1.5 py-1 text-[10px] text-muted">
              {JSON.stringify({ input, output }, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}

// --- Chat Message Component ---

interface ChatMessageProps {
  message: UIMessage;
  snapshot: ViewerStateSnapshot | null;
  onRestore: () => void;
  session: ViewerSessionController;
}

function ChatMessage({
  message,
  snapshot,
  onRestore,
  session,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const screenshots = snapshot?.screenshots ?? {};
  const screenshotEntries = Object.entries(screenshots);

  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
    >
      {/* Screenshot thumbnails for user messages */}
      {isUser && screenshotEntries.length > 0 && (
        <div className="flex gap-1">
          {screenshotEntries.map(([viewportId, dataUrl]) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={viewportId}
              src={dataUrl}
              alt={`${viewportId} viewport`}
              className="h-12 w-16 rounded border border-border object-cover"
            />
          ))}
        </div>
      )}

      {/* Snapshot badge for user messages */}
      {isUser && snapshot && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted">
            {formatSliceInfo(snapshot)}
          </span>
          <button
            onClick={onRestore}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            Restore view
          </button>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-full rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-accent-dim text-foreground"
            : "bg-surface text-foreground"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            const text = isUser
              ? part.text.replace(/^\[Viewer state:.*?\]\n\n/, "")
              : rewriteOpenRadLinksForDisplay(part.text);
            if (!text) return null;
            if (isUser) {
              return (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {text}
                </div>
              );
            }
            return (
              <MessageResponse
                key={i}
                linkSafety={{ enabled: false }}
                className="break-words text-xs [&_a[href^='/openrad-action']]:text-blue-400 [&_a[href^='/openrad-action']]:underline [&_a[href^='/openrad-action']]:cursor-pointer"
              >
                {text}
              </MessageResponse>
            );
          }

          if (isToolUIPart(part)) {
            const name = getToolName(part);
            return (
              <ToolCallCard
                key={i}
                toolName={name}
                state={part.state}
                input={
                  (part.state !== "input-streaming"
                    ? part.input
                    : {}) as Record<string, unknown>
                }
                output={
                  part.state === "output-available"
                    ? (part.output as Record<string, unknown>)
                    : undefined
                }
                session={session}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

// --- Chat Input Component ---

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  viewportInfo: string;
  medicalContext: string;
  onMedicalContextChange: (text: string) => void;
  onSaveMedicalContext: () => void;
  onClearMedicalContext: () => void;
  canPersistMedicalContext: boolean;
  medicalContextStatus: "idle" | "saving" | "saved" | "error";
  medicalContextError: string | null;
  medicalContextUpdatedAt: string | null;
  overMedicalContextLimit: boolean;
  hasMedicalContextChanges: boolean;
  maxMedicalContextChars: number;
}

function ChatInput({
  onSend,
  isStreaming,
  viewportInfo,
  medicalContext,
  onMedicalContextChange,
  onSaveMedicalContext,
  onClearMedicalContext,
  canPersistMedicalContext,
  medicalContextStatus,
  medicalContextError,
  medicalContextUpdatedAt,
  overMedicalContextLimit,
  hasMedicalContextChanges,
  maxMedicalContextChars,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [contextEditorOpen, setContextEditorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (input.trim() && !isStreaming) {
        onSend(input.trim());
        setInput("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    },
    [input, isStreaming, onSend],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    },
    [],
  );

  const medicalContextCharacterCount = medicalContext.length;
  const medicalContextIsSaving = medicalContextStatus === "saving";
  const medicalContextHasValue = medicalContext.trim().length > 0;
  const canSaveMedicalContext =
    canPersistMedicalContext &&
    !medicalContextIsSaving &&
    hasMedicalContextChanges &&
    !overMedicalContextLimit;
  const canClearMedicalContext =
    !medicalContextIsSaving && (medicalContextHasValue || medicalContextUpdatedAt !== null);
  const patientContextButtonLabel = contextEditorOpen ? "Hide patient context" : "Patient context";

  return (
    <div className="border-t border-border p-2">
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setContextEditorOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <span>{contextEditorOpen ? "▾" : "▸"}</span>
          <span>{patientContextButtonLabel}</span>
        </button>
      </div>
      {contextEditorOpen && (
        <div className="mb-2 rounded-md border border-border bg-surface/70 p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted">Patient context</p>
            <span
              className={`text-[10px] ${overMedicalContextLimit ? "text-red-400" : "text-muted"}`}
            >
              {medicalContextCharacterCount}/{maxMedicalContextChars}
            </span>
          </div>
          <textarea
            value={medicalContext}
            onChange={(e) => onMedicalContextChange(e.target.value)}
            placeholder="Optional medical context for this study root (history, symptoms, indication, etc.)"
            rows={3}
            className="mb-1 w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:border-accent/40 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted">
              {!canPersistMedicalContext
                ? "Persistence is available when this study is opened from a folder root."
                : medicalContextUpdatedAt
                ? `Saved locally · ${formatTimestamp(medicalContextUpdatedAt)}`
                : "Saved locally on this device for the active study root."}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClearMedicalContext}
                disabled={!canClearMedicalContext}
                className="rounded border border-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onSaveMedicalContext}
                disabled={!canSaveMedicalContext}
                className="rounded border border-border-bright px-2 py-0.5 text-[10px] transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                {medicalContextIsSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          {(medicalContextError || medicalContextStatus === "saved" || overMedicalContextLimit) && (
            <p
              className={`mt-1 text-[10px] ${
                medicalContextError || overMedicalContextLimit ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {medicalContextError
                ? medicalContextError
                : overMedicalContextLimit
                ? `Context exceeds ${maxMedicalContextChars} characters.`
                : "Patient context saved."}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 px-1 pb-1.5 text-[10px] text-muted">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span>{viewportInfo}</span>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this scan..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted/60 focus:border-accent/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center self-end rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isStreaming ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
