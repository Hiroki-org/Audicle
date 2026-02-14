import { jest } from '@jest/globals';

// Setup Mocks
const mockAuthorize = jest.fn();

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

// We need to capture the authorize function from config passed to CredentialsProvider
jest.mock("next-auth/providers/credentials", () => {
    return {
        __esModule: true,
        default: jest.fn((config: any) => {
            if (config.id === 'test-credentials') {
                // If it has authorize function, capture it for testing
                if (config.authorize) {
                    mockAuthorize.mockImplementation(config.authorize);
                }
                return {
                    id: "test-credentials",
                    name: "Test Credentials",
                    type: "credentials",
                    authorize: config.authorize, // Expose authorize
                    ...config
                };
            }
            return { id: "other", type: "credentials" };
        })
    };
});

jest.mock("../user-initialization", () => ({
    initializeNewUser: jest.fn().mockResolvedValue({ success: true }),
}));

describe("Auth Security Configuration", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        mockAuthorize.mockReset();
        // Clear module mocks
        require("next-auth").default.mockClear();
        require("next-auth/providers/credentials").default.mockClear();
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    test("CredentialsProvider is ENABLED when AUTH_ENV=test (even in production)", async () => {
        // Setup state where we want providers enabled for CI
        process.env.NODE_ENV = 'production';
        process.env.AUTH_ENV = 'test';
        process.env.GOOGLE_CLIENT_ID = 'mock-id';
        process.env.GOOGLE_CLIENT_SECRET = 'mock-secret';

        const NextAuth = require("next-auth").default;
        await import("../auth");

        const config = NextAuth.mock.calls[0][0];
        const providers = config.providers;

        const hasCredentials = providers.some((p: any) => p.id === 'test-credentials');

        // Should be enabled now (reverted behavior)
        expect(hasCredentials).toBe(true);
    });

    test("SECURITY: authorize callback BLOCKS external requests in production", async () => {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_ENV = 'test';
        process.env.TEST_USER_EMAIL = 'test@example.com';
        process.env.TEST_USER_PASSWORD = 'password';

        // Re-import to trigger setup
        require("next-auth").default;
        await import("../auth");

        const credentials = {
            email: 'test@example.com',
            password: 'password'
        };

        const mockRequest = {
            headers: new Headers({
                'host': 'evil-external.com'
            })
        };

        // Call the captured authorize function
        // Note: mockAuthorize should have been called/set up by the import
        const result = await mockAuthorize(credentials, mockRequest);

        // Should be blocked (return null)
        expect(result).toBeNull();
    });

    test("FUNCTIONALITY: authorize callback ALLOWS localhost requests in production (CI support)", async () => {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_ENV = 'test';
        process.env.TEST_USER_EMAIL = 'test@example.com';
        process.env.TEST_USER_PASSWORD = 'password';

        require("next-auth").default;
        await import("../auth");

        const credentials = {
            email: 'test@example.com',
            password: 'password'
        };

        // Simulate localhost request (CI environment)
        const mockRequest = {
            headers: new Headers({
                'host': 'localhost:3000'
            })
        };

        const result = await mockAuthorize(credentials, mockRequest);

        // Should be allowed
        expect(result).toEqual({
            id: 'test-user-id-123',
            name: 'Test User',
            email: 'test@example.com',
        });
    });

    test("FUNCTIONALITY: authorize callback ALLOWS requests in development/test without host check", async () => {
        process.env.NODE_ENV = 'development'; // Not production
        process.env.AUTH_ENV = 'test';
        process.env.TEST_USER_EMAIL = 'test@example.com';
        process.env.TEST_USER_PASSWORD = 'password';

        require("next-auth").default;
        await import("../auth");

        const credentials = {
            email: 'test@example.com',
            password: 'password'
        };

        // Request host shouldn't matter here
        const mockRequest = {
            headers: new Headers({
                'host': 'any-host.com'
            })
        };

        const result = await mockAuthorize(credentials, mockRequest);

        // Should succeed
        expect(result).not.toBeNull();
    });

    test("FUNCTIONALITY: authorize callback ALLOWS [::1] requests in production (IPv6 loopback)", async () => {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_ENV = 'test';
        process.env.TEST_USER_EMAIL = 'test@example.com';
        process.env.TEST_USER_PASSWORD = 'password';

        require("next-auth").default;
        await import("../auth");

        const credentials = {
            email: 'test@example.com',
            password: 'password'
        };

        // Simulate IPv6 loopback request
        const mockRequest = {
            headers: new Headers({
                'host': '[::1]:3000'
            })
        };

        const result = await mockAuthorize(credentials, mockRequest);

        // Should be allowed (IPv6 loopback)
        expect(result).toEqual({
            id: 'test-user-id-123',
            name: 'Test User',
            email: 'test@example.com',
        });
    });
});
