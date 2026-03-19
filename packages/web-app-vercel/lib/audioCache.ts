// 音声キャッシュ管理

import { synthesizeSpeech } from "./api";
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

  // キャッシュキーを生成（音声モデルと再生速度を含む）
  private getCacheKey(text: string, voiceModel: string = DEFAULT_VOICE, articleUrl?: string): string {
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
    forceRegenerate: boolean = false
  ): Promise<string> {
    const key = this.getCacheKey(text, voiceModel, articleUrl);

    // forceRegenerate フラグがある場合はキャッシュをスキップ
    if (!forceRegenerate) {
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
    logger.cache("MISS", `${text.substring(0, 30)}...`);
    const blob = await synthesizeSpeech(text, undefined, voiceModel, articleUrl);
    const url = URL.createObjectURL(blob);

    // キャッシュサイズ制限の確認 (LRU)
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        logger.cache("EVICT", `LRU evicting ${oldestKey}`);
        this.revoke(oldestKey);
      }
    }

    this.cache.set(key, {
      blob,
      url,
      timestamp: Date.now(),
    });

    logger.cache("STORE", key);
    return url;
  }

  // 複数の音声を先読み
  async prefetch(
    texts: string[],
    voiceModel: string = DEFAULT_VOICE,
    articleUrl?: string
  ): Promise<void> {
    logger.info(`🔄 先読み開始: ${texts.length}件`);

    const promises = texts.map(async (text) => {
      try {
        await this.get(text, voiceModel, articleUrl);
      } catch (error) {
        logger.error(`先読みエラー: ${text.substring(0, 30)}...`, error);
      }
    });

    await Promise.all(promises);
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
    logger.cache("CLEAR", "all");
  }
}

export const audioCache = new AudioCache();
