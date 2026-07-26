import { extractContent, synthesizeSpeech } from "../api";
import { logger } from "../logger";

jest.mock("../logger", () => ({
  logger: {
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe("api utilities", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("extractContent", () => {
    it("should extract content successfully", async () => {
      const mockResponse = { title: "Test", content: "Test content" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await extractContent("https://example.com");

      expect(global.fetch).toHaveBeenCalledWith("http://localhost:8000/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      });
      expect(result).toEqual(mockResponse);
      expect(logger.apiRequest).toHaveBeenCalled();
      expect(logger.apiResponse).toHaveBeenCalled();
    });

    it("should throw an error when fetch fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => "Internal Server Error",
      });

      await expect(extractContent("https://example.com")).rejects.toThrow(
        "抽出に失敗しました: Internal Server Error"
      );
      expect(logger.error).toHaveBeenCalledWith("抽出エラー: Internal Server Error");
    });
  });

  describe("synthesizeSpeech", () => {
    it("should synthesize speech successfully without voice", async () => {
      const mockBlob = new Blob(["test audio data"]);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      const result = await synthesizeSpeech("Hello world");

      expect(global.fetch).toHaveBeenCalledWith("http://localhost:8000/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Hello world" }),
      });
      expect(result).toBe(mockBlob);
      expect(logger.apiRequest).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalled();
    });

    it("should synthesize speech successfully with voice", async () => {
      const mockBlob = new Blob(["test audio data"]);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      const result = await synthesizeSpeech("Hello world", "alloy");

      expect(global.fetch).toHaveBeenCalledWith("http://localhost:8000/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Hello world", voice: "alloy" }),
      });
      expect(result).toBe(mockBlob);
    });

    it("should throw an error when fetch fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => "Bad Request",
      });

      await expect(synthesizeSpeech("Hello world")).rejects.toThrow(
        "音声合成に失敗しました: Bad Request"
      );
      expect(logger.error).toHaveBeenCalledWith("音声合成エラー: Bad Request");
    });
  });
});
