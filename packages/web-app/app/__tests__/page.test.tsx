import { render, screen, fireEvent } from '@testing-library/react';
import Home from '../page';
import { useRouter } from 'next/navigation';
import { articleStorage } from '@/lib/storage';

// Mock the next/navigation router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the article storage
jest.mock('@/lib/storage', () => ({
  articleStorage: {
    getAll: jest.fn(),
    remove: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Home Component', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the empty state when no articles exist', () => {
    (articleStorage.getAll as jest.Mock).mockReturnValue([]);

    render(<Home />);

    expect(screen.getByText('まだ記事がありません')).toBeInTheDocument();
    expect(screen.getByText('「+ 新しい記事を読む」から記事を追加してください')).toBeInTheDocument();
  });

  it('navigates to reader when "新しい記事を読む" is clicked', () => {
    (articleStorage.getAll as jest.Mock).mockReturnValue([]);

    render(<Home />);

    const addButton = screen.getByText('+ 新しい記事を読む');
    fireEvent.click(addButton);

    expect(mockRouter.push).toHaveBeenCalledWith('/reader');
  });

  it('renders a list of articles', () => {
    const mockArticles = [
      {
        id: '1',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        createdAt: 1672531200000, // 2023-01-01
        chunks: [{ text: 'chunk 1' }, { text: 'chunk 2' }],
      },
      {
        id: '2',
        title: 'Test Article 2',
        url: 'https://example.com/2',
        createdAt: 1672617600000, // 2023-01-02
        chunkCount: 5,
      },
    ];

    (articleStorage.getAll as jest.Mock).mockReturnValue(mockArticles);

    render(<Home />);

    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
    expect(screen.getByText('Test Article 2')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/1')).toBeInTheDocument();
    expect(screen.getByText('2 チャンク')).toBeInTheDocument();
    expect(screen.getByText('5 チャンク')).toBeInTheDocument();
  });

  it('navigates to article reader when an article is clicked', () => {
    const mockArticles = [
      {
        id: '1',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        createdAt: 1672531200000,
      },
    ];

    (articleStorage.getAll as jest.Mock).mockReturnValue(mockArticles);

    render(<Home />);

    const articleTitle = screen.getByText('Test Article 1');
    fireEvent.click(articleTitle);

    expect(mockRouter.push).toHaveBeenCalledWith('/reader?url=https%3A%2F%2Fexample.com%2F1');
  });

  it('deletes an article when confirm is accepted', () => {
    const mockArticles = [
      {
        id: '1',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        createdAt: 1672531200000,
      },
    ];

    (articleStorage.getAll as jest.Mock).mockReturnValue(mockArticles);

    // Mock confirm dialog to return true
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Home />);

    const deleteButton = screen.getByText('削除');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('「Test Article 1」を削除しますか?');
    expect(articleStorage.remove).toHaveBeenCalledWith('1');
    // Article should be removed from DOM
    expect(screen.queryByText('Test Article 1')).not.toBeInTheDocument();
  });

  it('does not delete an article when confirm is rejected', () => {
    const mockArticles = [
      {
        id: '1',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        createdAt: 1672531200000,
      },
    ];

    (articleStorage.getAll as jest.Mock).mockReturnValue(mockArticles);

    // Mock confirm dialog to return false
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<Home />);

    const deleteButton = screen.getByText('削除');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('「Test Article 1」を削除しますか?');
    expect(articleStorage.remove).not.toHaveBeenCalled();
    // Article should still be in DOM
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });

  it('reloads articles when storage event occurs', () => {
    const mockArticles = [
      {
        id: '1',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        createdAt: 1672531200000,
      },
    ];

    // Initial call returns empty
    (articleStorage.getAll as jest.Mock).mockReturnValueOnce([]);

    render(<Home />);
    expect(screen.getByText('まだ記事がありません')).toBeInTheDocument();

    // Subsequent call returns articles
    (articleStorage.getAll as jest.Mock).mockReturnValue(mockArticles);

    // Dispatch storage event
    fireEvent(window, new Event('storage'));

    // The component should update
    expect(screen.getByText('Test Article 1')).toBeInTheDocument();
  });
});
