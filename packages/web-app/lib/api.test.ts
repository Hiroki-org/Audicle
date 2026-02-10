import { extractContent } from './api';
import { ExtractResponse } from '@/types/api';
import { logger } from './logger';

// Mock global fetch
global.fetch = jest.fn();

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

describe('extractContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract content successfully', async () => {
    const mockResponse: ExtractResponse = {
      title: 'Test Article',
      chunks: ['Chunk 1', 'Chunk 2'],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const url = 'https://example.com/article';
    const result = await extractContent(url);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
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
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: async () => errorMessage,
    });

    const url = 'https://example.com/error';

    await expect(extractContent(url)).rejects.toThrow(`抽出に失敗しました: ${errorMessage}`);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`抽出エラー: ${errorMessage}`);
  });

  it('should throw an error when fetch fails (network error)', async () => {
    const networkError = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

    const url = 'https://example.com/network-error';

    await expect(extractContent(url)).rejects.toThrow('Network error');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // logger.error is not called in this case because fetch throws before response check
  });
});
