import React from "react";
import { render } from "@testing-library/react";
import { Spinner } from "../Spinner";

describe("Spinner", () => {
  it("renders with default props correctly", () => {
    const { container } = render(<Spinner />);
    const spinnerElement = container.firstChild as HTMLElement;

    expect(spinnerElement).toBeInTheDocument();

    // Default size is md, which maps to w-8 h-8
    expect(spinnerElement).toHaveClass("w-8", "h-8");

    // Should have basic classes
    expect(spinnerElement).toHaveClass(
      "inline-block",
      "animate-spin",
      "rounded-full",
      "border-2",
      "border-current",
      "border-t-transparent"
    );

    // Should have aria-hidden attribute
    expect(spinnerElement).toHaveAttribute("aria-hidden", "true");
  });

  it("renders with sm size", () => {
    const { container } = render(<Spinner size="sm" />);
    const spinnerElement = container.firstChild as HTMLElement;

    expect(spinnerElement).toHaveClass("w-4", "h-4");
  });

  it("renders with lg size", () => {
    const { container } = render(<Spinner size="lg" />);
    const spinnerElement = container.firstChild as HTMLElement;

    expect(spinnerElement).toHaveClass("w-12", "h-12");
  });

  it("renders with custom className", () => {
    const customClass = "test-custom-class text-red-500";
    const { container } = render(<Spinner className={customClass} />);
    const spinnerElement = container.firstChild as HTMLElement;

    // Should include the custom classes
    expect(spinnerElement).toHaveClass("test-custom-class", "text-red-500");
    // Should still have base classes
    expect(spinnerElement).toHaveClass("animate-spin");
  });
});
