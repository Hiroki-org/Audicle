// 音声キャッシュ管理

import { synthesizeSpeech, synthesizeSpeechBulk } from "./api";
import { logger } from "./logger";

interface CacheEntry {
  blob: Blob;
  url: string;
  timestamp: number;
}

const CACHE_PREFIX = "audio_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24時間
const DEFAULT_VOICE = "ja-JP-Wavenet-B";
const MAX_CACHE_SIZE = 50; // キャッシュする最大アイテム数

export class AudioCache {
  private cache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<string>>();

  // キャッシュキーを生成（音声モデルと再生速度を含む）
  private getCacheKey(
    text: string,
    voiceModel: string = DEFAULT_VOICE,
    articleUrl?: string,
  ): string {
    const articleParam = articleUrl ? `_${articleUrl}` : "";
    return `${CACHE_PREFIX}${this.hashString(text)}_${voiceModel}${articleParam}`;
  }

  // 簡単なハッシュ関数
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  // 音声を取得（キャッシュがあればそれを、なければ合成）
  async get(
    text: string,
    voiceModel: string = DEFAULT_VOICE,
    articleUrl?: string,
    forceRegenerate: boolean = false,
  ): Promise<string> {
    const key = this.getCacheKey(text, voiceModel, articleUrl);

    // forceRegenerate フラグがある場合はキャッシュをスキップ
    if (!forceRegenerate) {
      const inFlight = this.inFlightRequests.get(key);
      if (inFlight) {
        logger.cache("WAIT", `${text.substring(0, 30)}...`);
        return inFlight;
      }

      // キャッシュチェック
      const cached = this.cache.get(key);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_EXPIRY) {
          logger.cache("HIT", `${text.substring(0, 30)}...`);

          // blob URL は再生成して返す（以前の URL が revoke 済みでも再生可能にする）
          if (cached.url.startsWith("blob:")) {
            URL.revokeObjectURL(cached.url);
          }
          const freshUrl = URL.createObjectURL(cached.blob);

          // LRU戦略: 古いエントリを削除して最後に再追加することで最新にする
          this.cache.delete(key);
          this.cache.set(key, {
            ...cached,
            url: freshUrl,
            timestamp: Date.now(),
          });
          return freshUrl;
        } else {
          // 期限切れのキャッシュを削除
          this.revoke(key);
        }
      }
    } else {
      logger.info("🔄 強制再生成モード", { text: text.substring(0, 30) });
    }

    // キャッシュミス - 新規合成
    const request = this.synthesizeAndStore(
      key,
      text,
      voiceModel,
      articleUrl,
    );
    if (!forceRegenerate) {
      this.inFlightRequests.set(key, request);
    }

    try {
      return await request;
    } finally {
      if (this.inFlightRequests.get(key) === request) {
        this.inFlightRequests.delete(key);
      }
    }
  }

  private async synthesizeAndStore(
    key: string,
    text: string,
    voiceModel: string,
    articleUrl?: string,
  ): Promise<string> {
    logger.cache("MISS", `${text.substring(0, 30)}...`);
    const blob = await synthesizeSpeech(
      text,
      undefined,
      voiceModel,
      articleUrl,
    );
    const url = URL.createObjectURL(blob);

    // Evict the oldest item only if the cache is full and we are adding a new item.
    if (!this.cache.has(key) && this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        logger.cache("EVICT", `LRU evicting ${oldestKey}`);
        this.revoke(oldestKey);
      }
    }

    // If updating an existing entry, delete it first to move it to the end for LRU.
    // This also ensures the old object URL is revoked.
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      URL.revokeObjectURL(oldEntry.url);
      this.cache.delete(key);
    }

    this.cache.set(key, {
      blob,
      url,
      timestamp: Date.now(),
    });

    logger.cache("STORE", key);
    return url;
  }

    // 複数の音声を一括で先読み（APIを一括呼び出し）
  async prefetch(
    texts: string[],
    voiceModel: string = DEFAULT_VOICE,
    articleUrl?: string,
  ): Promise<void> {
    logger.info(`🔄 先読み開始: ${texts.length}件`);

    if (texts.length === 0) return;

    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    const keys: string[] = [];
    const resolveFns: ((_url: string) => void)[] = [];
    const rejectFns: ((_err: any) => void)[] = [];
    const waitPromises: Promise<any>[] = [];

    // 1. キャッシュチェック
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const key = this.getCacheKey(text, voiceModel, articleUrl);
      keys.push(key);

      const inFlight = this.inFlightRequests.get(key);
      if (inFlight) {
        waitPromises.push(inFlight.catch(e => {
          logger.error(`先読みエラー(待機中): ${text.substring(0, 30)}...`, e);
        }));
        continue;
      }

      const cached = this.cache.get(key);
      let isCached = false;
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_EXPIRY) {
          isCached = true;
          logger.cache("HIT", `${text.substring(0, 30)}...`);
        }
      }

      if (!isCached) {
        uncachedTexts.push(text);
        uncachedIndices.push(i);

        const promise = new Promise<string>((resolve, reject) => {
          resolveFns.push(resolve);
          rejectFns.push(reject);
        });

        waitPromises.push(promise.catch(e => {
          logger.error(`先読みエラー: ${text.substring(0, 30)}...`, e);
        }));

        this.inFlightRequests.set(key, promise);
      }
    }

    // 2. 未キャッシュのテキストがあれば一括リクエスト
    if (uncachedTexts.length > 0) {
      // 非同期で一括リクエストを開始
      const bulkFetch = async () => {
        try {
          const blobs = await synthesizeSpeechBulk(uncachedTexts, undefined, voiceModel, articleUrl);

          // 3. 結果をキャッシュに保存
          for (let j = 0; j < uncachedTexts.length; j++) {
            const key = keys[uncachedIndices[j]];
            const blob = blobs[j];

            if (!blob) {
              rejectFns[j](new Error("Missing blob in response"));
              this.inFlightRequests.delete(key);
              continue;
            }

            const url = URL.createObjectURL(blob);

            if (!this.cache.has(key) && this.cache.size >= MAX_CACHE_SIZE) {
              const oldestKey = this.cache.keys().next().value;
              if (oldestKey) {
                logger.cache("EVICT", `LRU evicting ${oldestKey}`);
                this.revoke(oldestKey);
              }
            }

            const oldEntry = this.cache.get(key);
            if (oldEntry) {
              URL.revokeObjectURL(oldEntry.url);
              this.cache.delete(key);
            }

            this.cache.set(key, {
              blob,
              url,
              timestamp: Date.now(),
            });

            logger.cache("STORE", key);
            resolveFns[j](url);
            this.inFlightRequests.delete(key);
          }
        } catch (error) {
          logger.error(`一括先読みエラー: ${uncachedTexts.length}件`, error);
          for (let j = 0; j < uncachedTexts.length; j++) {
            const key = keys[uncachedIndices[j]];
            this.inFlightRequests.delete(key);
            rejectFns[j](error);
          }
        }
      };

      bulkFetch();
    }

    await Promise.all(waitPromises);
    logger.success(`✅ 先読み完了: ${texts.length}件`);
  }

  // URL を解放
  private revoke(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      URL.revokeObjectURL(entry.url);
      this.cache.delete(key);
      logger.cache("REVOKE", key);
    }
  }

  // すべてのキャッシュをクリア
  clear(): void {
    this.cache.forEach((entry) => {
      URL.revokeObjectURL(entry.url);
    });
    this.cache.clear();
    this.inFlightRequests.clear();
    logger.cache("CLEAR", "all");
  }
}

export const audioCache = new AudioCache();
