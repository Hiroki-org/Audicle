/**
 * 段落パーサー
 * HTMLから段落単位でテキストを抽出し、各段落に情報を付与する
 */

import { detectLanguage, type DetectedLanguage } from './languageDetector';

export interface Paragraph {
  id: string; // 段落ID（連番）
  type: string; // 要素タイプ（p, h1, h2, li等）
  originalText: string; // 元のテキスト（表示用）
  cleanedText: string; // クリーンアップ済みテキスト（TTS送信用）
  isSplitChunk?: boolean; // true の場合、元の段落が分割されたもの
}

export interface ParseResult {
  paragraphs: Paragraph[];
  detectedLanguage: DetectedLanguage;
}

// Google Cloud TTS APIの最大リクエストバイト数
const MAX_TTS_BYTES = 5000;
// 安全マージンを設けた上限（日本語の文字境界問題を考慮）
const SAFE_MAX_TTS_BYTES = 4800;

/**
 * テキストのUTF-8バイトサイズを計算する
 */
function getByteSize(text: string): number {
  return Buffer.byteLength(text, 'utf-8');
}

/**
 * 分割文字の優先順位
 * 1. 句点: 。 ．
 * 2. 読点: 、 ，
 * 3. 英語ピリオド・カンマ: . ,
 */
const SPLIT_DELIMITERS = [
  ['。', '．'],           // 句点（最優先）
  ['、', '，'],           // 読点
  ['.', ','],            // 英語ピリオド・カンマ
];

/**
 * 指定された区切り文字でテキストを分割し、区切り文字を前のチャンクに含める
 */
function splitByDelimiters(text: string, delimiters: string[]): string[] {
  const pattern = new RegExp(`([${delimiters.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}])`, 'g');
  const parts = text.split(pattern);

  // 区切り文字を前の要素に結合
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && delimiters.includes(parts[i])) {
      // 区切り文字を前の要素に追加
      result[result.length - 1] += parts[i];
    } else if (parts[i]) {
      result.push(parts[i]);
    }
  }

  return result;
}

/**
 * テキストを指定バイトサイズ以下に分割する（再帰的処理）
 * @param text 分割対象のテキスト
 * @param maxBytes 最大バイトサイズ
 * @returns 分割されたテキストの配列
 */
function splitTextByByteSize(text: string, maxBytes: number = SAFE_MAX_TTS_BYTES): string[] {
  const byteSize = getByteSize(text);

  // バイトサイズが制限内なら分割不要
  if (byteSize <= maxBytes) {
    return [text];
  }

  // 優先順位に従って分割を試みる
  for (const delimiters of SPLIT_DELIMITERS) {
    const parts = splitByDelimiters(text, delimiters);

    // 分割できた場合
    if (parts.length > 1) {
      const result: string[] = [];
      let currentChunk = '';
      let currentChunkBytes = 0;

      for (const part of parts) {
        const partBytes = getByteSize(part);

        if (currentChunkBytes + partBytes <= maxBytes) {
          currentChunk += part;
          currentChunkBytes += partBytes;
        } else {
          // 現在のチャンクを保存
          if (currentChunk) {
            result.push(currentChunk);
          }

          // partが単体でも大きすぎる場合は再帰的に分割
          if (partBytes > maxBytes) {
            const subParts = splitTextByByteSize(part, maxBytes);
            result.push(...subParts);
            currentChunk = '';
            currentChunkBytes = 0;
          } else {
            currentChunk = part;
            currentChunkBytes = partBytes;
          }
        }
      }

      // 残りのチャンクを追加
      if (currentChunk) {
        result.push(currentChunk);
      }

      return result;
    }
  }

  // どの区切り文字でも分割できなかった場合：文字数で強制分割（フォールバック）
  return forceSplitByBytes(text, maxBytes);
}

/**
 * 文字数で強制分割（フォールバック）
 * UTF-8のバイト境界を考慮して分割する
 */
function forceSplitByBytes(text: string, maxBytes: number): string[] {
  const result: string[] = [];
  let start = 0;

  while (start < text.length) {
    // 最大文字数を見積もる（UTF-8では1文字が最大4バイトを占める可能性があるため、安全のため4で割る）
    let end = start + Math.floor(maxBytes / 4);

    // 実際のバイトサイズを確認しながら調整
    while (end > start && getByteSize(text.slice(start, end)) > maxBytes) {
      end--;
    }

    // 最低1文字は含める
    if (end === start) {
      end = start + 1;
    }

    result.push(text.slice(start, end));
    start = end;
  }

  return result;
}

/**
 * 段落配列に対してチャンクリサイズを適用する
 * 5000バイトを超えるチャンクを適切に分割する
 */
