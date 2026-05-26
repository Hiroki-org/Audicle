import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "../Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { handleSignOut } from "@/app/auth/signin/actions";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock auth actions
jest.mock("@/app/auth/signin/actions", () => ({
  handleSignOut: jest.fn(),
}));

describe("Sidebar", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue("/");
    (useSession as jest.Mock).mockReturnValue({ data: null });
  });

  it("renders the sidebar with correct navigation items", () => {
    render(<Sidebar />);

    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(screen.getByText("プレイリスト")).toBeInTheDocument();
    expect(screen.getByText("人気記事")).toBeInTheDocument();
    expect(screen.getByText("設定")).toBeInTheDocument();

    // Check main title
    const titles = screen.getAllByText("Audicle");
    expect(titles.length).toBeGreaterThan(0);
  });

  it("highlights the active navigation item", () => {
    (usePathname as jest.Mock).mockReturnValue("/playlists");
    render(<Sidebar />);

    const playlistLink = screen.getByText("プレイリスト").closest("a");
    expect(playlistLink).toHaveClass("bg-zinc-800", "text-white");

    const homeLink = screen.getByText("ホーム").closest("a");
    expect(homeLink).toHaveClass("text-zinc-400");
  });

  it("renders user information when logged in", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: { name: "Test User", email: "test@example.com" },
      },
    });

    render(<Sidebar />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("calls router.push when '新しい記事を読む' is clicked", () => {
    render(<Sidebar />);

    const newArticleButton = screen.getByText("新しい記事を読む");
    fireEvent.click(newArticleButton);

    expect(mockPush).toHaveBeenCalledWith("/reader");
  });

  it("calls handleSignOut when logout button is clicked", () => {
    render(<Sidebar />);

    const logoutButton = screen.getByText("ログアウト");
    fireEvent.click(logoutButton);

    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("opens and closes the mobile sidebar", () => {
    render(<Sidebar />);

    // Sidebar should be initially closed (translated out on small screens, handled by CSS)

    const openMenuButton = screen.getByLabelText("メニューを開く");
    fireEvent.click(openMenuButton);

    // After clicking open, overlay should be visible and close button should work
    const closeButton = screen.getByLabelText("メニューを閉じる");
    fireEvent.click(closeButton);

    // Re-open and try closing via link click
    fireEvent.click(openMenuButton);
    const homeLink = screen.getByText("ホーム").closest("a")!;
    fireEvent.click(homeLink);

    // State changes aren't easily testable via pure DOM output since they rely on Tailwind CSS classes,
    // but we can at least ensure no crashes and the callbacks work.
  });
});
