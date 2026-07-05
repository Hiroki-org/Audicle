import {
  validatePlaybackSpeed,
  validateVoiceModel,
  validateLanguage,
  validateColorTheme,
  validateUserSettings,
} from '../settingsValidator';
// Removed unused imports: VOICE_MODELS and COLOR_THEMES

jest.mock('@/types/settings', () => ({
  ...jest.requireActual('@/types/settings'),
  VOICE_MODELS: [
    { value: 'ja-JP-Neural2-B', label: 'Japanese' },
    { value: 'en-US-Standard-C', label: 'English' },
  ],
  COLOR_THEMES: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'sepia', label: 'Sepia' },
  ],
}));

describe('settingsValidator', () => {
  describe('validatePlaybackSpeed', () => {
    it('should return true for valid speeds', () => {
      expect(validatePlaybackSpeed(1.0)).toBe(true);
      expect(validatePlaybackSpeed(0.5)).toBe(true);
      expect(validatePlaybackSpeed(3.0)).toBe(true);
    });

    it('should return false for invalid speeds', () => {
      expect(validatePlaybackSpeed(0.4)).toBe(false);
      expect(validatePlaybackSpeed(3.1)).toBe(false);
      expect(validatePlaybackSpeed('1.0')).toBe(false);
      expect(validatePlaybackSpeed(null)).toBe(false);
    });
  });

  describe('validateVoiceModel', () => {
    it('should return true for valid voice models', () => {
      expect(validateVoiceModel('ja-JP-Neural2-B')).toBe(true);
      expect(validateVoiceModel('en-US-Standard-C')).toBe(true);
    });

    it('should return false for invalid voice models', () => {
      expect(validateVoiceModel('invalid-model')).toBe(false);
      expect(validateVoiceModel(123)).toBe(false);
    });
  });

  describe('validateLanguage', () => {
    it('should return true for valid languages', () => {
      expect(validateLanguage('ja-JP')).toBe(true);
      expect(validateLanguage('en-US')).toBe(true);
    });

    it('should return false for invalid languages', () => {
      expect(validateLanguage('fr-FR')).toBe(false);
      expect(validateLanguage(null)).toBe(false);
    });
  });

  describe('validateColorTheme', () => {
    it('should return true for valid color themes', () => {
      expect(validateColorTheme('light')).toBe(true);
      expect(validateColorTheme('dark')).toBe(true);
      expect(validateColorTheme('sepia')).toBe(true);
    });

    it('should return false for invalid color themes', () => {
      expect(validateColorTheme('blue')).toBe(false);
      expect(validateColorTheme(1)).toBe(false);
    });
  });

  describe('validateUserSettings', () => {
    const validSettings = {
      playback_speed: 1.0,
      voice_model: 'ja-JP-Neural2-B',
      language: 'ja-JP',
      color_theme: 'dark',
    };

    it('should return true for a valid settings object', () => {
      expect(validateUserSettings(validSettings)).toBe(true);
    });

    it('should return false for an invalid settings object', () => {
      expect(validateUserSettings({ ...validSettings, playback_speed: 99 })).toBe(false);
      expect(validateUserSettings({ ...validSettings, voice_model: 'invalid' })).toBe(false);
      expect(validateUserSettings({ ...validSettings, language: 'xx-XX' })).toBe(false);
      expect(validateUserSettings({ ...validSettings, color_theme: 'rainbow' })).toBe(false);
    });

    it('should return false for malformed data', () => {
      expect(validateUserSettings(null)).toBe(false);
      expect(validateUserSettings('settings')).toBe(false);
      expect(validateUserSettings(123)).toBe(false);
      expect(validateUserSettings({})).toBe(false);
    });

    it('should return false for partial settings objects missing required fields', () => {
      expect(validateUserSettings({ playback_speed: 1.0, voice_model: 'ja-JP-Neural2-B' })).toBe(false);
      expect(validateUserSettings({ language: 'ja-JP', color_theme: 'dark' })).toBe(false);
      expect(validateUserSettings({ playback_speed: 1.0 })).toBe(false);
    });

  });
});
