const ENABLED = process.env.NODE_ENV === "development";

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const noop = () => {};

const noopLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

export function logger(tag: string): Logger {
  if (!ENABLED) return noopLogger;

  const prefix = `[${tag}]`;
  return {
    debug: (message, ...args) => console.debug(prefix, message, ...args),
    info: (message, ...args) => console.info(prefix, message, ...args),
    warn: (message, ...args) => console.warn(prefix, message, ...args),
    error: (message, ...args) => console.error(prefix, message, ...args),
  };
}
