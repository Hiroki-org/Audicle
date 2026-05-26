// Supabase mock
const mockUpsert = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockReturnThis();
const mockSingle = jest.fn().mockResolvedValue({
    data: {
        user_id: 'test-user-id',
        playback_speed: 1.5,
        voice_model: 'en-US-Wavenet-C',
        language: 'en-US',
        color_theme: 'purple',
    },
    error: null,
});

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            upsert: mockUpsert,
            select: mockSelect,
            single: mockSingle,
        })),
    },
}));

// Auth mock
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { PUT } from '../route';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

describe('PUT /api/settings/update', () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeAll(() => {
        // Suppress expected console.error logs during error tests
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    beforeEach(() => {
        jest.resetAllMocks();

        // Reset default mock implementations for Supabase chain
        mockUpsert.mockReturnThis();
        mockSelect.mockReturnThis();
        mockSingle.mockResolvedValue({
            data: {
                user_id: 'test-user-id',
                playback_speed: 1.5,
                voice_model: 'en-US-Wavenet-C',
                language: 'en-US',
                color_theme: 'purple',
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValue({
            upsert: mockUpsert,
            select: mockSelect,
            single: mockSingle,
        });
    });

    const mockRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/settings/update', {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ playback_speed: 1.5 });
        const response = await PUT(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized', success: false });
    });

    it('returns 401 if user lacks an ID', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

        const request = mockRequest({ playback_speed: 1.5 });
        const response = await PUT(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized', success: false });
    });

    it('returns 400 for invalid playback_speed (too high)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ playback_speed: 5.0 }); // invalid
        const response = await PUT(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid playback_speed');
    });

    it('returns 400 for invalid playback_speed (too low)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ playback_speed: 0.1 }); // invalid
        const response = await PUT(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid playback_speed');
    });

    it('returns 400 for invalid voice_model', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ voice_model: 'invalid-model' });
        const response = await PUT(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid voice_model');
    });

    it('returns 400 for invalid language', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ language: 'fr-FR' });
        const response = await PUT(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid language');
    });

    it('returns 400 for invalid color_theme', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ color_theme: 'invalid-theme' });
        const response = await PUT(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid color_theme');
    });

    it('returns 400 if multiple fields are invalid', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ playback_speed: 5.0, language: 'fr-FR' });
        const response = await PUT(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid playback_speed');
        expect(data.error).toContain('Invalid language');
    });

    it('returns 500 if Supabase upsert fails', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        mockSingle.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

        const request = mockRequest({ playback_speed: 1.5 });
        const response = await PUT(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update settings', success: false });
        expect(consoleErrorMock).toHaveBeenCalledWith('Supabase error:', expect.any(Error));
    });

    it('successfully updates settings and returns 200', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({
            playback_speed: 1.5,
            voice_model: 'en-US-Wavenet-C',
            language: 'en-US',
            color_theme: 'purple',
        });
        const response = await PUT(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toBe('Settings updated successfully');
        expect(data.data).toEqual({
            user_id: 'test-user-id',
            playback_speed: 1.5,
            voice_model: 'en-US-Wavenet-C',
            language: 'en-US',
            color_theme: 'purple',
        });

        // Verify Supabase was called correctly
        expect(supabase.from).toHaveBeenCalledWith('user_settings');
        expect(mockUpsert).toHaveBeenCalledWith(
            {
                user_id: 'test-user-id',
                playback_speed: 1.5,
                voice_model: 'en-US-Wavenet-C',
                language: 'en-US',
                color_theme: 'purple',
            },
            { onConflict: 'user_id' }
        );
    });

    it('handles partial updates', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        mockSingle.mockResolvedValueOnce({
            data: {
                user_id: 'test-user-id',
                color_theme: 'orange',
            },
            error: null,
        });

        const request = mockRequest({
            color_theme: 'orange',
        });
        const response = await PUT(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.color_theme).toBe('orange');

        expect(mockUpsert).toHaveBeenCalledWith(
            {
                user_id: 'test-user-id',
                color_theme: 'orange',
            },
            { onConflict: 'user_id' }
        );
    });

    it('returns 500 if an unexpected exception occurs', async () => {
        (auth as jest.Mock).mockRejectedValue(new Error('Unexpected Error'));

        const request = mockRequest({ playback_speed: 1.5 });
        const response = await PUT(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error', success: false });
        expect(consoleErrorMock).toHaveBeenCalledWith('Error in PUT /api/settings/update:', expect.any(Error));
    });

    it('returns 500 if Supabase upsert throws an exception', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        mockUpsert.mockImplementationOnce(() => { throw new Error('Supabase Exception'); });

        const request = mockRequest({ playback_speed: 1.5 });
        const response = await PUT(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error', success: false });
        expect(consoleErrorMock).toHaveBeenCalledWith('Error in PUT /api/settings/update:', expect.any(Error));
    });
});
