const { isIpSafe } = require('./readability_script');

describe('isIpSafe Error Paths', () => {
  it('should return false when parsing throws an error', () => {
    // Invalid strings
    expect(isIpSafe('not-an-ip-address')).toBe(false);
    expect(isIpSafe('example.com')).toBe(false);

    // Out of range (Invalid IP structure)
    expect(isIpSafe('256.256.256.256')).toBe(false);
    expect(isIpSafe('999.999.999.999')).toBe(false);

    // Empty string
    expect(isIpSafe('')).toBe(false);

    // Other types
    expect(isIpSafe(undefined)).toBe(false);
    expect(isIpSafe(null)).toBe(false);
  });

  it('should return true for valid unicast IP addresses', () => {
    expect(isIpSafe('8.8.8.8')).toBe(true);
    expect(isIpSafe('1.1.1.1')).toBe(true);
  });

  it('should return false for invalid IP ranges like private/loopback', () => {
    // Private
    expect(isIpSafe('10.0.0.1')).toBe(false);
    expect(isIpSafe('192.168.1.1')).toBe(false);
    // Loopback
    expect(isIpSafe('127.0.0.1')).toBe(false);
    expect(isIpSafe('::1')).toBe(false);
  });
});
