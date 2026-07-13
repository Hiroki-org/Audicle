// Create the mock function FIRST
const mockInitializeNewUser = jest.fn();

// Mock the module using the mock function
jest.mock("../../../lib/user-initialization", () => {
  return {
    __esModule: true,
    initializeNewUser: mockInitializeNewUser,
  };
});

let mockNextAuthImplementation: any;

jest.mock("next-auth", () => {
  return function NextAuth(config: any) {
    mockNextAuthImplementation = config;
    return {
      handlers: {},
      auth: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
    };
  };
});

jest.mock("next-auth/providers/google", () => {
  return jest.fn().mockReturnValue({ id: "google", type: "oauth" });
});

jest.mock("next-auth/providers/credentials", () => {
  return jest.fn().mockImplementation((config) => ({
    id: config.id || "credentials",
    type: "credentials",
    ...config,
  }));
});


describe("lib/auth.ts", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
    jest.clearAllMocks();

    // Default mock setup for successful scenarios
    mockInitializeNewUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const getAuthConfig = () => {
    require("../../../lib/auth");
    return mockNextAuthImplementation;
  };

  it("should initialize NextAuth with correct providers and callbacks", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.AUTH_ENV = "production";

    const config = getAuthConfig();

    expect(config.providers).toHaveLength(1); // Default is just Google
    expect(config.pages.signIn).toBe("/auth/signin");
  });

  describe("Credentials Provider (AUTH_ENV=test)", () => {
    it("should include CredentialsProvider when AUTH_ENV is 'test'", () => {
      process.env.AUTH_ENV = "test";
      const config = getAuthConfig();
      expect(config.providers).toHaveLength(2); // Google + Credentials
    });

    it("should authenticate correctly with valid test credentials", async () => {
      process.env.AUTH_ENV = "test";
      process.env.TEST_USER_EMAIL = "valid@example.com";
      process.env.TEST_USER_PASSWORD = "validpassword";

      const config = getAuthConfig();
      const credentialsProvider = config.providers.find(
        (p: any) => p.id === "test-credentials"
      );

      const result = await credentialsProvider.authorize({
        email: "valid@example.com",
        password: "validpassword",
      });

      expect(result).toEqual({
        id: "test-user-id-123",
        name: "Test User",
        email: "valid@example.com",
      });
    });

    it("should return correct credentials when TEST_USER_EMAIL/TEST_USER_PASSWORD are not set in debug mode", async () => {
      process.env.AUTH_ENV = "test";
      process.env.NODE_ENV = "development";
      delete process.env.TEST_USER_EMAIL;
      delete process.env.TEST_USER_PASSWORD;

      const config = getAuthConfig();
      const credentialsProvider = config.providers.find(
        (p: any) => p.id === "test-credentials"
      );

      // It defaults to test@example.com / password
      const result = await credentialsProvider.authorize({
        email: "test@example.com",
        password: "password",
      });

      expect(result).toEqual({
        id: "test-user-id-123",
        name: "Test User",
        email: undefined,
      });
    });

    it("should return null on invalid credentials in debug mode", async () => {
      process.env.AUTH_ENV = "test";
      process.env.NODE_ENV = "development";
      delete process.env.TEST_USER_EMAIL;
      delete process.env.TEST_USER_PASSWORD;

      const config = getAuthConfig();
      const credentialsProvider = config.providers.find(
        (p: any) => p.id === "test-credentials"
      );

      // It defaults to test@example.com / password
      const result = await credentialsProvider.authorize({
        email: "wrong@example.com",
        password: "password",
      });

      expect(result).toBeNull();
    });

    it("should reject invalid test credentials", async () => {
      process.env.AUTH_ENV = "test";
      process.env.TEST_USER_EMAIL = "valid@example.com";
      process.env.TEST_USER_PASSWORD = "validpassword";

      const config = getAuthConfig();
      const credentialsProvider = config.providers.find(
        (p: any) => p.id === "test-credentials"
      );

      const result = await credentialsProvider.authorize({
        email: "wrong@example.com",
        password: "wrongpassword",
      });

      expect(result).toBeNull();
    });
  });

  describe("Callbacks", () => {
    beforeEach(() => {
      process.env.ALLOWED_USERS = "user1@example.com, user2@example.com";
    });

    describe("signIn", () => {
      it("should allow test user and skip whitelist when AUTH_ENV is test", async () => {
        process.env.AUTH_ENV = "test";
        process.env.NODE_ENV = "development"; // test IS_DEBUG branch
        const config = getAuthConfig();

        const result = await config.callbacks.signIn({
          user: { id: "test-user-id-123", email: "test@test.com" },
        });

        expect(result).toBe(true);
        expect(mockInitializeNewUser).toHaveBeenCalledWith(
          "test-user-id-123",
          "test@test.com"
        );
      });

      it("should reject sign in if email is not provided", async () => {
        const config = getAuthConfig();
        await expect(
          config.callbacks.signIn({ user: {} })
        ).rejects.toThrow("NO_EMAIL: メールアドレスが取得できませんでした");
      });

      it("should allow sign in for allowed users", async () => {
        const config = getAuthConfig();
        const result = await config.callbacks.signIn({
          user: { email: "user1@example.com" },
        });
        expect(result).toBe(true);
      });

      it("should reject sign in for unauthorized users", async () => {
        const config = getAuthConfig();
        await expect(
          config.callbacks.signIn({
            user: { email: "unauthorized@example.com" },
          })
        ).rejects.toThrow("ACCESS_DENIED: unauthorized@example.com");
      });

      it("should handle debug logs for unauthorized users", async () => {
        process.env.NODE_ENV = "development";
        const config = getAuthConfig();
        await expect(
          config.callbacks.signIn({
            user: { email: "unauthorized@example.com" },
          })
        ).rejects.toThrow("ACCESS_DENIED: unauthorized@example.com");
      });
    });

    describe("jwt", () => {
      it("should set token.id from profile.sub", async () => {
        const config = getAuthConfig();
        const result = await config.callbacks.jwt({
          token: {},
          account: { providerAccountId: "provider-123" },
          profile: { sub: "sub-123", email: "test@example.com" },
        });

        expect(result.id).toBe("sub-123");
        expect(mockInitializeNewUser).toHaveBeenCalledWith(
          "sub-123",
          "test@example.com"
        );
      });

      it("should set token.id from account.providerAccountId if profile.sub is missing", async () => {
        const config = getAuthConfig();
        const result = await config.callbacks.jwt({
          token: {},
          account: { providerAccountId: "provider-123" },
          profile: { email: "test@example.com" },
        });

        expect(result.id).toBe("provider-123");
        expect(mockInitializeNewUser).toHaveBeenCalledWith(
          "provider-123",
          "test@example.com"
        );
      });

      it("should handle profile with missing email", async () => {
        const config = getAuthConfig();
        const result = await config.callbacks.jwt({
          token: {},
          account: { providerAccountId: "provider-123" },
          profile: {},
        });

        expect(result.id).toBe("provider-123");
        expect(mockInitializeNewUser).toHaveBeenCalledWith(
          "provider-123",
          ""
        );
      });

      it("should handle profile without account", async () => {
        const config = getAuthConfig();
        const result = await config.callbacks.jwt({
          token: { id: "existing-id" },
        });

        expect(result.id).toBe("existing-id");
        expect(mockInitializeNewUser).toHaveBeenCalledWith(
          "existing-id",
          ""
        );
      });
    });

    describe("session", () => {
      it("should set session.user.id from token.id", async () => {
        const config = getAuthConfig();
        const result = await config.callbacks.session({
          session: { user: {} },
          token: { id: "token-123" },
        });

        expect(result.user.id).toBe("token-123");
      });

      it("should throw error if token.id is not a string", async () => {
        const config = getAuthConfig();
        await expect(
          config.callbacks.session({
            session: { user: {} },
            token: { id: 123 }, // not a string
          })
        ).rejects.toThrow("User ID not found in token.");
      });

      it("should return unmodified session if session.user is falsy", async () => {
        const config = getAuthConfig();
        const session = { some: "data" };
        const result = await config.callbacks.session({
          session,
          token: { id: "token-123" },
        });

        expect(result).toEqual(session);
      });
    });
  });
});
