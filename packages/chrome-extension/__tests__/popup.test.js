const { getHostnameFromUrl } = require('../popup.js');

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

  it('should log an error and return empty string when a malformed string is provided', () => {
    const errorSpy = jest.spyOn(console, 'error');
    const result = getHostnameFromUrl('malformed string');

    expect(result).toBe('');
    // Ensure console.error was called with expected start arguments
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe('Invalid URL:');
    expect(errorSpy.mock.calls[0][1]).toBe('malformed string');
    expect(errorSpy.mock.calls[0][2].constructor.name).toBe('TypeError');
  });
});
