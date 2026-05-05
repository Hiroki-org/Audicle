import React from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { AudioPlaybackProvider, useAudioPlayback } from '../AudioPlaybackContext';
import { usePlayback } from '@/hooks/usePlayback';

// Mock the usePlayback hook
jest.mock('@/hooks/usePlayback');

const mockUsePlayback = usePlayback as jest.MockedFunction<typeof usePlayback>;

describe('AudioPlaybackContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AudioPlaybackProvider>{children}</AudioPlaybackProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    mockUsePlayback.mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: '',
      currentIndex: -1,
      currentChunkId: undefined,
      playbackRate: 1,
      play: jest.fn(),
      pause: jest.fn(),
      stop: jest.fn(),
      next: jest.fn(),
      previous: jest.fn(),
      seekToChunk: jest.fn(),
      setPlaybackRate: jest.fn(),
    });

    const { result } = renderHook(() => useAudioPlayback(), { wrapper });

    expect(result.current.source).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.playbackRate).toBe(1);
    expect(typeof result.current.setSource).toBe('function');
  });

  it('should throw an error when useAudioPlayback is used outside of AudioPlaybackProvider', () => {
    // Suppress console.error for expected React error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    function TestComponent() {
      useAudioPlayback();
      return <div>Test</div>;
    }

    expect(() => render(<TestComponent />)).toThrow('useAudioPlayback must be used within AudioPlaybackProvider');

    consoleSpy.mockRestore();
  });

  it('should pass source properties to usePlayback when source is set', () => {
    mockUsePlayback.mockReturnValue({
      isPlaying: true,
      isLoading: false,
      error: '',
      currentIndex: 0,
      currentChunkId: 'chunk-1',
      playbackRate: 1.5,
      play: jest.fn(),
      pause: jest.fn(),
      stop: jest.fn(),
      next: jest.fn(),
      previous: jest.fn(),
      seekToChunk: jest.fn(),
      setPlaybackRate: jest.fn(),
    });

    const { result } = renderHook(() => useAudioPlayback(), { wrapper });

    const mockSource = {
      chunks: [{ id: 'chunk-1', text: 'Hello', cleanedText: 'Hello', type: 'paragraph' as const }],
      articleUrl: 'https://example.com/article',
      voiceModel: 'model-a',
      title: 'Test Article',
      author: 'Test Author',
      playbackSpeed: 1.5,
      onArticleEnd: jest.fn(),
    };

    act(() => {
      result.current.setSource(mockSource);
    });

    expect(result.current.source).toEqual(mockSource);

    // Verify that usePlayback was called with the updated properties
    expect(mockUsePlayback).toHaveBeenCalledWith({
      chunks: mockSource.chunks,
      articleUrl: mockSource.articleUrl,
      voiceModel: mockSource.voiceModel,
      playbackSpeed: mockSource.playbackSpeed,
      articleTitle: mockSource.title,
      articleAuthor: mockSource.author,
      onArticleEnd: mockSource.onArticleEnd,
    });
  });

  it('should expose playback controls from usePlayback', () => {
    const mockPlay = jest.fn();
    const mockPause = jest.fn();
    const mockStop = jest.fn();
    const mockNext = jest.fn();
    const mockPrevious = jest.fn();
    const mockSeekToChunk = jest.fn();
    const mockSetPlaybackRate = jest.fn();

    mockUsePlayback.mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: '',
      currentIndex: -1,
      currentChunkId: undefined,
      playbackRate: 1,
      play: mockPlay,
      pause: mockPause,
      stop: mockStop,
      next: mockNext,
      previous: mockPrevious,
      seekToChunk: mockSeekToChunk,
      setPlaybackRate: mockSetPlaybackRate,
    });

    const { result } = renderHook(() => useAudioPlayback(), { wrapper });

    result.current.play();
    expect(mockPlay).toHaveBeenCalledTimes(1);

    result.current.pause();
    expect(mockPause).toHaveBeenCalledTimes(1);

    result.current.stop();
    expect(mockStop).toHaveBeenCalledTimes(1);

    result.current.next();
    expect(mockNext).toHaveBeenCalledTimes(1);

    result.current.previous();
    expect(mockPrevious).toHaveBeenCalledTimes(1);

    result.current.seekToChunk('chunk-1');
    expect(mockSeekToChunk).toHaveBeenCalledWith('chunk-1');

    result.current.setPlaybackRate(1.5);
    expect(mockSetPlaybackRate).toHaveBeenCalledWith(1.5);
  });
});
