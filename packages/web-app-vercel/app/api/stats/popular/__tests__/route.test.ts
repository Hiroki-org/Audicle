
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Mock auth
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

// Mock Supabase chain
const mockSelect = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockGte = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockQueryObj = {
    select: mockSelect,
    order: mockOrder,
    limit: mockLimit,
    gte: mockGte,
    eq: mockEq,
    then: jest.fn(), // Make it a thenable to mock await
};

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => mockQueryObj),
    },
}));

describe('GET /api/stats/popular', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock default successful query resolution
        mockQueryObj.then.mockImplementation((resolve) => {
            resolve({ data: [], error: null });
        });

        // Setup mock request
        const url = new URL('http://localhost/api/stats/popular');
        mockRequest = new NextRequest(url);

        // Mock Date for deterministic tests
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-10-15T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const res = await GET(mockRequest);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 when user email is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '123' } });

        const res = await GET(mockRequest);
        expect(res.status).toBe(401);
    });

    it('returns 200 with default parameters (week, limit 20)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        const mockData = [
            {
                article_id: 'art1',
                article_hash: 'hash1',
                url: 'http://example.com/1',
                title: 'Title 1',
                domain: 'example.com',
                access_count: 100,
                unique_users: 50,
                cache_hit_rate: 0.85,
                is_fully_cached: true,
                last_accessed_at: '2023-10-15T10:00:00Z'
            }
        ];

        mockQueryObj.then.mockImplementation((resolve) => {
            resolve({ data: mockData, error: null });
        });

        const res = await GET(mockRequest);

        expect(res.status).toBe(200);

        // Verify Supabase query chain
        expect(supabase.from).toHaveBeenCalledWith('article_stats');
        expect(mockSelect).toHaveBeenCalledWith('*');
        expect(mockOrder).toHaveBeenCalledWith('access_count', { ascending: false });
        expect(mockLimit).toHaveBeenCalledWith(20);

        // Verify week calculation (2023-10-15 - 7 days = 2023-10-08)
        expect(mockGte).toHaveBeenCalledWith('last_accessed_at', '2023-10-08T12:00:00.000Z');
        expect(mockEq).not.toHaveBeenCalled();

        // Verify response mapping
        const data = await res.json();
        expect(data.total).toBe(1);
        expect(data.articles[0]).toEqual({
            articleId: 'art1',
            articleHash: 'hash1',
            url: 'http://example.com/1',
            title: 'Title 1',
            domain: 'example.com',
            accessCount: 100,
            uniqueUsers: 50,
            cacheHitRate: 85, // 0.85 * 100
            isFullyCached: true,
            lastAccessedAt: '2023-10-15T10:00:00Z'
        });
    });

    it('handles article_id fallback to article_hash', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        mockQueryObj.then.mockImplementation((resolve) => {
            resolve({
                data: [{
                    article_hash: 'hash_only',
                    cache_hit_rate: 0
                }],
                error: null
            });
        });

        const res = await GET(mockRequest);
        const data = await res.json();

        expect(data.articles[0].articleId).toBe('hash_only');
    });

    it('returns 200 with custom parameters (today, domain, custom limit)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        const url = new URL('http://localhost/api/stats/popular?period=today&domain=test.com&limit=50');
        const customRequest = new NextRequest(url);

        const res = await GET(customRequest);
        expect(res.status).toBe(200);

        expect(mockLimit).toHaveBeenCalledWith(50);

        // Verify today calculation
        const expectedToday = new Date('2023-10-15T12:00:00Z');
        expectedToday.setHours(0, 0, 0, 0);
        expect(mockGte).toHaveBeenCalledWith('last_accessed_at', expectedToday.toISOString());
        expect(mockEq).toHaveBeenCalledWith('domain', 'test.com');
    });

    it('skips gte query when period is "all"', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        const url = new URL('http://localhost/api/stats/popular?period=all');
        const allRequest = new NextRequest(url);

        const res = await GET(allRequest);
        expect(res.status).toBe(200);

        expect(mockGte).not.toHaveBeenCalled();
    });

    it('uses month period correctly', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        const url = new URL('http://localhost/api/stats/popular?period=month');
        const monthRequest = new NextRequest(url);

        const res = await GET(monthRequest);
        expect(res.status).toBe(200);

        // 2023-10-15 - 1 month = 2023-09-15
        expect(mockGte).toHaveBeenCalledWith('last_accessed_at', '2023-09-15T12:00:00.000Z');
    });

    it('falls back to default limit when limit > 100 or <= 0 or invalid', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        const requests = [
            new NextRequest(new URL('http://localhost/api/stats/popular?limit=150')),
            new NextRequest(new URL('http://localhost/api/stats/popular?limit=-5')),
            new NextRequest(new URL('http://localhost/api/stats/popular?limit=invalid')),
        ];

        for (const req of requests) {
            jest.clearAllMocks();
            mockQueryObj.then.mockImplementation((resolve) => resolve({ data: [], error: null }));

            await GET(req);
            expect(mockLimit).toHaveBeenCalledWith(20);
        }
    });

    it('returns sanitized 500 when Supabase query fails', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        mockQueryObj.then.mockImplementation((resolve) => {
            resolve({ data: null, error: { message: 'Database error' } });
        });

        // Suppress console.error for this test
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await GET(mockRequest);
        expect(res.status).toBe(500);

        const data = await res.json();
        expect(data.error).toBe('Failed to fetch popular articles');
        expect(data.details).toBeUndefined();

        consoleSpy.mockRestore();
    });

    it('returns 500 on unexpected exceptions', async () => {
        (auth as jest.Mock).mockRejectedValue(new Error('Unexpected auth error'));

        const res = await GET(mockRequest);
        expect(res.status).toBe(500);

        const data = await res.json();
        expect(data.error).toBe('Internal server error');
    });
});
