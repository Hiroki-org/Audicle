import {
  validatePlaybackSpeed,
  validateVoiceModel,
  validateLanguage,
  validateColorTheme,
  validateUserSettings,
} from '../settingsValidator';

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
      expect(validateVoiceModel('ja-JP-Standard-B')).toBe(true);
      expect(validateVoiceModel('en-US-Wavenet-C')).toBe(true);
    });

    it('should return false for invalid voice models', () => {
      expect(validateVoiceModel('invalid-model')).toBe(false);
      expect(validateVoiceModel(123)).toBe(false);
      expect(validateVoiceModel(null)).toBe(false);
      expect(validateVoiceModel(undefined)).toBe(false);
      expect(validateVoiceModel('')).toBe(false);
      expect(validateVoiceModel({})).toBe(false);
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
      expect(validateColorTheme('ocean')).toBe(true);
      expect(validateColorTheme('purple')).toBe(true);
      expect(validateColorTheme('forest')).toBe(true);
      expect(validateColorTheme('rose')).toBe(true);
      expect(validateColorTheme('orange')).toBe(true);
    });

    it('should return false for invalid color themes', () => {
      expect(validateColorTheme('blue')).toBe(false);
      expect(validateColorTheme(1)).toBe(false);
      expect(validateColorTheme('light')).toBe(false);
      expect(validateColorTheme('dark')).toBe(false);
      expect(validateColorTheme('sepia')).toBe(false);
    });
  });

  describe('validateUserSettings', () => {
    const validSettings = {
      playback_speed: 1.0,
      voice_model: 'ja-JP-Standard-B',
      language: 'ja-JP',
      color_theme: 'ocean',
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
  });
});
