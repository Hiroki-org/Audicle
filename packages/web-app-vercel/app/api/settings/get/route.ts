import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SETTINGS, UserSettingsResponse } from '@/types/settings'

async function getUserId(): Promise<string | null> {
    const session = await auth()
    return session?.user?.id || null
}

async function fetchUserSettings(userId: string) {
    return await supabase
        .from('user_settings')
        .select('playback_speed, voice_model, language, color_theme, created_at, updated_at')
        .eq('user_id', userId)
        .single()
}

function handleSupabaseError(error: any) {
    if (error.code === 'PGRST116') {
        return NextResponse.json({
            ...DEFAULT_SETTINGS,
            created_at: undefined,
            updated_at: undefined,
        } as UserSettingsResponse)
    }

    console.error('Supabase error:', error)
    return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
    )
}

export async function GET() {
    try {
        const userId = await getUserId()

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { data, error } = await fetchUserSettings(userId)

        if (error) {
            return handleSupabaseError(error)
        }

        return NextResponse.json(data as UserSettingsResponse)
    } catch (error) {
        console.error('Error in GET /api/settings/get:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
