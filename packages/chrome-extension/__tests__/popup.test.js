const { getHostnameFromUrl, parseAuthResult } = require('../popup.js');

describe('getHostnameFromUrl', () => {
  beforeEach(() => {
    // Silence console.error for expected failures in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should extract hostname from valid http/https URLs', () => {
    expect(getHostnameFromUrl('https://www.example.com/path?query=1')).toBe('www.example.com');
    expect(getHostnameFromUrl('http://sub.domain.co.uk/')).toBe('sub.domain.co.uk');
    expect(getHostnameFromUrl('https://localhost:3000')).toBe('localhost');
  });

  it('should return empty string for invalid URLs', () => {
    expect(getHostnameFromUrl('not-a-url')).toBe('');
    expect(getHostnameFromUrl('')).toBe('');
    expect(getHostnameFromUrl(null)).toBe('');
    expect(getHostnameFromUrl(undefined)).toBe('');
  });

  it('should handle chrome:// and other custom protocol URLs', () => {
    expect(getHostnameFromUrl('chrome://extensions/')).toBe('extensions');
    expect(getHostnameFromUrl('chrome-extension://abcdefghijklmnopqrstuvwxyz/')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(getHostnameFromUrl('file:///C:/path/to/file')).toBe(''); // file protocol doesn't typically have a hostname
  });
});

describe('parseAuthResult', () => {
  it('should parse token from hash parameters', () => {
    const result = parseAuthResult('https://abc.chromiumapp.org/audicle-auth#access_token=token123&expires_at=2000&email=test%40example.com');
    expect(result).toEqual({
      accessToken: 'token123',
      expiresAt: 2000,
      email: 'test@example.com',
    });
  });

  it('should parse token from query parameters', () => {
    const result = parseAuthResult('https://abc.chromiumapp.org/audicle-auth?access_token=token456&expires_at=3000');
    expect(result.accessToken).toBe('token456');
    expect(result.expiresAt).toBe(3000);
  });

  it('should throw error when access_token is missing', () => {
    expect(() => parseAuthResult('https://abc.chromiumapp.org/audicle-auth#expires_at=2000&email=test%40example.com'))
      .toThrow('アクセストークンが見つかりませんでした');
  });

  it('should fall back to default expiry when expires_at is invalid or 0', () => {
    const originalDateNow = Date.now;
    const now = 1000000;
    Date.now = jest.fn(() => now);

    const resultInvalid = parseAuthResult('https://abc.chromiumapp.org/audicle-auth#access_token=token1&expires_at=invalid');
    expect(resultInvalid.expiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000);

    const resultZero = parseAuthResult('https://abc.chromiumapp.org/audicle-auth#access_token=token2&expires_at=0');
    expect(resultZero.expiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000);

    Date.now = originalDateNow;
  });
});
