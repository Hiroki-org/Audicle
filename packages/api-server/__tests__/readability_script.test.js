const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('readability_script.js - isIpSafe', () => {
    let isIpSafe;

    beforeAll(() => {
        const scriptPath = path.join(__dirname, '..', 'readability_script.js');
        let scriptContent = fs.readFileSync(scriptPath, 'utf-8');

        // Prevent the script from automatically executing `extractContent(url)`
        scriptContent = scriptContent.replace('extractContent(url);', 'module.exports = { isIpSafe };');

        const moduleObj = { exports: {} };
        const context = vm.createContext({
            require,
            module: moduleObj,
            console,
            process: {
                argv: ['node', 'script.js', 'http://example.com'],
                stdout: { write: jest.fn() },
                stderr: { write: jest.fn() },
                exit: jest.fn()
            },
            URL
        });

        vm.runInContext(scriptContent, context);
        isIpSafe = moduleObj.exports.isIpSafe;
    });

    it('should return true for valid unicast IP (happy path)', () => {
        expect(isIpSafe('8.8.8.8')).toBe(true);
    });

    it('should return false for invalid IP strings, hitting the catch block', () => {
        // This causes ipaddr.parse() to throw an Error, triggering the catch (e) { return false; } block
        expect(isIpSafe('invalid-ip-string')).toBe(false);
    });

    it('should return false for out-of-range private IPs', () => {
        expect(isIpSafe('192.168.1.1')).toBe(false);
        expect(isIpSafe('10.0.0.1')).toBe(false);
        expect(isIpSafe('127.0.0.1')).toBe(false);
    });

    it('should return true for valid IPv4-mapped IPv6 address', () => {
        expect(isIpSafe('::ffff:8.8.8.8')).toBe(true);
    });

    it('should return false for invalid IPv4-mapped IPv6 address', () => {
        expect(isIpSafe('::ffff:127.0.0.1')).toBe(false);
    });
});
