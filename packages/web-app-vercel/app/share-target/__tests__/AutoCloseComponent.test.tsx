import { render, screen, act } from "@testing-library/react";
import { AutoCloseComponent } from "../AutoCloseComponent";
import { useRouter } from "next/navigation";

// Mock useRouter
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

describe("AutoCloseComponent", () => {
  let mockPush: jest.Mock;
  let originalClose: () => void;

  beforeEach(() => {
    jest.useFakeTimers();

    mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

    originalClose = window.close;
    window.close = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    window.close = originalClose;
  });

  it("should render the article title correctly", () => {
    render(<AutoCloseComponent articleTitle="Test Article" />);

    expect(screen.getByText("Test Article")).toBeInTheDocument();
    expect(screen.getByText("追加しました")).toBeInTheDocument();
  });

  it("should call window.close after 1000ms", () => {
    render(<AutoCloseComponent articleTitle="Test Article" />);

    expect(window.close).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(window.close).toHaveBeenCalledTimes(1);
    // At this point router.push should not be called yet
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should redirect to home 500ms after window.close is called", () => {
    render(<AutoCloseComponent articleTitle="Test Article" />);

    act(() => {
      // 1000ms + 500ms
      jest.advanceTimersByTime(1500);
    });

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("should clear timers on unmount", () => {
    const { unmount } = render(<AutoCloseComponent articleTitle="Test Article" />);

    unmount();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(window.close).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
