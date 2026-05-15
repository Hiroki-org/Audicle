import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodFilter } from "../PeriodFilter";
import type { Period } from "@/types/stats";

describe("PeriodFilter", () => {
  const mockOnPeriodChange = jest.fn();
  const periodCases: Array<{ period: Period; label: string }> = [
    { period: "today", label: "今日" },
    { period: "week", label: "今週" },
    { period: "month", label: "今月" },
    { period: "all", label: "全期間" },
  ];

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

    for (const { label } of periodCases) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it.each(periodCases)(
    "applies active styling only to the $period button",
    ({ period, label }) => {
      render(
        <PeriodFilter
          activePeriod={period}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      for (const periodCase of periodCases) {
        const button = screen.getByRole("button", { name: periodCase.label });
        if (periodCase.label === label) {
          expect(button).toHaveClass("bg-primary");
        } else {
          expect(button).not.toHaveClass("bg-primary");
        }
      }
    }
  );

  it("updates active styling when activePeriod changes", () => {
    const { rerender } = render(
      <PeriodFilter
        activePeriod="today"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    const todayButton = screen.getByRole("button", { name: "今日" });
    expect(todayButton).toHaveClass("bg-primary");

    rerender(
      <PeriodFilter
        activePeriod="week"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    const weekButton = screen.getByRole("button", { name: "今週" });
    expect(todayButton).not.toHaveClass("bg-primary");
    expect(weekButton).toHaveClass("bg-primary");
  });

  it("calls onPeriodChange with the correct period when a button is clicked", () => {
    render(
      <PeriodFilter
        activePeriod="today"
        onPeriodChange={mockOnPeriodChange}
      />
    );

    // week ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "今週" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(1);
    expect(mockOnPeriodChange).toHaveBeenCalledWith("week");

    // month ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "今月" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(2);
    expect(mockOnPeriodChange).toHaveBeenCalledWith("month");

    // all ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "全期間" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(3);
    expect(mockOnPeriodChange).toHaveBeenCalledWith("all");

    // today ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "今日" }));
    expect(mockOnPeriodChange).toHaveBeenCalledTimes(4);
    expect(mockOnPeriodChange).toHaveBeenCalledWith("today");
  });
});
