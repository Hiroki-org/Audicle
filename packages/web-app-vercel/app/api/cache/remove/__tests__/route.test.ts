/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { removeCachedChunk } from "@/lib/db/cacheIndex";
import { calculateTextHash } from "@/lib/textHash";

// Mock dependencies
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db/cacheIndex", () => ({
  removeCachedChunk: jest.fn(),
}));

jest.mock("@/lib/textHash", () => ({
  calculateTextHash: jest.fn(),
}));

describe("/api/cache/remove route", () => {
  const mockAuth = auth as jest.MockedFunction<typeof auth>;
  const mockRemoveCachedChunk = removeCachedChunk as jest.MockedFunction<typeof removeCachedChunk>;
  const mockCalculateTextHash = calculateTextHash as jest.MockedFunction<typeof calculateTextHash>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockAuth.mockResolvedValue({
      user: { email: "test@example.com", id: "user-123" },
      expires: "9999-12-31T23:59:59.999Z",
    });

    mockCalculateTextHash.mockReturnValue("mocked-hash");
    mockRemoveCachedChunk.mockResolvedValue(undefined);

    // Suppress console.error for clean test output
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockRequest = (body: any) => {
    return new NextRequest("http://localhost/api/cache/remove", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "test-req-id",
      },
      body: body ? JSON.stringify(body) : null,
    });
  };

  it("should return 401 if user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = createMockRequest({
      articleUrl: "https://example.com/article",
      voice: "alloy",
      text: "test text",
      index: 0,
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(mockRemoveCachedChunk).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "[Cache Remove API] ❌ Unauthorized",
      { requestId: "test-req-id" }
    );
  });

  it("should return 400 if required fields are missing", async () => {
    const testCases = [
      { body: { voice: "alloy", text: "text", index: 0 }, missing: "articleUrl" },
      { body: { articleUrl: "url", text: "text", index: 0 }, missing: "voice" },
      { body: { articleUrl: "url", voice: "alloy", index: 0 }, missing: "text" },
      { body: { articleUrl: "url", voice: "alloy", text: "text" }, missing: "index" },
    ];

    for (const { body } of testCases) {
      const req = createMockRequest(body);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("articleUrl, voice, text, and index are required");
    }

    expect(mockRemoveCachedChunk).not.toHaveBeenCalled();
  });

  it("should successfully remove cache when valid request is provided", async () => {
    const req = createMockRequest({
      articleUrl: "https://example.com/article",
      voice: "alloy",
      text: "test text",
      index: 5,
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mockCalculateTextHash).toHaveBeenCalledWith("test text", 5);
    expect(mockRemoveCachedChunk).toHaveBeenCalledWith(
      "https://example.com/article",
      "alloy",
      "mocked-hash"
    );
  });

  it("should return 500 if removeCachedChunk throws an error", async () => {
    const mockError = new Error("Database error");
    mockRemoveCachedChunk.mockRejectedValue(mockError);

    const req = createMockRequest({
      articleUrl: "https://example.com/article",
      voice: "alloy",
      text: "test text",
      index: 5,
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to remove cached chunk");
    expect(console.error).toHaveBeenCalledWith("[Cache Remove API] Error:", mockError);
  });

  it("should allow index 0 (falsy check)", async () => {
    const req = createMockRequest({
      articleUrl: "https://example.com/article",
      voice: "alloy",
      text: "test text",
      index: 0,
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mockCalculateTextHash).toHaveBeenCalledWith("test text", 0);
  });
});
