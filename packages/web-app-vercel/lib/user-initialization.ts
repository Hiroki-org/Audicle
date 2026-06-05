import { supabase } from './supabase'
import { getOrCreateDefaultPlaylist } from './playlist-utils'

export interface UserInitializationResult {
    success: boolean
    error?: string
}

/**
 * 新規ユーザー登録時の初期化処理
 * - user_settings を作成（既に存在する場合はスキップする）
 * - デフォルトプレイリストは getOrCreateDefaultPlaylist で作成
 *
 * @param userId NextAuth のユーザーID
 * @param userEmail ユーザーのメールアドレス
 * @returns 初期化結果
 */
export async function initializeNewUser(userId: string, userEmail: string): Promise<UserInitializationResult> {
    try {
        // user_settings が既に存在するか確認
        const { data: existingSettings, error: checkError } = await supabase
            .from('user_settings')
            .select('user_id')
            .eq('user_id', userId)
            .single()

        // 既に存在する場合はスキップ
        if (existingSettings) {
            console.log(`User settings already exist for user: ${userId}`)
            return { success: true }
        }

        // PGRST116 = not found（正常な状態）
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking user settings:', checkError)
            return { success: false, error: 'Failed to check user settings' }
        }

        // user_settings を作成
        const { data: newSettings, error: createError } = await supabase
            .from('user_settings')
            .insert({
                user_id: userId,
                playback_speed: 1.0,
                voice_model: 'ja-JP-Standard-B',
                language: 'ja-JP',
            })
            .select()
            .single()

        if (createError) {
            console.error('Error creating user settings:', createError)
            return { success: false, error: 'Failed to create user settings' }
        }

        console.log(`User settings created for user: ${userId}`, newSettings)

        // デフォルトプレイリストを作成
        if (userEmail) {
            const playlistResult = await getOrCreateDefaultPlaylist(userEmail);
            if (playlistResult.error) {
                console.error('Failed to create default playlist:', playlistResult.error);
                // エラーだが、user_settingsは作成済みなので success: true
            }
        }

        return { success: true }
    } catch (error) {
        console.error('Unexpected error in initializeNewUser:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}
