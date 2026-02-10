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

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('synthesizeSpeech', () => {
  const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
  // Default URL when env var is not set
  const EXPECTED_URL = 'http://localhost:8000/synthesize';

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

  it('throws error when API call fails', async () => {
    const errorMessage = 'Internal Server Error';
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => errorMessage,
    });

    await expect(synthesizeSpeech('test')).rejects.toThrow(`音声合成に失敗しました: ${errorMessage}`);
    expect(logger.error).toHaveBeenCalledWith(`音声合成エラー: ${errorMessage}`);
  });
});
