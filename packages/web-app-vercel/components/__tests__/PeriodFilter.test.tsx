import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeriodFilter } from "../PeriodFilter";

describe("PeriodFilter", () => {
  const mockOnPeriodChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all period buttons correctly", () => {
    render(
      <PeriodFilter
        activePeriod="today"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今週" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今月" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全期間" })).toBeInTheDocument();
  });

  it("applies active styling to the currently active period button", () => {
    const { rerender } = render(
      <PeriodFilter
        activePeriod="today"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    const todayButton = screen.getByRole("button", { name: "今日" });
    const weekButton = screen.getByRole("button", { name: "今週" });

    // 最初に today が active
    expect(todayButton).toHaveAttribute("aria-pressed", "true");
    expect(weekButton).toHaveAttribute("aria-pressed", "false");

    // week を active に変更
    rerender(
      <PeriodFilter
        activePeriod="week"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    expect(todayButton).toHaveAttribute("aria-pressed", "false");
    expect(weekButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onPeriodChange with the correct period when a button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <PeriodFilter
        activePeriod="today"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    // week ボタンをクリック
    await user.click(screen.getByRole("button", { name: "今週" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(1);
    expect(mockOnPeriodChange).toHaveBeenNthCalledWith(1, "week");

    // month ボタンをクリック
    await user.click(screen.getByRole("button", { name: "今月" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(2);
    expect(mockOnPeriodChange).toHaveBeenNthCalledWith(2, "month");

    // all ボタンをクリック
    await user.click(screen.getByRole("button", { name: "全期間" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(3);
    expect(mockOnPeriodChange).toHaveBeenNthCalledWith(3, "all");

    // today ボタンをクリック
    await user.click(screen.getByRole("button", { name: "今日" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(4);
    expect(mockOnPeriodChange).toHaveBeenNthCalledWith(4, "today");
  });
});
