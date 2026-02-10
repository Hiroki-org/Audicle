import { extractContent, synthesizeSpeech } from './api';
import { ExtractResponse } from '@/types/api';
import { logger } from './logger';

// Mock logger
jest.mock('./logger', () => ({
  logger: {
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    data: jest.fn(),
    cache: jest.fn(),
  },
}));

describe('API Utils', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('extractContent', () => {
    it('should extract content successfully', async () => {
      const mockResponse: ExtractResponse = {
        title: 'Test Article',
        chunks: ['Chunk 1', 'Chunk 2'],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const url = 'https://example.com/article';
      const result = await extractContent(url);

      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/extract'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ url }),
        })
      );
      expect(logger.apiRequest).toHaveBeenCalledWith('POST', expect.stringContaining('/extract'), { url });
      expect(logger.apiResponse).toHaveBeenCalledWith(expect.stringContaining('/extract'), mockResponse);
    });

    it('should throw an error when API returns non-ok status', async () => {
      const errorMessage = 'Internal Server Error';
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        text: async () => errorMessage,
      } as Response);

      const url = 'https://example.com/error';

      await expect(extractContent(url)).rejects.toThrow(`抽出に失敗しました: ${errorMessage}`);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(`抽出エラー: ${errorMessage}`);
    });

    it('should throw an error when fetch fails (network error)', async () => {
      const networkError = new Error('Network error');
      fetchSpy.mockRejectedValueOnce(networkError);

      const url = 'https://example.com/network-error';

      await expect(extractContent(url)).rejects.toThrow('Network error');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('synthesizeSpeech', () => {
    it('should synthesize speech successfully', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      } as Response);

      const text = 'Hello world';
      const result = await synthesizeSpeech(text);

      expect(result).toEqual(mockBlob);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/synthesize'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ text }),
        })
      );
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('音声合成完了'));
    });

    it('should handle voice parameter', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      } as Response);

      const text = 'Hello world';
      const voice = 'en-US-Standard-A';
      await synthesizeSpeech(text, voice);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/synthesize'),
        expect.objectContaining({
          body: JSON.stringify({ text, voice }),
        })
      );
    });

    it('should throw an error when API returns non-ok status', async () => {
      const errorMessage = 'TTS Error';
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        text: async () => errorMessage,
      } as Response);

      await expect(synthesizeSpeech('text')).rejects.toThrow(`音声合成に失敗しました: ${errorMessage}`);
      expect(logger.error).toHaveBeenCalledWith(`音声合成エラー: ${errorMessage}`);
    });
  });
});
