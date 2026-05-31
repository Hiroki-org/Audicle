import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "../Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { handleSignOut } from "@/app/auth/signin/actions";

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

describe("Sidebar", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/");
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useSession as jest.Mock).mockReturnValue({ data: null });
  });

  it("renders all navigation links", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "ホーム" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プレイリスト" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "人気記事" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "設定" })).toBeInTheDocument();
  });

  it("toggles the mobile sidebar using open/close buttons and overlay", () => {
    render(<Sidebar />);

    const openButton = screen.getByLabelText("メニューを開く");
    expect(screen.queryByTestId("mobile-sidebar-overlay")).not.toBeInTheDocument();

    fireEvent.click(openButton);

    const closeButtonDesktop = screen.getByLabelText("メニューを閉じる");
    expect(closeButtonDesktop).toBeInTheDocument();
    expect(screen.getByTestId("mobile-sidebar-overlay")).toBeInTheDocument();

    fireEvent.click(closeButtonDesktop);
    expect(screen.queryByTestId("mobile-sidebar-overlay")).not.toBeInTheDocument();

    fireEvent.click(openButton);
    const overlay = screen.getByTestId("mobile-sidebar-overlay");
    expect(overlay).toBeInTheDocument();

    fireEvent.click(overlay);
    expect(screen.queryByTestId("mobile-sidebar-overlay")).not.toBeInTheDocument();
  });

  it("closes the mobile sidebar when a link is clicked", () => {
    render(<Sidebar />);

    const openButton = screen.getByLabelText("メニューを開く");
    fireEvent.click(openButton);

    const homeLink = screen.getByRole("link", { name: "ホーム" });
    fireEvent.click(homeLink);

    expect(screen.queryByTestId("mobile-sidebar-overlay")).not.toBeInTheDocument();
  });

  it("styles the active link correctly", () => {
    (usePathname as jest.Mock).mockReturnValue("/playlists");
    render(<Sidebar />);

    const playlistLink = screen.getByRole("link", { name: "プレイリスト" });
    const homeLink = screen.getByRole("link", { name: "ホーム" });

    expect(playlistLink).toHaveClass("bg-zinc-800", "text-white");
    expect(homeLink).toHaveClass("text-zinc-400");
    expect(homeLink).not.toHaveClass("bg-zinc-800");
  });

  it("displays user information when logged in (with name and email)", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: { name: "Test User", email: "test@example.com" },
      },
    });

    render(<Sidebar />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("displays user information when logged in (email only)", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: { name: null, email: "test@example.com" },
      },
    });

    render(<Sidebar />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("does not display user information when not logged in", () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });

    render(<Sidebar />);

    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
  });

  it("routes to /reader when '新しい記事を読む' is clicked", () => {
    render(<Sidebar />);

    const newArticleButton = screen.getByText("新しい記事を読む");
    fireEvent.click(newArticleButton);

    expect(mockPush).toHaveBeenCalledWith("/reader");
  });

  it("calls handleSignOut when 'ログアウト' is clicked", () => {
    render(<Sidebar />);

    const logoutButton = screen.getByText("ログアウト");
    fireEvent.click(logoutButton);

    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });
});
