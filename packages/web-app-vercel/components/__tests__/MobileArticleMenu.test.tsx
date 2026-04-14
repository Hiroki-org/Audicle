import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileArticleMenu } from "../MobileArticleMenu";

describe("MobileArticleMenu", () => {
  const mockOnDownload = jest.fn();
  const mockWriteText = jest.fn().mockResolvedValue(undefined);
  const mockWindowOpen = jest.fn();

  const defaultProps = {
    articleUrl: "https://example.com/article",
    onDownload: mockOnDownload,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    jest.spyOn(window, "open").mockImplementation(mockWindowOpen);

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders only the toggle button initially", () => {
    render(<MobileArticleMenu {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "メニューを開く" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the menu when the toggle button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "元記事を開く" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "全文をダウンロード" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "URLをコピー" }),
    ).toBeInTheDocument();
  });

  it("closes the menu when clicking the toggle button again", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} />);

    const toggleButton = screen.getByRole("button", { name: "メニューを開く" });

    await user.click(toggleButton);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when pressing Escape", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when clicking the overlay", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByTestId("mobile-menu-overlay"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls window.open and closes menu when '元記事を開く' is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    await user.click(screen.getByRole("menuitem", { name: "元記事を開く" }));

    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://example.com/article",
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls onDownload and closes menu when '全文をダウンロード' is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    await user.click(
      screen.getByRole("menuitem", { name: "全文をダウンロード" }),
    );

    expect(mockOnDownload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("copies URL, shows notification, and hides it after 2 seconds", async () => {
    render(<MobileArticleMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "URLをコピー" }));
    });

    expect(mockWriteText).toHaveBeenCalledWith("https://example.com/article");

    expect(await screen.findByRole("status")).toHaveTextContent("URLをコピーしました");

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables download button and changes text when isDownloading is true", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<MobileArticleMenu {...defaultProps} isDownloading={true} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));

    const downloadButton = screen.getByRole("menuitem", {
      name: "ダウンロード中...",
    });
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).toBeDisabled();

    await user.click(downloadButton);
    expect(mockOnDownload).not.toHaveBeenCalled(); // Shouldn't be called because it's disabled
  });
});
