import { render, screen } from "@testing-library/react";
import { AutoCloseComponent } from "../AutoCloseComponent";
import { useRouter } from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

describe("AutoCloseComponent", () => {
  const mockPush = jest.fn();
  const mockClose = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

    // Mock window.close
    window.close = mockClose;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("renders correctly with article title", () => {
    render(<AutoCloseComponent articleTitle="Test Article" />);

    expect(screen.getByText("追加しました")).toBeInTheDocument();
    expect(screen.getByText("Test Article")).toBeInTheDocument();
    expect(screen.getByText("読み込みプレイリストに追加されました")).toBeInTheDocument();
  });

  it("attempts to close window after 1 second", () => {
    render(<AutoCloseComponent articleTitle="Test Article" />);

    expect(mockClose).not.toHaveBeenCalled();

    // Fast-forward 1 second
    jest.advanceTimersByTime(1000);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to home if window.close fails/is ignored after 1.5 seconds", () => {
    render(<AutoCloseComponent articleTitle="Test Article" />);

    // Fast-forward 1.5 seconds (1000ms for close + 500ms for redirect)
    jest.advanceTimersByTime(1500);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("cleans up timers on unmount", () => {
    const { unmount } = render(<AutoCloseComponent articleTitle="Test Article" />);

    unmount();

    // Fast-forward timers
    jest.advanceTimersByTime(1500);

    // Should not have been called because timers were cleared
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
