const fs = require('fs');

const path = 'packages/web-app-vercel/lib/hooks/__tests__/usePlaylists.test.tsx';
let content = fs.readFileSync(path, 'utf8');

// import retryFetch
content = content.replace(
  'usePlaylists,',
  'usePlaylists,\n  retryFetch,'
);

// Add test for retryFetch maxRetries = 0
const newTest = `
  describe("retryFetch", () => {
    it("should throw Max retries exceeded if maxRetries < 1", async () => {
      const mockFetch = jest.fn();
      await expect(retryFetch(mockFetch, 0)).rejects.toThrow('Max retries exceeded');
    });
  });

  describe("usePlaylistDetail", () => {`;

content = content.replace('  describe("usePlaylistDetail", () => {', newTest);

fs.writeFileSync(path, content, 'utf8');
