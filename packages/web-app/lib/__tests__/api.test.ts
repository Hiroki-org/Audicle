import { synthesizeSpeech } from '../api';
import { logger } from '../logger';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    apiRequest: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('synthesizeSpeech', () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();
  const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
  const EXPECTED_URL = 'http://localhost:8000/synthesize';

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully synthesizes speech', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    });

    const text = 'Hello world';
    const result = await synthesizeSpeech(text);

    expect(result).toBe(mockBlob);
    expect(mockFetch).toHaveBeenCalledWith(EXPECTED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    expect(logger.apiRequest).toHaveBeenCalled();
    expect(logger.success).toHaveBeenCalled();
  });

  it('handles optional voice parameter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    });

    const text = 'Hello';
    const voice = 'en-US-Standard-A';
    await synthesizeSpeech(text, voice);

    expect(mockFetch).toHaveBeenCalledWith(EXPECTED_URL, expect.objectContaining({
      body: JSON.stringify({ text, voice }),
    }));
  });

  it('throws error when API call fails (response not ok)', async () => {
    const errorMessage = 'Internal Server Error';
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => errorMessage,
    });

    await expect(synthesizeSpeech('test')).rejects.toThrow(`音声合成に失敗しました: ${errorMessage}`);
    expect(logger.error).toHaveBeenCalledWith(`音声合成エラー: ${errorMessage}`);
  });

  it('throws error on network failure', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    await expect(synthesizeSpeech('test')).rejects.toThrow(networkError);
    // Since there's no try/catch in the implementation, logger.error won't be called for network errors
    expect(logger.error).not.toHaveBeenCalled();
  });
});
