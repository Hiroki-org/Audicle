const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// NEXTAUTH_SECRETを使ってJWTを生成
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("NEXTAUTH_SECRET is not set");
}

// テスト用のユーザーデータ
const testUser = {
  name: "Test User",
  email: "test@example.com",
  sub: "test-user-id-123", // ユーザーID
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1年後に期限切れ
};

// JWTを生成
const token = jwt.sign(testUser, secret, { algorithm: "HS256" });

console.log("Generated JWT token:");
console.log(token);
console.log("\nAdd this to your .env.local as:");
console.log(`TEST_SESSION_TOKEN=${token}`);
