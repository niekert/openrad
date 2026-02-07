import { logger } from "@/lib/debug";
import { getFileRelativePath } from "./file-path";

const log = logger("file-manager");

const DEFAULT_SESSION_ID = "default";
const sessionFileRegistry = new Map<string, Map<string, File>>();
let activeSessionId = DEFAULT_SESSION_ID;

function ensureSession(sessionId: string): Map<string, File> {
  const existing = sessionFileRegistry.get(sessionId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, File>();
  sessionFileRegistry.set(sessionId, created);
  return created;
}

export function setActiveFileSession(sessionId: string): void {
  log.debug( "setActiveFileSession", sessionId);
  activeSessionId = sessionId || DEFAULT_SESSION_ID;
}

export function getActiveFileSession(): string {
  return activeSessionId;
}

export function registerFile(key: string, file: File, sessionId = activeSessionId): void {
  ensureSession(sessionId).set(key, file);
}

export function getFile(key: string, sessionId = activeSessionId): File | undefined {
  const session = ensureSession(sessionId);
  const file = session.get(key);
  if (!file) {
    log.debug( "getFile MISS", { key, sessionId, registeredKeys: session.size });
  }
  return file;
}

export function clearFiles(sessionId = activeSessionId): void {
  const session = ensureSession(sessionId);
  log.debug( "clearFiles", { sessionId, fileCount: session.size });
  session.clear();
}

export function clearAllFileSessions(): void {
  sessionFileRegistry.clear();
}

export function generateFileKey(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").toLowerCase();
}

export function registerFiles(files: File[], sessionId = activeSessionId): void {
  log.debug( "registerFiles", { count: files.length, sessionId });
  for (const file of files) {
    const path = getFileRelativePath(file);
    const key = generateFileKey(path);
    registerFile(key, file, sessionId);
  }
}