export function resizeChunksIfNeeded(paragraphs: Paragraph[]): Paragraph[] {
  const result: Paragraph[] = [];
  let idCounter = 0;

  for (const para of paragraphs) {
    const cleanedByteSize = getByteSize(para.cleanedText);

    if (cleanedByteSize <= SAFE_MAX_TTS_BYTES) {
      // サイズが制限内ならそのまま追加（IDは再採番）
      result.push({
        ...para,
        id: `para-${idCounter++}`,
        isSplitChunk: false,
      });
    } else {
      // サイズ超過：分割処理
      const splitTexts = splitTextByByteSize(para.cleanedText, SAFE_MAX_TTS_BYTES);

      for (let i = 0; i < splitTexts.length; i++) {
        result.push({
          id: `para-${idCounter++}`,
          type: para.type,
          // 分割されたチャンクでは、originalTextとcleanedTextの正確な対応を維持するのが困難です。
          // 表示の整合性を保つため、cleanedTextをoriginalTextとしても使用します。
          originalText: splitTexts[i],
          cleanedText: splitTexts[i],
          isSplitChunk: true,
        });
      }
    }
  }

  return result;
}

/**
 * HTMLからテキストを抽出し、段落単位で分割する
 * 
 * Readabilityが抽出した本文をTreeWalkerで走査し、
 * ブロック要素単位でテキストを抽出する。
 * blockquote内の要素は重複を避けるため特別処理する。
 * 
 * @param htmlContent Readability.jsの.contentで取得したHTML文字列
 * @returns 段落情報の配列
 */
export function parseHTMLToParagraphs(htmlContent: string): ParseResult {
  // DOMパーサーを使用してHTMLを解析
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const paragraphs: Paragraph[] = [];
  let idCounter = 0;

  // ブロック要素のセレクタ
  const blockSelectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'pre', 'td', 'th', 'figcaption', 'blockquote'
  ];

  // すべての対象要素を順番に処理
  const elements = doc.querySelectorAll(blockSelectors.join(','));

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    // blockquote内の子要素はblockquoteとして既に処理されるためスキップ
    if (tagName !== 'blockquote' && element.closest('blockquote')) {
      return;
    }

    // 入れ子のli（サブリスト）の親liは子のliで処理されるためスキップ
    if (tagName === 'li') {
      const nestedLi = element.querySelector('li');
      if (nestedLi) {
        // このliは子liを持つので、直接のテキストノードのみ抽出
        const directText = Array.from(element.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent?.trim())
          .filter(Boolean)
          .join(' ');
        if (directText) {
          paragraphs.push({
            id: `para-${idCounter++}`,
            type: tagName,
            originalText: directText,
            cleanedText: cleanText(directText),
          });
        }
        return;
      }
    }

    const text = element.textContent?.trim() || '';

    // 空の要素はスキップ
    if (!text) return;

    paragraphs.push({
      id: `para-${idCounter++}`,
      type: tagName,
      originalText: text,
      cleanedText: cleanText(text),
    });
  });

  // ブロック要素が見つからない場合は、body全体のテキストを1つの段落として返す
  if (paragraphs.length === 0) {
    const bodyText = doc.body.textContent?.trim() || '';
    if (bodyText) {
      paragraphs.push({
        id: `para-${idCounter++}`,
        type: 'p',
        originalText: bodyText,
        cleanedText: cleanText(bodyText),
      });
    }
  }

  // チャンクリサイズを適用（5000バイト超過チャンクを分割）
  const resized = resizeChunksIfNeeded(paragraphs);

  const fullText = resized
    .filter((p) => p.type !== 'pre') // コードブロック(pre)を言語検出から除外
    .map((p) => p.cleanedText)
    .join(' ');
  const detectedLanguage = detectLanguage(fullText);

  return { paragraphs: resized, detectedLanguage };
}

/**
 * テキストをクリーンアップする（TTS送信用）
 * - Markdown記法を削除
 * - HTML実体参照を変換
 * - 連続空白を正規化
 * - URLを短縮
 * - 前後の空白をトリム
 */
function cleanText(text: string): string {
  let cleaned = text;

  // HTML実体参照を変換
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'");

  // Markdown記法を削除
  // 太字: **text** or __text__
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');

  // 斜体: *text* or _text_
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');

  // 打ち消し: ~~text~~
  cleaned = cleaned.replace(/~~(.+?)~~/g, '$1');

  // インラインコード: `code`
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');

  // 見出し: # text
  cleaned = cleaned.replace(/^#+\s+/gm, '');

  // リンク: [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // URL短縮: https://example.com/path/to/page -> example.com
  cleaned = cleaned.replace(/https?:\/\/([^\/\s]+)([^\s]*)/g, (match, domain) => {
    return domain; // ドメイン名のみ残す
  });

  // 連続空白を1つに正規化
  cleaned = cleaned.replace(/\s+/g, ' ');

  // 前後の空白をトリム
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * ポーズが必要な段落タイプかどうか判定
 */
export function needsPauseBefore(type: string): boolean {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(type);
}

export function needsPauseAfter(type: string): boolean {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(type);
}

/**
 * ポーズ時間を取得（ミリ秒）
 */
export function getPauseDuration(type: 'heading' | 'paragraph'): number {
  if (type === 'heading') {
    return 500; // 見出しの前後: 500ms
  }
  return 300; // 段落間: 300ms
}
