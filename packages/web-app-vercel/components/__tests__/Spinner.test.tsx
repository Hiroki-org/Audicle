import React from "react";
import { render } from "@testing-library/react";
import Spinner from "../Spinner";

describe("Spinner Component", () => {
  it("renders with default props correctly", () => {
    const { container } = render(<Spinner />);
    const span = container.firstChild as HTMLElement;
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("inline-block animate-spin rounded-full border-2 border-current border-t-transparent");
    expect(span).toHaveStyle({ width: "32px", height: "32px" });
    expect(span).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom size correctly", () => {
    const customSize = 48;
    const { container } = render(<Spinner size={customSize} />);
    const span = container.firstChild as HTMLElement;
    expect(span).toBeInTheDocument();
    expect(span).toHaveStyle({ width: `${customSize}px`, height: `${customSize}px` });
  });

  it("applies custom className correctly", () => {
    const customClass = "text-red-500 custom-margin";
    const { container } = render(<Spinner className={customClass} />);
    const span = container.firstChild as HTMLElement;
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("text-red-500 custom-margin");
    // Ensure default classes are still there
    expect(span).toHaveClass("inline-block animate-spin");
  });
});
