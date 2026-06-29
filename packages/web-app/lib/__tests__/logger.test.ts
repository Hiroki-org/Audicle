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

  describe("info", () => {
    it("should log info message with correct style", () => {
      logger.info("Test message", { key: "value" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "%c[Audicle] [INFO]",
        "color: #3b82f6; font-weight: bold",
        "Test message",
        { key: "value" }
      );
    });

    it("should log info message without extra arguments", () => {
      logger.info("Test message");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "%c[Audicle] [INFO]",
        "color: #3b82f6; font-weight: bold",
        "Test message"
      );
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("success", () => {
    it("should log success message with correct style", () => {
      logger.success("Success message");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "%c[Audicle] [SUCCESS]",
        "color: #10b981; font-weight: bold",
        "Success message"
      );
    });
  });

  describe("warn", () => {
    it("should log warn message with correct style", () => {
      logger.warn("Warning message");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "%c[Audicle] [WARN]",
        "color: #f59e0b; font-weight: bold",
        "Warning message"
      );
    });
  });

  describe("error", () => {
    it("should log error message with correct style", () => {
      logger.error("Error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "%c[Audicle] [ERROR]",
        "color: #ef4444; font-weight: bold",
        "Error message"
      );
    });
  });

  describe("data", () => {
    it("should log data message and the data object", () => {
      const testData = { id: 1, name: "test" };
      logger.data("Data message", testData);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        "%c[Audicle] [DATA]",
        "color: #8b5cf6; font-weight: bold",
        "Data message"
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, testData);
    });
  });

  describe("apiRequest", () => {
    it("should log API request without data", () => {
      logger.apiRequest("GET", "/api/users");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "%c[Audicle] [API →]",
        "color: #3b82f6; font-weight: bold",
        "GET /api/users"
      );
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it("should log API request with data", () => {
      const requestData = { name: "John" };
      logger.apiRequest("POST", "/api/users", requestData);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        "%c[Audicle] [API →]",
        "color: #3b82f6; font-weight: bold",
        "POST /api/users"
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, "Request data:", requestData);
    });
  });

  describe("apiResponse", () => {
    it("should log API response", () => {
      const responseData = { success: true };
      logger.apiResponse("/api/users", responseData);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        "%c[Audicle] [API ←]",
        "color: #10b981; font-weight: bold",
        "/api/users"
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, "Response data:", responseData);
    });

    it("should always log API response data when it is undefined", () => {
      logger.apiResponse("/api/users", undefined);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        "%c[Audicle] [API ←]",
        "color: #10b981; font-weight: bold",
        "/api/users"
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, "Response data:", undefined);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache", () => {
    it("should log cache action", () => {
      logger.cache("HIT", "user_123");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "%c[Audicle] [CACHE]",
        "color: #8b5cf6; font-weight: bold",
        "HIT: user_123"
      );
    });
  });
});
