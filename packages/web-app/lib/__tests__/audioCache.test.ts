import { audioCache } from '../audioCache';
import { synthesizeSpeech } from '../api';

// Mock the API module
jest.mock('../api', () => ({
  synthesizeSpeech: jest.fn(),
}));

describe('AudioCache', () => {
  beforeEach(() => {
    // Clear cache and mocks before each test
    audioCache.clear();
    jest.clearAllMocks();
    (synthesizeSpeech as jest.Mock).mockReset();
    (global.URL.createObjectURL as jest.Mock).mockClear();
    (global.URL.revokeObjectURL as jest.Mock).mockClear();
    jest.useRealTimers();
  });

  describe('get', () => {
    it('should synthesize speech and cache it on cache miss', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
      (synthesizeSpeech as jest.Mock).mockResolvedValue(mockBlob);
      (global.URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url-1');

      const text = 'Hello, world!';
      const voice = 'voice-1';

      const url = await audioCache.get(text, voice);

      expect(synthesizeSpeech).toHaveBeenCalledWith(text, voice);
      expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(url).toBe('blob:mock-url-1');
    });

    it('should return cached URL without synthesizing on cache hit', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
      (synthesizeSpeech as jest.Mock).mockResolvedValue(mockBlob);
      (global.URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url-1');

      const text = 'Hello, world!';
      const voice = 'voice-1';

      // First call (Miss)
      await audioCache.get(text, voice);

      // Reset mock to ensure it's not called again
      (synthesizeSpeech as jest.Mock).mockClear();

      // Second call (Hit)
      const url = await audioCache.get(text, voice);

      expect(synthesizeSpeech).not.toHaveBeenCalled();
      expect(url).toBe('blob:mock-url-1');
    });

    it('should revoke old cache and re-synthesize when expired', async () => {
      jest.useFakeTimers();
      const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
      (synthesizeSpeech as jest.Mock).mockResolvedValue(mockBlob);
      (global.URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url-1');

      const text = 'Expired text';
      const voice = 'voice-1';

      // Initial fetch
      await audioCache.get(text, voice);
      expect(synthesizeSpeech).toHaveBeenCalledTimes(1);

      // Advance time beyond 24 hours (24 * 60 * 60 * 1000 + 100)
      jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 100);

      // Second fetch should trigger re-synthesis because cache expired
      await audioCache.get(text, voice);

      // Check if old URL was revoked
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-1');
      // Check if synthesize was called again
      expect(synthesizeSpeech).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should propagate errors from synthesizeSpeech', async () => {
      const error = new Error('API Error');
      (synthesizeSpeech as jest.Mock).mockRejectedValue(error);

      await expect(audioCache.get('Error text')).rejects.toThrow('API Error');
    });
  });

  describe('prefetch', () => {
    it('should call get for each text', async () => {
      // Spy on the 'get' method of the singleton instance
      // Note: Since 'get' is async, we mock resolved value
      const getSpy = jest.spyOn(audioCache, 'get').mockResolvedValue('blob:url');

      const texts = ['text1', 'text2', 'text3'];
      const voice = 'voice-prefetch';

      await audioCache.prefetch(texts, voice);

      expect(getSpy).toHaveBeenCalledTimes(3);
      expect(getSpy).toHaveBeenCalledWith('text1', voice);
      expect(getSpy).toHaveBeenCalledWith('text2', voice);
      expect(getSpy).toHaveBeenCalledWith('text3', voice);

      getSpy.mockRestore();
    });

    it('should handle errors in individual prefetch calls gracefully', async () => {
        const getSpy = jest.spyOn(audioCache, 'get')
          .mockResolvedValueOnce('blob:url')
          .mockRejectedValueOnce(new Error('Prefetch fail'))
          .mockResolvedValueOnce('blob:url');

        // Should not throw
        await audioCache.prefetch(['t1', 't2', 't3']);

        expect(getSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('clear', () => {
      it('should revoke all URLs and clear cache', async () => {
          const mockBlob = new Blob([''], {type: 'audio/wav'});
          (synthesizeSpeech as jest.Mock).mockResolvedValue(mockBlob);
          (global.URL.createObjectURL as jest.Mock)
            .mockReturnValueOnce('url1')
            .mockReturnValueOnce('url2');

          await audioCache.get('t1');
          await audioCache.get('t2');

          audioCache.clear();

          expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('url1');
          expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('url2');
      });
  });
});
