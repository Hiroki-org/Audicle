import React from "react";
import { render, screen } from "@testing-library/react";
import { DomainBadge } from "../DomainBadge";

it.each([
  ["qiita.com", "Qiita", "bg-green-950", "text-green-300"],
  ["Qiita.com", "Qiita", "bg-green-950", "text-green-300"],
  ["zenn.dev", "Zenn", "bg-blue-950", "text-blue-300"],
  ["example.com", "example.com", "bg-zinc-800", "text-zinc-300"],
])("renders correctly for %s", (domain, label, bgClass, textClass) => {
  render(<DomainBadge domain={domain} />);

  const badge = screen.getByText(label);
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass(bgClass, textClass);
});
