"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import type { ViewerSessionController } from "@/lib/viewer/runtime/viewer-session-controller";
import type { ViewerStateSnapshot } from "@/lib/viewer/state/types";
import { MessageResponse } from "@/components/ai-elements/message";
import ResizeHandle from "./ResizeHandle";

interface AIChatPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  session: ViewerSessionController;
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

function formatSliceInfo(snapshot: ViewerStateSnapshot): string {
  const parts: string[] = [];
  parts.push(`Slice ${snapshot.primarySliceIndex + 1}`);
  parts.push(`WW:${Math.round(snapshot.windowWidth)} WC:${Math.round(snapshot.windowCenter)}`);
  return parts.join(" · ");
}

export default function AIChatPanel({
  width,
  onWidthChange,
  session,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    id: "ai-chat",
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dismissPrivacyNotice = useCallback(() => {
    window.localStorage.setItem(AI_CHAT_NOTICE_DISMISSED_KEY, "true");
    setShowPrivacyNotice(false);
  }, []);

  const pendingSnapshotRef = useRef<ViewerStateSnapshot | null>(null);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      const snapshot = session.captureViewerSnapshot();
      pendingSnapshotRef.current = snapshot;

      const files: FileUIPart[] = Object.entries(snapshot.screenshots).map(([viewportId, dataUrl]) => ({
        type: "file",
        mediaType: "image/jpeg",
        url: dataUrl,
        filename: `${viewportId}-viewport.jpg`,
      }));

      const contextLine = `[Viewer state: Slice ${snapshot.primarySliceIndex + 1}${primaryTotal > 0 ? `/${primaryTotal}` : ""}, WW:${Math.round(snapshot.windowWidth)} WC:${Math.round(snapshot.windowCenter)}${snapshot.compareSeriesUID ? ", comparing with prior study" : ""}]`;

      void sendMessage({
        text: `${contextLine}\n\n${text}`,
        files,
      });
    },
    [session, sendMessage, isStreaming, primaryTotal]
  );

  // Associate snapshot with the user message once it appears
  useEffect(() => {
    if (!pendingSnapshotRef.current) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;
    const alreadyStored = snapshots.some((s) => s.messageId === lastUserMessage.id);
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
    [session, snapshots]
  );

  const getSnapshot = useCallback(
    (messageId: string): ViewerStateSnapshot | null => {
      return snapshots.find((s) => s.messageId === messageId)?.snapshot ?? null;
    },
    [snapshots]
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
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="text-muted text-xs leading-relaxed">
                  <p className="mb-2">Ask questions about your scans.</p>
                  <p>Viewport screenshots are captured with each message.</p>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                snapshot={getSnapshot(message.id)}
                onRestore={() => handleRestore(message.id)}
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
                  AI chat uploads viewport images to model providers for analysis. OpenRad does not store these images on its own servers.
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
            viewportInfo={`Slice ${primarySliceIndex + 1}${primaryTotal > 0 ? `/${primaryTotal}` : ""} · WW:${Math.round(windowWidth)} WC:${Math.round(windowCenter)}${compareOpen ? " · Compare" : ""}`}
          />
        </div>
      </div>
    </div>
  );
}

// --- Chat Message Component ---

interface ChatMessageProps {
  message: UIMessage;
  snapshot: ViewerStateSnapshot | null;
  onRestore: () => void;
}

function ChatMessage({ message, snapshot, onRestore }: ChatMessageProps) {
  const isUser = message.role === "user";
  const screenshots = snapshot?.screenshots ?? {};
  const screenshotEntries = Object.entries(screenshots);

  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
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
              : part.text;
            if (isUser) {
              return (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {text}
                </div>
              );
            }
            return (
              <MessageResponse key={i} className="break-words text-xs">
                {text}
              </MessageResponse>
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
}

function ChatInput({ onSend, isStreaming, viewportInfo }: ChatInputProps) {
  const [input, setInput] = useState("");
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
    [input, isStreaming, onSend]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="border-t border-border p-2">
      <div className="flex items-center gap-1 px-1 pb-1.5 text-[10px] text-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
