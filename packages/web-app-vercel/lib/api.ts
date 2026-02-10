'use client';

import {
  ExtractRequest,
  ExtractResponse,
  SynthesizeRequest,
} from "@/types/api";
import { logger } from "./logger";

// ============================================================================
// エラーハンドリングユーティリティ
// ============================================================================

/**
 * APIエラーレスポンスからエラーメッセージを抽出する
 * JSONレスポンスの場合は `error` フィールドを使用し、
 * そうでない場合はデフォルトメッセージまたは元のテキストを返す
 */
export function parseApiErrorMessage(
  errorText: string,
  defaultMessage?: string
): string {
  try {
    const errorJson = JSON.parse(errorText);
    if (errorJson.error) {
      return errorJson.error;
    }
  } catch {
    // JSON parse failed
  }
  return defaultMessage || errorText;
}

// ============================================================================
// Pending Map: 進行中のリクエストを管理（重複リクエスト対策）
// ============================================================================

const pendingRequests = new Map<string, Promise<Blob>>();

/**
 * テキスト＋音声パラメータから統合キーを生成
 */
function getPendingKey(
  text: string,
  voice?: string,
  voiceModel?: string,
  articleUrl?: string
): string {
  const voiceParam = voice ?? voiceModel ?? "default";
  const articleParam = articleUrl ? `_${articleUrl}` : "";
  return `${text}_${voiceParam}${articleParam}`;
}

/**
 * URLから本文を抽出する
 */
export async function extractContent(url: string): Promise<ExtractResponse> {
  const request: ExtractRequest = { url };

  logger.apiRequest("POST", "/api/extract", request);

  const response = await fetch("/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = parseApiErrorMessage(errorText);
    logger.error(`抽出エラー: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  logger.apiResponse("/api/extract", data);

  return data;
}

/**
 * 実際の TTS API へのリクエストを行う（内部用）
 * @returns 音声データのBlobを返す
 */
async function fetchTTSFromAPI(
  text: string,
  voice?: string,
  voiceModel?: string,
  articleUrl?: string
): Promise<Blob> {
  const request: SynthesizeRequest = { text };
  if (voice) {
    request.voice = voice;
  }
  if (voiceModel) {
    request.voice_model = voiceModel;
  }
  if (articleUrl) {
    request.articleUrl = articleUrl;
  }
  // playbackSpeedはフロントエンドでの再生速度制御用なのでAPIには渡さない

  logger.apiRequest("POST", "/api/synthesize", {
    textPreview: `${text.substring(0, 50)}...`,
    voice,
    voiceModel,
    articleUrl,
    hasArticleUrl: Boolean(articleUrl),
  });

  const response = await fetch("/api/synthesize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(`音声合成エラー: ${error}`);
    throw new Error(`音声合成に失敗しました: ${error}`);
  }

  const data = await response.json();

  // base64エンコードされた音声データをBlobに変換
  const audioData = data.audio;
  const binaryString = atob(audioData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  logger.success(`音声合成完了: ${blob.size} bytes`);

  return blob;
}

/**
 * Pending Map を考慮した音声取得関数
 * 
 * 1. 進行中リクエスト確認
 * 2. 新規 HTTP リクエスト発行
 */
async function getAudio(
  text: string,
  voice?: string,
  voiceModel?: string,
  articleUrl?: string
): Promise<Blob> {
  // キャッシュキーを生成
  const key = getPendingKey(text, voice, voiceModel, articleUrl);

  // 1. 進行中リクエストがあればそれを返す
  if (pendingRequests.has(key)) {
    logger.pending(`リクエスト待機: ${text.substring(0, 30)}...`);
    return pendingRequests.get(key)!;
  }

  // 2. 新規リクエスト
  const promise = fetchTTSFromAPI(text, voice, voiceModel, articleUrl)
    .finally(() => {
      // 完了後にMapから削除
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * 公開API: テキストを音声に変換する（Pending Map 対応）
 * @returns 音声データのBlobを返す
 */
export async function synthesizeSpeech(
  text: string,
  voice?: string,
  voiceModel?: string,
  articleUrl?: string
): Promise<Blob> {
  // Pending Map を経由してリクエストを管理
  return getAudio(text, voice, voiceModel, articleUrl);
}
