import React from "react";
import { render, screen } from "@testing-library/react";
import { DomainBadge } from "../DomainBadge";

describe("DomainBadge", () => {
  it("renders correctly with 'qiita.com'", () => {
    render(<DomainBadge domain="qiita.com" />);
    const badge = screen.getByText("Qiita");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-green-950", "text-green-300");
  });

  it("renders correctly with 'zenn.dev'", () => {
    render(<DomainBadge domain="zenn.dev" />);
    const badge = screen.getByText("Zenn");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-blue-950", "text-blue-300");
  });

  it("renders correctly with an unknown domain", () => {
    render(<DomainBadge domain="example.com" />);
    const badge = screen.getByText("example.com");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-zinc-800", "text-zinc-300");
  });
});
