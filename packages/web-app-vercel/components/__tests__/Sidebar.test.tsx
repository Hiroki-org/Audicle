import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "../Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { handleSignOut } from "@/app/auth/signin/actions";

// Mock dependencies
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/app/auth/signin/actions", () => ({
  handleSignOut: jest.fn(),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Menu: () => <span data-testid="icon-menu" />,
  X: () => <span data-testid="icon-x" />,
  Home: () => <span data-testid="icon-home" />,
  List: () => <span data-testid="icon-list" />,
  Settings: () => <span data-testid="icon-settings" />,
  Plus: () => <span data-testid="icon-plus" />,
  LogOut: () => <span data-testid="icon-logout" />,
  User: () => <span data-testid="icon-user" />,
  TrendingUp: () => <span data-testid="icon-trendingup" />,
}));

describe("Sidebar", () => {
  const mockRouter = { push: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/");
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSession as jest.Mock).mockReturnValue({ data: null });
  });

  it("renders navigation links correctly", () => {
    render(<Sidebar />);
    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(screen.getByText("プレイリスト")).toBeInTheDocument();
    expect(screen.getByText("人気記事")).toBeInTheDocument();
    expect(screen.getByText("設定")).toBeInTheDocument();
  });

  it("highlights the active link based on pathname", () => {
    (usePathname as jest.Mock).mockReturnValue("/playlists");
    render(<Sidebar />);

    // We check the classes of the link that contains "プレイリスト"
    const playlistLink = screen.getByText("プレイリスト").closest("a");
    expect(playlistLink).toHaveClass("bg-zinc-800", "text-white");

    const homeLink = screen.getByText("ホーム").closest("a");
    expect(homeLink).toHaveClass("text-zinc-400");
  });

  it("renders user information when session is available", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: "Test User",
          email: "test@example.com"
        }
      }
    });

    render(<Sidebar />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("handles '新しい記事を読む' button click", () => {
    render(<Sidebar />);
    const newArticleButton = screen.getByText("新しい記事を読む").closest("button");

    fireEvent.click(newArticleButton!);
    expect(mockRouter.push).toHaveBeenCalledWith("/reader");
  });

  it("handles logout button click", () => {
    render(<Sidebar />);
    const logoutButton = screen.getByText("ログアウト").closest("button");

    fireEvent.click(logoutButton!);
    expect(handleSignOut).toHaveBeenCalled();
  });

  it("toggles mobile sidebar open and close", () => {
    render(<Sidebar />);

    const openMenuButton = screen.getByLabelText("メニューを開く");
    fireEvent.click(openMenuButton);

    const sidebar = screen.getByRole("complementary"); // aside tag has complementary role
    expect(sidebar).toHaveClass("translate-x-0");

    const closeMenuButton = screen.getByLabelText("メニューを閉じる");
    fireEvent.click(closeMenuButton);

    // In mobile state (without lg: prefix), it should have -translate-x-full
    expect(sidebar).toHaveClass("-translate-x-full");
  });
});
