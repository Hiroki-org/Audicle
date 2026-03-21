const fs = require('fs');
const file = 'packages/web-app-vercel/lib/audioCache.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `    // キャッシュサイズ制限の確認 (LRU)
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        logger.cache("EVICT", \`LRU evicting \${oldestKey}\`);
        this.revoke(oldestKey);
      }
    }`,
  `    // Evict the oldest item only if the cache is full and we are adding a new item.
    if (!this.cache.has(key) && this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        logger.cache("EVICT", \`LRU evicting \${oldestKey}\`);
        this.revoke(oldestKey);
      }
    }

    // If updating an existing entry, delete it first to move it to the end for LRU.
    // This also ensures the old object URL is revoked.
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      URL.revokeObjectURL(oldEntry.url);
      this.cache.delete(key);
    }`
);

fs.writeFileSync(file, code);
