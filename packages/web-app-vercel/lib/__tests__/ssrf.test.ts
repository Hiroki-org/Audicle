import { isSafeUrl } from '../ssrf';

describe('isSafeUrl', () => {
  it('should return false for invalid URL strings that throw an error in the try block', async () => {
    expect(await isSafeUrl('not-a-url')).toBe(false);
    expect(await isSafeUrl('')).toBe(false);
    expect(await isSafeUrl('http://1.2.3.4.5')).toBe(false);
  });

  it('should return false for URLs with invalid protocols', async () => {
    expect(await isSafeUrl('ftp://example.com')).toBe(false);
    expect(await isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(await isSafeUrl('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==')).toBe(false);
  });

  it('should return false for blocked hostnames like localhost', async () => {
    expect(await isSafeUrl('http://localhost')).toBe(false);
    expect(await isSafeUrl('https://test.localhost')).toBe(false);
  });
});
