import React from 'react';
import { render, act } from '@testing-library/react';
import { AudioPlaybackProvider, useAudioPlayback } from '../AudioPlaybackContext';
import { usePlayback } from '../../hooks/usePlayback';

// Mock the usePlayback hook
jest.mock('../../hooks/usePlayback');

const mockUsePlayback = usePlayback as jest.MockedFunction<typeof usePlayback>;

describe('AudioPlaybackContext', () => {
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

    let contextValue: any;

    function TestComponent() {
      const val = useAudioPlayback();
      React.useEffect(() => {
        contextValue = val;
      }, [val]);
      return <div>Test</div>;
    }

    render(
      <AudioPlaybackProvider>
        <TestComponent />
      </AudioPlaybackProvider>
    );

    expect(contextValue.source).toBeNull();
    expect(contextValue.isPlaying).toBe(false);
    expect(contextValue.isLoading).toBe(false);
    expect(contextValue.error).toBe('');
    expect(contextValue.currentIndex).toBe(-1);
    expect(contextValue.playbackRate).toBe(1);
    expect(typeof contextValue.setSource).toBe('function');
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

    let contextValue: any;

    function TestComponent() {
      const val = useAudioPlayback();
      React.useEffect(() => {
        contextValue = val;
      }, [val]);
      return <div>Test</div>;
    }

    const { rerender } = render(
      <AudioPlaybackProvider>
        <TestComponent />
      </AudioPlaybackProvider>
    );

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
      contextValue.setSource(mockSource);
    });

    rerender(
      <AudioPlaybackProvider>
        <TestComponent />
      </AudioPlaybackProvider>
    );

    expect(contextValue.source).toEqual(mockSource);

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
      playbackRate: 1,
      play: mockPlay,
      pause: mockPause,
      stop: mockStop,
      next: mockNext,
      previous: mockPrevious,
      seekToChunk: mockSeekToChunk,
      setPlaybackRate: mockSetPlaybackRate,
    });

    let contextValue: any;

    function TestComponent() {
      const val = useAudioPlayback();
      React.useEffect(() => {
        contextValue = val;
      }, [val]);
      return <div>Test</div>;
    }

    render(
      <AudioPlaybackProvider>
        <TestComponent />
      </AudioPlaybackProvider>
    );

    contextValue.play();
    expect(mockPlay).toHaveBeenCalledTimes(1);

    contextValue.pause();
    expect(mockPause).toHaveBeenCalledTimes(1);

    contextValue.stop();
    expect(mockStop).toHaveBeenCalledTimes(1);

    contextValue.next();
    expect(mockNext).toHaveBeenCalledTimes(1);

    contextValue.previous();
    expect(mockPrevious).toHaveBeenCalledTimes(1);

    contextValue.seekToChunk('chunk-1');
    expect(mockSeekToChunk).toHaveBeenCalledWith('chunk-1');

    contextValue.setPlaybackRate(1.5);
    expect(mockSetPlaybackRate).toHaveBeenCalledWith(1.5);
  });
});
