// ログユーティリティ

const LOG_PREFIX = "[Audicle]";
const LOG_STYLES = {
  info: "color: #3b82f6; font-weight: bold",
  success: "color: #10b981; font-weight: bold",
  warn: "color: #f59e0b; font-weight: bold",
  error: "color: #ef4444; font-weight: bold",
  data: "color: #8b5cf6; font-weight: bold",
};

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`%c${LOG_PREFIX} [INFO]`, LOG_STYLES.info, message, ...args);
  },

  success: (message: string, ...args: unknown[]) => {
    console.log(
      `%c${LOG_PREFIX} [SUCCESS]`,
      LOG_STYLES.success,
      message,
      ...args
    );
  },

  warn: (message: string, ...args: unknown[]) => {
    console.warn(`%c${LOG_PREFIX} [WARN]`, LOG_STYLES.warn, message, ...args);
  },

  error: (message: string, ...args: unknown[]) => {
    console.error(
      `%c${LOG_PREFIX} [ERROR]`,
      LOG_STYLES.error,
      message,
      ...args
    );
  },

  data: (message: string, data: unknown) => {
    console.log(`%c${LOG_PREFIX} [DATA]`, LOG_STYLES.data, message);
    console.log(data);
  },

  apiRequest: (method: string, url: string, data?: unknown) => {
    console.log(`%c${LOG_PREFIX} [API →]`, LOG_STYLES.info, `${method} ${url}`);
    if (data) {
      console.log("Request data:", data);
    }
  },

  apiResponse: (url: string, data: unknown) => {
    console.log(`%c${LOG_PREFIX} [API ←]`, LOG_STYLES.success, url);
    console.log("Response data:", data);
  },

  cache: (action: string, key: string) => {
    console.log(
      `%c${LOG_PREFIX} [CACHE]`,
      LOG_STYLES.data,
      `${action}: ${key}`
    );
  },
};
