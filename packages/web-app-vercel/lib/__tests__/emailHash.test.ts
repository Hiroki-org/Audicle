import { createHmac } from "crypto";

describe("hashEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses EMAIL_HASH_SECRET when provided", () => {
    process.env.EMAIL_HASH_SECRET = "prod-secret";
    const email = "test@example.com";

    const { hashEmail } = require("../emailHash");
    const expected = createHmac("sha256", "prod-secret")
      .update(email)
      .digest("hex");

    expect(hashEmail(email)).toBe(expected);
  });

  it("uses TEST_EMAIL_HASH_SECRET when in test environment and EMAIL_HASH_SECRET is missing", () => {
    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "test";
    process.env.TEST_EMAIL_HASH_SECRET = "test-secret";
    const email = "test@example.com";

    const { hashEmail } = require("../emailHash");
    const expected = createHmac("sha256", "test-secret")
      .update(email)
      .digest("hex");

    expect(hashEmail(email)).toBe(expected);
  });

  it("throws error when TEST_EMAIL_HASH_SECRET is missing in test environment", () => {
    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "test";
    delete process.env.TEST_EMAIL_HASH_SECRET;

    const { hashEmail } = require("../emailHash");

    expect(() => hashEmail("test@example.com")).toThrow(
      "TEST_EMAIL_HASH_SECRET must be set for development/test runs.",
    );
  });

  it("throws error when EMAIL_HASH_SECRET is missing in production environment", () => {
    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.TEST_SESSION_TOKEN;

    const { hashEmail } = require("../emailHash");

    expect(() => hashEmail("test@example.com")).toThrow(
      "EMAIL_HASH_SECRET must be set for security reasons.",
    );
  });

  it("throws error in production even when CI is true if EMAIL_HASH_SECRET is missing", () => {
    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "production";
    process.env.CI = "true";

    const { hashEmail } = require("../emailHash");

    expect(() => hashEmail("test@example.com")).toThrow(
      "EMAIL_HASH_SECRET must be set for security reasons.",
    );
  });

  it("uses TEST_EMAIL_HASH_SECRET in development environment", () => {
    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "development";
    process.env.TEST_EMAIL_HASH_SECRET = "dev-secret";
    const email = "test@example.com";

    const { hashEmail } = require("../emailHash");
    const expected = createHmac("sha256", "dev-secret")
      .update(email)
      .digest("hex");

    expect(hashEmail(email)).toBe(expected);
  });
});
