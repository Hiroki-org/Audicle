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
    jest.restoreAllMocks();
  });

  it("info logs with correct prefix and style", () => {
    logger.info("test message", { key: "value" });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [INFO]",
      "color: #3b82f6; font-weight: bold",
      "test message",
      { key: "value" }
    );
  });

  it("success logs with correct prefix and style", () => {
    logger.success("success message", 123);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [SUCCESS]",
      "color: #10b981; font-weight: bold",
      "success message",
      123
    );
  });

  it("warn logs with correct prefix and style", () => {
    logger.warn("warning message", "extra");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "%c[Audicle] [WARN]",
      "color: #f59e0b; font-weight: bold",
      "warning message",
      "extra"
    );
  });

  it("error logs with correct prefix and style", () => {
    logger.error("error message", new Error("test"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "%c[Audicle] [ERROR]",
      "color: #ef4444; font-weight: bold",
      "error message",
      expect.any(Error)
    );
  });

  it("data logs message and data separately", () => {
    const testData = { a: 1 };
    logger.data("data message", testData);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [DATA]",
      "color: #8b5cf6; font-weight: bold",
      "data message"
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(testData);
  });

  it("apiRequest logs method and url without data", () => {
    logger.apiRequest("GET", "/api/test");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [API →]",
      "color: #3b82f6; font-weight: bold",
      "GET /api/test"
    );
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it("apiRequest logs method, url and data when data is provided", () => {
    const reqData = { id: 1 };
    logger.apiRequest("POST", "/api/test", reqData);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [API →]",
      "color: #3b82f6; font-weight: bold",
      "POST /api/test"
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("Request data:", reqData);
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
  });

  it("apiResponse logs url and response data", () => {
    const resData = { status: "ok" };
    logger.apiResponse("/api/test", resData);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [API ←]",
      "color: #10b981; font-weight: bold",
      "/api/test"
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("Response data:", resData);
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
  });

  it("cache logs action and key", () => {
    logger.cache("SET", "my-key");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "%c[Audicle] [CACHE]",
      "color: #8b5cf6; font-weight: bold",
      "SET: my-key"
    );
  });
});
