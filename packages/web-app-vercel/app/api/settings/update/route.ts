import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validatePlaybackSpeed, validateVoiceModel, validateLanguage, validateColorTheme } from '@/lib/settingsValidator'
import { UpdateSettingsRequest, UpdateSettingsSuccessResponse, VOICE_MODELS, COLOR_THEMES } from '@/types/settings'

export async function PUT(request: NextRequest) {
    try {
        // Verify authentication
        const session = await auth()

        if (!session || !session.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized', success: false },
                { status: 401 }
            )
        }

        const userId = session.user.id

        // Parse request body
        let body: UpdateSettingsRequest
        try {
            body = await request.json()
        } catch (error) {
            console.error('Error parsing request body:', error)
            return NextResponse.json(
                { error: 'Invalid JSON body', success: false },
                { status: 400 }
            )
        }

        // Validate input
        const { playback_speed, voice_model, language, color_theme } = body
        const errors: string[] = []

        if (playback_speed !== undefined && !validatePlaybackSpeed(playback_speed)) {
            errors.push('Invalid playback_speed. Must be between 0.5 and 3.0')
        }

        if (voice_model !== undefined && !validateVoiceModel(voice_model)) {
            const validModels = VOICE_MODELS.map(m => m.value).join(', ')
            errors.push(`Invalid voice_model. Must be one of: ${validModels}`)
        }

        if (language !== undefined && !validateLanguage(language)) {
            errors.push('Invalid language. Must be ja-JP or en-US')
        }

        if (color_theme !== undefined && !validateColorTheme(color_theme)) {
            const validThemes = COLOR_THEMES.map(m => m.value).join(', ')
            errors.push(`Invalid color_theme. Must be one of: ${validThemes}`)
        }

        if (errors.length > 0) {
            return NextResponse.json(
                {
                    error: errors.join(' '),
                    success: false,
                },
                { status: 400 }
            )
        }

        // Prepare update object
        const updateData: Record<string, unknown> = { user_id: userId }
        if (playback_speed !== undefined) updateData.playback_speed = playback_speed
        if (voice_model !== undefined) updateData.voice_model = voice_model
        if (language !== undefined) updateData.language = language
        if (color_theme !== undefined) updateData.color_theme = color_theme

        // UPSERT to user_settings table
        const { data, error } = await supabase
            .from('user_settings')
            .upsert(updateData, { onConflict: 'user_id' })
            .select()
            .single()

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json(
                { error: 'Failed to update settings', success: false },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Settings updated successfully',
            data,
        } as UpdateSettingsSuccessResponse)
    } catch (error) {
        console.error('Error in PUT /api/settings/update:', error)
        return NextResponse.json(
            { error: 'Internal server error', success: false },
            { status: 500 }
        )
    }
}
