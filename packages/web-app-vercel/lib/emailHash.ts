import { createHmac } from "crypto";

/**
 * メールアドレスをHMAC-SHA256でハッシュ化（セキュアな実装）
 * ソルトを使用してレインボーテーブル攻撃に対抗
 */
export function hashEmail(email: string): string {
  const secret = process.env.EMAIL_HASH_SECRET;
  if (!secret) {
    // テスト環境、CI、または GitHub Actions で実行している場合は
    // テスト用環境変数を使用して処理を続行する
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.CI === "true" ||
      process.env.TEST_SESSION_TOKEN
    ) {
      const testSecret = process.env.TEST_EMAIL_HASH_SECRET;
      if (!testSecret) {
        throw new Error(
          "TEST_EMAIL_HASH_SECRET must be set for development/test runs.",
        );
      }
      return createHmac("sha256", testSecret).update(email).digest("hex");
    }
    throw new Error("EMAIL_HASH_SECRET must be set for security reasons.");
  }
  return createHmac("sha256", secret).update(email).digest("hex");
}
