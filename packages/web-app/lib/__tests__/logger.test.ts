import { logger } from "../logger";

describe("logger", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("info calls console.log with correct prefix and styling", () => {
    logger.info("test message", { key: "value" });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Audicle] [INFO]"),
      expect.any(String),
      "test message",
      { key: "value" }
    );
  });

  it("success calls console.log with correct prefix and styling", () => {
    logger.success("success message");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Audicle] [SUCCESS]"),
      expect.any(String),
      "success message"
    );
  });

  it("warn calls console.warn with correct prefix and styling", () => {
    logger.warn("warning message");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Audicle] [WARN]"),
      expect.any(String),
      "warning message"
    );
  });

  it("error calls console.error with correct prefix and styling", () => {
    logger.error("error message");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Audicle] [ERROR]"),
      expect.any(String),
      "error message"
    );
  });

  it("data calls console.log twice with message and data", () => {
    const testData = { id: 1 };
    logger.data("data message", testData);
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("[Audicle] [DATA]"),
      expect.any(String),
      "data message"
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, testData);
  });

  it("apiRequest logs method, url and optionally data", () => {
    logger.apiRequest("GET", "/api/test");
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Audicle] [API →]"),
      expect.any(String),
      "GET /api/test"
    );

    consoleLogSpy.mockClear();

    logger.apiRequest("POST", "/api/test", { payload: true });
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, "Request data:", { payload: true });
  });

  it("apiResponse logs url and response data", () => {
    logger.apiResponse("/api/test", { result: "ok" });
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("[Audicle] [API ←]"),
      expect.any(String),
      "/api/test"
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, "Response data:", { result: "ok" });
  });

  it("cache logs action and key", () => {
    logger.cache("SET", "user:1");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Audicle] [CACHE]"),
      expect.any(String),
      "SET: user:1"
    );
  });
});
