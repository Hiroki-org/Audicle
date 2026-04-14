import { createReaderUrl, ReaderUrlParams } from '../urlBuilder';

describe('createReaderUrl', () => {
  it('should create a URL with only articleId', () => {
    const params: ReaderUrlParams = {
      articleId: '123',
    };
    const url = createReaderUrl(params);
    expect(url).toBe('/reader?id=123');
  });

  it('should create a URL with only articleUrl', () => {
    const params: ReaderUrlParams = {
      articleUrl: 'https://example.com/article',
    };
    const url = createReaderUrl(params);
    // URLSearchParams encodes the URL
    expect(url).toBe('/reader?url=https%3A%2F%2Fexample.com%2Farticle');
  });

  it('should create a URL with playlistId', () => {
    const params: ReaderUrlParams = {
      playlistId: 'playlist-abc',
    };
    const url = createReaderUrl(params);
    expect(url).toBe('/reader?playlist=playlist-abc');
  });

  it('should create a URL with playlistId and playlistIndex', () => {
    const params: ReaderUrlParams = {
      playlistId: 'playlist-abc',
      playlistIndex: 5,
    };
    const url = createReaderUrl(params);
    expect(url).toBe('/reader?playlist=playlist-abc&index=5');
  });

  it('should not include index if playlistId is missing', () => {
    const params: ReaderUrlParams = {
      playlistIndex: 5,
    };
    const url = createReaderUrl(params);
    expect(url).toBe('/reader?');
  });

  it('should create a URL with autoplay', () => {
    const params: ReaderUrlParams = {
      articleId: '123',
      autoplay: true,
    };
    const url = createReaderUrl(params);
    expect(url).toBe('/reader?id=123&autoplay=true');
  });

  it('should create a URL with all parameters', () => {
    const params: ReaderUrlParams = {
      articleId: '123',
      articleUrl: 'https://example.com',
      playlistId: 'plist-1',
      playlistIndex: 0,
      autoplay: true,
    };
    const url = createReaderUrl(params);
    // Order of params depends on implementation, but URLSearchParams usually appends in order
    // id, url, playlist, index, autoplay
    const expected = '/reader?id=123&url=https%3A%2F%2Fexample.com&playlist=plist-1&index=0&autoplay=true';
    expect(url).toBe(expected);
  });

  it('should handle empty params', () => {
    const params: ReaderUrlParams = {};
    const url = createReaderUrl(params);
    expect(url).toBe('/reader?');
  });
});
