import 'fake-indexeddb/auto';
import { getAudioChunk, saveAudioChunk, clearAll, generateKey } from '../indexedDB';

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = function (obj) {
    if (obj instanceof Blob) {
      return new Blob([obj], { type: obj.type });
    }
    // simple deep copy for other objects
    return JSON.parse(JSON.stringify(obj));
  };
}

describe('IndexedDB getAudioChunk', () => {
    beforeEach(async () => {
        await clearAll();
    });

    it('should return null when chunk is not found', async () => {
        const chunk = await getAudioChunk('https://example.com/article', 0, 'test-voice');
        expect(chunk).toBeNull();
    });

    it('should return the saved chunk', async () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 0;
        const voiceModel = 'test-voice';

        const testBlob = new Blob(['test audio data'], { type: 'audio/mpeg' });

        const entry = {
            audioData: testBlob,
            timestamp: Date.now(),
            articleUrl,
            chunkIndex,
            totalChunks: 1,
            voiceModel,
            size: testBlob.size,
        };

        await saveAudioChunk(entry);

        const chunk = await getAudioChunk(articleUrl, chunkIndex, voiceModel);

        expect(chunk).not.toBeNull();
        expect(chunk?.articleUrl).toBe(articleUrl);
        expect(chunk?.chunkIndex).toBe(chunkIndex);
        expect(chunk?.voiceModel).toBe(voiceModel);
        expect(chunk?.size).toBe(testBlob.size);
        expect(chunk?.key).toBe(generateKey(articleUrl, chunkIndex, voiceModel));
    });

    it('should handle missing voiceModel by using "default"', async () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 0;
        const testBlob = new Blob(['default voice audio data'], { type: 'audio/mpeg' });

        const entry = {
            audioData: testBlob,
            timestamp: Date.now(),
            articleUrl,
            chunkIndex,
            totalChunks: 1,
            size: testBlob.size,
        };

        await saveAudioChunk(entry);

        const chunk = await getAudioChunk(articleUrl, chunkIndex);

        expect(chunk).not.toBeNull();
        expect(chunk?.articleUrl).toBe(articleUrl);
        expect(chunk?.chunkIndex).toBe(chunkIndex);
        expect(chunk?.voiceModel).toBeUndefined(); // Assuming saveAudioChunk doesn't mutate voiceModel to 'default' in the object itself
        expect(chunk?.key).toBe(generateKey(articleUrl, chunkIndex)); // It should generate 'articleUrl:chunkIndex:default'
    });
});
