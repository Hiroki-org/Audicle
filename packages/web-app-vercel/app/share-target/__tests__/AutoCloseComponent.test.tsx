/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, act } from "@testing-library/react";
import { AutoCloseComponent } from "../AutoCloseComponent";

const mockPush = jest.fn();

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("AutoCloseComponent", () => {
  let originalWindowClose: () => void;
  let renderResult: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.close
    originalWindowClose = window.close;
    window.close = jest.fn();

    // Use fake timers for setTimeout
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (renderResult && renderResult.unmount) {
      renderResult.unmount();
    }
    // Restore window.close and real timers
    window.close = originalWindowClose;
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders the correct UI and article title", () => {
    const title = "Test Article Title";
    renderResult = render(<AutoCloseComponent articleTitle={title} />);

    expect(screen.getByText("追加しました")).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("読み込みプレイリストに追加されました")).toBeInTheDocument();
    expect(screen.getByText("このウィンドウは自動的に閉じます")).toBeInTheDocument();
  });

  it("attempts to close the window after 1 second", () => {
    renderResult = render(<AutoCloseComponent articleTitle="Test" />);

    expect(window.close).not.toHaveBeenCalled();

    // Advance timer by 1000ms
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to home if window.close fails (after additional 500ms)", () => {
    renderResult = render(<AutoCloseComponent articleTitle="Test" />);

    // Advance past the first timer (1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    // Advance past the second timer (500ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("cleans up timers when unmounted", () => {
    renderResult = render(<AutoCloseComponent articleTitle="Test" />);

    // Unmount before timers execute
    renderResult.unmount();
    renderResult = null; // prevent afterEach from unmounting again

    // Advance time past all timers
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Neither close nor push should have been called
    expect(window.close).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
