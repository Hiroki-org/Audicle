import { NextRequest } from "next/server";
import { getCorsHeaders } from "../cors";

describe("getCorsHeaders", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  function createMockRequest(origin: string | null): NextRequest {
    return {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "origin" ? origin : null,
      },
    } as unknown as NextRequest;
  }

  it("should return default headers when no origin is provided", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";
    const request = createMockRequest(null);

    const headers = getCorsHeaders(request);

    expect(headers).toEqual({
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("should return default headers when origin is not in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";
    const request = createMockRequest("http://malicious-site.com");

    const headers = getCorsHeaders(request);

    expect(headers).toEqual({
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("should return CORS headers when origin is allowed", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:3000, https://example.com";
    const request = createMockRequest("https://example.com");

    const headers = getCorsHeaders(request);

    expect(headers).toEqual({
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Credentials": "true",
    });
  });

  it("should handle whitespace in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS =
      " http://localhost:3000 ,  https://example.com  ";
    const request = createMockRequest("https://example.com");

    const headers = getCorsHeaders(request);

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
  });

  it("should log an error in production if ALLOWED_ORIGINS is empty", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "";
    const request = createMockRequest("http://localhost:3000");

    getCorsHeaders(request);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "ALLOWED_ORIGINS must be configured in production. Set it to a comma-separated list of allowed origins.",
    );
  });

  it("should not log an error if NODE_ENV is not production and ALLOWED_ORIGINS is empty", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOWED_ORIGINS = "";
    const request = createMockRequest("http://localhost:3000");

    getCorsHeaders(request);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
