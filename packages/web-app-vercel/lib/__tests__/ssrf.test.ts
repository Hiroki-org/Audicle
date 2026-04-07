
import { isSafeUrl } from '../ssrf';

describe('isSafeUrl', () => {
    // Public/Safe URLs
    test('should allow public https URLs', async () => {
        expect(await isSafeUrl('https://example.com')).toBe(true);
        expect(await isSafeUrl('https://google.com')).toBe(true);
        expect(await isSafeUrl('https://github.com')).toBe(true);
    });

    test('should allow public http URLs', async () => {
        expect(await isSafeUrl('http://example.com')).toBe(true);
    });

    // Unsafe Protocols
    test('should reject non-http/https protocols', async () => {
        expect(await isSafeUrl('ftp://example.com')).toBe(false);
        expect(await isSafeUrl('file:///etc/passwd')).toBe(false);
        expect(await isSafeUrl('gopher://example.com')).toBe(false);
    });

    // Loopback / Localhost
    test('should reject localhost', async () => {
        expect(await isSafeUrl('http://localhost')).toBe(false);
        expect(await isSafeUrl('http://localhost:3000')).toBe(false);
        expect(await isSafeUrl('https://localhost')).toBe(false);
        expect(await isSafeUrl('http://sub.localhost')).toBe(false);
    });

    test('should reject loopback IP (127.0.0.1)', async () => {
        expect(await isSafeUrl('http://127.0.0.1')).toBe(false);
        expect(await isSafeUrl('http://127.0.0.1:8080')).toBe(false);
    });

    test('should reject loopback IP (IPv6 ::1)', async () => {
        expect(await isSafeUrl('http://[::1]')).toBe(false);
    });

    // Private Networks
    test('should reject private IPv4 ranges', async () => {
        expect(await isSafeUrl('http://10.0.0.1')).toBe(false);
        expect(await isSafeUrl('http://192.168.1.1')).toBe(false);
        expect(await isSafeUrl('http://172.16.0.1')).toBe(false);
        expect(await isSafeUrl('http://172.31.255.255')).toBe(false);
    });

    // Cloud Metadata
    test('should reject AWS/Cloud metadata IP', async () => {
        expect(await isSafeUrl('http://169.254.169.254')).toBe(false);
    });

    // Unspecified
    test('should reject unspecified IP (0.0.0.0)', async () => {
        expect(await isSafeUrl('http://0.0.0.0')).toBe(false);
    });

    // Broadcast
    test('should reject broadcast IP (255.255.255.255)', async () => {
        expect(await isSafeUrl('http://255.255.255.255')).toBe(false);
    });

    // Multicast
    test('should reject multicast IP (224.0.0.1)', async () => {
        expect(await isSafeUrl('http://224.0.0.1')).toBe(false);
    });

    // TEST-NET (RFC 5737)
    test('should reject TEST-NET addresses', async () => {
        expect(await isSafeUrl('http://192.0.2.1')).toBe(false);    // TEST-NET-1
        expect(await isSafeUrl('http://198.51.100.1')).toBe(false); // TEST-NET-2
        expect(await isSafeUrl('http://203.0.113.1')).toBe(false);  // TEST-NET-3
    });

    test('should reject when DNS resolves to both public and internal IPs', async () => {
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
