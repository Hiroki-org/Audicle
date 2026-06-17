import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "@/components/Sidebar";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { handleSignOut } from "@/app/auth/signin/actions";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock server action
jest.mock("@/app/auth/signin/actions", () => ({
  handleSignOut: jest.fn(),
}));

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href, onClick, className }: any) => {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    );
  };
});

describe("Sidebar Component", () => {
  const mockRouterPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });
    (usePathname as jest.Mock).mockReturnValue("/");
  });

  it("renders without crashing and shows navigation items", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(<Sidebar />);

    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(screen.getByText("プレイリスト")).toBeInTheDocument();
    expect(screen.getByText("人気記事")).toBeInTheDocument();
    expect(screen.getByText("設定")).toBeInTheDocument();
  });

  it("applies active class to the current path", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    (usePathname as jest.Mock).mockReturnValue("/playlists");
    render(<Sidebar />);

    const playlistsLink = screen.getByText("プレイリスト").closest("a");
    expect(playlistsLink).toHaveClass("bg-zinc-800 text-white");

    const homeLink = screen.getByText("ホーム").closest("a");
    expect(homeLink).not.toHaveClass("bg-zinc-800 text-white");
  });

  it("renders user information when logged in", () => {
    const mockSession = {
      user: { name: "Test User", email: "test@example.com" },
    };
    (useSession as jest.Mock).mockReturnValue({ data: mockSession });
    render(<Sidebar />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders user email when name is not available", () => {
    const mockSession = {
      user: { email: "test@example.com" },
    };
    (useSession as jest.Mock).mockReturnValue({ data: mockSession });
    render(<Sidebar />);

    // Email should be shown in the primary spot
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("does not render user information when not logged in", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(<Sidebar />);

    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });

  it("calls handleSignOut when logout button is clicked", () => {
    const mockSession = { user: { name: "Test User" } };
    (useSession as jest.Mock).mockReturnValue({ data: mockSession });
    render(<Sidebar />);

    const logoutButton = screen.getByText("ログアウト");
    fireEvent.click(logoutButton);

    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("navigates to reader when '新しい記事を読む' is clicked", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(<Sidebar />);

    const newArticleButton = screen.getByText("新しい記事を読む");
    fireEvent.click(newArticleButton);

    expect(mockRouterPush).toHaveBeenCalledWith("/reader");
  });

  it("toggles mobile sidebar correctly", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(<Sidebar />);

    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("-translate-x-full"); // Initially closed on mobile

    // Open sidebar
    const openButton = screen.getByLabelText("メニューを開く");
    fireEvent.click(openButton);
    expect(aside).toHaveClass("translate-x-0");

    // Close sidebar
    const closeButton = screen.getByLabelText("メニューを閉じる");
    fireEvent.click(closeButton);
    expect(aside).toHaveClass("-translate-x-full");
  });

  it("closes sidebar when a link is clicked", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(<Sidebar />);

    const openButton = screen.getByLabelText("メニューを開く");
    fireEvent.click(openButton);

    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("translate-x-0");

    const homeLink = screen.getByText("ホーム").closest("a");
    fireEvent.click(homeLink!);

    expect(aside).toHaveClass("-translate-x-full");
  });
});
