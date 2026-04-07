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

  it('should reject when DNS resolves to both public and internal IPs', async () => {
    // Isolate modules and mock dns.lookup to return multiple addresses
    jest.resetModules();
    jest.doMock('dns', () => ({
        lookup: (hostname: string, options: any, callback: any) => {
            if (options && options.all) {
                callback(null, [
                    { address: '93.184.216.34', family: 4 },
                    { address: '127.0.0.1', family: 4 },
                ]);
            } else {
                callback(null, '93.184.216.34', 4);
            }
        }
    }));

    const { isSafeUrl: mockedIsSafeUrl } = require('../ssrf');
    await expect(mockedIsSafeUrl('http://example.com')).resolves.toBe(false);

    jest.dontMock('dns');
    jest.resetModules();
  });
});
