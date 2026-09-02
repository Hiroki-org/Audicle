/**
 * バイト数を人間が読みやすい形式に変換
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * タイムスタンプを日付文字列に変換
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * デバッグ用: テキストを指定した長さで安全に切り詰める
 */
export function truncateText(text: string | undefined, maxLength: number = 30): string | undefined {
  return text?.substring(0, maxLength);
}
