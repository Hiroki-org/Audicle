import React from "react";
import { render, screen } from "@testing-library/react";
import { DomainBadge } from "../DomainBadge";

describe("DomainBadge", () => {
  it.each([
    ["qiita.com", "Qiita", ["bg-green-950", "text-green-300"]],
    ["QIITA.COM", "Qiita", ["bg-green-950", "text-green-300"]],
    ["zenn.dev", "Zenn", ["bg-blue-950", "text-blue-300"]],
    ["example.com", "example.com", ["bg-zinc-800", "text-zinc-300"]],
    ["UNKNOWN.ORG", "UNKNOWN.ORG", ["bg-zinc-800", "text-zinc-300"]],
  ])("renders correctly for domain %s", (domain, expectedLabel, expectedClasses) => {
    render(<DomainBadge domain={domain} />);

    // For original unknown domains, the label is exactly what was passed.
    // However, if we're rendering "UNKNOWN.ORG", getByText finds it.
    const badge = screen.getByText(expectedLabel);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(...expectedClasses);
  });
});
