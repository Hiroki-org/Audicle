import { jest } from '@jest/globals';
import { chrome } from 'jest-chrome';

// Set up global mocks before evaluating background.js
global.chrome = chrome;

// Mock Blob since it's not available in standard Node.js environments (which Jest defaults to)
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options && options.type ? options.type : '';
    }
  };
}

// We need to test the RemoteAudioSynthesizer from background.js
// Since background.js has multiple classes but no exports, we'll need to use a trick to evaluate it
const fs = require('fs');
const path = require('path');

const backgroundCode = fs.readFileSync(path.resolve(__dirname, '../background.js'), 'utf8');

// The code runs in strict mode and top-level variables aren't attached to global context in module mode.
// We'll extract the specific classes we need by evaluating in a context that assigns them to globals.
// Also we need to mock blobToDataURL within the eval context to avoid FileReader error.
const evalContext = `
  ${backgroundCode}
  global.RemoteAudioSynthesizer = RemoteAudioSynthesizer;
  // Override the blobToDataURL defined in the script
  blobToDataURL = async function(blob) {
    if (global.mockBlobToDataURL) {
      return global.mockBlobToDataURL(blob);
    }
    throw new Error('Not mocked');
  };
`;
eval(evalContext);

describe('RemoteAudioSynthesizer', () => {
  let originalFetch;

  beforeEach(() => {
    // Mock the global fetch
    originalFetch = global.fetch;
    global.fetch = jest.fn();

    // Mock chrome APIs
    global.chrome.runtime.getURL.mockImplementation(path => `chrome-extension://testid/${path}`);

    global.mockBlobToDataURL = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('should successfully synthesize text', async () => {
    const synthesizer = new global.RemoteAudioSynthesizer('http://localhost:8000', '/api/synthesize', 'Test API Server');

    // Mock fetch to return a successful response with a blob
    const mockBlob = new global.Blob(['mock audio data'], { type: 'audio/mpeg' });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: jest.fn().mockResolvedValueOnce(mockBlob)
    });

    // Mock blobToDataURL
    global.mockBlobToDataURL = jest.fn().mockResolvedValueOnce('data:audio/mpeg;base64,mockbase64');

    const dataUrl = await synthesizer.synthesize('hello world');

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'hello world' }),
    });

    expect(dataUrl).toBe('data:audio/mpeg;base64,mockbase64');
  });

  it('should handle fetch errors', async () => {
    const synthesizer = new global.RemoteAudioSynthesizer('http://localhost:8000', '/api/synthesize', 'Test API Server');

    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    await expect(synthesizer.synthesize('hello world')).rejects.toThrow('Test API Server synthesis failed: Network Error');
  });

  it('should handle non-ok responses', async () => {
    const synthesizer = new global.RemoteAudioSynthesizer('http://localhost:8000', '/api/synthesize', 'Test API Server');

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValueOnce('Server crashed')
    });

    await expect(synthesizer.synthesize('hello world')).rejects.toThrow('Test API Server synthesis failed: Test API Server error: 500 Internal Server Error Server crashed');
  });
});
