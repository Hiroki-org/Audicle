const { Readability } = require('@mozilla/readability');
const fetch = require('node-fetch');

jest.mock('@mozilla/readability');
jest.mock('node-fetch', () => jest.fn());
jest.mock('dns');
jest.mock('ipaddr.js', () => ({
  parse: jest.fn().mockReturnValue({
    range: () => 'unicast',
    kind: () => 'ipv4',
    toIPv4Address: jest.fn().mockReturnValue({ range: () => 'unicast' }),
    isIPv4MappedAddress: jest.fn().mockReturnValue(false)
  }),
  isValid: jest.fn().mockReturnValue(false)
}));

describe('readability_script', () => {
  let originalArgv;
  let exitMock;
  let consoleErrorMock;
  let stdoutWriteMock;

  beforeEach(() => {
    originalArgv = process.argv;
    exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    stdoutWriteMock = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    fetch.mockReset();
    fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html><body><p>Test content</p></body></html>')
    });

    Readability.mockImplementation(() => {
      return {
        parse: () => ({
          title: "Test Title",
          textContent: "Chunk 1 is long enough\n\nChunk 2 is also long enough"
        })
      };
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it('should process article and output JSON to stdout', async () => {
    process.argv = ['node', 'readability_script.js', 'http://example.com'];
    jest.isolateModules(() => {
      require('./readability_script.js');
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(stdoutWriteMock).toHaveBeenCalledWith(
      JSON.stringify({
        title: "Test Title",
        chunks: ["Chunk 1 is long enough", "Chunk 2 is also long enough"]
      }) + "\n"
    );
    expect(exitMock).not.toHaveBeenCalled();
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  it('should write error JSON and exit with 1 when chunk serialization throws an error', async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html><body><p>Test content</p></body></html>')
    });

    Readability.mockImplementation(() => {
      return {
        parse: () => {
          throw new Error("Mocked chunk serialization error");
        }
      };
    });

    process.argv = ['node', 'readability_script.js', 'http://example.com'];
    jest.isolateModules(() => {
      require('./readability_script.js');
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleErrorMock).toHaveBeenCalledWith(JSON.stringify({ error: "Mocked chunk serialization error" }));
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(stdoutWriteMock).not.toHaveBeenCalled();
  });

  it('should exit with 1 if no URL is provided', async () => {
    process.argv = ['node', 'readability_script.js'];
    jest.isolateModules(() => {
      require('./readability_script.js');
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleErrorMock).toHaveBeenCalledWith(JSON.stringify({ error: "URL is required" }));
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
