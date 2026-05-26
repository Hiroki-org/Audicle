import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UserSettingsPanel from '../UserSettingsPanel';
import { useSession } from 'next-auth/react';
import { useUserSettings, useUpdateUserSettingsMutation } from '@/lib/hooks/useUserSettings';
import { DEFAULT_SETTINGS, COLOR_THEMES } from '@/types/settings';
import { applyTheme } from '@/lib/theme';
import toast from 'react-hot-toast';

// Mock useDebounce to allow controlling it more precisely
let debounceFlush = jest.fn();
let debounceCancel = jest.fn();

jest.mock('use-debounce', () => ({
  useDebounce: (value: any, delay: number) => {
    // For testing unmount specifically we need it NOT to auto-save immediately
    // so we return the previous value and let tests manipulate this if needed.
    // However, simplest way is just to return [value] always, making the auto-save trigger immediately.
    // The previous tests rely on this immediate return.
    return [value, { flush: debounceFlush, cancel: debounceCancel }];
  },
}));

// Mock dependencies
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserSettings', () => ({
  useUserSettings: jest.fn(),
  useUpdateUserSettingsMutation: jest.fn(),
}));

jest.mock('@/lib/theme', () => ({
  applyTheme: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock ResizeObserver for some UI components if needed
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Also mock window.console.error to keep logs clean
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('UserSettingsPanel', () => {
  const mockUpdateMutation = {
    mutateAsync: jest.fn(),
    isPending: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });

    (useUserSettings as jest.Mock).mockReturnValue({
      data: DEFAULT_SETTINGS,
      isLoading: false,
      error: null,
    });

    (useUpdateUserSettingsMutation as jest.Mock).mockReturnValue(mockUpdateMutation);

    // Clear localStorage
    localStorage.clear();
  });

  it('renders correctly with default settings', () => {
    render(<UserSettingsPanel />);

    expect(screen.getByText('再生設定')).toBeInTheDocument();
    expect(screen.getByText('カラーテーマ')).toBeInTheDocument();
    expect(screen.getByText('再生速度')).toBeInTheDocument();
    expect(screen.getByText('言語')).toBeInTheDocument();
    expect(screen.getByText('音声モデル')).toBeInTheDocument();

    // Default playback speed
    expect(screen.getByText('1.0x')).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    (useUserSettings as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<UserSettingsPanel />);
    // Loading skeleton should be visible
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('handles error state correctly', () => {
    (useUserSettings as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Settings fetch failed'),
    });

    render(<UserSettingsPanel />);
    expect(screen.getByText('Settings fetch failed')).toBeInTheDocument();
  });

  it('allows changing playback speed and saves correctly for logged-in user', async () => {
    render(<UserSettingsPanel />);

    const slider = screen.getByRole('slider');

    await act(async () => {
      fireEvent.change(slider, { target: { value: '1.5' } });
    });

    expect(screen.getByText('1.5x')).toBeInTheDocument();

    const saveButton = screen.getByText('保存');
    expect(saveButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ playback_speed: 1.5 })
      );
      expect(toast.success).toHaveBeenCalledWith('設定を保存しました');
    });
  });

  it('allows changing language and saves correctly', async () => {
    render(<UserSettingsPanel />);

    const languageSelect = screen.getAllByRole('combobox')[0]; // Language is first

    await act(async () => {
      fireEvent.change(languageSelect, { target: { value: 'en-US' } });
    });

    const saveButton = screen.getByText('保存');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en-US' })
      );
    });
  });

  it('allows changing voice model and saves correctly', async () => {
    render(<UserSettingsPanel />);

    const voiceModelSelect = screen.getAllByRole('combobox')[1]; // Voice model is second

    await act(async () => {
      fireEvent.change(voiceModelSelect, { target: { value: 'en-US-Wavenet-C' } });
    });

    const saveButton = screen.getByText('保存');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ voice_model: 'en-US-Wavenet-C' })
      );
    });
  });

  it('handles save error correctly', async () => {
    mockUpdateMutation.mutateAsync.mockRejectedValueOnce(new Error('Save failed'));

    render(<UserSettingsPanel />);

    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '1.5' } });
    });

    const saveButton = screen.getByText('保存');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Save failed');
    });
  });

  it('handles generic save error correctly', async () => {
    render(<UserSettingsPanel />);

    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '1.5' } });
    });

    mockUpdateMutation.mutateAsync.mockRejectedValueOnce('Some string error');
    const saveButton = screen.getByText('保存');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('設定の保存に失敗しました');
    });
  });

  it('saves settings to localStorage for guest user', async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<UserSettingsPanel />);

    const slider = screen.getByRole('slider');

    await act(async () => {
      fireEvent.change(slider, { target: { value: '2.0' } });
    });

    const saveButton = screen.getByText('保存');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateMutation.mutateAsync).not.toHaveBeenCalled();

      const savedSettings = JSON.parse(localStorage.getItem('audicle-user-settings') || '{}');
      expect(savedSettings.playback_speed).toBe(2.0);
      expect(toast.success).toHaveBeenCalledWith('設定を保存しました');
    });
  });

  it('loads valid existing settings from localStorage for guest user', async () => {
    const existingGuestSettings = { ...DEFAULT_SETTINGS, playback_speed: 2.5 };
    localStorage.setItem('audicle-user-settings', JSON.stringify(existingGuestSettings));

    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<UserSettingsPanel />);

    expect(screen.getByText('2.5x')).toBeInTheDocument();
  });

  it('handles invalid existing settings in localStorage gracefully', async () => {
    localStorage.setItem('audicle-user-settings', 'invalid-json');

    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<UserSettingsPanel />);

    // Should fallback to default
    expect(screen.getByText('1.0x')).toBeInTheDocument();
  });

  it('updates preview theme immediately and auto-saves', async () => {
    render(<UserSettingsPanel />);

    const firstThemeButton = screen.getAllByTitle(COLOR_THEMES[0].label)[0];
    const secondThemeButton = screen.getAllByTitle(COLOR_THEMES[1].label)[0];

    await act(async () => {
      fireEvent.click(secondThemeButton);
    });

    expect(applyTheme).toHaveBeenCalledWith(COLOR_THEMES[1].value);

    // Check if the second theme button has the "selected" classes
    expect(secondThemeButton).toHaveClass('border-white', 'scale-110');
    // First theme should not have them anymore
    expect(firstThemeButton).toHaveClass('border-zinc-600');

    // Because of our mocked useDebounce returning immediately, the useEffect for auto-save should trigger
    await waitFor(() => {
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ color_theme: COLOR_THEMES[1].value })
      );
    });
  });

  it('handles auto-save error gracefully', async () => {
    mockUpdateMutation.mutateAsync.mockRejectedValueOnce(new Error('Auto-save failed'));

    render(<UserSettingsPanel />);

    const secondThemeButton = screen.getAllByTitle(COLOR_THEMES[1].label)[0];

    await act(async () => {
      fireEvent.click(secondThemeButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Auto-save failed');
    });
  });

  it('cancels changes and reverts to original settings', async () => {
    render(<UserSettingsPanel />);

    // Change speed
    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '2.5' } });
    });
    expect(screen.getByText('2.5x')).toBeInTheDocument();

    // Click cancel
    const cancelButton = screen.getByText('キャンセル');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Should revert back to 1.0x
    expect(screen.getByText('1.0x')).toBeInTheDocument();
    // Cancel button should disappear
    expect(screen.queryByText('キャンセル')).not.toBeInTheDocument();
  });

  it('syncs when originalSettings changes externally and no local changes exist', async () => {
    const { rerender } = render(<UserSettingsPanel />);

    expect(screen.getByText('1.0x')).toBeInTheDocument();

    // Change external data
    (useUserSettings as jest.Mock).mockReturnValue({
      data: { ...DEFAULT_SETTINGS, playback_speed: 1.5 },
      isLoading: false,
      error: null,
    });

    rerender(<UserSettingsPanel />);

    // Should sync to 1.5x
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });

  it('does NOT sync when originalSettings changes externally but local changes exist', async () => {
    const { rerender } = render(<UserSettingsPanel />);

    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '2.0' } });
    });

    expect(screen.getByText('2.0x')).toBeInTheDocument();

    // Change external data
    (useUserSettings as jest.Mock).mockReturnValue({
      data: { ...DEFAULT_SETTINGS, playback_speed: 1.5 },
      isLoading: false,
      error: null,
    });

    rerender(<UserSettingsPanel />);

    // Should still be 2.0x because of local changes
    expect(screen.getByText('2.0x')).toBeInTheDocument();
  });
});
