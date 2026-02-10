import { jest } from '@jest/globals';

// Mock dependencies
jest.mock("next-auth", () => ({
    __esModule: true,
    default: jest.fn(() => ({
        handlers: {},
        auth: {},
        signIn: {},
        signOut: {}
    })),
}));

jest.mock("next-auth/providers/google", () => ({
    __esModule: true,
    default: jest.fn(() => ({ id: "google", name: "Google", type: "oauth" })),
}));

jest.mock("next-auth/providers/credentials", () => ({
    __esModule: true,
    default: jest.fn((config: any) => ({
        id: "test-credentials",
        name: "Test Credentials",
        type: "credentials",
        ...config
    })),
}));

jest.mock("../user-initialization", () => ({
    initializeNewUser: jest.fn().mockResolvedValue({ success: true }),
}));

describe("Auth Security Configuration", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        // Reset mocks
        require("next-auth").default.mockClear();
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    test("SECURITY FIX: CredentialsProvider is DISABLED when AUTH_ENV=test BUT NODE_ENV=production", async () => {
        // Setup vulnerable state attempt
        process.env.NODE_ENV = 'production';
        process.env.AUTH_ENV = 'test';
        process.env.GOOGLE_CLIENT_ID = 'mock-id';
        process.env.GOOGLE_CLIENT_SECRET = 'mock-secret';

        const NextAuth = require("next-auth").default;
        await import("../auth");

        const config = NextAuth.mock.calls[0][0];
        const providers = config.providers;

        const hasCredentials = providers.some((p: any) => p.id === 'test-credentials');

        // Should be disabled now
        expect(hasCredentials).toBe(false);
    });

    test("FUNCTIONALITY: CredentialsProvider is ENABLED when AUTH_ENV=test AND NODE_ENV=test", async () => {
        // Setup valid test state
        process.env.NODE_ENV = 'test';
        process.env.AUTH_ENV = 'test';
        process.env.GOOGLE_CLIENT_ID = 'mock-id';
        process.env.GOOGLE_CLIENT_SECRET = 'mock-secret';

        const NextAuth = require("next-auth").default;
        await import("../auth");

        const config = NextAuth.mock.calls[0][0];
        const providers = config.providers;

        const hasCredentials = providers.some((p: any) => p.id === 'test-credentials');

        // Should be enabled
        expect(hasCredentials).toBe(true);
    });

    test("FUNCTIONALITY: CredentialsProvider is ENABLED when AUTH_ENV=test AND NODE_ENV=development", async () => {
        // Setup valid dev state
        process.env.NODE_ENV = 'development';
        process.env.AUTH_ENV = 'test';
        process.env.GOOGLE_CLIENT_ID = 'mock-id';
        process.env.GOOGLE_CLIENT_SECRET = 'mock-secret';

        const NextAuth = require("next-auth").default;
        await import("../auth");

        const config = NextAuth.mock.calls[0][0];
        const providers = config.providers;

        const hasCredentials = providers.some((p: any) => p.id === 'test-credentials');

        // Should be enabled
        expect(hasCredentials).toBe(true);
    });
});
