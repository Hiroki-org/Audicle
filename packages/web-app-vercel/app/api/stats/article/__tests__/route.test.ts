/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";

// Authをモック
jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { email: "test@example.com" },
  }),
}));

// Supabaseをモック
const mockRpc = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

describe("/api/stats/article route", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // hashEmailがエラーにならないように環境変数をセット
    process.env.TEST_EMAIL_HASH_SECRET = "test_secret";
    process.env.TEST_SESSION_TOKEN = "test_token";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createRequest = (body: any) => {
    return new NextRequest("http://localhost/api/stats/article", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  };

  const validBody = {
    articleHash: "hash123",
    url: "https://example.com/article",
    title: "Test Article",
    domain: "example.com",
    cacheHits: 5,
    cacheMisses: 2,
    isFullyCached: false,
  };

  it("returns 500 when Supabase RPC fails", async () => {
    // RPCがエラーを返すようにモック
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Database connection failed", code: "503" },
    });

    // console.error出力を抑制
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: "Failed to record stats",
    });

    consoleSpy.mockRestore();
  });

  it("returns 200 and successful response on valid request", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { access_count: 42 },
      error: null,
    });

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      accessCount: 42,
      cacheHitRate: 71.43, // (5 / 7) * 100
    });
  });

  it("returns 200 with cacheHitRate 0 when total requests are 0", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { access_count: 42 },
      error: null,
    });

    const body = { ...validBody, cacheHits: 0, cacheMisses: 0 };
    const request = createRequest(body);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      accessCount: 42,
      cacheHitRate: 0,
    });
  });

  it("returns 200 with accessCount 1 when data.access_count is not provided", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null, // access_count is missing
      error: null,
    });

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      accessCount: 1, // Fallback value
      cacheHitRate: 71.43,
    });
  });

  it("returns 200 with accessCount 1 when data.access_count is 0 (falsy fallback)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { access_count: 0 },
      error: null,
    });

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    // Note: || operator treats 0 as falsy, so it falls back to 1
    // Consider using ?? instead of || if 0 should be preserved
    expect(json).toEqual({
      success: true,
      accessCount: 1,
      cacheHitRate: 71.43,
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when required fields are missing", async () => {
    const invalidBody = { ...validBody };
    delete (invalidBody as any).url;

    const request = createRequest(invalidBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Missing or invalid required fields" });
  });

  it("returns 500 when request.json() throws an error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const request = new NextRequest("http://localhost/api/stats/article", {
      method: "POST",
      body: "invalid json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Internal server error" });

    consoleSpy.mockRestore();
  });

  it("throws error when hash secret is missing in test env", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    delete process.env.EMAIL_HASH_SECRET;
    delete process.env.TEST_EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "test";
    process.env.CI = "true";

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Internal server error" });

    consoleSpy.mockRestore();
  });

  it("throws error when hash secret is missing in production env", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "production";
    process.env.CI = "";
    delete process.env.TEST_SESSION_TOKEN;

    const request = createRequest(validBody);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Internal server error" });

    consoleSpy.mockRestore();
  });

  it("uses EMAIL_HASH_SECRET when provided", async () => {
    process.env.EMAIL_HASH_SECRET = "prod_secret";

    mockRpc.mockResolvedValueOnce({
      data: { access_count: 42 },
      error: null,
    });

    const request = createRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});
