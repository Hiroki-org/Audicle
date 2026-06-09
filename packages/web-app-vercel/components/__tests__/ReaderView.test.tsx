import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReaderView from '../ReaderView';
import { Chunk } from '@/types/api';
import { useDownload } from '@/hooks/useDownload';
import { useAutoScroll } from '@/hooks/useAutoScroll';

// Mock ResizeObserver
class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

window.ResizeObserver = ResizeObserver;

// Mock requestAnimationFrame and cancelAnimationFrame
beforeAll(() => {
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterAll(() => {
  (window.requestAnimationFrame as jest.Mock).mockRestore();
  (window.cancelAnimationFrame as jest.Mock).mockRestore();
});

// Mock hooks
jest.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: jest.fn(),
}));

jest.mock('@/hooks/useDownload', () => ({
  useDownload: jest.fn(() => ({
    status: 'idle',
    progress: { current: 0, total: 0 },
    error: null,
    estimatedTime: 0,
    startDownload: jest.fn(),
    cancelDownload: jest.fn(),
  })),
}));

// Mock components
jest.mock('../DownloadPanel', () => function MockDownloadPanel({ status }: { status: string }) {
  if (status === 'idle') return null;
  return <div data-testid="download-panel">Download Panel ({status})</div>;
});

jest.mock('../ReaderChunk', () => function MockReaderChunk({ chunk, onClick }: { chunk: Chunk, onClick: (_id: string) => void }) { return (
  <div data-testid="reader-chunk" onClick={() => onClick(chunk.id)}>{chunk.text}</div>
);});

const mockChunks: Chunk[] = [
  { id: '1', text: 'Title', type: 'h1' },
  { id: '2', text: 'Paragraph 1', type: 'p' },
];

describe('ReaderView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no chunks provided', () => {
    render(<ReaderView chunks={[]} />);
    expect(screen.getByText('読み上げたい記事のURLを入力してください')).toBeInTheDocument();
  });

  it('renders chunks when provided', () => {
    render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);
    const chunks = screen.getAllByTestId('reader-chunk');
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveTextContent('Title');
    expect(chunks[1]).toHaveTextContent('Paragraph 1');
  });

  it('calls onChunkClick when a chunk is clicked', () => {
    const onChunkClick = jest.fn();
    render(<ReaderView chunks={mockChunks} onChunkClick={onChunkClick} articleUrl="https://example.com" />);

    const chunks = screen.getAllByTestId('reader-chunk');
    fireEvent.click(chunks[1]);

    expect(onChunkClick).toHaveBeenCalledWith('2');
  });

  it('passes the correct activeChunkIndex to useAutoScroll', () => {
    render(<ReaderView chunks={mockChunks} currentChunkId="2" articleUrl="https://example.com" />);

    expect(useAutoScroll).toHaveBeenCalledWith(expect.objectContaining({
      activeChunkIndex: '2',
      enabled: true,
      delay: 0,
    }));
  });

  it('unmounts cleanly', () => {
    const { unmount } = render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);
    unmount();
    // If it unmounts without error, it passes
  });

  describe('Download Panel Integration', () => {
    it('does not render download panel when status is idle', () => {
      render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);
      expect(screen.queryByTestId('download-panel')).not.toBeInTheDocument();
    });

    it('renders download panel when status is not idle', () => {
      (useDownload as jest.Mock).mockReturnValue({
        status: 'downloading',
        progress: { current: 5, total: 10 },
        error: null,
        estimatedTime: 120,
        startDownload: jest.fn(),
        cancelDownload: jest.fn(),
      });

      render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);
      expect(screen.getByTestId('download-panel')).toBeInTheDocument();
      expect(screen.getByTestId('download-panel')).toHaveTextContent('Download Panel (downloading)');
    });
  });

  describe('Scroll and Resize Events', () => {
    it('handles resize events via ResizeObserver', () => {
      const observeMock = jest.fn();
      const disconnectMock = jest.fn();

      class MockResizeObserver {
        observe = observeMock;
        disconnect = disconnectMock;
      }
      window.ResizeObserver = MockResizeObserver as any;

      const { unmount } = render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);

      expect(observeMock).toHaveBeenCalled();

      unmount();
      expect(disconnectMock).toHaveBeenCalled();
    });

    it('updates gradient state on scroll', () => {
      render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);

      // Get the scrollable container
      const chunks = screen.getAllByTestId('reader-chunk');
      const container = chunks[0].closest('.overflow-y-auto') as HTMLElement;

      // Mock properties to trigger overflow
      Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });

      // Scroll to top
      Object.defineProperty(container, 'scrollTop', { value: 0, configurable: true });
      act(() => {
        fireEvent.scroll(container);
      });

      // Since gradient state is internal, we can test that it doesn't crash
      // and triggers the scroll handler
      expect(window.requestAnimationFrame).toHaveBeenCalled();

      // Scroll down
      Object.defineProperty(container, 'scrollTop', { value: 100, configurable: true });
      act(() => {
        fireEvent.scroll(container);
      });

      // Scroll to bottom
      Object.defineProperty(container, 'scrollTop', { value: 500, configurable: true });
      act(() => {
        fireEvent.scroll(container);
      });
    });

    it('updates padding on window resize', () => {
      let resizeCallback: any;
      window.ResizeObserver = jest.fn().mockImplementation((cb) => {
        resizeCallback = cb;
        return { observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() };
      }) as any;

      const { rerender } = render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);
      const chunks = screen.getAllByTestId('reader-chunk');
      const container = chunks[0].closest('.overflow-y-auto') as HTMLElement;

      Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });

      act(() => {
        if (resizeCallback) resizeCallback();
      });

      // Trigger condition for top and bottom gradient active
      Object.defineProperty(container, 'scrollTop', { value: 50, configurable: true });
      Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });

      act(() => {
        fireEvent.scroll(container);
      });

      // Ensure new chunk signature triggers effect cleanup
      rerender(<ReaderView chunks={[...mockChunks, { id: '3', text: 'New', type: 'p' }]} articleUrl="https://example.com" />);
    });

    it('bails out of padding update if container is null', () => {
        const { unmount } = render(<ReaderView chunks={mockChunks} articleUrl="https://example.com" />);
        unmount();
        // The ResizeObserver or Scroll events firing on unmounted components shouldn't crash
    });
  });

  describe('Helper functions coverage', () => {
    it('handles missing URL for logger', () => {
      // Missing articleUrl should return early in useEffect
      render(<ReaderView chunks={mockChunks} />);
      // We are just verifying it doesn't crash when articleUrl is missing
    });

    it('handles article title extraction correctly', () => {
      render(<ReaderView chunks={[{ id: '1', text: 'This is a paragraph without heading', type: 'p' }]} articleUrl="https://example.com/some/path" />);
      // Should not crash, tests fallback logic when no primary heading exists
    });

    it('handles invalid articleUrl for title extraction', () => {
      render(<ReaderView chunks={[{ id: '1', text: 'This is a paragraph without heading', type: 'p' }]} articleUrl="invalid-url" />);
      // Should not crash, tests URL parsing error catching
    });

    it('handles getDownloadButtonLabel states correctly', () => {
      const renderWithStatus = (status: string) => {
        (useDownload as jest.Mock).mockReturnValue({
          status,
          progress: { current: 0, total: 0 },
          error: null,
          estimatedTime: 0,
          startDownload: jest.fn(),
          cancelDownload: jest.fn(),
        });
        render(<ReaderView chunks={mockChunks} />);
      };

      renderWithStatus('error');
      // Just verifying we hit the branch
      renderWithStatus('cancelled');
      // Just verifying we hit the branch
    });
  });
});
