import React from "react";

const SIZE_CLASSES = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
} as const;

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${SIZE_CLASSES[size]} ${className || ''}`}
      aria-hidden="true"
      data-testid="spinner"
    />
  );
}
