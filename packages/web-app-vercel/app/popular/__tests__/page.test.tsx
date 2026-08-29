import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PopularPage from '../page';

// Mock auth dependencies
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('lucide-react', () => ({
  RotateCcw: () => <div data-testid="icon-rotate" />,
  User: () => <div data-testid="icon-user" />,
  LogOut: () => <div data-testid="icon-logout" />,
  Headphones: () => <div data-testid="icon-headphones" />,
  Home: () => <div data-testid="icon-home" />,
  Menu: () => <div data-testid="icon-menu" />,
  Settings: () => <div data-testid="icon-settings" />,
  ListMusic: () => <div data-testid="icon-listmusic" />,
  TrendingUp: () => <div data-testid="icon-trendingup" />
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => '/popular'),
}));

// Mock components
jest.mock('@/components/Sidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar-mock" />
}));

jest.mock('@/components/PlaylistSelectorModal', () => ({
  PlaylistSelectorModal: () => <div data-testid="playlist-modal-mock" />
}));

// DomainBadge mocking to prevent the error
jest.mock('@/components/DomainBadge', () => ({
  DomainBadge: () => <div data-testid="domain-badge-mock" />
}));

// Mock PopularArticleCard
jest.mock('@/components/PopularArticleCard', () => ({
  PopularArticleCard: () => <div data-testid="popular-article-card-mock" />
}));

// Mock PeriodFilter
jest.mock('@/components/PeriodFilter', () => ({
  PeriodFilter: () => <div data-testid="period-filter-mock" />
}));

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('PopularPage', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create a mock for fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ articles: [] }),
      })
    ) as jest.Mock;

    // Save original localStorage
    originalLocalStorage = global.localStorage;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();

    // Restore localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
  });

  describe('Cache Writing Error Handling', () => {
    it('handles localStorage.setItem throwing an error', async () => {
      // 1. Arrange: setup localStorage mock to throw error on setItem
      const mockSetItem = jest.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const mockGetItem = jest.fn().mockReturnValue(null);

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: mockSetItem,
        },
        writable: true
      });

      // Mock fetch to return some data so it tries to set cache
      const mockArticles = [
        {
          articleId: '1',
          articleHash: 'hash1',
          url: 'https://example.com/1',
          title: 'Test Article 1',
          period: 'week',
          readCount: 100,
          domain: 'example.com' // added this in case it's used elsewhere
        }
      ];

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ articles: mockArticles }),
        })
      );

      // 2. Act: render component
      render(<PopularPage />);

      // Wait for fetch to complete and setItem to be called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(mockSetItem).toHaveBeenCalled();
      });

      // 3. Assert: check console.error is called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to write popular articles cache for week',
        expect.any(Error)
      );

      expect(consoleErrorSpy.mock.calls[0][1].message).toBe('QuotaExceededError');
    });
  });
});
