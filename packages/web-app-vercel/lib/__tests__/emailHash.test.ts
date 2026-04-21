import { hashEmail } from "../emailHash";
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

    // Re-import after env change
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
    process.env.CI = "false";
    delete process.env.TEST_SESSION_TOKEN;

    const { hashEmail } = require("../emailHash");

    expect(() => hashEmail("test@example.com")).toThrow(
      "EMAIL_HASH_SECRET must be set for security reasons.",
    );
  });

  it("uses TEST_EMAIL_HASH_SECRET when CI is true even if not in test environment", () => {
    delete process.env.EMAIL_HASH_SECRET;
    process.env.NODE_ENV = "production";
    process.env.CI = "true";
    process.env.TEST_EMAIL_HASH_SECRET = "ci-secret";
    const email = "test@example.com";

    const { hashEmail } = require("../emailHash");
    const expected = createHmac("sha256", "ci-secret")
      .update(email)
      .digest("hex");

    expect(hashEmail(email)).toBe(expected);
  });
});
