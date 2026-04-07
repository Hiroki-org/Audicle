"use client";

import type { ReactNode } from "react";

interface DomainBadgeProps {
  domain: string;
}

const DOMAIN_CONFIG: Record<string, { label: string; color: string }> = {
  "qiita.com": { label: "Qiita", color: "bg-green-950 text-green-300" },
  "zenn.dev": { label: "Zenn", color: "bg-blue-950 text-blue-300" },
};

export function DomainBadge({ domain }: DomainBadgeProps) {
  const config = DOMAIN_CONFIG[domain];
  const label = config?.label || domain;
  const colorClass = config?.color || "bg-zinc-800 text-zinc-300";

  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}
