import os
files = ['jest.setup.js', 'next.config.js']

code_to_add = """
// Polyfill markAsUncloneable for Undici v8 in Node 20 / JSDOM
if (typeof globalThis !== 'undefined' && globalThis.core === undefined) {
    if (!globalThis.webidl) globalThis.webidl = { util: {} };
    if (!globalThis.webidl.util) globalThis.webidl.util = {};
    if (!globalThis.webidl.util.markAsUncloneable) {
        globalThis.webidl.util.markAsUncloneable = function(obj) { return obj; };
    }
}
"""

with open('jest.setup.js', 'a') as f:
    f.write(code_to_add)
