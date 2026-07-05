const jwt = require("jsonwebtoken");

// NEXTAUTH_SECRETを使ってJWTを生成
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("NEXTAUTH_SECRET is not set");
}

const sub = process.env.TEST_USER_ID || "test-user-id-123";
const email = process.env.TEST_USER_EMAIL || "test@example.com";
const name = process.env.TEST_USER_NAME || "Test User";
const expiresInSeconds = parseInt(process.env.TEST_TOKEN_EXPIRES_IN_SECONDS || "3600", 10);

// テスト用のユーザーデータ
const testUser = {
  name,
  email,
  sub,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
};

// JWTを生成
const token = jwt.sign(testUser, secret, { algorithm: "HS256" });

console.log("⚠️ WARNING: This token is for testing purposes only. Do not use in production.");
console.log(`User: ${name} (${email}), ID: ${sub}`);
console.log(`Expires in: ${expiresInSeconds} seconds`);
console.log("\nGenerated JWT token:");
console.log(token);
console.log("\nAdd this to your .env.local as:");
console.log(`TEST_SESSION_TOKEN=${token}`);
