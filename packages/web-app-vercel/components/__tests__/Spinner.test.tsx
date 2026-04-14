import React from "react";
import { render } from "@testing-library/react";
import Spinner from "../Spinner";

describe("Spinner", () => {
  it("renders with default props", () => {
    const { container } = render(<Spinner />);
    const span = container.firstChild as HTMLElement;

    expect(span).toBeInTheDocument();
    expect(span).toHaveClass(
      "inline-block",
      "animate-spin",
      "rounded-full",
      "border-2",
      "border-current",
      "border-t-transparent",
    );
    expect(span).toHaveStyle({ width: "32px", height: "32px" });
    expect(span).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom size correctly", () => {
    const { container } = render(<Spinner size={48} />);
    const span = container.firstChild as HTMLElement;

    expect(span).toHaveStyle({ width: "48px", height: "48px" });
  });

  it("appends custom className", () => {
    const { container } = render(<Spinner className="text-red-500" />);
    const span = container.firstChild as HTMLElement;

    expect(span).toHaveClass("text-red-500");
    expect(span).toHaveClass("animate-spin"); // Ensure base classes are still there
  });
});
