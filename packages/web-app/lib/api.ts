import {
  ExtractRequest,
  ExtractResponse,
  SynthesizeRequest,
} from "@/types/api";
import { logger } from "./logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

/**
 * URLから本文を抽出する
 */
export async function extractContent(url: string): Promise<ExtractResponse> {
  const request: ExtractRequest = { url };

  logger.apiRequest("POST", `${API_BASE_URL}/extract`, request);

  const response = await fetch(`${API_BASE_URL}/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(`抽出エラー: ${error}`);
    throw new Error(`抽出に失敗しました: ${error}`);
  }

  const data = await response.json();
  logger.apiResponse(`${API_BASE_URL}/extract`, data);

  return data;
}

/**
 * テキストを音声に変換する
 * @returns 音声データのBlobを返す
 */
export async function synthesizeSpeech(
  text: string,
  voice?: string
): Promise<Blob> {
  const request: SynthesizeRequest = { text };
  if (voice) {
    request.voice = voice;
  }

  logger.apiRequest("POST", `${API_BASE_URL}/synthesize`, {
    text: text.substring(0, 50) + "...",
    voice,
  });

  const response = await fetch(`${API_BASE_URL}/synthesize`, {
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

  const blob = await response.blob();
  logger.success(`音声合成完了: ${blob.size} bytes`);

  return blob;
}
